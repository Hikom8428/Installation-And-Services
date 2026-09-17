import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// Assign a Doer to a Site Visit. Status changes past this point are driven
// by the Doer's TaskStep progress (see /api/task-steps), not a direct PATCH.
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user.role !== "MASTER" && session.user.role !== "ADMIN" && session.user.role !== "MANAGER")) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const { assignedDoerId } = await req.json();

    if (!assignedDoerId) {
      return NextResponse.json({ message: "assignedDoerId is required" }, { status: 400 });
    }

    const siteVisit = await prisma.siteVisit.findUnique({ where: { id } });
    if (!siteVisit) {
      return NextResponse.json({ message: "Site Visit not found" }, { status: 404 });
    }

    const updated = await prisma.siteVisit.update({
      where: { id },
      data: { assignedDoerId, status: "ASSIGNED" },
    });

    return NextResponse.json(updated, { status: 200 });
  } catch (error) {
    console.error("Error assigning site visit:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
