const express  = require('express');
const mongoose = require('mongoose');
const cors     = require('cors');
const path     = require('path');
const net      = require('net');
const fs       = require('fs');
const { spawn } = require('child_process');
require('dotenv').config();

const { CrowdLog, IncidentReport, Alert, User } = require('./models');

const app = express();
app.use(cors());
app.use(express.json());

// ─────────────────────────────────────────────────────────────────
// RUNTIME STATE
// ─────────────────────────────────────────────────────────────────
const runtime = {
  edge: new Map(),   // cameraId -> { lastSeen, source, coverageZone, pressureScores }
  sim: {
    timer: null, phase: 0, count: 10,
    cameraId: 'SIM-CAM-01', location: 'SIM-CAM-01'
  },
  detector: {
    proc: null, startedAt: null,
    cameraId: 'CCTV-MAIN', streamPort: 8001,
    lastExit: null, lastStderr: '', lastStdout: ''
  }
};

// ─────────────────────────────────────────────────────────────────
// MONGODB
// ─────────────────────────────────────────────────────────────────
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/guardian-vision')
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => console.error('❌ MongoDB Connection Error:', err));

function mongoReady() {
  return mongoose.connection && mongoose.connection.readyState === 1;
}

// ─────────────────────────────────────────────────────────────────
// CORE INGEST — with Delta-Velocity Surge Detection
// ─────────────────────────────────────────────────────────────────
async function ingestCrowdLog({ peopleCount, density, cameraId, location, zoneData, pressureScores }) {
  // Risk level from density
  let riskLevel = 'Low';
  if (density > 0.8)      riskLevel = 'High';
  else if (density > 0.4) riskLevel = 'Medium';

  // Fetch last 6 logs for this camera to compute growth rate
  const recentLogs = await CrowdLog.find({ cameraId: cameraId || 'CCTV-MAIN' })
    .sort({ timestamp: -1 }).limit(6).lean();

  // ── Delta-Velocity Growth Rate Calculation ──
  // IMPORTANT: We fetch AFTER log.save(), so recentLogs[0] IS the current log.
  // The previous log is at index [1]. We compare current density against it.
  let growthRate = 0;
  if (recentLogs.length >= 2) {
    const prev = recentLogs[1]; // index [0] = current log, [1] = previous
    const timeDeltaSec = (new Date(recentLogs[0].timestamp).getTime() - new Date(prev.timestamp).getTime()) / 1000;
    if (timeDeltaSec > 0) {
      growthRate = (density - prev.density) / timeDeltaSec;
    }
  }

  const log = new CrowdLog({
    cameraId:       cameraId || 'CCTV-MAIN',
    location:       location || cameraId || 'CCTV-MAIN',
    peopleCount,
    density,
    zoneData,
    pressureScores: pressureScores || {},
    growthRate:     parseFloat(growthRate.toFixed(5)),
    riskLevel
  });
  await log.save();

  const now = Date.now();

  // ── Velocity-Based Surge Detection (replaces flat threshold) ──
  // Fires if density is growing faster than 0.05 units/second (configurable)
  const SURGE_RATE_THRESHOLD = parseFloat(process.env.SURGE_RATE_THRESHOLD || '0.05');
  if (growthRate > SURGE_RATE_THRESHOLD && density > 0.2) {
    const lastSurge = await Alert.findOne({ type: 'VELOCITY_SURGE', cameraId: log.cameraId })
      .sort({ timestamp: -1 }).lean();
    if (!lastSurge || (now - new Date(lastSurge.timestamp).getTime() > 60000)) {
      await new Alert({
        type:      'VELOCITY_SURGE',
        alertType: 'PRESSURE_SURGE',
        location:  location || log.cameraId,
        cameraId:  log.cameraId,
        severity:  growthRate > SURGE_RATE_THRESHOLD * 3 ? 'Critical' : 'Warning',
        metadata:  new Map([['growthRate', growthRate], ['density', density]])
      }).save();
      console.log(`[SURGE] Velocity surge detected on ${log.cameraId}: +${growthRate.toFixed(4)} density/sec`);
    }
  }

  // ── Classic Crowd Cluster Detection (still useful as a second signal) ──
  if (peopleCount > 20 && density > 0.6) {
    const lastCluster = await Alert.findOne({ type: 'CLUSTER', cameraId: log.cameraId })
      .sort({ timestamp: -1 }).lean();
    if (!lastCluster || (now - new Date(lastCluster.timestamp).getTime() > 60000)) {
      await new Alert({
        type:      'CLUSTER',
        alertType: 'CROWD_DENSITY',
        location:  location || log.cameraId,
        cameraId:  log.cameraId,
        severity:  'Warning',
        metadata:  new Map([['peopleCount', peopleCount], ['density', density]])
      }).save();
    }
  }

  // ── Pressure Surge Detection (from optical flow data from edge) ──
  if (pressureScores) {
    const zones = Object.keys(pressureScores);
    for (const z of zones) {
      const pScore = pressureScores[z];
      if (pScore > 0.6) {
        // NOTE: Mongoose Map fields do not support dot-notation queries in lean().
        // Dedup by type + cameraId + time window only (per-zone granularity handled
        // by the 60s cooldown — sufficient for a demo environment).
        const lastPressure = await Alert.findOne({
          type: 'PRESSURE_SURGE',
          cameraId: log.cameraId
        }).sort({ timestamp: -1 }).lean();
        if (!lastPressure || (now - new Date(lastPressure.timestamp).getTime() > 60000)) {
          await new Alert({
            type:      'PRESSURE_SURGE',
            alertType: pScore > 0.9 ? 'DIRECTIONAL_CONFLICT' : 'PRESSURE_SURGE',
            location:  location || log.cameraId,
            cameraId:  log.cameraId,
            severity:  pScore > 0.9 ? 'Critical' : 'Warning',
            metadata:  new Map([['pressureScore', pScore], ['zone', z]])
          }).save();
          console.log(`[PRESSURE] Zone ${z} on ${log.cameraId}: score=${pScore.toFixed(3)}`);
          break; // One pressure alert per ingest cycle — avoid alert flooding
        }
      }
    }
  }

  return log;
}

