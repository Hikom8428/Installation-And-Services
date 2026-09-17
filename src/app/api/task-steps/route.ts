import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { isTaskAssignedToDoer } from "@/lib/taskAssignments";
import { sendPushToUsers } from "@/lib/onesignal-server";

const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8MB
const MAX_VIDEO_BYTES = 30 * 1024 * 1024; // 30MB

type TaskType = "INSTALLATION" | "COMPLAINT" | "SITE_VISIT";

const taskTypeLabel: Record<TaskType, string> = {
  INSTALLATION: "Installation",
  COMPLAINT: "Complaint",
  SITE_VISIT: "Site Visit",
};

async function notifyStaffOfStepCompletion(taskType: TaskType, stepNumber: number, doerName: string, taskLabel: string) {
  const staff = await prisma.user.findMany({
    where: { role: { in: ["MASTER", "ADMIN", "MANAGER"] } },
    select: { id: true },
  });
  if (staff.length === 0) return;
  await sendPushToUsers({
    userIds: staff.map((s) => s.id),
    title: `Step ${stepNumber} completed`,
    message: `${doerName} completed Step ${stepNumber} for ${taskTypeLabel[taskType]}: ${taskLabel}.`,
  });
}

// All task types share the same 3-step flow: site photo/video+location,
// then work evidence (or, for SiteVisit, visit notes + chart), then expense/bills.
function totalStepsFor(_taskType: TaskType) {
  return 3;
}

async function getTask(taskType: TaskType, taskId: string) {
  if (taskType === "INSTALLATION") {
    return prisma.installation.findUnique({ where: { id: taskId } });
  }
  if (taskType === "SITE_VISIT") {
    return prisma.siteVisit.findUnique({ where: { id: taskId } });
  }
  return prisma.complaint.findUnique({ where: { id: taskId } });
}

async function setTaskStatus(taskType: TaskType, taskId: string, status: string) {
  if (taskType === "INSTALLATION") {
    await prisma.installation.update({ where: { id: taskId }, data: { status } });
  } else if (taskType === "SITE_VISIT") {
    await prisma.siteVisit.update({ where: { id: taskId }, data: { status } });
  } else {
    await prisma.complaint.update({ where: { id: taskId }, data: { status } });
  }
}

