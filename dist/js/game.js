function init() {
  const canvas = document.getElementById('webgl-canvas');
  scene = new THREE.Scene();

  const isMobileDeviceCheck = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0) || window.matchMedia('(pointer: coarse)').matches;
  camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.5, isMobileDeviceCheck ? 16000 : 32000);
  scene.add(camera);

  renderer = new THREE.WebGLRenderer({ canvas, antialias: !isMobileDeviceCheck });
  renderer.setSize(window.innerWidth, window.innerHeight);
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
renderer.setPixelRatio(isMobile ? Math.min(window.devicePixelRatio, 1.5) : Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  hudCanvas = document.getElementById('hud-canvas');
  hudCtx = hudCanvas.getContext('2d');
  resizeHudCanvas();

  minimapCanvas = document.getElementById('minimap-canvas');
  minimapCtx = minimapCanvas.getContext('2d');

  minimapCanvas.addEventListener('click', (e) => {
    if (!impossibleDifficultyUnlocked) return;
    if (gameState !== 'RACING' && gameState !== 'RUNUP') return;

    const course = COURSES[selectedCourseId];
    if (!course) return;
    const b = (selectedCourseId === 'canyon' && selectedSubtrack === 'D')
      ? { minX: -13500, maxX: 13500, minZ: -15000, maxZ: 3500 }
      : (selectedCourseId === 'moon' && selectedSubtrack === 'D')
      ? { minX: -7000, maxX: 7000, minZ: -26000, maxZ: 1000 }
      : course.bounds;

    const rect = minimapCanvas.getBoundingClientRect();
    const mw = minimapCanvas.width;
    const mh = minimapCanvas.height;
    const mx = (e.clientX - rect.left) * (mw / rect.width);
    const my = (e.clientY - rect.top) * (mh / rect.height);

    const targetX = THREE.MathUtils.mapLinear(mx, 12, mw - 12, b.minX, b.maxX);
    const targetZ = THREE.MathUtils.mapLinear(my, 12, mh - 12, b.minZ, b.maxZ);
    const groundH = getTerrainHeight(targetX, targetZ, selectedCourseId);

    player.pos.x = targetX;
    player.pos.z = targetZ;
    player.pos.y = Math.max(player.pos.y, groundH + 110);
    player.speed = Math.max(player.speed, 65);

    audio.playRecoveryBoost();
    screenShake = Math.max(screenShake, 0.6);
  });

  scene.add(environmentGroup);
  scene.add(cloudsGroup);
  scene.add(lowerCloudsGroup);

hemiLight = new THREE.HemisphereLight(0xffffff, 0x445566, 0.95);
  scene.add(hemiLight);

  sunLight = new THREE.DirectionalLight(0xfff5e4, 1.2);
  sunLight.position.set(700, 1400, 400);
  scene.add(sunLight);

buildParagliderMesh();
  initShopPreview();
  updateShopTvGif();
  setGraphicsQuality(graphicsQuality);

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    resizeHudCanvas();
    const isFlight = (gameState === 'RACING' || gameState === 'RUNUP' || gameState === 'FINISHING' || gameState === 'CREDITS' || gameState === 'GHOST_FLEET_CINEMATIC');
    if (!isFlight) {
      const activeScreen = document.querySelector('.menu-screen[id]:not(.hidden)');
      if (activeScreen) {
        showScreen(activeScreen.id);
      } else if (gameState === 'START' || gameState === 'SELECT' || gameState === 'DISPATCH') {
        showScreen('screen-start');
      }
    }
    updateHalloweenThemeVisibility();
    applyMobileButtonPositions();
    updateJoystickVisibility();
  });

  window.addEventListener('keydown', (e) => {
    const flappyOverlay = document.getElementById('flappy-minigame-overlay');
    if (flappyOverlay && flappyOverlay.style.display !== 'none') {
      if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
        e.preventDefault();
        flappyTriggerFlap();
        return;
      }
      if (e.code === 'Escape') {
        e.preventDefault();
        closeFlappyMinigame();
        return;
      }
    }
    if (activeRebindAction !== null) {
      e.preventDefault();
      e.stopPropagation();
      if (e.code === 'Escape') {
        activeRebindAction = null;
        activeRebindIndex = -1;
        renderKeybindList();
        return;
      }
      if (!keybinds[activeRebindAction]) {
        keybinds[activeRebindAction] = [...defaultKeybinds[activeRebindAction]];
      }
      keybinds[activeRebindAction][activeRebindIndex] = e.code;
      try {
        localStorage.setItem('glider_keybinds', JSON.stringify(keybinds));
      } catch (err) {}
      audio.playRecoveryBoost();
      activeRebindAction = null;
      activeRebindIndex = -1;
      renderKeybindList();
      return;
    }

    audio.init();
    keys[e.code] = true;
    if (e.repeat) return;
    if (gameState === 'GHOST_FLEET_CINEMATIC') {
      if (e.code === 'Escape' || e.code === 'Space') {
        finishGhostFleetCinematic();
        return;
      }
    }
    if (e.altKey && e.shiftKey && (e.code === 'KeyD' || e.key === 'D' || e.key === 'd')) {
      e.preventDefault();
      triggerDevToolsUnlock();
    }
    if (impossibleDifficultyUnlocked) {
      if (e.code === 'KeyH') {
        devTimeFrozen = !devTimeFrozen;
        if (!devTimeFrozen) devFreeCam = false;
        const hudOverlayEl = document.getElementById('hud-overlay');
        if (hudOverlayEl) {
          hudOverlayEl.style.display = devTimeFrozen ? 'none' : ((gameState === 'RACING' || gameState === 'RUNUP') ? 'block' : 'none');
        }
        audio.playBeep(devTimeFrozen ? 380 : 760, 'square', 0.12);
      }
      if (e.code === 'KeyF') {
        if (!devTimeFrozen) {
          audio.playBeep(220, 'sawtooth', 0.08); // Can't freecam unless time is frozen
          return;
        }
        devFreeCam = !devFreeCam;
        if (devFreeCam) {
          devFreeCamPos.copy(camera.position);
          devFreeCamYaw = camSmoothYaw;
          devFreeCamPitch = camSmoothPitch;
        }
        audio.playBeep(devFreeCam ? 680 : 340, 'triangle', 0.15);
      }
    }
    if (gameState === 'CREDITS') {
      if (canSkipCredits && (e.code === 'Escape' || e.code === 'KeyP' || e.key === 'p' || e.key === 'P')) {
        e.preventDefault();
        finishCreditsSequence();
        return;
      }
      return;
    }

    if (greatestGliderSplashActive || aphelionApexCinematicActive) {
      return;
    }
    if (e.code === 'Space') player.airbrake = true;
    if (e.code === 'Escape') togglePauseMenu();
  });

  window.addEventListener('keyup', (e) => {
    keys[e.code] = false;
    if (e.code === 'Space') player.airbrake = false;
  });

  window.addEventListener('mousedown', (e) => {
    if (gameState === 'RACING' || gameState === 'RUNUP') {
      if (e.button === 0) mouseLeftPressed = true;
      if (e.button === 2) mouseRightPressed = true;
    }
  });

  window.addEventListener('mouseup', (e) => {
    if (e.button === 0) mouseLeftPressed = false;
    if (e.button === 2) mouseRightPressed = false;
  });

  window.addEventListener('contextmenu', (e) => {
    if (gameState === 'RACING' || gameState === 'RUNUP' || controlScheme === 'mouse') {
      e.preventDefault();
    }
  });

  window.addEventListener('mousemove', (e) => {
    if (devFreeCam && (e.buttons === 1 || e.buttons === 2 || controlScheme === 'mouse')) {
      devFreeCamYaw -= (e.movementX || 0) * 0.003;
      devFreeCamPitch = THREE.MathUtils.clamp(devFreeCamPitch - (e.movementY || 0) * 0.003, -Math.PI * 0.48, Math.PI * 0.48);
    }
    if (controlScheme === 'mouse') {
      mouseX = THREE.MathUtils.clamp((e.clientX / window.innerWidth) * 2 - 1, -1, 1);
      mouseY = THREE.MathUtils.clamp(-(e.clientY / window.innerHeight) * 2 + 1, -1, 1);
    }
  });

  window.addEventListener('mouseleave', () => {
    if (controlScheme === 'mouse') {
      mouseX = 0;
      mouseY = 0;
    }
  });

  window.addEventListener('gamepadconnected', (e) => {
    activeGamepadIndex = e.gamepad.index;
    gamepadConnected = true;
    audio.init(); 
  });

  window.addEventListener('gamepaddisconnected', (e) => {
if (activeGamepadIndex === e.gamepad?.index) {
      activeGamepadIndex = null;
      gamepadConnected = false;
    }
  });

  setupUI();
  setupMobileControls();
  showScreen('screen-start');
  updatePBTags();
  animate();
}

function getEquippedSkinId() {
  return localStorage.getItem('glider_equipped_skin') || 'default';
}

function getEquippedGhostSkinId() {
  return localStorage.getItem('glider_equipped_ghost_skin') || 'ghost_default';
}

// Procedural CRT TV Static & Scanline Texture
const tvNoiseCanvas = document.createElement('canvas');
tvNoiseCanvas.width = 128;
tvNoiseCanvas.height = 64;
const tvNoiseCtx = tvNoiseCanvas.getContext('2d');
const tvNoiseTexture = new THREE.CanvasTexture(tvNoiseCanvas);
tvNoiseTexture.magFilter = THREE.NearestFilter;
tvNoiseTexture.minFilter = THREE.NearestFilter;
tvNoiseTexture.wrapS = THREE.RepeatWrapping;
tvNoiseTexture.wrapT = THREE.RepeatWrapping;
tvNoiseTexture.repeat.set(3, 1);

let tvGlitchBarY = 0;

let lastTvStaticUpdate = 0;
function updateTvStaticTexture() {
  const isEquipped = getEquippedSkinId() === 'glider_tv_static';
  const isInspected = inspectedType === 'glider' && inspectedGliderId === 'glider_tv_static';
  const shopVisible = document.getElementById('screen-shop') && !document.getElementById('screen-shop').classList.contains('hidden');
  if (!isEquipped && !(shopVisible && isInspected)) return;

  const now = performance.now();
  if (now - lastTvStaticUpdate < 66) return;
  lastTvStaticUpdate = now;

  const w = tvNoiseCanvas.width;
  const h = tvNoiseCanvas.height;
  const imgData = tvNoiseCtx.createImageData(w, h);
  const data = imgData.data;


  for (let i = 0; i < data.length; i += 4) {
    const noise = (Math.random() * 235 + 20) | 0;
    data[i]     = noise;  // Red
    data[i + 1] = noise;  // Green
    data[i + 2] = noise;  // Blue
    data[i + 3] = 255;
  }
  tvNoiseCtx.putImageData(imgData, 0, 0);

  tvNoiseCtx.fillStyle = 'rgba(0, 0, 0, 0.45)';
  for (let y = 0; y < h; y += 3) {
    tvNoiseCtx.fillRect(0, y, w, 1.5);
  }

  tvGlitchBarY = (tvGlitchBarY + 1.8) % (h + 24);
  tvNoiseCtx.fillStyle = 'rgba(255, 255, 255, 0.28)';
  tvNoiseCtx.fillRect(0, tvGlitchBarY - 12, w, 6);

  tvNoiseTexture.needsUpdate = true;
}

const { lunarVoyagerTexture, lunarVoyagerEmissiveTexture } = (() => {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');

  const emCanvas = document.createElement('canvas');
  emCanvas.width = 1024;
  emCanvas.height = 256;
  const emCtx = emCanvas.getContext('2d');

  // Deep space carbon base
  ctx.fillStyle = '#14171d';
  ctx.fillRect(0, 0, 1024, 256);
  emCtx.fillStyle = '#000000';
  emCtx.fillRect(0, 0, 1024, 256);

  let s = 1969; // Apollo 11 landing year seed
  const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };

  const drawKaptonFoil = (x0, x1) => {
    const tileW = 28;
    const tileH = 28;
    for (let y = 0; y < 256; y += tileH) {
      for (let x = x0; x < x1; x += tileW) {
        const w = Math.min(tileW, x1 - x);
        const h = Math.min(tileH, 256 - y);

        const r = Math.floor(210 + rnd() * 42);
        const g = Math.floor(155 + rnd() * 35);
        const b = Math.floor(35 + rnd() * 25);
        ctx.fillStyle = `rgb(${r},${g},${b})`;
        ctx.fillRect(x, y, w, h);

        ctx.strokeStyle = 'rgba(255, 252, 205, 0.55)';
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        ctx.moveTo(x + rnd() * w, y + rnd() * h);
        ctx.lineTo(x + rnd() * w, y + rnd() * h);
        ctx.stroke();

        ctx.strokeStyle = 'rgba(115, 68, 8, 0.45)';
        ctx.beginPath();
        ctx.moveTo(x + rnd() * w, y + rnd() * h);
        ctx.lineTo(x + rnd() * w, y + rnd() * h);
        ctx.stroke();

        ctx.strokeStyle = 'rgba(130, 85, 15, 0.4)';
        ctx.lineWidth = 1;
        ctx.strokeRect(x, y, w, h);

        emCtx.fillStyle = 'rgba(190, 130, 20, 0.22)';
        emCtx.fillRect(x, y, w, h);
      }
    }
  };

  drawKaptonFoil(0, 340);
  drawKaptonFoil(684, 1024);

  for (let y = 0; y < 256; y += 24) {
    for (let x = 340; x < 684; x += 24) {
      const w = Math.min(24, 684 - x);
      const h = Math.min(24, 256 - y);
      const shade = Math.floor(238 + rnd() * 14);
      ctx.fillStyle = `rgb(${shade},${shade},${shade + 4})`;
      ctx.fillRect(x, y, w, h);

      ctx.strokeStyle = 'rgba(195, 205, 220, 0.75)';
      ctx.lineWidth = 1;
      ctx.strokeRect(x, y, w, h);

      ctx.strokeStyle = 'rgba(175, 185, 200, 0.55)';
      ctx.beginPath();
      ctx.moveTo(x + w / 2 - 2, y + h / 2);
      ctx.lineTo(x + w / 2 + 2, y + h / 2);
      ctx.moveTo(x + w / 2, y + h / 2 - 2);
      ctx.lineTo(x + w / 2, y + h / 2 + 2);
      ctx.stroke();
    }
  }

  [334, 678].forEach(rx => {
    ctx.fillStyle = '#1c1f26';
    ctx.fillRect(rx, 0, 14, 256);
    ctx.strokeStyle = '#383e4a';
    ctx.strokeRect(rx, 0, 14, 256);
    for (let ry = 10; ry < 256; ry += 20) {
      ctx.fillStyle = '#dbe1ec';
      ctx.beginPath();
      ctx.arc(rx + 7, ry, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
  });

  ctx.fillStyle = '#d8232a'; 
    ctx.fillRect(478, 0, 10, 256);
  ctx.fillRect(536, 0, 10, 256);

  ctx.fillStyle = '#0b2240';
  ctx.fillRect(488, 0, 48, 256);

  ctx.fillStyle = '#f1c40f'; 
  ctx.fillRect(476, 0, 2, 256);
  ctx.fillRect(546, 0, 2, 256);

  ctx.save();
  ctx.translate(512, 128);
  ctx.rotate(-Math.PI / 2);
  ctx.fillStyle = '#ffffff';
  ctx.font = '900 22px monospace';
  ctx.textAlign = 'center';
  ctx.letterSpacing = '5px';
  ctx.fillText('APOLLO XI', 0, 8);
  ctx.restore();

  ctx.fillStyle = '#0b2240';
  ctx.font = 'bold 15px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('UNITED', 410, 118);
  ctx.fillText('STATES', 410, 140);
  ctx.fillText('NASA', 614, 130);

  ctx.fillStyle = '#121418';
  ctx.fillRect(0, 0, 1024, 28);
  ctx.fillRect(0, 228, 1024, 28);
  ctx.strokeStyle = 'rgba(65, 70, 80, 0.45)';
  for (let tx = 0; tx < 1024; tx += 32) {
    ctx.strokeRect(tx, 0, 32, 28);
    ctx.strokeRect(tx, 228, 32, 28);
  }

  [0, 1008].forEach((wx, i) => {
    ctx.fillStyle = '#161920';
    ctx.fillRect(wx, 0, 16, 256);

    ctx.fillStyle = '#00f0ff';
    ctx.fillRect(wx + (i === 0 ? 10 : 2), 34, 4, 188);

    emCtx.fillStyle = '#00f0ff';
    emCtx.fillRect(wx + (i === 0 ? 9 : 1), 32, 6, 192);
  });

  const diffTex = new THREE.CanvasTexture(canvas);
  diffTex.wrapS = THREE.ClampToEdgeWrapping;
  diffTex.wrapT = THREE.ClampToEdgeWrapping;

  const emTex = new THREE.CanvasTexture(emCanvas);
  emTex.wrapS = THREE.ClampToEdgeWrapping;
  emTex.wrapT = THREE.ClampToEdgeWrapping;

  return { lunarVoyagerTexture: diffTex, lunarVoyagerEmissiveTexture: emTex };
})();

function createSkinMaterial(skinId) {
  const skin = GLIDER_SKINS.find(s => s.id === skinId) || GLIDER_SKINS[0];

  // Animated TV static skin
  if (skinId === 'glider_tv_static') {
    return new THREE.MeshStandardMaterial({
      map: tvNoiseTexture,
      emissiveMap: tvNoiseTexture,
      emissive: 0xffffff,
      emissiveIntensity: 0.45,
      roughness: 0.25,
      metalness: 0.2,
      side: THREE.DoubleSide
    });
  }

//Apollo Voyager 
  if (skinId === 'lunar_voyager') {
    return new THREE.MeshStandardMaterial({
      map: lunarVoyagerTexture,
      emissiveMap: lunarVoyagerEmissiveTexture,
      emissive: 0xffffff,
      emissiveIntensity: 0.65,
      roughness: 0.28,
      metalness: 0.72,
      side: THREE.DoubleSide
    });
  }

  // Aphelion Apex 
  if (skinId === 'aphelion_apex') {
    return new THREE.MeshStandardMaterial({
      map: aphelionApexTexture,
      emissiveMap: aphelionApexEmissiveTexture,
      emissive: 0xa020f0,
      emissiveIntensity: 0.55,
      roughness: 0.18,
      metalness: 0.85,
      side: THREE.DoubleSide
    });
  }

  if (skinId === 'glider_santa') {
    return new THREE.MeshStandardMaterial({
      map: santaGliderTexture,
      emissiveMap: santaGliderEmissiveTexture,
      emissive: 0xdfb12c,
      emissiveIntensity: 0.45,
      roughness: 0.28,
      metalness: 0.45,
      side: THREE.DoubleSide
    });
  }

  if (skinId === 'glider_halloween') {
    return new THREE.MeshStandardMaterial({
      map: halloweenGliderTexture,
      emissiveMap: halloweenGliderEmissiveTexture,
      emissive: 0xff5500,
      emissiveIntensity: 0.75,
      roughness: 0.35,
      metalness: 0.15,
      side: THREE.DoubleSide
    });
  }

  return new THREE.MeshStandardMaterial({
    color: skin.color,
    roughness: skin.roughness,
    metalness: skin.metalness,
    emissive: skin.emissive || 0x000000,
    emissiveIntensity: skin.emissiveIntensity || 0,
    side: THREE.DoubleSide
  });
}

function createGhostSkinMaterial(skinId) {
  const skin = GHOST_SKINS.find(s => s.id === skinId) || GHOST_SKINS[0];
  return new THREE.MeshStandardMaterial({
    color: skin.color,
    roughness: skin.roughness,
    metalness: skin.metalness,
    emissive: skin.emissive || 0x000000,
    emissiveIntensity: skin.emissiveIntensity || 0,
    side: THREE.DoubleSide
  });
}

function buildGoldDrone(group, mat) {
  const goldMat = mat || createGhostSkinMaterial('ghost_gold');
  const grayMat = new THREE.MeshStandardMaterial({
    color: 0x383a3d,
    roughness: 0.45,
    metalness: 0.55,
    side: THREE.DoubleSide
  });

  

  const noseGeom = new THREE.ConeGeometry(2.5, 7.5, 6);
  noseGeom.rotateX(-Math.PI / 2);
  noseGeom.scale(1.2, 0.75, 1.0);
  const nose = new THREE.Mesh(noseGeom, goldMat);
  nose.position.set(0, 0, -8.0);
  group.add(nose);

  const midFuseGeom = new THREE.CylinderGeometry(3.6, 2.4, 10.0, 6);
  midFuseGeom.rotateX(-Math.PI / 2);
  midFuseGeom.scale(1.35, 0.75, 1.0);
  const midFuse = new THREE.Mesh(midFuseGeom, goldMat);
  midFuse.position.set(0, 0.1, 0.2);
  group.add(midFuse);

  const canopyGeom = new THREE.ConeGeometry(1.5, 9.0, 4);
  canopyGeom.rotateX(-Math.PI / 2);
  canopyGeom.scale(0.85, 0.7, 1.0);
  const canopy = new THREE.Mesh(canopyGeom, goldMat);
  canopy.position.set(0, 1.15, -1.2);
  group.add(canopy);

  const aftGeom = new THREE.BoxGeometry(6.4, 1.8, 6.0);
  const aft = new THREE.Mesh(aftGeom, goldMat);
  aft.position.set(0, -0.05, 7.5);
  group.add(aft);

  const exhaustGeom = new THREE.CylinderGeometry(1.2, 1.6, 2.2, 8);
  exhaustGeom.rotateX(-Math.PI / 2);
  const exhaustMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.8, metalness: 0.8 });
  const exhaust = new THREE.Mesh(exhaustGeom, exhaustMat);
  exhaust.position.set(0, -0.1, 10.6);
  group.add(exhaust);

  const buildWingHalf = (isLeft) => {
    const sign = isLeft ? -1 : 1;
    const wingShape = new THREE.Shape();
    wingShape.moveTo(3.0 * sign, -2.5);
    wingShape.lineTo(20.5 * sign, 1.5);
    wingShape.lineTo(21.2 * sign, 3.8);
    wingShape.lineTo(17.8 * sign, 4.4);
    wingShape.lineTo(3.0 * sign, 2.8);
    wingShape.closePath();

    const wingGeom = new THREE.ExtrudeGeometry(wingShape, {
      depth: 0.7,
      bevelEnabled: true,
      bevelThickness: 0.25,
      bevelSize: 0.25,
      bevelSegments: 2
    });
    wingGeom.rotateX(Math.PI / 2);
    wingGeom.translate(0, 0.35, 0);
    const wingMesh = new THREE.Mesh(wingGeom, goldMat);
    group.add(wingMesh);

    const flapShape = new THREE.Shape();
    flapShape.moveTo(4.5 * sign, 0.0);
    flapShape.lineTo(17.2 * sign, 2.2);
    flapShape.lineTo(16.5 * sign, 4.1);
    flapShape.lineTo(4.5 * sign, 2.6);
    flapShape.closePath();

    const flapGeom = new THREE.ExtrudeGeometry(flapShape, {
      depth: 0.78,
      bevelEnabled: false
    });
    flapGeom.rotateX(Math.PI / 2);
    flapGeom.translate(0, 0.39, 0);
    const flapMesh = new THREE.Mesh(flapGeom, grayMat);
    group.add(flapMesh);

    const tipShape = new THREE.Shape();
    tipShape.moveTo(20.4 * sign, 1.4);
    tipShape.lineTo(21.6 * sign, 2.6);
    tipShape.lineTo(21.2 * sign, 4.2);
    tipShape.lineTo(19.8 * sign, 3.2);
    tipShape.closePath();

    const tipGeom = new THREE.ExtrudeGeometry(tipShape, {
      depth: 0.85,
      bevelEnabled: true,
      bevelThickness: 0.15,
      bevelSize: 0.15
    });
    tipGeom.rotateX(Math.PI / 2);
    tipGeom.translate(0, 0.42, 0);
    const tipMesh = new THREE.Mesh(tipGeom, goldMat);
    group.add(tipMesh);
  };

  buildWingHalf(false);
  buildWingHalf(true);

  const buildTailHalf = (isLeft) => {
    const sign = isLeft ? -1 : 1;
    const tailShape = new THREE.Shape();
    tailShape.moveTo(2.0 * sign, 5.8);
    tailShape.lineTo(11.0 * sign, 8.8);
    tailShape.lineTo(9.8 * sign, 11.2);
    tailShape.lineTo(2.0 * sign, 10.0);
    tailShape.closePath();

    const tailGeom = new THREE.ExtrudeGeometry(tailShape, {
      depth: 0.55,
      bevelEnabled: true,
      bevelThickness: 0.15,
      bevelSize: 0.15,
      bevelSegments: 2
    });
    tailGeom.rotateX(Math.PI / 2);
    tailGeom.translate(0, 0.28, 0);
    const tailMesh = new THREE.Mesh(tailGeom, goldMat);
    group.add(tailMesh);

    const tailFlapShape = new THREE.Shape();
    tailFlapShape.moveTo(2.8 * sign, 7.6);
    tailFlapShape.lineTo(9.2 * sign, 9.6);
    tailFlapShape.lineTo(8.5 * sign, 10.9);
    tailFlapShape.lineTo(2.8 * sign, 9.8);
    tailFlapShape.closePath();

    const tailFlapGeom = new THREE.ExtrudeGeometry(tailFlapShape, {
      depth: 0.62,
      bevelEnabled: false
    });
    tailFlapGeom.rotateX(Math.PI / 2);
    tailFlapGeom.translate(0, 0.32, 0);
    const tailFlapMesh = new THREE.Mesh(tailFlapGeom, grayMat);
    group.add(tailFlapMesh);
  };

  buildTailHalf(false);
  buildTailHalf(true);
}

function buildKrampusDrone(group, mat) {
  const krampusMat = mat || createGhostSkinMaterial('ghost_krampus');
  const redAccentMat = new THREE.MeshStandardMaterial({
    color: 0xff1111,
    emissive: 0xff0000,
    emissiveIntensity: 0.85,
    roughness: 0.2,
    metalness: 0.5
  });

  const body = new THREE.Mesh(new THREE.ConeGeometry(5, 26, 4), krampusMat);
  body.rotateX(-Math.PI / 2);
  const wings = new THREE.Mesh(new THREE.BoxGeometry(44, 0.5, 7), krampusMat);
  wings.position.set(0, 0, 3);
  group.add(body, wings);

  const stripe = new THREE.Mesh(new THREE.BoxGeometry(42, 0.7, 0.8), redAccentMat);
  stripe.position.set(0, 0, 0.5);
  group.add(stripe);

  [-1, 1].forEach(side => {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.9, 8, 8), redAccentMat);
    eye.position.set(side * 1.5, 1.2, -8.5);
    group.add(eye);

    const hornGeom = new THREE.ConeGeometry(1.2, 7.5, 6);
    hornGeom.rotateX(0.45);
    hornGeom.rotateZ(-side * 0.5);
    const horn = new THREE.Mesh(hornGeom, krampusMat);
    horn.position.set(side * 2.5, 3.2, -6.5);
    group.add(horn);
  });
}

function getTrackStats() {
  const courses = ['canyon', 'islands', 'coastal', 'volcano', 'glacial', 'moon'];
  const subs = ['A', 'B', 'C', 'D'];
  let totalBronzeOrBetter = 0;
  let totalSilverOrBetter = 0;
  let totalGoldOrBetter = 0;
  let totalAceOrBetter = 0;
  let hasSilver = false;
  let hasGold = false;
  let hasGhost = false;
  const hasDevTools = localStorage.getItem('glider_achieve_devtools') === 'true';
  const hasTvEasterEgg = localStorage.getItem('glider_achieve_tv') === 'true';

  courses.forEach(c => {
    subs.forEach(s => {
      if (!COURSES[c] || !COURSES[c].subtracks[s]) return; 
      const medals = COURSES[c].subtracks[s].medals;
      const pbStr = localStorage.getItem(`pb_${c}_${s}`);
      if (pbStr) {
        const pb = parseFloat(pbStr);
        if (pb <= medals.ace) {
          totalAceOrBetter++;
          totalGoldOrBetter++;
          totalSilverOrBetter++;
          totalBronzeOrBetter++;
          hasSilver = true;
          hasGold = true;
        } else if (pb <= medals.gold) {
          totalGoldOrBetter++;
          totalSilverOrBetter++;
          totalBronzeOrBetter++;
          hasSilver = true;
          hasGold = true;
        } else if (pb <= medals.silver) {
          totalSilverOrBetter++;
          totalBronzeOrBetter++;
          hasSilver = true;
        } else if (pb <= medals.bronze) {
          totalBronzeOrBetter++;
        }
      }
      if (localStorage.getItem(`ghost_${c}_${s}`) || ghostCache[`ghost_${c}_${s}`]) {
        hasGhost = true;
      }
    });
  });

  return {
    totalBronzeOrBetter,
    totalSilverOrBetter,
    totalGoldOrBetter,
    totalAceOrBetter,
    hasSilver,
    hasGold,
    hasGhost,
    hasDevTools,
    hasTvEasterEgg
  };
}

function showAchievementNotifications(unlockedItems) {
  const container = document.getElementById('notif-container');
  if (!container) return;

  unlockedItems.forEach((item, idx) => {
    setTimeout(() => {
      const card = document.createElement('div');
      card.className = 'notif-card';
      card.innerHTML = `
        <div class="notif-title">Achievement Unlocked: ${item.name}</div>
        <div class="notif-sub">Open shop to equip it!</div>
      `;
      container.appendChild(card);
      audio.playRecoveryBoost();

      setTimeout(() => {
        card.style.transition = 'all 0.5s ease';
        card.style.opacity = '0';
        card.style.transform = 'translateX(50px)';
        setTimeout(() => card.remove(), 550);
      }, 6500);
    }, idx * 300);
  });
}