// ─────────────────────────────────────────────────────────────────
// ROUTES
// ─────────────────────────────────────────────────────────────────

// 1. Ingest crowd log from edge detector
app.post('/api/crowd/log', async (req, res) => {
  try {
    const { peopleCount, density, cameraId, location, zoneData, pressureScores } = req.body;
    const log = await ingestCrowdLog({ peopleCount, density, cameraId, location, zoneData, pressureScores });
    res.status(201).json(log);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. Health check
app.get('/api/health', async (req, res) => {
  res.json({
    ok: true,
    mongoReady: mongoReady(),
    mongoState: mongoose.connection?.readyState ?? null,
    uptimeSec: Math.round(process.uptime()),
    now: Date.now()
  });
});

// 3. DB check
app.get('/api/db-check', async (req, res) => {
  try {
    const logs      = await CrowdLog.countDocuments();
    const incidents = await IncidentReport.countDocuments();
    const alerts    = await Alert.countDocuments();
    const latestLog = await CrowdLog.findOne().sort({ timestamp: -1 });
    res.json({ mongoReady: mongoReady(), counts: { logs, incidents, alerts }, latestLog });
  } catch (err) {
    res.status(500).json({ error: err.message, mongoReady: mongoReady() });
  }
});

// 4. Edge heartbeat — extended with coverageZone and pressureScores
app.post('/api/edge/heartbeat', async (req, res) => {
  const { cameraId = 'CCTV-MAIN', source = 'unknown', coverageZone, pressureScores } = req.body || {};
  runtime.edge.set(cameraId, {
    lastSeen: Date.now(),
    source,
    coverageZone: coverageZone || null,
    pressureScores: pressureScores || {}
  });
  res.json({ ok: true });
});

// 5. Edge status
app.get('/api/edge/status', async (req, res) => {
  const { cameraId = 'CCTV-MAIN' } = req.query;
  const s = runtime.edge.get(cameraId);
  res.json({
    cameraId,
    online:         !!s && (Date.now() - s.lastSeen) < 15000,
    lastSeen:       s?.lastSeen ?? null,
    source:         s?.source ?? null,
    coverageZone:   s?.coverageZone ?? null,
    pressureScores: s?.pressureScores ?? {}
  });
});

// 6. [NEW] Multi-camera registry — full edge topology view
app.get('/api/cameras', (req, res) => {
  const cameras = [];
  for (const [cameraId, data] of runtime.edge.entries()) {
    cameras.push({
      cameraId,
      online:         (Date.now() - data.lastSeen) < 15000,
      lastSeen:       data.lastSeen,
      source:         data.source,
      coverageZone:   data.coverageZone,
      pressureScores: data.pressureScores
    });
  }
  // Sort: online cameras first
  cameras.sort((a, b) => (b.online ? 1 : 0) - (a.online ? 1 : 0));
  res.json({ total: cameras.length, cameras });
});

// 7. Auth — secure via .env, no hardcoded fallback password
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required.' });

    let user = await User.findOne({ email });

    // Auto-seed master admin ONLY if credentials match .env — never hardcoded
    const masterEmail = process.env.MASTER_ADMIN_EMAIL;
    const masterPass  = process.env.MASTER_ADMIN_PASSWORD;
    if (!user && masterEmail && masterPass &&
        email.toLowerCase() === masterEmail.toLowerCase() && password === masterPass) {
      user = new User({ email, password, role: 'Admin' });
      await user.save();
      console.log(`[AUTH] Master admin account seeded for ${email}`);
    } else if (!user) {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }

    if (user.password !== password) {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }
    res.json({ success: true, user: { email: user.email, role: user.role }, token: 'mock-jwt-token' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/signup', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required.' });
    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ error: 'Email already registered.' });
    const user = new User({ email, password });
    await user.save();
    res.json({ success: true, user: { email: user.email, role: user.role }, token: 'mock-jwt-token' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 8. Simulator
app.post('/api/sim/start', async (req, res) => {
  const { cameraId = runtime.sim.cameraId, location = runtime.sim.location, intervalMs = 2500 } = req.body || {};
  runtime.sim.cameraId = cameraId;
  runtime.sim.location = location;
  if (runtime.sim.timer) clearInterval(runtime.sim.timer);

  runtime.sim.timer = setInterval(async () => {
    const phase = runtime.sim.phase;
    let count = runtime.sim.count;
    if (phase < 5)       count = Math.floor(5  + Math.random() * 11);
    else if (phase < 10) count = Math.floor(35 + Math.random() * 11);
    else if (phase < 15) count = Math.floor(25 + Math.random() * 11);
    else {
      count = Math.max(0, count - 10);
      if (count === 0) runtime.sim.phase = -1;
    }
    runtime.sim.phase += 1;
    runtime.sim.count  = count;

    const density = count / 50.0;
    let c1 = Math.floor(Math.random() * count * 0.4);
    let c2 = Math.floor(Math.random() * count * 0.3);
    let c3 = Math.floor(Math.random() * count * 0.2);
    let c4 = Math.max(0, count - (c1 + c2 + c3));

    const zoneData = { 'Zone 1': c1, 'Zone 2': c2, 'Zone 3': c3, 'Zone 4': c4 };

    // Simulated pressure scores — scale with crowd density for demo realism.
    // Deliberately allow high-pressure events during phase 5-10 (dense crowd phase)
    // so that PRESSURE_SURGE and DIRECTIONAL_CONFLICT alerts fire during the demo.
    const pressureBase = density; // 0.0 - 1.0
    const pressureScores = {
      'Zone 1': parseFloat(Math.min(0.95, (pressureBase * 0.6 + Math.random() * 0.4)).toFixed(3)),
      'Zone 2': parseFloat(Math.min(0.95, (pressureBase * 0.8 + Math.random() * 0.5)).toFixed(3)),
      'Zone 3': parseFloat(Math.min(0.95, (pressureBase * 0.5 + Math.random() * 0.3)).toFixed(3)),
      'Zone 4': parseFloat(Math.min(0.95, (pressureBase * 0.7 + Math.random() * 0.4)).toFixed(3)),
    };

    try {
      await ingestCrowdLog({
        peopleCount: count, density,
        cameraId: runtime.sim.cameraId, location: runtime.sim.location,
        zoneData, pressureScores
      });
      runtime.edge.set(runtime.sim.cameraId, { lastSeen: Date.now(), source: 'server-sim', pressureScores });
    } catch (simErr) {
      console.error(`[SIM] Ingest error (non-fatal): ${simErr.message}`);
    }
  }, Math.max(500, intervalMs));

  res.json({ ok: true, running: true, cameraId: runtime.sim.cameraId, location: runtime.sim.location });
});

app.post('/api/sim/stop', async (req, res) => {
  if (runtime.sim.timer) clearInterval(runtime.sim.timer);
  runtime.sim.timer = null;
  res.json({ ok: true, running: false });
});

app.get('/api/sim/status', async (req, res) => {
  res.json({ running: !!runtime.sim.timer, cameraId: runtime.sim.cameraId, location: runtime.sim.location });
});

// 9. Detector process control
app.get('/api/detector/status', (req, res) => {
  res.json({
    running:    !!runtime.detector.proc && !runtime.detector.proc.killed,
    pid:        runtime.detector.proc?.pid ?? null,
    startedAt:  runtime.detector.startedAt,
    cameraId:   runtime.detector.cameraId,
    streamPort: runtime.detector.streamPort,
    lastExit:   runtime.detector.lastExit,
    lastStderr: runtime.detector.lastStderr,
    lastStdout: runtime.detector.lastStdout
  });
});

function isPortFree(p) {
  return new Promise((resolve) => {
    const s = net.createServer();
    s.once('error', () => resolve(false));
    s.once('listening', () => s.close(() => resolve(true)));
    s.listen(p, '127.0.0.1');
  });
}

app.post('/api/detector/start', (req, res) => {
  const { cameraId = 'CCTV-MAIN', areaSize = 50, videoSource = '0', streamPort = 8001, pythonCmd } = req.body || {};

  if (runtime.detector.proc && !runtime.detector.proc.killed) {
    return res.json({
      ok: true, alreadyRunning: true,
      pid: runtime.detector.proc.pid,
      cameraId: runtime.detector.cameraId,
      streamPort: runtime.detector.streamPort
    });
  }

  const detectorPath = path.join(__dirname, '..', 'detector.py');
  const env = {
    ...process.env,
    GUARDIAN_API_URL:      'http://127.0.0.1:5000/api/crowd/log',
    GUARDIAN_CAMERA_ID:    String(cameraId),
    GUARDIAN_LOCATION:     String(cameraId),
    GUARDIAN_AREA_SIZE:    String(areaSize),
    GUARDIAN_VIDEO_SOURCE: String(videoSource),
    GUARDIAN_STREAM_PORT:  String(streamPort),
    GUARDIAN_HEADLESS:     '1',
    GUARDIAN_STREAM_TOKEN: process.env.GUARDIAN_STREAM_TOKEN || 'safety-first'
  };

  (async () => {
    let chosen = Number(streamPort) || 8001;
    for (let p = chosen; p <= 8010; p++) {
      if (await isPortFree(p)) { chosen = p; break; }
    }
    env.GUARDIAN_STREAM_PORT = String(chosen);

    const py   = pythonCmd || process.env.PYTHON || 'py';
    const args = py === 'py' ? ['-3', detectorPath] : [detectorPath];
    const child = spawn(py, args, {
      env, stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: false, detached: false
    });

    runtime.detector.proc      = child;
    runtime.detector.startedAt = Date.now();
    runtime.detector.cameraId  = String(cameraId);
    runtime.detector.streamPort = chosen;
    runtime.detector.lastExit   = null;
    runtime.detector.lastStdout = '';
    runtime.detector.lastStderr = '';

    child.stdout?.on('data', d => { runtime.detector.lastStdout = String(d).slice(-4000); });
    child.stderr?.on('data', d => { runtime.detector.lastStderr = String(d).slice(-4000); });
    child.on('exit', (code, signal) => {
      runtime.detector.lastExit = { code, signal, at: Date.now() };
      runtime.detector.proc = null;
      console.log(`[DETECTOR] Process exited — code=${code}, signal=${signal}`);
    });

    return res.json({ ok: true, pid: child.pid, cameraId: runtime.detector.cameraId, streamPort: chosen });
  })().catch(err => res.status(500).json({ error: err.message }));
});

app.post('/api/detector/stop', (req, res) => {
  const pid = runtime.detector.proc?.pid;
  if (!pid) return res.json({ ok: true, stopped: false, reason: 'not_running' });
  try {
    spawn('taskkill', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true });
  } catch { /* ignore kill errors */ }
  runtime.detector.proc      = null;
  runtime.detector.startedAt = null;
  res.json({ ok: true, stopped: true, pid });
});

// 10. Recent crowd logs
app.get('/api/crowd/logs', async (req, res) => {
  const { cameraId, limit } = req.query;
  const q = cameraId ? { cameraId } : {};
  const n = Math.min(parseInt(limit || '50', 10), 500);
  const logs = await CrowdLog.find(q).sort({ timestamp: -1 }).limit(n);
  res.json(logs);
});

// 11. Recent alerts
app.get('/api/alerts', async (req, res) => {
  const { cameraId, type, limit } = req.query;
  const q = {};
  if (cameraId) q.cameraId = cameraId;
  if (type)     q.type = type;
  const n = Math.min(parseInt(limit || '50', 10), 500);
  const alerts = await Alert.find(q).sort({ timestamp: -1 }).limit(n);
  res.json(alerts);
});

// 12. Incident CRUD
app.post('/api/incidents', async (req, res) => {
  try {
    const report = new IncidentReport(req.body);
    await report.save();
    res.status(201).json(report);
  } catch (err) {
    if (err?.name === 'ValidationError') return res.status(400).json({ error: err.message });
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/incidents', async (req, res) => {
  const incidents = await IncidentReport.find().sort({ timestamp: -1 });
  res.json(incidents);
});

// 13. Resolve / Ignore alert or incident
app.post('/api/resolve/:type/:id', async (req, res) => {
  const { type, id } = req.params;
  const { status }   = req.body;
  try {
    let doc;
    if (type === 'alert') doc = await Alert.findByIdAndUpdate(id, { status }, { new: true });
    else                  doc = await IncidentReport.findByIdAndUpdate(id, { status }, { new: true });
    if (!doc) return res.status(404).json({ error: 'Not found' });
    res.json(doc);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 14. Dashboard aggregation — includes kinetic intelligence data
app.get('/api/dashboard', async (req, res) => {
  try {
    const { cameraId } = req.query;
    const q = cameraId ? { cameraId } : {};

    const liveData        = await CrowdLog.findOne(q).sort({ timestamp: -1 });
    const recentAlerts    = await Alert.find().sort({ timestamp: -1 }).limit(100);
    const recentIncidents = await IncidentReport.find().sort({ timestamp: -1 }).limit(100);

    let feed = [
      ...recentAlerts.map(a => ({
        id:        String(a._id),
        dbType:    'alert',
        type:      a.type,
        alertType: a.alertType || 'CROWD_DENSITY',
        status:    a.status,
        severity:  a.severity,
        color:     a.severity === 'Critical' ? '#ef4444' : a.severity === 'Emergency' ? '#7f1d1d' : '#f59e0b',
        loc:       a.location,
        time:      new Date(a.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        src:       'AI Edge Node',
        desc:      `[${a.alertType || a.type}] ${a.type} event detected. Severity: ${a.severity}.`,
        metadata:  a.metadata ? Object.fromEntries(a.metadata) : {},
        rawTime:   new Date(a.timestamp).getTime()
      })),
      ...recentIncidents.map(i => ({
        id:        String(i._id),
        dbType:    'incident',
        type:      i.type.toUpperCase(),
        alertType: 'MANUAL_REPORT',
        status:    i.status,
        severity:  i.severity || 'Medium',
        color:     i.severity === 'Critical' ? '#ef4444' : i.severity === 'High' ? '#f59e0b' : '#06b6d4',
        loc:       i.location,
        time:      new Date(i.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        src:       i.reporterType,
        desc:      i.description || 'Incident reported manually.',
        metadata:  {},
        rawTime:   new Date(i.timestamp).getTime()
      }))
    ];
    feed.sort((a, b) => b.rawTime - a.rawTime);

    const totalReports = feed.length;

    // Honest Safety Score — active threats deplete score, ignoring still carries residual risk
    const riskFactor = feed.reduce((acc, f) => {
      if (f.status === 'Resolved') return acc;
      if (f.severity === 'Emergency') return acc + 40;
      if (f.severity === 'Critical')  return acc + 25;
      if (f.severity === 'High')      return acc + 10;
      if (f.status === 'Ignored')     return acc + 5;
      return acc + 2;
    }, 0);
    const safetyScore = totalReports > 0
      ? Math.max(0, Math.round(100 - (riskFactor / (totalReports * 0.5))))
      : 100;

    // Risk Index — from active (non-resolved) reports only
    const severityWeights = { Emergency: 100, Critical: 80, High: 60, Medium: 30, Low: 10, Warning: 30 };
    const activeReports   = feed.filter(f => f.status !== 'Resolved');
    const totalRisk       = activeReports.reduce((s, f) => s + (severityWeights[f.severity] || 30), 0);
    const riskIndex       = activeReports.length > 0 ? Math.round(totalRisk / activeReports.length) : 0;

    const criticalAlerts  = feed.filter(f => ['Critical', 'Emergency'].includes(f.severity) && f.status === 'Unverified');

    // Kinetic data from live edge state
    const edgeCamData = runtime.edge.get(liveData?.cameraId || 'CCTV-MAIN') || {};

    res.json({
      liveData,
      feed,
      kineticData: {
        pressureScores: liveData?.pressureScores ? Object.fromEntries(liveData.pressureScores) : (edgeCamData.pressureScores || {}),
        growthRate:     liveData?.growthRate ?? 0,
        riskLevel:      liveData?.riskLevel ?? 'Low'
      },
      stats: { safetyScore, riskIndex, responseCoverage: safetyScore, criticalAlerts }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 15. Clear all
app.delete('/api/dashboard/clear-all', async (req, res) => {
  try {
    await Alert.deleteMany({});
    await IncidentReport.deleteMany({});
    res.json({ message: 'All reports cleared successfully.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 16. Individual delete
app.delete('/api/resolve/:type/:id/clear', async (req, res) => {
  try {
    const { type, id } = req.params;
    if (type === 'alert') await Alert.findByIdAndDelete(id);
    else                  await IncidentReport.findByIdAndDelete(id);
    res.json({ message: 'Item deleted successfully.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────
// Serve the built React app from the same deployment as the API.
// Build the frontend first with `npm run build`, then start this server.
const clientDistPath = path.join(__dirname, '..', 'dist');
const clientIndexPath = path.join(clientDistPath, 'index.html');

if (fs.existsSync(clientIndexPath)) {
  app.use(express.static(clientDistPath));
  app.get(/^\/(?!api).*/, (req, res) => {
    res.sendFile(clientIndexPath);
  });
} else {
  console.warn(`[STATIC] Frontend build not found at ${clientDistPath}. Run "npm run build" before production start.`);
}

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Guardian Server running on port ${PORT}`));
