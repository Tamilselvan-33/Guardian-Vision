import { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import 'boxicons/css/boxicons.min.css';
import Sidebar from '../components/Sidebar';
import { apiFetch } from "../lib/api";
import { motion, AnimatePresence } from "framer-motion";

// Ã¢â€â‚¬Ã¢â€â‚¬ CUSTOM STYLES Ã¢â€â‚¬Ã¢â€â‚¬
const styles = {
  glass: "bg-white/[0.03] backdrop-blur-2xl border border-white/10 shadow-[0_8px_32px_0_rgba(0,0,0,0.8)]",
  orangeGlow: "shadow-[0_0_20px_rgba(233,155,99,0.2)] border-[#e99b63]/20",
  badge: "px-2 py-0.5 rounded-md text-[10px] font-bold tracking-widest uppercase",
};

// Ã¢â€â‚¬Ã¢â€â‚¬ PREMIUM PAGINATION (Google/Premium Style) Ã¢â€â‚¬Ã¢â€â‚¬
const ThemedPagination = ({ currentPage, totalPages, onPageChange, color = "#e99b63" }) => {
  if (totalPages <= 1) return null;

  const getPagingRange = (current, total) => {
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    if (current <= 4) return [1, 2, 3, 4, 5, "...", total];
    if (current >= total - 3) return [1, "...", total - 4, total - 3, total - 2, total - 1, total];
    return [1, "...", current - 1, current, current + 1, "...", total];
  };

  const pages = getPagingRange(currentPage, totalPages);

  return (
    <div className="mt-8 mb-4 flex items-center justify-center gap-2 select-none font-mono">
      <div className="flex items-center gap-1">
        {pages.map((page, idx) => {
          if (page === "...") {
            return (
              <span key={`dots-${idx}`} className="px-2 text-gray-600 text-[11px] font-bold">
                ...
              </span>
            );
          }
          const isActive = currentPage === page;
          return (
            <button
              key={`page-${page}`}
              onClick={() => onPageChange(page)}
              className={`h-7 min-w-[28px] px-1.5 rounded-md flex items-center justify-center text-[10px] font-black transition-all duration-300 ${
                isActive
                  ? "text-black shadow-[0_4px_12px_rgba(233,155,99,0.3)]"
                  : "text-gray-400 hover:text-white hover:bg-white/5"
              }`}
              style={{
                backgroundColor: isActive ? color : "transparent",
              }}
            >
              {page}
            </button>
          );
        })}
      </div>

      {currentPage < totalPages && (
        <button
          onClick={() => onPageChange(currentPage + 1)}
          className="ml-4 flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-[#e99b63] hover:text-white transition-colors group"
        >
          Next <i className="bx bx-chevron-right group-hover:translate-x-1 transition-transform" />
        </button>
      )}
    </div>
  );
};

export default function Dashboard() {
  const navigate = useNavigate();
  // Always stay in sync by default (shows live updates as soon as user opens dashboard)
  const [isAnalyzing, setIsAnalyzing] = useState(true);
  const [dashboardData, setDashboardData] = useState({ liveData: null, feed: [], kineticData: { pressureScores: {}, growthRate: 0, riskLevel: 'Low' }, stats: { criticalCount: 0, safetyScore: 100, riskIndex: 0, criticalAlerts: [] } });
  const [backendError, setBackendError] = useState("");
  const [dbCheck, setDbCheck] = useState(null);
  const [edgeStatus, setEdgeStatus] = useState(null);
  const [demoRunning, setDemoRunning] = useState(false);
  const [showIncidentModal, setShowIncidentModal] = useState(false);
  const [incidentForm, setIncidentForm] = useState({
    type: "Accident",
    location: "",
    description: "",
    reporterType: "Officer",
    severity: "Medium",
  });
  const [visionModalOpen, setVisionModalOpen] = useState(false);
  const [visionMode, setVisionMode] = useState("webcam"); // webcam | droidcam
  const [droidCamUrl, setDroidCamUrl] = useState("http://192.168.0.100:4747/video");
  const [cameraId, setCameraId] = useState("CCTV-MAIN"); // active camera context for dashboard + edge badge
  const [areaSize, setAreaSize] = useState("50");
  const [showVideo, setShowVideo] = useState(true);
  const [detectorStatus, setDetectorStatus] = useState(null);
  const [startingDetector, setStartingDetector] = useState(false);
  const [selectedAlert, setSelectedAlert] = useState(null); // for Detailed Analysis Modal
  const [resolving, setResolving] = useState(false);
  const [feedPage, setFeedPage] = useState(1);
  const [criticalPage, setCriticalPage] = useState(1);
  const [selectionMode, setSelectionMode] = useState(null); // null | 'deploy' | 'sms' | 'medical'
  const [selectedReportIds, setSelectedReportIds] = useState(new Set());
  const [smsMessage, setSmsMessage] = useState("");
  const [medicalReports, setMedicalReports] = useState(new Set());
  const [broadcastedMessages, setBroadcastedMessages] = useState(new Map());

  // Memoize stats to prevent heavy calculation on every render (2s polling)
  const seg = useMemo(() => {
    const feed = dashboardData.feed || [];
    const crit = feed.filter(f => f.severity === 'Critical' || f.type?.toLowerCase().includes('surge') || f.type?.toLowerCase().includes('critical')).length;
    const highCount = feed.filter(f => f.severity === 'High').length;
    const mediumCount = feed.filter(f => f.severity === 'Medium').length;
    const lowCount = Math.max(0, feed.length - crit - highCount - mediumCount);

    const med = feed.filter(f => f.type?.toLowerCase().includes('medical')).length;
    const acc = feed.filter(f => f.type?.toLowerCase().includes('accident')).length;
    const crd = feed.filter(f => (f.type?.toLowerCase().includes('crowd') || f.type?.toLowerCase().includes('surge'))).length;
    const oth = Math.max(0, feed.length - med - acc - crd);

    return {
      critical: crit, high: highCount, medium: mediumCount, low: lowCount,
      civilian: feed.filter(f => f.src?.toLowerCase().includes('civili') || f.src?.toLowerCase().includes('public') || f.src?.toLowerCase().includes('report')).length,
      officer: feed.filter(f => f.src?.toLowerCase().includes('officer') || f.src?.toLowerCase().includes('unit') || f.src?.toLowerCase().includes('patrol')).length,
      ai: feed.filter(f => f.src?.toLowerCase().includes('ai') || f.src?.toLowerCase().includes('sensor') || f.src?.toLowerCase().includes('cctv')).length,
      resolved: feed.filter(f => f.status === 'Resolved').length,
      ignored: feed.filter(f => f.status === 'Ignored').length,
      pending: feed.filter(f => f.status !== 'Resolved' && f.status !== 'Ignored').length,
      medical: med, accident: acc, crowd: crd, other: oth,
      total: feed.length || 1
    };
  }, [dashboardData.feed]);

  const EDGE_STREAM_BASE = (
    import.meta.env.VITE_EDGE_STREAM_BASE_URL ||
    (typeof window !== "undefined" ? `http://${window.location.hostname}:8001` : "http://localhost:8001")
  ).replace(/\/$/, "");
  const effectiveStreamPort = detectorStatus?.streamPort || 8001;
  const effectiveStreamBase = EDGE_STREAM_BASE.replace(/:\d+$/, `:${effectiveStreamPort}`);
  const streamUrl = `${effectiveStreamBase}/stream?cameraId=${encodeURIComponent(cameraId)}&token=safety-first`;

  const refreshDetectorStatus = async () => {
    try {
      const s = await apiFetch("/api/detector/status");
      setDetectorStatus(s);
    } catch {
      // ignore
    }
  };

  // On load, detect if demo is already running (e.g. after refresh)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const s = await apiFetch("/api/sim/status");
        if (cancelled) return;
        if (s?.running) {
          setDemoRunning(true);
          setCameraId(s.cameraId || "SIM-CAM-01");
        } else {
          setDemoRunning(false);
        }
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const runDbCheck = async () => {
    setBackendError("");
    try {
      const data = await apiFetch("/api/db-check");
      setDbCheck(data);
    } catch (err) {
      setBackendError(err?.message || "DB check failed.");
    }
  };

  const refreshEdgeStatus = async () => {
    try {
      const data = await apiFetch(`/api/edge/status?cameraId=${encodeURIComponent(cameraId)}`);
      setEdgeStatus(data);
    } catch {
      // ignore
    }
  };

  const toggleDemo = async () => {
    setBackendError("");
    try {
      if (demoRunning) {
        await apiFetch("/api/sim/stop", { method: "POST" });
        setDemoRunning(false);
        setCameraId("CCTV-MAIN");
      } else {
        await apiFetch("/api/sim/start", {
          method: "POST",
          body: JSON.stringify({ cameraId: "SIM-CAM-01", location: "SIM-CAM-01", intervalMs: 2500 }),
        });
        setDemoRunning(true);
        setCameraId("SIM-CAM-01");
      }
    } catch (err) {
      setBackendError(err?.message || "Demo toggle failed.");
    }
  };

  const submitIncident = async (e) => {
    e?.preventDefault?.();
    setBackendError("");
    try {
      await apiFetch("/api/incidents", {
        method: "POST",
        body: JSON.stringify(incidentForm),
      });
      setShowIncidentModal(false);
      setIncidentForm((f) => ({ ...f, description: "" }));
    } catch (err) {
      setBackendError(err?.message || "Failed to submit incident.");
    }
  };

  const deployAiVision = async () => {
    setBackendError("");
    setStartingDetector(true);
    try {
      // stop demo to avoid confusion
      if (demoRunning) {
        await apiFetch("/api/sim/stop", { method: "POST" });
        setDemoRunning(false);
      }
      setCameraId("CCTV-MAIN");
      const started = await apiFetch("/api/detector/start", {
        method: "POST",
        body: JSON.stringify({ cameraId: "CCTV-MAIN", areaSize: Number(areaSize) || 50, videoSource: "0", streamPort: 8001 }),
      });
      setDetectorStatus(started);
      // give detector a moment to spin up and send heartbeat
      setTimeout(() => {
        refreshEdgeStatus();
        refreshDetectorStatus();
      }, 1200);
    } catch (err) {
      setBackendError(err?.message || "Failed to start detector.");
    } finally {
      setStartingDetector(false);
    }
  };

  const stopAiVision = async () => {
    setBackendError("");
    try {
      await apiFetch("/api/detector/stop", { method: "POST" });
      await refreshDetectorStatus();
    } catch (err) {
      setBackendError(err?.message || "Failed to stop detector.");
    }
  };

  useEffect(() => {
    let interval;
    if (isAnalyzing) {
      const fetchData = async () => {
        try {
          const data = await apiFetch(`/api/dashboard?cameraId=${encodeURIComponent(cameraId)}`);
          setDashboardData(data);
          setBackendError("");
        } catch (err) {
          console.error("Backend offline or unreachable:", err);
          setBackendError(err?.message || "Backend offline or unreachable.");
        }
      };
      fetchData();
      interval = setInterval(fetchData, 2000);
    }
    return () => clearInterval(interval);
  }, [isAnalyzing, cameraId]);

  useEffect(() => {
    // refresh edge status periodically (lightweight)
    refreshEdgeStatus();
    const t = setInterval(refreshEdgeStatus, 5000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameraId]);

  useEffect(() => {
    refreshDetectorStatus();
    const t = setInterval(refreshDetectorStatus, 5000);
    return () => clearInterval(t);
  }, []);

  const handleResolve = async (id, dbType, status) => {
    setSelectedAlert(null);
    setResolving(true);
    try {
      await apiFetch(`/api/resolve/${dbType}/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      refreshData();
    } catch (err) {
      setBackendError(err.message || "Failed to resolve incident.");
    } finally {
      setResolving(false);
    }
  };

  const handleClearAll = async () => {
    try {
      await apiFetch('/api/dashboard/clear-all', { method: 'DELETE' });
      refreshData();
    } catch (err) {
      setBackendError("Clear All failed: " + err.message);
    }
  };

  const handleIndividualClear = async (type, id) => {
    setResolving(true);
    try {
      await apiFetch(`/api/resolve/${type}/${id}/clear`, { method: 'DELETE' });
      setSelectedAlert(null);
      refreshData();
    } catch (err) {
      setBackendError("Delete failed: " + err.message);
    } finally {
      setResolving(false);
    }
  };

  const refreshData = async () => {
    try {
      const data = await apiFetch(`/api/dashboard?cameraId=${encodeURIComponent(cameraId)}`);
      setDashboardData(data);
    } catch (err) {
      setBackendError(err.message);
    }
  };

  const handleBulkDeploy = async () => {
    setResolving(true);
    try {
      const promises = Array.from(selectedReportIds).map(async (id) => {
        const item = dashboardData.feed.find(f => f.id === id);
        if (item) {
          return apiFetch(`/api/resolve/${item.dbType}/${id}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'Resolved' })
          });
        }
        return null;
      });
      await Promise.all(promises);
      refreshData();
      setSelectionMode(null);
      setSelectedReportIds(new Set());
    } catch (err) {
      setBackendError("Bulk Deploy failed: " + err.message);
    } finally {
      setResolving(false);
    }
  };

  const handleBulkSms = async () => {
    if (!smsMessage) {
      alert("Please enter a message to broadcast.");
      return;
    }
    if (selectedReportIds.size === 0) return;
    const reportId = Array.from(selectedReportIds)[0];
    
    setBroadcastedMessages(prev => {
      const next = new Map(prev);
      next.set(reportId, smsMessage);
      return next;
    });

    setBackendError("");
    setSmsMessage("");
    setSelectionMode(null);
    setSelectedReportIds(new Set());
  };

  const handleBulkMedical = async () => {
    setResolving(true);
    try {
      const promises = Array.from(selectedReportIds).map(async (id) => {
        const item = dashboardData.feed.find(f => f.id === id);
        if (item) {
          await apiFetch(`/api/resolve/${item.dbType}/${id}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'Medical' })
          });
          setMedicalReports(prev => new Set(prev).add(id));
        }
      });
      await Promise.all(promises);
      alert("Reports have sent to nearby medical centers/hospitals... whichever is nearer to them...");
      refreshData();
      setSelectionMode(null);
      setSelectedReportIds(new Set());
    } catch (err) {
      setBackendError("Bulk Medical failed: " + err.message);
    } finally {
      setResolving(false);
    }
  };

  const toggleSelection = (id) => {
    setSelectedReportIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        if (selectionMode === 'sms') {
          // Single selection for SMS
          next.clear();
        }
        next.add(id);
      }
      return next;
    });
  };

  return (
    <div className="flex h-screen bg-[#050505] text-white font-sans selection:bg-[#e99b63]/30 overflow-hidden">
      
      {/* Ã¢â€â‚¬Ã¢â€â‚¬ SIDEBAR Ã¢â€â‚¬Ã¢â€â‚¬ */}
      <Sidebar />

      {/* Ã¢â€â‚¬Ã¢â€â‚¬ MAIN CONTENT Ã¢â€â‚¬Ã¢â€â‚¬ */}
      <main className="flex-1 p-8 overflow-y-auto custom-scrollbar">
        <div className="max-w-[1400px] mx-auto flex flex-col gap-8">

          {backendError && (
            <div className="p-4 rounded-2xl bg-red-500/5 border border-red-500/20">
              <p className="text-xs text-red-300 font-mono">
                Backend issue: {backendError}
              </p>
              <p className="text-[10px] text-gray-500 mt-1">
                Start the Node server (`server/index.js`) and MongoDB, or set `VITE_API_BASE_URL`.
              </p>
            </div>
          )}
          
          {/* AI COMMAND CENTER (TV SETUP) */}
          <motion.section 
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8 }}
            className={`p-8 rounded-3xl ${styles.glass} relative overflow-hidden group`}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-[#e99b63]/5 to-transparent pointer-events-none" />
            
            <div className="flex justify-between items-start mb-8 relative z-10">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className={`h-2 w-2 rounded-full ${isAnalyzing ? 'bg-amber-500 animate-ping' : 'bg-red-600 animate-pulse'}`} />
                  <span className={`text-[10px] font-bold uppercase tracking-widest ${isAnalyzing ? 'text-amber-500' : 'text-emerald-500'}`}>
                    {isAnalyzing ? 'Syncing CCTV Streams...' : 'Live Crowd Density Analysis'}
                  </span>
                </div>
                <h3 className="text-2xl font-bold italic tracking-tight">Global Command <span className="text-[#e99b63]">Nexus</span></h3>
                <p className="text-xs text-gray-500">Real-time AI monitoring of high-traffic zones. Detecting crowd density and anomalous patterns across metropolitan nodes.</p>
              </div>
              <div className="flex gap-2">
                <button className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-[10px] font-bold uppercase tracking-widest text-[#e99b63] hover:bg-[#e99b63]/10 transition-colors">
                  <i className="bx bx-history mr-2" /> Playback
                </button>
                <button
                  onClick={() => setIsAnalyzing((v) => !v)}
                  className={`px-4 py-2 rounded-xl border text-[10px] font-bold uppercase tracking-widest transition-colors ${
                    isAnalyzing
                      ? "bg-white/5 border-white/10 text-gray-200 hover:border-[#e99b63]/30"
                      : "bg-amber-500/10 border-amber-500/30 text-amber-300 hover:bg-amber-500/15"
                  }`}
                  title="Pause/resume live polling"
                >
                  <i className={`bx ${isAnalyzing ? "bx-pause-circle" : "bx-play-circle"} mr-2`} />
                  {isAnalyzing ? "Pause Sync" : "Resume Sync"}
                </button>
                <button
                  onClick={runDbCheck}
                  className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-[10px] font-bold uppercase tracking-widest text-gray-200 hover:border-[#e99b63]/30 transition-colors"
                  title="Verify MongoDB + latest logs"
                >
                  <i className="bx bx-data mr-2" /> DB Check
                </button>
                <button
                  onClick={toggleDemo}
                  className={`px-4 py-2 rounded-xl border text-[10px] font-bold uppercase tracking-widest transition-colors ${
                    demoRunning
                      ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/15"
                      : "bg-white/5 border-white/10 text-gray-200 hover:border-[#e99b63]/30"
                  }`}
                  title="Start/stop built-in demo simulator (no Python needed)"
                >
                  <i className={`bx ${demoRunning ? "bx-stop-circle" : "bx-play-circle"} mr-2`} />
                  {demoRunning ? "Stop Demo" : "Run Demo"}
                </button>
                <button 
                  onClick={deployAiVision}
                  className="px-6 py-2 rounded-xl text-black text-[10px] font-bold uppercase tracking-widest shadow-[0_0_20px_rgba(233,155,99,0.3)] hover:scale-105 transition-all bg-[#e99b63]"
                >
                  <i className={`bx ${startingDetector ? "bx-loader-alt animate-spin" : "bx-broadcast"} mr-2`} />
                  {startingDetector ? "Starting..." : "Deploy AI Vision"}
                </button>
                <button
                  onClick={stopAiVision}
                  className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-[10px] font-bold uppercase tracking-widest text-gray-200 hover:border-red-500/30 hover:text-red-300 transition-colors"
                  title="Stop local detector.py"
                >
                  <i className="bx bx-stop-circle mr-2" /> Stop Vision
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-[10px] font-mono mt-2 text-gray-500 relative z-10">
              <span className="uppercase tracking-widest">Edge:</span>
              <span className={`px-2 py-1 rounded border ${edgeStatus?.online ? "border-emerald-500/30 text-emerald-300 bg-emerald-500/5" : "border-white/10 text-gray-400 bg-white/5"}`}>
                {edgeStatus?.online ? `ONLINE (${edgeStatus.source})` : "OFFLINE"}
              </span>
              <span className="px-2 py-1 rounded border border-white/10 bg-white/5 text-gray-400">
                cam:{cameraId}
              </span>
              {detectorStatus?.pid && (
                <span className="px-2 py-1 rounded border border-white/10 bg-white/5 text-gray-400">
                  detector pid:{detectorStatus.pid}
                </span>
              )}
              <button
                onClick={() => setShowVideo((v) => !v)}
                className="px-2 py-1 rounded border border-white/10 bg-white/5 text-gray-300 hover:border-[#e99b63]/30 transition-colors"
                title="Toggle CCTV video stream"
              >
                {showVideo ? "Hide Video" : "Show Video"}
              </button>
              {dbCheck?.counts && (
                <span className="px-2 py-1 rounded border border-white/10 bg-white/5 text-gray-400">
                  DB logs:{dbCheck.counts.logs} alerts:{dbCheck.counts.alerts} incidents:{dbCheck.counts.incidents}
                </span>
              )}
            </div>

            <div className="aspect-video rounded-2xl bg-black border-4 border-white/5 relative flex items-center justify-center overflow-hidden shadow-2xl">
              <div className="absolute inset-0 pointer-events-none opacity-20 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_2px,3px_100%] z-20" />
              <div className="absolute inset-0 opacity-[0.03] z-10 pointer-events-none animate-noise" />
              
              {isAnalyzing && (
                <>
                  <div className="absolute top-0 left-0 w-full h-1 bg-[#e99b63] shadow-[0_0_15px_#e99b63] animate-scan z-30" />
                  <div className="absolute inset-0 flex items-center justify-center z-30 pointer-events-none">
                     <div className="relative h-64 w-64">
                        <div className="absolute inset-0 border-2 border-[#e99b63]/40 rounded-full animate-ping opacity-20" />
                        <div className="absolute inset-8 border border-[#e99b63]/60 rounded-full animate-spin duration-[3000ms]" />
                        <div className="absolute inset-16 border-2 border-dashed border-[#e99b63]/20 rounded-full animate-reverse-spin" />
                     </div>
                  </div>
                </>
              )}

              {/* Live video stream (MJPEG from detector.py) */}
              {showVideo && edgeStatus?.online && edgeStatus?.source !== "server-sim" ? (
                <img
                  src={streamUrl}
                  alt="Live CCTV stream"
                  className="absolute inset-0 w-full h-full object-cover opacity-90"
                />
              ) : (
                <div className={`text-center transition-all duration-700 ${isAnalyzing ? 'scale-90 opacity-40 blur-[2px]' : 'group-hover:scale-110'}`}>
                  <div className="h-20 w-20 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mb-4 mx-auto backdrop-blur-md">
                    <i className="bx bx-video text-4xl text-[#e99b63]/50" />
                  </div>
                  <p className="text-gray-600 font-mono text-[10px] uppercase tracking-[0.3em]">
                    {edgeStatus?.source === "server-sim"
                      ? "DEMO MODE (NO VIDEO)"
                      : edgeStatus?.online
                      ? "EDGE ONLINE Ã¢â‚¬â€ START MJPEG STREAM"
                      : "EDGE OFFLINE Ã¢â‚¬â€ RUN detector.py"}
                  </p>
                  <p className="text-[10px] text-gray-600 mt-2 font-mono">
                    {edgeStatus?.source === "server-sim"
                      ? ""
                      : `Stream: ${EDGE_STREAM_BASE}/stream`}
                  </p>
                </div>
              )}
              <div className="absolute top-6 right-6 flex flex-col items-end gap-1 font-mono text-[8px] text-[#e99b63] opacity-40">
                <span>PEOPLE COUNT: {dashboardData.liveData ? dashboardData.liveData.peopleCount : '---'}</span>
                <span>DENSITY: {dashboardData.liveData ? dashboardData.liveData.density.toFixed(2) : '---'}</span>
                <span>RISK: {dashboardData.liveData ? dashboardData.liveData.riskLevel : '---'}</span>
              </div>
              <div className="absolute bottom-6 left-6 flex flex-col gap-1 font-mono text-[8px] text-cyan-500 opacity-80">
                <span>AI_CORE: 4-PHASE ACTIVE</span>
                <span>DATA_STREAM: ENCRYPTED</span>
                {dashboardData.liveData?.zoneData && (
                  <div className="mt-2 text-[#e99b63] border border-[#e99b63]/40 bg-black/40 p-2 rounded-lg grid grid-cols-2 gap-2 text-center w-36">
                     <div className="border border-[#e99b63]/20 p-1">
                        Z1<br/><span className={dashboardData.liveData.zoneData['Zone 1'] > 10 ? "text-red-500 text-xs font-bold" : "text-xs font-bold"}>{dashboardData.liveData.zoneData['Zone 1'] || 0}</span>
                     </div>
                     <div className="border border-[#e99b63]/20 p-1">
                        Z2<br/><span className={dashboardData.liveData.zoneData['Zone 2'] > 10 ? "text-red-500 text-xs font-bold" : "text-xs font-bold"}>{dashboardData.liveData.zoneData['Zone 2'] || 0}</span>
                     </div>
                     <div className="border border-[#e99b63]/20 p-1">
                        Z3<br/><span className={dashboardData.liveData.zoneData['Zone 3'] > 10 ? "text-red-500 text-xs font-bold" : "text-xs font-bold"}>{dashboardData.liveData.zoneData['Zone 3'] || 0}</span>
                     </div>
                     <div className="border border-[#e99b63]/20 p-1">
                        Z4<br/><span className={dashboardData.liveData.zoneData['Zone 4'] > 10 ? "text-red-500 text-xs font-bold" : "text-xs font-bold"}>{dashboardData.liveData.zoneData['Zone 4'] || 0}</span>
                     </div>
                  </div>
                )}
              </div>

              {/* AI DETECTION OVERLAY */}
              {dashboardData.liveData && dashboardData.liveData.riskLevel !== 'Low' && (
                <div className="absolute inset-0 z-40 bg-red-500/10 border-4 border-red-500/40 animate-pulse pointer-events-none flex items-center justify-center">
                   <div className="bg-red-600 text-white px-6 py-2 rounded-full font-black text-sm tracking-[0.3em] uppercase shadow-[0_0_30px_#ef4444]">
                     AI DETECTION ACTIVE: {dashboardData.liveData.riskLevel} RISK
                   </div>
                </div>
              )}
            </div>
          </motion.section>

          {/* ── KINETIC ANALYSIS PANEL ── */}
          <motion.section
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className={`rounded-3xl ${styles.glass} p-6 relative overflow-hidden`}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 to-transparent pointer-events-none" />
            <div className="flex items-center justify-between mb-5 relative z-10">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-cyan-500 mb-1">Phase 3+ Intelligence</p>
                <h3 className="text-lg font-bold">Kinetic <span className="text-cyan-400">Crowd Analysis</span></h3>
                <p className="text-xs text-gray-500 mt-0.5">Optical flow pressure scores &amp; crowd velocity delta — real-time per zone</p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <div className="flex items-center gap-2">
                  <span className="text-[9px] font-mono uppercase text-gray-500">Growth Rate</span>
                  <span className={`px-2 py-0.5 rounded-md font-mono text-xs font-bold border ${
                    (dashboardData.kineticData?.growthRate ?? 0) > 0.05
                      ? 'bg-red-500/10 border-red-500/30 text-red-400'
                      : (dashboardData.kineticData?.growthRate ?? 0) > 0.02
                      ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                      : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                  }`}>
                    {dashboardData.kineticData?.growthRate != null
                      ? `${dashboardData.kineticData.growthRate >= 0 ? '+' : ''}${dashboardData.kineticData.growthRate.toFixed(4)} ρ/s`
                      : '--- ρ/s'}
                  </span>
                </div>
                <span className="text-[9px] font-mono text-gray-600">ρ = density units per second</span>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 relative z-10">
              {['Zone 1','Zone 2','Zone 3','Zone 4'].map((zone) => {
                const score = dashboardData.kineticData?.pressureScores?.[zone] ?? null;
                const zoneCount = dashboardData.liveData?.zoneData?.[zone] ?? 0;

                // Determine alert type badge for this zone from feed
                const zoneAlerts = (dashboardData.feed || []).filter(
                  f => f.status === 'Unverified' &&
                       (f.metadata?.zone === zone || (f.loc && f.loc.includes(zone)))
                );
                const alertType = zoneAlerts.length > 0 ? (zoneAlerts[0].alertType || 'CROWD_DENSITY') : null;

                // Color system
                const pressureColor = score === null ? 'gray'
                  : score > 0.9 ? 'red'
                  : score > 0.6 ? 'orange'
                  : score > 0.3 ? 'amber'
                  : 'emerald';

                const colorMap = {
                  red:     { bar: 'bg-red-500',     border: 'border-red-500/30',     text: 'text-red-400',     bg: 'bg-red-500/5' },
                  orange:  { bar: 'bg-orange-500',  border: 'border-orange-500/30',  text: 'text-orange-400',  bg: 'bg-orange-500/5' },
                  amber:   { bar: 'bg-amber-500',   border: 'border-amber-500/30',   text: 'text-amber-400',   bg: 'bg-amber-500/5' },
                  emerald: { bar: 'bg-emerald-500', border: 'border-emerald-500/30', text: 'text-emerald-400', bg: 'bg-emerald-500/5' },
                  gray:    { bar: 'bg-gray-700',    border: 'border-white/10',        text: 'text-gray-500',    bg: 'bg-white/[0.02]' },
                };
                const c = colorMap[pressureColor];

                const alertTypeBadgeColor = {
                  DIRECTIONAL_CONFLICT: 'bg-red-500/20 border-red-500/40 text-red-300',
                  PRESSURE_SURGE:       'bg-orange-500/20 border-orange-500/40 text-orange-300',
                  CROWD_DENSITY:        'bg-amber-500/20 border-amber-500/40 text-amber-300',
                  VELOCITY_SURGE:       'bg-purple-500/20 border-purple-500/40 text-purple-300',
                  MANUAL_REPORT:        'bg-blue-500/20 border-blue-500/40 text-blue-300',
                };

                return (
                  <div key={zone} className={`rounded-2xl border ${c.border} ${c.bg} p-4 flex flex-col gap-3`}>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{zone}</span>
                      <span className={`text-lg font-black ${c.text}`}>{zoneCount}</span>
                    </div>

                    {/* Pressure Score Bar */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[9px] font-mono text-gray-600 uppercase">Pressure</span>
                        <span className={`text-[10px] font-bold font-mono ${c.text}`}>
                          {score !== null ? score.toFixed(3) : '---'}
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-700 ${c.bar}`}
                          style={{ width: score !== null ? `${Math.min(score * 100, 100)}%` : '0%' }}
                        />
                      </div>
                    </div>

                    {/* Alert Type Badge */}
                    {alertType && (
                      <span className={`text-[8px] font-bold uppercase tracking-widest px-2 py-0.5 rounded border w-fit ${alertTypeBadgeColor[alertType] || alertTypeBadgeColor.CROWD_DENSITY}`}>
                        {alertType.replace(/_/g, ' ')}
                      </span>
                    )}

                    {/* Pressure state label */}
                    <p className={`text-[9px] font-mono ${c.text}`}>
                      {score === null ? 'AWAITING DATA'
                        : score > 0.9 ? '⚠ DIRECTIONAL CHAOS'
                        : score > 0.6 ? '⚠ HIGH FRICTION'
                        : score > 0.3 ? '~ ELEVATED'
                        : '✓ NOMINAL'}
                    </p>
                  </div>
                );
              })}
            </div>

            {/* Upgrade Path Note */}
            <div className="mt-4 p-3 rounded-xl bg-cyan-500/5 border border-cyan-500/10 relative z-10">
              <p className="text-[9px] font-mono text-cyan-700 uppercase tracking-widest">
                Upgrade Path: MTMC Re-ID with OSNet → Cross-camera identity continuity &nbsp;|&nbsp;
                H.264/WebRTC → 10× bandwidth reduction &nbsp;|&nbsp;
                TensorRT + YOLO11-L → Full stadium-scale inference
              </p>
            </div>
          </motion.section>

          {/* AI Vision Launcher Modal (Webcam / DroidCam) */}
          {visionModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
              <div className="w-full max-w-2xl rounded-3xl bg-[#070707] border border-white/10 shadow-2xl">
                <div className="p-6 border-b border-white/10 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">AI Vision</p>
                    <h3 className="text-lg font-bold">
                      Start <span className="text-[#e99b63]">Webcam / DroidCam</span> feed
                    </h3>
                  </div>
                  <button
                    onClick={() => setVisionModalOpen(false)}
                    className="h-9 w-9 rounded-xl bg-white/5 border border-white/10 hover:border-[#e99b63]/30 transition-colors"
                    aria-label="Close"
                  >
                    <i className="bx bx-x text-xl text-gray-300" />
                  </button>
                </div>

                <div className="p-6 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
                      Camera ID
                      <input
                        value={cameraId}
                        onChange={(e) => setCameraId(e.target.value)}
                        className="mt-2 w-full rounded-xl bg-black/40 border border-white/10 px-3 py-2 text-xs text-gray-200 outline-none focus:border-[#e99b63]/60"
                        placeholder="CCTV-MAIN"
                      />
                    </label>
                    <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
                      Area (mÃ‚Â²)
                      <input
                        value={areaSize}
                        onChange={(e) => setAreaSize(e.target.value)}
                        className="mt-2 w-full rounded-xl bg-black/40 border border-white/10 px-3 py-2 text-xs text-gray-200 outline-none focus:border-[#e99b63]/60"
                        placeholder="50"
                      />
                    </label>
                    <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
                      Mode
                      <select
                        value={visionMode}
                        onChange={(e) => setVisionMode(e.target.value)}
                        className="mt-2 w-full rounded-xl bg-black/40 border border-white/10 px-3 py-2 text-xs text-gray-200 outline-none focus:border-[#e99b63]/60"
                      >
                        <option value="webcam">Webcam (local)</option>
                        <option value="droidcam">DroidCam / IP stream</option>
                      </select>
                    </label>
                  </div>

                  {visionMode === "droidcam" && (
                    <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
                      DroidCam URL (example)
                      <input
                        value={droidCamUrl}
                        onChange={(e) => setDroidCamUrl(e.target.value)}
                        className="mt-2 w-full rounded-xl bg-black/40 border border-white/10 px-3 py-2 text-xs text-gray-200 outline-none focus:border-[#e99b63]/60"
                        placeholder="http://192.168.x.x:4747/video"
                      />
                      <p className="text-[10px] text-gray-500 mt-2">
                        DroidCam usually exposes `.../video` over WiÃ¢â‚¬â€˜Fi. RTSP also works if you paste an `rtsp://...` URL.
                      </p>
                    </label>
                  )}

                  <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2">
                      Run this on the machine that has the camera stream
                    </p>
                    <pre className="text-[11px] text-gray-200 font-mono whitespace-pre-wrap">
{`# Windows PowerShell
$env:GUARDIAN_API_URL="http://localhost:5000/api/crowd/log"
$env:GUARDIAN_CAMERA_ID="${cameraId || "CCTV-MAIN"}"
$env:GUARDIAN_LOCATION="${cameraId || "CCTV-MAIN"}"
$env:GUARDIAN_AREA_SIZE="${areaSize || "50"}"
$env:GUARDIAN_VIDEO_SOURCE="${visionMode === "webcam" ? "0" : (droidCamUrl || "http://192.168.0.100:4747/video")}"
python detector.py`}
                    </pre>
                    <p className="text-[10px] text-gray-500 mt-3">
                      After it starts sending logs, click <span className="text-gray-300 font-semibold">Start Sync</span> below to update the dashboard.
                    </p>
                  </div>

                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setVisionModalOpen(false)}
                      className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-[10px] font-bold uppercase tracking-widest text-gray-300 hover:border-[#e99b63]/30 transition-colors"
                    >
                      Close
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsAnalyzing(true);
                        setVisionModalOpen(false);
                      }}
                      className="px-5 py-2 rounded-xl bg-[#e99b63] text-black text-[10px] font-bold uppercase tracking-widest shadow-[0_0_20px_rgba(233,155,99,0.25)]"
                    >
                      Start Sync
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* DETAILED ANALYSIS MODAL */}
          <AnimatePresence>
            {selectedAlert && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-md p-4"
              >
                <motion.div 
                  initial={{ scale: 0.9, y: 20 }}
                  animate={{ scale: 1, y: 0 }}
                  exit={{ scale: 0.9, y: 20 }}
                  className="w-full max-w-3xl rounded-3xl bg-[#0a0a0a] border border-white/10 shadow-2xl overflow-hidden flex flex-col md:flex-row h-full max-h-[600px]"
                >
                  {/* Left Side: Feed */}
                  <div className="flex-1 bg-black relative flex items-center justify-center overflow-hidden">
                    <div className="absolute inset-0 pointer-events-none opacity-20 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_2px,3px_100%] z-20" />
                    <img 
                      src={selectedAlert.dbType === 'alert' && edgeStatus?.online ? streamUrl : "https://images.unsplash.com/photo-1549416843-98402db3457a?q=80&w=1470&auto=format&fit=crop"} 
                      alt="Intelligence Feed" 
                      className="w-full h-full object-cover opacity-80"
                    />
                    <div className="absolute top-4 left-4 bg-red-600 text-white text-[8px] font-bold px-2 py-1 rounded-sm animate-pulse uppercase tracking-widest">
                      Live AI Analysis
                    </div>
                  </div>

                  {/* Right Side: Data */}
                  <div className="flex-1 p-8 flex flex-col justify-between border-l border-white/5">
                    <div>
                      <div className="flex justify-between items-start mb-6">
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#e99b63] mb-1">Detailed Analysis</p>
                          <h3 className="text-2xl font-bold">{selectedAlert.type}</h3>
                        </div>
                        <button onClick={() => setSelectedAlert(null)} className="h-8 w-8 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors">
                          <i className="bx bx-x text-lg" />
                        </button>
                      </div>

                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4 pb-4 border-b border-white/5 font-mono">
                           <div>
                              <p className="text-[9px] text-gray-500 uppercase mb-1">Threat Level</p>
                              <p className={`text-xs font-bold ${selectedAlert.severity === 'Critical' ? 'text-red-500' : 'text-amber-500'}`}>{selectedAlert.severity || 'High'}</p>
                           </div>
                           <div>
                              <p className="text-[9px] text-gray-500 uppercase mb-1">Timestamp</p>
                              <p className="text-xs text-gray-300">{selectedAlert.time}</p>
                           </div>
                        </div>

                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-widest text-[#e99b63] mb-2 flex items-center gap-2">
                             <i className="bx bx-info-circle" /> Situation Overview
                          </p>
                          <p className="text-xs text-gray-400 leading-relaxed font-mono">
                             {selectedAlert.desc}. Anomalous patterns detected at {selectedAlert.loc}. AI confidence score: 94.2%. Situation requires immediate evaluation.
                          </p>
                        </div>

                        <div>
                           <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-500 mb-2 flex items-center gap-2">
                              <i className="bx bx-check-shield" /> Recommendations
                           </p>
                           <ul className="text-[10px] text-gray-500 space-y-1 list-disc pl-4 font-mono">
                              <li>Deploy local unit for visual verification.</li>
                              <li>Monitor nearby nodes for secondary surges.</li>
                              <li>Restrict movement in {selectedAlert.loc} perimeter.</li>
                           </ul>
                        </div>
                                      
                        <div className="mt-8 grid grid-cols-3 gap-3">
                           <button 
                             disabled={resolving}
                             onClick={() => handleResolve(selectedAlert.id, selectedAlert.dbType, 'Ignored')}
                             className="py-3 rounded-xl bg-white/5 border border-white/10 text-[9px] font-bold uppercase tracking-widest text-gray-400 hover:bg-white/10 transition-colors disabled:opacity-50"
                           >
                             {resolving ? 'Processing' : 'Ignore'}
                           </button>
                           <button 
                             disabled={resolving}
                             onClick={() => handleResolve(selectedAlert.id, selectedAlert.dbType, 'Resolved')}
                             className="py-3 rounded-xl bg-[#e99b63] text-black text-[9px] font-bold uppercase tracking-widest shadow-[0_0_20px_rgba(233,155,99,0.3)] hover:scale-[1.02] transition-all active:scale-95 disabled:opacity-50"
                           >
                             {resolving ? 'Deploying' : 'Deploy'}
                           </button>
                           <button 
                             disabled={resolving}
                             onClick={() => handleIndividualClear(selectedAlert.dbType, selectedAlert.id)}
                             className="py-3 rounded-xl bg-red-950/40 border border-red-500/30 text-red-500 text-[9px] font-bold uppercase tracking-widest hover:bg-red-600 hover:text-white transition-all disabled:opacity-50"
                           >
                             {resolving ? 'Clearing' : 'Clear'}
                           </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* INCIDENT INTELLIGENCE FEED & MONITORING PANEL */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" style={{ alignItems: 'stretch' }}>
            {/* LEFT COLUMN: FEED */}
            <motion.section 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              className={`lg:col-span-2 p-6 rounded-3xl ${styles.glass} border-white/5 flex flex-col`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                <div className="flex items-center gap-3">
                  <h3 className="text-sm font-bold uppercase tracking-widest text-[#e99b63] flex items-center gap-2 font-mono">
                    <i className="bx bxs-group" /> Crowd Intelligence Feed
                  </h3>
                  <div className="flex gap-2">
                      <span className={`${styles.badge} bg-red-500/10 text-red-500 border border-red-500/20`}>{dashboardData.stats?.criticalCount || 0} Critical</span>
                      <span className={`${styles.badge} bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 font-mono underline decoration-emerald-500/30 underline-offset-4`}>Active_Node</span>
                  </div>
                </div>
                <button 
                  onClick={handleClearAll}
                  className="px-4 py-1.5 rounded-full bg-red-950/30 border border-red-500/30 text-red-500 text-[9px] font-black uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all active:scale-95"
                >
                  Clear All Reports
                </button>
              </div>
              
              <div className="flex-1 space-y-3">
                {dashboardData.feed.length > 0 ? (
                  <AnimatePresence mode="popLayout">
                    {dashboardData.feed.slice((feedPage - 1) * 10, feedPage * 10).map((inc) => {
                      const isMedical = medicalReports.has(inc.id);
                      const isBroadcasted = broadcastedMessages.has(inc.id);
                      const isSelected = selectedReportIds.has(inc.id);
                      
                      return (
                        <motion.div 
                          key={inc.id || `${inc.name}-${inc.rawTime}`}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          whileHover={selectionMode ? { scale: 1.02 } : { 
                            scale: 1.01, 
                            x: 5,
                            rotateX: 1,
                            rotateY: -1,
                            perspective: 1000
                          }}
                          onClick={() => selectionMode ? toggleSelection(inc.id) : setSelectedAlert(inc)}
                          className={`group p-4 rounded-2xl border transition-all flex gap-4 relative overflow-hidden ${
                            isSelected ? 'border-[#e99b63] bg-[#e99b63]/10 shadow-[0_0_20px_rgba(233,155,99,0.1)]' : 
                            isMedical ? 'bg-white/[0.03] border-white/60 shadow-[0_0_20px_rgba(255,255,255,0.2)]' :
                            'bg-white/[0.02] border-white/5 hover:border-[#e99b63]/40'
                          } cursor-pointer`}
                        >
                          {selectionMode && (
                            <div className="flex items-center justify-center pr-2">
                              <div className={`h-5 w-5 rounded-md border flex items-center justify-center transition-all ${
                                isSelected ? 'bg-[#e99b63] border-[#e99b63]' : 'border-white/20 bg-white/5'
                              }`}>
                                {isSelected && <i className="bx bx-check text-black font-bold" />}
                              </div>
                            </div>
                          )}
                          <div className={`h-12 w-1 rounded-full shadow-[0_0_10px_currentColor] ${isMedical ? 'opacity-50' : ''}`} style={{ backgroundColor: inc.color, color: inc.color }} />
                          <div className="flex-1">
                            <div className="flex justify-between items-start mb-1">
                              <div>
                                <span className={`text-[9px] font-black uppercase tracking-wider block mb-0.5 ${isMedical ? 'text-white' : ''}`} style={{ color: isMedical ? undefined : inc.color }}>
                                  {isMedical ? 'MEDICAL STATUS' : inc.type}
                                </span>
                                <h4 className={`text-xs font-bold ${isMedical ? 'text-gray-100' : 'text-gray-200'}`}>{inc.loc}</h4>
                              </div>
                              <div className="flex flex-col items-end">
                                <span className={`text-[9px] font-mono italic mb-1 ${isMedical ? 'text-gray-600' : 'text-gray-500'}`}>{inc.time}</span>
                                {isBroadcasted && (
                                  <div className="px-2 py-0.5 rounded-full bg-[#06b6d4]/20 border border-[#06b6d4]/40 shadow-[0_0_10px_rgba(6,182,212,0.2)] mb-1">
                                    <span className="text-[8px] font-black text-[#06b6d4] uppercase">SMS SENT</span>
                                  </div>
                                )}
                                <motion.span 
                                  animate={(inc.status === 'Unverified' && !isMedical) ? { opacity: [0.6, 1, 0.6] } : {}}
                                  transition={inc.status === 'Unverified' ? { repeat: Infinity, duration: 2 } : {}}
                                  className={`text-[8px] font-black tracking-widest px-2 py-0.5 rounded-full border shadow-[0_0_10px_currentColor] ${
                                  (inc.status === 'Resolved' || isMedical) ? 'text-emerald-500 border-emerald-500/20 bg-emerald-500/5' :
                                  inc.status === 'Ignored' ? 'text-gray-600 border-white/5 bg-white/5' :
                                  'text-amber-500 border-amber-500/20 bg-amber-500/5'
                                }`}>
                                  {isMedical ? 'MEDICAL' : inc.status === 'Resolved' ? 'DEPLOYED' : inc.status === 'Ignored' ? 'IGNORED' : 'UNNOTICED'}
                                </motion.span>
                              </div>
                            </div>
                            <p className={`text-[10px] mb-2 leading-relaxed ${isMedical ? 'text-gray-400' : 'text-gray-500'}`}>{inc.desc}</p>
                            <div className="flex items-center gap-3">
                              <span className={`text-[8px] font-bold uppercase tracking-widest ${isMedical ? 'text-gray-500' : 'text-gray-600'}`}>
                                Source: <span className={isMedical ? 'text-gray-300' : 'text-gray-400'}>{inc.src}</span>
                              </span>
                              {!selectionMode && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); navigate(`/emergency?reportId=${inc.id}`); }}
                                  className="ml-auto flex items-center gap-1 px-2 py-0.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-[7px] font-black uppercase tracking-widest hover:bg-red-500 hover:text-white hover:border-red-500 transition-all hover:scale-105 active:scale-95"
                                >
                                  <i className="bx bx-shield-quarter text-sm" />
                                  Protocol
                                </button>
                              )}
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                ) : (
                  <p className="text-xs text-gray-500 italic p-4 text-center">No recent alerts or incidents detected.</p>
                )}
              </div>

              <ThemedPagination 
                currentPage={feedPage} 
                totalPages={Math.ceil(dashboardData.feed.length / 10)} 
                onPageChange={setFeedPage} 
              />
            </motion.section>

            {/* RIGHT COLUMN: RISK & ATTENTION */}
            <div className="lg:col-span-1 flex flex-col">
              <motion.section 
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 }}
                className={`p-6 rounded-3xl ${styles.glass} border-white/5 flex-1 flex flex-col overflow-hidden`}
              >
                <div className="h-full flex flex-col">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-6 flex items-center gap-2 font-mono">
                    <i className="bx bx-tachometer text-[#e99b63]" /> Risk Metrics
                  </h3>
                  
                  <div className="space-y-4 mb-8">
                     {/* Public Safety Index */}
                     <div>
                        <div className="flex justify-between text-[9px] font-bold uppercase tracking-[0.2em] mb-1.5 font-mono">
                          <span className="text-emerald-500">Safety Index</span>
                          <span>{dashboardData.stats?.safetyScore || 100}%</span>
                        </div>
                        <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                          <div className="h-full bg-emerald-500 shadow-[0_0_10px_#10b981]" style={{ width: `${dashboardData.stats?.safetyScore || 100}%` }} />
                        </div>
                     </div>

                     {/* Critical Risk Index */}
                     <div>
                        <div className="flex justify-between text-[9px] font-bold uppercase tracking-[0.2em] mb-1.5 font-mono">
                          <span className="text-red-500">Risk Index</span>
                           <span>{dashboardData.stats?.riskIndex || 0}%</span>
                        </div>
                        <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                          <div className="h-full bg-red-500 shadow-[0_0_10px_#ef4444]" style={{ width: `${dashboardData.stats?.riskIndex || 0}%` }} />
                        </div>
                     </div>
                  </div>

                  {/* SPECIAL ATTENTION SECTION (SCROLLABLE) */}
                  <div className="flex-1 flex flex-col min-h-0">
                    <p className="text-[9px] font-black uppercase tracking-[0.3em] text-[#e99b63] mb-4 flex items-center gap-2 font-mono">
                      <span className="h-1.5 w-1.5 rounded-full bg-red-600 animate-ping" />
                      Critical Attention
                    </p>
                    <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-2">
                      {dashboardData.stats?.criticalAlerts?.length > 0 ? (
                        dashboardData.stats.criticalAlerts.slice((criticalPage - 1) * 10, criticalPage * 10).map((alert) => (
                          <motion.div
                            key={`special-${alert.id}`}
                            whileHover={{ scale: 1.02, x: 5 }}
                            onClick={() => setSelectedAlert(alert)}
                            className="p-3 rounded-xl bg-red-950/20 border border-red-500/20 hover:border-red-500/40 cursor-pointer transition-all relative overflow-hidden group"
                          >
                            <div className="absolute top-0 left-0 w-1 h-full bg-red-600 shadow-[0_0_10px_#dc2626]" />
                            <div className="flex justify-between items-start">
                              <div>
                                <p className="text-[8px] font-bold text-red-500 uppercase tracking-widest mb-0.5 font-mono">{alert.type}</p>
                                <p className="text-[10px] font-bold text-gray-200">{alert.loc}</p>
                              </div>
                              <p className="text-[8px] text-gray-500 font-mono">{alert.time}</p>
                            </div>
                            <div className="mt-2 flex items-center justify-between text-[8px] text-gray-500 italic font-mono">
                              <span>Action Req.</span>
                              <i className="bx bx-right-arrow-alt text-red-500 transition-transform group-hover:translate-x-1" />
                            </div>
                          </motion.div>
                        ))
                      ) : (
                        <div className="p-4 rounded-xl border border-white/5 bg-white/[0.02] text-center">
                          <p className="text-[8px] text-gray-500 uppercase tracking-widest font-mono">No Active Threats</p>
                        </div>
                      )}
                    </div>
                    {dashboardData.stats?.criticalAlerts?.length > 0 && (
                      <ThemedPagination 
                        currentPage={criticalPage} 
                        totalPages={Math.ceil(dashboardData.stats.criticalAlerts.length / 10)} 
                        onPageChange={setCriticalPage} 
                        color="#ef4444"
                      />
                    )}
                  </div>
                </div>
                <div className="mt-6 pt-6 border-t border-white/5">
                  <div className="flex justify-between items-center mb-4">
                    <h4 className="text-[9px] font-black uppercase tracking-[0.2em] text-cyan-400 font-mono">Resource Allocation</h4>
                    <div className="flex gap-1">
                      <div className="h-1 w-1 rounded-full bg-cyan-400" />
                      <div className="h-1 w-1 rounded-full bg-cyan-400 animate-pulse" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 rounded-2xl bg-white/[0.02] border border-white/5">
                      <p className="text-[8px] text-gray-500 uppercase mb-1 font-mono">Police Units</p>
                      <p className="text-sm font-bold text-gray-200 font-mono">14 <span className="text-[9px] font-normal text-emerald-500">/ 18</span></p>
                    </div>
                    <div className="p-3 rounded-2xl bg-white/[0.02] border border-white/5">
                      <p className="text-[8px] text-gray-500 uppercase mb-1 font-mono">Medical Teams</p>
                      <p className="text-sm font-bold text-gray-200 font-mono">6 <span className="text-[9px] font-normal text-amber-500">/ 8</span></p>
                    </div>
                  </div>
                  <div className="mt-3 flex justify-between items-center">
                    <p className="text-[9px] text-gray-500 uppercase font-mono">Coverage</p>
                    <p className="text-[10px] text-[#e99b63] font-bold font-mono">+12.4% Optimal</p>
                  </div>
                </div>
              </motion.section>
            </div>
          </div>

          {/* QUICK ACTIONS */}
          <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[
              { id: 'report', name: 'Report Incident', desc: 'Manual civilian input', icon: 'bx-message-square-add', onClick: () => setShowIncidentModal(true) },
              { id: 'deploy', name: 'Deploy Officer', desc: 'Secure localized zone', icon: 'bx-shield-plus', onClick: () => {
                if (selectionMode === 'deploy' && selectedReportIds.size > 0) handleBulkDeploy();
                else setSelectionMode('deploy');
              } },
              { id: 'sms', name: 'Broadcast SMS', desc: 'Mass public warning', icon: 'bx-broadcast', onClick: () => {
                if (selectionMode === 'sms' && selectedReportIds.size > 0) handleBulkSms();
                else setSelectionMode('sms');
              } },
              { id: 'medical', name: 'Medical Support', desc: 'Professional assistance', icon: 'bx-plus-medical', onClick: () => {
                if (selectionMode === 'medical' && selectedReportIds.size > 0) handleBulkMedical();
                else setSelectionMode('medical');
              } },
            ].map((action) => (
              <motion.button
                key={action.id}
                onClick={action.onClick}
                whileHover={{ scale: 1.05, rotateZ: 1 }}
                whileTap={{ scale: 0.98 }}
                className={`flex items-center gap-4 p-4 rounded-xl ${styles.glass} border-white/5 hover:border-[#e99b63]/40 transition-all group text-left ${selectionMode === action.id ? 'border-[#e99b63] bg-[#e99b63]/10' : ''}`}
              >
                 <div className={`h-10 w-10 rounded-lg bg-white/5 flex items-center justify-center transition-colors ${selectionMode === action.id ? 'text-[#e99b63]' : 'text-gray-500 group-hover:text-[#e99b63]'}`}>
                    <i className={`bx ${action.icon} text-xl`} />
                 </div>
                 <div>
                    <p className="text-[10px] font-bold text-gray-100 uppercase tracking-widest">{action.name}</p>
                    <p className="text-[10px] text-gray-500 font-medium">{action.desc}</p>
                 </div>
              </motion.button>
            ))}
          </section>

          {/* SELECTION ACTIONS CONFIRMATION BAR */}
          <AnimatePresence>
            {selectionMode && (
              <motion.div
                initial={{ opacity: 0, y: 50 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 50 }}
                className={`p-6 rounded-3xl ${styles.glass} border-[#e99b63]/30 shadow-[0_0_40px_rgba(233,155,99,0.1)] flex flex-col md:flex-row items-center justify-between gap-6 z-40`}
              >
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-2xl bg-[#e99b63]/10 flex items-center justify-center text-[#e99b63]">
                    <i className={`bx ${
                      selectionMode === 'deploy' ? 'bx-shield-plus' :
                      selectionMode === 'sms' ? 'bx-broadcast' :
                      'bx-plus-medical'
                    } text-2xl animate-pulse`} />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold uppercase tracking-widest">
                      {selectionMode === 'deploy' ? 'Officer Deployment' :
                       selectionMode === 'sms' ? 'SMS Broadcast' :
                       'Medical Support Dispatch'}
                    </h4>
                    <p className="text-[10px] text-gray-500">
                      {selectionMode === 'sms' 
                        ? 'Select a single report to send a message.' 
                        : `Select reports from the feed below. (${selectedReportIds.size} selected)`}
                    </p>
                  </div>
                </div>

                <div className="flex flex-1 w-full md:w-auto items-center gap-4">
                  {selectionMode === 'sms' && (
                    <div className="flex-1">
                      <input
                        type="text"
                        value={smsMessage}
                        onChange={(e) => setSmsMessage(e.target.value)}
                        placeholder="Type custom message..."
                        className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-xs text-gray-200 outline-none focus:border-[#e99b63]/60"
                      />
                    </div>
                  )}
                  
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setSelectionMode(null);
                        setSelectedReportIds(new Set());
                        setSmsMessage("");
                      }}
                      className="px-6 py-2 rounded-xl bg-white/5 border border-white/10 text-[10px] font-bold uppercase tracking-widest text-gray-400 hover:text-white transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      disabled={selectedReportIds.size === 0 || resolving}
                      onClick={
                        selectionMode === 'deploy' ? handleBulkDeploy :
                        selectionMode === 'sms' ? handleBulkSms :
                        handleBulkMedical
                      }
                      className="px-8 py-2 rounded-xl bg-[#e99b63] text-black text-[10px] font-bold uppercase tracking-widest shadow-[0_0_20px_rgba(233,155,99,0.3)] hover:scale-[1.05] active:scale-95 transition-all disabled:opacity-50 disabled:scale-100"
                    >
                      {resolving ? 'Processing...' : 
                       selectionMode === 'deploy' ? `Confirm Deploy (${selectedReportIds.size})` :
                       selectionMode === 'sms' ? 'Send Message' :
                       `Send Medical (${selectedReportIds.size})`}
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Incident Modal */}
          {showIncidentModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
              <div className="w-full max-w-lg rounded-3xl bg-[#070707] border border-white/10 shadow-2xl">
                <div className="p-6 border-b border-white/10 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Quick Action</p>
                    <h3 className="text-lg font-bold">
                      Report <span className="text-[#e99b63]">Incident</span>
                    </h3>
                  </div>
                  <button
                    onClick={() => setShowIncidentModal(false)}
                    className="h-9 w-9 rounded-xl bg-white/5 border border-white/10 hover:border-[#e99b63]/30 transition-colors"
                    aria-label="Close"
                  >
                    <i className="bx bx-x text-xl text-gray-300" />
                  </button>
                </div>
                <form onSubmit={submitIncident} className="p-6 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
                      Type
                      <select
                        value={incidentForm.type}
                        onChange={(e) => setIncidentForm((f) => ({ ...f, type: e.target.value }))}
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
                      Criticality
                      <select
                        value={incidentForm.severity}
                        onChange={(e) => setIncidentForm((f) => ({ ...f, severity: e.target.value }))}
                        className="mt-2 w-full rounded-xl bg-black/40 border border-white/10 px-3 py-2 text-xs text-gray-200 outline-none focus:border-[#e99b63]/60"
                      >
                        <option>Low</option>
                        <option>Medium</option>
                        <option>High</option>
                        <option>Critical</option>
                      </select>
                    </label>
                    <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
                      Reporter
                      <select
                        value={incidentForm.reporterType}
                        onChange={(e) => setIncidentForm((f) => ({ ...f, reporterType: e.target.value }))}
                        className="mt-2 w-full rounded-xl bg-black/40 border border-white/10 px-3 py-2 text-xs text-gray-200 outline-none focus:border-[#e99b63]/60"
                      >
                        <option>Officer</option>
                        <option>Civilian</option>
                      </select>
                    </label>
                  </div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
                    Location
                    <input
                      value={incidentForm.location}
                      onChange={(e) => setIncidentForm((f) => ({ ...f, location: e.target.value }))}
                      placeholder="e.g., Town Hall Gate A"
                      required
                      className="mt-2 w-full rounded-xl bg-black/40 border border-white/10 px-3 py-2 text-xs text-gray-200 outline-none focus:border-[#e99b63]/60"
                    />
                  </label>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
                    Description (optional)
                    <textarea
                      value={incidentForm.description}
                      onChange={(e) => setIncidentForm((f) => ({ ...f, description: e.target.value }))}
                      placeholder="What happened?"
                      rows={4}
                      className="mt-2 w-full rounded-xl bg-black/40 border border-white/10 px-3 py-2 text-xs text-gray-200 outline-none focus:border-[#e99b63]/60 resize-none"
                    />
                  </label>
                  <div className="flex items-center justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowIncidentModal(false)}
                      className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-[10px] font-bold uppercase tracking-widest text-gray-300 hover:border-[#e99b63]/30 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2 rounded-xl bg-[#e99b63] text-black text-[10px] font-bold uppercase tracking-widest shadow-[0_0_20px_rgba(233,155,99,0.25)] hover:scale-[1.02] transition-all"
                    >
                      Submit
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}


          {/* REPORT SEGREGATION PANEL */}
          {(() => {
            const feed = dashboardData.feed || [];

            const RiskBar = ({ label, count, color }) => (
              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className={`text-[9px] font-black uppercase tracking-widest font-mono`} style={{ color }}>{label}</span>
                  <span className="text-[9px] font-bold text-gray-400 font-mono">{count} <span className="text-gray-600">/ {feed.length}</span></span>
                </div>
                <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${(count / seg.total) * 100}%` }}
                    transition={{ duration: 0.8, ease: 'easeOut' }}
                    className="h-full rounded-full"
                    style={{ backgroundColor: color, boxShadow: `0 0 8px ${color}` }}
                  />
                </div>
              </div>
            );

            const StatChip = ({ icon, label, value, color }) => (
              <div className="flex items-center gap-3 p-3 rounded-2xl bg-white/[0.02] border border-white/5">
                <div className="h-8 w-8 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${color}18`, color }}>
                  <i className={`bx ${icon} text-base`} />
                </div>
                <div>
                  <p className="text-[8px] text-gray-500 uppercase tracking-widest font-mono">{label}</p>
                  <p className="text-sm font-black font-mono" style={{ color }}>{value}</p>
                </div>
              </div>
            );

            return (
              <section className={`p-8 rounded-3xl ${styles.glass} border-white/5`}>
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-gray-500 font-mono mb-1">Live Analytics</p>
                    <h3 className="text-sm font-bold uppercase tracking-widest text-[#e99b63] flex items-center gap-2 font-mono">
                      <i className="bx bx-bar-chart-alt-2" /> Report Segregation
                    </h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-[9px] font-mono font-bold text-gray-500 uppercase">
                      {feed.length} Total Reports
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">

                  {/* RISK LEVEL BREAKDOWN */}
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-[0.25em] text-gray-400 mb-5 flex items-center gap-2 font-mono">
                      <i className="bx bx-shield-quarter text-[#e99b63]" /> Risk Level
                    </p>
                    <div className="space-y-4">
                      <RiskBar label="Critical" count={seg.critical} color="#ef4444" />
                      <RiskBar label="High" count={seg.high} color="#f97316" />
                      <RiskBar label="Medium" count={seg.medium} color="#f59e0b" />
                      <RiskBar label="Low" count={seg.low} color="#10b981" />
                    </div>
                  </div>

                  {/* SOURCE / REPORTER TYPE */}
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-[0.25em] text-gray-400 mb-5 flex items-center gap-2 font-mono">
                      <i className="bx bx-user-voice text-cyan-400" /> Reporter Source
                    </p>
                    <div className="space-y-3">
                      <StatChip icon="bx-user" label="Civilian Reports" value={seg.civilian} color="#06b6d4" />
                      <StatChip icon="bx-shield" label="Officer Reports" value={seg.officer} color="#8b5cf6" />
                      <StatChip icon="bx-chip" label="AI / Sensor" value={seg.ai} color="#e99b63" />
                    </div>
                  </div>

                  {/* ACTION STATUS & INCIDENT TYPES */}
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-[0.25em] text-gray-400 mb-5 flex items-center gap-2 font-mono">
                      <i className="bx bx-check-double text-emerald-400" /> Actions & Types
                    </p>
                    <div className="space-y-3 mb-5">
                      <StatChip icon="bx-check-circle" label="Resolved / Deployed" value={seg.resolved} color="#10b981" />
                      <StatChip icon="bx-time-five" label="Pending / Unnoticed" value={seg.pending} color="#f59e0b" />
                      <StatChip icon="bx-minus-circle" label="Ignored" value={seg.ignored} color="#6b7280" />
                    </div>
                    <div className="pt-4 border-t border-white/5">
                      <p className="text-[8px] text-gray-600 uppercase tracking-widest mb-3 font-mono">Incident Types</p>
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { label: 'Medical', count: seg.medical, color: '#06b6d4' },
                          { label: 'Accident', count: seg.accident, color: '#f97316' },
                          { label: 'Crowd', count: seg.crowd, color: '#e99b63' },
                          { label: 'Other', count: seg.other, color: '#6b7280' },
                        ].map(t => (
                          <div key={t.label} className="flex items-center gap-2 p-2 rounded-xl bg-white/[0.02] border border-white/5">
                            <div className="h-1.5 w-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: t.color, boxShadow: `0 0 6px ${t.color}` }} />
                            <span className="text-[8px] font-bold text-gray-400 font-mono">{t.label}</span>
                            <span className="text-[9px] font-black ml-auto font-mono" style={{ color: t.color }}>{t.count}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                </div>
              </section>
            );
          })()}



        </div>
      </main>
    </div>
  );
}


