import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

function isStaff(role: string) {
  return role === "MASTER" || role === "ADMIN" || role === "MANAGER";
}

interface TypeReport {
  pending: number;
  active: number;
  completed: number;
  totalExpense: number;
  dailyExpense: { date: string; expense: number }[];
}

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function buildDayList(from: Date, to: Date): string[] {
  const days: string[] = [];
  const cur = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()));
  const end = new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate()));
  while (cur <= end) {
    days.push(dayKey(cur));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return days;
}

function countStatuses(rows: { status: string }[]) {
  let pending = 0;
  let active = 0;
  let completed = 0;
  for (const r of rows) {
    if (r.status === "PENDING") pending++;
    else if (r.status === "COMPLETED") completed++;
    else active++; // ASSIGNED, IN_PROGRESS
  }
  return { pending, active, completed };
}

function buildExpense(
  steps: { step3At: Date | null; expenseAmount: number | null }[],
  dayList: string[]
): { total: number; dailyExpense: { date: string; expense: number }[] } {
  const byDay = new Map(dayList.map((d) => [d, 0]));
  let total = 0;
  for (const s of steps) {
    if (!s.step3At) continue;
    const amt = s.expenseAmount || 0;
    total += amt;
    const key = dayKey(s.step3At);
    if (byDay.has(key)) byDay.set(key, (byDay.get(key) || 0) + amt);
  }
  return {
    total: Math.round(total * 100) / 100,
    dailyExpense: dayList.map((d) => ({ date: d, expense: Math.round((byDay.get(d) || 0) * 100) / 100 })),
  };
}

function buildReport(
  rows: { status: string }[],
  steps: { step3At: Date | null; expenseAmount: number | null }[],
  dayList: string[]
): TypeReport {
  const { pending, active, completed } = countStatuses(rows);
  const { total, dailyExpense } = buildExpense(steps, dayList);
  return { pending, active, completed, totalExpense: total, dailyExpense };
}

// GET /api/reports?from=YYYY-MM-DD&to=YYYY-MM-DD
// Pending/Active/Completed are counted among tasks raised within the range
// (by syncDate for Installations, createdAt for Complaints/Site Visits).
// Expense is summed from Step 3 submissions (step3At) falling in the range,
// regardless of which cycle/round they belong to.
export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !isStaff(session.user.role)) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const fromParam = searchParams.get("from");
    const toParam = searchParams.get("to");
    if (!fromParam || !toParam) {
      return NextResponse.json({ message: "from and to dates are required" }, { status: 400 });
    }

    const from = new Date(`${fromParam}T00:00:00.000Z`);
    const to = new Date(`${toParam}T23:59:59.999Z`);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from > to) {
      return NextResponse.json({ message: "Invalid date range" }, { status: 400 });
    }

    const dayList = buildDayList(from, to);

    const [installations, complaints, siteVisits, instSteps, compSteps, svSteps] = await Promise.all([
      prisma.installation.findMany({ where: { syncDate: { gte: from, lte: to } }, select: { status: true } }),
      prisma.complaint.findMany({ where: { createdAt: { gte: from, lte: to } }, select: { status: true } }),
      prisma.siteVisit.findMany({ where: { createdAt: { gte: from, lte: to } }, select: { status: true } }),
      prisma.taskStep.findMany({ where: { taskType: "INSTALLATION", step3At: { gte: from, lte: to } }, select: { step3At: true, expenseAmount: true } }),
      prisma.taskStep.findMany({ where: { taskType: "COMPLAINT", step3At: { gte: from, lte: to } }, select: { step3At: true, expenseAmount: true } }),
      prisma.taskStep.findMany({ where: { taskType: "SITE_VISIT", step3At: { gte: from, lte: to } }, select: { step3At: true, expenseAmount: true } }),
    ]);

    return NextResponse.json({
      INSTALLATION: buildReport(installations, instSteps, dayList),
      COMPLAINT: buildReport(complaints, compSteps, dayList),
      SITE_VISIT: buildReport(siteVisits, svSteps, dayList),
    });
  } catch (error) {
    console.error("Error building reports:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