async function saveUploadedFile(file: File, maxBytes: number): Promise<string> {
  if (file.size > maxBytes) {
    throw new Error(`FILE_TOO_LARGE:${file.name}`);
  }
  const uploadDir = path.join(process.cwd(), "public", "uploads", "task-steps");
  await mkdir(uploadDir, { recursive: true });
  const ext = path.extname(file.name) || "";
  const filename = `${randomUUID()}${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(uploadDir, filename), buffer);
  return `/uploads/task-steps/${filename}`;
}

function isValidTaskType(value: string | null): value is TaskType {
  return value === "INSTALLATION" || value === "COMPLAINT" || value === "SITE_VISIT";
}

// GET /api/task-steps?taskType=INSTALLATION&taskId=xxx
// Returns the current step progress for one task.
export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const taskType = searchParams.get("taskType");
    const taskId = searchParams.get("taskId");

    if (!isValidTaskType(taskType) || !taskId) {
      return NextResponse.json({ message: "taskType and taskId are required" }, { status: 400 });
    }

    const task = await getTask(taskType, taskId);
    if (!task) {
      return NextResponse.json({ message: "Task not found" }, { status: 404 });
    }

    const isAssignedDoer =
      session.user.role === "DOER" && (await isTaskAssignedToDoer(taskType, taskId, session.user.id));
    const isStaff = session.user.role === "MASTER" || session.user.role === "ADMIN" || session.user.role === "MANAGER";
    if (!isAssignedDoer && !isStaff) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const step = await prisma.taskStep.findUnique({ where: { taskType_taskId: { taskType, taskId } } });

    return NextResponse.json({ step }, { status: 200 });
  } catch (error) {
    console.error("Error fetching task step:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}

// POST /api/task-steps — multipart/form-data. Only the Doer assigned to the
// task can submit a step, and steps must be completed in order (1, 2, 3).
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== "DOER") {
      return NextResponse.json({ message: "Only the assigned Doer can update task progress" }, { status: 401 });
    }

    const formData = await req.formData();
    const taskType = formData.get("taskType") as string | null;
    const taskId = formData.get("taskId") as string | null;
    const step = formData.get("step") as string | null;

    if (!isValidTaskType(taskType) || !taskId || !["1", "2", "3"].includes(step || "")) {
      return NextResponse.json({ message: "taskType, taskId, and a valid step (1-3) are required" }, { status: 400 });
    }

    const task = await getTask(taskType, taskId);
    if (!task) {
      return NextResponse.json({ message: "Task not found" }, { status: 404 });
    }
    if (!(await isTaskAssignedToDoer(taskType, taskId, session.user.id))) {
      return NextResponse.json({ message: "This task is not assigned to you" }, { status: 403 });
    }

    const maxStep = totalStepsFor(taskType);
    if (Number(step) > maxStep) {
      return NextResponse.json({ message: `This task only has ${maxStep} steps` }, { status: 400 });
    }

    const existing = await prisma.taskStep.findUnique({ where: { taskType_taskId: { taskType, taskId } } });

    if (step === "1") {
      const sitePhoto = formData.get("sitePhoto");
      const siteVideo = formData.get("siteVideo");
      const latitude = parseFloat((formData.get("latitude") as string) || "");
      const longitude = parseFloat((formData.get("longitude") as string) || "");

      if (!(sitePhoto instanceof File) || sitePhoto.size === 0) {
        return NextResponse.json({ message: "Site photo is required" }, { status: 400 });
      }
      if (Number.isNaN(latitude) || Number.isNaN(longitude)) {
        return NextResponse.json({ message: "Location (latitude/longitude) is required — please allow location access" }, { status: 400 });
      }

      const sitePhotoUrl = await saveUploadedFile(sitePhoto, MAX_IMAGE_BYTES);
      let siteVideoUrl: string | null = null;
      if (siteVideo instanceof File && siteVideo.size > 0) {
        siteVideoUrl = await saveUploadedFile(siteVideo, MAX_VIDEO_BYTES);
      }

      await prisma.taskStep.upsert({
        where: { taskType_taskId: { taskType, taskId } },
        update: { sitePhotoUrl, siteVideoUrl, latitude, longitude, step1At: new Date() },
        create: { taskType, taskId, sitePhotoUrl, siteVideoUrl, latitude, longitude, step1At: new Date() },
      });

      if (task.status !== "COMPLETED") {
        await setTaskStatus(taskType, taskId, "IN_PROGRESS");
      }
    } else if (step === "2") {
      if (!existing?.step1At) {
        return NextResponse.json({ message: "Complete Step 1 first" }, { status: 400 });
      }

      if (taskType === "SITE_VISIT") {
        const notes = ((formData.get("notes") as string) || "").trim();
        const chart = formData.get("chart");
        if (!notes) {
          return NextResponse.json({ message: "Site visit details are required" }, { status: 400 });
        }
        if (!(chart instanceof File) || chart.size === 0) {
          return NextResponse.json({ message: "Site chart/calculation file is required" }, { status: 400 });
        }
        const chartUrl = await saveUploadedFile(chart, MAX_IMAGE_BYTES);

        await prisma.taskStep.update({
          where: { taskType_taskId: { taskType, taskId } },
          data: { notes, chartUrl, step2At: new Date() },
        });
      } else {
        const evidence = formData.get("evidence");
        if (!(evidence instanceof File) || evidence.size === 0) {
          return NextResponse.json({ message: "Work-complete evidence file is required" }, { status: 400 });
        }
        const evidenceUrl = await saveUploadedFile(evidence, MAX_VIDEO_BYTES);

        await prisma.taskStep.update({
          where: { taskType_taskId: { taskType, taskId } },
          data: { evidenceUrl, step2At: new Date() },
        });
      }
    } else {
      // step === "3"
      if (!existing?.step2At) {
        return NextResponse.json({ message: "Complete Step 2 first" }, { status: 400 });
      }
      const expenseAmount = parseFloat((formData.get("expenseAmount") as string) || "");
      const expenseNotes = ((formData.get("expenseNotes") as string) || "").trim() || null;
      const bills = formData.getAll("bills").filter((b): b is File => b instanceof File && b.size > 0);

      if (Number.isNaN(expenseAmount)) {
        return NextResponse.json({ message: "Expense amount is required" }, { status: 400 });
      }

      const billUrls: string[] = [];
      for (const bill of bills) {
        billUrls.push(await saveUploadedFile(bill, MAX_IMAGE_BYTES));
      }

      await prisma.taskStep.update({
        where: { taskType_taskId: { taskType, taskId } },
        data: { expenseAmount, expenseNotes, billUrls, step3At: new Date() },
      });

      await setTaskStatus(taskType, taskId, "COMPLETED");
    }

    await notifyStaffOfStepCompletion(taskType, Number(step), session.user.name || "A Doer", task.customerName);

    const updated = await prisma.taskStep.findUnique({ where: { taskType_taskId: { taskType, taskId } } });
    return NextResponse.json({ step: updated }, { status: 200 });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("FILE_TOO_LARGE")) {
      return NextResponse.json({ message: `File too large: ${error.message.split(":")[1]}` }, { status: 400 });
    }
    console.error("Error saving task step:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
