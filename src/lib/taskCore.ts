import { prisma } from "@/lib/prisma";

export type TaskType = "INSTALLATION" | "COMPLAINT" | "SITE_VISIT";

export interface TaskCoreRow {
  id: string;
  status: string;
  currentCycle: number;
  customerName: string;
}

// Slim, type-agnostic accessors for the 3 underlying task tables, keyed by
// taskType — used wherever code needs to work generically across
// Installation/Complaint/SiteVisit (status + cycle bookkeeping only).
export async function getTaskCore(taskType: TaskType, taskId: string): Promise<TaskCoreRow | null> {
  const select = { id: true, status: true, currentCycle: true, customerName: true } as const;
  if (taskType === "INSTALLATION") {
    return prisma.installation.findUnique({ where: { id: taskId }, select });
  }
  if (taskType === "SITE_VISIT") {
    return prisma.siteVisit.findUnique({ where: { id: taskId }, select });
  }
  return prisma.complaint.findUnique({ where: { id: taskId }, select });
}

export async function updateTaskCore(
  taskType: TaskType,
  taskId: string,
  data: { status?: string; currentCycle?: number }
): Promise<void> {
  if (taskType === "INSTALLATION") {
    await prisma.installation.update({ where: { id: taskId }, data });
  } else if (taskType === "SITE_VISIT") {
    await prisma.siteVisit.update({ where: { id: taskId }, data });
  } else {
    await prisma.complaint.update({ where: { id: taskId }, data });
  }
}
