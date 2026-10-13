/**
 * NASA Open MCT VR Mission Control Server
 * Real-Time Multi-Satellite Tracking & SGP4 Orbital Mechanics Engine
 * Tracking Earth & Lunar Satellites in Real Time
 */

const express = require('express');
const http = require('http');
const https = require('https');
const fs = require('fs');
const os = require('os');
const path = require('path');
const WebSocket = require('ws');

const APP_PORT = process.env.PORT || 8080;
const HTTPS_PORT = process.env.HTTPS_PORT || 8443;
const OPENSPACE_WS_PORT = process.env.OPENSPACE_PORT || 4682;

const app = express();
const server = http.createServer(app);

// HTTPS Server for WebXR HMD (Meta Quest, Pico, Vision Pro)
let httpsServer = null;
const certPath = path.join(__dirname, 'certs/cert.pem');
const keyPath = path.join(__dirname, 'certs/key.pem');
if (fs.existsSync(certPath) && fs.existsSync(keyPath)) {
  try {
    const sslOptions = {
      key: fs.readFileSync(keyPath),
      cert: fs.readFileSync(certPath)
    };
    httpsServer = https.createServer(sslOptions, app);
  } catch (err) {
    console.warn('[HTTPS] Could not start SSL server:', err.message);
  }
}

// Static assets
app.use('/openmct-dist', express.static(path.join(__dirname, 'node_modules/openmct/dist')));
app.use('/three', express.static(path.join(__dirname, 'node_modules/three')));
app.use('/satellite-dist', express.static(path.join(__dirname, 'node_modules/satellite.js/dist')));
app.use(express.static(path.join(__dirname, 'public')));

// Network IP Discovery API for Meta Quest Headsets
app.get('/api/network-info', (req, res) => {
  const interfaces = os.networkInterfaces();
  const ips = [];
  for (const name of Object.keys(interfaces)) {
    for (const net of interfaces[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        ips.push(net.address);
      }
    }
  }
  res.json({
    localIps: ips,
    httpPort: APP_PORT,
    httpsPort: HTTPS_PORT,
    questHttpsUrl: ips.length > 0 ? `https://${ips[0]}:${HTTPS_PORT}` : `https://localhost:${HTTPS_PORT}`,
    questHttpUrl: ips.length > 0 ? `http://${ips[0]}:${APP_PORT}` : `http://localhost:${APP_PORT}`
  });
});

