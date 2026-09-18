"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import dynamic from "next/dynamic";
import { Plus } from "lucide-react";
import TaskProgressModal from "@/components/TaskProgressModal";
import AssignDoersModal, { AssignmentInfo } from "@/components/AssignDoersModal";
import StatusTabs from "@/components/StatusTabs";
import CompletedTaskSummary, { StepSummary } from "@/components/CompletedTaskSummary";
import ExpandableText from "@/components/ExpandableText";
import BrandFilter, { Brand } from "@/components/BrandFilter";

const LocationPicker = dynamic(() => import("@/components/LocationPicker"), {
  ssr: false,
  loading: () => <div className="h-[220px] rounded-md border border-slate-200 bg-slate-50 flex items-center justify-center text-sm text-slate-400">Loading map...</div>,
});

interface SiteVisit {
  id: string;
  serialNo: number;
  customerName: string;
  siteAddress?: string | null;
  siteLatitude?: number | null;
  siteLongitude?: number | null;
  attendantName?: string | null;
  attendantPhone?: string | null;
  visitFor: string;
  status: string;
  assignments: AssignmentInfo[];
  stepSummary: StepSummary | null;
  raisedBy?: { name: string } | null;
  raisedVia?: string | null;
  raisedByName?: string | null;
  brand?: string | null;
  // Present only on Completed-tab (history) rows — each is one past round.
  taskId?: string;
  cycle?: number;
  roundLabel?: string;
  isReopenable?: boolean;
}

interface Doer {
  id: string;
  name: string;
}

const emptyForm = {
  customerName: "",
  siteAddress: "",
  attendantName: "",
  attendantPhone: "",
  visitFor: "DOOR",
  raisedVia: "",
  raisedByName: "",
  brand: "",
};

const RAISED_VIA_OPTIONS = ["Phone Call", "WhatsApp", "Email", "In Person", "Other"];

const visitForLabel = (v: string) => (v === "DOOR_PANEL" ? "Door + Panel" : v.charAt(0) + v.slice(1).toLowerCase());

