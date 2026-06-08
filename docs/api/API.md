# API Documentation

Base URL locally:

```text
http://127.0.0.1:5000
```

## Health

### `GET /api/health`

Returns API health, MongoDB readiness, uptime, and timestamp.

## Auth

### `POST /api/auth/login`

Request:

```json
{
  "email": "admin@example.com",
  "password": "password"
}
```

Returns a demo token and user object. Production deployments should replace this with hashed passwords and signed JWT or secure sessions.

### `POST /api/auth/signup`

Creates an operator user.

## Crowd Logs

### `POST /api/crowd/log`

Request:

```json
{
  "cameraId": "CCTV-MAIN",
  "location": "Gate A",
  "peopleCount": 38,
  "density": 0.76,
  "zoneData": {
    "Zone 1": 10,
    "Zone 2": 12,
    "Zone 3": 8,
    "Zone 4": 8
  },
  "pressureScores": {
    "Zone 1": 0.42,
    "Zone 2": 0.81
  }
}
```

Creates a crowd log and may create alerts.

### `GET /api/crowd/logs?cameraId=CCTV-MAIN&limit=50`

Returns recent crowd logs.

## Dashboard

### `GET /api/dashboard?cameraId=CCTV-MAIN`

Returns:

- latest live data
- alert and incident feed
- kinetic data
- safety score
- risk index
- critical alerts

### `DELETE /api/dashboard/clear-all`

Clears alerts and incidents. Restrict this in production.

## Incidents

### `POST /api/incidents`

Creates a manual incident report.

### `GET /api/incidents`

Returns recent incident reports.

## Alerts

### `GET /api/alerts?cameraId=CCTV-MAIN&type=PRESSURE_SURGE&limit=50`

Returns recent alerts.

### `POST /api/resolve/:type/:id`

Updates report status. `type` is `alert` or `incident`.

Request:

```json
{
  "status": "Resolved"
}
```

### `DELETE /api/resolve/:type/:id/clear`

Deletes one alert or incident.

## Edge

### `POST /api/edge/heartbeat`

Records detector availability.

### `GET /api/edge/status?cameraId=CCTV-MAIN`

Returns edge node online/offline state.

### `GET /api/cameras`

Returns known edge cameras.

## Simulator

### `POST /api/sim/start`

Starts demo data generation.

### `POST /api/sim/stop`

Stops demo data generation.

### `GET /api/sim/status`

Returns simulator state.

## Detector Process

### `POST /api/detector/start`

Starts local Python detector from the backend host.

### `POST /api/detector/stop`

Stops local Python detector process.

### `GET /api/detector/status`

Returns detector process state.

