"use client";

import { useState } from "react";

const emptyForm = {
  jobNo: "",
  customerName: "",
  customerPhone: "",
  customerEmail: "",
  issueDescription: "",
};

export default function ComplaintFormPage() {
  const [formData, setFormData] = useState(emptyForm);
  const [attachment, setAttachment] = useState<File | null>(null);
  const [status, setStatus] = useState<{ type: "success" | "error" | ""; message: string }>({ type: "", message: "" });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setStatus({ type: "", message: "" });

    try {
      const body = new FormData();
      body.append("jobNo", formData.jobNo);
      body.append("customerName", formData.customerName);
      body.append("customerPhone", formData.customerPhone);
      body.append("customerEmail", formData.customerEmail);
      body.append("issueDescription", formData.issueDescription);
      if (attachment) body.append("attachment", attachment);

      const res = await fetch("/api/complaints", {
        method: "POST",
        body,
      });

      const data = await res.json();

      if (res.ok) {
        setStatus({ type: "success", message: "Aapki complaint safaltapurvak darj ho gayi hai. Hum jald hi aapse sampark karenge." });
        setFormData(emptyForm);
        setAttachment(null);
      } else {
        setStatus({ type: "error", message: data.message || "Complaint register karne me error aayi." });
      }
    } catch (error) {
      setStatus({ type: "error", message: "Server error. Kripya thodi der baad try karein." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8 flex items-center justify-center">
      <div className="max-w-md w-full bg-white p-8 rounded-xl shadow-lg">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-extrabold text-gray-900">Register a Complaint</h2>
          <p className="mt-2 text-sm text-gray-600">HICON Insta & Serv - Service Request</p>
        </div>

        {status.message && (
          <div className={`p-4 mb-6 rounded-md ${status.type === "success" ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"}`}>
            {status.message}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700">Job No</label>
            <input
              type="text"
              required
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-black"
              value={formData.jobNo}
              onChange={(e) => setFormData({ ...formData, jobNo: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Customer Name (Grahak ka Naam)</label>
            <input
              type="text"
              required
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-black"
              value={formData.customerName}
              onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Phone Number (Mobile Number)</label>
            <input
              type="tel"
              required
              pattern="[0-9]{10}"
              title="10 digit mobile number"
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-black"
              value={formData.customerPhone}
              onChange={(e) => setFormData({ ...formData, customerPhone: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Email <span className="text-gray-400 font-normal">(Optional)</span>
            </label>
            <input
              type="email"
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-black"
              value={formData.customerEmail}
              onChange={(e) => setFormData({ ...formData, customerEmail: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Upload Invoice / Bill <span className="text-gray-400 font-normal">(Optional)</span>
            </label>
            <input
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.webp"
              className="mt-1 block w-full text-sm text-gray-600 file:mr-3 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              onChange={(e) => setAttachment(e.target.files?.[0] || null)}
            />
            <p className="mt-1 text-xs text-gray-400">PDF or image, max 5MB</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Issue Description (Samasya batayein)</label>
            <textarea
              required
              rows={4}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-black"
              value={formData.issueDescription}
              onChange={(e) => setFormData({ ...formData, issueDescription: e.target.value })}
            ></textarea>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
          >
            {loading ? "Submitting..." : "Submit Complaint"}
          </button>
        </form>
      </div>
    </div>
  );
}
