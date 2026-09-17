import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getDoerOccupancy } from "@/lib/taskAssignments";

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || (session.user.role !== "MASTER" && session.user.role !== "ADMIN" && session.user.role !== "MANAGER")) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const doers = await prisma.user.findMany({
      where: { role: "DOER" },
      select: { id: true, name: true, email: true },
    });

    const occupancy = await getDoerOccupancy(doers.map((d) => d.id));
    const withOccupancy = doers.map((d) => ({ ...d, occupied: occupancy.get(d.id) || [] }));

    return NextResponse.json(withOccupancy, { status: 200 });
  } catch (error) {
    console.error("Error fetching doers:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}

