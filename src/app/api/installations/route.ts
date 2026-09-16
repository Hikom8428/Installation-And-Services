import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    let installations;

    if (session.user.role === "DOER") {
      installations = await prisma.installation.findMany({
        where: { assignedDoerId: session.user.id },
        orderBy: { syncDate: 'desc' }
      });
    } else {
      installations = await prisma.installation.findMany({
        orderBy: { syncDate: 'desc' },
        include: {
          assignedDoer: {
            select: { name: true }
          }
        }
      });
    }

    return NextResponse.json(installations, { status: 200 });
  } catch (error) {
    console.error("Error fetching installations:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}