function initShopPreview() {
  const canvas = document.getElementById('shop-canvas');
  if (!canvas) return;

  shopScene = new THREE.Scene();
  shopCamera = new THREE.PerspectiveCamera(45, canvas.width / canvas.height, 0.1, 100);
  shopCamera.position.set(0, 4.5, 24);
  shopCamera.lookAt(0, 1.2, 0);

  shopRenderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  shopRenderer.setSize(canvas.width, canvas.height);
  shopRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  const amb = new THREE.AmbientLight(0xffffff, 0.85);
  shopScene.add(amb);

  const dir1 = new THREE.DirectionalLight(0xffffff, 1.2);
  dir1.position.set(10, 20, 15);
  shopScene.add(dir1);

  const dir2 = new THREE.DirectionalLight(0x00f0ff, 0.4);
  dir2.position.set(-10, -5, -10);
  shopScene.add(dir2);

  shopGliderGroup = new THREE.Group();
  const wingWidth = 24;
  const geom = new THREE.PlaneGeometry(wingWidth, 4.2, 20, 6);
  const pos = geom.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const arch = Math.cos((x / (wingWidth / 2)) * (Math.PI / 2.3)) * 2.2;
    const sweep = -Math.pow(Math.abs(x) / (wingWidth / 2), 2) * 1.2;
    pos.setY(i, y + arch);
    pos.setZ(i, pos.getZ(i) + sweep);
  }
  geom.computeVertexNormals();

  const mat = createSkinMaterial(HALLOWEEN_EVENT_ACTIVE ? 'glider_halloween' : getEquippedSkinId());
  shopGliderCanopy = new THREE.Mesh(geom, mat);
  shopGliderCanopy.rotation.x = Math.PI / 10;
  shopGliderGroup.add(shopGliderCanopy);

  const shopGliderQuadGeom = new THREE.PlaneGeometry(32, 17.07);
  const shopGliderQuadMat = new THREE.MeshBasicMaterial({
    map: spriteTextures.back,
    transparent: true,
    alphaTest: 0.1,
    depthWrite: false,
    side: THREE.DoubleSide
  });
  const shopGliderSpriteQuad = new THREE.Mesh(shopGliderQuadGeom, shopGliderQuadMat);
  shopGliderSpriteQuad.name = 'shopGliderSpriteQuad';
  shopGliderSpriteQuad.visible = false;
  shopGliderGroup.add(shopGliderSpriteQuad);

  shopScene.add(shopGliderGroup);

  shopDroneGroup = new THREE.Group();
  shopDroneGroup.position.set(0, 1.2, 0);
  shopDroneGroup.rotation.x = Math.PI / 10;
  shopDroneGroup.visible = false;
  shopScene.add(shopDroneGroup);
}
const SHOP_TV_GIFS = [
  "suspiciousfella.gif",
  "love.gif",
  "maneatingburg.gif",
  "skulltv.png"

// add more gifs HERE TV GIFS
];

let tvTransitionTimeout = null;

let suspiciousFellaDuration = 2500; 


if (typeof window !== 'undefined' && 'ImageDecoder' in window) {
  try {
    fetch('suspiciousfella.gif')
      .then(res => res.ok ? res.arrayBuffer() : null)
      .then(async buffer => {
        if (!buffer) return;
        const decoder = new ImageDecoder({ data: buffer, type: 'image/gif' });
        await decoder.tracks.ready;
        const count = decoder.tracks.selectedTrack ? decoder.tracks.selectedTrack.frameCount : 0;
        if (count > 0) {
          let totalTimeMs = 0;
          for (let i = 0; i < count; i++) {
            const { image } = await decoder.decode({ frameIndex: i });
            totalTimeMs += (image.duration || 100000) / 1000; // microseconds to ms
            image.close();
          }
          if (totalTimeMs > 0) {
            suspiciousFellaDuration = totalTimeMs;
          }
        }
      })
      .catch(() => {});
  } catch (e) {}
}

function clearShopTvTimer() {
  if (tvTransitionTimeout) {
    clearTimeout(tvTransitionTimeout);
    tvTransitionTimeout = null;
  }
}

function setShopTvImage(gifName) {
  clearShopTvTimer();

  const container = document.getElementById('shop-tv-container');
  if (!container) return;

  container.innerHTML = `<img src="${gifName}" alt="Shop TV" class="shop-tv-gif">`;

  const img = container.querySelector('.shop-tv-gif');
  if (img) {
    img.onclick = onShopTvClick;
  }

  
  if (gifName === 'suspiciousfella.gif') {
    tvTransitionTimeout = setTimeout(() => {

      setShopTvImage('suspiciousfellaloop.gif');
    }, suspiciousFellaDuration);
  }
}

let tvClickCount = 0;

const speedometerPointer2Img = new Image();
speedometerPointer2Img.src = 'speedemeterpointer2.png';

function onShopTvClick() {
  audio.init();

  tvClickCount++;

  if (tvClickCount % 2 === 1) {
    setShopTvImage('what_a_concept.gif');
  } else {
    const randomGif = SHOP_TV_GIFS[Math.floor(Math.random() * SHOP_TV_GIFS.length)];
    setShopTvImage(randomGif);
  }

  const hadAchievement = localStorage.getItem('glider_achieve_tv') === 'true';
  if (tvClickCount >= 5 && !hadAchievement) {
    localStorage.setItem('glider_achieve_tv', 'true');
    localStorage.setItem('glider_unlocked_pointer2', 'true');
    showAchievementNotifications([
      { name: "Lets Not Turn It Off (Channel 3)" },
      { name: "Speedometer Pointer 2 Unlocked!" }
    ]);
    audio.playRecoveryBoost();

    const ptrBox = document.getElementById('settings-pointer-box');
    if (ptrBox) ptrBox.style.display = 'flex';

    const shopScreen = document.getElementById('screen-shop');
    if (shopScreen && !shopScreen.classList.contains('hidden')) {
      renderShop();
    }
  }
}

function updateShopTvGif() {
  if (!SHOP_TV_GIFS || SHOP_TV_GIFS.length === 0) return;
  const randomGif = SHOP_TV_GIFS[Math.floor(Math.random() * SHOP_TV_GIFS.length)];
  setShopTvImage(randomGif);
}

function openShopMenu() {
  updateShopTvGif();
  inspectedType = 'glider';
  inspectedGliderId = getEquippedSkinId();
  inspectedGhostId = getEquippedGhostSkinId();
  renderShop();
  showScreen('screen-shop');
}

function renderShop() {
  const listEl = document.getElementById('shop-glider-list');
  if (!listEl) return;
  listEl.innerHTML = '';

  const stats = getTrackStats();
  const equippedGliderId = getEquippedSkinId();
  const equippedGhostId = getEquippedGhostSkinId();

  const gliderHeading = document.createElement('div');
  gliderHeading.style.cssText = 'font-size: 10px; letter-spacing: 2px; color: var(--cyan); margin: 4px 0 2px 2px; text-transform: uppercase; font-weight: 700;';
  gliderHeading.innerText = 'PARAGLIDER CANOPIES';
  listEl.appendChild(gliderHeading);

  GLIDER_SKINS.forEach(skin => {
    const isUnlocked = skin.checkUnlocked(stats);
    const isEquipped = skin.id === equippedGliderId;
    const isInspected = inspectedType === 'glider' && skin.id === inspectedGliderId;

    const item = document.createElement('div');
    item.className = `shop-item-card ${isInspected ? 'selected' : ''}`;
    let statusText = isEquipped ? '<b style="color: var(--cyan);">[EQUIPPED]</b>' : (isUnlocked ? '<span style="color: #4cd137;">UNLOCKED</span>' : '<span style="color: var(--mono-60);">LOCKED</span>');

    item.innerHTML = `
      <div style="display: flex; flex-direction: column; align-items: center;">
        <svg width="46" height="15" viewBox="0 0 46 15" style="display:block; margin-bottom: 2px;">
          <path d="M 2,13 Q 23,1 44,13 Q 23,7 2,13 Z" fill="${skin.previewColor}" stroke="${skin.isGlowing ? '#ffffff' : 'rgba(255,255,255,0.25)'}" stroke-width="1"/>
        </svg>
      </div>
      <div class="shop-item-info">
        <div class="shop-item-name">${skin.name}</div>
        <div class="shop-item-status">${statusText} • <span style="color: var(--gold);">${skin.colorName}</span></div>
      </div>
    `;

    item.addEventListener('click', () => {
      inspectedType = 'glider';
      inspectedGliderId = skin.id;
      renderShop();
    });

    listEl.appendChild(item);
  });

  const ghostHeading = document.createElement('div');
  ghostHeading.style.cssText = 'font-size: 10px; letter-spacing: 2px; color: var(--cyan); margin: 14px 0 2px 2px; text-transform: uppercase; font-weight: 700;';
  ghostHeading.innerText = 'TIME TRIAL GHOST DRONES';
  listEl.appendChild(ghostHeading);

  GHOST_SKINS.forEach(skin => {
    const isUnlocked = skin.checkUnlocked(stats);
    const isEquipped = skin.id === equippedGhostId;
    const isInspected = inspectedType === 'ghost' && skin.id === inspectedGhostId;

    const item = document.createElement('div');
    item.className = `shop-item-card ${isInspected ? 'selected' : ''}`;
    let statusText = isEquipped ? '<b style="color: var(--cyan);">[EQUIPPED]</b>' : (isUnlocked ? '<span style="color: #4cd137;">UNLOCKED</span>' : '<span style="color: var(--mono-60);">LOCKED</span>');

    item.innerHTML = `
      <div style="display: flex; flex-direction: column; align-items: center;">
        <svg width="46" height="18" viewBox="0 0 46 18" style="display:block; margin-bottom: 2px;">
          <polygon points="23,1 30,17 23,12 16,17" fill="${skin.previewColor}" stroke="${skin.isGlowing ? '#ffffff' : 'rgba(255,255,255,0.3)'}" stroke-width="1"/>
          <line x1="4" y1="11" x2="42" y2="11" stroke="${skin.previewColor}" stroke-width="2.5" stroke-linecap="round"/>
        </svg>
      </div>
      <div class="shop-item-info">
        <div class="shop-item-name">${skin.name}</div>
        <div class="shop-item-status">${statusText} • <span style="color: var(--gold);">${skin.colorName}</span></div>
      </div>
    `;

    item.addEventListener('click', () => {
      inspectedType = 'ghost';
      inspectedGhostId = skin.id;
      renderShop();
    });

    listEl.appendChild(item);
  });

  const inspectedSkin = inspectedType === 'glider'
    ? (GLIDER_SKINS.find(s => s.id === inspectedGliderId) || GLIDER_SKINS[0])
    : (GHOST_SKINS.find(s => s.id === inspectedGhostId) || GHOST_SKINS[0]);

  const isUnlocked = inspectedSkin.checkUnlocked(stats);
  const isEquipped = inspectedType === 'glider'
    ? (inspectedSkin.id === equippedGliderId)
    : (inspectedSkin.id === equippedGhostId);

  document.getElementById('shop-inspect-name').innerText = inspectedSkin.name;
  document.getElementById('shop-inspect-color').innerText = `COLOR: ${inspectedSkin.colorName}`;
  document.getElementById('shop-inspect-req').innerText = `REQUIREMENT: ${inspectedSkin.reqText}`;

  if (inspectedType === 'glider') {
    if (shopGliderGroup) shopGliderGroup.visible = true;
    if (shopDroneGroup) shopDroneGroup.visible = false;
    const gQuad = shopGliderGroup ? shopGliderGroup.getObjectByName('shopGliderSpriteQuad') : null;

    if (inspectedSkin.id === 'glider_16bit') {
      if (shopGliderCanopy) shopGliderCanopy.visible = false;
      if (gQuad) {
        gQuad.visible = true;
        gQuad.material.map = spriteTextures.back;
      }
      shopGliderGroup.is2DGlider = true;
    } else {
      if (shopGliderCanopy) {
        shopGliderCanopy.visible = true;
        shopGliderCanopy.material = createSkinMaterial(inspectedSkin.id);
      }
      if (gQuad) gQuad.visible = false;
      shopGliderGroup.is2DGlider = false;
    }
  } else {
    if (shopGliderGroup) shopGliderGroup.visible = false;
    if (shopDroneGroup) shopDroneGroup.visible = true;

    while (shopDroneGroup.children.length) {
      const child = shopDroneGroup.children[0];
      if (child.traverse) {
        child.traverse(obj => {
          if (obj.geometry) obj.geometry.dispose();
          if (obj.material) {
            if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
            else obj.material.dispose();
          }
        });
      }
      shopDroneGroup.remove(child);
    }

    const previewMat = createGhostSkinMaterial(inspectedGhostId);

    if (inspectedGhostId === 'ghost_16bit') {
      const quadGeom = new THREE.PlaneGeometry(32, 17.07);
      const quadMat = new THREE.MeshBasicMaterial({
        map: spriteTextures.back,
        transparent: true,
        alphaTest: 0.1,
        depthWrite: false,
        side: THREE.DoubleSide
      });
      const quadMesh = new THREE.Mesh(quadGeom, quadMat);
      quadMesh.name = 'shopSpriteQuad';
      shopDroneGroup.add(quadMesh);
      shopDroneGroup.is2DDrone = true;
    } else if (inspectedGhostId === 'ghost_gold') {
      buildGoldDrone(shopDroneGroup, previewMat);
      shopDroneGroup.is2DDrone = false;
    } else if (inspectedGhostId === 'ghost_krampus') {
      buildKrampusDrone(shopDroneGroup, previewMat);
      shopDroneGroup.is2DDrone = false;
    } else {
      const bodyGeom = new THREE.ConeGeometry(5, 24, 4);
      bodyGeom.rotateX(-Math.PI / 2);
      const body = new THREE.Mesh(bodyGeom, previewMat);
      shopDroneGroup.add(body);

      const wingGeom = new THREE.BoxGeometry(42, 0.4, 6);
      const wing = new THREE.Mesh(wingGeom, previewMat);
      wing.position.set(0, 0, 3);
      shopDroneGroup.add(wing);
      shopDroneGroup.is2DDrone = false;
    }
  }

  const actionBox = document.getElementById('shop-action-box');
  actionBox.innerHTML = '';

  if (isEquipped) {
    const btn = document.createElement('button');
    btn.className = 'mono-btn';
    btn.style.borderColor = 'var(--cyan)';
    btn.style.color = 'var(--cyan)';
    btn.style.opacity = '0.85';
    btn.innerText = 'EQUIPPED';
    actionBox.appendChild(btn);
  } else if (isUnlocked) {
    const btn = document.createElement('button');
    btn.className = 'mono-btn';
    btn.style.borderColor = 'var(--cyan)';
    btn.style.color = 'var(--cyan)';
    btn.innerText = inspectedType === 'glider' ? 'EQUIP GLIDER' : 'EQUIP DRONE';
    btn.addEventListener('click', () => {
      if (inspectedType === 'glider') {
        localStorage.setItem('glider_equipped_skin', inspectedSkin.id);
        buildParagliderMesh();
        buildCourse(selectedCourseId);
      } else {
        localStorage.setItem('glider_equipped_ghost_skin', inspectedSkin.id);
        if (ghostDroneGroup) createGhostDroneMesh();
      }
      audio.playRecoveryBoost();
      renderShop();
    });
    actionBox.appendChild(btn);
  } else {
    const btn = document.createElement('div');
    btn.style.fontSize = '10px';
    btn.style.letterSpacing = '1px';
    btn.style.color = '#ff6666';
    btn.style.textTransform = 'uppercase';
    btn.innerText = 'LOCKED! COMPLETE REQUIREMENT TO UNLOCK';
    actionBox.appendChild(btn);
  }
}

let finishSavedTime = 0;
let finishSavedRank = 1;
let finishSequenceTimer = 0;

function updateCameraView(shakeX = 0, shakeY = 0, snap = false) {
if (!paragliderWingGroup) return;

const podObj = paragliderWingGroup.getObjectByName('podHarnessGroup');
const is16Bit = (getEquippedSkinId() === 'glider_16bit');

if (podObj) podObj.visible = devFreeCam ? true : false;

paragliderWingGroup.position.set(player.pos.x + shakeX, player.pos.y + shakeY, player.pos.z);
paragliderWingGroup.rotation.set(0, 0, 0);
paragliderWingGroup.rotation.order = 'YXZ';
paragliderWingGroup.rotation.y = player.yaw + (player.rudderDeflection * 0.85);
paragliderWingGroup.rotation.x = player.pitch * 0.92;
paragliderWingGroup.rotation.z = player.roll * 0.35;

if (devFreeCam) {
  if (is16Bit) {
    update2DDroneMesh(paragliderWingGroup, camera);
  }
  return;
}

const targetCamYaw = player.yaw + (player.rudderDeflection * 0.85) - (player.roll * 0.12);
const targetCamPitch = player.pitch * 0.92;
const targetCamRoll = player.roll * 0.30;

if (snap || gameState !== 'RACING') {
  camSmoothYaw = targetCamYaw;
  camSmoothPitch = targetCamPitch;
  camSmoothRoll = targetCamRoll;
} else {
  let dYaw = targetCamYaw - camSmoothYaw;
  while (dYaw > Math.PI) dYaw -= Math.PI * 2;
  while (dYaw < -Math.PI) dYaw += Math.PI * 2;
  camSmoothYaw += dYaw * 0.22;
  camSmoothPitch = THREE.MathUtils.lerp(camSmoothPitch, targetCamPitch, 0.22);
  camSmoothRoll = THREE.MathUtils.lerp(camSmoothRoll, targetCamRoll, 0.22);
}

camera.position.set(player.pos.x + shakeX, player.pos.y + shakeY, player.pos.z);
camera.rotation.set(0, 0, 0);
camera.rotation.order = 'YXZ';
camera.rotation.y = camSmoothYaw;
camera.rotation.x = camSmoothPitch;
camera.rotation.z = camSmoothRoll;

if (is16Bit) {
  update2DDroneMesh(paragliderWingGroup, camera);
}
}

function updateFreeCam(dt) {
const moveSpeed = (keys['ShiftLeft'] || keys['ShiftRight'] ? 520 : 220) * dt;
const cosP = Math.cos(devFreeCamPitch);
const sinP = Math.sin(devFreeCamPitch);
const cosY = Math.cos(devFreeCamYaw);
const sinY = Math.sin(devFreeCamYaw);

const fwdX = -sinY * cosP;
const fwdY = sinP;
const fwdZ = -cosY * cosP;
const rightX = cosY;
const rightZ = -sinY;

let moveFwd = 0;
let moveRight = 0;
let moveUp = 0;

if (keys['KeyW'] || keys['ArrowUp'] || keys['KeyI']) moveFwd += 1;
if (keys['KeyS'] || keys['ArrowDown'] || keys['KeyK']) moveFwd -= 1;
if (keys['KeyA'] || keys['ArrowLeft'] || keys['KeyJ']) moveRight -= 1;
if (keys['KeyD'] || keys['ArrowRight'] || keys['KeyL']) moveRight += 1;
if (keys['Space'] || keys['KeyE'] || keys['KeyR']) moveUp += 1;
if (keys['ControlLeft'] || keys['KeyQ'] || keys['KeyC']) moveUp -= 1;

devFreeCamPos.x += (fwdX * moveFwd + rightX * moveRight) * moveSpeed;
devFreeCamPos.y += (fwdY * moveFwd + moveUp) * moveSpeed;
devFreeCamPos.z += (fwdZ * moveFwd + rightZ * moveRight) * moveSpeed;

camera.position.copy(devFreeCamPos);
camera.rotation.set(0, 0, 0);
camera.rotation.order = 'YXZ';
camera.rotation.y = devFreeCamYaw;
camera.rotation.x = devFreeCamPitch;
camera.rotation.z = 0;
}

function warpToNextTrack() {
audio.init();
devFadeInTimer = 0.75;
if (grandPrixState.active) {
  grandPrixState.currentRaceIndex++;
  if (grandPrixState.currentRaceIndex >= grandPrixState.races.length) {
    showGrandPrixSummary();
  } else {
    const nextRace = grandPrixState.races[grandPrixState.currentRaceIndex];
    selectedCourseId = nextRace.courseId;
    selectedSubtrack = nextRace.subtrack;
    startCountdown();
  }
  return;
}

const courseOrder = ['canyon', 'islands', 'coastal', 'volcano', 'glacial', 'moon'];
const curSubtracks = Object.keys(COURSES[selectedCourseId]?.subtracks || { A: 1 });
const subIdx = curSubtracks.indexOf(selectedSubtrack);

if (subIdx >= 0 && subIdx < curSubtracks.length - 1) {
  selectedSubtrack = curSubtracks[subIdx + 1];
} else {
  const cIdx = courseOrder.indexOf(selectedCourseId);
  const nextCourse = courseOrder[(cIdx + 1) % courseOrder.length];
  selectedCourseId = nextCourse;
  selectedSubtrack = 'A';
}

audio.playRecoveryBoost();
startCountdown();
}

function buildParagliderMesh() {
if (paragliderWingGroup) {
  scene.remove(paragliderWingGroup);
  paragliderWingGroup.traverse(obj => {
    if (obj.geometry) obj.geometry.dispose();
    if (obj.material) {
      if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
      else obj.material.dispose();
    }
  });
}

paragliderWingGroup = new THREE.Group();

if (getEquippedSkinId() === 'glider_16bit') {
  const quadGeom = new THREE.PlaneGeometry(24, 12.8);
  const quadMat = new THREE.MeshBasicMaterial({
    map: spriteTextures.back,
    transparent: true,
    alphaTest: 0.1,
    depthWrite: false,
    side: THREE.DoubleSide
  });
  const pMesh = new THREE.Mesh(quadGeom, quadMat);
  pMesh.name = 'spriteDroneQuad';
  paragliderWingGroup.add(pMesh);
  scene.add(paragliderWingGroup);
  return;
}

const span = 26;
const chord = 5.4;
const segX = 32;
const segZ = 12;

const geom = new THREE.PlaneGeometry(span, chord, segX, segZ);
geom.rotateX(-Math.PI / 2);
const pos = geom.attributes.position;
const halfSpan = span / 2;
const halfChord = chord / 2;

for (let i = 0; i < pos.count; i++) {
  const x = pos.getX(i);
  const z = pos.getZ(i);

  const u = x / halfSpan; 
  const normZ = (z + halfChord) / chord; 


  const archY = (Math.cos(u * Math.PI * 0.72) - Math.cos(Math.PI * 0.72)) / (1.0 - Math.cos(Math.PI * 0.72)) * 3.6;


  const camberY = Math.sin(normZ * Math.PI) * 0.65 - (1.0 - normZ) * 0.35;

  const sweepZ = (u * u) * 1.5;

  const y = 1.7 + archY + camberY;
  const finalZ = z + sweepZ - 1.2;

  pos.setXYZ(i, x, y, finalZ);
}
geom.computeVertexNormals();

  const currentSkinId = getEquippedSkinId();
  const wingMat = createSkinMaterial(currentSkinId);
  const skinDef = GLIDER_SKINS.find(s => s.id === currentSkinId) || GLIDER_SKINS[0];

const canopyMesh = new THREE.Mesh(geom, wingMat);
canopyMesh.name = 'canopyMesh';
canopyMesh.rotation.x = -0.05; 
paragliderWingGroup.add(canopyMesh);


const podHarnessGroup = new THREE.Group();
podHarnessGroup.name = 'podHarnessGroup';
podHarnessGroup.position.set(0, -1.6, -1.8);

const podDarkMat = new THREE.MeshStandardMaterial({
  color: 0x181b22,
  roughness: 0.58,
  metalness: 0.28,
  side: THREE.DoubleSide
});

let accentHex = skinDef.color || 0xee2233;
let accentEmissive = skinDef.emissive || 0x000000;
let accentEmissiveInt = skinDef.emissiveIntensity ? skinDef.emissiveIntensity * 0.6 : 0;
if (currentSkinId === 'lunar_voyager') {
  accentHex = 0xe5a93b;
  accentEmissive = 0xffaa00;
  accentEmissiveInt = 0.35;
} else if (currentSkinId === 'aphelion_apex') {
  accentHex = 0xa020f0;
  accentEmissive = 0xa020f0;
  accentEmissiveInt = 0.5;
} else if (currentSkinId === 'glider_santa') {
  accentHex = 0xc41220;
  accentEmissive = 0xdfb12c;
  accentEmissiveInt = 0.45;
}

const podAccentMat = new THREE.MeshStandardMaterial({
  color: accentHex,
  roughness: 0.32,
  metalness: 0.65,
  emissive: accentEmissive,
  emissiveIntensity: accentEmissiveInt
});

const pilotSuitMat = new THREE.MeshStandardMaterial({
  color: 0x222732,
  roughness: 0.68,
  metalness: 0.18
});

const helmetMat = new THREE.MeshStandardMaterial({
  color: accentHex,
  roughness: 0.22,
  metalness: 0.52,
  emissive: accentEmissive,
  emissiveIntensity: accentEmissiveInt * 0.5
});

const visorMat = new THREE.MeshStandardMaterial({
  color: 0x060910,
  roughness: 0.05,
  metalness: 0.98
});


const midGeom = new THREE.CylinderGeometry(0.95, 1.05, 3.2, 16);
midGeom.rotateX(-Math.PI / 2);
const midMesh = new THREE.Mesh(midGeom, podDarkMat);
midMesh.scale.set(0.92, 0.88, 1.0);
midMesh.position.set(0, -0.1, 0.1);
podHarnessGroup.add(midMesh);

const noseGeom = new THREE.ConeGeometry(0.95, 3.4, 16);
noseGeom.rotateX(-Math.PI / 2);
const noseMesh = new THREE.Mesh(noseGeom, podDarkMat);
noseMesh.scale.set(0.88, 0.78, 1.0);
noseMesh.position.set(0, -0.25, -3.2);
podHarnessGroup.add(noseMesh);

const tailGeom = new THREE.ConeGeometry(1.05, 4.0, 16);
tailGeom.rotateX(Math.PI / 2);
const tailMesh = new THREE.Mesh(tailGeom, podDarkMat);
tailMesh.scale.set(0.85, 0.95, 1.0);
tailMesh.position.set(0, 0.08, 3.7);
podHarnessGroup.add(tailMesh);

[-0.92, 0.92].forEach(side => {
  const stripeGeom = new THREE.BoxGeometry(0.08, 0.18, 5.8);
  const stripeMesh = new THREE.Mesh(stripeGeom, podAccentMat);
  stripeMesh.position.set(side, -0.05, 0.3);
  stripeMesh.rotation.y = side > 0 ? 0.04 : -0.04;
  podHarnessGroup.add(stripeMesh);
});

const deckGeom = new THREE.BoxGeometry(1.0, 0.16, 0.82);
const deckMesh = new THREE.Mesh(deckGeom, new THREE.MeshStandardMaterial({ color: 0x111317, roughness: 0.5 }));
deckMesh.position.set(0, 0.55, -1.2);
deckMesh.rotation.x = 0.52;
podHarnessGroup.add(deckMesh);

const screenGeom = new THREE.PlaneGeometry(0.65, 0.42);
screenGeom.rotateX(-Math.PI / 2);
const screenMesh = new THREE.Mesh(screenGeom, new THREE.MeshBasicMaterial({ color: 0x00f0ff }));
screenMesh.position.set(0, 0.65, -1.2);
screenMesh.rotation.x = 0.52;
podHarnessGroup.add(screenMesh);

const torsoGeom = new THREE.BoxGeometry(1.05, 1.15, 0.92);
const torsoMesh = new THREE.Mesh(torsoGeom, pilotSuitMat);
torsoMesh.position.set(0, 0.6, -0.1);
torsoMesh.rotation.x = -0.32;
podHarnessGroup.add(torsoMesh);

const helmetGeom = new THREE.SphereGeometry(0.48, 16, 16);
helmetGeom.scale(0.92, 1.0, 1.15);
const helmetMesh = new THREE.Mesh(helmetGeom, helmetMat);
helmetMesh.position.set(0, 1.35, 0.38);
podHarnessGroup.add(helmetMesh);

const helmTailGeom = new THREE.ConeGeometry(0.36, 0.82, 12);
helmTailGeom.rotateX(Math.PI / 2);
const helmTailMesh = new THREE.Mesh(helmTailGeom, helmetMat);
helmTailMesh.position.set(0, 1.35, 0.85);
podHarnessGroup.add(helmTailMesh);

const visorGeom = new THREE.SphereGeometry(0.42, 14, 14, 0, Math.PI, 0, Math.PI * 0.65);
visorGeom.rotateY(-Math.PI / 2);
visorGeom.rotateX(-0.15);
const visorMesh = new THREE.Mesh(visorGeom, visorMat);
visorMesh.position.set(0, 1.36, 0.18);
podHarnessGroup.add(visorMesh);

[-1, 1].forEach(side => {
  const armGeom = new THREE.CylinderGeometry(0.12, 0.15, 1.05, 8);
  armGeom.rotateX(0.7);
  armGeom.rotateZ(side * 0.25);
  const armMesh = new THREE.Mesh(armGeom, pilotSuitMat);
  armMesh.position.set(side * 0.65, 0.75, -0.4);
  podHarnessGroup.add(armMesh);

  const carabinerGeom = new THREE.TorusGeometry(0.09, 0.03, 8, 12);
  const carabinerMesh = new THREE.Mesh(carabinerGeom, podAccentMat);
  carabinerMesh.position.set(side * 0.82, 0.95, -0.45);
  podHarnessGroup.add(carabinerMesh);
});

const lCar = [-0.82, 0.95, -0.45];
const rCar = [ 0.82, 0.95, -0.45];

const lineCoords = [
  -12.8, 3.4,  1.2,   lCar[0], lCar[1], lCar[2],
    -9.5, 5.0,  0.6,   lCar[0], lCar[1], lCar[2], 
    -6.0, 6.2,  0.2,   lCar[0], lCar[1], lCar[2], 
    -2.2, 7.0, -0.2,   lCar[0], lCar[1], lCar[2], 
    -9.8, 3.5,  2.8,   lCar[0], lCar[1], lCar[2], 

    12.8, 3.4,  1.2,   rCar[0], rCar[1], rCar[2], 
    9.5, 5.0,  0.6,   rCar[0], rCar[1], rCar[2], 
    6.0, 6.2,  0.2,   rCar[0], rCar[1], rCar[2], 
    2.2, 7.0, -0.2,   rCar[0], rCar[1], rCar[2], 
    9.8, 3.5,  2.8,   rCar[0], rCar[1], rCar[2], 

    -0.8, 7.2, -0.2,   lCar[0], lCar[1], lCar[2],
    0.8, 7.2, -0.2,   rCar[0], rCar[1], rCar[2]
];

const lineGeom = new THREE.BufferGeometry();
lineGeom.setAttribute('position', new THREE.Float32BufferAttribute(lineCoords, 3));
const lineMat = new THREE.LineBasicMaterial({
  color: 0x111111,
  transparent: true,
  opacity: 0.82
});
const linesMesh = new THREE.LineSegments(lineGeom, lineMat);
podHarnessGroup.add(linesMesh);

paragliderWingGroup.add(podHarnessGroup);
scene.add(paragliderWingGroup);
}


