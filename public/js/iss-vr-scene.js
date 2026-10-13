/**
 * NASA Open MCT Multi-Satellite VR Space Engine
 * Photorealistic 3D Earth, Moon, Scaled Spacecraft Models & High-Contrast Holographic HUD
 * Tracking Real-Time Earth & Lunar Satellites
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { VRButton } from 'three/addons/webxr/VRButton.js';

// Scene Globals
let scene, camera, renderer, controls;
let earthGroup, earthMesh, cloudsMesh, atmosphereMesh;
let moonGroup, moonMesh, moonOrbitLine;
let craftGroup, craftModelMesh, orbitLine, subSatPointer, groundTargetRing;
let hudPlane1, hudTexture1, hudCanvas1, hudCtx1;
let hudPlane2, hudTexture2, hudCanvas2, hudCtx2;
let vrPopCard, vrPopTexture, vrPopCanvas, vrPopCtx;
let sunLight, sunPointLight, sunMesh, sunCoronaMesh;
let mercuryGroup, mercuryMesh;
let venusGroup, venusMesh;
let marsGroup, marsMesh, phobosMesh, deimosMesh;
let asteroidBeltGroup, asteroidBeltPoints, asteroidInstancedMesh;
let jupiterGroup, jupiterMesh, ioMesh, europaMesh, ganymedeMesh, callistoMesh;
let saturnGroup, saturnMesh, saturnRingsMesh, titanMesh;
let uranusGroup, uranusMesh, uranusRingsMesh;
let neptuneGroup, neptuneMesh, tritonMesh;
let currentFocusBody = 'craft';

// ============================================================================
// HELIOCENTRIC SOLAR SYSTEM ARCHITECTURE & KEPLERIAN ELLIPTICAL ORBITS
// ============================================================================
// Sun is the gravitational center at (0, 0, 0)
const SUN_POSITION = new THREE.Vector3(0, 0, 0);
const SUN_RADIUS = 55.0; // Scaled so it is visibly grand without dwarfing orbits

// Elliptical Keplerian Orbit Parameters (a: semi-major axis, e: eccentricity, omega: periapsis angle)
// Focus distance c = a * e, semi-minor axis b = a * sqrt(1 - e^2)
//
// ══ NASA-ACCURATE ECCENTRICITIES ══
//   Mercury 0.2056 | Venus 0.0068 | Earth 0.0167 | Mars 0.0934
//   Jupiter 0.0484 | Saturn 0.0539 | Uranus 0.0473 | Neptune 0.0086
//
// Scene semi-major axes use compressed log spacing so orbits are
// visually distinct and non-overlapping, inspired by NASA orrery diagrams.
const ORBIT_PARAMS = {
  mercury: { a: 130.0,  e: 0.2056, r: 4.5,  speed: 0.048,  color: 0x94a3b8, name: 'Mercury', omega: 0.508 },
  venus:   { a: 220.0,  e: 0.0068, r: 12.0, speed: 0.035,  color: 0xfde047, name: 'Venus',   omega: 2.296 },
  earth:   { a: 310.0,  e: 0.0167, r: 14.0, speed: 0.030,  color: 0x38bdf8, name: 'Earth',   omega: 1.796 },
  mars:    { a: 410.0,  e: 0.0934, r: 7.4,  speed: 0.024,  color: 0xf87171, name: 'Mars',    omega: 5.001 },
  jupiter: { a: 980.0,  e: 0.0484, r: 28.0, speed: 0.013,  color: 0xfbbf24, name: 'Jupiter', omega: 4.779 },
  saturn:  { a: 1320.0, e: 0.0539, r: 22.0, speed: 0.0096, color: 0xfacc15, name: 'Saturn',  omega: 5.970 },
  uranus:  { a: 1680.0, e: 0.0473, r: 17.0, speed: 0.0068, color: 0x67e8f9, name: 'Uranus',  omega: 1.698 },
  neptune: { a: 2040.0, e: 0.0086, r: 16.5, speed: 0.0048, color: 0x38bdf8, name: 'Neptune', omega: 0.78 }
};

// Current orbital anomalies (angles around the ellipse)
const planetAngles = {
  mercury: 0.4,
  venus: 1.8,
  earth: 0.0,
  mars: 2.4,
  jupiter: -1.0,
  saturn: -2.5,
  uranus: 3.1,
  neptune: 1.2
};

// Calculate Keplerian orbital position with Sun at focal point (0, 0, 0)
function getKeplerianPos(key, theta) {
  const p = ORBIT_PARAMS[key];
  const b = p.a * Math.sqrt(1 - p.e * p.e);
  const c = p.a * p.e; // focus distance
  const x0 = p.a * Math.cos(theta) - c;
  const z0 = b * Math.sin(theta);
  const omega = p.omega || 0;
  return new THREE.Vector3(
    x0 * Math.cos(omega) - z0 * Math.sin(omega),
    0,
    x0 * Math.sin(omega) + z0 * Math.cos(omega)
  );
}

const mercuryPos = getKeplerianPos('mercury', planetAngles.mercury);
const venusPos = getKeplerianPos('venus', planetAngles.venus);
const earthPos = getKeplerianPos('earth', planetAngles.earth);
const moonPos = new THREE.Vector3().copy(earthPos).add(new THREE.Vector3(36, 0, 0));
const marsPos = getKeplerianPos('mars', planetAngles.mars);
const jupiterPos = getKeplerianPos('jupiter', planetAngles.jupiter);
const saturnPos = getKeplerianPos('saturn', planetAngles.saturn);
const uranusPos = getKeplerianPos('uranus', planetAngles.uranus);
const neptunePos = getKeplerianPos('neptune', planetAngles.neptune);

// Backward-compatible position aliases
const MOON_POSITION = moonPos;
const MARS_POSITION = marsPos;
const JUPITER_POSITION = jupiterPos;
const SATURN_POSITION = saturnPos;
const NEPTUNE_POSITION = neptunePos;

// Backward-compatible radius constants
const EARTH_RADIUS = ORBIT_PARAMS.earth.r;
const MOON_RADIUS = 3.8;
const MARS_RADIUS = ORBIT_PARAMS.mars.r;
const JUPITER_RADIUS = ORBIT_PARAMS.jupiter.r;
const SATURN_RADIUS = ORBIT_PARAMS.saturn.r;
const URANUS_RADIUS = ORBIT_PARAMS.uranus.r;
const NEPTUNE_RADIUS = ORBIT_PARAMS.neptune.r;

// Satellite Fleet Catalog
const SATELLITES = {
  iss: {
    id: 'iss',
    name: 'International Space Station (ISS)',
    body: 'earth',
    norad: '25544',
    inclination: 51.64,
    color: '#38bdf8',
    altScale: 2.2,
    speed: '7.66 km/s'
  },
  hst: {
    id: 'hst',
    name: 'Hubble Space Telescope (HST)',
    body: 'earth',
    norad: '20580',
    inclination: 28.47,
    color: '#c084fc',
    altScale: 2.9,
    speed: '7.59 km/s'
  },
  starlink: {
    id: 'starlink',
    name: 'Starlink-G4-1 (NORAD #49850)',
    body: 'earth',
    norad: '49850',
    inclination: 53.22,
    color: '#4ade80',
    altScale: 3.0,
    speed: '7.59 km/s'
  },
  tiangong: {
    id: 'tiangong',
    name: 'Tiangong Space Station (CSS)',
    body: 'earth',
    norad: '48274',
    inclination: 41.47,
    color: '#fbbf24',
    altScale: 2.0,
    speed: '7.68 km/s'
  },
  noaa20: {
    id: 'noaa20',
    name: 'NOAA-20 Polar Weather',
    body: 'earth',
    norad: '43013',
    inclination: 98.71,
    color: '#22d3ee',
    altScale: 4.2,
    speed: '7.44 km/s'
  },
  jwst: {
    id: 'jwst',
    name: 'James Webb Space Telescope (JWST)',
    body: 'earth',
    norad: '50463',
    inclination: 0.0,
    color: '#e879f9',
    altScale: 6.5,
    speed: '0.20 km/s'
  },
  terra: {
    id: 'terra',
    name: 'Terra Earth Observer (EOS-AM1)',
    body: 'earth',
    norad: '25994',
    inclination: 98.2,
    color: '#34d399',
    altScale: 3.5,
    speed: '7.50 km/s'
  },
  'gps-iir': {
    id: 'gps-iir',
    name: 'GPS Block IIR-M (PRN-11)',
    body: 'earth',
    norad: '29486',
    inclination: 55.0,
    color: '#38bdf8',
    altScale: 5.0,
    speed: '3.87 km/s'
  },
  lro: {
    id: 'lro',
    name: 'Lunar Reconnaissance Orbiter (LRO)',
    body: 'moon',
    norad: '35311',
    inclination: 89.9,
    color: '#facc15',
    altScale: 1.1,
    speed: '1.60 km/s'
  },
  chandrayaan2: {
    id: 'chandrayaan2',
    name: 'Chandrayaan-2 Lunar Orbiter',
    body: 'moon',
    norad: '44441',
    inclination: 90.0,
    color: '#fb923c',
    altScale: 1.4,
    speed: '1.63 km/s'
  }
};

let currentSatId = 'iss';
let targetCameraPos = new THREE.Vector3(earthPos.x + 28, earthPos.y + 10, earthPos.z + 36);
let targetLookAt = new THREE.Vector3(earthPos.x, earthPos.y, earthPos.z);
let isTransitioningCamera = false;
let isTrackingCraft = false;
let cameraRig = null;
let controller1 = null;
let controller2 = null;

// Current Real-Time Telemetry State
let activeTelemetry = {
  altitude: 419.2,
  velocity_kms: 7.665,
  velocity_kmh: 27594,
  latitude: 51.24,
  longitude: 14.85,
  visibility: 'DAYLIGHT',
  footprint: 4520,
  extra: 'Crew: 7 Onboard',
  body: 'earth',
  timestamp: Date.now()
};

// Texture Loader
const textureLoader = new THREE.TextureLoader();

export function initIssVrScene(container) {
  // 1. Three.js Scene & Camera
  scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x02040a, 0.0004);

  camera = new THREE.PerspectiveCamera(48, window.innerWidth / window.innerHeight, 0.1, 8000);
  camera.position.copy(targetCameraPos);

  // 2. WebGL Renderer with WebXR
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.3;
  renderer.xr.enabled = true;
  container.appendChild(renderer.domElement);

  // Camera Rig for WebXR 6-DoF Headsets (Meta Quest, Pico, Vision Pro)
  cameraRig = new THREE.Group();
  scene.add(cameraRig);
  cameraRig.add(camera);

  // WebXR 6-DoF Controllers with Laser Pointers
  controller1 = renderer.xr.getController(0);
  controller1.addEventListener('select', onVRControllerSelect);
  controller1.addEventListener('squeeze', onVRControllerSqueeze);
  cameraRig.add(controller1);

  controller2 = renderer.xr.getController(1);
  controller2.addEventListener('select', onVRControllerSelect);
  controller2.addEventListener('squeeze', onVRControllerSqueeze);
  cameraRig.add(controller2);

  const laserGeo = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0, 0, -4)
  ]);
  const laserMat = new THREE.LineBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.85 });
  controller1.add(new THREE.Line(laserGeo, laserMat));
  controller2.add(new THREE.Line(laserGeo, laserMat.clone()));

  // When entering WebXR VR, position camera rig near spacecraft and spawn sleek pop display
  renderer.xr.addEventListener('sessionstart', () => {
    console.log('[WebXR] Entered Immersive VR session on HMD!');
    if (cameraRig && craftGroup) {
      cameraRig.position.copy(craftGroup.position).add(new THREE.Vector3(2.5, 0.8, 3.2));
      cameraRig.lookAt(craftGroup.position);
    }
    // Remove the dual bulky 3D tablets
    if (hudPlane1) {
      hudPlane1.visible = false;
      if (hudPlane1.parent) hudPlane1.parent.remove(hudPlane1);
    }
    if (hudPlane2) {
      hudPlane2.visible = false;
      if (hudPlane2.parent) hudPlane2.parent.remove(hudPlane2);
    }
    // Attach single sleek pop display (exact replica of website HUD card)
    if (vrPopCard) {
      vrPopCard.visible = true;
      cameraRig.add(vrPopCard);
      drawVrPopCard();
    }
  });

  renderer.xr.addEventListener('sessionend', () => {
    console.log('[WebXR] Exited Immersive VR session');
    if (hudPlane1) hudPlane1.visible = false;
    if (hudPlane2) hudPlane2.visible = false;
    if (vrPopCard) {
      vrPopCard.visible = false;
      if (vrPopCard.parent) vrPopCard.parent.remove(vrPopCard);
    }
  });

  // WebXR Enter VR Button with DOM Overlay so the website HUD and UI overlay cleanly
  const vrButton = VRButton.createButton(renderer, {
    optionalFeatures: ['dom-overlay'],
    domOverlay: { root: document.body }
  });
  vrButton.id = 'webxr-enter-btn';
  vrButton.style.position = 'fixed';
  vrButton.style.bottom = '75px';
  vrButton.style.left = '50%';
  vrButton.style.transform = 'translateX(-50%)';
  vrButton.style.zIndex = '10001';
  vrButton.style.background = 'linear-gradient(135deg, #0284c7, #2563eb)';
  vrButton.style.border = '1px solid #38bdf8';
  vrButton.style.boxShadow = '0 0 20px rgba(56, 189, 248, 0.6)';
  vrButton.style.fontFamily = "'Chakra Petch', sans-serif";
  vrButton.style.fontWeight = '700';
  vrButton.style.borderRadius = '8px';
  vrButton.style.padding = '10px 24px';
  container.appendChild(vrButton);

  // 3. Orbit Controls with Free Rotation (Bug fixed: never snaps back on mouse release!)
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.maxDistance = 5000;
  controls.minDistance = 3.0;
  controls.target.copy(targetLookAt);
  camera.lookAt(targetLookAt);

  // Crucial: when user touches/drags mouse, cancel any camera transition so they have 100% free rotation!
  controls.addEventListener('start', () => {
    isTransitioningCamera = false;
    isTrackingCraft = false;
  });

  // 4. Space Lighting (Brilliant Golden Sun at Grand Distance)
  const ambientLight = new THREE.AmbientLight(0x1e293b, 1.2);
  scene.add(ambientLight);

  createPhotorealisticSun();

  // 5. Deep Space Starfield
  createStarfield();

  // 6. Photorealistic Celestial Bodies (Mercury, Venus, Earth, Moon, Mars, Asteroids, Jupiter, Saturn, Uranus & Orbits)
  createMercury();
  createVenus();
  createPhotorealisticEarth();
  createPhotorealisticMoon();
  createMars();
  createAsteroidBelt();
  createJupiter();
  createSaturn();
  createUranus();
  createNeptune();
  createPlanetaryOrbits();

  // 7. Spacecraft Rig & Orbit
  craftGroup = new THREE.Group();
  scene.add(craftGroup);

  // Dedicated inspection lights attached to craftGroup so the spacecraft is always beautifully visible!
  const craftLight1 = new THREE.DirectionalLight(0xffffff, 2.5);
  craftLight1.position.set(5, 6, 8);
  craftGroup.add(craftLight1);

  const craftLight2 = new THREE.DirectionalLight(0x93c5fd, 1.4);
  craftLight2.position.set(-6, -4, -6);
  craftGroup.add(craftLight2);

  createOrbitTrajectory();
  createGroundTrackPointer();
  buildCraft3DModel(currentSatId);

  // 8. VR Mission Control Pop Display (Mirrors Website HUD Card)
  createVrPopCard();

  // 9. Interactive 3D Click / Tap Raycaster
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();
  let pointerDownPos = { x: 0, y: 0 };
  let pointerDownTime = 0;

  renderer.domElement.addEventListener('pointerdown', (e) => {
    pointerDownPos = { x: e.clientX, y: e.clientY };
    pointerDownTime = performance.now();
  });

  renderer.domElement.addEventListener('pointerup', (e) => {
    const dist = Math.hypot(e.clientX - pointerDownPos.x, e.clientY - pointerDownPos.y);
    const time = performance.now() - pointerDownTime;
    if (dist < 8 && time < 400) {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);

      // Check spacecraft and sub-satellite target ring — PRIORITY click target!
      if (craftGroup) {
        // Expand raycaster for easier satellite click on small model
        raycaster.params.Points = { threshold: 12 };
        raycaster.params.Line = { threshold: 4 };
        const hits = raycaster.intersectObjects([craftGroup, groundTargetRing].filter(Boolean), true);
        if (hits.length > 0) {
          focusCraftView();
          // Fire satellite-3d-clicked so the HUD card pops up!
          window.dispatchEvent(new CustomEvent('satellite-3d-clicked', {
            detail: { satelliteId: currentSatId }
          }));
          return;
        }
      }

      // Check celestial bodies
      const bodyTargets = [
        { obj: earthMesh, fn: focusEarthView },
        { obj: moonMesh, fn: focusMoonView },
        { obj: marsMesh, fn: focusMarsView },
        { obj: jupiterMesh, fn: focusJupiterView },
        { obj: saturnMesh, fn: focusSaturnView },
        { obj: uranusMesh, fn: focusUranusView },
        { obj: neptuneMesh, fn: focusNeptuneView },
        { obj: mercuryMesh, fn: focusMercuryView },
        { obj: venusMesh, fn: focusVenusView },
        { obj: sunMesh, fn: focusSunView },
        { obj: asteroidInstancedMesh, fn: focusAsteroidsView }
      ];

      for (const target of bodyTargets) {
        if (target.obj) {
          const hits = raycaster.intersectObject(target.obj, true);
          if (hits.length > 0) {
            target.fn();
            return;
          }
        }
      }
    }
  });

  // Window Resize
  window.addEventListener('resize', onWindowResize);

  // Telemetry updates from WebSocket
  window.addEventListener('vr-telemetry-update', onTelemetryMessage);

  // Main Render Loop
  renderer.setAnimationLoop(render);

  console.log('[VR Engine] Space Engine 3D Initialized with Scaled Planets & Smooth Controls.');
}

/**
 * Deep Space Starfield
 */
