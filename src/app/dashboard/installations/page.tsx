"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { RefreshCw } from "lucide-react";

interface Installation {
  id: string;
  customerName: string;
  productDetails: string;
  status: string;
  syncDate: string;
  assignedDoer?: { name: string } | null;
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

  useEffect(() => {
    if (session) {
      fetchInstallations();
      if (session.user.role !== "DOER") {
        fetchDoers();
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case "PENDING": return "bg-yellow-100 text-yellow-800";
      case "ASSIGNED": return "bg-blue-100 text-blue-800";
      case "IN_PROGRESS": return "bg-purple-100 text-purple-800";
      case "COMPLETED": return "bg-green-100 text-green-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  if (loading) return <div className="p-8 text-center text-slate-500">Loading...</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Installations</h1>
          <p className="text-sm text-slate-500 mt-1">Manage installation tasks fetched from Google Sheets</p>
        </div>
        
        {session?.user.role !== "DOER" && (
          <button 
            onClick={handleSync}
            disabled={syncing}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-70"
          >
            <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Syncing...' : 'Sync from Google Sheets'}
          </button>
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
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Client Name</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Product Details</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Assigned To</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {installations.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-slate-500">
                    No installations found. Click Sync to pull data from Google Sheets.
                  </td>
                </tr>
              ) : (
                installations.map((inst) => (
                  <tr key={inst.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">
                      {inst.customerName}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600 max-w-xs truncate">
                      {inst.productDetails || "-"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2.5 py-1 inline-flex text-xs font-semibold rounded-full ${getStatusColor(inst.status)}`}>
                        {inst.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                      {inst.assignedDoer?.name || "Unassigned"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

