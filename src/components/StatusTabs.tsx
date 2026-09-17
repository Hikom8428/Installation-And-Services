"use client";

type Tab = "PENDING" | "COMPLETED";

interface Props {
  active: Tab;
  onChange: (tab: Tab) => void;
  pendingCount: number;
  completedCount: number;
}

export default function StatusTabs({ active, onChange, pendingCount, completedCount }: Props) {
  const tabClass = (tab: Tab) =>
    `px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
      active === tab ? "border-blue-600 text-blue-600" : "border-transparent text-slate-500 hover:text-slate-700"
    }`;

  return (
    <div className="flex gap-2 border-b border-slate-200">
      <button onClick={() => onChange("PENDING")} className={tabClass("PENDING")}>
        Pending ({pendingCount})
      </button>
      <button onClick={() => onChange("COMPLETED")} className={tabClass("COMPLETED")}>
        Completed ({completedCount})
      </button>
    </div>
  );
}
