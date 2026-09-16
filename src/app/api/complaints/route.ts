import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// Create a new complaint (Open for public or staff)
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { customerName, customerPhone, issueDescription } = body;

    if (!customerName || !customerPhone || !issueDescription) {
      return NextResponse.json({ message: "All fields are required" }, { status: 400 });
    }

    const complaint = await prisma.complaint.create({
      data: {
        customerName,
        customerPhone,
        issueDescription,
        status: "PENDING",
      },
    });

    return NextResponse.json({ message: "Complaint registered successfully", complaint }, { status: 201 });
  } catch (error) {
    console.error("Complaint creation error:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}

// Get all complaints (For Dashboard - requires auth)
export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    let complaints;
    
    // If Doer, only fetch their assigned complaints
    if (session.user.role === "DOER") {
      complaints = await prisma.complaint.findMany({
        where: { assignedDoerId: session.user.id },
        orderBy: { createdAt: 'desc' }
      });
    } else {
      // Master, Admin, Manager can see all complaints
      complaints = await prisma.complaint.findMany({
        orderBy: { createdAt: 'desc' },
        include: {
          assignedDoer: {
            select: { name: true }
          }
        }
      });
    }

    return NextResponse.json(complaints, { status: 200 });
  } catch (error) {
    console.error("Error fetching complaints:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}

