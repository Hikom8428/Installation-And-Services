import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAssignedTaskIds } from "@/lib/taskAssignments";

interface ActivityItem {
  type: "INSTALLATION" | "COMPLAINT" | "SITE_VISIT";
  id: string;
  title: string;
  status: string;
  updatedAt: string;
}

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const brandParam = searchParams.get("brand");
    const brandWhere = brandParam === "HIKOM" || brandParam === "HICON" ? { brand: brandParam } : {};

    // Doers only see counts/activity for work assigned to them; everyone else sees org-wide totals.
    const isDoer = session.user.role === "DOER";
    const installationWhere = {
      ...brandWhere,
      ...(isDoer ? { id: { in: await getAssignedTaskIds("INSTALLATION", session.user.id) } } : {}),
    };
    const complaintWhere = {
      ...brandWhere,
      ...(isDoer ? { id: { in: await getAssignedTaskIds("COMPLAINT", session.user.id) } } : {}),
    };
    const siteVisitWhere = {
      ...brandWhere,
      ...(isDoer ? { id: { in: await getAssignedTaskIds("SITE_VISIT", session.user.id) } } : {}),
    };

    const [
      pendingInstallations,
      totalInstallations,
      activeComplaints,
      resolvedComplaints,
      totalComplaints,
      activeSiteVisits,
      completedSiteVisits,
      totalSiteVisits,
      totalDoers,
      recentInstallations,
      recentComplaints,
      recentSiteVisits,
    ] = await Promise.all([
      prisma.installation.count({ where: { ...installationWhere, status: "PENDING" } }),
      prisma.installation.count({ where: installationWhere }),
      prisma.complaint.count({ where: { ...complaintWhere, status: { not: "COMPLETED" } } }),
      prisma.complaint.count({ where: { ...complaintWhere, status: "COMPLETED" } }),
      prisma.complaint.count({ where: complaintWhere }),
      prisma.siteVisit.count({ where: { ...siteVisitWhere, status: { not: "COMPLETED" } } }),
      prisma.siteVisit.count({ where: { ...siteVisitWhere, status: "COMPLETED" } }),
      prisma.siteVisit.count({ where: siteVisitWhere }),
      prisma.user.count({ where: { role: "DOER" } }),
      prisma.installation.findMany({
        where: installationWhere,
        orderBy: { updatedAt: "desc" },
        take: 5,
        select: { id: true, customerName: true, status: true, updatedAt: true },
      }),
      prisma.complaint.findMany({
        where: complaintWhere,
        orderBy: { updatedAt: "desc" },
        take: 5,
        select: { id: true, customerName: true, status: true, updatedAt: true },
      }),
      prisma.siteVisit.findMany({
        where: siteVisitWhere,
        orderBy: { updatedAt: "desc" },
        take: 5,
        select: { id: true, customerName: true, status: true, updatedAt: true, serialNo: true },
      }),
    ]);

    const recentActivity: ActivityItem[] = [
      ...recentInstallations.map((i) => ({
        type: "INSTALLATION" as const,
        id: i.id,
        title: i.customerName,
        status: i.status,
        updatedAt: i.updatedAt.toISOString(),
      })),
      ...recentComplaints.map((c) => ({
        type: "COMPLAINT" as const,
        id: c.id,
        title: c.customerName,
        status: c.status,
        updatedAt: c.updatedAt.toISOString(),
      })),
      ...recentSiteVisits.map((v) => ({
        type: "SITE_VISIT" as const,
        id: v.id,
        title: `SV-${String(v.serialNo).padStart(4, "0")} · ${v.customerName}`,
        status: v.status,
        updatedAt: v.updatedAt.toISOString(),
      })),
    ]
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, 6);

    return NextResponse.json(
      {
        pendingInstallations,
        totalInstallations,
        activeComplaints,
        resolvedComplaints,
        totalComplaints,
        activeSiteVisits,
        completedSiteVisits,
        totalSiteVisits,
        totalDoers,
        recentActivity,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error fetching dashboard stats:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
