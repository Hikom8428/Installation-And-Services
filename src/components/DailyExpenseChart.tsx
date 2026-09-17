"use client";

interface DayPoint {
  date: string; // YYYY-MM-DD
  expense: number;
}

// Lightweight dependency-free bar chart — pixel heights are computed in JS
// so it renders correctly without relying on percentage-height CSS quirks.
export default function DailyExpenseChart({ data }: { data: DayPoint[] }) {
  const max = Math.max(1, ...data.map((d) => d.expense));
  const chartHeight = 140;

  if (data.length === 0) {
    return <p className="text-sm text-slate-400 py-6 text-center">No data for this range.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <div className="flex items-end gap-1.5 min-w-max" style={{ height: chartHeight + 30 }}>
        {data.map((d) => {
          const barHeight = d.expense > 0 ? Math.max(3, Math.round((d.expense / max) * chartHeight)) : 1;
          return (
            <div key={d.date} className="flex flex-col items-center justify-end" style={{ width: 24, height: chartHeight + 30 }}>
              <div
                className={`w-3.5 rounded-t transition-colors ${d.expense > 0 ? "bg-blue-500 hover:bg-blue-600" : "bg-slate-200"}`}
                style={{ height: barHeight }}
                title={`${d.date}: ₹${d.expense.toLocaleString()}`}
              />
              <span className="text-[9px] text-slate-400 mt-1 whitespace-nowrap">
                {d.date.slice(5).replace("-", "/")}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