// -------------------------------------------------------------
// 1. Satellite Constellation Catalog (Earth & Moon)
// -------------------------------------------------------------
const SATELLITE_CATALOG = {
  // === EARTH ORBIT SATELLITES ===
  'iss': {
    id: 'iss',
    name: 'International Space Station (ISS)',
    norad: 25544,
    body: 'earth',
    type: 'Space Station / Microgravity Lab',
    operator: 'NASA / Roscosmos / ESA / JAXA / CSA',
    crew: 7,
    tle1: '1 25544U 98067A   26285.50000000  .00016717  00000-0  30000-3 0  9991',
    tle2: '2 25544  51.6430 120.4500 0006500  75.2000 285.1000 15.49815000450000',
    color: '#38bdf8',
    description: 'Continuously inhabited orbital research complex in Low Earth Orbit (LEO).'
  },
  'hst': {
    id: 'hst',
    name: 'Hubble Space Telescope (HST)',
    norad: 20580,
    body: 'earth',
    type: 'Space Observatory',
    operator: 'NASA / ESA',
    crew: 0,
    tle1: '1 20580U 90037B   26285.50000000  .00001000  00000-0  50000-4 0  9992',
    tle2: '2 20580  28.4690  85.3200 0002800 110.1500 250.0500 15.08500000950000',
    color: '#a855f7',
    description: 'Astronomical observatory in LEO with 2.4-meter primary mirror observing UV, optical, and NIR.'
  },
  'starlink': {
    id: 'starlink',
    name: 'Starlink-G4 Constellation (NORAD #49850)',
    norad: 49850,
    body: 'earth',
    type: 'Communications Mega-Constellation',
    operator: 'SpaceX',
    crew: 0,
    tle1: '1 49850U 21115A   26285.50000000  .00002500  00000-0  12000-3 0  9993',
    tle2: '2 49850  53.2180 145.2000 0001500  65.4000 294.7000 15.05600000120000',
    color: '#22c55e',
    description: 'Low-latency global broadband constellation with laser optical cross-links.'
  },
  'tiangong': {
    id: 'tiangong',
    name: 'Tiangong Space Station (CSS)',
    norad: 48274,
    body: 'earth',
    type: 'Space Station',
    operator: 'CMSA (China)',
    crew: 3,
    tle1: '1 48274U 21035A   26285.50000000  .00021500  00000-0  34000-3 0  9994',
    tle2: '2 48274  41.4720 102.5000 0004200  80.1500 280.2000 15.61200000210000',
    color: '#f59e0b',
    description: 'Permanent modular space station operating in low Earth orbit with Tianhe core module.'
  },
  'noaa20': {
    id: 'noaa20',
    name: 'NOAA-20 / JPSS-1 Weather Satellite',
    norad: 43013,
    body: 'earth',
    type: 'Polar Meteorological Satellite',
    operator: 'NOAA / NASA',
    crew: 0,
    tle1: '1 43013U 17073A   26285.50000000  .00000050  00000-0  35000-4 0  9995',
    tle2: '2 43013  98.7150  45.1200 0001200  95.4000 264.8000 14.19500000250000',
    color: '#06b6d4',
    description: 'Sun-synchronous polar orbiter monitoring global climate and severe storms.'
  },

  // === MOON ORBIT SATELLITES ===
  'lro': {
    id: 'lro',
    name: 'Lunar Reconnaissance Orbiter (LRO)',
    norad: 35311,
    body: 'moon',
    type: 'Lunar Exploration Orbiter',
    operator: 'NASA Goddard',
    crew: 0,
    alt_base: 65.0,
    eccentricity: 0.038,
    inclination: 89.9,
    period_min: 113.8,
    color: '#eab308',
    description: 'Robotic spacecraft in polar orbit around the Moon mapping lunar topography & water-ice.'
  },
  'chandrayaan2': {
    id: 'chandrayaan2',
    name: 'Chandrayaan-2 Lunar Orbiter',
    norad: 44441,
    body: 'moon',
    type: 'Lunar Science Orbiter',
    operator: 'ISRO (India)',
    crew: 0,
    alt_base: 100.0,
    eccentricity: 0.005,
    inclination: 90.0,
    period_min: 119.0,
    color: '#f97316',
    description: 'High-resolution lunar orbiter conducting 3D surface mapping and volatile detection.'
  },

  // === MORE EARTH ORBIT SATELLITES ===
  'jwst': {
    id: 'jwst',
    name: 'James Webb Space Telescope (JWST)',
    norad: 50463,
    body: 'earth',
    type: 'Deep-Space Observatory (L2 Halo)',
    operator: 'NASA / ESA / CSA',
    crew: 0,
    tle1: '1 50463U 21130A   26285.50000000  .00000012  00000-0  00000+0 0  9996',
    tle2: '2 50463   0.0000 316.5200 0002900 189.4200 218.4200  0.99690000 17200',
    color: '#e879f9',
    description: 'Infrared space observatory at Sun-Earth L2, imaging the first galaxies and exoplanet atmospheres.'
  },
  'terra': {
    id: 'terra',
    name: 'Terra Earth Observer (EOS-AM1)',
    norad: 25994,
    body: 'earth',
    type: 'Earth Science Satellite',
    operator: 'NASA',
    crew: 0,
    tle1: '1 25994U 99068A   26285.50000000  .00000030  00000-0  30000-4 0  9997',
    tle2: '2 25994  98.2010 296.4100 0001200  90.3000 269.8500 14.57120000100000',
    color: '#34d399',
    description: 'Sun-synchronous Earth-monitoring satellite with MODIS instrument for climate & land surface studies.'
  },
  'gps-iir': {
    id: 'gps-iir',
    name: 'GPS Block IIR-M Satellite (PRN-11)',
    norad: 29486,
    body: 'earth',
    type: 'Navigation Satellite (MEO)',
    operator: 'US Space Force',
    crew: 0,
    tle1: '1 29486U 06042A   26285.50000000  .00000020  00000-0  00000-0 0  9998',
    tle2: '2 29486  55.0340 280.1200 0138500 205.4000 153.8000  2.00563000145000',
    color: '#fbbf24',
    description: 'GPS Block IIR-M navigation satellite in Medium Earth Orbit providing global positioning accuracy.'
  }
};

