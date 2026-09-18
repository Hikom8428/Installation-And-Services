import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

function isStaff(role: string) {
  return role === "MASTER" || role === "ADMIN" || role === "MANAGER";
}

// Can the acting user manage (edit/delete) the target user?
// MASTER can manage anyone. ADMIN can manage MANAGER/DOER accounts (mirrors
// the "only MASTER can create ADMIN" rule on creation). MANAGER can only
// manage DOER accounts.
function canManage(actingRole: string, targetRole: string) {
  if (actingRole === "MASTER") return true;
  if (actingRole === "ADMIN") return targetRole === "MANAGER" || targetRole === "DOER";
  if (actingRole === "MANAGER") return targetRole === "DOER";
  return false;
}

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
    const target = await prisma.user.findUnique({ where: { id } });
    if (!target) {
      return NextResponse.json({ message: "User not found" }, { status: 404 });
    }

    if (!canManage(session.user.role, target.role)) {
      return NextResponse.json({ message: "You are not allowed to edit this user" }, { status: 403 });
    }

    const { name, email, password, role } = await req.json();

    if (role === "ADMIN" && session.user.role !== "MASTER") {
      return NextResponse.json({ message: "Only Master can assign the Admin role" }, { status: 403 });
    }

    if (role && role !== "DOER" && session.user.role === "MANAGER") {
      return NextResponse.json({ message: "Managers can only manage Doer accounts" }, { status: 403 });
    }

    if (email && email !== target.email) {
      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing) {
        return NextResponse.json({ message: "User with this email already exists" }, { status: 400 });
      }
    }

    const data: { name?: string; email?: string; role?: string; password?: string } = {};
    if (name) data.name = name;
    if (email) data.email = email;
    if (role) data.role = role;
    if (password) data.password = await bcrypt.hash(password, 10);

    const updated = await prisma.user.update({
      where: { id },
      data,
      select: { id: true, name: true, email: true, role: true, createdAt: true },
    });

    return NextResponse.json(updated, { status: 200 });
  } catch (error) {
    console.error("Error updating user:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}

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

    if (id === session.user.id) {
      return NextResponse.json({ message: "You cannot delete your own account" }, { status: 400 });
    }

    const target = await prisma.user.findUnique({ where: { id } });
    if (!target) {
      return NextResponse.json({ message: "User not found" }, { status: 404 });
    }

    if (!canManage(session.user.role, target.role)) {
      return NextResponse.json({ message: "You are not allowed to delete this user" }, { status: 403 });
    }

    await prisma.user.delete({ where: { id } });

    return NextResponse.json({ message: "User deleted" }, { status: 200 });
  } catch (error) {
    // Doers keep a permanent TaskAssignment history (see the reopen/round
    // feature) — the FK on doerId is ON DELETE RESTRICT, so a Doer who has
    // ever worked on anything can't be hard-deleted.
    if (error && typeof error === "object" && "code" in error && error.code === "P2003") {
      return NextResponse.json(
        { message: "This user has task assignment history and cannot be deleted. Remove or reassign their tasks first if needed." },
        { status: 400 }
      );
    }
    console.error("Error deleting user:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
