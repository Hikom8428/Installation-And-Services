import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAssignedTaskIds, attachAssignments, attachStepSummary, getCompletedCycles } from "@/lib/taskAssignments";
import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";

const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024; // 5MB
const MAX_PHOTO_BYTES = 8 * 1024 * 1024; // 8MB
const MAX_VIDEO_BYTES = 100 * 1024 * 1024; // 100MB
const MAX_PHOTOS = 10;
const MAX_VIDEOS = 2;

async function saveUpload(file: File): Promise<string> {
  const uploadDir = path.join(process.cwd(), "public", "uploads", "complaints");
  await mkdir(uploadDir, { recursive: true });

  const ext = path.extname(file.name) || "";
  const filename = `${randomUUID()}${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(uploadDir, filename), buffer);

  return `/uploads/complaints/${filename}`;
}

// Create a new complaint (Open for public or staff) — accepts multipart/form-data
// for the optional invoice/bill attachment and the problem photos/videos.
export async function POST(req: Request) {
  try {
    const formData = await req.formData();

    const jobNo = (formData.get("jobNo") as string | null)?.trim() || null;
    const doorSerialNo = (formData.get("doorSerialNo") as string | null)?.trim() || null;
    const customerName = (formData.get("customerName") as string | null)?.trim();
    const customerPhone = (formData.get("customerPhone") as string | null)?.trim();
    const customerEmail = (formData.get("customerEmail") as string | null)?.trim() || null;
    const siteAddress = (formData.get("siteAddress") as string | null)?.trim() || null;
    const attendantName = (formData.get("attendantName") as string | null)?.trim() || null;
    const attendantPhone = (formData.get("attendantPhone") as string | null)?.trim() || null;
    const issueDescription = (formData.get("issueDescription") as string | null)?.trim();
    const attachment = formData.get("attachment");

    const latRaw = formData.get("siteLatitude") as string | null;
    const lngRaw = formData.get("siteLongitude") as string | null;
    const siteLatitude = latRaw ? parseFloat(latRaw) : null;
    const siteLongitude = lngRaw ? parseFloat(lngRaw) : null;

    if (!jobNo && !doorSerialNo) {
      return NextResponse.json({ message: "Please provide either Job No or Door Serial No" }, { status: 400 });
    }
    if (!customerName || !customerPhone || !issueDescription) {
      return NextResponse.json({ message: "Customer Name, Mobile Number, and Issue Description are required" }, { status: 400 });
    }
    if (!attendantName || !attendantPhone) {
      return NextResponse.json({ message: "Site Attendant Name and Mobile No are required" }, { status: 400 });
    }

    let attachmentUrl: string | null = null;
    if (attachment instanceof File && attachment.size > 0) {
      if (attachment.size > MAX_ATTACHMENT_BYTES) {
        return NextResponse.json({ message: "Invoice/Bill attachment must be 5MB or smaller" }, { status: 400 });
      }
      attachmentUrl = await saveUpload(attachment);
    }

    const photos = formData.getAll("photos").filter((f): f is File => f instanceof File && f.size > 0);
    const videos = formData.getAll("videos").filter((f): f is File => f instanceof File && f.size > 0);

    if (photos.length < 1) {
      return NextResponse.json({ message: "Please upload at least 1 problem photo" }, { status: 400 });
    }
    if (videos.length < 1) {
      return NextResponse.json({ message: "Please upload at least 1 problem video" }, { status: 400 });
    }
    if (photos.length > MAX_PHOTOS) {
      return NextResponse.json({ message: `You can upload at most ${MAX_PHOTOS} photos` }, { status: 400 });
    }
    if (videos.length > MAX_VIDEOS) {
      return NextResponse.json({ message: `You can upload at most ${MAX_VIDEOS} videos` }, { status: 400 });
    }
    for (const photo of photos) {
      if (photo.size > MAX_PHOTO_BYTES) {
        return NextResponse.json({ message: `Photo "${photo.name}" must be 8MB or smaller` }, { status: 400 });
      }
    }
    for (const video of videos) {
      if (video.size > MAX_VIDEO_BYTES) {
        return NextResponse.json({ message: `Video "${video.name}" must be 100MB or smaller` }, { status: 400 });
      }
    }

    const mediaUrls: string[] = [];
    for (const file of [...photos, ...videos]) {
      mediaUrls.push(await saveUpload(file));
    }

    const complaint = await prisma.complaint.create({
      data: {
        jobNo,
        doorSerialNo,
        customerName,
        customerPhone,
        customerEmail,
        siteAddress,
        siteLatitude,
        siteLongitude,
        attendantName,
        attendantPhone,
        issueDescription,
        attachmentUrl,
        mediaUrls: mediaUrls.length > 0 ? mediaUrls : undefined,
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
export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const isDoer = session.user.role === "DOER";

    const pendingWhere = isDoer
      ? { id: { in: await getAssignedTaskIds("COMPLAINT", session.user.id) }, status: { not: "COMPLETED" } }
      : { status: { not: "COMPLETED" } };
    const pendingTasks = await prisma.complaint.findMany({ where: pendingWhere, orderBy: { createdAt: "desc" } });
    const pendingWithAssignments = await attachAssignments("COMPLAINT", pendingTasks);
    const pending = await attachStepSummary("COMPLAINT", pendingWithAssignments);

    const cycles = await getCompletedCycles("COMPLAINT", isDoer ? session.user.id : undefined);
    const baseIds = [...new Set(cycles.map((c) => c.taskId))];
    const baseTasks = baseIds.length ? await prisma.complaint.findMany({ where: { id: { in: baseIds } } }) : [];
    const baseById = new Map(baseTasks.map((t) => [t.id, t]));

    const completed = cycles
      .map((c) => {
        const base = baseById.get(c.taskId);
        if (!base) return null;
        return {
          ...base,
          id: `${c.taskId}::c${c.cycle}`,
          taskId: c.taskId,
          cycle: c.cycle,
          roundLabel: `Round ${c.cycle}`,
          isReopenable: base.status === "COMPLETED" && base.currentCycle === c.cycle,
          status: "COMPLETED",
          assignments: c.assignments,
          stepSummary: c.stepSummary,
        };
      })
      .filter((c): c is NonNullable<typeof c> => c !== null)
      .sort((a, b) => (b.stepSummary.step3At?.getTime() || 0) - (a.stepSummary.step3At?.getTime() || 0));

    return NextResponse.json({ pending, completed }, { status: 200 });
  } catch (error) {
    console.error("Error fetching complaints:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
