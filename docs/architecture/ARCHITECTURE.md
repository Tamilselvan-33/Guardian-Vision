# Guardian Vision Architecture

## High-Level Architecture

Guardian Vision has three major runtime surfaces:

- **Frontend dashboard**: React/Vite operator UI.
- **Backend API**: Express service that stores logs, creates alerts, and aggregates dashboard data.
- **Edge detector**: Python YOLO process that performs local video inference.

```mermaid
flowchart TB
  subgraph Edge["Edge Site"]
    Camera["CCTV / Webcam / IP Camera"]
    Detector["detector.py - YOLO + Tracking"]
  end

  subgraph CloudOrLocal["Backend Runtime"]
    API["Express API"]
    Sim["Demo Simulator"]
    AlertEngine["Alert Engine"]
    DB[("MongoDB Compatible Database")]
  end

  subgraph UI["Operator Console"]
    Web["React Dashboard"]
    Emergency["Emergency Protocol"]
  end

  Camera --> Detector
  Detector -->|crowd log| API
  Detector -->|heartbeat| API
  Sim --> API
  API --> DB
  API --> AlertEngine
  Web --> API
  Emergency --> API
```

## Low-Level Design

### Frontend

- `src/App.jsx`: route definitions and basic route protection.
- `src/pages/Dashboard.jsx`: primary command center and action workflow.
- `src/pages/Incidents.jsx`: incident management.
- `src/pages/Analytics.jsx`: chart-based analytics.
- `src/pages/Docs.jsx`: camera/demo documentation surface.
- `src/pages/EmergencyProtocol.jsx`: emergency response workflow.
- `src/lib/api.js`: API fetch wrapper and base URL handling.

### Backend

- `server/index.js`: Express app, runtime state, routes, simulator, detector process control.
- `server/models.js`: Mongoose schemas.

### AI Detector

- `detector.py`: video capture, YOLO inference, centroid tracking, zone assignment, backend reporting.

## Data Flow

```mermaid
sequenceDiagram
  participant Camera
  participant Detector
  participant API
  participant DB
  participant Dashboard

  Camera->>Detector: Video frames
  Detector->>Detector: YOLO person detection
  Detector->>Detector: Centroid tracking and zone mapping
  Detector->>API: POST /api/crowd/log
  API->>DB: Save CrowdLog
  API->>DB: Save Alert if threshold breached
  Dashboard->>API: GET /api/dashboard
  API->>DB: Fetch latest logs, alerts, incidents
  API->>Dashboard: Live risk intelligence
```

## Database Schema

```mermaid
erDiagram
  CrowdLog {
    string cameraId
    string location
    number peopleCount
    number density
    map zoneData
    map pressureScores
    number growthRate
    string riskLevel
    date timestamp
  }

  Alert {
    string type
    string alertType
    string location
    string cameraId
    string severity
    string status
    map metadata
    date timestamp
  }

  IncidentReport {
    string type
    string location
    string description
    string status
    string reporterType
    string severity
    date timestamp
  }

  User {
    string email
    string password
    string role
    date createdAt
  }
```

## Deployment Diagram

```mermaid
flowchart LR
  User["Operator Browser"] --> CF["CloudFront"]
  CF --> S3["S3 Frontend Bucket"]
  User --> ALB["Application Load Balancer"]
  ALB --> ECS["ECS Fargate Backend"]
  ECS --> DB[("DocumentDB / MongoDB Atlas")]
  ECS --> CW["CloudWatch Logs"]
  ECS --> SM["Secrets Manager / SSM"]
  Detector["Edge Detector"] --> ALB
```

## Production Notes

- Keep the detector near the camera source for lower latency and lower cloud cost.
- Use the backend as the source of truth for alerts and incidents.
- Add indexes on `timestamp`, `cameraId`, `status`, and `severity`.
- Replace demo auth before production use.