// -------------------------------------------------------------
// 2. Telemetry Dictionary Metadata
// -------------------------------------------------------------
const TELEMETRY_POINTS = {};
const SUBSYSTEMS = [];

Object.values(SATELLITE_CATALOG).forEach(sat => {
  const prefix = sat.id;
  const isMoon = sat.body === 'moon';
  const pointsList = [];

  // Altitude
  const altKey = `${prefix}.orbit.altitude`;
  TELEMETRY_POINTS[altKey] = {
    name: `${sat.name} - ${isMoon ? 'Lunar Altitude' : 'Orbital Altitude'}`,
    units: 'km',
    min: isMoon ? 40 : 300,
    max: isMoon ? 150 : 900,
    format: (v) => parseFloat(v).toFixed(2)
  };
  pointsList.push(altKey);

  // Velocity km/s
  const velKmsKey = `${prefix}.orbit.velocity_kms`;
  TELEMETRY_POINTS[velKmsKey] = {
    name: `${sat.name} - Velocity (km/s)`,
    units: 'km/s',
    min: isMoon ? 1.4 : 7.0,
    max: isMoon ? 1.8 : 8.0,
    format: (v) => parseFloat(v).toFixed(3)
  };
  pointsList.push(velKmsKey);

  // Velocity km/h
  const velKmhKey = `${prefix}.orbit.velocity_kmh`;
  TELEMETRY_POINTS[velKmhKey] = {
    name: `${sat.name} - Speed (km/h)`,
    units: 'km/h',
    min: isMoon ? 5000 : 25000,
    max: isMoon ? 6500 : 29000,
    format: (v) => parseFloat(v).toFixed(1)
  };
  pointsList.push(velKmhKey);

  // Latitude
  const latKey = `${prefix}.orbit.latitude`;
  TELEMETRY_POINTS[latKey] = {
    name: `${sat.name} - ${isMoon ? 'Selenographic Latitude' : 'Sub-Satellite Latitude'}`,
    units: '°',
    min: -90,
    max: 90,
    format: (v) => parseFloat(v).toFixed(4)
  };
  pointsList.push(latKey);

  // Longitude
  const lonKey = `${prefix}.orbit.longitude`;
  TELEMETRY_POINTS[lonKey] = {
    name: `${sat.name} - ${isMoon ? 'Selenographic Longitude' : 'Sub-Satellite Longitude'}`,
    units: '°',
    min: -180,
    max: 180,
    format: (v) => parseFloat(v).toFixed(4)
  };
  pointsList.push(lonKey);

  // Solar state
  const solarKey = `${prefix}.solar.visibility`;
  TELEMETRY_POINTS[solarKey] = {
    name: `${sat.name} - Solar Illumination State`,
    units: 'state',
    values: ['DAYLIGHT', 'ECLIPSED'],
    isDiscrete: true
  };
  pointsList.push(solarKey);

  // Craft specific
  if (sat.id === 'iss') {
    const crewKey = `${prefix}.crew.count`;
    TELEMETRY_POINTS[crewKey] = {
      name: `${sat.name} - Astronaut Crew Count`,
      units: 'crew',
      min: 0,
      max: 12,
      format: (v) => parseInt(v)
    };
    pointsList.push(crewKey);
  } else if (sat.id === 'lro') {
    const lolaKey = `${prefix}.instrument.lola_range`;
    TELEMETRY_POINTS[lolaKey] = {
      name: `${sat.name} - LOLA Laser Altimeter Range`,
      units: 'm',
      min: 40000,
      max: 120000,
      format: (v) => parseFloat(v).toFixed(1)
    };
    pointsList.push(lolaKey);
  }

  SUBSYSTEMS.push({
    id: `${prefix}.telemetry`,
    name: `${isMoon ? '🌕 MOON' : '🌍 EARTH'}: ${sat.name}`,
    body: sat.body,
    points: pointsList
  });
});

