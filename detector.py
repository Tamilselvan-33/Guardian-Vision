import cv2
import requests
import time
import os
import json
import math
import threading
import numpy as np
import paho.mqtt.client as mqtt
import torch
from ultralytics import YOLO
from http.server import BaseHTTPRequestHandler, HTTPServer
from collections import deque
from typing import Tuple

# ─────────────────────────────────────────────
# 1. CONFIGURATION
# ─────────────────────────────────────────────
# Base directory for absolute path resolution
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
model_path = os.path.join(BASE_DIR, "yolo11n.pt")
model = YOLO(model_path)

API_URL        = os.getenv("GUARDIAN_API_URL",       "http://localhost:5000/api/crowd/log")
SOURCE         = os.getenv("GUARDIAN_VIDEO_SOURCE",  "1")
AREA_SIZE      = float(os.getenv("GUARDIAN_AREA_SIZE",   "50"))
CAMERA_ID      = os.getenv("GUARDIAN_CAMERA_ID",    "CCTV-MAIN")
LOCATION       = os.getenv("GUARDIAN_LOCATION",     CAMERA_ID)
STREAM_PORT    = int(os.getenv("GUARDIAN_STREAM_PORT",   "8001"))
HEADLESS       = os.getenv("GUARDIAN_HEADLESS",     "0") in ("1", "true", "TRUE", "yes", "YES")
STREAM_TOKEN   = os.getenv("GUARDIAN_STREAM_TOKEN", "safety-first")

# MQTT — Phase 4
MQTT_BROKER = os.getenv("GUARDIAN_MQTT_BROKER", "test.mosquitto.org")
MQTT_PORT   = int(os.getenv("GUARDIAN_MQTT_PORT", "1883"))
MQTT_TOPIC  = os.getenv("GUARDIAN_MQTT_TOPIC",  f"guardian/{CAMERA_ID}/alerts")

# Coerce SOURCE to int (webcam index) if possible
try:
    SOURCE = int(SOURCE)
except ValueError:
    pass  # Keep as string path

# ─────────────────────────────────────────────
# 2. MQTT CLIENT — with exponential backoff reconnection
# ─────────────────────────────────────────────
_mqtt_connected = False

def _on_mqtt_connect(client, userdata, flags, reason_code, properties):
    global _mqtt_connected
    if reason_code == 0:
        _mqtt_connected = True
        print("[MQTT] Connected to broker.")
    else:
        _mqtt_connected = False
        print(f"[MQTT] Connection refused: reason_code={reason_code}")

def _on_mqtt_disconnect(client, userdata, disconnect_flags, reason_code, properties):
    global _mqtt_connected
    _mqtt_connected = False
    print(f"[MQTT] Disconnected (reason={reason_code}). Watchdog will reconnect.")

mqtt_client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2)
mqtt_client.on_connect    = _on_mqtt_connect
mqtt_client.on_disconnect = _on_mqtt_disconnect

def _mqtt_watchdog():
    """Background thread: reconnects to MQTT broker with exponential backoff."""
    backoff = 5
    while True:
        if not _mqtt_connected:
            try:
                mqtt_client.connect(MQTT_BROKER, MQTT_PORT, 60)
                mqtt_client.loop_start()
                backoff = 5  # reset on success
            except Exception as e:
                print(f"[WATCHDOG] MQTT reconnect failed: {e}. Retrying in {backoff}s.")
                time.sleep(backoff)
                backoff = min(backoff * 2, 120)
        time.sleep(10)

threading.Thread(target=_mqtt_watchdog, daemon=True).start()

# ─────────────────────────────────────────────
# 3. RESILIENCY BUFFER — zero silent failures
# ─────────────────────────────────────────────
_api_buffer: deque = deque(maxlen=100)
_buffer_lock = threading.Lock()

