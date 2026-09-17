import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { assignDoers, unassignDoer } from "@/lib/taskAssignments";

function isStaff(role: string) {
  return role === "MASTER" || role === "ADMIN" || role === "MANAGER";
}

// Assign one or more Doers to a Site Visit (additive — doesn't remove anyone
// already assigned), with an optional shared cash advance ("fund"). Status
// changes past this point are driven by the Doer's TaskStep progress.
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !isStaff(session.user.role)) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();
    const doerIds: string[] = Array.isArray(body.doerIds)
      ? body.doerIds
      : body.assignedDoerId
        ? [body.assignedDoerId]
        : [];
    const fundAmount = typeof body.fundAmount === "number" ? body.fundAmount : null;
    const fundNotes = (body.fundNotes || "").trim() || null;

    if (doerIds.length === 0) {
      return NextResponse.json({ message: "At least one doerId is required" }, { status: 400 });
    }

    const siteVisit = await prisma.siteVisit.findUnique({ where: { id } });
    if (!siteVisit) {
      return NextResponse.json({ message: "Site Visit not found" }, { status: 404 });
    }

    await assignDoers("SITE_VISIT", id, doerIds, fundAmount, fundNotes);

    if (siteVisit.status === "PENDING") {
      await prisma.siteVisit.update({ where: { id }, data: { status: "ASSIGNED" } });
    }

    const updated = await prisma.siteVisit.findUnique({ where: { id } });
    return NextResponse.json(updated, { status: 200 });
  } catch (error) {
    console.error("Error assigning site visit:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}

// Unassign a single Doer: DELETE /api/site-visits/[id]?doerId=xxx
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !isStaff(session.user.role)) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const doerId = new URL(req.url).searchParams.get("doerId");
    if (!doerId) {
      return NextResponse.json({ message: "doerId query param is required" }, { status: 400 });
    }

    await unassignDoer("SITE_VISIT", id, doerId);
    return NextResponse.json({ message: "Doer unassigned" }, { status: 200 });
  } catch (error) {
    console.error("Error unassigning site visit doer:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
