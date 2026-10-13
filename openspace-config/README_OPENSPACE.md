# OpenSpace VR Setup & Open MCT Integration Guide

This guide explains how to run **OpenSpace** in Virtual Reality (via SteamVR) and link it directly to this **NASA Open MCT VR Mission Control** dashboard.

---

## 1. Prerequisites

1. **Virtual Reality Headset:**
   - Meta Quest 2 / 3 / Pro (via Quest Link, AirLink, or Virtual Desktop), HTC Vive, Valve Index, or any PC VR-compatible headset.
2. **SteamVR:**
   - Installed and running on your host machine.
3. **OpenSpace Engine:**
   - Download the latest OpenSpace release for Windows or Linux from [openspaceproject.com/download](https://www.openspaceproject.com/download).

---

## 2. Running OpenSpace in Virtual Reality Mode

OpenSpace has native **OpenVR / SteamVR** support built in.

### Step 1: Start SteamVR
Ensure your VR headset is tracking and SteamVR is in the "Ready" state.

### Step 2: Launch OpenSpace with the VR Flag
From your terminal or command prompt inside the OpenSpace folder:

* **Windows:**
  ```cmd
  OpenSpace.exe -vr
  ```
* **Linux:**
  ```bash
  ./OpenSpace -vr
  ```

*Alternatively*, in OpenSpace's main launcher window, select **VR (SteamVR)** under the configuration display options before clicking **Start**.

---

## 3. Connecting OpenSpace with Open MCT

OpenSpace includes an internal **WebSocket JSON Server** running by default on:
```
ws://localhost:4682/json
```

### If OpenSpace and Open MCT run on the same PC:
1. Start the Open MCT server:
   ```bash
   npm start
   ```
2. Start OpenSpace in VR (`OpenSpace.exe -vr`).
3. Open MCT automatically discovers OpenSpace on port 4682 and updates the top status badge to:
   `OPENSPACE VR: LINKED` (Green dot).

### If OpenSpace runs on a separate Windows VR PC and Open MCT runs on a Linux workstation:
You can tell Open MCT the IP address of your VR PC by passing the `host` parameter or updating `public/js/plugins/openspace-sync.js`:
```javascript
openmct.install(OpenSpaceSyncPlugin({
  host: '192.168.1.50', // Replace with your VR PC IP
  port: 4682
}));
```

---

## 4. Embedding Open MCT Inside OpenSpace VR

OpenSpace features a Chromium Embedded Framework (CEF) web engine. In VR mode, web interfaces can be attached to the user's VR controller (virtual tablet) or projected as an interactive 3D board:

1. Copy `openspace-config/openmct_vr_gui.asset` into your OpenSpace assets directory:
   ```
   OpenSpace/data/assets/custom/openmct_vr_gui.asset
   ```
2. In your active profile (e.g., `default.profile`), add:
   ```lua
   asset.require('custom/openmct_vr_gui')
   ```
3. When OpenSpace launches, point the CEF browser pane to:
   ```
   http://localhost:8080
   ```
4. In VR, use your controller trigger / laser-pointer to interact with the Open MCT plots, time conductor, and quick-action buttons.

---

## 5. Testing Without OpenSpace (Emulation Mode)

During development on laptops or machines without a VR headset connected:
* The included `server.js` automatically runs an **OpenSpace WebSocket Emulator** on port `4682`.
* You can test scrubbing time, triggering RCS thruster burns, and switching camera anchors directly in your browser. All Lua commands executed by Open MCT will be logged in the terminal!
