import { useEffect, useState } from "react";
import Sidebar from "../components/Sidebar";
import { apiFetch } from "../lib/api";
import { motion, AnimatePresence } from "framer-motion";

export default function Incidents() {
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    type: "Accident",
    location: "",
    description: "",
    reporterType: "Civilian",
    severity: "Medium",
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const data = await apiFetch("/api/incidents");
        if (!cancelled) setIncidents(Array.isArray(data) ? data : []);
      } catch (e) {
        if (!cancelled) setError(e?.message || "Failed to load incidents.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      await apiFetch("/api/incidents", {
        method: "POST",
        body: JSON.stringify(form),
      });
      setForm({ type: "Accident", location: "", description: "", reporterType: "Civilian", severity: "Medium" });
      // reload list
      const data = await apiFetch("/api/incidents");
      setIncidents(Array.isArray(data) ? data : []);
    } catch (e2) {
      setError(e2?.message || "Failed to submit incident.");
    } finally {
      setSubmitting(false);
    }
  };

  const glass = "bg-white/[0.03] backdrop-blur-2xl border border-white/10 shadow-[0_8px_32px_0_rgba(0,0,0,0.8)]";

  return (
    <div className="flex h-screen bg-[#050505] text-white overflow-hidden">
      <Sidebar />
      <main className="flex-1 p-8 overflow-y-auto custom-scrollbar">
        <div className="max-w-[1200px] mx-auto">
          <div className="flex items-center justify-between gap-4 mb-6">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">
                Incident <span className="text-[#e99b63]">Ledger</span>
              </h1>
              <p className="text-xs text-gray-500">
                Live immutable record of structural anomalies and security events.
              </p>
            </div>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-[10px] font-bold uppercase tracking-widest text-[#e99b63] hover:bg-[#e99b63]/10 transition-colors"
            >
              Refresh
            </button>
          </div>

          <motion.section 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className={`p-6 rounded-3xl ${glass} mb-6`}
          >
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-4">
              Submit an incident
            </p>
            <form onSubmit={submit} className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
                Type
                <select
                  value={form.type}
                  onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
                  className="mt-2 w-full rounded-xl bg-black/40 border border-white/10 px-3 py-2 text-xs text-gray-200 outline-none focus:border-[#e99b63]/60"
                >
                  <option>Accident</option>
                  <option>Fight</option>
                  <option>Fire</option>
                  <option>Flood</option>
                  <option>Medical</option>
                  <option>Suspicious</option>
                  <option>Other</option>
                </select>
              </label>
              <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
                Reporter
                <select
                  value={form.reporterType}
                  onChange={(e) => setForm((f) => ({ ...f, reporterType: e.target.value }))}
                  className="mt-2 w-full rounded-xl bg-black/40 border border-white/10 px-3 py-2 text-xs text-gray-200 outline-none focus:border-[#e99b63]/60"
                >
                  <option>Civilian</option>
                  <option>Officer</option>
                </select>
              </label>
              <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
                Criticality Level
                <select
                  value={form.severity}
                  onChange={(e) => setForm((f) => ({ ...f, severity: e.target.value }))}
                  className="mt-2 w-full rounded-xl bg-black/40 border border-white/10 px-3 py-2 text-xs text-gray-200 outline-none focus:border-[#e99b63]/60"
                >
                  <option>Low</option>
                  <option>Medium</option>
                  <option>High</option>
                  <option>Critical</option>
                </select>
              </label>
              <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500 md:col-span-2">
                Location
                <input
                  value={form.location}
                  onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                  placeholder="e.g., Bus stand entrance"
                  required
                  className="mt-2 w-full rounded-xl bg-black/40 border border-white/10 px-3 py-2 text-xs text-gray-200 outline-none focus:border-[#e99b63]/60"
                />
              </label>
              <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500 md:col-span-2">
                Description (optional)
                <textarea
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  rows={3}
                  placeholder="Short details…"
                  className="mt-2 w-full rounded-xl bg-black/40 border border-white/10 px-3 py-2 text-xs text-gray-200 outline-none focus:border-[#e99b63]/60 resize-none"
                />
              </label>
              <div className="md:col-span-2 flex items-center justify-end">
                <button
                  disabled={submitting}
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-[#e99b63] text-black text-[10px] font-bold uppercase tracking-widest shadow-[0_0_20px_rgba(233,155,99,0.25)] disabled:opacity-60"
                >
                  {submitting ? "Submitting…" : "Submit"}
                </button>
              </div>
            </form>
          </motion.section>

          {loading ? (
            <div className={`p-6 rounded-3xl ${glass}`}>
              <p className="text-xs text-gray-400">Loading incidents…</p>
            </div>
          ) : error ? (
            <div className="p-6 rounded-2xl bg-red-500/5 border border-red-500/20">
              <p className="text-xs text-red-300 font-mono">
                Request failed: {error}
              </p>
              <p className="text-[10px] text-gray-500 mt-2">
                If this is a connection issue, make sure the server is running on the configured API base URL.
              </p>
            </div>
          ) : incidents.length === 0 ? (
            <div className={`p-6 rounded-3xl ${glass}`}>
              <p className="text-xs text-gray-400 italic">
                No incidents yet. Submit one via the backend `POST /api/incidents`.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <AnimatePresence>
                {incidents.map((i) => (
                  <motion.article
                    key={i._id || `${i.type}-${i.timestamp}`}
                    layout
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    whileHover={{ scale: 1.02, rotateY: 1, rotateX: -1 }}
                    className={`p-5 rounded-3xl ${glass} hover:border-[#e99b63]/30 transition-all cursor-default`}
                  >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-[#e99b63]">
                        {String(i.type || "incident")}
                      </p>
                      <p className="text-xs font-semibold text-gray-200">
                        {String(i.location || "Unknown location")}
                      </p>
                    </div>
                    <p className="text-[10px] text-gray-500 font-mono">
                      {i.timestamp ? new Date(i.timestamp).toLocaleString() : ""}
                    </p>
                  </div>
                  <p className="text-[11px] text-gray-400 mt-3 leading-relaxed">
                    {String(i.description || "No description provided.")}
                  </p>
                  <div className="mt-4 flex items-center gap-2 text-[10px] text-gray-500">
                    <span className="px-2 py-1 rounded bg-black/40 border border-white/10 uppercase tracking-widest">
                      {String(i.reporterType || "Unknown source")}
                    </span>
                    <span className={`px-2 py-1 rounded border uppercase tracking-widest font-black ${
                      i.severity === 'Critical' ? 'text-red-500 border-red-500/20 bg-red-500/5' :
                      i.severity === 'High' ? 'text-orange-500 border-orange-500/20 bg-orange-500/5' :
                      'text-cyan-500 border-cyan-500/20 bg-cyan-500/5'
                    }`}>
                      {String(i.severity || "Medium")}
                    </span>
                  </div>
                </motion.article>
              ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