// Telemetry History Buffer
const history = {};
Object.keys(TELEMETRY_POINTS).forEach(id => {
  history[id] = [];
});

function recordPoint(id, timestamp, val) {
  const datum = {
    id: id,
    timestamp: timestamp,
    utc: timestamp,
    value: val
  };
  if (!history[id]) history[id] = [];
  history[id].push(datum);
  if (history[id].length > 4000) {
    history[id].shift();
  }
  return datum;
}

// -------------------------------------------------------------
// 3. Real-Time SGP4 & Lunar Propagation Engine
// -------------------------------------------------------------
let satelliteLib = null;
const satrecs = {};

async function initPropagator() {
  satelliteLib = await import('satellite.js');
  console.log('[Orbital Engine] satellite.js SGP4 initialized successfully.');

  // Initialize satellite records for Earth orbiters
  Object.values(SATELLITE_CATALOG).forEach(sat => {
    if (sat.tle1 && sat.tle2) {
      satrecs[sat.id] = satelliteLib.twoline2satrec(sat.tle1, sat.tle2);
    }
  });

  // Pre-seed 30 minutes of real-time historical data so charts have full curves immediately
  preloadAllHistory();
}

/**
 * Propagate Earth satellite at a given Date
 */
function propagateEarthSat(sat, date) {
  const satrec = satrecs[sat.id];
  if (!satrec || !satelliteLib) return null;

  try {
    const pv = satelliteLib.propagate(satrec, date);
    if (!pv || !pv.position || !pv.velocity) return null;

    const gmst = satelliteLib.gstime(date);
    const gd = satelliteLib.eciToGeodetic(pv.position, gmst);
    const vKms = Math.hypot(pv.velocity.x, pv.velocity.y, pv.velocity.z);
    const vKmh = vKms * 3600;
    const lat = satelliteLib.degreesLat(gd.latitude);
    const lon = satelliteLib.degreesLong(gd.longitude);
    const alt = gd.height;

    // Check daylight / eclipse (simple solar angle)
    const sunAngle = (date.getTime() / 1000 / 86400 * Math.PI * 2) % (Math.PI * 2);
    const satAngle = (lon * Math.PI / 180);
    const isDaylight = Math.cos(satAngle - sunAngle) > -0.2;

    const rEarth = 6371;
    const footprint = rEarth * Math.acos(rEarth / (rEarth + alt));

    return {
      altitude: parseFloat(alt.toFixed(2)),
      velocity_kms: parseFloat(vKms.toFixed(3)),
      velocity_kmh: parseFloat(vKmh.toFixed(1)),
      latitude: parseFloat(lat.toFixed(4)),
      longitude: parseFloat(lon.toFixed(4)),
      footprint: parseFloat(footprint.toFixed(1)),
      visibility: isDaylight ? 'DAYLIGHT' : 'ECLIPSED'
    };
  } catch (err) {
    return null;
  }
}

/**
 * Propagate Moon satellite at a given Date using lunar celestial mechanics
 */
function propagateMoonSat(sat, date) {
  const tSec = date.getTime() / 1000;
  const n = (2 * Math.PI) / (sat.period_min * 60);
  const M = (n * tSec) % (2 * Math.PI);
  const r_moon = 1737.4;
  const a = r_moon + sat.alt_base;
  const r = a * (1 - sat.eccentricity * Math.cos(M));
  const alt = r - r_moon;
  const v_moon = Math.sqrt(4902.8 * (2 / r - 1 / a));
  const vKmh = v_moon * 3600;

  // Polar lunar orbit projection
  const lat = Math.sin(M) * (sat.inclination === 90 ? 89.9 : sat.inclination);
  const lunarRotationRateDegPerHour = 360 / (27.32166 * 24); // 0.549 deg/hr
  const lon = (((tSec / 3600) * (360 / (sat.period_min / 60) - lunarRotationRateDegPerHour)) % 360) - 180;

  const isDaylight = Math.sin(M + tSec * 0.0001) > -0.25;

  return {
    altitude: parseFloat(alt.toFixed(2)),
    velocity_kms: parseFloat(v_moon.toFixed(3)),
    velocity_kmh: parseFloat(vKmh.toFixed(1)),
    latitude: parseFloat(lat.toFixed(4)),
    longitude: parseFloat(lon.toFixed(4)),
    footprint: parseFloat((r_moon * 0.45).toFixed(1)),
    visibility: isDaylight ? 'DAYLIGHT' : 'ECLIPSED',
    lola_range: parseFloat((alt * 1000).toFixed(1))
  };
}

