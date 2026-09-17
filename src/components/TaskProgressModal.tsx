"use client";

import { useEffect, useState } from "react";
import { MapPin, CheckCircle2, Circle, Loader2 } from "lucide-react";

export interface TaskStepData {
  sitePhotoUrl: string | null;
  siteVideoUrl: string | null;
  latitude: number | null;
  longitude: number | null;
  step1At: string | null;
  evidenceUrl: string | null;
  notes: string | null;
  chartUrl: string | null;
  step2At: string | null;
  expenseAmount: number | null;
  expenseNotes: string | null;
  billUrls: string[] | null;
  step3At: string | null;
}

type TaskType = "INSTALLATION" | "COMPLAINT" | "SITE_VISIT";

interface Props {
  taskType: TaskType;
  taskId: string;
  isOpen: boolean;
  onClose: () => void;
  // "doer": the assigned Doer can fill in the next pending step.
  // "view": read-only (Master/Admin/Manager checking progress + location).
  mode: "doer" | "view";
  onUpdated?: () => void;
}

const stepLabelsFor = (taskType: TaskType) =>
  taskType === "SITE_VISIT"
    ? ["Site Photo/Video & Location", "Visit Details & Chart", "Expense & Bills"]
    : ["Site Photo/Video & Location", "Work Complete Evidence", "Expense & Bills"];

