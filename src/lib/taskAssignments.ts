import { prisma } from "@/lib/prisma";

export type TaskType = "INSTALLATION" | "COMPLAINT" | "SITE_VISIT";

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

export async function isTaskAssignedToDoer(taskType: TaskType, taskId: string, doerId: string): Promise<boolean> {
  const row = await prisma.taskAssignment.findUnique({
    where: { taskType_taskId_doerId: { taskType, taskId, doerId } },
  });
  return !!row;
}

// Adds (or updates the fund on) one or more Doers for a task. Additive —
// doesn't touch any Doer already assigned but not included in doerIds.
export async function assignDoers(
  taskType: TaskType,
  taskId: string,
  doerIds: string[],
  fundAmount: number | null,
  fundNotes: string | null
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
}

export async function unassignDoer(taskType: TaskType, taskId: string, doerId: string) {
  await prisma.taskAssignment
    .delete({ where: { taskType_taskId_doerId: { taskType, taskId, doerId } } })
    .catch(() => {
      /* already unassigned — no-op */
    });
}
