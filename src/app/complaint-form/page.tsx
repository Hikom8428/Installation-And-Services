"use client";

import { useState } from "react";
import dynamic from "next/dynamic";

const LocationPicker = dynamic(() => import("@/components/LocationPicker"), {
  ssr: false,
  loading: () => <div className="h-[260px] rounded-md border border-gray-300 bg-gray-50 flex items-center justify-center text-sm text-gray-400">Loading map...</div>,
});

const JOB_NO_PREFIX = "HI-";
const MAX_PHOTOS = 10;
const MAX_VIDEOS = 2;

const emptyForm = {
  jobNoDigits: "",
  doorSerialNo: "",
  customerName: "",
  customerPhone: "",
  customerEmail: "",
  siteAddress: "",
  attendantName: "",
  attendantPhone: "",
  issueDescription: "",
};

export default function ComplaintFormPage() {
  const [formData, setFormData] = useState(emptyForm);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [attachment, setAttachment] = useState<File | null>(null);
  const [photos, setPhotos] = useState<File[]>([]);
  const [videos, setVideos] = useState<File[]>([]);
  const [status, setStatus] = useState<{ type: "success" | "error" | ""; message: string }>({ type: "", message: "" });
  const [loading, setLoading] = useState(false);

  const handlePhotosChange = (files: FileList | null) => {
    const list = Array.from(files || []);
    if (list.length > MAX_PHOTOS) {
      setStatus({ type: "error", message: `You can upload at most ${MAX_PHOTOS} photos.` });
      return;
    }
    setPhotos(list);
  };

  const handleVideosChange = (files: FileList | null) => {
    const list = Array.from(files || []);
    if (list.length > MAX_VIDEOS) {
      setStatus({ type: "error", message: `You can upload at most ${MAX_VIDEOS} videos.` });
      return;
    }
    setVideos(list);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus({ type: "", message: "" });

    const jobNo = formData.jobNoDigits ? `${JOB_NO_PREFIX}${formData.jobNoDigits}` : "";
    if (!jobNo && !formData.doorSerialNo.trim()) {
      setStatus({ type: "error", message: "Please provide either Job No or Door Serial No." });
      return;
    }

    setLoading(true);

    try {
      const body = new FormData();
      body.append("jobNo", jobNo);
      body.append("doorSerialNo", formData.doorSerialNo);
      body.append("customerName", formData.customerName);
      body.append("customerPhone", formData.customerPhone);
      body.append("customerEmail", formData.customerEmail);
      body.append("siteAddress", formData.siteAddress);
      if (coords) {
        body.append("siteLatitude", String(coords.lat));
        body.append("siteLongitude", String(coords.lng));
      }
      body.append("attendantName", formData.attendantName);
      body.append("attendantPhone", formData.attendantPhone);
      body.append("issueDescription", formData.issueDescription);
      if (attachment) body.append("attachment", attachment);
      photos.forEach((p) => body.append("photos", p));
      videos.forEach((v) => body.append("videos", v));

      const res = await fetch("/api/complaints", {
        method: "POST",
        body,
      });

      const data = await res.json();

      if (res.ok) {
        setStatus({ type: "success", message: "Aapki complaint safaltapurvak darj ho gayi hai. Hum jald hi aapse sampark karenge." });
        setFormData(emptyForm);
        setCoords(null);
        setAttachment(null);
        setPhotos([]);
        setVideos([]);
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
            <label className="block text-sm font-medium text-gray-700">
              Job No <span className="text-gray-400 font-normal">(Job No ya Door Serial No, kam se kam ek zaroori hai)</span>
            </label>
            <div className="mt-1 flex items-stretch border border-gray-300 rounded-md shadow-sm overflow-hidden focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500">
              <span className="inline-flex items-center px-3 bg-gray-100 text-gray-600 font-medium text-sm select-none">
                {JOB_NO_PREFIX}
              </span>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]+"
                title="Digits only"
                placeholder="12450"
                className="block w-full px-3 py-2 border-0 focus:outline-none focus:ring-0 text-black"
                value={formData.jobNoDigits}
                onChange={(e) => setFormData({ ...formData, jobNoDigits: e.target.value.replace(/\D/g, "") })}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Door Serial No</label>
            <input
              type="text"
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-black"
              value={formData.doorSerialNo}
              onChange={(e) => setFormData({ ...formData, doorSerialNo: e.target.value })}
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
              Site Location <span className="text-gray-400 font-normal">(Optional — tap on the map to mark the exact spot)</span>
            </label>
            <LocationPicker value={coords} onChange={setCoords} />
            {coords && (
              <p className="mt-1 text-xs text-gray-500">Selected: {coords.lat.toFixed(6)}, {coords.lng.toFixed(6)}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Site Attendant Name <span className="text-gray-400 font-normal">(Optional)</span>
            </label>
            <input
              type="text"
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-black"
              value={formData.attendantName}
              onChange={(e) => setFormData({ ...formData, attendantName: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Site Attendant Mobile No <span className="text-gray-400 font-normal">(Optional)</span>
            </label>
            <input
              type="tel"
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-black"
              value={formData.attendantPhone}
              onChange={(e) => setFormData({ ...formData, attendantPhone: e.target.value })}
            />
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

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Problem Photos <span className="text-gray-400 font-normal">(Optional, up to {MAX_PHOTOS})</span>
            </label>
            <input
              type="file"
              accept="image/*"
              multiple
              className="mt-1 block w-full text-sm text-gray-600 file:mr-3 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              onChange={(e) => handlePhotosChange(e.target.files)}
            />
            {photos.length > 0 && <p className="mt-1 text-xs text-gray-500">{photos.length} photo(s) selected</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Problem Videos <span className="text-gray-400 font-normal">(Optional, up to {MAX_VIDEOS}, max 100MB each)</span>
            </label>
            <input
              type="file"
              accept="video/*"
              multiple
              className="mt-1 block w-full text-sm text-gray-600 file:mr-3 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              onChange={(e) => handleVideosChange(e.target.files)}
            />
            {videos.length > 0 && <p className="mt-1 text-xs text-gray-500">{videos.length} video(s) selected</p>}
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
