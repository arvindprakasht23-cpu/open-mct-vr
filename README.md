# NASA Open MCT + OpenSpace VR: Virtual Mission Control

An immersive **Virtual Reality Mission Control System** bridging **NASA Open MCT** (Open Mission Control Technologies) with the **OpenSpace 3D Engine**.

---

## 🚀 Overview

This project unites two powerful space software ecosystems into a unified VR operations interface:

* **NASA Open MCT (2D Mission Control):** Provides real-time and historical telemetry dashboards, subsystem plots, battery/altitude/propulsion gauges, and mission timeline scrubbing.
* **OpenSpace (3D Spatial Reality):** Renders celestial physics, real-time planetary terrain, and spacecraft trajectories inside a native SteamVR / OpenVR headset.
* **Bidirectional WebSocket Bridge:** Locks Open MCT's mission timeline directly with OpenSpace's celestial clock, routes camera framing commands, and translates telemetry anomalies into 3D visual triggers.

---

## 🛠️ Project Architecture

```
+-----------------------------------------------------------------------------------------+
|                                    NATIVE VR HEADSET                                    |
|                                                                                         |
|   +---------------------------------------+     +-----------------------------------+   |
|   |          OPENSPACE 3D ENGINE          |     |          OPEN MCT WEB HUD         |   |
|   |  - Real-time Celestial Physics (SPICE)|     |  - High-Contrast VR Dark Theme    |   |
|   |  - Ultra-high res Planetary Terrain   |     |  - Subsystem Health & Gauges      |   |
|   |  - Spacecraft Trajectory & Attitude   |     |  - Mission Timelines & Alarms     |   |
|   |  - SteamVR Controller Pointers        |     |  - Floating 3D Web View (CEF)     |   |
|   +---------------------------------------+     +-----------------------------------+   |
|                       ^                                       ^                         |
|                       |            Bidirectional Sync         |                         |
|                       +<=====================================>+                         |
|                                    WebSocket Bridge                             |
|                           - Time Conductor Sync (Lua commands)                          |
|                           - Camera Target Framing                                       |
|                           - Telemetry Anomaly Visual Triggers                           |
+-----------------------------------------------------------------------------------------+
```

---

## 🛰️ Simulated Mission: Artemis Lunar Gateway

The server streams live and historical telemetry for a simulated Lunar Gateway spacecraft:

| Subsystem | Telemetry Points | Units |
| :--- | :--- | :--- |
| **Orbital Mechanics** | Altitude, Orbital Velocity | `km`, `km/s` |
| **Electrical Power (EPS)** | Battery Level, Solar Array Power | `%`, `kW` |
| **Propulsion & Attitude** | Xenon Fuel, RCS Thruster State | `%`, `OFF/STANDBY/FIRING` |
| **Thermal Control (ATCS)** | Avionics Temp, Radiator Temp | `°C` |
| **Deep Space Comms** | Carrier Signal Margin, Downlink Rate | `dBm`, `Mbps` |

---

## ⚡ Quick Start

### 1. Install & Run the Open MCT VR Server

```bash
# Start the mission telemetry server and OpenSpace bridge
npm start
```

Open your browser to:
```
http://localhost:8080
```

### 2. Connect OpenSpace in Virtual Reality

1. Start SteamVR with your VR headset connected.
2. Launch OpenSpace with the VR flag:
   ```bash
   OpenSpace -vr
   ```
3. Open MCT will automatically detect OpenSpace on `ws://localhost:4682/json`. The top status badge will turn green: `OPENSPACE VR: LINKED`.

*(See [`openspace-config/README_OPENSPACE.md`](file:///home/stark/open_mct_vr/openspace-config/README_OPENSPACE.md) for full OpenSpace configuration details).*

---

## 🎮 VR Interaction Features

* **Time Conductor Synchronization:**
  * Scrub the Open MCT timeline forward or backward; OpenSpace's 3D celestial bodies and spacecraft immediately update in real-time.
* **Laser-Pointer Friendly Quick Actions:**
  * `🛰️ FOCUS GATEWAY`: Commands OpenSpace's camera to frame the spacecraft.
  * `🌕 FOCUS MOON`: Smoothly transitions camera anchor to the Moon.
  * `🌍 FOCUS EARTH`: Centers Earth in the VR field of view.
  * `🔥 RCS TEST BURN`: Triggers a simulated propulsion event, updating both Open MCT telemetry and visual thruster plume in OpenSpace.
  * `🥽 VR FULLSCREEN`: Optimizes the interface for head-mounted displays and Chromium Embedded Framework (CEF).

---

## 📂 File Structure

```
open_mct_vr/
├── package.json
├── server.js                      # Express server: Telemetry broadcaster & OpenSpace Mock Bridge
├── public/
│   ├── index.html                 # Main Mission Control VR HUD page
│   ├── css/
│   │   └── vr-hud.css             # High-contrast OLED styling for VR lenses
│   └── js/
│       ├── app.js                 # Open MCT bootstrap configuration
│       ├── telemetry-provider.js  # Open MCT plugin connecting to Gateway telemetry
│       └── plugins/
│           ├── openspace-sync.js  # Bidirectional WebSocket bridge with OpenSpace
│           └── vr-hud-overlay.js  # Controller & laser-pointer friendly buttons
└── openspace-config/
    ├── openmct_vr_gui.asset       # OpenSpace asset to embed Open MCT in 3D
    ├── openmct_bridge.lua         # Lua helper functions for OpenSpace
    └── README_OPENSPACE.md        # OpenSpace VR installation and runtime guide
```
