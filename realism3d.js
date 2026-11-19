(() => {
  'use strict';

  // =========================================================
  // Bendskin Rush — Ultra Realistic 1080p+ Cinema PBR Engine
  // True Sobel tangent-space normal maps, sculpted real cars
  // with interior cabins & visible human drivers, real bike
  // cockpit + anatomical human hands/wrists/watch, real rival
  // motorcyclists & roadside pedestrians, real asphalt roads,
  // sidewalks, guardrails, overhead gantry signs & foliage.
  // =========================================================

  let initialized = false;
  let activeAniso = 8;
  let propVariantCounter = 0;

  const tex = {};
  const mat = {};
  const geo = {};

  function createCanvas(w, h) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
  }

  function registerTex(key, canvas, opts = {}) {
    const t = new THREE.CanvasTexture(canvas);
    t.wrapS = opts.clamp ? THREE.ClampToEdgeWrapping : THREE.RepeatWrapping;
    t.wrapT = opts.clamp ? THREE.ClampToEdgeWrapping : THREE.RepeatWrapping;
    t.repeat.set(opts.repeatX || 1, opts.repeatY || 1);
    t.encoding = opts.linear ? THREE.LinearEncoding : THREE.sRGBEncoding;
    t.generateMipmaps = true;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    t.magFilter = THREE.LinearFilter;
    t.anisotropy = activeAniso;
    tex[key] = t;
    return t;
  }

  // Convert grayscale heightfield canvas -> tangent-space RGB normal map via 3x3 Sobel
  function heightCanvasToNormalTexture(key, srcCanvas, strength = 2.4, opts = {}) {
    if (tex[key]) return tex[key];
    const w = srcCanvas.width;
    const h = srcCanvas.height;
    const srcCtx = srcCanvas.getContext('2d');
    const src = srcCtx.getImageData(0, 0, w, h).data;

    const outCanvas = createCanvas(w, h);
    const outCtx = outCanvas.getContext('2d');
    const outImg = outCtx.createImageData(w, h);
    const dst = outImg.data;

    const wrap = !opts.clamp;
    const sample = (x, y) => {
      const sx = wrap ? ((x % w) + w) % w : Math.max(0, Math.min(w - 1, x));
      const sy = wrap ? ((y % h) + h) % h : Math.max(0, Math.min(h - 1, y));
      return src[(sy * w + sx) * 4] / 255;
    };

    for (let y = 0; y < h; y += 1) {
      for (let x = 0; x < w; x += 1) {
        const tl = sample(x - 1, y - 1);
        const t = sample(x, y - 1);
        const tr = sample(x + 1, y - 1);
        const l = sample(x - 1, y);
        const r = sample(x + 1, y);
        const bl = sample(x - 1, y + 1);
        const b = sample(x, y + 1);
        const br = sample(x + 1, y + 1);

        const dX = (tr + 2 * r + br) - (tl + 2 * l + bl);
        const dY = (bl + 2 * b + br) - (tl + 2 * t + tr);
        let nx = -dX * strength;
        let ny = -dY * strength;
        let nz = 1.0;
        const inv = 1 / Math.hypot(nx, ny, nz);
        nx *= inv;
        ny *= inv;
        nz *= inv;

        const idx = (y * w + x) * 4;
        dst[idx] = Math.round((nx * 0.5 + 0.5) * 255);
        dst[idx + 1] = Math.round((ny * 0.5 + 0.5) * 255);
        dst[idx + 2] = Math.round((nz * 0.5 + 0.5) * 255);
        dst[idx + 3] = 255;
      }
    }
    outCtx.putImageData(outImg, 0, 0);
    return registerTex(key, outCanvas, { ...opts, linear: true });
  }

  function makeNoiseRand(seed) {
    let s = seed >>> 0;
    return () => {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }

  function setAnisotropy(targetAniso) {
    activeAniso = Math.max(1, targetAniso || 8);
    Object.values(tex).forEach((t) => {
      if (t) {
        t.anisotropy = activeAniso;
        t.needsUpdate = true;
      }
    });
  }

  // =========================================================
  // 1. High-Detail Procedural PBR Texture & Normal Map Builder
  // =========================================================
  function initAssets(renderer) {
    if (renderer && renderer.capabilities) {
      activeAniso = Math.min(16, renderer.capabilities.getMaxAnisotropy() || 8);
    }
    if (initialized) {
      setAnisotropy(activeAniso);
      return;
    }
    initialized = true;

    // 1A. Real-Life Asphalt Highway (1024x1024 Diffuse + Sobel Normal + Roughness)
    {
      const w = 1024;
      const h = 1024;
      const diffC = createCanvas(w, h);
      const dg = diffC.getContext('2d');
      const hgtC = createCanvas(w, h);
      const hg = hgtC.getContext('2d');
      const rghC = createCanvas(w, h);
      const rg = rghC.getContext('2d');
      const rnd = makeNoiseRand(40219);

      // Base dark weathered basalt bitumen
      dg.fillStyle = '#1b1f27';
      dg.fillRect(0, 0, w, h);
      hg.fillStyle = '#7e7e7e';
      hg.fillRect(0, 0, w, h);
      rg.fillStyle = '#c8c8c8';
      rg.fillRect(0, 0, w, h);

      // Subtle dusty edge shoulders + center lane darkening
      const shoulderL = dg.createLinearGradient(0, 0, 108, 0);
      shoulderL.addColorStop(0, 'rgba(124, 77, 48, 0.36)');
      shoulderL.addColorStop(1, 'rgba(124, 77, 48, 0)');
      dg.fillStyle = shoulderL;
      dg.fillRect(0, 0, 108, h);

      const shoulderR = dg.createLinearGradient(w, 0, w - 108, 0);
      shoulderR.addColorStop(0, 'rgba(124, 77, 48, 0.36)');
      shoulderR.addColorStop(1, 'rgba(124, 77, 48, 0)');
      dg.fillStyle = shoulderR;
      dg.fillRect(w - 108, 0, 108, h);

      // Realistic twin rubber tire-wear tracks in all 3 lanes (darker + smoother gloss!)
      const laneCenters = [w * 0.21, w * 0.5, w * 0.79];
      laneCenters.forEach((lc) => {
        [-58, 58].forEach((offset) => {
          const tx = lc + offset;
          const grad = dg.createLinearGradient(tx - 46, 0, tx + 46, 0);
          grad.addColorStop(0, 'rgba(8, 10, 15, 0)');
          grad.addColorStop(0.5, 'rgba(8, 10, 15, 0.38)');
          grad.addColorStop(1, 'rgba(8, 10, 15, 0)');
          dg.fillStyle = grad;
          dg.fillRect(tx - 46, 0, 92, h);

          // Smoother polished bitumen along wheel ruts catches golden sunset reflections
          const rGrad = rg.createLinearGradient(tx - 44, 0, tx + 44, 0);
          rGrad.addColorStop(0, 'rgba(92, 92, 92, 0)');
          rGrad.addColorStop(0.5, 'rgba(86, 86, 86, 0.78)');
          rGrad.addColorStop(1, 'rgba(92, 92, 92, 0)');
          rg.fillStyle = rGrad;
          rg.fillRect(tx - 44, 0, 88, h);
        });
      });

      // Coarse asphalt mineral aggregate gravel speckles (diffuse + height + roughness)
      for (let i = 0; i < 42000; i += 1) {
        const x = rnd() * w;
        const y = rnd() * h;
        const sz = 1 + rnd() * 2.3;
        const v = rnd();
        if (v < 0.35) {
          dg.fillStyle = 'rgba(72, 79, 92, 0.32)';
          hg.fillStyle = 'rgba(215, 215, 215, 0.42)';
        } else if (v < 0.72) {
          dg.fillStyle = 'rgba(11, 14, 20, 0.42)';
          hg.fillStyle = 'rgba(42, 42, 42, 0.42)';
        } else {
          dg.fillStyle = 'rgba(138, 134, 126, 0.22)';
          hg.fillStyle = 'rgba(242, 242, 242, 0.38)';
        }
        dg.fillRect(x, y, sz, sz);
        hg.fillRect(x, y, sz, sz);
      }

      // Subtle hot-tar crack-seal seams (shiny black tar strips)
      for (let c = 0; c < 11; c += 1) {
        let cx = 70 + rnd() * (w - 140);
        let cy = rnd() * h;
        dg.strokeStyle = 'rgba(7, 8, 12, 0.78)';
        dg.lineWidth = 2.4;
        hg.strokeStyle = 'rgba(28, 28, 28, 0.8)';
        hg.lineWidth = 3.0;
        rg.strokeStyle = 'rgba(62, 62, 62, 0.85)';
        rg.lineWidth = 3.4;
        dg.beginPath();
        hg.beginPath();
        rg.beginPath();
        dg.moveTo(cx, cy);
        hg.moveTo(cx, cy);
        rg.moveTo(cx, cy);
        for (let s = 0; s < 5; s += 1) {
          cx += (rnd() - 0.5) * 95;
          cy += 24 + rnd() * 68;
          dg.lineTo(cx, cy);
          hg.lineTo(cx, cy);
          rg.lineTo(cx, cy);
        }
        dg.stroke();
        hg.stroke();
        rg.stroke();
      }

      // Solid amber-yellow highway edge lines (slightly weathered)
      const drawWeatheredStripe = (x, y, sw, sh, color) => {
        dg.fillStyle = color;
        dg.fillRect(x, y, sw, sh);
        hg.fillStyle = 'rgba(165, 165, 165, 0.5)';
        hg.fillRect(x, y, sw, sh);
        rg.fillStyle = 'rgba(110, 110, 110, 0.65)';
        rg.fillRect(x, y, sw, sh);
        for (let k = 0; k < Math.floor(sh * 0.45); k += 1) {
          dg.fillStyle = 'rgba(25, 29, 38, 0.38)';
          dg.fillRect(x + rnd() * sw, y + rnd() * sh, 1.8 + rnd() * 3, 2 + rnd() * 4);
        }
      };

      drawWeatheredStripe(40, 0, 14, h, '#eab308');
      drawWeatheredStripe(w - 54, 0, 14, h, '#eab308');

      // White dashed lane dividers with reflective glass-bead sheen
      [w * 0.355, w * 0.645].forEach((lx) => {
        for (let dy = 24; dy < h; dy += 256) {
          drawWeatheredStripe(lx - 8, dy, 16, 134, '#f1f5f9');
        }
      });

      registerTex('roadDiff', diffC, { repeatX: 1, repeatY: 16 });
      heightCanvasToNormalTexture('roadNorm', hgtC, 2.6, { repeatX: 1, repeatY: 16 });
      registerTex('roadRough', rghC, { repeatX: 1, repeatY: 16, linear: true });
    }

    // 1B. Concrete Sidewalk Paving + Curbstone PBR (512x512)
    {
      const w = 512;
      const h = 512;
      const diffC = createCanvas(w, h);
      const dg = diffC.getContext('2d');
      const hgtC = createCanvas(w, h);
      const hg = hgtC.getContext('2d');
      const rnd = makeNoiseRand(7721);

      dg.fillStyle = '#8b8e93';
      dg.fillRect(0, 0, w, h);
      hg.fillStyle = '#909090';
      hg.fillRect(0, 0, w, h);

      // Expansion joints for concrete tiles
      for (let y = 0; y < h; y += 128) {
        dg.fillStyle = 'rgba(30, 34, 42, 0.55)';
        dg.fillRect(0, y, w, 5);
        hg.fillStyle = '#202020';
        hg.fillRect(0, y, w, 6);
      }
      for (let x = 0; x < w; x += 128) {
        dg.fillStyle = 'rgba(30, 34, 42, 0.45)';
        dg.fillRect(x, 0, 4, h);
        hg.fillStyle = '#282828';
        hg.fillRect(x, 0, 5, h);
      }
      for (let i = 0; i < 12000; i += 1) {
        const x = rnd() * w;
        const y = rnd() * h;
        const bright = rnd() > 0.5;
        dg.fillStyle = bright ? 'rgba(210, 206, 198, 0.16)' : 'rgba(55, 50, 45, 0.18)';
        hg.fillStyle = bright ? 'rgba(180, 180, 180, 0.25)' : 'rgba(70, 70, 70, 0.25)';
        dg.fillRect(x, y, 2.5, 2.5);
        hg.fillRect(x, y, 2.5, 2.5);
      }
      registerTex('sidewalkDiff', diffC, { repeatX: 2, repeatY: 44 });
      heightCanvasToNormalTexture('sidewalkNorm', hgtC, 2.2, { repeatX: 2, repeatY: 44 });
    }

    // 1C. Laterite Soil & Tropical Roadside Ground PBR (512x512)
    {
      const w = 512;
      const h = 512;
      const diffC = createCanvas(w, h);
      const dg = diffC.getContext('2d');
      const hgtC = createCanvas(w, h);
      const hg = hgtC.getContext('2d');
      const rnd = makeNoiseRand(19301);

      dg.fillStyle = '#6b321b';
      dg.fillRect(0, 0, w, h);
      hg.fillStyle = '#808080';
      hg.fillRect(0, 0, w, h);

      // Organic earth patches & grass scrub
      for (let i = 0; i < 65; i += 1) {
        const x = rnd() * w;
        const y = rnd() * h;
        const r = 18 + rnd() * 52;
        const patch = dg.createRadialGradient(x, y, 2, x, y, r);
        if (i % 3 === 0) {
          patch.addColorStop(0, 'rgba(62, 86, 38, 0.42)');
          patch.addColorStop(1, 'rgba(62, 86, 38, 0)');
        } else {
          patch.addColorStop(0, 'rgba(130, 62, 32, 0.35)');
          patch.addColorStop(1, 'rgba(130, 62, 32, 0)');
        }
        dg.fillStyle = patch;
        dg.beginPath();
        dg.arc(x, y, r, 0, Math.PI * 2);
        dg.fill();
      }
      for (let i = 0; i < 16000; i += 1) {
        const x = rnd() * w;
        const y = rnd() * h;
        const sz = 1.5 + rnd() * 3.5;
        const t = rnd();
        dg.fillStyle = t < 0.4 ? 'rgba(148, 72, 36, 0.28)' : t < 0.78 ? 'rgba(54, 24, 12, 0.32)' : 'rgba(84, 108, 46, 0.26)';
        hg.fillStyle = t < 0.5 ? 'rgba(205, 205, 205, 0.35)' : 'rgba(50, 50, 50, 0.35)';
        dg.fillRect(x, y, sz, sz);
        hg.fillRect(x, y, sz, sz);
      }
      registerTex('lateriteDiff', diffC, { repeatX: 20, repeatY: 28 });
      heightCanvasToNormalTexture('lateriteNorm', hgtC, 2.5, { repeatX: 20, repeatY: 28 });
    }

    // 1D. Realistic Human Skin PBR (warm rich dark-brown African skin + pores/creases)
    {
      const w = 256;
      const h = 256;
      const diffC = createCanvas(w, h);
      const dg = diffC.getContext('2d');
      const hgtC = createCanvas(w, h);
      const hg = hgtC.getContext('2d');
      const rnd = makeNoiseRand(55103);

      const baseGrad = dg.createLinearGradient(0, 0, w, h);
      baseGrad.addColorStop(0, '#633c26');
      baseGrad.addColorStop(0.5, '#59331f');
      baseGrad.addColorStop(1, '#684029');
      dg.fillStyle = baseGrad;
      dg.fillRect(0, 0, w, h);
      hg.fillStyle = '#808080';
      hg.fillRect(0, 0, w, h);

      // Fine skin micro-grain & subtle knuckle crease lines
      for (let i = 0; i < 6500; i += 1) {
        const x = rnd() * w;
        const y = rnd() * h;
        const light = rnd() > 0.5;
        dg.fillStyle = light ? 'rgba(142, 94, 66, 0.12)' : 'rgba(42, 22, 12, 0.14)';
        hg.fillStyle = light ? 'rgba(155, 155, 155, 0.22)' : 'rgba(95, 95, 95, 0.22)';
        dg.fillRect(x, y, 1.5, 1.5);
        hg.fillRect(x, y, 1.5, 1.5);
      }
      for (let k = 0; k < 14; k += 1) {
        const y = 18 + k * 17;
        dg.strokeStyle = 'rgba(38, 19, 10, 0.16)';
        hg.strokeStyle = 'rgba(65, 65, 65, 0.32)';
        dg.lineWidth = 1.2;
        hg.lineWidth = 1.4;
        dg.beginPath();
        hg.beginPath();
        dg.moveTo(0, y);
        hg.moveTo(0, y);
        dg.quadraticCurveTo(w * 0.5, y + (rnd() - 0.5) * 6, w, y);
        hg.quadraticCurveTo(w * 0.5, y + (rnd() - 0.5) * 6, w, y);
        dg.stroke();
        hg.stroke();
      }
      registerTex('skinDiff', diffC, { repeatX: 2, repeatY: 2 });
      heightCanvasToNormalTexture('skinNorm', hgtC, 1.15, { repeatX: 2, repeatY: 2 });
    }

    // 1E. Perforated Riding Leather & Woven Moto Jacket Fabric PBR
    {
      const w = 256;
      const h = 256;
      const lDiff = createCanvas(w, h);
      const lg = lDiff.getContext('2d');
      const lHgt = createCanvas(w, h);
      const lhg = lHgt.getContext('2d');
      const rnd = makeNoiseRand(8821);

      lg.fillStyle = '#151821';
      lg.fillRect(0, 0, w, h);
      lhg.fillStyle = '#9a9a9a';
      lhg.fillRect(0, 0, w, h);
      for (let y = 8; y < h; y += 16) {
        for (let x = 8; x < w; x += 16) {
          const ox = ((y / 16) % 2) * 8;
          lg.fillStyle = '#07090e';
          lhg.fillStyle = '#181818';
          lg.beginPath();
          lhg.beginPath();
          lg.arc((x + ox) % w, y, 2.3, 0, Math.PI * 2);
          lhg.arc((x + ox) % w, y, 2.6, 0, Math.PI * 2);
          lg.fill();
          lhg.fill();
        }
      }
      for (let i = 0; i < 3000; i += 1) {
        const x = rnd() * w;
        const y = rnd() * h;
        lg.fillStyle = rnd() > 0.5 ? 'rgba(65, 72, 86, 0.14)' : 'rgba(5, 6, 10, 0.2)';
        lg.fillRect(x, y, 2, 2);
      }
      registerTex('leatherDiff', lDiff, { repeatX: 3, repeatY: 3 });
      heightCanvasToNormalTexture('leatherNorm', lHgt, 2.1, { repeatX: 3, repeatY: 3 });

      // Woven denim/cordura jacket fabric + contrast stitching
      const jDiff = createCanvas(w, h);
      const jg = jDiff.getContext('2d');
      const jHgt = createCanvas(w, h);
      const jhg = jHgt.getContext('2d');
      jg.fillStyle = '#1b2434';
      jg.fillRect(0, 0, w, h);
      jhg.fillStyle = '#808080';
      jhg.fillRect(0, 0, w, h);
      for (let y = 0; y < h; y += 4) {
        jg.fillStyle = y % 8 === 0 ? 'rgba(45, 60, 82, 0.28)' : 'rgba(12, 16, 26, 0.28)';
        jhg.fillStyle = y % 8 === 0 ? '#a6a6a6' : '#646464';
        jg.fillRect(0, y, w, 2);
        jhg.fillRect(0, y, w, 2);
      }
      for (let x = 0; x < w; x += 6) {
        jg.fillStyle = 'rgba(30, 42, 60, 0.22)';
        jhg.fillStyle = 'rgba(155, 155, 155, 0.35)';
        jg.fillRect(x, 0, 2, h);
        jhg.fillRect(x, 0, 2, h);
      }
      registerTex('jacketDiff', jDiff, { repeatX: 3, repeatY: 4 });
      heightCanvasToNormalTexture('jacketNorm', jHgt, 1.8, { repeatX: 3, repeatY: 4 });
    }

    // 1F. 2x2 Twill Carbon Fiber PBR & Tire Radial Tread PBR
    {
      const cDiff = createCanvas(128, 128);
      const cg = cDiff.getContext('2d');
      const cHgt = createCanvas(128, 128);
      const chg = cHgt.getContext('2d');
      cg.fillStyle = '#10141c';
      cg.fillRect(0, 0, 128, 128);
      chg.fillStyle = '#757575';
      chg.fillRect(0, 0, 128, 128);
      for (let y = 0; y < 128; y += 8) {
        for (let x = 0; x < 128; x += 8) {
          const shift = ((x + y) / 8) % 2 === 0;
          cg.fillStyle = shift ? '#283244' : '#0b0e14';
          chg.fillStyle = shift ? '#b8b8b8' : '#4a4a4a';
          cg.fillRect(x, y, 7, 7);
          chg.fillRect(x, y, 7, 7);
        }
      }
      registerTex('carbonDiff', cDiff, { repeatX: 4, repeatY: 4 });
      heightCanvasToNormalTexture('carbonNorm', cHgt, 1.6, { repeatX: 4, repeatY: 4 });

      // V-groove radial rubber tire tread
      const tDiff = createCanvas(256, 128);
      const tg = tDiff.getContext('2d');
      const tHgt = createCanvas(256, 128);
      const thg = tHgt.getContext('2d');
      tg.fillStyle = '#14171d';
      tg.fillRect(0, 0, 256, 128);
      thg.fillStyle = '#b4b4b4';
      thg.fillRect(0, 0, 256, 128);
      tg.strokeStyle = '#07080b';
      thg.strokeStyle = '#202020';
      tg.lineWidth = 6;
      thg.lineWidth = 7;
      for (let x = -32; x < 288; x += 28) {
        tg.beginPath();
        thg.beginPath();
        tg.moveTo(x, 6);
        tg.lineTo(x + 18, 64);
        tg.lineTo(x, 122);
        thg.moveTo(x, 6);
        thg.lineTo(x + 18, 64);
        thg.lineTo(x, 122);
        tg.stroke();
        thg.stroke();
      }
      registerTex('tireTreadDiff', tDiff, { repeatX: 6, repeatY: 1 });
      heightCanvasToNormalTexture('tireTreadNorm', tHgt, 3.0, { repeatX: 6, repeatY: 1 });
    }

    // 1G. Architectural Multi-Story Facade PBR Sets (3 Urban Styles + Normal Maps)
    {
      const buildFacade = (keyPrefix, style) => {
        const w = 512;
        const h = 1024;
        const diffC = createCanvas(w, h);
        const dg = diffC.getContext('2d');
        const hgtC = createCanvas(w, h);
        const hg = hgtC.getContext('2d');
        const rnd = makeNoiseRand(style === 'glass' ? 3101 : style === 'stucco' ? 4202 : 5303);

        if (style === 'glass') {
          dg.fillStyle = '#243242';
          dg.fillRect(0, 0, w, h);
        } else if (style === 'stucco') {
          dg.fillStyle = '#c89b6e';
          dg.fillRect(0, 0, w, h);
        } else {
          dg.fillStyle = '#cbd5e1';
          dg.fillRect(0, 0, w, h);
        }
        hg.fillStyle = '#b0b0b0';
        hg.fillRect(0, 0, w, h);

        // Plaster/concrete surface grain
        for (let i = 0; i < 8000; i += 1) {
          const x = rnd() * w;
          const y = rnd() * h;
          dg.fillStyle = rnd() > 0.5 ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.08)';
          hg.fillStyle = rnd() > 0.5 ? 'rgba(205,205,205,0.22)' : 'rgba(120,120,120,0.22)';
          dg.fillRect(x, y, 2, 3);
          hg.fillRect(x, y, 2, 3);
        }

        const floors = 9;
        const floorH = Math.floor(h / floors);
        const cols = 4;
        const colW = Math.floor(w / cols);

        for (let f = 0; f < floors; f += 1) {
          const fy = f * floorH;
          // Concrete slab spandrel ledge
          dg.fillStyle = style === 'glass' ? '#475569' : style === 'stucco' ? '#9a6b43' : '#64748b';
          dg.fillRect(0, fy, w, 16);
          hg.fillStyle = '#e8e8e8';
          hg.fillRect(0, fy, w, 16);

          for (let c = 0; c < cols; c += 1) {
            const wx = c * colW + 14;
            const wy = fy + 24;
            const ww = colW - 28;
            const wh = floorH - 36;

            // Deep window recess frame
            dg.fillStyle = '#0f172a';
            dg.fillRect(wx - 4, wy - 4, ww + 8, wh + 8);
            hg.fillStyle = '#282828';
            hg.fillRect(wx, wy, ww, wh);

            const lit = rnd() < 0.34;
            const wGrad = dg.createLinearGradient(wx, wy, wx, wy + wh);
            if (lit) {
              wGrad.addColorStop(0, '#fef08a');
              wGrad.addColorStop(0.55, '#f59e0b');
              wGrad.addColorStop(1, '#78350f');
            } else if (style === 'glass') {
              wGrad.addColorStop(0, '#38bdf8');
              wGrad.addColorStop(0.45, '#1e3a5f');
              wGrad.addColorStop(1, '#0c192c');
            } else {
              wGrad.addColorStop(0, '#475569');
              wGrad.addColorStop(0.5, '#1e293b');
              wGrad.addColorStop(1, '#090d16');
            }
            dg.fillStyle = wGrad;
            dg.fillRect(wx, wy, ww, wh);

            // Interior venetian blinds / window mullions + sky diagonal glare
            dg.fillStyle = 'rgba(255, 255, 255, 0.14)';
            dg.beginPath();
            dg.moveTo(wx, wy + wh * 0.25);
            dg.lineTo(wx + ww * 0.45, wy);
            dg.lineTo(wx + ww * 0.72, wy);
            dg.lineTo(wx, wy + wh * 0.58);
            dg.closePath();
            dg.fill();

            dg.fillStyle = '#1e293b';
            dg.fillRect(wx + ww * 0.5 - 2, wy, 4, wh);
            dg.fillRect(wx, wy + wh * 0.48, ww, 3);
            hg.fillStyle = '#909090';
            hg.fillRect(wx + ww * 0.5 - 2, wy, 4, wh);
          }
        }

        // Ground-floor dark glass retail shopfront
        const gy = h - floorH;
        dg.fillStyle = '#1e293b';
        dg.fillRect(0, gy, w, floorH);
        dg.fillStyle = '#f59e0b';
        dg.fillRect(0, gy, w, 14);
        for (let c = 0; c < 3; c += 1) {
          const sx = 18 + c * 164;
          const sg = dg.createLinearGradient(sx, gy + 22, sx, h - 10);
          sg.addColorStop(0, '#fde68a');
          sg.addColorStop(1, '#1e293b');
          dg.fillStyle = sg;
          dg.fillRect(sx, gy + 22, 142, floorH - 32);
        }

        registerTex(`${keyPrefix}Diff`, diffC, { repeatX: 1, repeatY: 1 });
        heightCanvasToNormalTexture(`${keyPrefix}Norm`, hgtC, 2.4, { repeatX: 1, repeatY: 1 });
      };

      buildFacade('facadeGlass', 'glass');
      buildFacade('facadeStucco', 'stucco');
      buildFacade('facadeCommercial', 'commercial');
    }

    // 1H. Ringed Palm Bark, Hardwood Timber Bark + End-Grain Growth Rings, Serrated Frond & Canopy Leaf Clusters
    {
      const rnd = makeNoiseRand(6041);
      // Palm ring bark
      const pDiff = createCanvas(256, 512);
      const pg = pDiff.getContext('2d');
      const pHgt = createCanvas(256, 512);
      const phg = pHgt.getContext('2d');
      pg.fillStyle = '#6f5842';
      pg.fillRect(0, 0, 256, 512);
      phg.fillStyle = '#888888';
      phg.fillRect(0, 0, 256, 512);
      for (let y = 0; y < 512; y += 22) {
        pg.fillStyle = '#473628';
        pg.fillRect(0, y, 256, 7);
        pg.fillStyle = '#8f755a';
        pg.fillRect(0, y + 7, 256, 4);
        phg.fillStyle = '#323232';
        phg.fillRect(0, y, 256, 7);
        phg.fillStyle = '#d4d4d4';
        phg.fillRect(0, y + 7, 256, 5);
      }
      registerTex('palmBarkDiff', pDiff, { repeatX: 1, repeatY: 4 });
      heightCanvasToNormalTexture('palmBarkNorm', pHgt, 2.8, { repeatX: 1, repeatY: 4 });

      // Deep-fissured hardwood mahogany/iroko bark
      const tDiff = createCanvas(256, 512);
      const tg = tDiff.getContext('2d');
      const tHgt = createCanvas(256, 512);
      const thg = tHgt.getContext('2d');
      tg.fillStyle = '#4e331f';
      tg.fillRect(0, 0, 256, 512);
      thg.fillStyle = '#909090';
      thg.fillRect(0, 0, 256, 512);
      for (let i = 0; i < 420; i += 1) {
        const x = rnd() * 256;
        const y = rnd() * 512;
        const lh = 26 + rnd() * 78;
        const dark = rnd() > 0.42;
        tg.fillStyle = dark ? '#2a180c' : '#734b2e';
        thg.fillStyle = dark ? '#2a2a2a' : '#d6d6d6';
        tg.fillRect(x, y, 3 + rnd() * 5, lh);
        thg.fillRect(x, y, 3 + rnd() * 5, lh);
      }
      registerTex('timberBarkDiff', tDiff, { repeatX: 2, repeatY: 2 });
      heightCanvasToNormalTexture('timberBarkNorm', tHgt, 3.0, { repeatX: 2, repeatY: 2 });

      // Timber cut log concentric growth rings
      const eDiff = createCanvas(256, 256);
      const eg = eDiff.getContext('2d');
      eg.fillStyle = '#b4834e';
      eg.fillRect(0, 0, 256, 256);
      for (let r = 122; r >= 8; r -= 7) {
        eg.strokeStyle = r % 14 === 0 ? '#784821' : '#d7aa74';
        eg.lineWidth = 3.2;
        eg.beginPath();
        eg.arc(128, 128, r, 0, Math.PI * 2);
        eg.stroke();
      }
      eg.strokeStyle = 'rgba(42, 22, 10, 0.65)';
      eg.lineWidth = 2;
      for (let a = 0; a < 5; a += 1) {
        const ang = a * 1.24 + 0.3;
        eg.beginPath();
        eg.moveTo(128, 128);
        eg.lineTo(128 + Math.cos(ang) * 112, 128 + Math.sin(ang) * 112);
        eg.stroke();
      }
      registerTex('timberEndDiff', eDiff, { clamp: true });

      // Serrated pinnate coconut palm frond alpha texture
      const fDiff = createCanvas(256, 512);
      const fg = fDiff.getContext('2d');
      fg.clearRect(0, 0, 256, 512);
      // Central woody rachis stem
      const stemGrad = fg.createLinearGradient(0, 512, 0, 0);
      stemGrad.addColorStop(0, '#5a6e2b');
      stemGrad.addColorStop(1, '#84a93a');
      fg.strokeStyle = stemGrad;
      fg.lineWidth = 8;
      fg.beginPath();
      fg.moveTo(128, 506);
      fg.quadraticCurveTo(124, 240, 128, 12);
      fg.stroke();

      for (let i = 0; i < 34; i += 1) {
        const t = i / 33;
        const y = 478 - t * 448;
        const reach = Math.sin(t * Math.PI * 0.94 + 0.1) * 114;
        [-1, 1].forEach((side) => {
          const leafGrad = fg.createLinearGradient(128, y, 128 + side * reach, y - 48);
          leafGrad.addColorStop(0, '#164e2a');
          leafGrad.addColorStop(0.55, '#22743b');
          leafGrad.addColorStop(1, '#65a30d');
          fg.fillStyle = leafGrad;
          fg.beginPath();
          fg.moveTo(128, y);
          fg.quadraticCurveTo(128 + side * reach * 0.55, y - 24, 128 + side * reach, y - 46 + t * 14);
          fg.quadraticCurveTo(128 + side * reach * 0.48, y - 6, 128, y + 11);
          fg.closePath();
          fg.fill();
        });
      }
      registerTex('palmFrondDiff', fDiff, { clamp: true });

      // Lush tropical mango / flame tree alpha leaf cluster
      const mDiff = createCanvas(256, 256);
      const mg = mDiff.getContext('2d');
      mg.clearRect(0, 0, 256, 256);
      for (let i = 0; i < 95; i += 1) {
        const ang = rnd() * Math.PI * 2;
        const rad = Math.sqrt(rnd()) * 94;
        const lx = 128 + Math.cos(ang) * rad;
        const ly = 128 + Math.sin(ang) * rad;
        const lw = 14 + rnd() * 20;
        const lh = 7 + rnd() * 11;
        mg.save();
        mg.translate(lx, ly);
        mg.rotate(rnd() * Math.PI * 2);
        const shade = rnd();
        mg.fillStyle =
          shade < 0.28 ? '#113c21' : shade < 0.65 ? '#1b5e32' : shade < 0.9 ? '#2f7e3f' : '#71a832';
        mg.beginPath();
        mg.ellipse(0, 0, lw, lh, 0, 0, Math.PI * 2);
        mg.fill();
        mg.restore();
      }
      registerTex('mangoLeafDiff', mDiff, { clamp: true });
    }

    // 1I. Overhead Highway Gantry Sign, Cameroon License Plates, Mirror Glass & Contact Shadow
    {
      // Reflective green overhead highway directional gantry sign
      const gSign = createCanvas(1024, 256);
      const sg = gSign.getContext('2d');
      const sGrad = sg.createLinearGradient(0, 0, 0, 256);
      sGrad.addColorStop(0, '#0f6a3c');
      sGrad.addColorStop(1, '#094b29');
      sg.fillStyle = sGrad;
      sg.fillRect(0, 0, 1024, 256);
      sg.strokeStyle = '#f8fafc';
      sg.lineWidth = 10;
      sg.strokeRect(14, 14, 996, 228);

      sg.fillStyle = '#f8fafc';
      sg.font = '900 54px sans-serif';
      sg.textAlign = 'center';
      sg.fillText('DOUALA   BONANJO', 275, 118);
      sg.fillText('YAOUNDE  N3', 745, 118);

      // Route badge & directional arrows
      sg.fillStyle = '#eab308';
      sg.fillRect(496, 36, 32, 184);
      sg.fillStyle = '#ffffff';
      sg.font = '800 34px sans-serif';
      sg.fillText('▲  ALL LANES', 275, 192);
      sg.fillText('▲  EXPRESS  4 KM', 745, 192);
      registerTex('gantrySignDiff', gSign, { clamp: true });

      // Realistic roadside city billboard
      const bSign = createCanvas(1024, 512);
      const bg = bSign.getContext('2d');
      const bGrad = bg.createLinearGradient(0, 0, 1024, 512);
      bGrad.addColorStop(0, '#0f172a');
      bGrad.addColorStop(0.55, '#1e293b');
      bGrad.addColorStop(1, '#7c2d12');
      bg.fillStyle = bGrad;
      bg.fillRect(0, 0, 1024, 512);
      bg.fillStyle = '#facc15';
      bg.fillRect(0, 0, 1024, 22);
      bg.fillRect(0, 490, 1024, 22);
      bg.fillStyle = '#facc15';
      bg.font = '900 88px sans-serif';
      bg.textAlign = 'center';
      bg.fillText('BENDSKIN RUSH', 512, 220);
      bg.fillStyle = '#f8fafc';
      bg.font = '800 44px sans-serif';
      bg.fillText('DOUALA  •  YAOUNDE  •  BUEA', 512, 315);
      bg.fillStyle = '#38bdf8';
      bg.font = '700 34px sans-serif';
      bg.fillText('DRIVE SAFE — WATCH TURN SIGNALS', 512, 396);
      registerTex('billboardRealDiff', bSign, { clamp: true });

      // Realistic reflective motorcycle wing mirror texture (sunset sky + receding highway)
      const mC = createCanvas(256, 128);
      const mg = mC.getContext('2d');
      const mSky = mg.createLinearGradient(0, 0, 0, 74);
      mSky.addColorStop(0, '#1e3a5f');
      mSky.addColorStop(0.65, '#f97316');
      mSky.addColorStop(1, '#fef08a');
      mg.fillStyle = mSky;
      mg.fillRect(0, 0, 256, 74);
      mg.fillStyle = '#1e2430';
      mg.fillRect(0, 74, 256, 54);
      // Receding asphalt perspective lines in mirror
      mg.fillStyle = '#eab308';
      mg.beginPath();
      mg.moveTo(118, 74);
      mg.lineTo(54, 128);
      mg.lineTo(62, 128);
      mg.lineTo(122, 74);
      mg.fill();
      mg.beginPath();
      mg.moveTo(138, 74);
      mg.lineTo(202, 128);
      mg.lineTo(194, 128);
      mg.lineTo(134, 74);
      mg.fill();
      // Subtle specular mirror glare streak
      mg.fillStyle = 'rgba(255, 255, 255, 0.18)';
      mg.beginPath();
      mg.moveTo(16, 0);
      mg.lineTo(66, 0);
      mg.lineTo(24, 128);
      mg.lineTo(0, 128);
      mg.closePath();
      mg.fill();
      registerTex('mirrorReflectDiff', mC, { clamp: true });

      // Cameroon vehicle license plates
      const makePlate = (key, text, bgCol, fgCol) => {
        const pc = createCanvas(256, 64);
        const pg = pc.getContext('2d');
        pg.fillStyle = bgCol;
        pg.fillRect(0, 0, 256, 64);
        pg.strokeStyle = '#0f172a';
        pg.lineWidth = 5;
        pg.strokeRect(3, 3, 250, 58);
        pg.fillStyle = '#16a34a';
        pg.fillRect(6, 6, 26, 52);
        pg.fillStyle = '#facc15';
        pg.font = '900 13px sans-serif';
        pg.textAlign = 'center';
        pg.fillText('CMR', 19, 37);
        pg.fillStyle = fgCol;
        pg.font = '900 34px monospace';
        pg.fillText(text, 144, 44);
        registerTex(key, pc, { clamp: true });
      };
      makePlate('plateTaxi', 'LT 4829 K', '#fef08a', '#090d16');
      makePlate('plateVan', 'CE 7104 M', '#f8fafc', '#090d16');
      makePlate('plateTruck', 'SW 2910 B', '#facc15', '#090d16');
      makePlate('plateMoto', 'LT 901 M', '#f8fafc', '#090d16');

      // Soft radial ambient-occlusion contact shadow beneath every vehicle
      const shC = createCanvas(128, 128);
      const shg = shC.getContext('2d');
      const sRad = shg.createRadialGradient(64, 64, 10, 64, 64, 60);
      sRad.addColorStop(0, 'rgba(0, 0, 0, 0.72)');
      sRad.addColorStop(0.58, 'rgba(0, 0, 0, 0.42)');
      sRad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      shg.fillStyle = sRad;
      shg.fillRect(0, 0, 128, 128);
      registerTex('contactShadowDiff', shC, { clamp: true });

      // Concrete Jersey Barrier hazard chevron texture
      const barC = createCanvas(512, 128);
      const barg = barC.getContext('2d');
      barg.fillStyle = '#9ca3af';
      barg.fillRect(0, 0, 512, 128);
      barg.fillStyle = '#eab308';
      barg.fillRect(0, 18, 512, 46);
      barg.fillStyle = '#0f172a';
      for (let x = -64; x < 576; x += 64) {
        barg.beginPath();
        barg.moveTo(x, 18);
        barg.lineTo(x + 32, 18);
        barg.lineTo(x + 8, 64);
        barg.lineTo(x - 24, 64);
        barg.closePath();
        barg.fill();
      }
      registerTex('barrierRealDiff', barC, { clamp: true });
    }

    // Shared photorealistic PBR materials cache
    mat.chrome = new THREE.MeshStandardMaterial({
      color: '#f1f5f9',
      roughness: 0.12,
      metalness: 0.96,
      envMapIntensity: 1.45,
    });
    mat.steel = new THREE.MeshStandardMaterial({
      color: '#94a3b8',
      roughness: 0.34,
      metalness: 0.86,
      envMapIntensity: 1.15,
    });
    mat.darkTrim = new THREE.MeshStandardMaterial({
      color: '#181c24',
      roughness: 0.62,
      metalness: 0.25,
    });
    mat.matteRubber = new THREE.MeshStandardMaterial({
      color: '#111318',
      roughness: 0.9,
      metalness: 0.04,
    });
    mat.tire = new THREE.MeshStandardMaterial({
      map: tex.tireTreadDiff,
      normalMap: tex.tireTreadNorm,
      normalScale: new THREE.Vector2(0.85, 0.85),
      roughness: 0.84,
      metalness: 0.06,
    });
    mat.alloyRim = new THREE.MeshStandardMaterial({
      color: '#dce4ef',
      roughness: 0.2,
      metalness: 0.9,
      envMapIntensity: 1.35,
    });
    mat.brakeDisc = new THREE.MeshStandardMaterial({
      color: '#cbd5e1',
      roughness: 0.28,
      metalness: 0.88,
    });
    mat.caliperRed = new THREE.MeshStandardMaterial({
      color: '#dc2626',
      roughness: 0.26,
      metalness: 0.55,
    });
    mat.glassTinted = new THREE.MeshPhysicalMaterial({
      color: '#0b1826',
      transparent: true,
      opacity: 0.56,
      roughness: 0.05,
      metalness: 0.18,
      clearcoat: 1.0,
      clearcoatRoughness: 0.04,
      envMapIntensity: 1.6,
    });
    mat.glassLight = new THREE.MeshPhysicalMaterial({
      color: '#13273d',
      transparent: true,
      opacity: 0.42,
      roughness: 0.04,
      metalness: 0.15,
      clearcoat: 1.0,
      envMapIntensity: 1.5,
      side: THREE.DoubleSide,
    });
    mat.interiorDark = new THREE.MeshStandardMaterial({
      color: '#151921',
      roughness: 0.88,
      metalness: 0.06,
    });
    mat.interiorSeat = new THREE.MeshStandardMaterial({
      color: '#322d2a',
      roughness: 0.82,
      metalness: 0.04,
    });
    mat.skin = new THREE.MeshStandardMaterial({
      map: tex.skinDiff,
      normalMap: tex.skinNorm,
      normalScale: new THREE.Vector2(0.45, 0.45),
      roughness: 0.52,
      metalness: 0.03,
    });
    mat.skinPalm = new THREE.MeshStandardMaterial({
      color: '#784c35',
      normalMap: tex.skinNorm,
      normalScale: new THREE.Vector2(0.35, 0.35),
      roughness: 0.58,
      metalness: 0.02,
    });
    mat.nail = new THREE.MeshPhysicalMaterial({
      color: '#c4967d',
      roughness: 0.22,
      metalness: 0.04,
      clearcoat: 0.65,
    });
    mat.leather = new THREE.MeshStandardMaterial({
      map: tex.leatherDiff,
      normalMap: tex.leatherNorm,
      normalScale: new THREE.Vector2(0.75, 0.75),
      roughness: 0.48,
      metalness: 0.14,
    });
    mat.jacket = new THREE.MeshStandardMaterial({
      map: tex.jacketDiff,
      normalMap: tex.jacketNorm,
      normalScale: new THREE.Vector2(0.65, 0.65),
      roughness: 0.74,
      metalness: 0.08,
    });
    mat.carbon = new THREE.MeshStandardMaterial({
      map: tex.carbonDiff,
      normalMap: tex.carbonNorm,
      normalScale: new THREE.Vector2(0.55, 0.55),
      roughness: 0.28,
      metalness: 0.48,
      envMapIntensity: 1.15,
    });
    mat.goldAnodized = new THREE.MeshStandardMaterial({
      color: '#d4a017',
      roughness: 0.22,
      metalness: 0.92,
      envMapIntensity: 1.35,
    });
    mat.contactShadow = new THREE.MeshBasicMaterial({
      map: tex.contactShadowDiff,
      transparent: true,
      depthWrite: false,
      opacity: 0.82,
    });
    mat.headlightGlass = new THREE.MeshStandardMaterial({
      color: '#fefce8',
      emissive: '#fef08a',
      emissiveIntensity: 1.2,
      roughness: 0.08,
      metalness: 0.2,
    });
    mat.facadeGlass = new THREE.MeshStandardMaterial({
      map: tex.facadeGlassDiff,
      normalMap: tex.facadeGlassNorm,
      normalScale: new THREE.Vector2(0.75, 0.75),
      roughness: 0.32,
      metalness: 0.42,
      envMapIntensity: 1.15,
    });
    mat.facadeStucco = new THREE.MeshStandardMaterial({
      map: tex.facadeStuccoDiff,
      normalMap: tex.facadeStuccoNorm,
      normalScale: new THREE.Vector2(0.85, 0.85),
      roughness: 0.78,
      metalness: 0.08,
    });
    mat.facadeCommercial = new THREE.MeshStandardMaterial({
      map: tex.facadeCommercialDiff,
      normalMap: tex.facadeCommercialNorm,
      normalScale: new THREE.Vector2(0.8, 0.8),
      roughness: 0.58,
      metalness: 0.18,
    });
    mat.palmBark = new THREE.MeshStandardMaterial({
      map: tex.palmBarkDiff,
      normalMap: tex.palmBarkNorm,
      normalScale: new THREE.Vector2(0.9, 0.9),
      roughness: 0.92,
      metalness: 0.02,
    });
    mat.timberBark = new THREE.MeshStandardMaterial({
      map: tex.timberBarkDiff,
      normalMap: tex.timberBarkNorm,
      normalScale: new THREE.Vector2(1.0, 1.0),
      roughness: 0.92,
      metalness: 0.02,
    });
    mat.timberEnd = new THREE.MeshStandardMaterial({
      map: tex.timberEndDiff,
      roughness: 0.85,
    });
    mat.palmFrond = new THREE.MeshStandardMaterial({
      map: tex.palmFrondDiff,
      alphaTest: 0.35,
      side: THREE.DoubleSide,
      roughness: 0.62,
      metalness: 0.04,
    });
    mat.mangoLeaf = new THREE.MeshStandardMaterial({
      map: tex.mangoLeafDiff,
      alphaTest: 0.35,
      side: THREE.DoubleSide,
      roughness: 0.68,
      metalness: 0.03,
    });
    mat.concrete = new THREE.MeshStandardMaterial({
      map: tex.sidewalkDiff,
      normalMap: tex.sidewalkNorm,
      normalScale: new THREE.Vector2(0.75, 0.75),
      roughness: 0.86,
      metalness: 0.04,
    });
    mat.barrierReal = new THREE.MeshStandardMaterial({
      map: tex.barrierRealDiff,
      normalMap: tex.sidewalkNorm,
      normalScale: new THREE.Vector2(0.65, 0.65),
      roughness: 0.84,
      metalness: 0.06,
    });
    mat.mirrorGlass = new THREE.MeshPhysicalMaterial({
      map: tex.mirrorReflectDiff,
      roughness: 0.04,
      metalness: 0.82,
      clearcoat: 1.0,
      envMapIntensity: 1.5,
    });

    // Shared curved geometry caches
    // Arched coconut palm frond 3D ribbon
    const fGeo = new THREE.PlaneGeometry(0.95, 2.55, 2, 7);
    const fPos = fGeo.attributes.position;
    for (let i = 0; i < fPos.count; i += 1) {
      const y = fPos.getY(i);
      const t = (y + 1.275) / 2.55; // 0 base -> 1 tip
      fPos.setY(i, Math.sin(t * Math.PI * 0.78) * 0.72 - t * t * 0.62);
      fPos.setZ(i, t * 2.5);
    }
    fGeo.computeVertexNormals();
    geo.palmFrond = fGeo;

    // Arched palm trunk curves
    geo.palmTrunkA = new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0.28, 2.2, 0.14),
        new THREE.Vector3(0.42, 4.4, 0.05),
        new THREE.Vector3(0.16, 6.5, -0.1),
      ]),
      18,
      0.21,
      12,
      false
    );
    geo.palmTrunkB = new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(-0.32, 2.4, -0.12),
        new THREE.Vector3(-0.38, 4.7, 0.14),
        new THREE.Vector3(-0.12, 6.8, 0.18),
      ]),
      18,
      0.2,
      12,
      false
    );

    // Sculpted sedan body & cabin profiles (ExtrudeGeometry along X, centered at X=0)
    const makeCarExtrude = (pts, width, bevel) => {
      const s = new THREE.Shape();
      pts.forEach(([z, y], idx) => {
        if (idx === 0) s.moveTo(z, y);
        else s.lineTo(z, y);
      });
      s.closePath();
      const g = new THREE.ExtrudeGeometry(s, {
        depth: width,
        bevelEnabled: true,
        bevelSegments: 3,
        steps: 1,
        bevelSize: bevel,
        bevelThickness: bevel,
      });
      // Map shape X -> world Z, shape Y -> world Y, extrude depth Z -> world X
      g.translate(0, 0, -width * 0.5);
      g.rotateY(-Math.PI / 2);
      g.computeVertexNormals();
      return g;
    };

    // Real Toyota Corolla / Carina E taxi body profile (+Z rear, -Z front)
    geo.taxiBody = makeCarExtrude(
      [
        [-2.06, 0.34],
        [-2.04, 0.64],
        [-1.82, 0.82],
        [-1.12, 0.88],
        [1.14, 0.89],
        [1.92, 0.84],
        [2.05, 0.64],
        [2.03, 0.34],
      ],
      1.68,
      0.06
    );
    geo.taxiRoof = makeCarExtrude(
      [
        [-0.95, 0.86],
        [-0.54, 1.38],
        [0.56, 1.38],
        [1.12, 0.87],
      ],
      1.36,
      0.05
    );

    // Real HiAce / Commuter Minibus profile
    geo.vanBody = makeCarExtrude(
      [
        [-2.25, 0.36],
        [-2.22, 0.96],
        [-1.84, 1.76],
        [2.04, 1.82],
        [2.22, 1.54],
        [2.24, 0.36],
      ],
      1.8,
      0.07
    );

    // Real Heavy Timber Truck Cab profile
    geo.truckCab = makeCarExtrude(
      [
        [-2.85, 0.55],
        [-2.82, 1.55],
        [-2.58, 2.48],
        [-1.25, 2.54],
        [-1.18, 0.55],
      ],
      2.02,
      0.07
    );

    // Concrete New Jersey barrier profile (extruded across X width)
    const jerseyShape = new THREE.Shape();
    jerseyShape.moveTo(-0.34, 0);
    jerseyShape.lineTo(-0.34, 0.14);
    jerseyShape.lineTo(-0.18, 0.34);
    jerseyShape.lineTo(-0.12, 0.86);
    jerseyShape.lineTo(0.12, 0.86);
    jerseyShape.lineTo(0.18, 0.34);
    jerseyShape.lineTo(0.34, 0.14);
    jerseyShape.lineTo(0.34, 0);
    jerseyShape.closePath();
    const bGeo = new THREE.ExtrudeGeometry(jerseyShape, {
      depth: 2.05,
      bevelEnabled: true,
      bevelSegments: 2,
      steps: 1,
      bevelSize: 0.025,
      bevelThickness: 0.025,
    });
    bGeo.translate(0, 0, -1.025);
    bGeo.rotateY(Math.PI / 2);
    bGeo.computeVertexNormals();
    geo.jerseyBarrier = bGeo;
  }

  // =========================================================
  // 2. Photorealistic Golden-Hour Sky Dome w/ Volumetric Clouds
  // =========================================================
  function createRealSkyDomeShaderMat() {
    return new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        topColor: { value: new THREE.Color('#0a1b38') },
        midColor: { value: new THREE.Color('#274775') },
        horizonColor: { value: new THREE.Color('#f58a3c') },
        sunDir: { value: new THREE.Vector3(0.08, 0.135, -1).normalize() },
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

        float hash(vec2 p) {
          return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
        }
        float noise(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          float a = hash(i);
          float b = hash(i + vec2(1.0, 0.0));
          float c = hash(i + vec2(0.0, 1.0));
          float d = hash(i + vec2(1.0, 1.0));
          return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
        }
        float fbm(vec2 p) {
          float v = 0.0;
          float a = 0.5;
          for (int i = 0; i < 4; i++) {
            v += a * noise(p);
            p *= 2.04;
            a *= 0.5;
          }
          return v;
        }

        void main() {
          vec3 dir = normalize(vWorldPos);
          float h = clamp(dir.y, 0.0, 1.0);
          vec3 col = mix(horizonColor, midColor, smoothstep(0.0, 0.28, h));
          col = mix(col, topColor, smoothstep(0.22, 0.78, h));

          float sunDot = max(dot(dir, sunDir), 0.0);
          // Warm Mie atmospheric sun scattering halo
          col += vec3(1.0, 0.68, 0.34) * pow(sunDot, 5.0) * 0.42;
          col += vec3(1.0, 0.88, 0.58) * pow(sunDot, 28.0) * 0.75;
          col += vec3(1.0, 0.97, 0.9) * smoothstep(0.9972, 0.9994, sunDot) * 1.15;

          // Layered golden-hour clouds projected onto upper sky dome
          if (dir.y > 0.03) {
            vec2 cloudUv = dir.xz / (dir.y + 0.22) * 1.65;
            float n = fbm(cloudUv + vec2(1.7, -0.9));
            float n2 = fbm(cloudUv * 2.1 - vec2(0.8, 2.3));
            float cloudMask = smoothstep(0.44, 0.78, n * 0.7 + n2 * 0.3) * smoothstep(0.03, 0.18, dir.y) * smoothstep(0.88, 0.25, dir.y);
            vec3 cloudDark = vec3(0.24, 0.23, 0.32);
            vec3 cloudLit = mix(vec3(0.98, 0.65, 0.38), vec3(1.0, 0.92, 0.72), pow(sunDot, 3.0));
            vec3 cloudCol = mix(cloudDark, cloudLit, smoothstep(0.35, 0.75, n2) * 0.65 + pow(sunDot, 2.0) * 0.45);
            col = mix(col, cloudCol, cloudMask * 0.78);
          }

          // Distant atmospheric city skyline haze along horizon
          float skyline = step(0.002, dir.y) * (1.0 - smoothstep(0.012, 0.048, dir.y));
          float bld = step(0.55, hash(vec2(floor(dir.x * 95.0), 3.0))) * 0.025;
          if (dir.y > 0.0 && dir.y < 0.012 + bld && dir.z < 0.0) {
            col = mix(col, vec3(0.22, 0.14, 0.15), 0.42);
          }
          col = mix(col, horizonColor * 0.95, skyline * 0.22);

          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });
  }

  function buildRealEnvironmentMap(targetRenderer) {
    if (!targetRenderer || typeof THREE.PMREMGenerator !== 'function') return null;
    try {
      const pmrem = new THREE.PMREMGenerator(targetRenderer);
      pmrem.compileEquirectangularShader();
      const envScene = new THREE.Scene();
      envScene.add(new THREE.Mesh(new THREE.SphereGeometry(32, 24, 16), createRealSkyDomeShaderMat()));
      const envGround = new THREE.Mesh(
        new THREE.CircleGeometry(30, 24),
        new THREE.MeshBasicMaterial({ color: '#1b2029' })
      );
      envGround.rotation.x = -Math.PI / 2;
      envGround.position.y = -2;
      envScene.add(envGround);
      const rt = pmrem.fromScene(envScene, 0.03);
      pmrem.dispose();
      return rt.texture;
    } catch {
      return null;
    }
  }

  // =========================================================
  // 3. Real Road Infrastructure (Asphalt PBR, Sidewalks, Guardrails, Gantries)
  // =========================================================
  function createRealRoadInfrastructure(laneWidth, roadWidth, roadLength) {
    initAssets();

    const roadMat = new THREE.MeshStandardMaterial({
      map: tex.roadDiff,
      normalMap: tex.roadNorm,
      normalScale: new THREE.Vector2(0.85, 0.85),
      roughnessMap: tex.roadRough,
      roughness: 0.78,
      metalness: 0.12,
      envMapIntensity: 0.95,
    });

    const groundMat = new THREE.MeshStandardMaterial({
      map: tex.lateriteDiff,
      normalMap: tex.lateriteNorm,
      normalScale: new THREE.Vector2(0.9, 0.9),
      roughness: 0.94,
      metalness: 0.02,
    });

    const roadGroup = new THREE.Group();
    const halfRoad = roadWidth * 0.5;
    const zCenter = -roadLength * 0.5 + 16;

    // Raised concrete sidewalks flanking both curbs
    const sidewalkGeo = new THREE.BoxGeometry(2.6, 0.22, roadLength);
    const curbRedMat = new THREE.MeshStandardMaterial({ color: '#b91c1c', roughness: 0.72 });
    const curbWhiteMat = new THREE.MeshStandardMaterial({ color: '#e2e8f0', roughness: 0.72 });
    [-1, 1].forEach((side) => {
      const sw = new THREE.Mesh(sidewalkGeo, mat.concrete);
      sw.position.set(side * (halfRoad + 1.55), 0.11, zCenter);
      sw.receiveShadow = true;
      roadGroup.add(sw);

      // Continuous W-Beam galvanized steel highway guardrail along sidewalk outer edge
      const railBeam = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.28, roadLength), mat.steel);
      railBeam.position.set(side * (halfRoad + 0.56), 0.66, zCenter);
      railBeam.castShadow = false;
      roadGroup.add(railBeam);
      const railGroove = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.07, roadLength), mat.darkTrim);
      railGroove.position.set(side * (halfRoad + 0.56), 0.66, zCenter);
      roadGroup.add(railGroove);
    });

    // Scrolling periodic road details (cat's-eye studs, curb paint blocks, guardrail H-posts, storm drains)
    const periodicGroup = new THREE.Group();
    const studGeo = new THREE.BoxGeometry(0.12, 0.032, 0.18);
    const studHousingMat = mat.darkTrim;
    const studReflectMat = new THREE.MeshBasicMaterial({ color: '#fef08a' });
    const postGeo = new THREE.BoxGeometry(0.12, 0.72, 0.12);
    const delinMat = new THREE.MeshBasicMaterial({ color: '#f8fafc' });
    const drainGeo = new THREE.BoxGeometry(0.32, 0.02, 0.55);
    const paintBlockGeo = new THREE.BoxGeometry(0.5, 0.255, 2.0);

    const STEP = 8;
    for (let z = 12; z > -roadLength + 18; z -= STEP) {
      // Cat's-eye road lane studs
      [-laneWidth * 0.5, laneWidth * 0.5].forEach((lx) => {
        const housing = new THREE.Mesh(studGeo, studHousingMat);
        housing.position.set(lx, 0.016, z);
        const glint = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.022, 0.04), studReflectMat);
        glint.position.set(lx, 0.022, z + 0.08);
        periodicGroup.add(housing, glint);
      });

      const isRed = Math.abs(Math.round(z / STEP)) % 2 === 0;
      [-1, 1].forEach((side) => {
        // Alternating painted safety curb edge segments
        const block = new THREE.Mesh(paintBlockGeo, isRed ? curbRedMat : curbWhiteMat);
        block.position.set(side * (halfRoad + 0.24), 0.122, z);
        periodicGroup.add(block);

        // Guardrail vertical H-post + reflective delineator tab
        const post = new THREE.Mesh(postGeo, mat.steel);
        post.position.set(side * (halfRoad + 0.62), 0.44, z);
        const delin = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.12, 0.04), delinMat);
        delin.position.set(side * (halfRoad + 0.51), 0.68, z + 0.05);
        periodicGroup.add(post, delin);

        // Recessed iron storm drain grate every 16m
        if (isRed) {
          const drain = new THREE.Mesh(drainGeo, mat.darkTrim);
          drain.position.set(side * (halfRoad - 0.18), 0.012, z + 2.4);
          periodicGroup.add(drain);
        }
      });
    }
    roadGroup.add(periodicGroup);

    // Overhead Highway Gantry Directional Sign Bridges (2 looped every 96m across highway)
    const gantryGroup = new THREE.Group();
    const GANTRY_SPAN = 96;
    const signMat = new THREE.MeshStandardMaterial({
      map: tex.gantrySignDiff,
      roughness: 0.35,
      metalness: 0.18,
      emissive: '#064e2b',
      emissiveIntensity: 0.16,
    });
    const buildGantry = (gz) => {
      const g = new THREE.Group();
      g.position.set(0, 0, gz);
      const colX = halfRoad + 1.35;
      [-colX, colX].forEach((x) => {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.24, 7.6, 12), mat.steel);
        leg.position.set(x, 3.8, 0);
        const plinth = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.65, 0.75), mat.concrete);
        plinth.position.set(x, 0.32, 0);
        g.add(leg, plinth);
      });
      const beamW = colX * 2 + 0.4;
      const topBeam = new THREE.Mesh(new THREE.BoxGeometry(beamW, 0.24, 0.28), mat.steel);
      topBeam.position.set(0, 7.35, 0);
      const botBeam = new THREE.Mesh(new THREE.BoxGeometry(beamW, 0.22, 0.28), mat.steel);
      botBeam.position.set(0, 6.25, 0);
      g.add(topBeam, botBeam);

      // Diagonal truss struts
      for (let x = -colX + 0.8; x <= colX - 0.8; x += 1.6) {
        const strut = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.35, 0.08), mat.steel);
        strut.position.set(x, 6.8, 0);
        strut.rotation.z = 0.58;
        g.add(strut);
      }

      // Main green directional highway sign board
      const board = new THREE.Mesh(new THREE.BoxGeometry(roadWidth + 0.6, 2.05, 0.14), mat.darkTrim);
      board.position.set(0, 6.8, 0.18);
      const face = new THREE.Mesh(new THREE.PlaneGeometry(roadWidth + 0.48, 1.94), signMat);
      face.position.set(0, 6.8, 0.26);
      g.add(board, face);

      // Sign illumination floodlight arms along top
      [-2.8, 0, 2.8].forEach((lx) => {
        const arm = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.95), mat.steel);
        arm.position.set(lx, 7.88, 0.6);
        const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.12, 0.22), mat.headlightGlass);
        lamp.position.set(lx, 7.82, 1.05);
        g.add(arm, lamp);
      });
      return g;
    };
    gantryGroup.add(buildGantry(-38), buildGantry(-38 - GANTRY_SPAN));
    roadGroup.add(gantryGroup);

    // Sagging overhead utility power cables running along both sidewalks (catenary curves)
    const cableGroup = new THREE.Group();
    const CABLE_SPAN = 28;
    const cableMat = new THREE.MeshBasicMaterial({ color: '#0f172a' });
    [-1, 1].forEach((side) => {
      const cx = side * (halfRoad + 2.35);
      for (let z = 12; z > -roadLength + 24; z -= CABLE_SPAN) {
        const curve = new THREE.CatmullRomCurve3([
          new THREE.Vector3(cx, 7.4, z),
          new THREE.Vector3(cx, 6.65, z - CABLE_SPAN * 0.5),
          new THREE.Vector3(cx, 7.4, z - CABLE_SPAN),
        ]);
        const wire = new THREE.Mesh(new THREE.TubeGeometry(curve, 8, 0.018, 4, false), cableMat);
        cableGroup.add(wire);
      }
    });
    roadGroup.add(cableGroup);

    return {
      roadMat,
      groundMat,
      roadGroup,
      scroll(cameraZ) {
        const roadOff = -(cameraZ / 14) % 1;
        const latOff = -(cameraZ / 8) % 1;
        const swOff = -(cameraZ / 5) % 1;
        if (tex.roadDiff) tex.roadDiff.offset.y = roadOff;
        if (tex.roadNorm) tex.roadNorm.offset.y = roadOff;
        if (tex.roadRough) tex.roadRough.offset.y = roadOff;
        if (tex.lateriteDiff) tex.lateriteDiff.offset.y = latOff;
        if (tex.lateriteNorm) tex.lateriteNorm.offset.y = latOff;
        if (tex.sidewalkDiff) tex.sidewalkDiff.offset.y = swOff;
        if (tex.sidewalkNorm) tex.sidewalkNorm.offset.y = swOff;
        periodicGroup.position.z = ((cameraZ % STEP) + STEP) % STEP;
        gantryGroup.position.z = ((cameraZ % GANTRY_SPAN) + GANTRY_SPAN) % GANTRY_SPAN;
        cableGroup.position.z = ((cameraZ % CABLE_SPAN) + CABLE_SPAN) % CABLE_SPAN;
      },
    };
  }

  // =========================================================
  // 4. REAL-LIFE MOTORCYCLE COCKPIT + REAL-LIFE HUMAN RIDER
  // =========================================================
  function buildAnatomicalHumanArm(side) {
    // side = -1 (left) | +1 (right)
    const arm = new THREE.Group();

    // Organic sculpted rolled-sleeve moto jacket forearm (LatheGeometry — zero boxy primitives!)
    const sleevePts = [
      new THREE.Vector2(0.036, 0.0),
      new THREE.Vector2(0.041, 0.06),
      new THREE.Vector2(0.044, 0.14),
      new THREE.Vector2(0.049, 0.24),
      new THREE.Vector2(0.056, 0.36),
    ];
    const sleeveGeo = new THREE.LatheGeometry(sleevePts, 18);
    const sleeve = new THREE.Mesh(sleeveGeo, mat.jacket);
    sleeve.rotation.x = Math.PI * 0.44;
    sleeve.rotation.z = side * 0.25;
    sleeve.position.set(side * 0.038, -0.048, 0.115);
    arm.add(sleeve);

    // Rolled denim/leather jacket cuff collar exposing real human wrist
    const cuffLip = new THREE.Mesh(new THREE.TorusGeometry(0.038, 0.0085, 10, 20), mat.leather);
    cuffLip.rotation.x = Math.PI * 0.94;
    cuffLip.rotation.y = side * 0.24;
    cuffLip.position.set(side * 0.034, -0.022, 0.106);
    arm.add(cuffLip);

    // Exposed REAL HUMAN WRIST & lower forearm (sculpted dark-brown skin PBR + subtle wrist bone)
    const wristGeo = new THREE.CapsuleGeometry(0.027, 0.062, 8, 16);
    const wrist = new THREE.Mesh(wristGeo, mat.skin);
    wrist.rotation.x = Math.PI * 0.44;
    wrist.rotation.z = side * 0.24;
    wrist.scale.set(1.16, 1, 0.84);
    wrist.position.set(side * 0.018, -0.004, 0.072);
    arm.add(wrist);

    // Realistic brushed stainless-steel sports chronograph wristwatch on LEFT wrist!
    if (side === -1) {
      const watchGroup = new THREE.Group();
      watchGroup.position.set(-0.022, 0.006, 0.082);
      watchGroup.rotation.x = 0.22;
      watchGroup.rotation.z = -0.22;

      const band = new THREE.Mesh(new THREE.TorusGeometry(0.032, 0.0055, 8, 22), mat.chrome);
      band.scale.set(1.15, 0.86, 1.35);
      watchGroup.add(band);

      const caseBezel = new THREE.Mesh(new THREE.CylinderGeometry(0.019, 0.019, 0.009, 20), mat.chrome);
      caseBezel.position.set(0, 0.028, 0);
      watchGroup.add(caseBezel);

      const dial = new THREE.Mesh(
        new THREE.CylinderGeometry(0.0155, 0.0155, 0.0095, 20),
        new THREE.MeshStandardMaterial({ color: '#0b1526', roughness: 0.15, metalness: 0.4 })
      );
      dial.position.set(0, 0.0285, 0);
      watchGroup.add(dial);

      // Luminous watch hands + gold bezel accent + side crown
      const handH = new THREE.Mesh(new THREE.BoxGeometry(0.0022, 0.002, 0.01), mat.chrome);
      handH.position.set(0.002, 0.0338, -0.002);
      handH.rotation.y = 0.7;
      const handM = new THREE.Mesh(new THREE.BoxGeometry(0.0018, 0.002, 0.013), mat.goldAnodized);
      handM.position.set(-0.002, 0.034, -0.003);
      handM.rotation.y = -0.5;
      const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.005, 8), mat.goldAnodized);
      crown.rotation.z = Math.PI / 2;
      crown.position.set(0.021, 0.028, 0);
      watchGroup.add(handH, handM, crown);
      arm.add(watchGroup);
    }

    // Glove & Anatomical Human Hand Anchor
    const gloveAnchor = new THREE.Group();
    arm.add(gloveAnchor);

    // Sculpted anatomical hand body (arched metacarpals wrapped in half-finger perforated leather glove)
    const handBase = new THREE.Mesh(new THREE.SphereGeometry(0.044, 18, 14), mat.leather);
    handBase.scale.set(1.06, 0.46, 0.94);
    handBase.position.set(0, 0.021, 0.015);
    gloveAnchor.add(handBase);

    // Exposed natural palm heel & wrist vent cutout showing real human skin
    const palmHeel = new THREE.Mesh(new THREE.SphereGeometry(0.034, 14, 12), mat.skinPalm);
    palmHeel.scale.set(1.05, 0.42, 0.78);
    palmHeel.position.set(0, 0.009, 0.026);
    gloveAnchor.add(palmHeel);

    const backVent = new THREE.Mesh(new THREE.SphereGeometry(0.019, 12, 10), mat.skin);
    backVent.scale.set(1.3, 0.28, 0.85);
    backVent.position.set(0, 0.036, 0.031);
    gloveAnchor.add(backVent);

    // Molded aerodynamic carbon-fiber knuckle shell over 4 metacarpal knuckles
    const knuckleBar = new THREE.Mesh(new THREE.CapsuleGeometry(0.0105, 0.062, 6, 14), mat.carbon);
    knuckleBar.rotation.z = Math.PI / 2;
    knuckleBar.position.set(0, 0.036, -0.011);
    gloveAnchor.add(knuckleBar);

    // Stitched leather wrist Velcro strap with red/yellow racing accent
    const accentMat = new THREE.MeshStandardMaterial({
      color: side === 1 ? '#dc2626' : '#eab308',
      roughness: 0.35,
      metalness: 0.25,
    });
    const strap = new THREE.Mesh(new THREE.CapsuleGeometry(0.007, 0.056, 6, 10), mat.leather);
    strap.rotation.z = Math.PI / 2;
    strap.position.set(side * 0.005, 0.017, 0.046);
    const strapBadge = new THREE.Mesh(new THREE.BoxGeometry(0.034, 0.004, 0.009), accentMat);
    strapBadge.position.set(side * 0.004, 0.024, 0.046);
    gloveAnchor.add(strap, strapBadge);

    // Articulated ANATOMICAL HUMAN THUMB (thenar pad + 2 rounded Capsule phalanges + joint + natural nail)
    const thumbPivot = new THREE.Group();
    thumbPivot.position.set(-side * 0.041, 0.013, 0.002);

    const thenar = new THREE.Mesh(new THREE.SphereGeometry(0.016, 12, 10), mat.skin);
    thenar.scale.set(1.1, 0.85, 1.25);
    thenar.position.set(side * 0.006, -0.003, 0.012);
    thumbPivot.add(thenar);

    const thumbProx = new THREE.Mesh(new THREE.CapsuleGeometry(0.0096, 0.022, 6, 12), mat.skin);
    thumbProx.rotation.z = side * 1.12;
    thumbProx.rotation.x = -0.34;
    thumbProx.position.set(-side * 0.014, -0.004, -0.005);
    thumbPivot.add(thumbProx);

    const thumbJoint = new THREE.Mesh(new THREE.SphereGeometry(0.0094, 10, 8), mat.skin);
    thumbJoint.position.set(-side * 0.023, -0.008, -0.009);
    thumbPivot.add(thumbJoint);

    const thumbDist = new THREE.Mesh(new THREE.CapsuleGeometry(0.0082, 0.018, 6, 12), mat.skin);
    thumbDist.rotation.z = side * 0.72;
    thumbDist.rotation.x = -0.45;
    thumbDist.position.set(-side * 0.031, -0.013, -0.014);
    thumbPivot.add(thumbDist);

    const thumbNail = new THREE.Mesh(new THREE.SphereGeometry(0.0064, 10, 8), mat.nail);
    thumbNail.scale.set(1.1, 0.35, 1.35);
    thumbNail.position.set(-side * 0.035, -0.008, -0.018);
    thumbPivot.add(thumbNail);
    gloveAnchor.add(thumbPivot);

    // Helper for organic 3-segment human fingers (half-glove collar + rounded capsules + joints + glossy nails)
    const makeAnatomicalFinger = (xOffset, lenScale, radiusScale) => {
      const fGroup = new THREE.Group();
      fGroup.position.set(xOffset, 0, 0);

      // Perforated leather half-finger ring
      const collar = new THREE.Mesh(
        new THREE.CylinderGeometry(0.0095 * radiusScale, 0.0102 * radiusScale, 0.014, 12),
        mat.leather
      );
      collar.rotation.x = 1.18;
      collar.position.set(0, 0.0, -0.006);
      fGroup.add(collar);

      // Proximal phalanx (knuckle to PIP joint)
      const r1 = 0.0084 * radiusScale;
      const prox = new THREE.Mesh(new THREE.CapsuleGeometry(r1, 0.02 * lenScale, 6, 12), mat.skin);
      prox.rotation.x = 1.24;
      prox.position.set(0, -0.006, -0.02 * lenScale);
      fGroup.add(prox);

      // PIP knuckle joint bulge
      const pip = new THREE.Mesh(new THREE.SphereGeometry(r1 * 1.06, 10, 8), mat.skin);
      pip.position.set(0, -0.012, -0.029 * lenScale);
      fGroup.add(pip);

      // Middle phalanx
      const r2 = 0.0074 * radiusScale;
      const mid = new THREE.Mesh(new THREE.CapsuleGeometry(r2, 0.016 * lenScale, 6, 12), mat.skin);
      mid.rotation.x = 2.08;
      mid.position.set(0, -0.021, -0.031 * lenScale);
      fGroup.add(mid);

      // Distal phalanx + realistic fingertip pad + keratin fingernail
      const r3 = 0.0066 * radiusScale;
      const tip = new THREE.Mesh(new THREE.CapsuleGeometry(r3, 0.013 * lenScale, 6, 12), mat.skin);
      tip.rotation.x = 2.74;
      tip.position.set(0, -0.033, -0.027 * lenScale);
      fGroup.add(tip);

      const nail = new THREE.Mesh(new THREE.SphereGeometry(r3 * 0.88, 10, 8), mat.nail);
      nail.scale.set(0.95, 0.35, 1.32);
      nail.rotation.x = 1.15;
      nail.position.set(0, -0.031, -0.033 * lenScale);
      fGroup.add(nail);

      return fGroup;
    };

    const fingersGroup = new THREE.Group();
    fingersGroup.position.set(0, 0.025, -0.018);

    const leverFingersGroup = new THREE.Group();
    leverFingersGroup.position.set(0, 0.025, -0.018);

    const fingerSpecs = [
      { slot: -side * 0.028, len: 1.0, rad: 1.02, isLever: true },
      { slot: -side * 0.0095, len: 1.09, rad: 1.04, isLever: true },
      { slot: side * 0.0095, len: 0.99, rad: 0.98, isLever: false },
      { slot: side * 0.028, len: 0.83, rad: 0.86, isLever: false },
    ];
    fingerSpecs.forEach((sp) => {
      const fMesh = makeAnatomicalFinger(sp.slot, sp.len, sp.rad);
      if (side === 1 && sp.isLever) {
        fMesh.rotation.x = -0.24;
        leverFingersGroup.add(fMesh);
      } else {
        fingersGroup.add(fMesh);
      }
    });

    gloveAnchor.add(fingersGroup, leverFingersGroup);
    return { arm, gloveAnchor, fingersGroup, leverFingersGroup, thumbPivot };
  }

  function buildRealCockpit(livery, dashTexture) {
    initAssets();

    const root = new THREE.Group();
    const tankMat = new THREE.MeshPhysicalMaterial({
      color: livery.paint,
      roughness: 0.12,
      metalness: 0.45,
      clearcoat: 1.0,
      clearcoatRoughness: 0.05,
      envMapIntensity: 1.55,
    });
    const trimMat = new THREE.MeshStandardMaterial({
      color: livery.trim,
      roughness: 0.22,
      metalness: 0.88,
      envMapIntensity: 1.35,
    });

    // 1. Sculpted Clearcoat Superbike Fuel Tank (ExtrudeGeometry silhouette + carbon spine + honeycomb knee pads)
    const tankShape = new THREE.Shape();
    tankShape.moveTo(-0.24, -0.22);
    tankShape.quadraticCurveTo(-0.26, -0.08, -0.14, -0.045);
    tankShape.quadraticCurveTo(0.02, -0.02, 0.22, -0.075);
    tankShape.lineTo(0.28, -0.22);
    tankShape.closePath();
    const tankGeo = new THREE.ExtrudeGeometry(tankShape, {
      depth: 0.34,
      bevelEnabled: true,
      bevelSegments: 4,
      steps: 1,
      bevelSize: 0.045,
      bevelThickness: 0.055,
    });
    tankGeo.translate(0, 0, -0.17);
    tankGeo.rotateY(-Math.PI / 2);
    tankGeo.computeVertexNormals();
    const tankMesh = new THREE.Mesh(tankGeo, tankMat);
    tankMesh.position.set(0, -0.02, 0.02);
    root.add(tankMesh);

    // Carbon-fiber center tank spine + rubber honeycomb knee pads
    const spine = new THREE.Mesh(new THREE.BoxGeometry(0.068, 0.012, 0.42), mat.carbon);
    spine.position.set(0, -0.056, 0.02);
    spine.rotation.x = 0.14;
    root.add(spine);

    [-1, 1].forEach((side) => {
      const kneePad = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.085, 0.22), mat.matteRubber);
      kneePad.position.set(side * 0.205, -0.12, 0.05);
      kneePad.rotation.z = side * 0.32;
      root.add(kneePad);
    });

    // Billet CNC Aluminum Monza Aero Fuel Cap + 6 stainless hex bolts
    const capOuter = new THREE.Mesh(new THREE.CylinderGeometry(0.046, 0.049, 0.015, 24), mat.chrome);
    capOuter.position.set(0, -0.048, -0.025);
    capOuter.rotation.x = 0.14;
    const capInner = new THREE.Mesh(new THREE.CylinderGeometry(0.029, 0.029, 0.019, 20), mat.darkTrim);
    capInner.position.set(0, -0.047, -0.025);
    capInner.rotation.x = 0.14;
    root.add(capOuter, capInner);
    for (let b = 0; b < 6; b += 1) {
      const a = (b / 6) * Math.PI * 2;
      const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.0032, 0.0032, 0.019, 6), mat.steel);
      bolt.position.set(Math.cos(a) * 0.037, -0.046 + Math.sin(a) * -0.005, -0.025 + Math.sin(a) * 0.037);
      root.add(bolt);
    }

    // 2. Steering Assembly (CNC Triple Tree, Gold USD Forks, Keychain, Tapered Bars, Brembo Cup, Mirrors, Dash, Hands)
    const steeringGroup = new THREE.Group();
    steeringGroup.position.set(0, 0.05, -0.36);
    root.add(steeringGroup);

    // Dual Gold Anodized Inverted USD Front Forks + Blue/Red Anodized Preload Adjusters
    const blueAnod = new THREE.MeshStandardMaterial({ color: '#0284c7', roughness: 0.22, metalness: 0.88 });
    [-1, 1].forEach((side) => {
      const forkOuter = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.027, 0.5, 18), mat.goldAnodized);
      forkOuter.rotation.x = -0.35;
      forkOuter.position.set(side * 0.098, -0.18, -0.08);
      steeringGroup.add(forkOuter);

      const capHex = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.014, 6), blueAnod);
      capHex.position.set(side * 0.098, 0.026, -0.018);
      const clicker = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.02, 8), mat.caliperRed);
      clicker.position.set(side * 0.098, 0.03, -0.018);
      steeringGroup.add(capHex, clicker);
    });

    // CNC Skeletonized Billet Upper Triple Tree Bridge
    const treeShape = new THREE.Shape();
    treeShape.moveTo(-0.13, -0.032);
    treeShape.quadraticCurveTo(0, -0.056, 0.13, -0.032);
    treeShape.lineTo(0.135, 0.024);
    treeShape.quadraticCurveTo(0, 0.044, -0.135, 0.024);
    treeShape.closePath();
    const treeGeo = new THREE.ExtrudeGeometry(treeShape, {
      depth: 0.022,
      bevelEnabled: true,
      bevelSegments: 2,
      steps: 1,
      bevelSize: 0.004,
      bevelThickness: 0.004,
    });
    treeGeo.rotateX(Math.PI / 2);
    const tripleTree = new THREE.Mesh(treeGeo, mat.darkTrim);
    tripleTree.position.set(0, 0.022, -0.02);
    steeringGroup.add(tripleTree);

    // Anodized Steering Stem Nut + CNC Bar Risers
    const stemNut = new THREE.Mesh(new THREE.CylinderGeometry(0.019, 0.021, 0.018, 6), mat.chrome);
    stemNut.position.set(0, 0.027, -0.024);
    steeringGroup.add(stemNut);

    [-0.042, 0.042].forEach((rx) => {
      const riser = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.015, 0.034, 12), mat.steel);
      riser.position.set(rx, 0.031, -0.004);
      steeringGroup.add(riser);
    });

    // Ignition Cylinder + Metallic Key + Dynamic Swaying Fabric Keychain Tag!
    const ignCyl = new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.018, 0.025, 16), mat.carbon);
    ignCyl.rotation.x = -0.3;
    ignCyl.position.set(0, 0.024, -0.055);
    steeringGroup.add(ignCyl);

    const ignKeyHead = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.022, 0.02), mat.matteRubber);
    ignKeyHead.rotation.x = -0.3;
    ignKeyHead.position.set(0, 0.04, -0.05);
    steeringGroup.add(ignKeyHead);

    const keychainPivot = new THREE.Group();
    keychainPivot.position.set(0, 0.046, -0.044);
    const keyRing = new THREE.Mesh(new THREE.TorusGeometry(0.007, 0.0014, 6, 12), mat.chrome);
    keyRing.position.set(0, -0.004, 0.004);
    const keyTag = new THREE.Mesh(
      new THREE.BoxGeometry(0.018, 0.042, 0.003),
      new THREE.MeshStandardMaterial({ color: '#dc2626', roughness: 0.72 })
    );
    keyTag.position.set(0, -0.028, 0.01);
    const tagStripe = new THREE.Mesh(
      new THREE.BoxGeometry(0.014, 0.008, 0.0036),
      new THREE.MeshBasicMaterial({ color: '#facc15' })
    );
    tagStripe.position.set(0, -0.028, 0.01);
    keychainPivot.add(keyRing, keyTag, tagStripe);
    steeringGroup.add(keychainPivot);

    // Sculpted Front Aero Nose Cowl + Twin LED DRL Eyebrows + Carbon Front Mudguard
    const noseFairing = new THREE.Mesh(
      new THREE.CylinderGeometry(0.19, 0.22, 0.27, 24, 1, true, Math.PI * 0.6, Math.PI * 0.8),
      tankMat
    );
    noseFairing.rotation.x = Math.PI * 0.42;
    noseFairing.position.set(0, 0.042, -0.115);
    steeringGroup.add(noseFairing);

    [-1, 1].forEach((side) => {
      const drl = new THREE.Mesh(
        new THREE.BoxGeometry(0.078, 0.009, 0.014),
        new THREE.MeshBasicMaterial({ color: '#e0f2fe' })
      );
      drl.position.set(side * 0.112, 0.09, -0.145);
      drl.rotation.z = -side * 0.28;
      drl.rotation.y = side * 0.22;
      steeringGroup.add(drl);
    });

    const frontFender = new THREE.Mesh(
      new THREE.CylinderGeometry(0.115, 0.115, 0.135, 18, 1, false, -0.52, 1.04),
      mat.carbon
    );
    frontFender.rotation.z = Math.PI / 2;
    frontFender.rotation.x = 0.2;
    frontFender.position.set(0, -0.35, -0.22);
    steeringGroup.add(frontFender);

    // Continuous Swept Variable-Diameter Tapered Aluminum Handlebar (TubeGeometry!)
    const barCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.31, 0.004, 0.046),
      new THREE.Vector3(-0.18, 0.028, 0.018),
      new THREE.Vector3(-0.08, 0.046, 0.0),
      new THREE.Vector3(0.08, 0.046, 0.0),
      new THREE.Vector3(0.18, 0.028, 0.018),
      new THREE.Vector3(0.31, 0.004, 0.046),
    ]);
    const barMesh = new THREE.Mesh(new THREE.TubeGeometry(barCurve, 26, 0.014, 14, false), mat.chrome);
    steeringGroup.add(barMesh);

    // Translucent Smoked Brembo Master-Cylinder Brake Fluid Cup + Golden Fluid + Braided Steel Hose
    const cupMount = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.028, 8), mat.darkTrim);
    cupMount.position.set(0.135, 0.056, -0.006);
    const fluidCup = new THREE.Mesh(
      new THREE.CylinderGeometry(0.018, 0.016, 0.032, 18),
      new THREE.MeshPhysicalMaterial({ color: '#e2e8f0', transparent: true, opacity: 0.44, roughness: 0.08 })
    );
    fluidCup.position.set(0.135, 0.077, -0.008);
    const fluidLiquid = new THREE.Mesh(
      new THREE.CylinderGeometry(0.0148, 0.0135, 0.021, 16),
      new THREE.MeshPhysicalMaterial({ color: '#d97706', transparent: true, opacity: 0.85, roughness: 0.1 })
    );
    fluidLiquid.position.set(0.135, 0.072, -0.008);
    const cupCap = new THREE.Mesh(new THREE.CylinderGeometry(0.0195, 0.0195, 0.009, 18), mat.matteRubber);
    cupCap.position.set(0.135, 0.095, -0.008);
    steeringGroup.add(cupMount, fluidCup, fluidLiquid, cupCap);

    // Braided Steel Front Brake Line arching down to fork
    const hoseCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0.155, 0.03, -0.012),
      new THREE.Vector3(0.135, -0.015, -0.06),
      new THREE.Vector3(0.105, -0.14, -0.09),
    ]);
    steeringGroup.add(new THREE.Mesh(new THREE.TubeGeometry(hoseCurve, 12, 0.0042, 6, false), mat.steel));

    // Left & Right Controls, Levers, Sculpted Mirrors & Anatomical Human Hands
    let rightBrakeLever = null;
    let rightGripPivot = null;
    let rightFingersGroup = null;
    let rightLeverFingersGroup = null;
    let leftArmGroup = null;
    let leftThumbPivot = null;

    // Sculpted curved CNC brake/clutch lever profile
    const makeCurvedLever = (side) => {
      const lCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(side * 0.042, 0, -0.014),
        new THREE.Vector3(side * 0.085, -0.002, -0.008),
        new THREE.Vector3(side * 0.112, -0.003, 0.004),
      ]);
      const g = new THREE.Group();
      g.add(new THREE.Mesh(new THREE.TubeGeometry(lCurve, 12, 0.0052, 8, false), mat.chrome));
      const ball = new THREE.Mesh(new THREE.SphereGeometry(0.0085, 10, 8), mat.chrome);
      ball.position.set(side * 0.112, -0.003, 0.004);
      const adj = new THREE.Mesh(new THREE.CylinderGeometry(0.0055, 0.0055, 0.011, 8), mat.goldAnodized);
      adj.position.set(side * 0.022, 0.005, -0.008);
      g.add(ball, adj);
      return g;
    };

    [-1, 1].forEach((side) => {
      // Knurled rubber grip + anodized bar-end slider
      const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.0215, 0.0215, 0.128, 18), mat.matteRubber);
      grip.rotation.z = Math.PI / 2 + side * 0.16;
      grip.rotation.y = -side * 0.2;
      grip.position.set(side * 0.235, 0.016, 0.03);
      steeringGroup.add(grip);

      const barEnd = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.02, 0.026, 14), trimMat);
      barEnd.rotation.z = Math.PI / 2 + side * 0.16;
      barEnd.rotation.y = -side * 0.2;
      barEnd.position.set(side * 0.308, 0.004, 0.045);
      steeringGroup.add(barEnd);

      // OEM Switchgear Pod with contoured tactile switches
      const pod = new THREE.Mesh(new THREE.BoxGeometry(0.044, 0.048, 0.048), mat.darkTrim);
      pod.position.set(side * 0.158, 0.032, 0.015);
      const mainBtn = new THREE.Mesh(
        new THREE.BoxGeometry(0.016, 0.015, 0.013),
        new THREE.MeshStandardMaterial({
          color: side === 1 ? '#ef4444' : '#facc15',
          emissive: side === 1 ? '#7f1d1d' : '#713f12',
          emissiveIntensity: 0.35,
        })
      );
      mainBtn.position.set(side * 0.158, 0.038, 0.039);
      const subBtn = new THREE.Mesh(
        new THREE.BoxGeometry(0.014, 0.009, 0.011),
        new THREE.MeshStandardMaterial({ color: side === 1 ? '#cbd5e1' : '#38bdf8', roughness: 0.35 })
      );
      subBtn.position.set(side * 0.158, 0.02, 0.039);
      steeringGroup.add(pod, mainBtn, subBtn);

      // Sculpted CNC Lever
      const leverPivot = new THREE.Group();
      leverPivot.position.set(side * 0.168, 0.026, -0.018);
      leverPivot.add(makeCurvedLever(side));
      steeringGroup.add(leverPivot);
      if (side === 1) rightBrakeLever = leverPivot;

      // Curved Cast-Aluminum Mirror Stalk + Aerodynamic Pentagon Housing + Real Reflective Glass!
      const stalkCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(side * 0.155, 0.042, -0.008),
        new THREE.Vector3(side * 0.188, 0.112, -0.02),
        new THREE.Vector3(side * 0.218, 0.165, -0.024),
      ]);
      steeringGroup.add(new THREE.Mesh(new THREE.TubeGeometry(stalkCurve, 10, 0.0058, 8, false), mat.darkTrim));

      const mGroup = new THREE.Group();
      mGroup.position.set(side * 0.222, 0.172, -0.024);
      mGroup.rotation.z = side * 0.06;
      mGroup.rotation.y = -side * 0.2;

      const mShape = new THREE.Shape();
      mShape.moveTo(-0.056, -0.024);
      mShape.lineTo(0.052, -0.03);
      mShape.lineTo(0.06, 0.024);
      mShape.lineTo(-0.044, 0.032);
      mShape.closePath();
      const mShell = new THREE.Mesh(
        new THREE.ExtrudeGeometry(mShape, {
          depth: 0.018,
          bevelEnabled: true,
          bevelSegments: 2,
          steps: 1,
          bevelSize: 0.005,
          bevelThickness: 0.005,
        }),
        mat.carbon
      );
      mShell.position.z = -0.016;
      const mGlass = new THREE.Mesh(new THREE.ShapeGeometry(mShape), mat.mirrorGlass);
      mGlass.scale.set(0.92, 0.9, 1);
      mGlass.position.z = 0.008;
      mGroup.add(mShell, mGlass);
      steeringGroup.add(mGroup);

      // Attach ANATOMICAL REAL HUMAN RIDER ARM, WRIST, WATCH & ARTICULATED FINGERS
      const handData = buildAnatomicalHumanArm(side);
      if (side === 1) {
        rightGripPivot = new THREE.Group();
        rightGripPivot.position.set(0.235, 0.016, 0.03);
        rightGripPivot.rotation.y = -0.2;
        rightGripPivot.rotation.z = 0.16;
        rightFingersGroup = handData.fingersGroup;
        rightLeverFingersGroup = handData.leverFingersGroup;
        rightGripPivot.add(handData.arm);
        steeringGroup.add(rightGripPivot);
      } else {
        const leftAnchor = new THREE.Group();
        leftAnchor.position.set(-0.235, 0.016, 0.03);
        leftAnchor.rotation.y = 0.2;
        leftAnchor.rotation.z = -0.16;
        leftArmGroup = handData.arm;
        leftThumbPivot = handData.thumbPivot;
        leftAnchor.add(leftArmGroup);
        steeringGroup.add(leftAnchor);
      }
    });

    // 3. Anti-Glare Carbon Sun-Hood + Brushed Aluminum Bezel + Live OLED TFT Instrument Cluster
    const dashGroup = new THREE.Group();
    dashGroup.position.set(0, 0.088, -0.075);
    dashGroup.rotation.x = -Math.PI * 0.14;

    const dashBack = new THREE.Mesh(new THREE.BoxGeometry(0.236, 0.122, 0.034), mat.carbon);
    const dashHood = new THREE.Mesh(new THREE.BoxGeometry(0.242, 0.012, 0.056), mat.darkTrim);
    dashHood.position.set(0, 0.062, 0.012);
    const dashBezel = new THREE.Mesh(new THREE.BoxGeometry(0.244, 0.128, 0.01), mat.chrome);
    dashBezel.position.set(0, 0, 0.012);
    const dashFace = new THREE.Mesh(
      new THREE.PlaneGeometry(0.222, 0.108),
      new THREE.MeshBasicMaterial({ map: dashTexture })
    );
    dashFace.position.set(0, 0, 0.019);
    const dashGlass = new THREE.Mesh(
      new THREE.PlaneGeometry(0.224, 0.11),
      new THREE.MeshPhysicalMaterial({
        color: '#ffffff',
        transparent: true,
        opacity: 0.08,
        roughness: 0.04,
        metalness: 0.1,
        clearcoat: 1.0,
      })
    );
    dashGlass.position.set(0, 0, 0.021);
    dashGroup.add(dashBack, dashHood, dashBezel, dashFace, dashGlass);
    steeringGroup.add(dashGroup);

    // Double-bubble smoked polycarbonate aero windscreen with dark trim screws
    const visor = new THREE.Mesh(
      new THREE.CylinderGeometry(0.175, 0.21, 0.23, 24, 1, true, Math.PI * 0.65, Math.PI * 0.7),
      new THREE.MeshPhysicalMaterial({
        color: '#0b1424',
        transparent: true,
        opacity: 0.34,
        roughness: 0.04,
        metalness: 0.22,
        clearcoat: 1.0,
        side: THREE.DoubleSide,
      })
    );
    visor.rotation.x = 0.48;
    visor.position.set(0, 0.168, -0.048);
    steeringGroup.add(visor);
    [-0.12, 0.12].forEach((sx) => {
      const screw = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.006, 8), mat.chrome);
      screw.rotation.x = Math.PI / 2;
      screw.position.set(sx, 0.118, -0.148);
      steeringGroup.add(screw);
    });

    return {
      root,
      steeringGroup,
      rightBrakeLever,
      rightGripPivot,
      rightFingersGroup,
      rightLeverFingersGroup,
      leftArmGroup,
      leftThumbPivot,
      keychainPivot,
      tankMat,
      trimMat,
    };
  }

  // =========================================================
  // 5. Shared Real Automotive Wheels, Contact Shadow & Cabin Driver
  // =========================================================
  function addContactShadow(group, width, length) {
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(width, length), mat.contactShadow);
    plane.rotation.x = -Math.PI / 2;
    plane.position.y = 0.015;
    group.add(plane);
  }

  function addRealWheelSet(group, positions, radius, width, isHeavyTruck = false) {
    const wheels = [];
    const tireGeo = new THREE.CylinderGeometry(radius, radius, width, 24);
    tireGeo.rotateZ(Math.PI / 2);
    const rimGeo = new THREE.CylinderGeometry(radius * 0.64, radius * 0.64, width + 0.014, 18);
    rimGeo.rotateZ(Math.PI / 2);
    const rotorGeo = new THREE.CylinderGeometry(radius * 0.48, radius * 0.48, 0.03, 14);
    rotorGeo.rotateZ(Math.PI / 2);
    const spokeGeo = new THREE.BoxGeometry(width + 0.024, radius * 1.18, radius * 0.11);
    const hubGeo = new THREE.CylinderGeometry(radius * 0.2, radius * 0.2, width + 0.032, 12);
    hubGeo.rotateZ(Math.PI / 2);

    positions.forEach(([wx, wy, wz]) => {
      const anchor = new THREE.Group();
      anchor.position.set(wx, wy, wz);

      // Fixed red brake caliper (non-rotating)
      if (!isHeavyTruck) {
        const cal = new THREE.Mesh(
          new THREE.BoxGeometry(width * 0.55, radius * 0.34, radius * 0.22),
          mat.caliperRed
        );
        cal.position.set(wx > 0 ? -width * 0.15 : width * 0.15, radius * 0.18, -radius * 0.32);
        anchor.add(cal);
      }

      const spinGroup = new THREE.Group();
      const tire = new THREE.Mesh(tireGeo, mat.tire);
      tire.castShadow = true;
      const rim = new THREE.Mesh(rimGeo, isHeavyTruck ? mat.steel : mat.alloyRim);
      const rotor = new THREE.Mesh(rotorGeo, mat.brakeDisc);
      const hub = new THREE.Mesh(hubGeo, mat.darkTrim);
      spinGroup.add(tire, rim, rotor, hub);

      const spokeCount = isHeavyTruck ? 6 : 5;
      for (let s = 0; s < spokeCount; s += 1) {
        const sp = new THREE.Mesh(spokeGeo, isHeavyTruck ? mat.steel : mat.alloyRim);
        sp.rotation.x = (s / spokeCount) * Math.PI;
        spinGroup.add(sp);
      }

      anchor.add(spinGroup);
      group.add(anchor);
      wheels.push(spinGroup);
    });
    return wheels;
  }

  // Visible real-life human driver inside car/van/truck cabins (head, shirt, hands on steering wheel!)
  function buildCabinDriver(x, y, z, shirtColor) {
    const d = new THREE.Group();
    d.position.set(x, y, z);
    const shirtMat = new THREE.MeshStandardMaterial({ color: shirtColor, roughness: 0.78 });
    const hairMat = new THREE.MeshStandardMaterial({ color: '#0b0c10', roughness: 0.9 });

    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.145, 0.22, 6, 10), shirtMat);
    torso.scale.set(1.25, 1, 0.8);
    torso.position.set(0, 0.04, 0.04);

    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.058, 0.08, 8), mat.skin);
    neck.position.set(0, 0.24, 0.02);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.112, 12, 10), mat.skin);
    head.scale.set(0.92, 1.08, 0.98);
    head.position.set(0, 0.35, 0.01);

    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.114, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.58), hairMat);
    hair.scale.set(0.94, 1.06, 1.0);
    hair.position.set(0, 0.36, 0.015);

    // Steering wheel visible right in front of driver
    const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.145, 0.018, 6, 16), mat.matteRubber);
    wheel.position.set(0, 0.14, -0.26);
    wheel.rotation.x = 0.42;

    // Driver forearms reaching onto steering wheel
    [-0.14, 0.14].forEach((ax) => {
      const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.038, 0.22, 4, 8), shirtMat);
      arm.rotation.x = 1.25;
      arm.position.set(ax, 0.12, -0.11);
      d.add(arm);
    });

    d.add(torso, neck, head, hair, wheel);
    return d;
  }

  // =========================================================
  // 6. REAL-LIFE VEHICLES, RIVAL MOTORCYCLIST & HAZARDS
  // =========================================================
  function createRealEntityMesh(type) {
    initAssets();

    const group = new THREE.Group();
    const userData = {
      wheels: [],
      brakeLights: [],
      leftSig: null,
      rightSig: null,
      spinTarget: null,
      orbitRing: null,
    };
    group.userData = userData;

    const attachSignalPod = (x, y, z, w, h) => {
      const pod = new THREE.Group();
      pod.position.set(x, y, z);
      const core = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.07), new THREE.MeshBasicMaterial({ color: '#fbbf24' }));
      const glow = new THREE.Mesh(
        new THREE.SphereGeometry(Math.max(w, h) * 1.15, 10, 8),
        new THREE.MeshBasicMaterial({
          color: '#f59e0b',
          transparent: true,
          opacity: 0.48,
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
      addContactShadow(group, 2.35, 4.75);
      const taxiPaint = new THREE.MeshPhysicalMaterial({
        color: '#facc15',
        roughness: 0.12,
        metalness: 0.24,
        clearcoat: 1.0,
        clearcoatRoughness: 0.05,
        envMapIntensity: 1.45,
      });

      // Contoured lower sedan body + roof deck + pillars
      const body = new THREE.Mesh(geo.taxiBody, taxiPaint);
      body.castShadow = true;
      group.add(body);

      const roof = new THREE.Mesh(geo.taxiRoof, taxiPaint);
      roof.scale.set(0.98, 0.18, 0.62);
      roof.position.set(0, 1.16, 0.02);
      roof.castShadow = true;
      group.add(roof);

      // Dark wheel well arch liners
      [
        [-0.84, 0.42, 1.2],
        [0.84, 0.42, 1.2],
        [-0.84, 0.42, -1.2],
        [0.84, 0.42, -1.2],
      ].forEach(([wx, wy, wz]) => {
        const well = new THREE.Mesh(new THREE.CylinderGeometry(0.41, 0.41, 0.24, 14), mat.matteRubber);
        well.rotation.z = Math.PI / 2;
        well.position.set(wx, wy, wz);
        group.add(well);
      });

      // Cabin Interior (dashboard, front/rear seats + headrests + REAL HUMAN DRIVER visible through glass!)
      const dash = new THREE.Mesh(new THREE.BoxGeometry(1.32, 0.24, 0.36), mat.interiorDark);
      dash.position.set(0, 0.94, -0.58);
      group.add(dash);

      [-0.36, 0.36].forEach((sx) => {
        const seatBack = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.44, 0.14), mat.interiorSeat);
        seatBack.position.set(sx, 1.04, 0.04);
        seatBack.rotation.x = -0.15;
        const headrest = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.16, 0.1), mat.interiorSeat);
        headrest.position.set(sx, 1.32, 0.08);
        group.add(seatBack, headrest);
      });
      const rearBench = new THREE.Mesh(new THREE.BoxGeometry(1.28, 0.42, 0.18), mat.interiorSeat);
      rearBench.position.set(0, 1.02, 0.64);
      group.add(rearBench);

      // Visible real driver sitting on left-hand drive side!
      group.add(buildCabinDriver(-0.36, 0.88, -0.06, '#e2e8f0'));

      // Translucent Reflective Tinted Glass Greenhouse (windshield, sloped rear glass, side windows) + A/B/C Pillars
      const frontGlass = new THREE.Mesh(new THREE.PlaneGeometry(1.34, 0.62), mat.glassLight);
      frontGlass.position.set(0, 1.15, -0.76);
      frontGlass.rotation.x = -0.68;
      frontGlass.rotation.y = Math.PI;
      const rearGlass = new THREE.Mesh(new THREE.PlaneGeometry(1.34, 0.64), mat.glassLight);
      rearGlass.position.set(0, 1.16, 0.86);
      rearGlass.rotation.x = -0.78;
      group.add(frontGlass, rearGlass);

      // Windshield wipers
      [-0.25, 0.25].forEach((wx) => {
        const wiper = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.018, 0.018), mat.matteRubber);
        wiper.position.set(wx, 0.96, -0.98);
        wiper.rotation.z = 0.08;
        group.add(wiper);
      });

      [-0.71, 0.71].forEach((sx) => {
        const sideGlass = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.42, 1.56), mat.glassTinted);
        sideGlass.position.set(sx, 1.15, 0.06);
        group.add(sideGlass);

        // Painted A / B / C window pillars
        [
          [-0.74, 0.46],
          [0.06, 0.0],
          [0.84, -0.52],
        ].forEach(([pz, tilt]) => {
          const pil = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.56, 0.07), taxiPaint);
          pil.position.set(sx * 1.01, 1.15, pz);
          pil.rotation.x = tilt;
          group.add(pil);
        });

        // Side door rub strip, chrome handles & sculpted wing mirrors
        const trimStrip = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.055, 2.35), mat.darkTrim);
        trimStrip.position.set(sx * 1.24, 0.58, 0.0);
        const handle1 = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.035, 0.14), mat.chrome);
        handle1.position.set(sx * 1.25, 0.8, -0.18);
        const handle2 = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.035, 0.14), mat.chrome);
        handle2.position.set(sx * 1.25, 0.8, 0.52);
        const mirror = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.095, 0.11), taxiPaint);
        mirror.position.set(sx * 1.32, 0.94, -0.66);
        group.add(trimStrip, handle1, handle2, mirror);
      });

      // Front chrome slatted radiator grille & twin headlights
      const grille = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.22, 0.06), mat.darkTrim);
      grille.position.set(0, 0.62, -2.1);
      const gBar = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.035, 0.07), mat.chrome);
      gBar.position.set(0, 0.64, -2.11);
      group.add(grille, gBar);
      [-0.58, 0.58].forEach((hx) => {
        const hl = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.16, 0.07), mat.headlightGlass);
        hl.position.set(hx, 0.66, -2.09);
        group.add(hl);
      });

      // Rear sculpted bumper, authentic Cameroon LT plate, multi-chamber tail-lights & chrome exhaust
      const rearBumper = new THREE.Mesh(new THREE.BoxGeometry(1.86, 0.22, 0.16), mat.darkTrim);
      rearBumper.position.set(0, 0.39, 2.04);
      const plate = new THREE.Mesh(
        new THREE.PlaneGeometry(0.46, 0.13),
        new THREE.MeshBasicMaterial({ map: tex.plateTaxi })
      );
      plate.position.set(0, 0.63, 2.12);
      const exhaust = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.18, 12), mat.chrome);
      exhaust.rotation.x = Math.PI / 2;
      exhaust.position.set(0.54, 0.3, 2.1);
      group.add(rearBumper, plate, exhaust);

      // Glowing Roof TAXI Beacon Sign
      const taxiSignBase = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.04, 0.28), mat.darkTrim);
      taxiSignBase.position.set(0, 1.43, -0.02);
      const taxiSign = new THREE.Mesh(
        new THREE.BoxGeometry(0.6, 0.15, 0.22),
        new THREE.MeshStandardMaterial({ color: '#fffbeb', emissive: '#fde047', emissiveIntensity: 0.65 })
      );
      taxiSign.position.set(0, 1.52, -0.02);
      group.add(taxiSignBase, taxiSign);

      // Multi-chamber Red Brake + White Reverse Tail-lights
      [-0.64, 0.64].forEach((tx) => {
        const housing = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.16, 0.07), mat.darkTrim);
        housing.position.set(tx, 0.72, 2.08);
        const tailRed = new THREE.Mesh(
          new THREE.BoxGeometry(0.28, 0.12, 0.06),
          new THREE.MeshStandardMaterial({ color: '#ef4444', emissive: '#ef4444', emissiveIntensity: 0.95 })
        );
        tailRed.position.set(tx + (tx > 0 ? 0.04 : -0.04), 0.73, 2.1);
        const revWhite = new THREE.Mesh(
          new THREE.BoxGeometry(0.09, 0.07, 0.06),
          new THREE.MeshBasicMaterial({ color: '#f8fafc' })
        );
        revWhite.position.set(tx + (tx > 0 ? -0.12 : 0.12), 0.7, 2.1);
        group.add(housing, tailRed, revWhite);
        userData.brakeLights.push(tailRed.material);
      });

      userData.leftSig = attachSignalPod(-0.84, 0.56, 2.11, 0.18, 0.14);
      userData.rightSig = attachSignalPod(0.84, 0.56, 2.11, 0.18, 0.14);
      userData.wheels = addRealWheelSet(
        group,
        [
          [-0.86, 0.35, 1.2],
          [0.86, 0.35, 1.2],
          [-0.86, 0.35, -1.2],
          [0.86, 0.35, -1.2],
        ],
        0.35,
        0.24
      );
    } else if (type === 'clando_van') {
      addContactShadow(group, 2.5, 5.1);
      const vanPaint = new THREE.MeshPhysicalMaterial({
        color: '#1d4ed8',
        roughness: 0.16,
        metalness: 0.36,
        clearcoat: 1.0,
        clearcoatRoughness: 0.08,
        envMapIntensity: 1.35,
      });
      const silverBelt = new THREE.MeshPhysicalMaterial({
        color: '#e2e8f0',
        roughness: 0.22,
        metalness: 0.55,
        clearcoat: 0.8,
      });

      const body = new THREE.Mesh(geo.vanBody, vanPaint);
      body.castShadow = true;
      group.add(body);

      // Two-tone silver side stripe belt
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(1.98, 0.28, 4.42), silverBelt);
      stripe.position.set(0, 0.68, 0.0);
      group.add(stripe);

      // Interior cabin seats & visible real commuter van driver
      group.add(buildCabinDriver(-0.42, 1.06, -1.18, '#facc15'));
      [-0.2, 0.75].forEach((rz) => {
        const row = new THREE.Mesh(new THREE.BoxGeometry(1.42, 0.44, 0.2), mat.interiorSeat);
        row.position.set(0, 1.06, rz);
        group.add(row);
      });

      // Panoramic tinted glass front, sides & rear door windows
      const frontWin = new THREE.Mesh(new THREE.BoxGeometry(1.64, 0.64, 0.06), mat.glassLight);
      frontWin.position.set(0, 1.4, -2.06);
      frontWin.rotation.x = 0.42;
      const rearWin = new THREE.Mesh(new THREE.BoxGeometry(1.52, 0.58, 0.06), mat.glassTinted);
      rearWin.position.set(0, 1.4, 2.28);
      const rearWiper = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.025, 0.03), mat.matteRubber);
      rearWiper.position.set(0.18, 1.15, 2.32);
      group.add(frontWin, rearWin, rearWiper);

      [-0.96, 0.96].forEach((sx) => {
        const sideWin = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.54, 3.45), mat.glassTinted);
        sideWin.position.set(sx, 1.38, 0.14);
        const rail = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.045, 2.1), mat.darkTrim);
        rail.position.set(sx * 1.01, 0.96, 0.42);
        const mirror = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.24, 0.09), mat.darkTrim);
        mirror.position.set(sx * 1.16, 1.24, -1.78);
        group.add(sideWin, rail, mirror);
      });

      // Roof AC condenser pod & aluminum luggage rack with strapped cargo bags
      const acPod = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.2, 1.2), silverBelt);
      acPod.position.set(0, 1.96, -0.7);
      const rack = new THREE.Mesh(new THREE.BoxGeometry(1.54, 0.12, 2.15), mat.steel);
      rack.position.set(0, 1.94, 0.72);
      const cargoBag = new THREE.Mesh(
        new THREE.BoxGeometry(0.95, 0.34, 0.82),
        new THREE.MeshStandardMaterial({ color: '#b45309', roughness: 0.85 })
      );
      cargoBag.position.set(-0.15, 2.15, 0.82);
      const cargoCrate = new THREE.Mesh(
        new THREE.BoxGeometry(0.55, 0.28, 0.55),
        new THREE.MeshStandardMaterial({ color: '#15803d', roughness: 0.75 })
      );
      cargoCrate.position.set(0.42, 2.12, 0.48);
      group.add(acPod, rack, cargoBag, cargoCrate);

      // Rear split-door seam, step bumper, Cameroon CE plate, high-mount 3rd brake light & vertical tail towers
      const rearBumper = new THREE.Mesh(new THREE.BoxGeometry(1.94, 0.24, 0.18), mat.darkTrim);
      rearBumper.position.set(0, 0.42, 2.32);
      const plate = new THREE.Mesh(
        new THREE.PlaneGeometry(0.48, 0.13),
        new THREE.MeshBasicMaterial({ map: tex.plateVan })
      );
      plate.position.set(0, 0.82, 2.33);
      const thirdBrake = new THREE.Mesh(
        new THREE.BoxGeometry(0.42, 0.07, 0.06),
        new THREE.MeshStandardMaterial({ color: '#ef4444', emissive: '#ef4444', emissiveIntensity: 1.0 })
      );
      thirdBrake.position.set(0, 1.78, 2.27);
      userData.brakeLights.push(thirdBrake.material);
      group.add(rearBumper, plate, thirdBrake);

      [-0.82, 0.82].forEach((tx) => {
        const tail = new THREE.Mesh(
          new THREE.BoxGeometry(0.18, 0.48, 0.08),
          new THREE.MeshStandardMaterial({ color: '#ef4444', emissive: '#ef4444', emissiveIntensity: 0.95 })
        );
        tail.position.set(tx, 0.86, 2.3);
        group.add(tail);
        userData.brakeLights.push(tail.material);
      });

      userData.leftSig = attachSignalPod(-0.88, 0.62, 2.34, 0.18, 0.15);
      userData.rightSig = attachSignalPod(0.88, 0.62, 2.34, 0.18, 0.15);
      userData.wheels = addRealWheelSet(
        group,
        [
          [-0.94, 0.39, 1.38],
          [0.94, 0.39, 1.38],
          [-0.94, 0.39, -1.35],
          [0.94, 0.39, -1.35],
        ],
        0.39,
        0.26
      );
    } else if (type === 'timber_truck') {
      addContactShadow(group, 2.85, 6.8);
      const cabPaint = new THREE.MeshPhysicalMaterial({
        color: '#991b1b',
        roughness: 0.18,
        metalness: 0.34,
        clearcoat: 0.9,
        envMapIntensity: 1.3,
      });

      // Heavy 6x4 Tractor Cab + Grille + Roof Wind Deflector + Twin Chrome Air Horns + Visible Driver
      const cab = new THREE.Mesh(geo.truckCab, cabPaint);
      cab.castShadow = true;
      group.add(cab);

      const cabWindshield = new THREE.Mesh(new THREE.BoxGeometry(1.86, 0.72, 0.08), mat.glassLight);
      cabWindshield.position.set(0, 2.02, -2.76);
      cabWindshield.rotation.x = 0.22;
      group.add(cabWindshield);
      group.add(buildCabinDriver(-0.46, 1.65, -2.0, '#38bdf8'));

      // Roof aero deflector, twin chrome air horns, 5 amber clearance lamps & vertical exhaust stack
      const deflector = new THREE.Mesh(new THREE.BoxGeometry(1.88, 0.38, 0.76), cabPaint);
      deflector.position.set(0, 2.74, -1.8);
      deflector.rotation.x = 0.28;
      group.add(deflector);
      [-0.45, 0.45].forEach((hx) => {
        const horn = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.025, 0.48, 10), mat.chrome);
        horn.rotation.x = Math.PI / 2;
        horn.position.set(hx, 2.66, -2.32);
        group.add(horn);
      });
      const stack = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 2.25, 12), mat.chrome);
      stack.position.set(1.08, 1.88, -1.16);
      group.add(stack);

      [-1.08, 1.08].forEach((mx) => {
        const rig = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.48, 0.08), mat.darkTrim);
        rig.position.set(mx * 1.08, 2.02, -2.42);
        group.add(rig);
      });

      // Heavy Steel Chassis Rails + Twin Aluminum Diesel Tanks + Steel Log Bolsters
      const chassis = new THREE.Mesh(new THREE.BoxGeometry(1.62, 0.32, 5.4), mat.darkTrim);
      chassis.position.set(0, 0.68, 0.15);
      group.add(chassis);

      [-0.92, 0.92].forEach((fx) => {
        const fuelTank = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 1.18, 14), mat.steel);
        fuelTank.rotation.x = Math.PI / 2;
        fuelTank.position.set(fx, 0.68, -0.58);
        group.add(fuelTank);
      });

      const flatbed = new THREE.Mesh(new THREE.BoxGeometry(2.26, 0.18, 4.05), mat.steel);
      flatbed.position.set(0, 0.94, 0.86);
      group.add(flatbed);

      // Steel U-bolster stanchions holding 7 real bark-textured tropical hardwood logs!
      [-0.6, 1.0, 2.4].forEach((bz) => {
        [-1.08, 1.08].forEach((bx) => {
          const post = new THREE.Mesh(new THREE.BoxGeometry(0.11, 1.75, 0.11), mat.caliperRed);
          post.position.set(bx, 1.82, bz);
          group.add(post);
        });
      });

      const logMatArr = [mat.timberBark, mat.timberEnd, mat.timberEnd];
      const logSpecs = [
        [-0.64, 1.36, 0.31, 4.15],
        [0.0, 1.38, 0.33, 4.35],
        [0.64, 1.36, 0.31, 4.05],
        [-0.35, 1.92, 0.3, 4.25],
        [0.35, 1.92, 0.3, 4.1],
        [0.0, 2.42, 0.28, 3.95],
      ];
      logSpecs.forEach(([lx, ly, lr, ll]) => {
        const logGeo = new THREE.CylinderGeometry(lr, lr * 1.04, ll, 16);
        logGeo.rotateX(Math.PI / 2);
        const logMesh = new THREE.Mesh(logGeo, logMatArr);
        logMesh.position.set(lx, ly, 0.96);
        logMesh.castShadow = true;
        group.add(logMesh);
      });

      // Orange tension lashing straps & steel chains binding the timber stack
      const strapMat = new THREE.MeshStandardMaterial({ color: '#f97316', roughness: 0.65 });
      [-0.1, 1.7].forEach((sz) => {
        const strap = new THREE.Mesh(new THREE.TorusGeometry(0.95, 0.032, 6, 20), strapMat);
        strap.scale.set(1.06, 0.92, 1);
        strap.position.set(0, 1.78, sz);
        group.add(strap);
      });

      // Rear crash bar with reflective chevron, Cameroon SW plate, mudflaps & heavy tail-light cluster
      const crashBar = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.22, 0.14), mat.barrierReal);
      crashBar.position.set(0, 0.56, 2.94);
      const plate = new THREE.Mesh(
        new THREE.PlaneGeometry(0.5, 0.14),
        new THREE.MeshBasicMaterial({ map: tex.plateTruck })
      );
      plate.position.set(0, 0.82, 2.98);
      group.add(crashBar, plate);

      [-0.86, 0.86].forEach((tx) => {
        const mudflap = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.44, 0.04), mat.matteRubber);
        mudflap.position.set(tx, 0.34, 2.86);
        const tail = new THREE.Mesh(
          new THREE.BoxGeometry(0.36, 0.16, 0.08),
          new THREE.MeshStandardMaterial({ color: '#ef4444', emissive: '#ef4444', emissiveIntensity: 1.0 })
        );
        tail.position.set(tx, 0.86, 2.95);
        group.add(mudflap, tail);
        userData.brakeLights.push(tail.material);
      });

      userData.leftSig = attachSignalPod(-1.05, 0.86, 2.98, 0.2, 0.16);
      userData.rightSig = attachSignalPod(1.05, 0.86, 2.98, 0.2, 0.16);
      userData.wheels = addRealWheelSet(
        group,
        [
          [-1.06, 0.48, -2.05],
          [1.06, 0.48, -2.05],
          [-1.06, 0.48, 0.72],
          [1.06, 0.48, 0.72],
          [-1.06, 0.48, 1.98],
          [1.06, 0.48, 1.98],
        ],
        0.48,
        0.34,
        true
      );
    } else if (type === 'rival_moto') {
      // REAL-LIFE STREET MOTORCYCLE + REAL-LIFE ANATOMICAL HUMAN RIDER!
      addContactShadow(group, 1.05, 2.25);

      const bikePaint = new THREE.MeshPhysicalMaterial({
        color: '#dc2626',
        roughness: 0.14,
        metalness: 0.48,
        clearcoat: 1.0,
        envMapIntensity: 1.45,
      });
      const riderJacketMat = new THREE.MeshStandardMaterial({
        color: '#1e293b',
        normalMap: tex.jacketNorm,
        normalScale: new THREE.Vector2(0.5, 0.5),
        roughness: 0.65,
      });
      const riderVestMat = new THREE.MeshStandardMaterial({ color: '#eab308', roughness: 0.52 });
      const jeansMat = new THREE.MeshStandardMaterial({ color: '#1d3557', roughness: 0.82 });

      // Realistic motorcycle chassis, engine block, swingarm, gold USD forks, tank, seat, muffler & handlebars
      const engine = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.34, 0.46), mat.steel);
      engine.position.set(0, 0.48, -0.04);
      const frame = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.16, 1.12), mat.darkTrim);
      frame.position.set(0, 0.68, -0.02);
      const tank = new THREE.Mesh(new THREE.SphereGeometry(0.24, 16, 12), bikePaint);
      tank.scale.set(0.86, 0.72, 1.35);
      tank.position.set(0, 0.84, -0.22);
      const seat = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.1, 0.62), mat.leather);
      seat.position.set(0, 0.8, 0.28);
      const tailCowl = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.12, 0.44), bikePaint);
      tailCowl.position.set(0, 0.86, 0.66);
      tailCowl.rotation.x = -0.18;
      const fenderRear = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.22, 0.05), mat.darkTrim);
      fenderRear.position.set(0, 0.68, 0.86);
      fenderRear.rotation.x = 0.28;
      const plate = new THREE.Mesh(
        new THREE.PlaneGeometry(0.22, 0.12),
        new THREE.MeshBasicMaterial({ map: tex.plateMoto })
      );
      plate.position.set(0, 0.65, 0.9);
      const exhaust = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.04, 0.68, 12), mat.chrome);
      exhaust.rotation.x = Math.PI / 2 + 0.24;
      exhaust.position.set(0.2, 0.44, 0.46);
      const handlebars = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.66, 10), mat.chrome);
      handlebars.rotation.z = Math.PI / 2;
      handlebars.position.set(0, 1.0, -0.48);
      group.add(engine, frame, tank, seat, tailCowl, fenderRear, plate, exhaust, handlebars);

      [-0.08, 0.08].forEach((fx) => {
        const fork = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.72, 10), mat.goldAnodized);
        fork.rotation.x = -0.34;
        fork.position.set(fx, 0.66, -0.58);
        group.add(fork);
      });

      // REAL-LIFE FULL-BODY ANATOMICAL HUMAN RIDER seated on bike!
      const pelvis = new THREE.Mesh(new THREE.CapsuleGeometry(0.14, 0.12, 6, 12), jeansMat);
      pelvis.rotation.z = Math.PI / 2;
      pelvis.position.set(0, 0.91, 0.2);

      const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.17, 0.34, 8, 14), riderJacketMat);
      torso.scale.set(1.24, 1, 0.78);
      torso.position.set(0, 1.24, 0.08);
      torso.rotation.x = 0.36;
      torso.castShadow = true;

      // Reflective yellow high-vis moto rider safety vest stripe on back
      const vestBack = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.34, 0.05), riderVestMat);
      vestBack.position.set(0, 1.24, 0.22);
      vestBack.rotation.x = 0.36;

      // Bent thighs, knees, shins & leather boots gripping the motorcycle pegs!
      [-1, 1].forEach((side) => {
        const thigh = new THREE.Mesh(new THREE.CapsuleGeometry(0.068, 0.28, 6, 10), jeansMat);
        thigh.position.set(side * 0.2, 0.84, 0.02);
        thigh.rotation.x = 1.22;
        thigh.rotation.z = side * 0.16;

        const shin = new THREE.Mesh(new THREE.CapsuleGeometry(0.052, 0.28, 6, 10), jeansMat);
        shin.position.set(side * 0.22, 0.58, 0.06);
        shin.rotation.x = -0.38;

        const boot = new THREE.Mesh(new THREE.BoxGeometry(0.095, 0.11, 0.22), mat.leather);
        boot.position.set(side * 0.22, 0.39, 0.02);

        // Articulated upper arms & forearms reaching onto handlebars + gloved hands
        const upperArm = new THREE.Mesh(new THREE.CapsuleGeometry(0.056, 0.22, 6, 10), riderJacketMat);
        upperArm.position.set(side * 0.25, 1.28, -0.06);
        upperArm.rotation.x = 0.82;
        upperArm.rotation.z = -side * 0.28;

        const foreArm = new THREE.Mesh(new THREE.CapsuleGeometry(0.045, 0.22, 6, 10), riderJacketMat);
        foreArm.position.set(side * 0.29, 1.1, -0.29);
        foreArm.rotation.x = 1.32;
        foreArm.rotation.z = side * 0.12;

        const glove = new THREE.Mesh(new THREE.SphereGeometry(0.046, 10, 8), mat.leather);
        glove.position.set(side * 0.31, 1.0, -0.46);
        group.add(thigh, shin, boot, upperArm, foreArm, glove);
      });

      // Neck + Realistic Aerodynamic Full-Face Helmet w/ Glossy Clearcoat & Tinted Visor
      const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.062, 0.1, 10), mat.skin);
      neck.position.set(0, 1.5, -0.03);
      const helmet = new THREE.Mesh(
        new THREE.SphereGeometry(0.185, 18, 14),
        new THREE.MeshPhysicalMaterial({
          color: '#f8fafc',
          roughness: 0.1,
          clearcoat: 1.0,
          envMapIntensity: 1.45,
        })
      );
      helmet.scale.set(0.94, 1.02, 1.12);
      helmet.position.set(0, 1.66, -0.06);
      helmet.castShadow = true;
      const helmetStripe = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.22, 0.32), bikePaint);
      helmetStripe.position.set(0, 1.75, -0.06);
      const visor = new THREE.Mesh(
        new THREE.CylinderGeometry(0.188, 0.188, 0.11, 16, 1, true, Math.PI * 0.64, Math.PI * 0.72),
        mat.glassTinted
      );
      visor.position.set(0, 1.65, -0.08);
      group.add(pelvis, torso, vestBack, neck, helmet, helmetStripe, visor);

      // LED Brake Light + Amber Blinkers + Real Spoked Moto Wheels
      const tail = new THREE.Mesh(
        new THREE.BoxGeometry(0.19, 0.085, 0.06),
        new THREE.MeshStandardMaterial({ color: '#ef4444', emissive: '#ef4444', emissiveIntensity: 1.1 })
      );
      tail.position.set(0, 0.84, 0.88);
      group.add(tail);
      userData.brakeLights.push(tail.material);

      userData.leftSig = attachSignalPod(-0.22, 0.82, 0.86, 0.11, 0.09);
      userData.rightSig = attachSignalPod(0.22, 0.82, 0.86, 0.11, 0.09);
      userData.wheels = addRealWheelSet(
        group,
        [
          [0, 0.33, 0.66],
          [0, 0.33, -0.68],
        ],
        0.33,
        0.15
      );
    } else if (type === 'barrier') {
      addContactShadow(group, 2.35, 1.1);
      const body = new THREE.Mesh(geo.jerseyBarrier, mat.barrierReal);
      body.castShadow = true;
      group.add(body);
      // Twin flashing solar amber roadwork warning beacons
      [-0.78, 0.78].forEach((bx) => {
        const box = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 0.1), mat.darkTrim);
        box.position.set(bx, 0.94, 0);
        const lamp = new THREE.Mesh(
          new THREE.CylinderGeometry(0.075, 0.075, 0.07, 12),
          new THREE.MeshBasicMaterial({ color: '#fbbf24' })
        );
        lamp.rotation.x = Math.PI / 2;
        lamp.position.set(bx, 1.07, 0);
        group.add(box, lamp);
      });
    } else if (type === 'timber_log') {
      addContactShadow(group, 2.35, 0.95);
      const logGeo = new THREE.CylinderGeometry(0.35, 0.38, 2.15, 18);
      logGeo.rotateZ(Math.PI / 2);
      const log = new THREE.Mesh(logGeo, [mat.timberBark, mat.timberEnd, mat.timberEnd]);
      log.position.set(0, 0.36, 0);
      log.castShadow = true;
      group.add(log);
      // Realistic orange PVC traffic cone warning beside fallen trunk
      const cone = new THREE.Mesh(
        new THREE.ConeGeometry(0.16, 0.52, 14),
        new THREE.MeshStandardMaterial({ color: '#f97316', roughness: 0.4 })
      );
      cone.position.set(0.95, 0.26, 0.42);
      const collar = new THREE.Mesh(
        new THREE.CylinderGeometry(0.085, 0.11, 0.11, 14),
        new THREE.MeshBasicMaterial({ color: '#f8fafc' })
      );
      collar.position.set(0.95, 0.34, 0.42);
      group.add(cone, collar);
    } else if (type === 'coin') {
      const spin = new THREE.Group();
      const goldMat = new THREE.MeshPhysicalMaterial({
        color: '#facc15',
        roughness: 0.12,
        metalness: 0.96,
        clearcoat: 0.9,
        emissive: '#854d0e',
        emissiveIntensity: 0.22,
        envMapIntensity: 1.6,
      });
      const coinDisc = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.09, 28), goldMat);
      coinDisc.rotation.x = Math.PI / 2;
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.045, 10, 28), goldMat);
      const star = new THREE.Mesh(new THREE.OctahedronGeometry(0.16, 0), mat.chrome);
      star.scale.set(1, 1, 0.35);
      spin.add(coinDisc, rim, star);
      spin.position.y = 0.78;
      group.add(spin);
      userData.spinTarget = spin;
    } else if (type === 'fuel_can') {
      const spin = new THREE.Group();
      const redCan = new THREE.MeshPhysicalMaterial({
        color: '#ef4444',
        roughness: 0.18,
        metalness: 0.55,
        clearcoat: 1.0,
        emissive: '#7f1d1d',
        emissiveIntensity: 0.25,
      });
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.62, 18), redCan);
      const dome = new THREE.Mesh(new THREE.SphereGeometry(0.24, 16, 10), redCan);
      dome.position.y = 0.31;
      const valve = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.075, 0.16, 12), mat.chrome);
      valve.position.y = 0.58;
      const band = new THREE.Mesh(new THREE.CylinderGeometry(0.248, 0.248, 0.14, 18), new THREE.MeshBasicMaterial({ color: '#facc15' }));
      const orbit = new THREE.Mesh(new THREE.TorusGeometry(0.46, 0.025, 8, 24), new THREE.MeshBasicMaterial({ color: '#f97316' }));
      spin.add(body, dome, valve, band, orbit);
      spin.position.y = 0.82;
      group.add(spin);
      userData.spinTarget = spin;
      userData.orbitRing = orbit;
    } else if (type === 'shield') {
      const spin = new THREE.Group();
      const core = new THREE.Mesh(
        new THREE.IcosahedronGeometry(0.32, 1),
        new THREE.MeshPhysicalMaterial({
          color: '#38bdf8',
          roughness: 0.08,
          metalness: 0.4,
          clearcoat: 1.0,
          emissive: '#0284c7',
          emissiveIntensity: 0.55,
        })
      );
      const orbit = new THREE.Mesh(new THREE.TorusGeometry(0.46, 0.03, 10, 26), new THREE.MeshBasicMaterial({ color: '#7dd3fc' }));
      spin.add(core, orbit);
      spin.position.y = 0.82;
      group.add(spin);
      userData.spinTarget = spin;
      userData.orbitRing = orbit;
    } else if (type === 'magnet') {
      const spin = new THREE.Group();
      const magRed = new THREE.MeshPhysicalMaterial({ color: '#e11d48', roughness: 0.2, metalness: 0.65, clearcoat: 0.9 });
      const arch = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.095, 12, 22, Math.PI), magRed);
      [-0.24, 0.24].forEach((mx) => {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.095, 0.26, 12), magRed);
        leg.position.set(mx, -0.13, 0);
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.098, 0.098, 0.12, 12), mat.chrome);
        pole.position.set(mx, -0.31, 0);
        spin.add(leg, pole);
      });
      const orbit = new THREE.Mesh(new THREE.TorusGeometry(0.48, 0.024, 8, 24), new THREE.MeshBasicMaterial({ color: '#fb7185' }));
      spin.add(arch, orbit);
      spin.position.y = 0.88;
      group.add(spin);
      userData.spinTarget = spin;
      userData.orbitRing = orbit;
    }
    return group;
  }

  // =========================================================
  // 7. REAL-LIFE ROADSIDE BUILDINGS, TREES, STREETLAMPS & HUMAN PEDESTRIANS
  // =========================================================
  function buildRoadsideHuman(shirtColor, pantsColor) {
    const p = new THREE.Group();
    const shirtMat = new THREE.MeshStandardMaterial({ color: shirtColor, roughness: 0.8 });
    const pantsMat = new THREE.MeshStandardMaterial({ color: pantsColor, roughness: 0.85 });
    const hairMat = new THREE.MeshStandardMaterial({ color: '#0b0c10', roughness: 0.92 });

    // Legs & shoes
    [-0.1, 0.1].forEach((lx) => {
      const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 0.56, 4, 8), pantsMat);
      leg.position.set(lx, 0.44, 0);
      const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.08, 0.22), mat.darkTrim);
      shoe.position.set(lx, 0.04, 0.04);
      p.add(leg, shoe);
    });
    // Torso & arms
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 0.34, 6, 10), shirtMat);
    torso.scale.set(1.15, 1, 0.78);
    torso.position.set(0, 1.04, 0);
    [-0.22, 0.22].forEach((ax) => {
      const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.045, 0.42, 4, 8), mat.skin);
      arm.position.set(ax, 0.98, 0);
      arm.rotation.z = ax > 0 ? 0.14 : -0.14;
      p.add(arm);
    });
    // Neck, head & hair
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.055, 0.08, 8), mat.skin);
    neck.position.set(0, 1.38, 0);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.115, 12, 10), mat.skin);
    head.scale.set(0.92, 1.08, 0.96);
    head.position.set(0, 1.52, 0);
    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.117, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.56), hairMat);
    hair.position.set(0, 1.53, 0);
    p.add(torso, neck, head, hair);
    return p;
  }

  function createRealPropMesh(kind, propSide = 1) {
    initAssets();

    const group = new THREE.Group();
    propVariantCounter += 1;
    const v = propVariantCounter;

    if (kind === 'palm') {
      if (v % 3 === 0) {
        // Real Gnarled Branching Equatorial Mango / Flame Tree (zero blocky spheres!)
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.36, 3.8, 12), mat.timberBark);
        trunk.position.y = 1.9;
        trunk.castShadow = true;
        group.add(trunk);

        const branches = [
          [-0.7, 4.0, 0.4, 0.48, 0.34],
          [0.72, 4.15, -0.3, -0.45, 0.3],
          [0.12, 4.25, -0.68, 0.12, -0.52],
          [-0.18, 4.1, 0.65, -0.16, 0.46],
        ];
        const clusterGeo = new THREE.PlaneGeometry(2.8, 2.8);
        branches.forEach(([bx, by, bz, rz, rx]) => {
          const limb = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.18, 2.4, 8), mat.timberBark);
          limb.position.set(bx * 0.52, by - 0.72, bz * 0.52);
          limb.rotation.set(rx, 0, rz);
          group.add(limb);

          // Crossed alpha-cutout multi-leaf canopy cards (organic sunlit foliage!)
          for (let c = 0; c < 2; c += 1) {
            const card = new THREE.Mesh(clusterGeo, mat.mangoLeaf);
            card.position.set(bx * 1.35, by + 0.75, bz * 1.35);
            card.rotation.y = c * Math.PI * 0.5 + bx;
            card.rotation.x = 0.18;
            group.add(card);
          }
        });
        for (let t = 0; t < 3; t += 1) {
          const topCard = new THREE.Mesh(new THREE.PlaneGeometry(3.5, 3.2), mat.mangoLeaf);
          topCard.position.set(0, 5.45, 0);
          topCard.rotation.y = (t / 3) * Math.PI;
          group.add(topCard);
        }
      } else {
        // Real Arched Ringed-Bark Coconut Palm + Coconuts + 14 Arching Serrated Fronds!
        const useA = v % 2 === 0;
        const trunk = new THREE.Mesh(useA ? geo.palmTrunkA : geo.palmTrunkB, mat.palmBark);
        trunk.rotation.y = (v % 5) * 0.72;
        trunk.castShadow = true;
        group.add(trunk);

        const tipX = useA ? 0.16 : -0.12;
        const tipZ = useA ? -0.1 : 0.18;
        const tipY = useA ? 6.45 : 6.75;
        const ry = trunk.rotation.y;
        const crown = new THREE.Group();
        crown.position.set(
          Math.cos(ry) * tipX + Math.sin(ry) * tipZ,
          tipY,
          -Math.sin(ry) * tipX + Math.cos(ry) * tipZ
        );

        // Cluster of glossy green/brown coconuts hanging under the crown
        const nutMat = new THREE.MeshStandardMaterial({ color: '#4d6b22', roughness: 0.45 });
        for (let n = 0; n < 5; n += 1) {
          const na = (n / 5) * Math.PI * 2;
          const nut = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), nutMat);
          nut.position.set(Math.cos(na) * 0.24, -0.24, Math.sin(na) * 0.24);
          crown.add(nut);
        }

        // 14 Arching 3D Serrated Pinnate Fronds in 2 natural canopy tiers
        for (let f = 0; f < 14; f += 1) {
          const frond = new THREE.Mesh(geo.palmFrond, mat.palmFrond);
          frond.rotation.y = (f / 14) * Math.PI * 2 + (f % 2) * 0.18;
          frond.rotation.x = f % 2 === 0 ? -0.22 : 0.26;
          frond.scale.setScalar(f % 2 === 0 ? 1.12 : 0.94);
          crown.add(frond);
        }
        group.add(crown);
      }
    } else if (kind === 'building') {
      const styleIdx = v % 3;
      const bw = 5.4 + (v % 3) * 1.1;
      const bh = 9.5 + (v % 4) * 3.8;
      const bd = 5.6 + (v % 2) * 1.2;
      const fMat = styleIdx === 0 ? mat.facadeGlass : styleIdx === 1 ? mat.facadeStucco : mat.facadeCommercial;

      const tower = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, bd), fMat);
      tower.position.y = bh * 0.5;
      tower.castShadow = true;
      tower.receiveShadow = true;
      group.add(tower);

      // Rooftop concrete parapet + water storage tank on steel legs + satellite dish
      const parapet = new THREE.Mesh(new THREE.BoxGeometry(bw + 0.32, 0.45, bd + 0.32), mat.concrete);
      parapet.position.y = bh + 0.2;
      const waterTank = new THREE.Mesh(
        new THREE.CylinderGeometry(0.62, 0.62, 1.35, 14),
        new THREE.MeshStandardMaterial({ color: '#0f172a', roughness: 0.45 })
      );
      waterTank.position.set(-bw * 0.22, bh + 1.15, 0.4);
      const dish = new THREE.Mesh(new THREE.SphereGeometry(0.45, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.4), mat.steel);
      dish.rotation.set(0.9, 0.4, 0);
      dish.position.set(bw * 0.26, bh + 0.85, -0.5);
      group.add(parapet, waterTank, dish);

      // Street-facing physical balconies, metal railings, AC condenser units & shopfront awning!
      const roadFaceX = -propSide * (bw * 0.5 + 0.22);
      const awning = new THREE.Mesh(
        new THREE.BoxGeometry(0.95, 0.14, bd * 0.88),
        new THREE.MeshStandardMaterial({ color: styleIdx === 1 ? '#b91c1c' : '#0369a1', roughness: 0.72 })
      );
      awning.position.set(roadFaceX - propSide * 0.22, 2.75, 0);
      awning.rotation.z = propSide * 0.24;
      group.add(awning);

      const balconyFloors = Math.min(3, Math.floor((bh - 3.5) / 3.0));
      for (let b = 0; b < balconyFloors; b += 1) {
        const by = 4.2 + b * 2.9;
        const slab = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.14, bd * 0.72), mat.concrete);
        slab.position.set(roadFaceX, by, 0);
        const railTop = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, bd * 0.72), mat.darkTrim);
        railTop.position.set(roadFaceX - propSide * 0.28, by + 0.66, 0);
        const acUnit = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.42, 0.56), mat.steel);
        acUnit.position.set(roadFaceX + propSide * 0.08, by + 0.9, bd * 0.34);
        group.add(slab, railTop, acUnit);
      }
    } else if (kind === 'lamp') {
      // Tapered Curved Steel Cobra-Head Highway Streetlamp + Glowing Lens + Volumetric Halo Cone
      const plinth = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.32, 0.52, 10), mat.concrete);
      plinth.position.y = 0.26;
      const poleCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, 0.4, 0),
        new THREE.Vector3(0, 5.2, 0),
        new THREE.Vector3(-propSide * 0.45, 6.95, 0),
        new THREE.Vector3(-propSide * 1.95, 7.28, 0),
      ]);
      const pole = new THREE.Mesh(new THREE.TubeGeometry(poleCurve, 14, 0.085, 10, false), mat.steel);
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.15, 0.3), mat.darkTrim);
      head.position.set(-propSide * 2.1, 7.26, 0);
      const lens = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.05, 0.22), mat.headlightGlass);
      lens.position.set(-propSide * 2.1, 7.18, 0);
      const lightCone = new THREE.Mesh(
        new THREE.ConeGeometry(1.75, 5.8, 12, 1, true),
        new THREE.MeshBasicMaterial({
          color: '#fde68a',
          transparent: true,
          opacity: 0.065,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          side: THREE.DoubleSide,
        })
      );
      lightCone.position.set(-propSide * 2.1, 4.28, 0);
      group.add(plinth, pole, head, lens, lightCone);
    } else if (kind === 'kiosk') {
      // Authentic Douala Roadside Street Kiosk / Market Stall + REALISTIC HUMAN VENDOR/PEDESTRIAN!
      const stallCol = v % 2 === 0 ? '#0369a1' : '#b45309';
      const base = new THREE.Mesh(
        new THREE.BoxGeometry(2.6, 1.08, 2.3),
        new THREE.MeshStandardMaterial({ color: stallCol, roughness: 0.78 })
      );
      base.position.y = 0.54;
      base.castShadow = true;
      const counter = new THREE.Mesh(new THREE.BoxGeometry(2.74, 0.1, 2.42), mat.timberEnd);
      counter.position.y = 1.1;
      const roof = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.12, 2.85), mat.steel);
      roof.position.y = 2.68;
      roof.rotation.z = propSide * 0.16;
      roof.castShadow = true;
      group.add(base, counter, roof);

      [
        [-1.18, -1.04],
        [1.18, -1.04],
        [-1.18, 1.04],
        [1.18, 1.04],
      ].forEach(([px, pz]) => {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.06, 2.65, 8), mat.timberBark);
        post.position.set(px, 1.32, pz);
        group.add(post);
      });

      // Colorful market umbrella + crates on counter
      const umbPole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 2.4, 8), mat.steel);
      umbPole.position.set(-propSide * 1.65, 1.2, 0.85);
      const umbTop = new THREE.Mesh(
        new THREE.ConeGeometry(1.15, 0.45, 12),
        new THREE.MeshStandardMaterial({ color: v % 2 === 0 ? '#ef4444' : '#eab308', roughness: 0.65 })
      );
      umbTop.position.set(-propSide * 1.65, 2.48, 0.85);
      group.add(umbPole, umbTop);

      // Realistic full-body human street vendor/pedestrian standing safely beside kiosk!
      const shirtColors = ['#facc15', '#ef4444', '#38bdf8', '#22c55e', '#f97316'];
      const pantsColors = ['#1e293b', '#1d3557', '#3f2e21'];
      const person = buildRoadsideHuman(shirtColors[v % shirtColors.length], pantsColors[v % pantsColors.length]);
      person.position.set(-propSide * 1.55, 0.0, -0.55);
      person.rotation.y = propSide * Math.PI * 0.5;
      group.add(person);
    } else if (kind === 'billboard') {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.3, 6.2, 12), mat.steel);
      pole.position.y = 3.1;
      const frame = new THREE.Mesh(new THREE.BoxGeometry(0.24, 3.2, 6.2), mat.darkTrim);
      frame.position.set(0, 6.1, 0);
      const face = new THREE.Mesh(
        new THREE.PlaneGeometry(5.95, 2.98),
        new THREE.MeshStandardMaterial({ map: tex.billboardRealDiff, roughness: 0.42 })
      );
      face.position.set(-propSide * 0.14, 6.1, 0);
      face.rotation.y = -propSide * (Math.PI / 2);
      const catwalk = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.08, 6.2), mat.steel);
      catwalk.position.set(-propSide * 0.45, 4.35, 0);
      group.add(pole, frame, face, catwalk);
    } else {
      // Highway concrete kilometer marker post
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.85, 0.18), mat.concrete);
      post.position.y = 0.42;
      const cap = new THREE.Mesh(
        new THREE.BoxGeometry(0.34, 0.24, 0.2),
        new THREE.MeshStandardMaterial({ color: '#15803d', roughness: 0.5 })
      );
      cap.position.y = 0.78;
      group.add(post, cap);
    }

    return group;
  }

  // =========================================================
  // 8. REAL-LIFE FULL 3D GARAGE SHOWROOM MOTORCYCLE
  // =========================================================
  function buildRealGarageMotorcycle(livery) {
    initAssets();
    const bike = new THREE.Group();

    const paintMat = new THREE.MeshPhysicalMaterial({
      color: livery.paint,
      roughness: 0.11,
      metalness: 0.48,
      clearcoat: 1.0,
      clearcoatRoughness: 0.05,
      envMapIntensity: 1.65,
    });
    const trimMat = new THREE.MeshStandardMaterial({
      color: livery.trim,
      roughness: 0.22,
      metalness: 0.88,
      envMapIntensity: 1.4,
    });
    const bronzeMat = new THREE.MeshStandardMaterial({
      color: '#926c3b',
      roughness: 0.34,
      metalness: 0.82,
    });

    // Front & Rear High-Detail Radial Treaded Motorcycle Wheels + Twin Drilled Discs + Red Brembo Calipers
    const addShowroomWheel = (zPos, radius, tireW, isFront) => {
      const wg = new THREE.Group();
      wg.position.set(0, radius, zPos);

      const tire = new THREE.Mesh(new THREE.TorusGeometry(radius - tireW * 0.36, tireW * 0.42, 16, 36), mat.tire);
      tire.rotation.y = Math.PI / 2;
      tire.castShadow = true;
      const rimRing = new THREE.Mesh(new THREE.TorusGeometry(radius * 0.64, 0.028, 10, 32), mat.alloyRim);
      rimRing.rotation.y = Math.PI / 2;
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, tireW * 0.95, 16), mat.darkTrim);
      hub.rotation.z = Math.PI / 2;
      wg.add(tire, rimRing, hub);

      // 5 Y-split machined alloy spokes
      for (let s = 0; s < 5; s += 1) {
        const ang = (s / 5) * Math.PI * 2;
        [-0.08, 0.08].forEach((spread) => {
          const sp = new THREE.Mesh(new THREE.BoxGeometry(0.022, radius * 0.62, 0.02), mat.alloyRim);
          sp.position.set(0, Math.cos(ang + spread) * radius * 0.32, Math.sin(ang + spread) * radius * 0.32);
          sp.rotation.x = -(ang + spread);
          wg.add(sp);
        });
      }

      // Drilled steel brake discs + radial Brembo calipers
      const sides = isFront ? [-0.075, 0.075] : [0.08];
      sides.forEach((dx) => {
        const disc = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.5, radius * 0.5, 0.014, 24), mat.brakeDisc);
        disc.rotation.z = Math.PI / 2;
        disc.position.x = dx;
        const caliper = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.095, 0.068), mat.caliperRed);
        caliper.position.set(dx, 0.06, isFront ? 0.14 : -0.14);
        wg.add(disc, caliper);
      });

      // Rear drive sprocket on left side
      if (!isFront) {
        const sprocket = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.44, radius * 0.44, 0.016, 22), mat.steel);
        sprocket.rotation.z = Math.PI / 2;
        sprocket.position.x = -0.095;
        wg.add(sprocket);
      }

      bike.add(wg);
    };

    addShowroomWheel(-0.74, 0.32, 0.13, true);
    addShowroomWheel(0.72, 0.33, 0.18, false);

    // Steel Trellis Frame + Multi-Cylinder Ribbed Engine Block + Bronze Clutch Cover
    const trellisPoints = [
      [new THREE.Vector3(-0.14, 0.92, -0.46), new THREE.Vector3(-0.15, 0.66, 0.12)],
      [new THREE.Vector3(0.14, 0.92, -0.46), new THREE.Vector3(0.15, 0.66, 0.12)],
      [new THREE.Vector3(-0.14, 0.78, -0.42), new THREE.Vector3(-0.15, 0.46, 0.12)],
      [new THREE.Vector3(0.14, 0.78, -0.42), new THREE.Vector3(0.15, 0.46, 0.12)],
    ];
    trellisPoints.forEach(([a, b]) => {
      const tube = new THREE.Mesh(
        new THREE.TubeGeometry(new THREE.CatmullRomCurve3([a, b]), 6, 0.018, 8, false),
        trimMat
      );
      bike.add(tube);
    });

    const engineBlock = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.34, 0.44), mat.darkTrim);
    engineBlock.position.set(0, 0.46, -0.08);
    engineBlock.castShadow = true;
    const cylHead = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.16, 0.28), mat.steel);
    cylHead.position.set(0, 0.64, -0.16);
    cylHead.rotation.x = -0.25;
    const clutchCover = new THREE.Mesh(new THREE.CylinderGeometry(0.115, 0.115, 0.06, 18), bronzeMat);
    clutchCover.rotation.z = Math.PI / 2;
    clutchCover.position.set(0.175, 0.43, -0.02);
    bike.add(engineBlock, cylHead, clutchCover);

    // Sweeping Curved Stainless-Steel Exhaust Headers -> Angled Carbon-Tipped Titanium Muffler!
    [-0.08, 0.08].forEach((hx) => {
      const headerCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(hx, 0.6, -0.3),
        new THREE.Vector3(hx + 0.04, 0.34, -0.34),
        new THREE.Vector3(0.14, 0.25, 0.05),
        new THREE.Vector3(0.22, 0.34, 0.38),
      ]);
      bike.add(new THREE.Mesh(new THREE.TubeGeometry(headerCurve, 16, 0.024, 10, false), mat.chrome));
    });
    const muffler = new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.05, 0.56, 16), mat.steel);
    muffler.rotation.x = Math.PI / 2 - 0.34;
    muffler.position.set(0.24, 0.44, 0.58);
    const mufflerTip = new THREE.Mesh(new THREE.CylinderGeometry(0.058, 0.062, 0.1, 16), mat.carbon);
    mufflerTip.rotation.x = Math.PI / 2 - 0.34;
    mufflerTip.position.set(0.24, 0.54, 0.85);
    bike.add(muffler, mufflerTip);

    // Twin-Sided Aluminum Swingarm + Drive Chain + Yellow Coilover Mono-Shock
    [-0.13, 0.13].forEach((sx) => {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.048, 0.085, 0.68), mat.steel);
      arm.position.set(sx, 0.38, 0.42);
      arm.rotation.x = 0.14;
      bike.add(arm);
    });
    const shockSpring = new THREE.Mesh(
      new THREE.CylinderGeometry(0.042, 0.042, 0.26, 12),
      new THREE.MeshStandardMaterial({ color: '#eab308', roughness: 0.3, metalness: 0.4 })
    );
    shockSpring.position.set(0, 0.58, 0.22);
    shockSpring.rotation.x = 0.55;
    const chain = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.032, 0.68), mat.darkTrim);
    chain.position.set(-0.11, 0.36, 0.42);
    bike.add(shockSpring, chain);

    // Sculpted Clearcoat Fuel Tank + Side Fairings + Belly Pan + Split Stitched Leather Seat + Tail Cowl
    const tankShape = new THREE.Shape();
    tankShape.moveTo(-0.46, 0.74);
    tankShape.quadraticCurveTo(-0.28, 1.06, 0.05, 0.98);
    tankShape.lineTo(0.22, 0.78);
    tankShape.lineTo(-0.36, 0.68);
    tankShape.closePath();
    const gTankGeo = new THREE.ExtrudeGeometry(tankShape, {
      depth: 0.34,
      bevelEnabled: true,
      bevelSegments: 4,
      steps: 1,
      bevelSize: 0.05,
      bevelThickness: 0.05,
    });
    gTankGeo.translate(0, 0, -0.17);
    gTankGeo.rotateY(-Math.PI / 2);
    gTankGeo.computeVertexNormals();
    const fuelTank = new THREE.Mesh(gTankGeo, paintMat);
    fuelTank.castShadow = true;
    const fuelCap = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.015, 16), mat.chrome);
    fuelCap.position.set(0, 1.01, -0.22);
    bike.add(fuelTank, fuelCap);

    // Aerodynamic Side Fairing Cowls + Lower Belly Pan
    [-1, 1].forEach((side) => {
      const sideCowl = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.32, 0.58), paintMat);
      sideCowl.position.set(side * 0.21, 0.66, -0.34);
      sideCowl.rotation.y = side * 0.14;
      const belly = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.15, 0.62), mat.carbon);
      belly.position.set(side * 0.16, 0.28, -0.12);
      bike.add(sideCowl, belly);
    });

    // Split Rider & Passenger Leather Seat + Aggressive Superbike Tail Cowl + LED Brake Strip + Plate
    const riderSeat = new THREE.Mesh(new THREE.BoxGeometry(0.29, 0.08, 0.38), mat.leather);
    riderSeat.position.set(0, 0.78, 0.24);
    riderSeat.rotation.x = 0.08;
    const tailCowl = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.11, 0.44), paintMat);
    tailCowl.position.set(0, 0.89, 0.64);
    tailCowl.rotation.x = -0.24;
    const pillionPad = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.05, 0.26), mat.leather);
    pillionPad.position.set(0, 0.95, 0.62);
    pillionPad.rotation.x = -0.22;
    const tailLight = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, 0.055, 0.06),
      new THREE.MeshStandardMaterial({ color: '#ef4444', emissive: '#ef4444', emissiveIntensity: 1.2 })
    );
    tailLight.position.set(0, 0.91, 0.86);
    const tailHanger = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.22, 0.03), mat.darkTrim);
    tailHanger.position.set(0, 0.75, 0.9);
    tailHanger.rotation.x = 0.35;
    const plate = new THREE.Mesh(
      new THREE.PlaneGeometry(0.2, 0.11),
      new THREE.MeshBasicMaterial({ map: tex.plateMoto })
    );
    plate.position.set(0, 0.72, 0.95);
    bike.add(riderSeat, tailCowl, pillionPad, tailLight, tailHanger, plate);

    // Inverted Gold USD Front Forks, Nose Fairing, Twin Projector LED Headlights, Clip-Ons & Mirrors
    [-0.095, 0.095].forEach((fx) => {
      const upperFork = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.03, 0.56, 14), mat.goldAnodized);
      upperFork.rotation.x = -0.36;
      upperFork.position.set(fx, 0.78, -0.58);
      const lowerFork = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.022, 0.42, 12), mat.chrome);
      lowerFork.rotation.x = -0.36;
      lowerFork.position.set(fx, 0.48, -0.68);
      bike.add(upperFork, lowerFork);
    });

    const frontFender = new THREE.Mesh(
      new THREE.CylinderGeometry(0.35, 0.35, 0.15, 18, 1, false, -0.55, 1.1),
      mat.carbon
    );
    frontFender.rotation.z = Math.PI / 2;
    frontFender.position.set(0, 0.34, -0.74);

    const noseCowl = new THREE.Mesh(new THREE.SphereGeometry(0.22, 18, 14), paintMat);
    noseCowl.scale.set(0.95, 0.76, 1.22);
    noseCowl.position.set(0, 0.92, -0.66);

    const screen = new THREE.Mesh(
      new THREE.SphereGeometry(0.19, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.46),
      mat.glassTinted
    );
    screen.position.set(0, 1.03, -0.6);
    screen.rotation.x = -0.52;

    [-0.095, 0.095].forEach((hx) => {
      const headlight = new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 10), mat.headlightGlass);
      headlight.position.set(hx, 0.91, -0.88);
      bike.add(headlight);
    });

    const clipBar = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.68, 12), mat.chrome);
    clipBar.rotation.z = Math.PI / 2;
    clipBar.position.set(0, 1.02, -0.46);
    [-0.27, 0.27].forEach((gx) => {
      const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.021, 0.021, 0.13, 12), mat.matteRubber);
      grip.rotation.z = Math.PI / 2;
      grip.position.set(gx, 1.02, -0.46);
      const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.16, 8), mat.darkTrim);
      stalk.position.set(gx * 0.85, 1.11, -0.56);
      stalk.rotation.z = gx > 0 ? -0.4 : 0.4;
      const mirror = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.055, 0.024), mat.carbon);
      mirror.position.set(gx * 1.05, 1.18, -0.57);
      bike.add(grip, stalk, mirror);
    });
    bike.add(frontFender, noseCowl, screen, clipBar);

    return bike;
  }

  window.BendskinRealism3D = {
    initAssets,
    setAnisotropy,
    createRealSkyDomeShaderMat,
    buildRealEnvironmentMap,
    createRealRoadInfrastructure,
    buildRealCockpit,
    createRealEntityMesh,
    createRealPropMesh,
    buildRealGarageMotorcycle,
  };
})();
