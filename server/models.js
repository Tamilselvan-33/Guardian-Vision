const mongoose = require('mongoose');

const CrowdLogSchema = new mongoose.Schema({
  cameraId:       { type: String, default: 'CCTV-MAIN' },
  location:       { type: String, default: 'CCTV-MAIN' },
  peopleCount:    { type: Number, required: true },
  density:        { type: Number, required: true },    // perspective-weighted people/m²
  zoneData:       { type: Map, of: Number },           // Phase 3 zone counts
  pressureScores: { type: Map, of: Number },           // Phase 3+ optical flow scores per zone
  growthRate:     { type: Number, default: 0 },        // delta-velocity: density/second change
  riskLevel:      { type: String, enum: ['Low', 'Medium', 'High'], default: 'Low' },
  timestamp:      { type: Date, default: Date.now }
});

const IncidentReportSchema = new mongoose.Schema({
  type:         { type: String, required: true },
  location:     { type: String, required: true },
  description:  { type: String },
  status:       { type: String, enum: ['Unverified', 'Verified', 'Resolved', 'Ignored', 'Medical'], default: 'Unverified' },
  reporterType: { type: String, enum: ['Civilian', 'Officer', 'AI Edge Node'], required: true },
  severity:     { type: String, enum: ['Low', 'Medium', 'High', 'Critical'], default: 'Medium' },
  timestamp:    { type: Date, default: Date.now }
});

const AlertSchema = new mongoose.Schema({
  type:       { type: String, required: true },  // SURGE, CLUSTER, VELOCITY_SURGE, PRESSURE_SURGE
  alertType:  { type: String, default: 'CROWD_DENSITY' }, // CROWD_DENSITY | PRESSURE_SURGE | DIRECTIONAL_CONFLICT | VELOCITY_SURGE
  location:   { type: String, required: true },
  cameraId:   { type: String, default: 'CCTV-MAIN' },
  severity:   { type: String, enum: ['Watch', 'Warning', 'Alert', 'Critical', 'Emergency'], required: true },
  status:     { type: String, enum: ['Unverified', 'Verified', 'Resolved', 'Ignored'], default: 'Unverified' },
  metadata:   { type: Map, of: mongoose.Schema.Types.Mixed }, // pressureScore, growthRate, zoneCount etc.
  timestamp:  { type: Date, default: Date.now }
});

const UserSchema = new mongoose.Schema({
  email:     { type: String, required: true, unique: true },
  password:  { type: String, required: true },
  role:      { type: String, default: 'Operator' },
  createdAt: { type: Date, default: Date.now }
});

module.exports = {
  CrowdLog:       mongoose.model('CrowdLog',       CrowdLogSchema),
  IncidentReport: mongoose.model('IncidentReport', IncidentReportSchema),
  Alert:          mongoose.model('Alert',          AlertSchema),
  User:           mongoose.model('User',           UserSchema)
};
