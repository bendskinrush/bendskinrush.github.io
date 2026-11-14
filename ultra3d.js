(() => {
  'use strict';

  const LANE_WIDTH_3D = 2.65;
  const ROAD_WIDTH_3D = LANE_WIDTH_3D * 3 + 0.9;
  const ROAD_LENGTH_3D = 220;

  let canvas3d = null;
  let renderer = null;
  let scene = null;
  let camera = null;
  let supported = null;
  let initialized = false;

  // Dynamic environment & lights
  let sunLight = null;
  let roadTexture = null;
  let lateriteTexture = null;
  let roadMesh = null;
  let groundMesh = null;

  // Road target marker lines (Personal Best & Rival)
  let pbLineMesh = null;
  let rivalLineMesh = null;

  // First-person bike & articulated rider arms/gloves
  let bikeRoot = null;
  let steeringGroup = null;
  let rightBrakeLever = null;
  let rightFingersGroup = null;
  let rightLeverFingersGroup = null;
  let leftThumbPivot = null;
  let rightGripPivot = null;
  let leftArmGroup = null;
  let leftRestAnchor = null;
  let leftPumpAnchor = null;
  let shieldDomeGroup = null;
  let nitroFlameGroup = null;
  let magnetAuraGroup = null;
  let dashCanvas = null;
  let dashCtx = null;
  let dashTexture = null;
  let cockpitTankMat = null;
  let cockpitTrimMat = null;
  let currentQualityMode = 'ultra';
  let currentLiveryId = 'classic';

  // Full 3D Garage Bike Showroom state
  let garageRenderer = null;
  let garageScene = null;
  let garageCamera = null;
  let garageTurntable = null;
  let garageRafId = null;
  let garageDragActive = false;
  let garageLastPointerX = 0;
  let garageSpinSpeed = 0.55;
  let garageLiveryId = 'classic';

  // Pooled 3D scenery & entity meshes
  const propMeshMap = new WeakMap();
  const propActiveList = new Set();
  const entityMeshMap = new WeakMap();
  const entityActiveList = new Set();

  // Shared materials/textures cache for crisp 60fps performance
  const texCache = {};
  const matCache = {};

  function laneToWorldX(laneFloat) {
    return (laneFloat - 1) * LANE_WIDTH_3D;
  }

  function isSupported() {
    if (supported !== null) return supported;
    try {
      if (typeof window.THREE === 'undefined') {
        supported = false;
        return false;
      }
      const testCanvas = document.createElement('canvas');
      const gl =
        testCanvas.getContext('webgl2', { failIfMajorPerformanceCaveat: false }) ||
        testCanvas.getContext('webgl', { failIfMajorPerformanceCaveat: false }) ||
        testCanvas.getContext('experimental-webgl');
      supported = Boolean(gl);
    } catch {
      supported = false;
    }
    return supported;
  }

  function makeCanvasTexture(key, width, height, drawFn, repeatX = 1, repeatY = 1) {
    if (texCache[key]) return texCache[key];
    const c = document.createElement('canvas');
    c.width = width;
    c.height = height;
    const g = c.getContext('2d');
    drawFn(g, width, height);
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeatX, repeatY);
    tex.encoding = THREE.sRGBEncoding;
    tex.anisotropy = 4;
    texCache[key] = tex;
    return tex;
  }

  function buildProceduralTextures() {
    // Detailed realistic asphalt with aggregate speckles, lane tire wear, outer yellow lines & white dashes
    roadTexture = makeCanvasTexture(
      'asphalt',
      512,
      512,
      (g, w, h) => {
        g.fillStyle = '#1f2633';
        g.fillRect(0, 0, w, h);

        // Tire wear bands along the 3 lanes
        const laneCenters = [w * 0.21, w * 0.5, w * 0.79];
        laneCenters.forEach((cx) => {
          const trackGrad = g.createLinearGradient(cx - 46, 0, cx + 46, 0);
          trackGrad.addColorStop(0, 'rgba(15, 23, 42, 0)');
          trackGrad.addColorStop(0.5, 'rgba(9, 13, 22, 0.34)');
          trackGrad.addColorStop(1, 'rgba(15, 23, 42, 0)');
          g.fillStyle = trackGrad;
          g.fillRect(cx - 46, 0, 92, h);
        });

        // Subtle asphalt grain
        for (let i = 0; i < 4200; i += 1) {
          const px = (i * 197) % w;
          const py = (i * 353) % h;
          g.fillStyle = i % 3 === 0 ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.14)';
          g.fillRect(px, py, 2, 2);
        }

        // Shoulder yellow edge stripes
        g.fillStyle = '#eab308';
        g.fillRect(14, 0, 10, h);
        g.fillRect(w - 24, 0, 10, h);

        // Dashed white lane dividers (between 3 lanes)
        const divX1 = Math.round(w * 0.355);
        const divX2 = Math.round(w * 0.645);
        g.fillStyle = '#f8fafc';
        for (let dy = 24; dy < h; dy += 128) {
          g.fillRect(divX1 - 4, dy, 8, 68);
          g.fillRect(divX2 - 4, dy, 8, 68);
        }
      },
      1,
      ROAD_LENGTH_3D / 14
    );

    lateriteTexture = makeCanvasTexture(
      'laterite',
      256,
      256,
      (g, w, h) => {
        g.fillStyle = '#5c2c16';
        g.fillRect(0, 0, w, h);
        for (let i = 0; i < 1600; i += 1) {
          const px = (i * 131) % w;
          const py = (i * 277) % h;
          g.fillStyle = i % 2 === 0 ? 'rgba(120, 53, 15, 0.35)' : 'rgba(22, 101, 52, 0.16)';
          g.fillRect(px, py, 3, 3);
        }
      },
      14,
      ROAD_LENGTH_3D / 8
    );

    texCache.buildingFacade = makeCanvasTexture(
      'building',
      256,
      512,
      (g, w, h) => {
        g.fillStyle = '#1e293b';
        g.fillRect(0, 0, w, h);
        for (let row = 24; row < h - 24; row += 42) {
          for (let col = 18; col < w - 18; col += 38) {
            const lit = ((row * 7 + col * 13) % 11) > 4;
            g.fillStyle = lit ? '#fde68a' : '#0f172a';
            g.fillRect(col, row, 22, 26);
            g.strokeStyle = '#334155';
            g.lineWidth = 2;
            g.strokeRect(col, row, 22, 26);
          }
        }
      },
      1,
      1
    );

    texCache.barrierStripe = makeCanvasTexture(
      'barrier',
      256,
      64,
      (g, w, h) => {
        g.fillStyle = '#f8fafc';
        g.fillRect(0, 0, w, h);
        g.fillStyle = '#dc2626';
        for (let x = -32; x < w + 32; x += 48) {
          g.beginPath();
          g.moveTo(x, h);
          g.lineTo(x + 24, h);
          g.lineTo(x + 42, 0);
          g.lineTo(x + 18, 0);
          g.closePath();
          g.fill();
        }
      },
      1,
      1
    );
  }

  function createSkyDome() {
    const skyGeo = new THREE.SphereGeometry(260, 24, 16);
    const skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        topColor: { value: new THREE.Color('#091326') },
        midColor: { value: new THREE.Color('#1e293b') },
        horizonColor: { value: new THREE.Color('#f97316') },
        sunDir: { value: new THREE.Vector3(0, 0.14, -1).normalize() },
      },
      vertexShader: `
        varying vec3 vWorldPos;
        void main() {
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorldPos = wp.xyz;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: `
        uniform vec3 topColor;
        uniform vec3 midColor;
        uniform vec3 horizonColor;
        uniform vec3 sunDir;
        varying vec3 vWorldPos;
        void main() {
          vec3 dir = normalize(vWorldPos);
          float h = clamp(dir.y, 0.0, 1.0);
          vec3 col = mix(horizonColor, midColor, smoothstep(0.0, 0.22, h));
          col = mix(col, topColor, smoothstep(0.18, 0.72, h));
          float sunDot = max(dot(dir, sunDir), 0.0);
          col += vec3(1.0, 0.85, 0.45) * pow(sunDot, 22.0) * 0.75;
          col += vec3(1.0, 0.96, 0.85) * smoothstep(0.9965, 0.9992, sunDot);
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });
    const dome = new THREE.Mesh(skyGeo, skyMat);
    scene.add(dome);
  }

  function createEnvironment() {
    createSkyDome();

    scene.fog = new THREE.FogExp2('#9a3412', 0.0085);

    const hemi = new THREE.HemisphereLight('#fde68a', '#431407', 0.92);
    scene.add(hemi);

    sunLight = new THREE.DirectionalLight('#fff1d0', 1.48);
    sunLight.position.set(14, 24, -40);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.bias = -0.0005;
    sunLight.shadow.camera.near = 2;
    sunLight.shadow.camera.far = 140;
    sunLight.shadow.camera.left = -22;
    sunLight.shadow.camera.right = 22;
    sunLight.shadow.camera.top = 50;
    sunLight.shadow.camera.bottom = -20;
    scene.add(sunLight);

    const fillLight = new THREE.DirectionalLight('#38bdf8', 0.35);
    fillLight.position.set(-10, 8, 12);
    scene.add(fillLight);

    // Asphalt highway mesh
    const roadGeo = new THREE.PlaneGeometry(ROAD_WIDTH_3D, ROAD_LENGTH_3D);
    const roadMat = new THREE.MeshStandardMaterial({
      map: roadTexture,
      roughness: 0.78,
      metalness: 0.08,
    });
    roadMesh = new THREE.Mesh(roadGeo, roadMat);
    roadMesh.rotation.x = -Math.PI / 2;
    roadMesh.position.set(0, 0, -ROAD_LENGTH_3D * 0.5 + 16);
    roadMesh.receiveShadow = true;
    scene.add(roadMesh);

    // Raised concrete curbs left & right
    const curbGeo = new THREE.BoxGeometry(0.45, 0.22, ROAD_LENGTH_3D);
    const curbMat = new THREE.MeshStandardMaterial({ color: '#94a3b8', roughness: 0.8 });
    [-1, 1].forEach((side) => {
      const curb = new THREE.Mesh(curbGeo, curbMat);
      curb.position.set(side * (ROAD_WIDTH_3D * 0.5 + 0.22), 0.11, -ROAD_LENGTH_3D * 0.5 + 16);
      curb.receiveShadow = true;
      scene.add(curb);
    });

    // Laterite red-earth ground plane
    const groundGeo = new THREE.PlaneGeometry(180, ROAD_LENGTH_3D);
    const groundMat = new THREE.MeshStandardMaterial({
      map: lateriteTexture,
      roughness: 0.95,
      metalness: 0.02,
    });
    groundMesh = new THREE.Mesh(groundGeo, groundMat);
    groundMesh.rotation.x = -Math.PI / 2;
    groundMesh.position.set(0, -0.02, -ROAD_LENGTH_3D * 0.5 + 16);
    groundMesh.receiveShadow = true;
    scene.add(groundMesh);

    // Target marker strips on asphalt
    const lineGeo = new THREE.PlaneGeometry(ROAD_WIDTH_3D - 0.5, 0.6);
    pbLineMesh = new THREE.Mesh(
      lineGeo,
      new THREE.MeshBasicMaterial({ color: '#22c55e', transparent: true, opacity: 0.85 })
    );
    pbLineMesh.rotation.x = -Math.PI / 2;
    pbLineMesh.position.y = 0.02;
    pbLineMesh.visible = false;
    scene.add(pbLineMesh);

    rivalLineMesh = new THREE.Mesh(
      lineGeo,
      new THREE.MeshBasicMaterial({ color: '#f43f5e', transparent: true, opacity: 0.88 })
    );
    rivalLineMesh.rotation.x = -Math.PI / 2;
    rivalLineMesh.position.y = 0.025;
    rivalLineMesh.visible = false;
    scene.add(rivalLineMesh);
  }

  const BIKE_LIVERIES = {
    classic: {
      name: 'Bendskin Classic 125',
      paint: '#b91c1c',
      trim: '#eab308',
      frame: '#1e293b',
      seat: '#111827',
      stripe: '#facc15',
    },
    sport: {
      name: 'Okada Sport 250',
      paint: '#0284c7',
      trim: '#e2e8f0',
      frame: '#0f172a',
      seat: '#1e293b',
      stripe: '#38bdf8',
    },
    superbike: {
      name: 'Douala Superbike 600',
      paint: '#eab308',
      trim: '#0f172a',
      frame: '#334155',
      seat: '#090d16',
      stripe: '#ef4444',
    },
  };

  function getBikeLivery(bikeId) {
    return BIKE_LIVERIES[bikeId] || BIKE_LIVERIES.classic;
  }

  function buildArticulatedHandAndArm(side) {
    // side = -1 (left) | +1 (right)
    const arm = new THREE.Group();

    const jacketMat = new THREE.MeshStandardMaterial({
      color: '#1e293b',
      roughness: 0.68,
      metalness: 0.14,
    });
    const leatherMat = new THREE.MeshStandardMaterial({
      color: '#0f172a',
      roughness: 0.42,
      metalness: 0.22,
    });
    const carbonKnuckleMat = new THREE.MeshStandardMaterial({
      color: '#334155',
      roughness: 0.2,
      metalness: 0.78,
    });
    const accentMat = new THREE.MeshStandardMaterial({
      color: side === 1 ? '#ef4444' : '#facc15',
      roughness: 0.32,
      metalness: 0.28,
    });
    const stripeMat = new THREE.MeshStandardMaterial({
      color: '#cbd5e1',
      roughness: 0.28,
      metalness: 0.65,
    });
    const skinMat = new THREE.MeshStandardMaterial({
      color: '#5c3824',
      roughness: 0.56,
      metalness: 0.04,
    });
    const palmSkinMat = new THREE.MeshStandardMaterial({
      color: '#734832',
      roughness: 0.62,
      metalness: 0.03,
    });
    const nailMat = new THREE.MeshStandardMaterial({
      color: '#b88b72',
      roughness: 0.26,
      metalness: 0.08,
    });

    // Forearm coming toward rider shoulder with padded riding jacket ribbing
    const sleeveGeo = new THREE.CylinderGeometry(0.037, 0.048, 0.35, 14);
    const sleeve = new THREE.Mesh(sleeveGeo, jacketMat);
    sleeve.rotation.x = Math.PI * 0.42;
    sleeve.rotation.z = side * 0.26;
    sleeve.position.set(side * 0.056, -0.056, 0.175);
    arm.add(sleeve);

    // Wrist gauntlet strap & reflective pipings
    const cuffGeo = new THREE.CylinderGeometry(0.039, 0.04, 0.026, 14);
    const cuff = new THREE.Mesh(cuffGeo, stripeMat);
    cuff.rotation.x = Math.PI * 0.42;
    cuff.rotation.z = side * 0.26;
    cuff.position.set(side * 0.023, -0.013, 0.062);
    arm.add(cuff);

    const strap = new THREE.Mesh(new THREE.BoxGeometry(0.064, 0.015, 0.022), leatherMat);
    strap.position.set(side * 0.008, 0.012, 0.046);
    arm.add(strap);

    // Glove wrist & palm resting over the handlebar grip (fingerless tactile sport glove)
    const gloveAnchor = new THREE.Group();
    arm.add(gloveAnchor);

    const palm = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.03, 0.068), leatherMat);
    palm.position.set(0, 0.022, 0.013);
    gloveAnchor.add(palm);

    // Lower visible heel of hand
    const palmPad = new THREE.Mesh(new THREE.BoxGeometry(0.072, 0.01, 0.048), palmSkinMat);
    palmPad.position.set(0, 0.007, 0.016);
    gloveAnchor.add(palmPad);

    // Molded carbon knuckle armor bridge across 4 fingers
    const knuckle = new THREE.Mesh(new THREE.BoxGeometry(0.082, 0.016, 0.025), carbonKnuckleMat);
    knuckle.position.set(0, 0.038, -0.009);
    knuckle.rotation.x = 0.22;
    gloveAnchor.add(knuckle);

    // Stitched accent band + buckle detail on back of glove
    const band = new THREE.Mesh(new THREE.BoxGeometry(0.068, 0.008, 0.012), accentMat);
    band.position.set(0, 0.039, 0.019);
    gloveAnchor.add(band);

    // Articulated bare Thumb (proximal + distal + nail) capable of pressing HORN button
    const thumbPivot = new THREE.Group();
    thumbPivot.position.set(-side * 0.042, 0.014, -0.004);
    const thumbProx = new THREE.Mesh(new THREE.CylinderGeometry(0.0095, 0.011, 0.032, 10), skinMat);
    thumbProx.rotation.z = side * 1.15;
    thumbProx.rotation.x = -0.32;
    thumbProx.position.set(-side * 0.014, -0.005, -0.004);
    thumbPivot.add(thumbProx);

    const thumbDist = new THREE.Mesh(new THREE.CylinderGeometry(0.0078, 0.0092, 0.026, 10), skinMat);
    thumbDist.rotation.z = side * 0.72;
    thumbDist.rotation.x = -0.45;
    thumbDist.position.set(-side * 0.028, -0.012, -0.011);
    thumbPivot.add(thumbDist);

    const thumbNail = new THREE.Mesh(new THREE.BoxGeometry(0.009, 0.004, 0.011), nailMat);
    thumbNail.position.set(-side * 0.031, -0.005, -0.015);
    thumbPivot.add(thumbNail);
    gloveAnchor.add(thumbPivot);

    // Helper to build a visible 3-joint individual rider finger
    function makeFingerMesh(xOffset, lengthScale) {
      const fGroup = new THREE.Group();
      fGroup.position.set(xOffset, 0, 0);

      // Leather half-cut finger base ring + exposed bare knuckles/phalanges
      const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.0088, 0.0096, 0.014, 10), leatherMat);
      collar.rotation.x = 1.15;
      collar.position.set(0, -0.001, -0.006);
      fGroup.add(collar);

      const prox = new THREE.Mesh(
        new THREE.CylinderGeometry(0.008, 0.0088, 0.032 * lengthScale, 10),
        skinMat
      );
      prox.rotation.x = 1.24;
      prox.position.set(0, -0.006, -0.02 * lengthScale);
      fGroup.add(prox);

      const mid = new THREE.Mesh(
        new THREE.CylinderGeometry(0.0072, 0.008, 0.026 * lengthScale, 10),
        skinMat
      );
      mid.rotation.x = 2.08;
      mid.position.set(0, -0.018, -0.029 * lengthScale);
      fGroup.add(mid);

      const tip = new THREE.Mesh(
        new THREE.CylinderGeometry(0.0064, 0.0072, 0.022 * lengthScale, 10),
        skinMat
      );
      tip.rotation.x = 2.75;
      tip.position.set(0, -0.031, -0.026 * lengthScale);
      fGroup.add(tip);

      const nail = new THREE.Mesh(new THREE.BoxGeometry(0.0082, 0.0035, 0.009), nailMat);
      nail.rotation.x = 1.05;
      nail.position.set(0, -0.028, -0.031 * lengthScale);
      fGroup.add(nail);

      return fGroup;
    }

    // Separate lever-pulling fingers (index+middle on right) vs grip-holding fingers
    const fingersGroup = new THREE.Group();
    fingersGroup.position.set(0, 0.025, -0.02);

    const leverFingersGroup = new THREE.Group();
    leverFingersGroup.position.set(0, 0.025, -0.02);

    // Side = -1 Left hand: inner = +x (index at +0.028 -> pinky at -0.028)
    // Side = +1 Right hand: inner = -x (index at -0.028 -> pinky at +0.028)
    const fingerSpecs = [
      { idx: 0, slot: -side * 0.027, len: 1.0, isLever: true },   // Index
      { idx: 1, slot: -side * 0.009, len: 1.08, isLever: true },  // Middle
      { idx: 2, slot: side * 0.009, len: 0.98, isLever: false },  // Ring
      { idx: 3, slot: side * 0.027, len: 0.82, isLever: false },  // Little
    ];

    fingerSpecs.forEach((spec) => {
      const fMesh = makeFingerMesh(spec.slot, spec.len);
      if (side === 1 && spec.isLever) {
        // Right index & middle slightly poised forward toward brake lever
        fMesh.rotation.x = -0.22;
        leverFingersGroup.add(fMesh);
      } else {
        fingersGroup.add(fMesh);
      }
    });

    gloveAnchor.add(fingersGroup);
    gloveAnchor.add(leverFingersGroup);

    return { arm, gloveAnchor, fingersGroup, leverFingersGroup, thumbPivot };
  }

  function setCockpitLivery(bikeId) {
    currentLiveryId = BIKE_LIVERIES[bikeId] ? bikeId : 'classic';
    const liv = getBikeLivery(currentLiveryId);
    if (cockpitTankMat) {
      cockpitTankMat.color.set(liv.paint);
    }
    if (cockpitTrimMat) {
      cockpitTrimMat.color.set(liv.trim);
    }
  }

  function buildBikeCockpit() {
    bikeRoot = new THREE.Group();
    scene.add(bikeRoot);

    dashCanvas = document.createElement('canvas');
    dashCanvas.width = 512;
    dashCanvas.height = 512;
    dashCtx = dashCanvas.getContext('2d');
    dashTexture = new THREE.CanvasTexture(dashCanvas);
    dashTexture.encoding = THREE.sRGBEncoding;
    if (renderer && renderer.capabilities) {
      dashTexture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy() || 4);
    }

    const liv = getBikeLivery(currentLiveryId);
    cockpitTankMat = new THREE.MeshPhysicalMaterial({
      color: liv.paint,
      roughness: 0.16,
      metalness: 0.48,
      clearcoat: 1.0,
      clearcoatRoughness: 0.1,
    });
    cockpitTrimMat = new THREE.MeshStandardMaterial({
      color: liv.trim,
      roughness: 0.24,
      metalness: 0.88,
    });
    const chromeMetal = new THREE.MeshStandardMaterial({
      color: '#e2e8f0',
      roughness: 0.15,
      metalness: 0.94,
    });
    const darkMetal = new THREE.MeshStandardMaterial({
      color: '#1e293b',
      roughness: 0.42,
      metalness: 0.68,
    });
    const carbonMat = new THREE.MeshStandardMaterial({
      color: '#0f172a',
      roughness: 0.35,
      metalness: 0.52,
    });
    const rubberMat = new THREE.MeshStandardMaterial({
      color: '#090d16',
      roughness: 0.88,
      metalness: 0.05,
    });

    // Sculpted front fuel tank body & knee cutouts visible below bars
    const tankMain = new THREE.Mesh(new THREE.CylinderGeometry(0.145, 0.21, 0.52, 22), cockpitTankMat);
    tankMain.rotation.x = Math.PI * 0.44;
    tankMain.scale.set(1.24, 1, 0.72);
    tankMain.position.set(0, -0.16, 0.05);
    bikeRoot.add(tankMain);

    // Center tank stripe & brushed CNC aero filler cap
    const tankStripe = new THREE.Mesh(new THREE.BoxGeometry(0.058, 0.014, 0.41), cockpitTrimMat);
    tankStripe.position.set(0, -0.064, 0.04);
    tankStripe.rotation.x = 0.18;
    bikeRoot.add(tankStripe);

    const fuelCapRing = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.045, 0.016, 20), chromeMetal);
    fuelCapRing.position.set(0, -0.055, -0.02);
    bikeRoot.add(fuelCapRing);
    const fuelCapCore = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.02, 12), darkMetal);
    fuelCapCore.position.set(0, -0.054, -0.02);
    bikeRoot.add(fuelCapCore);

    // Steering triple-clamp + forks + nose cowling + twin-cluster dash + handlebars + arms
    steeringGroup = new THREE.Group();
    steeringGroup.position.set(0, 0.05, -0.36);
    bikeRoot.add(steeringGroup);

    // Dual upside-down gold/anodized front fork tubes + blue anodized preload caps
    [-1, 1].forEach((side) => {
      const fork = new THREE.Mesh(new THREE.CylinderGeometry(0.023, 0.025, 0.48, 14), cockpitTrimMat);
      fork.rotation.x = -0.36;
      fork.position.set(side * 0.095, -0.18, -0.08);
      steeringGroup.add(fork);

      const preloadCap = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.014, 6), chromeMetal);
      preloadCap.position.set(side * 0.095, 0.025, -0.018);
      steeringGroup.add(preloadCap);
    });

    // CNC upper triple tree bridge + center stem nut
    const clamp = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.026, 0.092), darkMetal);
    clamp.position.set(0, 0.014, -0.02);
    steeringGroup.add(clamp);
    const stemNut = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.016, 6), chromeMetal);
    stemNut.position.set(0, 0.028, -0.022);
    steeringGroup.add(stemNut);

    // Ignition cylinder & silver key inserted at center console
    const ignCyl = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.017, 0.024, 14), carbonMat);
    ignCyl.rotation.x = -0.32;
    ignCyl.position.set(0, 0.024, -0.052);
    steeringGroup.add(ignCyl);
    const ignKey = new THREE.Mesh(new THREE.BoxGeometry(0.005, 0.024, 0.018), rubberMat);
    ignKey.rotation.x = -0.32;
    ignKey.position.set(0, 0.039, -0.047);
    steeringGroup.add(ignKey);

    // Aerodynamic front nose cowling + dual white LED halo strips visible at screen bottom-front
    const noseFairing = new THREE.Mesh(
      new THREE.CylinderGeometry(0.185, 0.215, 0.26, 20, 1, true, Math.PI * 0.62, Math.PI * 0.76),
      cockpitTankMat
    );
    noseFairing.rotation.x = Math.PI * 0.42;
    noseFairing.position.set(0, 0.04, -0.11);
    steeringGroup.add(noseFairing);

    [-1, 1].forEach((side) => {
      const drlBar = new THREE.Mesh(
        new THREE.BoxGeometry(0.068, 0.008, 0.012),
        new THREE.MeshBasicMaterial({ color: '#e0f2fe' })
      );
      drlBar.position.set(side * 0.11, 0.088, -0.14);
      drlBar.rotation.z = -side * 0.28;
      drlBar.rotation.y = side * 0.22;
      steeringGroup.add(drlBar);
    });

    // Front mudguard fender tip visible down ahead in the lane
    const fender = new THREE.Mesh(
      new THREE.CylinderGeometry(0.11, 0.11, 0.125, 16, 1, false, -0.5, 1.0),
      cockpitTankMat
    );
    fender.rotation.z = Math.PI / 2;
    fender.rotation.x = 0.2;
    fender.position.set(0, -0.35, -0.22);
    steeringGroup.add(fender);

    // Handlebar central stem + swept tapered aluminum bars
    const barCenter = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.21, 12), chromeMetal);
    barCenter.rotation.z = Math.PI / 2;
    barCenter.position.set(0, 0.045, 0);
    steeringGroup.add(barCenter);

    // Smoke-tinted Brake Fluid Reservoir cup on Right master cylinder
    const cupStem = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.025, 8), darkMetal);
    cupStem.position.set(0.135, 0.056, -0.005);
    steeringGroup.add(cupStem);
    const fluidCup = new THREE.Mesh(
      new THREE.CylinderGeometry(0.017, 0.015, 0.03, 14),
      new THREE.MeshPhysicalMaterial({ color: '#d97706', transparent: true, opacity: 0.78, roughness: 0.15 })
    );
    fluidCup.position.set(0.135, 0.076, -0.008);
    steeringGroup.add(fluidCup);
    const cupCap = new THREE.Mesh(new THREE.CylinderGeometry(0.0185, 0.0185, 0.008, 14), rubberMat);
    cupCap.position.set(0.135, 0.093, -0.008);
    steeringGroup.add(cupCap);

    [-1, 1].forEach((side) => {
      const armBar = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.21, 12), chromeMetal);
      armBar.rotation.z = Math.PI / 2 + side * 0.16;
      armBar.rotation.y = -side * 0.2;
      armBar.position.set(side * 0.185, 0.025, 0.02);
      steeringGroup.add(armBar);

      // Bar-end CNC counterweight cap
      const barEnd = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.019, 0.022, 12), cockpitTrimMat);
      barEnd.rotation.z = Math.PI / 2 + side * 0.16;
      barEnd.rotation.y = -side * 0.2;
      barEnd.position.set(side * 0.305, 0.005, 0.044);
      steeringGroup.add(barEnd);

      // Ribbed rubber grip + throttle twist pivot
      const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.021, 0.021, 0.125, 14), rubberMat);
      grip.rotation.z = Math.PI / 2 + side * 0.16;
      grip.rotation.y = -side * 0.2;
      grip.position.set(side * 0.235, 0.016, 0.03);
      steeringGroup.add(grip);

      // Multi-button switchgear pod (yellow HORN button on left, red KILL/START switch on right)
      const pod = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.046, 0.046), carbonMat);
      pod.position.set(side * 0.16, 0.032, 0.015);
      steeringGroup.add(pod);

      const switchBtn = new THREE.Mesh(
        new THREE.BoxGeometry(0.015, 0.014, 0.012),
        new THREE.MeshBasicMaterial({ color: side === 1 ? '#ef4444' : '#facc15' })
      );
      switchBtn.position.set(side * 0.16, 0.038, 0.038);
      steeringGroup.add(switchBtn);

      const passSwitch = new THREE.Mesh(
        new THREE.BoxGeometry(0.012, 0.008, 0.01),
        new THREE.MeshBasicMaterial({ color: side === 1 ? '#e2e8f0' : '#38bdf8' })
      );
      passSwitch.position.set(side * 0.16, 0.02, 0.038);
      steeringGroup.add(passSwitch);

      // Sculpted aluminum clutch/brake lever with ball end
      const leverPivot = new THREE.Group();
      leverPivot.position.set(side * 0.17, 0.026, -0.02);
      const lever = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.008, 0.014), chromeMetal);
      lever.position.set(side * 0.055, 0, -0.01);
      const leverBall = new THREE.Mesh(new THREE.SphereGeometry(0.0085, 8, 8), chromeMetal);
      leverBall.position.set(side * 0.11, 0, -0.01);
      leverPivot.add(lever, leverBall);
      steeringGroup.add(leverPivot);
      if (side === 1) {
        rightBrakeLever = leverPivot;
      }

      // Wing mirror on sculpted stalk + amber repeater strip
      const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.007, 0.145, 10), darkMetal);
      stalk.rotation.z = -side * 0.42;
      stalk.position.set(side * 0.175, 0.105, -0.02);
      steeringGroup.add(stalk);

      const mirrorHousing = new THREE.Mesh(new THREE.BoxGeometry(0.104, 0.06, 0.018), darkMetal);
      mirrorHousing.position.set(side * 0.208, 0.168, -0.025);
      mirrorHousing.rotation.z = side * 0.08;
      mirrorHousing.rotation.y = -side * 0.18;
      steeringGroup.add(mirrorHousing);

      const mirrorGlass = new THREE.Mesh(
        new THREE.PlaneGeometry(0.092, 0.048),
        new THREE.MeshStandardMaterial({
          color: '#fb923c',
          emissive: '#9a3412',
          emissiveIntensity: 0.32,
          roughness: 0.06,
          metalness: 0.92,
        })
      );
      mirrorGlass.position.set(side * 0.208, 0.168, -0.014);
      mirrorGlass.rotation.z = side * 0.08;
      mirrorGlass.rotation.y = -side * 0.18;
      steeringGroup.add(mirrorGlass);

      // Articulated Rider Hand & Visible Fingers gripping each bar
      const handData = buildArticulatedHandAndArm(side);
      if (side === 1) {
        rightGripPivot = new THREE.Group();
        rightGripPivot.position.set(0.235, 0.016, 0.03);
        rightGripPivot.rotation.y = -0.2;
        rightGripPivot.rotation.z = 0.16;
        handData.arm.position.set(0, 0, 0);
        handData.arm.rotation.set(0, 0, 0);
        rightFingersGroup = handData.fingersGroup;
        rightLeverFingersGroup = handData.leverFingersGroup;
        rightGripPivot.add(handData.arm);
        steeringGroup.add(rightGripPivot);
      } else {
        leftRestAnchor = new THREE.Group();
        leftRestAnchor.position.set(-0.235, 0.016, 0.03);
        leftRestAnchor.rotation.y = 0.2;
        leftRestAnchor.rotation.z = -0.16;
        handData.arm.position.set(0, 0, 0);
        handData.arm.rotation.set(0, 0, 0);
        leftArmGroup = handData.arm;
        leftThumbPivot = handData.thumbPivot;
        leftRestAnchor.add(leftArmGroup);
        steeringGroup.add(leftRestAnchor);
      }
    });

    // Wide Supersport Twin-Pod + TFT Digital Cockpit Instrument Cluster
    const dashBezel = new THREE.Mesh(new THREE.BoxGeometry(0.23, 0.118, 0.034), carbonMat);
    dashBezel.rotation.x = -Math.PI * 0.14;
    dashBezel.position.set(0, 0.084, -0.072);
    steeringGroup.add(dashBezel);

    const dashTrimRing = new THREE.Mesh(new THREE.BoxGeometry(0.238, 0.124, 0.01), chromeMetal);
    dashTrimRing.rotation.x = -Math.PI * 0.14;
    dashTrimRing.position.set(0, 0.084, -0.068);
    steeringGroup.add(dashTrimRing);

    const gaugeFace = new THREE.Mesh(
      new THREE.PlaneGeometry(0.218, 0.106),
      new THREE.MeshBasicMaterial({ map: dashTexture })
    );
    gaugeFace.rotation.x = -Math.PI * 0.14;
    gaugeFace.position.set(0, 0.086, -0.053);
    steeringGroup.add(gaugeFace);

    // Smoked polycarbonate curved aero windscreen visor
    const visorGeo = new THREE.CylinderGeometry(0.17, 0.205, 0.22, 20, 1, true, Math.PI * 0.66, Math.PI * 0.68);
    const visorMat = new THREE.MeshPhysicalMaterial({
      color: '#0f172a',
      transparent: true,
      opacity: 0.36,
      roughness: 0.06,
      metalness: 0.22,
      side: THREE.DoubleSide,
    });
    const visor = new THREE.Mesh(visorGeo, visorMat);
    visor.rotation.x = 0.48;
    visor.position.set(0, 0.165, -0.045);
    steeringGroup.add(visor);

    // Power-Up Aura 1: Translucent 3D Immunity Shield Dome
    shieldDomeGroup = new THREE.Group();
    const shieldSphere = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.56, 1),
      new THREE.MeshBasicMaterial({
        color: '#38bdf8',
        wireframe: true,
        transparent: true,
        opacity: 0.45,
      })
    );
    const shieldGlow = new THREE.Mesh(
      new THREE.SphereGeometry(0.54, 18, 14),
      new THREE.MeshBasicMaterial({
        color: '#0ea5e9',
        transparent: true,
        opacity: 0.14,
        side: THREE.DoubleSide,
      })
    );
    shieldDomeGroup.add(shieldSphere, shieldGlow);
    shieldDomeGroup.position.set(0, -0.05, -0.35);
    shieldDomeGroup.visible = false;
    bikeRoot.add(shieldDomeGroup);

    // Power-Up Aura 2: Nitro Flame Streaks
    nitroFlameGroup = new THREE.Group();
    [-1, 1].forEach((side) => {
      const cone = new THREE.Mesh(
        new THREE.ConeGeometry(0.045, 0.55, 10),
        new THREE.MeshBasicMaterial({
          color: '#f97316',
          transparent: true,
          opacity: 0.72,
        })
      );
      cone.rotation.x = Math.PI / 2;
      cone.position.set(side * 0.26, -0.14, -0.42);
      nitroFlameGroup.add(cone);
    });
    nitroFlameGroup.visible = false;
    bikeRoot.add(nitroFlameGroup);

    // Power-Up Aura 3: Magnet Field Halo
    magnetAuraGroup = new THREE.Group();
    const magRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.32, 0.012, 8, 28),
      new THREE.MeshBasicMaterial({
        color: '#fb7185',
        transparent: true,
        opacity: 0.75,
      })
    );
    magRing.rotation.x = Math.PI / 2;
    magnetAuraGroup.add(magRing);
    magnetAuraGroup.position.set(0, 0.08, -0.28);
    magnetAuraGroup.visible = false;
    bikeRoot.add(magnetAuraGroup);
  }

  function updateDashTexture(kmh, braking, distanceMeters, powerups, steerDir, hornHeld) {
    if (!dashCtx || !dashTexture) return;
    const g = dashCtx;
    const w = 512;
    const h = 512;
    g.clearRect(0, 0, w, h);

    // Brushed carbon-slate instrument panel background
    const bgGrad = g.createLinearGradient(0, 0, 0, h);
    bgGrad.addColorStop(0, '#020617');
    bgGrad.addColorStop(0.5, '#0b1326');
    bgGrad.addColorStop(1, '#020617');
    g.fillStyle = bgGrad;
    g.fillRect(0, 0, w, h);

    g.strokeStyle = '#334155';
    g.lineWidth = 8;
    g.strokeRect(10, 10, w - 20, h - 20);

    // Gear & RPM calculation
    const gear = kmh < 5 ? 'N' : kmh < 28 ? '1' : kmh < 58 ? '2' : kmh < 94 ? '3' : kmh < 132 ? '4' : '5';
    const rpmRatio = Math.max(0.12, Math.min(0.98, 0.14 + (kmh % 36) / 42 + kmh / 260));
    const blinkOn = Math.floor(performance.now() * 0.0065) % 2 === 0;

    // Top telltale strip (Left Turn / High Beam / Horn / ABS / Right Turn)
    g.fillStyle = steerDir < -0.15 && blinkOn ? '#22c55e' : '#1e293b';
    g.beginPath();
    g.moveTo(32, 48);
    g.lineTo(66, 26);
    g.lineTo(66, 70);
    g.closePath();
    g.fill();

    g.fillStyle = steerDir > 0.15 && blinkOn ? '#22c55e' : '#1e293b';
    g.beginPath();
    g.moveTo(w - 32, 48);
    g.lineTo(w - 66, 26);
    g.lineTo(w - 66, 70);
    g.closePath();
    g.fill();

    // Telltale badges across top center
    const badges = [
      { label: 'HB', active: true, onColor: '#38bdf8' },
      { label: 'HORN', active: Boolean(hornHeld), onColor: '#facc15' },
      { label: 'BRK', active: Boolean(braking), onColor: '#ef4444' },
      { label: 'N2O', active: Boolean(powerups && powerups.fuelBoost > 0), onColor: '#f97316' },
      { label: 'SHD', active: Boolean(powerups && powerups.shield > 0), onColor: '#22d3ee' },
    ];
    badges.forEach((b, idx) => {
      const bx = 92 + idx * 66;
      g.fillStyle = b.active ? b.onColor : '#1e293b';
      g.fillRect(bx, 28, 56, 32);
      g.fillStyle = b.active ? '#020617' : '#64748b';
      g.font = 'bold 16px monospace';
      g.textAlign = 'center';
      g.fillText(b.label, bx + 28, 50);
    });

    // Left Pod: Analog RPM Tachometer (center x=142, y=258, r=112)
    const cx = 144;
    const cy = 266;
    const rad = 114;
    g.fillStyle = '#090d16';
    g.beginPath();
    g.arc(cx, cy, rad, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = '#64748b';
    g.lineWidth = 6;
    g.stroke();

    for (let i = 0; i <= 12; i += 1) {
      const ang = Math.PI * 0.78 + (i / 12) * Math.PI * 1.44;
      const isRedline = i >= 9;
      g.strokeStyle = isRedline ? '#ef4444' : '#38bdf8';
      g.lineWidth = i % 2 === 0 ? 5 : 3;
      g.beginPath();
      g.moveTo(cx + Math.cos(ang) * (rad - 24), cy + Math.sin(ang) * (rad - 24));
      g.lineTo(cx + Math.cos(ang) * (rad - 8), cy + Math.sin(ang) * (rad - 8));
      g.stroke();
      if (i % 2 === 0) {
        g.fillStyle = isRedline ? '#fca5a5' : '#e2e8f0';
        g.font = 'bold 18px sans-serif';
        g.textAlign = 'center';
        g.fillText(String(i), cx + Math.cos(ang) * (rad - 40), cy + Math.sin(ang) * (rad - 40) + 6);
      }
    }

    g.fillStyle = '#94a3b8';
    g.font = 'bold 13px sans-serif';
    g.textAlign = 'center';
    g.fillText('x1000 RPM', cx, cy + 62);

    const nAng = Math.PI * 0.78 + rpmRatio * Math.PI * 1.44;
    g.strokeStyle = '#ef4444';
    g.lineWidth = 7;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(cx, cy);
    g.lineTo(cx + Math.cos(nAng) * (rad - 26), cy + Math.sin(nAng) * (rad - 26));
    g.stroke();

    g.fillStyle = '#e2e8f0';
    g.beginPath();
    g.arc(cx, cy, 13, 0, Math.PI * 2);
    g.fill();

    // Right Pod: High-Contrast TFT Digital Screen (x=276..486, y=104..408)
    g.fillStyle = '#061428';
    g.fillRect(276, 102, 212, 310);
    g.strokeStyle = '#0ea5e9';
    g.lineWidth = 3;
    g.strokeRect(276, 102, 212, 310);

    // Gear Indicator box top-right inside TFT
    g.fillStyle = '#0f172a';
    g.fillRect(424, 114, 52, 62);
    g.strokeStyle = gear === 'N' ? '#22c55e' : '#facc15';
    g.lineWidth = 3;
    g.strokeRect(424, 114, 52, 62);
    g.fillStyle = gear === 'N' ? '#4ade80' : '#facc15';
    g.font = '900 40px monospace';
    g.textAlign = 'center';
    g.fillText(gear, 450, 160);

    // Big Speed Readout
    g.fillStyle = powerups && powerups.fuelBoost > 0 ? '#fb923c' : '#f8fafc';
    g.font = '900 72px monospace';
    g.textAlign = 'left';
    g.fillText(`${Math.round(kmh)}`, 288, 198);
    g.fillStyle = '#38bdf8';
    g.font = 'bold 20px sans-serif';
    g.fillText('KM/H', 292, 224);

    // Live RPM Shift Progress Bar
    const barCount = 10;
    const filledBars = Math.round(rpmRatio * barCount);
    for (let b = 0; b < barCount; b += 1) {
      g.fillStyle =
        b >= filledBars
          ? '#1e293b'
          : b >= 8
          ? '#ef4444'
          : b >= 5
          ? '#facc15'
          : '#22c55e';
      g.fillRect(288 + b * 19, 240, 15, 16);
    }

    // Distance Trip + Coolant + Battery telemetry rows
    g.fillStyle = '#94a3b8';
    g.font = 'bold 16px monospace';
    g.textAlign = 'left';
    g.fillText('TRIP', 290, 294);
    g.fillStyle = '#facc15';
    g.font = 'bold 28px monospace';
    g.textAlign = 'right';
    g.fillText(`${Math.floor(distanceMeters)}m`, 474, 296);

    g.fillStyle = '#94a3b8';
    g.font = 'bold 16px monospace';
    g.textAlign = 'left';
    g.fillText('ENG 84C', 290, 338);
    g.fillText('14.2V', 416, 338);

    // Bottom Fuel Bar + Active Magnet badge
    g.fillStyle = '#94a3b8';
    g.font = 'bold 15px sans-serif';
    g.fillText('FUEL', 290, 384);
    const fuelPct = powerups && powerups.fuelBoost > 0 ? 1 : 0.82;
    g.fillStyle = '#1e293b';
    g.fillRect(340, 368, 134, 20);
    g.fillStyle = fuelPct > 0.9 ? '#f97316' : '#22c55e';
    g.fillRect(342, 370, Math.round(130 * fuelPct), 16);

    // Bottom status bar under analog tach
    g.fillStyle = braking ? '#ef4444' : '#38bdf8';
    g.font = '900 22px monospace';
    g.textAlign = 'center';
    g.fillText(braking ? 'ABS BRAKING' : hornHeld ? 'HORN ON' : 'BENDSKIN 237', 144, 462);

    dashTexture.needsUpdate = true;
  }

  function createPropMesh(kind) {
    const group = new THREE.Group();
    if (kind === 'palm') {
      const trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.14, 0.24, 5.4, 8),
        new THREE.MeshStandardMaterial({ color: '#78350f', roughness: 0.9 })
      );
      trunk.position.y = 2.7;
      trunk.castShadow = true;
      group.add(trunk);

      const leafMat = new THREE.MeshStandardMaterial({ color: '#16a34a', roughness: 0.72 });
      for (let i = 0; i < 6; i += 1) {
        const frond = new THREE.Mesh(new THREE.ConeGeometry(0.42, 2.5, 5), leafMat);
        frond.position.y = 5.4;
        frond.rotation.z = 1.15;
        frond.rotation.y = (i * Math.PI) / 3;
        frond.translateY(1.0);
        frond.castShadow = true;
        group.add(frond);
      }
    } else if (kind === 'building') {
      const bHeight = 14 + Math.random() * 8;
      const body = new THREE.Mesh(
        new THREE.BoxGeometry(6.5, bHeight, 7.5),
        new THREE.MeshStandardMaterial({
          map: texCache.buildingFacade,
          roughness: 0.65,
          metalness: 0.2,
        })
      );
      body.position.y = bHeight * 0.5;
      body.castShadow = true;
      group.add(body);
    } else if (kind === 'lamp') {
      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.08, 0.11, 6.2, 8),
        new THREE.MeshStandardMaterial({ color: '#64748b', metalness: 0.65, roughness: 0.4 })
      );
      pole.position.y = 3.1;
      group.add(pole);
      const lampHead = new THREE.Mesh(
        new THREE.SphereGeometry(0.24, 10, 8),
        new THREE.MeshBasicMaterial({ color: '#fef08a' })
      );
      lampHead.position.y = 6.2;
      group.add(lampHead);
    } else if (kind === 'kiosk') {
      const box = new THREE.Mesh(
        new THREE.BoxGeometry(2.8, 2.6, 3.0),
        new THREE.MeshStandardMaterial({ color: '#eab308', roughness: 0.75 })
      );
      box.position.y = 1.3;
      box.castShadow = true;
      group.add(box);
      const roof = new THREE.Mesh(
        new THREE.BoxGeometry(3.3, 0.24, 3.5),
        new THREE.MeshStandardMaterial({ color: '#dc2626', roughness: 0.6 })
      );
      roof.position.y = 2.7;
      group.add(roof);
    } else if (kind === 'billboard') {
      const post = new THREE.Mesh(
        new THREE.CylinderGeometry(0.14, 0.14, 4.5, 8),
        new THREE.MeshStandardMaterial({ color: '#475569', metalness: 0.5 })
      );
      post.position.y = 2.25;
      group.add(post);
      const board = new THREE.Mesh(
        new THREE.BoxGeometry(0.3, 2.2, 4.8),
        new THREE.MeshStandardMaterial({ color: '#0284c7', emissive: '#0c4a6e', emissiveIntensity: 0.4 })
      );
      board.position.y = 4.9;
      group.add(board);
    } else {
      const sign = new THREE.Mesh(
        new THREE.BoxGeometry(0.9, 1.4, 0.15),
        new THREE.MeshStandardMaterial({ color: '#16a34a', roughness: 0.5 })
      );
      sign.position.y = 0.7;
      group.add(sign);
    }
    return group;
  }

  function addWheelMeshes(group, positions, radius = 0.34, width = 0.22) {
    const tireMat = new THREE.MeshStandardMaterial({ color: '#090d16', roughness: 0.85 });
    const rimMat = new THREE.MeshStandardMaterial({ color: '#cbd5e1', metalness: 0.8, roughness: 0.25 });
    const wheels = [];
    positions.forEach(([wx, wy, wz]) => {
      const wg = new THREE.Group();
      const tire = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, width, 16), tireMat);
      tire.rotation.z = Math.PI / 2;
      const rim = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.55, radius * 0.55, width + 0.02, 12), rimMat);
      rim.rotation.z = Math.PI / 2;
      wg.add(tire, rim);
      wg.position.set(wx, wy, wz);
      wg.castShadow = true;
      group.add(wg);
      wheels.push(wg);
    });
    return wheels;
  }

  function createEntityMesh(type) {
    const group = new THREE.Group();
    const userData = { wheels: [], brakeLights: [], leftSig: null, rightSig: null, spinTarget: null, orbitRing: null };
    group.userData = userData;

    if (type === 'yellow_taxi') {
      const bodyMat = new THREE.MeshPhysicalMaterial({
        color: '#facc15',
        roughness: 0.25,
        metalness: 0.2,
        clearcoat: 0.8,
      });
      const glassMat = new THREE.MeshStandardMaterial({
        color: '#0f172a',
        roughness: 0.12,
        metalness: 0.85,
      });

      const chassis = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.72, 3.85), bodyMat);
      chassis.position.y = 0.62;
      chassis.castShadow = true;
      group.add(chassis);

      const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.48, 0.62, 2.05), bodyMat);
      cabin.position.set(0, 1.24, -0.1);
      cabin.castShadow = true;
      group.add(cabin);

      const rearGlass = new THREE.Mesh(new THREE.BoxGeometry(1.36, 0.44, 0.12), glassMat);
      rearGlass.position.set(0, 1.22, 0.94);
      rearGlass.rotation.x = -0.3;
      group.add(rearGlass);

      const roofSign = new THREE.Mesh(
        new THREE.BoxGeometry(0.65, 0.2, 0.34),
        new THREE.MeshBasicMaterial({ color: '#fffbeb' })
      );
      roofSign.position.set(0, 1.64, -0.1);
      group.add(roofSign);

      [-0.62, 0.62].forEach((tx) => {
        const tail = new THREE.Mesh(
          new THREE.BoxGeometry(0.32, 0.16, 0.08),
          new THREE.MeshStandardMaterial({ color: '#ef4444', emissive: '#ef4444', emissiveIntensity: 0.8 })
        );
        tail.position.set(tx, 0.68, 1.94);
        group.add(tail);
        userData.brakeLights.push(tail.material);
      });

      const attachSignalHalo = (x, y, z, w, h) => {
        const pod = new THREE.Group();
        pod.position.set(x, y, z);
        const core = new THREE.Mesh(
          new THREE.BoxGeometry(w, h, 0.09),
          new THREE.MeshBasicMaterial({ color: '#fbbf24' })
        );
        const glow = new THREE.Mesh(
          new THREE.BoxGeometry(w * 2.1, h * 2.1, 0.04),
          new THREE.MeshBasicMaterial({ color: '#f59e0b', transparent: true, opacity: 0.48 })
        );
        glow.position.z = 0.03;
        pod.add(core, glow);
        pod.visible = false;
        group.add(pod);
        return pod;
      };

      userData.leftSig = attachSignalHalo(-0.82, 0.54, 1.95, 0.2, 0.16);
      userData.rightSig = attachSignalHalo(0.82, 0.54, 1.95, 0.2, 0.16);

      userData.wheels = addWheelMeshes(
        group,
        [
          [-0.86, 0.34, 1.15],
          [0.86, 0.34, 1.15],
          [-0.86, 0.34, -1.15],
          [0.86, 0.34, -1.15],
        ],
        0.34,
        0.22
      );
    } else if (type === 'clando_van') {
      const bodyMat = new THREE.MeshStandardMaterial({ color: '#e2e8f0', roughness: 0.35, metalness: 0.18 });
      const stripeMat = new THREE.MeshStandardMaterial({ color: '#0284c7', roughness: 0.4 });
      const body = new THREE.Mesh(new THREE.BoxGeometry(1.88, 1.55, 4.15), bodyMat);
      body.position.y = 1.05;
      body.castShadow = true;
      group.add(body);

      const stripe = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.28, 4.17), stripeMat);
      stripe.position.y = 0.92;
      group.add(stripe);

      const windowBack = new THREE.Mesh(
        new THREE.BoxGeometry(1.48, 0.55, 0.08),
        new THREE.MeshStandardMaterial({ color: '#0f172a', roughness: 0.15, metalness: 0.8 })
      );
      windowBack.position.set(0, 1.44, 2.08);
      group.add(windowBack);

      const luggage = new THREE.Mesh(
        new THREE.BoxGeometry(1.45, 0.32, 2.6),
        new THREE.MeshStandardMaterial({ color: '#92400e', roughness: 0.8 })
      );
      luggage.position.set(0, 1.98, 0);
      group.add(luggage);

      [-0.72, 0.72].forEach((tx) => {
        const tail = new THREE.Mesh(
          new THREE.BoxGeometry(0.24, 0.34, 0.08),
          new THREE.MeshStandardMaterial({ color: '#ef4444', emissive: '#ef4444', emissiveIntensity: 0.8 })
        );
        tail.position.set(tx, 0.75, 2.09);
        group.add(tail);
        userData.brakeLights.push(tail.material);
      });

      [-1, 1].forEach((sSide) => {
        const pod = new THREE.Group();
        pod.position.set(sSide * 0.88, 0.52, 2.1);
        pod.add(
          new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.18, 0.08), new THREE.MeshBasicMaterial({ color: '#fbbf24' })),
          new THREE.Mesh(
            new THREE.BoxGeometry(0.42, 0.36, 0.04),
            new THREE.MeshBasicMaterial({ color: '#f59e0b', transparent: true, opacity: 0.48 })
          )
        );
        pod.visible = false;
        group.add(pod);
        if (sSide < 0) userData.leftSig = pod;
        else userData.rightSig = pod;
      });

      userData.wheels = addWheelMeshes(
        group,
        [
          [-0.92, 0.36, 1.25],
          [0.92, 0.36, 1.25],
          [-0.92, 0.36, -1.25],
          [0.92, 0.36, -1.25],
        ],
        0.36,
        0.24
      );
    } else if (type === 'timber_truck') {
      const flatbed = new THREE.Mesh(
        new THREE.BoxGeometry(2.15, 0.38, 6.2),
        new THREE.MeshStandardMaterial({ color: '#334155', roughness: 0.6, metalness: 0.4 })
      );
      flatbed.position.y = 0.85;
      flatbed.castShadow = true;
      group.add(flatbed);

      const cab = new THREE.Mesh(
        new THREE.BoxGeometry(2.05, 1.95, 1.9),
        new THREE.MeshStandardMaterial({ color: '#b45309', roughness: 0.4, metalness: 0.3 })
      );
      cab.position.set(0, 1.72, -2.25);
      cab.castShadow = true;
      group.add(cab);

      const barkMat = new THREE.MeshStandardMaterial({ color: '#78350f', roughness: 0.92 });
      const endMat = new THREE.MeshStandardMaterial({ color: '#d97706', roughness: 0.8 });
      const logOffsets = [
        [-0.58, 1.38],
        [0, 1.38],
        [0.58, 1.38],
        [-0.3, 1.88],
        [0.3, 1.88],
        [0, 2.38],
      ];
      logOffsets.forEach(([lx, ly]) => {
        const log = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 4.2, 12), barkMat);
        log.rotation.x = Math.PI / 2;
        log.position.set(lx, ly, 0.85);
        log.castShadow = true;
        group.add(log);

        const cap = new THREE.Mesh(new THREE.CircleGeometry(0.26, 12), endMat);
        cap.position.set(lx, ly, 2.96);
        group.add(cap);
      });

      [-0.8, 0.8].forEach((tx) => {
        const tail = new THREE.Mesh(
          new THREE.BoxGeometry(0.28, 0.18, 0.08),
          new THREE.MeshStandardMaterial({ color: '#ef4444', emissive: '#ef4444', emissiveIntensity: 0.9 })
        );
        tail.position.set(tx, 0.78, 3.12);
        group.add(tail);
        userData.brakeLights.push(tail.material);
      });

      [-1, 1].forEach((sSide) => {
        const pod = new THREE.Group();
        pod.position.set(sSide * 0.98, 0.82, 3.13);
        pod.add(
          new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.2, 0.09), new THREE.MeshBasicMaterial({ color: '#fbbf24' })),
          new THREE.Mesh(
            new THREE.BoxGeometry(0.48, 0.4, 0.04),
            new THREE.MeshBasicMaterial({ color: '#f59e0b', transparent: true, opacity: 0.52 })
          )
        );
        pod.visible = false;
        group.add(pod);
        if (sSide < 0) userData.leftSig = pod;
        else userData.rightSig = pod;
      });

      userData.wheels = addWheelMeshes(
        group,
        [
          [-1.02, 0.44, 2.1],
          [1.02, 0.44, 2.1],
          [-1.02, 0.44, 0.8],
          [1.02, 0.44, 0.8],
          [-1.02, 0.44, -2.0],
          [1.02, 0.44, -2.0],
        ],
        0.44,
        0.28
      );
    } else if (type === 'rival_moto') {
      const frame = new THREE.Mesh(
        new THREE.BoxGeometry(0.45, 0.55, 1.75),
        new THREE.MeshStandardMaterial({ color: '#1e293b', metalness: 0.6, roughness: 0.35 })
      );
      frame.position.y = 0.65;
      frame.castShadow = true;
      group.add(frame);

      const torso = new THREE.Mesh(
        new THREE.BoxGeometry(0.56, 0.68, 0.4),
        new THREE.MeshStandardMaterial({ color: '#eab308', roughness: 0.5 })
      );
      torso.position.set(0, 1.24, 0.1);
      torso.rotation.x = 0.25;
      torso.castShadow = true;
      group.add(torso);

      const helmet = new THREE.Mesh(
        new THREE.SphereGeometry(0.22, 14, 12),
        new THREE.MeshPhysicalMaterial({ color: '#dc2626', roughness: 0.2, clearcoat: 0.9 })
      );
      helmet.position.set(0, 1.74, -0.02);
      group.add(helmet);

      const tail = new THREE.Mesh(
        new THREE.BoxGeometry(0.18, 0.12, 0.08),
        new THREE.MeshStandardMaterial({ color: '#ef4444', emissive: '#ef4444', emissiveIntensity: 1.0 })
      );
      tail.position.set(0, 0.78, 0.9);
      group.add(tail);
      userData.brakeLights.push(tail.material);

      [-1, 1].forEach((sSide) => {
        const pod = new THREE.Group();
        pod.position.set(sSide * 0.24, 0.78, 0.88);
        pod.add(
          new THREE.Mesh(new THREE.SphereGeometry(0.065, 8, 8), new THREE.MeshBasicMaterial({ color: '#fbbf24' })),
          new THREE.Mesh(
            new THREE.SphereGeometry(0.13, 8, 8),
            new THREE.MeshBasicMaterial({ color: '#f59e0b', transparent: true, opacity: 0.45 })
          )
        );
        pod.visible = false;
        group.add(pod);
        if (sSide < 0) userData.leftSig = pod;
        else userData.rightSig = pod;
      });

      userData.wheels = addWheelMeshes(
        group,
        [
          [0, 0.32, 0.65],
          [0, 0.32, -0.65],
        ],
        0.32,
        0.16
      );
    } else if (type === 'barrier') {
      const bar = new THREE.Mesh(
        new THREE.BoxGeometry(2.15, 0.52, 0.25),
        new THREE.MeshStandardMaterial({ map: texCache.barrierStripe, roughness: 0.45 })
      );
      bar.position.y = 0.84;
      bar.castShadow = true;
      group.add(bar);

      [-0.85, 0.85].forEach((lx) => {
        const leg = new THREE.Mesh(
          new THREE.BoxGeometry(0.16, 1.08, 0.4),
          new THREE.MeshStandardMaterial({ color: '#334155', metalness: 0.5 })
        );
        leg.position.set(lx, 0.54, 0);
        leg.castShadow = true;
        group.add(leg);
        const beacon = new THREE.Mesh(
          new THREE.SphereGeometry(0.11, 10, 8),
          new THREE.MeshBasicMaterial({ color: '#f59e0b' })
        );
        beacon.position.set(lx, 1.18, 0);
        group.add(beacon);
      });
    } else if (type === 'timber_log') {
      const log = new THREE.Mesh(
        new THREE.CylinderGeometry(0.36, 0.36, 2.05, 14),
        new THREE.MeshStandardMaterial({ color: '#5c2c0e', roughness: 0.92 })
      );
      log.rotation.z = Math.PI / 2;
      log.position.y = 0.36;
      log.castShadow = true;
      group.add(log);
    } else if (type === 'pothole') {
      const rim = new THREE.Mesh(
        new THREE.CircleGeometry(0.88, 18),
        new THREE.MeshStandardMaterial({ color: '#292524', roughness: 0.95 })
      );
      rim.rotation.x = -Math.PI / 2;
      rim.position.y = 0.015;
      const puddle = new THREE.Mesh(
        new THREE.CircleGeometry(0.66, 16),
        new THREE.MeshStandardMaterial({ color: '#0f172a', roughness: 0.08, metalness: 0.85 })
      );
      puddle.rotation.x = -Math.PI / 2;
      puddle.position.y = 0.022;
      group.add(rim, puddle);
    } else if (type === 'coin') {
      const spinner = new THREE.Group();
      spinner.position.y = 0.72;
      const coinMesh = new THREE.Mesh(
        new THREE.CylinderGeometry(0.42, 0.42, 0.1, 20),
        new THREE.MeshStandardMaterial({
          color: '#facc15',
          emissive: '#a16207',
          emissiveIntensity: 0.35,
          metalness: 0.88,
          roughness: 0.22,
        })
      );
      coinMesh.rotation.x = Math.PI / 2;
      const starBadge = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.2, 0),
        new THREE.MeshStandardMaterial({ color: '#fef08a', emissive: '#ca8a04', emissiveIntensity: 0.5 })
      );
      spinner.add(coinMesh, starBadge);
      group.add(spinner);
      userData.spinTarget = spinner;
    } else if (type === 'fuel_can') {
      const spinner = new THREE.Group();
      spinner.position.y = 0.75;
      const can = new THREE.Mesh(
        new THREE.BoxGeometry(0.54, 0.68, 0.32),
        new THREE.MeshStandardMaterial({
          color: '#dc2626',
          emissive: '#991b1b',
          emissiveIntensity: 0.38,
          roughness: 0.28,
          metalness: 0.4,
        })
      );
      const spout = new THREE.Mesh(
        new THREE.CylinderGeometry(0.06, 0.08, 0.28, 10),
        new THREE.MeshStandardMaterial({ color: '#facc15', roughness: 0.3 })
      );
      spout.position.set(0.16, 0.44, 0);
      spout.rotation.z = -0.45;
      const stripe = new THREE.Mesh(
        new THREE.BoxGeometry(0.56, 0.14, 0.34),
        new THREE.MeshBasicMaterial({ color: '#facc15' })
      );
      spinner.add(can, spout, stripe);
      group.add(spinner);
      userData.spinTarget = spinner;
    } else if (type === 'shield') {
      const spinner = new THREE.Group();
      spinner.position.y = 0.8;
      const core = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.4, 1),
        new THREE.MeshPhysicalMaterial({
          color: '#38bdf8',
          emissive: '#0284c7',
          emissiveIntensity: 0.55,
          roughness: 0.15,
          metalness: 0.4,
        })
      );
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.56, 0.045, 10, 24),
        new THREE.MeshBasicMaterial({ color: '#fef08a' })
      );
      spinner.add(core, ring);
      group.add(spinner);
      userData.spinTarget = spinner;
      userData.orbitRing = ring;
    } else if (type === 'magnet') {
      const spinner = new THREE.Group();
      spinner.position.y = 0.8;
      const redMat = new THREE.MeshStandardMaterial({
        color: '#ef4444',
        emissive: '#991b1b',
        emissiveIntensity: 0.35,
        metalness: 0.5,
        roughness: 0.28,
      });
      const blueMat = new THREE.MeshStandardMaterial({
        color: '#0284c7',
        emissive: '#075985',
        emissiveIntensity: 0.35,
        metalness: 0.5,
        roughness: 0.28,
      });
      const tipMat = new THREE.MeshStandardMaterial({ color: '#e2e8f0', metalness: 0.9, roughness: 0.2 });

      const leftArm = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.5, 0.18), redMat);
      leftArm.position.set(-0.22, 0.12, 0);
      const rightArm = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.5, 0.18), blueMat);
      rightArm.position.set(0.22, 0.12, 0);
      const base = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.18, 0.18), redMat);
      base.position.set(0, -0.16, 0);
      const tipL = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.14, 0.19), tipMat);
      tipL.position.set(-0.22, 0.4, 0);
      const tipR = tipL.clone();
      tipR.position.x = 0.22;

      const waveRing = new THREE.Mesh(
        new THREE.TorusGeometry(0.52, 0.03, 8, 22),
        new THREE.MeshBasicMaterial({ color: '#38bdf8' })
      );
      waveRing.rotation.x = Math.PI / 2;

      spinner.add(leftArm, rightArm, base, tipL, tipR, waveRing);
      group.add(spinner);
      userData.spinTarget = spinner;
      userData.orbitRing = waveRing;
    }

    return group;
  }

  function init(canvasEl) {
    if (initialized || !isSupported()) return isSupported();
    try {
      canvas3d = canvasEl;
      renderer = new THREE.WebGLRenderer({
        canvas: canvas3d,
        antialias: true,
        powerPreference: 'high-performance',
      });
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.12;
      renderer.outputEncoding = THREE.sRGBEncoding;

      scene = new THREE.Scene();
      camera = new THREE.PerspectiveCamera(62, 16 / 9, 0.08, 380);

      buildProceduralTextures();
      const maxAniso = renderer && renderer.capabilities
        ? Math.min(8, renderer.capabilities.getMaxAnisotropy() || 4)
        : 4;
      Object.values(texCache).forEach((tex) => {
        if (tex) tex.anisotropy = maxAniso;
      });
      createEnvironment();
      buildBikeCockpit();

      initialized = true;
      return true;
    } catch {
      supported = false;
      initialized = false;
      return false;
    }
  }

  function resize(cssWidth, cssHeight, qualityMode) {
    if (!initialized || !renderer || !camera) return;
    if (qualityMode === 'high' || qualityMode === 'ultra') {
      currentQualityMode = qualityMode;
    }
    const w = Math.max(1, cssWidth);
    const h = Math.max(1, cssHeight);
    const shortSide = Math.min(w, h);
    const sysDpr = window.devicePixelRatio || 1;
    let dpr;
    if (currentQualityMode === 'ultra') {
      // Guarantee true 720p+ crisp backing resolution on every device screen
      const scale720p = 720 / shortSide;
      dpr = Math.min(3.0, Math.max(sysDpr, scale720p, 1.85));
    } else {
      dpr = Math.min(2.0, Math.max(sysDpr, 1.25));
    }
    renderer.setPixelRatio(dpr);
    renderer.setSize(w, h, false);
    camera.aspect = Math.max(0.25, w / h);
    camera.updateProjectionMatrix();
  }

  function renderFrame(state) {
    if (!initialized || !renderer || !scene || !camera) return;

    const nowSec = performance.now() * 0.001;
    const {
      cameraZ,
      currentLane,
      handlebarAngle,
      worldRollAngle,
      suspensionPitch,
      speedKmh,
      braking,
      throttling,
      hornHeld,
      steerDir,
      distanceMeters,
      rattleTimer,
      celebrationTimer,
      engineVibPhase,
      roadsideProps,
      entities,
      targetBestLineMeters,
      rivalActive,
      rivalDefeated,
      rivalMeters,
      powerups,
      crashShakeTimer,
      quality,
    } = state;

    if (quality && quality !== currentQualityMode) {
      currentQualityMode = quality;
      const rect = canvas3d ? canvas3d.getBoundingClientRect() : null;
      if (rect && rect.width > 0 && rect.height > 0) {
        resize(rect.width, rect.height, quality);
      }
    }

    // Smooth road texture scrolling synced 1:1 with world meters
    if (roadTexture) {
      roadTexture.offset.y = -(cameraZ / 14) % 1;
    }
    if (lateriteTexture) {
      lateriteTexture.offset.y = -(cameraZ / 8) % 1;
    }

    // Dynamic FOV & rider head camera placement inside active road lane
    const nitroExtraFov = powerups && powerups.fuelBoost > 0 ? 7 : 0;
    const portraitBoost = camera.aspect < 0.85 ? 8 : 0;
    const targetFov = 60 + portraitBoost + Math.max(0, (speedKmh - 65) / 100) * 10 + nitroExtraFov;
    if (Math.abs(camera.fov - targetFov) > 0.15) {
      camera.fov += (targetFov - camera.fov) * 0.12;
      camera.updateProjectionMatrix();
    }

    const shakeAmp = crashShakeTimer > 0 ? (crashShakeTimer / 0.25) * 0.12 : 0;
    const shakeX = shakeAmp > 0 ? Math.sin(crashShakeTimer * 180) * shakeAmp : 0;
    const shakeY = shakeAmp > 0 ? Math.cos(crashShakeTimer * 210) * shakeAmp : 0;
    const rattleX = rattleTimer > 0 ? Math.sin(rattleTimer * 95) * 0.03 : 0;
    const rattleY = rattleTimer > 0 ? Math.cos(rattleTimer * 110) * 0.025 : 0;

    const camX = laneToWorldX(currentLane) + shakeX;
    const camY = 1.48 + shakeY - suspensionPitch * 0.006;
    camera.position.set(camX, camY, 0);
    camera.lookAt(camX * 0.85, 1.18 - suspensionPitch * 0.01, -30);
    camera.rotation.z += worldRollAngle * 1.15;

    // Position 3D bike rig & animate fingers, lever, throttle wrist, thumb horn switch
    if (bikeRoot && steeringGroup) {
      const bob = Math.sin(engineVibPhase) * 0.004;
      const wheelie =
        celebrationTimer > 0 ? Math.sin(Math.min(1, celebrationTimer / 2.5) * Math.PI) * 0.08 : 0;
      bikeRoot.position.set(camX + rattleX, camY - 0.31 + bob + rattleY, -0.45);
      bikeRoot.rotation.set(wheelie - suspensionPitch * 0.006, 0, worldRollAngle * 1.5);

      steeringGroup.rotation.y = -handlebarAngle * 0.72;
      if (rightBrakeLever) {
        rightBrakeLever.rotation.y = braking ? -0.24 : 0;
      }
      if (rightLeverFingersGroup) {
        rightLeverFingersGroup.rotation.x = braking ? 0.42 : -0.08;
      }
      if (rightFingersGroup) {
        rightFingersGroup.rotation.x = braking ? 0.14 : 0;
      }
      if (rightGripPivot) {
        rightGripPivot.rotation.x = !braking && throttling ? 0.09 : 0;
      }
      if (leftThumbPivot) {
        leftThumbPivot.rotation.y = hornHeld ? -0.42 : 0;
        leftThumbPivot.rotation.x = hornHeld ? 0.25 : 0;
      }
      if (leftArmGroup) {
        if (celebrationTimer > 0) {
          leftArmGroup.position.set(-0.04, 0.18 + Math.sin(celebrationTimer * 14) * 0.04, 0.03);
          leftArmGroup.rotation.x = 0.6;
        } else {
          leftArmGroup.position.set(0, 0, 0);
          leftArmGroup.rotation.x = 0;
        }
      }

      // Active Power-Ups around bike
      if (shieldDomeGroup) {
        const active = powerups && powerups.shield > 0;
        shieldDomeGroup.visible = active;
        if (active) {
          shieldDomeGroup.rotation.y = nowSec * 1.8;
          shieldDomeGroup.rotation.x = Math.sin(nowSec * 2.2) * 0.15;
        }
      }
      if (nitroFlameGroup) {
        const active = powerups && powerups.fuelBoost > 0;
        nitroFlameGroup.visible = active;
        if (active) {
          const flicker = 0.85 + Math.sin(nowSec * 42) * 0.25;
          nitroFlameGroup.scale.set(1, 1, flicker);
        }
      }
      if (magnetAuraGroup) {
        const active = powerups && powerups.magnet > 0;
        magnetAuraGroup.visible = active;
        if (active) {
          const pulse = 0.75 + ((nowSec * 1.9) % 1) * 0.65;
          magnetAuraGroup.scale.setScalar(pulse);
        }
      }

      updateDashTexture(
        kmhOrZero(speedKmh, state.isRunning),
        braking,
        distanceMeters,
        powerups,
        steerDir || 0,
        hornHeld
      );
    }

    // Target lines on asphalt
    if (pbLineMesh) {
      const ahead = targetBestLineMeters - cameraZ;
      pbLineMesh.visible = targetBestLineMeters > 0 && ahead > -2 && ahead < 130;
      if (pbLineMesh.visible) {
        pbLineMesh.position.z = -ahead;
      }
    }
    if (rivalLineMesh) {
      const ahead = rivalMeters - cameraZ;
      rivalLineMesh.visible = rivalActive && !rivalDefeated && ahead > -2 && ahead < 130;
      if (rivalLineMesh.visible) {
        rivalLineMesh.position.z = -ahead;
      }
    }

    // Sync roadside props
    const nextPropActive = new Set();
    for (let i = 0; i < roadsideProps.length; i += 1) {
      const prop = roadsideProps[i];
      const ahead = prop.worldZ - cameraZ;
      if (ahead < -10 || ahead > 145) continue;
      let mesh = propMeshMap.get(prop);
      if (!mesh) {
        mesh = createPropMesh(prop.kind);
        propMeshMap.set(prop, mesh);
        scene.add(mesh);
      }
      mesh.visible = true;
      const sideOffset = prop.kind === 'lamp' ? 4.9 : prop.kind === 'kiosk' ? 6.8 : 9.4;
      mesh.position.set(prop.side * sideOffset, 0, -ahead);
      nextPropActive.add(mesh);
    }
    propActiveList.forEach((m) => {
      if (!nextPropActive.has(m)) {
        m.visible = false;
      }
    });
    propActiveList.clear();
    nextPropActive.forEach((m) => propActiveList.add(m));

    // Sync road hazards, traffic & custom 3D power-ups
    const nextEntityActive = new Set();
    for (let i = 0; i < entities.length; i += 1) {
      const entity = entities[i];
      if (entity.collected) continue;
      const ahead = entity.worldZ - cameraZ;
      if (ahead < -8 || ahead > 140) continue;

      let mesh = entityMeshMap.get(entity);
      if (!mesh) {
        mesh = createEntityMesh(entity.type);
        entityMeshMap.set(entity, mesh);
      }
      if (mesh.parent !== scene) {
        scene.add(mesh);
      }
      mesh.visible = true;
      const laneFloat = typeof entity.visualLane === 'number' ? entity.visualLane : entity.lane;
      mesh.position.set(laneToWorldX(laneFloat), 0, -ahead);

      // Rotate vehicle wheels, tilt gently on lane change, and flash amber turn-signals in advance
      const ud = mesh.userData;
      if (ud) {
        if (ud.wheels && ud.wheels.length > 0) {
          const spin = -(entity.wheelPhase || 0);
          for (let w = 0; w < ud.wheels.length; w += 1) {
            ud.wheels[w].rotation.x = spin;
          }
        }
        if (ud.brakeLights && ud.brakeLights.length > 0) {
          const ei = entity.braking ? 1.8 : 0.7;
          for (let b = 0; b < ud.brakeLights.length; b += 1) {
            ud.brakeLights[b].emissiveIntensity = ei;
          }
        }
        const laneErr = entity.lane - laneFloat;
        mesh.rotation.y = Math.abs(laneErr) > 0.02 ? laneErr * -0.2 : 0;
        if (ud.leftSig && ud.rightSig) {
          const blink = Math.floor(nowSec * 7.5) % 2 === 0;
          const sigDir = entity.signalDir || (laneErr < -0.02 ? -1 : laneErr > 0.02 ? 1 : 0);
          ud.leftSig.visible = sigDir === -1 && blink;
          ud.rightSig.visible = sigDir === 1 && blink;
        }
        if (ud.spinTarget) {
          ud.spinTarget.rotation.y = nowSec * 2.6 + entity.worldZ * 0.2;
          ud.spinTarget.position.y = 0.76 + Math.sin(nowSec * 4 + entity.worldZ * 0.3) * 0.12;
          if (ud.orbitRing) {
            ud.orbitRing.rotation.x = nowSec * 3.1;
            ud.orbitRing.rotation.z = nowSec * 2.1;
          }
        }
      }
      nextEntityActive.add(mesh);
    }
    entityActiveList.forEach((m) => {
      if (!nextEntityActive.has(m)) {
        scene.remove(m);
      }
    });
    entityActiveList.clear();
    nextEntityActive.forEach((m) => entityActiveList.add(m));

    renderer.render(scene, camera);
  }

  function kmhOrZero(speedKmh, isRunning) {
    return isRunning ? speedKmh : 0;
  }

  // =========================================================
  // Full 3D Motorcycle Showroom Viewer (Garage Modal)
  // =========================================================
  function buildFullMotorcycleMesh(bikeId) {
    const liv = getBikeLivery(bikeId);
    const bike = new THREE.Group();

    const paintMat = new THREE.MeshPhysicalMaterial({
      color: liv.paint,
      roughness: 0.16,
      metalness: 0.5,
      clearcoat: 1.0,
      clearcoatRoughness: 0.1,
    });
    const trimMat = new THREE.MeshStandardMaterial({
      color: liv.trim,
      roughness: 0.25,
      metalness: 0.85,
    });
    const frameMat = new THREE.MeshStandardMaterial({
      color: liv.frame,
      roughness: 0.45,
      metalness: 0.65,
    });
    const chromeMat = new THREE.MeshStandardMaterial({
      color: '#e2e8f0',
      roughness: 0.14,
      metalness: 0.94,
    });
    const tireMat = new THREE.MeshStandardMaterial({
      color: '#090d16',
      roughness: 0.88,
      metalness: 0.08,
    });
    const seatMat = new THREE.MeshStandardMaterial({
      color: liv.seat,
      roughness: 0.72,
      metalness: 0.1,
    });

    // Helper for front/rear detailed motorcycle wheel + drilled brake disc
    function makeMotoWheel(zPos, radius, width) {
      const wg = new THREE.Group();
      wg.position.set(0, radius, zPos);

      const tire = new THREE.Mesh(new THREE.TorusGeometry(radius - 0.055, 0.075, 14, 28), tireMat);
      tire.rotation.y = Math.PI / 2;
      tire.castShadow = true;
      wg.add(tire);

      const rim = new THREE.Mesh(new THREE.TorusGeometry(radius - 0.115, 0.025, 10, 24), trimMat);
      rim.rotation.y = Math.PI / 2;
      wg.add(rim);

      const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, width * 0.85, 12), chromeMat);
      hub.rotation.z = Math.PI / 2;
      wg.add(hub);

      for (let sp = 0; sp < 5; sp += 1) {
        const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.022, (radius - 0.11) * 1.9, 0.026), frameMat);
        spoke.rotation.x = (sp * Math.PI) / 5;
        wg.add(spoke);
      }

      const disc = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.56, radius * 0.56, 0.015, 22), chromeMat);
      disc.rotation.z = Math.PI / 2;
      disc.position.x = 0.065;
      wg.add(disc);

      const caliper = new THREE.Mesh(
        new THREE.BoxGeometry(0.04, 0.085, 0.06),
        new THREE.MeshStandardMaterial({ color: '#ef4444', roughness: 0.3, metalness: 0.4 })
      );
      caliper.position.set(0.072, radius * 0.36, 0.06);
      wg.add(caliper);

      return wg;
    }

    bike.add(makeMotoWheel(-0.78, 0.33, 0.14)); // Front wheel
    bike.add(makeMotoWheel(0.76, 0.34, 0.18));  // Rear fat tire

    // Rear swingarm + twin shock springs
    [-0.1, 0.1].forEach((sideX) => {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.06, 0.65), frameMat);
      arm.position.set(sideX, 0.36, 0.48);
      arm.rotation.x = 0.1;
      bike.add(arm);

      const spring = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.32, 10), trimMat);
      spring.position.set(sideX * 1.15, 0.52, 0.44);
      spring.rotation.x = -0.35;
      bike.add(spring);
    });

    // Air-cooled / DOHC engine crankcase block + cooling fins + chrome cylinder head
    const engineBlock = new THREE.Mesh(
      new THREE.BoxGeometry(0.28, 0.28, 0.34),
      new THREE.MeshStandardMaterial({ color: '#475569', roughness: 0.38, metalness: 0.72 })
    );
    engineBlock.position.set(0, 0.44, 0.02);
    engineBlock.castShadow = true;
    bike.add(engineBlock);

    for (let fin = 0; fin < 4; fin += 1) {
      const finMesh = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.014, 0.24), chromeMat);
      finMesh.position.set(0, 0.5 + fin * 0.035, -0.02);
      bike.add(finMesh);
    }

    // Diamond tubular chassis rails
    [-0.1, 0.1].forEach((rx) => {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.055, 0.85), frameMat);
      rail.position.set(rx, 0.68, 0.05);
      rail.rotation.x = 0.22;
      bike.add(rail);
    });

    // Swept chrome exhaust header pipe + angled megaphone muffler
    const exPipe = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.58, 12), chromeMat);
    exPipe.rotation.x = Math.PI / 2 - 0.16;
    exPipe.position.set(0.17, 0.27, 0.25);
    bike.add(exPipe);
    const muffler = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.04, 0.48, 14), chromeMat);
    muffler.rotation.x = Math.PI / 2 + 0.18;
    muffler.position.set(0.18, 0.38, 0.68);
    bike.add(muffler);

    // Sculpted Fuel Tank + Center Racing Stripe + Chrome Cap
    const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.21, 0.52, 20), paintMat);
    tank.rotation.x = Math.PI * 0.44;
    tank.scale.set(1.18, 1, 0.78);
    tank.position.set(0, 0.83, -0.12);
    tank.castShadow = true;
    bike.add(tank);

    const tStripe = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.015, 0.42), trimMat);
    tStripe.position.set(0, 0.94, -0.11);
    tStripe.rotation.x = -0.16;
    bike.add(tStripe);

    const tCap = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.038, 0.018, 14), chromeMat);
    tCap.position.set(0, 0.96, -0.17);
    bike.add(tCap);

    // Two-up stitched Bendskin Seat + Tail Cowling + Ruby LED Taillight + Rear Fender
    const seatBase = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.1, 0.68), seatMat);
    seatBase.position.set(0, 0.78, 0.38);
    seatBase.rotation.x = 0.08;
    seatBase.castShadow = true;
    bike.add(seatBase);

    const tailCowl = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.11, 0.26), paintMat);
    tailCowl.position.set(0, 0.81, 0.76);
    tailCowl.rotation.x = -0.14;
    bike.add(tailCowl);

    const tailLamp = new THREE.Mesh(
      new THREE.BoxGeometry(0.14, 0.06, 0.04),
      new THREE.MeshBasicMaterial({ color: '#ef4444' })
    );
    tailLamp.position.set(0, 0.78, 0.9);
    bike.add(tailLamp);

    const rearFender = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.03, 0.32), frameMat);
    rearFender.position.set(0, 0.62, 0.92);
    rearFender.rotation.x = 0.78;
    bike.add(rearFender);

    // Front Telescopic Gold/Alloy Forks + Front Fender + Circular LED Headlight + Windscreen + Handlebars
    [-0.1, 0.1].forEach((fx) => {
      const fork = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.028, 0.66, 12), trimMat);
      fork.position.set(fx, 0.63, -0.62);
      fork.rotation.x = -0.38;
      fork.castShadow = true;
      bike.add(fork);
    });

    const frontFender = new THREE.Mesh(
      new THREE.CylinderGeometry(0.32, 0.32, 0.16, 16, 1, false, -0.45, 0.9),
      paintMat
    );
    frontFender.rotation.z = Math.PI / 2;
    frontFender.position.set(0, 0.36, -0.77);
    bike.add(frontFender);

    const headlightHousing = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.095, 0.12, 16), frameMat);
    headlightHousing.rotation.x = Math.PI / 2;
    headlightHousing.position.set(0, 0.84, -0.66);
    bike.add(headlightHousing);

    const headlightLens = new THREE.Mesh(
      new THREE.CircleGeometry(0.098, 18),
      new THREE.MeshBasicMaterial({ color: '#fef9c3' })
    );
    headlightLens.rotation.y = Math.PI;
    headlightLens.position.set(0, 0.84, -0.725);
    bike.add(headlightLens);

    const miniVisor = new THREE.Mesh(
      new THREE.CylinderGeometry(0.13, 0.16, 0.18, 14, 1, true, Math.PI * 0.68, Math.PI * 0.64),
      new THREE.MeshPhysicalMaterial({ color: '#0f172a', transparent: true, opacity: 0.45, side: THREE.DoubleSide })
    );
    miniVisor.position.set(0, 0.98, -0.58);
    miniVisor.rotation.x = 0.45;
    bike.add(miniVisor);

    // Wide Handlebars + Grips + Mirrors
    const hbar = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.64, 10), chromeMat);
    hbar.rotation.z = Math.PI / 2;
    hbar.position.set(0, 0.96, -0.46);
    bike.add(hbar);

    [-1, 1].forEach((side) => {
      const mStalk = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.14, 8), frameMat);
      mStalk.rotation.z = -side * 0.35;
      mStalk.position.set(side * 0.24, 1.04, -0.46);
      bike.add(mStalk);

      const mMirror = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.05, 0.018), frameMat);
      mMirror.position.set(side * 0.28, 1.11, -0.46);
      bike.add(mMirror);
    });

    // Side Stand leaning faintly or showroom plinth alignment
    const gauge = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.06, 0.05), frameMat);
    gauge.position.set(0, 0.96, -0.56);
    gauge.rotation.x = -0.3;
    bike.add(gauge);

    return bike;
  }

  function initGaragePreview(canvasEl, bikeId) {
    if (!canvasEl || !isSupported()) return false;
    garageLiveryId = BIKE_LIVERIES[bikeId] ? bikeId : 'classic';

    if (!garageRenderer) {
      try {
        garageRenderer = new THREE.WebGLRenderer({
          canvas: canvasEl,
          antialias: true,
          alpha: true,
          powerPreference: 'high-performance',
        });
        garageRenderer.shadowMap.enabled = true;
        garageRenderer.toneMapping = THREE.ACESFilmicToneMapping;
        garageRenderer.toneMappingExposure = 1.18;
        garageRenderer.outputEncoding = THREE.sRGBEncoding;

        garageScene = new THREE.Scene();
        garageCamera = new THREE.PerspectiveCamera(38, 2.1, 0.1, 40);
        garageCamera.position.set(2.35, 1.25, 2.25);
        garageCamera.lookAt(0, 0.56, 0);

        garageScene.add(new THREE.HemisphereLight('#fde68a', '#0f172a', 0.95));
        const keyLight = new THREE.DirectionalLight('#fffbeb', 1.6);
        keyLight.position.set(3.5, 5, 4);
        keyLight.castShadow = true;
        garageScene.add(keyLight);

        const rimLight = new THREE.DirectionalLight('#38bdf8', 1.05);
        rimLight.position.set(-4, 2.5, -3);
        garageScene.add(rimLight);

        garageTurntable = new THREE.Group();
        const plinth = new THREE.Mesh(
          new THREE.CylinderGeometry(1.38, 1.48, 0.12, 36),
          new THREE.MeshStandardMaterial({ color: '#1e293b', roughness: 0.32, metalness: 0.78 })
        );
        plinth.position.y = -0.06;
        plinth.receiveShadow = true;
        const rimGlow = new THREE.Mesh(
          new THREE.TorusGeometry(1.38, 0.02, 8, 40),
          new THREE.MeshBasicMaterial({ color: '#facc15' })
        );
        rimGlow.rotation.x = Math.PI / 2;
        garageTurntable.add(plinth, rimGlow);
        garageTurntable.rotation.y = 0.65;
        garageScene.add(garageTurntable);

        canvasEl.addEventListener('pointerdown', (ev) => {
          garageDragActive = true;
          garageLastPointerX = ev.clientX;
        });
        window.addEventListener('pointermove', (ev) => {
          if (!garageDragActive || !garageTurntable) return;
          const dx = ev.clientX - garageLastPointerX;
          garageLastPointerX = ev.clientX;
          garageTurntable.rotation.y += dx * 0.012;
        });
        window.addEventListener('pointerup', () => {
          garageDragActive = false;
        });
      } catch {
        return false;
      }
    }

    const rect = canvasEl.getBoundingClientRect();
    const cw = Math.max(260, rect.width || canvasEl.width || 460);
    const ch = Math.max(140, rect.height || canvasEl.height || 178);
    garageRenderer.setPixelRatio(Math.min(2.5, window.devicePixelRatio || 1));
    garageRenderer.setSize(cw, ch, false);
    garageCamera.aspect = cw / ch;
    garageCamera.updateProjectionMatrix();

    setGarageBike(garageLiveryId);

    if (!garageRafId) {
      let lastT = performance.now();
      const tickGarage = (nowT) => {
        if (!garageRenderer || !garageScene || !garageCamera) return;
        const dt = Math.min(0.05, Math.max(0.001, (nowT - lastT) * 0.001));
        lastT = nowT;
        if (garageTurntable && !garageDragActive) {
          garageTurntable.rotation.y += dt * garageSpinSpeed;
        }
        garageRenderer.render(garageScene, garageCamera);
        garageRafId = window.requestAnimationFrame(tickGarage);
      };
      garageRafId = window.requestAnimationFrame(tickGarage);
    }
    return true;
  }

  function setGarageBike(bikeId) {
    garageLiveryId = BIKE_LIVERIES[bikeId] ? bikeId : 'classic';
    if (!garageTurntable) return;
    // Remove previous bike child (keeping turntable plinth + glow ring at indices 0,1)
    for (let i = garageTurntable.children.length - 1; i >= 0; i -= 1) {
      const ch = garageTurntable.children[i];
      if (ch.userData && ch.userData.isShowroomBike) {
        garageTurntable.remove(ch);
      }
    }
    const model = buildFullMotorcycleMesh(garageLiveryId);
    model.userData.isShowroomBike = true;
    garageTurntable.add(model);
  }

  function stopGaragePreview() {
    garageDragActive = false;
    if (garageRafId) {
      window.cancelAnimationFrame(garageRafId);
      garageRafId = null;
    }
  }

  window.BendskinUltra3D = {
    isSupported,
    init,
    resize,
    renderFrame,
    setCockpitLivery,
    initGaragePreview,
    setGarageBike,
    stopGaragePreview,
  };
})();
