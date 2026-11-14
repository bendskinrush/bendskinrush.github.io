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
  let leftArmGroup = null;
  let leftRestAnchor = null;
  let leftPumpAnchor = null;
  let shieldDomeGroup = null;
  let nitroFlameGroup = null;
  let magnetAuraGroup = null;
  let dashCanvas = null;
  let dashCtx = null;
  let dashTexture = null;

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

    sunLight = new THREE.DirectionalLight('#fff1d0', 1.45);
    sunLight.position.set(14, 24, -40);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 1024;
    sunLight.shadow.mapSize.height = 1024;
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

  function buildArticulatedHandAndArm(side) {
    // side = -1 (left) | +1 (right)
    const arm = new THREE.Group();

    const jacketMat = new THREE.MeshStandardMaterial({
      color: '#1e293b',
      roughness: 0.72,
      metalness: 0.12,
    });
    const leatherMat = new THREE.MeshStandardMaterial({
      color: '#0f172a',
      roughness: 0.45,
      metalness: 0.18,
    });
    const carbonKnuckleMat = new THREE.MeshStandardMaterial({
      color: '#334155',
      roughness: 0.22,
      metalness: 0.72,
    });
    const accentMat = new THREE.MeshStandardMaterial({
      color: side === 1 ? '#ef4444' : '#facc15',
      roughness: 0.35,
      metalness: 0.25,
    });
    const stripeMat = new THREE.MeshStandardMaterial({
      color: '#cbd5e1',
      roughness: 0.3,
      metalness: 0.6,
    });

    // Forearm coming toward rider shoulder
    const sleeveGeo = new THREE.CylinderGeometry(0.036, 0.046, 0.34, 12);
    const sleeve = new THREE.Mesh(sleeveGeo, jacketMat);
    sleeve.rotation.x = Math.PI * 0.42;
    sleeve.rotation.z = side * 0.26;
    sleeve.position.set(side * 0.055, -0.055, 0.17);
    arm.add(sleeve);

    // Reflective cuff stripe
    const cuffGeo = new THREE.CylinderGeometry(0.038, 0.039, 0.022, 12);
    const cuff = new THREE.Mesh(cuffGeo, stripeMat);
    cuff.rotation.x = Math.PI * 0.42;
    cuff.rotation.z = side * 0.26;
    cuff.position.set(side * 0.024, -0.014, 0.062);
    arm.add(cuff);

    // Glove wrist & palm resting over the handlebar grip
    const gloveAnchor = new THREE.Group();
    arm.add(gloveAnchor);

    const palm = new THREE.Mesh(new THREE.BoxGeometry(0.078, 0.032, 0.072), leatherMat);
    palm.position.set(0, 0.021, 0.012);
    gloveAnchor.add(palm);

    // Molded carbon knuckle guard bridge
    const knuckle = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.016, 0.026), carbonKnuckleMat);
    knuckle.position.set(0, 0.038, -0.01);
    knuckle.rotation.x = 0.2;
    gloveAnchor.add(knuckle);

    // Stitched accent band on back of glove
    const band = new THREE.Mesh(new THREE.BoxGeometry(0.068, 0.008, 0.012), accentMat);
    band.position.set(0, 0.039, 0.018);
    gloveAnchor.add(band);

    // Thumb curled underneath inner edge of grip
    const thumb = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.013, 0.052, 8), leatherMat);
    thumb.rotation.z = side * 1.15;
    thumb.rotation.x = -0.3;
    thumb.position.set(-side * 0.044, -0.002, -0.008);
    gloveAnchor.add(thumb);

    // 4 articulated curved fingers wrapping forward/down over grip & lever
    const fingersGroup = new THREE.Group();
    fingersGroup.position.set(0, 0.024, -0.022);
    for (let f = 0; f < 4; f += 1) {
      const fx = (f - 1.5) * 0.0185;
      const prox = new THREE.Mesh(new THREE.CylinderGeometry(0.0085, 0.0095, 0.034, 8), leatherMat);
      prox.rotation.x = 1.2;
      prox.position.set(fx, -0.004, -0.016);
      fingersGroup.add(prox);

      const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.0075, 0.0085, 0.028, 8), carbonKnuckleMat);
      tip.rotation.x = 2.35;
      tip.position.set(fx, -0.022, -0.025);
      fingersGroup.add(tip);
    }
    gloveAnchor.add(fingersGroup);

    return { arm, fingersGroup };
  }

  function buildBikeCockpit() {
    bikeRoot = new THREE.Group();
    scene.add(bikeRoot);

    dashCanvas = document.createElement('canvas');
    dashCanvas.width = 256;
    dashCanvas.height = 256;
    dashCtx = dashCanvas.getContext('2d');
    dashTexture = new THREE.CanvasTexture(dashCanvas);
    dashTexture.encoding = THREE.sRGBEncoding;

    const tankPaint = new THREE.MeshPhysicalMaterial({
      color: '#b91c1c',
      roughness: 0.18,
      metalness: 0.45,
      clearcoat: 1.0,
      clearcoatRoughness: 0.12,
    });
    const goldMetal = new THREE.MeshStandardMaterial({
      color: '#eab308',
      roughness: 0.25,
      metalness: 0.88,
    });
    const chromeMetal = new THREE.MeshStandardMaterial({
      color: '#e2e8f0',
      roughness: 0.16,
      metalness: 0.92,
    });
    const darkMetal = new THREE.MeshStandardMaterial({
      color: '#1e293b',
      roughness: 0.45,
      metalness: 0.65,
    });
    const rubberMat = new THREE.MeshStandardMaterial({
      color: '#090d16',
      roughness: 0.88,
      metalness: 0.05,
    });

    // Sculpted front fuel tank body visible below bars
    const tankMain = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.2, 0.5, 18), tankPaint);
    tankMain.rotation.x = Math.PI * 0.44;
    tankMain.scale.set(1.22, 1, 0.72);
    tankMain.position.set(0, -0.16, 0.05);
    bikeRoot.add(tankMain);

    // Center tank stripe & brushed aluminum filler cap
    const tankStripe = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.015, 0.4), goldMetal);
    tankStripe.position.set(0, -0.065, 0.04);
    tankStripe.rotation.x = 0.18;
    bikeRoot.add(tankStripe);

    const fuelCap = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.042, 0.018, 16), chromeMetal);
    fuelCap.position.set(0, -0.055, -0.02);
    bikeRoot.add(fuelCap);

    // Steering triple-clamp + forks + handlebars + gauges + arms
    steeringGroup = new THREE.Group();
    steeringGroup.position.set(0, 0.05, -0.36);
    bikeRoot.add(steeringGroup);

    // Dual upside-down gold front fork tubes + clamps
    [-1, 1].forEach((side) => {
      const fork = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.024, 0.48, 12), goldMetal);
      fork.rotation.x = -0.36;
      fork.position.set(side * 0.095, -0.18, -0.08);
      steeringGroup.add(fork);
    });

    const clamp = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.028, 0.09), darkMetal);
    clamp.position.set(0, 0.015, -0.02);
    steeringGroup.add(clamp);

    // Front mudguard fender tip visible down ahead in the lane
    const fender = new THREE.Mesh(
      new THREE.CylinderGeometry(0.11, 0.11, 0.12, 14, 1, false, -0.5, 1.0),
      tankPaint
    );
    fender.rotation.z = Math.PI / 2;
    fender.rotation.x = 0.2;
    fender.position.set(0, -0.35, -0.22);
    steeringGroup.add(fender);

    // Handlebar central stem + swept chrome bars + crossbar
    const barCenter = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.21, 10), chromeMetal);
    barCenter.rotation.z = Math.PI / 2;
    barCenter.position.set(0, 0.045, 0);
    steeringGroup.add(barCenter);

    [-1, 1].forEach((side) => {
      const armBar = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.21, 10), chromeMetal);
      armBar.rotation.z = Math.PI / 2 + side * 0.16;
      armBar.rotation.y = -side * 0.2;
      armBar.position.set(side * 0.185, 0.025, 0.02);
      steeringGroup.add(armBar);

      // Ribbed rubber grip
      const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.021, 0.021, 0.125, 12), rubberMat);
      grip.rotation.z = Math.PI / 2 + side * 0.16;
      grip.rotation.y = -side * 0.2;
      grip.position.set(side * 0.235, 0.016, 0.03);
      steeringGroup.add(grip);

      // Switchgear pod with colored button
      const pod = new THREE.Mesh(new THREE.BoxGeometry(0.038, 0.044, 0.044), darkMetal);
      pod.position.set(side * 0.16, 0.032, 0.015);
      steeringGroup.add(pod);

      const switchBtn = new THREE.Mesh(
        new THREE.BoxGeometry(0.014, 0.014, 0.012),
        new THREE.MeshBasicMaterial({ color: side === 1 ? '#ef4444' : '#facc15' })
      );
      switchBtn.position.set(side * 0.16, 0.038, 0.037);
      steeringGroup.add(switchBtn);

      // Aluminum lever pivot
      const leverPivot = new THREE.Group();
      leverPivot.position.set(side * 0.17, 0.026, -0.02);
      const lever = new THREE.Mesh(new THREE.BoxGeometry(0.105, 0.008, 0.014), chromeMetal);
      lever.position.set(side * 0.052, 0, -0.01);
      leverPivot.add(lever);
      steeringGroup.add(leverPivot);
      if (side === 1) {
        rightBrakeLever = leverPivot;
      }

      // Wing mirror on angled stalk
      const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.007, 0.14, 8), darkMetal);
      stalk.rotation.z = -side * 0.42;
      stalk.position.set(side * 0.175, 0.105, -0.02);
      steeringGroup.add(stalk);

      const mirrorHousing = new THREE.Mesh(new THREE.BoxGeometry(0.098, 0.058, 0.018), darkMetal);
      mirrorHousing.position.set(side * 0.205, 0.165, -0.025);
      mirrorHousing.rotation.z = side * 0.08;
      mirrorHousing.rotation.y = -side * 0.18;
      steeringGroup.add(mirrorHousing);

      const mirrorGlass = new THREE.Mesh(
        new THREE.PlaneGeometry(0.086, 0.044),
        new THREE.MeshStandardMaterial({
          color: '#f97316',
          emissive: '#9a3412',
          emissiveIntensity: 0.35,
          roughness: 0.08,
          metalness: 0.9,
        })
      );
      mirrorGlass.position.set(side * 0.205, 0.165, -0.014);
      mirrorGlass.rotation.z = side * 0.08;
      mirrorGlass.rotation.y = -side * 0.18;
      steeringGroup.add(mirrorGlass);

      // Rider Hand & Armored Glove gripping each bar
      const { arm, fingersGroup } = buildArticulatedHandAndArm(side);
      arm.position.set(side * 0.235, 0.016, 0.03);
      arm.rotation.y = -side * 0.2;
      arm.rotation.z = side * 0.16;
      if (side === 1) {
        rightFingersGroup = fingersGroup;
        steeringGroup.add(arm);
      } else {
        leftRestAnchor = new THREE.Group();
        leftRestAnchor.position.set(-0.235, 0.016, 0.03);
        leftRestAnchor.rotation.y = 0.2;
        leftRestAnchor.rotation.z = -0.16;
        arm.position.set(0, 0, 0);
        arm.rotation.set(0, 0, 0);
        leftArmGroup = arm;
        leftRestAnchor.add(leftArmGroup);
        steeringGroup.add(leftRestAnchor);
      }
    });

    // Chrome gauge bezel + live digital/analog speedometer
    const gaugeBody = new THREE.Mesh(new THREE.CylinderGeometry(0.086, 0.08, 0.032, 24), darkMetal);
    gaugeBody.rotation.x = Math.PI * 0.34;
    gaugeBody.position.set(0, 0.072, -0.068);
    steeringGroup.add(gaugeBody);

    const gaugeFace = new THREE.Mesh(
      new THREE.CircleGeometry(0.078, 24),
      new THREE.MeshBasicMaterial({ map: dashTexture })
    );
    gaugeFace.rotation.x = -Math.PI * 0.16;
    gaugeFace.position.set(0, 0.083, -0.056);
    steeringGroup.add(gaugeFace);

    // Smoked polycarbonate curved windscreen visor
    const visorGeo = new THREE.CylinderGeometry(0.16, 0.19, 0.21, 18, 1, true, Math.PI * 0.68, Math.PI * 0.64);
    const visorMat = new THREE.MeshPhysicalMaterial({
      color: '#0f172a',
      transparent: true,
      opacity: 0.42,
      roughness: 0.08,
      metalness: 0.2,
      side: THREE.DoubleSide,
    });
    const visor = new THREE.Mesh(visorGeo, visorMat);
    visor.rotation.x = 0.48;
    visor.position.set(0, 0.16, -0.04);
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

  function updateDashTexture(kmh, braking, distanceMeters, powerups) {
    if (!dashCtx || !dashTexture) return;
    const g = dashCtx;
    const w = 256;
    const h = 256;
    g.clearRect(0, 0, w, h);

    g.fillStyle = '#090d16';
    g.beginPath();
    g.arc(128, 128, 122, 0, Math.PI * 2);
    g.fill();

    g.strokeStyle = '#64748b';
    g.lineWidth = 8;
    g.stroke();

    // Speedometer arc ticks
    for (let i = 0; i <= 8; i += 1) {
      const ang = Math.PI * 0.78 + (i / 8) * Math.PI * 1.44;
      g.strokeStyle = i >= 6 ? '#ef4444' : '#38bdf8';
      g.lineWidth = 4;
      g.beginPath();
      g.moveTo(128 + Math.cos(ang) * 90, 128 + Math.sin(ang) * 90);
      g.lineTo(128 + Math.cos(ang) * 108, 128 + Math.sin(ang) * 108);
      g.stroke();
    }

    // Needle
    const ratio = Math.max(0, Math.min(1, kmh / 185));
    const needleAng = Math.PI * 0.78 + ratio * Math.PI * 1.44;
    g.strokeStyle = '#ef4444';
    g.lineWidth = 6;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(128, 128);
    g.lineTo(128 + Math.cos(needleAng) * 86, 128 + Math.sin(needleAng) * 86);
    g.stroke();

    g.fillStyle = '#e2e8f0';
    g.beginPath();
    g.arc(128, 128, 12, 0, Math.PI * 2);
    g.fill();

    // Digital readout box
    g.fillStyle = '#0f172a';
    g.fillRect(68, 152, 120, 56);
    g.strokeStyle = '#334155';
    g.lineWidth = 2;
    g.strokeRect(68, 152, 120, 56);

    g.fillStyle = powerups && powerups.fuelBoost > 0 ? '#fb923c' : '#38bdf8';
    g.font = 'bold 34px monospace';
    g.textAlign = 'center';
    g.fillText(`${Math.round(kmh)}`, 128, 184);

    g.fillStyle = braking ? '#ef4444' : '#facc15';
    g.font = 'bold 16px monospace';
    g.fillText(braking ? 'BRAKE' : `${Math.floor(distanceMeters)}m`, 128, 203);

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

      const leftSig = new THREE.Mesh(
        new THREE.BoxGeometry(0.16, 0.14, 0.08),
        new THREE.MeshBasicMaterial({ color: '#f59e0b' })
      );
      leftSig.position.set(-0.78, 0.54, 1.94);
      leftSig.visible = false;
      const rightSig = leftSig.clone();
      rightSig.position.x = 0.78;
      group.add(leftSig, rightSig);
      userData.leftSig = leftSig;
      userData.rightSig = rightSig;

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
      camera = new THREE.PerspectiveCamera(62, 16 / 9, 0.08, 280);

      buildProceduralTextures();
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

  function resize(cssWidth, cssHeight) {
    if (!initialized || !renderer || !camera) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    renderer.setPixelRatio(dpr);
    renderer.setSize(Math.max(1, cssWidth), Math.max(1, cssHeight), false);
    camera.aspect = Math.max(0.25, cssWidth / Math.max(1, cssHeight));
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
    } = state;

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

    // Position 3D bike rig squarely inside rider view & road lane
    if (bikeRoot && steeringGroup) {
      const bob = Math.sin(engineVibPhase) * 0.004;
      const wheelie =
        celebrationTimer > 0 ? Math.sin(Math.min(1, celebrationTimer / 2.5) * Math.PI) * 0.08 : 0;
      bikeRoot.position.set(camX + rattleX, camY - 0.31 + bob + rattleY, -0.45);
      bikeRoot.rotation.set(wheelie - suspensionPitch * 0.006, 0, worldRollAngle * 1.5);

      steeringGroup.rotation.y = -handlebarAngle * 0.72;
      if (rightBrakeLever) {
        rightBrakeLever.rotation.y = braking ? -0.22 : 0;
      }
      if (rightFingersGroup) {
        rightFingersGroup.rotation.x = braking ? 0.28 : 0;
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

      updateDashTexture(kmhOrZero(speedKmh, state.isRunning), braking, distanceMeters, powerups);
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

      // Rotate vehicle wheels & tilt slightly when yielding lanes
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
        mesh.rotation.y = Math.abs(laneErr) > 0.02 ? laneErr * -0.22 : 0;
        if (ud.leftSig && ud.rightSig) {
          const blink = Math.floor(nowSec * 8) % 2 === 0;
          ud.leftSig.visible = laneErr < -0.02 && blink;
          ud.rightSig.visible = laneErr > 0.02 && blink;
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

  window.BendskinUltra3D = {
    isSupported,
    init,
    resize,
    renderFrame,
  };
})();