const FINISH_PLACE_IMAGES = {
  1: '1stplace.png', 
  2: '2ndplace.png', 
  3: '3rdplace.png',
  4: '4thplace.png',
  5: '5thplace.png', 
};

const FINISH_TEXT_IMAGES = {
  1: 'finish.png',
  2: '2ndplacefinish.png',
  3: '3rdplacefinish.png',
  4: '4thplacefinish.png',
  5: '5thplacefinish.png'
};

const FINISH_BANNER_IMAGES = {
  1: 'finishbanner.png',
  2: 'lessthan1stbanner.png',
  3: 'lessthan1stbanner.png',
  4: 'lessthan1stbanner.png',
  5: 'lessthan1stbanner.png'
};

function triggerRaceFinishSequence() {
  gameState = 'FINISHING';
  finishSavedTime = raceElapsedTime;
  finishSavedRank = player.rank;
  finishSequenceTimer = 5.0; // 5 full seconds of finish sequence

  const activeSubtrack = COURSES[selectedCourseId].subtracks[selectedSubtrack];
  player.nextGateIdx = 0;

  audio.playFinishFanfare();

  const banner = document.getElementById('race-finish-banner');
  const posEl = document.getElementById('rfb-sub');
  const placeImg = document.getElementById('rfb-place-img');

  if (banner) {
    banner.style.display = 'flex';

    const bannerImg = document.getElementById('rfb-banner-img');
    const textImg = document.getElementById('rfb-text-img');
    const placeWrap = document.getElementById('rfb-place-container');

    if (bannerImg) {
      const bannerSrc = (gameMode === 'timetrial') ? 'finishbanner.png' : (FINISH_BANNER_IMAGES[player.rank] || 'lessthan1stbanner.png');
      bannerImg.src = bannerSrc;
      bannerImg.style.animation = 'none';
      void bannerImg.offsetWidth;
      bannerImg.style.animation = '';
    }

    if (textImg) {
      const textSrc = (gameMode === 'timetrial') ? 'finish.png' : (FINISH_TEXT_IMAGES[player.rank] || 'finish.png');
      textImg.src = textSrc;
      textImg.style.animation = 'none';
      void textImg.offsetWidth;
      textImg.style.animation = '';
    }

    if (placeWrap) {
      placeWrap.style.animation = 'none';
      void placeWrap.offsetWidth;
      placeWrap.style.animation = '';
    }
  }

  const placeKey = (gameMode === 'timetrial') ? 'timetrial' : player.rank;
  const customImgSrc = FINISH_PLACE_IMAGES[placeKey];

  if (placeImg && customImgSrc && customImgSrc.trim() !== '') {
    placeImg.src = customImgSrc;
    placeImg.style.display = 'block';
    if (posEl) posEl.style.display = 'none';

    placeImg.onerror = () => {
      placeImg.style.display = 'none';
      if (posEl) posEl.style.display = 'block';
    };
  } else {
    if (placeImg) placeImg.style.display = 'none';
    if (posEl) {
      if (gameMode === 'timetrial') {
        posEl.style.display = 'none';
      } else {
        posEl.style.display = 'block';
        const ord = ['ST', 'ND', 'RD', 'TH', 'TH'][player.rank - 1] || 'TH';
        posEl.innerText = `${player.rank}${ord} PLACE`;
        posEl.style.color = (player.rank === 1) ? 'var(--gold)' : 'var(--cyan)';
        posEl.style.borderColor = (player.rank === 1) ? 'var(--gold)' : 'var(--cyan)';
        posEl.style.boxShadow = `0 0 16px ${(player.rank === 1) ? 'rgba(241, 196, 15, 0.45)' : 'rgba(0, 240, 255, 0.45)'}`;
      }
    }
  }
}

function createGhostDroneMesh() {
  if (ghostDroneGroup) {
    environmentGroup.remove(ghostDroneGroup);
    ghostDroneGroup = null;
  }

  const equippedSkinId = getEquippedGhostSkinId();
  ghostDroneGroup = new THREE.Group();

  if (equippedSkinId === 'ghost_16bit') {
    const quadGeom = new THREE.PlaneGeometry(38, 20.27);
    const quadMat = new THREE.MeshBasicMaterial({
      map: spriteTextures.back,
      transparent: true,
      alphaTest: 0.1,
      depthWrite: false,
      side: THREE.DoubleSide
    });
    const quadMesh = new THREE.Mesh(quadGeom, quadMat);
    quadMesh.name = 'spriteDroneQuad';
    ghostDroneGroup.add(quadMesh);
    ghostDroneGroup.is2DDrone = true;
  } else if (equippedSkinId === 'ghost_gold') {
    const mat = createGhostSkinMaterial(equippedSkinId);
    buildGoldDrone(ghostDroneGroup, mat);
    ghostDroneGroup.is2DDrone = false;
  } else if (equippedSkinId === 'ghost_krampus') {
    const mat = createGhostSkinMaterial(equippedSkinId);
    buildKrampusDrone(ghostDroneGroup, mat);
    ghostDroneGroup.is2DDrone = false;
  } else {
    const mat = createGhostSkinMaterial(equippedSkinId);
    const bodyGeom = new THREE.ConeGeometry(5, 24, 4);
    bodyGeom.rotateX(-Math.PI / 2);
    const body = new THREE.Mesh(bodyGeom, mat);
    ghostDroneGroup.add(body);

    const wingGeom = new THREE.BoxGeometry(42, 0.4, 6);
    const wing = new THREE.Mesh(wingGeom, mat);
    wing.position.set(0, 0, 3);
    ghostDroneGroup.add(wing);
    ghostDroneGroup.is2DDrone = false;
  }

  environmentGroup.add(ghostDroneGroup);
}

function resizeHudCanvas() {
  hudCanvas.width = window.innerWidth;
  hudCanvas.height = window.innerHeight;
  if (hudCtx) hudCtx.imageSmoothingEnabled = false;
}

function updateInvertButtons() {
  document.querySelectorAll('.invert-btn').forEach(btn => {
    const mode = btn.getAttribute('data-invert');
    if ((mode === 'on' && invertControls) || (mode === 'off' && !invertControls)) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
  updateRudderVisuals();
}

let pauseStartTime = 0;

function togglePauseMenu() {
  if (gameState === 'RACING' || gameState === 'RUNUP') {
    pausedState = gameState;
    pauseStartTime = performance.now();
    gameState = 'PAUSED';
    audio.stopAllAudio();
    updateInvertButtons();
    showScreen('screen-pause');
  } else if (gameState === 'PAUSED') {
    if (pauseStartTime > 0) {
      if (pausedState === 'RACING') {
        raceStartTime += (performance.now() - pauseStartTime);
      }
      pauseStartTime = 0;
    }
    gameState = pausedState;
    mouseX = 0;
    mouseY = 0;
    showScreen(null);
  }
}

function clearAndDisposeGroup(group) {
  if (!group) return;
  while (group.children.length > 0) {
    const child = group.children[0];
    group.remove(child);
    child.traverse(obj => {
      if (obj.geometry) {
        obj.geometry.dispose();
      }
      if (obj.material) {
        if (typeof waypointMaterials !== 'undefined' && 
          (obj.material === waypointMaterials.blue || obj.material === waypointMaterials.gray)) {
          return;
        }
        
        if (Array.isArray(obj.material)) {
          obj.material.forEach(m => m.dispose());
        } else {
          obj.material.dispose();
        }
      }
    });
  }
}

function buildClouds(courseKey) {
  const isHighGfx = (graphicsQuality === 'high');
  clearAndDisposeGroup(cloudsGroup);
  clearAndDisposeGroup(lowerCloudsGroup);

  const cloudGeom = new THREE.DodecahedronGeometry(1, 1);
  const cloudColor = courseKey === 'coastal' ? 0xd0dbe5 : (courseKey === 'volcano' ? 0x3d2c2e : (courseKey === 'caves' ? 0x221334 : 0xffffff));
  const cloudOpacity = courseKey === 'volcano' ? 0.38 : (courseKey === 'coastal' ? 0.35 : (courseKey === 'caves' ? 0.32 : 0.22));

  const cloudMat = new THREE.MeshLambertMaterial({
    color: cloudColor,
    transparent: true,
    opacity: cloudOpacity,
    depthWrite: false
  });

  const cloudCount = isHighGfx ? ((courseKey === 'coastal' || courseKey === 'volcano') ? 65 : 45) : 16;
  for (let i = 0; i < cloudCount; i++) {
    const cluster = new THREE.Group();
    const cx = (Math.random() - 0.5) * 8500;
    const cy = THREE.MathUtils.lerp(750, 1400, Math.random());
    const cz = -Math.random() * 9500;

    const puffs = 3 + Math.floor(Math.random() * 4);
    for (let p = 0; p < puffs; p++) {
      const mesh = new THREE.Mesh(cloudGeom, cloudMat);
      const s = 90 + Math.random() * 120;
      mesh.scale.set(s * 1.5, s * 0.5, s);
      mesh.position.set(
        (Math.random() - 0.5) * 140,
        (Math.random() - 0.5) * 40,
        (Math.random() - 0.5) * 140
      );
      cluster.add(mesh);
    }
    cluster.position.set(cx, cy, cz);
    cloudsGroup.add(cluster);
  }

if (courseKey === 'islands' || courseKey === 'coastal' || courseKey === 'volcano' || courseKey === 'caves') {
    const seaCloudColor = courseKey === 'volcano' ? 0x24181a : (courseKey === 'coastal' ? 0x90a8bd : (courseKey === 'caves' ? 0x1d102a : 0xe6f0fa));
    const seaCloudMat = new THREE.MeshLambertMaterial({
      color: seaCloudColor,
      transparent: true,
      opacity: 0.34,
      depthWrite: false
    });
    const seaCloudCount = isHighGfx ? 55 : 12;
    for (let j = 0; j < seaCloudCount; j++) {
      const seaMesh = new THREE.Mesh(cloudGeom, seaCloudMat);
      const s = 220 + Math.random() * 240;
      seaMesh.scale.set(s * 1.8, s * 0.35, s * 1.8);
      seaMesh.position.set(
        (Math.random() - 0.5) * 11000,
        THREE.MathUtils.lerp(30, 220, Math.random()),
        -Math.random() * 11000 + 500
      );
      lowerCloudsGroup.add(seaMesh);
    }
  }
}

function createThermalParticles(th) {
  const particleCount = 130;
  const geom = new THREE.BufferGeometry();
  const positions = new Float32Array(particleCount * 3);
  const speeds = new Float32Array(particleCount);
  const angles = new Float32Array(particleCount);
  const dists = new Float32Array(particleCount);

  for (let i = 0; i < particleCount; i++) {
    const r = Math.random() * th.radius * 0.85;
    const ang = Math.random() * Math.PI * 2;
    const y = th.pos.y + Math.random() * 850;

    positions[i * 3] = th.pos.x + Math.cos(ang) * r;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = th.pos.z + Math.sin(ang) * r;

    speeds[i] = 70 + Math.random() * 85;
    angles[i] = ang;
    dists[i] = r;
  }

  geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  const isHwWitch = isHalloweenThemeActive();
  const thermalColor = isHwWitch ? (Math.random() > 0.5 ? 0x00ff66 : 0xa020f0) : 0x00f0ff;
  const mat = new THREE.PointsMaterial({
    color: thermalColor,
    size: isHwWitch ? 10.0 : 7.5,
    transparent: true,
    opacity: 0.85,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });

  const pSystem = new THREE.Points(geom, mat);
  environmentGroup.add(pSystem);

  thermalSystems.push({
    points: pSystem,
    speeds: speeds,
    angles: angles,
    dists: dists,
    th: th,
    count: particleCount
  });
}

function createSinkParticles(sink) {
  const particleCount = 100;
  const geom = new THREE.BufferGeometry();
  const positions = new Float32Array(particleCount * 3);
  const speeds = new Float32Array(particleCount);
  const angles = new Float32Array(particleCount);
  const dists = new Float32Array(particleCount);

  for (let i = 0; i < particleCount; i++) {
    const r = Math.random() * sink.radius * 0.8;
    const ang = Math.random() * Math.PI * 2;
    const y = sink.pos.y + Math.random() * 400;

    positions[i * 3] = sink.pos.x + Math.cos(ang) * r;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = sink.pos.z + Math.sin(ang) * r;

    speeds[i] = -30 - Math.random() * 60;
    angles[i] = ang;
    dists[i] = r;
  }

  geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  const mat = new THREE.PointsMaterial({
    color: 0xff4444,
    size: 8.5,
    transparent: true,
    opacity: 0.55,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });

  const pSystem = new THREE.Points(geom, mat);
  environmentGroup.add(pSystem);

  thermalSystems.push({
    points: pSystem,
    speeds: speeds,
    angles: angles,
    dists: dists,
    th: sink,
    count: particleCount,
    isSink: true
  });
}

function updateThermalParticles(dt) {
  thermalSystems.forEach(sys => {
    const pos = sys.points.geometry.attributes.position.array;
    const count = sys.count;
    const th = sys.th;

    for (let i = 0; i < count; i++) {
      sys.angles[i] += 0.8 * dt;
      let y = pos[i * 3 + 1] + sys.speeds[i] * dt;
      
      if (sys.isSink) {
        if (y < sys.th.pos.y - 20) {
          y = sys.th.pos.y + 380 + Math.random() * 20;
        }
      } else {
        if (y > sys.th.pos.y + 850) {
          y = sys.th.pos.y + Math.random() * 20;
        }
      }
      
      pos[i * 3 + 1] = y;
      pos[i * 3] = th.pos.x + Math.cos(sys.angles[i]) * sys.dists[i];
      pos[i * 3 + 2] = th.pos.z + Math.sin(sys.angles[i]) * sys.dists[i];
    }
    sys.points.geometry.attributes.position.needsUpdate = true;
  });
}

function createLateralShoveParticles(shove) {
  const pCount = 110;
  const geom = new THREE.BufferGeometry();
  const positions = new Float32Array(pCount * 3);
  const speeds = new Float32Array(pCount);
  const offsets = [];

  for (let i = 0; i < pCount; i++) {
    const along = (Math.random() - 0.5) * shove.length;
    const ang = Math.random() * Math.PI * 2;
    const r = Math.random() * shove.radius;

    const perpX = Math.cos(ang) * r;
    const perpY = Math.sin(ang) * r;

    offsets.push({ along, perpX, perpY });

    positions[i * 3] = shove.pos.x + shove.axisX * along - shove.axisZ * perpX;
    positions[i * 3 + 1] = shove.pos.y + perpY;
    positions[i * 3 + 2] = shove.pos.z + shove.axisZ * along + shove.axisX * perpX;

    speeds[i] = 120 + Math.random() * 110;
  }

  geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  const mat = new THREE.PointsMaterial({
    color: 0xf39c12,
    size: 7.0,
    transparent: true,
    opacity: 0.001,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });

  const pMesh = new THREE.Points(geom, mat);
  environmentGroup.add(pMesh);

  lateralShoveSystems.push({
    mesh: pMesh,
    material: mat,
    speeds: speeds,
    offsets: offsets,
    shove: shove,
    phase: 'off',
    pCount: pCount
  });
}

function updateLateralShoves(dt) {
  const time = raceElapsedTime;
  lateralShoveSystems.forEach(sys => {
    const shove = sys.shove;
    const cycleTime = (time % shove.cyclePeriod);

    if (cycleTime < shove.offDuration) {
      sys.phase = 'off';
      sys.material.opacity = 0.001;
    } else if (cycleTime < shove.offDuration + shove.warningDuration) {
      sys.phase = 'warning';
      // Warning flicker
      const pulse = Math.sin(performance.now() * 0.024) * 0.18 + 0.22;
      sys.material.opacity = pulse;
      sys.material.color.setHex(0xe67e22);
    } else {
      sys.phase = 'on';
      const breath = 1.0 + Math.sin(performance.now() * 0.008) * 0.08;
      sys.material.opacity = 0.75;
      sys.material.color.setHex(0xf39c12);

      const pos = sys.mesh.geometry.attributes.position.array;
      for (let i = 0; i < sys.pCount; i++) {
        sys.offsets[i].perpY -= sys.speeds[i] * dt;
        if (sys.offsets[i].perpY < -shove.radius) {
          sys.offsets[i].perpY = shove.radius;
        }

        const o = sys.offsets[i];
        pos[i * 3] = shove.pos.x + shove.axisX * o.along - shove.axisZ * (o.perpX * breath);
        pos[i * 3 + 1] = shove.pos.y + o.perpY;
        pos[i * 3 + 2] = shove.pos.z + shove.axisZ * o.along + shove.axisX * (o.perpX * breath);
      }
      sys.mesh.geometry.attributes.position.needsUpdate = true;
    }
  });
}

function createBirdFlockMesh(flockDef) {
  const flockGroup = new THREE.Group();
  const subClusters = [];
  const birdWings = [];

  const isBatMode = isHalloweenThemeActive();
  const wingMat = new THREE.MeshBasicMaterial({ color: isBatMode ? 0x050505 : 0x1f2429, side: THREE.DoubleSide });

  flockDef.tiers.forEach((tier, tIdx) => {
    const clusterGroup = new THREE.Group();
    clusterGroup.position.set(tier.dx, tier.dy, tier.dz);

    for (let b = 0; b < tier.count; b++) {
      const birdMesh = new THREE.Group();
      const bx = (Math.random() - 0.5) * tier.radius * 1.5;
      const by = (Math.random() - 0.5) * 16;
      const bz = (Math.random() - 0.5) * tier.radius * 1.5;

      const wingShapeL = new THREE.BufferGeometry();
      const vL = isBatMode
        ? new Float32Array([0, 0, 0,  -4.6, 1.4, -1.4,  -2.2, -0.6, 2.4])
        : new Float32Array([0, 0, 0,  -4.2, 0.4, -1.8,  -1.2, 0, 2.0]);
      wingShapeL.setAttribute('position', new THREE.BufferAttribute(vL, 3));
      const leftWing = new THREE.Mesh(wingShapeL, wingMat);

      const wingShapeR = new THREE.BufferGeometry();
      const vR = isBatMode
        ? new Float32Array([0, 0, 0,  4.6, 1.4, -1.4,  2.2, -0.6, 2.4])
        : new Float32Array([0, 0, 0,  4.2, 0.4, -1.8,  1.2, 0, 2.0]);
      wingShapeR.setAttribute('position', new THREE.BufferAttribute(vR, 3));
      const rightWing = new THREE.Mesh(wingShapeR, wingMat);

      birdMesh.add(leftWing, rightWing);

      if (isBatMode) {
        const batBody = new THREE.Mesh(new THREE.SphereGeometry(0.8, 6, 6), wingMat);
        birdMesh.add(batBody);
      }

      birdMesh.position.set(bx, by, bz);
      clusterGroup.add(birdMesh);

      birdWings.push({
        left: leftWing,
        right: rightWing,
        flapSpeed: isBatMode ? (24 + Math.random() * 8) : (14 + Math.random() * 6),
        flapPhase: Math.random() * Math.PI * 2
      });
    }

    flockGroup.add(clusterGroup);
    subClusters.push({
      localOffset: new THREE.Vector3(tier.dx, tier.dy, tier.dz),
      radius: tier.radius,
      worldPos: new THREE.Vector3()
    });
  });

  environmentGroup.add(flockGroup);

  activeBirdFlocks.push({
    mesh: flockGroup,
    start: flockDef.start.clone(),
    end: flockDef.end.clone(),
    totalDist: flockDef.start.distanceTo(flockDef.end),
    speed: flockDef.speed || 80,
    subClusters: subClusters,
    birdWings: birdWings,
    currentPos: flockDef.start.clone()
  });
}

function updateBirdFlocks(dt) {
  const time = raceElapsedTime;
  activeBirdFlocks.forEach(flock => {
    const progress = ((time * flock.speed) % flock.totalDist) / flock.totalDist;
    flock.currentPos.lerpVectors(flock.start, flock.end, progress);
    flock.mesh.position.copy(flock.currentPos);

    // Look towards destination
    flock.mesh.lookAt(flock.end.x, flock.currentPos.y, flock.end.z);

    // Update global world coordinates of each tiered cluster for collision
    flock.subClusters.forEach(cluster => {
      cluster.worldPos.copy(cluster.localOffset).applyQuaternion(flock.mesh.quaternion).add(flock.currentPos);
    });

    // Animate flapping wings
    const tSec = performance.now() * 0.001;
    flock.birdWings.forEach(w => {
      const angle = Math.sin(tSec * w.flapSpeed + w.flapPhase) * 0.55;
      w.left.rotation.z = angle;
      w.right.rotation.z = -angle;
    });
  });
}

function setupTrackHazards(courseKey, activeSubtrack) {
  lateralShoveSystems = [];
  activeBirdFlocks = [];

  const wps = activeSubtrack.waypoints;
  if (!wps || wps.length < 5) return;

  const birdFrom  = 3; 
  const birdTo    = 4;

  const shoveFrom = 5; // from 5-6
  const shoveTo   = 6;

  // Safe clamping in case a custom track has fewer waypoints
  const b1Idx = Math.min(birdFrom, wps.length - 2);
  const b2Idx = Math.min(birdTo, wps.length - 1);
  const s1Idx = Math.min(shoveFrom, wps.length - 2);
  const s2Idx = Math.min(shoveTo, wps.length - 1);

  const sp1 = wps[s1Idx];
  const sp2 = wps[s2Idx];
  const shoveMidX = (sp1.x + sp2.x) * 0.5;
  const shoveMidY = (sp1.y + sp2.y) * 0.5;
  const shoveMidZ = (sp1.z + sp2.z) * 0.5;

  const sDx = sp2.x - sp1.x;
  const sDz = sp2.z - sp1.z;
  const sLen = Math.hypot(sDx, sDz) || 1;

  const sAxisX = -sDz / sLen;
  const sAxisZ = sDx / sLen;

  createLateralShoveParticles({
    pos: new THREE.Vector3(shoveMidX, shoveMidY, shoveMidZ),
    radius: 200,
    length: 850,
    axisX: sAxisX,
    axisZ: sAxisZ,
    force: 68,
    cyclePeriod: 7.0,
    offDuration: 2.5,
    warningDuration: 1.5
  });


  const bp1 = wps[b1Idx];
  const bp2 = wps[b2Idx];
  const birdMidX = (bp1.x + bp2.x) * 0.5;
  const birdMidY = (bp1.y + bp2.y) * 0.5; 
  const birdMidZ = (bp1.z + bp2.z) * 0.5;

  const bDx = bp2.x - bp1.x;
  const bDz = bp2.z - bp1.z;
  const bLen = Math.hypot(bDx, bDz) || 1;

  const bAxisX = -bDz / bLen;
  const bAxisZ = bDx / bLen;

  const spanDist = 2600;
  const skewAlong = 650; 

  const flockStart = new THREE.Vector3(
    birdMidX - bAxisX * spanDist - (bDx / bLen) * skewAlong,
    birdMidY,
    birdMidZ - bAxisZ * spanDist - (bDz / bLen) * skewAlong
  );

  const flockEnd = new THREE.Vector3(
    birdMidX + bAxisX * spanDist + (bDx / bLen) * skewAlong,
    birdMidY,
    birdMidZ + bAxisZ * spanDist + (bDz / bLen) * skewAlong
  );

  // Multi-altitude tiered sub-flocks 
  const tiers = [
    { dx: -140, dy: -42, dz: -70, radius: 65, count: 20 }, 
    { dx: -20,  dy: 14,  dz: -10, radius: 65, count: 22 }, 
    { dx: 95,   dy: -18, dz: 60,  radius: 65, count: 18 }, 
    { dx: 210,  dy: 48,  dz: 130, radius: 65, count: 20 }, 
    { dx: -100, dy: 70,  dz: 100, radius: 55, count: 14 },
  ];

  createBirdFlockMesh({
    start: flockStart,
    end: flockEnd,
    speed: 82,
    tiers: tiers
  });
}

function buildVolcanoEruptionPlume() {
  const pCount = 180;
  const geom = new THREE.BufferGeometry();
  const positions = new Float32Array(pCount * 3);
  const velocities = new Float32Array(pCount * 3);
  const colors = new Float32Array(pCount * 3);

  for (let i = 0; i < pCount; i++) {
    const ang = Math.random() * Math.PI * 2;
    const r = Math.random() * 260;
    positions[i * 3] = Math.cos(ang) * r;
    positions[i * 3 + 1] = 880 + Math.random() * 700;
    positions[i * 3 + 2] = -5500 + Math.sin(ang) * r;

    velocities[i * 3] = (Math.random() - 0.5) * 35;
    velocities[i * 3 + 1] = 85 + Math.random() * 110;
    velocities[i * 3 + 2] = (Math.random() - 0.5) * 35;

    const isFire = Math.random() > 0.45;
    if (isFire) {
      colors[i * 3] = 1.0;
      colors[i * 3 + 1] = 0.35 + Math.random() * 0.4;
      colors[i * 3 + 2] = 0.05;
    } else {
      const ashShade = 0.15 + Math.random() * 0.15;
      colors[i * 3] = ashShade;
      colors[i * 3 + 1] = ashShade * 0.9;
      colors[i * 3 + 2] = ashShade * 0.85;
    }
  }

  geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geom.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const mat = new THREE.PointsMaterial({
    size: 14,
    vertexColors: true,
    transparent: true,
    opacity: 0.75,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });

  const pMesh = new THREE.Points(geom, mat);
  environmentGroup.add(pMesh);

  volcanoEruptionSystem = {
    mesh: pMesh,
    velocities: velocities,
    count: pCount
  };
}

function updateVolcanoEruption(dt) {
  if (!volcanoEruptionSystem) return;
  const pos = volcanoEruptionSystem.mesh.geometry.attributes.position.array;
  const vel = volcanoEruptionSystem.velocities;
  const count = volcanoEruptionSystem.count;

  for (let i = 0; i < count; i++) {
    pos[i * 3 + 1] += vel[i * 3 + 1] * dt;
    pos[i * 3] += vel[i * 3] * dt;
    pos[i * 3 + 2] += vel[i * 3 + 2] * dt;

    if (pos[i * 3 + 1] > 1650) {
      const ang = Math.random() * Math.PI * 2;
      const r = Math.random() * 240;
      pos[i * 3] = Math.cos(ang) * r;
      pos[i * 3 + 1] = 880 + Math.random() * 40;
      pos[i * 3 + 2] = -5500 + Math.sin(ang) * r;
    }
  }
  volcanoEruptionSystem.mesh.geometry.attributes.position.needsUpdate = true;

  if (volcanoLavaLight) {
    volcanoLavaLight.intensity = 3.6 + Math.sin(performance.now() * 0.007) * 0.9;
  }
}

function triggerMassiveVolcanoExplosion() {
  audio.playCrash();
  if (audio.ctx) {
    audio.playBeep(55, 'sawtooth', 2.0, 0.75);
    audio.playBeep(40, 'square', 2.5, 0.85);
    audio.playBeep(95, 'triangle', 1.5, 0.6);
  }

  screenShake = Math.max(screenShake, 1.85);

  if (volcanoLavaLight) {
    volcanoLavaLight.intensity = 18.0;
  }

  if (volcanoEvent.explosionGroup) {
    environmentGroup.remove(volcanoEvent.explosionGroup);
  }

  volcanoEvent.explosionGroup = new THREE.Group();
  environmentGroup.add(volcanoEvent.explosionGroup);

  volcanoEvent.rocks = [];
  const rockGeom = new THREE.DodecahedronGeometry(1, 0);
  const rockMat = new THREE.MeshStandardMaterial({
    color: 0x140e10,
    emissive: 0xff3b00,
    emissiveIntensity: 0.95,
    roughness: 0.8
  });

  const numRocks = 65;
  for (let i = 0; i < numRocks; i++) {
    const rScale = THREE.MathUtils.randFloat(7, 24);
    const rockMesh = new THREE.Mesh(rockGeom, rockMat);
    rockMesh.scale.set(rScale, rScale * THREE.MathUtils.randFloat(0.75, 1.25), rScale);

    const startX = (Math.random() - 0.5) * 160;
    const startY = 890 + Math.random() * 20;
    const startZ = -5500 + (Math.random() - 0.5) * 160;
    rockMesh.position.set(startX, startY, startZ);

    volcanoEvent.explosionGroup.add(rockMesh);

    volcanoEvent.rocks.push({
      mesh: rockMesh,
      pos: new THREE.Vector3(startX, startY, startZ),
      vel: new THREE.Vector3(
        (Math.random() - 0.5) * 340,
        THREE.MathUtils.randFloat(320, 620),
        (Math.random() - 0.5) * 340
      ),
      rotSpeed: new THREE.Vector3(
        (Math.random() - 0.5) * 6,
        (Math.random() - 0.5) * 6,
        (Math.random() - 0.5) * 6
      )
    });
  }

  const sCount = 850;
  const sGeom = new THREE.BufferGeometry();
  const sPos = new Float32Array(sCount * 3);
  const sVel = new Float32Array(sCount * 3);
  const sColors = new Float32Array(sCount * 3);

  for (let i = 0; i < sCount; i++) {
    const ang = Math.random() * Math.PI * 2;
    const r = Math.random() * 320;
    sPos[i * 3] = Math.cos(ang) * r;
    sPos[i * 3 + 1] = 880 + Math.random() * 800;
    sPos[i * 3 + 2] = -5500 + Math.sin(ang) * r;

    sVel[i * 3] = (Math.random() - 0.5) * 80;
    sVel[i * 3 + 1] = THREE.MathUtils.randFloat(140, 320);
    sVel[i * 3 + 2] = (Math.random() - 0.5) * 80;

    const fireT = Math.random();
    if (fireT > 0.65) {
      sColors[i * 3] = 1.0;
      sColors[i * 3 + 1] = 0.35 + Math.random() * 0.3;
      sColors[i * 3 + 2] = 0.05;
    } else {
      const ash = 0.12 + Math.random() * 0.16;
      sColors[i * 3] = ash;
      sColors[i * 3 + 1] = ash * 0.9;
      sColors[i * 3 + 2] = ash * 0.88;
    }
  }

  sGeom.setAttribute('position', new THREE.BufferAttribute(sPos, 3));
  sGeom.setAttribute('color', new THREE.BufferAttribute(sColors, 3));

  const sMat = new THREE.PointsMaterial({
    size: 26,
    vertexColors: true,
    transparent: true,
    opacity: 0.85,
    depthWrite: false
  });

  const sMesh = new THREE.Points(sGeom, sMat);
  volcanoEvent.explosionGroup.add(sMesh);

  volcanoEvent.smokeSystem = {
    mesh: sMesh,
    velocities: sVel,
    count: sCount
  };

  volcanoEvent.denseSmokeMeshes = [];
  const puffGeom = new THREE.DodecahedronGeometry(1, 1);
  const puffMat = new THREE.MeshLambertMaterial({
    color: 0x1f1618,
    transparent: true,
    opacity: 0.52,
    depthWrite: false
  });

  for (let j = 0; j < 30; j++) {
    const puff = new THREE.Mesh(puffGeom, puffMat);
    const pScale = THREE.MathUtils.randFloat(60, 140);
    puff.scale.set(pScale * 1.5, pScale * 0.9, pScale * 1.5);
    puff.position.set(
      (Math.random() - 0.5) * 350,
      890 + Math.random() * 700,
      -5500 + (Math.random() - 0.5) * 350
    );
    volcanoEvent.explosionGroup.add(puff);
    volcanoEvent.denseSmokeMeshes.push({
      mesh: puff,
      speedY: THREE.MathUtils.randFloat(80, 170),
      baseScale: pScale
    });
  }
}

function updateMassiveVolcanoExplosion(dt) {
  if (!volcanoEvent.exploded || !volcanoEvent.explosionGroup) return;

  volcanoEvent.rocks.forEach(rock => {
    rock.vel.y -= 110 * dt;
    rock.pos.addScaledVector(rock.vel, dt);
    rock.mesh.position.copy(rock.pos);
    rock.mesh.rotation.x += rock.rotSpeed.x * dt;
    rock.mesh.rotation.y += rock.rotSpeed.y * dt;
    rock.mesh.rotation.z += rock.rotSpeed.z * dt;

    if (rock.pos.y < 870 || rock.pos.y < getTerrainHeight(rock.pos.x, rock.pos.z, 'volcano')) {
      rock.pos.set((Math.random() - 0.5) * 160, 890, -5500 + (Math.random() - 0.5) * 160);
      rock.vel.set(
        (Math.random() - 0.5) * 340,
        THREE.MathUtils.randFloat(320, 620),
        (Math.random() - 0.5) * 340
      );
    }
  });

  if (volcanoEvent.smokeSystem) {
    const pos = volcanoEvent.smokeSystem.mesh.geometry.attributes.position.array;
    const vel = volcanoEvent.smokeSystem.velocities;
    const count = volcanoEvent.smokeSystem.count;

    for (let i = 0; i < count; i++) {
      pos[i * 3] += vel[i * 3] * dt + weather.windVector.x * dt * 0.35;
      pos[i * 3 + 1] += vel[i * 3 + 1] * dt;
      pos[i * 3 + 2] += vel[i * 3 + 2] * dt + weather.windVector.z * dt * 0.35;

      if (pos[i * 3 + 1] > 2900) {
        const ang = Math.random() * Math.PI * 2;
        const r = Math.random() * 260;
        pos[i * 3] = Math.cos(ang) * r;
        pos[i * 3 + 1] = 890 + Math.random() * 40;
        pos[i * 3 + 2] = -5500 + Math.sin(ang) * r;
      }
    }
    volcanoEvent.smokeSystem.mesh.geometry.attributes.position.needsUpdate = true;
  }

  volcanoEvent.denseSmokeMeshes.forEach(puff => {
    puff.mesh.position.y += puff.speedY * dt;
    puff.mesh.position.x += weather.windVector.x * dt * 0.25;
    puff.mesh.position.z += weather.windVector.z * dt * 0.25;

    if (puff.mesh.position.y > 2700) {
      puff.mesh.position.set(
        (Math.random() - 0.5) * 350,
        890 + Math.random() * 60,
        -5500 + (Math.random() - 0.5) * 350
      );
    }
  });

  const distToCaldera = Math.hypot(player.pos.x, player.pos.z - (-5500));
  if (distToCaldera < 3000) {
    screenShake = Math.max(screenShake, (1.0 - distToCaldera / 3000) * 0.55);
  }

  if (volcanoLavaLight) {
    volcanoLavaLight.intensity = 8.5 + Math.sin(performance.now() * 0.012) * 3.5;
  }
}

function initWeatherForCourse(courseKey) {
  weather.weatherTimer = 0;
  weather.isStormy2X = false;
  weather.lightningTimer = 3.0;
  weather.lightningFlash = 0;

if (courseKey === 'moon') {
    weather.windSpeed = 0;
    weather.targetWindSpeed = 0;
    weather.windAngle = 0;
    weather.targetWindAngle = 0;
    weather.rainIntensity = 0.0;
    weather.targetRainIntensity = 0.0;
    weather.fogBaseDensity = 0.00003;
    weather.conditionText = 'VACUUM';
    return;
  } else if (courseKey === 'coastal') {
    weather.windSpeed = 22;
    weather.targetWindSpeed = 24;
    weather.windAngle = Math.PI * 0.85;
    weather.targetWindAngle = Math.PI * 0.9;
    weather.rainIntensity = 0.85;
    weather.targetRainIntensity = 0.85;
    weather.fogBaseDensity = 0.00018;
    weather.conditionText = 'HEAVY RAIN';
  } else if (courseKey === 'glacial' || courseKey === 'caves') {
    weather.windSpeed = 16;
    weather.targetWindSpeed = 18;
    weather.windAngle = Math.PI * 0.15;
    weather.targetWindAngle = Math.PI * 0.2;
    weather.rainIntensity = 0.85;
    weather.targetRainIntensity = 0.85;
    weather.fogBaseDensity = 0.00014;
    weather.conditionText = 'BLIZZARD GALE';
  } else if (courseKey === 'volcano') {
    weather.windSpeed = 22;
    weather.targetWindSpeed = 24;
    weather.windAngle = Math.PI * 1.1;
    weather.targetWindAngle = Math.PI * 1.15;
    weather.rainIntensity = 0.70;
    weather.targetRainIntensity = 0.70;
    weather.fogBaseDensity = 0.00017;
    weather.conditionText = 'ASHY RAIN';
  } else if (courseKey === 'islands') {
    weather.windSpeed = 16;
    weather.targetWindSpeed = 18;
    weather.windAngle = Math.PI * 0.25;
    weather.targetWindAngle = Math.PI * 0.35;
    weather.rainIntensity = 0.25;
    weather.targetRainIntensity = 0.3;
    weather.fogBaseDensity = 0.00012;
    weather.conditionText = 'MIST BANKS';
  } else {
    weather.windSpeed = 10;
    weather.targetWindSpeed = 11;
    weather.windAngle = Math.PI * 0.5;
    weather.targetWindAngle = Math.PI * 0.55;
    weather.rainIntensity = 0.0;
    weather.targetRainIntensity = 0.0;
    weather.fogBaseDensity = 0.00014;
    weather.conditionText = 'CLEAR';
  }
}

const TT_SCHEDULE_STORMY = [
  { spd: 22, ang: Math.PI * 0.85, rain: 0.85, cond: 'STAGE 1: 22 KT SE (RAIN)', stormy2x: false },
  { spd: 34, ang: Math.PI * 1.15, rain: 1.0, cond: 'STAGE 2: 34 KT S (STORMY)', stormy2x: true },
  { spd: 26, ang: Math.PI * 1.45, rain: 0.9, cond: 'STAGE 3: 26 KT SW (GALE)', stormy2x: false },
  { spd: 38, ang: Math.PI * 1.85, rain: 1.0, cond: 'STAGE 4: 38 KT W (STORMY)', stormy2x: true }
];
const TT_SCHEDULE_CLEAR = [
  { spd: 12, ang: Math.PI * 0.5, rain: 0.0, cond: 'STAGE 1: 12 KT E (CLEAR)', stormy2x: false },
  { spd: 19, ang: Math.PI * 0.85, rain: 0.35, cond: 'STAGE 2: 19 KT SE (RAIN)', stormy2x: false },
  { spd: 27, ang: Math.PI * 1.35, rain: 0.8, cond: 'STAGE 3: 27 KT SW (GUSTS)', stormy2x: false },
  { spd: 34, ang: Math.PI * 1.65, rain: 1.0, cond: 'STAGE 4: 34 KT W (STORMY)', stormy2x: true }
];

function updateWeather(dt) {
  if (gameMode === 'timetrial') {
    const phase = Math.floor(raceElapsedTime / 15);
    const schedule = (selectedCourseId === 'coastal' || selectedCourseId === 'volcano')
      ? TT_SCHEDULE_STORMY
      : TT_SCHEDULE_CLEAR;
    const cur = schedule[phase % schedule.length];
    weather.targetWindSpeed = cur.spd;
    weather.targetWindAngle = cur.ang;
    weather.targetRainIntensity = cur.rain;
    weather.conditionText = cur.cond;
    weather.isStormy2X = !!cur.stormy2x;
  } else {
    weather.weatherTimer += dt;
    if (weather.weatherTimer > 14.0) {
      weather.weatherTimer = 0;
      weather.targetWindAngle += (Math.random() - 0.5) * 0.8;

      const stormyChance = (selectedCourseId === 'coastal' || selectedCourseId === 'volcano') ? 0.35 : 0.20;
      if (Math.random() < stormyChance) {
        weather.isStormy2X = true;
        weather.targetWindSpeed = THREE.MathUtils.clamp(28 + (Math.random() - 0.5) * 10, 24, 40);
        weather.targetRainIntensity = 1.0;
        weather.conditionText = 'STORMY';
      } else {
        weather.isStormy2X = false;
        const baseSpd = selectedCourseId === 'coastal' ? 22 : (selectedCourseId === 'volcano' ? 22 : (selectedCourseId === 'islands' ? 15 : 10));
        weather.targetWindSpeed = THREE.MathUtils.clamp(baseSpd + (Math.random() - 0.5) * 8, 4, 34);

        if (selectedCourseId === 'canyon') {
          weather.targetRainIntensity = Math.random() > 0.65 ? 0.35 : 0.0;
          weather.conditionText = weather.targetRainIntensity > 0 ? 'LIGHT RAIN' : 'CLEAR';
        } else if (selectedCourseId === 'islands') {
          weather.targetRainIntensity = 0.15 + Math.random() * 0.35;
          weather.conditionText = 'MIST BANKS';
        } else if (selectedCourseId === 'coastal') {
          weather.targetRainIntensity = 0.6 + Math.random() * 0.4;
          weather.conditionText = 'HEAVY RAIN';
        } else if (selectedCourseId === 'volcano') {
          weather.targetRainIntensity = 0.55 + Math.random() * 0.35;
          weather.conditionText = 'ASHY RAIN';
        }
      }
    }
  }

  if (weather.isStormy2X) {
    weather.lightningTimer -= dt;
    if (weather.lightningTimer <= 0) {
      weather.lightningTimer = 3.5 + Math.random() * 5.5;
      weather.lightningFlash = 0.12;
      audio.playBeep(65, 'sawtooth', 0.4, 0.1);
    }
  } else {
    weather.lightningFlash = 0;
  }
  if (weather.lightningFlash > 0) {
    weather.lightningFlash -= dt;
  }

  weather.windAngle = THREE.MathUtils.lerp(weather.windAngle, weather.targetWindAngle, 0.4 * dt);
  weather.windSpeed = THREE.MathUtils.lerp(weather.windSpeed, weather.targetWindSpeed, 0.5 * dt);
  weather.rainIntensity = THREE.MathUtils.lerp(weather.rainIntensity, weather.targetRainIntensity, 0.6 * dt);

  weather.windVector.set(
    Math.sin(weather.windAngle) * weather.windSpeed,
    0,
    Math.cos(weather.windAngle) * weather.windSpeed
  );

  const stormyDensityMult = weather.isStormy2X ? 2.4 : 1.0;
  const targetFog = weather.fogBaseDensity * (1.0 + weather.rainIntensity * 1.3) * stormyDensityMult;
  scene.fog.density = THREE.MathUtils.lerp(scene.fog.density, targetFog, 0.4 * dt);

  const cardinalDirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const deg = ((weather.windAngle * 180 / Math.PI) % 360 + 360) % 360;
  const cIndex = Math.round(deg / 45) % 8;
  const dirName = cardinalDirs[cIndex];

  document.getElementById('wb-wind').innerText = `${Math.round(weather.windSpeed)} KT ${dirName}`;
  const condEl = document.getElementById('wb-cond');
  condEl.innerText = weather.conditionText;
  if (weather.isStormy2X) {
    condEl.style.color = 'var(--red)';
  } else {
    condEl.style.color = '';
  }
  document.getElementById('wb-track').innerText = `${selectedCourseId.toUpperCase()} - ${selectedSubtrack}`;
}

function buildCargoShip(x, z, rotY) {
  const ship = new THREE.Group();
  ship.position.set(x, 8, z);
  ship.rotation.y = rotY;

  const hull = new THREE.Mesh(
    new THREE.BoxGeometry(34, 20, 160),
    new THREE.MeshStandardMaterial({ color: 0x1a2430, roughness: 0.6 })
  );
  hull.position.y = 8;
  ship.add(hull);

  const bridge = new THREE.Mesh(
    new THREE.BoxGeometry(30, 26, 24),
    new THREE.MeshStandardMaterial({ color: 0xdedede, roughness: 0.4 })
  );
  bridge.position.set(0, 28, 52);
  ship.add(bridge);

  const colors = [0x00f0ff, 0xe74c3c, 0xf39c12, 0x2ecc71];
  for (let cz = -65; cz < 35; cz += 22) {
    for (let cx = -9; cx <= 9; cx += 9) {
      const cMesh = new THREE.Mesh(
        new THREE.BoxGeometry(8, 9, 20),
        new THREE.MeshLambertMaterial({ color: colors[Math.floor(Math.random() * colors.length)] })
      );
      cMesh.position.set(cx, 22, cz);
      ship.add(cMesh);
    }
  }
  return ship;
}

function buildSailingShip(x, z, rotY) {
  const ship = new THREE.Group();
  ship.position.set(x, 8, z);
  ship.rotation.y = rotY;

  const hull = new THREE.Mesh(
    new THREE.BoxGeometry(20, 16, 90),
    new THREE.MeshStandardMaterial({ color: 0x3e2b1d, roughness: 0.8 })
  );
  hull.position.y = 6;
  ship.add(hull);

  for (let m = -26; m <= 26; m += 26) {
    const mast = new THREE.Mesh(
      new THREE.CylinderGeometry(0.8, 1.2, 65, 6),
      new THREE.MeshStandardMaterial({ color: 0x5a422d })
    );
    mast.position.set(0, 35, m);
    ship.add(mast);

    for (let s = 20; s <= 50; s += 15) {
      const sail = new THREE.Mesh(
        new THREE.PlaneGeometry(22 - (s - 20) * 0.3, 11),
        new THREE.MeshLambertMaterial({ color: 0xf4f1ea, side: THREE.DoubleSide })
      );
      sail.position.set(0, s, m);
      sail.rotation.y = 0.15;
      ship.add(sail);
    }
  }
  return ship;
}

function buildTrawler(x, z, rotY) {
  const ship = new THREE.Group();
  ship.position.set(x, 8, z);
  ship.rotation.y = rotY;

  const hull = new THREE.Mesh(
    new THREE.BoxGeometry(14, 12, 45),
    new THREE.MeshStandardMaterial({ color: 0x2c3e50 })
  );
  hull.position.y = 5;
  ship.add(hull);

  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(11, 12, 14),
    new THREE.MeshStandardMaterial({ color: 0xecf0f1 })
  );
  cabin.position.set(0, 14, -6);
  ship.add(cabin);

  const mast = new THREE.Mesh(
    new THREE.CylinderGeometry(0.5, 0.5, 20, 4),
    new THREE.MeshBasicMaterial({ color: 0xf1c40f })
  );
  mast.position.set(0, 22, -6);
  ship.add(mast);
  return ship;
}

function buildLighthouse(x, z, scale = 1.0) {
  const groundY = getTerrainHeight(x, z, 'coastal');
  const lhGroup = new THREE.Group();
  lhGroup.position.set(x, groundY, z);

  const baseH = 85 * scale;
  const baseR1 = 12 * scale;
  const baseR2 = 22 * scale;

  const lhBase = new THREE.Mesh(
    new THREE.CylinderGeometry(baseR1, baseR2, baseH, 14),
    new THREE.MeshStandardMaterial({ color: 0xeeece8, roughness: 0.4 })
  );
  lhBase.position.y = baseH * 0.5;

  const stripeH = 18 * scale;
  const stripeR1 = THREE.MathUtils.lerp(baseR2, baseR1, 0.46);
  const stripeR2 = THREE.MathUtils.lerp(baseR2, baseR1, 0.25);
  const stripe = new THREE.Mesh(
    new THREE.CylinderGeometry(stripeR1, stripeR2, stripeH, 14),
    new THREE.MeshStandardMaterial({ color: 0xdd2222, roughness: 0.4 })
  );
  stripe.position.y = baseH * 0.35;

  const deckH = 16 * scale;
  const lhTop = new THREE.Mesh(
    new THREE.CylinderGeometry(15 * scale, 15 * scale, deckH, 14),
    new THREE.MeshStandardMaterial({ color: 0xdd2222, roughness: 0.3 })
  );
  lhTop.position.y = baseH + deckH * 0.5;

  const lanternH = 14 * scale;
  const lantern = new THREE.Mesh(
    new THREE.CylinderGeometry(10 * scale, 10 * scale, lanternH, 10),
    new THREE.MeshBasicMaterial({ color: 0xfffaaa })
  );
  lantern.position.y = baseH + deckH + lanternH * 0.5;

  const roof = new THREE.Mesh(
    new THREE.ConeGeometry(15 * scale, 14 * scale, 14),
    new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.3 })
  );
  roof.position.y = baseH + deckH + lanternH + 7 * scale;

  const beaconLight = new THREE.PointLight(0xfff4cc, 1.6, 1200 * scale);
  beaconLight.position.y = baseH + deckH + lanternH * 0.5;

  const beamGeom = new THREE.ConeGeometry(24 * scale, 180 * scale, 12, 1, true);
  beamGeom.rotateZ(Math.PI * 0.5);
  beamGeom.translate(90 * scale, 0, 0);
  const beamMat = new THREE.MeshBasicMaterial({
    color: 0xfffaaa,
    transparent: true,
    opacity: 0.22,
    side: THREE.DoubleSide,
    depthWrite: false
  });
  const beam = new THREE.Mesh(beamGeom, beamMat);
  beam.position.y = baseH + deckH + lanternH * 0.5;

  lhGroup.add(lhBase, stripe, lhTop, lantern, roof, beaconLight, beam);
  lighthouseBeams.push(beam);
  return lhGroup;
}

  const waterEnvCache = {};
