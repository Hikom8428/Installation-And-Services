import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { getDoerOccupancy } from "@/lib/taskAssignments";

function isStaff(role: string) {
  return role === "MASTER" || role === "ADMIN" || role === "MANAGER";
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !isStaff(session.user.role)) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const users = await prisma.user.findMany({
      select: { id: true, name: true, email: true, role: true, lastLoginAt: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    });

    const doerIds = users.filter((u) => u.role === "DOER").map((u) => u.id);
    const occupancy = await getDoerOccupancy(doerIds);
    const withOccupancy = users.map((u) => ({
      ...u,
      occupied: u.role === "DOER" ? occupancy.get(u.id) || [] : undefined,
    }));

    return NextResponse.json(withOccupancy, { status: 200 });
  } catch (error) {
    console.error("Error fetching users:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !isStaff(session.user.role)) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { name, email, password, role } = await req.json();

    if (!name || !email || !password || !role) {
      return NextResponse.json({ message: "Missing required fields" }, { status: 400 });
    }

    // Only MASTER can create ADMIN
    if (role === "ADMIN" && session.user.role !== "MASTER") {
      return NextResponse.json({ message: "Only Master can create Admins" }, { status: 403 });
    }

    // MANAGER can only create DOER accounts
    if (session.user.role === "MANAGER" && role !== "DOER") {
      return NextResponse.json({ message: "Managers can only create Doer accounts" }, { status: 403 });
    }

    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json({ message: "User with this email already exists" }, { status: 400 });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role: role,
      },
    });

    return NextResponse.json({ 
      message: "User created successfully", 
      user: { id: newUser.id, name: newUser.name, email: newUser.email, role: newUser.role } 
    }, { status: 201 });

  } catch (error) {
    console.error("User creation error:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}

