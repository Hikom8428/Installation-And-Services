import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

const VALID_VISIT_FOR = ["DOOR", "PANEL", "DOOR_PANEL"];

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

    if (!customerName || !VALID_VISIT_FOR.includes(visitFor)) {
      return NextResponse.json({ message: "Customer Name and a valid Visit For are required" }, { status: 400 });
    }

    const siteVisit = await prisma.siteVisit.create({
      data: {
        raisedById: session?.user.id || null,
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

    let siteVisits;
    if (session.user.role === "DOER") {
      siteVisits = await prisma.siteVisit.findMany({
        where: { assignedDoerId: session.user.id },
        orderBy: { createdAt: "desc" },
        include: {
          assignedDoer: { select: { name: true } },
          raisedBy: { select: { name: true } },
        },
      });
    } else {
      siteVisits = await prisma.siteVisit.findMany({
        orderBy: { createdAt: "desc" },
        include: {
          assignedDoer: { select: { name: true } },
          raisedBy: { select: { name: true } },
        },
      });
    }

    return NextResponse.json(siteVisits, { status: 200 });
  } catch (error) {
    console.error("Error fetching site visits:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
