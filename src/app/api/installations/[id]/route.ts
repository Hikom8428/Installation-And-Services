import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();
    const { assignedDoerId, status } = body;

    const installation = await prisma.installation.findUnique({ where: { id } });
    if (!installation) {
      return NextResponse.json({ message: "Installation not found" }, { status: 404 });
    }

    // Manager/Admin can assign doer
    if (assignedDoerId && (session.user.role === "MANAGER" || session.user.role === "ADMIN" || session.user.role === "MASTER")) {
      const updatedInstallation = await prisma.installation.update({
        where: { id },
        data: {
          assignedDoerId,
          status: "ASSIGNED"
        }
      });
      return NextResponse.json(updatedInstallation, { status: 200 });
    }

    // Doer can update status
    if (status && session.user.role === "DOER" && installation.assignedDoerId === session.user.id) {
      const updatedInstallation = await prisma.installation.update({
        where: { id },
        data: { status: status }
      });
      return NextResponse.json(updatedInstallation, { status: 200 });
    }

    return NextResponse.json({ message: "Forbidden or invalid data" }, { status: 403 });
  } catch (error) {
    console.error("Error updating installation:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