function getWaterEnvMap(courseKey) {
  if (waterEnvCache[courseKey]) return waterEnvCache[courseKey];
  const profile = COURSE_LIGHTING[courseKey];
  if (!profile || !renderer) return null;

  const c = document.createElement('canvas');
  c.width = 4;
  c.height = 256;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, profile.zenith);
  grad.addColorStop(0.35, profile.mid);
  grad.addColorStop(0.5, profile.horiz);
  grad.addColorStop(1, profile.horiz);
  g.fillStyle = grad;
  g.fillRect(0, 0, 4, 256);

  const tex = new THREE.CanvasTexture(c);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.colorSpace = THREE.SRGBColorSpace;

  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromEquirectangular(tex).texture;
  pmrem.dispose();
  tex.dispose();

  waterEnvCache[courseKey] = env;
  return env;
}

  const waterFoamTime = { value: 0 };
const foamMaskCache = {};

function getFoamMask(courseKey, waterLevel) {
  if (foamMaskCache[courseKey]) return foamMaskCache[courseKey];

  const N = 256;
  const HALF = 16000;
  const canvas = document.createElement('canvas');
  canvas.width = N;
  canvas.height = N;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(N, N);

  for (let j = 0; j < N; j++) {
    const z = -HALF + ((j + 0.5) / N) * HALF * 2;
    for (let i = 0; i < N; i++) {
      const x = -HALF + ((i + 0.5) / N) * HALF * 2;
      const d = getTerrainHeight(x, z, courseKey) - waterLevel;
      // Foam in the shallow band right at the shoreline
      let m = 0;
      if (d >= 0) m = 1;
      else if (d > -6) m = 1 + d / 6;
      const idx = (j * N + i) * 4;
      const v = Math.round(m * 255);
      img.data[idx] = v;
      img.data[idx + 1] = v;
      img.data[idx + 2] = v;
      img.data[idx + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);

  const tex = new THREE.CanvasTexture(canvas);
  tex.flipY = false;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.minFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;

  foamMaskCache[courseKey] = tex;
  return tex;
}

  function buildCourse(courseKey) {
  const isHighGfx = (graphicsQuality === 'high');
  clearAndDisposeGroup(environmentGroup);
  
  gateMeshes = [];
  aiGliders = [];
  islandPlates = [];
seaStacks = [];
  thermalSystems = [];
  lateralShoveSystems = [];
  activeBirdFlocks = [];
  ghostDroneGroup = null;
  lighthouseBeams = [];
  volcanoEruptionSystem = null;
  volcanoLavaLight = null;
  activePresents3D = [];

  volcanoEvent.warningActive = false;
  volcanoEvent.exploded = false;
  volcanoEvent.rocks = [];
  volcanoEvent.smokeSystem = null;
  volcanoEvent.denseSmokeMeshes = [];
  volcanoEvent.explosionGroup = null;

  const warnEl = document.getElementById('volcano-event-warning');
  if (warnEl) warnEl.style.display = 'none';

  const course = COURSES[courseKey];
  lunarMeteorEvent.triggered = false;
  lunarMeteorEvent.active = false;
  lunarMeteorEvent.timer = 0;
  lunarMeteorEvent.impactMeshes = [];
  if (lunarMeteorEvent.group) {
    environmentGroup.remove(lunarMeteorEvent.group);
    lunarMeteorEvent.group = null;
  }
  const activeSubtrack = course.subtracks[selectedSubtrack];

applySkySetting();
  scene.fog = new THREE.FogExp2(course.fogColor, course.fogDensity);

  playerShadowMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ map: blobShadowTexture, transparent: true, opacity: 0, depthWrite: false })
  );
  playerShadowMesh.visible = (graphicsQuality === 'high');
  environmentGroup.add(playerShadowMesh);