/**
 * Calculate telemetry for any satellite at any given date
 */
function getSatelliteTelemetryAt(satId, date) {
  const sat = SATELLITE_CATALOG[satId];
  if (!sat) return null;

  if (sat.body === 'earth') {
    return propagateEarthSat(sat, date);
  } else {
    return propagateMoonSat(sat, date);
  }
}

/**
 * Preload 30 minutes of history for all satellites so Open MCT charts start with rich curves
 */
function preloadAllHistory() {
  console.log('[Orbital Engine] Pre-generating genuine orbital trajectories for all satellites...');
  const nowMs = Date.now();
  const stepMs = 30 * 1000; // 30 sec resolution
  const pointsCount = 60; // 30 minutes

  for (let i = pointsCount; i >= 0; i--) {
    const t = nowMs - (i * stepMs);
    const date = new Date(t);

    Object.values(SATELLITE_CATALOG).forEach(sat => {
      const state = getSatelliteTelemetryAt(sat.id, date);
      if (!state) return;

      const prefix = sat.id;
      recordPoint(`${prefix}.orbit.altitude`, t, state.altitude);
      recordPoint(`${prefix}.orbit.velocity_kms`, t, state.velocity_kms);
      recordPoint(`${prefix}.orbit.velocity_kmh`, t, state.velocity_kmh);
      recordPoint(`${prefix}.orbit.latitude`, t, state.latitude);
      recordPoint(`${prefix}.orbit.longitude`, t, state.longitude);
      recordPoint(`${prefix}.solar.visibility`, t, state.visibility);

      if (sat.id === 'iss') {
        recordPoint(`${prefix}.crew.count`, t, sat.crew);
      } else if (sat.id === 'lro') {
        recordPoint(`${prefix}.instrument.lola_range`, t, state.lola_range);
      }
    });
  }
  console.log('[Orbital Engine] History populated across Earth and Moon fleets.');
}

// -------------------------------------------------------------
// 4. WebSocket Broadcast Loop (1 Hz Real-Time Streaming)
const wssTelemetry = new WebSocket.Server({ noServer: true });

server.on('upgrade', (request, socket, head) => {
  try {
    const { pathname } = new URL(request.url, `http://${request.headers.host}`);
    if (pathname === '/telemetry') {
      wssTelemetry.handleUpgrade(request, socket, head, (ws) => {
        wssTelemetry.emit('connection', ws, request);
      });
    }
  } catch (e) {}
});

if (httpsServer) {
  httpsServer.on('upgrade', (request, socket, head) => {
    try {
      const { pathname } = new URL(request.url, `https://${request.headers.host}`);
      if (pathname === '/telemetry') {
        wssTelemetry.handleUpgrade(request, socket, head, (ws) => {
          wssTelemetry.emit('connection', ws, request);
        });
      }
    } catch (e) {}
  });
}
const telemetrySubscriptions = new Set();
let primaryActiveSatellite = 'iss';

wssTelemetry.on('connection', (ws) => {
  telemetrySubscriptions.add(ws);
  console.log('[Telemetry Stream] Client connected. Active clients:', telemetrySubscriptions.size);

  // Send initial state & catalog
  ws.send(JSON.stringify({
    type: 'initial_state',
    catalog: SATELLITE_CATALOG,
    activeSatellite: primaryActiveSatellite,
    timestamp: Date.now()
  }));

  ws.on('message', (msg) => {
    try {
      const data = JSON.parse(msg.toString());
      if (data.action === 'select_satellite' && SATELLITE_CATALOG[data.satelliteId]) {
        primaryActiveSatellite = data.satelliteId;
        console.log(`[Telemetry Stream] Primary satellite changed to: ${primaryActiveSatellite}`);
        broadcastToClients({
          type: 'satellite_selected',
          satelliteId: primaryActiveSatellite,
          satellite: SATELLITE_CATALOG[primaryActiveSatellite],
          timestamp: Date.now()
        });
      }
    } catch (e) {}
  });

  ws.on('close', () => {
    telemetrySubscriptions.delete(ws);
  });
});

