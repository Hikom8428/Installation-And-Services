import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { assignDoers, unassignDoer } from "@/lib/taskAssignments";

function isStaff(role: string) {
  return role === "MASTER" || role === "ADMIN" || role === "MANAGER";
}

// Assign one or more Doers to a complaint (additive — doesn't remove anyone
// already assigned), with an optional shared cash advance ("fund").
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

    const complaint = await prisma.complaint.findUnique({ where: { id } });
    if (!complaint) {
      return NextResponse.json({ message: "Complaint not found" }, { status: 404 });
    }

    await assignDoers("COMPLAINT", id, doerIds, fundAmount, fundNotes);

    const updated = await prisma.complaint.findUnique({ where: { id } });
    return NextResponse.json(updated, { status: 200 });
  } catch (error) {
    console.error("Error assigning complaint:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}

// DELETE /api/complaints/[id]?doerId=xxx — unassign a single Doer (any staff).
// DELETE /api/complaints/[id] (no doerId) — permanently delete the whole
// complaint record, e.g. to remove a duplicate. Master only.
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

    if (doerId) {
      await unassignDoer("COMPLAINT", id, doerId);
      return NextResponse.json({ message: "Doer unassigned" }, { status: 200 });
    }

    if (session.user.role !== "MASTER") {
      return NextResponse.json({ message: "Only Master can delete a Complaint" }, { status: 403 });
    }

    const existing = await prisma.complaint.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ message: "Complaint not found" }, { status: 404 });
    }

    await prisma.taskAssignment.deleteMany({ where: { taskType: "COMPLAINT", taskId: id } });
    await prisma.taskStep.deleteMany({ where: { taskType: "COMPLAINT", taskId: id } });
    await prisma.complaint.delete({ where: { id } });

    return NextResponse.json({ message: "Complaint deleted" }, { status: 200 });
  } catch (error) {
    console.error("Error deleting complaint:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