def _resiliency_flush_worker():
    """Background thread: flushes locally buffered payloads when server is reachable."""
    while True:
        time.sleep(5)

        # Snapshot and clear buffer under lock, then release before making network calls
        with _buffer_lock:
            if not _api_buffer:
                continue
            to_send = list(_api_buffer)
            _api_buffer.clear()

        # Network calls happen OUTSIDE the lock to avoid blocking other threads
        failed = []
        for payload in to_send:
            try:
                requests.post(API_URL, json=payload, timeout=4)
            except Exception:
                failed.append(payload)

        # Re-queue failed items under lock
        if failed:
            with _buffer_lock:
                for item in reversed(failed):
                    _api_buffer.appendleft(item)

        sent = len(to_send) - len(failed)
        if sent > 0:
            print(f"[WATCHDOG] Flushed {sent} buffered record(s) to server.")
        if failed:
            print(f"[WATCHDOG] Server still unreachable. Re-queued {len(failed)} record(s) ({len(failed)}/100).")

threading.Thread(target=_resiliency_flush_worker, daemon=True).start()

# ─────────────────────────────────────────────
# 4. MJPEG STREAM SERVER — Authorization header auth
# ─────────────────────────────────────────────
_latest_jpeg = None
_jpeg_lock   = threading.Lock()

class _StreamHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path.startswith("/health"):
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            buffered = 0
            with _buffer_lock:
                buffered = len(_api_buffer)
            self.wfile.write(json.dumps({
                "ok": True,
                "mqttConnected": _mqtt_connected,
                "bufferedRecords": buffered
            }).encode())
            return

        if self.path.startswith("/frame.jpg"):
            with _jpeg_lock:
                jpg = _latest_jpeg
            if not jpg:
                self.send_response(204)
                self.end_headers()
                return
            self.send_response(200)
            self.send_header("Content-Type", "image/jpeg")
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(jpg)
            return

        if self.path.startswith("/stream"):
            # Security: token must be in Authorization header
            auth = self.headers.get("Authorization", "")
            expected = f"Bearer {STREAM_TOKEN}"
            # Also accept URL param for dashboard compatibility
            from urllib.parse import urlparse, parse_qs
            query  = parse_qs(urlparse(self.path).query)
            url_token = query.get("token", [None])[0]

            if auth != expected and url_token != STREAM_TOKEN:
                self.send_response(403)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(b'{"error":"Unauthorized: invalid or missing stream token"}')
                return

            self.send_response(200)
            self.send_header("Age", "0")
            self.send_header("Cache-Control", "no-cache, private")
            self.send_header("Pragma", "no-cache")
            self.send_header("Content-Type", "multipart/x-mixed-replace; boundary=frame")
            self.end_headers()
            try:
                while True:
                    with _jpeg_lock:
                        jpg = _latest_jpeg
                    if jpg:
                        self.wfile.write(b"--frame\r\n")
                        self.wfile.write(b"Content-Type: image/jpeg\r\n")
                        self.wfile.write(f"Content-Length: {len(jpg)}\r\n\r\n".encode())
                        self.wfile.write(jpg)
                        self.wfile.write(b"\r\n")
                    time.sleep(0.08)  # ~12 fps
            except Exception:
                return

        self.send_response(404)
        self.end_headers()

    def log_message(self, format, *args):
        return  # suppress default stdout logging

def _start_stream_server():
    httpd = HTTPServer(("0.0.0.0", STREAM_PORT), _StreamHandler)
    print(f"[STREAM] MJPEG server: http://127.0.0.1:{STREAM_PORT}/stream")
    httpd.serve_forever()

# ─────────────────────────────────────────────
# 5. SEVERITY ENGINE — Dynamic 4-tier calculation
# ─────────────────────────────────────────────
def _calculate_severity(count: int, threshold: int, pressure_score: float) -> Tuple[str, str]:
    """
    Returns (severity, alertType) based on count/threshold ratio and pressure score.
    Severity tiers: WATCH → WARNING → CRITICAL → EMERGENCY
    Alert types: CROWD_DENSITY | PRESSURE_SURGE | DIRECTIONAL_CONFLICT
    """
    ratio = count / max(threshold, 1)

    # Determine alert type based on what's driving the alert
    if pressure_score > 0.6:
        alert_type = "DIRECTIONAL_CONFLICT"
    elif pressure_score > 0.3:
        alert_type = "PRESSURE_SURGE"
    else:
        alert_type = "CROWD_DENSITY"

    # Determine severity
    if pressure_score > 0.9 or ratio > 2.0:
        severity = "EMERGENCY"
    elif pressure_score > 0.6 or ratio > 1.3:
        severity = "CRITICAL"
    elif pressure_score > 0.3 or ratio > 1.0:
        severity = "WARNING"
    else:
        severity = "WATCH"

    return severity, alert_type

