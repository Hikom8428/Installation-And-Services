"use client";

import { useState } from "react";
import dynamic from "next/dynamic";

const LocationPicker = dynamic(() => import("@/components/LocationPicker"), {
  ssr: false,
  loading: () => <div className="h-[260px] rounded-md border border-gray-300 bg-gray-50 flex items-center justify-center text-sm text-gray-400">Loading map...</div>,
});

const emptyForm = {
  customerName: "",
  siteAddress: "",
  attendantName: "",
  attendantPhone: "",
  visitFor: "DOOR",
};

export default function SiteVisitFormPage() {
  const [formData, setFormData] = useState(emptyForm);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [status, setStatus] = useState<{ type: "success" | "error" | ""; message: string }>({ type: "", message: "" });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setStatus({ type: "", message: "" });

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
        const serialNo = data.siteVisit?.serialNo;
        setStatus({
          type: "success",
          message: serialNo
            ? `Site Visit request darj ho gaya hai (SV-${String(serialNo).padStart(4, "0")}). Hum jald hi aapse sampark karenge.`
            : "Site Visit request darj ho gaya hai. Hum jald hi aapse sampark karenge.",
        });
        setFormData(emptyForm);
        setCoords(null);
      } else {
        setStatus({ type: "error", message: data.message || "Site Visit request register karne me error aayi." });
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
          <h2 className="text-3xl font-extrabold text-gray-900">Request a Site Visit</h2>
          <p className="mt-2 text-sm text-gray-600">HICON Insta & Serv - Service Request</p>
        </div>

        {status.message && (
          <div className={`p-4 mb-6 rounded-md ${status.type === "success" ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"}`}>
            {status.message}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700">Customer Name</label>
            <input
              type="text"
              required
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-black"
              value={formData.customerName}
              onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Site Address</label>
            <textarea
              rows={2}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-black"
              value={formData.siteAddress}
              onChange={(e) => setFormData({ ...formData, siteAddress: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Site Location <span className="text-gray-400 font-normal">(tap on the map to mark the exact spot)</span>
            </label>
            <LocationPicker value={coords} onChange={setCoords} />
            {coords && (
              <p className="mt-1 text-xs text-gray-500">Selected: {coords.lat.toFixed(6)}, {coords.lng.toFixed(6)}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Site Attendant Name</label>
            <input
              type="text"
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-black"
              value={formData.attendantName}
              onChange={(e) => setFormData({ ...formData, attendantName: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Site Attendant Mobile No</label>
            <input
              type="tel"
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-black"
              value={formData.attendantPhone}
              onChange={(e) => setFormData({ ...formData, attendantPhone: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Visit For</label>
            <select
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-black"
              value={formData.visitFor}
              onChange={(e) => setFormData({ ...formData, visitFor: e.target.value })}
            >
              <option value="DOOR">Door</option>
              <option value="PANEL">Panel</option>
              <option value="DOOR_PANEL">Door + Panel</option>
            </select>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
          >
            {loading ? "Submitting..." : "Submit Site Visit Request"}
          </button>
        </form>
      </div>
    </div>
  );
}
