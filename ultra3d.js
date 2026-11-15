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
  let fillLight = null;
  let hemiLight = null;
  let roadTexture = null;
  let roadUltraTexture = null;
  let roadBumpTexture = null;
  let roadRoughTexture = null;
  let lateriteTexture = null;
  let lateriteUltraTexture = null;
  let lateriteBumpTexture = null;
  let roadMesh = null;
  let roadMatStd = null;
  let roadMatUltra = null;
  let groundMesh = null;
  let groundMatStd = null;
  let groundMatUltra = null;
  let ultraRoadAccents = null;
  let ultraEnvTex = null;
  let appliedSceneQuality = null;

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

  // Pooled 3D scenery & entity meshes (separated cleanly for Standard vs Ultra 1080p)
  const propMeshMapStd = new WeakMap();
  const propActiveStd = new Set();
  const propMeshMapUltra = new WeakMap();
  const propActiveUltra = new Set();
  const entityMeshMapStd = new WeakMap();
  const entityActiveStd = new Set();
  const entityMeshMapUltra = new WeakMap();
  const entityActiveUltra = new Set();
  let ultraPropCounter = 0;

  // Shared materials/textures/geometries cache for crisp 60fps performance
  const texCache = {};
  const matCache = {};
  const ultraGeoCache = {};

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

  function makeCanvasTexture(key, width, height, drawFn, repeatX = 1, repeatY = 1, opts = {}) {
    if (texCache[key]) return texCache[key];
    const c = document.createElement('canvas');
    c.width = width;
    c.height = height;
    const g = c.getContext('2d');
    drawFn(g, width, height);
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = opts.clamp ? THREE.ClampToEdgeWrapping : THREE.RepeatWrapping;
    tex.wrapT = opts.clamp ? THREE.ClampToEdgeWrapping : THREE.RepeatWrapping;
    tex.repeat.set(repeatX, repeatY);
    tex.encoding = opts.linear ? THREE.LinearEncoding : THREE.sRGBEncoding;
    tex.generateMipmaps = true;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.anisotropy = 4;
    texCache[key] = tex;
    return tex;
  }

  function buildProceduralTextures() {
    // Standard 512 asphalt for Medium / High tiers
    roadTexture = makeCanvasTexture(
      'asphalt',
      512,
      512,
      (g, w, h) => {
        g.fillStyle = '#1f2633';
        g.fillRect(0, 0, w, h);

        const laneCenters = [w * 0.21, w * 0.5, w * 0.79];
        laneCenters.forEach((cx) => {
          const trackGrad = g.createLinearGradient(cx - 46, 0, cx + 46, 0);
          trackGrad.addColorStop(0, 'rgba(15, 23, 42, 0)');
          trackGrad.addColorStop(0.5, 'rgba(9, 13, 22, 0.34)');
          trackGrad.addColorStop(1, 'rgba(15, 23, 42, 0)');
          g.fillStyle = trackGrad;
          g.fillRect(cx - 46, 0, 92, h);
        });

        for (let i = 0; i < 4200; i += 1) {
          const px = (i * 197) % w;
          const py = (i * 353) % h;
          g.fillStyle = i % 3 === 0 ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.14)';
          g.fillRect(px, py, 2, 2);
        }

        g.fillStyle = '#eab308';
        g.fillRect(14, 0, 10, h);
        g.fillRect(w - 24, 0, 10, h);

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

    // Ultra 1080p Hi-Res 1024x1024 Asphalt + Aggregate + Tar Cracks + Reflector Studs
    roadUltraTexture = makeCanvasTexture(
      'asphaltUltra',
      1024,
      1024,
      (g, w, h) => {
        const base = g.createLinearGradient(0, 0, w, 0);
        base.addColorStop(0, '#272f3d');
        base.addColorStop(0.08, '#1e2532');
        base.addColorStop(0.5, '#202836');
        base.addColorStop(0.92, '#1e2532');
        base.addColorStop(1, '#272f3d');
        g.fillStyle = base;
        g.fillRect(0, 0, w, h);

        // Dual tire tracks per lane
        [w * 0.2, w * 0.5, w * 0.8].forEach((cx) => {
          [-26, 26].forEach((off) => {
            const tg = g.createLinearGradient(cx + off - 34, 0, cx + off + 34, 0);
            tg.addColorStop(0, 'rgba(9, 13, 22, 0)');
            tg.addColorStop(0.5, 'rgba(7, 11, 18, 0.38)');
            tg.addColorStop(1, 'rgba(9, 13, 22, 0)');
            g.fillStyle = tg;
            g.fillRect(cx + off - 34, 0, 68, h);
          });
        });

        // Multi-scale stone aggregate mineral speckles
        for (let i = 0; i < 19000; i += 1) {
          const px = (i * 197 + (i % 7) * 31) % w;
          const py = (i * 353 + (i % 13) * 19) % h;
          const sz = i % 11 === 0 ? 3 : i % 3 === 0 ? 2 : 1;
          g.fillStyle =
            i % 9 === 0
              ? 'rgba(203, 213, 225, 0.085)'
              : i % 4 === 0
              ? 'rgba(148, 163, 184, 0.055)'
              : 'rgba(2, 6, 23, 0.22)';
          g.fillRect(px, py, sz, sz);
        }

        // Subtle asphalt tar repair seams
        g.strokeStyle = 'rgba(7, 10, 18, 0.55)';
        g.lineWidth = 3;
        g.beginPath();
        g.moveTo(160, 120);
        g.bezierCurveTo(210, 290, 175, 420, 235, 620);
        g.moveTo(740, 480);
        g.bezierCurveTo(790, 660, 725, 810, 770, 980);
        g.stroke();

        // Crisp double yellow edge safety markings with weathered edges
        g.fillStyle = '#eab308';
        g.fillRect(24, 0, 14, h);
        g.fillRect(46, 0, 8, h);
        g.fillRect(w - 38, 0, 14, h);
        g.fillRect(w - 54, 0, 8, h);

        // Crisp white thermoplastic lane dashes + amber/white cat's-eye reflector dots
        const divX1 = Math.round(w * 0.355);
        const divX2 = Math.round(w * 0.645);
        for (let dy = 36; dy < h; dy += 256) {
          g.fillStyle = 'rgba(248, 250, 252, 0.94)';
          g.fillRect(divX1 - 8, dy, 16, 136);
          g.fillRect(divX2 - 8, dy, 16, 136);
          g.fillStyle = 'rgba(255, 255, 255, 0.95)';
          g.fillRect(divX1 - 5, dy + 178, 10, 10);
          g.fillRect(divX2 - 5, dy + 178, 10, 10);
        }
      },
      1,
      ROAD_LENGTH_3D / 14
    );

    roadBumpTexture = makeCanvasTexture(
      'asphaltBump',
      512,
      512,
      (g, w, h) => {
        g.fillStyle = '#808080';
        g.fillRect(0, 0, w, h);
        for (let i = 0; i < 12000; i += 1) {
          const px = (i * 149) % w;
          const py = (i * 293) % h;
          const shade = i % 2 === 0 ? 176 + (i % 45) : 72 + (i % 42);
          g.fillStyle = `rgb(${shade},${shade},${shade})`;
          g.fillRect(px, py, i % 5 === 0 ? 2 : 1, i % 5 === 0 ? 2 : 1);
        }
      },
      1,
      ROAD_LENGTH_3D / 14,
      { linear: true }
    );

    roadRoughTexture = makeCanvasTexture(
      'asphaltRough',
      512,
      512,
      (g, w, h) => {
        g.fillStyle = '#d4d4d4';
        g.fillRect(0, 0, w, h);
        [w * 0.2, w * 0.5, w * 0.8].forEach((cx) => {
          [-13, 13].forEach((off) => {
            const rg = g.createLinearGradient(cx + off - 18, 0, cx + off + 18, 0);
            rg.addColorStop(0, 'rgba(160,160,160,0)');
            rg.addColorStop(0.5, 'rgba(110,110,110,0.92)');
            rg.addColorStop(1, 'rgba(160,160,160,0)');
            g.fillStyle = rg;
            g.fillRect(cx + off - 18, 0, 36, h);
          });
        });
      },
      1,
      ROAD_LENGTH_3D / 14,
      { linear: true }
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

    lateriteUltraTexture = makeCanvasTexture(
      'lateriteUltra',
      512,
      512,
      (g, w, h) => {
        g.fillStyle = '#5a2d18';
        g.fillRect(0, 0, w, h);
        for (let i = 0; i < 9000; i += 1) {
          const px = (i * 173) % w;
          const py = (i * 317) % h;
          const tone = i % 5 === 0 ? 'rgba(21, 128, 61, 0.32)' : i % 3 === 0 ? 'rgba(146, 64, 14, 0.42)' : 'rgba(41, 20, 10, 0.34)';
          g.fillStyle = tone;
          g.fillRect(px, py, (i % 3) + 2, (i % 3) + 2);
        }
      },
      14,
      ROAD_LENGTH_3D / 8
    );

    lateriteBumpTexture = makeCanvasTexture(
      'lateriteBump',
      256,
      256,
      (g, w, h) => {
        g.fillStyle = '#808080';
        g.fillRect(0, 0, w, h);
        for (let i = 0; i < 3600; i += 1) {
          const v = 90 + ((i * 37) % 85);
          g.fillStyle = `rgb(${v},${v},${v})`;
          g.fillRect((i * 113) % w, (i * 229) % h, 3, 3);
        }
      },
      14,
      ROAD_LENGTH_3D / 8,
      { linear: true }
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

    texCache.buildingGlassUltra = makeCanvasTexture(
      'buildingGlassUltra',
      512,
      1024,
      (g, w, h) => {
        g.fillStyle = '#1e293b';
        g.fillRect(0, 0, w, h);
        for (let row = 20; row < h - 20; row += 68) {
          // Horizontal floor concrete slab spandrel
          g.fillStyle = '#334155';
          g.fillRect(0, row - 12, w, 12);
          g.fillStyle = '#475569';
          g.fillRect(0, row - 12, w, 3);
          for (let col = 18; col < w - 24; col += 60) {
            const seed = (row * 11 + col * 17) % 19;
            const winGrad = g.createLinearGradient(col, row, col + 46, row + 48);
            if (seed > 9) {
              winGrad.addColorStop(0, '#fef08a');
              winGrad.addColorStop(0.65, '#f59e0b');
              winGrad.addColorStop(1, '#78350f');
            } else if (seed > 4) {
              winGrad.addColorStop(0, '#38bdf8');
              winGrad.addColorStop(0.55, '#0f172a');
              winGrad.addColorStop(1, '#020617');
            } else {
              winGrad.addColorStop(0, '#1e293b');
              winGrad.addColorStop(1, '#090d16');
            }
            g.fillStyle = winGrad;
            g.fillRect(col, row + 4, 46, 44);
            // Window aluminum mullions & interior blinds
            g.strokeStyle = '#64748b';
            g.lineWidth = 2;
            g.strokeRect(col, row + 4, 46, 44);
            g.beginPath();
            g.moveTo(col + 23, row + 4);
            g.lineTo(col + 23, row + 48);
            g.stroke();
          }
        }
      },
      1,
      1
    );

    texCache.buildingConcreteUltra = makeCanvasTexture(
      'buildingConcreteUltra',
      512,
      1024,
      (g, w, h) => {
        g.fillStyle = '#b49474';
        g.fillRect(0, 0, w, h);
        for (let i = 0; i < 6500; i += 1) {
          g.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.06)' : 'rgba(67,20,7,0.08)';
          g.fillRect((i * 107) % w, (i * 211) % h, 3, 2);
        }
        for (let row = 44; row < h - 48; row += 108) {
          g.fillStyle = '#785a40';
          g.fillRect(0, row - 14, w, 10);
          for (let col = 28; col < w - 42; col += 88) {
            const lit = ((row * 3 + col * 5) % 13) > 5;
            g.fillStyle = '#475569';
            g.fillRect(col - 4, row, 58, 68);
            g.fillStyle = lit ? '#fde68a' : '#0f172a';
            g.fillRect(col + 2, row + 6, 46, 56);
            // Louvered shutter accents
            g.fillStyle = '#92400e';
            g.fillRect(col + 2, row + 6, 12, 56);
            g.fillRect(col + 36, row + 6, 12, 56);
          }
        }
      },
      1,
      1
    );

    texCache.buildingBumpUltra = makeCanvasTexture(
      'buildingBumpUltra',
      256,
      512,
      (g, w, h) => {
        g.fillStyle = '#a8a8a8';
        g.fillRect(0, 0, w, h);
        for (let row = 10; row < h - 10; row += 34) {
          g.fillStyle = '#e0e0e0';
          g.fillRect(0, row - 6, w, 6);
          for (let col = 9; col < w - 12; col += 30) {
            g.fillStyle = '#383838';
            g.fillRect(col, row + 2, 23, 22);
          }
        }
      },
      1,
      1,
      { linear: true }
    );

    texCache.palmBarkUltra = makeCanvasTexture(
      'palmBarkUltra',
      256,
      512,
      (g, w, h) => {
        g.fillStyle = '#6b4226';
        g.fillRect(0, 0, w, h);
        for (let y = 0; y < h; y += 20) {
          g.fillStyle = '#3f2210';
          g.fillRect(0, y, w, 5);
          g.fillStyle = '#8b5a36';
          g.fillRect(0, y + 5, w, 4);
        }
        for (let i = 0; i < 1400; i += 1) {
          g.fillStyle = i % 2 === 0 ? 'rgba(0,0,0,0.18)' : 'rgba(255,235,205,0.08)';
          g.fillRect((i * 89) % w, (i * 157) % h, 2, 6);
        }
      },
      1,
      4
    );

    texCache.timberBarkUltra = makeCanvasTexture(
      'timberBarkUltra',
      512,
      512,
      (g, w, h) => {
        g.fillStyle = '#5c3419';
        g.fillRect(0, 0, w, h);
        for (let x = 0; x < w; x += 8) {
          const shade = 45 + ((x * 13) % 45);
          g.fillStyle = `rgb(${shade + 22}, ${Math.floor(shade * 0.6)}, ${Math.floor(shade * 0.35)})`;
          g.fillRect(x, 0, 5, h);
        }
        for (let i = 0; i < 2400; i += 1) {
          g.fillStyle = 'rgba(20, 10, 4, 0.28)';
          g.fillRect((i * 101) % w, (i * 193) % h, 2, 18);
        }
      },
      1,
      2
    );

    texCache.timberEndUltra = makeCanvasTexture(
      'timberEndUltra',
      256,
      256,
      (g, w, h) => {
        g.fillStyle = '#d99b52';
        g.fillRect(0, 0, w, h);
        const cx = w * 0.5;
        const cy = h * 0.5;
        for (let r = 12; r < 120; r += 9) {
          g.strokeStyle = r % 18 === 0 ? '#78350f' : '#b45309';
          g.lineWidth = 2.5;
          g.beginPath();
          g.arc(cx, cy, r, 0, Math.PI * 2);
          g.stroke();
        }
        g.strokeStyle = '#78350f';
        g.lineWidth = 3;
        g.beginPath();
        g.moveTo(cx, cy);
        g.lineTo(cx + 85, cy + 40);
        g.moveTo(cx, cy);
        g.lineTo(cx - 72, cy + 55);
        g.stroke();
      },
      1,
      1,
      { clamp: true }
    );

    texCache.palmFrondUltra = makeCanvasTexture(
      'palmFrondUltra',
      512,
      512,
      (g, w, h) => {
        g.clearRect(0, 0, w, h);
        const cx = w * 0.5;
        // Central stem (rachis)
        g.fillStyle = '#4d7c0f';
        g.fillRect(cx - 5, 16, 10, h - 24);
        // Individual feathery serrated leaflets on left & right
        for (let y = 26; y < h - 32; y += 22) {
          const span = Math.sin(((y - 20) / (h - 45)) * Math.PI) * (w * 0.44);
          [-1, 1].forEach((side) => {
            g.fillStyle = y % 44 === 0 ? '#16a34a' : '#22c55e';
            g.beginPath();
            g.moveTo(cx, y);
            g.quadraticCurveTo(cx + side * span * 0.55, y - 10, cx + side * span, y + 14);
            g.quadraticCurveTo(cx + side * span * 0.45, y + 9, cx, y + 11);
            g.closePath();
            g.fill();
            g.strokeStyle = '#14532d';
            g.lineWidth = 1.5;
            g.stroke();
          });
        }
      },
      1,
      1,
      { clamp: true }
    );

    texCache.mangoCanopyUltra = makeCanvasTexture(
      'mangoCanopyUltra',
      512,
      512,
      (g, w, h) => {
        g.clearRect(0, 0, w, h);
        for (let i = 0; i < 420; i += 1) {
          const angle = i * 2.39996;
          const dist = Math.sqrt(i / 420) * (w * 0.43);
          const lx = w * 0.5 + Math.cos(angle) * dist;
          const ly = h * 0.5 + Math.sin(angle) * dist;
          const rx = 16 + (i % 10);
          const ry = 9 + (i % 6);
          g.save();
          g.translate(lx, ly);
          g.rotate(angle);
          g.fillStyle =
            i % 7 === 0
              ? '#4ade80'
              : i % 4 === 0
              ? '#16a34a'
              : i % 3 === 0
              ? '#15803d'
              : '#14532d';
          g.beginPath();
          g.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
          g.fill();
          g.restore();
        }
      },
      1,
      1,
      { clamp: true }
    );

    texCache.billboardUltra = makeCanvasTexture(
      'billboardUltra',
      1024,
      512,
      (g, w, h) => {
        const grad = g.createLinearGradient(0, 0, w, h);
        grad.addColorStop(0, '#0f172a');
        grad.addColorStop(0.55, '#1e3a8a');
        grad.addColorStop(1, '#ea580c');
        g.fillStyle = grad;
        g.fillRect(0, 0, w, h);
        g.strokeStyle = '#facc15';
        g.lineWidth = 16;
        g.strokeRect(20, 20, w - 40, h - 40);
        g.fillStyle = '#fde047';
        g.font = '900 84px sans-serif';
        g.textAlign = 'center';
        g.fillText('BENDSKIN RUSH 237', w * 0.5, 210);
        g.fillStyle = '#ffffff';
        g.font = 'bold 44px sans-serif';
        g.fillText('DOUALA • YAOUNDE EXPRESS', w * 0.5, 315);
        g.fillStyle = '#38bdf8';
        g.font = 'bold 34px monospace';
        g.fillText('RESPECT SIGNALS • RIDE TO WIN', w * 0.5, 395);
      },
      1,
      1,
      { clamp: true }
    );

    texCache.barrierStripe = makeCanvasTexture(
      'barrier',
      512,
      128,
      (g, w, h) => {
        g.fillStyle = '#f8fafc';
        g.fillRect(0, 0, w, h);
        g.fillStyle = '#dc2626';
        for (let x = -64; x < w + 64; x += 96) {
          g.beginPath();
          g.moveTo(x, h);
          g.lineTo(x + 48, h);
          g.lineTo(x + 84, 0);
          g.lineTo(x + 36, 0);
          g.closePath();
          g.fill();
        }
        // Subtle concrete wear speckles
        for (let i = 0; i < 900; i += 1) {
          g.fillStyle = 'rgba(15,23,42,0.1)';
          g.fillRect((i * 73) % w, (i * 41) % h, 2, 2);
        }
      },
      1,
      1
    );
  }

  function createSkyDomeShaderMat() {
    return new THREE.ShaderMaterial({
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
          col += vec3(1.0, 0.85, 0.45) * pow(sunDot, 22.0) * 0.78;
          col += vec3(1.0, 0.96, 0.85) * smoothstep(0.9965, 0.9992, sunDot);
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });
  }

  function createSkyDome() {
    const skyGeo = new THREE.SphereGeometry(280, 32, 20);
    const skyMat = createSkyDomeShaderMat();
    const dome = new THREE.Mesh(skyGeo, skyMat);
    scene.add(dome);
  }

  function buildEnvironmentReflectionMap(targetRenderer) {
    if (!targetRenderer || typeof THREE.PMREMGenerator !== 'function') return null;
    try {
      const pmrem = new THREE.PMREMGenerator(targetRenderer);
      pmrem.compileEquirectangularShader();
      const envScene = new THREE.Scene();
      const envSky = new THREE.Mesh(new THREE.SphereGeometry(30, 20, 14), createSkyDomeShaderMat());
      envScene.add(envSky);
      const envGround = new THREE.Mesh(
        new THREE.CircleGeometry(28, 20),
        new THREE.MeshBasicMaterial({ color: '#1e2430' })
      );
      envGround.rotation.x = -Math.PI / 2;
      envGround.position.y = -2;
      envScene.add(envGround);
      const rt = pmrem.fromScene(envScene, 0.04);
      pmrem.dispose();
      return rt.texture;
    } catch {
      return null;
    }
  }

  function applyTextureAnisotropy(mode) {
    if (!renderer || !renderer.capabilities) return;
    const hwMax = renderer.capabilities.getMaxAnisotropy() || 4;
    const targetAniso = mode === 'ultra' ? Math.min(16, hwMax) : mode === 'high' ? Math.min(8, hwMax) : Math.min(4, hwMax);
    Object.values(texCache).forEach((tex) => {
      if (tex) {
        tex.anisotropy = targetAniso;
        tex.needsUpdate = true;
      }
    });
    if (dashTexture) {
      dashTexture.anisotropy = targetAniso;
      dashTexture.needsUpdate = true;
    }
  }

  function applyQualityConfigToScene(mode) {
    if (!scene || !renderer || appliedSceneQuality === mode) return;
    appliedSceneQuality = mode;
    const isUltra = mode === 'ultra';
    const isHighOrAbove = mode === 'high' || isUltra;

    applyTextureAnisotropy(mode);

    scene.environment = isUltra && ultraEnvTex ? ultraEnvTex : null;

    if (roadMesh && roadMatStd && roadMatUltra) {
      roadMesh.material = isUltra ? roadMatUltra : roadMatStd;
    }
    if (groundMesh && groundMatStd && groundMatUltra) {
      groundMesh.material = isUltra ? groundMatUltra : groundMatStd;
    }
    if (ultraRoadAccents) {
      ultraRoadAccents.visible = isUltra;
    }
    if (sunLight) {
      const targetShadowSize = isHighOrAbove ? 2048 : 1024;
      if (sunLight.shadow.mapSize.width !== targetShadowSize) {
        sunLight.shadow.mapSize.width = targetShadowSize;
        sunLight.shadow.mapSize.height = targetShadowSize;
        if (sunLight.shadow.map) {
          sunLight.shadow.map.dispose();
          sunLight.shadow.map = null;
        }
      }
      sunLight.intensity = isUltra ? 1.68 : 1.48;
    }
    if (hemiLight) {
      hemiLight.intensity = isUltra ? 1.05 : 0.92;
    }

    // Hide inactive tier pools when quality changes dynamically
    const hidePool = (pool) => {
      pool.forEach((m) => {
        m.visible = false;
      });
    };
    if (isUltra) {
      hidePool(propActiveStd);
      propActiveStd.clear();
      entityActiveStd.forEach((m) => scene.remove(m));
      entityActiveStd.clear();
    } else {
      hidePool(propActiveUltra);
      propActiveUltra.clear();
      entityActiveUltra.forEach((m) => scene.remove(m));
      entityActiveUltra.clear();
    }
  }

  function createEnvironment() {
    createSkyDome();
    ultraEnvTex = buildEnvironmentReflectionMap(renderer);

    scene.fog = new THREE.FogExp2('#9a3412', 0.0082);

    hemiLight = new THREE.HemisphereLight('#fde68a', '#431407', 0.95);
    scene.add(hemiLight);

    sunLight = new THREE.DirectionalLight('#fff1d0', 1.55);
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

    fillLight = new THREE.DirectionalLight('#38bdf8', 0.38);
    fillLight.position.set(-10, 8, 12);
    scene.add(fillLight);

    // Asphalt highway mesh (Standard & Ultra PBR Materials)
    const roadGeo = new THREE.PlaneGeometry(ROAD_WIDTH_3D, ROAD_LENGTH_3D);
    roadMatStd = new THREE.MeshStandardMaterial({
      map: roadTexture,
      roughness: 0.78,
      metalness: 0.08,
    });
    roadMatUltra = new THREE.MeshStandardMaterial({
      map: roadUltraTexture,
      bumpMap: roadBumpTexture,
      bumpScale: 0.04,
      roughnessMap: roadRoughTexture,
      roughness: 0.74,
      metalness: 0.14,
      envMapIntensity: 0.75,
    });
    roadMesh = new THREE.Mesh(roadGeo, roadMatUltra);
    roadMesh.rotation.x = -Math.PI / 2;
    roadMesh.position.set(0, 0, -ROAD_LENGTH_3D * 0.5 + 16);
    roadMesh.receiveShadow = true;
    scene.add(roadMesh);

    // Beveled concrete road curbs & Ultra storm drains / glowing cat's-eye studs
    const curbGeo = new THREE.BoxGeometry(0.48, 0.24, ROAD_LENGTH_3D);
    const curbMat = new THREE.MeshStandardMaterial({ color: '#94a3b8', roughness: 0.82 });
    [-1, 1].forEach((side) => {
      const curb = new THREE.Mesh(curbGeo, curbMat);
      curb.position.set(side * (ROAD_WIDTH_3D * 0.5 + 0.24), 0.12, -ROAD_LENGTH_3D * 0.5 + 16);
      curb.receiveShadow = true;
      scene.add(curb);
    });

    ultraRoadAccents = new THREE.Group();
    const studGeo = new THREE.BoxGeometry(0.11, 0.035, 0.18);
    const studMat = new THREE.MeshBasicMaterial({ color: '#fef08a' });
    const seamGeo = new THREE.BoxGeometry(0.52, 0.25, 0.12);
    const seamMat = new THREE.MeshStandardMaterial({ color: '#475569', roughness: 0.9 });
    for (let z = 12; z > -ROAD_LENGTH_3D + 18; z -= 8) {
      [-LANE_WIDTH_3D * 0.5, LANE_WIDTH_3D * 0.5].forEach((lx) => {
        const stud = new THREE.Mesh(studGeo, studMat);
        stud.position.set(lx, 0.018, z);
        ultraRoadAccents.add(stud);
      });
      [-1, 1].forEach((side) => {
        const seam = new THREE.Mesh(seamGeo, seamMat);
        seam.position.set(side * (ROAD_WIDTH_3D * 0.5 + 0.24), 0.122, z);
        ultraRoadAccents.add(seam);
      });
    }
    scene.add(ultraRoadAccents);

    // Laterite red-earth ground plane (Standard & Ultra PBR Materials)
    const groundGeo = new THREE.PlaneGeometry(190, ROAD_LENGTH_3D);
    groundMatStd = new THREE.MeshStandardMaterial({
      map: lateriteTexture,
      roughness: 0.95,
      metalness: 0.02,
    });
    groundMatUltra = new THREE.MeshStandardMaterial({
      map: lateriteUltraTexture,
      bumpMap: lateriteBumpTexture,
      bumpScale: 0.08,
      roughness: 0.94,
      metalness: 0.02,
    });
    groundMesh = new THREE.Mesh(groundGeo, groundMatUltra);
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

  // =========================================================
  // Ultra HD 1080p Sculpted Geometry & PBR Asset Builders
  // =========================================================
  function makeCarProfileGeo(pts, width, bevelSize = 0.075, bevelSegments = 3) {
    const shape = new THREE.Shape();
    shape.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i += 1) {
      shape.lineTo(pts[i][0], pts[i][1]);
    }
    shape.closePath();
    const innerWidth = Math.max(0.08, width - bevelSize * 2);
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: innerWidth,
      bevelEnabled: bevelSize > 0,
      bevelThickness: bevelSize,
      bevelSize,
      bevelSegments,
      steps: 1,
    });
    geo.translate(0, 0, -innerWidth * 0.5);
    geo.rotateY(-Math.PI / 2);
    geo.computeVertexNormals();
    return geo;
  }

  function makeCurvedFrondGeo() {
    const segs = 7;
    const width = 0.92;
    const length = 2.65;
    const geo = new THREE.PlaneGeometry(width, length, 2, segs);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i += 1) {
      const x = pos.getX(i);
      const origY = pos.getY(i);
      // t runs 0 at crown base to 1 at tip
      const t = (origY + length * 0.5) / length;
      const zOut = t * length;
      const archY = Math.sin(t * Math.PI * 0.72) * 0.55 - t * t * 0.95;
      const vFold = -Math.abs(x) * (0.14 + t * 0.1);
      pos.setXYZ(i, x * (1 - t * 0.28), archY + vFold, -zOut);
    }
    geo.computeVertexNormals();
    return geo;
  }

  function makeJitteredCanopyGeo(radius, detail = 2, seed = 1) {
    const geo = new THREE.IcosahedronGeometry(radius, detail);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i += 1) {
      const vx = pos.getX(i);
      const vy = pos.getY(i);
      const vz = pos.getZ(i);
      const n = 1 + 0.16 * Math.sin(vx * 3.1 + seed) * Math.cos(vy * 2.7 - vz * 2.4);
      pos.setXYZ(i, vx * n, vy * n * 0.78, vz * n);
    }
    geo.computeVertexNormals();
    return geo;
  }

  function getSharedUltraAssets() {
    if (ultraGeoCache.ready) return ultraGeoCache;

    // 1. Sleek Sedan (Yellow Taxi) sculpted body + glass greenhouse
    ultraGeoCache.taxiLowerGeo = makeCarProfileGeo(
      [
        [-1.96, 0.34],
        [-1.98, 0.58],
        [-1.84, 0.78],
        [-1.08, 0.9],
        [1.18, 0.92],
        [1.86, 0.86],
        [1.98, 0.62],
        [1.96, 0.34],
      ],
      1.78,
      0.085,
      3
    );
    ultraGeoCache.taxiCabinGeo = makeCarProfileGeo(
      [
        [-1.02, 0.87],
        [-0.36, 1.38],
        [0.58, 1.39],
        [1.3, 0.9],
      ],
      1.46,
      0.08,
      3
    );

    // 2. Sculpted Sloped-Nose Minibus (Clando Van)
    ultraGeoCache.vanBodyGeo = makeCarProfileGeo(
      [
        [-2.06, 0.36],
        [-2.14, 0.82],
        [-1.82, 1.56],
        [-1.34, 1.84],
        [1.88, 1.84],
        [2.08, 1.54],
        [2.08, 0.38],
      ],
      1.86,
      0.095,
      3
    );

    // 3. Sculpted Heavy Cab-Over Forestry Truck Cab
    ultraGeoCache.truckCabGeo = makeCarProfileGeo(
      [
        [-0.95, 0.72],
        [-1.04, 1.46],
        [-0.86, 2.38],
        [-0.55, 2.66],
        [0.86, 2.66],
        [0.92, 0.72],
      ],
      2.04,
      0.085,
      3
    );

    // 4. Concrete Jersey Barrier profile
    ultraGeoCache.jerseyGeo = makeCarProfileGeo(
      [
        [-0.32, 0],
        [-0.24, 0.24],
        [-0.13, 0.52],
        [-0.08, 0.84],
        [0.08, 0.84],
        [0.13, 0.52],
        [0.24, 0.24],
        [0.32, 0],
      ],
      2.18,
      0.025,
      2
    );
    // Rotate jersey barrier so length spans X across the road lane cleanly
    ultraGeoCache.jerseyGeo.rotateY(Math.PI / 2);

    // 5. Beveled Metallic Coin + Beveled U-Magnet
    const coinShape = new THREE.Shape();
    coinShape.absarc(0, 0, 0.42, 0, Math.PI * 2, false);
    ultraGeoCache.coinGeo = new THREE.ExtrudeGeometry(coinShape, {
      depth: 0.08,
      bevelEnabled: true,
      bevelThickness: 0.025,
      bevelSize: 0.025,
      bevelSegments: 2,
      curveSegments: 24,
    });
    ultraGeoCache.coinGeo.center();

    const magOuter = new THREE.Shape();
    magOuter.absarc(0, 0.02, 0.36, Math.PI, 0, true);
    magOuter.lineTo(0.36, 0.36);
    magOuter.lineTo(0.18, 0.36);
    magOuter.absarc(0, 0.02, 0.18, 0, Math.PI, false);
    magOuter.lineTo(-0.36, 0.36);
    magOuter.closePath();
    ultraGeoCache.magnetArchGeo = new THREE.ExtrudeGeometry(magOuter, {
      depth: 0.14,
      bevelEnabled: true,
      bevelThickness: 0.025,
      bevelSize: 0.025,
      bevelSegments: 2,
      curveSegments: 20,
    });
    ultraGeoCache.magnetArchGeo.center();

    // 6. Organic Palm Trunk Curves & Arched Frond + Mango Canopy Clusters
    const curveLeft = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0.18, 1.8, 0.08),
      new THREE.Vector3(0.32, 3.8, -0.05),
      new THREE.Vector3(0.14, 5.7, 0.1),
    ]);
    ultraGeoCache.palmTrunkGeoA = new THREE.TubeGeometry(curveLeft, 12, 0.2, 10, false);
    ultraGeoCache.frondGeo = makeCurvedFrondGeo();
    ultraGeoCache.canopyLobeA = makeJitteredCanopyGeo(1.7, 2, 1.3);
    ultraGeoCache.canopyLobeB = makeJitteredCanopyGeo(1.32, 2, 3.7);

    const lampCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 4.9, 0),
      new THREE.Vector3(-0.22, 6.05, 0),
      new THREE.Vector3(-0.85, 6.42, 0),
      new THREE.Vector3(-1.38, 6.28, 0),
    ]);
    ultraGeoCache.lampPoleGeo = new THREE.TubeGeometry(lampCurve, 14, 0.085, 10, false);

    // Shared Ultra PBR materials
    matCache.uTire = new THREE.MeshStandardMaterial({ color: '#0b101b', roughness: 0.86, metalness: 0.08 });
    matCache.uAlloy = new THREE.MeshStandardMaterial({ color: '#e2e8f0', roughness: 0.18, metalness: 0.92 });
    matCache.uRotor = new THREE.MeshStandardMaterial({ color: '#94a3b8', roughness: 0.28, metalness: 0.85 });
    matCache.uCaliper = new THREE.MeshStandardMaterial({ color: '#dc2626', roughness: 0.3, metalness: 0.45 });
    matCache.uDarkTrim = new THREE.MeshStandardMaterial({ color: '#111827', roughness: 0.55, metalness: 0.35 });
    matCache.uChrome = new THREE.MeshStandardMaterial({ color: '#f1f5f9', roughness: 0.1, metalness: 0.96 });
    matCache.uGlass = new THREE.MeshPhysicalMaterial({
      color: '#09111f',
      roughness: 0.06,
      metalness: 0.28,
      clearcoat: 1.0,
      clearcoatRoughness: 0.04,
      envMapIntensity: 1.35,
    });
    matCache.uConcrete = new THREE.MeshStandardMaterial({ color: '#94a3b8', roughness: 0.88, metalness: 0.05 });
    matCache.uPalmBark = new THREE.MeshStandardMaterial({ map: texCache.palmBarkUltra, roughness: 0.92, metalness: 0.02 });
    matCache.uTimberBark = new THREE.MeshStandardMaterial({ map: texCache.timberBarkUltra, roughness: 0.9, metalness: 0.03 });
    matCache.uTimberEnd = new THREE.MeshStandardMaterial({ map: texCache.timberEndUltra, roughness: 0.78, metalness: 0.02 });
    matCache.uFrond = new THREE.MeshStandardMaterial({
      map: texCache.palmFrondUltra,
      alphaTest: 0.34,
      transparent: false,
      side: THREE.DoubleSide,
      roughness: 0.62,
      metalness: 0.04,
    });
    matCache.uCanopy = new THREE.MeshStandardMaterial({
      map: texCache.mangoCanopyUltra,
      alphaTest: 0.3,
      side: THREE.DoubleSide,
      roughness: 0.72,
      metalness: 0.03,
    });
    matCache.uBldGlass = new THREE.MeshStandardMaterial({
      map: texCache.buildingGlassUltra,
      bumpMap: texCache.buildingBumpUltra,
      bumpScale: 0.08,
      roughness: 0.32,
      metalness: 0.48,
      envMapIntensity: 0.95,
    });
    matCache.uBldConcrete = new THREE.MeshStandardMaterial({
      map: texCache.buildingConcreteUltra,
      bumpMap: texCache.buildingBumpUltra,
      bumpScale: 0.07,
      roughness: 0.78,
      metalness: 0.12,
    });

    ultraGeoCache.ready = true;
    return ultraGeoCache;
  }

  function addUltraWheelMeshes(group, positions, radius = 0.34, width = 0.24) {
    getSharedUltraAssets();
    const wheels = [];
    const tireTubeR = Math.min(radius * 0.26, width * 0.42);
    const tireGeo = new THREE.TorusGeometry(radius - tireTubeR * 0.85, tireTubeR, 12, 24);
    const sidewallGeo = new THREE.CylinderGeometry(radius * 0.76, radius * 0.76, width * 0.82, 18);
    const lipGeo = new THREE.CylinderGeometry(radius * 0.58, radius * 0.58, width * 0.9, 18);
    const rotorGeo = new THREE.CylinderGeometry(radius * 0.44, radius * 0.44, width * 0.24, 16);
    const spokeGeo = new THREE.BoxGeometry(width * 0.92, radius * 1.05, 0.055);
    const capGeo = new THREE.CylinderGeometry(radius * 0.14, radius * 0.14, width + 0.02, 10);

    positions.forEach(([wx, wy, wz]) => {
      const wg = new THREE.Group();
      const tire = new THREE.Mesh(tireGeo, matCache.uTire);
      tire.rotation.y = Math.PI / 2;
      const sidewall = new THREE.Mesh(sidewallGeo, matCache.uTire);
      sidewall.rotation.z = Math.PI / 2;
      const rim = new THREE.Mesh(lipGeo, matCache.uAlloy);
      rim.rotation.z = Math.PI / 2;
      const rotor = new THREE.Mesh(rotorGeo, matCache.uRotor);
      rotor.rotation.z = Math.PI / 2;
      const cap = new THREE.Mesh(capGeo, matCache.uDarkTrim);
      cap.rotation.z = Math.PI / 2;

      wg.add(tire, sidewall, rim, rotor, cap);
      for (let sp = 0; sp < 5; sp += 1) {
        const spoke = new THREE.Mesh(spokeGeo, matCache.uAlloy);
        spoke.rotation.x = (sp * Math.PI) / 5;
        wg.add(spoke);
      }

      const cal = new THREE.Mesh(new THREE.BoxGeometry(width * 0.34, radius * 0.34, radius * 0.26), matCache.uCaliper);
      cal.position.set(wx < 0 ? -width * 0.22 : width * 0.22, wy + radius * 0.18, wz - radius * 0.22);
      group.add(cal);

      wg.position.set(wx, wy, wz);
      wg.castShadow = true;
      group.add(wg);
      wheels.push(wg);
    });
    return wheels;
  }

  function createUltraPropMesh(kind, propSide = 1) {
    const assets = getSharedUltraAssets();
    const group = new THREE.Group();
    ultraPropCounter += 1;
    const variant = ultraPropCounter;

    if (kind === 'palm') {
      if (variant % 3 === 0) {
        // Lush branching Equatorial Mango / Flame Canopy Tree (never blocky spheres!)
        const trunk = new THREE.Mesh(
          new THREE.CylinderGeometry(0.18, 0.34, 3.6, 12),
          matCache.uPalmBark
        );
        trunk.position.y = 1.8;
        trunk.castShadow = true;
        group.add(trunk);

        const limbs = [
          [-0.55, 3.85, 0.35, 0.42, 0.35],
          [0.62, 4.05, -0.25, -0.38, 0.28],
          [0.05, 4.15, -0.52, 0.1, -0.45],
        ];
        limbs.forEach(([lx, ly, lz, rz, rx]) => {
          const branch = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.17, 2.2, 8), matCache.uPalmBark);
          branch.position.set(lx * 0.55, ly - 0.65, lz * 0.55);
          branch.rotation.set(rx, 0, rz);
          group.add(branch);

          const lobe = new THREE.Mesh(assets.canopyLobeB, matCache.uCanopy);
          lobe.position.set(lx * 1.15, ly + 0.55, lz * 1.15);
          lobe.castShadow = true;
          group.add(lobe);
        });
        const crown = new THREE.Mesh(assets.canopyLobeA, matCache.uCanopy);
        crown.position.set(0, 4.95, 0);
        crown.castShadow = true;
        group.add(crown);
      } else {
        // Realistic Curved Coconut Palm with 11 arching serrated fronds + coconuts
        const trunk = new THREE.Mesh(assets.palmTrunkGeoA, matCache.uPalmBark);
        trunk.rotation.y = (variant % 4) * 0.85;
        trunk.castShadow = true;
        group.add(trunk);

        const crownX = Math.cos(trunk.rotation.y) * 0.14 - Math.sin(trunk.rotation.y) * 0.1;
        const crownZ = Math.sin(trunk.rotation.y) * 0.14 + Math.cos(trunk.rotation.y) * 0.1;
        const crownGroup = new THREE.Group();
        crownGroup.position.set(crownX, 5.65, crownZ);

        // Coconut cluster
        const nutMat = new THREE.MeshStandardMaterial({ color: '#451a03', roughness: 0.78 });
        for (let c = 0; c < 4; c += 1) {
          const nut = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), nutMat);
          const ca = (c * Math.PI) / 2;
          nut.position.set(Math.cos(ca) * 0.2, -0.15, Math.sin(ca) * 0.2);
          crownGroup.add(nut);
        }

        // Two tiers of arching palm fronds
        for (let f = 0; f < 11; f += 1) {
          const frond = new THREE.Mesh(assets.frondGeo, matCache.uFrond);
          frond.rotation.y = (f * Math.PI * 2) / 11 + (f % 2) * 0.18;
          frond.rotation.x = f % 2 === 0 ? 0.26 : -0.16;
          frond.castShadow = true;
          crownGroup.add(frond);
        }
        group.add(crownGroup);
      }
    } else if (kind === 'building') {
      const style = variant % 3;
      const bHeight = 14 + ((variant * 3) % 10);
      if (style === 0) {
        // Modern Commercial Glass & Architectural Fin Tower with Setback Penthouse & Entrance Awning
        const podium = new THREE.Mesh(new THREE.BoxGeometry(7.2, 3.8, 8.2), matCache.uConcrete);
        podium.position.y = 1.9;
        podium.castShadow = true;
        group.add(podium);

        const tower = new THREE.Mesh(new THREE.BoxGeometry(6.2, bHeight - 3.4, 7.1), matCache.uBldGlass);
        tower.position.y = 3.6 + (bHeight - 3.4) * 0.5;
        tower.castShadow = true;
        group.add(tower);

        // Projecting floor cornices & vertical structural fins
        for (let fy = 5.4; fy < bHeight; fy += 3.2) {
          const ledge = new THREE.Mesh(new THREE.BoxGeometry(6.65, 0.22, 7.55), matCache.uConcrete);
          ledge.position.y = fy;
          group.add(ledge);
        }
        const pent = new THREE.Mesh(new THREE.BoxGeometry(3.8, 2.2, 4.4), matCache.uDarkTrim);
        pent.position.y = bHeight + 1.1;
        group.add(pent);
        const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.08, 3.2, 8), matCache.uChrome);
        antenna.position.set(0.8, bHeight + 3.6, 0);
        group.add(antenna);

        // Road-facing glowing shopfront awning
        const faceSign = -Math.sign(propSide || 1);
        const awning = new THREE.Mesh(
          new THREE.BoxGeometry(0.95, 0.2, 5.4),
          new THREE.MeshStandardMaterial({ color: '#dc2626', roughness: 0.45 })
        );
        awning.position.set(faceSign * 3.85, 3.35, 0);
        awning.rotation.z = faceSign * -0.24;
        group.add(awning);
      } else if (style === 1) {
        // Cameroonian Balcony Apartment Building with Balustrades + Rooftop Water Tank
        const body = new THREE.Mesh(new THREE.BoxGeometry(6.6, bHeight, 7.6), matCache.uBldConcrete);
        body.position.y = bHeight * 0.5;
        body.castShadow = true;
        group.add(body);

        const faceSign = -Math.sign(propSide || 1);
        const railMat = matCache.uDarkTrim;
        for (let by = 4.2; by < bHeight - 1.5; by += 3.4) {
          const slab = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.16, 4.8), matCache.uConcrete);
          slab.position.set(faceSign * 3.55, by, 0);
          group.add(slab);
          const rail = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.7, 4.75), railMat);
          rail.position.set(faceSign * 3.92, by + 0.42, 0);
          group.add(rail);
        }
        // Rooftop parapet & blue polyethylene water tank
        const parapet = new THREE.Mesh(new THREE.BoxGeometry(6.95, 0.45, 7.95), matCache.uConcrete);
        parapet.position.y = bHeight + 0.22;
        group.add(parapet);
        const waterTank = new THREE.Mesh(
          new THREE.CylinderGeometry(0.85, 0.85, 1.5, 14),
          new THREE.MeshStandardMaterial({ color: '#0284c7', roughness: 0.4 })
        );
        waterTank.position.set(0.8, bHeight + 1.15, -1.2);
        group.add(waterTank);
      } else {
        // Sloped Roof Tropical Arcade Complex
        const body = new THREE.Mesh(new THREE.BoxGeometry(6.4, bHeight * 0.72, 7.4), matCache.uBldConcrete);
        body.position.y = bHeight * 0.36;
        body.castShadow = true;
        group.add(body);

        const roof = new THREE.Mesh(
          new THREE.ConeGeometry(5.6, 2.8, 4),
          new THREE.MeshStandardMaterial({ color: '#7f1d1d', roughness: 0.65 })
        );
        roof.rotation.y = Math.PI / 4;
        roof.position.y = bHeight * 0.72 + 1.4;
        roof.castShadow = true;
        group.add(roof);

        const trimBand = new THREE.Mesh(
          new THREE.BoxGeometry(6.7, 0.45, 7.7),
          new THREE.MeshStandardMaterial({ color: '#facc15', emissive: '#ca8a04', emissiveIntensity: 0.3 })
        );
        trimBand.position.y = 3.7;
        group.add(trimBand);
      }
    } else if (kind === 'lamp') {
      const sideSign = propSide >= 0 ? 1 : -1;
      const poleGroup = new THREE.Group();
      if (sideSign < 0) {
        poleGroup.rotation.y = Math.PI;
      }
      const plinth = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.26, 0.55, 10), matCache.uConcrete);
      plinth.position.y = 0.27;
      const pole = new THREE.Mesh(assets.lampPoleGeo, matCache.uRotor);
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.15, 0.32), matCache.uDarkTrim);
      head.position.set(-1.45, 6.26, 0);
      const bulb = new THREE.Mesh(
        new THREE.BoxGeometry(0.46, 0.06, 0.24),
        new THREE.MeshBasicMaterial({ color: '#fef08a' })
      );
      bulb.position.set(-1.45, 6.17, 0);
      const lightCone = new THREE.Mesh(
        new THREE.ConeGeometry(1.55, 4.4, 14, 1, true),
        new THREE.MeshBasicMaterial({
          color: '#fde68a',
          transparent: true,
          opacity: 0.075,
          side: THREE.DoubleSide,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        })
      );
      lightCone.position.set(-1.45, 3.95, 0);
      poleGroup.add(plinth, pole, head, bulb, lightCone);
      group.add(poleGroup);
    } else if (kind === 'kiosk') {
      const counter = new THREE.Mesh(
        new THREE.BoxGeometry(2.7, 1.15, 3.2),
        new THREE.MeshStandardMaterial({ color: '#d97706', roughness: 0.72 })
      );
      counter.position.y = 0.58;
      counter.castShadow = true;
      group.add(counter);

      const backWall = new THREE.Mesh(
        new THREE.BoxGeometry(0.3, 2.6, 3.15),
        new THREE.MeshStandardMaterial({ color: '#eab308', roughness: 0.65 })
      );
      backWall.position.set(propSide >= 0 ? 1.15 : -1.15, 1.3, 0);
      group.add(backWall);

      [-1.35, 1.35].forEach((pz) => {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 2.75, 8), matCache.uTimberBark);
        post.position.set(propSide >= 0 ? -1.18 : 1.18, 1.38, pz);
        group.add(post);
      });

      const awning = new THREE.Mesh(
        new THREE.BoxGeometry(3.45, 0.14, 3.7),
        new THREE.MeshStandardMaterial({ color: variant % 2 === 0 ? '#dc2626' : '#0284c7', roughness: 0.55 })
      );
      awning.position.set(0, 2.78, 0);
      awning.rotation.z = propSide >= 0 ? 0.14 : -0.14;
      group.add(awning);

      // Market display crates on counter
      ['#22c55e', '#f97316', '#facc15'].forEach((col, ci) => {
        const crate = new THREE.Mesh(
          new THREE.BoxGeometry(0.65, 0.35, 0.75),
          new THREE.MeshStandardMaterial({ color: col, roughness: 0.6 })
        );
        crate.position.set(propSide >= 0 ? -0.6 : 0.6, 1.32, -0.9 + ci * 0.9);
        group.add(crate);
      });
    } else if (kind === 'billboard') {
      const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.24, 4.6, 12), matCache.uRotor);
      mast.position.y = 2.3;
      group.add(mast);
      const frame = new THREE.Mesh(new THREE.BoxGeometry(0.32, 2.55, 5.2), matCache.uDarkTrim);
      frame.position.y = 5.1;
      frame.castShadow = true;
      group.add(frame);
      const panel = new THREE.Mesh(
        new THREE.BoxGeometry(0.36, 2.25, 4.85),
        new THREE.MeshStandardMaterial({
          map: texCache.billboardUltra,
          emissive: '#ffffff',
          emissiveMap: texCache.billboardUltra,
          emissiveIntensity: 0.38,
          roughness: 0.35,
        })
      );
      panel.position.y = 5.1;
      group.add(panel);
    } else {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 1.5, 8), matCache.uRotor);
      post.position.y = 0.75;
      const sign = new THREE.Mesh(
        new THREE.CircleGeometry(0.42, 16),
        new THREE.MeshStandardMaterial({ color: '#16a34a', roughness: 0.45, side: THREE.DoubleSide })
      );
      sign.position.y = 1.65;
      group.add(post, sign);
    }

    return group;
  }

  function createUltraEntityMesh(type) {
    const assets = getSharedUltraAssets();
    const group = new THREE.Group();
    const userData = { wheels: [], brakeLights: [], leftSig: null, rightSig: null, spinTarget: null, orbitRing: null };
    group.userData = userData;

    const attachSignalPod = (x, y, z, w, h) => {
      const pod = new THREE.Group();
      pod.position.set(x, y, z);
      const core = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.08), new THREE.MeshBasicMaterial({ color: '#fbbf24' }));
      const glow = new THREE.Mesh(
        new THREE.SphereGeometry(Math.max(w, h) * 1.15, 10, 8),
        new THREE.MeshBasicMaterial({
          color: '#f59e0b',
          transparent: true,
          opacity: 0.45,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        })
      );
      pod.add(core, glow);
      pod.visible = false;
      group.add(pod);
      return pod;
    };

    if (type === 'yellow_taxi') {
      const paintMat = new THREE.MeshPhysicalMaterial({
        color: '#facc15',
        roughness: 0.16,
        metalness: 0.25,
        clearcoat: 1.0,
        clearcoatRoughness: 0.06,
        envMapIntensity: 1.25,
      });

      const body = new THREE.Mesh(assets.taxiLowerGeo, paintMat);
      body.castShadow = true;
      group.add(body);

      const cabin = new THREE.Mesh(assets.taxiCabinGeo, paintMat);
      cabin.castShadow = true;
      group.add(cabin);

      // Sloped rear window & side greenhouse glass panels
      const rearGlass = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.44, 0.08), matCache.uGlass);
      rearGlass.position.set(0, 1.15, 0.96);
      rearGlass.rotation.x = -0.62;
      group.add(rearGlass);

      const frontGlass = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.46, 0.08), matCache.uGlass);
      frontGlass.position.set(0, 1.14, -0.71);
      frontGlass.rotation.x = 0.68;
      group.add(frontGlass);

      [-0.74, 0.74].forEach((sx) => {
        const sideGlass = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.34, 1.56), matCache.uGlass);
        sideGlass.position.set(sx, 1.15, 0.12);
        group.add(sideGlass);

        const mirror = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.09, 0.11), paintMat);
        mirror.position.set(sx * 1.26, 0.94, -0.62);
        group.add(mirror);
      });

      // Lower bumpers, diffuser & twin chrome exhausts
      const rearBumper = new THREE.Mesh(new THREE.BoxGeometry(1.82, 0.2, 0.16), matCache.uDarkTrim);
      rearBumper.position.set(0, 0.4, 1.96);
      group.add(rearBumper);
      const plate = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.14, 0.04), new THREE.MeshBasicMaterial({ color: '#fef9c3' }));
      plate.position.set(0, 0.62, 1.98);
      group.add(plate);

      [-0.48, 0.48].forEach((ex) => {
        const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.042, 0.16, 10), matCache.uChrome);
        pipe.rotation.x = Math.PI / 2;
        pipe.position.set(ex, 0.32, 2.02);
        group.add(pipe);
      });

      // Aerodynamic roof TAXI sign
      const roofPod = new THREE.Mesh(
        new THREE.BoxGeometry(0.62, 0.16, 0.3),
        new THREE.MeshBasicMaterial({ color: '#fffbeb' })
      );
      roofPod.position.set(0, 1.48, -0.05);
      group.add(roofPod);

      [-0.66, 0.66].forEach((tx) => {
        const tail = new THREE.Mesh(
          new THREE.BoxGeometry(0.32, 0.14, 0.08),
          new THREE.MeshStandardMaterial({ color: '#ef4444', emissive: '#ef4444', emissiveIntensity: 0.9 })
        );
        tail.position.set(tx, 0.72, 1.97);
        group.add(tail);
        userData.brakeLights.push(tail.material);
      });

      userData.leftSig = attachSignalPod(-0.84, 0.56, 1.98, 0.18, 0.14);
      userData.rightSig = attachSignalPod(0.84, 0.56, 1.98, 0.18, 0.14);
      userData.wheels = addUltraWheelMeshes(
        group,
        [
          [-0.86, 0.34, 1.18],
          [0.86, 0.34, 1.18],
          [-0.86, 0.34, -1.18],
          [0.86, 0.34, -1.18],
        ],
        0.34,
        0.24
      );
    } else if (type === 'clando_van') {
      const bodyMat = new THREE.MeshPhysicalMaterial({
        color: '#e2e8f0',
        roughness: 0.24,
        metalness: 0.22,
        clearcoat: 0.85,
        envMapIntensity: 1.1,
      });
      const stripeMat = new THREE.MeshStandardMaterial({ color: '#0284c7', roughness: 0.35, metalness: 0.2 });

      const body = new THREE.Mesh(assets.vanBodyGeo, bodyMat);
      body.castShadow = true;
      group.add(body);

      const stripe = new THREE.Mesh(new THREE.BoxGeometry(1.91, 0.24, 4.18), stripeMat);
      stripe.position.set(0, 0.88, 0);
      group.add(stripe);

      const rearGlass = new THREE.Mesh(new THREE.BoxGeometry(1.44, 0.52, 0.08), matCache.uGlass);
      rearGlass.position.set(0, 1.44, 2.09);
      rearGlass.rotation.x = -0.14;
      group.add(rearGlass);

      [-0.95, 0.95].forEach((sx) => {
        const sWin = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.46, 3.0), matCache.uGlass);
        sWin.position.set(sx, 1.42, 0.25);
        group.add(sWin);
        const mirror = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.22, 0.08), matCache.uDarkTrim);
        mirror.position.set(sx * 1.14, 1.25, -1.78);
        group.add(mirror);
      });

      // Steel roof rack & lashed cargo bundles
      const rack = new THREE.Mesh(new THREE.BoxGeometry(1.52, 0.06, 2.7), matCache.uDarkTrim);
      rack.position.set(0, 1.88, 0.1);
      const packA = new THREE.Mesh(
        new THREE.CylinderGeometry(0.28, 0.28, 1.25, 12),
        new THREE.MeshStandardMaterial({ color: '#92400e', roughness: 0.85 })
      );
      packA.rotation.z = Math.PI / 2;
      packA.position.set(0, 2.08, -0.45);
      const packB = packA.clone();
      packB.material = new THREE.MeshStandardMaterial({ color: '#15803d', roughness: 0.85 });
      packB.position.set(0, 2.06, 0.55);
      group.add(rack, packA, packB);

      const stepBumper = new THREE.Mesh(new THREE.BoxGeometry(1.88, 0.18, 0.18), matCache.uDarkTrim);
      stepBumper.position.set(0, 0.42, 2.1);
      group.add(stepBumper);

      [-0.76, 0.76].forEach((tx) => {
        const tail = new THREE.Mesh(
          new THREE.BoxGeometry(0.22, 0.36, 0.08),
          new THREE.MeshStandardMaterial({ color: '#ef4444', emissive: '#ef4444', emissiveIntensity: 0.85 })
        );
        tail.position.set(tx, 0.78, 2.1);
        group.add(tail);
        userData.brakeLights.push(tail.material);
      });

      userData.leftSig = attachSignalPod(-0.88, 0.52, 2.12, 0.2, 0.16);
      userData.rightSig = attachSignalPod(0.88, 0.52, 2.12, 0.2, 0.16);
      userData.wheels = addUltraWheelMeshes(
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
      const cabMat = new THREE.MeshPhysicalMaterial({
        color: '#c2410c',
        roughness: 0.24,
        metalness: 0.38,
        clearcoat: 0.85,
        envMapIntensity: 1.15,
      });

      const flatbed = new THREE.Mesh(new THREE.BoxGeometry(2.14, 0.32, 6.2), matCache.uDarkTrim);
      flatbed.position.set(0, 0.86, 0);
      flatbed.castShadow = true;
      group.add(flatbed);

      const cab = new THREE.Mesh(assets.truckCabGeo, cabMat);
      cab.position.set(0, 0, -2.28);
      cab.castShadow = true;
      group.add(cab);

      const visor = new THREE.Mesh(new THREE.BoxGeometry(1.96, 0.12, 0.22), matCache.uDarkTrim);
      visor.position.set(0, 2.45, -3.28);
      group.add(visor);

      [-1.08, 1.08].forEach((mx) => {
        const exhaust = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.1, 10), matCache.uChrome);
        exhaust.position.set(mx * 0.88, 2.15, -1.32);
        const mirror = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.34, 0.1), matCache.uDarkTrim);
        mirror.position.set(mx * 1.1, 1.98, -2.95);
        group.add(exhaust, mirror);
      });

      // Steel trailer log-stanchion posts + textured debarked hardwood logs + steel chains
      [-1.02, 1.02].forEach((sx) => {
        [0.1, 1.75, 2.85].forEach((sz) => {
          const post = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.55, 0.12), matCache.uCaliper);
          post.position.set(sx, 1.65, sz);
          group.add(post);
        });
      });

      const logOffsets = [
        [-0.58, 1.34, 0.28],
        [0, 1.34, 0.29],
        [0.58, 1.34, 0.27],
        [-0.31, 1.85, 0.28],
        [0.31, 1.85, 0.28],
        [0, 2.34, 0.27],
      ];
      logOffsets.forEach(([lx, ly, r]) => {
        const log = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.94, r, 4.35, 16), matCache.uTimberBark);
        log.rotation.x = Math.PI / 2;
        log.position.set(lx, ly, 0.88);
        log.castShadow = true;
        group.add(log);

        const cap = new THREE.Mesh(new THREE.CircleGeometry(r * 0.94, 16), matCache.uTimberEnd);
        cap.position.set(lx, ly, 3.06);
        group.add(cap);
      });

      // Reflective steel chain straps binding logs
      [0.3, 1.8].forEach((cz) => {
        const strap = new THREE.Mesh(new THREE.BoxGeometry(1.96, 1.62, 0.06), matCache.uChrome);
        strap.position.set(0, 1.78, cz);
        strap.material = matCache.uRotor;
        // Thin frame outline using top/side straps
        const topChain = new THREE.Mesh(new THREE.BoxGeometry(1.96, 0.05, 0.06), matCache.uChrome);
        topChain.position.set(0, 2.62, cz);
        group.add(topChain);
      });

      const rearGuard = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.16, 0.14), matCache.uDarkTrim);
      rearGuard.position.set(0, 0.56, 3.12);
      group.add(rearGuard);

      [-0.82, 0.82].forEach((tx) => {
        const tail = new THREE.Mesh(
          new THREE.BoxGeometry(0.28, 0.18, 0.08),
          new THREE.MeshStandardMaterial({ color: '#ef4444', emissive: '#ef4444', emissiveIntensity: 0.95 })
        );
        tail.position.set(tx, 0.78, 3.13);
        group.add(tail);
        userData.brakeLights.push(tail.material);
      });

      userData.leftSig = attachSignalPod(-0.98, 0.84, 3.14, 0.24, 0.18);
      userData.rightSig = attachSignalPod(0.98, 0.84, 3.14, 0.24, 0.18);
      userData.wheels = addUltraWheelMeshes(
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
      const motoPaint = new THREE.MeshPhysicalMaterial({
        color: '#dc2626',
        roughness: 0.16,
        metalness: 0.45,
        clearcoat: 1.0,
        envMapIntensity: 1.2,
      });
      const frame = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.36, 1.38), matCache.uDarkTrim);
      frame.position.set(0, 0.56, 0);
      frame.castShadow = true;
      group.add(frame);

      const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.52, 16), motoPaint);
      tank.rotation.x = Math.PI * 0.44;
      tank.scale.set(1.2, 1, 0.76);
      tank.position.set(0, 0.82, -0.18);
      group.add(tank);

      const tailCowl = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.14, 0.55), motoPaint);
      tailCowl.position.set(0, 0.84, 0.58);
      tailCowl.rotation.x = -0.14;
      group.add(tailCowl);

      const exhaust = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.036, 0.56, 12), matCache.uChrome);
      exhaust.rotation.x = Math.PI / 2 + 0.22;
      exhaust.position.set(0.19, 0.42, 0.54);
      group.add(exhaust);

      // Sculpted armored rider + helmet + curved visor + gripping arms
      const riderJacket = new THREE.MeshStandardMaterial({ color: '#eab308', roughness: 0.45, metalness: 0.15 });
      const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.18, 0.64, 12), riderJacket);
      torso.position.set(0, 1.24, 0.14);
      torso.rotation.x = 0.36;
      torso.scale.set(1.32, 1, 0.82);
      torso.castShadow = true;
      group.add(torso);

      [-0.24, 0.24].forEach((ax) => {
        const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.05, 0.48, 10), riderJacket);
        arm.position.set(ax, 1.22, -0.14);
        arm.rotation.x = 1.05;
        arm.rotation.z = ax * -0.4;
        group.add(arm);
      });

      const helmet = new THREE.Mesh(
        new THREE.SphereGeometry(0.22, 18, 14),
        new THREE.MeshPhysicalMaterial({ color: '#f8fafc', roughness: 0.14, clearcoat: 1.0, envMapIntensity: 1.2 })
      );
      helmet.position.set(0, 1.69, -0.04);
      group.add(helmet);

      const visor = new THREE.Mesh(new THREE.CylinderGeometry(0.225, 0.225, 0.14, 14, 1, true, Math.PI * 0.65, Math.PI * 0.7), matCache.uGlass);
      visor.position.set(0, 1.67, -0.05);
      group.add(visor);

      const tail = new THREE.Mesh(
        new THREE.BoxGeometry(0.18, 0.1, 0.08),
        new THREE.MeshStandardMaterial({ color: '#ef4444', emissive: '#ef4444', emissiveIntensity: 1.0 })
      );
      tail.position.set(0, 0.82, 0.88);
      group.add(tail);
      userData.brakeLights.push(tail.material);

      userData.leftSig = attachSignalPod(-0.24, 0.8, 0.86, 0.11, 0.09);
      userData.rightSig = attachSignalPod(0.24, 0.8, 0.86, 0.11, 0.09);
      userData.wheels = addUltraWheelMeshes(
        group,
        [
          [0, 0.32, 0.66],
          [0, 0.32, -0.66],
        ],
        0.32,
        0.16
      );
    } else if (type === 'barrier') {
      const jersey = new THREE.Mesh(assets.jerseyGeo, matCache.uConcrete);
      jersey.castShadow = true;
      group.add(jersey);

      const bar = new THREE.Mesh(
        new THREE.BoxGeometry(2.24, 0.36, 0.18),
        new THREE.MeshStandardMaterial({ map: texCache.barrierStripe, roughness: 0.4 })
      );
      bar.position.y = 0.96;
      bar.castShadow = true;
      group.add(bar);

      [-0.86, 0.86].forEach((lx) => {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.42, 10), matCache.uDarkTrim);
        leg.position.set(lx, 1.06, 0);
        const beacon = new THREE.Mesh(
          new THREE.SphereGeometry(0.11, 12, 10),
          new THREE.MeshBasicMaterial({ color: '#f59e0b' })
        );
        beacon.position.set(lx, 1.32, 0);
        group.add(leg, beacon);
      });
    } else if (type === 'timber_log') {
      const log = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.39, 2.08, 18), matCache.uTimberBark);
      log.rotation.z = Math.PI / 2;
      log.position.y = 0.37;
      log.castShadow = true;
      group.add(log);

      [-1.05, 1.05].forEach((cx) => {
        const cap = new THREE.Mesh(new THREE.CircleGeometry(0.37, 16), matCache.uTimberEnd);
        cap.rotation.y = cx > 0 ? Math.PI / 2 : -Math.PI / 2;
        cap.position.set(cx, 0.37, 0);
        group.add(cap);
      });
    } else if (type === 'coin') {
      const spinner = new THREE.Group();
      spinner.position.y = 0.72;
      const coinMesh = new THREE.Mesh(
        assets.coinGeo,
        new THREE.MeshPhysicalMaterial({
          color: '#facc15',
          emissive: '#a16207',
          emissiveIntensity: 0.38,
          metalness: 0.92,
          roughness: 0.16,
          clearcoat: 0.8,
          envMapIntensity: 1.4,
        })
      );
      const starBadge = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.18, 0),
        new THREE.MeshStandardMaterial({ color: '#fef08a', emissive: '#ca8a04', emissiveIntensity: 0.55 })
      );
      spinner.add(coinMesh, starBadge);
      group.add(spinner);
      userData.spinTarget = spinner;
    } else if (type === 'fuel_can') {
      const spinner = new THREE.Group();
      spinner.position.y = 0.75;
      const can = new THREE.Mesh(
        new THREE.BoxGeometry(0.54, 0.68, 0.32),
        new THREE.MeshPhysicalMaterial({
          color: '#dc2626',
          emissive: '#991b1b',
          emissiveIntensity: 0.35,
          roughness: 0.22,
          metalness: 0.35,
          clearcoat: 0.9,
        })
      );
      const spout = new THREE.Mesh(
        new THREE.CylinderGeometry(0.055, 0.08, 0.28, 12),
        new THREE.MeshStandardMaterial({ color: '#facc15', roughness: 0.25 })
      );
      spout.position.set(0.16, 0.44, 0);
      spout.rotation.z = -0.45;
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.14, 0.34), new THREE.MeshBasicMaterial({ color: '#facc15' }));
      spinner.add(can, spout, stripe);
      group.add(spinner);
      userData.spinTarget = spinner;
    } else if (type === 'shield') {
      const spinner = new THREE.Group();
      spinner.position.y = 0.8;
      const core = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.4, 2),
        new THREE.MeshPhysicalMaterial({
          color: '#38bdf8',
          emissive: '#0284c7',
          emissiveIntensity: 0.55,
          roughness: 0.12,
          metalness: 0.5,
          clearcoat: 1.0,
          envMapIntensity: 1.4,
        })
      );
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.56, 0.045, 12, 32),
        new THREE.MeshBasicMaterial({ color: '#fef08a' })
      );
      spinner.add(core, ring);
      group.add(spinner);
      userData.spinTarget = spinner;
      userData.orbitRing = ring;
    } else if (type === 'magnet') {
      const spinner = new THREE.Group();
      spinner.position.y = 0.8;
      const magMesh = new THREE.Mesh(
        assets.magnetArchGeo,
        new THREE.MeshPhysicalMaterial({
          color: '#ef4444',
          emissive: '#991b1b',
          emissiveIntensity: 0.35,
          metalness: 0.58,
          roughness: 0.22,
          clearcoat: 0.9,
        })
      );
      const tipL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.14, 0.2), matCache.uAlloy);
      tipL.position.set(-0.27, 0.36, 0);
      const tipR = tipL.clone();
      tipR.position.x = 0.27;
      const waveRing = new THREE.Mesh(
        new THREE.TorusGeometry(0.52, 0.03, 10, 28),
        new THREE.MeshBasicMaterial({ color: '#38bdf8' })
      );
      waveRing.rotation.x = Math.PI / 2;
      spinner.add(magMesh, tipL, tipR, waveRing);
      group.add(spinner);
      userData.spinTarget = spinner;
      userData.orbitRing = waveRing;
    } else {
      return createEntityMesh(type);
    }

    return group;
  }

  function getSafeMaxPixelRatio(w, h) {
    let maxGpuDim = 4096;
    try {
      if (renderer && renderer.capabilities && renderer.capabilities.maxTextureSize) {
        maxGpuDim = Math.min(4096, renderer.capabilities.maxTextureSize);
      }
    } catch {
      maxGpuDim = 4096;
    }
    const maxDim = Math.max(1, Math.max(w, h));
    return Math.max(1.5, Math.min(4.0, maxGpuDim / maxDim));
  }

  function init(canvasEl) {
    if (initialized || !isSupported()) return isSupported();
    try {
      canvas3d = canvasEl;
      renderer = new THREE.WebGLRenderer({
        canvas: canvas3d,
        antialias: true,
        powerPreference: 'high-performance',
        precision: 'highp',
      });
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.14;
      renderer.outputEncoding = THREE.sRGBEncoding;

      scene = new THREE.Scene();
      camera = new THREE.PerspectiveCamera(62, 16 / 9, 0.08, 380);

      buildProceduralTextures();
      createEnvironment();
      buildBikeCockpit();
      applyQualityConfigToScene(currentQualityMode);

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
    if (qualityMode === 'normal' || qualityMode === 'high' || qualityMode === 'ultra') {
      currentQualityMode = qualityMode;
    }
    applyQualityConfigToScene(currentQualityMode);

    const w = Math.max(1, cssWidth);
    const h = Math.max(1, cssHeight);
    const shortSide = Math.min(w, h);
    const sysDpr = window.devicePixelRatio || 1;
    let dpr;
    if (currentQualityMode === 'ultra') {
      // Best-of-the-best 1080p+ supersampled render scale on every viewport
      const scale1080p = 1080 / shortSide;
      const safeMax = getSafeMaxPixelRatio(w, h);
      dpr = Math.min(safeMax, Math.max(sysDpr, scale1080p, 2.35));
    } else if (currentQualityMode === 'high') {
      // Previous Ultra: 720p+ crisp backing resolution
      const scale720p = 720 / shortSide;
      dpr = Math.min(3.0, Math.max(sysDpr, scale720p, 1.85));
    } else {
      // Medium ('normal', previous High HD)
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
      } else {
        applyQualityConfigToScene(quality);
      }
    }

    const useUltraPool = currentQualityMode === 'ultra';

    // Smooth road & ground texture scrolling synced 1:1 with world meters
    const roadOff = -(cameraZ / 14) % 1;
    const latOff = -(cameraZ / 8) % 1;
    if (roadTexture) roadTexture.offset.y = roadOff;
    if (roadUltraTexture) roadUltraTexture.offset.y = roadOff;
    if (roadBumpTexture) roadBumpTexture.offset.y = roadOff;
    if (roadRoughTexture) roadRoughTexture.offset.y = roadOff;
    if (lateriteTexture) lateriteTexture.offset.y = latOff;
    if (lateriteUltraTexture) lateriteUltraTexture.offset.y = latOff;
    if (lateriteBumpTexture) lateriteBumpTexture.offset.y = latOff;
    if (ultraRoadAccents && ultraRoadAccents.visible) {
      ultraRoadAccents.position.z = ((cameraZ % 8) + 8) % 8;
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

    // Sync roadside props using selected tier's pool
    const propMap = useUltraPool ? propMeshMapUltra : propMeshMapStd;
    const propActive = useUltraPool ? propActiveUltra : propActiveStd;
    const nextPropActive = new Set();
    for (let i = 0; i < roadsideProps.length; i += 1) {
      const prop = roadsideProps[i];
      const ahead = prop.worldZ - cameraZ;
      if (ahead < -10 || ahead > 145) continue;
      let mesh = propMap.get(prop);
      if (!mesh) {
        mesh = useUltraPool
          ? createUltraPropMesh(prop.kind, prop.side)
          : createPropMesh(prop.kind);
        propMap.set(prop, mesh);
        scene.add(mesh);
      }
      mesh.visible = true;
      const sideOffset = prop.kind === 'lamp' ? 4.9 : prop.kind === 'kiosk' ? 6.8 : 9.4;
      mesh.position.set(prop.side * sideOffset, 0, -ahead);
      nextPropActive.add(mesh);
    }
    propActive.forEach((m) => {
      if (!nextPropActive.has(m)) {
        m.visible = false;
      }
    });
    propActive.clear();
    nextPropActive.forEach((m) => propActive.add(m));

    // Sync road hazards, traffic & custom 3D power-ups using selected tier's pool
    const entMap = useUltraPool ? entityMeshMapUltra : entityMeshMapStd;
    const entActive = useUltraPool ? entityActiveUltra : entityActiveStd;
    const nextEntityActive = new Set();
    for (let i = 0; i < entities.length; i += 1) {
      const entity = entities[i];
      if (entity.collected) continue;
      const ahead = entity.worldZ - cameraZ;
      if (ahead < -8 || ahead > 140) continue;

      let mesh = entMap.get(entity);
      if (!mesh) {
        mesh = useUltraPool
          ? createUltraEntityMesh(entity.type)
          : createEntityMesh(entity.type);
        entMap.set(entity, mesh);
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
    entActive.forEach((m) => {
      if (!nextEntityActive.has(m)) {
        scene.remove(m);
      }
    });
    entActive.clear();
    nextEntityActive.forEach((m) => entActive.add(m));

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
          precision: 'highp',
        });
        garageRenderer.shadowMap.enabled = true;
        garageRenderer.shadowMap.type = THREE.PCFSoftShadowMap;
        garageRenderer.toneMapping = THREE.ACESFilmicToneMapping;
        garageRenderer.toneMappingExposure = 1.18;
        garageRenderer.outputEncoding = THREE.sRGBEncoding;

        garageScene = new THREE.Scene();
        const garageEnv = buildEnvironmentReflectionMap(garageRenderer);
        if (garageEnv) {
          garageScene.environment = garageEnv;
        }
        garageCamera = new THREE.PerspectiveCamera(38, 2.1, 0.1, 40);
        garageCamera.position.set(2.35, 1.25, 2.25);
        garageCamera.lookAt(0, 0.56, 0);

        garageScene.add(new THREE.HemisphereLight('#fde68a', '#0f172a', 0.95));
        const keyLight = new THREE.DirectionalLight('#fffbeb', 1.65);
        keyLight.position.set(3.5, 5, 4);
        keyLight.castShadow = true;
        keyLight.shadow.mapSize.width = 1024;
        keyLight.shadow.mapSize.height = 1024;
        garageScene.add(keyLight);

        const rimLight = new THREE.DirectionalLight('#38bdf8', 1.1);
        rimLight.position.set(-4, 2.5, -3);
        garageScene.add(rimLight);

        garageTurntable = new THREE.Group();
        const plinth = new THREE.Mesh(
          new THREE.CylinderGeometry(1.38, 1.48, 0.12, 48),
          new THREE.MeshPhysicalMaterial({ color: '#1e293b', roughness: 0.25, metalness: 0.8, clearcoat: 0.7 })
        );
        plinth.position.y = -0.06;
        plinth.receiveShadow = true;
        const rimGlow = new THREE.Mesh(
          new THREE.TorusGeometry(1.38, 0.02, 10, 48),
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
    garageRenderer.setPixelRatio(Math.min(3.2, Math.max(window.devicePixelRatio || 1, 2.2)));
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
