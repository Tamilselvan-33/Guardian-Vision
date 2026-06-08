import { useState, useEffect } from "react";
import Sidebar from "../components/Sidebar";
import { apiFetch } from "../lib/api";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, CartesianGrid
} from 'recharts';
import { motion } from "framer-motion";

const styles = {
  glass: "bg-white/[0.03] backdrop-blur-2xl border border-white/10 shadow-[0_8px_32px_0_rgba(0,0,0,0.8)]",
};

export default function Analytics() {
  const [data, setData] = useState({ feed: [], stats: {} });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let interval;
    const fetchData = async () => {
      try {
        const res = await apiFetch("/api/dashboard");
        setData(res);
      } catch (err) {
        console.error("Fetch error:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
    interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, []);

  const feed = data.feed || [];

  // 1. RISK LEVEL PIPELINE
  const critical = feed.filter(f => f.severity === 'Critical' || f.type?.toLowerCase().includes('surge') || f.type?.toLowerCase().includes('critical')).length;
  const high = feed.filter(f => f.severity === 'High').length;
  const medium = feed.filter(f => f.severity === 'Medium').length;
  const low = Math.max(0, feed.length - critical - high - medium);
  
  const riskData = [
    { name: 'Critical', value: critical, color: '#ef4444' },
    { name: 'High', value: high, color: '#f97316' },
    { name: 'Medium', value: medium, color: '#f59e0b' },
    { name: 'Low', value: low, color: '#10b981' },
  ].filter(d => d.value > 0);

  // 2. INCIDENT TYPES OVERVIEW
  const typesMap = feed.reduce((acc, curr) => {
    const t = curr.type || 'Other';
    acc[t] = (acc[t] || 0) + 1;
    return acc;
  }, {});
  const typeData = Object.entries(typesMap)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  // 3. RESOLUTION METRICS
  const resolved = feed.filter(f => f.status === 'Resolved').length;
  const ignored = feed.filter(f => f.status === 'Ignored').length;
  const pending = feed.length - resolved - ignored;

  // 4. REPORTER SOURCES
  const civilian = feed.filter(f => f.src?.toLowerCase().includes('civili') || f.src?.toLowerCase().includes('public')).length;
  const officer = feed.filter(f => f.src?.toLowerCase().includes('officer') || f.src?.toLowerCase().includes('unit')).length;
  const ai = feed.length - civilian - officer;
  const sourceData = [
    { name: 'AI / Sensor', value: ai, color: '#e99b63' },
    { name: 'Civilian', value: civilian, color: '#06b6d4' },
    { name: 'Officer', value: officer, color: '#8b5cf6' },
  ];

  // (Simulated timeline data based on feed length, since we don't store historical timestamps yet)
  const timelineData = [
    { time: '00:00', load: Math.floor(feed.length * 0.2) },
    { time: '04:00', load: Math.floor(feed.length * 0.3) },
    { time: '08:00', load: Math.floor(feed.length * 0.8) },
    { time: '12:00', load: feed.length },
    { time: '16:00', load: Math.floor(feed.length * 0.9) },
    { time: '20:00', load: Math.floor(feed.length * 0.6) },
  ];

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-[#0f0f0f] border border-white/10 p-3 rounded-lg shadow-xl font-mono">
          <p className="text-[10px] text-gray-400 mb-1 uppercase tracking-widest">{label || payload[0].name}</p>
          <p className="text-sm font-bold" style={{ color: payload[0].payload.color || payload[0].color || '#fff' }}>
            {payload[0].value} <span className="text-[10px] font-normal text-gray-500">Reports</span>
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="flex h-screen bg-[#050505] text-white overflow-hidden selection:bg-[#e99b63]/30">
      <Sidebar />
      <main className="flex-1 p-8 overflow-y-auto custom-scrollbar">
        <div className="max-w-[1400px] mx-auto">
          
          <div className="flex justify-between items-end mb-8 border-b border-white/5 pb-6">
            <div>
              <h1 className="text-3xl font-bold tracking-tight mb-2 flex items-center gap-3">
                Threat <span className="text-[#e99b63]">Analytics</span>
                {loading && <i className="bx bx-loader-alt animate-spin text-sm text-gray-500" />}
              </h1>
              <p className="text-xs text-gray-500 font-mono uppercase tracking-widest">
                Data Aggregation & Intelligence Metrics
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-[#10b981] font-bold font-mono tracking-widest uppercase flex items-center gap-2 justify-end mb-1">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981] animate-pulse" /> Live Sync Active
              </p>
              <p className="text-[10px] text-gray-400 font-mono tracking-widest uppercase">
                {feed.length} Total Records Analyzed
              </p>
            </div>
          </div>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8"
          >
            {[
              { title: "Average Risk Score", value: `${data.stats?.riskIndex || 0}%`, icon: 'bx-shield-quarter', color: 'text-amber-500' },
              { title: "Safety Index", value: `${data.stats?.safetyScore || 100}%`, icon: 'bx-check-shield', color: 'text-emerald-500' },
              { title: "Total Pending", value: pending, icon: 'bx-time-five', color: 'text-[#e99b63]' },
              { title: "Resolution Rate", value: feed.length ? `${Math.round((resolved/feed.length)*100)}%` : '0%', icon: 'bx-trending-up', color: 'text-cyan-400' },
            ].map((c, i) => (
              <div key={i} className={`p-6 rounded-3xl ${styles.glass} relative overflow-hidden group`}>
                <div className="absolute -inset-10 bg-gradient-to-br from-white/[0.02] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <h4 className="text-[10px] font-bold uppercase tracking-widest text-gray-500 font-mono mb-4 flex items-center gap-2">
                  <i className={`bx ${c.icon} ${c.color} text-lg`} /> {c.title}
                </h4>
                <p className="text-4xl font-black font-mono tracking-tight">{c.value}</p>
              </div>
            ))}
          </motion.div>

          {/* CHARTS GRID */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            
            {/* INCIDENT TYPES */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1 }}
              className={`p-6 rounded-3xl ${styles.glass}`}
            >
              <h3 className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#e99b63] mb-6 font-mono flex items-center gap-2">
                <i className="bx bx-category" /> Top Incident Categories
              </h3>
              <div className="h-[280px] w-full">
                {feed.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-xs text-gray-500 font-mono uppercase tracking-widest">No Data</div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={typeData} margin={{ top: 10, right: 10, left: -10, bottom: 40 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                      <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#6b7280', fontFamily: 'monospace', angle: -35, textAnchor: 'end', dy: 8 }} axisLine={false} tickLine={false} interval={0} height={50} />
                      <YAxis tick={{ fontSize: 10, fill: '#6b7280', fontFamily: 'monospace' }} axisLine={false} tickLine={false} allowDecimals={false} width={30} />
                      <Tooltip content={<CustomTooltip />} cursor={{ fill: '#ffffff05' }} />
                      <Bar dataKey="count" fill="#e99b63" radius={[4, 4, 0, 0]} barSize={32}>
                        {typeData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={index === 0 ? '#e99b63' : '#6b7280'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </motion.div>

            {/* RISK & SEVERITY */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 }}
              className={`p-6 rounded-3xl ${styles.glass} flex flex-col`}
            >
              <h3 className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#e99b63] mb-2 font-mono flex items-center gap-2">
                <i className="bx bx-doughnut-chart" /> Risk Segregation & Sources
              </h3>
              
              <div className="flex-1 grid grid-cols-2 gap-4">
                <div className="h-[220px] flex flex-col items-center">
                  <p className="text-[9px] text-gray-500 uppercase tracking-widest font-mono mt-4 mb-2">Severity Spread</p>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={riskData.length ? riskData : [{ name: 'Empty', value: 1, color: '#222' }]}
                        cx="50%" cy="50%"
                        innerRadius={50} outerRadius={70}
                        paddingAngle={5}
                        dataKey="value"
                        stroke="none"
                      >
                        {riskData.length ? riskData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        )) : <Cell fill="#222" />}
                      </Pie>
                      {riskData.length > 0 && <Tooltip content={<CustomTooltip />} />}
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                <div className="h-[220px] flex flex-col items-center">
                  <p className="text-[9px] text-gray-500 uppercase tracking-widest font-mono mt-4 mb-2">Report Origins</p>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={sourceData.filter(d => d.value > 0).length ? sourceData.filter(d => d.value > 0) : [{ name: 'Empty', value: 1, color: '#222' }]}
                        cx="50%" cy="50%"
                        innerRadius={50} outerRadius={70}
                        paddingAngle={5}
                        dataKey="value"
                        stroke="none"
                      >
                        {sourceData.filter(d => d.value > 0).length ? sourceData.filter(d => d.value > 0).map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        )) : <Cell fill="#222" />}
                      </Pie>
                      {sourceData.filter(d => d.value > 0).length > 0 && <Tooltip content={<CustomTooltip />} />}
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mt-4 border-t border-white/5 pt-4">
                 <div className="flex items-center gap-3">
                    <div className="hidden sm:flex items-center gap-1.5 text-[8px] font-mono text-gray-400">
                      <div className="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_5px_rgba(239,68,68,0.5)]" /> Critical
                      <div className="w-2 h-2 rounded-full bg-orange-500 shadow-[0_0_5px_rgba(249,115,22,0.5)] ml-2" /> High
                      <div className="w-2 h-2 rounded-full bg-amber-500 shadow-[0_0_5px_rgba(245,158,11,0.5)] ml-2" /> Med
                      <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_5px_rgba(16,185,129,0.5)] ml-2" /> Low
                    </div>
                 </div>
                 <div className="flex items-center gap-3 justify-end">
                    <div className="hidden sm:flex items-center gap-1.5 text-[8px] font-mono text-gray-400">
                      <div className="w-2 h-2 rounded-full bg-cyan-400" /> Civilian
                      <div className="w-2 h-2 rounded-full bg-[#e99b63] ml-2" /> AI Edge
                      <div className="w-2 h-2 rounded-full bg-violet-500 ml-2" /> Officer
                    </div>
                 </div>
              </div>

            </motion.div>

            {/* DAILY PIPELINE TREND */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3 }}
              className={`p-6 rounded-3xl ${styles.glass} lg:col-span-2`}
            >
              <h3 className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#e99b63] mb-6 font-mono flex items-center gap-2">
                <i className="bx bx-pulse" /> Live Volume Trend (Simulated Timeline)
              </h3>
              <div className="h-[240px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={timelineData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" vertical={false} />
                    <XAxis dataKey="time" tick={{ fontSize: 10, fill: '#6b7280', fontFamily: 'monospace' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: '#6b7280', fontFamily: 'monospace' }} axisLine={false} tickLine={false} allowDecimals={false} width={30} />
                    <Tooltip content={<CustomTooltip />} />
                    <Line 
                      type="monotone" 
                      dataKey="load" 
                      stroke="#10b981" 
                      strokeWidth={3}
                      dot={{ fill: '#050505', stroke: '#10b981', strokeWidth: 2, r: 4 }}
                      activeDot={{ fill: '#10b981', stroke: '#fff', strokeWidth: 2, r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </motion.div>

          </div>
        </div>
      </main>
    </div>
  );
}
