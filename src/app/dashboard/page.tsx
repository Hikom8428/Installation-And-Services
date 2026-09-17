"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { FileText, ClipboardList, Users, ArrowUpRight, MapPin, Wrench } from "lucide-react";
import Link from "next/link";

interface ActivityItem {
  type: "INSTALLATION" | "COMPLAINT" | "SITE_VISIT";
  id: string;
  title: string;
  status: string;
  updatedAt: string;
}

interface Stats {
  pendingInstallations: number;
  totalInstallations: number;
  activeComplaints: number;
  resolvedComplaints: number;
  totalComplaints: number;
  activeSiteVisits: number;
  completedSiteVisits: number;
  totalSiteVisits: number;
  totalDoers: number;
  recentActivity: ActivityItem[];
}

const statusColor = (status: string) => {
  switch (status) {
    case "PENDING": return "bg-yellow-100 text-yellow-800";
    case "ASSIGNED": return "bg-blue-100 text-blue-800";
    case "IN_PROGRESS": return "bg-purple-100 text-purple-800";
    case "COMPLETED": return "bg-green-100 text-green-800";
    default: return "bg-gray-100 text-gray-800";
  }
};

const activityMeta: Record<ActivityItem["type"], { label: string; href: string; icon: typeof FileText; color: string }> = {
  INSTALLATION: { label: "Installation", href: "/dashboard/installations", icon: FileText, color: "text-blue-600 bg-blue-50" },
  COMPLAINT: { label: "Complaint", href: "/dashboard/complaints", icon: ClipboardList, color: "text-rose-600 bg-rose-50" },
  SITE_VISIT: { label: "Site Visit", href: "/dashboard/site-visits", icon: MapPin, color: "text-emerald-600 bg-emerald-50" },
};

