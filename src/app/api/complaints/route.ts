import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";

const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024; // 5MB

async function saveAttachment(file: File): Promise<string> {
  const uploadDir = path.join(process.cwd(), "public", "uploads", "complaints");
  await mkdir(uploadDir, { recursive: true });

  const ext = path.extname(file.name) || "";
  const filename = `${randomUUID()}${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(uploadDir, filename), buffer);

  return `/uploads/complaints/${filename}`;
}

// Create a new complaint (Open for public or staff) — accepts multipart/form-data
// so the optional invoice/bill attachment can be uploaded alongside the fields.
export async function POST(req: Request) {
  try {
    const formData = await req.formData();

    const jobNo = (formData.get("jobNo") as string | null)?.trim() || null;
    const customerName = (formData.get("customerName") as string | null)?.trim();
    const customerPhone = (formData.get("customerPhone") as string | null)?.trim();
    const customerEmail = (formData.get("customerEmail") as string | null)?.trim() || null;
    const issueDescription = (formData.get("issueDescription") as string | null)?.trim();
    const attachment = formData.get("attachment");

    if (!jobNo || !customerName || !customerPhone || !issueDescription) {
      return NextResponse.json({ message: "Job No, Customer Name, Mobile Number, and Issue Description are required" }, { status: 400 });
    }

    let attachmentUrl: string | null = null;
    if (attachment instanceof File && attachment.size > 0) {
      if (attachment.size > MAX_ATTACHMENT_BYTES) {
        return NextResponse.json({ message: "Attachment must be 5MB or smaller" }, { status: 400 });
      }
      attachmentUrl = await saveAttachment(attachment);
    }

    const complaint = await prisma.complaint.create({
      data: {
        jobNo,
        customerName,
        customerPhone,
        customerEmail,
        issueDescription,
        attachmentUrl,
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

