# Software Requirements Specification

## 1. Purpose

Guardian Vision provides real-time AI crowd intelligence for public safety teams. It detects people, estimates density, identifies zone-level risk, creates alerts, and supports incident response workflows.

## 2. Scope

The system covers:

- Edge video inference.
- Crowd telemetry ingestion.
- Alert generation.
- Operator dashboard.
- Incident management.
- Emergency protocol workflows.
- Cloud deployment readiness.

## 3. Users

- Safety operators.
- Event security teams.
- Smart-city command center staff.
- Airport, railway, stadium, and campus operations teams.
- Hackathon judges and technical evaluators.

## 4. Functional Requirements

| ID | Requirement |
| --- | --- |
| FR-01 | The detector shall detect people from webcam, video file, or camera stream. |
| FR-02 | The detector shall calculate total people count. |
| FR-03 | The detector shall divide frames into four zones. |
| FR-04 | The detector shall send crowd logs to the backend. |
| FR-05 | The backend shall persist crowd logs. |
| FR-06 | The backend shall generate density, cluster, velocity, and pressure alerts. |
| FR-07 | The dashboard shall show live crowd data. |
| FR-08 | Operators shall create manual incident reports. |
| FR-09 | Operators shall resolve, ignore, or clear reports. |
| FR-10 | The simulator shall generate demo crowd data. |

## 5. Non-Functional Requirements

| Category | Requirement |
| --- | --- |
| Security | Secrets must be stored outside source code. |
| Reliability | Backend shall expose `/api/health` for monitoring. |
| Performance | Dashboard APIs should limit recent records. |
| Maintainability | Docs must describe setup, deployment, and API usage. |
| Scalability | Architecture shall support multiple cameras. |
| Cost | Edge inference should be preferred over always-on cloud GPU. |

## 6. Assumptions

- Camera quality and angle affect detection accuracy.
- Crowd density estimates require calibration for production.
- Current authentication is demo-level and must be hardened before public use.

## 7. Acceptance Criteria

- Frontend builds successfully.
- Backend starts and connects to MongoDB.
- Detector can send logs to the backend.
- Dashboard displays live/simulated crowd data.
- Alerts appear when thresholds are breached.
- Documentation supports local and AWS deployment.

