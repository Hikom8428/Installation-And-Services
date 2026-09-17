import { prisma } from "@/lib/prisma";
import { sendPushToUsers } from "@/lib/onesignal-server";

export type TaskType = "INSTALLATION" | "COMPLAINT" | "SITE_VISIT";

const taskTypeLabel: Record<TaskType, string> = {
  INSTALLATION: "Installation",
  COMPLAINT: "Complaint",
  SITE_VISIT: "Site Visit",
};

export interface AssignmentInfo {
  doerId: string;
  doerName: string;
  fundAmount: number | null;
  fundNotes: string | null;
}

// Task ids currently assigned to this Doer, for filtering "my tasks" lists.
export async function getAssignedTaskIds(taskType: TaskType, doerId: string): Promise<string[]> {
  const rows = await prisma.taskAssignment.findMany({
    where: { taskType, doerId },
    select: { taskId: true },
  });
  return rows.map((r) => r.taskId);
}

// Attaches an `assignments` array (one entry per Doer assigned) to each task,
// since Prisma can't `include` TaskAssignment directly — it's a shared table
// across three unrelated task models, joined by taskType + taskId.
export async function attachAssignments<T extends { id: string }>(
  taskType: TaskType,
  tasks: T[]
): Promise<(T & { assignments: AssignmentInfo[] })[]> {
  if (tasks.length === 0) return [];

  const taskIds = tasks.map((t) => t.id);
  const rows = await prisma.taskAssignment.findMany({
    where: { taskType, taskId: { in: taskIds } },
    include: { doer: { select: { name: true } } },
    orderBy: { createdAt: "asc" },
  });

  const byTaskId = new Map<string, AssignmentInfo[]>();
  for (const row of rows) {
    const list = byTaskId.get(row.taskId) || [];
    list.push({ doerId: row.doerId, doerName: row.doer.name, fundAmount: row.fundAmount, fundNotes: row.fundNotes });
    byTaskId.set(row.taskId, list);
  }

  return tasks.map((t) => ({ ...t, assignments: byTaskId.get(t.id) || [] }));
}

export interface StepSummary {
  step1At: Date | null;
  step2At: Date | null;
  step3At: Date | null;
  daysStep1To2: number | null;
  expenseAmount: number | null;
  billUrls: string[];
}

// Attaches a `stepSummary` (progress timestamps + expense/bill info from the
// last step) to each task, for the Completed-tab summary — same shared-table
// join pattern as attachAssignments, against TaskStep instead.
export async function attachStepSummary<T extends { id: string }>(
  taskType: TaskType,
  tasks: T[]
): Promise<(T & { stepSummary: StepSummary | null })[]> {
  if (tasks.length === 0) return [];

  const taskIds = tasks.map((t) => t.id);
  const rows = await prisma.taskStep.findMany({
    where: { taskType, taskId: { in: taskIds } },
  });

  const byTaskId = new Map<string, StepSummary>();
  for (const row of rows) {
    const daysStep1To2 =
      row.step1At && row.step2At
        ? Math.round(((row.step2At.getTime() - row.step1At.getTime()) / (1000 * 60 * 60 * 24)) * 10) / 10
        : null;
    byTaskId.set(row.taskId, {
      step1At: row.step1At,
      step2At: row.step2At,
      step3At: row.step3At,
      daysStep1To2,
      expenseAmount: row.expenseAmount,
      billUrls: Array.isArray(row.billUrls) ? (row.billUrls as string[]) : [],
    });
  }

  return tasks.map((t) => ({ ...t, stepSummary: byTaskId.get(t.id) || null }));
}

export async function isTaskAssignedToDoer(taskType: TaskType, taskId: string, doerId: string): Promise<boolean> {
  const row = await prisma.taskAssignment.findUnique({
    where: { taskType_taskId_doerId: { taskType, taskId, doerId } },
  });
  return !!row;
}

// Adds (or updates the fund on) one or more Doers for a task. Additive —
// doesn't touch any Doer already assigned but not included in doerIds.
// taskLabel (e.g. the customer's name) is used only for the push notification
// text sent to each newly-assigned Doer.
export async function assignDoers(
  taskType: TaskType,
  taskId: string,
  doerIds: string[],
  fundAmount: number | null,
  fundNotes: string | null,
  taskLabel?: string
) {
  for (const doerId of doerIds) {
    await prisma.taskAssignment.upsert({
      where: { taskType_taskId_doerId: { taskType, taskId, doerId } },
      update: {
        ...(fundAmount !== null ? { fundAmount } : {}),
        ...(fundNotes !== null ? { fundNotes } : {}),
      },
      create: { taskType, taskId, doerId, fundAmount, fundNotes },
    });
  }

  await sendPushToUsers({
    userIds: doerIds,
    title: "New task assigned",
    message: `You've been assigned a ${taskTypeLabel[taskType]}${taskLabel ? `: ${taskLabel}` : ""}.`,
  });
}

export async function unassignDoer(taskType: TaskType, taskId: string, doerId: string) {
  await prisma.taskAssignment
    .delete({ where: { taskType_taskId_doerId: { taskType, taskId, doerId } } })
    .catch(() => {
      /* already unassigned — no-op */
    });
}