applySkySetting();

  initWeatherForCourse(courseKey);
  buildClouds(courseKey);

  if (courseKey === 'islands') {
    const islandCoords = [
      { x: 0, y: 640, z: 120, r: 360 },
      { x: 700, y: 560, z: -1000, r: 380 },
      { x: 1400, y: 560, z: -2200, r: 440 },
      { x: 2400, y: 460, z: -3500, r: 450 },
      { x: 3200, y: 410, z: -4800, r: 520 },
      { x: 2800, y: 610, z: -6400, r: 430 },
      { x: 2200, y: 720, z: -7800, r: 470 },
      { x: 700, y: 670, z: -8600, r: 450 },
      { x: -800, y: 590, z: -9200, r: 490 },
      { x: -2200, y: 550, z: -7800, r: 470 },
      { x: -3200, y: 510, z: -6200, r: 490 },
      { x: -2800, y: 580, z: -4500, r: 430 },
      { x: -2200, y: 650, z: -2800, r: 430 },
      { x: -1100, y: 530, z: -1500, r: 390 },
      { x: 300, y: 450, z: -5200, r: 370 },
      { x: -1400, y: 480, z: -5600, r: 400 }
    ];

    islandCoords.forEach(isl => {
    islandPlates.push({ x: isl.x, y: isl.y, z: isl.z, radius: isl.r, height: isl.y });

      const islandGroup = new THREE.Group();
      islandGroup.position.set(isl.x, isl.y, isl.z);

      const topGeom = new THREE.CylinderGeometry(isl.r, isl.r * 0.85, 48, 20);
      const topMat = new THREE.MeshLambertMaterial({ color: course.grassColor, flatShading: (graphicsQuality !== 'high') });
      const topMesh = new THREE.Mesh(topGeom, topMat);
      topMesh.position.y = -24;
      islandGroup.add(topMesh);

      const coneGeom = new THREE.ConeGeometry(isl.r * 0.85, isl.r * 1.5, 18);
      coneGeom.rotateX(Math.PI);
      const coneMat = new THREE.MeshLambertMaterial({ color: course.groundColor, flatShading: (graphicsQuality !== 'high') });
      const coneMesh = new THREE.Mesh(coneGeom, coneMat);
      coneMesh.position.y = -48 - (isl.r * 0.75);
      islandGroup.add(coneMesh);

      const archGeom = new THREE.TorusGeometry(isl.r * 0.35, 12, 8, 22, Math.PI);
      const archMat = new THREE.MeshLambertMaterial({ color: 0x90989c, flatShading: true });
      const archMesh = new THREE.Mesh(archGeom, archMat);
      archMesh.position.set(0, 10, 0);
      archMesh.rotation.y = Math.random() * Math.PI;
      islandGroup.add(archMesh);

      const ruinMat = new THREE.MeshLambertMaterial({ color: 0x82898e });

      for (let p = 0; p < 5; p++) {
        const pillarGeom = new THREE.BoxGeometry(10, 45 + Math.random() * 35, 10);
        const pillar = new THREE.Mesh(pillarGeom, ruinMat);
        const ang = (p / 5) * Math.PI * 2;
        pillar.position.set(Math.cos(ang) * (isl.r * 0.55), 20, Math.sin(ang) * (isl.r * 0.55));
        islandGroup.add(pillar);
      }

      for (let f = 0; f < 3; f++) {
        const fallen = new THREE.Mesh(new THREE.CylinderGeometry(5, 5, 42, 8), ruinMat);
        fallen.position.set((Math.random() - 0.5) * isl.r * 0.7, 5, (Math.random() - 0.5) * isl.r * 0.7);
        fallen.rotation.set(Math.PI / 2 + (Math.random() - 0.5) * 0.2, 0, Math.random() * Math.PI);
        islandGroup.add(fallen);
      }

      for (let d = 0; d < 4; d++) {
        const chunk = new THREE.Mesh(
          new THREE.DodecahedronGeometry(8 + Math.random() * 8),
          new THREE.MeshLambertMaterial({ color: course.groundColor, flatShading: true })
        );
        const a = (d / 4) * Math.PI * 2 + Math.random() * 0.5;
        const dist = isl.r * 0.8 + Math.random() * (isl.r * 0.15);
        chunk.position.set(Math.cos(a) * dist, 4, Math.sin(a) * dist);
        chunk.rotation.set(Math.random() * 0.5, Math.random() * Math.PI * 2, Math.random() * 0.5);
        islandGroup.add(chunk);
      }

      environmentGroup.add(islandGroup);
    });
  } else if (courseKey === 'coastal') {
    const stackCoords = [
      { x: -1400, z: -2000, r: 130, h: 280 },
      { x: -3200, z: -4800, r: 170, h: 200 },
      { x: -1200, z: -7500, r: 150, h: 440 },
      { x: 2000, z: -8800, r: 160, h: 350 },
      { x: 3400, z: -5800, r: 140, h: 260 },
      { x: -2200, z: -3400, r: 120, h: 230 },
      { x: -600, z: -4500, r: 130, h: 220 },
      { x: 1200, z: -5000, r: 120, h: 200 }
    ];

    stackCoords.forEach(stk => {
      seaStacks.push({ x: stk.x, z: stk.z, radius: stk.r, height: stk.h });

      const stackGroup = new THREE.Group();
      stackGroup.position.set(stk.x, 0, stk.z);

      const rockGeom = new THREE.CylinderGeometry(stk.r * 0.72, stk.r, stk.h, 16, 4);
      const rockMat = new THREE.MeshLambertMaterial({ color: course.groundColor, flatShading: true });
      const rockMesh = new THREE.Mesh(rockGeom, rockMat);
      rockMesh.position.y = stk.h * 0.5;
      stackGroup.add(rockMesh);

      environmentGroup.add(stackGroup);
    });

    const lighthouseLocations = [
      { x: 2200, z: -5500, scale: 1.1 },
      { x: 800, z: -9400, scale: 1.2 },
      { x: -2800, z: -6500, scale: 1.0 },
      { x: -2400, z: -2400, scale: 1.0 },
      { x: -1850, z: -1600, scale: 0.9 },
      { x: -1200, z: -7500, scale: 0.85 }
    ];

    lighthouseLocations.forEach(lh => {
      environmentGroup.add(buildLighthouse(lh.x, lh.z, lh.scale));
    });

    environmentGroup.add(buildCargoShip(-1500, -3200, 0.4));
    environmentGroup.add(buildCargoShip(1200, -7200, -0.6));
    environmentGroup.add(buildSailingShip(-2800, -2200, 1.2));
    environmentGroup.add(buildSailingShip(2400, -4200, -1.8));
    environmentGroup.add(buildTrawler(-800, -1600, 0.2));
    environmentGroup.add(buildTrawler(800, -3400, 2.1));
    environmentGroup.add(buildTrawler(-2600, -6400, -0.9));
  } else if (courseKey === 'volcano') {
    const lavaGeom = new THREE.CircleGeometry(480, 28);
    lavaGeom.rotateX(-Math.PI / 2);
    const lavaMat = new THREE.MeshBasicMaterial({
      color: 0xff3b00,
      side: THREE.DoubleSide
    });
    const lavaMesh = new THREE.Mesh(lavaGeom, lavaMat);
    lavaMesh.position.set(0, 882, -5500);
    environmentGroup.add(lavaMesh);

    const lavaCoreGeom = new THREE.CircleGeometry(260, 24);
    lavaCoreGeom.rotateX(-Math.PI / 2);
    const lavaCoreMat = new THREE.MeshBasicMaterial({
      color: 0xffaa00,
      side: THREE.DoubleSide
    });
    const lavaCoreMesh = new THREE.Mesh(lavaCoreGeom, lavaCoreMat);
    lavaCoreMesh.position.set(0, 883, -5500);
    environmentGroup.add(lavaCoreMesh);

    volcanoLavaLight = new THREE.PointLight(0xff4400, 4.2, 3800);
    volcanoLavaLight.position.set(0, 920, -5500);
    environmentGroup.add(volcanoLavaLight);

    const lavaRibbonMat = new THREE.MeshBasicMaterial({ color: 0xff3700, side: THREE.DoubleSide });
    const lavaRibbonCoreMat = new THREE.MeshBasicMaterial({ color: 0xffaa00, side: THREE.DoubleSide });

    const createLavaRiver = (startAngle, length, steps) => {
      for (let s = 0; s < steps; s++) {
        const t1 = s / steps;
        const t2 = (s + 1) / steps;
        const r1 = THREE.MathUtils.lerp(560, length, t1);
        const r2 = THREE.MathUtils.lerp(560, length, t2);
        const a1 = startAngle + Math.sin(t1 * 6.0) * 0.15;
        const a2 = startAngle + Math.sin(t2 * 6.0) * 0.15;

        const x1 = Math.cos(a1) * r1;
        const z1 = -5500 + Math.sin(a1) * r1;
        const y1 = getTerrainHeight(x1, z1, 'volcano') + 3.0;

        const x2 = Math.cos(a2) * r2;
        const z2 = -5500 + Math.sin(a2) * r2;
        const y2 = getTerrainHeight(x2, z2, 'volcano') + 3.0;

        const width = THREE.MathUtils.lerp(65, 115, t1);
        const riverSegment = new THREE.Mesh(
          new THREE.BoxGeometry(width, 2.5, Math.hypot(x2 - x1, z2 - z1) + 8),
          lavaRibbonMat
        );
        riverSegment.position.set((x1 + x2) * 0.5, (y1 + y2) * 0.5, (z1 + z2) * 0.5);
        riverSegment.lookAt(x2, y2, z2);
        environmentGroup.add(riverSegment);

        const riverCore = new THREE.Mesh(
          new THREE.BoxGeometry(width * 0.45, 3.2, Math.hypot(x2 - x1, z2 - z1) + 9),
          lavaRibbonCoreMat
        );
        riverCore.position.set((x1 + x2) * 0.5, (y1 + y2) * 0.5 + 0.6, (z1 + z2) * 0.5);
        riverCore.lookAt(x2, y2, z2);
        environmentGroup.add(riverCore);
      }
    };

    createLavaRiver(Math.PI * 0.48, 2900, 18);
    createLavaRiver(Math.PI * 1.05, 3100, 18);
    createLavaRiver(-Math.PI * 0.15, 2800, 16);
    createLavaRiver(-Math.PI * 0.72, 3000, 18);

    buildVolcanoEruptionPlume();

    const stackCoords = [
      { x: -3600, z: -2400, r: 130, h: 270 },
      { x: -4400, z: -4600, r: 150, h: 250 },
      { x: 3200, z: -5600, r: 140, h: 290 },
      { x: 4200, z: -7800, r: 160, h: 260 },
      { x: 1400, z: -9400, r: 120, h: 240 }
    ];
    stackCoords.forEach(stk => {
      seaStacks.push({ x: stk.x, z: stk.z, radius: stk.r, height: stk.h });
      const rockGeom = new THREE.CylinderGeometry(stk.r * 0.75, stk.r, stk.h, 14, 3);
      const rockMat = new THREE.MeshLambertMaterial({ color: 0x181214, flatShading: true });
      const rockMesh = new THREE.Mesh(rockGeom, rockMat);
      rockMesh.position.set(stk.x, stk.h * 0.5, stk.z);
      environmentGroup.add(rockMesh);
    });

} else if (courseKey === 'moon') {
    const earthCanvas = document.createElement('canvas');
    earthCanvas.width = 1024;
    earthCanvas.height = 512;
    const eCtx = earthCanvas.getContext('2d');

    const oceanGrad = eCtx.createLinearGradient(0, 0, 0, 512);
    oceanGrad.addColorStop(0, '#040f1e');
    oceanGrad.addColorStop(0.25, '#0a2344');
    oceanGrad.addColorStop(0.5, '#123e75');
    oceanGrad.addColorStop(0.75, '#0a2344');
    oceanGrad.addColorStop(1, '#040f1e');
    eCtx.fillStyle = oceanGrad;
    eCtx.fillRect(0, 0, 1024, 512);

    eCtx.fillStyle = '#2c5e38';
    eCtx.beginPath(); 
    eCtx.ellipse(260, 160, 140, 85, -0.22, 0, Math.PI * 2);
    eCtx.fill();
    eCtx.beginPath(); 
    eCtx.ellipse(360, 340, 75, 115, 0.22, 0, Math.PI * 2);
    eCtx.fill();
    eCtx.beginPath(); 
    eCtx.ellipse(680, 155, 220, 90, 0.04, 0, Math.PI * 2);
    eCtx.fill();
    eCtx.beginPath(); 
    eCtx.ellipse(560, 290, 95, 120, 0.12, 0, Math.PI * 2);
    eCtx.fill();
    eCtx.beginPath(); 
    eCtx.ellipse(820, 370, 70, 48, -0.15, 0, Math.PI * 2);
    eCtx.fill();

    eCtx.fillStyle = '#b08a47';
    eCtx.beginPath();
    eCtx.ellipse(555, 235, 75, 36, 0.05, 0, Math.PI * 2);
    eCtx.fill();
    eCtx.beginPath();
    eCtx.ellipse(675, 205, 60, 28, 0.1, 0, Math.PI * 2);
    eCtx.fill();

    eCtx.fillStyle = '#ebf6fc';
    eCtx.beginPath();
    eCtx.ellipse(512, 18, 490, 30, 0, 0, Math.PI * 2);
    eCtx.fill();
    eCtx.beginPath();
    eCtx.ellipse(512, 496, 490, 32, 0, 0, Math.PI * 2);
    eCtx.fill();

    eCtx.fillStyle = 'rgba(255, 255, 255, 0.65)';
    for (let c = 0; c < 50; c++) {
      eCtx.beginPath();
      const cx = (c * 67 + 37) % 1024;
      const cy = 60 + ((c * 43) % 390);
      const rw = 50 + (c % 7) * 22;
      const rh = 16 + (c % 5) * 8;
      eCtx.ellipse(cx, cy, rw, rh, (c % 4 - 2) * 0.2, 0, Math.PI * 2);
      eCtx.fill();
    }
    eCtx.strokeStyle = 'rgba(255, 255, 255, 0.72)';
    eCtx.lineWidth = 14;
    [[280, 140], [720, 180], [390, 320]].forEach(([sx, sy]) => {
      eCtx.beginPath();
      eCtx.arc(sx, sy, 45, 0.2, Math.PI * 1.6);
      eCtx.stroke();
    });

    const earthTex = new THREE.CanvasTexture(earthCanvas);
    const earthGroup = new THREE.Group();
    earthGroup.position.set(1000, 3400, -19500);

    const earthMesh = new THREE.Mesh(
      new THREE.SphereGeometry(3800, 48, 48),
      new THREE.MeshStandardMaterial({
        map: earthTex,
        roughness: 0.35,
        metalness: 0.15,
        emissive: 0x071e36,
        emissiveIntensity: 0.4
      })
    );
    earthMesh.rotation.z = 0.38;
    earthMesh.rotation.y = 0.9;
    earthGroup.add(earthMesh);

    const atmoMesh = new THREE.Mesh(
      new THREE.SphereGeometry(3990, 40, 40),
      new THREE.MeshBasicMaterial({ color: 0x00e1ff, transparent: true, opacity: 0.35, side: THREE.BackSide })
    );
    earthGroup.add(atmoMesh);
    environmentGroup.add(earthGroup);

    const starCount = 2000;
    const starGeom = new THREE.BufferGeometry();
    const starPos = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      const u = Math.random(), v = Math.random();
      const theta = u * 2.0 * Math.PI;
      const phi = Math.acos(2.0 * v - 1.0) * 0.48;
      const r = 21000 + Math.random() * 4500;
      starPos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      starPos[i * 3 + 1] = Math.max(120, r * Math.cos(phi));
      starPos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    }
    starGeom.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    environmentGroup.add(new THREE.Points(
      starGeom,
      new THREE.PointsMaterial({ color: 0xffffff, size: 6.8, transparent: true, opacity: 0.95 })
    ));

    let lSeed = 1969;
    const lRnd = () => { lSeed = (lSeed * 1664525 + 1013904223) >>> 0; return lSeed / 4294967296; };
    const boulderMat = new THREE.MeshStandardMaterial({ color: 0x484b52, roughness: 0.88, metalness: 0.12, flatShading: true });
    const brightRockMat = new THREE.MeshStandardMaterial({ color: 0x767a84, roughness: 0.82, metalness: 0.15, flatShading: true });

    const boulderCount = isHighGfx ? 145 : 35;
    for (let b = 0; b < boulderCount; b++) {
      const bx = (lRnd() - 0.5) * 11500;
      const bz = -lRnd() * 11800 - 300;
      if (bz > -350 && Math.abs(bx) < 320) continue;
      const by = getTerrainHeight(bx, bz, 'moon');
      const bScale = 7 + lRnd() * 22 + (lRnd() > 0.88 ? 32 : 0);
      const bMesh = new THREE.Mesh(new THREE.DodecahedronGeometry(bScale, 0), (lRnd() > 0.4 ? boulderMat : brightRockMat));
      bMesh.position.set(bx, by + bScale * 0.42, bz);
      bMesh.rotation.set(lRnd() * Math.PI, lRnd() * Math.PI, lRnd() * Math.PI);
      bMesh.scale.set(1.0 + lRnd() * 0.4, 0.65 + lRnd() * 0.35, 1.0 + lRnd() * 0.4);
      environmentGroup.add(bMesh);
    }

    // LUNAR RELAY NAVIGATION BEACONS ALONG DESOLATE PASSES
    const beaconCoords = [
      [300, -850], [1200, -2700], [1700, -5100], [800, -7400],
      [-1500, -5200], [-2100, -4800], [-3000, -8400], [2100, -7800]
    ];
    beaconCoords.forEach(([bx, bz]) => {
      const by = getTerrainHeight(bx, bz, 'moon');
      const pylon = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 1.4, 38, 6), new THREE.MeshStandardMaterial({ color: 0x8c929c, metalness: 0.8 }));
      pylon.position.set(bx, by + 19, bz);
      const lightCap = new THREE.Mesh(new THREE.SphereGeometry(2.5, 8, 8), new THREE.MeshBasicMaterial({ color: 0x00f0ff }));
      lightCap.position.set(bx, by + 39, bz);
      environmentGroup.add(pylon, lightCap);
    });

    const apolloGroup = new THREE.Group();
    const apX = 600, apZ = -1600;
    const apY = getTerrainHeight(apX, apZ, 'moon');
    apolloGroup.position.set(apX, apY, apZ);

    const foilMat = new THREE.MeshStandardMaterial({
      color: 0xe0ad36, roughness: 0.28, metalness: 0.95, emissive: 0x5a4208, emissiveIntensity: 0.35
    });
    const blackFoilMat = new THREE.MeshStandardMaterial({
      color: 0x1a1a1a, roughness: 0.55, metalness: 0.65
    });
    const silverMat = new THREE.MeshStandardMaterial({
      color: 0xdce0e6, roughness: 0.22, metalness: 0.85
    });
    const darkBellMat = new THREE.MeshStandardMaterial({
      color: 0x222224, roughness: 0.75, metalness: 0.85
    });
    const windowMat = new THREE.MeshStandardMaterial({
      color: 0x0d121c, roughness: 0.05, metalness: 0.95, emissive: 0x00f0ff, emissiveIntensity: 0.18
    });

    const descentStage = new THREE.Mesh(new THREE.CylinderGeometry(56, 62, 28, 8), foilMat);
    descentStage.position.y = 19;
    apolloGroup.add(descentStage);

    for (let q = 0; q < 4; q++) {
      const qAng = (q / 4) * Math.PI * 2;
      const bay = new THREE.Mesh(new THREE.BoxGeometry(26, 22, 18), (q % 2 === 0 ? blackFoilMat : silverMat));
      bay.position.set(Math.cos(qAng) * 44, 19, Math.sin(qAng) * 44);
      bay.rotation.y = qAng;
      apolloGroup.add(bay);
    }

    const dpsNozzle = new THREE.Mesh(new THREE.CylinderGeometry(11, 26, 22, 16), darkBellMat);
    dpsNozzle.position.y = 9;
    apolloGroup.add(dpsNozzle);

    for (let leg = 0; leg < 4; leg++) {
      const ang = (leg / 4) * Math.PI * 2 + Math.PI / 4;
      const legGroup = new THREE.Group();
      legGroup.position.set(Math.cos(ang) * 48, 18, Math.sin(ang) * 48);
      legGroup.rotation.y = ang;

      // Main Strut
      const mainStrut = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.4, 68, 8), foilMat);
      mainStrut.rotation.x = 0.65;
      mainStrut.position.set(0, -6, 22);
      legGroup.add(mainStrut);

      // A-Frame Diagonal Trusses
      [-11, 11].forEach(dx => {
        const truss = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 58, 6), silverMat);
        truss.position.set(dx, -5, 14);
        truss.rotation.x = 0.52;
        truss.rotation.z = (dx > 0 ? -0.22 : 0.22);
        legGroup.add(truss);
      });

      const pad = new THREE.Mesh(new THREE.CylinderGeometry(16, 17, 3.5, 14), foilMat);
      pad.position.set(0, -17.5, 46);
      legGroup.add(pad);

      const probe = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 16, 4), darkBellMat);
      probe.position.set(0, -25, 46);
      legGroup.add(probe);

      apolloGroup.add(legGroup);
    }

    const porch = new THREE.Mesh(new THREE.BoxGeometry(16, 2.5, 14), silverMat);
    porch.position.set(0, 32, 48);
    apolloGroup.add(porch);

    const ladderGroup = new THREE.Group();
    [-4.5, 4.5].forEach(lx => {
      const sideRail = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 48, 6), silverMat);
      sideRail.position.set(lx, 10, 68);
      sideRail.rotation.x = 0.55;
      ladderGroup.add(sideRail);
    });
    for (let r = 0; r < 9; r++) {
      const rung = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 9, 6), silverMat);
      rung.rotation.z = Math.PI / 2;
      rung.position.set(0, 28 - r * 4.4, 48 + r * 3.8);
      ladderGroup.add(rung);
    }
    const plaque = new THREE.Mesh(new THREE.BoxGeometry(8, 6, 0.8), new THREE.MeshStandardMaterial({ color: 0xeeeeee, metalness: 0.95 }));
    plaque.position.set(0, 18, 56);
    plaque.rotation.x = 0.55;
    ladderGroup.add(plaque);
    apolloGroup.add(ladderGroup);

    const cabinGroup = new THREE.Group();
    cabinGroup.position.set(0, 33, 0);

    const cabinCenter = new THREE.Mesh(new THREE.CylinderGeometry(38, 44, 34, 8), silverMat);
    cabinCenter.position.y = 17;
    cabinGroup.add(cabinCenter);

    const cockpitNose = new THREE.Mesh(new THREE.BoxGeometry(42, 24, 26), silverMat);
    cockpitNose.position.set(0, 15, 24);
    cabinGroup.add(cockpitNose);

    [-11, 11].forEach(wx => {
      const win = new THREE.Mesh(new THREE.PlaneGeometry(10, 8), windowMat);
      win.position.set(wx, 19, 37.2);
      win.rotation.x = -0.15;
      cabinGroup.add(win);
    });

    const dockCollar = new THREE.Mesh(new THREE.CylinderGeometry(14, 14, 10, 16), blackFoilMat);
    dockCollar.position.y = 37;
    cabinGroup.add(dockCollar);

    for (let rq = 0; rq < 4; rq++) {
      const rAng = (rq / 4) * Math.PI * 2 + Math.PI / 4;
      const rcsArm = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 24, 6), silverMat);
      rcsArm.position.set(Math.cos(rAng) * 34, 20, Math.sin(rAng) * 34);
      rcsArm.rotation.z = Math.PI / 2;
      rcsArm.rotation.y = rAng;
      cabinGroup.add(rcsArm);

      [-3.5, 3.5].forEach(nz => {
        const bell = new THREE.Mesh(new THREE.ConeGeometry(2.0, 4.5, 6), darkBellMat);
        bell.position.set(Math.cos(rAng) * 44, 20, Math.sin(rAng) * 44 + nz);
        bell.rotation.x = Math.PI / 2;
        cabinGroup.add(bell);
      });
    }

    const sBandDish = new THREE.Mesh(new THREE.ConeGeometry(15, 6, 16, 1, true), silverMat);
    sBandDish.position.set(22, 42, 14);
    sBandDish.rotation.set(-0.7, 0.4, 0);
    cabinGroup.add(sBandDish);

    apolloGroup.add(cabinGroup);

    const flagGroup = new THREE.Group();
    flagGroup.position.set(110, 0, 65);

    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(1.2, 1.4, 75, 12),
      new THREE.MeshStandardMaterial({ color: 0xd8d8d8, metalness: 0.9 })
    );
    pole.position.y = 37.5;

    const crossBar = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 40, 8), new THREE.MeshStandardMaterial({ color: 0xd8d8d8, metalness: 0.9 }));
    crossBar.rotation.z = Math.PI / 2;
    crossBar.position.set(20, 73, 0);

    const goldBall = new THREE.Mesh(new THREE.SphereGeometry(2.2, 10, 10), foilMat);
    goldBall.position.set(0, 75, 0);
    flagGroup.add(pole, crossBar, goldBall);

    const flagGeom = new THREE.PlaneGeometry(38, 24, 20, 8);
    const fPos = flagGeom.attributes.position;
    for (let i = 0; i < fPos.count; i++) {
      const fx = fPos.getX(i);
      const fy = fPos.getY(i);
      const normX = (fx + 19) / 38;
      fPos.setZ(i, Math.sin(normX * Math.PI * 3.2) * (2.8 * normX) + Math.cos(fy * 0.35) * 0.8);
    }
    flagGeom.computeVertexNormals();

    const flagCanvas = document.createElement('canvas');
    flagCanvas.width = 256;
    flagCanvas.height = 160;
    const fCtx = flagCanvas.getContext('2d');
    for (let s = 0; s < 13; s++) {
      fCtx.fillStyle = (s % 2 === 0) ? '#be1622' : '#ffffff';
      fCtx.fillRect(0, s * (160 / 13), 256, (160 / 13) + 1);
    }
    fCtx.fillStyle = '#0f275e';
    fCtx.fillRect(0, 0, 105, 86);
    fCtx.fillStyle = '#ffffff';
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 6; c++) fCtx.fillRect(10 + c * 15, 9 + r * 15, 5, 5);
    }
    const flagBanner = new THREE.Mesh(
      flagGeom,
      new THREE.MeshStandardMaterial({
        map: new THREE.CanvasTexture(flagCanvas),
        roughness: 0.5,
        side: THREE.DoubleSide
      })
    );
    flagBanner.position.set(19, 61, 0);
    flagGroup.add(flagBanner);
    apolloGroup.add(flagGroup);

    const tvTripod = new THREE.Mesh(new THREE.ConeGeometry(10, 24, 3, 1, true), silverMat);
    tvTripod.position.set(90, 12, 130);
    const tvCam = new THREE.Mesh(new THREE.BoxGeometry(10, 8, 14), foilMat);
    tvCam.position.set(90, 26, 130);
    tvCam.lookAt(apX, apY + 30, apZ);
    apolloGroup.add(tvTripod, tvCam);

    const psep = new THREE.Mesh(new THREE.CylinderGeometry(8, 8, 8, 10), silverMat);
    psep.position.set(-85, 4, 100);
    [-14, 14].forEach(sx => {
      const panel = new THREE.Mesh(new THREE.BoxGeometry(16, 0.8, 14), new THREE.MeshStandardMaterial({ color: 0x143b7a, metalness: 0.8 }));
      panel.position.set(-85 + sx, 6, 100);
      apolloGroup.add(panel);
    });
    apolloGroup.add(psep);

    const trailGeom = new THREE.PlaneGeometry(16, 120);
    trailGeom.rotateX(-Math.PI / 2);
    const trailMesh = new THREE.Mesh(trailGeom, new THREE.MeshBasicMaterial({ color: 0x22242a, transparent: true, opacity: 0.45 }));
    trailMesh.position.set(50, 0.8, 80);
    trailMesh.rotation.y = -0.55;
    apolloGroup.add(trailMesh);

    const apolloBeacon = new THREE.PointLight(0xfff1cc, 2.2, 450);
    apolloBeacon.position.set(0, 55, 0);
    apolloGroup.add(apolloBeacon);

    environmentGroup.add(apolloGroup);


    const roverGroup = new THREE.Group();
    const rovX = -1800, rovZ = -3400;
    roverGroup.position.set(rovX, getTerrainHeight(rovX, rovZ, 'moon'), rovZ);
    roverGroup.rotation.y = 1.1;

    const chassis = new THREE.Mesh(new THREE.BoxGeometry(40, 5, 68), silverMat);
    chassis.position.y = 12;
    roverGroup.add(chassis);

    const orangeFenderMat = new THREE.MeshStandardMaterial({ color: 0xe64a19, roughness: 0.4, metalness: 0.3 });
    const wireTireMat = new THREE.MeshStandardMaterial({ color: 0x61666e, roughness: 0.6, metalness: 0.85, wireframe: false });

    [[-24, -22], [-24, 22], [24, -22], [24, 22]].forEach(([wx, wz]) => {
      const tire = new THREE.Mesh(new THREE.TorusGeometry(11, 4.2, 8, 16), wireTireMat);
      tire.rotateY(Math.PI / 2);
      tire.position.set(wx, 12, wz);
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(5, 5, 6, 8), silverMat);
      hub.rotateZ(Math.PI / 2);
      hub.position.set(wx, 12, wz);
      const fender = new THREE.Mesh(new THREE.BoxGeometry(9, 4, 24), orangeFenderMat);
      fender.position.set(wx, 19.5, wz);
      roverGroup.add(tire, hub, fender);
    });

    [-9, 9].forEach(sx => {
      const seatBottom = new THREE.Mesh(new THREE.BoxGeometry(13, 2.5, 14), blackFoilMat);
      seatBottom.position.set(sx, 16, 2);
      const seatBack = new THREE.Mesh(new THREE.BoxGeometry(13, 18, 2.5), blackFoilMat);
      seatBack.position.set(sx, 24, -6);
      seatBack.rotation.x = -0.18;
      roverGroup.add(seatBottom, seatBack);
    });

    // Center T-Handle Driving Joystick & Console
    const consoleBox = new THREE.Mesh(new THREE.BoxGeometry(6, 12, 12), silverMat);
    consoleBox.position.set(0, 18, 6);
    const tStick = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 14, 6), blackFoilMat);
    tStick.position.set(0, 24, 8);
    const tHandle = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 6, 6), blackFoilMat);
    tHandle.rotation.z = Math.PI / 2;
    tHandle.position.set(0, 31, 8);
    roverGroup.add(consoleBox, tStick, tHandle);

    const rCam = new THREE.Mesh(new THREE.BoxGeometry(8, 7, 10), foilMat);
    rCam.position.set(0, 18, 38);
    const dishMast = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 32, 6), silverMat);
    dishMast.position.set(12, 28, 28);
    const umbrellaDish = new THREE.Mesh(new THREE.ConeGeometry(17, 7, 16, 1, true), foilMat);
    umbrellaDish.position.set(12, 44, 28);
    umbrellaDish.rotation.set(-0.6, 0.35, 0);
    roverGroup.add(rCam, dishMast, umbrellaDish);

    const rearPallet = new THREE.Mesh(new THREE.BoxGeometry(32, 10, 22), silverMat);
    rearPallet.position.set(0, 18, -22);
    roverGroup.add(rearPallet);

    const tracksGeom = new THREE.PlaneGeometry(36, 220);
    tracksGeom.rotateX(-Math.PI / 2);
    const tracksMesh = new THREE.Mesh(tracksGeom, new THREE.MeshBasicMaterial({ color: 0x1e2026, transparent: true, opacity: 0.5 }));
    tracksMesh.position.set(0, 0.4, -120);
    roverGroup.add(tracksMesh);

    environmentGroup.add(roverGroup);


    const golfGroup = new THREE.Group();
    const gX = 1800, gZ = -3800;
    const gY = getTerrainHeight(gX, gZ, 'moon');
    golfGroup.position.set(gX, gY, gZ);

    const golfBall1 = new THREE.Mesh(new THREE.SphereGeometry(7, 14, 14), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.25 }));
    golfBall1.position.set(0, 10, 0);
    const tee = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 0.4, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff2222 }));
    tee.position.y = 4;

    const clubShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 44, 6), silverMat);
    clubShaft.position.set(14, 20, -5);
    clubShaft.rotation.set(0.3, 0, 0.25);
    const clubHead = new THREE.Mesh(new THREE.BoxGeometry(6, 4, 2), silverMat);
    clubHead.position.set(14, 40, -10);
    clubHead.rotation.x = -0.4;
    golfGroup.add(golfBall1, tee, clubShaft, clubHead);

    const curve = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(0, 10, 0),
      new THREE.Vector3(120, 160, -220),
      new THREE.Vector3(240, 20, -440)
    );
    const arcPoints = curve.getPoints(32);
    const arcGeom = new THREE.BufferGeometry().setFromPoints(arcPoints);
    const arcMesh = new THREE.Line(arcGeom, new THREE.LineDashedMaterial({ color: 0x00f0ff, dashSize: 12, gapSize: 8 }));
    arcMesh.computeLineDistances();
    golfGroup.add(arcMesh);

    const golfBall2 = new THREE.Mesh(new THREE.SphereGeometry(7, 14, 14), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.25 }));
    golfBall2.position.set(240, 20, -440);
    golfGroup.add(golfBall2);

    environmentGroup.add(golfGroup);


    const retroGroup = new THREE.Group();
    const retX = -600, retZ = -7800;
    const retY = getTerrainHeight(retX, retZ, 'moon');
    retroGroup.position.set(retX, retY, retZ);

    const retroStand = new THREE.Mesh(new THREE.ConeGeometry(18, 14, 4), silverMat);
    retroStand.position.y = 7;
    const retroPallet = new THREE.Mesh(
      new THREE.BoxGeometry(34, 4, 34),
      new THREE.MeshStandardMaterial({ color: 0x00f0ff, emissive: 0x006688, emissiveIntensity: 0.65, metalness: 0.95 })
    );
    retroPallet.position.y = 15;
    retroPallet.rotation.x = 0.42; 
    retroGroup.add(retroStand, retroPallet);

    const beamGeom = new THREE.CylinderGeometry(1.2, 5.0, 3600, 8);
    beamGeom.translate(0, 1800, 0);
    const beamMat = new THREE.MeshBasicMaterial({ color: 0x00ffaa, transparent: true, opacity: 0.45, depthWrite: false });
    const laserBeam = new THREE.Mesh(beamGeom, beamMat);
    laserBeam.position.set(0, 15, 0);
    laserBeam.rotation.x = 0.42;
    retroGroup.add(laserBeam);

    environmentGroup.add(retroGroup);


    const boosterGroup = new THREE.Group();
    const bstX = -3600, bstZ = -5800;
    boosterGroup.position.set(bstX, getTerrainHeight(bstX, bstZ, 'moon') + 12, bstZ);
    boosterGroup.rotation.set(0.45, -0.65, 0.28);

    const bBody = new THREE.Mesh(new THREE.CylinderGeometry(28, 28, 130, 16), new THREE.MeshStandardMaterial({ color: 0xe0e0e0, roughness: 0.55, metalness: 0.45 }));
    const bStripe = new THREE.Mesh(new THREE.CylinderGeometry(28.5, 28.5, 24, 16), blackFoilMat);
    bStripe.position.y = 25;
    const j2Engine = new THREE.Mesh(new THREE.CylinderGeometry(12, 24, 28, 14), darkBellMat);
    j2Engine.position.y = -75;

    [-24, 28, 42].forEach((dx, idx) => {
      const shrapnel = new THREE.Mesh(new THREE.DodecahedronGeometry(8 + idx * 3, 0), silverMat);
      shrapnel.position.set(dx, -30 + idx * 12, (idx - 1) * 26);
      boosterGroup.add(shrapnel);
    });
    boosterGroup.add(bBody, bStripe, j2Engine);
    environmentGroup.add(boosterGroup);

    const baseGroup = new THREE.Group();
    const bsX = 2400, bsZ = -7500;
    baseGroup.position.set(bsX, getTerrainHeight(bsX, bsZ, 'moon'), bsZ);

    const mainDome = new THREE.Mesh(
      new THREE.SphereGeometry(135, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.5),
      new THREE.MeshStandardMaterial({ color: 0x1b2432, emissive: 0x00f0ff, emissiveIntensity: 0.25, metalness: 0.85 })
    );
    const observationRing = new THREE.Mesh(new THREE.CylinderGeometry(136, 136, 12, 18), new THREE.MeshBasicMaterial({ color: 0x00f0ff }));
    observationRing.position.y = 45;
    baseGroup.add(mainDome, observationRing);

    [-180, 180].forEach(tx => {
      const tunnel = new THREE.Mesh(new THREE.CylinderGeometry(14, 14, 90, 8), silverMat);
      tunnel.rotation.z = Math.PI / 2;
      tunnel.position.set(tx * 0.55, 14, 0);
      const subDome = new THREE.Mesh(
        new THREE.SphereGeometry(65, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.5),
        new THREE.MeshStandardMaterial({ color: 0x222d3d, metalness: 0.8 })
      );
      subDome.position.set(tx, 0, 0);
      baseGroup.add(tunnel, subDome);
    });

    const commTower = new THREE.Mesh(new THREE.CylinderGeometry(4, 9, 210, 8), silverMat);
    commTower.position.set(190, 105, -60);
    const bigDish = new THREE.Mesh(new THREE.ConeGeometry(38, 14, 16, 1, true), silverMat);
    bigDish.position.set(190, 215, -60);
    bigDish.rotation.set(-0.75, 0.45, 0);
    baseGroup.add(commTower, bigDish);

    const padHex = new THREE.Mesh(new THREE.CylinderGeometry(85, 85, 4, 6), new THREE.MeshStandardMaterial({ color: 0x2c3340, roughness: 0.7 }));
    padHex.position.set(0, 2, 220);
    baseGroup.add(padHex);
    for (let lp = 0; lp < 6; lp++) {
      const lAng = (lp / 6) * Math.PI * 2;
      const bLight = new THREE.Mesh(new THREE.SphereGeometry(3, 8, 8), new THREE.MeshBasicMaterial({ color: 0x00f0ff }));
      bLight.position.set(Math.cos(lAng) * 82, 5, 220 + Math.sin(lAng) * 82);
      baseGroup.add(bLight);
    }

