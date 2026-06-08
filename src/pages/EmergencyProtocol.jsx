import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import 'boxicons/css/boxicons.min.css';
import Sidebar from '../components/Sidebar';
import { apiFetch } from '../lib/api';

// ── AI PRIORITY SCORING ──
const SEVERITY_SCORE = { critical: 100, high: 80, medium: 50, low: 20 };
const LIFE_COST_TYPES = ['medical', 'injured', 'accident', 'cardiac', 'fire'];

function getAiScore(report) {
  const sev = SEVERITY_SCORE[(report.severity || '').toLowerCase()] ?? 30;
  const typeStr = (report.type || '').toLowerCase();
  const descStr = (report.desc || '').toLowerCase();
  const lifeCost = LIFE_COST_TYPES.some(t => typeStr.includes(t) || descStr.includes(t)) ? 40 : 0;
  const unresolvedBonus = (report.status || '') === 'Unverified' ? 30 : 0;
  return Math.min(100, sev + lifeCost + unresolvedBonus);
}

// ── PROTOCOL CONFIG PER INCIDENT TYPE ──
function getProtocolConfig(report = {}) {
  const type = (report?.type || '').toLowerCase();
  const desc = (report?.desc || '').toLowerCase();
  
  let config = { id: 'generic', label: 'Incident Protocol', color: '#e99b63', icon: 'bx-broadcast', textColor: 'text-orange-400', borderColor: 'border-orange-500/30', bgColor: 'bg-orange-500/5', actions: ['police','cctv','broadcast'] };

  if (type.includes('fire') || type.includes('smoke') || type.includes('burn') || type.includes('explosion')) {
    config = { id: 'fire', label: 'Fire & Inferno Response', color: '#f97316', icon: 'bx-error-alt', textColor: 'text-orange-500', borderColor: 'border-orange-600/30', bgColor: 'bg-orange-600/5', actions: ['fire_service','police','hospital','broadcast','cctv'] };
  } else if (type.includes('medical') || type.includes('accident') || type.includes('cardiac')) {
    config = { id: 'medical', label: 'Medical Emergency', color: '#ef4444', icon: 'bx-plus-medical', textColor: 'text-red-400', borderColor: 'border-red-500/30', bgColor: 'bg-red-500/5', actions: ['police','signal','hospital','cctv','broadcast'] };
  } else if (type.includes('surge') || type.includes('crowd') || type.includes('stampede')) {
    config = { id: 'crowd', label: 'Crowd Surge Control', color: '#f59e0b', icon: 'bx-street-view', textColor: 'text-amber-400', borderColor: 'border-amber-500/30', bgColor: 'bg-amber-500/5', actions: ['police','diversion','broadcast','cctv'] };
  } else if (type.includes('fight') || type.includes('violence') || type.includes('assault') || type.includes('suspicious')) {
    config = { id: 'security', label: 'Security Response', color: '#06b6d4', icon: 'bx-shield-quarter', textColor: 'text-cyan-400', borderColor: 'border-cyan-500/30', bgColor: 'bg-cyan-500/5', actions: ['police','units','cctv','broadcast'] };
  } else if (type.includes('traffic') || type.includes('blockage') || type.includes('jam')) {
    config = { id: 'traffic', label: 'Traffic Control', color: '#eab308', icon: 'bxs-traffic-cone', textColor: 'text-yellow-400', borderColor: 'border-yellow-500/30', bgColor: 'bg-yellow-500/5', actions: ['signal','diversion','police','cctv'] };
  } else if (type.includes('flood') || type.includes('water') || type.includes('rain') || type.includes('drowning')) {
    config = { id: 'flood', label: 'Flood & Water Safety', color: '#3b82f6', icon: 'bx-water', textColor: 'text-blue-400', borderColor: 'border-blue-500/30', bgColor: 'bg-blue-500/5', actions: ['rescue','diversion','police','broadcast'] };
  } else if (type.includes('biohazard') || type.includes('chemical') || type.includes('gas') || type.includes('toxic') || type.includes('leak')) {
    config = { id: 'biohazard', label: 'Biohazard & Toxic Containment', color: '#22c55e', icon: 'bx-unite', textColor: 'text-green-400', borderColor: 'border-green-500/30', bgColor: 'bg-green-500/5', actions: ['hazmat','police','hospital','cctv','broadcast'] };
  } else if (type.includes('theft') || type.includes('robbery') || type.includes('larceny') || type.includes('shoplift')) {
    config = { id: 'theft', label: 'Larceny & Theft Protocol', color: '#06b6d4', icon: 'bx-search-alt', textColor: 'text-cyan-400', borderColor: 'border-cyan-500/30', bgColor: 'bg-cyan-500/5', actions: ['police','cctv','perimeter_hold'] };
  } else if (type.includes('missing') || type.includes('child') || type.includes('lost') || type.includes('amber')) {
    config = { id: 'missing', label: 'Missing Person / Amber Alert', color: '#a855f7', icon: 'bx-user-voice', textColor: 'text-purple-400', borderColor: 'border-purple-500/30', bgColor: 'bg-purple-500/5', actions: ['perimeter_hold','police','broadcast','air_support'] };
  } else if (type.includes('earthquake') || type.includes('seismic') || type.includes('tremor') || type.includes('quake')) {
    config = { id: 'seismic', label: 'Seismic Activity Protocol', color: '#64748b', icon: 'bx-pulse', textColor: 'text-slate-400', borderColor: 'border-slate-500/30', bgColor: 'bg-slate-500/5', actions: ['evacuate','broadcast','rescue','hospital'] };
  } else if (type.includes('infrastructure') || type.includes('power') || type.includes('outage') || type.includes('blackout') || type.includes('structural')) {
    config = { id: 'infrastructure', label: 'Infrastructure Failure', color: '#94a3b8', icon: 'bx-plug', textColor: 'text-slate-400', borderColor: 'border-slate-500/30', bgColor: 'bg-slate-500/5', actions: ['backup_power','cctv','police','broadcast'] };
  } else if (type.includes('riot') || type.includes('disorder') || type.includes('protest') || type.includes('unrest')) {
    config = { id: 'riot', label: 'Public Disorder / Riot', color: '#f97316', icon: 'bx-group', textColor: 'text-orange-400', borderColor: 'border-orange-500/30', bgColor: 'bg-orange-500/5', actions: ['police','special_ops','cctv','broadcast','diversion'] };
  } else if (type.includes('shooter') || type.includes('gun') || type.includes('weapon') || type.includes('armed')) {
    config = { id: 'weapon', label: 'EXTREME: Armed Threat', color: '#7f1d1d', icon: 'bx-target-lock', textColor: 'text-red-500', borderColor: 'border-red-600/50', bgColor: 'bg-red-950/20', actions: ['lockdown','special_ops','police','cctv','broadcast'] };
  }

  // Dynamic additions based on description
  if (desc.includes('kids') || desc.includes('children') || desc.includes('school')) {
    if (!config.actions.includes('units')) config.actions.push('units');
    config.label += " (Child Safety Protocol)";
  }
  if (desc.includes('weapon') || desc.includes('gun') || desc.includes('knife')) {
    config.color = '#7f1d1d'; // Darker red for extreme danger
    config.label = "EXTREME: armed threat";
    if (!config.actions.includes('police')) config.actions.unshift('police');
  }

  return config;
}

