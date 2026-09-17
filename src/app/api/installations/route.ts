import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAssignedTaskIds, attachAssignments, attachStepSummary, getCompletedCycles } from "@/lib/taskAssignments";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const isDoer = session.user.role === "DOER";

    // Pending: not-yet-completed tasks, scoped to this Doer's active cycle if a Doer.
    const pendingWhere = isDoer
      ? { id: { in: await getAssignedTaskIds("INSTALLATION", session.user.id) }, status: { not: "COMPLETED" } }
      : { status: { not: "COMPLETED" } };
    const pendingTasks = await prisma.installation.findMany({ where: pendingWhere, orderBy: { syncDate: "desc" } });
    const pendingWithAssignments = await attachAssignments("INSTALLATION", pendingTasks);
    const pending = await attachStepSummary("INSTALLATION", pendingWithAssignments);

    // Completed: full reopen/reassign history — one row per completed cycle.
    const cycles = await getCompletedCycles("INSTALLATION", isDoer ? session.user.id : undefined);
    const baseIds = [...new Set(cycles.map((c) => c.taskId))];
    const baseTasks = baseIds.length ? await prisma.installation.findMany({ where: { id: { in: baseIds } } }) : [];
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
    console.error("Error fetching installations:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
