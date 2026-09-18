"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { FileText, ClipboardList, MapPin } from "lucide-react";
import DailyExpenseChart from "@/components/DailyExpenseChart";
import BrandFilter, { Brand } from "@/components/BrandFilter";

type Preset = "WEEK" | "MONTH" | "CUSTOM";

interface TypeReport {
  pending: number;
  active: number;
  completed: number;
  totalExpense: number;
  dailyExpense: { date: string; expense: number }[];
}

interface ReportsData {
  INSTALLATION: TypeReport;
  COMPLAINT: TypeReport;
  SITE_VISIT: TypeReport;
}

function toISODate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function presetRange(preset: "WEEK" | "MONTH"): { from: string; to: string } {
  const today = new Date();
  if (preset === "WEEK") {
    const from = new Date(today);
    from.setDate(from.getDate() - 6);
    return { from: toISODate(from), to: toISODate(today) };
  }
  const from = new Date(today.getFullYear(), today.getMonth(), 1);
  return { from: toISODate(from), to: toISODate(today) };
}

const sections: { type: keyof ReportsData; title: string; icon: typeof FileText }[] = [
  { type: "INSTALLATION", title: "Installations", icon: FileText },
  { type: "COMPLAINT", title: "Complaints", icon: ClipboardList },
  { type: "SITE_VISIT", title: "Site Visits", icon: MapPin },
];

function StatBox({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-slate-50 rounded-lg px-4 py-3 flex-1 min-w-[7rem]">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
    </div>
  );
}

export default function ReportsPage() {
  const { data: session } = useSession();
  const [preset, setPreset] = useState<Preset>("MONTH");
  const [range, setRange] = useState(() => presetRange("MONTH"));
  const [data, setData] = useState<ReportsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [brand, setBrand] = useState<Brand>("ALL");

  const isStaff = session?.user.role === "MASTER" || session?.user.role === "ADMIN" || session?.user.role === "MANAGER";

  const fetchReports = async (from: string, to: string, brandValue: Brand) => {
    setLoading(true);
    setError("");
    try {
      const url = `/api/reports?from=${from}&to=${to}${brandValue !== "ALL" ? `&brand=${brandValue}` : ""}`;
      const res = await fetch(url);
      const json = await res.json();
      if (res.ok) setData(json);
      else setError(json.message || "Failed to load reports");
    } catch (e) {
      setError("Network error, please try again");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isStaff) fetchReports(range.from, range.to, brand);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  const applyPreset = (p: "WEEK" | "MONTH") => {
    setPreset(p);
    const r = presetRange(p);
    setRange(r);
    fetchReports(r.from, r.to, brand);
  };

  const applyCustom = () => {
    setPreset("CUSTOM");
    fetchReports(range.from, range.to, brand);
  };

  const applyBrand = (b: Brand) => {
    setBrand(b);
    fetchReports(range.from, range.to, b);
  };

  if (!isStaff) {
    return <div className="p-4 text-red-500">Access Denied. Only Master, Admin, and Manager can view reports.</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Reports</h1>
          <p className="text-sm text-slate-500 mt-1">Pending / Active / Completed counts and expense trends, per task type</p>
        </div>
        <BrandFilter value={brand} onChange={applyBrand} />
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex gap-2">
          <button
            onClick={() => applyPreset("WEEK")}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${preset === "WEEK" ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}
          >
            Weekly
          </button>
          <button
            onClick={() => applyPreset("MONTH")}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${preset === "MONTH" ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}
          >
            Monthly
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="date"
            value={range.from}
            onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))}
            className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-sm text-slate-900"
          />
          <span className="text-slate-400 text-sm">to</span>
          <input
            type="date"
            value={range.to}
            onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))}
            className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-sm text-slate-900"
          />
          <button
            onClick={applyCustom}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${preset === "CUSTOM" ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}
          >
            Apply
          </button>
        </div>
        <span className="text-xs text-slate-400 sm:ml-auto">
          Showing {range.from} to {range.to}
        </span>
      </div>

      {error && <div className="p-4 bg-red-50 text-red-700 border border-red-200 rounded-lg text-sm font-medium">{error}</div>}

      {loading ? (
        <div className="p-8 text-center text-slate-500">Loading...</div>
      ) : (
        data &&
        sections.map(({ type, title, icon: Icon }) => {
          const report = data[type];
          return (
            <div key={type} className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 space-y-4">
              <div className="flex items-center gap-2">
                <Icon className="w-5 h-5 text-blue-600" />
                <h2 className="text-lg font-bold text-slate-900">{title}</h2>
              </div>

              <div className="flex flex-wrap gap-3">
                <StatBox label="Pending" value={report.pending} color="text-yellow-600" />
                <StatBox label="Active" value={report.active} color="text-purple-600" />
                <StatBox label="Completed" value={report.completed} color="text-green-600" />
                <div className="bg-slate-50 rounded-lg px-4 py-3 flex-1 min-w-[9rem]">
                  <p className="text-xs text-slate-500">Total Expense</p>
                  <p className="text-2xl font-bold text-slate-800">₹{report.totalExpense.toLocaleString()}</p>
                </div>
              </div>

              <div>
                <p className="text-xs font-medium text-slate-500 mb-2">Daily Expense Trend</p>
                <DailyExpenseChart data={report.dailyExpense} />
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