const ALL_ACTIONS = {
  police:    { label: 'Local police station has received info', icon: 'bx-building-house' },
  signal:    { label: 'Traffic signal command sent — Green Wave active', icon: 'bxs-traffic-cone' },
  hospital:  { label: 'Nearest hospital & ambulance dispatched', icon: 'bx-plus-medical' },
  diversion: { label: 'Crowd diversion signboards updated', icon: 'bx-street-view' },
  units:     { label: 'Nearby units alerted via proximity sync', icon: 'bx-radio' },
  cctv:      { label: 'CCTV focus mode: framerate boosted on zone', icon: 'bx-camera' },
  broadcast: { label: 'Public broadcast: area advisory issued', icon: 'bx-broadcast' },
  fire_service: { label: 'Fire & Rescue units dispatched to zone', icon: 'bx-error-alt' },
  rescue:    { label: 'Specialized water rescue team deployed', icon: 'bx-water' },
  hazmat:    { label: 'HAZMAT containment protocol active', icon: 'bx-unite' },
  lockdown:  { label: 'Full facility lockdown initiated', icon: 'bx-lock-alt' },
  evacuate:  { label: 'Evacuation pathways illuminated', icon: 'bx-exit' },
  backup_power: { label: 'Auxiliary power grid activation requested', icon: 'bx-plug' },
  special_ops:  { label: 'Special response team (SRT) mobilized', icon: 'bx-shield-quarter' },
  perimeter_hold: { label: 'Perimeter exits secured and monitored', icon: 'bx-door-open' },
  air_support:  { label: 'Aerial drone surveillance dispatched', icon: 'bx-navigation' },
};

// ── UNIQUE PROTOCOL VISUALS ──
function ProtocolVisual({ config, isActive }) {
  if (!isActive) return (
    <div className="h-56 flex items-center justify-center">
      <p className="text-[10px] text-gray-600 uppercase tracking-widest font-mono">Select a report to activate protocol</p>
    </div>
  );

  switch (config.id) {
    case 'medical': return <MedicalVisual color={config.color} />;
    case 'crowd':   return <CrowdVisual color={config.color} />;
    case 'security': return <SecurityVisual color={config.color} />;
    case 'traffic': return <TrafficVisual color={config.color} />;
    case 'fire':    return <FireVisual color={config.color} />;
    case 'flood':   return <FloodVisual color={config.color} />;
    case 'biohazard': return <BiohazardVisual color={config.color} />;
    case 'theft':   return <TheftVisual color={config.color} />;
    case 'missing': return <MissingVisual color={config.color} />;
    case 'seismic': return <SeismicVisual color={config.color} />;
    case 'infrastructure': return <InfrastructureVisual color={config.color} />;
    case 'riot':    return <RiotVisual color={config.color} />;
    case 'weapon':  return <WeaponVisual color={config.color} />;
    default:        return <GenericVisual color={config.color} />;
  }
}

