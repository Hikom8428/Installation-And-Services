import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAssignedTaskIds, attachAssignments, attachStepSummary, getCompletedCycles } from "@/lib/taskAssignments";

const VALID_VISIT_FOR = ["DOOR", "PANEL", "DOOR_PANEL"];
const VALID_BRAND = ["HIKOM", "HICON"];

// Create a new Site Visit request. Open to the public (via /site-visit-form,
// a shareable link anyone can fill in — clients included) as well as staff
// raising one from the dashboard's "Site Visits" tab.
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);

    const body = await req.json();
    const customerName = (body.customerName || "").trim();
    const siteAddress = (body.siteAddress || "").trim() || null;
    const attendantName = (body.attendantName || "").trim() || null;
    const attendantPhone = (body.attendantPhone || "").trim() || null;
    const visitFor = body.visitFor;
    const siteLatitude = typeof body.siteLatitude === "number" ? body.siteLatitude : null;
    const siteLongitude = typeof body.siteLongitude === "number" ? body.siteLongitude : null;
    const raisedVia = (body.raisedVia || "").trim() || null;
    const raisedByName = (body.raisedByName || "").trim() || null;
    const brand = (body.brand || "").trim() || null;

    if (!customerName || !VALID_VISIT_FOR.includes(visitFor)) {
      return NextResponse.json({ message: "Customer Name and a valid Visit For are required" }, { status: 400 });
    }
    if (!brand || !VALID_BRAND.includes(brand)) {
      return NextResponse.json({ message: "Please select the Brand (Hikom or Hicon)" }, { status: 400 });
    }

    const siteVisit = await prisma.siteVisit.create({
      data: {
        raisedById: session?.user.id || null,
        raisedVia,
        raisedByName,
        brand,
        customerName,
        siteAddress,
        siteLatitude,
        siteLongitude,
        attendantName,
        attendantPhone,
        visitFor,
        status: "PENDING",
      },
    });

    return NextResponse.json({ message: "Site Visit created", siteVisit }, { status: 201 });
  } catch (error) {
    console.error("Site visit creation error:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}

// List Site Visits — Doers see only what's assigned to them.
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const isDoer = session.user.role === "DOER";

    const pendingWhere = isDoer
      ? { id: { in: await getAssignedTaskIds("SITE_VISIT", session.user.id) }, status: { not: "COMPLETED" } }
      : { status: { not: "COMPLETED" } };
    const pendingTasks = await prisma.siteVisit.findMany({
      where: pendingWhere,
      orderBy: { createdAt: "desc" },
      include: { raisedBy: { select: { name: true } } },
    });
    const pendingWithAssignments = await attachAssignments("SITE_VISIT", pendingTasks);
    const pending = await attachStepSummary("SITE_VISIT", pendingWithAssignments);

    const cycles = await getCompletedCycles("SITE_VISIT", isDoer ? session.user.id : undefined);
    const baseIds = [...new Set(cycles.map((c) => c.taskId))];
    const baseTasks = baseIds.length
      ? await prisma.siteVisit.findMany({ where: { id: { in: baseIds } }, include: { raisedBy: { select: { name: true } } } })
      : [];
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
    console.error("Error fetching site visits:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
