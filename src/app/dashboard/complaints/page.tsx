"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import TaskProgressModal from "@/components/TaskProgressModal";

interface Complaint {
  id: string;
  jobNo?: string | null;
  customerName: string;
  customerPhone: string;
  customerEmail?: string | null;
  issueDescription: string;
  attachmentUrl?: string | null;
  status: string;
  createdAt: string;
  assignedDoer?: { name: string } | null;
}

interface Doer {
  id: string;
  name: string;
}

export default function ComplaintsDashboard() {
  const { data: session } = useSession();
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [doers, setDoers] = useState<Doer[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modals state
  const [assignModal, setAssignModal] = useState<{ isOpen: boolean; complaintId: string }>({ isOpen: false, complaintId: "" });
  const [progressModal, setProgressModal] = useState<{ isOpen: boolean; complaintId: string }>({ isOpen: false, complaintId: "" });

  const fetchComplaints = async () => {
    try {
      const res = await fetch("/api/complaints");
      const data = await res.json();
      if (res.ok) setComplaints(data);
    } catch (error) {
      console.error("Failed to fetch complaints", error);
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
      fetchComplaints();
      if (session.user.role !== "DOER") {
        fetchDoers();
      }
    }
  }, [session]);

  const handleAssign = async (doerId: string) => {
    try {
      const res = await fetch(`/api/complaints/${assignModal.complaintId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignedDoerId: doerId }),
      });
      if (res.ok) {
        setAssignModal({ isOpen: false, complaintId: "" });
        fetchComplaints(); // refresh
      }
    } catch (error) {
      console.error("Assign error", error);
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

  if (loading) return <div>Loading complaints...</div>;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Complaints Management</h1>
        <a href="/complaint-form" target="_blank" className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 text-sm font-medium">
          Open Public Form ↗
        </a>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Job No</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Issue</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Attachment</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Assigned To</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {complaints.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-6 py-4 text-center text-sm text-gray-500">
                  No complaints found.
                </td>
              </tr>
            ) : (
              complaints.map((complaint) => (
                <tr key={complaint.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(complaint.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {complaint.jobNo || "-"}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{complaint.customerName}</div>
                    <div className="text-sm text-gray-500">{complaint.customerPhone}</div>
                    {complaint.customerEmail && <div className="text-xs text-gray-400">{complaint.customerEmail}</div>}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">
                    {complaint.issueDescription}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {complaint.attachmentUrl ? (
                      <a href={complaint.attachmentUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 underline">
                        View
                      </a>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(complaint.status)}`}>
                      {complaint.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {complaint.assignedDoer?.name || "Unassigned"}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    {session?.user.role !== "DOER" ? (
                      <div className="flex items-center gap-3">
                        <button onClick={() => setAssignModal({ isOpen: true, complaintId: complaint.id })} className="text-indigo-600 hover:text-indigo-900">Assign Doer</button>
                        {complaint.assignedDoer && (
                          <button onClick={() => setProgressModal({ isOpen: true, complaintId: complaint.id })} className="text-blue-600 hover:text-blue-900">View Progress</button>
                        )}
                      </div>
                    ) : (
                       <button onClick={() => setProgressModal({ isOpen: true, complaintId: complaint.id })} className="text-green-600 hover:text-green-900">Update Progress</button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Assign Modal */}
      {assignModal.isOpen && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex items-center justify-center">
          <div className="bg-white p-6 rounded-md shadow-lg w-96">
            <h3 className="text-lg font-bold mb-4">Assign to Doer</h3>
            <select className="w-full p-2 border rounded mb-4" onChange={(e) => handleAssign(e.target.value)}>
              <option value="">Select a Doer...</option>
              {doers.map(doer => <option key={doer.id} value={doer.id}>{doer.name}</option>)}
            </select>
            <button onClick={() => setAssignModal({ isOpen: false, complaintId: "" })} className="w-full bg-gray-200 text-gray-800 p-2 rounded">Cancel</button>
          </div>
        </div>
      )}

      {/* Task Progress Modal (Doer fills steps; Manager/Admin/Master view them) */}
      {progressModal.isOpen && (
        <TaskProgressModal
          taskType="COMPLAINT"
          taskId={progressModal.complaintId}
          isOpen={progressModal.isOpen}
          onClose={() => setProgressModal({ isOpen: false, complaintId: "" })}
          mode={session?.user.role === "DOER" ? "doer" : "view"}
          onUpdated={fetchComplaints}
        />
      )}
    </div>
  );
}

