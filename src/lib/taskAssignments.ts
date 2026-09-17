import { prisma } from "@/lib/prisma";
import { sendPushToUsers } from "@/lib/onesignal-server";
import { TaskType, getTaskCore, updateTaskCore } from "@/lib/taskCore";

export type { TaskType };

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

// Task ids currently assigned to this Doer IN THEIR ACTIVE CYCLE, for
// filtering "my tasks" lists. A Doer from an earlier (reopened/superseded)
// cycle no longer shows the task as "theirs" once a new cycle has started.
export async function getAssignedTaskIds(taskType: TaskType, doerId: string): Promise<string[]> {
  const rows = await prisma.taskAssignment.findMany({
    where: { taskType, doerId },
    select: { taskId: true, cycle: true },
  });
  if (rows.length === 0) return [];

  const taskIds = [...new Set(rows.map((r) => r.taskId))];
  const cycleByTaskId = await getCurrentCycles(taskType, taskIds);

  return rows.filter((r) => cycleByTaskId.get(r.taskId) === r.cycle).map((r) => r.taskId);
}

async function getCurrentCycles(taskType: TaskType, taskIds: string[]): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (taskIds.length === 0) return map;
  const select = { id: true, currentCycle: true } as const;
  const rows =
    taskType === "INSTALLATION"
      ? await prisma.installation.findMany({ where: { id: { in: taskIds } }, select })
      : taskType === "SITE_VISIT"
        ? await prisma.siteVisit.findMany({ where: { id: { in: taskIds } }, select })
        : await prisma.complaint.findMany({ where: { id: { in: taskIds } }, select });
  for (const r of rows) map.set(r.id, r.currentCycle);
  return map;
}