environmentGroup.add(baseGroup);


    const roadsterGroup = new THREE.Group();
    roadsterGroup.position.set(4600, 4800, -18000);
    roadsterGroup.scale.set(22, 22, 22);
    roadsterGroup.rotation.set(0.35, -0.75, 0.4);

    // Materials
    const roadsterRed = new THREE.MeshStandardMaterial({
      color: 0xa81424,
      emissive: 0x3d0006,
      emissiveIntensity: 0.35,
      roughness: 0.18,
      metalness: 0.88
    });
    const roadsterInterior = new THREE.MeshStandardMaterial({ color: 0x181818, roughness: 0.7 });
    const roadsterGlass = new THREE.MeshStandardMaterial({
      color: 0x334d66,
      roughness: 0.1,
      metalness: 0.9,
      transparent: true,
      opacity: 0.65
    });
    const roadsterTireMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.85 });
    const roadsterRimMat = new THREE.MeshStandardMaterial({ color: 0xd8d8d8, roughness: 0.25, metalness: 0.92 });
    const starmanSuitMat = new THREE.MeshStandardMaterial({ color: 0xf5f7fa, roughness: 0.35, metalness: 0.15 });
    const starmanVisorMat = new THREE.MeshStandardMaterial({
      color: 0x0a0a0f,
      roughness: 0.05,
      metalness: 0.98,
      emissive: 0xd4af37,
      emissiveIntensity: 0.35
    });

    const carBody = new THREE.Mesh(new THREE.BoxGeometry(22, 5, 48), roadsterRed);
    carBody.position.y = 7;
    roadsterGroup.add(carBody);

    const carHood = new THREE.Mesh(new THREE.BoxGeometry(20.5, 3.5, 18), roadsterRed);
    carHood.position.set(0, 8.5, 15);
    carHood.rotation.x = -0.08;
    roadsterGroup.add(carHood);

    const carRear = new THREE.Mesh(new THREE.BoxGeometry(20.5, 4.5, 14), roadsterRed);
    carRear.position.set(0, 9, -17);
    roadsterGroup.add(carRear);

    const cockpitTub = new THREE.Mesh(new THREE.BoxGeometry(18, 4, 16), roadsterInterior);
    cockpitTub.position.set(0, 8.5, 0);
    roadsterGroup.add(cockpitTub);

    [-4.5, 4.5].forEach(sx => {
      const carSeatBottom = new THREE.Mesh(new THREE.BoxGeometry(7, 2, 7), roadsterInterior);
      carSeatBottom.position.set(sx, 9.5, -0.5);
      const carSeatBack = new THREE.Mesh(new THREE.BoxGeometry(7, 9, 2), roadsterInterior);
      carSeatBack.position.set(sx, 13.5, -4.5);
      carSeatBack.rotation.x = -0.2;
      roadsterGroup.add(carSeatBottom, carSeatBack);
    });

    const roadsterWindshield = new THREE.Mesh(new THREE.BoxGeometry(19, 8, 0.8), roadsterGlass);
    roadsterWindshield.position.set(0, 13, 7.5);
    roadsterWindshield.rotation.x = -0.75;
    roadsterGroup.add(roadsterWindshield);

    const roadsterDash = new THREE.Mesh(new THREE.BoxGeometry(17, 3, 3), roadsterInterior);
    roadsterDash.position.set(0, 10.5, 6);
    const dontPanicCanvas = document.createElement('canvas');
    dontPanicCanvas.width = 128; dontPanicCanvas.height = 48;
    const dpCtx = dontPanicCanvas.getContext('2d');
    dpCtx.fillStyle = '#050505';
    dpCtx.fillRect(0, 0, 128, 48);
    dpCtx.fillStyle = '#00f0ff';
    dpCtx.font = 'bold 16px sans-serif';
    dpCtx.textAlign = 'center';
    dpCtx.fillText("DON'T PANIC!", 64, 30);
    const screenTex = new THREE.CanvasTexture(dontPanicCanvas);
    const screenMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(5, 2),
      new THREE.MeshBasicMaterial({ map: screenTex })
    );
    screenMesh.position.set(0, 11, 7.6);
    screenMesh.rotation.x = -0.3;
    roadsterGroup.add(roadsterDash, screenMesh);

    const wheelRing = new THREE.Mesh(new THREE.TorusGeometry(1.8, 0.35, 8, 16), roadsterInterior);
    wheelRing.position.set(-4.5, 12, 4.5);
    wheelRing.rotation.x = -0.7;
    roadsterGroup.add(wheelRing);

    [[-11.5, -13], [-11.5, 15], [11.5, -13], [11.5, 15]].forEach(([wx, wz]) => {
      const roadsterTire = new THREE.Mesh(new THREE.CylinderGeometry(5.5, 5.5, 3.5, 16), roadsterTireMat);
      roadsterTire.rotateZ(Math.PI / 2);
      roadsterTire.position.set(wx, 5.5, wz);
      const roadsterRim = new THREE.Mesh(new THREE.CylinderGeometry(3.6, 3.6, 3.6, 12), roadsterRimMat);
      roadsterRim.rotateZ(Math.PI / 2);
      roadsterRim.position.set(wx, 5.5, wz);
      roadsterGroup.add(roadsterTire, roadsterRim);
    });

    [-8, 8].forEach(lx => {
      const roadsterHeadLight = new THREE.Mesh(new THREE.BoxGeometry(3, 1.2, 0.8), new THREE.MeshBasicMaterial({ color: 0xffffff }));
      roadsterHeadLight.position.set(lx, 8, 24.1);
      roadsterGroup.add(roadsterHeadLight);
    });
    const tailLightBar = new THREE.Mesh(new THREE.BoxGeometry(19, 1.2, 0.8), new THREE.MeshBasicMaterial({ color: 0xff1122 }));
    tailLightBar.position.set(0, 8.5, -24.1);
    roadsterGroup.add(tailLightBar);

    const starmanGroup = new THREE.Group();
    starmanGroup.position.set(-4.5, 10, -0.5);

    const starmanTorso = new THREE.Mesh(new THREE.BoxGeometry(5.5, 7.5, 4.2), starmanSuitMat);
    starmanTorso.position.y = 4;
    starmanGroup.add(starmanTorso);

    const starmanHelmet = new THREE.Mesh(new THREE.SphereGeometry(3.2, 16, 16), starmanSuitMat);
    starmanHelmet.scale.set(1.0, 1.15, 1.05);
    starmanHelmet.position.set(0, 9.2, 0);
    const starmanVisor = new THREE.Mesh(new THREE.SphereGeometry(2.6, 14, 14, 0, Math.PI), starmanVisorMat);
    starmanVisor.position.set(0, 9.2, 1.2);
    starmanVisor.rotation.x = 0.1;
    starmanGroup.add(starmanHelmet, starmanVisor);

    const starmanRightArm = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.9, 6.5, 6), starmanSuitMat);
    starmanRightArm.position.set(2.2, 4.5, 2.5);
    starmanRightArm.rotation.set(0.8, 0, -0.35);
    starmanGroup.add(starmanRightArm);
    const starmanArmUpper = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.9, 4.5, 6), starmanSuitMat);
    starmanArmUpper.position.set(-3.2, 4.8, 0);
    starmanArmUpper.rotation.z = 0.5;
    const starmanForearm = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.8, 5.0, 6), starmanSuitMat);
    starmanForearm.position.set(-4.8, 5.8, 2.2);
    starmanForearm.rotation.set(1.4, 0, 0);
    starmanGroup.add(starmanArmUpper, starmanForearm);

    roadsterGroup.add(starmanGroup);

    const payloadAdapter = new THREE.Mesh(
      new THREE.CylinderGeometry(7, 12, 8, 16, 1, true),
      new THREE.MeshStandardMaterial({ color: 0xc4c7cc, metalness: 0.8, side: THREE.DoubleSide })
    );
    payloadAdapter.position.y = 1.5;
    roadsterGroup.add(payloadAdapter);

    environmentGroup.add(roadsterGroup);
  } else if (courseKey === 'glacial') {
    const arches = [
      { x: 0, z: -2400, span: 340, height: 210, rotY: 0.1 },
      { x: 900, z: -4300, span: 380, height: 230, rotY: -0.35 },
      { x: -300, z: -8000, span: 360, height: 220, rotY: 0.45 }
    ];
    arches.forEach(a => {
      const groundY = getTerrainHeight(a.x, a.z, 'glacial');
      environmentGroup.add(createGlacialIceArch(a.x, groundY, a.z, a.span, a.height, a.rotY));
    });

    const spikeColors = [0x7282e8, 0x8192f5, 0x6de4d6, 0x5cd8cb, 0x346b84, 0xcef5fc, 0xa6afff, 0x9ff3e9];

    const spawnCluster = (cx, cz, baseScale, count = 3, primaryCol = 0x7282e8, secondaryCol = 0x6de4d6) => {
      for (let c = 0; c < count; c++) {
        let sc, col, sx, sz, rX, rZ, rY, st;
        if (c === 0) {
          sc = baseScale * (0.95 + Math.random() * 0.15);
          col = primaryCol;
          sx = cx;
          sz = cz;
          rX = (Math.random() - 0.5) * 0.22;
          rZ = (Math.random() - 0.5) * 0.22;
          rY = Math.random() * Math.PI * 2;
          st = Math.random() > 0.5 ? 'chunky' : 'obelisk';
        } else if (c === 1) {
          sc = baseScale * (0.55 + Math.random() * 0.2);
          col = secondaryCol;
          const offsetDist = baseScale * (0.28 + Math.random() * 0.15);
          const angle = Math.random() * Math.PI * 2;
          sx = cx + Math.cos(angle) * offsetDist;
          sz = cz + Math.sin(angle) * offsetDist;
          rX = (Math.random() - 0.5) * 0.35;
          rZ = (Math.random() - 0.5) * 0.35;
          rY = Math.random() * Math.PI * 2;
          st = Math.random() > 0.5 ? 'slender' : 'chunky';
        } else {
          sc = baseScale * (0.28 + Math.random() * 0.18);
          col = spikeColors[Math.floor(Math.random() * spikeColors.length)];
          const offsetDist = baseScale * (0.35 + Math.random() * 0.2);
          const angle = Math.random() * Math.PI * 2;
          sx = cx + Math.cos(angle) * offsetDist;
          sz = cz + Math.sin(angle) * offsetDist;
          rX = (Math.random() - 0.5) * 0.45;
          rZ = (Math.random() - 0.5) * 0.45;
          rY = Math.random() * Math.PI * 2;
          st = 'chunky';
        }
        const gy = getTerrainHeight(sx, sz, 'glacial');
        environmentGroup.add(createDiamondIceSpike(sx, gy, sz, sc, col, rX, rZ, rY, st));
      }
    };

    const landmarkClusters = [
      { x: -220, z: -1550, scale: 220, count: 4, c1: 0x7282e8, c2: 0x6de4d6 },
      { x: 320,  z: -1750, scale: 190, count: 3, c1: 0x6de4d6, c2: 0x8192f5 },
      { x: -180, z: -2500, scale: 210, count: 4, c1: 0x7282e8, c2: 0x346b84 },
      { x: 420,  z: -3200, scale: 240, count: 5, c1: 0x8192f5, c2: 0x6de4d6 },
      { x: 980,  z: -4150, scale: 210, count: 3, c1: 0x6de4d6, c2: 0x7282e8 },
      { x: -380, z: -4650, scale: 250, count: 5, c1: 0x7282e8, c2: 0x346b84 },
      { x: 380,  z: -5400, scale: 200, count: 4, c1: 0xcef5fc, c2: 0x7282e8 },
      { x: -480, z: -6850, scale: 230, count: 4, c1: 0x6de4d6, c2: 0x8192f5 },
      { x: 320,  z: -7850, scale: 220, count: 4, c1: 0x7282e8, c2: 0x6de4d6 },
      { x: -280, z: -8750, scale: 260, count: 5, c1: 0x8192f5, c2: 0x346b84 },
    ];
    landmarkClusters.forEach(cl => spawnCluster(cl.x, cl.z, cl.scale, cl.count, cl.c1, cl.c2));

    const spikeCount = isHighGfx ? 65 : 18;
    for (let i = 0; i < spikeCount; i++) {
      let sx, sz, sy;
      let attempts = 0;
      do {
        sx = (Math.random() - 0.5) * 9500;
        sz = -Math.random() * 11000 - 300;
        sy = getTerrainHeight(sx, sz, 'glacial');
        attempts++;
      } while ((sy < 80 || sy > 750) && attempts < 25);

      const tooCloseWp = activeSubtrack.waypoints.some(wp => Math.hypot(sx - wp.x, sz - wp.z) < 160);
      if (tooCloseWp) continue;

      const baseScale = Math.random() > 0.65
        ? (170 + Math.random() * 80) 
        : (Math.random() > 0.35 ? (95 + Math.random() * 55) : (45 + Math.random() * 40)); 

      const col = spikeColors[Math.floor(Math.random() * spikeColors.length)];
      const rX = (Math.random() - 0.5) * 0.35;
      const rZ = (Math.random() - 0.5) * 0.35;
      const rY = Math.random() * Math.PI * 2;
      const st = Math.random() > 0.6 ? 'obelisk' : (Math.random() > 0.3 ? 'chunky' : 'slender');

      environmentGroup.add(createDiamondIceSpike(sx, sy, sz, baseScale, col, rX, rZ, rY, st));

      if (Math.random() > 0.55 && baseScale > 90) {
        const cCol = spikeColors[Math.floor(Math.random() * spikeColors.length)];
        const sc2 = baseScale * (0.35 + Math.random() * 0.3);
        const offX = sx + (Math.random() - 0.5) * baseScale * 0.6;
        const offZ = sz + (Math.random() - 0.5) * baseScale * 0.6;
        const gy2 = getTerrainHeight(offX, offZ, 'glacial');
        environmentGroup.add(createDiamondIceSpike(offX, gy2, offZ, sc2, cCol, rX * -1.2, rZ * -1.2, rY + 1.2, 'chunky'));
      }
    }

    const pineCount = isHighGfx ? 90 : 22;
    for (let i = 0; i < pineCount; i++) {
      let tx, tz, ty;
      let attempts = 0;
      let onLake = true;
      do {
        tx = (Math.random() - 0.5) * 8500;
        tz = -Math.random() * 10000 - 300;
        ty = getTerrainHeight(tx, tz, 'glacial');
        
        const fjordCenter = Math.sin(tz * 0.0004) * 1250;
        const distFromCenter = Math.abs(tx - fjordCenter);
        onLake = (distFromCenter < 950) || (ty < 100);

        attempts++;
      } while ((onLake || ty < 100 || ty > 540) && attempts < 35);

      const tooCloseWp = activeSubtrack.waypoints.some(wp => Math.hypot(tx - wp.x, tz - wp.z) < 220);
      const nearRunway = (tz > -250 && Math.abs(tx) < 320);
      if (onLake || tooCloseWp || nearRunway || ty < 100) continue;

      const scale = 12 + Math.random() * 8;
      environmentGroup.add(createSnowyPineTree(tx, ty, tz, scale));
    }
  }

  const rock = new THREE.Color(course.groundColor);
  const grass = new THREE.Color(course.grassColor);
  const snow = new THREE.Color(course.snowColor);
  const deepIce = new THREE.Color(0x27526b);

  const terrainMat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    flatShading: !isHighGfx,
    roughness: isHighGfx ? 0.82 : 0.95,
    metalness: isHighGfx ? 0.12 : 0.0
  });

  const quadSize = 16000;
  const quadSegs = isHighGfx ? 176 : 64;
  const quadOffsets = [
    { x: -8000, z: -10000 },
    { x:  8000, z: -10000 },
    { x: -8000, z:   2000 },
    { x:  8000, z:   2000 }
  ];

  const tempTerrainColor = new THREE.Color();

  if (courseKey !== 'islands') {
    quadOffsets.forEach(offset => {
      const geom = new THREE.PlaneGeometry(quadSize, quadSize, quadSegs, quadSegs);
      geom.rotateX(-Math.PI / 2);

      const pos = geom.attributes.position;
      const colors = [];

      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i) + offset.x;
        const z = pos.getZ(i) + offset.z;

        const h = getTerrainHeight(x, z, courseKey);
        pos.setY(i, h);

        const c = tempTerrainColor.copy(rock);

        if (isHighGfx) {
          const sd = 12.0;
          const hL = getTerrainHeight(x - sd, z, courseKey);
          const hR = getTerrainHeight(x + sd, z, courseKey);
          const hD = getTerrainHeight(x, z - sd, courseKey);
          const hU = getTerrainHeight(x, z + sd, courseKey);
          const slopeY = Math.min(1.0, (2.0 * sd) / Math.hypot(hL - hR, 2.0 * sd, hD - hU));

          if (courseKey === 'volcano') {
            const dVolc = Math.hypot(x, z + 5500);
            if (dVolc < 620) {
              c.setRGB(1.0, 0.22, 0.02);
            } else if (dVolc < 3600) {
              const coneT = (dVolc - 600) / 3000;
              c.setRGB(0.06, 0.04, 0.05);
              c.lerp(new THREE.Color(0x181014), coneT);
            } else {
              if (slopeY < 0.65) {
                c.multiplyScalar(0.75 + slopeY * 0.25);
              } else if (h > 460) {
                c.lerp(snow, Math.min((h - 460) / 250, 1.0));
              } else if (h < 220 && h > course.waterLevel + 1) {
                c.lerp(grass, 0.55 * ((slopeY - 0.65) / 0.35));
              }
            }
          } else if (courseKey === 'glacial') {
            if (slopeY < 0.60) {
              c.lerp(deepIce, 0.85); 
            } else if (h > 180) {
              const snowCling = Math.min(1.0, (slopeY - 0.5) / 0.5);
              c.lerp(snow, Math.min(1.0, (h - 180) / 160) * snowCling);
            } else {
              c.lerp(deepIce, 0.70);
            }
          } else if (courseKey === 'moon') {
            if (slopeY < 0.68) {
              c.multiplyScalar(0.72 + slopeY * 0.28);
            }
          } else {
            if (slopeY < 0.62) {
              const strata = Math.sin(h * 0.07) * 0.07;
              c.r = Math.max(0, Math.min(1, c.r + strata));
              c.g = Math.max(0, Math.min(1, c.g + strata * 0.5));
              c.multiplyScalar(0.75 + slopeY * 0.25);
            } else {
              if (h > 360 && slopeY > 0.55) {
                const snowCling = (slopeY - 0.55) / 0.45;
                c.lerp(snow, Math.min(1.0, (h - 360) / 220) * snowCling);
              } else if (h < 260 && h > course.waterLevel + 1) {
                const grassCling = (slopeY - 0.62) / 0.38;
                c.lerp(grass, Math.min(1.0, (260 - h) / 160) * grassCling * 0.85);
              }
            }
          }

          if (course.waterLevel > -500) {
            const distToWater = h - course.waterLevel;
            if (distToWater >= 0 && distToWater < 16) {
              const wet = 1.0 - (distToWater / 16);
              c.multiplyScalar(1.0 - wet * 0.38);
              if (courseKey === 'coastal') {
                c.lerp(new THREE.Color(0xdad3c1), wet * 0.65);
              }
            }
          }
        } else {
          // Low graphics mode: fast, classic elevation-based coloring
          if (courseKey === 'volcano') {
            const dVolc = Math.hypot(x, z + 5500);
            if (dVolc < 620) {
              c.setRGB(1.0, 0.22, 0.02);
            } else if (dVolc < 3600) {
              const coneT = (dVolc - 600) / 3000;
              c.setRGB(0.06, 0.04, 0.05);
              c.lerp(new THREE.Color(0x181014), coneT);
            } else {
              if (h > 460) {
                c.lerp(snow, Math.min((h - 460) / 250, 1.0));
              } else if (h < 180 && h > course.waterLevel + 1) {
                c.lerp(grass, 0.65);
              }
            }
          } else if (courseKey === 'glacial') {
            if (h > 180) {
              c.lerp(snow, Math.min(1.0, (h - 180) / 160));
            } else {
              c.lerp(deepIce, 0.75);
            }
          } else {
            if (h > 450) c.lerp(snow, Math.min((h - 450) / 250, 1.0));
            else if (h < 200) c.lerp(grass, 0.7);
          }
        }

        colors.push(c.r, c.g, c.b);
      }

      geom.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
      geom.computeVertexNormals();

      const terrainMesh = new THREE.Mesh(geom, terrainMat);
      terrainMesh.position.set(offset.x, 0, offset.z);
      environmentGroup.add(terrainMesh);
    });
  }

  const waterGeom = new THREE.PlaneGeometry(32000, 32000);
  waterGeom.rotateX(-Math.PI / 2);

  const isGlacial = (courseKey === 'glacial');
  const realWater = (course.waterLevel > -500);
  const waterMat = new THREE.MeshStandardMaterial({
    color: course.waterColor,
    roughness: (isHighGfx && realWater) ? 0.08 : (isGlacial ? 0.18 : 0.8),
    metalness: (isHighGfx && realWater) ? 0.18 : (isGlacial ? 0.35 : 0.1),
    transparent: !isGlacial,
    opacity: isGlacial ? 1.0 : 0.9,
    depthWrite: isGlacial ? true : false,
    polygonOffset: true,
    polygonOffsetFactor: 1.0,
    polygonOffsetUnits: 1.0
  });

if (graphicsQuality === 'high' && !isGlacial && realWater && waterRippleTexture) {
    waterMat.normalMap = waterRippleTexture;
    waterMat.normalScale = new THREE.Vector2(0.2, 0.2);
    const waterEnv = getWaterEnvMap(courseKey);
    if (waterEnv) {
      waterMat.envMap = waterEnv;
      //change ripple brigness /color or whatever
      waterMat.envMapIntensity = 0.5;
    }
  }

      if (isHighGfx && !isGlacial && course.waterLevel > -500) {
    const foamMask = getFoamMask(courseKey, course.waterLevel);
    waterMat.onBeforeCompile = (shader) => {
      shader.uniforms.foamMap = { value: foamMask };
      shader.uniforms.uFoamTime = waterFoamTime;
      shader.uniforms.uFoamStrength = { value: (courseKey === 'volcano') ? 1.0 : 0.3 };

      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec2 vFoamXZ;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvFoamXZ = (modelMatrix * vec4(position, 1.0)).xz;');

      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying vec2 vFoamXZ;\nuniform sampler2D foamMap;\nuniform float uFoamTime;\nuniform float uFoamStrength;')
        .replace('#include <color_fragment>', `#include <color_fragment>
          vec2 foamUv = (vFoamXZ + 16000.0) / 32000.0;
          float foamM = texture2D(foamMap, foamUv).r;
          float foamPulse = 0.5 + 0.5 * sin(uFoamTime * 1.7 + foamM * 18.0);
          float foamLace = 0.5 + 0.5 * sin(vFoamXZ.x * 0.05 + uFoamTime) * sin(vFoamXZ.y * 0.05 - uFoamTime * 0.8);
          float foamAmt = smoothstep(0.25, 0.95, foamM) * (0.30 + 0.70 * foamPulse) * mix(0.35, 1.0, foamLace);
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.95, 0.98, 1.0), foamAmt * uFoamStrength);
        `);
    };
    waterMat.customProgramCacheKey = () => 'waterFoamShore';
  }

  const water = new THREE.Mesh(waterGeom, waterMat);
  water.position.y = course.waterLevel;
  environmentGroup.add(water);


  if (courseKey === 'canyon') {
    const treeCount = isHighGfx ? 120 : 35;
    const treeScaleBase = 16;
    for (let i = 0; i < treeCount; i++) {
      let x, z, y;
      let attempts = 0;
      do {
        x = (Math.random() - 0.5) * 9000;
        z = -Math.random() * 8000 - 500;
        y = getTerrainHeight(x, z, courseKey);
        attempts++;
      } while ((y < course.waterLevel + 5 || y < 20 || y > 500) && attempts < 25);
      
      const tooClose = activeSubtrack.waypoints.some(wp => Math.hypot(x - wp.x, z - wp.z) < 220);
      if (tooClose || y < course.waterLevel + 5) continue;

      const scale = treeScaleBase * (0.7 + Math.random() * 0.6);
      const leafColor = new THREE.Color().setHSL(0.28, 0.6, 0.25 + Math.random() * 0.2);
      const tree = createTree(x, y, z, scale, 0x5d4037, leafColor);
      environmentGroup.add(tree);
    }
  } else if (courseKey === 'islands') {
    const treeX = 300;
    const treeZ = -5200;
    const h = getTerrainHeight(treeX, treeZ, courseKey);
    const groundY = h > -900 ? h : 450;
    const bigTree = createBigPinkTree(treeX, groundY, treeZ, 75);
    environmentGroup.add(bigTree);
  } else if (courseKey === 'coastal') {
    const treeCount = isHighGfx ? 90 : 28;
    const treeScaleBase = 16;
    for (let i = 0; i < treeCount; i++) {
      let x, z, y;
      let attempts = 0;
      do {
        x = (Math.random() - 0.5) * 10000;
        z = -Math.random() * 9500 - 500;
        y = getTerrainHeight(x, z, courseKey);
        attempts++;
      } while ((y < course.waterLevel + 8 || y < 30 || y > 600) && attempts < 25);

      const tooClose = activeSubtrack.waypoints.some(wp => Math.hypot(x - wp.x, z - wp.z) < 220);
      if (tooClose || y < course.waterLevel + 5) continue;

      const scale = treeScaleBase * (0.7 + Math.random() * 0.6);
      const leafColor = new THREE.Color().setHSL(0.28, 0.5, 0.2 + Math.random() * 0.25);
      const tree = createTree(x, y, z, scale, 0x4e342e, leafColor);
      environmentGroup.add(tree);
    }
  }

  activeSubtrack.waypoints.forEach((wp, idx) => {
    const hGround = getTerrainHeight(wp.x, wp.z, courseKey);
    const minSafeY = hGround + 110;
    if (wp.y < minSafeY) {
      wp.y = minSafeY;
    }

    const gateGroup = new THREE.Group();
    gateGroup.position.copy(wp);

    const nextWp = activeSubtrack.waypoints[(idx + 1) % activeSubtrack.waypoints.length];
    gateGroup.lookAt(nextWp);

const outerRing = new THREE.Mesh(
      new THREE.TorusGeometry(85, 4.5, 6, 16),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 })
    );
    const corePlane = new THREE.Mesh(
      new THREE.CircleGeometry(80, 20),
      new THREE.MeshBasicMaterial({
        color: 0x00f0ff,
        transparent: true,
        opacity: 0.2,
        side: THREE.DoubleSide,
        depthWrite: false
      })
    );

    const is16BitGlider = (getEquippedSkinId() === 'glider_16bit');
    const spriteGeom = new THREE.PlaneGeometry(180, 180);
    const gateSprite = new THREE.Mesh(spriteGeom, (idx === 1 ? waypointMaterials.blue : waypointMaterials.gray));
    gateSprite.name = 'gateSprite';
    gateSprite.visible = is16BitGlider;
    gateGroup.add(gateSprite);

    outerRing.visible = !is16BitGlider;
    corePlane.visible = !is16BitGlider;

    gateGroup.add(outerRing, corePlane);
    environmentGroup.add(gateGroup);
    gateMeshes.push({ group: gateGroup, ring: outerRing, core: corePlane, sprite: gateSprite, pos: wp, radius: 85 });
  });

  activeSubtrack.thermals.forEach(th => {
    const hGround = getTerrainHeight(th.pos.x, th.pos.z, courseKey);
    if (th.pos.y < hGround + 30) {
      th.pos.y = hGround + 30;
    }
    createThermalParticles(th);
  });

  if (activeSubtrack.sinks) {
    activeSubtrack.sinks.forEach(sink => {
      const hGround = getTerrainHeight(sink.pos.x, sink.pos.z, courseKey);
      if (sink.pos.y < hGround + 30) {
        sink.pos.y = hGround + 30;
      }
      createSinkParticles(sink);
    });
  }

setupTrackHazards(courseKey, activeSubtrack);

  if (CHRISTMAS_EVENT_ACTIVE && courseKey === 'glacial') {
    const pTex = createPixelTexture('present.png');
    const pGeom = new THREE.BoxGeometry(16, 16, 16);
    const pMat = new THREE.MeshStandardMaterial({
      map: pTex,
      roughness: 0.45,
      metalness: 0.1
    });

    if (selectedSubtrack === 'A' && localStorage.getItem('glider_xmas_present_A') !== 'true') {
      const mA = new THREE.Mesh(pGeom, pMat);
      mA.position.set(-280, 298, -8750);
      environmentGroup.add(mA);
      activePresents3D.push({ id: 'glider_xmas_present_A', mesh: mA, pos: new THREE.Vector3(-280, 298, -8750) });
    }
    if (selectedSubtrack === 'B' && localStorage.getItem('glider_xmas_present_B') !== 'true') {
      const mB = new THREE.Mesh(pGeom, pMat);
      const presentBPos = new THREE.Vector3(0, 250, -9600);
      mB.position.copy(presentBPos);
      environmentGroup.add(mB);
      activePresents3D.push({ id: 'glider_xmas_present_B', mesh: mB, pos: presentBPos });
    }
    if (selectedSubtrack === 'C' && localStorage.getItem('glider_xmas_present_C') !== 'true') {
      const mC = new THREE.Mesh(pGeom, pMat);
      mC.position.set(900, 475, -4300);
      environmentGroup.add(mC);
      activePresents3D.push({ id: 'glider_xmas_present_C', mesh: mC, pos: new THREE.Vector3(900, 475, -4300) });
    }
  }

  if (gameMode === 'race') {
    spawnAI(course, activeSubtrack);
  } else {
    loadGhostDrone();
  }
}