export default function TaskProgressModal({ taskType, taskId, isOpen, onClose, mode, onUpdated }: Props) {
  const [step, setStep] = useState<TaskStepData | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Step 1 form state
  const [sitePhoto, setSitePhoto] = useState<File | null>(null);
  const [siteVideo, setSiteVideo] = useState<File | null>(null);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState("");

  // Step 2 form state
  const [evidence, setEvidence] = useState<File | null>(null);
  const [visitNotes, setVisitNotes] = useState("");
  const [chart, setChart] = useState<File | null>(null);

  // Step 3 form state
  const [expenseAmount, setExpenseAmount] = useState("");
  const [expenseNotes, setExpenseNotes] = useState("");
  const [bills, setBills] = useState<File[]>([]);

  const totalSteps = 3;
  const stepLabels = stepLabelsFor(taskType);

  const fetchStep = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/task-steps?taskType=${taskType}&taskId=${taskId}`);
      const data = await res.json();
      if (res.ok) setStep(data.step);
    } catch (e) {
      console.error("Failed to fetch task step", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) fetchStep();
  }, [isOpen, taskId, taskType]);

  const currentStage = !step?.step1At
    ? 1
    : !step?.step2At
    ? 2
    : !step?.step3At
    ? 3
    : 4;

  const captureLocation = () => {
    setLocationError("");
    if (!navigator.geolocation) {
      setLocationError("Location is not supported on this device/browser.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocating(false);
      },
      (err) => {
        setLocationError("Could not get location: " + err.message + ". Please allow location access.");
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  };

  const submitStep = async (stepNumber: number, extra: (fd: FormData) => void) => {
    setSubmitting(true);
    setError("");
    try {
      const fd = new FormData();
      fd.append("taskType", taskType);
      fd.append("taskId", taskId);
      fd.append("step", String(stepNumber));
      extra(fd);

      const res = await fetch("/api/task-steps", { method: "POST", body: fd });
      const data = await res.json();
      if (res.ok) {
        setStep(data.step);
        onUpdated?.();
      } else {
        setError(data.message || "Something went wrong");
      }
    } catch (e) {
      setError("Network error, please try again");
    } finally {
      setSubmitting(false);
    }
  };

  const handleStep1Submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!sitePhoto || !coords) return;
    submitStep(1, (fd) => {
      fd.append("sitePhoto", sitePhoto);
      if (siteVideo) fd.append("siteVideo", siteVideo);
      fd.append("latitude", String(coords.lat));
      fd.append("longitude", String(coords.lng));
    });
  };

  const handleStep2Submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (taskType === "SITE_VISIT") {
      if (!visitNotes.trim() || !chart) return;
      submitStep(2, (fd) => {
        fd.append("notes", visitNotes);
        fd.append("chart", chart);
      });
      return;
    }
    if (!evidence) return;
    submitStep(2, (fd) => fd.append("evidence", evidence));
  };

  const handleStep3Submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!expenseAmount) return;
    submitStep(3, (fd) => {
      fd.append("expenseAmount", expenseAmount);
      fd.append("expenseNotes", expenseNotes);
      bills.forEach((b) => fd.append("bills", b));
    });
  };

  if (!isOpen) return null;

  const StepHeader = ({ n, label }: { n: number; label: string }) => (
    <div className="flex items-center gap-2">
      {currentStage > n ? (
        <CheckCircle2 className="w-5 h-5 text-green-600" />
      ) : (
        <Circle className={`w-5 h-5 ${currentStage === n ? "text-blue-600" : "text-slate-300"}`} />
      )}
      <span className={`font-semibold ${currentStage === n ? "text-slate-900" : "text-slate-500"}`}>
        Step {n}: {label}
      </span>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-slate-900/50 overflow-y-auto h-full w-full flex items-center justify-center z-50 p-4">
      <div className="bg-white p-6 rounded-xl shadow-lg w-full max-w-lg max-h-[85vh] overflow-y-auto">
        <h3 className="text-lg font-bold mb-4 text-slate-900">Task Progress</h3>

        {loading ? (
          <div className="py-8 text-center text-slate-500 text-sm">Loading...</div>
        ) : (
          <div className="space-y-5">
            {error && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-100 text-sm text-red-600">{error}</div>
            )}

            {/* Step 1 */}
            <div className="border border-slate-100 rounded-lg p-4">
              <StepHeader n={1} label={stepLabels[0]} />
              {step?.step1At ? (
                <div className="mt-3 text-sm text-slate-600 space-y-1">
                  <a href={step.sitePhotoUrl || "#"} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline block">View site photo</a>
                  {step.siteVideoUrl && (
                    <a href={step.siteVideoUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline block">View site video</a>
                  )}
                  {step.latitude != null && step.longitude != null && (
                    <a
                      href={`https://www.google.com/maps?q=${step.latitude},${step.longitude}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-blue-600 hover:underline"
                    >
                      <MapPin className="w-4 h-4" /> View location on map
                    </a>
                  )}
                  <p className="text-xs text-slate-400">{new Date(step.step1At).toLocaleString()}</p>
                </div>
              ) : mode === "doer" && currentStage === 1 ? (
                <form onSubmit={handleStep1Submit} className="mt-3 space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Site Photo</label>
                    <input type="file" accept="image/*" capture="environment" required
                      onChange={(e) => setSitePhoto(e.target.files?.[0] || null)}
                      className="block w-full text-sm text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Site Video (optional)</label>
                    <input type="file" accept="video/*" capture="environment"
                      onChange={(e) => setSiteVideo(e.target.files?.[0] || null)}
                      className="block w-full text-sm text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700" />
                  </div>
                  <div>
                    <button type="button" onClick={captureLocation} disabled={locating}
                      className="flex items-center gap-2 text-sm font-medium text-blue-600 border border-blue-200 rounded-lg px-3 py-2 hover:bg-blue-50 disabled:opacity-60">
                      {locating ? <Loader2 className="w-4 h-4 animate-spin" /> : <MapPin className="w-4 h-4" />}
                      {coords ? "Location captured — tap to recapture" : "Capture current location"}
                    </button>
                    {coords && <p className="text-xs text-slate-500 mt-1">Lat: {coords.lat.toFixed(6)}, Lng: {coords.lng.toFixed(6)}</p>}
                    {locationError && <p className="text-xs text-red-600 mt-1">{locationError}</p>}
                  </div>
                  <button type="submit" disabled={!sitePhoto || !coords || submitting}
                    className="w-full bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-60">
                    {submitting ? "Submitting..." : "Submit Step 1"}
                  </button>
                </form>
              ) : (
                <p className="mt-2 text-xs text-slate-400">Pending</p>
              )}
            </div>

            {/* Step 2 */}
            <div className={`border border-slate-100 rounded-lg p-4 ${currentStage < 2 ? "opacity-50" : ""}`}>
              <StepHeader n={2} label={stepLabels[1]} />
              {step?.step2At ? (
                <div className="mt-3 text-sm text-slate-600 space-y-1">
                  {taskType === "SITE_VISIT" ? (
                    <>
                      {step.notes && <p className="whitespace-pre-wrap">{step.notes}</p>}
                      {step.chartUrl && (
                        <a href={step.chartUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline block">View site chart</a>
                      )}
                    </>
                  ) : (
                    <a href={step.evidenceUrl || "#"} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline block">View evidence</a>
                  )}
                  <p className="text-xs text-slate-400">{new Date(step.step2At).toLocaleString()}</p>
                </div>
              ) : mode === "doer" && currentStage === 2 ? (
                <form onSubmit={handleStep2Submit} className="mt-3 space-y-3">
                  {taskType === "SITE_VISIT" ? (
                    <>
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Site Visit Details</label>
                        <textarea rows={3} required value={visitNotes} onChange={(e) => setVisitNotes(e.target.value)}
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Site Chart & Calculation</label>
                        <input type="file" accept="image/*,application/pdf" required
                          onChange={(e) => setChart(e.target.files?.[0] || null)}
                          className="block w-full text-sm text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700" />
                      </div>
                      <button type="submit" disabled={!visitNotes.trim() || !chart || submitting}
                        className="w-full bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-60">
                        {submitting ? "Submitting..." : "Submit Step 2"}
                      </button>
                    </>
                  ) : (
                    <>
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Work Complete Evidence (photo/video)</label>
                        <input type="file" accept="image/*,video/*" capture="environment" required
                          onChange={(e) => setEvidence(e.target.files?.[0] || null)}
                          className="block w-full text-sm text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700" />
                      </div>
                      <button type="submit" disabled={!evidence || submitting}
                        className="w-full bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-60">
                        {submitting ? "Submitting..." : "Submit Step 2"}
                      </button>
                    </>
                  )}
                </form>
              ) : (
                <p className="mt-2 text-xs text-slate-400">{currentStage < 2 ? "Locked" : "Pending"}</p>
              )}
            </div>

            {/* Step 3 — final step for every task type, marks it Completed */}
            <div className={`border border-slate-100 rounded-lg p-4 ${currentStage < 3 ? "opacity-50" : ""}`}>
              <StepHeader n={3} label={stepLabels[2]} />
              {step?.step3At ? (
                <div className="mt-3 text-sm text-slate-600 space-y-1">
                  <p>Amount: <span className="font-semibold">₹{step.expenseAmount}</span></p>
                  {step.expenseNotes && <p className="text-xs text-slate-500">{step.expenseNotes}</p>}
                  {step.billUrls && step.billUrls.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {step.billUrls.map((url, i) => (
                        <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline text-xs">Bill {i + 1}</a>
                      ))}
                    </div>
                  )}
                  <p className="text-xs text-slate-400">{new Date(step.step3At).toLocaleString()}</p>
                </div>
              ) : mode === "doer" && currentStage === 3 ? (
                <form onSubmit={handleStep3Submit} className="mt-3 space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Expense Amount (₹)</label>
                    <input type="number" step="0.01" min="0" required value={expenseAmount}
                      onChange={(e) => setExpenseAmount(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Notes (optional)</label>
                    <textarea rows={2} value={expenseNotes} onChange={(e) => setExpenseNotes(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Upload Bills (optional, multiple allowed)</label>
                    <input type="file" accept="image/*,application/pdf" multiple
                      onChange={(e) => setBills(Array.from(e.target.files || []))}
                      className="block w-full text-sm text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700" />
                  </div>
                  <button type="submit" disabled={!expenseAmount || submitting}
                    className="w-full bg-green-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-60">
                    {submitting ? "Submitting..." : "Submit Step 3 & Mark Completed"}
                  </button>
                </form>
              ) : (
                <p className="mt-2 text-xs text-slate-400">{currentStage < 3 ? "Locked" : "Pending"}</p>
              )}
            </div>
          </div>
        )}

        <button onClick={onClose} className="w-full mt-5 bg-slate-100 text-slate-700 p-2.5 rounded-lg text-sm font-medium hover:bg-slate-200">
          Close
        </button>
      </div>
    </div>
  );
}