function timeAgo(iso: string): string {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

function StatCard({
  icon: Icon,
  iconClass,
  label,
  value,
  suffix,
}: {
  icon: typeof FileText;
  iconClass: string;
  label: string;
  value: number | string;
  suffix?: string;
}) {
  return (
    <div className="bg-white p-5 sm:p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-between group hover:shadow-md hover:border-slate-200 transition-all">
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center mb-4 ${iconClass}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <h3 className="text-slate-500 text-sm font-medium">{label}</h3>
        <div className="flex items-baseline gap-2 mt-1">
          <p className="text-3xl sm:text-4xl font-bold text-slate-900">{value}</p>
          {suffix && <span className="text-sm text-slate-500 font-medium">{suffix}</span>}
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { data: session } = useSession();
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    if (!session) return;
    fetch("/api/dashboard/stats")
      .then((res) => res.json())
      .then((data) => {
        if (data && typeof data.pendingInstallations === "number") setStats(data);
      })
      .catch((error) => console.error("Failed to fetch dashboard stats", error));
  }, [session]);

  const isDoer = session?.user?.role === "DOER";
  const v = (n: number | undefined) => (stats ? n : "—");

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
            Dashboard Overview
          </h1>
          <p className="text-slate-500 mt-1">
            Welcome back, <span className="font-semibold text-slate-700">{session?.user?.name || "User"}</span>. Here is what's happening today.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <StatCard
          icon={FileText}
          iconClass="bg-blue-50 text-blue-600"
          label={isDoer ? "My Pending Installations" : "Pending Installations"}
          value={v(stats?.pendingInstallations) as number | string}
          suffix={stats ? `/ ${stats.totalInstallations} total` : undefined}
        />
        <StatCard
          icon={ClipboardList}
          iconClass="bg-rose-50 text-rose-600"
          label={isDoer ? "My Active Complaints" : "Active Complaints"}
          value={v(stats?.activeComplaints) as number | string}
          suffix={stats ? `/ ${stats.resolvedComplaints} resolved` : undefined}
        />
        <StatCard
          icon={MapPin}
          iconClass="bg-emerald-50 text-emerald-600"
          label={isDoer ? "My Active Site Visits" : "Active Site Visits"}
          value={v(stats?.activeSiteVisits) as number | string}
          suffix={stats ? `/ ${stats.completedSiteVisits} completed` : undefined}
        />
        {!isDoer && (
          <StatCard
            icon={Users}
            iconClass="bg-indigo-50 text-indigo-600"
            label="Total Doers"
            value={v(stats?.totalDoers) as number | string}
          />
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
        {/* Quick Actions */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
          <h3 className="text-lg font-bold text-slate-900 mb-4">Quick Actions</h3>
          <div className="space-y-3">
            <Link href="/complaint-form" target="_blank" className="flex items-center justify-between p-4 rounded-xl border border-slate-100 hover:border-blue-200 hover:bg-blue-50 transition-colors group">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center">
                  <ClipboardList className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-semibold text-slate-900 group-hover:text-blue-700">Open Public Complaint Form</p>
                  <p className="text-xs text-slate-500">Submit a new service request</p>
                </div>
              </div>
              <ArrowUpRight className="w-5 h-5 text-slate-300 group-hover:text-blue-500" />
            </Link>

            <Link href="/site-visit-form" target="_blank" className="flex items-center justify-between p-4 rounded-xl border border-slate-100 hover:border-emerald-200 hover:bg-emerald-50 transition-colors group">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center">
                  <MapPin className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-semibold text-slate-900 group-hover:text-emerald-700">Open Site Visit Form</p>
                  <p className="text-xs text-slate-500">Request a site visit — shareable with anyone</p>
                </div>
              </div>
              <ArrowUpRight className="w-5 h-5 text-slate-300 group-hover:text-emerald-500" />
            </Link>

            {!isDoer && (
              <Link href="/dashboard/installations" className="flex items-center justify-between p-4 rounded-xl border border-slate-100 hover:border-purple-200 hover:bg-purple-50 transition-colors group">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-purple-100 text-purple-600 flex items-center justify-center">
                    <Wrench className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900 group-hover:text-purple-700">Sync Installations</p>
                    <p className="text-xs text-slate-500">Pull latest rows from Google Sheets</p>
                  </div>
                </div>
                <ArrowUpRight className="w-5 h-5 text-slate-300 group-hover:text-purple-500" />
              </Link>
            )}

            {(session?.user.role === "MASTER" || session?.user.role === "ADMIN") && (
              <Link href="/dashboard/users/new" className="flex items-center justify-between p-4 rounded-xl border border-slate-100 hover:border-indigo-200 hover:bg-indigo-50 transition-colors group">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center">
                    <Users className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900 group-hover:text-indigo-700">Add New Team Member</p>
                    <p className="text-xs text-slate-500">Create account for Manager or Doer</p>
                  </div>
                </div>
                <ArrowUpRight className="w-5 h-5 text-slate-300 group-hover:text-indigo-500" />
              </Link>
            )}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
          <h3 className="text-lg font-bold text-slate-900 mb-4">Recent Activity</h3>
          {stats && stats.recentActivity.length > 0 ? (
            <div className="space-y-1">
              {stats.recentActivity.map((item) => {
                const meta = activityMeta[item.type];
                const Icon = meta.icon;
                return (
                  <Link
                    key={`${item.type}-${item.id}`}
                    href={meta.href}
                    className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 transition-colors group"
                  >
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${meta.color}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-slate-800 truncate group-hover:text-slate-950">{item.title}</p>
                      <p className="text-xs text-slate-400">{meta.label} · {timeAgo(item.updatedAt)}</p>
                    </div>
                    <span className={`px-2 py-1 text-[11px] font-semibold rounded-full flex-shrink-0 ${statusColor(item.status)}`}>
                      {item.status}
                    </span>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-48 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
              <ClipboardList className="w-10 h-10 text-slate-300 mb-2" />
              <p className="text-sm font-medium text-slate-500">No recent activity yet</p>
              <p className="text-xs text-slate-400 mt-1">Activities will appear here once tasks are updated.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