function loadGhostDrone() {
  const ghostKey = `ghost_${selectedCourseId}_${selectedSubtrack}`;
  let data = ghostCache[ghostKey] || null;
  if (!data) {
    try {
      const raw = localStorage.getItem(ghostKey);
      if (raw) data = JSON.parse(raw);
    } catch (e) {}
  }

  if (data && data.length > 2) {
    savedGhostData = data;
    createGhostDroneMesh();
  } else {
    savedGhostData = null;
    if (ghostDroneGroup) {
      environmentGroup.remove(ghostDroneGroup);
      ghostDroneGroup = null;
    }
  }
}

function spawnAI(course, activeSubtrack) {
  aiGliders = [];
  const speedMult = { easy: 0.92, medium: 1.12, hard: 1.30, impossible: 1.45 }[selectedDifficulty] || 1.12;
  const colors = [0xe74c3c, 0xf39c12, 0x9b59b6, 0x2ecc71];

  const cCliffPos = activeSubtrack.cliffPos || course.cliffPos;
  const cCliffForward = activeSubtrack.cliffForward || course.cliffForward;
  const cCliffRight = new THREE.Vector3(-cCliffForward.z, 0, cCliffForward.x).normalize();
  const runwayBasePos = _tempVec1.copy(cCliffPos).sub(_tempVec2.copy(cCliffForward).multiplyScalar(220));

  if (isHalloweenBossDuel) {
    const phantomMat = new THREE.MeshStandardMaterial({
      color: 0x050505,
      emissive: 0x000000,
      emissiveIntensity: 0.0,
      roughness: 0.25,
      metalness: 0.85
    });

    const aiGroup = new THREE.Group();
    const body = new THREE.Mesh(new THREE.ConeGeometry(5, 26, 4), phantomMat);
    body.rotateX(-Math.PI / 2);
    const wings = new THREE.Mesh(new THREE.BoxGeometry(44, 0.5, 7), phantomMat);
    wings.position.set(0, 0, 3);
    aiGroup.add(body, wings);

    const startPos = runwayBasePos.clone().add(cCliffRight.clone().multiplyScalar(24)).add(cCliffForward.clone().multiplyScalar(25));
    aiGroup.position.copy(startPos);
    environmentGroup.add(aiGroup);

    aiGliders.push({
      mesh: aiGroup,
      pos: startPos.clone(),
      vel: cCliffForward.clone().multiplyScalar(10),
      pitch: 0, roll: 0,
      yaw: Math.atan2(-cCliffForward.x, -cCliffForward.z),
      targetIdx: 1,
      baseSpeed: 108,
      currentSpeed: 70,
      isPhantomBoss: true,
      lap: 0, progress: 0,
      color: 0x050505,
      shadowMesh: null,
      aiDraftTimer: 0, bullyTimer: 0, bullyState: 'cooldown', bullyPhaseTimer: 0,
      dodgeOffset: 0, dodgeTarget: 0, dodgeTimer: 0,
      personality: {
        type: 'speedy',
        wobbleFreq: 1.8,
        cornerAggression: 0.98,
        apexOffset: new THREE.Vector3(0, 0, 0),
        thermalHunter: true
      }
    });
    return;
  }

  if (isKrampusBossDuel) {
    const aiGroup = new THREE.Group();
    buildKrampusDrone(aiGroup);

    const startPos = runwayBasePos.clone().add(cCliffRight.clone().multiplyScalar(24)).add(cCliffForward.clone().multiplyScalar(25));
    aiGroup.position.copy(startPos);
    environmentGroup.add(aiGroup);

    aiGliders.push({
      mesh: aiGroup,
      pos: startPos.clone(),
      vel: cCliffForward.clone().multiplyScalar(10),
      pitch: 0, roll: 0,
      yaw: Math.atan2(-cCliffForward.x, -cCliffForward.z),
      targetIdx: 1,
      baseSpeed: 108,
      currentSpeed: 70,
      isKrampusBoss: true,
      lap: 0, progress: 0,
      color: 0x0a0a0a,
      shadowMesh: null,
      aiDraftTimer: 0, bullyTimer: 0, bullyState: 'cooldown', bullyPhaseTimer: 0,
      dodgeOffset: 0, dodgeTarget: 0, dodgeTimer: 0,
      personality: {
        type: 'speedy',
        wobbleFreq: 1.8,
        cornerAggression: 0.98,
        apexOffset: new THREE.Vector3(0, 0, 0),
        thermalHunter: true
      }
    });
    return;
  }

  const sideOffsets = [-22, 22, 38, -38];
  const forwardOffsets = [15, 25, 35, 45].sort(() => Math.random() - 0.5);

  const PERSONALITY_TYPES = [
    'speedy',
    'bully',
    'drafter',
    'high_altitude_cruiser',
    'npc',
    'serpentine_dodger'
  ];

  for (let i = 0; i < 4; i++) {
    const aiGroup = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.ConeGeometry(5, 24, 4),
      new THREE.MeshStandardMaterial({ color: colors[i] })
    );
    body.rotateX(-Math.PI / 2);

    const wings = new THREE.Mesh(
      new THREE.BoxGeometry(42, 0.4, 6),
      new THREE.MeshStandardMaterial({ color: colors[i] })
    );
    wings.position.set(0, 0, 3);
    aiGroup.add(body, wings);

    const startPos = runwayBasePos.clone()
      .add(cCliffRight.clone().multiplyScalar(sideOffsets[i]))
      .add(cCliffForward.clone().multiplyScalar(forwardOffsets[i]));

    aiGroup.position.copy(startPos);
    environmentGroup.add(aiGroup);

    const aiShadow = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ map: blobShadowTexture, transparent: true, opacity: 0, depthWrite: false })
    );
    aiShadow.visible = (graphicsQuality === 'high');
    environmentGroup.add(aiShadow);

    let assignedPersonality = PERSONALITY_TYPES[Math.floor(Math.random() * PERSONALITY_TYPES.length)];
    const racePaceFactor = 0.96 + Math.random() * 0.12;
    let initialBaseSpeed = 78 * speedMult * racePaceFactor;
    let isImpossibleBot = false;

    if (selectedDifficulty === 'impossible' && i === 2) {
      isImpossibleBot = true;
      assignedPersonality = 'npc';
      initialBaseSpeed = 175;
    } else if (assignedPersonality === 'speedy') {
      initialBaseSpeed *= 1.10;
    }

    aiGliders.push({
      mesh: aiGroup,
      pos: startPos.clone(),
      vel: cCliffForward.clone().multiplyScalar(10),
      pitch: 0,
      roll: 0,
      yaw: Math.atan2(-cCliffForward.x, -cCliffForward.z),
      targetIdx: 1,
      baseSpeed: initialBaseSpeed,
      currentSpeed: isImpossibleBot ? 175 : 0,
      isImpossible: isImpossibleBot,
      lap: 0,
      progress: 0,
      color: colors[i],
      shadowMesh: aiShadow,
      aiDraftTimer: 0,
      bullyTimer: 0,
      bullyState: 'cooldown',
      bullyPhaseTimer: 0,
      dodgeOffset: 0,
      dodgeTarget: 0,
      dodgeTimer: 0,
      personality: {
        type: assignedPersonality,
        wobbleFreq: 1.0 + Math.random() * 1.2,
        cornerAggression: (isImpossibleBot || assignedPersonality === 'speedy') ? 0.98 : (0.75 + Math.random() * 0.20),
        apexOffset: (isImpossibleBot || assignedPersonality === 'speedy')
          ? new THREE.Vector3(0, 0, 0)
          : new THREE.Vector3((Math.random() - 0.5) * 40, (Math.random() - 0.5) * 20, (Math.random() - 0.5) * 40),
        // Most bots on Hard/Insane should hunt thermals when low
        thermalHunter: isImpossibleBot ? false : (selectedDifficulty === 'hard' ? Math.random() > 0.25 : Math.random() > 0.5)
      }
    });
  }
}

function getTrackProgress(pos, targetIdx, lap = 0) {
  const course = COURSES[selectedCourseId];
  if (!course) return 0;
  const activeSubtrack = course.subtracks[selectedSubtrack];
  if (!activeSubtrack || !activeSubtrack.waypoints || activeSubtrack.waypoints.length === 0) return 0;
  const wps = activeSubtrack.waypoints;

  if (!activeSubtrack.cumDist || activeSubtrack.cumDist.length !== wps.length) {
    activeSubtrack.cumDist = [0];
    for (let i = 0; i < wps.length - 1; i++) {
      activeSubtrack.cumDist.push(activeSubtrack.cumDist[i] + wps[i].distanceTo(wps[i + 1]));
    }
    const isClosed = wps[0].distanceTo(wps[wps.length - 1]) < 50;
    activeSubtrack.lapLength = activeSubtrack.cumDist[wps.length - 1] + (isClosed ? 0 : wps[wps.length - 1].distanceTo(wps[0]));
  }

  const safeIdx = Math.min(Math.max(targetIdx, 0), wps.length - 1);
  const distToTarget = pos.distanceTo(wps[safeIdx]);
  return (lap * activeSubtrack.lapLength) + activeSubtrack.cumDist[safeIdx] - distToTarget;
}

function updateAI(dt) {
  if (gameMode !== 'race') return;
  const course = COURSES[selectedCourseId];
  const activeSubtrack = course.subtracks[selectedSubtrack];
  const rainThermalBonus = 1.0 + weather.rainIntensity * 0.45;

  const diveCapByDifficulty = {
    easy: 130,
    medium: 155,
    hard: 185,
    impossible: 185
  };
  const currentDiveCap = diveCapByDifficulty[selectedDifficulty] || 155;

  const playerProgress = getTrackProgress(player.pos, player.nextGateIdx, 0);

  aiGliders.forEach((ai, idx) => {
    if (gameState === 'RUNUP') {
      const targetRunupSpeed = ai.isImpossible ? 175 : ai.baseSpeed;
      ai.currentSpeed = THREE.MathUtils.lerp(10, targetRunupSpeed, Math.min(runupProgress, 1.0));
      ai.pos.addScaledVector(cliffForwardDir, ai.currentSpeed * dt * 2.2);
      ai.mesh.position.copy(ai.pos);
      ai.mesh.rotation.y = ai.yaw;
      return;
    }

    if (gameState !== 'RACING') return;

    const currentWp = activeSubtrack.waypoints[ai.targetIdx];
    _targetWp.copy(currentWp).add(ai.personality.apexOffset);

    const toTrackWp = _tempVec2.subVectors(currentWp, ai.pos);
    const trackDist = toTrackWp.length();
    const trackDir = _trackDirVec.copy(toTrackWp).normalize();
    
    _toTarget.subVectors(_targetWp, ai.pos).normalize();

    if (ai.personality.type === 'high_altitude_cruiser') {
      if (trackDist > 650) {
        _targetWp.y += 120; 
      } else {
        _targetWp.y -= 25; 
      }
    }

    if (ai.personality.type === 'speedy') {
      _targetWp.y = Math.min(_targetWp.y, currentWp.y - 25);
    }

    const distToPlayer = ai.pos.distanceTo(player.pos);

    if (ai.personality.type === 'bully') {
      const toAi = _tempVec1.subVectors(ai.pos, player.pos);
      const aiLead = toAi.dot(_playerForward); 

      if (ai.bullyState === 'cooldown') {
        ai.bullyTimer += dt;

        if (ai.progress < playerProgress) {
          const stalkSpeed = Math.min(Math.max(player.speed + 7.0, ai.baseSpeed + 12.0), currentDiveCap);
          ai.currentSpeed = THREE.MathUtils.lerp(ai.currentSpeed, stalkSpeed, 2.5 * dt);
        } else {
          const isDiving = _toTarget.y < -0.04;
          if (isDiving) {
            const diveSteepness = Math.min(1.0, (-_toTarget.y - 0.04) / 0.35);
            const targetDiveSpeed = THREE.MathUtils.lerp(ai.baseSpeed, currentDiveCap, diveSteepness);
            ai.currentSpeed = THREE.MathUtils.lerp(ai.currentSpeed, targetDiveSpeed, 3.0 * dt);
          } else {
            ai.currentSpeed = THREE.MathUtils.lerp(ai.currentSpeed, ai.baseSpeed, 0.75 * dt);
          }
        }

        if (ai.bullyTimer >= 3.5 && distToPlayer < 480) {
          ai.bullyState = 'in_face';
          ai.bullyPhaseTimer = 0;
        }
      } else if (ai.bullyState === 'in_face') {
        ai.bullyPhaseTimer += dt;

        if (aiLead < -25) {
          _targetWp.lerp(player.pos, 0.35);
          const closeSpeed = Math.min(player.speed + 6.0, currentDiveCap);
          ai.currentSpeed = THREE.MathUtils.lerp(ai.currentSpeed, closeSpeed, 3.0 * dt);
        } else {
          const crowdTarget = _tempVec2.copy(player.pos).addScaledVector(_playerForward, 40);
          _targetWp.lerp(crowdTarget, 0.40);

          const harassSpeed = Math.max(player.speed + 1.2, ai.baseSpeed);
          ai.currentSpeed = THREE.MathUtils.lerp(ai.currentSpeed, harassSpeed, 3.5 * dt);
        }

        if (ai.bullyPhaseTimer >= 2.8) {
          ai.bullyState = 'backing_off';
          ai.bullyPhaseTimer = 0;
        }
      } else if (ai.bullyState === 'backing_off') {
        ai.bullyPhaseTimer += dt;
        const relaxSpeed = Math.max(player.speed - 3.5, ai.baseSpeed);
        ai.currentSpeed = THREE.MathUtils.lerp(ai.currentSpeed, relaxSpeed, 2.0 * dt);

        if (ai.bullyPhaseTimer >= 2.2) {
          ai.bullyState = 'cooldown';
          ai.bullyTimer = 0;
        }
      }
    }

    let draftTarget = null;
    let closestAheadDist = 450;

    if (ai.progress < playerProgress && distToPlayer < closestAheadDist) {
      draftTarget = { pos: player.pos, speed: player.speed, dist: distToPlayer };
      closestAheadDist = distToPlayer;
    }

    aiGliders.forEach((otherAi, oIdx) => {
      if (oIdx === idx) return;
      const dToOther = ai.pos.distanceTo(otherAi.pos);
      const maxDraftSpeed = ai.baseSpeed + 8.0;
      if (dToOther < 160 && otherAi.progress > ai.progress && ai.currentSpeed < maxDraftSpeed) {
        ai.currentSpeed = Math.min(ai.currentSpeed + 14 * dt, maxDraftSpeed);
      }
      if (gameState === 'RACING' && dToOther < 20.0 && Math.abs(ai.pos.y - otherAi.pos.y) < 14.0) {
        const sepX = ai.pos.x - otherAi.pos.x;
        const sepZ = ai.pos.z - otherAi.pos.z;
        const sDist = Math.hypot(sepX, sepZ) || 1.0;
        ai.pos.x += (sepX / sDist) * 16.0 * dt;
        ai.pos.z += (sepZ / sDist) * 16.0 * dt;
        ai.currentSpeed = Math.max(35, ai.currentSpeed - 8.0 * dt);
      }
    });

    if (ai.personality.type === 'drafter' && draftTarget) {
      _targetWp.lerp(draftTarget.pos, 0.40);
    }

    if (ai.pos.y < currentWp.y + 30) {
      let bestThermal = null;
      let bestDist = Infinity;

      activeSubtrack.thermals.forEach(th => {
        const toThX = th.pos.x - ai.pos.x;
        const toThZ = th.pos.z - ai.pos.z;
        const distTh = Math.hypot(toThX, toThZ);

        // Thermal must be reasonably close and AHEAD along the track direction
        if (distTh > 100 && distTh < 1900) {
          const dotForward = (toThX * trackDir.x + toThZ * trackDir.z) / distTh;
          if (dotForward > 0.35 && distTh < bestDist) {
            bestDist = distTh;
            bestThermal = th;
          }
        }
      });

      if (bestThermal) {
        const blend = 0.42 * (1.0 - bestDist / 1900);
        _targetWp.x = _targetWp.x * (1.0 - blend) + bestThermal.pos.x * blend;
        _targetWp.z = _targetWp.z * (1.0 - blend) + bestThermal.pos.z * blend;
        _targetWp.y = Math.max(_targetWp.y, bestThermal.pos.y + 140);
      }
    }

    const realWp = activeSubtrack.waypoints[ai.targetIdx];
    const dist3D = ai.pos.distanceTo(realWp);
    const distH = Math.hypot(ai.pos.x - realWp.x, ai.pos.z - realWp.z);
    const vertDiff = Math.abs(ai.pos.y - realWp.y);

    if (dist3D < 160 || (distH < 95 && vertDiff < 290)) {
      ai.targetIdx = (ai.targetIdx + 1) % activeSubtrack.waypoints.length;
      if (ai.targetIdx === 0) ai.lap++;
    }

    _toTarget.normalize();

    if (ai.personality.type === 'serpentine_dodger') {
      const distBehind = -_tempVec1.subVectors(player.pos, ai.pos).dot(_playerForward);
      const playerIsDrafting = (ai.progress > playerProgress && distBehind > 25 && distBehind < 320 && distToPlayer < 350);

      ai.dodgeTimer += dt;
      if (playerIsDrafting && ai.dodgeTimer > 2.0) {
        ai.dodgeTimer = 0;
        ai.dodgeTarget = (ai.dodgeTarget > 0 ? -1 : 1) * 60.0;
      } else if (!playerIsDrafting && ai.dodgeTimer > 3.0) {
        ai.dodgeTarget = 0;
      }

      ai.dodgeOffset = THREE.MathUtils.lerp(ai.dodgeOffset, ai.dodgeTarget, 2.5 * dt);
      const perpX = -_toTarget.z;
      const perpZ = _toTarget.x;
      _toTarget.x += perpX * (ai.dodgeOffset * 0.012);
      _toTarget.z += perpZ * (ai.dodgeOffset * 0.012);
      _toTarget.normalize();
    }

    // Hazards: Lateral Shoves & Bird Flocks
    lateralShoveSystems.forEach(sys => {
      if (sys.phase === 'on') {
        const shove = sys.shove;
        const dx = ai.pos.x - shove.pos.x;
        const dy = ai.pos.y - shove.pos.y;
        const dz = ai.pos.z - shove.pos.z;
        const proj = dx * shove.axisX + dz * shove.axisZ;
        if (Math.abs(proj) <= shove.length * 0.5) {
          const perpX = dx - proj * shove.axisX;
          const perpY = dy;
          const perpZ = dz - proj * shove.axisZ;
          if (Math.hypot(perpX, perpY, perpZ) < shove.radius) {
            ai.pos.y -= shove.force * 0.7 * dt;
            ai.pitch += 0.15 * dt;
          }
        }
      }
    });

    activeBirdFlocks.forEach(flock => {
      flock.subClusters.forEach(cluster => {
        const cPos = cluster.worldPos;
        const distToBird = ai.pos.distanceTo(cPos);
        if (distToBird < 380) {
          const yDiff = ai.pos.y - cPos.y;
          if (Math.abs(yDiff) < 65) {
            if (yDiff < 0) _toTarget.y -= 0.65;
            else _toTarget.y += 0.65;
            const awayX = ai.pos.x - cPos.x;
            const awayZ = ai.pos.z - cPos.z;
            const distH = Math.hypot(awayX, awayZ) || 1;
            _toTarget.x += (awayX / distH) * 0.75;
            _toTarget.z += (awayZ / distH) * 0.75;
            _toTarget.normalize();
          }
        }
        if (distToBird < cluster.radius + 6.0) {
          ai.currentSpeed = Math.max(30, ai.currentSpeed - 42 * dt);
          ai.roll += (Math.random() - 0.5) * 0.6;
          ai.pitch += 0.2 * dt;
        }
      });
    });

    activeSubtrack.thermals.forEach(th => {
      const dist2D = Math.hypot(ai.pos.x - th.pos.x, ai.pos.z - th.pos.z);
      if (dist2D < th.radius && ai.pos.y > th.pos.y - 60 && ai.pos.y < th.pos.y + 850) {
        ai.pos.y += th.boost * rainThermalBonus * dt;
        // Scale thermal exit speed reasonably off baseSpeed
        const thermalBoostSpeed = ai.baseSpeed + 12;
        ai.currentSpeed = Math.max(ai.currentSpeed, thermalBoostSpeed);
      }
    });

    // Surges
    ai.surgeTimer = (ai.surgeTimer || 0) + dt;
    if (ai.surgeTimer > 7.0 + idx * 2.0) {
      ai.surgeTimer = 0;
      ai.currentSpeed = Math.min(ai.currentSpeed + 10, ai.baseSpeed + 15);
    }

    if (ai.personality.type === 'drafter') {
      const inSlipstream = draftTarget && draftTarget.dist < 240;
      if (inSlipstream) {
        ai.aiDraftTimer += dt;
        if (ai.aiDraftTimer >= 1.8) {
          const targetDraftSpeed = Math.min(draftTarget.speed + 12, currentDiveCap);
          ai.currentSpeed = THREE.MathUtils.lerp(ai.currentSpeed, targetDraftSpeed, 2.5 * dt);
        }
      } else {
        ai.aiDraftTimer = Math.max(0, ai.aiDraftTimer - dt * 1.5);
      }
    }
    if (ai.isImpossible) {
      ai.currentSpeed = 175;
    } else if (ai.personality.type !== 'bully') {
      const isDiving = _toTarget.y < -0.04;

      if (isDiving) {
        const diveSteepness = Math.min(1.0, (-_toTarget.y - 0.04) / 0.35);
        const targetDiveSpeed = THREE.MathUtils.lerp(ai.baseSpeed, currentDiveCap, diveSteepness);
        ai.currentSpeed = THREE.MathUtils.lerp(ai.currentSpeed, targetDiveSpeed, 3.0 * dt);
        if (ai.currentSpeed > currentDiveCap) ai.currentSpeed = currentDiveCap;
      } else {
        if (ai.currentSpeed > ai.baseSpeed) {
          ai.currentSpeed = THREE.MathUtils.lerp(ai.currentSpeed, ai.baseSpeed, 0.75 * dt);
        }
        if (_toTarget.y > 0.10) {
          ai.currentSpeed -= _toTarget.y * 12.0 * dt;
          ai.currentSpeed = Math.max(ai.currentSpeed, ai.baseSpeed * 0.75);
        }
      }
    }

    if (selectedDifficulty === 'hard' && (playerProgress - ai.progress > 750)) {
      ai.currentSpeed = Math.max(ai.currentSpeed, ai.baseSpeed + 15);
    }

    // Physics Integration
    _tempVec1.copy(_toTarget).multiplyScalar(ai.currentSpeed);
    ai.vel.lerp(_tempVec1, 3.2 * dt * ai.personality.cornerAggression);
    ai.pos.addScaledVector(ai.vel, dt * 2.2);
    ai.pos.addScaledVector(weather.windVector, dt * 0.95);

    const desiredYaw = Math.atan2(-ai.vel.x, -ai.vel.z);
    let yawDelta = desiredYaw - ai.yaw;
    while (yawDelta > Math.PI) yawDelta -= Math.PI * 2;
    while (yawDelta < -Math.PI) yawDelta += Math.PI * 2;
    yawDelta = THREE.MathUtils.clamp(yawDelta, -0.25, 0.25);

    ai.roll = THREE.MathUtils.lerp(ai.roll, -yawDelta * 7.0, 6.0 * dt);
    ai.pitch = THREE.MathUtils.lerp(ai.pitch, ai.vel.y * 0.025, 5.0 * dt);
    ai.yaw += yawDelta * 4.5 * dt;

    ai.mesh.position.copy(ai.pos);
    ai.mesh.rotation.set(0, 0, 0);
    ai.mesh.rotation.order = 'YXZ';
    ai.mesh.rotation.y = ai.yaw;
    ai.mesh.rotation.x = ai.pitch;
    ai.mesh.rotation.z = ai.roll;

    if (ai.shadowMesh) {
      updateShadowMesh(ai.shadowMesh, ai.pos.x, ai.pos.y, ai.pos.z, ai.yaw, selectedCourseId);
    }

    ai.progress = getTrackProgress(ai.pos, ai.targetIdx, ai.lap);
  });

  let r = 1;
  aiGliders.forEach(ai => { if (ai.progress > playerProgress) r++; });
  player.rank = r;
}

function updateGhostDrone() {
  if (!ghostDroneGroup || !savedGhostData || savedGhostData.length < 2) return;

  const curTime = raceElapsedTime;
  while (ghostFrameIdx < savedGhostData.length - 2 && savedGhostData[ghostFrameIdx + 1].t < curTime) {
    ghostFrameIdx++;
  }

  const fA = savedGhostData[ghostFrameIdx];
  const fB = savedGhostData[ghostFrameIdx + 1];

  if (!fB) {
    ghostDroneGroup.position.set(fA.x, fA.y, fA.z);
    ghostDroneGroup.rotation.set(0, 0, 0);
    ghostDroneGroup.rotation.order = 'YXZ';
    ghostDroneGroup.rotation.y = fA.yaw;
    ghostDroneGroup.rotation.x = fA.pitch;
    ghostDroneGroup.rotation.z = fA.roll;
    update2DDroneMesh(ghostDroneGroup, camera);
    return;
  }

  const span = fB.t - fA.t;
  const factor = span > 0.0001 ? THREE.MathUtils.clamp((curTime - fA.t) / span, 0, 1) : 0;

  ghostDroneGroup.position.set(
    THREE.MathUtils.lerp(fA.x, fB.x, factor),
    THREE.MathUtils.lerp(fA.y, fB.y, factor),
    THREE.MathUtils.lerp(fA.z, fB.z, factor)
  );

  let dYaw = fB.yaw - fA.yaw;
  while (dYaw > Math.PI) dYaw -= Math.PI * 2;
  while (dYaw < -Math.PI) dYaw += Math.PI * 2;

  ghostDroneGroup.rotation.set(0, 0, 0);
  ghostDroneGroup.rotation.order = 'YXZ';
  ghostDroneGroup.rotation.y = fA.yaw + dYaw * factor;
  ghostDroneGroup.rotation.x = THREE.MathUtils.lerp(fA.pitch, fB.pitch, factor);
  ghostDroneGroup.rotation.z = THREE.MathUtils.lerp(fA.roll, fB.roll, factor);
update2DDroneMesh(ghostDroneGroup, camera);
}