function broadcastToClients(payload) {
  const jsonStr = JSON.stringify(payload);
  for (const client of telemetrySubscriptions) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(jsonStr);
    }
  }
}

// 1 Hz Real-Time Physics Broadcast
setInterval(() => {
  if (!satelliteLib) return;

  const now = new Date();
  const timestamp = now.getTime();
  const currentBatch = {};
  const currentFleetState = {};

  Object.values(SATELLITE_CATALOG).forEach(sat => {
    const state = getSatelliteTelemetryAt(sat.id, now);
    if (!state) return;

    currentFleetState[sat.id] = state;

    const prefix = sat.id;
    currentBatch[`${prefix}.orbit.altitude`] = recordPoint(`${prefix}.orbit.altitude`, timestamp, state.altitude);
    currentBatch[`${prefix}.orbit.velocity_kms`] = recordPoint(`${prefix}.orbit.velocity_kms`, timestamp, state.velocity_kms);
    currentBatch[`${prefix}.orbit.velocity_kmh`] = recordPoint(`${prefix}.orbit.velocity_kmh`, timestamp, state.velocity_kmh);
    currentBatch[`${prefix}.orbit.latitude`] = recordPoint(`${prefix}.orbit.latitude`, timestamp, state.latitude);
    currentBatch[`${prefix}.orbit.longitude`] = recordPoint(`${prefix}.orbit.longitude`, timestamp, state.longitude);
    currentBatch[`${prefix}.solar.visibility`] = recordPoint(`${prefix}.solar.visibility`, timestamp, state.visibility);

    if (sat.id === 'iss') {
      currentBatch[`${prefix}.crew.count`] = recordPoint(`${prefix}.crew.count`, timestamp, sat.crew);
    } else if (sat.id === 'lro') {
      currentBatch[`${prefix}.instrument.lola_range`] = recordPoint(`${prefix}.instrument.lola_range`, timestamp, state.lola_range);
    }
  });

  // Broadcast to Open MCT & VR scene
  broadcastToClients({
    type: 'telemetry_batch',
    timestamp,
    primarySatellite: primaryActiveSatellite,
    fleet: currentFleetState,
    data: currentBatch
  });
}, 1000);

// -------------------------------------------------------------
// 5. REST Endpoints for Open MCT & VR Scene
// -------------------------------------------------------------
app.get('/api/satellites', (req, res) => {
  const now = new Date();
  const result = Object.values(SATELLITE_CATALOG).map(sat => {
    const state = getSatelliteTelemetryAt(sat.id, now);
    return {
      ...sat,
      currentState: state
    };
  });
  res.json({
    active: primaryActiveSatellite,
    satellites: result
  });
});

app.get('/api/dictionary', (req, res) => {
  res.json({
    subsystems: SUBSYSTEMS,
    points: TELEMETRY_POINTS,
    satellites: SATELLITE_CATALOG
  });
});

app.get('/api/history/:pointId', (req, res) => {
  const pointId = req.params.pointId;
  const start = parseInt(req.query.start) || (Date.now() - 1800000);
  const end = parseInt(req.query.end) || Date.now();

  // If in-memory history has data, filter it
  const series = history[pointId] || [];
  let filtered = series.filter(p => p.timestamp >= start && p.timestamp <= end);

  // If filtered is empty or sparse, dynamically calculate exact physics points
  if (filtered.length < 5 && satelliteLib) {
    const satId = pointId.split('.')[0];
    const metric = pointId.split('.')[2] || pointId.split('.')[1];
    const sat = SATELLITE_CATALOG[satId];

    if (sat) {
      filtered = [];
      const interval = Math.max(10000, Math.floor((end - start) / 40));
      for (let t = start; t <= end; t += interval) {
        const state = getSatelliteTelemetryAt(satId, new Date(t));
        if (state) {
          let val = state[metric];
          if (metric === 'altitude') val = state.altitude;
          else if (metric === 'velocity_kms') val = state.velocity_kms;
          else if (metric === 'velocity_kmh') val = state.velocity_kmh;
          else if (metric === 'latitude') val = state.latitude;
          else if (metric === 'longitude') val = state.longitude;
          else if (metric === 'visibility') val = state.visibility;
          else if (metric === 'count' && sat.id === 'iss') val = sat.crew;
          else if (metric === 'lola_range' && sat.id === 'lro') val = state.lola_range;

          if (val !== undefined) {
            filtered.push({
              id: pointId,
              timestamp: t,
              utc: t,
              value: val
            });
          }
        }
      }
    }
  }

  res.json(filtered);
});