function MedicalVisual({ color }) {
  return (
    <div className="h-56 flex items-center justify-center relative overflow-hidden">
      <div className="absolute inset-0 bg-red-500/3" />
      {/* Heartbeat line */}
      <svg className="absolute bottom-8 left-0 w-full h-12 opacity-60" viewBox="0 0 400 48">
        <motion.polyline
          points="0,24 60,24 80,4 100,44 120,24 140,24 180,24 200,2 220,46 240,24 260,24 320,24 340,10 360,38 380,24 400,24"
          stroke={color} strokeWidth="2" fill="none"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
        />
      </svg>
      {/* Pulse rings */}
      {[0, 1, 2].map(i => (
        <motion.div key={i} className="absolute rounded-full border-2" style={{ borderColor: color, width: 80 + i * 60, height: 80 + i * 60 }}
          animate={{ scale: [1, 1.3, 1], opacity: [0.6, 0, 0.6] }}
          transition={{ duration: 2, delay: i * 0.6, repeat: Infinity }}
        />
      ))}
      {/* Cross */}
      <div className="relative z-10 flex items-center justify-center h-14 w-14 rounded-full border-2" style={{ borderColor: color, backgroundColor: color + '15' }}>
        <i className="bx bx-plus-medical text-3xl" style={{ color }} />
      </div>
    </div>
  );
}

