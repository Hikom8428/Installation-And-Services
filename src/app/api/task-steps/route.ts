import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { isTaskAssignedToDoer, isTaskAssignedToDoerInCycle } from "@/lib/taskAssignments";
import { getTaskCore, updateTaskCore, TaskType } from "@/lib/taskCore";
import { sendPushToUsers } from "@/lib/onesignal-server";

const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8MB
const MAX_VIDEO_BYTES = 30 * 1024 * 1024; // 30MB

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

// GET /api/task-steps?taskType=INSTALLATION&taskId=xxx&cycle=2
// Returns step progress for one task. `cycle` is optional and defaults to
// the task's current (active) cycle — pass a past cycle number to view
// history from a previous round.
export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const taskType = searchParams.get("taskType");
    const taskId = searchParams.get("taskId");
    const cycleParam = searchParams.get("cycle");

    if (!isValidTaskType(taskType) || !taskId) {
      return NextResponse.json({ message: "taskType and taskId are required" }, { status: 400 });
    }

    const task = await getTaskCore(taskType, taskId);
    if (!task) {
      return NextResponse.json({ message: "Task not found" }, { status: 404 });
    }

    const cycle = cycleParam ? parseInt(cycleParam, 10) : task.currentCycle;
    const isStaff = session.user.role === "MASTER" || session.user.role === "ADMIN" || session.user.role === "MANAGER";
    const isAssignedDoer =
      session.user.role === "DOER" &&
      (cycle === task.currentCycle
        ? await isTaskAssignedToDoer(taskType, taskId, session.user.id)
        : await isTaskAssignedToDoerInCycle(taskType, taskId, session.user.id, cycle));

    if (!isAssignedDoer && !isStaff) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const step = await prisma.taskStep.findUnique({ where: { taskType_taskId_cycle: { taskType, taskId, cycle } } });

    return NextResponse.json({ step, cycle }, { status: 200 });
  } catch (error) {
    console.error("Error fetching task step:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}

// POST /api/task-steps — multipart/form-data. Only the Doer assigned to the
// task's CURRENT cycle can submit a step, and steps must be completed in
// order (1, 2, 3). Submitting step 3 marks that cycle COMPLETED; staff can
// then reopen the task (via Assign Doer) to start a new cycle.
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

    const task = await getTaskCore(taskType, taskId);
    if (!task) {
      return NextResponse.json({ message: "Task not found" }, { status: 404 });
    }
    if (!(await isTaskAssignedToDoer(taskType, taskId, session.user.id))) {
      return NextResponse.json({ message: "This task is not assigned to you" }, { status: 403 });
    }

    const cycle = task.currentCycle;
    const existing = await prisma.taskStep.findUnique({ where: { taskType_taskId_cycle: { taskType, taskId, cycle } } });

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
        where: { taskType_taskId_cycle: { taskType, taskId, cycle } },
        update: { sitePhotoUrl, siteVideoUrl, latitude, longitude, step1At: new Date() },
        create: { taskType, taskId, cycle, sitePhotoUrl, siteVideoUrl, latitude, longitude, step1At: new Date() },
      });

      if (task.status !== "COMPLETED") {
        await updateTaskCore(taskType, taskId, { status: "IN_PROGRESS" });
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
          where: { taskType_taskId_cycle: { taskType, taskId, cycle } },
          data: { notes, chartUrl, step2At: new Date() },
        });
      } else {
        const evidence = formData.get("evidence");
        if (!(evidence instanceof File) || evidence.size === 0) {
          return NextResponse.json({ message: "Work-complete evidence file is required" }, { status: 400 });
        }
        const evidenceUrl = await saveUploadedFile(evidence, MAX_VIDEO_BYTES);

        await prisma.taskStep.update({
          where: { taskType_taskId_cycle: { taskType, taskId, cycle } },
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
        where: { taskType_taskId_cycle: { taskType, taskId, cycle } },
        data: { expenseAmount, expenseNotes, billUrls, step3At: new Date() },
      });

      await updateTaskCore(taskType, taskId, { status: "COMPLETED" });
    }

    await notifyStaffOfStepCompletion(taskType, Number(step), session.user.name || "A Doer", task.customerName);

    const updated = await prisma.taskStep.findUnique({ where: { taskType_taskId_cycle: { taskType, taskId, cycle } } });
    return NextResponse.json({ step: updated }, { status: 200 });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("FILE_TOO_LARGE")) {
      return NextResponse.json({ message: `File too large: ${error.message.split(":")[1]}` }, { status: 400 });
    }
    console.error("Error saving task step:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