# ─────────────────────────────────────────────
# 6. OPTICAL FLOW — Crowd Pressure & Velocity Engine
# ─────────────────────────────────────────────
def _compute_pressure_scores(
    prev_positions: dict,
    curr_positions: dict,
    zone_map: dict,
    zones: list
) -> dict:
    """
    Compute a pressure score per zone using Lucas-Kanade optical flow vectors.
    Pressure score = std deviation of velocity directions in the zone.
    High directional divergence = crowd friction = pre-stampede indicator.
    Returns dict: { "Zone 1": float, ... }
    """
    scores = {z: 0.0 for z in zones}
    zone_angles = {z: [] for z in zones}

    for track_id, curr_pos in curr_positions.items():
        if track_id not in prev_positions:
            continue
        px, py = prev_positions[track_id]
        cx, cy = curr_pos
        vx, vy = cx - px, cy - py
        speed = math.sqrt(vx**2 + vy**2)
        if speed < 1.0:  # ignore stationary detections
            continue
        angle = math.atan2(vy, vx)
        zone = zone_map.get(track_id)
        if zone:
            zone_angles[zone].append(angle)

    for z, angles in zone_angles.items():
        if len(angles) < 2:
            scores[z] = 0.0
            continue
        # Circular standard deviation of angles
        sin_sum = sum(math.sin(a) for a in angles)
        cos_sum = sum(math.cos(a) for a in angles)
        R = math.sqrt(sin_sum**2 + cos_sum**2) / len(angles)
        # R close to 1 = everyone moving same direction (safe)
        # R close to 0 = chaotic movement (dangerous)
        scores[z] = round(1.0 - R, 4)

    return scores

