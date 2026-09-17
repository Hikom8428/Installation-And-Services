"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import TaskProgressModal from "@/components/TaskProgressModal";
import AssignDoersModal, { AssignmentInfo } from "@/components/AssignDoersModal";

interface Complaint {
  id: string;
  jobNo?: string | null;
  doorSerialNo?: string | null;
  customerName: string;
  customerPhone: string;
  customerEmail?: string | null;
  siteAddress?: string | null;
  siteLatitude?: number | null;
  siteLongitude?: number | null;
  attendantName?: string | null;
  attendantPhone?: string | null;
  issueDescription: string;
  attachmentUrl?: string | null;
  mediaUrls?: string[] | null;
  status: string;
  createdAt: string;
  assignments: AssignmentInfo[];
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
          <h1 className="text-2xl font-bold text-slate-900">Complaints</h1>
          <p className="text-sm text-slate-500 mt-1">Manage customer-reported service complaints</p>
        </div>
        <a href="/complaint-form" target="_blank" className="flex items-center gap-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors">
          Open Public Form ↗
        </a>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Date</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Job / Door No</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Customer</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Site</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Issue</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Media</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Assigned To</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white">
            {complaints.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-6 py-8 text-center text-slate-500">
                  No complaints found.
                </td>
              </tr>
            ) : (
              complaints.map((complaint) => (
                <tr key={complaint.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                    {new Date(complaint.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                    <div>{complaint.jobNo || "-"}</div>
                    {complaint.doorSerialNo && <div className="text-xs text-slate-400">Door: {complaint.doorSerialNo}</div>}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-slate-900">{complaint.customerName}</div>
                    <div className="text-sm text-slate-500">{complaint.customerPhone}</div>
                    {complaint.customerEmail && <div className="text-xs text-slate-400">{complaint.customerEmail}</div>}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-500 max-w-[12rem]">
                    {complaint.siteAddress && <div className="truncate">{complaint.siteAddress}</div>}
                    {complaint.siteLatitude != null && complaint.siteLongitude != null && (
                      <a
                        href={`https://www.google.com/maps?q=${complaint.siteLatitude},${complaint.siteLongitude}`}
                        target="_blank" rel="noopener noreferrer"
                        className="text-blue-600 hover:underline text-xs block"
                      >
                        View on map
                      </a>
                    )}
                    {complaint.attendantName && (
                      <div className="text-xs text-slate-400">
                        {complaint.attendantName}{complaint.attendantPhone ? ` · ${complaint.attendantPhone}` : ""}
                      </div>
                    )}
                    {!complaint.siteAddress && complaint.siteLatitude == null && !complaint.attendantName && "-"}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-500 max-w-xs truncate">
                    {complaint.issueDescription}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <div className="flex flex-col gap-0.5">
                      {complaint.attachmentUrl && (
                        <a href={complaint.attachmentUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 underline text-xs">
                          Bill
                        </a>
                      )}
                      {complaint.mediaUrls?.map((url, i) => (
                        <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 underline text-xs">
                          Media {i + 1}
                        </a>
                      ))}
                      {!complaint.attachmentUrl && (!complaint.mediaUrls || complaint.mediaUrls.length === 0) && (
                        <span className="text-slate-400">-</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2.5 py-1 inline-flex text-xs font-semibold rounded-full ${getStatusColor(complaint.status)}`}>
                      {complaint.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                    {complaint.assignments.length > 0 ? complaint.assignments.map((a) => a.doerName).join(", ") : "Unassigned"}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    {session?.user.role !== "DOER" ? (
                      <div className="flex items-center gap-3">
                        <button onClick={() => setAssignModal({ isOpen: true, complaintId: complaint.id })} className="text-indigo-600 hover:text-indigo-900">Assign Doer</button>
                        {complaint.assignments.length > 0 && (
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
      </div>

      {/* Assign Modal */}
      {assignModal.isOpen && (
        <AssignDoersModal
          taskType="COMPLAINT"
          taskId={assignModal.complaintId}
          isOpen={assignModal.isOpen}
          onClose={() => setAssignModal({ isOpen: false, complaintId: "" })}
          doers={doers}
          currentAssignments={complaints.find((c) => c.id === assignModal.complaintId)?.assignments || []}
          onUpdated={fetchComplaints}
        />
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

