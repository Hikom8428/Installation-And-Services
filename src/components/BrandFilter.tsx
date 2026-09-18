"use client";

export type Brand = "ALL" | "HIKOM" | "HICON";

const OPTIONS: { value: Brand; label: string }[] = [
  { value: "ALL", label: "Sara System" },
  { value: "HIKOM", label: "Hikom" },
  { value: "HICON", label: "Hicon" },
];

// Shared Hikom / Hicon / Sara System (all) toggle — used on every list page
// and on Reports/Overview so staff can view either brand's data alone or
// everything combined.
export default function BrandFilter({ value, onChange }: { value: Brand; onChange: (b: Brand) => void }) {
  return (
    <div className="flex gap-2">
      {OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            value === opt.value ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