function CrowdVisual({ color }) {
  return (
    <div className="h-56 flex items-center justify-center relative overflow-hidden">
      <div className="absolute inset-0 bg-amber-500/3" />
      {/* Arrow flows */}
      {[20, 40, 60, 80].map((y, i) => (
        <motion.div key={i} className="absolute left-0 flex items-center gap-1"
          style={{ top: `${y}%`, color }}
          animate={{ x: ['-5%', '110%'] }}
          transition={{ duration: 2 + i * 0.3, delay: i * 0.4, repeat: Infinity, ease: 'linear' }}
        >
          <i className="bx bx-chevron-right text-xl opacity-60" />
          <i className="bx bx-chevron-right text-xl opacity-40" />
          <i className="bx bx-chevron-right text-xl opacity-20" />
        </motion.div>
      ))}
      {/* Person icons */}
      <div className="relative z-10 flex gap-4">
        {[...Array(5)].map((_, i) => (
          <motion.div key={i} animate={{ y: [0, -6, 0] }} transition={{ delay: i * 0.15, duration: 1.2, repeat: Infinity }}>
            <i className="bx bxs-user text-2xl" style={{ color, opacity: 0.6 + i * 0.08 }} />
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function SecurityVisual({ color }) {
  return (
    <div className="h-56 flex items-center justify-center relative overflow-hidden">
      <div className="absolute inset-0 bg-cyan-500/3" />
      {/* Rotating scan beam */}
      <motion.div className="absolute h-1 w-32 origin-left rounded-full blur-sm"
        style={{ backgroundColor: color, left: '50%', top: '50%', translateY: '-50%' }}
        animate={{ rotate: [0, 360] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
      />
      {/* Shield */}
      <div className="relative z-10">
        <motion.div animate={{ scale: [1, 1.05, 1] }} transition={{ duration: 2, repeat: Infinity }}>
          <i className="bx bxs-shield text-7xl" style={{ color, opacity: 0.8 }} />
        </motion.div>
        <div className="absolute inset-0 flex items-center justify-center pt-3">
          <i className="bx bx-radar text-2xl text-black" />
        </div>
      </div>
      {/* Corner scan lines */}
      {['top-4 left-4', 'top-4 right-4', 'bottom-4 left-4', 'bottom-4 right-4'].map((pos, i) => (
        <motion.div key={i} className={`absolute h-4 w-4 border-t-2 border-l-2 ${pos}`}
          style={{ borderColor: color }} animate={{ opacity: [0.2, 1, 0.2] }}
          transition={{ duration: 1.5, delay: i * 0.3, repeat: Infinity }}
        />
      ))}
    </div>
  );
}

function TrafficVisual({ color }) {
  const [lightState, setLightState] = useState(0); // 0=red,1=amber,2=green
  useEffect(() => {
    const t = setInterval(() => setLightState(s => (s + 1) % 3), 2000);
    return () => clearInterval(t);
  }, []);
  const lights = ['#ef4444', '#f59e0b', '#22c55e'];
  return (
    <div className="h-56 flex items-center justify-center relative overflow-hidden gap-16">
      <div className="absolute inset-0 bg-yellow-500/3" />
      {/* Traffic light */}
      <div className="flex flex-col items-center gap-2">
        <div className="p-3 rounded-2xl bg-black/60 border border-white/10 flex flex-col gap-3">
          {lights.map((c, i) => (
            <motion.div key={i} className="h-8 w-8 rounded-full" style={{ backgroundColor: lightState === i ? c : '#1a1a1a' }}
              animate={{ boxShadow: lightState === i ? `0 0 20px ${c}` : '0 0 0px transparent' }}
              transition={{ duration: 0.4 }}
            />
          ))}
        </div>
        <p className="text-[8px] font-black uppercase tracking-widest" style={{ color }}>
          {['STOP', 'CAUTION', 'GREEN WAVE'][lightState]}
        </p>
      </div>
      {/* Road lines */}
      <div className="flex flex-col gap-3">
        {[...Array(4)].map((_, i) => (
          <motion.div key={i} className="h-1 rounded-full" style={{ backgroundColor: color, width: 80 }}
            animate={{ opacity: [0.2, 0.8, 0.2], scaleX: [0.6, 1, 0.6] }}
            transition={{ duration: 1.5, delay: i * 0.3, repeat: Infinity }}
          />
        ))}
      </div>
    </div>
  );
}

function FireVisual({ color }) {
  return (
    <div className="h-56 flex items-center justify-center relative overflow-hidden">
      <div className="absolute inset-0 bg-orange-500/3" />
      {/* Flame fragments */}
      {[...Array(6)].map((_, i) => (
        <motion.div key={i} className="absolute bottom-0 rounded-full blur-xl"
          style={{ backgroundColor: color, width: 60 + i * 20, height: 80 + i * 30, left: `${15 + i * 15}%` }}
          animate={{ y: [0, -40, 0], scale: [1, 1.2, 1], opacity: [0.3, 0.6, 0.3] }}
          transition={{ duration: 2 + i * 0.5, repeat: Infinity }}
        />
      ))}
      <div className="relative z-10">
        <motion.div
          animate={{ scale: [1, 1.1, 1], rotate: [-2, 2, -2] }}
          transition={{ duration: 0.8, repeat: Infinity }}
        >
          <i className="bx bxs-hot text-7xl" style={{ color }} />
        </motion.div>
      </div>
    </div>
  );
}

function FloodVisual({ color }) {
  return (
    <div className="h-56 flex items-center justify-center relative overflow-hidden">
      <div className="absolute inset-0 bg-blue-500/3" />
      {/* Wave layers */}
      {[1, 2, 3].map(i => (
        <motion.div key={i} className="absolute bottom-0 left-[-50%] w-[200%] h-32 opacity-20"
          style={{ backgroundColor: color, borderRadius: '40% 45% 0 0' }}
          animate={{ x: ['-25%', '25%'], rotate: [0, 5, 0] }}
          transition={{ duration: 5 + i, repeat: Infinity, ease: 'easeInOut' }}
        />
      ))}
      <div className="relative z-10">
        <motion.div
          animate={{ y: [0, -10, 0] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <i className="bx bx-water text-7xl" style={{ color }} />
        </motion.div>
      </div>
    </div>
  );
}

// Pre-computed particle positions to avoid Math.random() in render
const BIOHAZARD_PARTICLES = Array.from({ length: 12 }, (_, i) => ({
  left: `${(i * 37 + 13) % 100}%`,
  top:  `${(i * 53 + 7)  % 100}%`,
  duration: 3 + (i % 3) * 0.7,
}));

function BiohazardVisual({ color }) {
  return (
    <div className="h-56 flex items-center justify-center relative overflow-hidden">
      <div className="absolute inset-0 bg-green-500/3" />
      {/* Gas particles — positions are pre-computed, NOT random per render */}
      {BIOHAZARD_PARTICLES.map((p, i) => (
        <motion.div key={i} className="absolute h-4 w-4 rounded-full blur-md"
          style={{ backgroundColor: color, left: p.left, top: p.top }}
          animate={{ scale: [1, 2, 1], opacity: [0.1, 0.4, 0.1], x: [0, 20, 0], y: [0, 20, 0] }}
          transition={{ duration: p.duration, repeat: Infinity }}
        />
      ))}
      <div className="relative z-10">
        <motion.div className="h-20 w-20 rounded-full border-4 flex items-center justify-center"
          style={{ borderColor: color, backgroundColor: color + '15' }}
          animate={{ rotate: [0, 360] }}
          transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
        >
          <i className="bx bx-unite text-4xl" style={{ color }} />
        </motion.div>
      </div>
    </div>
  );
}

function TheftVisual({ color }) {
  return (
    <div className="h-56 flex items-center justify-center relative overflow-hidden">
      <div className="absolute inset-0 bg-cyan-500/3" />
      {/* Search beam */}
      <motion.div className="absolute h-1 w-64 bg-cyan-500/20 blur-xl"
        animate={{ y: [-100, 100, -100] }}
        transition={{ duration: 4, repeat: Infinity }}
      />
      <div className="relative z-10 flex flex-col items-center">
        <motion.div animate={{ rotate: [0, 15, -15, 0] }} transition={{ duration: 2, repeat: Infinity }}>
          <i className="bx bx-search-alt text-7xl" style={{ color }} />
        </motion.div>
        <p className="mt-4 text-[10px] font-black uppercase tracking-[0.3em]" style={{ color }}>Scanning Perimeters</p>
      </div>
    </div>
  );
}

function MissingVisual({ color }) {
  return (
    <div className="h-56 flex items-center justify-center relative overflow-hidden">
      <div className="absolute inset-0 bg-purple-500/3" />
      {/* Radiating signal */}
      {[1, 2, 3].map(i => (
        <motion.div key={i} className="absolute rounded-full border"
          style={{ borderColor: color, width: 60 + i * 40, height: 60 + i * 40 }}
          animate={{ scale: [0.8, 1.2, 0.8], opacity: [0.1, 0.4, 0.1] }}
          transition={{ duration: 3, delay: i * 0.5, repeat: Infinity }}
        />
      ))}
      <div className="relative z-10">
        <i className="bx bx-user-voice text-7xl" style={{ color }} />
      </div>
    </div>
  );
}

function SeismicVisual({ color }) {
  return (
    <div className="h-56 flex items-center justify-center relative overflow-hidden">
      <div className="absolute inset-0 bg-slate-500/3" />
      <motion.div className="absolute bottom-0 left-0 w-full h-1 bg-slate-500/40" />
      {/* Seismic waves */}
      <svg className="absolute w-full h-32" viewBox="0 0 400 100">
        <motion.path
          d="M 0 50 Q 25 10 50 50 Q 75 90 100 50 T 200 50 T 300 50 T 400 50"
          stroke={color} strokeWidth="2" fill="none"
          animate={{ d: [
            "M 0 50 Q 25 20 50 50 Q 75 80 100 50 T 200 50 T 300 50 T 400 50",
            "M 0 50 Q 25 40 50 50 Q 75 60 100 50 T 200 50 T 300 50 T 400 50",
            "M 0 50 Q 25 20 50 50 Q 75 80 100 50 T 200 50 T 300 50 T 400 50"
          ]}}
          transition={{ duration: 0.2, repeat: Infinity }}
        />
      </svg>
      <div className="relative z-10 bg-black/40 p-4 rounded-3xl border border-white/10 backdrop-blur-md">
        <i className="bx bx-pulse text-5xl" style={{ color }} />
      </div>
    </div>
  );
}

function InfrastructureVisual({ color }) {
  return (
    <div className="h-56 flex items-center justify-center relative overflow-hidden">
      <div className="absolute inset-0 bg-slate-500/3" />
      <div className="relative z-10 grid grid-cols-2 gap-8">
        <div className="flex flex-col items-center gap-2">
            <motion.i className="bx bx-plug text-4xl" style={{ color }}
              animate={{ opacity: [0.3, 1, 0.3] }}
              transition={{ duration: 1, repeat: Infinity }}
            />
            <span className="text-[8px] font-black uppercase text-gray-500">Power Node</span>
        </div>
        <div className="flex flex-col items-center gap-2">
            <i className="bx bx-cog text-4xl animate-spin text-gray-700" />
            <span className="text-[8px] font-black uppercase text-gray-500">Grid Status</span>
        </div>
      </div>
    </div>
  );
}

function RiotVisual({ color }) {
  return (
    <div className="h-56 flex items-center justify-center relative overflow-hidden">
      <div className="absolute inset-0 bg-orange-500/5" />
      {/* Alert dots */}
      {[...Array(15)].map((_, i) => (
        <motion.div key={i} className="absolute h-1 w-1 rounded-full"
          style={{ backgroundColor: color, left: `${Math.random() * 100}%`, top: `${Math.random() * 100}%` }}
          animate={{ scale: [1, 2, 1], opacity: [0.2, 0.6, 0.2] }}
          transition={{ duration: 1 + Math.random(), repeat: Infinity }}
        />
      ))}
      <div className="relative z-10">
        <motion.div animate={{ scale: [1, 1.1, 1] }} transition={{ duration: 0.5, repeat: Infinity }}>
          <i className="bx bx-group text-7xl" style={{ color }} />
        </motion.div>
      </div>
    </div>
  );
}

function WeaponVisual({ color: _color }) {
  return (
    <div className="h-56 flex items-center justify-center relative overflow-hidden">
      <div className="absolute inset-0 bg-red-950/20" />
      {/* Target reticule lines */}
      <motion.div className="absolute h-[1px] w-full bg-red-600/40" animate={{ y: [-20, 20, -20] }} transition={{ duration: 2, repeat: Infinity }} />
      <motion.div className="absolute w-[1px] h-full bg-red-600/40" animate={{ x: [-20, 20, -20] }} transition={{ duration: 2, repeat: Infinity }} />
      
      <div className="relative z-10">
        <div className="h-24 w-24 rounded-full border-2 border-dashed border-red-600 animate-spin flex items-center justify-center">
            <i className="bx bx-target-lock text-6xl text-red-600 shadow-[0_0_20px_#ef4444]" />
        </div>
      </div>
      <div className="absolute bottom-6 w-full text-center">
        <p className="text-[10px] font-black text-red-500 animate-pulse tracking-[0.4em]">LETHAL THREAT DETECTED</p>
      </div>
    </div>
  );
}

function GenericVisual({ color }) {
  return (
    <div className="h-56 flex items-center justify-center relative overflow-hidden">
      <div className="absolute inset-0 bg-orange-500/3" />
      {[1, 2, 3].map(i => (
        <motion.div key={i} className="absolute rounded-full border" style={{ borderColor: color, width: i * 80, height: i * 80 }}
          animate={{ rotate: [0, 360 * (i % 2 === 0 ? -1 : 1)], opacity: [0.4, 0.8, 0.4] }}
          transition={{ duration: 4 + i, repeat: Infinity, ease: 'linear' }}
        />
      ))}
      {/* Radiating glow burst behind icon */}
      <motion.div
        className="absolute rounded-full"
        style={{ backgroundColor: color, width: 70, height: 70, filter: 'blur(20px)' }}
        animate={{ scale: [0.6, 1.4, 0.6], opacity: [0.15, 0.4, 0.15] }}
        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
      />
      {/* Animated broadcast icon — motion.i is invalid, use motion.div wrapper */}
      <motion.div
        className="relative z-10"
        animate={{ scale: [1, 1.15, 1], opacity: [0.7, 1, 0.7] }}
        transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
      >
        <i className="bx bx-broadcast text-5xl" style={{ color }} />
      </motion.div>
    </div>
  );
}

// ── MAIN PAGE ──
export default function EmergencyProtocol() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const paramReportId = searchParams.get('reportId');

  const [reports, setReports] = useState([]);
  const [activeReportId, setActiveReportId] = useState(null);
  const [isProtocolActive, setIsProtocolActive] = useState(false);
  const [checkedActionsMap, setCheckedActionsMap] = useState({}); // { [reportId]: [actionKeys] }
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6;

  // Fetch live feed
  const fetchReports = useCallback(async () => {
    try {
      const data = await apiFetch('/api/dashboard?cameraId=CCTV-MAIN');
      const scored = (data.feed || [])
        .map(r => ({ ...r, aiScore: getAiScore(r) }))
        .sort((a, b) => b.aiScore - a.aiScore);
      setReports(scored);
      setLoading(false);
    } catch {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReports();
    const t = setInterval(fetchReports, 5000);
    return () => clearInterval(t);
  }, [fetchReports]);

  // Pre-select report from URL param
  useEffect(() => {
    if (paramReportId && reports.length > 0) {
      const found = reports.find(r => String(r.id) === String(paramReportId));
      if (found) {
        setActiveReportId(found.id);
        setIsProtocolActive(true);
      }
    }
  }, [paramReportId, reports]);

  // Derive active report and config here so the checklist useEffect can reference them
  const activeReport = reports.find(r => String(r.id) === String(activeReportId)) || null;
  const config = activeReport ? getProtocolConfig(activeReport, activeReport.aiScore) : getProtocolConfig({}, 0);

  // Animate action checklist when protocol activates (initial checks)
  useEffect(() => {
    if (!isProtocolActive || !activeReportId) return;
    
    // Check if we already have actions for this specific ID to avoid resetting
    if (checkedActionsMap[activeReportId] && checkedActionsMap[activeReportId].length > 0) return;

    // Re-derive config inside for stable action list
    const activeRpt = reports.find(r => String(r.id) === String(activeReportId));
    if (!activeRpt) return;
    const actions = getProtocolConfig(activeRpt, activeRpt.aiScore).actions;

    // Only auto-check the FIRST action, let the user do the rest
    if (actions.length > 0) {
      const firstAction = actions[0];
      const timer = setTimeout(() => {
        setCheckedActionsMap(prev => {
          const current = prev[activeReportId] || [];
          if (current.includes(firstAction)) return prev;
          return { ...prev, [activeReportId]: [...current, firstAction] };
        });
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [isProtocolActive, activeReportId, reports, checkedActionsMap]); // reports included to ensure we find activeRpt if it loads late

  // Derived checked actions for the current active report
  const checkedActions = checkedActionsMap[activeReportId] || [];

  const toggleAction = (actionKey) => {
    setCheckedActionsMap(prev => {
      const current = prev[activeReportId] || [];
      const next = current.includes(actionKey)
        ? current.filter(k => k !== actionKey)
        : [...current, actionKey];
      return { ...prev, [activeReportId]: next };
    });
  };

  const handleActivate = (report) => {
    setActiveReportId(report.id);
    setIsProtocolActive(true);
  };

  const handleAbort = () => {
    setIsProtocolActive(false);
    // We keep checkedActionsMap to persist them if user reactivates
    setActiveReportId(null);
    navigate('/emergency', { replace: true });
  };

  const severityColor = (s = '') => {
    const v = s.toLowerCase();
    if (v === 'critical') return 'text-red-500';
    if (v === 'high') return 'text-orange-400';
    if (v === 'medium') return 'text-amber-400';
    return 'text-gray-400';
  };

  const scoreColor = (score) => {
    if (score >= 90) return '#ef4444';
    if (score >= 70) return '#f97316';
    if (score >= 50) return '#f59e0b';
    return '#6b7280';
  };

  const glass = 'bg-white/[0.03] backdrop-blur-2xl border border-white/10 shadow-[0_8px_32px_0_rgba(0,0,0,0.8)]';

  return (
    <div className="flex h-screen bg-[#050505] text-white font-sans overflow-hidden">
      <Sidebar />
      <main className="flex-1 p-8 overflow-y-auto">
        <div className="max-w-[1400px] mx-auto flex flex-col gap-6">

          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <i className="bx bx-shield-exclamation text-xl text-red-500" />
                <span className="text-[10px] font-black uppercase tracking-widest text-red-500">Guardian Protocol</span>
                {isProtocolActive && (
                  <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }}
                    className="px-2 py-0.5 rounded-full bg-red-600 text-white text-[8px] font-black uppercase animate-pulse shadow-[0_0_15px_rgba(239,68,68,0.4)]"
                  >
                    ACTIVE
                  </motion.span>
                )}
              </div>
              <h1 className="text-3xl font-bold tracking-tight">
                Response <span className="text-[#e99b63]">Protocol</span> Matrix
              </h1>
              <p className="text-xs text-gray-500 mt-1">
                {isProtocolActive && activeReport
                  ? `Protocol active for: ${activeReport.type} @ ${activeReport.loc}`
                  : 'AI-ranked incident queue. Select a report to activate the protocol.'}
              </p>
            </div>
            {isProtocolActive && (
              <motion.button
                initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
                onClick={handleAbort}
                className="px-6 py-3 rounded-xl bg-red-600 text-white font-bold text-xs uppercase tracking-widest shadow-[0_0_20px_rgba(239,68,68,0.4)] hover:scale-105 transition-all"
              >
                <i className="bx bx-stop-circle mr-2" /> Abort Protocol
              </motion.button>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* ── LEFT: AI Priority Queue ── */}
            <div className={`${glass} p-6 rounded-3xl flex flex-col gap-4`}>
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-xs font-black uppercase tracking-widest text-[#e99b63] flex items-center gap-2">
                  <i className="bx bx-brain" /> AI Priority Queue
                </h2>
                <span className="text-[9px] text-gray-500 font-mono">{reports.length} incidents</span>
              </div>

              {loading ? (
                <div className="flex-1 flex items-center justify-center">
                  <i className="bx bx-loader-alt animate-spin text-2xl text-[#e99b63]" />
                </div>
              ) : reports.length === 0 ? (
                <p className="text-xs text-gray-500 italic text-center mt-8">No active incidents. All clear.</p>
              ) : (
                <>
                  <div className="space-y-3 flex-1 overflow-y-auto pr-1 min-h-[500px]">
                    {reports.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map((r, idx) => {
                      const cfg = getProtocolConfig(r, r.aiScore);
                      const isSelected = r.id === activeReportId;
                      return (
                        <motion.div
                          key={r.id}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: idx * 0.04 }}
                          onClick={() => handleActivate(r)}
                          className={`p-3 rounded-2xl border cursor-pointer transition-all ${
                            isSelected
                              ? `${cfg.borderColor} ${cfg.bgColor}`
                              : 'border-white/5 bg-white/[0.02] hover:border-white/20'
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            {/* AI Score Ring */}
                            <div className="relative flex-shrink-0">
                              <svg width="44" height="44" viewBox="0 0 44 44">
                                <circle cx="22" cy="22" r="18" stroke="#1f1f1f" strokeWidth="4" fill="none" />
                                <motion.circle
                                  cx="22" cy="22" r="18"
                                  stroke={scoreColor(r.aiScore)} strokeWidth="4" fill="none"
                                  strokeLinecap="round"
                                  strokeDasharray={`${(r.aiScore / 100) * 113} 113`}
                                  strokeDashoffset="28"
                                  initial={{ strokeDasharray: '0 113' }}
                                  animate={{ strokeDasharray: `${(r.aiScore / 100) * 113} 113` }}
                                  transition={{ duration: 1, delay: idx * 0.05 }}
                                />
                              </svg>
                              <div className="absolute inset-0 flex items-center justify-center">
                                <span className="text-[9px] font-black" style={{ color: scoreColor(r.aiScore) }}>{r.aiScore}</span>
                              </div>
                            </div>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between mb-0.5">
                                <span className="text-[9px] font-black uppercase tracking-wider" style={{ color: cfg.color }}>
                                  {r.type}
                                </span>
                                {idx === 0 && currentPage === 1 && !isProtocolActive && (
                                  <span className="text-[7px] text-red-400 font-black uppercase animate-pulse">TOP PRIORITY</span>
                                )}
                              </div>
                              <p className="text-xs font-bold text-gray-100 truncate">{r.loc}</p>
                              <div className="flex items-center gap-2 mt-1">
                                <span className={`text-[8px] font-bold ${severityColor(r.severity)}`}>{r.severity || 'Unknown'}</span>
                                <span className="text-gray-700">·</span>
                                <span className="text-[8px] text-gray-500">{r.time}</span>
                              </div>
                            </div>
                          </div>

                          {isSelected && isProtocolActive && (
                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                              className="mt-2 pt-2 border-t border-white/5 flex items-center gap-2"
                            >
                              <div className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
                              <span className="text-[8px] text-red-400 font-black uppercase tracking-widest">Protocol Live</span>
                            </motion.div>
                          )}
                        </motion.div>
                      );
                    })}
                  </div>

                  {/* Pagination Controls */}
                  <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-center gap-2 select-none font-mono">
                    <div className="flex items-center gap-1">
                      {(() => {
                        const totalPages = Math.ceil(reports.length / itemsPerPage);
                        if (totalPages <= 1) return null;
                        
                        const getPagingRange = (current, total) => {
                          if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
                          if (current <= 4) return [1, 2, 3, 4, 5, "...", total];
                          if (current >= total - 3) return [1, "...", total - 4, total - 3, total - 2, total - 1, total];
                          return [1, "...", current - 1, current, current + 1, "...", total];
                        };

                        return getPagingRange(currentPage, totalPages).map((page, idx) => {
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
                              onClick={() => setCurrentPage(page)}
                              className={`h-7 min-w-[28px] px-1.5 rounded-md flex items-center justify-center text-[10px] font-black transition-all duration-300 ${
                                isActive
                                  ? "bg-[#e99b63] text-black shadow-[0_4px_12px_rgba(233,155,99,0.3)]"
                                  : "text-gray-500 hover:text-white hover:bg-white/5"
                              }`}
                            >
                              {page}
                            </button>
                          );
                        });
                      })()}
                    </div>

                    {currentPage < Math.ceil(reports.length / itemsPerPage) && (
                      <button
                        onClick={() => setCurrentPage(prev => prev + 1)}
                        className="ml-4 flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-[#e99b63] hover:text-white transition-colors group"
                      >
                        Next <i className="bx bx-chevron-right group-hover:translate-x-1 transition-transform" />
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* ── RIGHT: Active Protocol Panel ── */}
            <div className="lg:col-span-2 flex flex-col gap-6">

              {/* Protocol Visual Canvas */}
              <div className={`${glass} p-6 rounded-3xl`}>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-xl flex items-center justify-center" style={{ backgroundColor: config.color + '20', border: `1px solid ${config.color}40` }}>
                      <i className={`bx ${config.icon} text-lg`} style={{ color: config.color }} />
                    </div>
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-widest text-gray-500">Protocol Type</p>
                      <p className="text-sm font-bold" style={{ color: config.color }}>{config.label}</p>
                    </div>
                  </div>
                  {activeReport && (
                    <div className="text-right">
                      <p className="text-[9px] text-gray-500 uppercase tracking-widest">Target Incident</p>
                      <p className="text-xs font-bold text-gray-100">{activeReport.type} @ {activeReport.loc}</p>
                    </div>
                  )}
                </div>

                <div className={`rounded-2xl border overflow-hidden ${isProtocolActive ? config.borderColor : 'border-white/5'} bg-[#080808]`}>
                  <ProtocolVisual config={config} isActive={isProtocolActive} />
                </div>
              </div>

              {/* Action Checklist */}
              <AnimatePresence>
                {isProtocolActive && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
                    className={`${glass} p-6 rounded-3xl`}
                  >
                    <h2 className="text-xs font-black uppercase tracking-widest text-[#e99b63] flex items-center gap-2 mb-5">
                      <i className="bx bx-list-check" /> Protocol Action Checklist
                    </h2>
                    <div className="space-y-3">
                      {config.actions.map((actionKey, i) => {
                        const action = ALL_ACTIONS[actionKey];
                        const isDone = checkedActions.includes(actionKey);
                        return (
                          <motion.div
                            key={actionKey}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.1 }}
                            onClick={() => toggleAction(actionKey)}
                            className={`flex items-center gap-4 p-3 rounded-xl border transition-all cursor-pointer ${
                              isDone ? `${config.bgColor} ${config.borderColor}` : 'bg-white/[0.02] border-white/5 hover:border-white/20'
                            }`}
                          >
                            <motion.div
                              animate={isDone ? { scale: [1.3, 1] } : {}}
                              className={`h-6 w-6 rounded-full flex items-center justify-center flex-shrink-0 border transition-all ${
                                isDone ? 'border-transparent' : 'border-white/20 bg-white/5'
                              }`}
                              style={isDone ? { backgroundColor: config.color + '30', borderColor: config.color + '60' } : {}}
                            >
                              {isDone
                                ? <i className="bx bx-check text-sm font-black" style={{ color: config.color }} />
                                : <i className="bx bx-time text-xs text-gray-600" />
                              }
                            </motion.div>
                            <div className="flex-1">
                              <p className={`text-xs font-bold ${isDone ? 'text-gray-100' : 'text-gray-500'}`}>
                                {action.label}
                              </p>
                            </div>
                            <span className={`text-[7px] font-black uppercase px-2 py-0.5 rounded tracking-widest ${
                              isDone ? 'text-white' : 'text-gray-600 bg-white/5'
                            }`} style={isDone ? { backgroundColor: config.color + '30', color: config.color } : {}}>
                              {isDone ? 'DONE' : 'PENDING'}
                            </span>
                          </motion.div>
                        );
                      })}
                    </div>

                    {checkedActions.length === config.actions.length && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                        className="mt-5 p-4 rounded-2xl flex items-center gap-3"
                        style={{ backgroundColor: config.color + '10', border: `1px solid ${config.color}30` }}
                      >
                        <i className="bx bxs-check-shield text-2xl" style={{ color: config.color }} />
                        <div>
                          <p className="text-xs font-black" style={{ color: config.color }}>All Actions Complete</p>
                          <p className="text-[10px] text-gray-400">Emergency protocol fully dispatched. Monitor the feed for updates.</p>
                        </div>
                      </motion.div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Prompt to activate */}
              {!isProtocolActive && !loading && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  className={`${glass} p-8 rounded-3xl flex flex-col items-center justify-center gap-4 text-center border-dashed`}
                >
                  <div className="h-16 w-16 rounded-full bg-[#e99b63]/10 border border-[#e99b63]/20 flex items-center justify-center">
                    <i className="bx bx-shield-exclamation text-3xl text-[#e99b63]/60" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-300">Select a report from the AI Priority Queue</p>
                    <p className="text-[10px] text-gray-500 mt-1">The AI has ranked incidents by urgency. The top-priority one is recommended for immediate protocol activation.</p>
                  </div>
                  {reports[0] && (
                    <button onClick={() => handleActivate(reports[0])}
                      className="px-6 py-2.5 rounded-xl bg-[#e99b63] text-black text-xs font-bold uppercase tracking-widest shadow-[0_0_20px_rgba(233,155,99,0.3)] hover:scale-105 transition-all"
                    >
                      <i className="bx bx-shield-quarter mr-2" />
                      Activate for Top Priority: {reports[0]?.type}
                    </button>
                  )}
                </motion.div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
