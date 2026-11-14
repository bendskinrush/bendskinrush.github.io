(() => {
  'use strict';

  // =========================================================
  // 1. Virtual Coordinate System & 2.5D First-Person Constants
  // =========================================================
  const LOGICAL_WIDTH = 400;
  let logicalHeight = 711;

  const PERSPECTIVE = {
    HORIZON_RATIO: 0.35,
    BOTTOM_RATIO: 0.96,
    HORIZON_LANE_WIDTH: 15,
    BOTTOM_LANE_WIDTH: 125,
    DEPTH_CURVE: 1.55,
    MIN_SCALE: 0.15,
    CAMERA_PARALLAX: 80,
    HANDLEBAR_SWAY: 45,
  };

  const SPEED_CURVE = {
    LAUNCH_KMH: 60,
    MANUAL_LAUNCH_KMH: 40,
    MAX_KMH: 205,
    AUTO_TOP_KMH: 168,
    NITRO_BONUS_KMH: 36,
  };

  const POWERUPS = {
    FUEL_DURATION: 5.5,
    SHIELD_DURATION: 7.0,
    MAGNET_DURATION: 8.0,
  };

  const WORLD_SPACE = {
    VIEW_DISTANCE_METERS: 110,
    PLAYER_PLANE_Z: 0.92,
    ROAD_SEGMENT_METERS: 6,
    KMH_TO_MPS: 1 / 3.2,
  };

  const STEERING = {
    SWIPE_THRESHOLD_PX: 25,
    LANE_LERP_RATE: 18,
    LEAN_LERP_RATE: 14,
    MAX_HANDLEBAR_RAD: (15 * Math.PI) / 180,
    MAX_WORLD_ROLL_RAD: (4 * Math.PI) / 180,
  };

  const COLLISION = {
    DANGER_MIN_Z: 0.87,
    DANGER_MAX_Z: 0.97,
    NEAR_MISS_MIN_Z: 0.77,
    NEAR_MISS_MAX_Z: 0.90,
    COLLECT_MIN_Z: 0.81,
    COLLECT_MAX_Z: 0.99,
    AABB_SHRINK: 0.82,
    BIKE_HALF_WIDTH: 21,
    VEHICLE_BUMP_MAX_KMH: 85,
  };

  const COMBO = {
    DURATION_SEC: 5.5,
    BASE_BONUS_METERS: 50,
  };

  const GRAPHICS_QUALITIES = ['low', 'normal', 'high', 'ultra'];

  const GRAPHICS_DESCRIPTIONS = {
    low: 'Low quality active: classic 2.5D shaded vehicles and smooth road lighting with balanced battery use.',
    normal: 'Normal quality active: perspective-extruded 3D vehicles, raised curbs & buildings, headbeams & mirrors.',
    high: 'High HD 3D Engine: real-time Three.js WebGL 3D highway, detailed traffic, shadows & full armored gloves.',
    ultra: 'Ultra HD 720p+ Engine: crisp 720p+ supersampled 3D cockpit, visible rider fingers & twin digital/analog dashboard.',
  };

  // Uniform metadata table: stationary hazards stay at speedKmh: 0 (world-locked),
  // traffic moves forward at constant world speeds so braking always lets cars pull ahead.
  const ENTITY_CONFIG = {
    pothole: {
      kind: 'hazard',
      isVehicle: false,
      speedKmh: 0,
      width: 64,
      height: 24,
      laneHalfSpan: 0.28,
      rattleSpan: 0.48,
    },
    barrier: {
      kind: 'hazard',
      isVehicle: false,
      speedKmh: 0,
      width: 86,
      height: 46,
      laneHalfSpan: 0.34,
    },
    timber_log: {
      kind: 'hazard',
      isVehicle: false,
      speedKmh: 0,
      width: 86,
      height: 32,
      laneHalfSpan: 0.34,
    },
    yellow_taxi: {
      kind: 'hazard',
      isVehicle: true,
      speedKmh: 54,
      width: 78,
      height: 66,
      laneHalfSpan: 0.34,
    },
    timber_truck: {
      kind: 'hazard',
      isVehicle: true,
      speedKmh: 46,
      width: 92,
      height: 108,
      laneHalfSpan: 0.36,
    },
    clando_van: {
      kind: 'hazard',
      isVehicle: true,
      speedKmh: 60,
      width: 82,
      height: 82,
      laneHalfSpan: 0.34,
    },
    rival_moto: {
      kind: 'hazard',
      isVehicle: true,
      speedKmh: 68,
      width: 52,
      height: 64,
      laneHalfSpan: 0.28,
    },
    fuel_can: {
      kind: 'collectible',
      isVehicle: false,
      speedKmh: 0,
      width: 34,
      height: 40,
      coins: 0,
      label: 'NITRO SPEED BOOST!',
      color: '#f97316',
    },
    shield: {
      kind: 'collectible',
      isVehicle: false,
      speedKmh: 0,
      width: 36,
      height: 38,
      coins: 0,
      label: 'IMMUNITY SHIELD!',
      color: '#38bdf8',
    },
    magnet: {
      kind: 'collectible',
      isVehicle: false,
      speedKmh: 0,
      width: 36,
      height: 36,
      coins: 0,
      label: 'COIN MAGNET!',
      color: '#fb7185',
    },
    coin: {
      kind: 'collectible',
      isVehicle: false,
      speedKmh: 0,
      width: 32,
      height: 32,
      coins: 10,
      label: '+10 COINS!',
      color: '#facc15',
    },
  };

  const HAZARD_TYPES = [
    'barrier',
    'timber_log',
    'yellow_taxi',
    'timber_truck',
    'clando_van',
    'rival_moto',
  ];
  const COLLECTIBLE_TYPES = ['coin', 'fuel_can', 'shield', 'magnet'];

  const GAME_STATE = {
    START: 'START',
    PLAYING: 'PLAYING',
    PAUSED: 'PAUSED',
    GAMEOVER: 'GAMEOVER',
  };

  const STORAGE_BEST_KEY = 'bendskin_rush_best_meters_v1';
  const STORAGE_PROFILE_KEY = 'bendskin_rush_profile_v2';
  const STORAGE_LEADERBOARD_KEY = 'bendskin_rush_leaderboard_v2_real';
  const STORAGE_SETTINGS_KEY = 'bendskin_rush_settings_v2';
  const STORAGE_COINS_KEY = 'bendskin_rush_coins_v1';
  const STORAGE_COINS_MAP_KEY = 'bendskin_rush_coins_by_account_v2';
  const STORAGE_BEST_MAP_KEY = 'bendskin_rush_best_by_account_v2';
  const STORAGE_GUEST_ID_KEY = 'bendskin_rush_guest_id_v2';
  const STORAGE_MIGRATED_V2_KEY = 'bendskin_rush_account_isolation_v2';
  const ADSENSE_BACKGROUND_PUB_ID = 'ca-pub-4032050439057511';

  const API_ORIGIN =
    window.location.hostname.endsWith('.workers.dev') ||
    window.location.hostname === '127.0.0.1' ||
    window.location.hostname === 'localhost'
      ? ''
      : 'https://bendskin-rush.bendskin-rush.workers.dev';

  const API_ENDPOINTS = {
    leaderboard: `${API_ORIGIN}/api/leaderboard`,
    signup: `${API_ORIGIN}/api/auth/signup`,
    login: `${API_ORIGIN}/api/auth/login`,
    coins: `${API_ORIGIN}/api/account/coins`,
  };

  const CAMEROON_CITIES = [
    'Douala',
    'Yaoundé',
    'Bamenda',
    'Buea',
    'Bafoussam',
    'Limbe',
    'Kribi',
    'Kumba',
    'Garoua',
    'Maroua',
    'Ngaoundéré',
    'Bertoua',
    'Ebolowa',
  ];

  const INTERNATIONAL_LOCATIONS = [
    'Nigeria',
    'Ghana',
    'Ivory Coast',
    'Senegal',
    'France',
    'UK',
    'Germany',
    'USA',
    'Canada',
  ];

  const SUPPORTED_LOCATIONS = [...CAMEROON_CITIES, ...INTERNATIONAL_LOCATIONS];

  const ANTI_CHEAT = {
    MAX_THEORETICAL_SCORE: 100000,
    MAX_RATE_METERS_PER_SEC: 360,
    BONUS_BUFFER_METERS: 1500,
    MIN_RUN_SECONDS: 0.8,
    SALT: 'cmr_bendskin_237_rush_v1',
  };

  const PROFANITY_BLOCKLIST = [
    'fuck', 'shit', 'bitch', 'asshole', 'bastard', 'dick', 'pussy',
    'cunt', 'whore', 'slut', 'nigger', 'nigga', 'faggot', 'retard',
    'porn', 'nazi', 'putain', 'merde', 'connard', 'salope', 'encule',
  ];

  // =========================================================
  // 2. DOM Elements
  // =========================================================
  const appContainer = document.getElementById('app-container');
  const canvas3d = document.getElementById('game-canvas-3d');
  const canvas = document.getElementById('game-canvas');
  const ctx = canvas.getContext('2d', { alpha: true });

  const hudScreen = document.getElementById('hud-screen');
  const startScreen = document.getElementById('start-screen');
  const gamingLogoWordmark = document.getElementById('gaming-logo-wordmark');
  const gameoverScreen = document.getElementById('gameover-screen');
  const leaderboardModal = document.getElementById('leaderboard-modal');

  const hudScoreEl = document.getElementById('hud-score');
  const hudBestEl = document.getElementById('hud-best');
  const hudCoinsEl = document.getElementById('hud-coins');
  const hudPowerupsEl = document.getElementById('hud-powerups');
  const hudSpeedEl = document.getElementById('hud-speed');
  const hudGearBadgeEl = document.getElementById('hud-gear-badge');
  const hudQualityBadgeEl = document.getElementById('hud-quality-badge');
  const hudFpsEl = document.getElementById('hud-fps');
  const btnHudTilt = document.getElementById('btn-hud-tilt');
  const hudHintPillEl = document.getElementById('hud-hint-pill');
  const hudComboBadgeEl = document.getElementById('hud-combo-badge');
  const hudComboTextEl = document.getElementById('hud-combo-text');
  const hudComboFillEl = document.getElementById('hud-combo-fill');
  const hudPedalsEl = document.getElementById('hud-pedals');
  const hudSteerClusterEl = document.getElementById('hud-steer-cluster');
  const btnSteerLeft = document.getElementById('btn-steer-left');
  const btnSteerRight = document.getElementById('btn-steer-right');
  const btnHornEl = document.getElementById('btn-horn');
  const pedalBrakeEl = document.getElementById('pedal-brake');
  const pedalGasEl = document.getElementById('pedal-gas');

  const finalScoreEl = document.getElementById('final-score');
  const finalBestEl = document.getElementById('final-best');
  const cityRankEl = document.getElementById('city-rank');

  const onboardingCard = document.getElementById('onboarding-card');
  const onboardingRankTitle = document.getElementById('onboarding-rank-title');
  const inputNickname = document.getElementById('input-nickname');
  const selectCity = document.getElementById('select-city');
  const onboardingCustomCity = document.getElementById('onboarding-custom-city');
  const btnSaveProfile = document.getElementById('btn-save-profile');
  const onboardingFeedback = document.getElementById('onboarding-feedback');
  const playerTagBar = document.getElementById('player-tag-bar');
  const playerTagLabel = document.getElementById('player-tag-label');
  const cloudSyncStatus = document.getElementById('cloud-sync-status');
  const btnEditProfile = document.getElementById('btn-edit-profile');
  const btnGameoverAccount = document.getElementById('btn-gameover-account');

  const homeCoinBankEl = document.getElementById('home-coin-bank');
  const homeAccountBadge = document.getElementById('home-account-badge');
  const homeAccountName = document.getElementById('home-account-name');
  const homeAccountLocation = document.getElementById('home-account-location');
  const btnOpenAccount = document.getElementById('btn-open-account');
  const btnOpenGarage = document.getElementById('btn-open-garage');
  const garageModal = document.getElementById('garage-modal');
  const btnCloseGarage = document.getElementById('btn-close-garage');
  const garageCoinBalanceEl = document.getElementById('garage-coin-balance');
  const garageBikeCanvas = document.getElementById('garage-bike-canvas');
  const garagePreviewName = document.getElementById('garage-preview-name');
  const garagePreviewSpecs = document.getElementById('garage-preview-specs');
  const garageBikeCards = document.querySelectorAll('.garage-bike-card');

  const accountModal = document.getElementById('account-modal');
  const btnCloseAccount = document.getElementById('btn-close-account');
  const tabAuthSignup = document.getElementById('tab-auth-signup');
  const tabAuthLogin = document.getElementById('tab-auth-login');
  const tabAuthGuest = document.getElementById('tab-auth-guest');
  const accountModeSubtitle = document.getElementById('account-mode-subtitle');
  const accountUsernameGroup = document.getElementById('account-username-group');
  const accountUsername = document.getElementById('account-username');
  const accountPasswordGroup = document.getElementById('account-password-group');
  const accountPassword = document.getElementById('account-password');
  const accountLocationGroup = document.getElementById('account-location-group');
  const accountLocation = document.getElementById('account-location');
  const accountCustomLocationGroup = document.getElementById('account-custom-location-group');
  const accountCustomLocation = document.getElementById('account-custom-location');
  const accountStatusMsg = document.getElementById('account-status-msg');
  const btnAccountSubmit = document.getElementById('btn-account-submit');
  const btnAccountQuickGuest = document.getElementById('btn-account-quick-guest');

  const btnStart = document.getElementById('btn-start');
  const btnRestart = document.getElementById('btn-restart');
  const btnReviveAd = document.getElementById('btn-revive-ad');
  const btnPause = document.getElementById('btn-pause');
  const btnSound = document.getElementById('btn-sound');
  const btnHudSettings = document.getElementById('btn-hud-settings');
  const btnTestGameover = document.getElementById('btn-test-gameover');
  const btnOpenLeaderboard = document.getElementById('btn-open-leaderboard');
  const btnOpenSettings = document.getElementById('btn-open-settings');
  const btnOpenAbout = document.getElementById('btn-open-about');
  const btnGameoverHome = document.getElementById('btn-gameover-home');
  const btnGameoverSettings = document.getElementById('btn-gameover-settings');
  const btnGameoverLeaderboard = document.getElementById('btn-gameover-leaderboard');
  const btnCloseLeaderboard = document.getElementById('btn-close-leaderboard');
  const btnWhatsapp = document.getElementById('btn-whatsapp');
  const btnCopyLink = document.getElementById('btn-copy-link');
  const copyToastEl = document.getElementById('copy-toast');
  const hudRivalPill = document.getElementById('hud-rival-pill');
  const rivalStartBanner = document.getElementById('rival-start-banner');
  const rivalGameoverBanner = document.getElementById('rival-gameover-banner');
  const tabTopRiders = document.getElementById('tab-top-riders');
  const tabCityWar = document.getElementById('tab-city-war');
  const cityFilterRow = document.getElementById('city-filter-row');
  const leaderboardListEl = document.getElementById('leaderboard-list');
  const modalFootnoteEl = document.getElementById('modal-footnote');

  const pauseModal = document.getElementById('pause-modal');
  const btnClosePause = document.getElementById('btn-close-pause');
  const btnResume = document.getElementById('btn-resume');
  const btnPauseSettings = document.getElementById('btn-pause-settings');
  const btnPauseRestart = document.getElementById('btn-pause-restart');
  const btnPauseHome = document.getElementById('btn-pause-home');
  const pauseDistanceEl = document.getElementById('pause-distance');
  const pauseBestEl = document.getElementById('pause-best');
  const pauseComboEl = document.getElementById('pause-combo');

  const settingsModal = document.getElementById('settings-modal');
  const btnCloseSettings = document.getElementById('btn-close-settings');
  const btnSaveSettings = document.getElementById('btn-save-settings');
  const btnModeAuto = document.getElementById('btn-mode-auto');
  const btnModeManual = document.getElementById('btn-mode-manual');
  const driveModeDesc = document.getElementById('drive-mode-desc');
  const btnHandRight = document.getElementById('btn-hand-right');
  const btnHandLeft = document.getElementById('btn-hand-left');
  const handLayoutDesc = document.getElementById('hand-layout-desc');
  const btnTiltToggle = document.getElementById('btn-tilt-toggle');
  const btnTiltCalibrate = document.getElementById('btn-tilt-calibrate');
  const tiltStatusBadge = document.getElementById('tilt-status-badge');
  const tiltDesc = document.getElementById('tilt-desc');
  const qualityButtons = document.querySelectorAll('[data-quality]');
  const graphicsQualityDesc = document.getElementById('graphics-quality-desc');
  const sliderSensitivity = document.getElementById('slider-sensitivity');
  const sensitivityValueEl = document.getElementById('sensitivity-value');
  const btnSettingsSound = document.getElementById('btn-settings-sound');
  const adSlotHome = document.getElementById('ad-slot-home');
  const adSlotGameover = document.getElementById('ad-slot-gameover');

  const aboutModal = document.getElementById('about-modal');
  const btnCloseAbout = document.getElementById('btn-close-about');
  const aboutTabs = document.querySelectorAll('.about-tab');
  const aboutPanels = document.querySelectorAll('.about-panel');
  const policyLinks = document.querySelectorAll('.policy-link');

  const rivalChallenge = {
    active: false,
    rivalName: '',
    rivalCity: 'Cameroon',
    targetMeters: 0,
    defeatedThisRun: false
  };
  let copyToastTimeoutId = null;

  function sanitizeParamText(value, fallback, maxLen) {
    if (typeof value !== 'string') return fallback;
    const cleaned = value.replace(/[\r\n\t<>]/g, ' ').replace(/\s+/g, ' ').trim();
    if (!cleaned) return fallback;
    return cleaned.slice(0, maxLen);
  }

  function parseRivalChallengeFromUrl() {
    try {
      const params = new URLSearchParams(window.location.search);
      const rawRival = params.get('rival');
      const rawTarget = params.get('target');
      const rawCity = params.get('city');
      const parsedTarget = Math.floor(Number(rawTarget));

      if (rawRival && Number.isFinite(parsedTarget) && parsedTarget > 0) {
        rivalChallenge.active = true;
        rivalChallenge.rivalName = sanitizeParamText(rawRival, 'Rival', 18);
        rivalChallenge.rivalCity = sanitizeParamText(rawCity, 'Cameroon', 20);
        rivalChallenge.targetMeters = Math.min(parsedTarget, 999999);
        rivalChallenge.defeatedThisRun = false;

        if (rivalStartBanner) {
          rivalStartBanner.textContent = `CHALLENGE: ${rivalChallenge.rivalName} (${rivalChallenge.rivalCity}) dared you to beat ${rivalChallenge.targetMeters.toLocaleString()}m!`;
          rivalStartBanner.classList.remove('hidden');
        }
        if (hudRivalPill) {
          hudRivalPill.textContent = `RIVAL: ${rivalChallenge.targetMeters.toLocaleString()}m`;
          hudRivalPill.classList.remove('hidden', 'defeated');
        }
        return;
      }
    } catch (_err) {
      // Ignore malformed query string
    }
    rivalChallenge.active = false;
    if (rivalStartBanner) rivalStartBanner.classList.add('hidden');
    if (hudRivalPill) hudRivalPill.classList.add('hidden');
  }

  // =========================================================
  // 3. Zero-Download Web Audio API Synthesizer
  // =========================================================
  function createSoundController() {
    let audioCtx = null;
    let engineOsc = null;
    let engineSubOsc = null;
    let engineFilter = null;
    let engineGain = null;
    let noiseBuffer = null;
    let muted = false;

    function ensureContext() {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return null;
      if (!audioCtx) {
        audioCtx = new AudioCtx();
        buildNoiseBuffer();
        setupEngineNodes();
      }
      if (audioCtx.state === 'suspended') {
        audioCtx.resume().catch(() => {});
      }
      return audioCtx;
    }

    function buildNoiseBuffer() {
      if (!audioCtx || noiseBuffer) return;
      const sampleRate = audioCtx.sampleRate;
      const len = Math.floor(sampleRate * 0.4);
      noiseBuffer = audioCtx.createBuffer(1, len, sampleRate);
      const data = noiseBuffer.getChannelData(0);
      for (let i = 0; i < len; i += 1) {
        data[i] = Math.random() * 2 - 1;
      }
    }

    function setupEngineNodes() {
      if (!audioCtx || engineOsc) return;
      engineOsc = audioCtx.createOscillator();
      engineSubOsc = audioCtx.createOscillator();
      engineFilter = audioCtx.createBiquadFilter();
      engineGain = audioCtx.createGain();

      engineOsc.type = 'sawtooth';
      engineSubOsc.type = 'triangle';
      engineOsc.frequency.value = 52;
      engineSubOsc.frequency.value = 26;

      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 180;
      engineFilter.Q.value = 2.2;

      engineGain.gain.value = 0;

      engineOsc.connect(engineFilter);
      engineSubOsc.connect(engineFilter);
      engineFilter.connect(engineGain);
      engineGain.connect(audioCtx.destination);

      engineOsc.start();
      engineSubOsc.start();
    }

    function unlock() {
      try {
        ensureContext();
      } catch {
        // Ignore restricted audio environments
      }
    }

    function updateEngine(kmh, active) {
      if (!audioCtx || !engineGain || !engineOsc || !engineSubOsc || !engineFilter) return;
      try {
        const now = audioCtx.currentTime;
        if (!active || muted || audioCtx.state !== 'running') {
          engineGain.gain.setTargetAtTime(0, now, 0.05);
          return;
        }
        const ratio = Math.max(0, Math.min(1, kmh / SPEED_CURVE.MAX_KMH));
        const baseFreq = 38 + ratio * 105;
        engineOsc.frequency.setTargetAtTime(baseFreq, now, 0.06);
        engineSubOsc.frequency.setTargetAtTime(baseFreq * 0.5, now, 0.06);
        engineFilter.frequency.setTargetAtTime(140 + ratio * 420, now, 0.08);
        engineGain.gain.setTargetAtTime(0.032 + ratio * 0.026, now, 0.06);
      } catch {
        // No-op
      }
    }

    function playTone(freqStart, freqEnd, duration, type, volume, delay = 0) {
      if (muted) return;
      try {
        const ctxAudio = ensureContext();
        if (!ctxAudio) return;
        const start = ctxAudio.currentTime + delay;
        const osc = ctxAudio.createOscillator();
        const gain = ctxAudio.createGain();

        osc.type = type;
        osc.frequency.setValueAtTime(freqStart, start);
        if (freqEnd !== freqStart) {
          osc.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), start + duration);
        }

        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.linearRampToValueAtTime(volume, start + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

        osc.connect(gain);
        gain.connect(ctxAudio.destination);
        osc.start(start);
        osc.stop(start + duration + 0.02);
      } catch {
        // No-op
      }
    }

    function playSwoosh() {
      if (muted) return;
      try {
        const ctxAudio = ensureContext();
        if (!ctxAudio || !noiseBuffer) return;
        const now = ctxAudio.currentTime;
        const src = ctxAudio.createBufferSource();
        src.buffer = noiseBuffer;

        const filter = ctxAudio.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(950, now);
        filter.frequency.exponentialRampToValueAtTime(2200, now + 0.11);
        filter.Q.value = 1.6;

        const gain = ctxAudio.createGain();
        gain.gain.setValueAtTime(0.001, now);
        gain.gain.linearRampToValueAtTime(0.09, now + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);

        src.connect(filter);
        filter.connect(gain);
        gain.connect(ctxAudio.destination);
        src.start(now);
        src.stop(now + 0.13);
      } catch {
        // No-op
      }
    }

    function playNearMiss(multiplier, withHorn) {
      const pitchBoost = 1 + (multiplier - 1) * 0.14;
      playTone(520 * pitchBoost, 860 * pitchBoost, 0.12, 'triangle', 0.12, 0);
      playTone(780 * pitchBoost, 1180 * pitchBoost, 0.14, 'sine', 0.11, 0.07);

      if (withHorn) {
        // Quick Cameroonian yellow-taxi beep-beep
        playTone(440, 435, 0.06, 'sawtooth', 0.045, 0.04);
        playTone(554, 548, 0.06, 'sawtooth', 0.038, 0.04);
        playTone(440, 435, 0.07, 'sawtooth', 0.045, 0.13);
        playTone(554, 548, 0.07, 'sawtooth', 0.038, 0.13);
      }
    }

    function playCollect() {
      playTone(587, 587, 0.07, 'sine', 0.11, 0);
      playTone(880, 940, 0.13, 'triangle', 0.12, 0.06);
    }

    function playNewRecord() {
      playTone(523, 523, 0.09, 'triangle', 0.13, 0);
      playTone(659, 659, 0.09, 'triangle', 0.13, 0.08);
      playTone(784, 1046, 0.22, 'triangle', 0.15, 0.16);
    }

    function playHooYeahCelebration() {
      if (muted) return;
      // Triumphant brass fanfare + vocal-style "Hoo Yeah!" formant sweep
      playTone(523.25, 587.33, 0.11, 'triangle', 0.15, 0);
      playTone(659.25, 783.99, 0.13, 'triangle', 0.16, 0.09);
      playTone(783.99, 1046.5, 0.18, 'sawtooth', 0.12, 0.19);
      playTone(1046.5, 1318.5, 0.26, 'triangle', 0.16, 0.30);
      // Formant "Hoo!" (low -> high) + "Yeah!" (bright chord)
      playTone(260, 440, 0.16, 'sine', 0.14, 0.02);
      playTone(392, 587, 0.28, 'triangle', 0.15, 0.20);
      try {
        if ('speechSynthesis' in window && typeof window.SpeechSynthesisUtterance === 'function') {
          window.speechSynthesis.cancel();
          const utter = new window.SpeechSynthesisUtterance('Hoo yeah! New high score!');
          utter.rate = 1.18;
          utter.pitch = 1.25;
          utter.volume = 0.85;
          window.speechSynthesis.speak(utter);
        }
      } catch {
        // Ignore speech synthesis restrictions
      }
    }

    function playRattle() {
      playTone(105, 48, 0.14, 'sawtooth', 0.11, 0);
    }

    function playBump() {
      playTone(175, 72, 0.16, 'sawtooth', 0.16, 0);
      playTone(390, 355, 0.08, 'triangle', 0.09, 0.05);
    }

    function playCrash() {
      playTone(140, 26, 0.26, 'sawtooth', 0.22, 0);
      try {
        if (muted) return;
        const ctxAudio = ensureContext();
        if (!ctxAudio || !noiseBuffer) return;
        const now = ctxAudio.currentTime;
        const src = ctxAudio.createBufferSource();
        src.buffer = noiseBuffer;

        const filter = ctxAudio.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(750, now);
        filter.frequency.exponentialRampToValueAtTime(120, now + 0.24);

        const gain = ctxAudio.createGain();
        gain.gain.setValueAtTime(0.18, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.26);

        src.connect(filter);
        filter.connect(gain);
        gain.connect(ctxAudio.destination);
        src.start(now);
        src.stop(now + 0.28);
      } catch {
        // No-op
      }
    }

    let activeHornNodes = null;

    function stopContinuousHorn() {
      if (!activeHornNodes) return;
      const nodes = activeHornNodes;
      activeHornNodes = null;
      try {
        const ctxAudio = ensureContext();
        const now = ctxAudio ? ctxAudio.currentTime : 0;
        if (nodes.gain && ctxAudio) {
          nodes.gain.gain.cancelScheduledValues(now);
          nodes.gain.gain.setValueAtTime(Math.max(0.0001, nodes.gain.gain.value || 0.08), now);
          nodes.gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.05);
        }
        window.setTimeout(() => {
          [nodes.oscA, nodes.oscB].forEach((osc) => {
            if (!osc) return;
            try {
              osc.stop();
              osc.disconnect();
            } catch {
              // Already stopped
            }
          });
          if (nodes.filter) {
            try { nodes.filter.disconnect(); } catch {}
          }
          if (nodes.gain) {
            try { nodes.gain.disconnect(); } catch {}
          }
        }, 70);
      } catch {
        // No-op
      }
    }

    function startContinuousHorn() {
      if (muted) return;
      unlock();
      if (activeHornNodes) return;
      try {
        const ctxAudio = ensureContext();
        if (!ctxAudio) return;
        const now = ctxAudio.currentTime;
        const oscA = ctxAudio.createOscillator();
        const oscB = ctxAudio.createOscillator();
        const filter = ctxAudio.createBiquadFilter();
        const gain = ctxAudio.createGain();

        oscA.type = 'sawtooth';
        oscA.frequency.setValueAtTime(482, now);
        oscB.type = 'square';
        oscB.frequency.setValueAtTime(612, now);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(2100, now);

        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.linearRampToValueAtTime(0.11, now + 0.035);

        oscA.connect(filter);
        oscB.connect(filter);
        filter.connect(gain);
        gain.connect(ctxAudio.destination);

        oscA.start(now);
        oscB.start(now);
        activeHornNodes = { oscA, oscB, filter, gain };
      } catch {
        activeHornNodes = null;
      }
    }

    function playHorn() {
      if (muted) return;
      unlock();
      // Punchy dual-tone bendskin moto horn ("BEEP-BEEP!")
      playTone(490, 485, 0.08, 'sawtooth', 0.11, 0);
      playTone(620, 614, 0.08, 'square', 0.06, 0);
      playTone(490, 482, 0.12, 'sawtooth', 0.12, 0.11);
      playTone(620, 610, 0.12, 'square', 0.07, 0.11);
    }

    function setMuted(nextMuted) {
      muted = Boolean(nextMuted);
      if (muted) {
        stopContinuousHorn();
      } else {
        unlock();
      }
      return muted;
    }

    function toggleMute() {
      return setMuted(!muted);
    }

    return {
      unlock,
      updateEngine,
      playSwoosh,
      playNearMiss,
      playCollect,
      playNewRecord,
      playHooYeahCelebration,
      playRattle,
      playBump,
      playCrash,
      playHorn,
      startContinuousHorn,
      stopContinuousHorn,
      setMuted,
      toggleMute,
      isMuted: () => muted,
    };
  }

  const sound = createSoundController();

  // =========================================================
  // 4. Anti-Cheat, Player Profile & Cloud/Local Leaderboard Service
  // =========================================================
  function createLeaderboardService() {
    // Purge legacy pre-seeded v1 board so only real player scores appear
    try {
      localStorage.removeItem('bendskin_rush_leaderboard_v1');
    } catch {
      // Ignore storage cleanup errors
    }

    function generatePlayerId() {
      let hex = '';
      for (let i = 0; i < 8; i += 1) {
        hex += Math.floor(Math.random() * 16).toString(16);
      }
      return `usr_${hex}`;
    }

    function sanitizeLocation(rawLocation) {
      const cleaned = String(rawLocation || '')
        .replace(/[\r\n\t<>]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 20);
      if (cleaned.length < 2) {
        return { valid: false, location: cleaned, reason: 'Location must be 2–20 characters.' };
      }
      const lower = cleaned.toLowerCase();
      const hasProfanity = PROFANITY_BLOCKLIST.some((word) => lower.includes(word));
      if (hasProfanity) {
        return { valid: false, location: cleaned, reason: 'Please choose a clean location name.' };
      }
      return { valid: true, location: cleaned };
    }

    function loadProfile() {
      try {
        const raw = localStorage.getItem(STORAGE_PROFILE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed.playerId === 'string') {
            const locCheck = sanitizeLocation(parsed.city);
            return {
              playerId: parsed.playerId,
              nickname: typeof parsed.nickname === 'string' ? parsed.nickname : '',
              city: locCheck.valid ? locCheck.location : 'Douala',
              accountType: parsed.accountType === 'registered' ? 'registered' : 'guest',
              configured: Boolean(parsed.configured),
            };
          }
        }
      } catch {
        // Ignore parse errors
      }
      const fresh = {
        playerId: generatePlayerId(),
        nickname: '',
        city: 'Douala',
        accountType: 'guest',
        configured: false,
      };
      saveProfile(fresh);
      return fresh;
    }

    function saveProfile(profile) {
      try {
        localStorage.setItem(STORAGE_PROFILE_KEY, JSON.stringify(profile));
      } catch {
        // Ignore storage errors
      }
    }

    function loadBoard() {
      try {
        const raw = localStorage.getItem(STORAGE_LEADERBOARD_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            return parsed;
          }
        }
      } catch {
        // Ignore parse errors
      }
      return [];
    }

    function saveBoard(entries) {
      try {
        localStorage.setItem(STORAGE_LEADERBOARD_KEY, JSON.stringify(Array.isArray(entries) ? entries : []));
      } catch {
        // Ignore storage errors
      }
    }

    function sanitizeAndValidateNickname(rawName) {
      const cleaned = String(rawName || '')
        .trim()
        .replace(/\s+/g, ' ');
      if (!/^[A-Za-z0-9_ -]{2,15}$/.test(cleaned)) {
        return {
          valid: false,
          nickname: cleaned,
          reason: 'Username must be 2–15 letters, numbers, spaces, _ or -.',
        };
      }

      const normalized = cleaned
        .toLowerCase()
        .replace(/0/g, 'o')
        .replace(/1/g, 'i')
        .replace(/3/g, 'e')
        .replace(/4/g, 'a')
        .replace(/5/g, 's')
        .replace(/\$/g, 's')
        .replace(/@/g, 'a')
        .replace(/[\s_-]+/g, '');

      const hasProfanity = PROFANITY_BLOCKLIST.some((word) => normalized.includes(word));
      if (hasProfanity) {
        return {
          valid: false,
          nickname: cleaned,
          reason: 'Please choose a clean rider name.',
        };
      }

      return { valid: true, nickname: cleaned };
    }

    function computeRunSignature(payload) {
      const pid = String(payload.playerId || '');
      const score = Math.floor(Number(payload.highScore) || 0);
      const durTenths = Math.round((Number(payload.runDurationSeconds) || 0) * 10);
      const combo = Math.floor(Number(payload.maxCombo) || 1);
      const milestones = Math.floor(Number(payload.milestoneCount) || 0);
      const raw = `${ANTI_CHEAT.SALT}|${pid}|${score}|${durTenths}|${combo}|${milestones}`;

      let hash = 2166136261;
      for (let i = 0; i < raw.length; i += 1) {
        hash ^= raw.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
      }
      return `sig_${(hash >>> 0).toString(16).padStart(8, '0')}`;
    }

    function validateScoreSubmission(submission) {
      if (!submission || typeof submission !== 'object') {
        return { valid: false, reason: 'Invalid submission payload.' };
      }

      const pid = String(submission.playerId || '');
      if (!/^[A-Za-z0-9_-]{6,32}$/.test(pid)) {
        return { valid: false, reason: 'Invalid playerId.' };
      }

      const nickCheck = sanitizeAndValidateNickname(submission.nickname);
      if (!nickCheck.valid) {
        return { valid: false, reason: nickCheck.reason };
      }

      const locCheck = sanitizeLocation(submission.city);
      if (!locCheck.valid) {
        return { valid: false, reason: locCheck.reason };
      }

      const score = Number(submission.highScore);
      if (!Number.isInteger(score) || score < 1 || score > ANTI_CHEAT.MAX_THEORETICAL_SCORE) {
        return {
          valid: false,
          reason: `Score out of valid range (1–${ANTI_CHEAT.MAX_THEORETICAL_SCORE}).`,
        };
      }

      const duration = Number(submission.runDurationSeconds);
      if (!Number.isFinite(duration) || duration < ANTI_CHEAT.MIN_RUN_SECONDS) {
        return {
          valid: false,
          reason: `Run duration too short (${duration}s).`,
        };
      }

      const maxAllowed = Math.ceil(
        duration * ANTI_CHEAT.MAX_RATE_METERS_PER_SEC + ANTI_CHEAT.BONUS_BUFFER_METERS
      );
      if (score > maxAllowed) {
        return {
          valid: false,
          reason: `Physics anti-cheat rejected ${score}m in ${duration.toFixed(1)}s (max ${maxAllowed}m).`,
        };
      }

      const expectedSig = computeRunSignature(submission);
      if (submission.signature !== expectedSig) {
        return { valid: false, reason: 'Invalid run telemetry signature.' };
      }

      return { valid: true, nickname: nickCheck.nickname, city: locCheck.location };
    }

    function mergeBoardEntries(localEntries, remoteEntries) {
      const mergedMap = new Map();
      [...localEntries, ...remoteEntries].forEach((row) => {
        if (!row || !row.playerId || !row.nickname || !row.city) return;
        const prev = mergedMap.get(row.playerId);
        if (!prev || Number(row.highScore || 0) >= Number(prev.highScore || 0)) {
          mergedMap.set(row.playerId, row);
        }
      });
      return Array.from(mergedMap.values()).sort((a, b) => b.highScore - a.highScore);
    }

    async function pushToCloud(doc) {
      try {
        const res = await fetch(API_ENDPOINTS.leaderboard, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(doc),
        });
        if (!res.ok) return false;
        const data = await res.json();
        if (data && data.ok && Array.isArray(data.entries)) {
          saveBoard(data.entries);
          return true;
        }
        return Boolean(data && data.ok);
      } catch {
        return false;
      }
    }

    async function syncFromCloud() {
      try {
        const res = await fetch(API_ENDPOINTS.leaderboard, { method: 'GET', cache: 'no-store' });
        if (!res.ok) return false;
        const data = await res.json();
        if (!data || !data.ok || !Array.isArray(data.entries)) return false;
        const remote = data.entries;
        const local = loadBoard();
        const merged = remote.length > 0 ? mergeBoardEntries(local, remote) : local;
        saveBoard(merged);
        return true;
      } catch {
        return false;
      }
    }

    async function registerAccount({ username, password, location, playerId, highScore }) {
      const nickCheck = sanitizeAndValidateNickname(username);
      if (!nickCheck.valid) {
        return { ok: false, error: nickCheck.reason };
      }
      const cleanPass = String(password || '').trim();
      if (cleanPass.length < 4) {
        return { ok: false, error: 'PIN / Password must be at least 4 characters.' };
      }
      const locCheck = sanitizeLocation(location);
      if (!locCheck.valid) {
        return { ok: false, error: locCheck.reason };
      }

      try {
        const res = await fetch(API_ENDPOINTS.signup, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: nickCheck.nickname,
            password: cleanPass,
            city: locCheck.location,
            playerId: generatePlayerId(),
            highScore: Math.max(0, Math.floor(Number(highScore) || 0)),
            coins: 0,
          }),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok || !data || !data.ok) {
          return {
            ok: false,
            error: (data && data.error) || 'Could not create account right now.',
          };
        }
        if (Array.isArray(data.entries)) {
          saveBoard(data.entries);
        }
        return {
          ok: true,
          profile: data.profile,
          highScore: Number(data.highScore || 0),
          coins: Number(data.coins || 0),
        };
      } catch {
        return {
          ok: false,
          error: 'Network offline — use Guest Mode locally or check your connection.',
        };
      }
    }

    async function loginAccount({ username, password }) {
      const nickCheck = sanitizeAndValidateNickname(username);
      if (!nickCheck.valid) {
        return { ok: false, error: nickCheck.reason };
      }
      const cleanPass = String(password || '').trim();
      if (cleanPass.length < 4) {
        return { ok: false, error: 'Enter your 4+ char PIN / password.' };
      }

      try {
        const res = await fetch(API_ENDPOINTS.login, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: nickCheck.nickname,
            password: cleanPass,
          }),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok || !data || !data.ok) {
          return {
            ok: false,
            error: (data && data.error) || 'Invalid username or PIN/password.',
          };
        }
        if (Array.isArray(data.entries)) {
          saveBoard(data.entries);
        }
        return {
          ok: true,
          profile: data.profile,
          highScore: Number(data.highScore || 0),
          coins: Number(data.coins || 0),
        };
      } catch {
        return {
          ok: false,
          error: 'Network offline — cannot log in without internet.',
        };
      }
    }

    async function syncAccountCoins(profileObj, coinsValue) {
      if (!profileObj || profileObj.accountType !== 'registered' || !profileObj.nickname || !profileObj.playerId) {
        return;
      }
      try {
        await fetch(API_ENDPOINTS.coins, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: profileObj.nickname,
            playerId: profileObj.playerId,
            coins: Math.max(0, Math.floor(Number(coinsValue) || 0)),
          }),
        });
      } catch {
        // Offline tolerance; per-account map still preserves balance locally
      }
    }

    function submitScore(submission, options = { allowMetadataOnly: false }) {
      const validation = validateScoreSubmission(submission);
      if (!validation.valid) {
        return { accepted: false, updated: false, reason: validation.reason };
      }

      const board = loadBoard();
      const idx = board.findIndex((item) => item.playerId === submission.playerId);
      const existing = idx >= 0 ? board[idx] : null;
      const incomingScore = Math.floor(submission.highScore);
      const incomingCombo = Math.max(1, Math.floor(submission.maxCombo || 1));

      if (existing && incomingScore <= existing.highScore) {
        if (!options.allowMetadataOnly) {
          return {
            accepted: true,
            updated: false,
            reason: 'Score did not beat existing personal best; write skipped.',
            record: existing,
          };
        }
      }

      const nextRecord = {
        playerId: submission.playerId,
        nickname: validation.nickname,
        city: validation.city,
        accountType: submission.accountType === 'registered' ? 'registered' : 'guest',
        highScore: existing ? Math.max(existing.highScore, incomingScore) : incomingScore,
        maxCombo: existing ? Math.max(existing.maxCombo || 1, incomingCombo) : incomingCombo,
        runDurationSeconds: Number(submission.runDurationSeconds.toFixed(2)),
        signature: submission.signature,
        updatedAt: new Date().toISOString(),
      };

      if (idx >= 0) {
        board[idx] = nextRecord;
      } else {
        board.push(nextRecord);
      }

      board.sort((a, b) => b.highScore - a.highScore);
      saveBoard(board);
      pushToCloud(nextRecord);

      return {
        accepted: true,
        updated: true,
        reason: existing ? 'Personal best updated!' : 'Added to leaderboard!',
        record: nextRecord,
      };
    }

    function getTopRiders(cityFilter = 'All') {
      const board = loadBoard().sort((a, b) => b.highScore - a.highScore);
      const filtered =
        cityFilter === 'All' ? board : board.filter((entry) => entry.city === cityFilter);
      return filtered.slice(0, 50);
    }

    function getActiveLocations(myCity) {
      const board = loadBoard();
      const set = new Set();
      if (myCity) set.add(myCity);
      board.forEach((entry) => {
        if (entry && entry.city) set.add(entry.city);
      });
      return Array.from(set);
    }

    function getCityWarStandings(myCity) {
      const board = loadBoard();
      const grouped = new Map();

      board.forEach((entry) => {
        if (!entry || !entry.city) return;
        if (!grouped.has(entry.city)) {
          grouped.set(entry.city, []);
        }
        grouped.get(entry.city).push(entry);
      });

      const standings = [];
      grouped.forEach((riders, city) => {
        if (riders.length === 0) return;
        const sortedTop20 = riders
          .slice()
          .sort((a, b) => b.highScore - a.highScore)
          .slice(0, 20);
        const totalScore = sortedTop20.reduce((sum, r) => sum + r.highScore, 0);
        const avgScore = Math.round(totalScore / sortedTop20.length);
        standings.push({
          city,
          totalScore,
          avgScore,
          riderCount: riders.length,
          topRider: sortedTop20[0].nickname,
          isMyCity: city === myCity,
        });
      });

      standings.sort((a, b) => b.totalScore - a.totalScore);
      return standings;
    }

    function getPlayerRankSummary(playerId, score, city) {
      const board = loadBoard().sort((a, b) => b.highScore - a.highScore);
      const existingIdx = board.findIndex((entry) => entry.playerId === playerId);
      const effectiveScore =
        existingIdx >= 0 ? Math.max(board[existingIdx].highScore, score) : score;

      let nationalRank = 1;
      let cityRank = 1;
      let totalCityPlayers = 0;

      board.forEach((entry) => {
        if (entry.playerId === playerId) return;
        if (entry.highScore > effectiveScore) {
          nationalRank += 1;
          if (entry.city === city) {
            cityRank += 1;
          }
        }
        if (entry.city === city) {
          totalCityPlayers += 1;
        }
      });

      return {
        nationalRank,
        totalPlayers: board.length + (existingIdx >= 0 ? 0 : 1),
        cityRank,
        totalCityPlayers: totalCityPlayers + (existingIdx >= 0 && board[existingIdx].city === city ? 0 : 1),
        existingScore: existingIdx >= 0 ? board[existingIdx].highScore : 0,
      };
    }

    return {
      loadProfile,
      saveProfile,
      sanitizeLocation,
      sanitizeAndValidateNickname,
      computeRunSignature,
      validateScoreSubmission,
      submitScore,
      getTopRiders,
      getActiveLocations,
      getCityWarStandings,
      getPlayerRankSummary,
      syncFromFirestore: syncFromCloud,
      syncFromCloud,
      registerAccount,
      loginAccount,
      syncAccountCoins,
      generatePlayerId,
    };
  }

  const leaderboardService = createLeaderboardService();
  let playerProfile = leaderboardService.loadProfile();

  function getOrCreateGuestPlayerId() {
    try {
      if (playerProfile && playerProfile.accountType !== 'registered' && playerProfile.playerId) {
        localStorage.setItem(STORAGE_GUEST_ID_KEY, playerProfile.playerId);
        return playerProfile.playerId;
      }
      const saved = localStorage.getItem(STORAGE_GUEST_ID_KEY);
      if (saved && /^[A-Za-z0-9_-]{6,32}$/.test(saved)) {
        return saved;
      }
      const nextId = `gst_${leaderboardService.generatePlayerId().replace(/^u_/, '')}`;
      localStorage.setItem(STORAGE_GUEST_ID_KEY, nextId);
      return nextId;
    } catch {
      return `gst_${leaderboardService.generatePlayerId().replace(/^u_/, '')}`;
    }
  }

  if (playerProfile && playerProfile.accountType !== 'registered' && playerProfile.playerId) {
    try {
      if (!localStorage.getItem(STORAGE_GUEST_ID_KEY)) {
        localStorage.setItem(STORAGE_GUEST_ID_KEY, playerProfile.playerId);
      }
    } catch {
      // Ignore storage error
    }
  }

  // Expose validation & leaderboard helpers for inspection/anti-cheat verification
  window.BendskinLeaderboard = {
    validateScoreSubmission: leaderboardService.validateScoreSubmission,
    submitScore: leaderboardService.submitScore,
    getTopRiders: leaderboardService.getTopRiders,
    getCityWarStandings: () => leaderboardService.getCityWarStandings(playerProfile.city),
    computeRunSignature: leaderboardService.computeRunSignature,
    getProfile: () => ({ ...playerProfile }),
  };

  // =========================================================
  // 5. Runtime Game State, Graphics Tiers & AdSense Config
  // =========================================================
  const DEFAULT_SETTINGS = {
    driveMode: 'auto', // 'auto' | 'manual'
    controlHandedness: 'right', // 'right' (arrows L, pedals R) | 'left' (pedals L, arrows R)
    sensitivity: 1.0,  // 0.5 .. 2.0
    soundMuted: false,
    graphicsQuality: 'ultra', // 'low' | 'normal' | 'high' | 'ultra'
    tiltSteering: false,
    adsensePublisherId: 'ca-pub-4032050439057511',
  };

  function normalizeAdsenseId(raw) {
    const cleaned = String(raw || '').trim();
    if (/^pub-\d{16}$/.test(cleaned)) return `ca-${cleaned}`;
    if (/^ca-pub-\d{16}$/.test(cleaned)) return cleaned;
    return '';
  }

  function loadSettings() {
    try {
      const raw = localStorage.getItem(STORAGE_SETTINGS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          const sens = Number(parsed.sensitivity);
          const qual = GRAPHICS_QUALITIES.includes(parsed.graphicsQuality)
            ? parsed.graphicsQuality
            : 'ultra';
          return {
            driveMode: parsed.driveMode === 'manual' ? 'manual' : 'auto',
            controlHandedness: parsed.controlHandedness === 'left' ? 'left' : 'right',
            sensitivity: Number.isFinite(sens) ? Math.max(0.5, Math.min(2.0, sens)) : 1.0,
            soundMuted: Boolean(parsed.soundMuted),
            graphicsQuality: qual,
            tiltSteering: Boolean(parsed.tiltSteering),
            adsensePublisherId: normalizeAdsenseId(parsed.adsensePublisherId),
          };
        }
      }
    } catch {
      // Ignore storage errors
    }
    return { ...DEFAULT_SETTINGS };
  }

  function saveSettings(next) {
    try {
      localStorage.setItem(STORAGE_SETTINGS_KEY, JSON.stringify(next));
    } catch {
      // Ignore storage errors
    }
  }

  let userSettings = loadSettings();
  sound.setMuted(userSettings.soundMuted);

  let adsenseScriptLoadedFor = '';
  function initAdSense(pubId) {
    const validId = normalizeAdsenseId(pubId) || ADSENSE_BACKGROUND_PUB_ID;
    if (!validId) return;

    const host = window.location.hostname || '';
    const isLocalHost = host === 'localhost' || host === '127.0.0.1' || host === '';
    if (isLocalHost) return;

    if (adsenseScriptLoadedFor !== validId) {
      adsenseScriptLoadedFor = validId;
      const scriptEl = document.createElement('script');
      scriptEl.async = true;
      scriptEl.crossOrigin = 'anonymous';
      scriptEl.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(validId)}`;
      document.head.appendChild(scriptEl);
    }

    [adSlotHome, adSlotGameover].forEach((slotEl) => {
      if (!slotEl || slotEl.dataset.adsenseInit === validId) return;
      slotEl.dataset.adsenseInit = validId;
      slotEl.innerHTML = '';
      const ins = document.createElement('ins');
      ins.className = 'adsbygoogle';
      ins.style.display = 'inline-block';
      ins.style.width = '320px';
      ins.style.height = '50px';
      ins.dataset.adClient = validId;
      slotEl.appendChild(ins);
      try {
        (window.adsbygoogle = window.adsbygoogle || []).push({});
      } catch {
        // AdSense fills automatically once script finishes loading
      }
    });
  }

  function readPerAccountMap(storageKey) {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          return parsed;
        }
      }
    } catch {
      // Ignore parse errors
    }
    return {};
  }

  function writePerAccountMap(storageKey, mapObj) {
    try {
      localStorage.setItem(storageKey, JSON.stringify(mapObj));
    } catch {
      // Ignore storage errors
    }
  }

  function migrateLegacyScalarsOnce() {
    try {
      if (localStorage.getItem(STORAGE_MIGRATED_V2_KEY)) return;
      localStorage.setItem(STORAGE_MIGRATED_V2_KEY, '1');
      const pid = (playerProfile && playerProfile.playerId) || '';
      if (!pid) return;
      const legacyCoins = parseInt(localStorage.getItem(STORAGE_COINS_KEY) || '0', 10);
      if (Number.isFinite(legacyCoins) && legacyCoins > 0) {
        const coinsMap = readPerAccountMap(STORAGE_COINS_MAP_KEY);
        if (typeof coinsMap[pid] !== 'number') {
          coinsMap[pid] = legacyCoins;
          writePerAccountMap(STORAGE_COINS_MAP_KEY, coinsMap);
        }
      }
      const legacyBest = parseInt(localStorage.getItem(STORAGE_BEST_KEY) || '0', 10);
      if (Number.isFinite(legacyBest) && legacyBest > 0) {
        const bestMap = readPerAccountMap(STORAGE_BEST_MAP_KEY);
        if (typeof bestMap[pid] !== 'number') {
          bestMap[pid] = legacyBest;
          writePerAccountMap(STORAGE_BEST_MAP_KEY, bestMap);
        }
      }
    } catch {
      // Ignore migration errors
    }
  }
  migrateLegacyScalarsOnce();

  function loadCoinBank(accountId = playerProfile && playerProfile.playerId) {
    const pid = String(accountId || '').trim();
    if (!pid) return 0;
    const coinsMap = readPerAccountMap(STORAGE_COINS_MAP_KEY);
    const val = Number(coinsMap[pid]);
    return Number.isFinite(val) && val > 0 ? Math.floor(val) : 0;
  }

  function saveCoinBank(value, accountId = playerProfile && playerProfile.playerId) {
    const pid = String(accountId || '').trim();
    if (!pid) return;
    const cleanVal = Math.max(0, Math.floor(Number(value) || 0));
    const coinsMap = readPerAccountMap(STORAGE_COINS_MAP_KEY);
    coinsMap[pid] = cleanVal;
    writePerAccountMap(STORAGE_COINS_MAP_KEY, coinsMap);
  }

  let currentState = GAME_STATE.START;
  let lastTimestamp = 0;

  // World-locked physical highway coordinates (meters)
  let playerZ = 0;
  let menuCameraZ = 0;
  let speedKmh = SPEED_CURVE.LAUNCH_KMH;
  let distanceMeters = 0;
  let bestMeters = loadBestScore(playerProfile && playerProfile.playerId);
  let savedCoinBank = loadCoinBank(playerProfile && playerProfile.playerId);
  let runCoins = 0;
  let targetBestLineMeters = bestMeters;
  let passedBestThisRun = false;
  let bonusMetersTotal = 0;
  let selectedCityFilter = 'All';
  let activeLeaderboardTab = 'riders';
  let revivedThisRun = false;

  // Timed Power-Ups (seconds remaining)
  let fuelBoostTimer = 0;
  let shieldTimer = 0;
  let magnetTimer = 0;
  let hornHeld = false;
  let hornYieldTimer = 0;
  let pauseFocusIndex = 0;
  let ultra3DEnabled = false;

  // Run anti-cheat telemetry
  let runDurationSeconds = 0;
  let closeCallCount = 0;
  let collectibleCount = 0;
  let maxComboReached = 1;
  let nextMilestoneTarget = 250;
  let runMilestones = [];
  let lastRunSummary = null;

  // Combo & Near-Miss state
  let comboChain = 0;
  let comboMultiplier = 1;
  let comboTimer = 0;

  // First-person bike, suspension & steering physics
  let targetLane = 1;
  let currentLane = 1;
  let leanNormalized = 0;
  let handlebarAngle = 0;
  let worldRollAngle = 0;
  let suspensionPitch = 0;
  let steerCount = 0;
  let engineVibPhase = 0;
  let rattleTimer = 0;
  let crashFlash = 0;
  let crashShakeTimer = 0;

  // Entities, celebration & world-locked scenery
  let entities = [];
  let roadsideProps = [];
  let windStreaks = [];
  let floatingPopups = [];
  let celebrationParticles = [];
  let celebrationTimer = 0;
  let settingsSource = 'home';
  let lastOpenLane = 1;
  let waveCount = 0;
  let nextWaveWorldZ = 48;
  let nextMarkerKm = 1;

  // Keyboard & pedal hold states
  const keysHeld = {
    throttle: false,
    brake: false,
  };
  const pedalsHeld = {
    gas: false,
    brake: false,
  };

  // FPS tracking
  let fpsAccumulator = 0;
  let fpsFrameCount = 0;
  let displayedFps = 60;

  // Gyroscope / Accelerometer Phone Tilt Steering state
  let hasDeviceOrientation = false;
  let tiltPermissionDenied = false;
  let lastRawTiltRoll = 0;
  let tiltBaselineRoll = null;
  let tiltAnchorRoll = 0;
  let manualSteerOverrideTimer = 0;

  // Input state (multi-touch aware via touchId)
  const gesture = {
    active: false,
    touchId: null,
    startX: 0,
    startY: 0,
    swiped: false,
    lastTouchEndMs: 0,
  };

  window.BendskinSettings = {
    getSettings: () => ({ ...userSettings }),
    setDriveMode: (mode) => {
      userSettings.driveMode = mode === 'manual' ? 'manual' : 'auto';
      saveSettings(userSettings);
      applySettingsUi();
    },
    setControlHandedness: (hand) => {
      userSettings.controlHandedness = hand === 'left' ? 'left' : 'right';
      saveSettings(userSettings);
      applySettingsUi();
    },
    setSensitivity: (val) => {
      const n = Number(val);
      if (Number.isFinite(n)) {
        userSettings.sensitivity = Math.max(0.5, Math.min(2.0, Math.round(n * 10) / 10));
        saveSettings(userSettings);
        applySettingsUi();
      }
    },
    setGraphicsQuality: (tier) => {
      if (GRAPHICS_QUALITIES.includes(tier)) {
        userSettings.graphicsQuality = tier;
        saveSettings(userSettings);
        resizeCanvas();
        applySettingsUi();
      }
    },
    setTiltSteering: (enabled) => {
      userSettings.tiltSteering = Boolean(enabled);
      saveSettings(userSettings);
      applySettingsUi();
    },
    recenterTilt: () => {
      if (hasDeviceOrientation) {
        tiltBaselineRoll = Math.max(-22, Math.min(22, lastRawTiltRoll));
        tiltAnchorRoll = lastRawTiltRoll;
      }
    },
    setAdsensePublisherId: (pubId) => {
      userSettings.adsensePublisherId = normalizeAdsenseId(pubId);
      saveSettings(userSettings);
      applySettingsUi();
      initAdSense(userSettings.adsensePublisherId);
    },
  };

  // =========================================================
  // 5b. Persistence & 720p+ Crisp Resize
  // =========================================================
  function loadBestScore(accountId = playerProfile && playerProfile.playerId) {
    const pid = String(accountId || '').trim();
    if (!pid) return 0;
    const bestMap = readPerAccountMap(STORAGE_BEST_MAP_KEY);
    const val = Number(bestMap[pid]);
    return Number.isFinite(val) && val > 0 ? Math.floor(val) : 0;
  }

  function saveBestScore(value, accountId = playerProfile && playerProfile.playerId) {
    const pid = String(accountId || '').trim();
    if (!pid) return;
    const cleanVal = Math.max(0, Math.floor(Number(value) || 0));
    const bestMap = readPerAccountMap(STORAGE_BEST_MAP_KEY);
    bestMap[pid] = cleanVal;
    writePerAccountMap(STORAGE_BEST_MAP_KEY, bestMap);
  }

  function getQualityDprCap(cssWidth, cssHeight) {
    const shortSide = Math.min(Math.max(1, cssWidth || 400), Math.max(1, cssHeight || 720));
    switch (userSettings.graphicsQuality) {
      case 'low':
        return 1.5;
      case 'normal':
        return 2.0;
      case 'high':
        return 2.0;
      default: {
        const minScale720p = 720 / shortSide;
        return Math.min(3.0, Math.max(2.0, minScale720p));
      }
    }
  }

  function syncUltra3DMode(cssWidth, cssHeight) {
    const wants3D =
      userSettings.graphicsQuality === 'high' || userSettings.graphicsQuality === 'ultra';
    const engine = window.BendskinUltra3D;
    let ready = false;
    if (wants3D && canvas3d && engine && engine.isSupported()) {
      ready = engine.init(canvas3d);
      if (ready && typeof cssWidth === 'number' && typeof cssHeight === 'number') {
        engine.resize(cssWidth, cssHeight, userSettings.graphicsQuality);
      }
    }
    ultra3DEnabled = ready;
    if (canvas3d) {
      canvas3d.classList.toggle('hidden', !ultra3DEnabled);
    }
  }

  function resizeCanvas() {
    const rect = appContainer.getBoundingClientRect();
    const cssWidth = Math.max(1, rect.width);
    const cssHeight = Math.max(1, rect.height);
    const dprCap = getQualityDprCap(cssWidth, cssHeight);
    const dpr =
      userSettings.graphicsQuality === 'ultra'
        ? Math.min(3.0, Math.max(window.devicePixelRatio || 1, dprCap))
        : Math.min(window.devicePixelRatio || 1, dprCap);

    canvas.width = Math.round(cssWidth * dpr);
    canvas.height = Math.round(cssHeight * dpr);

    logicalHeight = LOGICAL_WIDTH * (cssHeight / cssWidth);

    const scale = (cssWidth * dpr) / LOGICAL_WIDTH;
    ctx.setTransform(scale, 0, 0, scale, 0, 0);

    syncUltra3DMode(cssWidth, cssHeight);
  }

  window.addEventListener('resize', resizeCanvas);
  window.addEventListener('orientationchange', resizeCanvas);
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', resizeCanvas);
  }

  // =========================================================
  // 6. World-Locked 2.5D/3D Projection & Dynamic High-Speed FOV
  // =========================================================
  function getActiveCameraZ() {
    return (currentState === GAME_STATE.PLAYING || currentState === GAME_STATE.PAUSED)
      ? playerZ
      : menuCameraZ;
  }

  function worldZToNormalizedZ(worldZ) {
    const aheadMeters = worldZ - getActiveCameraZ();
    return WORLD_SPACE.PLAYER_PLANE_Z * (1 - aheadMeters / WORLD_SPACE.VIEW_DISTANCE_METERS);
  }

  function getGearForSpeed(kmh) {
    if (kmh < 22) return 1;
    if (kmh < 52) return 2;
    if (kmh < 88) return 3;
    if (kmh < 126) return 4;
    return 5;
  }

  function getRpmRatio(kmh) {
    const bands = [
      [0, 26],
      [18, 56],
      [48, 92],
      [82, 130],
      [120, SPEED_CURVE.MAX_KMH],
    ];
    const gearIdx = getGearForSpeed(kmh) - 1;
    const [minK, maxK] = bands[gearIdx];
    const t = (kmh - minK) / Math.max(1, maxK - minK);
    return Math.max(0.16, Math.min(0.98, 0.22 + t * 0.76));
  }

  function isBrakingActive() {
    return currentState === GAME_STATE.PLAYING && Boolean(keysHeld.brake || pedalsHeld.brake);
  }

  function isThrottlingActive() {
    return currentState === GAME_STATE.PLAYING && Boolean(keysHeld.throttle || pedalsHeld.gas);
  }

  function getHighSpeedFactor() {
    if (currentState !== GAME_STATE.PLAYING) return 0;
    return Math.max(0, Math.min(1, (speedKmh - 95) / 70));
  }

  function getHorizonY() {
    return logicalHeight * (PERSPECTIVE.HORIZON_RATIO - getHighSpeedFactor() * 0.018);
  }

  function getBottomY() {
    return logicalHeight * PERSPECTIVE.BOTTOM_RATIO;
  }

  function getHandlebarBaseX() {
    return projectPoint(currentLane, 0.96).x;
  }

  /**
   * Projects a lane coordinate (0..2, or outside road <0 / >2) and normalized
   * depth z (0 at horizon -> 1 at bottom edge) into 2D logical canvas space.
   */
  function projectPoint(laneFloat, z) {
    const clampedZ = Math.max(0, z);
    const visZ = Math.pow(clampedZ, PERSPECTIVE.DEPTH_CURVE);
    const horizonY = getHorizonY();
    const bottomY = getBottomY();
    const fovFactor = getHighSpeedFactor();

    const bottomLaneWidth = PERSPECTIVE.BOTTOM_LANE_WIDTH + fovFactor * 24;
    const bottomLane0 = 200 - bottomLaneWidth;
    const horizonLane0 = 200 - PERSPECTIVE.HORIZON_LANE_WIDTH;

    const horizonX = horizonLane0 + laneFloat * PERSPECTIVE.HORIZON_LANE_WIDTH;
    const cameraShift = (1 - currentLane) * PERSPECTIVE.CAMERA_PARALLAX;
    const bottomX = bottomLane0 + laneFloat * bottomLaneWidth + cameraShift;

    const x = horizonX + (bottomX - horizonX) * visZ;
    const y = horizonY + (bottomY - horizonY) * visZ;
    const laneWidthAtZ =
      PERSPECTIVE.HORIZON_LANE_WIDTH +
      (bottomLaneWidth - PERSPECTIVE.HORIZON_LANE_WIDTH) * visZ;
    const scale = laneWidthAtZ / PERSPECTIVE.BOTTOM_LANE_WIDTH;

    return { x, y, scale, visZ, laneWidthAtZ };
  }

  // =========================================================
  // 7. Snappy Dual-Mode Input Controls (Swipe, Tap & Keyboard)
  // =========================================================
  function steerBy(delta, fromTilt = false) {
    if (currentState !== GAME_STATE.PLAYING) {
      return;
    }

    if (!fromTilt) {
      manualSteerOverrideTimer = 1.6;
      tiltAnchorRoll = lastRawTiltRoll;
    }

    const nextLane = Math.max(0, Math.min(2, targetLane + delta));
    if (nextLane !== targetLane) {
      targetLane = nextLane;
      steerCount += 1;
      sound.playSwoosh();
      if (steerCount >= 2 && hudHintPillEl) {
        hudHintPillEl.classList.add('fade-out');
      }
    }
  }

  function isUiInteraction(target) {
    return Boolean(
      target &&
        target.closest(
          'button, input, select, .thumb-pedal, .policy-link, .ad-banner-slot, .ui-modal, .gameover-card'
        )
    );
  }

  function getEffectiveSwipeThreshold() {
    return STEERING.SWIPE_THRESHOLD_PX / Math.max(0.5, userSettings.sensitivity);
  }

  function beginGesture(clientX, clientY, target, touchId = null) {
    sound.unlock();
    if (currentState !== GAME_STATE.PLAYING || isUiInteraction(target)) {
      gesture.active = false;
      gesture.touchId = null;
      return;
    }
    gesture.active = true;
    gesture.touchId = touchId;
    gesture.startX = clientX;
    gesture.startY = clientY;
    gesture.swiped = false;
  }

  function moveGesture(clientX) {
    if (!gesture.active || gesture.swiped || currentState !== GAME_STATE.PLAYING) {
      return;
    }
    const dx = clientX - gesture.startX;
    if (Math.abs(dx) >= getEffectiveSwipeThreshold()) {
      steerBy(dx < 0 ? -1 : 1, false);
      gesture.swiped = true;
    }
  }

  function endGesture(clientX, clientY) {
    if (!gesture.active) {
      return;
    }
    const dx = clientX - gesture.startX;
    const dy = clientY - gesture.startY;
    const wasSwiped = gesture.swiped;
    gesture.active = false;
    gesture.touchId = null;
    gesture.swiped = false;

    if (!wasSwiped && Math.abs(dx) < getEffectiveSwipeThreshold() && Math.abs(dy) < 40) {
      const rect = appContainer.getBoundingClientRect();
      const tapIsLeft = clientX < rect.left + rect.width * 0.5;
      steerBy(tapIsLeft ? -1 : 1, false);
    }
  }

  function bindThumbPedal(el, field) {
    if (!el) return;
    const engage = (e) => {
      e.preventDefault();
      e.stopPropagation();
      sound.unlock();
      if (el.setPointerCapture && e.pointerId !== undefined) {
        try {
          el.setPointerCapture(e.pointerId);
        } catch {
          // Ignore unsupported pointer capture environments
        }
      }
      pedalsHeld[field] = true;
      el.classList.add('pressed');
    };
    const release = (e) => {
      if (e) e.stopPropagation();
      pedalsHeld[field] = false;
      el.classList.remove('pressed');
    };
    el.addEventListener('pointerdown', engage);
    el.addEventListener('pointerup', release);
    el.addEventListener('pointercancel', release);
  }

  function bindSteerButton(el, delta) {
    if (!el) return;
    const trigger = (e) => {
      e.preventDefault();
      e.stopPropagation();
      sound.unlock();
      el.classList.add('pressed');
      steerBy(delta, false);
    };
    const release = (e) => {
      if (e) e.stopPropagation();
      el.classList.remove('pressed');
    };
    el.addEventListener('pointerdown', trigger);
    el.addEventListener('pointerup', release);
    el.addEventListener('pointercancel', release);
    el.addEventListener('pointerleave', release);
  }

  function isLaneClearForVehicle(targetLaneIdx, worldZ, ignoreEntity, bandMeters = 18) {
    if (targetLaneIdx < 0 || targetLaneIdx > 2) return false;
    for (let i = 0; i < entities.length; i += 1) {
      const other = entities[i];
      if (other === ignoreEntity) continue;
      if (ENTITY_CONFIG[other.type].kind !== 'hazard') continue;
      const otherLane = Math.round(
        typeof other.visualLane === 'number' ? other.visualLane : other.lane
      );
      if (other.lane === targetLaneIdx || otherLane === targetLaneIdx) {
        if (Math.abs(other.worldZ - worldZ) < bandMeters) {
          return false;
        }
      }
    }
    return true;
  }

  function getOccupiedOtherLanesSet(laneIdx, worldZ, ignoreEntity, bandMeters = 16) {
    const occupied = new Set();
    for (let i = 0; i < entities.length; i += 1) {
      const other = entities[i];
      if (other === ignoreEntity) continue;
      if (ENTITY_CONFIG[other.type].kind !== 'hazard') continue;
      if (Math.abs(other.worldZ - worldZ) < bandMeters) {
        const otherLane = Math.round(
          typeof other.visualLane === 'number' ? other.visualLane : other.lane
        );
        if (other.lane !== laneIdx) occupied.add(other.lane);
        if (otherLane !== laneIdx) occupied.add(otherLane);
      }
    }
    return occupied;
  }

  function beginVehicleLaneChange(entity, nextLane, leadSeconds = 0.72, isHornYield = false) {
    if (!entity || ENTITY_CONFIG[entity.type].speedKmh <= 0) return false;
    if (typeof entity.pendingLane === 'number' || nextLane === entity.lane) return false;
    if (nextLane < 0 || nextLane > 2) return false;
    if (typeof entity.visualLane !== 'number') {
      entity.visualLane = entity.lane;
    }
    // Never cut across into the player's lane at high speed when close
    const distAhead = entity.worldZ - playerZ;
    if (!isHornYield && distAhead > -2 && distAhead < 28 && Math.abs(nextLane - targetLane) < 0.75) {
      return false;
    }
    entity.pendingLane = nextLane;
    entity.signalDir = nextLane < entity.lane ? -1 : 1;
    entity.signalTimer = Math.max(0.32, leadSeconds);
    entity.yielding = isHornYield;
    return true;
  }

  function tryYieldVehicleLane(entity, isHornYield = false) {
    if (!entity || ENTITY_CONFIG[entity.type].speedKmh <= 0) return false;
    if (typeof entity.pendingLane === 'number' && !isHornYield) return true;
    const distAhead = entity.worldZ - playerZ;
    const candidates = [entity.lane - 1, entity.lane + 1].filter(
      (laneIdx) =>
        isLaneClearForVehicle(laneIdx, entity.worldZ, entity, 18) &&
        getOccupiedOtherLanesSet(laneIdx, entity.worldZ, entity, 17).size < 2 &&
        (isHornYield || distAhead >= 28 || Math.abs(laneIdx - targetLane) >= 0.75)
    );
    if (candidates.length === 0) return false;

    // Prefer moving away from the player's current lane
    candidates.sort((a, b) => Math.abs(b - currentLane) - Math.abs(a - currentLane));
    const nextLane = candidates[0];
    // Flash turn signal before shifting lanes (0.36s when clearing for horn, 0.72s otherwise)
    return beginVehicleLaneChange(entity, nextLane, isHornYield ? 0.36 : 0.72, isHornYield);
  }

  function clearTrafficAheadWithHorn(showPopup) {
    if (currentState !== GAME_STATE.PLAYING) return;
    let clearedCount = 0;
    for (let i = 0; i < entities.length; i += 1) {
      const entity = entities[i];
      const cfg = ENTITY_CONFIG[entity.type];
      if (cfg.speedKmh <= 0) continue;
      const distAhead = entity.worldZ - playerZ;
      const entityLane = typeof entity.visualLane === 'number' ? entity.visualLane : entity.lane;
      if (distAhead > 2 && distAhead < 78 && Math.abs(entityLane - currentLane) < 0.85) {
        if (tryYieldVehicleLane(entity, true)) {
          clearedCount += 1;
        }
      }
    }
    if (showPopup) {
      addPopup(
        clearedCount > 0 ? 'HORN! LANE CLEAR!' : 'HOOOORN!',
        getHandlebarBaseX(),
        getBottomY() - 165,
        '#fde047'
      );
    }
  }

  function startHorn() {
    if (currentState !== GAME_STATE.PLAYING) return;
    sound.unlock();
    const firstPress = !hornHeld;
    hornHeld = true;
    if (btnHornEl) btnHornEl.classList.add('pressed');
    sound.startContinuousHorn();
    if (firstPress) {
      hornYieldTimer = 0.24;
      clearTrafficAheadWithHorn(true);
    }
  }

  function stopHorn() {
    hornHeld = false;
    hornYieldTimer = 0;
    if (btnHornEl) btnHornEl.classList.remove('pressed');
    sound.stopContinuousHorn();
  }

  function triggerHorn() {
    startHorn();
  }

  bindThumbPedal(pedalBrakeEl, 'brake');
  bindThumbPedal(pedalGasEl, 'gas');
  bindSteerButton(btnSteerLeft, -1);
  bindSteerButton(btnSteerRight, 1);
  if (btnHornEl) {
    const pressHorn = (e) => {
      e.preventDefault();
      e.stopPropagation();
      startHorn();
    };
    const releaseHorn = (e) => {
      if (e) e.stopPropagation();
      stopHorn();
    };
    btnHornEl.addEventListener('pointerdown', pressHorn);
    btnHornEl.addEventListener('pointerup', releaseHorn);
    btnHornEl.addEventListener('pointercancel', releaseHorn);
    btnHornEl.addEventListener('pointerleave', releaseHorn);
  }

  function extractRollAngle(event) {
    const angle =
      (window.screen &&
        window.screen.orientation &&
        typeof window.screen.orientation.angle === 'number'
        ? window.screen.orientation.angle
        : typeof window.orientation === 'number'
        ? window.orientation
        : 0) % 360;
    const normAngle = angle < 0 ? angle + 360 : angle;

    if (normAngle === 90) {
      return typeof event.beta === 'number' ? event.beta : NaN;
    }
    if (normAngle === 270) {
      return typeof event.beta === 'number' ? -event.beta : NaN;
    }
    if (normAngle === 180) {
      return typeof event.gamma === 'number' ? -event.gamma : NaN;
    }
    return typeof event.gamma === 'number' ? event.gamma : NaN;
  }

  function recenterTiltBaseline() {
    if (hasDeviceOrientation) {
      tiltBaselineRoll = Math.max(-22, Math.min(22, lastRawTiltRoll));
      tiltAnchorRoll = lastRawTiltRoll;
    } else {
      tiltBaselineRoll = 0;
      tiltAnchorRoll = 0;
    }
    manualSteerOverrideTimer = 0;
  }

  function requestTiltPermission() {
    try {
      if (
        typeof window.DeviceOrientationEvent !== 'undefined' &&
        typeof window.DeviceOrientationEvent.requestPermission === 'function'
      ) {
        window.DeviceOrientationEvent.requestPermission()
          .then((state) => {
            tiltPermissionDenied = state !== 'granted';
            if (!tiltPermissionDenied) {
              recenterTiltBaseline();
            }
            applySettingsUi();
          })
          .catch(() => {
            tiltPermissionDenied = true;
            applySettingsUi();
          });
      }
    } catch {
      // Ignore permission errors on unsupported browsers
    }
  }

  function handleDeviceOrientation(event) {
    if (event.gamma === null && event.beta === null) return;
    const roll = extractRollAngle(event);
    if (!Number.isFinite(roll)) return;

    const firstReading = !hasDeviceOrientation;
    hasDeviceOrientation = true;
    lastRawTiltRoll = roll;
    if (tiltBaselineRoll === null) {
      tiltBaselineRoll = Math.max(-20, Math.min(20, roll));
      tiltAnchorRoll = roll;
    }
    if (firstReading) {
      applySettingsUi();
    }

    if (!userSettings.tiltSteering || currentState !== GAME_STATE.PLAYING) {
      return;
    }

    if (manualSteerOverrideTimer > 0) {
      if (Math.abs(roll - tiltAnchorRoll) < 6.5) {
        return;
      }
      manualSteerOverrideTimer = 0;
    }

    const relTilt = (roll - tiltBaselineRoll) * Math.max(0.6, userSettings.sensitivity);
    const deadzone = 1.8;
    const adjustedTilt =
      Math.abs(relTilt) <= deadzone ? 0 : relTilt - Math.sign(relTilt) * deadzone;
    const continuousLane = Math.max(0, Math.min(2, 1 + adjustedTilt / 16));
    targetLane = continuousLane;
  }

  window.addEventListener('deviceorientation', handleDeviceOrientation);

  appContainer.addEventListener(
    'touchstart',
    (event) => {
      if (gesture.active && gesture.touchId !== null) return;
      for (let i = 0; i < event.changedTouches.length; i += 1) {
        const touch = event.changedTouches[i];
        if (!isUiInteraction(touch.target)) {
          beginGesture(touch.clientX, touch.clientY, touch.target, touch.identifier);
          break;
        }
      }
    },
    { passive: true }
  );

  appContainer.addEventListener(
    'touchmove',
    (event) => {
      if (
        !event.target ||
        !event.target.closest('.leaderboard-list, .city-filter-row, .gameover-card, .about-content, .about-tabs, .settings-body')
      ) {
        event.preventDefault();
      }
      if (!gesture.active) return;
      for (let i = 0; i < event.changedTouches.length; i += 1) {
        const touch = event.changedTouches[i];
        if (gesture.touchId === null || touch.identifier === gesture.touchId) {
          moveGesture(touch.clientX);
          break;
        }
      }
    },
    { passive: false }
  );

  appContainer.addEventListener(
    'touchend',
    (event) => {
      gesture.lastTouchEndMs = Date.now();
      if (!gesture.active) return;
      for (let i = 0; i < event.changedTouches.length; i += 1) {
        const touch = event.changedTouches[i];
        if (gesture.touchId === null || touch.identifier === gesture.touchId) {
          endGesture(touch.clientX, touch.clientY);
          break;
        }
      }
    },
    { passive: true }
  );

  appContainer.addEventListener('touchcancel', (event) => {
    if (!gesture.active) return;
    for (let i = 0; i < event.changedTouches.length; i += 1) {
      const touch = event.changedTouches[i];
      if (gesture.touchId === null || touch.identifier === gesture.touchId) {
        gesture.active = false;
        gesture.touchId = null;
        gesture.swiped = false;
        break;
      }
    }
  });

  appContainer.addEventListener('mousedown', (event) => {
    if (Date.now() - gesture.lastTouchEndMs < 450 || event.button !== 0) return;
    beginGesture(event.clientX, event.clientY, event.target, null);
  });

  window.addEventListener('mousemove', (event) => {
    if (!gesture.active || gesture.touchId !== null) return;
    moveGesture(event.clientX);
  });

  window.addEventListener('mouseup', (event) => {
    if (Date.now() - gesture.lastTouchEndMs < 450 || gesture.touchId !== null) return;
    endGesture(event.clientX, event.clientY);
  });

  appContainer.addEventListener(
    'wheel',
    (event) => {
      if (
        !event.target ||
        !event.target.closest('.leaderboard-list, .city-filter-row, .gameover-card, .about-content, .about-tabs, .settings-body')
      ) {
        event.preventDefault();
      }
    },
    { passive: false }
  );

  document.addEventListener('gesturestart', (e) => e.preventDefault(), { passive: false });
  document.addEventListener('gesturechange', (e) => e.preventDefault(), { passive: false });

  function getPauseMenuButtons() {
    return [btnResume, btnPauseSettings, btnPauseRestart, btnPauseHome].filter(Boolean);
  }

  function setPauseMenuFocus(nextIdx) {
    const buttons = getPauseMenuButtons();
    if (buttons.length === 0) return;
    pauseFocusIndex = ((nextIdx % buttons.length) + buttons.length) % buttons.length;
    buttons.forEach((btn, idx) => {
      const focused = idx === pauseFocusIndex;
      btn.classList.toggle('kb-focus', focused);
      if (focused) {
        try {
          btn.focus({ preventScroll: true });
        } catch {
          // Ignore focus failures
        }
      }
    });
  }

  window.addEventListener('keydown', (event) => {
    sound.unlock();

    if (
      event.target &&
      (event.target.tagName === 'INPUT' || event.target.tagName === 'SELECT')
    ) {
      return;
    }

    if (
      !leaderboardModal.classList.contains('hidden') ||
      (accountModal && !accountModal.classList.contains('hidden')) ||
      (settingsModal && !settingsModal.classList.contains('hidden')) ||
      (garageModal && !garageModal.classList.contains('hidden')) ||
      (aboutModal && !aboutModal.classList.contains('hidden'))
    ) {
      if (event.code === 'Escape') {
        event.preventDefault();
        closeLeaderboard();
        closeAccountModal();
        closeSettings();
        if (garageModal) garageModal.classList.add('hidden');
        closeAbout();
      }
      return;
    }

    if (currentState === GAME_STATE.PAUSED) {
      const buttons = getPauseMenuButtons();
      if (event.code === 'Escape' || event.code === 'KeyP') {
        if (event.repeat) return;
        event.preventDefault();
        resumeGame();
        return;
      }
      if (event.code === 'ArrowUp' || event.code === 'KeyW' || event.code === 'ArrowLeft') {
        event.preventDefault();
        setPauseMenuFocus(pauseFocusIndex - 1);
        return;
      }
      if (event.code === 'ArrowDown' || event.code === 'KeyS' || event.code === 'ArrowRight') {
        event.preventDefault();
        setPauseMenuFocus(pauseFocusIndex + 1);
        return;
      }
      if (event.code === 'Tab') {
        event.preventDefault();
        setPauseMenuFocus(pauseFocusIndex + (event.shiftKey ? -1 : 1));
        return;
      }
      if ((event.code === 'Enter' || event.code === 'Space') && !event.repeat) {
        event.preventDefault();
        const activeBtn = buttons[pauseFocusIndex] || buttons[0];
        if (activeBtn) activeBtn.click();
      }
      return;
    }

    if (currentState === GAME_STATE.PLAYING) {
      if ((event.code === 'Escape' || event.code === 'KeyP') && !event.repeat) {
        event.preventDefault();
        pauseGame(true);
        return;
      }
      if (event.code === 'Space' || event.code === 'KeyH' || event.code === 'KeyE') {
        event.preventDefault();
        if (!event.repeat) startHorn();
        return;
      }
      if (event.code === 'ArrowUp' || event.code === 'KeyW') {
        event.preventDefault();
        keysHeld.throttle = true;
        return;
      }
      if (event.code === 'ArrowDown' || event.code === 'KeyS') {
        event.preventDefault();
        keysHeld.brake = true;
        return;
      }
      if (event.repeat) return;
      if (event.code === 'ArrowLeft' || event.code === 'KeyA') {
        event.preventDefault();
        steerBy(-1, false);
      } else if (event.code === 'ArrowRight' || event.code === 'KeyD') {
        event.preventDefault();
        steerBy(1, false);
      }
    } else if ((event.code === 'Space' || event.code === 'Enter') && !event.repeat) {
      event.preventDefault();
      if (currentState === GAME_STATE.START) {
        handlePlayPressed();
      } else {
        startRun();
      }
    }
  });

  window.addEventListener('keyup', (event) => {
    if (event.code === 'ArrowUp' || event.code === 'KeyW') {
      keysHeld.throttle = false;
    } else if (event.code === 'ArrowDown' || event.code === 'KeyS') {
      keysHeld.brake = false;
    } else if (event.code === 'Space' || event.code === 'KeyH' || event.code === 'KeyE') {
      stopHorn();
    }
  });

  window.addEventListener('blur', () => {
    stopHorn();
    keysHeld.throttle = false;
    keysHeld.brake = false;
    pedalsHeld.gas = false;
    pedalsHeld.brake = false;
    if (pedalBrakeEl) pedalBrakeEl.classList.remove('pressed');
    if (pedalGasEl) pedalGasEl.classList.remove('pressed');
  });

  // =========================================================
  // 8. World-Locked Spawner, Open-Lane Guarantee & Scenery
  // =========================================================
  function initAmbientWorld(baseZ = 0) {
    roadsideProps = [];
    const leftKinds = ['palm', 'building', 'kiosk', 'lamp', 'palm', 'billboard', 'building', 'lamp'];
    const totalSpan = WORLD_SPACE.VIEW_DISTANCE_METERS + 24;
    for (let i = 0; i < 12; i += 1) {
      const worldZ = baseZ - 6 + (i / 12) * totalSpan;
      roadsideProps.push({
        worldZ,
        z: 0,
        side: -1,
        kind: leftKinds[i % leftKinds.length],
        km: i,
      });
      roadsideProps.push({
        worldZ: worldZ + totalSpan / 24,
        z: 0,
        side: 1,
        kind: i % 5 === 0 ? 'mile' : i === 6 ? 'billboard' : i % 4 === 1 ? 'building' : i % 3 === 0 ? 'kiosk' : 'palm',
        km: Math.max(1, i),
      });
    }

    windStreaks = [];
    for (let i = 0; i < 18; i += 1) {
      windStreaks.push({
        side: i % 2 === 0 ? -1 : 1,
        progress: Math.random(),
        offsetRatio: Math.random(),
        speedMult: 0.8 + Math.random() * 0.7,
      });
    }
  }

  const STATIONARY_HAZARDS = ['barrier', 'timber_log'];
  const MOVING_HAZARDS = ['yellow_taxi', 'timber_truck', 'clando_van', 'rival_moto'];

  function pickCollectibleType() {
    const r = Math.random();
    if (r < 0.64) return 'coin';
    if (r < 0.76) return 'fuel_can';
    if (r < 0.88) return 'shield';
    return 'magnet';
  }

  function spawnWave(spawnWorldZ) {
    waveCount += 1;

    // Check existing hazards near the spawn band so all 3 lanes can never align within 22m
    const nearbyHazards = entities.filter(
      (e) =>
        ENTITY_CONFIG[e.type].kind === 'hazard' &&
        e.worldZ >= spawnWorldZ - 22 &&
        e.worldZ <= spawnWorldZ + 24
    );
    const busyLanes = new Set(nearbyHazards.map((h) => h.lane));

    // Predict whether any upstream moving vehicle could reach this band at player intersection time
    const upstreamPredictedLanes = new Set();
    const distToWave = Math.max(20, spawnWorldZ - playerZ);
    const tFast = distToWave / 36;
    const tSlow = distToWave / 16;
    entities.forEach((e) => {
      const cfg = ENTITY_CONFIG[e.type];
      if (!cfg || !cfg.isVehicle || e.worldZ >= spawnWorldZ) return;
      const vMps = cfg.speedKmh * WORLD_SPACE.KMH_TO_MPS;
      const zMin = e.worldZ + vMps * tFast;
      const zMax = e.worldZ + vMps * tSlow;
      if (zMax >= spawnWorldZ - 20 && zMin <= spawnWorldZ + 22) {
        upstreamPredictedLanes.add(e.lane);
      }
    });

    let openLane = lastOpenLane;
    const candidateOpen = [lastOpenLane];
    if (lastOpenLane > 0) candidateOpen.push(lastOpenLane - 1);
    if (lastOpenLane < 2) candidateOpen.push(lastOpenLane + 1);
    const preferredOpen = candidateOpen.filter(
      (lane) => !busyLanes.has(lane) && !upstreamPredictedLanes.has(lane)
    );
    const freeCandidates =
      preferredOpen.length > 0
        ? preferredOpen
        : candidateOpen.filter((lane) => !busyLanes.has(lane));

    if (freeCandidates.length > 0) {
      openLane = freeCandidates[Math.floor(Math.random() * freeCandidates.length)];
    } else {
      const anyFree = [0, 1, 2].filter((lane) => !busyLanes.has(lane));
      if (anyFree.length > 0) {
        openLane = anyFree[Math.floor(Math.random() * anyFree.length)];
      }
    }
    lastOpenLane = openLane;

    const availableBlockLanes = [0, 1, 2].filter(
      (lane) => lane !== openLane && !busyLanes.has(lane)
    );
    const wantsTwo = Math.random() < Math.min(0.65, 0.36 + waveCount * 0.015);
    let lanesToBlock =
      wantsTwo || availableBlockLanes.length <= 1
        ? availableBlockLanes
        : [availableBlockLanes[Math.floor(Math.random() * availableBlockLanes.length)]];

    // Reserve at least 1 unobstructed corridor if upstream vehicles may cross this wave band
    const reservedCount = busyLanes.size + upstreamPredictedLanes.size;
    if (reservedCount >= 2 && lanesToBlock.length > 1) {
      lanesToBlock = [lanesToBlock[0]];
    } else if (busyLanes.size + lanesToBlock.length >= 3) {
      lanesToBlock = lanesToBlock.slice(0, Math.max(0, 2 - busyLanes.size));
    }

    let stationaryInBand = nearbyHazards.filter((h) => !ENTITY_CONFIG[h.type].isVehicle).length;

    lanesToBlock.forEach((lane) => {
      const allowStationary = stationaryInBand === 0 || upstreamPredictedLanes.size === 0;
      let pool = allowStationary ? HAZARD_TYPES : MOVING_HAZARDS;
      // Never stack 2 stationary barriers if any moving vehicle could converge on openLane
      if (stationaryInBand >= 1 && upstreamPredictedLanes.has(openLane)) {
        return;
      }
      const type = pool[Math.floor(Math.random() * pool.length)];
      if (!ENTITY_CONFIG[type].isVehicle) {
        stationaryInBand += 1;
      }

      const sameLaneAhead = entities.some(
        (e) =>
          ENTITY_CONFIG[e.type].kind === 'hazard' &&
          e.lane === lane &&
          Math.abs(e.worldZ - spawnWorldZ) < 22
      );
      if (sameLaneAhead) return;

      const worldZ = spawnWorldZ + Math.random() * 3.5;
      entities.push({
        type,
        lane,
        worldZ,
        lockedWorldZ: worldZ,
        z: worldZToNormalizedZ(worldZ),
        wheelPhase: Math.random() * Math.PI * 2,
        braking: false,
        rattled: false,
        wasInSameLane: false,
        nearMissAwarded: false,
      });
    });

    if (Math.random() < 0.65) {
      const colType = pickCollectibleType();
      const colLane = openLane;
      const colWorldZ = spawnWorldZ + 2;
      if (colType === 'coin' && Math.random() < 0.42) {
        for (let k = 0; k < 3; k += 1) {
          const cz = colWorldZ + k * 7.5;
          entities.push({
            type: 'coin',
            lane: colLane,
            worldZ: cz,
            lockedWorldZ: cz,
            z: worldZToNormalizedZ(cz),
            collected: false,
          });
        }
      } else {
        entities.push({
          type: colType,
          lane: colLane,
          worldZ: colWorldZ,
          lockedWorldZ: colWorldZ,
          z: worldZToNormalizedZ(colWorldZ),
          collected: false,
        });
      }
    }
  }

  function addPopup(text, x, y, color) {
    floatingPopups.push({
      text,
      x,
      y,
      color,
      life: 0.95,
      maxLife: 0.95,
    });
  }

  // =========================================================
  // 9. UI State Transitions, Settings, Policies & Revive
  // =========================================================
  function setButtonIconAndText(btnEl, iconId, labelText, iconClass = '') {
    if (!btnEl) return;
    const svgNs = 'http://www.w3.org/2000/svg';
    btnEl.textContent = '';
    if (iconId) {
      const svg = document.createElementNS(svgNs, 'svg');
      svg.setAttribute('class', iconClass ? `game-svg-icon ${iconClass}` : 'game-svg-icon');
      const use = document.createElementNS(svgNs, 'use');
      use.setAttribute('href', `#${iconId}`);
      svg.appendChild(use);
      btnEl.appendChild(svg);
    }
    if (labelText) {
      const span = document.createElement('span');
      span.className = 'btn-arcade-label';
      span.textContent = labelText;
      btnEl.appendChild(span);
    }
  }

  function triggerTitleBonkAnimation() {
    if (!gamingLogoWordmark) return;
    gamingLogoWordmark.classList.remove('animate-bonk');
    void gamingLogoWordmark.getBoundingClientRect();
    gamingLogoWordmark.classList.add('animate-bonk');
  }

  function applyDriveModeToHud() {
    const isManual = userSettings.driveMode === 'manual';
    const isLeftHanded = userSettings.controlHandedness === 'left';
    const tiltOn = Boolean(userSettings.tiltSteering);
    if (hudPedalsEl) {
      hudPedalsEl.classList.toggle('left-handed', isLeftHanded);
    }
    if (pedalGasEl) {
      pedalGasEl.classList.toggle('hidden', !isManual);
    }
    if (hudSteerClusterEl) {
      hudSteerClusterEl.classList.toggle('hidden', tiltOn);
    }
    if (hudHintPillEl) {
      const steerText = tiltOn ? 'Tilt Phone Smoothly' : '</> Arrows or Swipe';
      const sideText = isLeftHanded ? 'Pedals L / Arrows R' : 'Arrows L / Pedals R';
      hudHintPillEl.textContent = isManual
        ? `${steerText} • ${sideText} • SPACE Horn • ESC Pause`
        : `${steerText} to Steer • SPACE Horn • ESC Pause`;
    }
  }

  function syncCoinDisplays() {
    if (homeCoinBankEl) {
      homeCoinBankEl.textContent = savedCoinBank.toLocaleString();
    }
    if (garageCoinBalanceEl) {
      garageCoinBalanceEl.textContent = `${savedCoinBank.toLocaleString()} COINS`;
    }
    if (hudCoinsEl) {
      hudCoinsEl.textContent = `${savedCoinBank.toLocaleString()}`;
    }
  }

  function renderPowerupHud() {
    if (!hudPowerupsEl) return;
    const activeItems = [];
    if (fuelBoostTimer > 0) {
      activeItems.push({
        cls: 'nitro',
        icon: 'icon-fuel',
        label: 'NITRO',
        sec: fuelBoostTimer,
        max: POWERUPS.FUEL_DURATION,
      });
    }
    if (shieldTimer > 0) {
      activeItems.push({
        cls: 'shield',
        icon: 'icon-shield',
        label: 'SHIELD',
        sec: shieldTimer,
        max: POWERUPS.SHIELD_DURATION,
      });
    }
    if (magnetTimer > 0) {
      activeItems.push({
        cls: 'magnet',
        icon: 'icon-magnet',
        label: 'MAGNET',
        sec: magnetTimer,
        max: POWERUPS.MAGNET_DURATION,
      });
    }

    if (activeItems.length === 0) {
      hudPowerupsEl.classList.add('hidden');
      if (hudPowerupsEl.innerHTML !== '') hudPowerupsEl.innerHTML = '';
      return;
    }

    hudPowerupsEl.classList.remove('hidden');
    hudPowerupsEl.innerHTML = activeItems
      .map((item) => {
        const pct = Math.max(0, Math.min(100, (item.sec / item.max) * 100));
        return `<div class="powerup-pill ${item.cls}">
          <svg class="game-svg-icon icon-sm" aria-hidden="true"><use href="#${item.icon}"></use></svg>
          <span class="powerup-timer">${item.label} ${item.sec.toFixed(1)}s</span>
          <div class="powerup-bar-track"><div class="powerup-bar-fill" style="width:${pct.toFixed(1)}%"></div></div>
        </div>`;
      })
      .join('');
  }

  function syncSoundButtonsUi() {
    const isMuted = sound.isMuted();
    if (btnSound) {
      setButtonIconAndText(btnSound, isMuted ? 'icon-sound-off' : 'icon-sound-on', '');
      btnSound.classList.toggle('muted', isMuted);
    }
    if (btnSettingsSound) {
      setButtonIconAndText(
        btnSettingsSound,
        isMuted ? 'icon-sound-off' : 'icon-sound-on',
        isMuted ? 'Sound Effects: OFF' : 'Sound Effects: ON',
        'icon-sm'
      );
    }
  }

  function applySettingsUi() {
    const isManual = userSettings.driveMode === 'manual';
    const isLeftHanded = userSettings.controlHandedness === 'left';
    if (btnModeAuto) btnModeAuto.classList.toggle('active', !isManual);
    if (btnModeManual) btnModeManual.classList.toggle('active', isManual);
    if (driveModeDesc) {
      const arrowSide = isLeftHanded ? 'right' : 'left';
      const pedalSide = isLeftHanded ? 'left' : 'right';
      driveModeDesc.textContent = isManual
        ? `Manual car pedals active: hold GAS/BRAKE on the ${pedalSide} while steering with Tilt or </> arrows on the ${arrowSide}.`
        : `Bike accelerates automatically; steer with Tilt or </> arrows (${arrowSide}) and hold BRAKE car pedal (${pedalSide}).`;
    }
    if (btnHandRight) btnHandRight.classList.toggle('active', !isLeftHanded);
    if (btnHandLeft) btnHandLeft.classList.toggle('active', isLeftHanded);
    if (handLayoutDesc) {
      handLayoutDesc.textContent = isLeftHanded
        ? 'Left-Handed layout: Car GAS/BRAKE Pedals & Horn on the Left, < > steering arrows on the Right.'
        : 'Right-Handed layout: < > steering arrows on the Left, Car GAS/BRAKE Pedals & Horn on the Right.';
    }
    qualityButtons.forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.quality === userSettings.graphicsQuality);
    });
    if (graphicsQualityDesc) {
      graphicsQualityDesc.textContent =
        GRAPHICS_DESCRIPTIONS[userSettings.graphicsQuality] || GRAPHICS_DESCRIPTIONS.ultra;
    }
    if (hudQualityBadgeEl) {
      const labels = { low: 'LOW', normal: 'NORMAL', high: 'HIGH HD', ultra: 'ULTRA 720p+' };
      hudQualityBadgeEl.textContent = labels[userSettings.graphicsQuality] || 'ULTRA 720p+';
    }
    const tiltOn = Boolean(userSettings.tiltSteering);
    if (btnHudTilt) {
      setButtonIconAndText(btnHudTilt, 'icon-tilt', tiltOn ? 'TILT: ON' : 'TILT: OFF', 'icon-sm');
      btnHudTilt.classList.toggle('off', !tiltOn);
    }
    if (btnTiltToggle) {
      setButtonIconAndText(
        btnTiltToggle,
        'icon-tilt',
        tiltOn ? 'Tilt Steer: ON' : 'Tilt Steer: OFF',
        'icon-sm'
      );
    }
    if (tiltStatusBadge) {
      tiltStatusBadge.textContent = tiltPermissionDenied
        ? 'Blocked'
        : !tiltOn
        ? 'Off'
        : hasDeviceOrientation
        ? 'Live Sensor'
        : 'Ready';
    }
    if (tiltDesc) {
      tiltDesc.textContent = tiltPermissionDenied
        ? 'Motion sensor permission was denied in browser settings; use </> arrow buttons or swipe.'
        : 'Lean your phone left or right to steer automatically while holding GAS/BRAKE or using </> arrows.';
    }
    if (sliderSensitivity) {
      sliderSensitivity.value = String(userSettings.sensitivity.toFixed(1));
    }
    if (sensitivityValueEl) {
      sensitivityValueEl.textContent = `${userSettings.sensitivity.toFixed(1)}x`;
    }
    syncSoundButtonsUi();
    applyDriveModeToHud();
    syncCoinDisplays();
  }

  function openSettings(source = 'home') {
    settingsSource = source;
    if (source === 'hud' && currentState === GAME_STATE.PLAYING) {
      pauseGame(false);
      settingsSource = 'pause';
    }
    if (source === 'pause' && pauseModal) {
      pauseModal.classList.add('hidden');
    }
    applySettingsUi();
    if (settingsModal) settingsModal.classList.remove('hidden');
  }

  function closeSettings() {
    if (settingsModal) settingsModal.classList.add('hidden');
    if (settingsSource === 'pause' && currentState === GAME_STATE.PAUSED && pauseModal) {
      pauseModal.classList.remove('hidden');
      setPauseMenuFocus(pauseFocusIndex);
    }
  }

  function setAboutTab(tabName) {
    aboutTabs.forEach((btn) => {
      const active = btn.dataset.aboutTab === tabName;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-selected', String(active));
    });
    aboutPanels.forEach((panel) => {
      panel.classList.toggle('hidden', panel.dataset.aboutPanel !== tabName);
    });
  }

  function openAbout(tabName = 'about') {
    setAboutTab(tabName);
    if (aboutModal) aboutModal.classList.remove('hidden');
  }

  function closeAbout() {
    if (aboutModal) aboutModal.classList.add('hidden');
  }

  function updateHudDisplay() {
    const roundedMeters = Math.floor(distanceMeters);
    const displayBest = Math.max(bestMeters, roundedMeters);
    const roundedKmh = Math.round(speedKmh);
    const gear = getGearForSpeed(roundedKmh);

    hudScoreEl.textContent = `${roundedMeters} m`;
    hudBestEl.textContent = `${displayBest} m`;
    if (hudCoinsEl) {
      hudCoinsEl.textContent = `${savedCoinBank.toLocaleString()}`;
    }
    hudSpeedEl.textContent = `${roundedKmh} km/h`;
    if (hudGearBadgeEl) {
      hudGearBadgeEl.textContent = `G${gear}`;
    }
    hudFpsEl.textContent = `${displayedFps} FPS`;

    if (comboTimer > 0 && comboChain > 0) {
      hudComboBadgeEl.classList.remove('hidden');
      hudComboTextEl.textContent =
        comboMultiplier >= 2
          ? `SHARP DODGE! x${comboMultiplier}`
          : `CLOSE CALL! x1`;
      hudComboFillEl.style.width = `${Math.max(0, Math.min(100, (comboTimer / COMBO.DURATION_SEC) * 100))}%`;
    } else {
      hudComboBadgeEl.classList.add('hidden');
    }
    renderPowerupHud();
  }

  function showScreen(targetState) {
    currentState = targetState;
    startScreen.classList.toggle('hidden', targetState !== GAME_STATE.START);
    if (targetState === GAME_STATE.START) {
      syncCoinDisplays();
      triggerTitleBonkAnimation();
    }
    hudScreen.classList.toggle(
      'hidden',
      targetState !== GAME_STATE.PLAYING && targetState !== GAME_STATE.PAUSED
    );
    gameoverScreen.classList.toggle('hidden', targetState !== GAME_STATE.GAMEOVER);
    if (pauseModal) {
      pauseModal.classList.toggle('hidden', targetState !== GAME_STATE.PAUSED);
    }
  }

  function pauseGame(showModalUi = true) {
    if (currentState !== GAME_STATE.PLAYING) return;
    currentState = GAME_STATE.PAUSED;
    stopHorn();
    if (playerProfile && playerProfile.accountType === 'registered') {
      leaderboardService.syncAccountCoins(playerProfile, savedCoinBank);
    }
    sound.updateEngine(0, false);
    keysHeld.throttle = false;
    keysHeld.brake = false;
    pedalsHeld.gas = false;
    pedalsHeld.brake = false;
    if (pedalBrakeEl) pedalBrakeEl.classList.remove('pressed');
    if (pedalGasEl) pedalGasEl.classList.remove('pressed');

    if (pauseDistanceEl) pauseDistanceEl.textContent = `${Math.floor(distanceMeters)} m`;
    if (pauseBestEl) pauseBestEl.textContent = `${Math.max(bestMeters, Math.floor(distanceMeters))} m`;
    if (pauseComboEl) pauseComboEl.textContent = `x${Math.max(1, comboMultiplier || 1)}`;
    if (pauseModal) {
      pauseModal.classList.toggle('hidden', !showModalUi);
      if (showModalUi) {
        setPauseMenuFocus(0);
      }
    }
  }

  function resumeGame() {
    if (currentState !== GAME_STATE.PAUSED) return;
    if (pauseModal) pauseModal.classList.add('hidden');
    getPauseMenuButtons().forEach((b) => b.classList.remove('kb-focus'));
    lastTimestamp = 0;
    showScreen(GAME_STATE.PLAYING);
    updateHudDisplay();
  }

  function returnToHomeScreen() {
    stopHorn();
    sound.updateEngine(0, false);
    keysHeld.throttle = false;
    keysHeld.brake = false;
    pedalsHeld.gas = false;
    pedalsHeld.brake = false;
    if (pedalBrakeEl) pedalBrakeEl.classList.remove('pressed');
    if (pedalGasEl) pedalGasEl.classList.remove('pressed');
    fuelBoostTimer = 0;
    shieldTimer = 0;
    magnetTimer = 0;
    celebrationTimer = 0;
    celebrationParticles = [];
    crashFlash = 0;
    crashShakeTimer = 0;
    rattleTimer = 0;
    targetLane = 1;
    currentLane = 1;
    leanNormalized = 0;
    handlebarAngle = 0;
    worldRollAngle = 0;
    suspensionPitch = 0;
    targetBestLineMeters = bestMeters;
    closeSettings();
    closeAbout();
    if (garageModal) garageModal.classList.add('hidden');
    if (window.BendskinUltra3D && typeof window.BendskinUltra3D.stopGaragePreview === 'function') {
      window.BendskinUltra3D.stopGaragePreview();
    }
    closeLeaderboard();
    closeAccountModal();
    updateHomeAccountUi();
    syncCoinDisplays();
    showScreen(GAME_STATE.START);
  }

  function triggerHighScoreCelebration() {
    celebrationTimer = 2.5;
    celebrationParticles = [];
    const colors = ['#facc15', '#4ade80', '#38bdf8', '#fb7185', '#f97316'];
    for (let i = 0; i < 36; i += 1) {
      const angle = -Math.PI + Math.random() * Math.PI;
      const speed = 90 + Math.random() * 190;
      celebrationParticles.push({
        x: 200 + (Math.random() - 0.5) * 80,
        y: getBottomY() - 120,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 60,
        size: 4 + Math.random() * 4,
        color: colors[i % colors.length],
        life: 1.5 + Math.random() * 0.9,
        maxLife: 2.4,
      });
    }
    addPopup('HOO YEAH! NEW HIGH SCORE!', 200, getHorizonY() + 108, '#fde047');
    sound.playHooYeahCelebration();
  }

  function startRun() {
    sound.unlock();
    requestTiltPermission();
    recenterTiltBaseline();

    playerZ = 0;
    distanceMeters = 0;
    bonusMetersTotal = 0;
    runCoins = 0;
    fuelBoostTimer = 0;
    shieldTimer = 0;
    magnetTimer = 0;
    stopHorn();
    speedKmh =
      userSettings.driveMode === 'manual'
        ? SPEED_CURVE.MANUAL_LAUNCH_KMH
        : SPEED_CURVE.LAUNCH_KMH;
    revivedThisRun = false;

    runDurationSeconds = 0;
    closeCallCount = 0;
    collectibleCount = 0;
    maxComboReached = 1;
    nextMilestoneTarget = 250;
    runMilestones = [];

    targetBestLineMeters = bestMeters;
    passedBestThisRun = false;
    celebrationTimer = 0;
    celebrationParticles = [];

    comboChain = 0;
    comboMultiplier = 1;
    comboTimer = 0;

    targetLane = 1;
    currentLane = 1;
    leanNormalized = 0;
    handlebarAngle = 0;
    worldRollAngle = 0;
    suspensionPitch = 0;
    steerCount = 0;
    rattleTimer = 0;
    crashFlash = 0;
    crashShakeTimer = 0;

    keysHeld.throttle = false;
    keysHeld.brake = false;
    pedalsHeld.gas = false;
    pedalsHeld.brake = false;
    if (pedalBrakeEl) pedalBrakeEl.classList.remove('pressed');
    if (pedalGasEl) pedalGasEl.classList.remove('pressed');

    entities = [];
    floatingPopups = [];
    lastOpenLane = 1;
    waveCount = 0;
    nextWaveWorldZ = 56;
    initAmbientWorld(0);

    if (hudHintPillEl) {
      hudHintPillEl.classList.remove('fade-out');
    }

    if (copyToastTimeoutId) {
      clearTimeout(copyToastTimeoutId);
      copyToastTimeoutId = null;
    }
    if (copyToastEl) {
      copyToastEl.classList.add('hidden');
    }

    if (rivalChallenge.active) {
      rivalChallenge.defeatedThisRun = false;
      if (hudRivalPill) {
        hudRivalPill.textContent = `RIVAL: ${rivalChallenge.targetMeters.toLocaleString()}m`;
        hudRivalPill.classList.remove('hidden', 'defeated');
      }
    } else if (hudRivalPill) {
      hudRivalPill.classList.add('hidden');
    }

    applyDriveModeToHud();
    leaderboardModal.classList.add('hidden');
    if (garageModal) garageModal.classList.add('hidden');
    closeAccountModal();
    closeSettings();
    closeAbout();
    showScreen(GAME_STATE.PLAYING);
    spawnWave(nextWaveWorldZ);
    nextWaveWorldZ += 42;
    updateHudDisplay();
  }

  let activeAuthMode = 'signup';
  let pendingStartAfterAuth = false;

  function showOnboardingFeedback(message, isError) {
    onboardingFeedback.textContent = message;
    onboardingFeedback.classList.remove('hidden', 'error', 'success');
    onboardingFeedback.classList.add(isError ? 'error' : 'success');
  }

  function showAccountStatus(message, isError) {
    if (!accountStatusMsg) return;
    if (!message) {
      accountStatusMsg.classList.add('hidden');
      accountStatusMsg.textContent = '';
      return;
    }
    accountStatusMsg.textContent = message;
    accountStatusMsg.classList.remove('hidden', 'error', 'success');
    accountStatusMsg.classList.add(isError ? 'error' : 'success');
  }

  function populateLocationSelect(selectEl, customInputEl, currentLocation) {
    if (!selectEl) return;
    const isKnown = SUPPORTED_LOCATIONS.includes(currentLocation);
    if (isKnown) {
      selectEl.value = currentLocation;
      if (customInputEl) customInputEl.classList.add('hidden');
    } else if (currentLocation && currentLocation !== 'Douala') {
      selectEl.value = 'Custom / Other';
      if (customInputEl) {
        customInputEl.value = currentLocation;
        customInputEl.classList.remove('hidden');
      }
    } else {
      selectEl.value = 'Douala';
      if (customInputEl) customInputEl.classList.add('hidden');
    }
  }

  function readSelectedLocation(selectEl, customInputEl) {
    if (!selectEl) return 'Douala';
    if (selectEl.value === 'Custom / Other') {
      return customInputEl ? customInputEl.value.trim() : '';
    }
    return selectEl.value;
  }

  function updateHomeAccountUi() {
    const isRegistered = playerProfile && playerProfile.accountType === 'registered';
    const isConfigured = Boolean(playerProfile && playerProfile.configured);
    if (homeAccountBadge) {
      homeAccountBadge.textContent = isRegistered ? 'ACCOUNT' : 'GUEST';
      homeAccountBadge.classList.toggle('registered', isRegistered);
      homeAccountBadge.classList.toggle('guest', !isRegistered);
    }
    if (homeAccountName) {
      homeAccountName.textContent =
        playerProfile && playerProfile.nickname ? playerProfile.nickname : 'Guest Rider';
    }
    if (homeAccountLocation) {
      homeAccountLocation.textContent = isConfigured
        ? (playerProfile.city || 'Douala')
        : 'Choose Location';
    }
  }

  function setAccountModalMode(mode) {
    activeAuthMode = mode === 'login' || mode === 'guest' ? mode : 'signup';
    if (tabAuthSignup) {
      tabAuthSignup.classList.toggle('active', activeAuthMode === 'signup');
      tabAuthSignup.setAttribute('aria-selected', String(activeAuthMode === 'signup'));
    }
    if (tabAuthLogin) {
      tabAuthLogin.classList.toggle('active', activeAuthMode === 'login');
      tabAuthLogin.setAttribute('aria-selected', String(activeAuthMode === 'login'));
    }
    if (tabAuthGuest) {
      tabAuthGuest.classList.toggle('active', activeAuthMode === 'guest');
      tabAuthGuest.setAttribute('aria-selected', String(activeAuthMode === 'guest'));
    }

    if (accountPasswordGroup) {
      accountPasswordGroup.classList.toggle('hidden', activeAuthMode === 'guest');
    }
    if (accountLocationGroup) {
      accountLocationGroup.classList.toggle('hidden', activeAuthMode === 'login');
    }
    if (accountCustomLocationGroup) {
      const showCustom =
        activeAuthMode !== 'login' &&
        accountLocation &&
        accountLocation.value === 'Custom / Other';
      accountCustomLocationGroup.classList.toggle('hidden', !showCustom);
    }

    if (accountModeSubtitle) {
      if (activeAuthMode === 'signup') {
        accountModeSubtitle.textContent =
          'Create a rider account with your username & location so your real scores persist everywhere.';
      } else if (activeAuthMode === 'login') {
        accountModeSubtitle.textContent =
          'Sign back into your saved Bendskin Rush username to restore your location & high score.';
      } else {
        accountModeSubtitle.textContent =
          'Pick your location and jump straight onto the road as a guest rider (or type an optional guest name).';
      }
    }

    if (accountUsername) {
      accountUsername.placeholder =
        activeAuthMode === 'guest'
          ? 'Optional guest name (or leave blank)'
          : 'e.g. MotoKing237 (2-15 chars)';
    }

    if (btnAccountSubmit) {
      if (activeAuthMode === 'signup') {
        setButtonIconAndText(
          btnAccountSubmit,
          'icon-check',
          pendingStartAfterAuth ? 'CREATE ACCOUNT & RIDE' : 'CREATE ACCOUNT & SAVE'
        );
      } else if (activeAuthMode === 'login') {
        setButtonIconAndText(
          btnAccountSubmit,
          'icon-rider',
          pendingStartAfterAuth ? 'LOG IN & RIDE' : 'LOG IN'
        );
      } else {
        setButtonIconAndText(
          btnAccountSubmit,
          'icon-play',
          pendingStartAfterAuth ? 'CONTINUE AS GUEST & RIDE' : 'SAVE GUEST LOCATION'
        );
      }
    }

    if (btnAccountQuickGuest) {
      btnAccountQuickGuest.classList.toggle('hidden', activeAuthMode === 'guest');
    }

    showAccountStatus('', false);
  }

  function openAccountModal(mode = 'signup', options = { startAfterSave: false }) {
    if (!accountModal) return;
    pendingStartAfterAuth = Boolean(options && options.startAfterSave);
    if (accountUsername) {
      const hasCustomNick =
        playerProfile.nickname && !playerProfile.nickname.startsWith('Guest_');
      accountUsername.value = hasCustomNick ? playerProfile.nickname : '';
    }
    if (accountPassword) {
      accountPassword.value = '';
    }
    if (accountLocation) {
      const isKnown = SUPPORTED_LOCATIONS.includes(playerProfile.city);
      accountLocation.value = isKnown ? playerProfile.city : 'Custom / Other';
      if (accountCustomLocation) {
        accountCustomLocation.value = isKnown ? '' : playerProfile.city || '';
      }
    }
    setAccountModalMode(mode);
    accountModal.classList.remove('hidden');
  }

  function closeAccountModal(clearPending = true) {
    if (accountModal) accountModal.classList.add('hidden');
    if (clearPending) pendingStartAfterAuth = false;
    showAccountStatus('', false);
  }

  function activateAccountSession(nextProfile, { serverBest = null, serverCoins = null, isFreshAccount = false } = {}) {
    const prevPid = playerProfile && playerProfile.playerId;
    if (prevPid) {
      saveCoinBank(savedCoinBank, prevPid);
      saveBestScore(bestMeters, prevPid);
    }

    playerProfile = nextProfile;
    leaderboardService.saveProfile(playerProfile);
    if (playerProfile.accountType !== 'registered' && playerProfile.playerId) {
      try {
        localStorage.setItem(STORAGE_GUEST_ID_KEY, playerProfile.playerId);
      } catch {
        // Ignore storage error
      }
    }

    const nextPid = playerProfile.playerId;
    if (isFreshAccount) {
      savedCoinBank = 0;
      bestMeters = 0;
      runCoins = 0;
    } else {
      const localCoins = loadCoinBank(nextPid);
      const cloudCoins = typeof serverCoins === 'number' && Number.isFinite(serverCoins)
        ? Math.max(0, Math.floor(serverCoins))
        : 0;
      savedCoinBank = Math.max(localCoins, cloudCoins);

      const localBest = loadBestScore(nextPid);
      const cloudBest = typeof serverBest === 'number' && Number.isFinite(serverBest)
        ? Math.max(0, Math.floor(serverBest))
        : 0;
      bestMeters = Math.max(localBest, cloudBest);
      runCoins = 0;
    }

    saveCoinBank(savedCoinBank, nextPid);
    saveBestScore(bestMeters, nextPid);
    targetBestLineMeters = bestMeters;
    syncCoinDisplays();
    updateHudDisplay();
    updateHomeAccountUi();
  }

  async function handleAccountSubmit() {
    if (!btnAccountSubmit) return;
    const rawUsername = accountUsername ? accountUsername.value.trim() : '';
    const rawPassword = accountPassword ? accountPassword.value : '';
    const rawLocation = readSelectedLocation(accountLocation, accountCustomLocation);

    if (activeAuthMode === 'guest') {
      const locCheck = leaderboardService.sanitizeLocation(rawLocation);
      if (!locCheck.valid) {
        showAccountStatus(locCheck.reason, true);
        return;
      }
      const guestPid = getOrCreateGuestPlayerId();
      let guestName = '';
      if (rawUsername) {
        const nickCheck = leaderboardService.sanitizeAndValidateNickname(rawUsername);
        if (!nickCheck.valid) {
          showAccountStatus(nickCheck.reason, true);
          return;
        }
        guestName = nickCheck.nickname;
      } else {
        const suffix = (guestPid || 'R237').slice(-4).toUpperCase();
        guestName = `Guest_${suffix}`;
      }
      activateAccountSession(
        {
          playerId: guestPid,
          nickname: guestName,
          city: locCheck.location,
          accountType: 'guest',
          configured: true,
        },
        { isFreshAccount: false }
      );
      const shouldStart = pendingStartAfterAuth;
      closeAccountModal(true);
      if (shouldStart) {
        startRun();
      }
      return;
    }

    btnAccountSubmit.disabled = true;
    setButtonIconAndText(btnAccountSubmit, 'icon-rider', 'CONNECTING...');
    showAccountStatus('', false);

    let outcome;
    if (activeAuthMode === 'signup') {
      outcome = await leaderboardService.registerAccount({
        username: rawUsername,
        password: rawPassword,
        location: rawLocation,
        playerId: leaderboardService.generatePlayerId(),
        highScore: 0,
      });
    } else {
      outcome = await leaderboardService.loginAccount({
        username: rawUsername,
        password: rawPassword,
      });
    }

    btnAccountSubmit.disabled = false;
    setAccountModalMode(activeAuthMode);

    if (!outcome || !outcome.ok) {
      showAccountStatus((outcome && outcome.error) || 'Authentication failed.', true);
      return;
    }

    activateAccountSession(
      {
        playerId: outcome.profile.playerId,
        nickname: outcome.profile.nickname,
        city: outcome.profile.city,
        accountType: 'registered',
        configured: true,
      },
      {
        serverBest: Number(outcome.highScore || 0),
        serverCoins: Number(outcome.coins || 0),
        isFreshAccount: activeAuthMode === 'signup',
      }
    );
    updateProfileStrip('Account Synced');
    const shouldStart = pendingStartAfterAuth;
    closeAccountModal(true);
    if (shouldStart) {
      startRun();
    }
  }

  function handleQuickGuest() {
    const rawLocation = readSelectedLocation(accountLocation, accountCustomLocation);
    const locCheck = leaderboardService.sanitizeLocation(rawLocation);
    const chosenLocation = locCheck.valid ? locCheck.location : 'Douala';
    const rawUsername = accountUsername ? accountUsername.value.trim() : '';
    const guestPid = getOrCreateGuestPlayerId();
    let guestName = '';
    if (rawUsername) {
      const nickCheck = leaderboardService.sanitizeAndValidateNickname(rawUsername);
      if (nickCheck.valid) guestName = nickCheck.nickname;
    }
    if (!guestName) {
      const suffix = (guestPid || 'R237').slice(-4).toUpperCase();
      guestName = `Guest_${suffix}`;
    }

    activateAccountSession(
      {
        playerId: guestPid,
        nickname: guestName,
        city: chosenLocation,
        accountType: 'guest',
        configured: true,
      },
      { isFreshAccount: false }
    );
    const shouldStart = pendingStartAfterAuth;
    closeAccountModal(true);
    if (shouldStart) {
      startRun();
    }
  }

  function handlePlayPressed() {
    sound.unlock();
    if (!playerProfile || !playerProfile.configured) {
      openAccountModal('signup', { startAfterSave: true });
      return;
    }
    startRun();
  }

  function updateProfileStrip(statusText) {
    const tagRole = playerProfile.accountType === 'registered' ? 'RIDER' : 'GUEST';
    playerTagLabel.textContent = `${tagRole}: ${playerProfile.nickname || 'Guest Rider'} • ${playerProfile.city}`;
    cloudSyncStatus.textContent = statusText || 'Verified';
    playerTagBar.classList.remove('hidden');
  }

  function buildSubmissionPayload(scoreToSubmit, durationSeconds) {
    const safeDuration = Math.max(ANTI_CHEAT.MIN_RUN_SECONDS, Number(durationSeconds) || ANTI_CHEAT.MIN_RUN_SECONDS);
    const payload = {
      playerId: playerProfile.playerId,
      nickname: playerProfile.nickname,
      city: playerProfile.city,
      accountType: playerProfile.accountType || 'guest',
      highScore: Math.max(1, Math.floor(scoreToSubmit)),
      maxCombo: Math.max(1, maxComboReached),
      runDurationSeconds: Number(safeDuration.toFixed(2)),
      milestoneCount: runMilestones.length,
    };
    payload.signature = leaderboardService.computeRunSignature(payload);
    return payload;
  }

  function triggerGameOver(withCrashImpact) {
    const finalMeters = Math.max(1, Math.floor(distanceMeters));
    const beatPrevRecord = finalMeters > bestMeters;
    if (beatPrevRecord) {
      bestMeters = finalMeters;
      saveBestScore(bestMeters, playerProfile && playerProfile.playerId);
      if (!passedBestThisRun && !withCrashImpact) {
        triggerHighScoreCelebration();
      } else if (!passedBestThisRun && finalMeters >= 25) {
        sound.playHooYeahCelebration();
      }
    }
    if (playerProfile && playerProfile.accountType === 'registered') {
      leaderboardService.syncAccountCoins(playerProfile, savedCoinBank);
    }

    if (withCrashImpact) {
      crashFlash = 1.0;
      crashShakeTimer = 0.25;
      sound.playCrash();
    }

    stopHorn();
    fuelBoostTimer = 0;
    shieldTimer = 0;
    magnetTimer = 0;
    renderPowerupHud();
    sound.updateEngine(0, false);
    keysHeld.throttle = false;
    keysHeld.brake = false;
    pedalsHeld.gas = false;
    pedalsHeld.brake = false;
    if (pedalBrakeEl) pedalBrakeEl.classList.remove('pressed');
    if (pedalGasEl) pedalGasEl.classList.remove('pressed');

    if (btnReviveAd) {
      btnReviveAd.classList.toggle('hidden', revivedThisRun);
      btnReviveAd.disabled = false;
      setButtonIconAndText(btnReviveAd, 'icon-revive', 'WATCH AD TO REVIVE (+CONTINUE)');
    }

    finalScoreEl.textContent = `${finalMeters} m`;
    finalBestEl.textContent = `${bestMeters} m`;

    const rankInfo = leaderboardService.getPlayerRankSummary(
      playerProfile.playerId,
      Math.max(finalMeters, bestMeters),
      playerProfile.city
    );

    cityRankEl.textContent = `Rank #${rankInfo.nationalRank} of ${rankInfo.totalPlayers} Global • #${rankInfo.cityRank} in ${playerProfile.city}`;

    lastRunSummary = {
      score: finalMeters,
      bestScore: bestMeters,
      durationSeconds: Math.max(ANTI_CHEAT.MIN_RUN_SECONDS, runDurationSeconds),
      maxCombo: maxComboReached,
      milestoneCount: runMilestones.length,
    };

    onboardingFeedback.classList.add('hidden');

    if (!playerProfile.nickname) {
      // Fallback onboarding prompt if rider skipped entering a name
      onboardingRankTitle.textContent = `You placed #${rankInfo.nationalRank} Global! Enter your Rider Name & Location to save your real score:`;
      populateLocationSelect(selectCity, onboardingCustomCity, playerProfile.city);
      inputNickname.value = '';
      onboardingCard.classList.remove('hidden');
      playerTagBar.classList.add('hidden');
    } else {
      onboardingCard.classList.add('hidden');
      const submission = buildSubmissionPayload(finalMeters, lastRunSummary.durationSeconds);
      const result = leaderboardService.submitScore(submission, { allowMetadataOnly: false });

      if (result.accepted && result.updated) {
        updateProfileStrip('New PB Synced!');
      } else if (result.accepted) {
        updateProfileStrip('PB Stands');
      } else {
        updateProfileStrip('Check Rejected');
      }
    }

    if (copyToastTimeoutId) {
      clearTimeout(copyToastTimeoutId);
      copyToastTimeoutId = null;
    }
    if (copyToastEl) {
      copyToastEl.classList.add('hidden');
    }

    if (rivalGameoverBanner) {
      rivalGameoverBanner.classList.remove('hidden', 'won');
      if (rivalChallenge.active) {
        const beatRival = rivalChallenge.defeatedThisRun || finalMeters >= rivalChallenge.targetMeters;
        if (beatRival) {
          rivalGameoverBanner.classList.add('won');
          const margin = Math.max(0, finalMeters - rivalChallenge.targetMeters);
          rivalGameoverBanner.textContent = margin > 0
            ? `RIVAL DEFEATED! You beat ${rivalChallenge.rivalName} by +${margin.toLocaleString()}m - send revenge!`
            : `TARGET MATCHED! You caught ${rivalChallenge.rivalName} at ${rivalChallenge.targetMeters.toLocaleString()}m!`;
        } else {
          const gap = rivalChallenge.targetMeters - finalMeters;
          rivalGameoverBanner.textContent = `${rivalChallenge.rivalName} (${rivalChallenge.rivalCity}) still leads by ${gap.toLocaleString()}m - tap RIDE AGAIN for revenge!`;
        }
      } else {
        rivalGameoverBanner.classList.add('hidden');
      }
    }

    showScreen(GAME_STATE.GAMEOVER);
  }

  function handleSaveProfile() {
    const nickCheck = leaderboardService.sanitizeAndValidateNickname(inputNickname.value);
    if (!nickCheck.valid) {
      showOnboardingFeedback(nickCheck.reason, true);
      return;
    }

    const rawCity = readSelectedLocation(selectCity, onboardingCustomCity);
    const locCheck = leaderboardService.sanitizeLocation(rawCity);
    if (!locCheck.valid) {
      showOnboardingFeedback(locCheck.reason, true);
      return;
    }

    playerProfile.nickname = nickCheck.nickname;
    playerProfile.city = locCheck.location;
    playerProfile.configured = true;
    leaderboardService.saveProfile(playerProfile);
    updateHomeAccountUi();

    const scoreToSubmit = lastRunSummary
      ? Math.max(lastRunSummary.score, lastRunSummary.bestScore)
      : Math.max(1, bestMeters);
    const durationToUse = lastRunSummary
      ? Math.max(lastRunSummary.durationSeconds, scoreToSubmit / 65)
      : Math.max(5, scoreToSubmit / 65);

    const payload = buildSubmissionPayload(scoreToSubmit, durationToUse);
    const result = leaderboardService.submitScore(payload, { allowMetadataOnly: true });

    if (!result.accepted) {
      showOnboardingFeedback(result.reason, true);
      return;
    }

    const rankInfo = leaderboardService.getPlayerRankSummary(
      playerProfile.playerId,
      result.record.highScore,
      playerProfile.city
    );
    cityRankEl.textContent = `Rank #${rankInfo.nationalRank} of ${rankInfo.totalPlayers} Global • #${rankInfo.cityRank} in ${playerProfile.city}`;

    onboardingCard.classList.add('hidden');
    updateProfileStrip('Saved to Board!');
  }

  function renderLocationFilterChips() {
    if (!cityFilterRow) return;
    const locations = leaderboardService.getActiveLocations(
      playerProfile && playerProfile.configured ? playerProfile.city : ''
    );
    const filterItems = ['All', ...locations];
    if (!filterItems.includes(selectedCityFilter)) {
      selectedCityFilter = 'All';
    }
    cityFilterRow.innerHTML = '';
    filterItems.forEach((loc) => {
      const btn = document.createElement('button');
      btn.className = loc === selectedCityFilter ? 'city-chip active' : 'city-chip';
      btn.type = 'button';
      btn.dataset.city = loc;
      btn.textContent = loc === 'All' ? 'All Locations' : loc;
      cityFilterRow.appendChild(btn);
    });
  }

  function createEmptyLeaderboardItem(title, desc) {
    const li = document.createElement('li');
    li.className = 'leaderboard-empty-state';
    const titleEl = document.createElement('span');
    titleEl.className = 'leaderboard-empty-title';
    titleEl.textContent = title;
    const descEl = document.createElement('span');
    descEl.className = 'leaderboard-empty-desc';
    descEl.textContent = desc;
    li.appendChild(titleEl);
    li.appendChild(descEl);
    return li;
  }

  function renderLeaderboard() {
    leaderboardListEl.innerHTML = '';

    const showCityFilters = activeLeaderboardTab === 'riders';
    cityFilterRow.classList.toggle('hidden', !showCityFilters);
    if (showCityFilters) {
      renderLocationFilterChips();
    }
    tabTopRiders.classList.toggle('active', activeLeaderboardTab === 'riders');
    tabCityWar.classList.toggle('active', activeLeaderboardTab === 'citywar');
    tabTopRiders.setAttribute('aria-selected', String(activeLeaderboardTab === 'riders'));
    tabCityWar.setAttribute('aria-selected', String(activeLeaderboardTab === 'citywar'));

    if (activeLeaderboardTab === 'riders') {
      const rows = leaderboardService.getTopRiders(selectedCityFilter);
      modalFootnoteEl.textContent =
        rows.length > 0
          ? `${rows.length} Verified Rider${rows.length > 1 ? 's' : ''} • Live Cloud Sync`
          : '100% Real Riders Only • No pre-seeded scores';

      if (rows.length === 0) {
        const msgTitle =
          selectedCityFilter === 'All'
            ? 'Leaderboard Waiting for First Rider'
            : `No Riders in ${selectedCityFilter} Yet`;
        const msgDesc =
          selectedCityFilter === 'All'
            ? 'Nobody has completed a recorded run yet. Hit PLAY, finish a ride, and claim Rank #1!'
            : `Be the first rider to represent ${selectedCityFilter} on the live standings.`;
        leaderboardListEl.appendChild(createEmptyLeaderboardItem(msgTitle, msgDesc));
        return;
      }

      rows.forEach((entry, index) => {
        const isMe = entry.playerId === playerProfile.playerId;
        const li = document.createElement('li');
        li.className = isMe ? 'lb-row is-me' : 'lb-row';

        const left = document.createElement('div');
        left.className = 'lb-left';

        const rankSpan = document.createElement('span');
        rankSpan.className = 'lb-rank';
        rankSpan.textContent = `#${index + 1}`;

        const playerDiv = document.createElement('div');
        playerDiv.className = 'lb-player';

        const nameSpan = document.createElement('span');
        nameSpan.className = 'lb-name';
        nameSpan.textContent = entry.nickname;

        if (isMe) {
          const youPill = document.createElement('span');
          youPill.className = 'lb-you-pill';
          youPill.textContent = 'YOU';
          nameSpan.appendChild(youPill);
        }

        const citySpan = document.createElement('span');
        citySpan.className = 'lb-city';
        const cityBadge = document.createElement('span');
        cityBadge.className = 'lb-city-badge';
        cityBadge.textContent = entry.city;
        citySpan.appendChild(cityBadge);

        playerDiv.appendChild(nameSpan);
        playerDiv.appendChild(citySpan);
        left.appendChild(rankSpan);
        left.appendChild(playerDiv);

        const scoreSpan = document.createElement('span');
        scoreSpan.className = 'lb-score';
        scoreSpan.textContent = `${entry.highScore} m`;

        li.appendChild(left);
        li.appendChild(scoreSpan);
        leaderboardListEl.appendChild(li);
      });
    } else {
      const standings = leaderboardService.getCityWarStandings(playerProfile.city);
      const topTotal = standings.length > 0 ? standings[0].totalScore : 1;
      modalFootnoteEl.textContent =
        standings.length > 0
          ? 'Location Wars aggregates real Top 20 riders per location'
          : '100% Real Locations Only • Ride to put your location on the map';

      if (standings.length === 0) {
        leaderboardListEl.appendChild(
          createEmptyLeaderboardItem(
            'City / Location Wars Waiting to Start',
            'Choose your location in Account / Location and complete a run to score points for your city or country!'
          )
        );
        return;
      }

      standings.forEach((cityStat, index) => {
        const li = document.createElement('li');
        li.className = cityStat.isMyCity ? 'city-war-row is-my-city' : 'city-war-row';

        const topRow = document.createElement('div');
        topRow.className = 'city-war-top';

        const meta = document.createElement('div');
        meta.className = 'city-war-meta';

        const rankSpan = document.createElement('span');
        rankSpan.className = 'lb-rank';
        rankSpan.textContent = `#${index + 1}`;

        const nameSpan = document.createElement('span');
        nameSpan.className = 'city-war-name';
        nameSpan.textContent = cityStat.city;

        meta.appendChild(rankSpan);
        meta.appendChild(nameSpan);

        if (cityStat.isMyCity) {
          const youPill = document.createElement('span');
          youPill.className = 'lb-you-pill';
          youPill.textContent = 'YOUR LOCATION';
          meta.appendChild(youPill);
        }

        const totalSpan = document.createElement('span');
        totalSpan.className = 'lb-score';
        totalSpan.textContent = `${cityStat.totalScore.toLocaleString()} pts`;

        topRow.appendChild(meta);
        topRow.appendChild(totalSpan);

        const statsRow = document.createElement('div');
        statsRow.className = 'city-war-stats';

        const ridersSpan = document.createElement('span');
        ridersSpan.textContent = `${cityStat.riderCount} rider${cityStat.riderCount > 1 ? 's' : ''} • Lead: ${cityStat.topRider}`;

        const avgSpan = document.createElement('span');
        avgSpan.textContent = `Avg: ${cityStat.avgScore} m`;

        statsRow.appendChild(ridersSpan);
        statsRow.appendChild(avgSpan);

        const barTrack = document.createElement('div');
        barTrack.className = 'city-war-bar-track';
        const barFill = document.createElement('div');
        barFill.className = 'city-war-bar-fill';
        barFill.style.width = `${Math.max(8, Math.round((cityStat.totalScore / topTotal) * 100))}%`;
        barTrack.appendChild(barFill);

        li.appendChild(topRow);
        li.appendChild(statsRow);
        li.appendChild(barTrack);
        leaderboardListEl.appendChild(li);
      });
    }
  }

  function openLeaderboard() {
    renderLeaderboard();
    leaderboardModal.classList.remove('hidden');
    leaderboardService.syncFromFirestore().then((updated) => {
      if (updated && !leaderboardModal.classList.contains('hidden')) {
        renderLeaderboard();
      }
    });
  }

  function closeLeaderboard() {
    leaderboardModal.classList.add('hidden');
  }

  function getShareScore() {
    if (lastRunSummary && typeof lastRunSummary.score === 'number' && lastRunSummary.score > 0) {
      return Math.floor(lastRunSummary.score);
    }
    return Math.max(1, Math.floor(distanceMeters || bestMeters || 1));
  }

  function buildChallengeUrl(score) {
    const url = new URL(window.location.href);
    url.search = '';
    url.hash = '';
    const riderName = (playerProfile.nickname && playerProfile.nickname.trim())
      ? playerProfile.nickname.trim()
      : 'BendskinRider';
    const cityLabel = playerProfile.city || 'Douala';
    const targetScore = Math.max(1, Math.floor(score || 1));

    url.searchParams.set('rival', riderName);
    url.searchParams.set('target', String(targetScore));
    url.searchParams.set('city', cityLabel);
    return url.toString();
  }

  function buildChallengeMessage(score) {
    const cityLabel = playerProfile.city || 'Cameroon';
    const rankInfo = leaderboardService.getPlayerRankSummary(
      playerProfile.playerId,
      Math.max(score, bestMeters),
      cityLabel
    );
    const challengeUrl = buildChallengeUrl(score);

    if (rivalChallenge.active && score >= rivalChallenge.targetMeters) {
      return `I just beat ${rivalChallenge.rivalName}'s ${rivalChallenge.targetMeters.toLocaleString()}m target with ${score.toLocaleString()}m in Bendskin Rush (Rank #${rankInfo.cityRank} in ${cityLabel})! Who dares try next? ${challengeUrl}`;
    }
    return `I just rode ${score.toLocaleString()}m in Bendskin Rush (Rank #${rankInfo.cityRank} in ${cityLabel})! Bet you can't beat my score without crashing into a yellow taxi: ${challengeUrl}`;
  }

  function shareOnWhatsapp() {
    const score = getShareScore();
    const shareText = buildChallengeMessage(score);
    const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(shareText)}`;
    window.open(waUrl, '_blank', 'noopener,noreferrer');
  }

  async function copyChallengeLink() {
    const score = getShareScore();
    const challengeUrl = buildChallengeUrl(score);
    let copied = false;

    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      try {
        await navigator.clipboard.writeText(challengeUrl);
        copied = true;
      } catch (_err) {
        copied = false;
      }
    }

    if (!copied) {
      try {
        const tempInput = document.createElement('textarea');
        tempInput.value = challengeUrl;
        tempInput.setAttribute('readonly', '');
        tempInput.style.position = 'fixed';
        tempInput.style.opacity = '0';
        document.body.appendChild(tempInput);
        tempInput.select();
        copied = document.execCommand('copy');
        document.body.removeChild(tempInput);
      } catch (_err) {
        copied = false;
      }
    }

    if (copyToastEl) {
      if (copyToastTimeoutId) {
        clearTimeout(copyToastTimeoutId);
      }
      copyToastEl.textContent = copied
        ? 'Copied! Paste in TikTok bio or group chat'
        : 'Copy blocked — tap Challenge on WhatsApp above';
      copyToastEl.classList.remove('hidden');
      copyToastTimeoutId = window.setTimeout(() => {
        copyToastEl.classList.add('hidden');
      }, 3000);
    }
  }

  function completeReviveResume() {
    revivedThisRun = true;
    // Clear any hazards within 48m ahead so rider resumes safely
    entities = entities.filter(
      (ent) => ENTITY_CONFIG[ent.type].kind !== 'hazard' || ent.worldZ - playerZ > 48
    );
    nextWaveWorldZ = Math.max(nextWaveWorldZ, playerZ + 62);
    speedKmh =
      userSettings.driveMode === 'manual'
        ? Math.max(45, speedKmh * 0.7)
        : Math.max(SPEED_CURVE.LAUNCH_KMH, speedKmh * 0.8);
    crashFlash = 0;
    crashShakeTimer = 0;
    comboTimer = 0;
    comboChain = 0;
    comboMultiplier = 1;
    addPopup('REVIVED! RIDE ON!', 200, getHorizonY() + 130, '#38bdf8');
    showScreen(GAME_STATE.PLAYING);
    updateHudDisplay();
  }

  function handleRewardedRevive() {
    if (revivedThisRun || !btnReviveAd) return;
    btnReviveAd.disabled = true;
    setButtonIconAndText(btnReviveAd, 'icon-revive', 'LOADING AD REWARD...');

    if (typeof window.adBreak === 'function') {
      try {
        window.adBreak({
          type: 'reward',
          name: 'bendskin_revive',
          beforeReward: (showAdFn) => showAdFn(),
          adViewed: () => completeReviveResume(),
          adDismissed: () => {
            btnReviveAd.disabled = false;
            setButtonIconAndText(btnReviveAd, 'icon-revive', 'WATCH AD TO REVIVE (+CONTINUE)');
          },
          adBreakDone: (placementInfo) => {
            if (placementInfo && placementInfo.breakStatus !== 'viewed' && currentState === GAME_STATE.GAMEOVER) {
              btnReviveAd.disabled = false;
              setButtonIconAndText(btnReviveAd, 'icon-revive', 'WATCH AD TO REVIVE (+CONTINUE)');
            }
          },
        });
        return;
      } catch (_err) {
        // Fall through to simulated reward preview when offline
      }
    }

    window.setTimeout(completeReviveResume, 650);
  }

  btnStart.addEventListener('click', handlePlayPressed);
  btnRestart.addEventListener('click', startRun);
  if (btnReviveAd) {
    btnReviveAd.addEventListener('click', handleRewardedRevive);
  }
  btnTestGameover.addEventListener('click', () => triggerGameOver(true));
  btnOpenLeaderboard.addEventListener('click', openLeaderboard);
  if (btnPause) {
    btnPause.addEventListener('click', () => pauseGame(true));
  }
  if (btnClosePause) {
    btnClosePause.addEventListener('click', resumeGame);
  }
  if (btnResume) {
    btnResume.addEventListener('click', resumeGame);
  }
  if (btnPauseSettings) {
    btnPauseSettings.addEventListener('click', () => openSettings('pause'));
  }
  if (btnPauseRestart) {
    btnPauseRestart.addEventListener('click', startRun);
  }
  if (btnPauseHome) {
    btnPauseHome.addEventListener('click', returnToHomeScreen);
  }
  if (btnOpenSettings) {
    btnOpenSettings.addEventListener('click', () => openSettings('home'));
  }
  if (btnHudSettings) {
    btnHudSettings.addEventListener('click', () => openSettings('hud'));
  }
  if (btnGameoverHome) {
    btnGameoverHome.addEventListener('click', returnToHomeScreen);
  }
  if (btnGameoverSettings) {
    btnGameoverSettings.addEventListener('click', () => openSettings('gameover'));
  }
  if (btnOpenAbout) {
    btnOpenAbout.addEventListener('click', () => openAbout('about'));
  }
  const GARAGE_BIKE_META = {
    classic: {
      name: 'Bendskin Classic 125',
      specs: '125cc Street • Nimble Crimson-Gold Chassis',
    },
    sport: {
      name: 'Okada Sport 250',
      specs: '250cc Sport • Twin Discs & Agile Handling',
    },
    superbike: {
      name: 'Douala Superbike 600',
      specs: '600cc Champion • Carbon & Championship Gold',
    },
  };
  let previewGarageBikeId = 'classic';

  function selectGaragePreviewBike(bikeId) {
    const id = GARAGE_BIKE_META[bikeId] ? bikeId : 'classic';
    previewGarageBikeId = id;
    const meta = GARAGE_BIKE_META[id];
    if (garagePreviewName) garagePreviewName.textContent = meta.name;
    if (garagePreviewSpecs) garagePreviewSpecs.textContent = meta.specs;
    if (garageBikeCards) {
      garageBikeCards.forEach((card) => {
        card.classList.toggle('preview-selected', card.dataset.garageBike === id);
      });
    }
    if (window.BendskinUltra3D && typeof window.BendskinUltra3D.setGarageBike === 'function') {
      window.BendskinUltra3D.setGarageBike(id);
    }
  }

  function openGarageModal() {
    if (!garageModal) return;
    syncCoinDisplays();
    garageModal.classList.remove('hidden');
    selectGaragePreviewBike(previewGarageBikeId);
    if (
      garageBikeCanvas &&
      window.BendskinUltra3D &&
      typeof window.BendskinUltra3D.initGaragePreview === 'function'
    ) {
      window.BendskinUltra3D.initGaragePreview(garageBikeCanvas, previewGarageBikeId);
    }
  }

  function closeGarageModal() {
    if (garageModal) garageModal.classList.add('hidden');
    if (window.BendskinUltra3D && typeof window.BendskinUltra3D.stopGaragePreview === 'function') {
      window.BendskinUltra3D.stopGaragePreview();
    }
  }

  if (btnOpenGarage && garageModal) {
    btnOpenGarage.addEventListener('click', openGarageModal);
  }
  if (btnCloseGarage && garageModal) {
    btnCloseGarage.addEventListener('click', closeGarageModal);
  }
  if (garageModal) {
    garageModal.addEventListener('click', (event) => {
      if (event.target === garageModal) closeGarageModal();
    });
  }
  if (garageBikeCards) {
    garageBikeCards.forEach((card) => {
      card.addEventListener('click', () => selectGaragePreviewBike(card.dataset.garageBike));
      card.addEventListener('keydown', (ev) => {
        if (ev.key === 'Enter' || ev.key === ' ') {
          ev.preventDefault();
          selectGaragePreviewBike(card.dataset.garageBike);
        }
      });
    });
  }
  btnGameoverLeaderboard.addEventListener('click', openLeaderboard);
  btnCloseLeaderboard.addEventListener('click', closeLeaderboard);
  if (btnCloseSettings) btnCloseSettings.addEventListener('click', closeSettings);
  if (btnSaveSettings) btnSaveSettings.addEventListener('click', closeSettings);
  if (btnCloseAbout) btnCloseAbout.addEventListener('click', closeAbout);

  qualityButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const nextQual = btn.dataset.quality;
      if (!GRAPHICS_QUALITIES.includes(nextQual)) return;
      userSettings.graphicsQuality = nextQual;
      saveSettings(userSettings);
      resizeCanvas();
      applySettingsUi();
    });
  });

  if (btnModeAuto) {
    btnModeAuto.addEventListener('click', () => {
      userSettings.driveMode = 'auto';
      saveSettings(userSettings);
      applySettingsUi();
    });
  }
  if (btnModeManual) {
    btnModeManual.addEventListener('click', () => {
      userSettings.driveMode = 'manual';
      saveSettings(userSettings);
      applySettingsUi();
    });
  }
  if (btnHandRight) {
    btnHandRight.addEventListener('click', () => {
      userSettings.controlHandedness = 'right';
      saveSettings(userSettings);
      applySettingsUi();
    });
  }
  if (btnHandLeft) {
    btnHandLeft.addEventListener('click', () => {
      userSettings.controlHandedness = 'left';
      saveSettings(userSettings);
      applySettingsUi();
    });
  }
  if (btnHudTilt) {
    btnHudTilt.addEventListener('click', () => {
      sound.unlock();
      userSettings.tiltSteering = !userSettings.tiltSteering;
      if (userSettings.tiltSteering) {
        requestTiltPermission();
        recenterTiltBaseline();
      }
      saveSettings(userSettings);
      applySettingsUi();
    });
  }
  if (btnTiltToggle) {
    btnTiltToggle.addEventListener('click', () => {
      userSettings.tiltSteering = !userSettings.tiltSteering;
      if (userSettings.tiltSteering) {
        requestTiltPermission();
        recenterTiltBaseline();
      }
      saveSettings(userSettings);
      applySettingsUi();
    });
  }
  if (btnTiltCalibrate) {
    btnTiltCalibrate.addEventListener('click', () => {
      requestTiltPermission();
      recenterTiltBaseline();
      applySettingsUi();
      if (tiltStatusBadge) tiltStatusBadge.textContent = 'Centered!';
    });
  }
  if (sliderSensitivity) {
    sliderSensitivity.addEventListener('input', () => {
      const nextVal = Math.max(0.5, Math.min(2.0, Number(sliderSensitivity.value) || 1.0));
      userSettings.sensitivity = Math.round(nextVal * 10) / 10;
      saveSettings(userSettings);
      applySettingsUi();
    });
  }
  if (btnSettingsSound) {
    btnSettingsSound.addEventListener('click', () => {
      userSettings.soundMuted = sound.toggleMute();
      saveSettings(userSettings);
      syncSoundButtonsUi();
    });
  }

  aboutTabs.forEach((tabBtn) => {
    tabBtn.addEventListener('click', () => {
      setAboutTab(tabBtn.dataset.aboutTab || 'about');
    });
  });

  policyLinks.forEach((linkBtn) => {
    linkBtn.addEventListener('click', () => {
      openAbout(linkBtn.dataset.aboutTab || 'about');
    });
  });

    if (pauseModal) {
      pauseModal.addEventListener('click', (event) => {
        if (event.target === pauseModal) resumeGame();
      });
    }
    if (settingsModal) {
      settingsModal.addEventListener('click', (event) => {
        if (event.target === settingsModal) closeSettings();
      });
    }
  if (aboutModal) {
    aboutModal.addEventListener('click', (event) => {
      if (event.target === aboutModal) closeAbout();
    });
  }

  btnWhatsapp.addEventListener('click', shareOnWhatsapp);
  if (btnCopyLink) {
    btnCopyLink.addEventListener('click', copyChallengeLink);
  }
  btnSaveProfile.addEventListener('click', handleSaveProfile);

  inputNickname.addEventListener('keydown', (event) => {
    if (event.code === 'Enter') {
      event.preventDefault();
      handleSaveProfile();
    }
  });

  btnEditProfile.addEventListener('click', () => {
    inputNickname.value = playerProfile.nickname;
    populateLocationSelect(selectCity, onboardingCustomCity, playerProfile.city);
    onboardingRankTitle.textContent = 'Update your Rider Name or Location:';
    onboardingFeedback.classList.add('hidden');
    onboardingCard.classList.remove('hidden');
    playerTagBar.classList.add('hidden');
  });

  if (selectCity) {
    selectCity.addEventListener('change', () => {
      if (onboardingCustomCity) {
        onboardingCustomCity.classList.toggle('hidden', selectCity.value !== 'Custom / Other');
      }
    });
  }

  if (btnOpenAccount) {
    btnOpenAccount.addEventListener('click', () => {
      openAccountModal(playerProfile.accountType === 'registered' ? 'login' : 'signup', {
        startAfterSave: false,
      });
    });
  }
  if (btnGameoverAccount) {
    btnGameoverAccount.addEventListener('click', () => {
      openAccountModal(playerProfile.accountType === 'registered' ? 'login' : 'signup', {
        startAfterSave: false,
      });
    });
  }
  if (btnCloseAccount) {
    btnCloseAccount.addEventListener('click', () => closeAccountModal(true));
  }
  if (accountModal) {
    accountModal.addEventListener('click', (event) => {
      if (event.target === accountModal) closeAccountModal(true);
    });
  }
  if (tabAuthSignup) tabAuthSignup.addEventListener('click', () => setAccountModalMode('signup'));
  if (tabAuthLogin) tabAuthLogin.addEventListener('click', () => setAccountModalMode('login'));
  if (tabAuthGuest) tabAuthGuest.addEventListener('click', () => setAccountModalMode('guest'));
  if (accountLocation) {
    accountLocation.addEventListener('change', () => {
      if (accountCustomLocationGroup) {
        accountCustomLocationGroup.classList.toggle(
          'hidden',
          activeAuthMode === 'login' || accountLocation.value !== 'Custom / Other'
        );
      }
    });
  }
  if (btnAccountSubmit) btnAccountSubmit.addEventListener('click', handleAccountSubmit);
  if (btnAccountQuickGuest) btnAccountQuickGuest.addEventListener('click', handleQuickGuest);
  [accountUsername, accountPassword, accountCustomLocation].forEach((inputEl) => {
    if (inputEl) {
      inputEl.addEventListener('keydown', (event) => {
        if (event.code === 'Enter') {
          event.preventDefault();
          handleAccountSubmit();
        }
      });
    }
  });

  tabTopRiders.addEventListener('click', () => {
    activeLeaderboardTab = 'riders';
    renderLeaderboard();
  });

  tabCityWar.addEventListener('click', () => {
    activeLeaderboardTab = 'citywar';
    renderLeaderboard();
  });

  btnSound.addEventListener('click', () => {
    userSettings.soundMuted = sound.toggleMute();
    saveSettings(userSettings);
    syncSoundButtonsUi();
  });

  leaderboardModal.addEventListener('click', (event) => {
    if (event.target === leaderboardModal) {
      closeLeaderboard();
    }
  });

  if (cityFilterRow) {
    cityFilterRow.addEventListener('click', (event) => {
      const chip = event.target.closest('.city-chip');
      if (!chip) return;
      selectedCityFilter = chip.dataset.city || 'All';
      renderLeaderboard();
    });
  }

  // =========================================================
  // 10. Near-Miss Combo & Shrunk-AABB Collision Detection
  // =========================================================
  let coinSyncTimerId = null;
  function scheduleCoinCloudSync() {
    if (!playerProfile || playerProfile.accountType !== 'registered') return;
    if (coinSyncTimerId) window.clearTimeout(coinSyncTimerId);
    const snapshotProfile = { ...playerProfile };
    const snapshotCoins = savedCoinBank;
    coinSyncTimerId = window.setTimeout(() => {
      coinSyncTimerId = null;
      leaderboardService.syncAccountCoins(snapshotProfile, snapshotCoins);
    }, 1500);
  }

  function addCoins(amount) {
    if (!amount || amount <= 0) return;
    runCoins += amount;
    savedCoinBank += amount;
    saveCoinBank(savedCoinBank, playerProfile && playerProfile.playerId);
    syncCoinDisplays();
    scheduleCoinCloudSync();
  }

  function triggerNearMiss(entity, cfg) {
    entity.nearMissAwarded = true;
    closeCallCount += 1;
    comboChain += 1;
    comboMultiplier = comboChain;
    maxComboReached = Math.max(maxComboReached, comboMultiplier);
    comboTimer = COMBO.DURATION_SEC;

    const bonus = COMBO.BASE_BONUS_METERS * comboMultiplier;
    distanceMeters += bonus;
    bonusMetersTotal += bonus;
    addCoins(1);

    const bikeX = getHandlebarBaseX();
    const label =
      comboMultiplier >= 2
        ? `SHARP DODGE! +1 COIN • x${comboMultiplier}`
        : `SHARP DODGE! +1 COIN`;

    addPopup(label, bikeX, getBottomY() - 155, '#fde047');
    sound.playNearMiss(Math.min(8, comboMultiplier), cfg.isVehicle);
  }

  function checkCollisions() {
    const bikeX = getHandlebarBaseX();
    const bikeHalfW = COLLISION.BIKE_HALF_WIDTH * COLLISION.AABB_SHRINK;

    for (let i = 0; i < entities.length; i += 1) {
      const entity = entities[i];
      const cfg = ENTITY_CONFIG[entity.type];

      if (cfg.kind === 'collectible') {
        const pickupLane = typeof entity.visualLane === 'number' ? entity.visualLane : entity.lane;
        const collectBand = magnetTimer > 0 && entity.type === 'coin' ? 0.72 : 0.45;
        if (
          !entity.collected &&
          entity.z >= COLLISION.COLLECT_MIN_Z &&
          entity.z <= COLLISION.COLLECT_MAX_Z &&
          Math.abs(currentLane - pickupLane) < collectBand
        ) {
          entity.collected = true;
          collectibleCount += 1;
          const proj = projectPoint(pickupLane, entity.z);

          if (entity.type === 'coin') {
            addCoins(cfg.coins || 10);
            addPopup('+10 COINS!', proj.x, proj.y - 36, cfg.color);
          } else if (entity.type === 'fuel_can') {
            fuelBoostTimer = POWERUPS.FUEL_DURATION;
            speedKmh = Math.min(SPEED_CURVE.MAX_KMH, Math.max(speedKmh + 28, 125));
            addPopup('NITRO FUEL BOOST!', proj.x, proj.y - 36, cfg.color);
          } else if (entity.type === 'shield') {
            shieldTimer = POWERUPS.SHIELD_DURATION;
            addPopup('IMMUNITY SHIELD!', proj.x, proj.y - 36, cfg.color);
          } else if (entity.type === 'magnet') {
            magnetTimer = POWERUPS.MAGNET_DURATION;
            addPopup('COIN MAGNET!', proj.x, proj.y - 36, cfg.color);
          }
          sound.playCollect();
        }
        continue;
      }

      if (entity.shieldIgnored) continue;

      const entityLane = typeof entity.visualLane === 'number' ? entity.visualLane : entity.lane;
      const laneDiff = Math.abs(currentLane - entityLane);

      // Remember if the rider was lined up in front of this hazard before swerving
      if (
        entity.z >= 0.42 &&
        entity.z <= 0.88 &&
        (laneDiff < 0.44 || targetLane === entity.lane)
      ) {
        entity.wasInSameLane = true;
      }

      // Close-Call / Lane-Split Near-Miss Window
      if (
        !entity.nearMissAwarded &&
        entity.z >= COLLISION.NEAR_MISS_MIN_Z &&
        entity.z <= COLLISION.NEAR_MISS_MAX_Z
      ) {
        const dodgedOutOfLane = entity.wasInSameLane && laneDiff >= cfg.laneHalfSpan;
        const grazedTrafficLane =
          cfg.isVehicle &&
          laneDiff >= cfg.laneHalfSpan &&
          laneDiff <= 0.95 &&
          entity.z >= 0.82 &&
          entity.z <= 0.91;

        if (dodgedOutOfLane || grazedTrafficLane) {
          triggerNearMiss(entity, cfg);
        }
      }

      // Hazard Crash Danger Zone: z >= 0.87 && z <= 0.97
      if (entity.z < COLLISION.DANGER_MIN_Z || entity.z > COLLISION.DANGER_MAX_Z) {
        continue;
      }

      const proj = projectPoint(entityLane, entity.z);
      const obsHalfW = cfg.width * proj.scale * 0.5 * COLLISION.AABB_SHRINK;
      const horizontalOverlap = Math.abs(bikeX - proj.x) < bikeHalfW + obsHalfW;

      // Pothole edge-graze rattle (breaks combo unless shielded)
      if (
        entity.type === 'pothole' &&
        !entity.rattled &&
        laneDiff >= cfg.laneHalfSpan &&
        laneDiff < cfg.rattleSpan
      ) {
        if (shieldTimer > 0) {
          entity.rattled = true;
          entity.shieldIgnored = true;
          continue;
        }
        entity.rattled = true;
        rattleTimer = 0.25;
        comboChain = 0;
        comboMultiplier = 1;
        comboTimer = 0;
        sound.playRattle();
        addPopup('POTHOLE RATTLE!', bikeX, getBottomY() - 135, '#fb923c');
        continue;
      }

      if (horizontalOverlap && laneDiff < cfg.laneHalfSpan) {
        if (shieldTimer > 0) {
          entity.shieldIgnored = true;
          if (cfg.isVehicle) {
            entity.worldZ = playerZ + 11;
            entity.z = worldZToNormalizedZ(entity.worldZ);
          } else {
            entity.collected = true;
          }
          crashShakeTimer = 0.12;
          sound.playBump();
          addPopup('SHIELD SMASH!', bikeX, getBottomY() - 145, '#38bdf8');
          continue;
        }
        if (cfg.isVehicle && speedKmh <= COLLISION.VEHICLE_BUMP_MAX_KMH) {
          if ((entity.bumpCooldown || 0) <= 0) {
            entity.bumpCooldown = 0.65;
            entity.worldZ = Math.max(entity.worldZ, playerZ + 7.5);
            entity.z = worldZToNormalizedZ(entity.worldZ);
            speedKmh = Math.max(28, Math.min(speedKmh * 0.65, cfg.speedKmh + 6));
            rattleTimer = 0.32;
            crashShakeTimer = 0.16;
            suspensionPitch = 8.5;
            comboChain = 0;
            comboMultiplier = 1;
            comboTimer = 0;
            sound.playBump();
            addPopup('CAR BUMP! HANG ON!', bikeX, getBottomY() - 140, '#38bdf8');
          }
          continue;
        }
        triggerGameOver(true);
        return;
      }
    }
  }

  // =========================================================
  // 11. 60 FPS Delta-Time Update Loop & World-Locked Physics
  // =========================================================
  function updateSpeedCurve(dt) {
    const braking = isBrakingActive();
    const throttling = isThrottlingActive();
    const nitroActive = fuelBoostTimer > 0;
    const nitroExtra = nitroActive ? SPEED_CURVE.NITRO_BONUS_KMH : 0;

    if (braking) {
      const floorKmh = userSettings.driveMode === 'manual' ? 0 : 14;
      speedKmh = Math.max(floorKmh, speedKmh - 88 * dt);
      suspensionPitch += (9 - suspensionPitch) * Math.min(1, 14 * dt);
      return;
    }

    // As time and distance climb, top/cruise speeds rise smoothly
    const timeRamp = Math.min(54, runDurationSeconds * 0.78 + distanceMeters * 0.008);

    if (throttling || nitroActive) {
      const baseTop = userSettings.driveMode === 'manual'
        ? Math.min(182, 152 + runDurationSeconds * 0.48)
        : Math.min(SPEED_CURVE.AUTO_TOP_KMH, 138 + runDurationSeconds * 0.45);
      const targetMax = Math.min(SPEED_CURVE.MAX_KMH, baseTop + nitroExtra);
      const accelBoost = nitroActive
        ? 68
        : speedKmh < 80
        ? 46
        : speedKmh < 130
        ? 34
        : 22;
      speedKmh = Math.min(targetMax, speedKmh + accelBoost * dt);
      suspensionPitch += ((nitroActive ? -7 : -5) - suspensionPitch) * Math.min(1, 12 * dt);
      return;
    }

    if (userSettings.driveMode === 'auto') {
      const progressiveTarget = Math.min(SPEED_CURVE.AUTO_TOP_KMH, 76 + timeRamp);
      const accelRate = speedKmh < 75 ? 16 : 5.4;
      speedKmh = Math.min(progressiveTarget, speedKmh + accelRate * dt);
      suspensionPitch += (0 - suspensionPitch) * Math.min(1, 8 * dt);
    } else {
      // Manual coasting settles smoothly toward a gentle rolling idle unless throttle/brake held
      if (speedKmh > 18) {
        speedKmh = Math.max(18, speedKmh - 18 * dt);
      }
      suspensionPitch += (1.5 - suspensionPitch) * Math.min(1, 8 * dt);
    }
  }

  function update(dt) {
    fpsAccumulator += dt;
    fpsFrameCount += 1;
    if (fpsAccumulator >= 0.25) {
      displayedFps = Math.round(fpsFrameCount / fpsAccumulator);
      fpsAccumulator = 0;
      fpsFrameCount = 0;
    }

    if (crashFlash > 0) {
      crashFlash = Math.max(0, crashFlash - dt * 2.5);
    }
    if (crashShakeTimer > 0) {
      crashShakeTimer = Math.max(0, crashShakeTimer - dt);
    }

    // Freeze road & obstacles immediately on GAMEOVER or PAUSED
    if (currentState === GAME_STATE.GAMEOVER || currentState === GAME_STATE.PAUSED) {
      if (currentState === GAME_STATE.PAUSED) {
        sound.updateEngine(0, false);
      }
      return;
    }

    if (celebrationTimer > 0) {
      celebrationTimer = Math.max(0, celebrationTimer - dt);
    }
    for (let i = celebrationParticles.length - 1; i >= 0; i -= 1) {
      const pt = celebrationParticles[i];
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.vy += 260 * dt;
      pt.life -= dt;
      if (pt.life <= 0) {
        celebrationParticles.splice(i, 1);
      }
    }

    const activeKmh = currentState === GAME_STATE.PLAYING ? speedKmh : 54;
    const activeMps = activeKmh * WORLD_SPACE.KMH_TO_MPS;
    if (currentState === GAME_STATE.START) {
      menuCameraZ += activeMps * dt;
    } else {
      playerZ += activeMps * dt;
    }

    const cameraZ = getActiveCameraZ();
    engineVibPhase += dt * (currentState === GAME_STATE.PLAYING ? 26 + speedKmh * 0.25 : 14);

    if (rattleTimer > 0) {
      rattleTimer = Math.max(0, rattleTimer - dt);
    }

    for (let i = 0; i < roadsideProps.length; i += 1) {
      const prop = roadsideProps[i];
      if (prop.worldZ < cameraZ - 8) {
        prop.worldZ += WORLD_SPACE.VIEW_DISTANCE_METERS + 24;
        if (prop.kind === 'mile') {
          prop.km = nextMarkerKm;
          nextMarkerKm += 1;
        }
      }
      prop.z = worldZToNormalizedZ(prop.worldZ);
    }

    for (let i = 0; i < windStreaks.length; i += 1) {
      const streak = windStreaks[i];
      const streakRate = currentState === GAME_STATE.PLAYING ? 1.4 + (speedKmh / 100) * 1.4 : 0.9;
      streak.progress += dt * streakRate * streak.speedMult;
      if (streak.progress >= 1) {
        streak.progress -= 1;
        streak.offsetRatio = Math.random();
      }
    }

    if (currentState === GAME_STATE.START) {
      sound.updateEngine(0, false);
      currentLane = 1 + Math.sin(engineVibPhase * 0.04) * 0.08;
      leanNormalized = Math.cos(engineVibPhase * 0.04) * 0.12;
      handlebarAngle = leanNormalized * STEERING.MAX_HANDLEBAR_RAD;
      worldRollAngle = -leanNormalized * STEERING.MAX_WORLD_ROLL_RAD;
      return;
    }

    // PLAYING state progression & anti-cheat run telemetry
    runDurationSeconds += dt;
    if (fuelBoostTimer > 0) fuelBoostTimer = Math.max(0, fuelBoostTimer - dt);
    if (shieldTimer > 0) shieldTimer = Math.max(0, shieldTimer - dt);
    if (magnetTimer > 0) magnetTimer = Math.max(0, magnetTimer - dt);
    if (hornHeld) {
      hornYieldTimer -= dt;
      if (hornYieldTimer <= 0) {
        hornYieldTimer = 0.24;
        clearTrafficAheadWithHorn(false);
      }
    }
    if (manualSteerOverrideTimer > 0) {
      manualSteerOverrideTimer = Math.max(0, manualSteerOverrideTimer - dt);
    }
    updateSpeedCurve(dt);
    sound.updateEngine(speedKmh, true);
    distanceMeters = playerZ + bonusMetersTotal;

    while (distanceMeters >= nextMilestoneTarget) {
      runMilestones.push({
        meters: nextMilestoneTarget,
        t: Number(runDurationSeconds.toFixed(2)),
      });
      nextMilestoneTarget += 250;
    }

    if (
      !passedBestThisRun &&
      ((targetBestLineMeters > 0 && distanceMeters >= targetBestLineMeters) ||
        (targetBestLineMeters === 0 && distanceMeters >= 250))
    ) {
      passedBestThisRun = true;
      triggerHighScoreCelebration();
    }

    if (
      rivalChallenge.active &&
      !rivalChallenge.defeatedThisRun &&
      distanceMeters >= rivalChallenge.targetMeters
    ) {
      rivalChallenge.defeatedThisRun = true;
      addPopup('RIVAL DEFEATED!', 200, getHorizonY() + 150, '#fb7185');
      if (hudRivalPill) {
        hudRivalPill.textContent = 'RIVAL DEFEATED!';
        hudRivalPill.classList.add('defeated');
      }
      sound.playNewRecord();
    }

    if (comboTimer > 0) {
      comboTimer = Math.max(0, comboTimer - dt);
      if (comboTimer === 0) {
        comboChain = 0;
        comboMultiplier = 1;
      }
    }

    const sensScale = 0.75 + 0.25 * userSettings.sensitivity;
    currentLane += (targetLane - currentLane) * Math.min(1, STEERING.LANE_LERP_RATE * sensScale * dt);
    const laneDelta = targetLane - currentLane;
    const targetLean = Math.max(-1, Math.min(1, laneDelta * 1.45));
    leanNormalized += (targetLean - leanNormalized) * Math.min(1, STEERING.LEAN_LERP_RATE * sensScale * dt);

    handlebarAngle = leanNormalized * STEERING.MAX_HANDLEBAR_RAD;
    worldRollAngle = -leanNormalized * STEERING.MAX_WORLD_ROLL_RAD;

    // Stationary hazards stay 100% locked to their asphalt meter coordinates;
    // Moving vehicles maintain constant world speeds and never form 3-lane walls.
    for (let i = entities.length - 1; i >= 0; i -= 1) {
      const entity = entities[i];
      if (entity.bumpCooldown > 0) {
        entity.bumpCooldown = Math.max(0, entity.bumpCooldown - dt);
      }
      const cfg = ENTITY_CONFIG[entity.type];

      // Coin Magnet pulls road coins smoothly toward the bike across lanes
      if (
        entity.type === 'coin' &&
        !entity.collected &&
        magnetTimer > 0 &&
        entity.worldZ > playerZ - 3 &&
        entity.worldZ < playerZ + 40
      ) {
        if (typeof entity.visualLane !== 'number') {
          entity.visualLane = entity.lane;
        }
        entity.visualLane += (currentLane - entity.visualLane) * Math.min(1, 11 * dt);
        if (entity.worldZ > playerZ + 2) {
          entity.worldZ -= 16 * dt;
        }
      }

      if (cfg.speedKmh > 0) {
        if (typeof entity.visualLane !== 'number') {
          entity.visualLane = entity.lane;
        }
        const distAhead = entity.worldZ - playerZ;

        // Ambient mid-range lane telegraph (~0.72s turn signal before shifting smoothly)
        if (
          !entity.yieldChecked &&
          typeof entity.pendingLane !== 'number' &&
          distAhead > 34 &&
          distAhead < 85 &&
          speedKmh > cfg.speedKmh + 22 &&
          Math.abs(entity.visualLane - currentLane) < 0.55
        ) {
          entity.yieldChecked = true;
          if (Math.random() < 0.55) {
            tryYieldVehicleLane(entity, false);
          }
        }

        // Phase 1: Flash turn-signal indicator cleanly inside current lane BEFORE shifting
        if (entity.signalTimer > 0) {
          entity.signalTimer = Math.max(0, entity.signalTimer - dt);
          if (entity.signalTimer === 0 && typeof entity.pendingLane === 'number') {
            const unsafeLateMerge =
              !entity.yielding &&
              distAhead > -2 &&
              distAhead < 22 &&
              Math.abs(entity.pendingLane - targetLane) < 0.75;
            if (
              unsafeLateMerge ||
              !isLaneClearForVehicle(entity.pendingLane, entity.worldZ, entity, 14)
            ) {
              entity.pendingLane = null;
              entity.signalDir = 0;
              entity.yielding = false;
            } else {
              entity.lane = entity.pendingLane;
              entity.pendingLane = null;
            }
          }
        }

        // Phase 2: Smooth lateral lane slide while keeping blinker lit until settled
        if (Math.abs(entity.visualLane - entity.lane) > 0.004) {
          entity.visualLane += (entity.lane - entity.visualLane) * Math.min(1, 3.4 * dt);
        } else {
          entity.visualLane = entity.lane;
          if (typeof entity.pendingLane !== 'number') {
            entity.signalDir = 0;
            entity.yielding = false;
          }
        }

        let effectiveKmh = cfg.speedKmh;
        let sameLaneBlocker = null;
        for (let j = 0; j < entities.length; j += 1) {
          if (j === i) continue;
          const other = entities[j];
          if (ENTITY_CONFIG[other.type].kind !== 'hazard') continue;
          if (
            other.lane === entity.lane &&
            other.worldZ > entity.worldZ &&
            other.worldZ - entity.worldZ < 24
          ) {
            sameLaneBlocker = other;
            break;
          }
        }

        if (sameLaneBlocker) {
          const merged = tryYieldVehicleLane(entity, false);
          const blockerCfg = ENTITY_CONFIG[sameLaneBlocker.type];
          if (!merged && blockerCfg.isVehicle && sameLaneBlocker.worldZ - entity.worldZ < 18) {
            effectiveKmh = Math.max(46, Math.min(cfg.speedKmh, blockerCfg.speedKmh));
          }
        }

        const candidateWorldZ = entity.worldZ + effectiveKmh * WORLD_SPACE.KMH_TO_MPS * dt;
        const otherLanesOccupied = getOccupiedOtherLanesSet(entity.lane, candidateWorldZ, entity, 15);
        // Prevent any moving vehicle from sitting alongside 2 other blocked lanes to seal the road
        if (otherLanesOccupied.size >= 2) {
          if (!tryYieldVehicleLane(entity, false) && entity.worldZ > playerZ + 18) {
            effectiveKmh = Math.max(effectiveKmh, cfg.speedKmh + 24);
          }
        }

        entity.braking = false;
        const stepMeters = effectiveKmh * WORLD_SPACE.KMH_TO_MPS * dt;
        entity.worldZ += stepMeters;
        entity.wheelPhase =
          ((entity.wheelPhase || 0) + dt * (effectiveKmh * 0.25)) % (Math.PI * 2);
      } else if (entity.type !== 'coin' && typeof entity.lockedWorldZ === 'number') {
        entity.worldZ = entity.lockedWorldZ;
        entity.braking = false;
      }

      entity.z = worldZToNormalizedZ(entity.worldZ);

      if (
        entity.collected ||
        entity.worldZ < playerZ - 14 ||
        entity.worldZ > playerZ + WORLD_SPACE.VIEW_DISTANCE_METERS + 140
      ) {
        entities.splice(i, 1);
      }
    }

    while (playerZ + WORLD_SPACE.VIEW_DISTANCE_METERS + 12 >= nextWaveWorldZ) {
      spawnWave(nextWaveWorldZ);
      const waveSpacing = Math.max(26, 42 - Math.min(14, waveCount * 0.25));
      nextWaveWorldZ += waveSpacing;
    }

    for (let i = floatingPopups.length - 1; i >= 0; i -= 1) {
      const pop = floatingPopups[i];
      pop.life -= dt;
      pop.y -= 40 * dt;
      if (pop.life <= 0) {
        floatingPopups.splice(i, 1);
      }
    }

    checkCollisions();
    updateHudDisplay();
  }

  // =========================================================
  // 12. Multi-Tier 2D / 2.5D / Ultra 3D Scenery & Cockpit Engine
  // =========================================================
  function isQualityAtLeast(minTier) {
    const idx = GRAPHICS_QUALITIES.indexOf(userSettings.graphicsQuality);
    const minIdx = GRAPHICS_QUALITIES.indexOf(minTier);
    return (idx < 0 ? 3 : idx) >= minIdx;
  }

  function getWorld3DBoxCoords(laneFloat, worldZNear, worldZFar, halfW, heightPx, baseElevPx = 0) {
    const z0 = Math.max(0.002, Math.min(1.08, worldZToNormalizedZ(worldZNear)));
    const z1 = Math.max(0.001, Math.min(1.06, worldZToNormalizedZ(worldZFar)));
    const p0 = projectPoint(laneFloat, z0);
    const p1 = projectPoint(laneFloat, z1);

    const w0 = halfW * p0.scale;
    const h0 = heightPx * p0.scale;
    const eb0 = baseElevPx * p0.scale;
    const w1 = halfW * p1.scale;
    const h1 = heightPx * p1.scale;
    const eb1 = baseElevPx * p1.scale;

    return {
      p0,
      p1,
      x0L: p0.x - w0,
      x0R: p0.x + w0,
      y0B: p0.y - eb0,
      y0T: p0.y - eb0 - h0,
      x1L: p1.x - w1,
      x1R: p1.x + w1,
      y1B: p1.y - eb1,
      y1T: p1.y - eb1 - h1,
    };
  }

  function drawExtruded3DBox(laneFloat, worldZNear, depthMeters, halfW, heightPx, baseElevPx, palette) {
    const b = getWorld3DBoxCoords(
      laneFloat,
      worldZNear,
      worldZNear + depthMeters,
      halfW,
      heightPx,
      baseElevPx
    );

    // Left 3D perspective wall (visible when vehicle/building sits right of camera)
    if (b.x1L > b.x0L + 0.3 && palette.sideLeft) {
      ctx.fillStyle = palette.sideLeft;
      ctx.beginPath();
      ctx.moveTo(b.x0L, b.y0T);
      ctx.lineTo(b.x1L, b.y1T);
      ctx.lineTo(b.x1L, b.y1B);
      ctx.lineTo(b.x0L, b.y0B);
      ctx.closePath();
      ctx.fill();
    }

    // Right 3D perspective wall (visible when vehicle/building sits left of camera)
    if (b.x1R < b.x0R - 0.3 && palette.sideRight) {
      ctx.fillStyle = palette.sideRight;
      ctx.beginPath();
      ctx.moveTo(b.x0R, b.y0T);
      ctx.lineTo(b.x1R, b.y1T);
      ctx.lineTo(b.x1R, b.y1B);
      ctx.lineTo(b.x0R, b.y0B);
      ctx.closePath();
      ctx.fill();
    }

    // Roof / hood plane converging toward vanishing point
    if (b.y1T < b.y0T - 0.2 && palette.top) {
      ctx.fillStyle = palette.top;
      ctx.beginPath();
      ctx.moveTo(b.x0L, b.y0T);
      ctx.lineTo(b.x1L, b.y1T);
      ctx.lineTo(b.x1R, b.y1T);
      ctx.lineTo(b.x0R, b.y0T);
      ctx.closePath();
      ctx.fill();
    }

    // Front face facing the player
    if (palette.front) {
      ctx.fillStyle = palette.front;
      ctx.fillRect(b.x0L, b.y0T, b.x0R - b.x0L, b.y0B - b.y0T);
    }

    return b;
  }

  function drawSkyAndHorizon(horizonY) {
    const isLow = false;
    const isHigh3D = isQualityAtLeast('normal');
    const isUltra = userSettings.graphicsQuality === 'ultra';

    if (isLow) {
      ctx.fillStyle = '#13243f';
      ctx.fillRect(-60, -60, LOGICAL_WIDTH + 120, horizonY + 62);
      ctx.fillStyle = '#d97706';
      ctx.fillRect(-60, horizonY - 22, LOGICAL_WIDTH + 120, 24);
    } else {
      const skyGrad = ctx.createLinearGradient(0, -40, 0, horizonY);
      skyGrad.addColorStop(0, isUltra ? '#050c1b' : '#071124');
      skyGrad.addColorStop(0.5, '#1b3557');
      skyGrad.addColorStop(0.84, '#b85a2a');
      skyGrad.addColorStop(1, '#f59e0b');
      ctx.fillStyle = skyGrad;
      ctx.fillRect(-60, -60, LOGICAL_WIDTH + 120, horizonY + 62);
    }

    // Crisp twilight starfield in Ultra HD+
    if (isUltra) {
      ctx.fillStyle = 'rgba(248, 250, 252, 0.72)';
      const starOffsets = [
        [28, 26], [74, 48], [116, 22], [168, 56], [218, 30],
        [264, 44], [312, 20], [358, 52], [386, 28], [52, 82], [336, 78],
      ];
      starOffsets.forEach(([sx, sy], idx) => {
        if (sy < horizonY - 78) {
          const twinkle = 0.55 + 0.45 * Math.sin(engineVibPhase * 0.14 + idx * 1.7);
          ctx.globalAlpha = twinkle;
          ctx.fillRect(sx + (1 - currentLane) * 2, sy, idx % 3 === 0 ? 2 : 1.3, idx % 3 === 0 ? 2 : 1.3);
        }
      });
      ctx.globalAlpha = 1;
    }

    const sunX = 200 + (1 - currentLane) * 14;
    if (!isLow) {
      const sunGrad = ctx.createRadialGradient(sunX, horizonY - 22, 4, sunX, horizonY - 22, isUltra ? 82 : 68);
      sunGrad.addColorStop(0, 'rgba(254, 249, 195, 0.96)');
      sunGrad.addColorStop(0.32, 'rgba(251, 146, 60, 0.52)');
      sunGrad.addColorStop(1, 'rgba(251, 146, 60, 0)');
      ctx.fillStyle = sunGrad;
      ctx.beginPath();
      ctx.arc(sunX, horizonY - 22, isUltra ? 82 : 68, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = '#fde68a';
      ctx.beginPath();
      ctx.arc(sunX, horizonY - 18, 22, 0, Math.PI * 2);
      ctx.fill();
    }

    // Volumetric dusk sunbeams in High 3D & Ultra HD+
    if (isHigh3D) {
      ctx.save();
      ctx.fillStyle = isUltra ? 'rgba(254, 240, 138, 0.085)' : 'rgba(254, 240, 138, 0.06)';
      [-0.42, -0.18, 0.14, 0.4].forEach((rayAng) => {
        ctx.beginPath();
        ctx.moveTo(sunX, horizonY - 22);
        ctx.lineTo(sunX + Math.sin(rayAng - 0.08) * 260, horizonY - 220);
        ctx.lineTo(sunX + Math.sin(rayAng + 0.08) * 260, horizonY - 220);
        ctx.closePath();
        ctx.fill();
      });
      ctx.restore();
    }

    // Soft dusk cloud wisps
    if (!isLow) {
      ctx.fillStyle = 'rgba(253, 186, 116, 0.14)';
      ctx.beginPath();
      ctx.ellipse(95 + (1 - currentLane) * 6, horizonY - 72, 62, 10, -0.05, 0, Math.PI * 2);
      ctx.ellipse(305 + (1 - currentLane) * 8, horizonY - 88, 72, 11, 0.04, 0, Math.PI * 2);
      ctx.fill();
    }

    // Far Mount Cameroon atmospheric ridge in Ultra HD+
    if (isUltra) {
      ctx.fillStyle = '#24344d';
      ctx.beginPath();
      ctx.moveTo(-60, horizonY + 2);
      ctx.lineTo(50, horizonY - 46);
      ctx.lineTo(145, horizonY - 22);
      ctx.lineTo(240, horizonY - 54);
      ctx.lineTo(340, horizonY - 26);
      ctx.lineTo(LOGICAL_WIDTH + 60, horizonY + 2);
      ctx.closePath();
      ctx.fill();
    }

    // Foreground tropical hills
    ctx.fillStyle = '#182636';
    ctx.beginPath();
    ctx.moveTo(-60, horizonY + 2);
    ctx.lineTo(25, horizonY - 26);
    ctx.lineTo(110, horizonY - 12);
    ctx.lineTo(205, horizonY - 38);
    ctx.lineTo(300, horizonY - 14);
    ctx.lineTo(385, horizonY - 28);
    ctx.lineTo(LOGICAL_WIDTH + 60, horizonY + 2);
    ctx.closePath();
    ctx.fill();

    // Distant urban city skyline silhouettes with lit windows
    const towers = [
      [-10, 22, 20], [16, 18, 30], [38, 24, 18], [66, 20, 36],
      [90, 26, 24], [122, 16, 40], [142, 22, 22], [238, 20, 28],
      [262, 26, 38], [292, 18, 22], [314, 24, 34], [344, 20, 26], [368, 28, 30],
    ];
    const cityShift = (1 - currentLane) * 4;
    towers.forEach(([tx, tw, th], idx) => {
      const bx = tx + cityShift;
      const by = horizonY - th;
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(bx, by, tw, th + 2);
      if (isHigh3D) {
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(bx + tw, by + 3, 5, th - 1);
      }
      if (isUltra && th >= 32) {
        ctx.fillStyle = '#dc2626';
        ctx.fillRect(bx + tw * 0.5 - 1, by - 4, 2, 4);
      }
      if (!isLow) {
        ctx.fillStyle = idx % 2 === 0 ? 'rgba(253, 224, 71, 0.45)' : 'rgba(56, 189, 248, 0.32)';
        for (let wy = by + 5; wy < horizonY - 6; wy += 6) {
          for (let wx = bx + 4; wx < bx + tw - 4; wx += 6) {
            if ((wx + wy + idx) % 3 !== 0) {
              ctx.fillRect(wx, wy, 2.5, 3);
            }
          }
        }
      }
    });

    ctx.fillStyle = '#0b1322';
    ctx.fillRect(-60, horizonY - 6, LOGICAL_WIDTH + 120, 8);
  }

  function drawRoadTargetLine(options) {
    if (currentState !== GAME_STATE.PLAYING || options.targetMeters <= 0) return;
    const metersAhead = options.targetMeters - distanceMeters;
    if (metersAhead < -8 || metersAhead > WORLD_SPACE.VIEW_DISTANCE_METERS) return;

    const z = worldZToNormalizedZ(playerZ + metersAhead);
    if (z < 0.01 || z > 1.04) return;

    const pL = projectPoint(-0.5, z);
    const pR = projectPoint(2.5, z);
    const pC = projectPoint(1, z);
    const bandHalfH = Math.max(2, 6 * pC.scale);

    ctx.save();
    ctx.fillStyle = options.glowColor;
    ctx.fillRect(pL.x, pC.y - bandHalfH * 2.2, pR.x - pL.x, bandHalfH * 4.4);

    const squares = 12;
    const segW = (pR.x - pL.x) / squares;
    for (let i = 0; i < squares; i += 1) {
      ctx.fillStyle = i % 2 === 0 ? options.colorA : options.colorB;
      ctx.fillRect(pL.x + i * segW, pC.y - bandHalfH, segW + 0.5, bandHalfH * 2);
    }

    if (pC.scale > 0.28) {
      const textY = pC.y - bandHalfH - 6 - (options.labelOffsetY || 0);
      ctx.font = `900 ${Math.round(12 * Math.max(0.55, pC.scale))}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.strokeStyle = '#090d16';
      ctx.lineWidth = 3;
      ctx.strokeText(options.labelText, pC.x, textY);
      ctx.fillStyle = options.textColor;
      ctx.fillText(options.labelText, pC.x, textY);
    }
    ctx.restore();
  }

  function drawPersonalBestRoadLine() {
    drawRoadTargetLine({
      targetMeters: targetBestLineMeters,
      glowColor: 'rgba(250, 204, 21, 0.35)',
      colorA: '#facc15',
      colorB: '#10b981',
      labelText: `BEST: ${targetBestLineMeters}m`,
      textColor: '#fde047',
      labelOffsetY: 0,
    });
  }

  function drawRivalTargetRoadLine() {
    if (!rivalChallenge.active || rivalChallenge.targetMeters <= 0) return;
    const nearBestLine =
      targetBestLineMeters > 0 &&
      Math.abs(targetBestLineMeters - rivalChallenge.targetMeters) <= 8;
    drawRoadTargetLine({
      targetMeters: rivalChallenge.targetMeters,
      glowColor: 'rgba(244, 63, 94, 0.42)',
      colorA: '#ef4444',
      colorB: '#fef2f2',
      labelText: `RIVAL (${rivalChallenge.rivalName}): ${rivalChallenge.targetMeters}m`,
      textColor: '#fda4af',
      labelOffsetY: nearBestLine ? 18 : 0,
    });
  }

  function draw25DRoadAndShoulders() {
    const horizonY = getHorizonY();
    const bottomY = getBottomY();
    const cameraZ = getActiveCameraZ();
    const segLen = WORLD_SPACE.ROAD_SEGMENT_METERS;
    const isLow = false;
    const isHigh3D = isQualityAtLeast('normal');
    const isUltra = userSettings.graphicsQuality === 'ultra';

    // Dusty laterite earth shoulders
    if (isLow) {
      ctx.fillStyle = '#5c2815';
      ctx.fillRect(-60, horizonY, LOGICAL_WIDTH + 120, logicalHeight - horizonY + 80);
    } else {
      const groundGrad = ctx.createLinearGradient(0, horizonY, 0, logicalHeight + 60);
      groundGrad.addColorStop(0, '#522414');
      groundGrad.addColorStop(1, '#7c361c');
      ctx.fillStyle = groundGrad;
      ctx.fillRect(-60, horizonY, LOGICAL_WIDTH + 120, logicalHeight - horizonY + 80);
    }

    const hLeft = projectPoint(-0.5, 0);
    const hRight = projectPoint(2.5, 0);
    const bLeft = projectPoint(-0.5, 1.06);
    const bRight = projectPoint(2.5, 1.06);

    // Textured dark highway asphalt base
    if (isLow) {
      ctx.fillStyle = '#1e2533';
    } else {
      const roadGrad = ctx.createLinearGradient(0, horizonY, 0, bottomY);
      roadGrad.addColorStop(0, '#273040');
      roadGrad.addColorStop(1, '#141923');
      ctx.fillStyle = roadGrad;
    }
    ctx.beginPath();
    ctx.moveTo(hLeft.x, hLeft.y);
    ctx.lineTo(hRight.x, hRight.y);
    ctx.lineTo(bRight.x, bRight.y);
    ctx.lineTo(bLeft.x, bLeft.y);
    ctx.closePath();
    ctx.fill();

    // Sunset highway sheen & specular wet-asphalt reflection lanes
    if (!isLow) {
      if (isHigh3D) {
        const sunSheen = ctx.createLinearGradient(0, horizonY, 0, horizonY + (isUltra ? 185 : 110));
        sunSheen.addColorStop(0, isUltra ? 'rgba(245, 158, 11, 0.30)' : 'rgba(245, 158, 11, 0.22)');
        sunSheen.addColorStop(1, 'rgba(245, 158, 11, 0)');
        ctx.fillStyle = sunSheen;
        ctx.beginPath();
        ctx.moveTo(hLeft.x, hLeft.y);
        ctx.lineTo(hRight.x, hRight.y);
        ctx.lineTo(bRight.x, bRight.y);
        ctx.lineTo(bLeft.x, bLeft.y);
        ctx.closePath();
        ctx.fill();
      }
      [0, 1, 2].forEach((lane) => {
        const ht = projectPoint(lane, 0);
        const bt = projectPoint(lane, 1.06);
        ctx.strokeStyle = 'rgba(7, 11, 18, 0.28)';
        ctx.lineWidth = 22;
        ctx.beginPath();
        ctx.moveTo(ht.x, ht.y);
        ctx.lineTo(bt.x, bt.y);
        ctx.stroke();

        if (isUltra) {
          const laneSheen = ctx.createLinearGradient(ht.x, ht.y, bt.x, bt.y);
          laneSheen.addColorStop(0, 'rgba(251, 146, 60, 0.14)');
          laneSheen.addColorStop(0.5, 'rgba(56, 189, 248, 0.05)');
          laneSheen.addColorStop(1, 'rgba(15, 23, 42, 0)');
          ctx.strokeStyle = laneSheen;
          ctx.lineWidth = 7;
          ctx.beginPath();
          ctx.moveTo(ht.x, ht.y);
          ctx.lineTo(bt.x, bt.y);
          ctx.stroke();
        }
      });
    }

    // World-locked road bands, raised 3D curbs & world-locked lane dashes
    // Compute normalized depths before clamping so dashes never compress/slide at boundaries
    const firstSeg = Math.floor((cameraZ - 12) / segLen);
    const lastSeg = Math.ceil((cameraZ + WORLD_SPACE.VIEW_DISTANCE_METERS) / segLen);

    for (let segIdx = firstSeg; segIdx <= lastSeg; segIdx += 1) {
      const rawFar = worldZToNormalizedZ((segIdx + 1) * segLen);
      const rawNear = worldZToNormalizedZ(segIdx * segLen);
      const zFar = Math.max(0, rawFar);
      const zNear = Math.min(1.06, rawNear);
      if (zNear <= 0.004 || zFar >= 1.06 || zNear <= zFar) continue;

      const p0L = projectPoint(-0.5, zFar);
      const p1L = projectPoint(-0.5, zNear);
      const p0R = projectPoint(2.5, zFar);
      const p1R = projectPoint(2.5, zNear);

      const isEven = Math.abs(segIdx) % 2 === 0;
      if (isEven && !isLow) {
        ctx.fillStyle = isUltra ? 'rgba(12, 18, 28, 0.22)' : 'rgba(12, 18, 28, 0.16)';
        ctx.beginPath();
        ctx.moveTo(p0L.x, p0L.y);
        ctx.lineTo(p0R.x, p0R.y);
        ctx.lineTo(p1R.x, p1R.y);
        ctx.lineTo(p1L.x, p1L.y);
        ctx.closePath();
        ctx.fill();
      }

      const curbW0 = 3 + 10 * p0L.visZ;
      const curbW1 = 3 + 10 * p1L.visZ;
      const curbElev0 = isHigh3D ? (isUltra ? 6 : 4) * p0L.scale : 0;
      const curbElev1 = isHigh3D ? (isUltra ? 6 : 4) * p1L.scale : 0;

      // Outer concrete curb drop bevel
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.moveTo(p0L.x - curbW0 - 2 * p0L.visZ, p0L.y + 1.5);
      ctx.lineTo(p0L.x - curbW0, p0L.y - curbElev0);
      ctx.lineTo(p1L.x - curbW1, p1L.y - curbElev1);
      ctx.lineTo(p1L.x - curbW1 - 3 * p1L.visZ, p1L.y + 2);
      ctx.closePath();
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(p0R.x + curbW0, p0R.y - curbElev0);
      ctx.lineTo(p0R.x + curbW0 + 2 * p0R.visZ, p0R.y + 1.5);
      ctx.lineTo(p1R.x + curbW1 + 3 * p1R.visZ, p1R.y + 2);
      ctx.lineTo(p1R.x + curbW1, p1R.y - curbElev1);
      ctx.closePath();
      ctx.fill();

      // Raised alternating curb blocks
      ctx.fillStyle = isEven ? '#eab308' : '#475569';
      ctx.beginPath();
      ctx.moveTo(p0L.x - curbW0, p0L.y - curbElev0);
      ctx.lineTo(p0L.x, p0L.y - curbElev0);
      ctx.lineTo(p1L.x, p1L.y - curbElev1);
      ctx.lineTo(p1L.x - curbW1, p1L.y - curbElev1);
      ctx.closePath();
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(p0R.x, p0R.y - curbElev0);
      ctx.lineTo(p0R.x + curbW0, p0R.y - curbElev0);
      ctx.lineTo(p1R.x + curbW1, p1R.y - curbElev1);
      ctx.lineTo(p1R.x, p1R.y - curbElev1);
      ctx.closePath();
      ctx.fill();

      // Inner 3D vertical face of raised curbs facing road in High 3D & Ultra HD+
      if (isHigh3D) {
        ctx.fillStyle = isEven ? '#a16207' : '#334155';
        ctx.beginPath();
        ctx.moveTo(p0L.x, p0L.y - curbElev0);
        ctx.lineTo(p1L.x, p1L.y - curbElev1);
        ctx.lineTo(p1L.x, p1L.y);
        ctx.lineTo(p0L.x, p0L.y);
        ctx.closePath();
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(p0R.x, p0R.y - curbElev0);
        ctx.lineTo(p1R.x, p1R.y - curbElev1);
        ctx.lineTo(p1R.x, p1R.y);
        ctx.lineTo(p0R.x, p0R.y);
        ctx.closePath();
        ctx.fill();
      }

      if (isEven) {
        const rawDashFar = worldZToNormalizedZ((segIdx + 0.62) * segLen);
        const dashFar = Math.max(zFar, rawDashFar);
        const dashNear = Math.min(zNear, rawNear);
        if (dashNear > dashFar + 0.001) {
          [0.5, 1.5].forEach((dividerLane) => {
            const d0 = projectPoint(dividerLane, dashFar);
            const d1 = projectPoint(dividerLane, dashNear);
            const halfW0 = 1 + 2.5 * d0.visZ;
            const halfW1 = 1 + 2.5 * d1.visZ;

            ctx.fillStyle = isUltra ? 'rgba(248, 250, 252, 0.92)' : 'rgba(241, 245, 249, 0.84)';
            ctx.beginPath();
            ctx.moveTo(d0.x - halfW0, d0.y);
            ctx.lineTo(d0.x + halfW0, d0.y);
            ctx.lineTo(d1.x + halfW1, d1.y);
            ctx.lineTo(d1.x - halfW1, d1.y);
            ctx.closePath();
            ctx.fill();
          });
        }
      }
    }

    drawPersonalBestRoadLine();
    drawRivalTargetRoadLine();

    ctx.strokeStyle = 'rgba(248, 250, 252, 0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(hLeft.x + 1, hLeft.y);
    ctx.lineTo(bLeft.x + 3, bLeft.y);
    ctx.moveTo(hRight.x - 1, hRight.y);
    ctx.lineTo(bRight.x - 3, bRight.y);
    ctx.stroke();
  }

  function drawRoadsideProp(prop) {
    if (prop.z < 0.008 || prop.z > 1.06) return;
    const laneCoord = prop.side < 0 ? -0.95 : 2.95;
    const buildingLane = prop.side < 0 ? -1.45 : 3.45;
    const p = projectPoint(laneCoord, prop.z);
    const s = p.scale;
    const isLow = false;
    const isHigh3D = isQualityAtLeast('normal');
    const isUltra = userSettings.graphicsQuality === 'ultra';
    const horizonAlpha = Math.min(1, prop.z / 0.05);

    ctx.save();
    ctx.globalAlpha = horizonAlpha;

    // Tall 3D Multi-Story Roadside City Blocks in Ultra HD+
    if (isUltra && prop.kind === 'building') {
      const bMain = drawExtruded3DBox(buildingLane, prop.worldZ, 7.2, 34, 118, 0, {
        front: '#1e293b',
        sideLeft: prop.side > 0 ? '#334155' : '#0f172a',
        sideRight: prop.side < 0 ? '#334155' : '#0f172a',
        top: '#475569',
      });
      // Shopfront Cameroon-themed colorful awning
      drawExtruded3DBox(buildingLane, prop.worldZ - 0.2, 5.4, 36, 9, 28, {
        front: prop.km % 2 === 0 ? '#007a5e' : '#eab308',
        sideLeft: '#b45309',
        sideRight: '#b45309',
        top: '#fde047',
      });
      // Rooftop water tank cylinder/box silhouette
      drawExtruded3DBox(buildingLane, prop.worldZ + 1.8, 2.2, 10, 14, 118, {
        front: '#0284c7',
        sideLeft: '#0369a1',
        sideRight: '#0369a1',
        top: '#38bdf8',
      });
      // Lit apartment windows across 3 upper stories
      const faceW = bMain.x0R - bMain.x0L;
      const faceH = bMain.y0B - bMain.y0T;
      if (faceW > 12 && faceH > 24) {
        [0.16, 0.34, 0.52].forEach((rowFrac, rIdx) => {
          [0.18, 0.44, 0.70].forEach((colFrac, cIdx) => {
            ctx.fillStyle =
              (prop.km + rIdx + cIdx) % 3 === 0 ? '#fde047' : 'rgba(56, 189, 248, 0.8)';
            ctx.fillRect(
              bMain.x0L + faceW * colFrac,
              bMain.y0T + faceH * rowFrac,
              faceW * 0.14,
              faceH * 0.09
            );
          });
        });
      }
      ctx.restore();
      return;
    }

    // Glowing 3D Highway Billboards in Ultra HD+
    if (isUltra && prop.kind === 'billboard') {
      drawExtruded3DBox(laneCoord, prop.worldZ, 1.1, 4, 68, 0, {
        front: '#64748b',
        sideLeft: '#334155',
        sideRight: '#334155',
        top: '#94a3b8',
      });
      const board = drawExtruded3DBox(laneCoord, prop.worldZ - 0.2, 1.4, 34, 32, 68, {
        front: '#0f172a',
        sideLeft: '#1e293b',
        sideRight: '#1e293b',
        top: '#facc15',
      });
      const bw = board.x0R - board.x0L;
      const bh = board.y0B - board.y0T;
      if (bw > 18) {
        ctx.fillStyle = '#facc15';
        ctx.fillRect(board.x0L + bw * 0.06, board.y0T + bh * 0.1, bw * 0.88, bh * 0.8);
        ctx.fillStyle = '#0f172a';
        ctx.font = `900 ${Math.max(6, Math.round(bw * 0.16))}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(prop.side < 0 ? '237 RUSH' : 'DOUALA', (board.x0L + board.x0R) * 0.5, board.y0T + bh * 0.52);
      }
      ctx.restore();
      return;
    }

    // 3D Kiosks in High 3D & Ultra HD+ (and fallback for 'building'/'billboard' in High 3D/Normal/Low)
    if (isHigh3D && (prop.kind === 'kiosk' || prop.kind === 'building')) {
      const sideDark = prop.side < 0 ? '#1e293b' : '#475569';
      drawExtruded3DBox(laneCoord, prop.worldZ, 5.2, 24, 52, 0, {
        front: '#334155',
        sideLeft: prop.side > 0 ? '#475569' : '#1e293b',
        sideRight: prop.side < 0 ? '#475569' : '#1e293b',
        top: '#ea580c',
      });
      drawExtruded3DBox(laneCoord, prop.worldZ - 0.3, 5.6, 28, 10, 48, {
        front: '#f97316',
        sideLeft: sideDark,
        sideRight: sideDark,
        top: '#facc15',
      });
      const bWin = getWorld3DBoxCoords(laneCoord, prop.worldZ, prop.worldZ + 0.5, 16, 17, 18);
      ctx.fillStyle = '#fef3c7';
      ctx.fillRect(bWin.x0L, bWin.y0T, bWin.x0R - bWin.x0L, bWin.y0B - bWin.y0T);
      ctx.restore();
      return;
    }

    ctx.translate(p.x, p.y);
    ctx.scale(s, s);

    if (prop.kind === 'palm' || prop.kind === 'billboard') {
      if (!isLow) {
        ctx.fillStyle = 'rgba(0,0,0,0.28)';
        ctx.beginPath();
        ctx.ellipse(0, 0, 14, 5, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.strokeStyle = '#5c2c0e';
      ctx.lineWidth = 8;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(prop.side * 6, -45, prop.side * 12, -88);
      ctx.stroke();

      ctx.translate(prop.side * 12, -88);
      if (isUltra) {
        // Coconuts cluster under palm crown
        ctx.fillStyle = '#451a03';
        ctx.beginPath();
        ctx.arc(-3, 5, 4, 0, Math.PI * 2);
        ctx.arc(4, 6, 4, 0, Math.PI * 2);
        ctx.arc(0, 9, 3.5, 0, Math.PI * 2);
        ctx.fill();
      }
      for (let i = 0; i < 7; i += 1) {
        ctx.save();
        ctx.rotate((Math.PI * 2 * i) / 7);
        ctx.fillStyle = i % 2 === 0 ? '#15803d' : '#16a34a';
        ctx.beginPath();
        ctx.ellipse(18, 0, 21, 5.5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    } else if (prop.kind === 'lamp') {
      ctx.fillStyle = '#475569';
      ctx.fillRect(-3, -98, 6, 98);
      ctx.fillStyle = '#94a3b8';
      ctx.fillRect(-3, -98, -prop.side * 22, 4);
      if (!isLow) {
        const glow = ctx.createRadialGradient(-prop.side * 19, -92, 2, -prop.side * 19, -70, 32);
        glow.addColorStop(0, 'rgba(253, 224, 71, 0.55)');
        glow.addColorStop(1, 'rgba(253, 224, 71, 0)');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(-prop.side * 19, -82, 30, 0, Math.PI * 2);
        ctx.fill();
        if (isHigh3D) {
          ctx.fillStyle = isUltra ? 'rgba(254, 240, 138, 0.16)' : 'rgba(254, 240, 138, 0.12)';
          ctx.beginPath();
          ctx.ellipse(-prop.side * 28, -2, 42, 11, 0, 0, Math.PI * 2);
          ctx.fill();
        }
        if (isUltra) {
          // Volumetric downward spotlight cone in Ultra HD+
          ctx.fillStyle = 'rgba(254, 240, 138, 0.08)';
          ctx.beginPath();
          ctx.moveTo(-prop.side * 19, -91);
          ctx.lineTo(-prop.side * 60, 0);
          ctx.lineTo(-prop.side * 4, 0);
          ctx.closePath();
          ctx.fill();
        }
      }
      ctx.fillStyle = '#fef08a';
      ctx.beginPath();
      ctx.arc(-prop.side * 19, -93, 4.5, 0, Math.PI * 2);
      ctx.fill();
    } else if (prop.kind === 'kiosk' || prop.kind === 'building') {
      ctx.fillStyle = 'rgba(0,0,0,0.32)';
      ctx.fillRect(-26, -4, 52, 6);
      ctx.fillStyle = '#334155';
      ctx.fillRect(-22, -48, 44, 48);
      ctx.fillStyle = '#fef3c7';
      ctx.fillRect(-16, -34, 32, 16);
      ctx.fillStyle = '#f97316';
      ctx.fillRect(-25, -52, 50, 9);
      ctx.fillStyle = '#facc15';
      for (let sx = -25; sx < 25; sx += 10) {
        ctx.fillRect(sx, -52, 5, 9);
      }
    } else {
      ctx.fillStyle = '#f8fafc';
      drawRoundedRect(-10, -30, 20, 30, 3);
      ctx.fill();
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(-10, -30, 20, 8);
      ctx.fillStyle = '#facc15';
      ctx.fillRect(-6, -18, 12, 4);
    }

    ctx.restore();
  }

  function drawRoundedRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  function drawWheelBlock(x, y, w, h, phase) {
    ctx.fillStyle = '#090d16';
    drawRoundedRect(x, y, w, h, 3);
    ctx.fill();
    ctx.fillStyle = '#334155';
    const ribOffset = ((Math.sin(phase) + 1) * 0.5) * (h * 0.45);
    ctx.fillRect(x + 2, y + 2 + ribOffset, w - 4, 2.5);
  }

  function drawUltra3DEntity(entity) {
    const lane = typeof entity.visualLane === 'number' ? entity.visualLane : entity.lane;
    const zNear = entity.worldZ;
    const wheelPhase = entity.wheelPhase || 0;
    const p = projectPoint(lane, entity.z);
    const s = p.scale;
    const isUltra = userSettings.graphicsQuality === 'ultra';

    switch (entity.type) {
      case 'pothole': {
        const bFar = projectPoint(lane, worldZToNormalizedZ(zNear + 2.4));
        const cy = (p.y + bFar.y) * 0.5 - 1.5 * s;
        ctx.fillStyle = '#292524';
        ctx.beginPath();
        ctx.ellipse(p.x, cy - 1 * s, 36 * s, 14 * s, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#090d16';
        ctx.beginPath();
        ctx.ellipse(p.x, cy, 30 * s, 10 * s, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#78716c';
        ctx.lineWidth = Math.max(1, 2.4 * s);
        ctx.stroke();
        ctx.fillStyle = 'rgba(56, 189, 248, 0.34)';
        ctx.beginPath();
        ctx.ellipse(p.x - 5 * s, cy, 13 * s, 3.8 * s, 0.12, 0, Math.PI * 2);
        ctx.fill();
        if (isUltra) {
          ctx.fillStyle = '#78716c';
          ctx.fillRect(p.x - 24 * s, cy - 6 * s, 6 * s, 4 * s);
          ctx.fillRect(p.x + 17 * s, cy + 2 * s, 7 * s, 4 * s);
          ctx.fillStyle = 'rgba(253, 224, 71, 0.24)';
          ctx.beginPath();
          ctx.ellipse(p.x + 6 * s, cy - 2 * s, 8 * s, 2.2 * s, 0, 0, Math.PI * 2);
          ctx.fill();
        }
        return true;
      }

      case 'barrier': {
        if (isUltra) {
          drawExtruded3DBox(lane - 0.18, zNear + 0.1, 0.9, 10, 12, 0, {
            front: '#a16207',
            sideLeft: '#78350f',
            sideRight: '#78350f',
            top: '#ca8a04',
          });
          drawExtruded3DBox(lane + 0.18, zNear + 0.1, 0.9, 10, 12, 0, {
            front: '#a16207',
            sideLeft: '#78350f',
            sideRight: '#78350f',
            top: '#ca8a04',
          });
        }
        drawExtruded3DBox(lane, zNear, 1.4, 42, 46, 0, {
          front: '#f8fafc',
          sideLeft: '#cbd5e1',
          sideRight: '#94a3b8',
          top: '#e2e8f0',
        });
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.scale(s, s);
        ctx.fillStyle = '#dc2626';
        for (let sx = -39; sx < 39; sx += 19) {
          ctx.fillRect(sx, -46, 10, 23);
        }
        if (isUltra) {
          const strobeAlpha = 0.25 + 0.35 * Math.abs(Math.sin(engineVibPhase * 0.25));
          ctx.fillStyle = `rgba(245, 158, 11, ${strobeAlpha})`;
          ctx.beginPath();
          ctx.arc(-36, -50, 13, 0, Math.PI * 2);
          ctx.arc(36, -50, 13, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = '#f59e0b';
        ctx.beginPath();
        ctx.arc(-36, -50, 4.5, 0, Math.PI * 2);
        ctx.arc(36, -50, 4.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        return true;
      }

      case 'timber_log': {
        drawExtruded3DBox(lane, zNear, 1.8, 41, 24, 2, {
          front: '#78350f',
          sideLeft: '#451a03',
          sideRight: '#5c2c0e',
          top: '#92400e',
        });
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.scale(s, s);
        ctx.fillStyle = '#d97706';
        ctx.beginPath();
        ctx.ellipse(-38, -14, 6, 11, 0, 0, Math.PI * 2);
        ctx.ellipse(38, -14, 6, 11, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.restore();
        return true;
      }

      case 'yellow_taxi': {
        // Drop shadow across road + true 3D lower body + 3D greenhouse cab
        ctx.fillStyle = 'rgba(0,0,0,0.48)';
        ctx.beginPath();
        ctx.ellipse(p.x, p.y - 2 * s, 44 * s, 10 * s, 0, 0, Math.PI * 2);
        ctx.fill();

        if (isUltra) {
          // Red taillight asphalt reflections under taxi
          const refGrad = ctx.createLinearGradient(0, p.y - 4 * s, 0, p.y + 18 * s);
          refGrad.addColorStop(0, entity.braking ? 'rgba(239, 68, 68, 0.5)' : 'rgba(239, 68, 68, 0.28)');
          refGrad.addColorStop(1, 'rgba(239, 68, 68, 0)');
          ctx.fillStyle = refGrad;
          ctx.fillRect(p.x - 35 * s, p.y - 4 * s, 16 * s, 22 * s);
          ctx.fillRect(p.x + 19 * s, p.y - 4 * s, 16 * s, 22 * s);
        }

        const bBody = drawExtruded3DBox(lane, zNear, 4.8, 38, 30, 12, {
          front: '#facc15',
          sideLeft: '#ca8a04',
          sideRight: '#eab308',
          top: '#fde047',
        });
        const bCab = drawExtruded3DBox(lane, zNear + 1.0, 2.7, 30, 22, 42, {
          front: '#eab308',
          sideLeft: '#a16207',
          sideRight: '#ca8a04',
          top: '#fef08a',
        });
        // 3D side window strips when side is visible
        if (bCab.x1L > bCab.x0L + 1.5) {
          ctx.fillStyle = '#0f172a';
          ctx.beginPath();
          ctx.moveTo(bCab.x0L, bCab.y0T + (bCab.y0B - bCab.y0T) * 0.2);
          ctx.lineTo(bCab.x1L, bCab.y1T + (bCab.y1B - bCab.y1T) * 0.2);
          ctx.lineTo(bCab.x1L, bCab.y1B - (bCab.y1B - bCab.y1T) * 0.12);
          ctx.lineTo(bCab.x0L, bCab.y0B - (bCab.y0B - bCab.y0T) * 0.12);
          ctx.closePath();
          ctx.fill();
        }
        if (bCab.x1R < bCab.x0R - 1.5) {
          ctx.fillStyle = '#0f172a';
          ctx.beginPath();
          ctx.moveTo(bCab.x0R, bCab.y0T + (bCab.y0B - bCab.y0T) * 0.2);
          ctx.lineTo(bCab.x1R, bCab.y1T + (bCab.y1B - bCab.y1T) * 0.2);
          ctx.lineTo(bCab.x1R, bCab.y1B - (bCab.y1B - bCab.y1T) * 0.12);
          ctx.lineTo(bCab.x0R, bCab.y0B - (bCab.y0B - bCab.y0T) * 0.12);
          ctx.closePath();
          ctx.fill();
        }

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.scale(s, s);
        drawWheelBlock(-36, -16, 12, 16, wheelPhase);
        drawWheelBlock(24, -16, 12, 16, wheelPhase);
        ctx.fillStyle = '#1e293b';
        drawRoundedRect(-38, -16, 76, 6, 2);
        ctx.fill();
        if (isUltra) {
          // 3D wing mirrors + Cameroon flag badge + glowing TAXI sign
          ctx.fillStyle = '#eab308';
          drawRoundedRect(-44, -44, 7, 5, 2);
          ctx.fill();
          drawRoundedRect(37, -44, 7, 5, 2);
          ctx.fill();
          ctx.fillStyle = '#007a5e';
          ctx.fillRect(-30, -24, 4, 5);
          ctx.fillStyle = '#ce1126';
          ctx.fillRect(-26, -24, 4, 5);
          ctx.fillStyle = '#fcd116';
          ctx.fillRect(-22, -24, 4, 5);
          ctx.fillStyle = 'rgba(254, 240, 138, 0.32)';
          ctx.beginPath();
          ctx.arc(0, -68, 16, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = '#0f172a';
        drawRoundedRect(-25, -60, 50, 14, 3);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        drawRoundedRect(-12, -72, 24, 8, 3);
        ctx.fill();
        ctx.fillStyle = '#0f172a';
        ctx.font = 'bold 6px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('TAXI', 0, -66);
        const glowAlpha = entity.braking ? 0.65 : 0.34;
        ctx.fillStyle = `rgba(239, 68, 68, ${glowAlpha})`;
        ctx.beginPath();
        ctx.arc(-27, -30, 14, 0, Math.PI * 2);
        ctx.arc(27, -30, 14, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ef4444';
        drawRoundedRect(-34, -34, 14, 8, 2);
        ctx.fill();
        drawRoundedRect(20, -34, 14, 8, 2);
        ctx.fill();
        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(-11, -24, 22, 7);
        ctx.restore();
        return bBody !== null;
      }

      case 'timber_truck': {
        ctx.fillStyle = 'rgba(0,0,0,0.52)';
        ctx.beginPath();
        ctx.ellipse(p.x, p.y - 2 * s, 50 * s, 12 * s, 0, 0, Math.PI * 2);
        ctx.fill();

        if (isUltra) {
          // Forward 3D truck cab towering above log bed + exhaust stack
          drawExtruded3DBox(lane, zNear + 8.4, 3.2, 42, 82, 16, {
            front: '#b91c1c',
            sideLeft: '#7f1d1d',
            sideRight: '#991b1b',
            top: '#dc2626',
          });
        }

        drawExtruded3DBox(lane, zNear, 8.5, 45, 22, 16, {
          front: '#334155',
          sideLeft: '#1e293b',
          sideRight: '#475569',
          top: '#64748b',
        });
        drawExtruded3DBox(lane, zNear + 0.4, 7.6, 36, 56, 38, {
          front: '#5c2c0e',
          sideLeft: '#451a03',
          sideRight: '#78350f',
          top: '#92400e',
        });

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.scale(s, s);
        if (isUltra) {
          // Chrome exhaust stack + diesel puff + mudflaps
          ctx.fillStyle = '#94a3b8';
          ctx.fillRect(36, -112, 6, 48);
          ctx.fillStyle = 'rgba(203, 213, 225, 0.35)';
          const smokeShift = (engineVibPhase * 2) % 16;
          ctx.beginPath();
          ctx.arc(39, -118 - smokeShift, 6 + smokeShift * 0.25, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#090d16';
          ctx.fillRect(-44, -14, 15, 11);
          ctx.fillRect(29, -14, 15, 11);
        }
        drawWheelBlock(-45, -22, 16, 22, wheelPhase);
        drawWheelBlock(29, -22, 16, 22, wheelPhase);
        const logCenters = [
          [-24, -55], [0, -55], [24, -55],
          [-13, -75], [13, -75],
          [0, -94],
        ];
        logCenters.forEach(([lx, ly]) => {
          ctx.fillStyle = '#78350f';
          ctx.beginPath();
          ctx.arc(lx, ly, 13, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#d97706';
          ctx.beginPath();
          ctx.arc(lx, ly, 9, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#fbbf24';
          ctx.beginPath();
          ctx.arc(lx, ly, 3, 0, Math.PI * 2);
          ctx.fill();
        });
        ctx.fillStyle = '#dc2626';
        ctx.fillRect(-6, -48, 12, 18);
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(-41, -32, 12, 8);
        ctx.fillRect(29, -32, 12, 8);
        ctx.restore();
        return true;
      }

      case 'clando_van': {
        ctx.fillStyle = 'rgba(0,0,0,0.48)';
        ctx.beginPath();
        ctx.ellipse(p.x, p.y - 2 * s, 44 * s, 10 * s, 0, 0, Math.PI * 2);
        ctx.fill();

        const bVan = drawExtruded3DBox(lane, zNear, 5.4, 40, 64, 12, {
          front: '#e2e8f0',
          sideLeft: '#94a3b8',
          sideRight: '#cbd5e1',
          top: '#f8fafc',
        });
        if (bVan.x1L > bVan.x0L + 1.5) {
          ctx.fillStyle = '#0284c7';
          ctx.beginPath();
          ctx.moveTo(bVan.x0L, bVan.y0T + (bVan.y0B - bVan.y0T) * 0.45);
          ctx.lineTo(bVan.x1L, bVan.y1T + (bVan.y1B - bVan.y1T) * 0.45);
          ctx.lineTo(bVan.x1L, bVan.y1T + (bVan.y1B - bVan.y1T) * 0.62);
          ctx.lineTo(bVan.x0L, bVan.y0T + (bVan.y0B - bVan.y0T) * 0.62);
          ctx.closePath();
          ctx.fill();
        }
        if (bVan.x1R < bVan.x0R - 1.5) {
          ctx.fillStyle = '#0284c7';
          ctx.beginPath();
          ctx.moveTo(bVan.x0R, bVan.y0T + (bVan.y0B - bVan.y0T) * 0.45);
          ctx.lineTo(bVan.x1R, bVan.y1T + (bVan.y1B - bVan.y1T) * 0.45);
          ctx.lineTo(bVan.x1R, bVan.y1T + (bVan.y1B - bVan.y1T) * 0.62);
          ctx.lineTo(bVan.x0R, bVan.y0T + (bVan.y0B - bVan.y0T) * 0.62);
          ctx.closePath();
          ctx.fill();
        }
        drawExtruded3DBox(lane, zNear + 0.4, 4.4, 24, 9, 78, {
          front: '#b45309',
          sideLeft: '#78350f',
          sideRight: '#92400e',
          top: '#d97706',
        });
        if (isUltra) {
          drawExtruded3DBox(lane - 0.14, zNear + 0.9, 2.2, 11, 10, 87, {
            front: '#15803d',
            sideLeft: '#14532d',
            sideRight: '#166534',
            top: '#22c55e',
          });
        }

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.scale(s, s);
        drawWheelBlock(-38, -16, 12, 16, wheelPhase);
        drawWheelBlock(26, -16, 12, 16, wheelPhase);
        ctx.fillStyle = '#0284c7';
        ctx.fillRect(-40, -45, 80, 11);
        ctx.fillStyle = '#0f172a';
        drawRoundedRect(-30, -68, 60, 20, 4);
        ctx.fill();
        if (isUltra) {
          // Spare tire mounted on back door + chrome ladder
          ctx.fillStyle = '#090d16';
          ctx.beginPath();
          ctx.arc(-14, -30, 10, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#94a3b8';
          ctx.beginPath();
          ctx.arc(-14, -30, 4, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillRect(10, -72, 2.5, 56);
          ctx.fillRect(20, -72, 2.5, 56);
          for (let ry = -66; ry <= -22; ry += 10) {
            ctx.fillRect(10, ry, 12, 2);
          }
        }
        ctx.fillStyle = '#ef4444';
        drawRoundedRect(-36, -31, 11, 12, 2);
        ctx.fill();
        drawRoundedRect(25, -31, 11, 12, 2);
        ctx.fill();
        ctx.restore();
        return true;
      }

      case 'rival_moto': {
        drawExtruded3DBox(lane, zNear, 2.2, 10, 22, 16, {
          front: '#1e293b',
          sideLeft: '#0f172a',
          sideRight: '#334155',
          top: '#475569',
        });
        if (isUltra) {
          drawExtruded3DBox(lane, zNear + 0.3, 1.5, 13, 20, 38, {
            front: '#eab308',
            sideLeft: '#ca8a04',
            sideRight: '#ca8a04',
            top: '#fde047',
          });
        }
        break;
      }
    }
    return false;
  }

  function drawCanvasVehicleSignals(entity, p, s) {
    const cfg = ENTITY_CONFIG[entity.type];
    if (!cfg || !cfg.isVehicle) return;
    const laneFloat = typeof entity.visualLane === 'number' ? entity.visualLane : entity.lane;
    const laneErr = entity.lane - laneFloat;
    const sigDir = entity.signalDir || (laneErr < -0.02 ? -1 : laneErr > 0.02 ? 1 : 0);
    if (!sigDir) return;
    const blinkOn = Math.floor(performance.now() * 0.0075) % 2 === 0;
    if (!blinkOn) return;

    const halfSpread =
      entity.type === 'rival_moto' ? 14 : entity.type === 'timber_truck' ? 40 : 34;
    const sigY = p.y - (entity.type === 'rival_moto' ? 30 : 28) * s;
    const sigX = p.x + sigDir * halfSpread * s;

    ctx.save();
    ctx.fillStyle = 'rgba(245, 158, 11, 0.45)';
    ctx.beginPath();
    ctx.arc(sigX, sigY, 13 * s, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#fbbf24';
    ctx.beginPath();
    ctx.arc(sigX, sigY, 6 * s, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#fffbeb';
    ctx.font = `900 ${Math.max(8, Math.round(12 * s))}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(sigDir < 0 ? '<' : '>', sigX, sigY - 12 * s);
    ctx.restore();
  }

  function drawEntity(entity) {
    if (entity.z < 0.008 || entity.z > 1.06) return;
    const entityLane = typeof entity.visualLane === 'number' ? entity.visualLane : entity.lane;
    const p = projectPoint(entityLane, entity.z);
    const s = p.scale;
    const wheelPhase = entity.wheelPhase || 0;
    const isLow = false;
    const isHigh3D = isQualityAtLeast('normal');
    const horizonAlpha = Math.min(1, entity.z / 0.05);

    ctx.save();
    ctx.globalAlpha = horizonAlpha;

    if (isHigh3D && drawUltra3DEntity(entity)) {
      drawCanvasVehicleSignals(entity, p, s);
      ctx.restore();
      return;
    }

    ctx.translate(p.x, p.y);
    ctx.scale(s, s);

    switch (entity.type) {
      case 'pothole': {
        ctx.fillStyle = '#292524';
        ctx.beginPath();
        ctx.ellipse(0, -6, 35, 13, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#090d16';
        ctx.beginPath();
        ctx.ellipse(0, -6, 29, 9.5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#57534e';
        ctx.lineWidth = 2.5;
        ctx.stroke();
        ctx.fillStyle = 'rgba(56, 189, 248, 0.25)';
        ctx.beginPath();
        ctx.ellipse(-6, -7, 12, 3.5, 0.15, 0, Math.PI * 2);
        ctx.fill();
        break;
      }

      case 'barrier': {
        ctx.fillStyle = 'rgba(0,0,0,0.4)';
        ctx.fillRect(-42, -3, 84, 6);
        ctx.fillStyle = '#334155';
        ctx.fillRect(-38, -44, 6, 44);
        ctx.fillRect(32, -44, 6, 44);
        ctx.fillStyle = '#f8fafc';
        drawRoundedRect(-43, -46, 86, 23, 4);
        ctx.fill();
        ctx.fillStyle = '#dc2626';
        for (let sx = -39; sx < 39; sx += 19) {
          ctx.fillRect(sx, -46, 10, 23);
        }
        // Flashing corner beacons
        ctx.fillStyle = '#f59e0b';
        ctx.beginPath();
        ctx.arc(-36, -50, 4.5, 0, Math.PI * 2);
        ctx.arc(36, -50, 4.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ea580c';
        ctx.beginPath();
        ctx.moveTo(-36, 0);
        ctx.lineTo(-28, -22);
        ctx.lineTo(-20, 0);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(20, 0);
        ctx.lineTo(28, -22);
        ctx.lineTo(36, 0);
        ctx.closePath();
        ctx.fill();
        break;
      }

      case 'timber_log': {
        ctx.fillStyle = 'rgba(0,0,0,0.45)';
        ctx.beginPath();
        ctx.ellipse(0, -2, 46, 8, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#5c2c0e';
        drawRoundedRect(-42, -28, 84, 24, 10);
        ctx.fill();
        ctx.fillStyle = '#78350f';
        ctx.fillRect(-36, -24, 72, 9);
        ctx.fillStyle = '#d97706';
        ctx.beginPath();
        ctx.ellipse(-40, -16, 6, 12, 0, 0, Math.PI * 2);
        ctx.ellipse(40, -16, 6, 12, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#92400e';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        break;
      }

      case 'yellow_taxi': {
        ctx.fillStyle = 'rgba(0,0,0,0.48)';
        ctx.beginPath();
        ctx.ellipse(0, -2, 42, 9, 0, 0, Math.PI * 2);
        ctx.fill();
        drawWheelBlock(-36, -16, 12, 16, wheelPhase);
        drawWheelBlock(24, -16, 12, 16, wheelPhase);
        // Bumper & lower chassis shadow
        ctx.fillStyle = '#1e293b';
        drawRoundedRect(-38, -17, 76, 8, 3);
        ctx.fill();
        // Shaded 3D body panels
        ctx.fillStyle = '#ca8a04';
        drawRoundedRect(-39, -44, 78, 32, 8);
        ctx.fill();
        ctx.fillStyle = '#facc15';
        drawRoundedRect(-35, -45, 70, 29, 7);
        ctx.fill();
        // Cabin & roof highlight
        ctx.fillStyle = '#eab308';
        drawRoundedRect(-31, -66, 62, 24, 7);
        ctx.fill();
        ctx.fillStyle = '#fde047';
        drawRoundedRect(-27, -67, 54, 6, 3);
        ctx.fill();
        // Windshield with specular sky glare
        ctx.fillStyle = '#0f172a';
        drawRoundedRect(-25, -61, 50, 15, 4);
        ctx.fill();
        ctx.fillStyle = 'rgba(125, 211, 252, 0.25)';
        ctx.beginPath();
        ctx.moveTo(-22, -60);
        ctx.lineTo(-8, -60);
        ctx.lineTo(-16, -47);
        ctx.lineTo(-22, -47);
        ctx.closePath();
        ctx.fill();
        // Illuminated TAXI roof box
        ctx.fillStyle = '#ffffff';
        drawRoundedRect(-12, -74, 24, 8, 3);
        ctx.fill();
        ctx.fillStyle = '#0f172a';
        ctx.font = 'bold 6px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('TAXI', 0, -68);
        // LED taillights + brake glow
        const glowAlpha = entity.braking ? 0.6 : 0.32;
        ctx.fillStyle = `rgba(239, 68, 68, ${glowAlpha})`;
        ctx.beginPath();
        ctx.arc(-27, -33, 14, 0, Math.PI * 2);
        ctx.arc(27, -33, 14, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ef4444';
        drawRoundedRect(-34, -37, 14, 8, 2);
        ctx.fill();
        drawRoundedRect(20, -37, 14, 8, 2);
        ctx.fill();
        // License plate
        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(-11, -26, 22, 7);
        break;
      }

      case 'timber_truck': {
        ctx.fillStyle = 'rgba(0,0,0,0.52)';
        ctx.beginPath();
        ctx.ellipse(0, -2, 50, 11, 0, 0, Math.PI * 2);
        ctx.fill();
        drawWheelBlock(-45, -22, 16, 22, wheelPhase);
        drawWheelBlock(29, -22, 16, 22, wheelPhase);
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(-46, -24, 92, 10);
        ctx.fillStyle = '#334155';
        drawRoundedRect(-46, -37, 92, 16, 3);
        ctx.fill();
        ctx.fillStyle = '#475569';
        ctx.fillRect(-44, -37, 88, 4);
        const logCenters = [
          [-24, -55], [0, -55], [24, -55],
          [-13, -75], [13, -75],
          [0, -94],
        ];
        logCenters.forEach(([lx, ly]) => {
          ctx.fillStyle = '#78350f';
          ctx.beginPath();
          ctx.arc(lx, ly, 13, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#d97706';
          ctx.beginPath();
          ctx.arc(lx, ly, 9, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#92400e';
          ctx.lineWidth = 1.5;
          ctx.stroke();
          ctx.fillStyle = '#fbbf24';
          ctx.beginPath();
          ctx.arc(lx, ly, 3, 0, Math.PI * 2);
          ctx.fill();
        });
        // Lashing chain + red danger marker
        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-36, -42);
        ctx.lineTo(0, -104);
        ctx.lineTo(36, -42);
        ctx.stroke();
        ctx.fillStyle = '#dc2626';
        ctx.fillRect(-6, -48, 12, 18);
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(-41, -32, 12, 8);
        ctx.fillRect(29, -32, 12, 8);
        break;
      }

      case 'clando_van': {
        ctx.fillStyle = 'rgba(0,0,0,0.48)';
        ctx.beginPath();
        ctx.ellipse(0, -2, 43, 9, 0, 0, Math.PI * 2);
        ctx.fill();
        drawWheelBlock(-38, -16, 12, 16, wheelPhase);
        drawWheelBlock(26, -16, 12, 16, wheelPhase);
        ctx.fillStyle = '#cbd5e1';
        drawRoundedRect(-41, -76, 82, 66, 9);
        ctx.fill();
        ctx.fillStyle = '#e2e8f0';
        drawRoundedRect(-36, -77, 72, 64, 7);
        ctx.fill();
        ctx.fillStyle = '#0284c7';
        ctx.fillRect(-41, -45, 82, 12);
        ctx.fillStyle = '#0f172a';
        drawRoundedRect(-30, -68, 60, 20, 4);
        ctx.fill();
        ctx.fillStyle = 'rgba(125, 211, 252, 0.22)';
        ctx.fillRect(-26, -66, 18, 16);
        // Loaded roof rack
        ctx.fillStyle = '#475569';
        ctx.fillRect(-29, -81, 58, 5);
        ctx.fillStyle = '#b45309';
        drawRoundedRect(-24, -89, 48, 9, 2);
        ctx.fill();
        ctx.fillStyle = '#ef4444';
        drawRoundedRect(-36, -31, 11, 12, 2);
        ctx.fill();
        drawRoundedRect(25, -31, 11, 12, 2);
        ctx.fill();
        break;
      }

      case 'rival_moto': {
        ctx.fillStyle = 'rgba(0,0,0,0.42)';
        ctx.beginPath();
        ctx.ellipse(0, -2, 18, 6, 0, 0, Math.PI * 2);
        ctx.fill();
        drawWheelBlock(-6, -24, 12, 24, wheelPhase);
        // Chrome rear fender & dual exhausts
        ctx.fillStyle = '#94a3b8';
        ctx.fillRect(-13, -22, 5, 14);
        ctx.fillRect(8, -22, 5, 14);
        ctx.fillStyle = '#1e293b';
        drawRoundedRect(-11, -38, 22, 18, 5);
        ctx.fill();
        // Glowing red taillight
        ctx.fillStyle = '#ef4444';
        drawRoundedRect(-5, -34, 10, 6, 2);
        ctx.fill();
        // Rider torso + backpack + helmet
        ctx.fillStyle = '#eab308';
        drawRoundedRect(-14, -56, 28, 22, 7);
        ctx.fill();
        ctx.fillStyle = '#334155';
        drawRoundedRect(-9, -54, 18, 15, 4);
        ctx.fill();
        ctx.fillStyle = '#dc2626';
        ctx.beginPath();
        ctx.arc(0, -64, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#38bdf8';
        ctx.fillRect(-6, -65, 12, 3);
        break;
      }

      case 'fuel_can': {
        const bob = Math.sin(engineVibPhase * 0.22 + entity.worldZ * 0.4) * 4;
        const pulse = 1 + Math.sin(engineVibPhase * 0.35 + entity.worldZ * 0.2) * 0.08;
        ctx.translate(0, bob - 18);
        ctx.scale(pulse, pulse);
        ctx.fillStyle = 'rgba(249, 115, 22, 0.28)';
        ctx.beginPath();
        ctx.arc(0, 0, 26, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ea580c';
        drawRoundedRect(-14, -18, 28, 34, 6);
        ctx.fill();
        ctx.fillStyle = '#9a3412';
        ctx.fillRect(-10, -14, 20, 6);
        ctx.fillStyle = '#fde047';
        ctx.fillRect(-4, -24, 8, 6);
        // Custom vector flame crest (no sticker/emoji)
        ctx.fillStyle = '#fef08a';
        ctx.beginPath();
        ctx.moveTo(0, -8);
        ctx.quadraticCurveTo(9, 1, 0, 11);
        ctx.quadraticCurveTo(-9, 1, 0, -8);
        ctx.fill();
        break;
      }

      case 'shield': {
        const bob = Math.sin(engineVibPhase * 0.22 + entity.worldZ * 0.4) * 4;
        const pulse = 1 + Math.sin(engineVibPhase * 0.28) * 0.08;
        ctx.translate(0, bob - 18);
        ctx.fillStyle = 'rgba(56, 189, 248, 0.26)';
        ctx.beginPath();
        ctx.arc(0, 0, 26 * pulse, 0, Math.PI * 2);
        ctx.fill();
        // Custom sculpted shield coat-of-arms
        ctx.fillStyle = '#0284c7';
        ctx.beginPath();
        ctx.moveTo(0, -18);
        ctx.lineTo(15, -12);
        ctx.lineTo(13, 4);
        ctx.quadraticCurveTo(0, 19, 0, 19);
        ctx.quadraticCurveTo(0, 19, -13, 4);
        ctx.lineTo(-15, -12);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#bae6fd';
        ctx.lineWidth = 2.6;
        ctx.stroke();
        ctx.fillStyle = '#e0f2fe';
        ctx.fillRect(-2.5, -9, 5, 16);
        ctx.fillRect(-8, -3.5, 16, 5);
        break;
      }

      case 'magnet': {
        const bob = Math.sin(engineVibPhase * 0.24 + entity.worldZ * 0.35) * 4;
        const spin = Math.sin(engineVibPhase * 0.12 + entity.worldZ * 0.15) * 0.25;
        ctx.translate(0, bob - 18);
        ctx.rotate(spin);
        ctx.fillStyle = 'rgba(251, 113, 133, 0.24)';
        ctx.beginPath();
        ctx.arc(0, 0, 26, 0, Math.PI * 2);
        ctx.fill();
        // Custom U-shaped horseshoe magnet with chrome poles
        ctx.strokeStyle = '#e11d48';
        ctx.lineWidth = 7.5;
        ctx.lineCap = 'butt';
        ctx.beginPath();
        ctx.arc(0, -3, 12, 0, Math.PI, false);
        ctx.stroke();
        ctx.fillStyle = '#e11d48';
        ctx.fillRect(-15.5, -15, 7, 13);
        ctx.fillRect(8.5, -15, 7, 13);
        ctx.fillStyle = '#e2e8f0';
        ctx.fillRect(-15.5, -18, 7, 5);
        ctx.fillRect(8.5, -18, 7, 5);
        // Animated magnetic waves
        ctx.strokeStyle = '#fde047';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.arc(0, -18, 6 + (Math.sin(engineVibPhase * 0.35) + 1) * 2.5, Math.PI * 1.15, Math.PI * 1.85);
        ctx.stroke();
        break;
      }

      case 'coin': {
        const bob = Math.sin(engineVibPhase * 0.25 + entity.worldZ * 0.4) * 4;
        const spinWidth = Math.max(0.28, Math.abs(Math.cos(engineVibPhase * 0.18 + entity.worldZ * 0.3)));
        ctx.translate(0, bob - 18);
        ctx.fillStyle = 'rgba(250, 204, 21, 0.28)';
        ctx.beginPath();
        ctx.arc(0, 0, 22, 0, Math.PI * 2);
        ctx.fill();
        ctx.scale(spinWidth, 1);
        ctx.fillStyle = '#facc15';
        ctx.beginPath();
        ctx.arc(0, 0, 14, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ca8a04';
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.fillStyle = '#854d0e';
        ctx.beginPath();
        for (let i = 0; i < 10; i += 1) {
          const rad = i % 2 === 0 ? 7.2 : 3.2;
          const ang = (i * Math.PI) / 5 - Math.PI / 2;
          const sx = Math.cos(ang) * rad;
          const sy = Math.sin(ang) * rad;
          if (i === 0) ctx.moveTo(sx, sy);
          else ctx.lineTo(sx, sy);
        }
        ctx.closePath();
        ctx.fill();
        break;
      }
    }

    ctx.restore();
    drawCanvasVehicleSignals(entity, p, s);
  }

  function drawWindStreaks() {
    if (currentState !== GAME_STATE.PLAYING) return;
    const intensity = Math.max(0, Math.min(1, (speedKmh - 75) / 75));
    if (intensity <= 0.04) return;

    const horizonY = getHorizonY();
    ctx.save();
    ctx.strokeStyle = `rgba(248, 250, 252, ${0.12 + 0.32 * intensity})`;
    ctx.lineWidth = 1.4 + intensity * 1.1;

    windStreaks.forEach((streak) => {
      const startX =
        streak.side < 0
          ? 6 + streak.offsetRatio * 48
          : LOGICAL_WIDTH - 6 - streak.offsetRatio * 48;
      const y0 = horizonY + streak.progress * (logicalHeight - horizonY);
      const len = 18 + (28 + 46 * intensity) * streak.progress;
      ctx.beginPath();
      ctx.moveTo(startX, y0);
      ctx.lineTo(startX + streak.side * 8, y0 + len);
      ctx.stroke();
    });

    ctx.restore();
  }

  function drawSideMirror(side, cameraZ) {
    ctx.save();
    // Chrome mirror stalk
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(side * 68, -26);
    ctx.lineTo(side * 102, -62);
    ctx.stroke();
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1.8;
    ctx.stroke();

    ctx.translate(side * 108, -70);
    ctx.rotate(side * 0.14);

    // Outer matte mirror shell
    ctx.fillStyle = '#090d16';
    drawRoundedRect(-25, -15, 50, 30, 10);
    ctx.fill();
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Working glass reflection clipped to mirror interior
    ctx.save();
    drawRoundedRect(-21, -11, 42, 22, 7);
    ctx.clip();

    ctx.rotate(-worldRollAngle * 0.8);
    const skyRef = ctx.createLinearGradient(0, -12, 0, 2);
    skyRef.addColorStop(0, '#1e3a5f');
    skyRef.addColorStop(1, '#ea8c3b');
    ctx.fillStyle = skyRef;
    ctx.fillRect(-28, -14, 56, 16);

    ctx.fillStyle = '#5c2b17';
    ctx.fillRect(-28, 0, 56, 16);

    // Reflected receding road & animated scrolling curb dashes
    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.moveTo(-8, 0);
    ctx.lineTo(8, 0);
    ctx.lineTo(24, 14);
    ctx.lineTo(-24, 14);
    ctx.closePath();
    ctx.fill();

    const mirrorPhase = (cameraZ % 8) / 8;
    ctx.strokeStyle = 'rgba(250, 204, 21, 0.75)';
    ctx.lineWidth = 1.5;
    const stripeY = 2 + mirrorPhase * 9;
    ctx.beginPath();
    ctx.moveTo(-2, stripeY);
    ctx.lineTo(2, stripeY);
    ctx.stroke();

    // Ultra HD+: live approaching/passed vehicle headlights in side mirror
    if (userSettings.graphicsQuality === 'ultra') {
      entities.forEach((ent) => {
        if (!ENTITY_CONFIG[ent.type].isVehicle) return;
        const ahead = ent.worldZ - cameraZ;
        if (ahead > -10 && ahead < 26) {
          const laneMatch = (side < 0 && ent.lane <= currentLane) || (side > 0 && ent.lane >= currentLane);
          if (laneMatch) {
            const distScale = Math.max(0.25, 1 - Math.abs(ahead) / 26);
            const rx = (ent.lane - currentLane) * 7;
            const ry = 3 + (1 - distScale) * 5;
            ctx.fillStyle = ent.type === 'yellow_taxi' ? '#facc15' : '#cbd5e1';
            ctx.fillRect(rx - 4 * distScale, ry - 3 * distScale, 8 * distScale, 5 * distScale);
            ctx.fillStyle = '#fef08a';
            ctx.fillRect(rx - 3 * distScale, ry, 1.8, 1.8);
            ctx.fillRect(rx + 1.2 * distScale, ry, 1.8, 1.8);
          }
        }
      });
    }
    ctx.restore();

    ctx.restore();
  }

  function drawInstrumentCluster(kmh, braking) {
    // Center backlit carbon housing
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.arc(0, -34, 37, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = braking
      ? '#ef4444'
      : comboTimer > 0
      ? '#facc15'
      : '#64748b';
    ctx.lineWidth = braking || comboTimer > 0 ? 4 : 3;
    ctx.stroke();

    // Inner dial face
    ctx.fillStyle = '#020617';
    ctx.beginPath();
    ctx.arc(0, -34, 32, 0, Math.PI * 2);
    ctx.fill();

    // Segmented backlit RPM LED bar
    const rpmRatio = getRpmRatio(kmh);
    const segCount = 10;
    const litCount = Math.round(rpmRatio * segCount);
    const startA = Math.PI * 0.82;
    const sweepA = Math.PI * 1.36;
    for (let i = 0; i < segCount; i += 1) {
      const a0 = startA + (i / segCount) * sweepA;
      const a1 = a0 + (sweepA / segCount) * 0.72;
      ctx.strokeStyle =
        i < litCount
          ? i >= 8
            ? '#ef4444'
            : i >= 5
            ? '#facc15'
            : '#22c55e'
          : 'rgba(148, 163, 184, 0.2)';
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.arc(0, -34, 26, a0, a1);
      ctx.stroke();
    }

    // Analog speedometer needle
    const speedRatio = Math.min(1, kmh / SPEED_CURVE.MAX_KMH);
    const needleAngle = startA + speedRatio * sweepA;
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(0, -34);
    ctx.lineTo(Math.cos(needleAngle) * 21, -34 + Math.sin(needleAngle) * 21);
    ctx.stroke();

    ctx.fillStyle = '#facc15';
    ctx.beginPath();
    ctx.arc(0, -34, 3.5, 0, Math.PI * 2);
    ctx.fill();

    // Gear badge (left), BRK warning LED (right), Speed & ODO (bottom)
    const gear = getGearForSpeed(kmh);
    ctx.fillStyle = '#fde047';
    ctx.font = 'bold 8px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`G${gear}`, -16, -24);

    ctx.fillStyle = braking ? '#ef4444' : 'rgba(239, 68, 68, 0.22)';
    drawRoundedRect(8, -28, 17, 9, 2);
    ctx.fill();
    ctx.fillStyle = braking ? '#ffffff' : 'rgba(248, 250, 252, 0.35)';
    ctx.font = 'bold 6.5px monospace';
    ctx.fillText('BRK', 16.5, -23.5);

    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 11px monospace';
    ctx.fillText(`${kmh}`, 0, -14);

    const odoText = `${Math.floor(distanceMeters)}m`;
    ctx.fillStyle = '#94a3b8';
    ctx.font = 'bold 7px monospace';
    ctx.fillText(odoText, 0, -5);
  }

  function drawCockpitHandlebars() {
    const baseX = getHandlebarBaseX();
    const baseY = logicalHeight - 28;
    const rattleX = rattleTimer > 0 ? Math.sin(rattleTimer * 95) * 6 : 0;
    const rattleY = rattleTimer > 0 ? Math.cos(rattleTimer * 110) * 4 : 0;
    const engineBob = Math.sin(engineVibPhase) * (0.8 + (speedKmh / SPEED_CURVE.MAX_KMH) * 0.7);
    const braking = isBrakingActive();
    const kmh = currentState === GAME_STATE.PLAYING || currentState === GAME_STATE.PAUSED
      ? Math.round(speedKmh)
      : 0;
    const celebrating = celebrationTimer > 0;
    const wheeliePitch = celebrating
      ? -Math.sin(Math.min(1, celebrationTimer / 2.5) * Math.PI) * 14
      : 0;

    ctx.save();
    ctx.translate(baseX + rattleX, baseY + rattleY + engineBob + suspensionPitch * 1.8 + wheeliePitch);
    ctx.scale(0.72, 0.72);
    ctx.rotate(handlebarAngle);

    // Warm forward headlight cone (enabled on Normal, High & Ultra)
    if (isQualityAtLeast('normal')) {
      const beamGrad = ctx.createLinearGradient(0, -245, 0, -32);
      beamGrad.addColorStop(0, 'rgba(254, 240, 138, 0)');
      beamGrad.addColorStop(1, 'rgba(254, 240, 138, 0.16)');
      ctx.fillStyle = beamGrad;
      ctx.beginPath();
      ctx.moveTo(-24, -28);
      ctx.lineTo(-92, -250);
      ctx.lineTo(92, -250);
      ctx.lineTo(24, -28);
      ctx.closePath();
      ctx.fill();
    }

    // Tinted polycarbonate windscreen visor + sky glare
    ctx.fillStyle = 'rgba(15, 23, 42, 0.42)';
    ctx.beginPath();
    ctx.moveTo(-58, -32);
    ctx.quadraticCurveTo(-48, -98, 0, -104);
    ctx.quadraticCurveTo(48, -98, 58, -32);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.55)';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    ctx.fillStyle = 'rgba(248, 250, 252, 0.14)';
    ctx.beginPath();
    ctx.moveTo(-34, -44);
    ctx.lineTo(-10, -92);
    ctx.lineTo(6, -92);
    ctx.lineTo(-18, -44);
    ctx.closePath();
    ctx.fill();

    // Working left & right rear-view mirrors
    const mirrorCameraZ = getActiveCameraZ();
    drawSideMirror(-1, mirrorCameraZ);
    drawSideMirror(1, mirrorCameraZ);

    // Steering triple-clamp stem (matte slate + metallic trim)
    ctx.fillStyle = '#1e293b';
    drawRoundedRect(-20, -40, 40, 44, 10);
    ctx.fill();
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Chrome & matte-black handlebar tube
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 11;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-138, -4);
    ctx.quadraticCurveTo(-70, -28, 0, -24);
    ctx.quadraticCurveTo(70, -28, 138, -4);
    ctx.stroke();

    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(-124, -7);
    ctx.quadraticCurveTo(-68, -29, 0, -25);
    ctx.quadraticCurveTo(68, -29, 124, -7);
    ctx.stroke();

    // Crossbar brace
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(-64, -22);
    ctx.lineTo(64, -22);
    ctx.stroke();

    // Brake (right) & Clutch (left) levers — right squeezes inward when braking
    [-1, 1].forEach((side) => {
      ctx.save();
      ctx.translate(side * 78, -22);
      const squeezeAngle = side === 1 && braking ? 0.24 : 0;
      ctx.rotate(side * (-0.06 + squeezeAngle));
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(side * 46, 5);
      ctx.stroke();
      ctx.fillStyle = '#cbd5e1';
      ctx.beginPath();
      ctx.arc(side * 46, 5, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });

    // Ribbed rubber grips, switchgear & armored riding gloves
    [-1, 1].forEach((side) => {
      ctx.save();
      ctx.translate(side * 108, -11);
      ctx.rotate(side * 0.22);

      // Switchgear pod
      ctx.fillStyle = '#1e293b';
      drawRoundedRect(side > 0 ? -34 : 18, -11, 16, 22, 4);
      ctx.fill();
      ctx.fillStyle = side > 0 ? '#ef4444' : '#facc15';
      ctx.fillRect(side > 0 ? -29 : 23, -5, 6, 6);

      // Textured grip
      ctx.fillStyle = '#090d16';
      drawRoundedRect(-28, -9, 56, 18, 7);
      ctx.fill();
      ctx.fillStyle = '#334155';
      for (let rx = -18; rx <= 18; rx += 8) {
        ctx.fillRect(rx, -8, 3, 16);
      }

      // Armored motorcycle glove (raises in a "HOO YEAH!" celebratory fist pump when beating PB!)
      if (side === -1 && celebrating) {
        const pumpWave = Math.sin(celebrationTimer * 14) * 8;
        ctx.save();
        ctx.translate(-8, -44 + pumpWave);
        ctx.rotate(-0.22);
        ctx.fillStyle = '#111827';
        drawRoundedRect(-16, -24, 30, 32, 8);
        ctx.fill();
        ctx.fillStyle = '#facc15';
        drawRoundedRect(-12, -20, 22, 6, 2);
        ctx.fill();
        ctx.fillStyle = '#1e293b';
        drawRoundedRect(-13, 6, 26, 62, 8);
        ctx.fill();
        ctx.restore();
      } else {
        ctx.fillStyle = '#111827';
        drawRoundedRect(-14, -7, 30, 32, 8);
        ctx.fill();
        ctx.fillStyle = '#475569';
        drawRoundedRect(-10, -3, 22, 6, 2);
        ctx.fill();
        ctx.fillStyle = '#1e293b';
        drawRoundedRect(-12, 20, 28, 52, 8);
        ctx.fill();
        ctx.fillStyle = '#64748b';
        ctx.fillRect(-10, 34, 24, 5);
      }
      ctx.restore();
    });

    drawInstrumentCluster(kmh, braking);

    // Timed Power-Up cockpit effects for 2D/Normal/High modes
    if (shieldTimer > 0) {
      const pulse = 0.22 + Math.sin(engineVibPhase * 0.28) * 0.08;
      ctx.strokeStyle = `rgba(56, 189, 248, ${pulse * 2.2})`;
      ctx.fillStyle = `rgba(14, 165, 233, ${pulse * 0.45})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, -32, 165, Math.PI * 1.05, Math.PI * 1.95);
      ctx.stroke();
      ctx.fill();
    }
    if (magnetTimer > 0) {
      ctx.strokeStyle = 'rgba(251, 113, 133, 0.65)';
      ctx.lineWidth = 2.5;
      const rad = 42 + ((engineVibPhase * 2.2) % 24);
      ctx.beginPath();
      ctx.arc(0, -34, rad, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (fuelBoostTimer > 0) {
      [-1, 1].forEach((side) => {
        ctx.fillStyle = 'rgba(249, 115, 22, 0.55)';
        ctx.beginPath();
        ctx.ellipse(side * 135, -35, 18, 70, side * 0.2, 0, Math.PI * 2);
        ctx.fill();
      });
    }
    ctx.restore();
  }

  function drawCelebrationParticles() {
    celebrationParticles.forEach((pt) => {
      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, pt.life / 0.8));
      ctx.fillStyle = pt.color;
      ctx.translate(pt.x, pt.y);
      ctx.rotate(pt.life * 6);
      ctx.fillRect(-pt.size * 0.5, -pt.size * 0.5, pt.size, pt.size * 0.7);
      ctx.restore();
    });
  }

  function drawFloatingPopups() {
    floatingPopups.forEach((pop) => {
      const alpha = Math.max(0, pop.life / pop.maxLife);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.font = '900 14px sans-serif';
      ctx.textAlign = 'center';
      ctx.strokeStyle = '#090d16';
      ctx.lineWidth = 4;
      ctx.strokeText(pop.text, pop.x, pop.y);
      ctx.fillStyle = pop.color;
      ctx.fillText(pop.text, pop.x, pop.y);
      ctx.restore();
    });
  }

  function render() {
    if (ultra3DEnabled && window.BendskinUltra3D) {
      ctx.clearRect(0, 0, LOGICAL_WIDTH, logicalHeight);
      const activeSteerDir = Math.max(-1, Math.min(1, (targetLane - currentLane) * 1.4));
      window.BendskinUltra3D.renderFrame({
        quality: userSettings.graphicsQuality,
        cameraZ: getActiveCameraZ(),
        currentLane,
        handlebarAngle,
        worldRollAngle,
        suspensionPitch,
        speedKmh,
        braking: isBrakingActive(),
        throttling: isThrottlingActive(),
        hornHeld,
        steerDir: activeSteerDir,
        distanceMeters,
        rattleTimer,
        celebrationTimer,
        engineVibPhase,
        roadsideProps,
        entities,
        targetBestLineMeters,
        rivalActive: rivalChallenge.active,
        rivalDefeated: rivalChallenge.defeatedThisRun,
        rivalMeters: rivalChallenge.targetMeters,
        powerups: {
          fuelBoost: fuelBoostTimer,
          shield: shieldTimer,
          magnet: magnetTimer,
        },
        crashShakeTimer,
        isRunning: currentState === GAME_STATE.PLAYING || currentState === GAME_STATE.PAUSED,
      });

      const shakeAmp = crashShakeTimer > 0 ? (crashShakeTimer / 0.25) * 8 : 0;
      const shakeX = shakeAmp > 0 ? Math.sin(crashShakeTimer * 180) * shakeAmp : 0;
      const shakeY = shakeAmp > 0 ? Math.cos(crashShakeTimer * 210) * shakeAmp : 0;

      ctx.save();
      ctx.translate(shakeX, shakeY);
      drawWindStreaks();
      drawCelebrationParticles();
      drawFloatingPopups();
      ctx.restore();

      if (crashFlash > 0) {
        ctx.fillStyle = `rgba(220, 38, 38, ${crashFlash * 0.45})`;
        ctx.fillRect(0, 0, LOGICAL_WIDTH, logicalHeight);
      }
      return;
    }

    ctx.fillStyle = '#0b162c';
    ctx.fillRect(0, 0, LOGICAL_WIDTH, logicalHeight);

    const shakeAmp = crashShakeTimer > 0 ? (crashShakeTimer / 0.25) * 8 : 0;
    const shakeX = shakeAmp > 0 ? Math.sin(crashShakeTimer * 180) * shakeAmp : 0;
    const shakeY = shakeAmp > 0 ? Math.cos(crashShakeTimer * 210) * shakeAmp : 0;

    ctx.save();
    ctx.translate(shakeX, shakeY);

    const horizonY = getHorizonY();

    ctx.save();
    ctx.translate(200, horizonY);
    ctx.rotate(worldRollAngle);
    ctx.translate(-200, -horizonY);

    drawSkyAndHorizon(horizonY);
    draw25DRoadAndShoulders();

    const drawItems = [];
    roadsideProps.forEach((prop) => {
      drawItems.push({ z: prop.z, draw: () => drawRoadsideProp(prop) });
    });
    entities.forEach((entity) => {
      drawItems.push({ z: entity.z, draw: () => drawEntity(entity) });
    });

    drawItems.sort((a, b) => a.z - b.z);
    drawItems.forEach((item) => item.draw());

    ctx.restore();

    drawWindStreaks();
    drawCelebrationParticles();
    drawFloatingPopups();
    drawCockpitHandlebars();

    ctx.restore();

    if (crashFlash > 0) {
      ctx.fillStyle = `rgba(220, 38, 38, ${crashFlash * 0.45})`;
      ctx.fillRect(0, 0, LOGICAL_WIDTH, logicalHeight);
    }
  }

  // =========================================================
  // 13. Main 60 FPS Delta-Time Loop
  // =========================================================
  function gameLoop(timestamp) {
    if (!lastTimestamp) {
      lastTimestamp = timestamp;
    }

    const dt = Math.min((timestamp - lastTimestamp) / 1000, 0.1);
    lastTimestamp = timestamp;

    update(dt);
    render();

    window.requestAnimationFrame(gameLoop);
  }

  resizeCanvas();
  initAmbientWorld(0);
  applySettingsUi();
  initAdSense(ADSENSE_BACKGROUND_PUB_ID);
  parseRivalChallengeFromUrl();
  updateHomeAccountUi();
  syncCoinDisplays();
  showScreen(GAME_STATE.START);
  updateHudDisplay();
  leaderboardService.syncFromFirestore();
  window.requestAnimationFrame(gameLoop);
})();
