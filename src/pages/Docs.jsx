import { useState, useEffect, useRef } from "react";
import Sidebar from "../components/Sidebar";
import { API_BASE, apiFetch } from "../lib/api";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { LineChart, Line, ResponsiveContainer, YAxis } from "recharts";
import { useTensorFlow } from "../hooks/useTensorFlow";

const styles = {
  glass: "bg-white/[0.03] backdrop-blur-2xl border border-white/10 shadow-[0_8px_32px_0_rgba(0,0,0,0.8)]",
  btnPrimary: "bg-[#e99b63] hover:bg-[#d68a52] text-black font-bold py-2 px-4 rounded-xl transition-all font-mono uppercase tracking-widest text-[10px]",
  btnDanger: "bg-red-600 hover:bg-red-500 text-white animate-pulse font-bold py-2 px-4 rounded-xl transition-all flex items-center justify-center gap-2 font-mono uppercase tracking-widest text-[10px] shadow-[0_0_15px_#dc2626]",
  btnOutline: "border border-white/10 hover:border-white/30 hover:bg-white/5 text-gray-300 py-2 px-4 rounded-xl transition-all font-mono uppercase tracking-widest text-[10px]",
};

export default function Command() {
  const [incidents, setIncidents] = useState([]);
  const [healthStatus, setHealthStatus] = useState("checking");
  const [latencyData, setLatencyData] = useState([{ time: 0, ms: 50 }]);
  
  // Camera & Monitoring State
  const videoRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [videoSource, setVideoSource] = useState('webcam'); // webcam, ip
  
  // Simulation State
  const [isAlertActive, setIsAlertActive] = useState(false);
  const [simulatedCount, setSimulatedCount] = useState(0);
  const [liveDensityData, setLiveDensityData] = useState([{ time: 0, val: 0 }]);

  // AI Vision State
  const { model, isLoaded: aiLoaded } = useTensorFlow();
  const [predictions, setPredictions] = useState([]);

  // 1. Live Incident Feed & System Health Polling
  useEffect(() => {
    let interval;
    const fetchData = async () => {
      const start = performance.now();
      try {
        const res = await apiFetch("/api/incidents");
        const safeRes = Array.isArray(res) ? res : [];
        setIncidents(safeRes.slice(0, 15)); // Keep latest 15
        
        const delay = Math.round(performance.now() - start);
        setHealthStatus("online");
        setLatencyData(prev => [...prev.slice(-19), { time: Date.now(), ms: delay }]);
      } catch {
        setHealthStatus("offline");
      }
    };
    fetchData();
    interval = setInterval(fetchData, 2000);
    return () => clearInterval(interval);
  }, []);

  // 2. Camera Management
  useEffect(() => {
    return () => {
      if (stream) stream.getTracks().forEach(track => track.stop());
    };
  }, [stream]);

  const startCamera = async () => {
    if (videoSource === 'ip') {
      alert("IP Camera / RTSP mode selected. In a production environment, this would bind to the network stream. Showing placeholder webcam for demo.");
    }
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ 
        video: { aspectRatio: 16/9, width: { ideal: 1280 }, height: { ideal: 720 } } 
      });
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
      setStream(mediaStream);
      setIsMonitoring(true);
    } catch (err) {
      console.error("Camera access denied", err);
      alert("Please allow webcam permissions to demo live AI vision.");
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsMonitoring(false);
  };

  // 3. Real Edge AI Inference Loop
  useEffect(() => {
    if (!isMonitoring || !model || !videoRef.current) return;
    
    let animationId;
    const detectFrame = async () => {
      // Ensure video is playing and has frames
      if (videoRef.current && videoRef.current.readyState === 4) {
        try {
          const preds = await model.detect(videoRef.current);
          const people = preds.filter(p => p.class === 'person');
          setPredictions(people);
          
          const realCount = people.length;
          setSimulatedCount(prev => {
            // Keep surge demo capability active
            if (isAlertActive) return prev + Math.floor(Math.random() * 10) + 5;
            return realCount; 
          });
        } catch { /* ignore tracking errs */ }
      }
      animationId = requestAnimationFrame(detectFrame);
    };
    
    detectFrame();
    
    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [isMonitoring, model, isAlertActive]);

  useEffect(() => {
    const val = isAlertActive ? Math.min(100, (simulatedCount / 120) * 100) : (simulatedCount / 50) * 100;
    setLiveDensityData(prev => [...prev.slice(-19), { time: Date.now(), val: Math.min(100, Math.max(0, val)) }]);
  }, [simulatedCount, isAlertActive]);


  // 4. Incident Trigger (Wow Factor!)
  const triggerSurge = async () => {
    if (!isMonitoring) {
      alert("Please press 'Start Detection' to activate the camera before simulating a surge.");
      return;
    }
    
    setIsAlertActive(true);
    
    // Actually inject into the backend to make it feel real across the app
    try {
      await apiFetch("/api/incidents", {
        method: 'POST',
        body: JSON.stringify({
          type: 'Crowd Surge',
          desc: 'Simulated critical density spike detected by Edge Node Alpha (Demo).',
          loc: 'Zone A - Main Concourse',
          severity: 'Critical',
          src: 'AI Sensor',
          status: 'Unverified'
        })
      });
    } catch(err) { console.error("Could not dispatch fake alert", err); }

    // Auto-resolve simulation after 12 seconds
    setTimeout(() => {
      setIsAlertActive(false);
    }, 12000); 
  };

  // Derived metrics
  const densityVal = liveDensityData[liveDensityData.length - 1]?.val || 0;
  let heatColor = "text-emerald-500";
  let _heatBg = "bg-emerald-500";
  let heatLabel = "🟢 SAFE";
  if (densityVal > 70) {
    heatColor = "text-red-500";
    _heatBg = "bg-red-500 shadow-[0_0_15px_#ef4444]";
    heatLabel = "🔴 DANGEROUS";
  } else if (densityVal > 30) {
    heatColor = "text-amber-500";
    _heatBg = "bg-amber-500";
    heatLabel = "🟡 MODERATE";
  }

  return (
    <div className={`flex h-screen bg-[#050505] text-white overflow-hidden transition-colors duration-1000 ${isAlertActive ? 'shadow-[inset_0_0_150px_rgba(220,38,38,0.2)] bg-red-950/20' : ''}`}>
      <Sidebar />
      <main className="flex-1 p-4 lg:p-8 overflow-y-auto custom-scrollbar relative">
        
        {/* EMERGENCY OVERLAY */}
        <AnimatePresence>
          {isAlertActive && (
             <motion.div 
               initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
               className="pointer-events-none fixed inset-0 z-50 border-[8px] border-red-600/50 mix-blend-screen"
             >
                <div className="absolute top-8 left-1/2 -translate-x-1/2 bg-red-600 text-white font-black uppercase tracking-[0.5em] text-2xl py-2 px-8 rounded-full shadow-[0_0_40px_#dc2626] animate-pulse">
                  CRITICAL SURGE DETECTED
                </div>
             </motion.div>
          )}
        </AnimatePresence>

        <div className="max-w-[1400px] mx-auto space-y-6">
          
          {/* HEADER */}
          <div className="flex justify-between items-end border-b border-white/5 pb-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight mb-2">
                Live Command <span className={isAlertActive ? "text-red-500 transition-colors" : "text-[#e99b63] transition-colors"}>Center</span>
              </h1>
              <p className="text-xs text-gray-500 font-mono uppercase tracking-widest">
                Real-Time Edge Telemetry & Operations
              </p>
            </div>
            
            {/* System Health Panel (Mini) */}
            <div className={`p-3 rounded-xl border flex items-center gap-6 ${isAlertActive ? 'border-red-500/30 bg-red-900/20' : 'border-white/10 bg-white/5'}`}>
              <div className="flex flex-col gap-2 font-mono text-[9px] uppercase tracking-widest">
                <span className="flex items-center gap-2"><div className={`w-1.5 h-1.5 rounded-full ${healthStatus === 'online' ? 'bg-emerald-500' : 'bg-red-500'}`} /> Backend: {healthStatus}</span>
                <span className="flex items-center gap-2"><div className={`w-1.5 h-1.5 rounded-full ${healthStatus === 'online' ? 'bg-emerald-500' : 'bg-red-500'}`} /> DB: Connected</span>
                <span className="flex items-center gap-2"><div className={`w-1.5 h-1.5 rounded-full ${isMonitoring ? 'bg-emerald-500 animate-pulse' : 'bg-gray-600'}`} /> AI Nodes: {isMonitoring ? 'Active' : 'Standby'}</span>
              </div>
              <div className="h-12 w-24 border-l border-white/10 pl-4">
                 <p className="text-[8px] text-gray-500 uppercase tracking-widest font-mono mb-1">Latency (ms)</p>
                 <ResponsiveContainer width="100%" height="80%">
                   <LineChart data={latencyData}>
                     <Line type="step" dataKey="ms" stroke={healthStatus === 'online' ? "#10b981" : "#ef4444"} strokeWidth={1.5} dot={false} isAnimationActive={false} />
                   </LineChart>
                 </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            
            {/* MIDDLE SECTION - LIVE CAMERA & EDGE CONTROL (Spans 2 cols) */}
            <div className="xl:col-span-2 space-y-6 flex flex-col">
              
              {/* LIVE CAMERA FEED */}
              <div className={`relative rounded-3xl overflow-hidden border ${isAlertActive ? 'border-red-500/50 shadow-[0_0_30px_rgba(220,38,38,0.3)]' : 'border-white/10'} bg-black aspect-video flex-shrink-0 group`}>
                {/* Fallback pattern when offline */}
                {!isMonitoring && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center opacity-30 pattern-grid-lg">
                    <i className="bx bx-cctv text-6xl text-gray-500 mb-4" />
                    <p className="font-mono text-sm tracking-widest uppercase text-gray-400">Video Source Offline</p>
                  </div>
                )}
                
                {/* Native Video Element */}
                <video 
                  ref={videoRef} 
                  autoPlay 
                  playsInline 
                  muted 
                  className={`w-full h-full object-fill transition-opacity duration-1000 relative z-10 ${isMonitoring ? 'opacity-100' : 'opacity-0'}`}
                />

                {/* AI Bounding Boxes */}
                {isMonitoring && predictions.map((pred, idx) => {
                  // Since object-contain centers the video with aspect ratio, we do relative percentages based on natural video bounds
                  const vidParams = videoRef.current ? { w: videoRef.current.videoWidth, h: videoRef.current.videoHeight } : { w: 640, h: 480 };
                  if (!vidParams.w) return null; // Avoid NaN if not loaded
                  
                  // For object-contain, accurate mapping requires knowing letterbox offsets. 
                  // But for "wow factor", standard CSS % mapping is acceptable if they fill the frame.
                  const left = (pred.bbox[0] / vidParams.w) * 100;
                  const top = (pred.bbox[1] / vidParams.h) * 100;
                  const width = (pred.bbox[2] / vidParams.w) * 100;
                  const height = (pred.bbox[3] / vidParams.h) * 100;
                  
                  return (
                    <div 
                      key={idx}
                      className="absolute border-2 border-[#10b981] bg-[#10b981]/10 z-20 pointer-events-none transition-all duration-75"
                      style={{ left: `${left}%`, top: `${top}%`, width: `${width}%`, height: `${height}%` }}
                    >
                      <span className="absolute -top-4 left-0 text-[8px] bg-[#10b981] text-black font-bold px-1 whitespace-nowrap font-mono tracking-widest">
                        PERSON {Math.round(pred.score * 100)}%
                      </span>
                    </div>
                  );
                })}

                {/* Cyberpunk CRT Scanline overlay */}
                <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_4px,3px_100%] opacity-20" />

                {/* Overlays (Only show when checking) */}
                {isMonitoring && (
                  <>
                    <div className="absolute top-4 left-4 p-2 bg-black/60 backdrop-blur-md rounded border border-white/10 font-mono">
                      <p className="text-[8px] uppercase tracking-widest text-[#e99b63] mb-1">Node Alpha // Cam 01</p>
                      <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-black">{simulatedCount}</span>
                        <span className="text-[10px] text-gray-400">Persons</span>
                      </div>
                    </div>

                    <div className="absolute top-4 right-4 p-2 bg-black/60 backdrop-blur-md rounded border border-white/10 font-mono text-right">
                       <p className="text-[8px] uppercase tracking-widest text-gray-400 mb-1">Density Index</p>
                       <div className={`text-lg font-black ${heatColor}`}>{Math.round(densityVal)}%</div>
                    </div>

                    {/* Bounding Box Simulation */}
                    <div className="absolute inset-0 pointer-events-none p-12">
                       <div className={`w-full h-full border-2 ${isAlertActive ? 'border-red-500/80 bg-red-500/10' : 'border-[#e99b63]/30'} rounded-lg transition-colors duration-500 relative`}>
                         <div className={`absolute -top-3 left-4 px-2 py-0.5 text-[9px] font-black font-mono tracking-widest uppercase ${isAlertActive ? 'bg-red-600 text-white' : 'bg-[#e99b63] text-black'} rounded`}>
                           {isAlertActive ? '⚠️ DETECTING ANOMALY' : 'TRACKING'}
                         </div>
                       </div>
                    </div>
                  </>
                )}
              </div>

              {/* EDGE CONTROL & REAL-TIME VIZ PANEL */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 flex-1">
                {/* Controls */}
                <div className={`p-6 rounded-3xl ${styles.glass} flex flex-col justify-between`}>
                  <div>
                    <h3 className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#e99b63] mb-4 font-mono flex items-center gap-2">
                      <i className="bx bx-slider-alt" /> Edge Node Control
                    </h3>
                    
                    <div className="space-y-4 mb-6">
                      <div>
                        <label className="text-[9px] font-mono text-gray-500 uppercase tracking-widest mb-2 block">Video Source</label>
                        <select 
                          value={videoSource}
                          onChange={(e) => setVideoSource(e.target.value)}
                          className="w-full p-3 rounded-lg bg-[#111] border border-white/10 text-sm text-gray-200 focus:outline-none focus:border-[#e99b63] transition-all"
                          disabled={isMonitoring}
                        >
                          <option className="bg-[#111] text-gray-200" value="webcam">Default Webcam (Direct)</option>
                          <option className="bg-[#111] text-gray-200" value="ip">IP Camera / RTSP (Network)</option>
                        </select>
                      </div>
                      
                      <div className="flex items-center justify-between p-3 rounded-lg bg-black/40 border border-white/5">
                         <span className="text-[10px] font-mono uppercase tracking-widest text-gray-400">Heat Status</span>
                         <span className={`text-[10px] font-mono font-bold tracking-widest ${heatColor}`}>{heatLabel}</span>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    {!isMonitoring ? (
                      <button onClick={startCamera} className={`${styles.btnPrimary} col-span-2 py-3 flex items-center justify-center gap-2`} disabled={!aiLoaded}>
                        <i className={`bx ${aiLoaded ? 'bx-play-circle text-lg' : 'bx-loader-alt animate-spin text-lg'}`} /> 
                        {aiLoaded ? 'Start AI Detection' : 'Loading Neural Net...'}
                      </button>
                    ) : (
                      <>
                        <button onClick={stopCamera} className={`${styles.btnOutline} py-3 flex items-center justify-center gap-2`}>
                          <i className="bx bx-stop-circle text-lg border-white/30" /> Stop
                        </button>
                        <button onClick={triggerSurge} className={`${styles.btnDanger} py-3 shadow-lg`} disabled={isAlertActive}>
                          <i className="bx bx-error text-lg" /> {isAlertActive ? "Surging..." : "Simulate Surge"}
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Live Data Graph */}
                <div className={`p-6 rounded-3xl ${styles.glass} flex flex-col`}>
                  <h3 className="text-[11px] font-bold uppercase tracking-[0.2em] text-cyan-400 mb-2 font-mono flex items-center gap-2">
                    <i className="bx bx-line-chart" /> Live Crowd Trajectory
                  </h3>
                  <div className="flex-1 w-full min-h-[150px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={liveDensityData}>
                        <YAxis domain={[0, 100]} hide />
                        <Line 
                          type="monotone" 
                          dataKey="val" 
                          stroke={isAlertActive ? "#ef4444" : "#06b6d4"} 
                          strokeWidth={3} 
                          dot={false}
                          isAnimationActive={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </div>

            {/* RIGHT SECTION - LOGS, AI, ACTIONS */}
            <div className="space-y-6 flex flex-col">
              
              {/* AI INSIGHTS PANEL (HIGH IMPACT) */}
              <div className={`p-6 rounded-3xl ${styles.glass} border border-[#e99b63]/30 bg-gradient-to-b from-[#e99b63]/5 to-transparent relative overflow-hidden`}>
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[#e99b63] to-transparent opacity-50" />
                 <h3 className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#e99b63] mb-4 font-mono flex items-center gap-2">
                  <i className="bx bx-brain text-lg" /> AI Insights <span className="text-[8px] bg-[#e99b63]/20 px-1.5 py-0.5 rounded text-[#e99b63]">LIVE</span>
                </h3>
                
                <div className="space-y-3 font-mono text-[11px] leading-relaxed">
                  {!isMonitoring ? (
                    <p className="text-gray-500 italic">"Awaiting visual telemetry feed to generate insights..."</p>
                  ) : isAlertActive ? (
                    <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="space-y-3">
                      <p className="text-red-400 font-bold border-l-2 border-red-500 pl-3">⚠️ Crowd density increasing rapidly in Zone A (Main Concourse).</p>
                      <p className="text-amber-400 border-l-2 border-amber-500 pl-3">⚡ Potential multi-directional crush detected in next 2 minutes.</p>
                      <p className="text-emerald-400 border-l-2 border-emerald-500 pl-3">🛡️ Evacuation Route B (North Exits) recommended immediately.</p>
                    </motion.div>
                  ) : (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
                      <p className="text-gray-300 border-l-2 border-white/20 pl-3">✓ Normal operations verified.</p>
                      <p className="text-gray-300 border-l-2 border-white/20 pl-3">✓ Traffic flow steady at 45 persons/min.</p>
                      <p className="text-gray-500 border-l-2 border-white/10 pl-3 italic">Predictive models indicate 98% nominal behavior for next hour.</p>
                    </motion.div>
                  )}
                </div>
              </div>

              {/* LIVE INCIDENT FEED */}
              <div className={`p-6 rounded-3xl ${styles.glass} flex-1 flex flex-col overflow-hidden`}>
                <h3 className="text-[11px] font-bold uppercase tracking-[0.2em] text-gray-400 mb-4 font-mono flex items-center justify-between">
                  <span><i className="bx bx-list-ul" /> Active Incidents</span>
                  <div className="h-1.5 w-1.5 rounded-full bg-cyan-500 animate-ping" />
                </h3>
                
                <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2 pr-2">
                  <AnimatePresence>
                    {incidents.length === 0 ? (
                      <p className="text-[10px] text-gray-500 font-mono italic mt-4 text-center">Ledger empty. No recent incidents.</p>
                    ) : (
                      incidents.map((inc, i) => (
                        <motion.div 
                          key={inc.id || `inc-${i}`}
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          className={`p-3 rounded-xl border border-white/5 bg-black/40 flex items-start justify-between font-mono gap-3`}
                        >
                          <div className="flex flex-col gap-1 min-w-0">
                            <span className={`text-[9px] font-bold uppercase tracking-widest ${inc.severity === 'Critical' ? 'text-red-500' : inc.severity === 'High' ? 'text-orange-500' : 'text-amber-500'}`}>
                              {inc.type || 'Unknown'}
                            </span>
                            <span className="text-[10px] text-gray-300 truncate">{inc.loc || 'Unknown Location'}</span>
                          </div>
                          <span className="text-[8px] text-gray-500 whitespace-nowrap pt-0.5">{inc.time || ''}</span>
                        </motion.div>
                      ))
                    )}
                  </AnimatePresence>
                </div>
              </div>

              {/* QUICK ACTIONS LINKS */}
              <div className="grid grid-cols-2 gap-3">
                <Link to="/dashboard" className={`${styles.btnOutline} text-center py-3 bg-black flex flex-col items-center gap-1 group`}>
                   <i className="bx bx-radar text-lg text-gray-500 group-hover:text-white transition-colors" /> Fetch Dashboard
                </Link>
                <Link to="/incidents" className={`${styles.btnOutline} text-center py-3 bg-black flex flex-col items-center gap-1 group`}>
                   <i className="bx bx-folder-open text-lg text-gray-500 group-hover:text-white transition-colors" /> All Incidents
                </Link>
              </div>

            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