// -------------------------------------------------------------
// 6. OpenSpace WebSocket Bridge / Smart Proxy
// -------------------------------------------------------------
let mockOpenSpaceServer = null;
if (process.env.DISABLE_MOCK_OPENSPACE !== 'true') {
  try {
    mockOpenSpaceServer = new WebSocket.Server({ port: OPENSPACE_WS_PORT });
    mockOpenSpaceServer.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.log(`[OpenSpace Bridge] Real OpenSpace is active on port ${OPENSPACE_WS_PORT}. Internal mock yielded.`);
    } else {
      console.warn(`[OpenSpace Bridge] WebSocket notice: ${err.message}`);
    }
  });

  console.log(`[OpenSpace Bridge/Emulator] Listening on ws://localhost:${OPENSPACE_WS_PORT}`);

  let simulatedOpenSpaceTime = new Date().toISOString();
  let isPaused = false;
  let currentAnchor = 'Earth';

  mockOpenSpaceServer.on('connection', (ws) => {
    console.log('[OpenSpace Bridge] Connected to OpenSpace sync client');

    ws.send(JSON.stringify({
      topic: 'time',
      type: 'time',
      value: {
        time: simulatedOpenSpaceTime,
        paused: isPaused
      }
    }));

    ws.on('message', (msg) => {
      try {
        const payload = JSON.parse(msg.toString());
        if (payload.event === 'lua' || payload.type === 'luascript' || payload.function) {
          const command = payload.command || payload.script || '';

          if (command.includes('openspace.time.setTime')) {
            const match = command.match(/setTime\(['"]([^'"]+)['"]\)/);
            if (match) simulatedOpenSpaceTime = match[1];
          }
          if (command.includes('OrbitalNavigator.Anchor')) {
            const match = command.match(/Anchor',\s*['"]([^'"]+)['"]/);
            if (match) currentAnchor = match[1];
            console.log(`  -> OpenSpace camera anchored to: ${currentAnchor}`);
          }

          ws.send(JSON.stringify({
            status: 'ok',
            echoCommand: command,
            simulatedAnchor: currentAnchor,
            timestamp: Date.now()
          }));
        }
      } catch (err) {}
    });
  });
  } catch (e) {
    console.log(`[OpenSpace Bridge] Port ${OPENSPACE_WS_PORT} note: ${e.message}`);
  }
}



// Start server
server.listen(APP_PORT, async () => {
  await initPropagator();
  const interfaces = os.networkInterfaces();
  const ips = [];
  for (const name of Object.keys(interfaces)) {
    for (const net of interfaces[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        ips.push(net.address);
      }
    }
  }
  const lanIp = ips[0] || 'localhost';

  console.log(`================================================================`);
  console.log(`  NASA Open MCT Multi-Satellite VR Mission Control`);
  console.log(`  Desktop Browser       : http://localhost:${APP_PORT}`);
  console.log(`  Meta Quest / HMD HTTPS: https://${lanIp}:${HTTPS_PORT}`);
  console.log(`  Local Network HTTP    : http://${lanIp}:${APP_PORT}`);
  console.log(`  Earth Orbit Fleet     : ISS, Hubble, Starlink, Tiangong, NOAA-20`);
  console.log(`  Lunar Orbit Fleet     : LRO (Lunar Reconnaissance Orbiter), Chandrayaan-2`);
  console.log(`  SGP4 Physics Engine   : Active (Real-Time 1 Hz Propagation)`);
  console.log(`================================================================`);
});

if (httpsServer) {
  httpsServer.listen(HTTPS_PORT, () => {
    console.log(`[HTTPS Server] Meta Quest WebXR endpoint active on port ${HTTPS_PORT}`);
  });
}