function updateFlight(dt) {
  if (gameState !== 'RACING' && gameState !== 'FINISHING') return;

  if (devTimeFrozen) {
    if (devFreeCam) {
      updateFreeCam(dt);
    } else {
      updateCameraView(0, 0);
    }
    drawHudCanvas();
    return;
  }

  if (devFreeCam) {
    updateFreeCam(dt);
  }

  if (gameState === 'FINISHING') {
    finishSequenceTimer -= dt;

    updateWeather(dt);
    updateBirdFlocks(dt);
    updateThermalParticles(dt);
    updateVolcanoEruption(dt);
    if (volcanoEvent.exploded) updateMassiveVolcanoExplosion(dt);
    if (lunarMeteorEvent.active) updateLunarMeteorShower(dt);

    const activeSubtrack = COURSES[selectedCourseId].subtracks[selectedSubtrack];
    const targetWp = activeSubtrack.waypoints[player.nextGateIdx % activeSubtrack.waypoints.length];
    const toTarget = _tempVec1.subVectors(targetWp, player.pos);
    if (toTarget.length() < 220) {
      player.nextGateIdx = (player.nextGateIdx + 1) % activeSubtrack.waypoints.length;
    }
    toTarget.normalize();

    const desiredYaw = Math.atan2(-toTarget.x, -toTarget.z);
    let yawDelta = desiredYaw - player.yaw;
    while (yawDelta > Math.PI) yawDelta -= Math.PI * 2;
    while (yawDelta < -Math.PI) yawDelta += Math.PI * 2;
    player.yaw += THREE.MathUtils.clamp(yawDelta, -1.8, 1.8) * 3.5 * dt;

    player.pitch = THREE.MathUtils.lerp(player.pitch, THREE.MathUtils.clamp(toTarget.y * 0.5, -0.2, 0.2), 3.0 * dt);
    player.roll = THREE.MathUtils.lerp(player.roll, -yawDelta * 3.0, 4.0 * dt);
    player.speed = THREE.MathUtils.lerp(player.speed, 65, 2.0 * dt);
    player.flightPathPitch = THREE.MathUtils.lerp(player.flightPathPitch, player.pitch, 3.5 * dt);

    const cosG = Math.cos(player.flightPathPitch);
    player.pos.x += -Math.sin(player.yaw) * cosG * player.speed * dt * 2.2;
    player.pos.z += -Math.cos(player.yaw) * cosG * player.speed * dt * 2.2;
    player.pos.y += Math.sin(player.flightPathPitch) * player.speed * dt * 2.2;

    updateCameraView(0, 0);
    updateShadowMesh(playerShadowMesh, player.pos.x, player.pos.y, player.pos.z, player.yaw, selectedCourseId);
    audio.updateWind(player.speed, false, weather.rainIntensity);

    if (gameMode === 'race') {
      updateAI(dt);
    } else if (gameMode === 'timetrial') {
      updateGhostDrone();
    }

    updateHUD();
    drawMinimap();

    if (finishSequenceTimer <= 0) {
      const banner = document.getElementById('race-finish-banner');
      if (banner) banner.style.display = 'none';
      raceElapsedTime = finishSavedTime;
      player.rank = finishSavedRank;
      finishRace();
    }
    return;
  }

  raceElapsedTime = (performance.now() - raceStartTime) / 1000;

  let shoveVelocityOffset = 0; 

  updateLateralShoves(dt);
  updateBirdFlocks(dt);
  updateWeather(dt);
  updateThermalParticles(dt);
  updateVolcanoEruption(dt);

// RIP caves :)

  if (selectedCourseId === 'volcano' && selectedSubtrack === 'C') {
    if (!volcanoEvent.warningActive && !volcanoEvent.exploded) {
      const distToTh1 = Math.hypot(player.pos.x - 400, player.pos.z - (-1000));
      if (distToTh1 < 480 || player.nextGateIdx >= 2) {
        volcanoEvent.warningActive = true;
        const warnEl = document.getElementById('volcano-event-warning');
        if (warnEl) warnEl.style.display = 'block';
      }
    }

if (volcanoEvent.warningActive && !volcanoEvent.exploded) {
      const distToTh2 = Math.hypot(player.pos.x - (-1800), player.pos.z - (-5200));
      if (distToTh2 < 520 || (player.pos.x > -2100 && player.pos.z < -4900 && player.nextGateIdx >= 5)) {
        volcanoEvent.warningActive = false;
        volcanoEvent.exploded = true;
        const warnEl = document.getElementById('volcano-event-warning');
        if (warnEl) warnEl.style.display = 'none';
        triggerMassiveVolcanoExplosion();
      }
    }

    if (volcanoEvent.exploded) {
      updateMassiveVolcanoExplosion(dt);
    }
  }

if (selectedCourseId === 'moon' && selectedSubtrack === 'C') {
    if (!lunarMeteorEvent.triggered) {
      if (player.nextGateIdx >= 10 || (player.pos.x <= 3500 && player.pos.x >= -1200 && Math.abs(player.pos.z - (-5600)) < 900)) {
        triggerLunarMeteorShower();
      }
    }

    if (lunarMeteorEvent.active) {
      updateLunarMeteorShower(dt);
    }
  }

  if (gameMode === 'timetrial') {
    if (currentGhostRun.length === 0 || raceElapsedTime - currentGhostRun[currentGhostRun.length - 1].t >= 0.15) {
      currentGhostRun.push({
        t: parseFloat(raceElapsedTime.toFixed(3)),
        x: parseFloat(player.pos.x.toFixed(1)),
        y: parseFloat(player.pos.y.toFixed(1)),
        z: parseFloat(player.pos.z.toFixed(1)),
        pitch: parseFloat(player.pitch.toFixed(3)),
        yaw: parseFloat(player.yaw.toFixed(3)),
        roll: parseFloat(player.roll.toFixed(3))
      });
    }
    updateGhostDrone();
  }

  if (impossibleDifficultyUnlocked && keys['KeyT']) {
    devWarpTimer += dt;
    playerDraftTimer = 3.5;
    camera.fov = THREE.MathUtils.lerp(camera.fov, 125, 6.0 * dt);
    camera.updateProjectionMatrix();
    screenShake = Math.max(screenShake, 1.3);

    if (devWarpTimer >= 0.75) {
      devWarpTimer = 0;
      keys['KeyT'] = false;
      warpToNextTrack();
      return;
    }
  } else {
    devWarpTimer = 0;
  }

  handleGamepad();
  updateGyroSteering();

  let pitchInput = 0;
  let rollInput = 0;
  let yawInput = 0;
  let hasPitchInput = false;
  let hasRollInput = false;



  if (gamepadConnected) {
    if (Math.abs(gpPitch) > 0.05) {
      pitchInput += gpPitch * 0.9;
      hasPitchInput = true;
    }
    if (Math.abs(gpRoll) > 0.05) {
      rollInput += gpRoll * 0.9;
      hasRollInput = true;
    }
    if (Math.abs(gpYaw) > 0.05) {
      yawInput += gpYaw * 0.6;
    }
    if (gpAirbrake) player.airbrake = true;
    else if (!gpAirbrake && !keys['Space']) player.airbrake = false;
  }

  if (controlScheme === 'wasd') {
    if (isActionPressed('pitchDown')) pitchInput -= 1.0;
    if (isActionPressed('pitchUp')) pitchInput += 1.0;
    if (isActionPressed('rollRight')) rollInput -= 1.0;
    if (isActionPressed('rollLeft')) rollInput += 1.0;
    if (isActionPressed('yawLeft')) yawInput -= 1.0;
    if (isActionPressed('yawRight')) yawInput += 1.0;
  } else if (controlScheme === 'mouse') {
    if (Math.abs(mouseY) > 0.03 && (!gamepadConnected || Math.abs(gpPitch) <= 0.05)) {
      pitchInput = THREE.MathUtils.clamp(mouseY * 0.9, -0.9, 0.9);
      hasPitchInput = true;
    }
    if (Math.abs(mouseX) > 0.03 && (!gamepadConnected || Math.abs(gpRoll) <= 0.05)) {
      rollInput = THREE.MathUtils.clamp(mouseX * 0.85, -0.85, 0.85);
      hasRollInput = true;
    }
    if (mouseLeftPressed || isActionPressed('yawLeft')) yawInput -= 1.0;
    if (mouseRightPressed || isActionPressed('yawRight')) yawInput += 1.0;
  }

  if (mobilePitchInput !== 0) {
    pitchInput += mobilePitchInput;
    hasPitchInput = true;
  }
  if (mobileRollInput !== 0) {
    rollInput += mobileRollInput;
    hasRollInput = true;
  }
  if (mobileYawLeft) yawInput -= 1.0;
  if (mobileYawRight) yawInput += 1.0;
  if (mobileAirbrake) player.airbrake = true;

  if (Math.abs(pitchInput) > 0.001) hasPitchInput = true;
  if (Math.abs(rollInput) > 0.001) hasRollInput = true;

  if (invertControls) {
    pitchInput = -pitchInput;
    rollInput = -rollInput;
    yawInput = -yawInput;
  }

  if (rudderBoost.cooldownTimer > 0) {
    rudderBoost.cooldownTimer -= dt;
  }
  if (!rudderBoost.rearmed) {
    if (Math.abs(player.pitch - rudderBoost.releasePitch) >= 0.15) {
      rudderBoost.rearmed = true;
    }
  }

const currentYawDir = yawInput > 0.25 ? 1 : (yawInput < -0.25 ? -1 : 0);

  if (currentYawDir !== 0) {
    if (!rudderBoost.charging) {
      if (rudderBoost.cooldownTimer <= 0 && rudderBoost.rearmed) {
        rudderBoost.charging = true;
        rudderBoost.chargeTimer = 0;
        rudderBoost.activeDir = currentYawDir;
      }
    } else if (rudderBoost.activeDir !== currentYawDir) {
        if (rudderBoost.chargeTimer >= 0.4 && rudderBoost.cooldownTimer <= 0 && rudderBoost.rearmed) {
        const effectiveCharge = Math.min(rudderBoost.chargeTimer, 1.2);
        const boost = 18 + ((effectiveCharge - 0.4) / 0.8) * 10;
        player.speed = Math.min(player.speed + boost, 185);
        audio.playRecoveryBoost();
        screenShake = Math.max(screenShake, 0.4);
        rudderBoost.cooldownTimer = 2.5;
        rudderBoost.rearmed = false;
        rudderBoost.releasePitch = player.pitch;
      }
      rudderBoost.charging = true;
      rudderBoost.chargeTimer = 0;
      rudderBoost.activeDir = currentYawDir;
    } else {
      rudderBoost.chargeTimer += dt;
    }
  } else {
    if (rudderBoost.charging) {
      if (rudderBoost.chargeTimer >= 0.4) {
        const effectiveCharge = Math.min(rudderBoost.chargeTimer, 1.2);
        const boost = 18 + ((effectiveCharge - 0.4) / 0.8) * 10;
        player.speed = Math.min(player.speed + boost, 185);
        audio.playRecoveryBoost();
        screenShake = Math.max(screenShake, 0.4);
        rudderBoost.cooldownTimer = 2.5;
        rudderBoost.rearmed = false;
        rudderBoost.releasePitch = player.pitch;
      }
      rudderBoost.charging = false;
      rudderBoost.chargeTimer = 0;
      rudderBoost.activeDir = 0;
    }
  }

  const maxPitch = 0.65; 

  if (hasPitchInput) {
    player.targetPitch = THREE.MathUtils.lerp(player.targetPitch, pitchInput * maxPitch, 7.5 * dt);
  } else {
    player.targetPitch = THREE.MathUtils.lerp(player.targetPitch, 0.0, 3.5 * dt);
  }

  if (hasRollInput) {
    player.targetRoll = THREE.MathUtils.lerp(player.targetRoll, rollInput * 0.85, 8.0 * dt);
  } else {
    player.targetRoll = THREE.MathUtils.lerp(player.targetRoll, 0.0, 3.8 * dt);
  }

  player.pitch = THREE.MathUtils.lerp(player.pitch, player.targetPitch, 7.0 * dt);
  player.roll = THREE.MathUtils.lerp(player.roll, player.targetRoll, 8.0 * dt);

  if (yawInput !== 0) {
    const cap = 0.32;
    const resistance = Math.max(0.15, 1.0 - Math.abs(player.rudderDeflection) / cap);
    player.rudderDeflection += yawInput * (3.8 * resistance) * dt;
    player.rudderDeflection = THREE.MathUtils.clamp(player.rudderDeflection, -cap, cap);
  } else {
    player.rudderDeflection -= player.rudderDeflection * 0.20 * 32.0 * dt;
  }

  const bankYawRate = -player.roll * 1.35;
  player.yaw += (bankYawRate + player.rudderDeflection * 1.5) * dt;

  const alphaRad = player.pitch - player.flightPathPitch;
  const alphaDeg = alphaRad * (180 / Math.PI);

  let CL = 0;
  if (alphaDeg < -6) {
    CL = 0;
  } else if (alphaDeg <= 8) {
    CL = THREE.MathUtils.mapLinear(alphaDeg, -6, 8, 0, 1.25);
  } else if (alphaDeg <= 11) {
    CL = 1.25;
  } else if (alphaDeg <= 18) {
    CL = THREE.MathUtils.mapLinear(alphaDeg, 11, 18, 1.25, 0.18);
  } else {
    CL = 0.15;
  }

  const hTerrain = getTerrainHeight(player.pos.x, player.pos.z, selectedCourseId);
  const altitudeAGL = player.pos.y - hTerrain;

  const turbMult = weather.isStormy2X ? 2.0 : 1.0;

  const turbZoneHeight = 150;
  if (altitudeAGL < turbZoneHeight && altitudeAGL > 0) {
    const turbFactor = 1.0 - (altitudeAGL / turbZoneHeight);
    const dragPenalty = turbFactor * 12.0 * turbMult;
    player.speed -= dragPenalty * dt;

    if (turbFactor > 0.3) {
      const buffFreq = 2.0;
      const buffStrength = turbFactor * 0.80 * turbMult;
      const pitchKick = (Math.random() - 0.5) * buffStrength * 2;
      player.targetPitch += pitchKick * dt * buffFreq;
      player.targetPitch = THREE.MathUtils.clamp(player.targetPitch, -0.6, 0.6);
      const rollKick = (Math.random() - 0.5) * buffStrength * 3;
      player.targetRoll += rollKick * dt * buffFreq;
      player.targetRoll = THREE.MathUtils.clamp(player.targetRoll, -0.8, 0.8);
    }
    screenShake = Math.max(screenShake, turbFactor * 0.5 * turbMult);
  }

  const highAltMin = 1187.5;
  const highAltMax = 1875;

  if (player.pos.y > highAltMin && selectedCourseId !== 'moon') {
    const turbFactor = Math.min(1.0, (player.pos.y - highAltMin) / (highAltMax - highAltMin));
    const dragPenalty = turbFactor * 14.0 * turbMult;
    player.speed -= dragPenalty * dt;

    const buffStrength = turbFactor * 0.9 * turbMult;
    const pitchKick = (Math.random() - 0.5) * buffStrength * 2.5;
    player.targetPitch += pitchKick * dt * 3.5;
    player.targetPitch = THREE.MathUtils.clamp(player.targetPitch, -0.8, 0.8);
    const rollKick = (Math.random() - 0.5) * buffStrength * 4.0;
    player.targetRoll += rollKick * dt * 3.5;
    player.targetRoll = THREE.MathUtils.clamp(player.targetRoll, -1.0, 1.0);

    screenShake = Math.max(screenShake, turbFactor * 0.6 * turbMult);
  }

  const speedNorm = player.speed / 60.0;
  const liftForce = CL * (speedNorm * speedNorm) * 32.0;
  const verticalLift = liftForce * Math.cos(player.roll);

  const gravityNormal = 32.0 * Math.cos(player.flightPathPitch);
  const gammaRate = (verticalLift - gravityNormal) / Math.max(player.speed, 18.0);
  player.flightPathPitch += gammaRate * 2.2 * dt;

  player.flightPathPitch = THREE.MathUtils.lerp(player.flightPathPitch, player.pitch, 3.5 * dt);
  player.flightPathPitch = THREE.MathUtils.clamp(player.flightPathPitch, player.pitch - 0.35, player.pitch + 0.35);
  player.flightPathPitch = THREE.MathUtils.clamp(player.flightPathPitch, -Math.PI * 0.499, Math.PI * 0.499);

  const aGravity = -36.0 * Math.sin(player.flightPathPitch);
  player.speed += aGravity * dt;

  const aParasiticDrag = 0.00006 * (player.speed * player.speed);
  const aInducedDrag = 0.35 * (CL * CL) * (60.0 / Math.max(player.speed, 20.0));
  const aTurnDrag = (Math.abs(player.rudderDeflection) * 22.0 + Math.abs(player.roll) * 10.0);
  const aAirbrake = player.airbrake ? 42.0 : 0.0;

  player.speed -= (aParasiticDrag + aInducedDrag + aTurnDrag + aAirbrake) * dt;
  if (birdStrikeDragTimer > 0) {
    birdStrikeDragTimer -= dt;
    const birdDrag = 44.0 * Math.min(birdStrikeDragTimer, 1.5);
    player.speed -= birdDrag * dt;
    player.speed = Math.max(18, player.speed);
    screenShake = Math.max(screenShake, 0.25 * birdStrikeDragTimer);
  }

  const devShiftBoost = impossibleDifficultyUnlocked && (keys['ShiftLeft'] || keys['ShiftRight']);
  if (devShiftBoost) {
    player.speed = THREE.MathUtils.lerp(player.speed, 240, 4.5 * dt);
    screenShake = Math.max(screenShake, 0.45);
  } else if (player.speed > 130) {
    const overSpeed = (player.speed - 130) / 45;
    player.speed -= overSpeed * overSpeed * 26.0 * dt;
  }
  player.speed = Math.max(0, player.speed);

  const isStalling = player.speed < 24 || (alphaDeg > 16 && player.speed < 36);
  const stallEl = document.getElementById('stall-warning');

  if (isStalling) {
    stallEl.style.display = 'block';
    audio.playStallAlarm();
    player.pitch -= 0.35 * dt;

    if (!stallMechanic.active) {
      stallMechanic.active = true;
      stallMechanic.recoveryWindowTimer = 1.5;
      stallMechanic.canBonus = true;
    } else {
      if (stallMechanic.recoveryWindowTimer > 0) {
        stallMechanic.recoveryWindowTimer -= dt;
      }

      if (stallMechanic.canBonus && stallMechanic.recoveryWindowTimer > 0 && pitchInput < -0.3) {
        player.speed = Math.min(player.speed + 38, 175);
        stallMechanic.canBonus = false;
        birdStrikeDragTimer = 0;
        lastBirdStrikeTime = 0;
        stallMechanic.active = false;
        stallMechanic.bonusBannerTimer = 1.6;
        audio.playRecoveryBoost();
        screenShake = 0.4;
      }
    }
  } else {
    stallEl.style.display = 'none';
    if (player.speed > 28) {
      stallMechanic.active = false;
      stallMechanic.canBonus = true;
      stallMechanic.recoveryWindowTimer = 0;
    }
  }

  if (stallMechanic.bonusBannerTimer > 0) {
    stallMechanic.bonusBannerTimer -= dt;
    document.getElementById('stall-bonus').style.display = 'block';
  } else {
    document.getElementById('stall-bonus').style.display = 'none';
  }

  let isPlayerDrafting = false;

  if (gameMode === 'race' && aiGliders.length > 0) {
    aiGliders.forEach(ai => {
      _tempVec1.subVectors(player.pos, ai.pos);
      const distBetween = _tempVec1.length();

      if (gameState === 'RACING' && distBetween < 22.0 && Math.abs(player.pos.y - ai.pos.y) < 14.0) {
        const bumpX = player.pos.x - ai.pos.x;
        const bumpZ = player.pos.z - ai.pos.z;
        const hDist = Math.hypot(bumpX, bumpZ) || 1.0;
        const pushX = bumpX / hDist;
        const pushZ = bumpZ / hDist;

        player.pos.x += pushX * 22.0 * dt;
        player.pos.z += pushZ * 22.0 * dt;
        ai.pos.x -= pushX * 22.0 * dt;
        ai.pos.z -= pushZ * 22.0 * dt;

        player.speed = Math.max(36, player.speed - 12.0 * dt);
        ai.currentSpeed = Math.max(36, ai.currentSpeed - 12.0 * dt);

        player.targetRoll += pushX * 0.15;
        ai.roll -= pushX * 0.20;

        const nowSec = performance.now() * 0.001;
        if (nowSec - lastGliderBumpTime > 0.4) {
          lastGliderBumpTime = nowSec;
          audio.playScrape();
          screenShake = Math.max(screenShake, 0.32);
        }
      }

      const aiForward = _tempVec2.copy(ai.vel).normalize();
      const distBehind = -_tempVec1.dot(aiForward);

      if (distBehind > 25 && distBehind < 280) {
        _tempVec2.copy(aiForward).multiplyScalar(-distBehind);
        const distLateral = _tempVec1.sub(_tempVec2).length();

        if (distLateral < 38 && _playerForward.dot(aiForward) > 0.45) {
          isPlayerDrafting = true;
        }
      }
    });
  }

  if (isPlayerDrafting) {
    playerDraftTimer += dt;
    if (playerDraftTimer >= 3.0) {
      player.speed = Math.min(player.speed + 34.0 * dt, 165);
      screenShake = Math.max(screenShake, 0.2);
    }
  } else {
    playerDraftTimer = Math.max(0, playerDraftTimer - dt * 1.5);
  }

  player.inThermal = false;
  const course = COURSES[selectedCourseId];
  const activeSubtrack = course.subtracks[selectedSubtrack];
  const rainThermalBonus = 1.0 + weather.rainIntensity * 0.45;
  let thBoostLift = 0;

  const thHint = document.getElementById('thermal-hint');
  let inSink = false;

  if (activeSubtrack.sinks) {
    const sinkMult = weather.isStormy2X ? 2.0 : 1.0;
    activeSubtrack.sinks.forEach(sink => {
      const dist2D = Math.hypot(player.pos.x - sink.pos.x, player.pos.z - sink.pos.z);
      if (dist2D < sink.radius && player.pos.y > sink.pos.y - 50 && player.pos.y < sink.pos.y + 400) {
        inSink = true;
        const effStrength = sink.strength * sinkMult;
        player.verticalVelocity -= effStrength * 0.9 * dt;
        player.speed -= effStrength * 1.2 * dt;
        player.speed = Math.max(player.speed, 25);
        screenShake = Math.max(screenShake, 0.35 * sinkMult);
        
        thHint.innerText = weather.isStormy2X ? 'CRITICAL SINK ZONE (2X)!' : 'Sink Zone Detected! GET OUT';
        thHint.style.color = '#ff4444';
        thHint.style.borderColor = '#ff4444';
        thHint.style.display = 'block';
        
        audio.playBeep(180, 'sawtooth', 0.1, 0.08);
      }
    });
  }

  // Check Lateral Shoves
  let inLateralShove = false;
  lateralShoveSystems.forEach(sys => {
    if (sys.phase === 'on') {
      const shove = sys.shove;
      const dx = player.pos.x - shove.pos.x;
      const dy = player.pos.y - shove.pos.y;
      const dz = player.pos.z - shove.pos.z;
      const proj = dx * shove.axisX + dz * shove.axisZ;

      if (Math.abs(proj) <= shove.length * 0.5) {
        const perpX = dx - proj * shove.axisX;
        const perpY = dy;
        const perpZ = dz - proj * shove.axisZ;
        const distPerp = Math.hypot(perpX, perpY, perpZ);

        if (distPerp < shove.radius) {
          inLateralShove = true;
          const shoveFactor = 1.0 - (distPerp / shove.radius);
          // Downward velocity shove
          shoveVelocityOffset -= shove.force * shoveFactor * dt;
          // Softly forces nose downwards
          player.targetPitch -= 10.0 * shoveFactor * dt;
          player.flightPathPitch -= 0.16 * shoveFactor * dt;
          screenShake = Math.max(screenShake, 0.28 * shoveFactor);
          if (!inSink) {
            thHint.innerText = 'WIND SHEAR: NOSE FORCED DOWNWARD';
            thHint.style.color = '#f39c12';
            thHint.style.borderColor = '#f39c12';
            thHint.style.display = 'block';
          }
        }
      }
    }
  });

  // Check Bird Strikes
  activeBirdFlocks.forEach(flock => {
    flock.subClusters.forEach(cluster => {
      const distToBird = player.pos.distanceTo(cluster.worldPos);
      if (distToBird < cluster.radius + 12) {
        const nowSec = performance.now() * 0.001;
        if (nowSec - lastBirdStrikeTime > 0.35) {
          lastBirdStrikeTime = nowSec;
          birdStrikeDragTimer = Math.min(birdStrikeDragTimer + 1.8, 3.6);
          screenShake = Math.max(screenShake, 0.95);

          // nose down pitch
          const rollKick = Math.random() > 0.5 ? 0.95 : -0.95;
          player.targetRoll += rollKick;
          player.rudderDeflection += (rollKick > 0 ? 0.22 : -0.22);
          player.targetPitch += 0.36;
          player.flightPathPitch -= 0.14;

          audio.playBirdStrike();

          if (!inSink) {
            thHint.innerText = 'BIRD STRIKE! SEVERE DRAG & SPIRAL';
            thHint.style.color = '#ff4444';
            thHint.style.borderColor = '#ff4444';
            thHint.style.display = 'block';
          }
        }
      }
    });
  });


  activeSubtrack.thermals.forEach(th => {
    const dist2D = Math.hypot(player.pos.x - th.pos.x, player.pos.z - th.pos.z);
    if (dist2D < th.radius && player.pos.y > th.pos.y - 60 && player.pos.y < th.pos.y + 800) {
      player.inThermal = true;
      thBoostLift = th.boost * rainThermalBonus;
      player.speed = Math.max(player.speed, 85);
    }
  });

  if (player.inThermal) {
    thHint.style.display = 'block';
    thHint.innerText = weather.rainIntensity > 0.3 ? 'THERMAL UPDRAFT (+40% RAIN BOOST)' : 'THERMAL UPDRAFT';
    thHint.style.color = 'var(--cyan)';
    thHint.style.borderColor = 'var(--cyan)';
  } else if (!inSink) {
    thHint.style.display = 'none';
  }

  const cosGamma = Math.cos(player.flightPathPitch);
  const sinGamma = Math.sin(player.flightPathPitch);
  const sinYaw = Math.sin(player.yaw);
  const cosYaw = Math.cos(player.yaw);

  const flightDirX = -sinYaw * cosGamma;
  const flightDirY = sinGamma;
  const flightDirZ = -cosYaw * cosGamma;

  _playerForward.set(flightDirX, flightDirY, flightDirZ).normalize();

  const sustainSpeed = 26.0;
  const stallSink = (player.speed < sustainSpeed) ? ((sustainSpeed - player.speed) / sustainSpeed) * 28.0 : 0;

  let vertVel = (flightDirY * player.speed) - stallSink;
  if (player.inThermal) {
    vertVel += thBoostLift * 0.85;
  }

  vertVel += shoveVelocityOffset;
  player.verticalVelocity = vertVel;

  player.pos.x += flightDirX * player.speed * dt * 2.2;
  player.pos.z += flightDirZ * player.speed * dt * 2.2;
  player.pos.y += player.verticalVelocity * dt * 2.2;

  player.pos.x += weather.windVector.x * dt * 0.95;
  player.pos.z += weather.windVector.z * dt * 0.95;

  const hCenter = getTerrainHeight(player.pos.x, player.pos.z, selectedCourseId);
  const centerClearance = player.pos.y - hCenter;

  let groundContact = false;
  let isSteepImpact = false;

  if (centerClearance < 30) {
    const wingSpan = 11.5;
    const rightX = Math.cos(player.yaw);
    const rightZ = -Math.sin(player.yaw);
    const rollSin = Math.sin(player.roll);

    const lx = player.pos.x - rightX * wingSpan;
    const lz = player.pos.z - rightZ * wingSpan;
    const ly = player.pos.y + rollSin * wingSpan;

    const rx = player.pos.x + rightX * wingSpan;
    const rz = player.pos.z + rightZ * wingSpan;
    const ry = player.pos.y - rollSin * wingSpan;

    const nx = player.pos.x + _playerForward.x * 6.5;
    const nz = player.pos.z + _playerForward.z * 6.5;
    const ny = player.pos.y + _playerForward.y * 6.5;

    const hL = getTerrainHeight(lx, lz, selectedCourseId);
    const hR = getTerrainHeight(rx, rz, selectedCourseId);
    const hN = getTerrainHeight(nx, nz, selectedCourseId);

    const leftClip = ly < hL + 1.0;
    const rightClip = ry < hR + 1.0;
    const noseClip = ny < hN + 1.0;
    const centerClip = player.pos.y < hCenter + 1.0;

    groundContact = centerClip || (leftClip && rightClip) || (noseClip && centerClip);
    isSteepImpact = _playerForward.y < -0.22 || player.verticalVelocity < -16;
  } else {
    groundContact = player.pos.y < hCenter + 1.0;
    isSteepImpact = _playerForward.y < -0.22 || player.verticalVelocity < -16;
  }

  if (groundContact) {
    if (player.speed > 48 || isSteepImpact) {
      audio.playCrash();
      endRace('lose-crash');
      return;
    } else {
      audio.playScrape();
      player.pos.y = Math.max(player.pos.y, hCenter + 4.0);
      player.verticalVelocity = Math.max(player.verticalVelocity, 4.0);
      player.speed = Math.max(0, player.speed - 36 * dt);
      screenShake = Math.max(screenShake, 0.35);
    }
  }

  const targetFOV = THREE.MathUtils.mapLinear(player.speed, 0, 180, 68, 96);
  camera.fov = THREE.MathUtils.lerp(camera.fov, targetFOV, 4.0 * dt);
  camera.updateProjectionMatrix();

  const baseSpeedShake = player.speed > 80 ? (player.speed - 80) * 0.015 : 0;
const targetShake = baseSpeedShake * turbMult;

if (screenShake > targetShake) {
  screenShake = THREE.MathUtils.lerp(screenShake, targetShake, 5.0 * dt);
} else {
  screenShake = targetShake;
}

const shakeX = (Math.random() - 0.5) * screenShake;
const shakeY = (Math.random() - 0.5) * screenShake;

updateCameraView(shakeX, shakeY);

  audio.updateWind(player.speed, player.inThermal, weather.rainIntensity);

updateShadowMesh(playerShadowMesh, player.pos.x, player.pos.y, player.pos.z, player.yaw, selectedCourseId);

  if (activePresents3D.length > 0) {
    for (let i = activePresents3D.length - 1; i >= 0; i--) {
      const p = activePresents3D[i];
      if (player.pos.distanceTo(p.pos) < 36) {
  localStorage.setItem(p.id, 'true');
  environmentGroup.remove(p.mesh);
  activePresents3D.splice(i, 1);
  audio.playRecoveryBoost();
  screenShake = Math.max(screenShake, 0.4);

  let count = 0;
  ['A','B','C'].forEach(sub => {
    if (localStorage.getItem(`glider_xmas_present_${sub}`) === 'true') count++;
  });
  showAchievementNotifications([{ name: `Present Found! (${count}/3)` }]);
}
    }
  }

  checkGateProgress();
  if (gameState !== 'RACING') return;
  checkBoundaries();
  if (gameState !== 'RACING') return; 
  updateAI(dt);
  updateHUD();
  drawMinimap();
}

function checkGateProgress() {
  const course = COURSES[selectedCourseId];
  const activeSubtrack = course.subtracks[selectedSubtrack];
  const targetGate = gateMeshes[player.nextGateIdx];

const is16BitGlider = (getEquippedSkinId() === 'glider_16bit');

  gateMeshes.forEach((g, idx) => {
    const isNext = (idx === player.nextGateIdx);
    if (is16BitGlider) {
      g.ring.visible = false;
      g.core.visible = false;
      if (g.sprite) {
        g.sprite.visible = true;
        g.sprite.material = isNext ? waypointMaterials.blue : waypointMaterials.gray;
        g.sprite.quaternion.copy(g.group.quaternion).invert().multiply(camera.quaternion);
      }
    } else {
      g.ring.visible = true;
      g.core.visible = true;
      if (g.sprite) g.sprite.visible = false;
      if (isNext) {
        g.ring.material.color.setHex(0x00f0ff);
        g.core.material.color.setHex(0x00f0ff);
        g.core.material.opacity = 0.35 + Math.sin(performance.now() * 0.008) * 0.15;
    } else {
        g.ring.material.color.setHex(0xffffff);
        g.core.material.color.setHex(0xffffff);
        g.core.material.opacity = 0.08;
      }
    }
  });

  const dist = player.pos.distanceTo(targetGate.pos);
  if (dist < targetGate.radius + 14) {
    audio.playGateWhoosh();
    player.nextGateIdx++;
    if (player.nextGateIdx >= activeSubtrack.waypoints.length) {
      triggerRaceFinishSequence();
      return;   
    }
  }
}

function checkBoundaries() {
  if (gameState !== 'RACING') return;
  const course = COURSES[selectedCourseId];
  if (player.pos.y <= course.waterLevel + 3) {
    audio.playCrash();
    endRace('lose-crash');
    return; 
  }
}