function createStarfield() {
  const starsCount = 5500;
  const starGeo = new THREE.BufferGeometry();
  const starPos = new Float32Array(starsCount * 3);
  const starColors = new Float32Array(starsCount * 3);

  for (let i = 0; i < starsCount * 3; i += 3) {
    const radius = 1200 + Math.random() * 1200;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);

    starPos[i] = radius * Math.sin(phi) * Math.cos(theta);
    starPos[i + 1] = radius * Math.sin(phi) * Math.sin(theta);
    starPos[i + 2] = radius * Math.cos(phi);

    const tint = Math.random();
    if (tint > 0.8) {
      starColors[i] = 0.85; starColors[i + 1] = 0.92; starColors[i + 2] = 1.0;
    } else if (tint > 0.4) {
      starColors[i] = 1.0; starColors[i + 1] = 1.0; starColors[i + 2] = 0.96;
    } else {
      starColors[i] = 1.0; starColors[i + 1] = 0.88; starColors[i + 2] = 0.72;
    }
  }

  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  starGeo.setAttribute('color', new THREE.BufferAttribute(starColors, 3));

  const starMat = new THREE.PointsMaterial({
    size: 2.4,
    vertexColors: true,
    transparent: true,
    opacity: 0.95
  });

  scene.add(new THREE.Points(starGeo, starMat));
}

/**
 * Photorealistic Planet Earth (Enlarged, Minimal Delicate Clouds)
 */
