"use client";

import { useState } from "react";

interface OccupiedTask {
  taskType: TaskType;
  taskId: string;
  label: string;
  status: string;
}

interface Doer {
  id: string;
  name: string;
  occupied?: OccupiedTask[];
}

export interface AssignmentInfo {
  doerId: string | null; // null once the Doer's account has been deleted
  doerName: string;
  fundAmount: number | null;
  fundNotes: string | null;
}

type TaskType = "INSTALLATION" | "COMPLAINT" | "SITE_VISIT";

interface Props {
  taskType: TaskType;
  taskId: string;
  isOpen: boolean;
  onClose: () => void;
  doers: Doer[];
  currentAssignments: AssignmentInfo[];
  onUpdated: () => void;
}

const apiBase: Record<TaskType, string> = {
  INSTALLATION: "/api/installations",
  COMPLAINT: "/api/complaints",
  SITE_VISIT: "/api/site-visits",
};

export default function AssignDoersModal({ taskType, taskId, isOpen, onClose, doers, currentAssignments, onUpdated }: Props) {
  const [selected, setSelected] = useState<string[]>([]);
  const [fundAmount, setFundAmount] = useState("");
  const [fundNotes, setFundNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  if (!isOpen) return null;

  const assignedIds = new Set(currentAssignments.map((a) => a.doerId));
  const availableDoers = doers.filter((d) => !assignedIds.has(d.id));

  const toggle = (id: string) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleAssign = async () => {
    if (selected.length === 0) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`${apiBase[taskType]}/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          doerIds: selected,
          fundAmount: fundAmount ? parseFloat(fundAmount) : undefined,
          fundNotes: fundNotes || undefined,
        }),
      });
      if (res.ok) {
        setSelected([]);
        setFundAmount("");
        setFundNotes("");
        onUpdated();
      } else {
        const data = await res.json();
        setError(data.message || "Failed to assign");
      }
    } catch (e) {
      setError("Network error, please try again");
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (doerId: string) => {
    try {
      const res = await fetch(`${apiBase[taskType]}/${taskId}?doerId=${doerId}`, { method: "DELETE" });
      if (res.ok) onUpdated();
    } catch (e) {
      console.error("Failed to unassign", e);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 overflow-y-auto h-full w-full flex items-center justify-center z-50 p-4">
      <div className="bg-white p-6 rounded-xl shadow-lg w-full max-w-sm max-h-[85vh] overflow-y-auto">
        <h3 className="text-lg font-bold mb-4 text-slate-900">Assign Doers</h3>

        {error && <div className="p-2 mb-3 rounded-lg bg-red-50 text-red-600 text-xs">{error}</div>}

        {currentAssignments.length > 0 && (
          <div className="mb-4">
            <p className="text-xs font-medium text-slate-500 mb-2">Currently Assigned</p>
            <div className="space-y-2">
              {currentAssignments.map((a) => (
                <div key={a.doerId || a.doerName} className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2 text-sm">
                  <div>
                    <span className="font-medium text-slate-800">{a.doerName}{!a.doerId && " (account deleted)"}</span>
                    {a.fundAmount != null && <span className="text-xs text-slate-500 ml-2">₹{a.fundAmount} fund</span>}
                  </div>
                  {a.doerId && (
                    <button onClick={() => handleRemove(a.doerId!)} className="text-red-500 hover:text-red-700 text-xs font-medium">
                      Remove
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {availableDoers.length > 0 ? (
          <>
            <p className="text-xs font-medium text-slate-500 mb-2">Add Doer(s)</p>
            <div className="space-y-1 mb-4 border border-slate-100 rounded-lg p-2 max-h-48 overflow-y-auto">
              {availableDoers.map((d) => (
                <label key={d.id} className="flex items-start gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-50 cursor-pointer text-sm">
                  <input
                    type="checkbox"
                    checked={selected.includes(d.id)}
                    onChange={() => toggle(d.id)}
                    className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 mt-0.5"
                  />
                  <span className="flex-1">
                    <span className="text-slate-700">{d.name}</span>
                    {!d.occupied || d.occupied.length === 0 ? (
                      <span className="ml-2 px-1.5 py-0.5 text-[10px] font-semibold rounded-full bg-green-100 text-green-800">Free</span>
                    ) : (
                      <span className="block mt-0.5">
                        {d.occupied.map((t) => (
                          <span key={`${t.taskType}-${t.taskId}`} className="mr-1 px-1.5 py-0.5 text-[10px] font-semibold rounded-full bg-amber-100 text-amber-800">
                            Busy: {t.label}
                          </span>
                        ))}
                      </span>
                    )}
                  </span>
                </label>
              ))}
            </div>

            <div className="mb-4 space-y-2">
              <label className="block text-xs font-medium text-slate-600">
                Fund Amount (₹) <span className="text-slate-400 font-normal">(Optional — given to each selected Doer)</span>
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={fundAmount}
                onChange={(e) => setFundAmount(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900"
                placeholder="e.g. 500"
              />
              <input
                type="text"
                value={fundNotes}
                onChange={(e) => setFundNotes(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900"
                placeholder="Fund notes (optional)"
              />
            </div>
          </>
        ) : (
          <p className="text-sm text-slate-400 mb-4">All Doers are already assigned to this task.</p>
        )}

        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 bg-slate-100 text-slate-700 p-2.5 rounded-lg text-sm font-medium hover:bg-slate-200">
            Close
          </button>
          {availableDoers.length > 0 && (
            <button
              onClick={handleAssign}
              disabled={selected.length === 0 || saving}
              className="flex-1 bg-blue-600 text-white p-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-60"
            >
              {saving ? "Assigning..." : "Assign"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
