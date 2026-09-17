"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { RefreshCw, Settings } from "lucide-react";
import TaskProgressModal from "@/components/TaskProgressModal";

interface Installation {
  id: string;
  customerName: string;
  productDetails: string;
  status: string;
  syncDate: string;
  assignedDoer?: { name: string } | null;
  data?: Record<string, string> | null;
}

interface Doer {
  id: string;
  name: string;
}

export default function InstallationsDashboard() {
  const { data: session } = useSession();
  const [installations, setInstallations] = useState<Installation[]>([]);
  const [doers, setDoers] = useState<Doer[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState("");

  // Which sheet columns are currently configured to show in the table
  const [selectedColumns, setSelectedColumns] = useState<string[]>([]);

  // Modals state
  const [assignModal, setAssignModal] = useState<{ isOpen: boolean; installationId: string }>({ isOpen: false, installationId: "" });
  const [progressModal, setProgressModal] = useState<{ isOpen: boolean; installationId: string }>({ isOpen: false, installationId: "" });
  const [columnModal, setColumnModal] = useState<{ isOpen: boolean; available: string[]; draft: string[]; loading: boolean }>({
    isOpen: false,
    available: [],
    draft: [],
    loading: false,
  });

  const fetchInstallations = async () => {
    try {
      const res = await fetch("/api/installations");
      const data = await res.json();
      if (res.ok) setInstallations(data);
    } catch (error) {
      console.error("Failed to fetch", error);
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

  const fetchColumns = async () => {
    try {
      const res = await fetch("/api/installations/sync/columns");
      const data = await res.json();
      if (res.ok) setSelectedColumns(data.selected || []);
    } catch (error) {
      console.error("Failed to fetch columns", error);
    }
  };

  useEffect(() => {
    if (session) {
      fetchInstallations();
      if (session.user.role !== "DOER") {
        fetchDoers();
        fetchColumns();
      }
    }
  }, [session]);

  const handleSync = async () => {
    setSyncing(true);
    setMessage("Syncing with Google Sheets...");
    try {
      const res = await fetch("/api/installations/sync", { method: "POST" });
      const data = await res.json();
      setMessage(data.message);
      fetchInstallations();
    } catch (error) {
      setMessage("Error syncing data.");
    } finally {
      setSyncing(false);
      setTimeout(() => setMessage(""), 5000);
    }
  };

  const openColumnModal = async () => {
    setColumnModal({ isOpen: true, available: [], draft: [], loading: true });
    try {
      const res = await fetch("/api/installations/sync/columns");
      const data = await res.json();
      if (res.ok) {
        setColumnModal({ isOpen: true, available: data.available || [], draft: data.selected || [], loading: false });
      } else {
        setMessage(data.message || "Failed to load columns");
        setColumnModal({ isOpen: false, available: [], draft: [], loading: false });
      }
    } catch (error) {
      console.error("Failed to load columns", error);
      setColumnModal({ isOpen: false, available: [], draft: [], loading: false });
    }
  };

  const toggleDraftColumn = (col: string) => {
    setColumnModal((prev) => ({
      ...prev,
      draft: prev.draft.includes(col) ? prev.draft.filter((c) => c !== col) : [...prev.draft, col],
    }));
  };

  const saveColumns = async () => {
    try {
      const res = await fetch("/api/installations/sync/columns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ columns: columnModal.draft }),
      });
      if (res.ok) {
        setSelectedColumns(columnModal.draft);
        setColumnModal({ isOpen: false, available: [], draft: [], loading: false });
        setMessage("Column selection saved. Click Sync to refresh data.");
        setTimeout(() => setMessage(""), 5000);
      }
    } catch (error) {
      console.error("Failed to save columns", error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "PENDING": return "bg-yellow-100 text-yellow-800";
      case "ASSIGNED": return "bg-blue-100 text-blue-800";
      case "IN_PROGRESS": return "bg-purple-100 text-purple-800";
      case "COMPLETED": return "bg-green-100 text-green-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const handleAssign = async (doerId: string) => {
    if (!doerId) return;
    try {
      const res = await fetch(`/api/installations/${assignModal.installationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignedDoerId: doerId }),
      });
      if (res.ok) {
        setAssignModal({ isOpen: false, installationId: "" });
        fetchInstallations(); // refresh
      }
    } catch (error) {
      console.error("Assign error", error);
    }
  };

  if (loading) return <div className="p-8 text-center text-slate-500">Loading...</div>;

  // Fall back to the fixed Client Name / Product Details columns until a
  // selection has been fetched (or for Doers, who can't configure columns).
  const displayColumns = selectedColumns.length > 0 ? selectedColumns : ["Client Name", "Order Details"];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Installations</h1>
          <p className="text-sm text-slate-500 mt-1">Manage installation tasks fetched from Google Sheets</p>
        </div>

        {session?.user.role !== "DOER" && (
          <div className="flex items-center gap-2">
            <button
              onClick={openColumnModal}
              className="flex items-center gap-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              <Settings className="w-4 h-4" />
              Configure Columns
            </button>
            <button
              onClick={handleSync}
              disabled={syncing}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-70"
            >
              <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Syncing...' : 'Sync from Google Sheets'}
            </button>
          </div>
        )}
      </div>

      {message && (
        <div className="p-4 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg text-sm font-medium">
          {message}
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                {displayColumns.map((col) => (
                  <th key={col} className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                    {col}
                  </th>
                ))}
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Assigned To</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {installations.length === 0 ? (
                <tr>
                  <td colSpan={displayColumns.length + 3} className="px-6 py-8 text-center text-slate-500">
                    No installations found. Click Sync to pull data from Google Sheets.
                  </td>
                </tr>
              ) : (
                installations.map((inst) => (
                  <tr key={inst.id} className="hover:bg-slate-50 transition-colors">
                    {displayColumns.map((col) => {
                      const value = inst.data?.[col] || (col === "Client Name" ? inst.customerName : "");
                      const isLink = /^https?:\/\//i.test(value);
                      return (
                        <td key={col} className="px-6 py-4 text-sm text-slate-600 max-w-xs truncate">
                          {isLink ? (
                            <a href={value} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 underline">
                              View
                            </a>
                          ) : (
                            value || "-"
                          )}
                        </td>
                      );
                    })}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2.5 py-1 inline-flex text-xs font-semibold rounded-full ${getStatusColor(inst.status)}`}>
                        {inst.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                      {inst.assignedDoer?.name || "Unassigned"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      {session?.user.role !== "DOER" ? (
                        <div className="flex items-center gap-3">
                          <button onClick={() => setAssignModal({ isOpen: true, installationId: inst.id })} className="text-indigo-600 hover:text-indigo-900">
                            Assign Doer
                          </button>
                          {inst.assignedDoer && (
                            <button onClick={() => setProgressModal({ isOpen: true, installationId: inst.id })} className="text-blue-600 hover:text-blue-900">
                              View Progress
                            </button>
                          )}
                        </div>
                      ) : (
                        // A Doer's list is already filtered to their own assigned tasks
                        <button onClick={() => setProgressModal({ isOpen: true, installationId: inst.id })} className="text-green-600 hover:text-green-900">
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

      {/* Assign Modal */}
      {assignModal.isOpen && (
        <div className="fixed inset-0 bg-slate-900/50 overflow-y-auto h-full w-full flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-xl shadow-lg w-96">
            <h3 className="text-lg font-bold mb-4 text-slate-900">Assign to Doer</h3>
            <select
              className="w-full p-2.5 border border-slate-200 rounded-lg mb-4 text-sm"
              defaultValue=""
              onChange={(e) => handleAssign(e.target.value)}
            >
              <option value="" disabled>Select a Doer...</option>
              {doers.map(doer => <option key={doer.id} value={doer.id}>{doer.name}</option>)}
            </select>
            <button
              onClick={() => setAssignModal({ isOpen: false, installationId: "" })}
              className="w-full bg-slate-100 text-slate-700 p-2.5 rounded-lg text-sm font-medium hover:bg-slate-200"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Task Progress Modal (Doer fills steps; Manager/Admin/Master view them) */}
      {progressModal.isOpen && (
        <TaskProgressModal
          taskType="INSTALLATION"
          taskId={progressModal.installationId}
          isOpen={progressModal.isOpen}
          onClose={() => setProgressModal({ isOpen: false, installationId: "" })}
          mode={session?.user.role === "DOER" ? "doer" : "view"}
          onUpdated={fetchInstallations}
        />
      )}

      {/* Configure Columns Modal */}
      {columnModal.isOpen && (
        <div className="fixed inset-0 bg-slate-900/50 overflow-y-auto h-full w-full flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-xl shadow-lg w-full max-w-lg max-h-[80vh] flex flex-col">
            <h3 className="text-lg font-bold mb-1 text-slate-900">Configure Columns</h3>
            <p className="text-sm text-slate-500 mb-4">
              Choose which columns from the Google Sheet should be pulled in and shown in the Installations table.
            </p>

            {columnModal.loading ? (
              <div className="py-8 text-center text-slate-500 text-sm">Loading columns from sheet...</div>
            ) : (
              <div className="flex-1 overflow-y-auto space-y-1 mb-4 border border-slate-100 rounded-lg p-3">
                {columnModal.available.map((col) => (
                  <label key={col} className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-slate-50 cursor-pointer text-sm">
                    <input
                      type="checkbox"
                      checked={columnModal.draft.includes(col)}
                      onChange={() => toggleDraftColumn(col)}
                      className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-slate-700">{col}</span>
                  </label>
                ))}
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => setColumnModal({ isOpen: false, available: [], draft: [], loading: false })}
                className="flex-1 bg-slate-100 text-slate-700 p-2.5 rounded-lg text-sm font-medium hover:bg-slate-200"
              >
                Cancel
              </button>
              <button
                onClick={saveColumns}
                disabled={columnModal.loading}
                className="flex-1 bg-blue-600 text-white p-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-60"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