function createPhotorealisticEarth() {
  earthGroup = new THREE.Group();
  earthGroup.position.copy(earthPos);
  earthGroup.rotation.z = THREE.MathUtils.degToRad(23.44); // True axial tilt

  // 1. Earth Day / Night Shader Sphere
  const earthGeo = new THREE.SphereGeometry(EARTH_RADIUS, 128, 128);

  const dayTexture = textureLoader.load('/textures/earth_day.jpg');
  dayTexture.colorSpace = THREE.SRGBColorSpace;
  dayTexture.wrapS = THREE.RepeatWrapping;

  const nightTexture = textureLoader.load('/textures/earth_night.jpg');
  nightTexture.colorSpace = THREE.SRGBColorSpace;
  nightTexture.wrapS = THREE.RepeatWrapping;

  const earthShaderMaterial = new THREE.ShaderMaterial({
    uniforms: {
      uDayMap: { value: dayTexture },
      uNightMap: { value: nightTexture },
      uSunDirection: { value: new THREE.Vector3() }
    },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vWorldPosition;
      void main() {
        vUv = uv;
        vNormal = normalize(normalMatrix * normal);
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPos.xyz;
        gl_Position = projectionMatrix * viewMatrix * worldPos;
      }
    `,
    fragmentShader: `
      uniform sampler2D uDayMap;
      uniform sampler2D uNightMap;
      uniform vec3 uSunDirection;
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vWorldPosition;

      void main() {
        vec4 dayColor = texture2D(uDayMap, vUv);
        vec4 nightColor = texture2D(uNightMap, vUv);

        vec3 sunDir = normalize(uSunDirection);
        float NdotL = dot(vNormal, sunDir);

        float dayWeight = smoothstep(-0.15, 0.25, NdotL);
        float nightWeight = 1.0 - dayWeight;

        vec3 dayLit = dayColor.rgb * (max(NdotL, 0.0) * 1.0 + 0.22);
        vec3 nightLit = nightColor.rgb * nightWeight * 2.0;

        // OpenSpace NASA Blue Marble: Specular sun glint over oceans
        vec3 viewDir = normalize(cameraPosition - vWorldPosition);
        vec3 halfDir = normalize(sunDir + viewDir);
        float spec = pow(max(dot(vNormal, halfDir), 0.0), 36.0);
        float isOcean = smoothstep(0.08, 0.35, dayColor.b - dayColor.r);
        vec3 oceanGlint = vec3(1.0, 0.98, 0.92) * spec * isOcean * max(NdotL, 0.0) * 2.2;

        gl_FragColor = vec4(dayLit + nightLit + oceanGlint, 1.0);
      }
    `
  });

  earthMesh = new THREE.Mesh(earthGeo, earthShaderMaterial);
  earthGroup.add(earthMesh);

  // 2. Minimalist, Delicate, Wispy Clouds (NOT Clumpy!)
  // Low opacity (0.22) so vibrant continents, mountains, and night lights are 100% visible!
  const cloudsGeo = new THREE.SphereGeometry(EARTH_RADIUS + 0.18, 96, 96);
  const cloudsTex = textureLoader.load('/textures/earth_clouds.jpg');
  cloudsTex.wrapS = THREE.RepeatWrapping;

  const cloudsMat = new THREE.MeshStandardMaterial({
    map: cloudsTex,
    transparent: true,
    opacity: 0.22, // Minimal, subtle, delicate cloud veil
    blending: THREE.AdditiveBlending,
    roughness: 1.0
  });

  cloudsMesh = new THREE.Mesh(cloudsGeo, cloudsMat);
  earthGroup.add(cloudsMesh);

  // 3. Atmospheric Rayleigh Blue Limb Glow
  const atmosGeo = new THREE.SphereGeometry(EARTH_RADIUS + 0.85, 64, 64);
  const atmosMat = new THREE.ShaderMaterial({
    vertexShader: `
      varying vec3 vNormal;
      void main() {
        vNormal = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec3 vNormal;
      void main() {
        float intensity = pow(0.70 - dot(vNormal, vec3(0, 0, 1.0)), 2.8);
        gl_FragColor = vec4(0.22, 0.74, 0.98, 1.0) * intensity * 0.95;
      }
    `,
    blending: THREE.AdditiveBlending,
    side: THREE.BackSide,
    transparent: true
  });

  atmosphereMesh = new THREE.Mesh(atmosGeo, atmosMat);
  earthGroup.add(atmosphereMesh);

  scene.add(earthGroup);
}

/**
 * Photorealistic Moon (OpenSpace LRO Elevation & Tactile Craters)
 */
function createPhotorealisticMoon() {
  moonGroup = new THREE.Group();
  moonGroup.position.copy(MOON_POSITION);

  const moonGeo = new THREE.SphereGeometry(MOON_RADIUS, 128, 128);
  const moonTex = textureLoader.load('/textures/moon.jpg');
  moonTex.colorSpace = THREE.SRGBColorSpace;
  moonTex.anisotropy = 8;

  const moonMat = new THREE.MeshStandardMaterial({
    map: moonTex,
    bumpMap: moonTex,
    bumpScale: 0.14, // Tactile 3D crater elevation
    roughness: 0.88,
    metalness: 0.02
  });

  moonMesh = new THREE.Mesh(moonGeo, moonMat);
  moonGroup.add(moonMesh);

  // Subtle lunar exosphere rim
  const moonGlowGeo = new THREE.SphereGeometry(MOON_RADIUS + 0.2, 48, 48);
  const moonGlowMat = new THREE.MeshBasicMaterial({
    color: 0xa1a1aa,
    transparent: true,
    opacity: 0.12,
    side: THREE.BackSide,
    blending: THREE.AdditiveBlending
  });
  // Dedicated Moon Illumination (prevents dark side from becoming pitch black)
  const moonKeyLight = new THREE.DirectionalLight(0xfffaed, 2.2);
  moonKeyLight.position.set(MOON_POSITION.x + 60, MOON_POSITION.y + 40, MOON_POSITION.z + 70);
  moonKeyLight.target = moonMesh;
  scene.add(moonKeyLight);

  const moonFillLight = new THREE.PointLight(0xa5b4fc, 1.2, 300);
  moonFillLight.position.set(MOON_POSITION.x - 40, MOON_POSITION.y + 20, MOON_POSITION.z - 40);
  scene.add(moonFillLight);

  scene.add(moonGroup);
}

/**
 * Photorealistic Blazing Golden Sun (Authentic Incandescent Star at Solar System Center)
 */
function createPhotorealisticSun() {
  // 1. Calibrated Solar Point Light – warm and illuminating without blinding wash-out
  sunPointLight = new THREE.PointLight(0xfff3d8, 1.45, 9000, 0.12);
  sunPointLight.position.set(0, 0, 0);
  scene.add(sunPointLight);

  // Subtle ambient fill so planetary night-sides are gently readable
  const ambientSolar = new THREE.AmbientLight(0x0c0c0e, 0.45);
  scene.add(ambientSolar);

  // 2. Solar Surface (NASA SOHO/SDO incandescent solar chromosphere)
  const sunTex = textureLoader.load('/textures/sun.jpg');
  sunTex.colorSpace = THREE.SRGBColorSpace;
  const sunGeo = new THREE.SphereGeometry(SUN_RADIUS, 64, 64);
  const sunMat = new THREE.MeshBasicMaterial({ map: sunTex });
  sunMesh = new THREE.Mesh(sunGeo, sunMat);
  sunMesh.position.set(0, 0, 0);
  scene.add(sunMesh);

  // 3. Chromosphere red-orange inner fringe (tight against solar limb)
  const innerCoronaGeo = new THREE.SphereGeometry(SUN_RADIUS * 1.05, 48, 48);
  const innerCoronaMat = new THREE.MeshBasicMaterial({
    color: 0xff4500,
    transparent: true,
    opacity: 0.35,
    blending: THREE.AdditiveBlending,
    side: THREE.BackSide
  });
  const innerCorona = new THREE.Mesh(innerCoronaGeo, innerCoronaMat);
  innerCorona.position.set(0, 0, 0);
  scene.add(innerCorona);

  // 4. Fiery orange-red mid corona ring
  const midCoronaGeo = new THREE.SphereGeometry(SUN_RADIUS * 1.16, 48, 48);
  const midCoronaMat = new THREE.MeshBasicMaterial({
    color: 0xd9381e,
    transparent: true,
    opacity: 0.20,
    blending: THREE.AdditiveBlending,
    side: THREE.BackSide
  });
  scene.add(new THREE.Mesh(midCoronaGeo, midCoronaMat));

  // 5. High-resolution canvas with vibrant red & orange solar flares, prominences, and coronal loops
  const flareCanvas = document.createElement('canvas');
  flareCanvas.width = 512;
  flareCanvas.height = 512;
  const fCtx = flareCanvas.getContext('2d');

  // Multi-tier solar coronal halo: Golden-Orange core -> Deep Orange -> Crimson Red -> Space
  const fGrad = fCtx.createRadialGradient(256, 256, SUN_RADIUS * 0.65, 256, 256, 256);
  fGrad.addColorStop(0.00, 'rgba(255, 170, 40,  0.0)');
  fGrad.addColorStop(0.25, 'rgba(255, 90,  15,  0.42)'); // Vibrant orange inner flare
  fGrad.addColorStop(0.50, 'rgba(220, 38,  12,  0.26)'); // Deep solar red prominence
  fGrad.addColorStop(0.75, 'rgba(150, 15,   5,  0.10)'); // Dark ruby coronal rim
  fGrad.addColorStop(1.00, 'rgba(60,   5,   0,  0.00)');
  fCtx.fillStyle = fGrad;
  fCtx.fillRect(0, 0, 512, 512);

  // Dynamic solar prominence loops & eruptive flare jets (12 coronal streamers)
  fCtx.save();
  fCtx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 12; i++) {
    fCtx.save();
    fCtx.translate(256, 256);
    const angle = (i * Math.PI) / 6;
    fCtx.rotate(angle);

    // Coronal ray gradient: orange to fiery red
    const isMajorFlare = (i % 3 === 0);
    const flareLen = isMajorFlare ? 240 : 190;
    const flareGrad = fCtx.createLinearGradient(0, 0, flareLen, 0);
    flareGrad.addColorStop(0.0, 'rgba(255, 130, 20, 0.38)');
    flareGrad.addColorStop(0.4, 'rgba(235, 45,  10, 0.22)');
    flareGrad.addColorStop(0.8, 'rgba(180, 15,   5, 0.08)');
    flareGrad.addColorStop(1.0, 'rgba(100, 0,    0, 0.00)');

    fCtx.fillStyle = flareGrad;
    fCtx.beginPath();
    const halfWidth = isMajorFlare ? 9 : 5;
    fCtx.moveTo(0, -halfWidth);
    fCtx.lineTo(flareLen, 0);
    fCtx.lineTo(0, halfWidth);
    fCtx.closePath();
    fCtx.fill();

    // Curved coronal magnetic loop / prominence arch
    if (isMajorFlare) {
      fCtx.strokeStyle = 'rgba(255, 75, 15, 0.28)';
      fCtx.lineWidth = 3;
      fCtx.beginPath();
      fCtx.arc(110, 0, 45, -Math.PI / 2, Math.PI / 2);
      fCtx.stroke();
    }

    fCtx.restore();
  }
  fCtx.restore();

  const flareTex = new THREE.CanvasTexture(flareCanvas);
  const flareMat = new THREE.MeshBasicMaterial({
    map: flareTex,
    transparent: true,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    depthWrite: false
  });
  sunCoronaMesh = new THREE.Mesh(new THREE.PlaneGeometry(SUN_RADIUS * 4.6, SUN_RADIUS * 4.6), flareMat);
  sunCoronaMesh.position.set(0, 0, 0);
  scene.add(sunCoronaMesh);
}

/**
 * Photorealistic Mercury (NASA Messenger Texture & Cratered Elevation)
 */
function createMercury() {
  mercuryGroup = new THREE.Group();
  mercuryGroup.position.copy(mercuryPos);

  const tex = textureLoader.load('/textures/mercury.jpg');
  tex.colorSpace = THREE.SRGBColorSpace;
  const geo = new THREE.SphereGeometry(ORBIT_PARAMS.mercury.r, 64, 64);
  const mat = new THREE.MeshStandardMaterial({
    map: tex,
    roughness: 0.88,
    metalness: 0.1
  });
  mercuryMesh = new THREE.Mesh(geo, mat);
  mercuryGroup.add(mercuryMesh);

  const keyLight = new THREE.DirectionalLight(0xffedd5, 2.2);
  keyLight.position.set(12, 6, 14);
  mercuryGroup.add(keyLight);

  scene.add(mercuryGroup);
}

/**
 * Photorealistic Venus (NASA Magellan/Akatsuki Texture & Sulfuric Atmosphere)
 */
function createVenus() {
  venusGroup = new THREE.Group();
  venusGroup.position.copy(venusPos);
  venusGroup.rotation.z = THREE.MathUtils.degToRad(177.3); // Retrograde tilt

  const tex = textureLoader.load('/textures/venus.jpg');
  tex.colorSpace = THREE.SRGBColorSpace;
  const geo = new THREE.SphereGeometry(ORBIT_PARAMS.venus.r, 64, 64);
  const mat = new THREE.MeshStandardMaterial({
    map: tex,
    roughness: 0.65,
    metalness: 0.04
  });
  venusMesh = new THREE.Mesh(geo, mat);
  venusGroup.add(venusMesh);

  const atmoGeo = new THREE.SphereGeometry(ORBIT_PARAMS.venus.r * 1.03, 32, 32);
  const atmoMat = new THREE.MeshBasicMaterial({
    color: 0xfef08a,
    transparent: true,
    opacity: 0.22,
    side: THREE.BackSide
  });
  venusGroup.add(new THREE.Mesh(atmoGeo, atmoMat));

  const keyLight = new THREE.DirectionalLight(0xfffaed, 2.2);
  keyLight.position.set(18, 9, 20);
  venusGroup.add(keyLight);

  scene.add(venusGroup);
}

/**
 * Photorealistic Mars (NASA Viking Global Mosaic, Atmosphere & Moons)
 */
function createMars() {
  marsGroup = new THREE.Group();
  marsGroup.position.copy(marsPos);
  marsGroup.rotation.z = THREE.MathUtils.degToRad(25.19); // True Mars tilt

  // Real NASA Viking Mars Map
  const marsTex = textureLoader.load('/textures/mars.jpg');
  marsTex.colorSpace = THREE.SRGBColorSpace;
  const marsGeo = new THREE.SphereGeometry(MARS_RADIUS, 64, 64);
  const marsMat = new THREE.MeshStandardMaterial({
    map: marsTex,
    roughness: 0.8,
    metalness: 0.08
  });
  marsMesh = new THREE.Mesh(marsGeo, marsMat);
  marsGroup.add(marsMesh);

  // Mars Thin Atmosphere Peach Glow
  const marsAtmo = new THREE.Mesh(
    new THREE.SphereGeometry(MARS_RADIUS * 1.04, 32, 32),
    new THREE.MeshBasicMaterial({ color: 0xfca5a5, transparent: true, opacity: 0.22, side: THREE.BackSide })
  );
  marsGroup.add(marsAtmo);

  // Phobos Moon
  const phobosMat = new THREE.MeshStandardMaterial({ color: 0x78716c, roughness: 0.9 });
  phobosMesh = new THREE.Mesh(new THREE.DodecahedronGeometry(0.45, 1), phobosMat);
  phobosMesh.position.set(13.0, 0, 0);
  marsGroup.add(phobosMesh);

  // Deimos Moon
  const deimosMat = new THREE.MeshStandardMaterial({ color: 0xa8a29e, roughness: 0.95 });
  deimosMesh = new THREE.Mesh(new THREE.DodecahedronGeometry(0.32, 1), deimosMat);
  deimosMesh.position.set(0, 0, 19.0);
  marsGroup.add(deimosMesh);

  // Dedicated planetary key light for Mars & Moons
  const marsKeyLight = new THREE.DirectionalLight(0xffedd5, 2.4);
  marsKeyLight.position.set(20, 10, 25);
  marsGroup.add(marsKeyLight);

  scene.add(marsGroup);
}

/**
 * Main Asteroid Belt (Between Mars & Jupiter, 1500+ 3D Textured Rocky Asteroids)
 * Uses high-resolution photographic asteroid surface texture and PBR bump mapping
 */
function createAsteroidBelt() {
  asteroidBeltGroup = new THREE.Group();
  const asteroidCount = 1350;

  // Realistic natural asteroid boulder base: smooth dodecahedron with gentle continuous spherical harmonics
  const baseGeo = new THREE.DodecahedronGeometry(1.0, 2);
  const posAttr = baseGeo.attributes.position;
  for (let i = 0; i < posAttr.count; i++) {
    const vx = posAttr.getX(i);
    const vy = posAttr.getY(i);
    const vz = posAttr.getZ(i);
    const len = Math.sqrt(vx * vx + vy * vy + vz * vz) || 1.0;
    const nx = vx / len;
    const ny = vy / len;
    const nz = vz / len;
    // Smooth natural boulder shape (weathered rock without broken/fractured spikes)
    const radial = 0.94 + 0.12 * Math.sin(nx * 3.0 + ny * 2.0) + 0.08 * Math.cos(nz * 2.8 + nx * 1.5);
    posAttr.setXYZ(i, nx * radial, ny * radial, nz * radial);
  }
  baseGeo.computeVertexNormals();

  // Asteroid surface material — realistic carbonaceous-chondrite rocky texture
  const asteroidTex = textureLoader.load('/textures/asteroid.jpg');
  asteroidTex.colorSpace = THREE.SRGBColorSpace;
  asteroidTex.wrapS = THREE.RepeatWrapping;
  asteroidTex.wrapT = THREE.RepeatWrapping;

  const rockMat = new THREE.MeshStandardMaterial({
    map: asteroidTex,
    bumpMap: asteroidTex,
    bumpScale: 0.18,
    roughness: 0.90,
    metalness: 0.06,
    color: 0x827362,
    flatShading: false
  });

  asteroidInstancedMesh = new THREE.InstancedMesh(baseGeo, rockMat, asteroidCount);
  asteroidInstancedMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

  const dummy = new THREE.Object3D();

  // Belt ring: strictly between Mars (a=410) and Jupiter (a=980) — belt spans 530 to 660
  for (let i = 0; i < asteroidCount; i++) {
    const a = 530 + Math.random() * 130;    // Semi-major axis (530 - 660)
    const e = 0.015 + Math.random() * 0.06; // Nearly circular, thin Keplerian ring
    const b = a * Math.sqrt(1 - e * e);
    const theta = Math.random() * Math.PI * 2;
    const y = (Math.random() - 0.5) * 16;   // Moderate vertical inclination plane

    // Natural oblong boulder scaling (ellipsoidal rock aspect ratios)
    const baseScale = 0.8 + Math.random() * 2.2;
    const sx = baseScale * (0.8 + Math.random() * 0.4);
    const sy = baseScale * (0.65 + Math.random() * 0.35);
    const sz = baseScale * (0.75 + Math.random() * 0.45);

    dummy.position.set(a * Math.cos(theta) - a * e, y, b * Math.sin(theta));
    dummy.rotation.set(
      Math.random() * Math.PI * 2,
      Math.random() * Math.PI * 2,
      Math.random() * Math.PI * 2
    );
    dummy.scale.set(sx, sy, sz);
    dummy.updateMatrix();
    asteroidInstancedMesh.setMatrixAt(i, dummy.matrix);
  }

  asteroidInstancedMesh.instanceMatrix.needsUpdate = true;
  asteroidBeltGroup.add(asteroidInstancedMesh);

  // Subtle asteroid dust/micrometeoroid ring
  const dustCount = 1000;
  const dustGeo = new THREE.BufferGeometry();
  const dustPos = new Float32Array(dustCount * 3);
  for (let i = 0; i < dustCount; i++) {
    const i3 = i * 3;
    const r = 530 + Math.random() * 130;
    const th = Math.random() * Math.PI * 2;
    dustPos[i3]     = r * Math.cos(th);
    dustPos[i3 + 1] = (Math.random() - 0.5) * 16;
    dustPos[i3 + 2] = r * Math.sin(th);
  }
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
  const dustMat = new THREE.PointsMaterial({
    size: 1.1,
    color: 0x9b8c78,
    transparent: true,
    opacity: 0.30
  });
  asteroidBeltPoints = new THREE.Points(dustGeo, dustMat);
  asteroidBeltGroup.add(asteroidBeltPoints);

  scene.add(asteroidBeltGroup);
}

/**
 * Photorealistic Jupiter (NASA Cassini/Juno Map with Great Red Spot & Galilean Moons)
 */
function createJupiter() {
  jupiterGroup = new THREE.Group();
  jupiterGroup.position.copy(jupiterPos);
  jupiterGroup.rotation.z = THREE.MathUtils.degToRad(3.13); // Jupiter axial tilt

  // Real NASA Cassini/Juno Map with Great Red Spot
  const jupTex = textureLoader.load('/textures/jupiter.jpg');
  jupTex.colorSpace = THREE.SRGBColorSpace;
  const jupGeo = new THREE.SphereGeometry(JUPITER_RADIUS, 64, 64);
  const jupMat = new THREE.MeshStandardMaterial({
    map: jupTex,
    roughness: 0.65,
    metalness: 0.05
  });
  jupiterMesh = new THREE.Mesh(jupGeo, jupMat);
  jupiterGroup.add(jupiterMesh);

  // 4 Galilean Moons
  ioMesh = new THREE.Mesh(new THREE.SphereGeometry(0.9, 16, 16), new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.7 }));
  jupiterGroup.add(ioMesh);

  europaMesh = new THREE.Mesh(new THREE.SphereGeometry(0.8, 16, 16), new THREE.MeshStandardMaterial({ color: 0xe0f2fe, roughness: 0.5 }));
  jupiterGroup.add(europaMesh);

  ganymedeMesh = new THREE.Mesh(new THREE.SphereGeometry(1.35, 16, 16), new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.8 }));
  jupiterGroup.add(ganymedeMesh);

  callistoMesh = new THREE.Mesh(new THREE.SphereGeometry(1.2, 16, 16), new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.9 }));
  jupiterGroup.add(callistoMesh);

  // Dedicated key light for Jupiter & Galilean Moons
  const jupKeyLight = new THREE.DirectionalLight(0xfffaed, 2.2);
  jupKeyLight.position.set(50, 25, 60);
  jupiterGroup.add(jupKeyLight);

  scene.add(jupiterGroup);
}

/**
 * Photorealistic Saturn & Authentic Cassini Rings (NASA Global Imagery & Titan)
 */
function createSaturn() {
  saturnGroup = new THREE.Group();
  saturnGroup.position.copy(saturnPos);
  saturnGroup.rotation.z = THREE.MathUtils.degToRad(26.73); // True Saturn axial tilt!

  // Real NASA Cassini Saturn Map
  const satTex = textureLoader.load('/textures/saturn.jpg');
  satTex.colorSpace = THREE.SRGBColorSpace;
  const satGeo = new THREE.SphereGeometry(SATURN_RADIUS, 64, 64);
  const satMat = new THREE.MeshStandardMaterial({
    map: satTex,
    roughness: 0.75,
    metalness: 0.08
  });
  saturnMesh = new THREE.Mesh(satGeo, satMat);
  saturnGroup.add(saturnMesh);

  // Real NASA Cassini Rings
  const ringInner = SATURN_RADIUS * 1.25;
  const ringOuter = SATURN_RADIUS * 2.35;
  const ringGeo = new THREE.RingGeometry(ringInner, ringOuter, 96);
  const ringTex = textureLoader.load('/textures/saturn_ring.jpg');
  ringTex.colorSpace = THREE.SRGBColorSpace;

  // Map radial coordinates so ring texture stretches smoothly around 360 degrees
  const pos = ringGeo.attributes.position;
  const uvs = ringGeo.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const r = Math.sqrt(x * x + y * y);
    const normalizedR = (r - ringInner) / (ringOuter - ringInner);
    uvs.setXY(i, normalizedR, 0.5);
  }
  uvs.needsUpdate = true;

  const ringMat = new THREE.MeshStandardMaterial({
    map: ringTex,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.94,
    roughness: 0.45,
    metalness: 0.15
  });
  saturnRingsMesh = new THREE.Mesh(ringGeo, ringMat);
  saturnRingsMesh.rotation.x = Math.PI / 2;
  saturnGroup.add(saturnRingsMesh);

  // Titan Moon (giant hazy golden moon)
  const titanMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.7 });
  titanMesh = new THREE.Mesh(new THREE.SphereGeometry(1.3, 16, 16), titanMat);
  titanMesh.position.set(70.0, 0, 0);
  saturnGroup.add(titanMesh);

  // Dedicated Saturn Key Light
  const satKeyLight = new THREE.DirectionalLight(0xfffaed, 2.2);
  satKeyLight.position.set(50, 25, 60);
  saturnGroup.add(satKeyLight);

  scene.add(saturnGroup);
}

/**
 * Photorealistic Uranus (NASA Voyager 2 Imagery, 98° Sideways Tilt & Rings)
 */
function createUranus() {
  uranusGroup = new THREE.Group();
  uranusGroup.position.copy(uranusPos);
  uranusGroup.rotation.z = THREE.MathUtils.degToRad(97.77); // True 98° sideways axial tilt!

  const tex = textureLoader.load('/textures/uranus.jpg');
  tex.colorSpace = THREE.SRGBColorSpace;
  const geo = new THREE.SphereGeometry(ORBIT_PARAMS.uranus.r, 64, 64);
  const mat = new THREE.MeshStandardMaterial({
    map: tex,
    roughness: 0.6,
    metalness: 0.05
  });
  uranusMesh = new THREE.Mesh(geo, mat);
  uranusGroup.add(uranusMesh);

  // Pale Cyan Atmosphere Rim
  const atmoGeo = new THREE.SphereGeometry(ORBIT_PARAMS.uranus.r * 1.04, 32, 32);
  const atmoMat = new THREE.MeshBasicMaterial({
    color: 0x67e8f9,
    transparent: true,
    opacity: 0.25,
    side: THREE.BackSide
  });
  uranusGroup.add(new THREE.Mesh(atmoGeo, atmoMat));

  // Thin Uranus Rings
  const ringGeo = new THREE.RingGeometry(ORBIT_PARAMS.uranus.r * 1.35, ORBIT_PARAMS.uranus.r * 1.8, 64);
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0xa5f3fc,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.4
  });
  uranusRingsMesh = new THREE.Mesh(ringGeo, ringMat);
  uranusRingsMesh.rotation.x = Math.PI / 2;
  uranusGroup.add(uranusRingsMesh);

  const keyLight = new THREE.DirectionalLight(0xe0f2fe, 2.0);
  keyLight.position.set(35, 18, 42);
  uranusGroup.add(keyLight);

  scene.add(uranusGroup);
}

/**
 * Photorealistic Neptune (NASA Voyager 2 Imagery, Azure Atmosphere & Triton)
 */
function createNeptune() {
  neptuneGroup = new THREE.Group();
  neptuneGroup.position.copy(neptunePos);
  neptuneGroup.rotation.z = THREE.MathUtils.degToRad(28.32); // 28.32° axial tilt

  const tex = textureLoader.load('/textures/neptune.jpg');
  tex.colorSpace = THREE.SRGBColorSpace;
  const geo = new THREE.SphereGeometry(ORBIT_PARAMS.neptune.r, 64, 64);
  const mat = new THREE.MeshStandardMaterial({
    map: tex,
    roughness: 0.55,
    metalness: 0.05
  });
  neptuneMesh = new THREE.Mesh(geo, mat);
  neptuneGroup.add(neptuneMesh);

  // Deep Azure Methane Atmosphere Limb Glow
  const atmoGeo = new THREE.SphereGeometry(ORBIT_PARAMS.neptune.r * 1.05, 32, 32);
  const atmoMat = new THREE.MeshBasicMaterial({
    color: 0x38bdf8,
    transparent: true,
    opacity: 0.28,
    side: THREE.BackSide,
    blending: THREE.AdditiveBlending
  });
  neptuneGroup.add(new THREE.Mesh(atmoGeo, atmoMat));

  // Triton Moon (giant icy moon)
  const tritonMat = new THREE.MeshStandardMaterial({ color: 0xfbcfe8, roughness: 0.75 });
  tritonMesh = new THREE.Mesh(new THREE.SphereGeometry(1.2, 16, 16), tritonMat);
  tritonMesh.position.set(45.0, 0, 0);
  neptuneGroup.add(tritonMesh);

  // Dedicated Key Light for Neptune & Triton
  const nepKeyLight = new THREE.DirectionalLight(0xfffaed, 2.2);
  nepKeyLight.position.set(50, 25, 60);
  neptuneGroup.add(nepKeyLight);

  scene.add(neptuneGroup);
}

/**
 * Elliptical Keplerian Planetary Orbits (Sun at Focus 0, 0, 0)
 * Plus Lunar Orbit Centered on Earth
 */
function createPlanetaryOrbits() {
  Object.keys(ORBIT_PARAMS).forEach(key => {
    const p = ORBIT_PARAMS[key];
    const points = [];
    const segments = 320;
    for (let i = 0; i <= segments; i++) {
      const theta = (i / segments) * Math.PI * 2;
      points.push(getKeplerianPos(key, theta));
    }
    // Primary bright orbit line
    const orbitGeo = new THREE.BufferGeometry().setFromPoints(points);
    const orbitMat = new THREE.LineBasicMaterial({
      color: p.color,
      transparent: true,
      opacity: 0.75,
      linewidth: 3
    });
    const line = new THREE.Line(orbitGeo, orbitMat);
    scene.add(line);

    // Glow shadow line (slightly offset for double-line glow effect)
    const glowMat = new THREE.LineBasicMaterial({
      color: p.color,
      transparent: true,
      opacity: 0.22,
      linewidth: 6
    });
    const glowLine = new THREE.Line(orbitGeo, glowMat);
    scene.add(glowLine);
  });

  // Lunar orbit centered on Earth (earthPos)
  const moonPoints = [];
  const moonSegments = 128;
  for (let i = 0; i <= moonSegments; i++) {
    const theta = (i / moonSegments) * Math.PI * 2;
    moonPoints.push(new THREE.Vector3(
      36.0 * Math.cos(theta),
      0,
      36.0 * Math.sin(theta)
    ));
  }
  const moonOrbitGeo = new THREE.BufferGeometry().setFromPoints(moonPoints);
  const moonOrbitMat = new THREE.LineBasicMaterial({
    color: 0x94a3b8,
    transparent: true,
    opacity: 0.35
  });
  moonOrbitLine = new THREE.Line(moonOrbitGeo, moonOrbitMat);
  moonOrbitLine.position.copy(earthPos);
  scene.add(moonOrbitLine);
}

/**
 * 3D Orbit Trajectory Line
 */
function createOrbitTrajectory() {
  const points = [];
  const segments = 180;
  const sat = SATELLITES[currentSatId];
  const isMoon = sat.body === 'moon';
  const baseR = (isMoon ? MOON_RADIUS : EARTH_RADIUS) + sat.altScale;
  const incRad = THREE.MathUtils.degToRad(sat.inclination);

  for (let i = 0; i <= segments; i++) {
    const theta = (i / segments) * Math.PI * 2;
    const x = baseR * Math.cos(theta);
    const y = baseR * Math.sin(theta) * Math.sin(incRad);
    const z = baseR * Math.sin(theta) * Math.cos(incRad);
    points.push(new THREE.Vector3(x, y, z));
  }

  const orbitGeo = new THREE.BufferGeometry().setFromPoints(points);
  const orbitMat = new THREE.LineBasicMaterial({
    color: new THREE.Color(sat.color),
    transparent: true,
    opacity: 0.65,
    linewidth: 2
  });

  if (orbitLine) scene.remove(orbitLine);
  orbitLine = new THREE.Line(orbitGeo, orbitMat);

  const centerPos = isMoon ? moonPos : earthPos;
  orbitLine.position.copy(centerPos);
  scene.add(orbitLine);
}

/**
 * Sub-Satellite Laser Ground Track Pointer
 */
function createGroundTrackPointer() {
  const lineGeo = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0, -2, 0)
  ]);
  const lineMat = new THREE.LineBasicMaterial({
    color: 0x38bdf8,
    transparent: true,
    opacity: 0.85
  });
  subSatPointer = new THREE.Line(lineGeo, lineMat);
  craftGroup.add(subSatPointer);

  const ringGeo = new THREE.RingGeometry(0.18, 0.32, 32);
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0x38bdf8,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.9
  });
  groundTargetRing = new THREE.Mesh(ringGeo, ringMat);
  groundTargetRing.rotation.x = Math.PI / 2;
  scene.add(groundTargetRing);
}

// ============================================================================
// HIGH-FIDELITY PROCEDURAL SPACECRAFT GENERATOR & PBR TEXTURE ENGINE
// Realistic Aerospace Engineering Models (ISS, Hubble, Tiangong, Lunar Orbiters, Starlink)
// ============================================================================

let scTextures = null;

/**
 * Generate Procedural Aerospace Textures using Lightweight HTML5 Canvases
 * Zero megabyte downloads, high-res PBR appearance, runs at 60-72 FPS in VR
 */
function getSpacecraftTextures() {
  if (scTextures) return scTextures;

  // 1. Solar Photovoltaic Array Texture (Deep blue silicon, cell grid lines, silver busbars)
  const solarCanvas = document.createElement('canvas');
  solarCanvas.width = 512;
  solarCanvas.height = 512;
  const sCtx = solarCanvas.getContext('2d');
  sCtx.fillStyle = '#060f22';
  sCtx.fillRect(0, 0, 512, 512);

  const cols = 8;
  const rows = 16;
  const cw = 512 / cols;
  const rh = 512 / rows;

  for (let c = 0; c < cols; c++) {
    for (let r = 0; r < rows; r++) {
      const x = c * cw;
      const y = r * rh;
      // Photovoltaic cell background
      sCtx.fillStyle = '#0a235c';
      sCtx.fillRect(x + 2, y + 2, cw - 4, rh - 4);

      // Iridescent silicon sheen
      const grad = sCtx.createLinearGradient(x, y, x + cw, y + rh);
      grad.addColorStop(0, 'rgba(37, 99, 235, 0.45)');
      grad.addColorStop(0.5, 'rgba(14, 165, 233, 0.2)');
      grad.addColorStop(1, 'rgba(29, 78, 216, 0.45)');
      sCtx.fillStyle = grad;
      sCtx.fillRect(x + 2, y + 2, cw - 4, rh - 4);

      // Fine horizontal grid conductors
      sCtx.strokeStyle = 'rgba(147, 197, 253, 0.35)';
      sCtx.lineWidth = 1;
      for (let gy = y + 6; gy < y + rh - 4; gy += 6) {
        sCtx.beginPath();
        sCtx.moveTo(x + 3, gy);
        sCtx.lineTo(x + cw - 3, gy);
        sCtx.stroke();
      }

      // Vertical metallic silver busbars (2 per wafer)
      sCtx.strokeStyle = '#e2e8f0';
      sCtx.lineWidth = 1.8;
      sCtx.beginPath();
      sCtx.moveTo(x + cw * 0.33, y + 2);
      sCtx.lineTo(x + cw * 0.33, y + rh - 2);
      sCtx.moveTo(x + cw * 0.67, y + 2);
      sCtx.lineTo(x + cw * 0.67, y + rh - 2);
      sCtx.stroke();
    }
  }

  // 2. Gold Kapton MLI Thermal Insulation Foil (Wrinkled aerospace foil)
  const goldCanvas = document.createElement('canvas');
  goldCanvas.width = 512;
  goldCanvas.height = 512;
  const gCtx = goldCanvas.getContext('2d');
  gCtx.fillStyle = '#b45309';
  gCtx.fillRect(0, 0, 512, 512);

  for (let i = 0; i < 450; i++) {
    const rx = Math.random() * 512;
    const ry = Math.random() * 512;
    const rw = 25 + Math.random() * 45;
    const rh = 15 + Math.random() * 35;
    const shade = Math.random();
    if (shade > 0.65) {
      gCtx.fillStyle = 'rgba(251, 191, 36, 0.6)';
    } else if (shade > 0.3) {
      gCtx.fillStyle = 'rgba(245, 158, 11, 0.45)';
    } else {
      gCtx.fillStyle = 'rgba(120, 53, 15, 0.5)';
    }
    gCtx.beginPath();
    gCtx.moveTo(rx, ry);
    gCtx.lineTo(rx + rw, ry + (Math.random() * 10 - 5));
    gCtx.lineTo(rx + rw * 0.7, ry + rh);
    gCtx.lineTo(rx - Math.random() * 8, ry + rh * 0.8);
    gCtx.closePath();
    gCtx.fill();
  }

  // Kapton tape seams
  gCtx.strokeStyle = '#fef08a';
  gCtx.lineWidth = 2;
  for (let y = 0; y < 512; y += 64) {
    gCtx.beginPath();
    gCtx.moveTo(0, y);
    gCtx.lineTo(512, y);
    gCtx.stroke();
  }
  for (let x = 0; x < 512; x += 128) {
    gCtx.beginPath();
    gCtx.moveTo(x, 0);
    gCtx.lineTo(x, 512);
    gCtx.stroke();
  }

  // 3. Silver / Aluminized Mylar MLI Foil
  const silvCanvas = document.createElement('canvas');
  silvCanvas.width = 512;
  silvCanvas.height = 512;
  const slCtx = silvCanvas.getContext('2d');
  slCtx.fillStyle = '#475569';
  slCtx.fillRect(0, 0, 512, 512);

  for (let i = 0; i < 400; i++) {
    const rx = Math.random() * 512;
    const ry = Math.random() * 512;
    const rw = 25 + Math.random() * 50;
    const rh = 15 + Math.random() * 35;
    slCtx.fillStyle = Math.random() > 0.5 ? 'rgba(248, 250, 252, 0.45)' : 'rgba(30, 41, 59, 0.4)';
    slCtx.beginPath();
    slCtx.moveTo(rx, ry);
    slCtx.lineTo(rx + rw, ry + Math.random() * 8 - 4);
    slCtx.lineTo(rx + rw * 0.6, ry + rh);
    slCtx.closePath();
    slCtx.fill();
  }
  slCtx.strokeStyle = '#e2e8f0';
  slCtx.lineWidth = 1.5;
  for (let y = 0; y < 512; y += 64) {
    slCtx.beginPath();
    slCtx.moveTo(0, y);
    slCtx.lineTo(512, y);
    slCtx.stroke();
  }

  // 4. Pressurized Module Shell (Quilted Beta cloth thermal blankets & orbital ribs)
  const modCanvas = document.createElement('canvas');
  modCanvas.width = 512;
  modCanvas.height = 512;
  const mCtx = modCanvas.getContext('2d');
  mCtx.fillStyle = '#e2e8f0';
  mCtx.fillRect(0, 0, 512, 512);

  // Quilted insulation squares
  mCtx.strokeStyle = 'rgba(148, 163, 184, 0.7)';
  mCtx.lineWidth = 1.5;
  for (let x = 0; x < 512; x += 32) {
    for (let y = 0; y < 512; y += 32) {
      mCtx.strokeRect(x + 2, y + 2, 28, 28);
      mCtx.fillStyle = 'rgba(100, 116, 139, 0.5)';
      mCtx.beginPath();
      mCtx.arc(x + 16, y + 16, 2, 0, Math.PI * 2);
      mCtx.fill();
    }
  }
  // Metallic structural bands
  mCtx.fillStyle = 'rgba(71, 85, 105, 0.35)';
  mCtx.fillRect(0, 0, 512, 14);
  mCtx.fillRect(0, 240, 512, 18);
  mCtx.fillRect(0, 498, 512, 14);

  // 5. Heat Rejection Accordion Radiator (Corrugated cooling fins)
  const radCanvas = document.createElement('canvas');
  radCanvas.width = 512;
  radCanvas.height = 512;
  const rCtx = radCanvas.getContext('2d');
  rCtx.fillStyle = '#f8fafc';
  rCtx.fillRect(0, 0, 512, 512);
  for (let x = 0; x < 512; x += 16) {
    rCtx.fillStyle = (x % 32 === 0) ? '#e2e8f0' : '#ffffff';
    rCtx.fillRect(x, 0, 16, 512);
    rCtx.strokeStyle = '#94a3b8';
    rCtx.lineWidth = 1;
    rCtx.beginPath();
    rCtx.moveTo(x, 0);
    rCtx.lineTo(x, 512);
    rCtx.stroke();
  }

  // Create Three.js Textures
  const solarTex = new THREE.CanvasTexture(solarCanvas);
  solarTex.wrapS = THREE.RepeatWrapping;
  solarTex.wrapT = THREE.RepeatWrapping;

  const foilGoldTex = new THREE.CanvasTexture(goldCanvas);
  foilGoldTex.wrapS = THREE.RepeatWrapping;
  foilGoldTex.wrapT = THREE.RepeatWrapping;

  const foilSilverTex = new THREE.CanvasTexture(silvCanvas);
  foilSilverTex.wrapS = THREE.RepeatWrapping;
  foilSilverTex.wrapT = THREE.RepeatWrapping;

  const moduleTex = new THREE.CanvasTexture(modCanvas);
  moduleTex.wrapS = THREE.RepeatWrapping;
  moduleTex.wrapT = THREE.RepeatWrapping;

  const radiatorTex = new THREE.CanvasTexture(radCanvas);
  radiatorTex.wrapS = THREE.RepeatWrapping;
  radiatorTex.wrapT = THREE.RepeatWrapping;

  scTextures = {
    solarTex,
    foilGoldTex,
    foilSilverTex,
    moduleTex,
    radiatorTex
  };
  return scTextures;
}

/**
 * Procedural Spacecraft 3D Models
 * Real Aerospace Architecture, Multi-Module Complexes & Realistic PBR Textures
 */
function buildCraft3DModel(satId) {
  if (craftModelMesh) craftGroup.remove(craftModelMesh);

  const model = new THREE.Group();
  const textures = getSpacecraftTextures();

  // Shared Aerospace Materials
  const solarMat = new THREE.MeshStandardMaterial({
    map: textures.solarTex,
    metalness: 0.85,
    roughness: 0.22,
    emissive: 0x051b3d,
    emissiveIntensity: 0.35,
    side: THREE.DoubleSide
  });

  const foilGoldMat = new THREE.MeshStandardMaterial({
    map: textures.foilGoldTex,
    metalness: 0.92,
    roughness: 0.28,
    emissive: 0x78350f,
    emissiveIntensity: 0.25,
    side: THREE.DoubleSide
  });

  const foilSilverMat = new THREE.MeshStandardMaterial({
    map: textures.foilSilverTex,
    metalness: 0.95,
    roughness: 0.2,
    side: THREE.DoubleSide
  });

  const moduleMat = new THREE.MeshStandardMaterial({
    map: textures.moduleTex,
    metalness: 0.55,
    roughness: 0.38
  });

  const radiatorMat = new THREE.MeshStandardMaterial({
    map: textures.radiatorTex,
    metalness: 0.25,
    roughness: 0.5,
    side: THREE.DoubleSide
  });

  const trussMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.92, roughness: 0.25 });
  const collarMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.85, roughness: 0.3 });
  const russianMat = new THREE.MeshStandardMaterial({ color: 0xb0bec5, metalness: 0.75, roughness: 0.4 });
  const darkMetalMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.95, roughness: 0.25 });
  const dockRingMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.95, roughness: 0.15 });
  const cupolaGlassMat = new THREE.MeshStandardMaterial({
    color: 0x0284c7,
    metalness: 0.95,
    roughness: 0.05,
    transparent: true,
    opacity: 0.75
  });

  if (satId === 'iss') {
    // =========================================================================
    // INTERNATIONAL SPACE STATION (ISS)
    // Full 109m x 73m Architecture: ITS Truss, 8 Solar Array Wings, 3 Radiators,
    // USOS & Russian Segments, Cupola, Canadarm2, and Docked Capsule
    // =========================================================================

    // 1. Integrated Truss Structure (ITS) - Spanning 8.2 units along X
    const mainTruss = new THREE.Mesh(new THREE.BoxGeometry(8.2, 0.2, 0.2), trussMat);
    model.add(mainTruss);

    // Segment bulkheads along truss (P6 to S6)
    [-3.8, -2.8, -1.8, -0.9, 0, 0.9, 1.8, 2.8, 3.8].forEach(x => {
      const ring = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.26, 0.26), collarMat);
      ring.position.x = x;
      model.add(ring);
    });

    // Solar Alpha Rotary Joints (SARJ)
    [-2.3, 2.3].forEach(x => {
      const sarj = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.3, 24), collarMat);
      sarj.rotation.z = Math.PI / 2;
      sarj.position.x = x;
      model.add(sarj);
    });

    // Outboard Solar Mast Canisters
    [-3.7, 3.7].forEach(x => {
      const can = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.42, 16), darkMetalMat);
      can.position.x = x;
      model.add(can);
    });

    // 2. Eight Massive Photovoltaic Solar Array Wings (SAW)
    // 4 dual wing assemblies extending along ±Z (forward and aft)
    const sawPositions = [-3.7, -2.7, 2.7, 3.7]; // P6, P4, S4, S6
    sawPositions.forEach(xPos => {
      // Forward Wing
      const wingFwd = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.015, 2.1), solarMat);
      wingFwd.position.set(xPos, 0, 1.25);
      model.add(wingFwd);

      // Central deployment mast
      const mastFwd = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 2.1, 8), darkMetalMat);
      mastFwd.rotation.x = Math.PI / 2;
      mastFwd.position.set(xPos, 0, 1.25);
      model.add(mastFwd);

      // Aft Wing
      const wingAft = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.015, 2.1), solarMat);
      wingAft.position.set(xPos, 0, -1.25);
      model.add(wingAft);

      const mastAft = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 2.1, 8), darkMetalMat);
      mastAft.rotation.x = Math.PI / 2;
      mastAft.position.set(xPos, 0, -1.25);
      model.add(mastAft);
    });

    // 3. Heat Rejection Subsystem (HRS) Accordion Radiators
    // Starboard S1 Radiator
    const radStarboard = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.02, 1.45), radiatorMat);
    radStarboard.position.set(1.4, 0.35, -1.1);
    radStarboard.rotation.y = -0.15;
    model.add(radStarboard);

    // Port P1 Radiator
    const radPort = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.02, 1.45), radiatorMat);
    radPort.position.set(-1.4, 0.35, -1.1);
    radPort.rotation.y = 0.15;
    model.add(radPort);

    // Center Trailing Radiator
    const radCenter = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.02, 1.1), radiatorMat);
    radCenter.position.set(0, 0.42, -0.9);
    model.add(radCenter);

    // 4. US Orbital Segment (USOS) Pressurized Modules (Along Z axis)
    // Unity Node 1
    const unity = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.65, 24), moduleMat);
    unity.rotation.x = Math.PI / 2;
    unity.position.set(0, -0.22, 0);
    model.add(unity);

    // Destiny US Laboratory
    const destiny = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 1.2, 24), moduleMat);
    destiny.rotation.x = Math.PI / 2;
    destiny.position.set(0, -0.22, 0.95);
    model.add(destiny);

    // Destiny end cones
    const destinyCap = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.26, 0.18, 24), collarMat);
    destinyCap.rotation.x = Math.PI / 2;
    destinyCap.position.set(0, -0.22, 1.6);
    model.add(destinyCap);

    // Harmony Node 2
    const harmony = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.65, 24), moduleMat);
    harmony.rotation.x = Math.PI / 2;
    harmony.position.set(0, -0.22, 1.95);
    model.add(harmony);

    // Columbus Laboratory (ESA) - Docked Starboard of Harmony
    const columbus = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.95, 24), moduleMat);
    columbus.rotation.z = Math.PI / 2;
    columbus.position.set(0.75, -0.22, 1.95);
    model.add(columbus);

    // Kibo Japanese Experiment Module (JAXA) - Docked Port of Harmony
    const kibo = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 1.25, 24), moduleMat);
    kibo.rotation.z = Math.PI / 2;
    kibo.position.set(-0.88, -0.22, 1.95);
    model.add(kibo);

    // Kibo Exposed Facility (EF "Porch")
    const kiboPorch = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.16, 0.45), darkMetalMat);
    kiboPorch.position.set(-1.65, -0.22, 1.95);
    model.add(kiboPorch);

    // Quest Airlock - Attached Starboard of Unity
    const quest = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.6, 20), moduleMat);
    quest.rotation.z = Math.PI / 2;
    quest.position.set(0.52, -0.22, 0);
    model.add(quest);

    // Tranquility Node 3 - Attached Port of Unity
    const tranquility = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.6, 20), moduleMat);
    tranquility.rotation.z = Math.PI / 2;
    tranquility.position.set(-0.52, -0.22, 0);
    model.add(tranquility);

    // Cupola 7-Window Observation Dome (Facing Earth / Nadir)
    const cupolaBase = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.18, 0.14, 6), collarMat);
    cupolaBase.position.set(-0.52, -0.56, 0);
    model.add(cupolaBase);

    const cupolaGlass = new THREE.Mesh(
      new THREE.SphereGeometry(0.18, 6, 6, 0, Math.PI * 2, 0, Math.PI / 2),
      cupolaGlassMat
    );
    cupolaGlass.rotation.x = Math.PI;
    cupolaGlass.position.set(-0.52, -0.62, 0);
    model.add(cupolaGlass);

    // 5. Russian Orbital Segment (ROS)
    // Zarya (FGB) Module
    const zarya = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.95, 24), russianMat);
    zarya.rotation.x = Math.PI / 2;
    zarya.position.set(0, -0.22, -0.8);
    model.add(zarya);

    // Zarya Solar Wings (Port & Starboard)
    [-0.95, 0.95].forEach(x => {
      const zWing = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.015, 0.45), solarMat);
      zWing.position.set(x, -0.22, -0.8);
      model.add(zWing);
    });

    // Zvezda Service Module
    const zvezda = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.28, 1.15, 24), russianMat);
    zvezda.rotation.x = Math.PI / 2;
    zvezda.position.set(0, -0.22, -1.85);
    model.add(zvezda);

    // Zvezda Twin Engine Bells
    [-0.08, 0.08].forEach(x => {
      const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.09, 0.18, 16), darkMetalMat);
      nozzle.rotation.x = Math.PI / 2;
      nozzle.position.set(x, -0.22, -2.48);
      model.add(nozzle);
    });

    // Zvezda Solar Wings
    [-1.15, 1.15].forEach(x => {
      const zvWing = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.015, 0.5), solarMat);
      zvWing.position.set(x, -0.22, -1.85);
      model.add(zvWing);
    });

    // 6. Canadarm2 Robotic Arm (Mounted to Mobile Transporter on S0 truss)
    const armBase = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 12), collarMat);
    armBase.position.set(0.3, 0.15, 0.15);
    model.add(armBase);

    const armBoom1 = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.65, 12), collarMat);
    armBoom1.position.set(0.3, 0.45, 0.25);
    armBoom1.rotation.x = 0.4;
    model.add(armBoom1);

    const armElbow = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 12), darkMetalMat);
    armElbow.position.set(0.3, 0.72, 0.38);
    model.add(armElbow);

    const armBoom2 = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.65, 12), collarMat);
    armBoom2.position.set(0.3, 0.85, 0.7);
    armBoom2.rotation.x = 1.2;
    model.add(armBoom2);

    // 7. Docked Visiting Spacecraft (SpaceX Crew Dragon at Harmony forward IDA port)
    const dragonRing = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.08, 24), dockRingMat);
    dragonRing.rotation.x = Math.PI / 2;
    dragonRing.position.set(0, -0.22, 2.32);
    model.add(dragonRing);

    const dragonCapsule = new THREE.Mesh(new THREE.ConeGeometry(0.25, 0.45, 24), moduleMat);
    dragonCapsule.rotation.x = Math.PI / 2;
    dragonCapsule.position.set(0, -0.22, 2.6);
    model.add(dragonCapsule);

    const dragonTrunk = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.38, 24), darkMetalMat);
    dragonTrunk.rotation.x = Math.PI / 2;
    dragonTrunk.position.set(0, -0.22, 2.95);
    model.add(dragonTrunk);

    // ISS scale: 0.36x so the entire 109m complex is majestic and detailed
    model.scale.setScalar(0.36);

  } else if (satId === 'hst') {
    // =========================================================================
    // HUBBLE SPACE TELESCOPE (HST)
    // Silver Mylar Hull, Aperture Door Open 42°, Black Optical Baffle,
    // Gold Aft Equipment Shroud, Dual Solar Wings, and High-Gain Dishes
    // =========================================================================

    // Forward Shell (Silver Mylar MLI)
    const forwardTube = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.46, 2.2, 32), foilSilverMat);
    forwardTube.rotation.z = Math.PI / 2;
    model.add(forwardTube);

    // Aft Equipment Shroud (Gold Kapton MLI)
    const aftShroud = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.46, 0.95, 32), foilGoldMat);
    aftShroud.rotation.z = Math.PI / 2;
    aftShroud.position.x = -1.2;
    model.add(aftShroud);

    // Aperture Sunshade Door (Propped open at 42°)
    const door = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.48, 0.04, 32), foilSilverMat);
    door.position.set(1.15, 0.38, 0);
    door.rotation.z = Math.PI / 4.2;
    model.add(door);

    // Interior Optical Baffle (Pitch Black Velvet)
    const baffle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.4, 0.4, 0.35, 24, 1, true),
      new THREE.MeshBasicMaterial({ color: 0x010204, side: THREE.DoubleSide })
    );
    baffle.rotation.z = Math.PI / 2;
    baffle.position.x = 1.05;
    model.add(baffle);

    // Secondary Mirror Spider Support (Cross struts inside aperture)
    const spider1 = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.78, 0.015), darkMetalMat);
    spider1.position.x = 1.05;
    model.add(spider1);
    const spider2 = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.015, 0.78), darkMetalMat);
    spider2.position.x = 1.05;
    model.add(spider2);
    const secMirror = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.06, 16), darkMetalMat);
    secMirror.rotation.z = Math.PI / 2;
    secMirror.position.x = 1.05;
    model.add(secMirror);

    // Dual Articulated Solar Array Wings (SAW)
    [-1.45, 1.45].forEach(zPos => {
      // Bi-stem deployment boom
      const boom = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.85, 8), darkMetalMat);
      boom.rotation.x = Math.PI / 2;
      boom.position.set(0, 0, zPos * 0.4);
      model.add(boom);

      // Solar Panel
      const panel = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.015, 1.9), solarMat);
      panel.position.set(0, 0, zPos);
      model.add(panel);
    });

    // Dual High-Gain Dish Antennas (HGA) on articulated booms
    [-0.7, 0.7].forEach(ySign => {
      const dishMast = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.65, 8), darkMetalMat);
      dishMast.position.set(-0.8, ySign * 0.65, 0.35);
      dishMast.rotation.z = ySign * 0.6;
      model.add(dishMast);

      const dish = new THREE.Mesh(
        new THREE.SphereGeometry(0.28, 18, 18, 0, Math.PI * 2, 0, Math.PI / 3),
        foilSilverMat
      );
      dish.position.set(-0.95, ySign * 0.85, 0.45);
      dish.rotation.x = -Math.PI / 3;
      model.add(dish);
    });

    // Yellow EVA Handrails
    const railMat = new THREE.MeshBasicMaterial({ color: 0xfacc15 });
    [-0.4, -0.8, -1.2].forEach(x => {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.015, 0.4), railMat);
      rail.position.set(x, 0.54, 0);
      model.add(rail);
    });

    model.scale.setScalar(0.48);

  } else if (satId === 'tiangong') {
    // =========================================================================
    // TIANGONG SPACE STATION (CSS - China Space Station)
    // Authentic T-Shape: Tianhe Core Module, Wentian & Mengtian Lab Modules,
    // Flexible Solar Wings, Shenzhou Crew Capsule, and Tianzhou Resupply Craft
    // =========================================================================

    // 1. Tianhe Core Module (Central Along Z Axis)
    // Forward Spherical Docking Hub (4 berthing ports)
    const hub = new THREE.Mesh(new THREE.SphereGeometry(0.38, 20, 20), dockRingMat);
    hub.position.set(0, 0, 0.85);
    model.add(hub);

    // Working Compartment Cylinder
    const tianheBody = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 1.4, 24), moduleMat);
    tianheBody.rotation.x = Math.PI / 2;
    tianheBody.position.set(0, 0, 0);
    model.add(tianheBody);

    // Aft Service and Propulsion Section
    const tianheAft = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.42, 0.7, 24), russianMat);
    tianheAft.rotation.x = Math.PI / 2;
    tianheAft.position.set(0, 0, -1.05);
    model.add(tianheAft);

    // 2. Wentian Laboratory Module (Docked Starboard along +X)
    const wentian = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 1.5, 24), moduleMat);
    wentian.rotation.z = Math.PI / 2;
    wentian.position.set(1.2, 0, 0.85);
    model.add(wentian);

    // Wentian Airlock Section
    const wentianAirlock = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.46, 0.4, 20), collarMat);
    wentianAirlock.rotation.z = Math.PI / 2;
    wentianAirlock.position.set(1.7, 0, 0.85);
    model.add(wentianAirlock);

    // Wentian Massive Flexible Solar Wing
    const wentianWing = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.015, 0.85), solarMat);
    wentianWing.position.set(2.85, 0, 0.85);
    model.add(wentianWing);

    // 3. Mengtian Laboratory Module (Docked Port along -X)
    const mengtian = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 1.5, 24), moduleMat);
    mengtian.rotation.z = Math.PI / 2;
    mengtian.position.set(-1.2, 0, 0.85);
    model.add(mengtian);

    // Mengtian Payload Airlock Hatch
    const mengtianAirlock = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.35, 0.35), darkMetalMat);
    mengtianAirlock.position.set(-1.7, 0, 0.85);
    model.add(mengtianAirlock);

    // Mengtian Massive Flexible Solar Wing
    const mengtianWing = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.015, 0.85), solarMat);
    mengtianWing.position.set(-2.85, 0, 0.85);
    model.add(mengtianWing);

    // 4. Shenzhou Crew Spacecraft (Docked Forward Axial Port)
    const shenzhouOrbital = new THREE.Mesh(new THREE.SphereGeometry(0.24, 16, 16), moduleMat);
    shenzhouOrbital.position.set(0, 0, 1.45);
    model.add(shenzhouOrbital);

    const shenzhouReentry = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.25, 0.28, 20), collarMat);
    shenzhouReentry.rotation.x = Math.PI / 2;
    shenzhouReentry.position.set(0, 0, 1.75);
    model.add(shenzhouReentry);

    const shenzhouService = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.38, 20), russianMat);
    shenzhouService.rotation.x = Math.PI / 2;
    shenzhouService.position.set(0, 0, 2.05);
    model.add(shenzhouService);

    // Shenzhou Solar Wings
    [-0.65, 0.65].forEach(x => {
      const szWing = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.015, 0.32), solarMat);
      szWing.position.set(x, 0, 2.05);
      model.add(szWing);
    });

    // 5. Tianzhou Cargo Resupply Craft (Docked Aft Port)
    const tianzhou = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.9, 24), moduleMat);
    tianzhou.rotation.x = Math.PI / 2;
    tianzhou.position.set(0, 0, -1.9);
    model.add(tianzhou);

    // Tianzhou Solar Wings
    [-0.85, 0.85].forEach(x => {
      const tzWing = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.015, 0.38), solarMat);
      tzWing.position.set(x, 0, -1.9);
      model.add(tzWing);
    });

    model.scale.setScalar(0.42);

  } else if (satId === 'lro' || satId === 'chandrayaan2') {
    // =========================================================================
    // LUNAR ORBITERS (LRO / CHANDRAYAAN-2)
    // Gold Kapton Foil Bus, High-Gain Steerable Dish, Laser Altimeter Optics,
    // Nadir Science Deck, Reaction Wheels, and Solar Arrays
    // =========================================================================

    // Octagonal Spacecraft Bus (Gold MLI Thermal Foil)
    const bus = new THREE.Mesh(new THREE.CylinderGeometry(0.58, 0.58, 1.05, 8), foilGoldMat);
    model.add(bus);

    // Top Equipment Deck
    const topDeck = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.08, 8), darkMetalMat);
    topDeck.position.y = 0.55;
    model.add(topDeck);

    // Bottom Instrument Deck (Nadir Facing - Points Toward Moon Surface)
    const instDeck = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.08, 8), darkMetalMat);
    instDeck.position.y = -0.55;
    model.add(instDeck);

    // High-Gain Parabolic Dish Antenna (Steerable Carbon Boom)
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.7, 8), darkMetalMat);
    mast.position.set(0, 0.75, 0.45);
    mast.rotation.x = 0.4;
    model.add(mast);

    const dish = new THREE.Mesh(
      new THREE.SphereGeometry(0.42, 20, 20, 0, Math.PI * 2, 0, Math.PI / 3),
      foilSilverMat
    );
    dish.position.set(0, 1.05, 0.65);
    dish.rotation.x = -Math.PI / 3.5;
    model.add(dish);

    // Cassegrain Feed Horn
    const feed = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.18, 12), darkMetalMat);
    feed.position.set(0, 1.15, 0.72);
    feed.rotation.x = -Math.PI / 3.5;
    model.add(feed);

    // Nadir Science Telescopes (LOLA Laser Altimeter / TMC-2 Cameras)
    const lolaBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 0.45, 16), darkMetalMat);
    lolaBarrel.position.set(0.18, -0.75, 0.15);
    model.add(lolaBarrel);

    const lolaLens = new THREE.Mesh(
      new THREE.CircleGeometry(0.11, 16),
      new THREE.MeshBasicMaterial({ color: 0x38bdf8 })
    );
    lolaLens.rotation.x = Math.PI / 2;
    lolaLens.position.set(0.18, -0.98, 0.15);
    model.add(lolaLens);

    // SAR Radar Boom / Sensor Tube
    const sarBoom = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.5, 0.12), collarMat);
    sarBoom.position.set(-0.2, -0.75, -0.15);
    model.add(sarBoom);

    // Articulated Solar Array Wing (Angled Sunward)
    const yoke = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.55, 8), darkMetalMat);
    yoke.rotation.z = Math.PI / 2;
    yoke.position.set(0.75, 0, 0);
    model.add(yoke);

    const wing = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.015, 0.92), solarMat);
    wing.position.set(1.85, 0, 0);
    model.add(wing);

    // 4 RCS Thruster Pods (At Bus Corners)
    [[0.45, 0.45], [0.45, -0.45], [-0.45, 0.45], [-0.45, -0.45]].forEach(([x, z]) => {
      const pod = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), collarMat);
      pod.position.set(x, 0, z);
      model.add(pod);

      const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.04, 0.08, 8), darkMetalMat);
      nozzle.position.set(x * 1.15, -0.06, z * 1.15);
      model.add(nozzle);
    });

    model.scale.setScalar(0.55);

  } else if (satId === 'starlink') {
    // =========================================================================
    // STARLINK SATELLITE
    // Flat-Pack Composite Chassis, Earth-Facing Phased Array Antennas,
    // Optical Laser Crosslinks, Single Solar Array, and Krypton Ion Thruster
    // =========================================================================

    // Flat Spacecraft Bus
    const bus = new THREE.Mesh(new THREE.BoxGeometry(1.85, 0.1, 0.92), darkMetalMat);
    model.add(bus);

    // Phased Array Antenna Matrix (Nadir Surface Facing Earth)
    const antennaPanel = new THREE.Mesh(
      new THREE.PlaneGeometry(1.7, 0.8),
      new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.25, metalness: 0.9 })
    );
    antennaPanel.rotation.x = Math.PI / 2;
    antennaPanel.position.set(0, -0.055, 0);
    model.add(antennaPanel);

    // Inter-Satellite Laser Link Domes (Optical ISL)
    [-0.85, 0.85].forEach(x => {
      const laserDome = new THREE.Mesh(
        new THREE.SphereGeometry(0.06, 12, 12),
        new THREE.MeshBasicMaterial({ color: 0x38bdf8 })
      );
      laserDome.position.set(x, 0.05, 0);
      model.add(laserDome);
    });

    // Single Expansive Solar Array Wing
    const wingYoke = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.45, 8), collarMat);
    wingYoke.rotation.z = Math.PI / 2;
    wingYoke.position.set(1.15, 0, 0);
    model.add(wingYoke);

    const wing = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.015, 0.92), solarMat);
    wing.position.set(2.85, 0, 0);
    model.add(wing);

    // Krypton Hall-Effect Ion Propulsion Thruster
    const thrusterBell = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.14, 0.22, 20), darkMetalMat);
    thrusterBell.rotation.z = Math.PI / 2;
    thrusterBell.position.set(-1.0, 0, 0);
    model.add(thrusterBell);

    // Glowing Cyan Ion Plasma Exhaust Glow
    const plasmaGlow = new THREE.Mesh(
      new THREE.RingGeometry(0.02, 0.13, 20),
      new THREE.MeshBasicMaterial({ color: 0x38bdf8, side: THREE.DoubleSide })
    );
    plasmaGlow.rotation.y = Math.PI / 2;
    plasmaGlow.position.set(-1.12, 0, 0);
    model.add(plasmaGlow);

    model.scale.setScalar(0.48);

  } else if (satId === 'jwst') {
    // =========================================================================
    // JAMES WEBB SPACE TELESCOPE (JWST)
    // 5-Layer Silver Sunshield, 18-Segment Gold Primary Mirror,
    // Secondary Mirror Tripod Mast, and Integrated Science Instrument Module
    // =========================================================================
    // 1. Kite-shaped 5-Layer Sunshield Membrane (Silver Foil)
    const sunshieldGeo = new THREE.BufferGeometry();
    // Kite vertices: front (0,0,2.6), back (0,0,-2.6), right (1.8,0,-0.3), left (-1.8,0,-0.3)
    const vertices = new Float32Array([
      // Front right triangle
      0, -0.05, 2.6,   1.8, -0.05, -0.3,   0, -0.05, -0.3,
      // Front left triangle
      0, -0.05, 2.6,   0, -0.05, -0.3,   -1.8, -0.05, -0.3,
      // Back right triangle
      0, -0.05, -0.3,   1.8, -0.05, -0.3,   0, -0.05, -2.6,
      // Back left triangle
      0, -0.05, -0.3,   0, -0.05, -2.6,   -1.8, -0.05, -0.3
    ]);
    sunshieldGeo.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
    sunshieldGeo.computeVertexNormals();
    const sunshieldMesh = new THREE.Mesh(sunshieldGeo, foilSilverMat);
    model.add(sunshieldMesh);

    // 2. Spacecraft Bus & Solar Array under sunshield
    const jwstBus = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.45, 0.8), darkMetalMat);
    jwstBus.position.set(0, -0.3, -0.6);
    model.add(jwstBus);

    const jwstSolar = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.02, 1.2), solarMat);
    jwstSolar.position.set(0, -0.4, -1.5);
    model.add(jwstSolar);

    // 3. Central Backplane & ISIM Structure (Carbon-composite dark tower)
    const backplane = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.35, 6), darkMetalMat);
    backplane.position.set(0, 0.25, 0);
    model.add(backplane);

    // 4. Iconic Gold Beryllium Primary Mirror (6.5m diameter equivalent, 18 Hex segments)
    const mirrorGroup = new THREE.Group();
    mirrorGroup.position.set(0, 0.55, 0);
    // Honeycomb pattern of gold hexagons
    const hexRadius = 0.28;
    const hexGeo = new THREE.CircleGeometry(hexRadius, 6);
    const hexMat = foilGoldMat;

    const hexPositions = [
      [0, 0],
      [hexRadius * 1.732, 0], [-hexRadius * 1.732, 0],
      [hexRadius * 0.866, hexRadius * 1.5], [-hexRadius * 0.866, hexRadius * 1.5],
      [hexRadius * 0.866, -hexRadius * 1.5], [-hexRadius * 0.866, -hexRadius * 1.5],
      [hexRadius * 2.598, hexRadius * 1.5], [-hexRadius * 2.598, hexRadius * 1.5],
      [hexRadius * 2.598, -hexRadius * 1.5], [-hexRadius * 2.598, -hexRadius * 1.5],
      [0, hexRadius * 3.0], [0, -hexRadius * 3.0],
      [hexRadius * 1.732, hexRadius * 3.0], [-hexRadius * 1.732, hexRadius * 3.0],
      [hexRadius * 1.732, -hexRadius * 3.0], [-hexRadius * 1.732, -hexRadius * 3.0],
      [hexRadius * 3.464, 0]
    ];

    hexPositions.forEach(([hx, hy]) => {
      const seg = new THREE.Mesh(hexGeo, hexMat);
      seg.position.set(hx * 0.5, hy * 0.5, 0);
      seg.rotation.x = -Math.PI / 2;
      mirrorGroup.add(seg);
    });
    model.add(mirrorGroup);

    // 5. Secondary Mirror Support Tripod & Reflector
    const mastMat = collarMat;
    [-0.7, 0.7].forEach(x => {
      const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 1.8, 8), mastMat);
      strut.position.set(x * 0.6, 1.1, -0.4);
      strut.rotation.x = 0.55;
      strut.rotation.z = -x * 0.35;
      model.add(strut);
    });
    const topStrut = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 1.8, 8), mastMat);
    topStrut.position.set(0, 1.1, 0.6);
    topStrut.rotation.x = -0.55;
    model.add(topStrut);

    // Gold Secondary Mirror
    const secMirror = new THREE.Mesh(new THREE.CircleGeometry(0.12, 16), foilGoldMat);
    secMirror.position.set(0, 1.8, 0.05);
    secMirror.rotation.x = Math.PI / 2;
    model.add(secMirror);

    model.scale.setScalar(0.5);

  } else if (satId === 'terra') {
    // =========================================================================
    // TERRA EARTH SCIENCE SATELLITE (EOS-AM1)
    // Multi-Sensor Flagship (MODIS, ASTER, MISR, CERES, MOPITT)
    // =========================================================================
    const bus = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.1, 2.2), foilSilverMat);
    model.add(bus);

    // Thermal gold insulation panel
    const goldPanel = new THREE.Mesh(new THREE.PlaneGeometry(1.35, 2.1), foilGoldMat);
    goldPanel.rotation.x = -Math.PI / 2;
    goldPanel.position.set(0, 0.56, 0);
    model.add(goldPanel);

    // Earth-facing (nadir) instrument deck
    const instDeck = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.2, 2.0), darkMetalMat);
    instDeck.position.set(0, -0.6, 0);
    model.add(instDeck);

    // MODIS Optical Sensor Barrel (Earth scanning radiometer)
    const modis = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.45, 16), collarMat);
    modis.position.set(0.35, -0.85, 0.4);
    model.add(modis);

    // ASTER SWIR/TIR Sensor Turret
    const aster = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.35, 0.35), darkMetalMat);
    aster.position.set(-0.35, -0.8, -0.3);
    model.add(aster);

    // Large high-efficiency GaAs solar array wing
    const solarWing = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.02, 1.2), solarMat);
    solarWing.position.set(2.8, 0, 0);
    model.add(solarWing);

    // High Gain Antenna (HGA) Gimbal Dish
    const dish = new THREE.Mesh(new THREE.SphereGeometry(0.32, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), collarMat);
    dish.rotation.x = Math.PI;
    dish.position.set(-0.85, 0.3, -0.8);
    model.add(dish);

    model.scale.setScalar(0.48);

  } else if (satId === 'gps-iir') {
    // =========================================================================
    // GPS BLOCK IIR-M NAVIGATION SATELLITE
    // Medium Earth Orbit, L-Band Phased Antenna Array, Dual Solar Wings
    // =========================================================================
    // Golden Cubic Spacecraft Bus
    const bus = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.2, 1.2), foilGoldMat);
    model.add(bus);

    // Earth-facing Nadir Deck with L-Band Helical Antenna Matrix (12 elements)
    const nadirDeck = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.08, 1.1), darkMetalMat);
    nadirDeck.position.set(0, -0.64, 0);
    model.add(nadirDeck);

    // Helical antenna array elements
    [-0.35, 0, 0.35].forEach(x => {
      [-0.35, 0, 0.35].forEach(z => {
        const helix = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.32, 8), collarMat);
        helix.position.set(x, -0.82, z);
        model.add(helix);
      });
    });

    // Dual Solar Array Wings spanning +X and -X
    [-1, 1].forEach(side => {
      const yoke = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.5, 8), collarMat);
      yoke.rotation.z = Math.PI / 2;
      yoke.position.set(side * 0.85, 0, 0);
      model.add(yoke);

      const wing = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.02, 0.95), solarMat);
      wing.position.set(side * 2.5, 0, 0);
      model.add(wing);
    });

    // UHF Crosslink Antenna & Apogee Kick Motor
    const akm = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.32, 0.4, 16), darkMetalMat);
    akm.position.set(0, 0.8, 0);
    model.add(akm);

    model.scale.setScalar(0.48);

  } else {
    // =========================================================================
    // NOAA-20 / WEATHER SATELLITE (DEFAULT)
    // Multi-Instrument Earth Observer with Microwave Dishes & Gold Foil
    // =========================================================================
    const bus = new THREE.Mesh(new THREE.BoxGeometry(0.95, 1.35, 0.85), foilGoldMat);
    model.add(bus);

    const instPanel = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.12, 0.75), darkMetalMat);
    instPanel.position.set(0, -0.72, 0);
    model.add(instPanel);

    // Microwave Sounder Rotating Drum (ATMS)
    const atms = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.22, 16), collarMat);
    atms.position.set(0.2, -0.88, 0.15);
    model.add(atms);

    // Single Articulated Solar Array
    const wing = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.015, 0.95), solarMat);
    wing.position.set(1.85, 0, 0);
    model.add(wing);

    model.scale.setScalar(0.5);
  }

  craftModelMesh = model;
  craftGroup.add(craftModelMesh);
}

/**
 * VR Pop Display (Exact Replica of Website HUD Card #vr-telemetry-hud-card)
 * Semi-transparent dark glassmorphism, high contrast, positioned in right peripheral view
 */
function createVrPopCard() {
  vrPopCanvas = document.createElement('canvas');
  vrPopCanvas.width = 1024;
  vrPopCanvas.height = 700;
  vrPopCtx = vrPopCanvas.getContext('2d');
  vrPopTexture = new THREE.CanvasTexture(vrPopCanvas);

  const mat = new THREE.MeshBasicMaterial({
    map: vrPopTexture,
    transparent: true,
    opacity: 0.94,
    side: THREE.DoubleSide
  });

  vrPopCard = new THREE.Mesh(new THREE.PlaneGeometry(1.38, 0.94), mat);
  // Positioned in right peripheral view (never blocking the spacecraft or planets)
  vrPopCard.position.set(0.85, 0.28, -1.75);
  vrPopCard.rotation.set(0, -0.24, 0);
  vrPopCard.visible = false;

  drawVrPopCard();
}

/**
 * Handle VR Controller Grip / Squeeze Button (Toggle VR Pop Display)
 */
function onVRControllerSqueeze() {
  if (vrPopCard) {
    vrPopCard.visible = !vrPopCard.visible;
    console.log('[WebXR] Toggled VR Pop Display visibility:', vrPopCard.visible);
  }
}

/**
 * Render High-Contrast VR Pop Display (Exact Replica of Website Card)
 */
function drawVrPopCard() {
  if (!vrPopCtx || !vrPopTexture) return;

  const sat = SATELLITES[currentSatId] || SATELLITES['iss'];
  const isMoon = sat.body === 'moon';

  vrPopCtx.clearRect(0, 0, 1024, 700);

  // 1. Semi-Transparent Glassmorphic Card Background (Matches #vr-telemetry-hud-card)
  vrPopCtx.fillStyle = 'rgba(6, 12, 28, 0.84)';
  vrPopCtx.roundRect(10, 10, 1004, 680, 22);
  vrPopCtx.fill();

  // Glowing Cyan Neon Border
  vrPopCtx.strokeStyle = 'rgba(56, 189, 248, 0.85)';
  vrPopCtx.lineWidth = 3;
  vrPopCtx.stroke();

  // 2. Header Bar
  vrPopCtx.fillStyle = 'rgba(15, 23, 42, 0.92)';
  vrPopCtx.fillRect(14, 14, 996, 90);

  // Live SGP4 Badge
  vrPopCtx.fillStyle = '#0284c7';
  vrPopCtx.roundRect(32, 34, 130, 48, 8);
  vrPopCtx.fill();
  vrPopCtx.strokeStyle = '#38bdf8';
  vrPopCtx.lineWidth = 1.5;
  vrPopCtx.stroke();

  vrPopCtx.fillStyle = '#ffffff';
  vrPopCtx.font = 'bold 20px "Chakra Petch", sans-serif';
  vrPopCtx.fillText('LIVE SGP4', 45, 66);

  // Spacecraft Name
  vrPopCtx.fillStyle = '#ffffff';
  vrPopCtx.font = 'bold 30px "Chakra Petch", sans-serif';
  vrPopCtx.fillText(sat.name, 180, 68);

  // Pulsing Green Live Dot + Tracking indicator
  vrPopCtx.fillStyle = '#10b981';
  vrPopCtx.beginPath();
  vrPopCtx.arc(960, 58, 10, 0, Math.PI * 2);
  vrPopCtx.fill();

  vrPopCtx.font = 'bold 16px "JetBrains Mono", monospace';
  vrPopCtx.fillText('TRACKING', 860, 64);

  // 3. Four Metric Boxes (2x2 Grid)
  const drawCardBox = (label, val, unit, color, x, y, w, h) => {
    vrPopCtx.fillStyle = 'rgba(11, 20, 38, 0.85)';
    vrPopCtx.roundRect(x, y, w, h, 14);
    vrPopCtx.fill();
    vrPopCtx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
    vrPopCtx.lineWidth = 2;
    vrPopCtx.stroke();

    // Metric Label
    vrPopCtx.fillStyle = '#94a3b8';
    vrPopCtx.font = 'bold 18px "Chakra Petch", sans-serif';
    vrPopCtx.fillText(label, x + 20, y + 36);

    // Metric Value
    vrPopCtx.fillStyle = color;
    vrPopCtx.font = 'bold 38px "Chakra Petch", sans-serif';
    vrPopCtx.fillText(`${val} ${unit}`.trim(), x + 20, y + 88);
  };

  const alt = activeTelemetry.altitude !== undefined ? `${activeTelemetry.altitude}` : '418.5';
  const vel = activeTelemetry.velocity_kms !== undefined ? `${activeTelemetry.velocity_kms}` : '7.661';
  const lat = (activeTelemetry.latitude !== undefined ? Number(activeTelemetry.latitude).toFixed(4) : '2.7437') + '°';
  const lon = (activeTelemetry.longitude !== undefined ? Number(activeTelemetry.longitude).toFixed(4) : '85.6719') + '°';

  // Box 1: Altitude (Cyan)
  drawCardBox('ALTITUDE', alt, 'KM', '#38bdf8', 32, 125, 465, 115);
  // Box 2: Velocity (Neon Green)
  drawCardBox('VELOCITY', vel, 'KM/S', '#10b981', 525, 125, 465, 115);
  // Box 3: Latitude (Amber)
  drawCardBox('LATITUDE', lat, '', '#facc15', 32, 260, 465, 115);
  // Box 4: Longitude (Amber)
  drawCardBox('LONGITUDE', lon, '', '#facc15', 525, 260, 465, 115);

  // 4. Sub-Metrics Bar
  const isMoonText = isMoon ? 'LUNAR POLAR ORBIT' : 'LOW EARTH ORBIT (LEO)';
  const incText = activeTelemetry.inclination ? `${Number(activeTelemetry.inclination).toFixed(2)}°` : '51.64°';

  vrPopCtx.fillStyle = 'rgba(15, 23, 42, 0.75)';
  vrPopCtx.roundRect(32, 395, 465, 60, 10);
  vrPopCtx.fill();
  vrPopCtx.strokeStyle = 'rgba(56, 189, 248, 0.25)';
  vrPopCtx.lineWidth = 1;
  vrPopCtx.stroke();
  vrPopCtx.fillStyle = '#94a3b8';
  vrPopCtx.font = 'bold 16px "JetBrains Mono", monospace';
  vrPopCtx.fillText('REGIME: ' + isMoonText, 48, 432);

  vrPopCtx.fillStyle = 'rgba(15, 23, 42, 0.75)';
  vrPopCtx.roundRect(525, 395, 465, 60, 10);
  vrPopCtx.fill();
  vrPopCtx.strokeStyle = 'rgba(56, 189, 248, 0.25)';
  vrPopCtx.lineWidth = 1;
  vrPopCtx.stroke();
  vrPopCtx.fillStyle = '#94a3b8';
  vrPopCtx.font = 'bold 16px "JetBrains Mono", monospace';
  vrPopCtx.fillText('INCLINATION: ' + incText, 545, 432);

  // 5. VR Controls Hint Bar
  vrPopCtx.fillStyle = 'rgba(2, 6, 23, 0.85)';
  vrPopCtx.roundRect(32, 475, 960, 85, 12);
  vrPopCtx.fill();
  vrPopCtx.strokeStyle = 'rgba(56, 189, 248, 0.35)';
  vrPopCtx.lineWidth = 1.5;
  vrPopCtx.stroke();

  vrPopCtx.fillStyle = '#38bdf8';
  vrPopCtx.font = 'bold 18px "Chakra Petch", sans-serif';
  vrPopCtx.fillText('🎮 VR CONTROLS:', 52, 515);

  vrPopCtx.fillStyle = '#e2e8f0';
  vrPopCtx.font = '16px "Chakra Petch", sans-serif';
  vrPopCtx.fillText('Trigger: Next Craft  |  Grip: Hide/Show Card  |  Left Stick: Fly  |  Right Stick: 360° Rotate', 215, 515);

  vrPopCtx.fillStyle = '#94a3b8';
  vrPopCtx.font = '14px "JetBrains Mono", monospace';
  vrPopCtx.fillText('Spacecraft data synchronizes with NASA Open MCT real-time telemetry streams', 52, 542);

  // 6. Footer Clock Bar
  const nowUtc = new Date().toISOString().replace('T', ' ').substring(0, 19) + ' UTC';
  vrPopCtx.fillStyle = '#38bdf8';
  vrPopCtx.font = 'bold 16px "JetBrains Mono", monospace';
  vrPopCtx.fillText(`ANCHOR: ${isMoon ? 'MOON POLAR ORBIT' : 'EARTH LEO'}`, 48, 620);

  vrPopCtx.fillStyle = '#facc15';
  vrPopCtx.font = 'bold 16px "JetBrains Mono", monospace';
  vrPopCtx.fillText(`PROPAGATION: ${nowUtc}`, 640, 620);

  vrPopTexture.needsUpdate = true;
}

function drawHoloHUD() {
  drawVrPopCard();
}

/**
 * Handle Telemetry Message from WebSocket
 */
function onTelemetryMessage(event) {
  const detail = event.detail;
  if (!detail) return;

  const fleet = detail.fleet;
  const data = detail.data;

  if (fleet && fleet[currentSatId]) {
    const s = fleet[currentSatId];
    activeTelemetry = {
      ...activeTelemetry,
      ...s,
      timestamp: detail.timestamp || Date.now()
    };
  } else if (data) {
    const prefix = currentSatId;
    if (data[`${prefix}.orbit.altitude`]) activeTelemetry.altitude = data[`${prefix}.orbit.altitude`].value;
    if (data[`${prefix}.orbit.velocity_kms`]) activeTelemetry.velocity_kms = data[`${prefix}.orbit.velocity_kms`].value;
    if (data[`${prefix}.orbit.velocity_kmh`]) activeTelemetry.velocity_kmh = data[`${prefix}.orbit.velocity_kmh`].value;
    if (data[`${prefix}.orbit.latitude`]) activeTelemetry.latitude = data[`${prefix}.orbit.latitude`].value;
    if (data[`${prefix}.orbit.longitude`]) activeTelemetry.longitude = data[`${prefix}.orbit.longitude`].value;
    if (data[`${prefix}.solar.visibility`]) activeTelemetry.visibility = data[`${prefix}.solar.visibility`].value;
    activeTelemetry.timestamp = detail.timestamp || Date.now();
  }

  updateFastStripUI();
  drawHoloHUD();
}

/**
 * Synchronize Bottom Quick Dial Strip
 */
function updateFastStripUI() {
  const sat = SATELLITES[currentSatId];
  const isMoon = sat.body === 'moon';

  const dialAlt = document.getElementById('dial-alt');
  const dialVel = document.getElementById('dial-vel');
  const dialLat = document.getElementById('dial-lat');
  const dialLon = document.getElementById('dial-lon');
  const dialSolar = document.getElementById('dial-solar');

  if (dialAlt) dialAlt.innerText = `${activeTelemetry.altitude || '--'} km`;
  if (dialVel) dialVel.innerText = `${activeTelemetry.velocity_kms || '--'} km/s`;
  if (dialLat) dialLat.innerText = `${(activeTelemetry.latitude || 0).toFixed(4)}° ${isMoon ? '(Seleno)' : ''}`;
  if (dialLon) dialLon.innerText = `${(activeTelemetry.longitude || 0).toFixed(4)}° ${isMoon ? '(Seleno)' : ''}`;
  if (dialSolar) {
    dialSolar.innerText = activeTelemetry.visibility || 'DAYLIGHT';
    dialSolar.style.color = activeTelemetry.visibility === 'ECLIPSED' ? '#f43f5e' : '#facc15';
  }
}

/**
 * Set Camera Preset Target with Smooth Lerp
 */
function setCameraTarget(camPos, lookAt) {
  targetCameraPos.copy(camPos);
  targetLookAt.copy(lookAt);
  isTransitioningCamera = true;
}

/**
 * Switch Active Satellite in Real-Time
 */
export function selectSatellite(satId) {
  if (!SATELLITES[satId]) return;
  currentSatId = satId;
  window.currentSatId = satId;
  window.SATELLITES = SATELLITES;
  const sat = SATELLITES[satId];
  const isMoon = sat.body === 'moon';

  console.log(`[VR Engine] Switching primary craft to: ${sat.name}`);

  buildCraft3DModel(satId);
  createOrbitTrajectory();

  // Immediately zoom in and focus on the spacecraft!
  focusCraftView();

  const titleEl = document.querySelector('.vr-title');
  const subTitleEl = document.getElementById('openspace-anchor-label');
  if (titleEl) titleEl.innerText = `${sat.name} (NORAD #${sat.norad})`;
  if (subTitleEl) subTitleEl.innerText = `LIVE SGP4 REAL-TIME TELEMETRY | [${isMoon ? 'MOON ORBIT' : 'EARTH ORBIT'}]`;

  // Notify OpenSpace sync bridge
  window.dispatchEvent(new CustomEvent('satellite-changed', {
    detail: { satelliteId: satId, satellite: sat }
  }));

  drawHoloHUD();
}

/**
 * Camera Focus Presets & Celestial Navigation
 */
export function focusCraftView() {
  isTrackingCraft = true;
  currentFocusBody = 'craft';
  const sat = SATELLITES[currentSatId];
  const isMoon = sat && sat.body === 'moon';
  const centerPos = isMoon ? moonPos : earthPos;

  // Position camera 3.6 units away, looking down onto the craft
  const radial = new THREE.Vector3().subVectors(craftGroup.position, centerPos).normalize();
  const up = new THREE.Vector3(0, 1, 0);
  const side = new THREE.Vector3().crossVectors(radial, up).normalize();

  const camPos = new THREE.Vector3().copy(craftGroup.position)
    .addScaledVector(radial, 2.6)
    .addScaledVector(side, 3.0)
    .add(new THREE.Vector3(0, 1.6, 0));

  setCameraTarget(camPos, craftGroup.position);
  updateAnchorLabel('3D TARGET: ' + (sat ? sat.name.toUpperCase() : 'SPACECRAFT'));

  window.dispatchEvent(new CustomEvent('craft-focused', {
    detail: { satelliteId: currentSatId, satellite: sat }
  }));
}

function updateAnchorLabel(text) {
  const lbl = document.getElementById('openspace-anchor-label');
  if (lbl) lbl.innerText = text;
}

export function focusEarthView() {
  currentFocusBody = 'earth';
  isTrackingCraft = false;
  setCameraTarget(
    new THREE.Vector3(earthPos.x + 28, earthPos.y + 10, earthPos.z + 36),
    earthPos
  );
  updateAnchorLabel('3D TARGET: EARTH (BLUE MARBLE)');
  window.dispatchEvent(new CustomEvent('camera-focus-changed', { detail: { body: 'earth' } }));
}

export function focusMoonView() {
  currentFocusBody = 'moon';
  isTrackingCraft = false;
  setCameraTarget(
    new THREE.Vector3(moonPos.x + 10, moonPos.y + 4, moonPos.z + 14),
    moonPos
  );
  updateAnchorLabel('3D TARGET: MOON (LUNAR ORBIT)');
  window.dispatchEvent(new CustomEvent('camera-focus-changed', { detail: { body: 'moon' } }));
}

export function focusSunView() {
  currentFocusBody = 'sun';
  isTrackingCraft = false;
  setCameraTarget(
    new THREE.Vector3(120, 45, 150),
    SUN_POSITION
  );
  updateAnchorLabel('3D TARGET: SUN (SOLAR CORE)');
  window.dispatchEvent(new CustomEvent('camera-focus-changed', { detail: { body: 'sun' } }));
}

export function focusMercuryView() {
  currentFocusBody = 'mercury';
  isTrackingCraft = false;
  setCameraTarget(
    new THREE.Vector3(mercuryPos.x + 12, mercuryPos.y + 5, mercuryPos.z + 16),
    mercuryPos
  );
  updateAnchorLabel('3D TARGET: MERCURY');
  window.dispatchEvent(new CustomEvent('camera-focus-changed', { detail: { body: 'mercury' } }));
}

export function focusVenusView() {
  currentFocusBody = 'venus';
  isTrackingCraft = false;
  setCameraTarget(
    new THREE.Vector3(venusPos.x + 24, venusPos.y + 10, venusPos.z + 32),
    venusPos
  );
  updateAnchorLabel('3D TARGET: VENUS (SULFURIC CLOUDS)');
  window.dispatchEvent(new CustomEvent('camera-focus-changed', { detail: { body: 'venus' } }));
}

export function focusMarsView() {
  currentFocusBody = 'mars';
  isTrackingCraft = false;
  setCameraTarget(
    new THREE.Vector3(marsPos.x + 16, marsPos.y + 7, marsPos.z + 20),
    marsPos
  );
  updateAnchorLabel('3D TARGET: MARS & MOONS (PHOBOS & DEIMOS)');
  window.dispatchEvent(new CustomEvent('camera-focus-changed', { detail: { body: 'mars' } }));
}

export function focusAsteroidsView() {
  currentFocusBody = 'asteroids';
  isTrackingCraft = false;
  setCameraTarget(
    new THREE.Vector3(580, 120, 360),
    new THREE.Vector3(540, 0, 0)
  );
  updateAnchorLabel('3D TARGET: ASTEROID BELT');
  window.dispatchEvent(new CustomEvent('camera-focus-changed', { detail: { body: 'asteroids' } }));
}

export function focusJupiterView() {
  currentFocusBody = 'jupiter';
  isTrackingCraft = false;
  setCameraTarget(
    new THREE.Vector3(jupiterPos.x + 55, jupiterPos.y + 22, jupiterPos.z + 70),
    jupiterPos
  );
  updateAnchorLabel('3D TARGET: JUPITER & GALILEAN MOONS');
  window.dispatchEvent(new CustomEvent('camera-focus-changed', { detail: { body: 'jupiter' } }));
}

export function focusSaturnView() {
  currentFocusBody = 'saturn';
  isTrackingCraft = false;
  setCameraTarget(
    new THREE.Vector3(saturnPos.x + 48, saturnPos.y + 24, saturnPos.z + 60),
    saturnPos
  );
  updateAnchorLabel('3D TARGET: SATURN & CASSINI RINGS');
  window.dispatchEvent(new CustomEvent('camera-focus-changed', { detail: { body: 'saturn' } }));
}

export function focusUranusView() {
  currentFocusBody = 'uranus';
  isTrackingCraft = false;
  setCameraTarget(
    new THREE.Vector3(uranusPos.x + 40, uranusPos.y + 18, uranusPos.z + 52),
    uranusPos
  );
  updateAnchorLabel('3D TARGET: URANUS & RINGS');
  window.dispatchEvent(new CustomEvent('camera-focus-changed', { detail: { body: 'uranus' } }));
}

export function focusNeptuneView() {
  currentFocusBody = 'neptune';
  isTrackingCraft = false;
  setCameraTarget(
    new THREE.Vector3(neptunePos.x + 36, neptunePos.y + 16, neptunePos.z + 46),
    neptunePos
  );
  updateAnchorLabel('3D TARGET: NEPTUNE (VOYAGER 2)');
  window.dispatchEvent(new CustomEvent('camera-focus-changed', { detail: { body: 'neptune' } }));
}

/**
 * Window Resize
 */
function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

/**
 * Main WebXR Animation Loop (60-90 FPS)
 */
let lastRenderTime = 0;

function render(timestamp, frame) {
  if (!lastRenderTime) lastRenderTime = timestamp;
  const dt = Math.min((timestamp - lastRenderTime) * 0.001, 0.1);
  lastRenderTime = timestamp;
  const timeSec = timestamp * 0.001;

  // 1. Slow, Majestic Keplerian Orbital Revolution of Planets around Sun
  const orbRate = 0.042; // Calm pedagogical orbital movement — slow & majestic
  Object.keys(ORBIT_PARAMS).forEach(key => {
    planetAngles[key] += dt * ORBIT_PARAMS[key].speed * orbRate;
  });

  // Update dynamic planet positions along Keplerian ellipses
  mercuryPos.copy(getKeplerianPos('mercury', planetAngles.mercury));
  if (mercuryGroup) {
    mercuryGroup.position.copy(mercuryPos);
    if (mercuryMesh) mercuryMesh.rotation.y = timeSec * 0.008;
  }

  venusPos.copy(getKeplerianPos('venus', planetAngles.venus));
  if (venusGroup) {
    venusGroup.position.copy(venusPos);
    if (venusMesh) venusMesh.rotation.y = -timeSec * 0.004; // Retrograde
  }

  earthPos.copy(getKeplerianPos('earth', planetAngles.earth));
  if (earthGroup) {
    earthGroup.position.copy(earthPos);
    if (earthMesh) {
      earthMesh.rotation.y = timeSec * 0.015;
      earthMesh.material.uniforms.uSunDirection.value.copy(SUN_POSITION).sub(earthPos).normalize();
    }
    if (cloudsMesh) cloudsMesh.rotation.y = timeSec * 0.018;
  }

  // Moon orbits Earth at calm, majestic pace
  const moonTheta = timeSec * 0.015;
  moonPos.set(
    earthPos.x + Math.cos(moonTheta) * 36.0,
    earthPos.y,
    earthPos.z + Math.sin(moonTheta) * 36.0
  );
  if (moonGroup) {
    moonGroup.position.copy(moonPos);
    if (moonMesh) moonMesh.rotation.y = timeSec * 0.005;
  }
  if (moonOrbitLine) {
    moonOrbitLine.position.copy(earthPos);
  }

  marsPos.copy(getKeplerianPos('mars', planetAngles.mars));
  if (marsGroup) {
    marsGroup.position.copy(marsPos);
    if (marsMesh) marsMesh.rotation.y = timeSec * 0.014;
    // Mars moons: calmed down from fast spin to graceful gentle orbit
    if (phobosMesh && deimosMesh) {
      phobosMesh.position.set(Math.cos(timeSec * 0.045) * 13.0, 0, Math.sin(timeSec * 0.045) * 13.0);
      deimosMesh.position.set(Math.cos(timeSec * 0.022) * 19.0, 0, Math.sin(timeSec * 0.022) * 19.0);
    }
  }

  // Asteroid Belt gentle drift
  if (asteroidBeltGroup) {
    asteroidBeltGroup.rotation.y = timeSec * 0.002;
  }

  jupiterPos.copy(getKeplerianPos('jupiter', planetAngles.jupiter));
  if (jupiterGroup) {
    jupiterGroup.position.copy(jupiterPos);
    if (jupiterMesh) jupiterMesh.rotation.y = timeSec * 0.018;
    // Jupiter 4 Galilean Moons: calmed down from dizzying speeds to realistic majestic orbits
    if (ioMesh && europaMesh && ganymedeMesh && callistoMesh) {
      ioMesh.position.set(Math.cos(timeSec * 0.035) * 48, 0, Math.sin(timeSec * 0.035) * 48);
      europaMesh.position.set(Math.cos(timeSec * 0.024) * 58, 0, Math.sin(timeSec * 0.024) * 58);
      ganymedeMesh.position.set(Math.cos(timeSec * 0.016) * 72, 0, Math.sin(timeSec * 0.016) * 72);
      callistoMesh.position.set(Math.cos(timeSec * 0.010) * 88, 0, Math.sin(timeSec * 0.010) * 88);
    }
  }

  saturnPos.copy(getKeplerianPos('saturn', planetAngles.saturn));
  if (saturnGroup) {
    saturnGroup.position.copy(saturnPos);
    if (saturnMesh) saturnMesh.rotation.y = timeSec * 0.015;
    // Titan Moon calmed down
    if (titanMesh) {
      titanMesh.position.set(Math.cos(timeSec * 0.018) * 70, Math.sin(timeSec * 0.018) * 12, Math.sin(timeSec * 0.018) * 70);
    }
  }

  uranusPos.copy(getKeplerianPos('uranus', planetAngles.uranus));
  if (uranusGroup) {
    uranusGroup.position.copy(uranusPos);
    if (uranusMesh) uranusMesh.rotation.y = timeSec * 0.012;
  }

  neptunePos.copy(getKeplerianPos('neptune', planetAngles.neptune));
  if (neptuneGroup) {
    neptuneGroup.position.copy(neptunePos);
    if (neptuneMesh) neptuneMesh.rotation.y = timeSec * 0.010;
    if (tritonMesh) {
      tritonMesh.position.set(Math.cos(-timeSec * 0.020) * 45, Math.sin(timeSec * 0.015) * 8, Math.sin(-timeSec * 0.020) * 45);
    }
  }

  // Solar Core & Corona
  if (sunMesh) sunMesh.rotation.y = timeSec * 0.002;
  if (sunCoronaMesh) {
    sunCoronaMesh.lookAt(camera.position);
    sunCoronaMesh.scale.setScalar(1.0 + Math.sin(timeSec * 2.5) * 0.03);
  }

  // 2. Spacecraft Fleet Orbital Velocity around Earth / Moon
  const sat = SATELLITES[currentSatId];
  const isMoon = sat.body === 'moon';
  const centerPos = isMoon ? moonPos : earthPos;
  const baseR = (isMoon ? MOON_RADIUS : EARTH_RADIUS) + sat.altScale;

  // Visible, smooth, continuous revolution (approx. 2-3 degrees/sec)
  const orbitSpeed = isMoon ? 0.045 : 0.032;
  const currentTheta = (timeSec * orbitSpeed);
  const incRad = THREE.MathUtils.degToRad(sat.inclination);

  const localX = baseR * Math.cos(currentTheta);
  const localY = baseR * Math.sin(currentTheta) * Math.sin(incRad);
  const localZ = baseR * Math.sin(currentTheta) * Math.cos(incRad);

  craftGroup.position.set(centerPos.x + localX, centerPos.y + localY, centerPos.z + localZ);
  craftGroup.lookAt(centerPos); // Nadir pointing

  // Synchronize 3D orbit trajectory line position with moving body!
  if (orbitLine) {
    orbitLine.position.copy(centerPos);
  }

  // HUD Planes gently face the camera orientation so they are ALWAYS 100% readable!
  if (hudPlane1 && hudPlane2) {
    hudPlane1.quaternion.copy(camera.quaternion);
    hudPlane2.quaternion.copy(camera.quaternion);
  }

  // 3. Sub-Satellite Laser Pointer & Pulsing Surface Target Ring
  const dirToCenter = new THREE.Vector3().subVectors(centerPos, craftGroup.position).normalize();
  const groundPoint = new THREE.Vector3().copy(craftGroup.position).addScaledVector(dirToCenter, sat.altScale);

  if (groundTargetRing) {
    groundTargetRing.position.copy(groundPoint);
    groundTargetRing.lookAt(craftGroup.position);
    groundTargetRing.scale.setScalar(1.0 + Math.sin(timeSec * 3) * 0.12);
  }

  // 4. Smooth Camera Transition & Celestial Body Tracking
  if (isTransitioningCamera && controls) {
    if (isTrackingCraft && craftGroup) {
      targetLookAt.copy(craftGroup.position);
    }
    const dist = camera.position.distanceTo(targetCameraPos);
    const lerpFactor = Math.min(0.12, Math.max(0.08, dist * 0.0003));
    controls.target.lerp(targetLookAt, lerpFactor);
    camera.position.lerp(targetCameraPos, lerpFactor);
    if (dist < 1.5 && controls.target.distanceTo(targetLookAt) < 1.5) {
      camera.position.copy(targetCameraPos);
      controls.target.copy(targetLookAt);
      isTransitioningCamera = false;
    }
  } else if (isTrackingCraft && controls) {
    const delta = new THREE.Vector3().subVectors(craftGroup.position, controls.target);
    controls.target.copy(craftGroup.position);
    camera.position.add(delta);
  } else if (!isTransitioningCamera && controls) {
    // Keep camera smoothly anchored to the currently focused celestial body
    let anchorPos = null;
    if (currentFocusBody === 'mercury') anchorPos = mercuryPos;
    else if (currentFocusBody === 'venus') anchorPos = venusPos;
    else if (currentFocusBody === 'earth') anchorPos = earthPos;
    else if (currentFocusBody === 'moon') anchorPos = moonPos;
    else if (currentFocusBody === 'mars') anchorPos = marsPos;
    else if (currentFocusBody === 'jupiter') anchorPos = jupiterPos;
    else if (currentFocusBody === 'saturn') anchorPos = saturnPos;
    else if (currentFocusBody === 'uranus') anchorPos = uranusPos;
    else if (currentFocusBody === 'neptune') anchorPos = neptunePos;

    if (anchorPos) {
      const delta = new THREE.Vector3().subVectors(anchorPos, controls.target);
      controls.target.copy(anchorPos);
      camera.position.add(delta);
    }
  }

  // OrbitControls damping update
  if (controls) {
    controls.update();
  }

  // WebXR 6-DoF Flight & Smooth Rotation in Meta Quest / VR Headsets
  if (renderer.xr.isPresenting && cameraRig) {
    const session = renderer.xr.getSession();
    if (session && session.inputSources) {
      for (const source of session.inputSources) {
        if (source.gamepad && source.gamepad.axes) {
          const axes = source.gamepad.axes;
          // Standard WebXR Gamepad mapping: axes[2] is Thumbstick X, axes[3] is Thumbstick Y
          const stickX = axes.length >= 4 ? axes[2] : (axes[0] || 0);
          const stickY = axes.length >= 4 ? axes[3] : (axes[1] || 0);

          if (source.handedness === 'right') {
            // Right Thumbstick: Smooth 360° Rotation (Yaw) & Vertical Elevation (Up/Down)
            if (Math.abs(stickX) > 0.12) {
              cameraRig.rotation.y -= stickX * 0.04;
            }
            if (Math.abs(stickY) > 0.12) {
              cameraRig.position.y -= stickY * 0.45;
            }
          } else {
            // Left Thumbstick: Free Flight (Forward/Backward & Strafe Left/Right)
            if (Math.abs(stickX) > 0.12 || Math.abs(stickY) > 0.12) {
              const forward = new THREE.Vector3();
              camera.getWorldDirection(forward);
              const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();
              const flySpeed = 0.65;
              cameraRig.position.addScaledVector(forward, -stickY * flySpeed);
              cameraRig.position.addScaledVector(right, stickX * flySpeed);
            }
          }
        }
      }
    }
  }

  // 5. Render Scene
  renderer.render(scene, camera);
}

/**
 * Handle VR Controller Trigger Click (Cycle Spacecraft Target in VR)
 */
function onVRControllerSelect() {
  const satKeys = Object.keys(SATELLITES);
  const nextIdx = (satKeys.indexOf(currentSatId) + 1) % satKeys.length;
  console.log('[WebXR Controller] Trigger pulled! Switching to next target:', satKeys[nextIdx]);
  selectSatellite(satKeys[nextIdx]);
  if (vrPopCard) {
    vrPopCard.visible = true;
    drawVrPopCard();
  }
}