// Attaches an `assignments` array (one entry per Doer assigned IN THE
// CURRENT CYCLE) to each task, since Prisma can't `include` TaskAssignment
// directly — it's a shared table across three unrelated task models, joined
// by taskType + taskId (+ cycle).
export async function attachAssignments<T extends { id: string; currentCycle: number }>(
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
  const cycleByTaskId = new Map(tasks.map((t) => [t.id, t.currentCycle]));
  for (const row of rows) {
    if (row.cycle !== cycleByTaskId.get(row.taskId)) continue; // history — not the active cycle
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

function toStepSummary(row: {
  step1At: Date | null;
  step2At: Date | null;
  step3At: Date | null;
  expenseAmount: number | null;
  billUrls: unknown;
}): StepSummary {
  const daysStep1To2 =
    row.step1At && row.step2At
      ? Math.round(((row.step2At.getTime() - row.step1At.getTime()) / (1000 * 60 * 60 * 24)) * 10) / 10
      : null;
  return {
    step1At: row.step1At,
    step2At: row.step2At,
    step3At: row.step3At,
    daysStep1To2,
    expenseAmount: row.expenseAmount,
    billUrls: Array.isArray(row.billUrls) ? (row.billUrls as string[]) : [],
  };
}

// Attaches a `stepSummary` (progress timestamps + expense/bill info) from
// each task's CURRENT CYCLE — same shared-table join pattern as
// attachAssignments, against TaskStep instead.
export async function attachStepSummary<T extends { id: string; currentCycle: number }>(
  taskType: TaskType,
  tasks: T[]
): Promise<(T & { stepSummary: StepSummary | null })[]> {
  if (tasks.length === 0) return [];

  const taskIds = tasks.map((t) => t.id);
  const rows = await prisma.taskStep.findMany({
    where: { taskType, taskId: { in: taskIds } },
  });

  const cycleByTaskId = new Map(tasks.map((t) => [t.id, t.currentCycle]));
  const byTaskId = new Map<string, StepSummary>();
  for (const row of rows) {
    if (row.cycle !== cycleByTaskId.get(row.taskId)) continue; // history — not the active cycle
    byTaskId.set(row.taskId, toStepSummary(row));
  }

  return tasks.map((t) => ({ ...t, stepSummary: byTaskId.get(t.id) || null }));
}

export interface CompletedCycleEntry {
  taskId: string;
  cycle: number;
  assignments: AssignmentInfo[];
  stepSummary: StepSummary;
}

// Every completed round (cycle) across all tasks of a type — the full
// reopen/reassign history. When doerId is given, scoped to only the cycles
// that Doer actually worked on.
export async function getCompletedCycles(taskType: TaskType, doerId?: string): Promise<CompletedCycleEntry[]> {
  const steps = await prisma.taskStep.findMany({
    where: { taskType, step3At: { not: null } },
    orderBy: [{ taskId: "asc" }, { cycle: "asc" }],
  });
  if (steps.length === 0) return [];

  const taskIds = [...new Set(steps.map((s) => s.taskId))];
  const assignmentRows = await prisma.taskAssignment.findMany({
    where: { taskType, taskId: { in: taskIds } },
    include: { doer: { select: { name: true } } },
    orderBy: { createdAt: "asc" },
  });

  const assignByTaskCycle = new Map<string, AssignmentInfo[]>();
  for (const a of assignmentRows) {
    const key = `${a.taskId}::${a.cycle}`;
    const list = assignByTaskCycle.get(key) || [];
    list.push({ doerId: a.doerId, doerName: a.doer.name, fundAmount: a.fundAmount, fundNotes: a.fundNotes });
    assignByTaskCycle.set(key, list);
  }

  const entries: CompletedCycleEntry[] = [];
  for (const s of steps) {
    const assignments = assignByTaskCycle.get(`${s.taskId}::${s.cycle}`) || [];
    if (doerId && !assignments.some((a) => a.doerId === doerId)) continue;
    entries.push({ taskId: s.taskId, cycle: s.cycle, assignments, stepSummary: toStepSummary(s) });
  }
  return entries;
}

export interface DoerOccupancy {
  taskType: TaskType;
  taskId: string;
  label: string;
  status: string;
}

// For a set of Doers, finds which non-completed tasks (across all 3 task
// types) each one is currently assigned to IN THE ACTIVE CYCLE — used to
// show "Free" vs "Occupied on ..." in the Doer list and the Assign Doers
// picker.
export async function getDoerOccupancy(doerIds: string[]): Promise<Map<string, DoerOccupancy[]>> {
  const result = new Map<string, DoerOccupancy[]>();
  if (doerIds.length === 0) return result;

  const assignments = await prisma.taskAssignment.findMany({
    where: { doerId: { in: doerIds } },
    select: { doerId: true, taskType: true, taskId: true, cycle: true },
  });
  if (assignments.length === 0) return result;

  const idsByType: Record<TaskType, string[]> = { INSTALLATION: [], COMPLAINT: [], SITE_VISIT: [] };
  for (const a of assignments) idsByType[a.taskType as TaskType].push(a.taskId);

  const [installations, complaints, siteVisits] = await Promise.all([
    idsByType.INSTALLATION.length
      ? prisma.installation.findMany({ where: { id: { in: idsByType.INSTALLATION } }, select: { id: true, customerName: true, status: true, currentCycle: true } })
      : Promise.resolve([]),
    idsByType.COMPLAINT.length
      ? prisma.complaint.findMany({ where: { id: { in: idsByType.COMPLAINT } }, select: { id: true, customerName: true, status: true, currentCycle: true } })
      : Promise.resolve([]),
    idsByType.SITE_VISIT.length
      ? prisma.siteVisit.findMany({ where: { id: { in: idsByType.SITE_VISIT } }, select: { id: true, customerName: true, serialNo: true, status: true, currentCycle: true } })
      : Promise.resolve([]),
  ]);

  const taskById = new Map<string, { label: string; status: string; currentCycle: number }>();
  for (const i of installations) taskById.set(`INSTALLATION:${i.id}`, { label: i.customerName, status: i.status, currentCycle: i.currentCycle });
  for (const c of complaints) taskById.set(`COMPLAINT:${c.id}`, { label: c.customerName, status: c.status, currentCycle: c.currentCycle });
  for (const v of siteVisits) {
    taskById.set(`SITE_VISIT:${v.id}`, { label: `SV-${String(v.serialNo).padStart(4, "0")} · ${v.customerName}`, status: v.status, currentCycle: v.currentCycle });
  }

  for (const a of assignments) {
    const task = taskById.get(`${a.taskType}:${a.taskId}`);
    if (!task || task.status === "COMPLETED" || a.cycle !== task.currentCycle) continue; // only active work in the active cycle counts as "occupied"
    const list = result.get(a.doerId) || [];
    list.push({ taskType: a.taskType as TaskType, taskId: a.taskId, label: task.label, status: task.status });
    result.set(a.doerId, list);
  }

  return result;
}

export async function isTaskAssignedToDoer(taskType: TaskType, taskId: string, doerId: string): Promise<boolean> {
  const task = await getTaskCore(taskType, taskId);
  if (!task) return false;
  const row = await prisma.taskAssignment.findUnique({
    where: { taskType_taskId_doerId_cycle: { taskType, taskId, doerId, cycle: task.currentCycle } },
  });
  return !!row;
}

// Same check, but for a specific historical cycle — used to authorize a
// Doer viewing their own past-round history (they no longer need to be
// assigned in the CURRENT cycle to see a round they actually worked on).
export async function isTaskAssignedToDoerInCycle(taskType: TaskType, taskId: string, doerId: string, cycle: number): Promise<boolean> {
  const row = await prisma.taskAssignment.findUnique({
    where: { taskType_taskId_doerId_cycle: { taskType, taskId, doerId, cycle } },
  });
  return !!row;
}

// Adds (or updates the fund on) one or more Doers for a task, in its
// CURRENT cycle. Additive — doesn't touch any Doer already assigned in this
// cycle but not included in doerIds.
//
// If the task is currently COMPLETED, this call REOPENS it: a new cycle is
// started (currentCycle + 1), status resets to ASSIGNED, and the given
// Doers are assigned fresh in that new cycle — the previous cycle's
// TaskAssignment/TaskStep rows are left untouched as permanent history.
export async function assignDoers(
  taskType: TaskType,
  taskId: string,
  doerIds: string[],
  fundAmount: number | null,
  fundNotes: string | null
): Promise<void> {
  const task = await getTaskCore(taskType, taskId);
  if (!task) return;

  let cycle = task.currentCycle;
  const isReopen = task.status === "COMPLETED";

  if (isReopen) {
    cycle = task.currentCycle + 1;
    await updateTaskCore(taskType, taskId, { status: "ASSIGNED", currentCycle: cycle });
  } else if (task.status === "PENDING") {
    await updateTaskCore(taskType, taskId, { status: "ASSIGNED" });
  }

  for (const doerId of doerIds) {
    await prisma.taskAssignment.upsert({
      where: { taskType_taskId_doerId_cycle: { taskType, taskId, doerId, cycle } },
      update: {
        ...(fundAmount !== null ? { fundAmount } : {}),
        ...(fundNotes !== null ? { fundNotes } : {}),
      },
      create: { taskType, taskId, doerId, cycle, fundAmount, fundNotes },
    });
  }

  await sendPushToUsers({
    userIds: doerIds,
    title: isReopen ? "Task re-assigned" : "New task assigned",
    message: isReopen
      ? `A ${taskTypeLabel[taskType]} has been reopened for another round: ${task.customerName}.`
      : `You've been assigned a ${taskTypeLabel[taskType]}: ${task.customerName}.`,
  });
}

// Unassign a Doer from a task's CURRENT cycle (history is never modified).
export async function unassignDoer(taskType: TaskType, taskId: string, doerId: string) {
  const task = await getTaskCore(taskType, taskId);
  if (!task) return;
  await prisma.taskAssignment
    .delete({ where: { taskType_taskId_doerId_cycle: { taskType, taskId, doerId, cycle: task.currentCycle } } })
    .catch(() => {
      /* already unassigned — no-op */
    });
}