export default function SiteVisitsDashboard() {
  const { data: session } = useSession();
  const [pendingVisits, setPendingVisits] = useState<SiteVisit[]>([]);
  const [completedVisits, setCompletedVisits] = useState<SiteVisit[]>([]);
  const [doers, setDoers] = useState<Doer[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const [createModal, setCreateModal] = useState(false);
  const [formData, setFormData] = useState(emptyForm);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [saving, setSaving] = useState(false);

  const [assignModal, setAssignModal] = useState<{ isOpen: boolean; visitId: string }>({ isOpen: false, visitId: "" });
  const [progressModal, setProgressModal] = useState<{ isOpen: boolean; visitId: string; cycle?: number; roundLabel?: string }>({ isOpen: false, visitId: "" });
  const [activeTab, setActiveTab] = useState<"PENDING" | "COMPLETED">("PENDING");
  const [deleteTarget, setDeleteTarget] = useState<SiteVisit | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [brandFilter, setBrandFilter] = useState<Brand>("ALL");

  const isStaff = session?.user.role === "MASTER" || session?.user.role === "ADMIN" || session?.user.role === "MANAGER";
  const isMaster = session?.user.role === "MASTER";

  const fetchVisits = async () => {
    try {
      const res = await fetch("/api/site-visits");
      const data = await res.json();
      if (res.ok) {
        setPendingVisits(data.pending || []);
        setCompletedVisits(data.completed || []);
      }
    } catch (error) {
      console.error("Failed to fetch site visits", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchDoers = async () => {
    try {
      const res = await fetch("/api/users/doers");
      const data = await res.json();
      if (res.ok) setDoers(data);
    } catch (error) {
      console.error("Failed to fetch doers", error);
    }
  };

  useEffect(() => {
    if (session) {
      fetchVisits();
      if (isStaff) fetchDoers();
    }
  }, [session]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "PENDING": return "bg-yellow-100 text-yellow-800";
      case "ASSIGNED": return "bg-blue-100 text-blue-800";
      case "IN_PROGRESS": return "bg-purple-100 text-purple-800";
      case "COMPLETED": return "bg-green-100 text-green-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      const res = await fetch("/api/site-visits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          siteLatitude: coords?.lat,
          siteLongitude: coords?.lng,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setCreateModal(false);
        setFormData(emptyForm);
        setCoords(null);
        setMessage("Site Visit created.");
        fetchVisits();
      } else {
        setMessage(data.message || "Failed to create Site Visit");
      }
    } catch (error) {
      setMessage("An error occurred");
    } finally {
      setSaving(false);
      setTimeout(() => setMessage(""), 5000);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const id = deleteTarget.taskId || deleteTarget.id;
      const res = await fetch(`/api/site-visits/${id}`, { method: "DELETE" });
      if (res.ok) {
        fetchVisits();
      } else {
        const data = await res.json();
        alert(data.message || "Failed to delete site visit");
      }
    } catch (error) {
      alert("An error occurred while deleting");
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  if (loading) return <div className="p-8 text-center text-slate-500">Loading...</div>;

  const tabVisits = activeTab === "COMPLETED" ? completedVisits : pendingVisits;
  const visibleVisits = brandFilter === "ALL" ? tabVisits : tabVisits.filter((v) => v.brand === brandFilter);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Site Visits</h1>
          <p className="text-sm text-slate-500 mt-1">Schedule and track Doer site visits</p>
        </div>
        <BrandFilter value={brandFilter} onChange={setBrandFilter} />
        {isStaff && (
          <button
            onClick={() => setCreateModal(true)}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Site Visit
          </button>
        )}
      </div>

      {message && (
        <div className="p-4 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg text-sm font-medium">
          {message}
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-4 pt-2">
          <StatusTabs
            active={activeTab}
            onChange={setActiveTab}
            pendingCount={pendingVisits.length}
            completedCount={completedVisits.length}
          />
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Serial No</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Brand</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Customer</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Requested By</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Visit For</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Site</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Assigned To</th>
                {activeTab === "COMPLETED" && (
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Summary</th>
                )}
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {visibleVisits.length === 0 ? (
                <tr>
                  <td colSpan={activeTab === "COMPLETED" ? 10 : 9} className="px-6 py-8 text-center text-slate-500">
                    {activeTab === "COMPLETED" ? "No completed site visits yet." : "No pending site visits found."}
                  </td>
                </tr>
              ) : (
                visibleVisits.map((v) => (
                  <tr key={v.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">
                      SV-{String(v.serialNo).padStart(4, "0")}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {v.brand ? (
                        <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${v.brand === "HIKOM" ? "bg-cyan-100 text-cyan-800" : "bg-fuchsia-100 text-fuchsia-800"}`}>
                          {v.brand === "HIKOM" ? "Hikom" : "Hicon"}
                        </span>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">{v.customerName}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                      {v.raisedByName ? (
                        <>
                          <div>{v.raisedByName}</div>
                          {v.raisedVia && <div className="text-xs text-slate-400">via {v.raisedVia}</div>}
                        </>
                      ) : v.raisedVia ? (
                        <div className="text-xs text-slate-400">via {v.raisedVia}</div>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">{visitForLabel(v.visitFor)}</td>
                    <td className="px-6 py-4 text-sm text-slate-600 max-w-[16rem]">
                      <ExpandableText text={v.siteAddress} />
                      {v.siteLatitude != null && v.siteLongitude != null && (
                        <a
                          href={`https://www.google.com/maps?q=${v.siteLatitude},${v.siteLongitude}`}
                          target="_blank" rel="noopener noreferrer"
                          className="text-blue-600 hover:underline text-xs block"
                        >
                          View on map
                        </a>
                      )}
                      {v.attendantName && (
                        <div className="text-xs text-slate-400">
                          {v.attendantName}{v.attendantPhone ? ` · ${v.attendantPhone}` : ""}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2.5 py-1 inline-flex text-xs font-semibold rounded-full ${getStatusColor(v.status)}`}>
                        {v.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                      {v.assignments.length > 0 ? v.assignments.map((a) => a.doerName).join(", ") : "Unassigned"}
                    </td>
                    {activeTab === "COMPLETED" && (
                      <td className="px-6 py-4">
                        <CompletedTaskSummary assignments={v.assignments} stepSummary={v.stepSummary} showExpense roundLabel={v.roundLabel} />
                      </td>
                    )}
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      {activeTab === "COMPLETED" ? (
                        <div className="flex items-center gap-3">
                          {isStaff && v.isReopenable && (
                            <button onClick={() => setAssignModal({ isOpen: true, visitId: v.taskId || v.id })} className="text-indigo-600 hover:text-indigo-900">
                              Reassign Doer
                            </button>
                          )}
                          <button
                            onClick={() => setProgressModal({ isOpen: true, visitId: v.taskId || v.id, cycle: v.cycle, roundLabel: v.roundLabel })}
                            className="text-blue-600 hover:text-blue-900"
                          >
                            View Progress
                          </button>
                          {isMaster && (
                            <button onClick={() => setDeleteTarget(v)} className="text-red-600 hover:text-red-900">Delete</button>
                          )}
                        </div>
                      ) : isStaff ? (
                        <div className="flex items-center gap-3">
                          <button onClick={() => setAssignModal({ isOpen: true, visitId: v.id })} className="text-indigo-600 hover:text-indigo-900">
                            Assign Doer
                          </button>
                          {v.assignments.length > 0 && (
                            <button onClick={() => setProgressModal({ isOpen: true, visitId: v.id })} className="text-blue-600 hover:text-blue-900">
                              View Progress
                            </button>
                          )}
                          {isMaster && (
                            <button onClick={() => setDeleteTarget(v)} className="text-red-600 hover:text-red-900">Delete</button>
                          )}
                        </div>
                      ) : (
                        <button onClick={() => setProgressModal({ isOpen: true, visitId: v.id })} className="text-green-600 hover:text-green-900">
                          Update Progress
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Site Visit Modal */}
      {createModal && (
        <div className="fixed inset-0 bg-slate-900/50 overflow-y-auto h-full w-full flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 rounded-xl shadow-lg w-full max-w-lg max-h-[85vh] overflow-y-auto">
            <h3 className="text-lg font-bold mb-4 text-slate-900">New Site Visit</h3>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Customer Name</label>
                <input type="text" required
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-900"
                  value={formData.customerName}
                  onChange={(e) => setFormData({ ...formData, customerName: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Brand</label>
                <select required
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-900"
                  value={formData.brand}
                  onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                >
                  <option value="">Select...</option>
                  <option value="HIKOM">Hikom</option>
                  <option value="HICON">Hicon</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Site Visit Raised Via</label>
                <select
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-900"
                  value={formData.raisedVia}
                  onChange={(e) => setFormData({ ...formData, raisedVia: e.target.value })}
                >
                  <option value="">Select...</option>
                  {RAISED_VIA_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Raised By (Person Name)</label>
                <input type="text"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-900"
                  placeholder="Who requested this site visit"
                  value={formData.raisedByName}
                  onChange={(e) => setFormData({ ...formData, raisedByName: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Site Address</label>
                <textarea rows={2}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-900"
                  value={formData.siteAddress}
                  onChange={(e) => setFormData({ ...formData, siteAddress: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Site Location <span className="text-slate-400 font-normal">(tap on the map)</span>
                </label>
                <LocationPicker value={coords} onChange={setCoords} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Site Attendant Name</label>
                <input type="text"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-900"
                  value={formData.attendantName}
                  onChange={(e) => setFormData({ ...formData, attendantName: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Site Attendant Mobile No</label>
                <input type="tel"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-900"
                  value={formData.attendantPhone}
                  onChange={(e) => setFormData({ ...formData, attendantPhone: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Visit For</label>
                <select
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-900"
                  value={formData.visitFor}
                  onChange={(e) => setFormData({ ...formData, visitFor: e.target.value })}
                >
                  <option value="DOOR">Door</option>
                  <option value="PANEL">Panel</option>
                  <option value="DOOR_PANEL">Door + Panel</option>
                </select>
              </div>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setCreateModal(false)}
                  className="flex-1 bg-slate-100 text-slate-700 p-2.5 rounded-lg text-sm font-medium hover:bg-slate-200">
                  Cancel
                </button>
                <button type="submit" disabled={saving}
                  className="flex-1 bg-blue-600 text-white p-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-60">
                  {saving ? "Creating..." : "Create Site Visit"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Assign Modal — reopening a Completed visit always starts a fresh (empty) cycle */}
      {assignModal.isOpen && (
        <AssignDoersModal
          taskType="SITE_VISIT"
          taskId={assignModal.visitId}
          isOpen={assignModal.isOpen}
          onClose={() => setAssignModal({ isOpen: false, visitId: "" })}
          doers={doers}
          currentAssignments={pendingVisits.find((v) => v.id === assignModal.visitId)?.assignments || []}
          onUpdated={fetchVisits}
        />
      )}

      {/* Task Progress Modal (Doer fills steps; Manager/Admin/Master view them) */}
      {progressModal.isOpen && (
        <TaskProgressModal
          taskType="SITE_VISIT"
          taskId={progressModal.visitId}
          isOpen={progressModal.isOpen}
          onClose={() => setProgressModal({ isOpen: false, visitId: "" })}
          mode={activeTab === "COMPLETED" ? "view" : session?.user.role === "DOER" ? "doer" : "view"}
          cycle={progressModal.cycle}
          roundLabel={progressModal.roundLabel}
          onUpdated={fetchVisits}
        />
      )}

      {/* Delete Confirm Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-slate-900/50 overflow-y-auto h-full w-full flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 rounded-xl shadow-lg w-full max-w-sm">
            <h3 className="text-lg font-bold mb-2 text-slate-900">Delete Site Visit</h3>
            <p className="text-sm text-slate-500 mb-4">
              Are you sure you want to permanently delete SV-{String(deleteTarget.serialNo).padStart(4, "0")} for{" "}
              <span className="font-semibold text-slate-700">{deleteTarget.customerName}</span>? This also removes its assignment and progress history. This cannot be undone.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setDeleteTarget(null)}
                className="flex-1 bg-slate-100 text-slate-700 p-2.5 rounded-lg text-sm font-medium hover:bg-slate-200"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 bg-red-600 text-white p-2.5 rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-60"
              >
                {deleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