# ─────────────────────────────────────────────
# 7. MAIN DETECTION LOOP
# ─────────────────────────────────────────────
def start_detection():
    threading.Thread(target=_start_stream_server, daemon=True).start()

    # Normalize tracker path to file location (not CWD)
    tracker_path = os.path.join(BASE_DIR, "custom_tracker.yaml")

    # ── Robust Hardware Auto-Scanner ──
    cap = None
    active_source = SOURCE
    
    # Try the user-defined source first
    print(f"[HW] Testing primary source index {active_source}...")
    temp_cap = cv2.VideoCapture(active_source, cv2.CAP_DSHOW)
    if not temp_cap.isOpened():
        temp_cap = cv2.VideoCapture(active_source)
    
    if temp_cap.isOpened():
        cap = temp_cap
    else:
        # Auto-scan indices 0-5
        print("[HW] Primary source failed. Scanning hardware indices 0-5...")
        for i in range(6):
            if i == active_source: continue # already tried
            temp_cap = cv2.VideoCapture(i, cv2.CAP_DSHOW)
            if not temp_cap.isOpened():
                temp_cap = cv2.VideoCapture(i)
            
            if temp_cap.isOpened():
                print(f"[HW] Success! Found active camera on Index {i}.")
                cap = temp_cap
                active_source = i
                break
    
    print(f"[INIT] Guardian Vision — Stability Pivot active. Source={active_source}, Device=CPU")

    # Give the MJPEG server and camera hardware 2 seconds to stabilize before first ingest
    print("[INIT] System warming up (2s)...")
    time.sleep(2)

    zone_limits          = {"Zone 1": 10, "Zone 2": 10, "Zone 3": 10, "Zone 4": 10}
    zone_alert_timestamps = {"Zone 1": 0.0, "Zone 2": 0.0, "Zone 3": 0.0, "Zone 4": 0.0}
    last_api_update      = 0.0
    last_watchdog_log    = 0.0

    # Optical flow state
    prev_positions: dict = {}  # track_id -> (cx, cy) from last frame
    ZONES = list(zone_limits.keys())

    while cap.isOpened():
        success, frame = cap.read()
        if not success or frame is None:
            continue
        
        h, w = frame.shape[:2]
        cX, cY = w // 2, h // 2

        # ── Draw Zone Grid ──
        cv2.line(frame, (cX, 0), (cX, h), (0, 255, 255), 2)
        cv2.line(frame, (0, cY), (w, cY), (0, 255, 255), 2)
        for label, pos in [("Zone 1", (10, 30)), ("Zone 2", (cX+10, 30)),
                            ("Zone 3", (10, cY+30)), ("Zone 4", (cX+10, cY+30))]:
            cv2.putText(frame, label, pos, cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 255), 2)

        # ── Phase 2: CPU Stability Mode (i7-14th Gen Optimization) ──
        # GPU (sm_120) disabled to prevent Blackwell architecture crash
        inf_imgsz = 800  # High detail, high FPS on i7-14th
        inf_device = 'cpu'

        results = model.track(
            frame,
            classes=[0],
            persist=True,
            verbose=False,
            imgsz=inf_imgsz,
            conf=0.1,
            iou=0.45,
            tracker=tracker_path,
            device=inf_device
        )

        zone_counts   = {z: 0 for z in ZONES}
        curr_positions: dict = {}
        zone_map: dict = {}   # track_id -> zone
        unique_people  = 0

        if results[0].boxes.id is not None:
            boxes_n   = results[0].boxes.xyxyn.cpu().numpy()
            boxes_px  = results[0].boxes.xyxy.cpu().numpy()
            track_ids = results[0].boxes.id.int().cpu().tolist()
            unique_people = len(track_ids)

            for i in range(len(track_ids)):
                tid = track_ids[i]
                nx1, ny1, nx2, ny2 = boxes_n[i]
                x1, y1, x2, y2 = map(int, boxes_px[i])
                
                # Center point in normalized space
                ncx, ncy = (nx1 + nx2) / 2, (ny1 + ny2) / 2
                
                # Center point in pixel space for tracker
                cx, cy = (x1 + x2) // 2, (y1 + y2) // 2
                curr_positions[tid] = (cx, cy)

                # Zone classification (FIXED: Uses 0.5 threshold on normalized coords)
                if ncx <= 0.5 and ncy <= 0.5:   z = "Zone 1"
                elif ncx > 0.5 and ncy <= 0.5:  z = "Zone 2"
                elif ncx <= 0.5 and ncy > 0.5:  z = "Zone 3"
                else:                          z = "Zone 4"
                
                zone_counts[z] += 1
                zone_map[tid] = z

                # Visuals
                cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 255, 0), 2)
                cv2.putText(frame, f"ID {tid}", (x1, y1 - 10),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 1)
                cv2.circle(frame, (cx, cy), 4, (0, 255, 0), -1)

        # ── Phase 3: Depth-Aware Density (Perspective Heuristic) ──
        weighted_sum = 0.0
        if results[0].boxes.id is not None:
            for box in results[0].boxes.xyxy.cpu().numpy():
                bcy = (box[1] + box[3]) / 2
                # Objects near top of frame = far = higher density contribution
                weight = 1.0 + (1.0 - bcy / h) * 1.5
                weighted_sum += weight
        else:
            weighted_sum = float(unique_people)
        density = weighted_sum / AREA_SIZE

        # ── Phase 3+: Optical Flow Pressure Scores ──
        pressure_scores = _compute_pressure_scores(prev_positions, curr_positions, zone_map, ZONES)
        prev_positions = curr_positions.copy()

        # Annotate pressure on frame
        for z, score in pressure_scores.items():
            if score > 0.3:
                color = (0, 128, 255) if score < 0.6 else (0, 0, 255)
                label_pos = {
                    "Zone 1": (10, 55), "Zone 2": (cX+10, 55),
                    "Zone 3": (10, cY+55), "Zone 4": (cX+10, cY+55)
                }
                cv2.putText(frame, f"P:{score:.2f}", label_pos[z],
                            cv2.FONT_HERSHEY_SIMPLEX, 0.55, color, 2)

        # HUD overlay
        cv2.putText(frame,
            f"Tot:{unique_people} | Z1:{zone_counts['Zone 1']} Z2:{zone_counts['Zone 2']} "
            f"Z3:{zone_counts['Zone 3']} Z4:{zone_counts['Zone 4']}",
            (10, h - 20), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (0, 0, 255), 2)

        curr_time = time.time()

        # ── Phase 4: Dynamic Severity MQTT Alerts (Per-Zone, Throttled) ──
        for z, count in zone_counts.items():
            pressure = pressure_scores.get(z, 0.0)
            threshold = zone_limits[z]
            severity, alert_type = _calculate_severity(count, threshold, pressure)

            # Only fire if genuinely concerning (WARNING or above) and throttle per zone
            if severity in ("WARNING", "CRITICAL", "EMERGENCY") and \
               (curr_time - zone_alert_timestamps[z] > 10.0):
                # Update timestamp immediately to prevent log spam regardless of MQTT state
                zone_alert_timestamps[z] = curr_time
                try:
                    packet = {
                        "type":          "CROWD_ALERT",
                        "alertType":     alert_type,
                        "severity":      severity,
                        "cameraId":      CAMERA_ID,
                        "zone":          z,
                        "count":         count,
                        "threshold":     threshold,
                        "pressureScore": pressure,
                        "timestamp":     curr_time
                    }
                    if _mqtt_connected:
                        mqtt_client.publish(MQTT_TOPIC, json.dumps(packet))
                        print(f"[ALERT] {severity}/{alert_type} — {z} ({count}/{threshold}, P={pressure:.2f})")
                    else:
                        print(f"[ALERT] {severity}/{alert_type} — {z} (MQTT offline, buffered via API)")
                except Exception as e:
                    print(f"[ERROR] MQTT publish failed for {z}: {e}")

        # ── API Post with Resiliency Buffer ──
        if curr_time - last_api_update > 2.0:
            payload = {
                "cameraId":       CAMERA_ID,
                "location":       LOCATION,
                "peopleCount":    unique_people,
                "density":        round(density, 4),
                "zoneData":       zone_counts,
                "pressureScores": pressure_scores
            }
            try:
                requests.post(API_URL, json=payload, timeout=4)
                # Heartbeat — log failure, do not swallow silently
                try:
                    hb_url = API_URL.replace("/api/crowd/log", "/api/edge/heartbeat")
                    requests.post(hb_url, json={"cameraId": CAMERA_ID, "source": str(SOURCE)}, timeout=1)
                except Exception as hb_err:
                    print(f"[WARN] Heartbeat failed (non-critical): {hb_err}")
                print(f"[LOG] {unique_people} people | Zones: {zone_counts} | Pressure: {pressure_scores}")
                last_api_update = curr_time
            except Exception as e:
                # DO NOT PASS SILENTLY — buffer and log
                with _buffer_lock:
                    _api_buffer.append(payload)
                print(f"[BUFFER] Server unreachable ({e}). Queued locally ({len(_api_buffer)}/100).")

        # Periodic watchdog log
        if curr_time - last_watchdog_log > 30.0:
            with _buffer_lock:
                queued = len(_api_buffer)
            print(f"[WATCHDOG] Status — MQTT:{'CONNECTED' if _mqtt_connected else 'OFFLINE'} | "
                  f"Buffer:{queued}/100 | People:{unique_people} | Density:{density:.3f}")
            last_watchdog_log = curr_time

        # ── Encode & push frame to MJPEG server ──
        ok, buf = cv2.imencode(".jpg", frame, [int(cv2.IMWRITE_JPEG_QUALITY), 80])
        if ok:
            with _jpeg_lock:
                global _latest_jpeg
                _latest_jpeg = buf.tobytes()

        if not HEADLESS:
            cv2.imshow("Guardian Vision — 4-Phase Detection Engine", frame)
            if cv2.waitKey(1) & 0xFF == ord('q'):
                break

    cap.release()
    if not HEADLESS:
        cv2.destroyAllWindows()
    print("[EXIT] Detection loop ended.")

if __name__ == "__main__":
    print("=" * 60)
    print("  GUARDIAN VISION — 4-Phase AI Safety Engine")
    print(f"  Camera: {CAMERA_ID} | Source: {SOURCE} | Area: {AREA_SIZE}m²")
    print("=" * 60)
    start_detection()
