import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAssignedTaskIds } from "@/lib/taskAssignments";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    // Doers only see counts for work assigned to them; everyone else sees the org-wide totals.
    const isDoer = session.user.role === "DOER";
    const installationWhere = isDoer
      ? { id: { in: await getAssignedTaskIds("INSTALLATION", session.user.id) } }
      : {};
    const complaintWhere = isDoer
      ? { id: { in: await getAssignedTaskIds("COMPLAINT", session.user.id) } }
      : {};

    const [pendingInstallations, activeComplaints, resolvedComplaints, totalDoers] = await Promise.all([
      prisma.installation.count({ where: { ...installationWhere, status: "PENDING" } }),
      prisma.complaint.count({ where: { ...complaintWhere, status: { not: "COMPLETED" } } }),
      prisma.complaint.count({ where: { ...complaintWhere, status: "COMPLETED" } }),
      prisma.user.count({ where: { role: "DOER" } }),
    ]);

    return NextResponse.json(
      { pendingInstallations, activeComplaints, resolvedComplaints, totalDoers },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error fetching dashboard stats:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
