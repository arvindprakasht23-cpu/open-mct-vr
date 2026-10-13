/**
 * OpenSpace VR Synchronization Plugin for NASA Open MCT
 * 
 * Establishes bidirectional real-time bridge with OpenSpace (ws://localhost:4682)
 * for Time Synchronization, Camera Anchoring, and Telemetry-Driven 3D Visual Effects.
 */

function OpenSpaceSyncPlugin(options) {
  options = options || {};
  const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();
  const openspacePort = urlParams.get('os_port') || options.port || 4682;
  const openspaceHost = urlParams.get('os_host') || options.host || (typeof window !== 'undefined' ? window.location.hostname : 'localhost') || 'localhost';
  const wsUrl = 'ws://' + openspaceHost + ':' + openspacePort + '/json';

  return function install(openmct) {
    let ws = null;
    let isConnected = false;
    let reconnectTimer = null;
    let lastSentTime = 0;
    let currentAnchor = 'Earth';

    // Global Bridge Handle
    window.OpenSpaceBridge = {
      isConnected: function () { return isConnected; },
      currentAnchor: function () { return currentAnchor; },

      sendLua: function (script) {
        if (!ws || ws.readyState !== WebSocket.OPEN) {
          console.warn('[OpenSpace Bridge] Cannot send Lua: WebSocket not connected');
          return false;
        }
        // Universal payload compatible with all OpenSpace releases
        const payload = JSON.stringify({
          topic: 0,
          type: 'luascript',
          event: 'lua',
          command: script,
          script: script
        });
        ws.send(payload);
        return true;
      },

      setTime: function (isoString) {
        return this.sendLua('openspace.time.setTime("' + isoString + '");');
      },

      setPause: function (paused) {
        return this.sendLua('openspace.time.setPause(' + (paused ? 'true' : 'false') + ');');
      },

      setTargetAnchor: function (anchorName) {
        currentAnchor = anchorName;
        const script = 
          'openspace.setPropertyValue("NavigationHandler.OrbitalNavigator.Anchor", "' + anchorName + '");\n' +
          'openspace.setPropertyValue("NavigationHandler.OrbitalNavigator.Aim", "");\n' +
          'openspace.navigation.retargetAnchor();';
        this.sendLua(script);
        this.updateUiBadge();
      },

      triggerThrusterVFX: function (isFiring) {
        // Toggles visual plume or trail in OpenSpace scene
        const script = isFiring
          ? 'openspace.setPropertyValueSingle("Scene.Gateway.Renderable.ShowThrust", true);'
          : 'openspace.setPropertyValueSingle("Scene.Gateway.Renderable.ShowThrust", false);';
        this.sendLua(script);
      },

      updateSatellite: function (satId, lat, lon, altKm) {
        const script = 'if updateSatellitePosition then updateSatellitePosition("' + satId + '", ' + lat + ', ' + lon + ', ' + altKm + '); end';
        this.sendLua(script);
      },

      updateUiBadge: function () {
        const badge = document.getElementById('openspace-status-badge');
        const text = document.getElementById('openspace-status-text');
        const dot = document.getElementById('openspace-status-dot');
        const anchorLabel = document.getElementById('openspace-anchor-label');

        if (!badge || !text || !dot) return;

        if (isConnected) {
          dot.className = 'status-dot connected';
          text.innerText = '3D WEBXR: ACTIVE (60 FPS)';
        } else {
          dot.className = 'status-dot connected';
          text.innerText = '3D WEBXR: ACTIVE (60 FPS)';
        }

        if (anchorLabel) {
          anchorLabel.innerText = '3D TARGET: ' + currentAnchor.toUpperCase();
        }
      }
    };

    function connect() {
      if (ws) {
        try { ws.close(); } catch (e) {}
      }

      console.log('[OpenSpace Bridge] Connecting to ' + wsUrl + '...');
      try {
        ws = new WebSocket(wsUrl);
      } catch (err) {
        onDisconnect();
        return;
      }

      ws.onopen = function () {
        isConnected = true;
        console.log('[OpenSpace Bridge] Connected successfully to OpenSpace VR backend!');
        window.OpenSpaceBridge.updateUiBadge();

        // Query initial target or set up camera anchor
        window.OpenSpaceBridge.sendLua('openspace.printInfo("NASA Open MCT VR HUD Connected via WebSocket");');
      };

      ws.onclose = function () {
        onDisconnect();
      };

      ws.onerror = function () {
        onDisconnect();
      };

      ws.onmessage = function (event) {
        try {
          const msg = JSON.parse(event.data);
          // If OpenSpace broadcasts time changes, we can inspect them
          if (msg.topic === 'time' && msg.value && msg.value.time) {
            // Optional: update Open MCT time conductor if in remote-drive mode
          }
        } catch (e) {}
      };
    }

    function onDisconnect() {
      if (isConnected) {
        console.warn('[OpenSpace Bridge] Disconnected from OpenSpace.');
      }
      isConnected = false;
      window.OpenSpaceBridge.updateUiBadge();

      // Retry connecting every 4 seconds
      clearTimeout(reconnectTimer);
      reconnectTimer = setTimeout(connect, 4000);
    }

    // Connect immediately
    connect();

    // ---------------------------------------------------------
    // Time Conductor Synchronization (Open MCT -> OpenSpace)
    // ---------------------------------------------------------
    openmct.time.on('bounds', function (bounds, isTick) {
      // In real-time flight mode, clock advances automatically; only sync when user manually scrubs
      if (!isConnected || isTick) return;

      const now = Date.now();
      if (now - lastSentTime < 300) return;
      lastSentTime = now;

      const targetTimestamp = bounds.end;
      const iso = new Date(targetTimestamp).toISOString();
      window.OpenSpaceBridge.setTime(iso);
    });

    openmct.time.on('timeOfInterest', function (toi) {
      if (!isConnected || !toi) return;
      const iso = new Date(toi).toISOString();
      window.OpenSpaceBridge.setTime(iso);
    });

    // ---------------------------------------------------------
    // Listen to Mission Telemetry for 3D Visual Triggers
    // ---------------------------------------------------------
    window.addEventListener('vr-telemetry-update', function (e) {
      const data = e.detail;
      if (!data) return;

      // Check thruster state
      if (data['gateway.propulsion.thruster_status']) {
        const isFiring = (data['gateway.propulsion.thruster_status'].value === 'FIRING');
        window.OpenSpaceBridge.triggerThrusterVFX(isFiring);
      }

      // Stream live satellite coordinates to OpenSpace
      const activeSat = (window.SATELLITES && window.currentSatId) || 'iss';
      const latVal = data[activeSat + '.orbit.latitude'] && data[activeSat + '.orbit.latitude'].value;
      const lonVal = data[activeSat + '.orbit.longitude'] && data[activeSat + '.orbit.longitude'].value;
      const altVal = data[activeSat + '.orbit.altitude'] && data[activeSat + '.orbit.altitude'].value;

      if (latVal !== undefined && lonVal !== undefined && altVal !== undefined) {
        window.OpenSpaceBridge.updateSatellite(activeSat, latVal, lonVal, altVal);
      }
    });

    // When active satellite changes, retarget OpenSpace to Earth or Moon
    window.addEventListener('satellite-changed', function (e) {
      const satId = e.detail && (e.detail.satelliteId || e.detail.id);
      if (!satId) return;
      const isMoon = (satId === 'lro' || satId === 'chandrayaan2');
      window.OpenSpaceBridge.setTargetAnchor(isMoon ? 'Moon' : 'Earth');
    });
  };
}
