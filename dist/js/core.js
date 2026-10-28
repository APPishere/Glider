const HALLOWEEN_EVENT_ACTIVE = (() => {
  const now = new Date();
  const md = (now.getMonth() + 1) * 100 + now.getDate();
 return md >= 1027 && md <= 1102; 
})();
let halloween_door_unlocked = false;
try {
  localStorage.removeItem('glider_halloween_door_unlocked');
} catch (e) {}
let isHalloweenBossDuel = false;
let halloweenPreviousSkin = null;


const CHRISTMAS_EVENT_ACTIVE = (() => {
  const now = new Date();
  const md = (now.getMonth() + 1) * 100 + now.getDate();
  return (md >= 1220 && md <= 1231) || (md === 101);
})();
let isKrampusBossDuel = false;
let activePresents3D = [];
function hasAllChristmasPresents() {
  return localStorage.getItem('glider_xmas_present_A') === 'true' &&
         localStorage.getItem('glider_xmas_present_B') === 'true' &&
         localStorage.getItem('glider_xmas_present_C') === 'true';
}

function isMobileDevice() {
  return ('ontouchstart' in window) || (navigator.maxTouchPoints > 0) || window.matchMedia('(pointer: coarse)').matches;
}

let savedMusicVol = parseFloat(localStorage.getItem('glider_music_volume'));
let musicVolume = (!isNaN(savedMusicVol) && isFinite(savedMusicVol)) ? savedMusicVol : 0.8;

let savedSfxVol = parseFloat(localStorage.getItem('glider_sfx_volume'));
let sfxVolume = (!isNaN(savedSfxVol) && isFinite(savedSfxVol)) ? savedSfxVol : 0.8;

let mobilePitchInput = 0;
let mobileRollInput = 0;
let mobileYawLeft = false;
let mobileYawRight = false;
let mobileAirbrake = false;
let isRepositionMode = false;
let lastMobileCtrlGameState = null;
let mobileJoystickMode = localStorage.getItem('glider_mobile_joystick') || 'visible';
const activeSteeringTouches = new Map();

let gyroCurrentBeta = 0;
let gyroCurrentGamma = 0;
let gyroCalBeta = 0;
let gyroCalGamma = 0;
let gyroListenerAttached = false;

function onDeviceOrientation(e) {
  if (e.beta !== null && e.gamma !== null) {
    gyroCurrentBeta = e.beta;
    gyroCurrentGamma = e.gamma;
  }
}

function initGyroListener() {
  if (gyroListenerAttached) return;
  gyroListenerAttached = true;
  window.addEventListener('deviceorientation', onDeviceOrientation, true);
}

function requestGyroPermission() {
  if (!isMobileDevice()) return;
  if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
    DeviceOrientationEvent.requestPermission()
      .then(permissionState => {
        if (permissionState === 'granted') {
          initGyroListener();
        }
      })
      .catch(console.error);
  } else {
    initGyroListener();
  }
}

function calibrateGyro() {
  gyroCalBeta = gyroCurrentBeta;
  gyroCalGamma = gyroCurrentGamma;
}

function updateGyroSteering() {
  if (!isMobileDevice() || mobileJoystickMode !== 'gyro') return;
  const isReverse = (screen.orientation && (screen.orientation.angle === 270 || screen.orientation.angle === -90)) || window.orientation === -90 || window.orientation === 270;
  const sign = isReverse ? 1 : -1;
  let diffPitch = (gyroCurrentGamma - gyroCalGamma) * sign;
  let diffRoll = (gyroCurrentBeta - gyroCalBeta) * sign;

  if (Math.abs(diffPitch) < 3.0) {
    diffPitch = 0;
  } else {
    diffPitch = Math.sign(diffPitch) * (Math.abs(diffPitch) - 3.0);
  }

  if (Math.abs(diffRoll) < 3.0) {
    diffRoll = 0;
  } else {
    diffRoll = Math.sign(diffRoll) * (Math.abs(diffRoll) - 3.0);
  }

  const maxTilt = 25.0;
  mobilePitchInput = THREE.MathUtils.clamp(diffPitch / maxTilt, -1, 1);
  mobileRollInput = THREE.MathUtils.clamp(diffRoll / maxTilt, -1, 1);
}

function updateRudderVisuals() {
  const imgL = document.getElementById('mobile-img-yaw-l');
  const imgR = document.getElementById('mobile-img-yaw-r');
  if (!imgL || !imgR) return;
  if (!invertControls) {
    imgL.src = mobileYawLeft ? 'rudderleftclick.png' : 'rudderleft.png';
    imgR.src = mobileYawRight ? 'rudderrightclick.png' : 'rudderRight.png';
  } else {
    imgL.src = mobileYawLeft ? 'rudderrightclick.png' : 'rudderRight.png';
    imgR.src = mobileYawRight ? 'rudderleftclick.png' : 'rudderleft.png';
  }
}

function updateJoystickVisibility() {
  const stick = document.getElementById('mobile-joystick');
  const dpad = document.getElementById('mobile-dpad');
  const brake = document.getElementById('mobile-btn-brake');
  const showStick = (mobileJoystickMode === 'analog' || mobileJoystickMode === 'visible');
  const showDpad = (mobileJoystickMode === 'dpad');

  document.body.classList.toggle('dpad-mode', mobileJoystickMode === 'dpad');

  document.querySelectorAll('.joystick-btn').forEach(btn => {
    const val = btn.getAttribute('data-joystick');
    if (val === mobileJoystickMode || (val === 'analog' && mobileJoystickMode === 'visible') || (val === 'visible' && mobileJoystickMode === 'analog')) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  if (stick) {
    if (showStick && (gameState === 'RACING' || gameState === 'RUNUP' || isRepositionMode)) {
      stick.style.display = 'flex';
    } else {
      stick.style.display = 'none';
    }
  }

  if (dpad) {
    if (showDpad && (gameState === 'RACING' || gameState === 'RUNUP' || isRepositionMode)) {
      dpad.style.display = 'block';
    } else {
      dpad.style.display = 'none';
    }
  }

  if (brake) {
    brake.classList.add('rect-mode');
  }

  updateRudderVisuals();
  applyMobileButtonPositions();
}

function applyMobileButtonPositions() {
  const yawL = document.getElementById('mobile-btn-yaw-l');
  const yawR = document.getElementById('mobile-btn-yaw-r');
  const brake = document.getElementById('mobile-btn-brake');
  const stick = document.getElementById('mobile-joystick');
  const dpad = document.getElementById('mobile-dpad');
  if (!yawL || !yawR || !brake) return;

  const isVisibleMode = (mobileJoystickMode === 'analog' || mobileJoystickMode === 'visible' || mobileJoystickMode === 'dpad');
  if (brake) {
    brake.classList.add('rect-mode');
  }

  let saved = null;
  try {
    saved = JSON.parse(localStorage.getItem('glider_mobile_button_positions'));
  } catch (e) {}

  const w = window.innerWidth;
  const h = window.innerHeight;
  const clamp = (val, min, max) => Math.max(min, Math.min(max, val));

  if (saved) {
    if (saved.yawL && saved.yawL.size > 20) {
      yawL.style.width = saved.yawL.size + 'px';
      yawL.style.height = saved.yawL.size + 'px';
    }
    if (saved.yawR && saved.yawR.size > 20) {
      yawR.style.width = saved.yawR.size + 'px';
      yawR.style.height = saved.yawR.size + 'px';
    }
    if (saved.brake) {
      if (saved.brake.width > 20 && saved.brake.height > 20) {
        brake.style.width = saved.brake.width + 'px';
        brake.style.height = saved.brake.height + 'px';
      } else if (saved.brake.size > 20) {
        brake.style.width = saved.brake.size + 'px';
        brake.style.height = saved.brake.size + 'px';
      }
    }
    if (stick) {
      const stickSize = (saved.stick && saved.stick.size > 20) ? saved.stick.size : 114;
      stick.style.width = stickSize + 'px';
      stick.style.height = stickSize + 'px';
    }
    if (dpad) {
      const dpadSize = (saved.dpad && saved.dpad.size > 20) ? saved.dpad.size : 130;
      dpad.style.width = dpadSize + 'px';
      dpad.style.height = dpadSize + 'px';
    }

    if (saved.yawL && saved.yawR && saved.brake) {
      yawL.style.left = clamp(saved.yawL.xRatio * w, 10, w - (yawL.offsetWidth || 70)) + 'px';
      yawL.style.top = clamp(saved.yawL.yRatio * h, 10, h - (yawL.offsetHeight || 70)) + 'px';
      yawL.style.right = 'auto';
      yawL.style.bottom = 'auto';

      yawR.style.left = clamp(saved.yawR.xRatio * w, 10, w - (yawR.offsetWidth || 70)) + 'px';
      yawR.style.top = clamp(saved.yawR.yRatio * h, 10, h - (yawR.offsetHeight || 70)) + 'px';
      yawR.style.right = 'auto';
      yawR.style.bottom = 'auto';

      brake.style.left = clamp(saved.brake.xRatio * w, 10, w - (brake.offsetWidth || 84)) + 'px';
      brake.style.top = clamp(saved.brake.yRatio * h, 10, h - (brake.offsetHeight || 84)) + 'px';
      brake.style.right = 'auto';
      brake.style.bottom = 'auto';

      if (stick) {
        if (saved.stick && saved.stick.size > 20 && saved.stick.yRatio > 0.05) {
          stick.style.left = clamp(saved.stick.xRatio * w, 10, w - (stick.offsetWidth || 114)) + 'px';
          stick.style.top = clamp(saved.stick.yRatio * h, 10, h - (stick.offsetHeight || 114)) + 'px';
        } else {
          stick.style.left = '24px';
          stick.style.top = clamp(h - 138, 10, h - (stick.offsetHeight || 114)) + 'px';
        }
        stick.style.right = 'auto';
        stick.style.bottom = 'auto';
      }
      if (dpad) {
        if (saved.dpad && saved.dpad.size > 20 && saved.dpad.yRatio > 0.05) {
          dpad.style.left = clamp(saved.dpad.xRatio * w, 10, w - (dpad.offsetWidth || 130)) + 'px';
          dpad.style.top = clamp(saved.dpad.yRatio * h, 10, h - (dpad.offsetHeight || 130)) + 'px';
        } else {
          dpad.style.left = '24px';
          dpad.style.top = clamp(h - 148, 10, h - (dpad.offsetHeight || 130)) + 'px';
        }
        dpad.style.right = 'auto';
        dpad.style.bottom = 'auto';
      }
      return;
    }
  }

  if (isVisibleMode) {
    if (stick) {
      stick.style.left = '24px';
      stick.style.top = clamp(h - 138, 10, h - 114) + 'px';
      stick.style.right = 'auto';
      stick.style.bottom = 'auto';
    }
    if (dpad) {
      dpad.style.left = '24px';
      dpad.style.top = clamp(h - 148, 10, h - 130) + 'px';
      dpad.style.right = 'auto';
      dpad.style.bottom = 'auto';
    }
    brake.style.left = clamp(w - 108, 10, w - 84) + 'px';
    brake.style.top = clamp(h - 108, 10, h - 84) + 'px';
    brake.style.right = 'auto';
    brake.style.bottom = 'auto';

    yawL.style.left = clamp(w - 180, 10, w - 68) + 'px';
    yawL.style.top = clamp(h - 86, 10, h - 68) + 'px';
    yawL.style.right = 'auto';
    yawL.style.bottom = 'auto';

    yawR.style.left = clamp(w - 112, 10, w - 68) + 'px';
    yawR.style.top = clamp(h - 158, 10, h - 68) + 'px';
    yawR.style.right = 'auto';
    yawR.style.bottom = 'auto';
  } else {
    yawL.style.left = '24px';
    yawL.style.top = (h - 88) + 'px';
    yawL.style.right = 'auto';
    yawL.style.bottom = 'auto';

    yawR.style.left = '100px';
    yawR.style.top = (h - 88) + 'px';
    yawR.style.right = 'auto';
    yawR.style.bottom = 'auto';

    brake.style.left = (w - 108) + 'px';
    brake.style.top = (h - 108) + 'px';
    brake.style.right = 'auto';
    brake.style.bottom = 'auto';
  }
}

function saveMobileButtonPositions() {
  const yawL = document.getElementById('mobile-btn-yaw-l');
  const yawR = document.getElementById('mobile-btn-yaw-r');
  const brake = document.getElementById('mobile-btn-brake');
  const stick = document.getElementById('mobile-joystick');
  const dpad = document.getElementById('mobile-dpad');
  if (!yawL || !yawR || !brake) return;

  const w = window.innerWidth;
  const h = window.innerHeight;

  let saved = {};
  try {
    saved = JSON.parse(localStorage.getItem('glider_mobile_button_positions')) || {};
  } catch (e) {}

  const data = Object.assign({}, saved);

  if (yawL && yawL.offsetWidth > 20) {
    data.yawL = { xRatio: yawL.offsetLeft / w, yRatio: yawL.offsetTop / h, size: yawL.offsetWidth };
  }
  if (yawR && yawR.offsetWidth > 20) {
    data.yawR = { xRatio: yawR.offsetLeft / w, yRatio: yawR.offsetTop / h, size: yawR.offsetWidth };
  }
  if (brake && brake.offsetWidth > 20) {
    data.brake = { xRatio: brake.offsetLeft / w, yRatio: brake.offsetTop / h, size: brake.offsetWidth, width: brake.offsetWidth, height: brake.offsetHeight };
  }
  if (stick && stick.offsetWidth > 20 && stick.style.display !== 'none') {
    data.stick = { xRatio: stick.offsetLeft / w, yRatio: stick.offsetTop / h, size: stick.offsetWidth };
  }
  if (dpad && dpad.offsetWidth > 20 && dpad.style.display !== 'none') {
    data.dpad = { xRatio: dpad.offsetLeft / w, yRatio: dpad.offsetTop / h, size: dpad.offsetWidth };
  }

  try {
    localStorage.setItem('glider_mobile_button_positions', JSON.stringify(data));
  } catch (e) {}
}

function resetMobileButtonPositions() {
  try {
    localStorage.removeItem('glider_mobile_button_positions');
  } catch (e) {}
  const yawL = document.getElementById('mobile-btn-yaw-l');
  const yawR = document.getElementById('mobile-btn-yaw-r');
  const brake = document.getElementById('mobile-btn-brake');
  const stick = document.getElementById('mobile-joystick');
  const dpad = document.getElementById('mobile-dpad');
  if (yawL) { yawL.style.width = ''; yawL.style.height = ''; }
  if (yawR) { yawR.style.width = ''; yawR.style.height = ''; }
  if (brake) { brake.style.width = ''; brake.style.height = ''; }
  if (stick) { stick.style.width = ''; stick.style.height = ''; }
  if (dpad) { dpad.style.width = ''; dpad.style.height = ''; }
  applyMobileButtonPositions();
}

function openMobileRepositionEditor() {
  isRepositionMode = true;
  const overlay = document.getElementById('mobile-reposition-overlay');
  if (overlay) overlay.style.display = 'block';

  const wrap = document.getElementById('mobile-controls-wrap');
  if (wrap) wrap.style.display = 'block';

  const pauseBtn = document.getElementById('mobile-btn-pause');
  if (pauseBtn) pauseBtn.style.display = 'none';

  const yawL = document.getElementById('mobile-btn-yaw-l');
  const yawR = document.getElementById('mobile-btn-yaw-r');
  const brake = document.getElementById('mobile-btn-brake');
  const stick = document.getElementById('mobile-joystick');
  const dpad = document.getElementById('mobile-dpad');

  [yawL, yawR, brake].forEach(btn => {
    if (btn) {
      btn.style.display = 'flex';
      btn.classList.add('reposition-mode');
    }
  });
  if (stick && (mobileJoystickMode === 'analog' || mobileJoystickMode === 'visible')) {
    stick.style.display = 'flex';
    stick.classList.add('reposition-mode');
  }
  if (dpad && mobileJoystickMode === 'dpad') {
    dpad.style.display = 'block';
    dpad.classList.add('reposition-mode');
  }
  applyMobileButtonPositions();
}

function closeMobileRepositionEditor(save) {
  if (save) {
    saveMobileButtonPositions();
  }
  isRepositionMode = false;
  const overlay = document.getElementById('mobile-reposition-overlay');
  if (overlay) overlay.style.display = 'none';

  const pauseBtn = document.getElementById('mobile-btn-pause');
  const yawL = document.getElementById('mobile-btn-yaw-l');
  const yawR = document.getElementById('mobile-btn-yaw-r');
  const brake = document.getElementById('mobile-btn-brake');
  const stick = document.getElementById('mobile-joystick');
  const dpad = document.getElementById('mobile-dpad');

  [yawL, yawR, brake, stick, dpad].forEach(btn => {
    if (btn) {
      btn.classList.remove('reposition-mode');
    }
  });

  if (gameState !== 'RACING' && gameState !== 'RUNUP') {
    const wrap = document.getElementById('mobile-controls-wrap');
    if (wrap) wrap.style.display = 'none';
  } else {
    if (pauseBtn) pauseBtn.style.display = 'flex';
    if (stick && (mobileJoystickMode === 'analog' || mobileJoystickMode === 'visible')) stick.style.display = 'flex';
    if (dpad && mobileJoystickMode === 'dpad') dpad.style.display = 'block';
  }

  const settingsOverlay = document.getElementById('settings-overlay');
  if (settingsOverlay) settingsOverlay.style.display = 'flex';
}

function setupDraggableButton(btn) {
  if (!btn) return;
  let isDragging = false;
  let startX = 0, startY = 0;
  let initLeft = 0, initTop = 0;

  btn.addEventListener('pointerdown', (e) => {
    if (!isRepositionMode) return;
    if (e.target && e.target.closest && e.target.closest('.ctrl-resize-handle')) return;
    e.preventDefault();
    e.stopPropagation();
    isDragging = true;
    startX = e.clientX;
    startY = e.clientY;
    initLeft = btn.offsetLeft;
    initTop = btn.offsetTop;
    btn.setPointerCapture(e.pointerId);
  });

  btn.addEventListener('pointermove', (e) => {
    if (!isRepositionMode || !isDragging) return;
    e.preventDefault();
    e.stopPropagation();
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    const w = window.innerWidth;
    const h = window.innerHeight;
    const newL = Math.max(10, Math.min(w - btn.offsetWidth - 10, initLeft + dx));
    const newT = Math.max(10, Math.min(h - btn.offsetHeight - 10, initTop + dy));
    btn.style.left = newL + 'px';
    btn.style.top = newT + 'px';
    btn.style.right = 'auto';
    btn.style.bottom = 'auto';
  });

  const onDragEnd = (e) => {
    if (!isRepositionMode || !isDragging) return;
    isDragging = false;
    try { btn.releasePointerCapture(e.pointerId); } catch (err) {}
    saveMobileButtonPositions();
  };

  btn.addEventListener('pointerup', onDragEnd);
  btn.addEventListener('pointercancel', onDragEnd);
}

function setupResizableButton(btn) {
  if (!btn) return;
  const handle = btn.querySelector('.ctrl-resize-handle');
  if (!handle) return;

  let isResizing = false;
  let startX = 0, startY = 0;
  let startW = 0, startH = 0;

  handle.addEventListener('pointerdown', (e) => {
    if (!isRepositionMode) return;
    e.preventDefault();
    e.stopPropagation();
    isResizing = true;
    startX = e.clientX;
    startY = e.clientY;
    startW = btn.offsetWidth;
    startH = btn.offsetHeight;
    handle.setPointerCapture(e.pointerId);
  });

  handle.addEventListener('pointermove', (e) => {
    if (!isResizing || !isRepositionMode) return;
    e.preventDefault();
    e.stopPropagation();
    if (btn.id === 'mobile-btn-brake') {
      const newW = Math.max(54, Math.min(220, startW + (e.clientX - startX)));
      const newH = Math.max(48, Math.min(180, startH + (e.clientY - startY)));
      btn.style.width = newW + 'px';
      btn.style.height = newH + 'px';
    } else {
      const delta = Math.max(e.clientX - startX, e.clientY - startY);
      const newSize = Math.max(48, Math.min(160, startW + delta));
      btn.style.width = newSize + 'px';
      btn.style.height = newSize + 'px';
    }
  });

  const onResizeEnd = (e) => {
    if (!isResizing) return;
    isResizing = false;
    try { handle.releasePointerCapture(e.pointerId); } catch (err) {}
    saveMobileButtonPositions();
  };

  handle.addEventListener('pointerup', onResizeEnd);
  handle.addEventListener('pointercancel', onResizeEnd);
}

function setupJoystick() {
  const stick = document.getElementById('mobile-joystick');
  const knob = document.getElementById('mobile-joystick-knob');
  if (!stick || !knob) return;

  let pointerId = null;

  stick.addEventListener('pointerdown', (e) => {
    if (isRepositionMode) return;
    e.preventDefault();
    e.stopPropagation();
    pointerId = e.pointerId;
    stick.classList.add('active');
    stick.setPointerCapture(e.pointerId);
    handleMove(e);
  });

  const handleMove = (e) => {
    if (e.pointerId !== pointerId) return;
    e.preventDefault();
    e.stopPropagation();
    const rect = stick.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = e.clientX - cx;
    const dy = e.clientY - cy;
    const maxR = (stick.offsetWidth || 104) * 0.28;
    const dist = Math.hypot(dx, dy);
    let clampedX = dx;
    let clampedY = dy;
    if (dist > maxR) {
      clampedX = (dx / dist) * maxR;
      clampedY = (dy / dist) * maxR;
    }
    knob.style.transform = `translate(${clampedX}px, ${clampedY}px)`;
    mobileRollInput = THREE.MathUtils.clamp(clampedX / maxR, -1, 1);
    mobilePitchInput = THREE.MathUtils.clamp(clampedY / maxR, -1, 1);
  };

  stick.addEventListener('pointermove', handleMove);

  const handleEnd = (e) => {
    if (e.pointerId !== pointerId) return;
    pointerId = null;
    stick.classList.remove('active');
    knob.style.transform = 'translate(0px, 0px)';
    mobileRollInput = 0;
    mobilePitchInput = 0;
    try { stick.releasePointerCapture(e.pointerId); } catch (err) {}
  };

  stick.addEventListener('pointerup', handleEnd);
  stick.addEventListener('pointercancel', handleEnd);
}

function setupDpad() {
  const dpad = document.getElementById('mobile-dpad');
  const dpadImg = document.getElementById('mobile-dpad-img');
  if (!dpad || !dpadImg) return;

  let pointerId = null;

  const dpadTable = [
    { roll: 1, pitch: 0, img: 'dpadright.png' },
    { roll: 1, pitch: 1, img: 'dpaddownright.png' },
    { roll: 0, pitch: 1, img: 'dpaddown.png' },
    { roll: -1, pitch: 1, img: 'dpaddownleft.png' },
    { roll: -1, pitch: 0, img: 'dpadleft.png' },
    { roll: -1, pitch: -1, img: 'dpadupleft.png' },
    { roll: 0, pitch: -1, img: 'Dpadup.png' },
    { roll: 1, pitch: -1, img: 'dpadupright.png' }
  ];

  const handlePointer = (e) => {
    if (e.pointerId !== pointerId) return;
    e.preventDefault();
    e.stopPropagation();
    const rect = dpad.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = e.clientX - cx;
    const dy = e.clientY - cy;
    const dist = Math.hypot(dx, dy);

    if (dist < rect.width * 0.12) {
      dpadImg.src = 'D-pad.png';
      mobileRollInput = 0;
      mobilePitchInput = 0;
      return;
    }

    const deg = (Math.atan2(dy, dx) * 180 / Math.PI + 360) % 360;
    const sector = Math.floor(((deg + 22.5) % 360) / 45);
    const entry = dpadTable[sector];
    if (entry) {
      dpadImg.src = entry.img;
      mobileRollInput = entry.roll;
      mobilePitchInput = entry.pitch;
    }
  };

  dpad.addEventListener('pointerdown', (e) => {
    if (isRepositionMode) return;
    if (e.target && e.target.closest && e.target.closest('.ctrl-resize-handle')) return;
    e.preventDefault();
    e.stopPropagation();
    pointerId = e.pointerId;
    dpad.setPointerCapture(e.pointerId);
    handlePointer(e);
  });

  dpad.addEventListener('pointermove', handlePointer);

  const handleEnd = (e) => {
    if (e.pointerId !== pointerId) return;
    pointerId = null;
    dpadImg.src = 'D-pad.png';
    mobileRollInput = 0;
    mobilePitchInput = 0;
    try { dpad.releasePointerCapture(e.pointerId); } catch (err) {}
  };

  dpad.addEventListener('pointerup', handleEnd);
  dpad.addEventListener('pointercancel', handleEnd);
}

function setupMobileControls() {
  const yawL = document.getElementById('mobile-btn-yaw-l');
  const yawR = document.getElementById('mobile-btn-yaw-r');
  const brake = document.getElementById('mobile-btn-brake');
  const pause = document.getElementById('mobile-btn-pause');
  const stick = document.getElementById('mobile-joystick');
  const dpad = document.getElementById('mobile-dpad');
  const hudPause = document.getElementById('btn-hud-pause');

  setupDraggableButton(yawL);
  setupDraggableButton(yawR);
  setupDraggableButton(brake);
  if (stick) setupDraggableButton(stick);
  if (dpad) setupDraggableButton(dpad);

  setupResizableButton(yawL);
  setupResizableButton(yawR);
  setupResizableButton(brake);
  if (stick) setupResizableButton(stick);
  if (dpad) setupResizableButton(dpad);

  setupJoystick();
  setupDpad();

  const attachAction = (btn, onPress, onRelease) => {
    if (!btn) return;
    btn.addEventListener('pointerdown', (e) => {
      if (isRepositionMode) return;
      e.preventDefault();
      e.stopPropagation();
      btn.classList.add('active');
      onPress();
    });
    const release = (e) => {
      if (isRepositionMode) return;
      e.preventDefault();
      e.stopPropagation();
      btn.classList.remove('active');
      onRelease();
    };
    btn.addEventListener('pointerup', release);
    btn.addEventListener('pointercancel', release);
    btn.addEventListener('pointerleave', release);
  };

  attachAction(yawL, () => { mobileYawLeft = true; updateRudderVisuals(); }, () => { mobileYawLeft = false; updateRudderVisuals(); });
  attachAction(yawR, () => { mobileYawRight = true; updateRudderVisuals(); }, () => { mobileYawRight = false; updateRudderVisuals(); });
  attachAction(brake, () => { mobileAirbrake = true; player.airbrake = true; }, () => { mobileAirbrake = false; if (!keys['Space'] && !gpAirbrake) player.airbrake = false; });

  if (pause) {
    pause.addEventListener('pointerdown', (e) => {
      if (isRepositionMode) return;
      e.preventDefault();
      e.stopPropagation();
      audio.init();
      togglePauseMenu();
    });
  }

  if (hudPause) {
    const onHudPause = (e) => {
      e.preventDefault();
      e.stopPropagation();
      audio.init();
      togglePauseMenu();
    };
    hudPause.addEventListener('pointerdown', onHudPause);
    hudPause.addEventListener('click', onHudPause);
  }

  const btnMobileSave = document.getElementById('btn-mobile-save-pos');
  if (btnMobileSave) {
    btnMobileSave.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      audio.init();
      audio.playRecoveryBoost();
      closeMobileRepositionEditor(true);
    });
  }

  const btnMobileReset = document.getElementById('btn-mobile-reset-pos');
  if (btnMobileReset) {
    btnMobileReset.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      audio.init();
      resetMobileButtonPositions();
      audio.playBeep(440, 'triangle', 0.12);
    });
  }

  const flappyCard = document.getElementById('flappy-modal-card');
  if (flappyCard) {
    flappyCard.addEventListener('pointerdown', (e) => {
      if (e.target && e.target.id === 'btn-flappy-close') return;
      e.preventDefault();
      flappyTriggerFlap();
    });
  }

  function updateSteeringFromTouches() {
    if (mobileJoystickMode === 'gyro' || mobileJoystickMode === 'dpad') return;
    if (activeSteeringTouches.size === 0) {
      if (mobileJoystickMode === 'invisible' || !stick || stick.style.display === 'none') {
        mobilePitchInput = 0;
        mobileRollInput = 0;
      }
      return;
    }
    let latest = null;
    activeSteeringTouches.forEach(t => { latest = t; });
    if (!latest) {
      if (mobileJoystickMode === 'invisible' || !stick || stick.style.display === 'none') {
        mobilePitchInput = 0;
        mobileRollInput = 0;
      }
      return;
    }
    const dx = latest.currX - latest.startX;
    const dy = latest.currY - latest.startY;
    const dragRange = Math.min(window.innerWidth, window.innerHeight) * 0.18;
    mobileRollInput = THREE.MathUtils.clamp(dx / dragRange, -1, 1);
    mobilePitchInput = THREE.MathUtils.clamp(dy / dragRange, -1, 1);
  }

  window.addEventListener('touchstart', (e) => {
    if (gameState !== 'RACING' && gameState !== 'RUNUP') return;
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      if (t.target && t.target.closest && t.target.closest('.mobile-ctrl-btn, #mobile-reposition-overlay')) {
        continue;
      }
      activeSteeringTouches.set(t.identifier, {
        startX: t.clientX,
        startY: t.clientY,
        currX: t.clientX,
        currY: t.clientY
      });
    }
    updateSteeringFromTouches();
  }, { passive: false });

  window.addEventListener('touchmove', (e) => {
    if (gameState !== 'RACING' && gameState !== 'RUNUP') return;
    let handled = false;
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      if (activeSteeringTouches.has(t.identifier)) {
        const item = activeSteeringTouches.get(t.identifier);
        item.currX = t.clientX;
        item.currY = t.clientY;
        handled = true;
      }
    }
    if (handled) {
      e.preventDefault();
      updateSteeringFromTouches();
    }
  }, { passive: false });

  const endSteeringTouch = (e) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      activeSteeringTouches.delete(e.changedTouches[i].identifier);
    }
    updateSteeringFromTouches();
  };

  window.addEventListener('touchend', endSteeringTouch);
  window.addEventListener('touchcancel', endSteeringTouch);

  window.addEventListener('gesturestart', (e) => e.preventDefault());
  window.addEventListener('gesturechange', (e) => e.preventDefault());
  window.addEventListener('gestureend', (e) => e.preventDefault());

  applyMobileButtonPositions();
  updateJoystickVisibility();
}

const defaultKeybinds = {
  pitchDown: ['KeyW', 'ArrowUp'],
  pitchUp: ['KeyS', 'ArrowDown'],
  rollLeft: ['KeyA', 'ArrowLeft'],
  rollRight: ['KeyD', 'ArrowRight'],
  yawLeft: ['KeyQ'],
  yawRight: ['KeyE'],
  airbrake: ['Space']
};
let keybinds = null;
try {
  keybinds = JSON.parse(localStorage.getItem('glider_keybinds'));
} catch (e) {}
if (!keybinds || typeof keybinds !== 'object') {
  keybinds = JSON.parse(JSON.stringify(defaultKeybinds));
}

function isActionPressed(action) {
  const codes = keybinds[action] || defaultKeybinds[action] || [];
  return codes.some(code => !!keys[code]);
}

const KEY_NAME_MAP = {
  KeyW: 'W', KeyS: 'S', KeyA: 'A', KeyD: 'D',
  KeyQ: 'Q', KeyE: 'E', KeyR: 'R', KeyF: 'F',
  ArrowUp: '↑ UP', ArrowDown: '↓ DOWN', ArrowLeft: '← LEFT', ArrowRight: '→ RIGHT',
  Space: 'SPACE', ShiftLeft: 'L-SHIFT', ShiftRight: 'R-SHIFT',
  ControlLeft: 'L-CTRL', ControlRight: 'R-CTRL', AltLeft: 'L-ALT', AltRight: 'R-ALT'
};

function formatKeyName(code) {
  if (KEY_NAME_MAP[code]) return KEY_NAME_MAP[code];
  if (code && code.startsWith('Key')) return code.substring(3);
  if (code && code.startsWith('Digit')) return code.substring(5);
  return code || '---';
}

const ACTION_LABELS = {
  pitchDown: 'PITCH DOWN (NOSE DOWN)',
  pitchUp: 'PITCH UP (NOSE UP)',
  rollLeft: 'BANK LEFT',
  rollRight: 'BANK RIGHT',
  yawLeft: 'RUDDER YAW LEFT',
  yawRight: 'RUDDER YAW RIGHT',
  airbrake: 'AIRBRAKE'
};

let activeRebindAction = null;
let activeRebindIndex = -1;

function renderKeybindList() {
  const container = document.getElementById('keybind-list');
  if (!container) return;
  container.innerHTML = '';

  for (const action in defaultKeybinds) {
    const row = document.createElement('div');
    row.className = 'control-toggle-box';
    row.style.marginBottom = '0';
    row.style.justifyContent = 'space-between';

    const label = document.createElement('div');
    label.className = 'control-toggle-label';
    label.innerText = ACTION_LABELS[action] || action.toUpperCase();
    row.appendChild(label);

    const btnGroup = document.createElement('div');
    btnGroup.style.display = 'flex';
    btnGroup.style.gap = '6px';

    const assigned = keybinds[action] || defaultKeybinds[action] || [];
    assigned.forEach((code, idx) => {
      const btn = document.createElement('button');
      btn.className = 'mono-btn keybind-btn';
      btn.style.padding = '5px 12px';
      btn.style.fontSize = '10px';
      btn.style.minWidth = '58px';

      const isRebinding = (activeRebindAction === action && activeRebindIndex === idx);
      if (isRebinding) {
        btn.innerText = 'PRESS KEY...';
        btn.style.borderColor = 'var(--gold)';
        btn.style.color = 'var(--gold)';
      } else {
        btn.innerText = formatKeyName(code);
      }

      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        audio.init();
        audio.playBeep(520, 'sine', 0.08);
        activeRebindAction = action;
        activeRebindIndex = idx;
        renderKeybindList();
      });

      btnGroup.appendChild(btn);
    });

    row.appendChild(btnGroup);
    container.appendChild(row);
  }
}

function updateCellarDoorVisibility() {
  const cellarWrap = document.getElementById('shop-cellar-door-wrap');
  if (cellarWrap) {
    const showHw = (HALLOWEEN_EVENT_ACTIVE && halloween_door_unlocked);
    const showXmas = (CHRISTMAS_EVENT_ACTIVE && hasAllChristmasPresents());
    cellarWrap.style.display = (showHw || showXmas) ? 'block' : 'none';
  }
}

function updateHalloweenThemeVisibility() {
  const isHwEquipped = isHalloweenGliderEquipped();
  const hwDecor = document.getElementById('halloween-decor-wrap');
  const hudStatsBar = document.querySelector('.hud-stats');
  const mmContainer = document.getElementById('minimap-container');
  const banner = document.getElementById('happy-halloween-banner');

  const isFlight = (gameState === 'RACING' || gameState === 'RUNUP' || gameState === 'FINISHING' || gameState === 'CREDITS' || gameState === 'GHOST_FLEET_CINEMATIC');
  const activeScreen = document.querySelector('.menu-screen[id]:not(.hidden)');
  const settingsOverlay = document.getElementById('settings-overlay');
  const settingsOpen = settingsOverlay && window.getComputedStyle(settingsOverlay).display !== 'none';
  const hudOverlay = document.getElementById('hud-overlay');
  const hudActive = hudOverlay && window.getComputedStyle(hudOverlay).display !== 'none';

  const isMenuScreen = !isFlight && !hudActive && !!activeScreen;
  const showHalloweenMenu = HALLOWEEN_EVENT_ACTIVE && isMenuScreen && !settingsOpen;

  if (hwDecor) {
    hwDecor.style.display = showHalloweenMenu ? 'block' : 'none';
  }
  if (hudStatsBar) {
    hudStatsBar.classList.toggle('halloween-theme', HALLOWEEN_EVENT_ACTIVE || isHalloweenBossDuel);
  }
  if (mmContainer) {
    mmContainer.classList.toggle('halloween-theme', HALLOWEEN_EVENT_ACTIVE || isHalloweenBossDuel);
  }

  if (banner) {
    if (showHalloweenMenu && activeScreen) {
      banner.style.display = 'block';
      banner.style.top = '20px';
      banner.style.bottom = 'auto';
      banner.style.transform = 'translateX(-50%) scale(1.05)';
      banner.classList.add('visible');
    } else {
      banner.style.display = 'none';
      banner.classList.remove('visible');
    }
  }
}

let ghostFleetCinematicActive = false;
let ghostFleetCinematicTimer = 0;
const ghostFleetCinematicDuration = 7.5; 

function startGhostFleetCinematic() {
  ghostFleetCinematicActive = true;
  ghostFleetCinematicTimer = 0;
  gameState = 'GHOST_FLEET_CINEMATIC';

  if (typeof updateHalloweenThemeVisibility === 'function') {
    updateHalloweenThemeVisibility();
  }

  if (paragliderWingGroup) paragliderWingGroup.visible = false;
  if (gateMeshes) gateMeshes.forEach(g => { g.group.visible = false; });
  document.getElementById('hud-overlay').style.display = 'none';
  document.getElementById('countdown-box').style.display = 'none';

  audio.playBeep(85, 'sawtooth', 1.6, 0.35);
  setTimeout(() => audio.playBeep(55, 'square', 2.0, 0.30), 600);
}

function updateGhostFleetCinematic(dt) {
  ghostFleetCinematicTimer += dt;
  const progress = Math.min(1.0, ghostFleetCinematicTimer / ghostFleetCinematicDuration);

  if (lighthouseBeams && lighthouseBeams.length > 0) {
    lighthouseBeams.forEach(b => { b.rotation.y += 1.4 * dt; });
  }

  const p1 = new THREE.Vector3(-2600, 400, -1900);
  const p2 = new THREE.Vector3(-1700, 1400, -2800);
  const p3 = new THREE.Vector3(-700, 1000, -2100);
  const p4 = new THREE.Vector3(0, 490, 160);

  let camPos = new THREE.Vector3();
  let lookTarget = new THREE.Vector3();

  if (progress < 0.5) {
    const t = progress / 0.5;
    camPos.lerpVectors(p1, p2, t);
    lookTarget.set(-1500, 35, -3200);
  } else if (progress < 0.8) {
    const t = (progress - 0.5) / 0.3;
    camPos.lerpVectors(p2, p3, t);
    lookTarget.set(-1850, 180, -1600);
  } else {
    const t = (progress - 0.8) / 0.2;
    camPos.lerpVectors(p3, p4, t);
    lookTarget.set(0, 460, -300);
  }

  camera.position.copy(camPos);
  camera.lookAt(lookTarget);

  if (progress >= 1.0) {
    finishGhostFleetCinematic();
  }
}

function finishGhostFleetCinematic() {
  if (!ghostFleetCinematicActive) return;
  ghostFleetCinematicActive = false;
  if (paragliderWingGroup) paragliderWingGroup.visible = true;
  if (gateMeshes) gateMeshes.forEach(g => { g.group.visible = true; });
  startCountdown();
}

function createTree(x, y, z, scale, trunkColor = 0x5d4037, leafColor = 0x2e7d32) {
  const group = new THREE.Group();
  
  const trunkGeom = new THREE.CylinderGeometry(0.25 * scale, 0.4 * scale, 1.0 * scale, 6);
  const trunkMat = new THREE.MeshLambertMaterial({ color: trunkColor });
  const trunk = new THREE.Mesh(trunkGeom, trunkMat);
  trunk.position.y = 0.5 * scale;
  group.add(trunk);

  const canopyGeom = new THREE.ConeGeometry(1.2 * scale, 2.2 * scale, 6);
  const canopyMat = new THREE.MeshLambertMaterial({ color: leafColor });
  const canopy = new THREE.Mesh(canopyGeom, canopyMat);
  canopy.position.y = 1.6 * scale + 0.2 * scale;
  group.add(canopy);

  const canopy2Geom = new THREE.ConeGeometry(0.9 * scale, 1.6 * scale, 6);
  const canopy2 = new THREE.Mesh(canopy2Geom, canopyMat);
  canopy2.position.y = 2.4 * scale + 0.2 * scale;
  group.add(canopy2);

  group.position.set(x, y, z);
  group.rotation.y = Math.random() * Math.PI * 2;
  group.rotation.z = (Math.random() - 0.5) * 0.08;
  group.rotation.x = (Math.random() - 0.5) * 0.08;

  return group;
}

let gamepadConnected = false;
let gpPitch = 0, gpRoll = 0, gpYaw = 0;
let gpAirbrake = false;
let uiFocusIndex = 0;
let uiCooldown = 0;
let startPressed = false;
let selectPressed = false;
let cancelPressed = false;
let lastActiveScreenId = null;
let activeGamepadIndex = null;

function getActiveGamepad() {
  const gamepads = (navigator.getGamepads ? navigator.getGamepads() : (navigator.webkitGetGamepads ? navigator.webkitGetGamepads() : [])) || [];
  if (activeGamepadIndex !== null && gamepads[activeGamepadIndex] && gamepads[activeGamepadIndex].connected) {
    return gamepads[activeGamepadIndex];
  }
  for (let i = 0; i < gamepads.length; i++) {
    const gp = gamepads[i];
    if (gp && gp.connected) {
      activeGamepadIndex = gp.index;
      return gp;
    }
  }
  return null;
}

function highlightUIElement(items, index) {
  items.forEach(el => {
    el.style.borderColor = '';
    el.style.boxShadow = '';
  });
  const current = items[index];
  if (current) {
    current.style.borderColor = 'var(--cyan)';
    current.style.boxShadow = '0 0 10px rgba(0, 240, 255, 0.7)';
    current.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
}

function handleGamepadUI(dt) {
  const gp = getActiveGamepad();
  if (!gp) {
    gamepadConnected = false;
    return;
  }
  gamepadConnected = true;

  if (gp.buttons[9]?.pressed || gp.buttons[8]?.pressed) {
    if (!startPressed) {
      startPressed = true;
      audio.init();
      togglePauseMenu();
    }
  } else {
    startPressed = false;
  }

  const activeScreen = document.querySelector('.menu-screen:not(.hidden)');
  if (!activeScreen) {
    lastActiveScreenId = null;
    return;
  }

  const interactables = Array.from(activeScreen.querySelectorAll(
    '.mono-btn, .track-opt, .subtrack-opt, .shop-item-card, .ctrl-btn, .mode-btn, .diff-btn, .invert-btn'
  )).filter(el => el.offsetParent !== null && !el.disabled);
  if (interactables.length === 0) return;

  if (lastActiveScreenId !== activeScreen.id) {
    lastActiveScreenId = activeScreen.id;
    const activeIdx = interactables.findIndex(el => el.classList.contains('active'));
    uiFocusIndex = activeIdx >= 0 ? activeIdx : 0;
    highlightUIElement(interactables, uiFocusIndex);
  }

  if (uiFocusIndex >= interactables.length) uiFocusIndex = 0;

  let up = gp.buttons[12]?.pressed || (gp.buttons[12]?.value > 0.5);
  let down = gp.buttons[13]?.pressed || (gp.buttons[13]?.value > 0.5);
  let left = gp.buttons[14]?.pressed || (gp.buttons[14]?.value > 0.5);
  let right = gp.buttons[15]?.pressed || (gp.buttons[15]?.value > 0.5);

  const stickDeadZone = 0.35;
  const stickY = gp.axes[1] || 0;
  const stickX = gp.axes[0] || 0;

  if (!up && stickY < -stickDeadZone) up = true;
  if (!down && stickY > stickDeadZone) down = true;
  if (!left && stickX < -stickDeadZone) left = true;
  if (!right && stickX > stickDeadZone) right = true;

  if (up || down || left || right) audio.init();

  const select = gp.buttons[0]?.pressed || (gp.buttons[0]?.value > 0.5);
  const cancel = gp.buttons[1]?.pressed || (gp.buttons[1]?.value > 0.5);

  if (uiCooldown > 0) {
    uiCooldown -= dt;
  }

  let moved = false;

  if (uiCooldown <= 0) {
    if (up || left) {
      uiFocusIndex = (uiFocusIndex - 1 + interactables.length) % interactables.length;
      moved = true;
    } else if (down || right) {
      uiFocusIndex = (uiFocusIndex + 1) % interactables.length;
      moved = true;
    }

    if (moved) {
      uiCooldown = 0.22;
      highlightUIElement(interactables, uiFocusIndex);
    }
  }

  if (select) {
    if (!selectPressed && uiCooldown <= 0) {
      selectPressed = true;
      audio.init();
      const current = interactables[uiFocusIndex];
      if (current) {
        current.click();
        uiCooldown = 0.25;
        setTimeout(() => {
          const freshScreen = document.querySelector('.menu-screen:not(.hidden)');
          if (freshScreen) {
            const freshItems = Array.from(freshScreen.querySelectorAll(
              '.mono-btn, .track-opt, .subtrack-opt, .shop-item-card, .ctrl-btn, .mode-btn, .diff-btn, .invert-btn'
            )).filter(el => el.offsetParent !== null && !el.disabled);
            if (freshItems.length > 0) {
              if (uiFocusIndex >= freshItems.length) uiFocusIndex = 0;
              highlightUIElement(freshItems, uiFocusIndex);
            }
          }
        }, 60);
      }
    }
  } else {
    selectPressed = false;
  }

  if (cancel) {
    if (!cancelPressed && uiCooldown <= 0) {
      cancelPressed = true;
      audio.init();
      const backBtn = activeScreen.querySelector('#btn-dispatch-back, #btn-shop-back, #btn-resume, #btn-gp-preview-back, #btn-gp-select, .btn-menu');
      if (backBtn) {
        backBtn.click();
        uiCooldown = 0.25;
      }
    }
  } else {
    cancelPressed = false;
  }
}

function handleGamepad() {
  const gp = getActiveGamepad();
  
  if (!gp) {
    gamepadConnected = false;
    gpPitch = 0;
    gpRoll = 0;
    gpYaw = 0;
    gpAirbrake = false;
    return;
  }

  gamepadConnected = true;
  const deadZone = 0.10;

  let rawRoll = gp.axes[0] || 0;
  let rawPitch = gp.axes[1] || 0;

  if (gp.buttons[12]?.pressed) rawPitch -= 1.0;
  if (gp.buttons[13]?.pressed) rawPitch += 1.0;
  if (gp.buttons[14]?.pressed) rawRoll -= 1.0;
  if (gp.buttons[15]?.pressed) rawRoll += 1.0;

  let rawYaw = -(gp.axes[2] !== undefined ? gp.axes[2] : 0);
  if (gp.buttons[4]?.pressed) rawYaw += 1.0;
  if (gp.buttons[5]?.pressed) rawYaw -= 1.0;

  gpRoll = Math.abs(rawRoll) > deadZone ? rawRoll : 0;
  gpPitch = Math.abs(rawPitch) > deadZone ? rawPitch : 0;
  gpYaw = Math.abs(rawYaw) > deadZone ? rawYaw : 0;

  const leftTrigger = gp.buttons[6]?.value ?? (gp.buttons[6]?.pressed ? 1 : 0);
  const rightTrigger = gp.buttons[7]?.value ?? (gp.buttons[7]?.pressed ? 1 : 0);
  const bAirbrake = gp.buttons[1]?.pressed || gp.buttons[2]?.pressed;
  gpAirbrake = (leftTrigger > 0.25 || rightTrigger > 0.25 || !!bAirbrake);
}

function createBigPinkTree(x, y, z, scale = 1.0) {
  const group = new THREE.Group();
  const trunkColor = 0x8d6e63;
  const leafColor = 0xf8b0c0;

  const trunkGeom = new THREE.CylinderGeometry(1.2 * scale, 1.8 * scale, 5.0 * scale, 8);
  const trunkMat = new THREE.MeshLambertMaterial({ color: trunkColor });
  const trunk = new THREE.Mesh(trunkGeom, trunkMat);
  trunk.position.y = 2.5 * scale;
  group.add(trunk);

  const canopyMat = new THREE.MeshLambertMaterial({ color: leafColor });
  const positions = [
    [0, 5.0 * scale, 0, 2.8 * scale],
    [1.6 * scale, 4.2 * scale, 1.2 * scale, 2.0 * scale],
    [-1.4 * scale, 4.0 * scale, -1.0 * scale, 2.0 * scale],
    [1.0 * scale, 3.5 * scale, -1.8 * scale, 1.8 * scale],
    [-1.8 * scale, 3.8 * scale, 1.4 * scale, 1.8 * scale],
  ];
  positions.forEach(([px, py, pz, r]) => {
    const sphere = new THREE.Mesh(new THREE.SphereGeometry(r, 6, 6), canopyMat);
    sphere.position.set(px, py, pz);
    group.add(sphere);
  });

group.position.set(x, y, z);
  return group;
}


function createSnowyPineTree(x, y, z, scale = 14) {
  const group = new THREE.Group();
  
  const trunkGeom = new THREE.CylinderGeometry(0.25 * scale, 0.4 * scale, 1.2 * scale, 6);
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x4a3728 });
  const trunk = new THREE.Mesh(trunkGeom, trunkMat);
  trunk.position.y = 0.6 * scale;
  group.add(trunk);

  const foliageMat = new THREE.MeshLambertMaterial({ color: 0x1e3f20, flatShading: true });
  const snowMat = new THREE.MeshLambertMaterial({ color: 0xf0f8ff, flatShading: true });

  const tiers = [
    { r: 1.5 * scale, h: 1.8 * scale, y: 1.5 * scale },
    { r: 1.2 * scale, h: 1.6 * scale, y: 2.4 * scale },
    { r: 0.85 * scale, h: 1.4 * scale, y: 3.2 * scale }
  ];

  tiers.forEach(t => {
    const foliage = new THREE.Mesh(new THREE.ConeGeometry(t.r, t.h, 6), foliageMat);
    foliage.position.y = t.y;
    group.add(foliage);

    const snowCap = new THREE.Mesh(new THREE.ConeGeometry(t.r * 1.02, t.h * 0.45, 6), snowMat);
    snowCap.position.y = t.y + t.h * 0.28;
    group.add(snowCap);
  });

  group.position.set(x, y, z);
  group.rotation.y = Math.random() * Math.PI * 2;
  return group;
}
const iceFrostTexture = (() => {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 128, 128);

  ctx.strokeStyle = 'rgba(210, 235, 255, 0.45)';
  ctx.lineWidth = 1.2;
  let s = 1337;
  const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  for (let i = 0; i < 24; i++) {
    ctx.beginPath();
    let x = rnd() * 128;
    let y = rnd() * 128;
    ctx.moveTo(x, y);
    for (let j = 0; j < 3; j++) {
      x += (rnd() - 0.5) * 40;
      y += (rnd() - 0.5) * 40;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1.5, 1.5);
  return tex;
})();

function createDiamondIceSpike(x, y, z, scale = 140, col = 0x7282e8, rotX = 0, rotZ = 0, rotY = 0, style = 'chunky') {
  const group = new THREE.Group();
  group.position.set(x, y, z);
  group.rotation.x = rotX;
  group.rotation.y = rotY;
  group.rotation.z = rotZ;

  let emissiveCol = 0x1e2a5e;
  if (col === 0x6de4d6 || col === 0x64dfdf || col === 0x78eedd) {
    emissiveCol = 0x144c54;
  } else if (col === 0x346b84 || col === 0x2b5b72) {
    emissiveCol = 0x0f2936;
  } else if (col === 0xb8ecf5 || col === 0xcef5fc) {
    emissiveCol = 0x244c5c;
  }

  const mat = new THREE.MeshStandardMaterial({
    color: col,
    emissive: emissiveCol,
    emissiveIntensity: 0.28,
    roughness: 0.16,
    metalness: 0.35,
    roughnessMap: iceFrostTexture,
    flatShading: true,
    side: THREE.DoubleSide
  });

  const segments = (style === 'slender' || Math.random() > 0.5) ? 4 : 5;
  
  let radius = scale * 0.42;
  let topH = scale * 0.70;
  let botH = scale * 0.55;

  if (style === 'slender') {
    radius = scale * 0.34;
    topH = scale * 0.85;
    botH = scale * 0.65;
  } else if (style === 'obelisk') {
    radius = scale * 0.38;
    topH = scale * 0.78;
    botH = scale * 0.60;
  }

  const positions = [];
  const uvs = [];

  const angles = [];
  for (let i = 0; i < segments; i++) {
    angles.push((i / segments) * Math.PI * 2);
  }

  for (let i = 0; i < segments; i++) {
    const a1 = angles[i];
    const a2 = angles[(i + 1) % segments];
    const x1 = Math.cos(a1) * radius;
    const z1 = Math.sin(a1) * radius;
    const x2 = Math.cos(a2) * radius;
    const z2 = Math.sin(a2) * radius;

    const u1 = i / segments;
    const u2 = (i + 1) / segments;

    // Upper pyramid
    positions.push(
      0, topH, 0,
      x2, 0, z2,
      x1, 0, z1
    );
    uvs.push(0.5, 1.0, u2, 0.5, u1, 0.5);

    // Lower pyramid
    positions.push(
      x1, 0, z1,
      x2, 0, z2,
      0, -botH, 0
    );
    uvs.push(u1, 0.5, u2, 0.5, 0.5, 0.0);
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geom.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geom.computeVertexNormals();

  const mesh = new THREE.Mesh(geom, mat);
  mesh.position.y = botH * 0.45;
  group.add(mesh);

  return group;
}

function createGlacialIceArch(x, y, z, span = 260, height = 180, rotY = 0) {
  const archGroup = new THREE.Group();
  archGroup.position.set(x, y, z);
  archGroup.rotation.y = rotY;

  const iceMat = new THREE.MeshStandardMaterial({
    color: 0x6be5e8,
    emissive: 0x1f5c6b,
    emissiveIntensity: 0.28,
    roughness: 0.12,
    metalness: 0.45,
    flatShading: true
  });

  const archGeom = new THREE.TorusGeometry(span * 0.5, 32, 7, 18, Math.PI);
  const archMesh = new THREE.Mesh(archGeom, iceMat);
  archMesh.scale.set(1.0, height / (span * 0.5), 1.0);
  archGroup.add(archMesh);

  [-span * 0.5, span * 0.5].forEach((px, idx) => {
    const pillarGeom = new THREE.ConeGeometry(38, height * 1.1, 7);
    const pillar = new THREE.Mesh(pillarGeom, iceMat);
    pillar.position.set(px, height * 0.15, 0);
    pillar.rotation.z = (idx === 0 ? 0.18 : -0.18);
    archGroup.add(pillar);
  });

  return archGroup;
}

const AphelionEncoder = (() => {
  const SECRET_KEY = [65, 112, 104, 101, 108, 105, 111, 110, 83, 101, 99, 114, 101, 116]; 

  const SUB_TABLE = new Uint8Array(256);
  const INV_TABLE = new Uint8Array(256);
  (() => {
    let s = 1337;
    const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
    const arr = [];
    for (let i = 0; i < 256; i++) arr.push(i);
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      const tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
    }
    for (let i = 0; i < 256; i++) {
      SUB_TABLE[i] = arr[i];
      INV_TABLE[arr[i]] = i;
    }
  })();

  function packSave(saveObj) {
    const pbs = saveObj.pbs || {};
    const ghosts = saveObj.ghosts || {};
    const hw = saveObj.halloweenUnlocked ? 1 : 0;
    const sn = saveObj.santaUnlocked ? 1 : 0;
    const kr = saveObj.krampusUnlocked ? 1 : 0;
    const xm = saveObj.xm || 0;
    const packedGhosts = {};
    for (const track in ghosts) {
      if (Array.isArray(ghosts[track])) {
        packedGhosts[track] = ghosts[track].map(f => [
          Math.round(f.t * 1000) / 1000,
          Math.round(f.x * 10) / 10,
          Math.round(f.y * 10) / 10,
          Math.round(f.z * 10) / 10,
          Math.round(f.pitch * 1000) / 1000,
          Math.round(f.yaw * 1000) / 1000,
          Math.round(f.roll * 1000) / 1000
        ]);
      }
    }
    const jsonStr = JSON.stringify({ p: pbs, g: packedGhosts, hw, xm, sn, kr });
    if (typeof TextEncoder !== 'undefined') {
      return new TextEncoder().encode(jsonStr);
    }
    const buf = new Uint8Array(jsonStr.length);
    for (let i = 0; i < jsonStr.length; i++) buf[i] = jsonStr.charCodeAt(i);
    return buf;
  }

  function unpackSave(bytes) {
    let jsonStr;
    if (typeof TextDecoder !== 'undefined') {
      jsonStr = new TextDecoder().decode(bytes);
    } else {
      jsonStr = String.fromCharCode.apply(null, bytes);
    }
    const parsed = JSON.parse(jsonStr);
    const pbs = parsed.p || {};
    const ghosts = {};
    const halloweenUnlocked = (parsed.hw === 1);
    const santaUnlocked = (parsed.sn === 1);
    const krampusUnlocked = (parsed.kr === 1);
    const xm = parsed.xm || 0;
    if (parsed.g) {
      for (const track in parsed.g) {
        ghosts[track] = parsed.g[track].map(f => ({
          t: f[0], x: f[1], y: f[2], z: f[3],
          pitch: f[4], yaw: f[5], roll: f[6]
        }));
      }
    }
    return { pbs, ghosts, halloweenUnlocked, santaUnlocked, krampusUnlocked, xm };
  }

  function lzwCompress(bytes) {
    const dict = new Map();
    for (let i = 0; i < 256; i++) dict.set(String.fromCharCode(i), i);
    let dictSize = 256;
    let w = "";
    const codes = [];
    for (let i = 0; i < bytes.length; i++) {
      const c = String.fromCharCode(bytes[i]);
      const wc = w + c;
      if (dict.has(wc)) {
        w = wc;
      } else {
        codes.push(dict.get(w));
        if (dictSize < 65535) dict.set(wc, dictSize++);
        w = c;
      }
    }
    if (w !== "") codes.push(dict.get(w));

    const out = new Uint8Array(codes.length * 2);
    for (let i = 0; i < codes.length; i++) {
      out[i * 2] = (codes[i] >> 8) & 0xFF;
      out[i * 2 + 1] = codes[i] & 0xFF;
    }
    return out;
  }

  function lzwDecompress(bytes) {
    if (bytes.length % 2 !== 0) throw new Error("Malformed compressed save data");
    const codes = new Uint16Array(bytes.length / 2);
    for (let i = 0; i < codes.length; i++) {
      codes[i] = (bytes[i * 2] << 8) | bytes[i * 2 + 1];
    }
    if (codes.length === 0) return new Uint8Array(0);

    const dict = new Map();
    for (let i = 0; i < 256; i++) dict.set(i, [i]);
    let dictSize = 256;

    let w = dict.get(codes[0]);
    const result = [...w];

    for (let i = 1; i < codes.length; i++) {
      const k = codes[i];
      let entry;
      if (dict.has(k)) {
        entry = dict.get(k);
      } else if (k === dictSize) {
        entry = [...w, w[0]];
      } else {
        throw new Error("Corrupted LZW code dictionary");
      }
      for (let j = 0; j < entry.length; j++) result.push(entry[j]);
      if (dictSize < 65535) dict.set(dictSize++, [...w, entry[0]]);
      w = entry;
    }
    return new Uint8Array(result);
  }

  function fletcher16(data) {
    let s1 = 0, s2 = 0;
    for (let i = 0; i < data.length; i++) {
      s1 = (s1 + data[i]) % 255;
      s2 = (s2 + s1) % 255;
    }
    return (s2 << 8) | s1;
  }

  function addChecksum(data) {
    const h = fletcher16(data);
    const out = new Uint8Array(data.length + 2);
    out[0] = (h >> 8) & 0xFF;
    out[1] = h & 0xFF;
    out.set(data, 2);
    return out;
  }

  function verifyChecksum(data) {
    if (data.length < 2) throw new Error("Save key is truncated");
    const expectedH = (data[0] << 8) | data[1];
    const payload = data.subarray(2);
    const actualH = fletcher16(payload);
    if (expectedH !== actualH) throw new Error("Checksum mismatch: corrupted or altered save code!");
    return payload;
  }

  function applySub(data) {
    const out = new Uint8Array(data.length);
    for (let i = 0; i < data.length; i++) out[i] = SUB_TABLE[data[i]];
    return out;
  }

  function invertSub(data) {
    const out = new Uint8Array(data.length);
    for (let i = 0; i < data.length; i++) out[i] = INV_TABLE[data[i]];
    return out;
  }

  function xorCipher(data) {
    const out = new Uint8Array(data.length);
    const kLen = SECRET_KEY.length;
    for (let i = 0; i < data.length; i++) out[i] = data[i] ^ SECRET_KEY[i % kLen];
    return out;
  }

  function bitInvert(data) {
    const out = new Uint8Array(data.length);
    for (let i = 0; i < data.length; i++) out[i] = data[i] ^ 0xFF;
    return out;
  }

  function offsetShift(data) {
    const out = new Uint8Array(data.length);
    for (let i = 0; i < data.length; i++) out[i] = (data[i] + (i % 37) + 13) & 0xFF;
    return out;
  }

  function offsetUnshift(data) {
    const out = new Uint8Array(data.length);
    for (let i = 0; i < data.length; i++) out[i] = (data[i] - (i % 37) - 13) & 0xFF;
    return out;
  }

  function base64Encode(bytes) {
    let binary = '';
    const chunk = 8192;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
    }
    return "APH_" + btoa(binary);
  }

  function base64Decode(str) {
    let clean = str.trim();
    if (clean.startsWith("APH_")) clean = clean.substring(4);
    const binary = atob(clean);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }

  return {
    encode: function(saveObj) {
      const bA = packSave(saveObj);   
      const bP = lzwCompress(bA);   
      const bH = addChecksum(bP);   
      const bE = applySub(bH);      
      const bL = xorCipher(bE);     
      const bI = bitInvert(bL);     
      const bO = offsetShift(bI);    
      const sN = base64Encode(bO);  
      return sN;
    },
    decode: function(saveKey) {
      const bO = base64Decode(saveKey); 
      const bI = offsetUnshift(bO);    
      const bL = bitInvert(bI);         
      const bE = xorCipher(bL);         
      const bH = invertSub(bE);        
      const bP = verifyChecksum(bH);   
      const bA = lzwDecompress(bP);    
      const res = unpackSave(bA);     
      return res;
    }
  };
})();
class SoundEngine {
  constructor() {
    this.masterGain = null;
    this.masterVolume = sfxVolume;
    this.ctx = null;
    this.windNode = null;
    this.windGain = null;
    this.windFilter = null;
    this.thermalGain = null;
    this.rainGain = null;
    this.lastPullUpTime = 0;
  }

  setMasterVolume(val) {
    this.masterVolume = val;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(val, this.ctx.currentTime, 0.05);
    }
  }

  init() {
    if (this.ctx) return;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AudioCtx();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.setValueAtTime(this.masterVolume, this.ctx.currentTime);
    this.masterGain.connect(this.ctx.destination);

    const bufferSize = this.ctx.sampleRate * 2;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    const whiteNoise = this.ctx.createBufferSource();
    whiteNoise.buffer = noiseBuffer;
    whiteNoise.loop = true;

    this.windFilter = this.ctx.createBiquadFilter();
    this.windFilter.type = 'lowpass';
    this.windFilter.frequency.setValueAtTime(400, this.ctx.currentTime);

    this.windGain = this.ctx.createGain();
    this.windGain.gain.setValueAtTime(0.0001, this.ctx.currentTime);

    whiteNoise.connect(this.windFilter);
    this.windFilter.connect(this.windGain);
    this.windGain.connect(this.masterGain);
    whiteNoise.start();

    const thermalOsc = this.ctx.createOscillator();
    this.thermalGain = this.ctx.createGain();
    thermalOsc.type = 'sine';
    thermalOsc.frequency.setValueAtTime(80, this.ctx.currentTime);
    this.thermalGain.gain.setValueAtTime(0, this.ctx.currentTime);
    thermalOsc.connect(this.thermalGain);
    this.thermalGain.connect(this.masterGain);
    thermalOsc.start();

    const rainNoise = this.ctx.createBufferSource();
    rainNoise.buffer = noiseBuffer;
    rainNoise.loop = true;
    const rainFilter = this.ctx.createBiquadFilter();
    rainFilter.type = 'bandpass';
    rainFilter.frequency.setValueAtTime(1400, this.ctx.currentTime);
    rainFilter.Q.setValueAtTime(1.8, this.ctx.currentTime);

    this.rainGain = this.ctx.createGain();
    this.rainGain.gain.setValueAtTime(0.0001, this.ctx.currentTime);
    rainNoise.connect(rainFilter);
    rainFilter.connect(this.rainGain);
    this.rainGain.connect(this.masterGain);
    rainNoise.start();
  }

  updateWind(speed, inThermal, rainIntensity = 0) {
    if (!this.ctx) return;
    const targetFreq = THREE.MathUtils.mapLinear(speed, 0, 180, 100, 2800);
    const targetVol = THREE.MathUtils.mapLinear(speed, 0, 180, 0.0, 0.55);

    this.windFilter.frequency.setTargetAtTime(targetFreq, this.ctx.currentTime, 0.1);
    this.windGain.gain.setTargetAtTime(targetVol, this.ctx.currentTime, 0.1);
    this.thermalGain.gain.setTargetAtTime(inThermal ? 0.28 : 0.0, this.ctx.currentTime, 0.2);

    if (this.rainGain) {
      const targetRain = THREE.MathUtils.clamp(rainIntensity * 0.22, 0.0001, 0.35);
      this.rainGain.gain.setTargetAtTime(targetRain, this.ctx.currentTime, 0.3);
    }
  }

  stopAllAudio() {
    if (!this.ctx) return;
    if (this.windGain) this.windGain.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.05);
    if (this.thermalGain) this.thermalGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.05);
    if (this.rainGain) this.rainGain.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.05);
  }

  playBeep(freq = 440, type = 'sine', duration = 0.1, gainVal = 0.2) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
    gain.gain.setValueAtTime(gainVal, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(this.masterGain || this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + duration);
  }

  playGateWhoosh() {
    if (!this.ctx) return;
    this.playBeep(580, 'triangle', 0.18, 0.25);
    this.playBeep(880, 'sine', 0.25, 0.2);
  }

  playCrash() {
    if (!this.ctx) return;
    this.playBeep(120, 'sawtooth', 0.5, 0.4);
    this.playBeep(65, 'square', 0.7, 0.5);
  }

  playScrape() {
    if (!this.ctx) return;
    this.playBeep(180, 'sawtooth', 0.12, 0.15);
  }

playBirdStrike() {
    if (!this.ctx) return;
    this.playBeep(240, 'sawtooth', 0.18, 0.35);
    setTimeout(() => this.playBeep(160, 'triangle', 0.22, 0.4), 40);
    setTimeout(() => this.playBeep(85, 'square', 0.28, 0.35), 85);
  }

  playLateralShove() {
    if (!this.ctx) return;
    this.playBeep(95, 'sine', 0.3, 0.22);
  }

  playStallAlarm() {
    if (!this.ctx) return;
    const now = performance.now();
    if (now - this.lastPullUpTime < 650) return;
    this.lastPullUpTime = now;

    this.playBeep(880, 'triangle', 0.12, 0.3);
    setTimeout(() => {
      this.playBeep(520, 'sine', 0.16, 0.35);
    }, 120);
  }

  playRecoveryBoost() {
    if (!this.ctx) return;
    this.playBeep(440, 'triangle', 0.15, 0.25);
    this.playBeep(660, 'sine', 0.22, 0.28);
    this.playBeep(990, 'sine', 0.3, 0.25);
  }

  playChainRattle() {
    if (!this.ctx) return;
    for (let i = 0; i < 4; i++) {
      setTimeout(() => {
        this.playBeep(110 + Math.random() * 70, 'square', 0.05, 0.07);
        this.playBeep(230 + Math.random() * 110, 'triangle', 0.04, 0.06);
      }, i * 35);
    }
  }

  playCreakAndDeadbolt() {
    if (!this.ctx) return;
    // Heavy iron bolt click
    this.playBeep(90, 'sawtooth', 0.12, 0.35);
    setTimeout(() => this.playBeep(140, 'square', 0.08, 0.30), 60);
    // Heavy wooden creak
    setTimeout(() => {
      this.playBeep(75, 'sawtooth', 0.45, 0.28);
      this.playBeep(60, 'triangle', 0.60, 0.25);
    }, 180);
  }

  playFinishFanfare() {
    if (!this.ctx) return;
    this.playGateWhoosh();

    const arpeggio = [
      { freq: 523.25, time: 0,   dur: 0.12 }, // C5
      { freq: 659.25, time: 90,  dur: 0.12 }, // E5
      { freq: 783.99, time: 180, dur: 0.14 }, // G5
      { freq: 1046.50, time: 290, dur: 0.38 } // C6
    ];

    arpeggio.forEach(n => {
      setTimeout(() => {
        this.playBeep(n.freq, 'sawtooth', n.dur, 0.22);
        this.playBeep(n.freq, 'triangle', n.dur, 0.28);
        this.playBeep(n.freq * 2, 'sine', n.dur * 0.7, 0.15);
      }, n.time);
    });

    setTimeout(() => {
      const chord = [523.25, 659.25, 783.99, 1046.50, 1318.51];
      chord.forEach((freq, idx) => {
        this.playBeep(freq, 'triangle', 2.0, 0.22 - idx * 0.02);
        this.playBeep(freq, 'sawtooth', 1.6, 0.14);
        this.playBeep(freq * 2, 'sine', 1.4, 0.10);
      });
    }, 430);
  }
}

const audio = new SoundEngine();

const bgStartup = new Audio('startup.mp3');
bgStartup.loop = true;
bgStartup.volume = parseFloat(localStorage.getItem('glider_music_volume') ?? 0.8);

class GaplessAudio {
  constructor(url) {
    this.url = url;
    this.buffer = null;
    this.source = null;
    this.gainNode = null;
    this._volume = 0.8;
    this.paused = true;
    this.pauseOffset = 0;
    this.startTime = 0;
    this._arrayBufferPromise = null;
    this._decodePromise = null;
    this._fallback = null;

    this._fetchData();
  }

  get volume() {
    return this._volume;
  }

  set volume(val) {
    this._volume = Math.max(0, Math.min(1, val));
    if (this.gainNode && audio.ctx) {
      this.gainNode.gain.setTargetAtTime(this._volume, audio.ctx.currentTime, 0.05);
    }
    if (this._fallback) {
      this._fallback.volume = this._volume;
    }
  }

  get currentTime() {
    if (this._fallback) return this._fallback.currentTime;
    if (!this.buffer) return 0;
    if (this.paused) return this.pauseOffset;
    if (!audio.ctx) return 0;
    return (audio.ctx.currentTime - this.startTime) % this.buffer.duration;
  }

  set currentTime(val) {
    if (this._fallback) {
      this._fallback.currentTime = val;
      return;
    }
    this.pauseOffset = Math.max(0, val);
    if (!this.paused && this.source) {
      this._startSource(this.pauseOffset);
    }
  }

  _fetchData() {
    if (this._arrayBufferPromise) return;
    this._arrayBufferPromise = fetch(this.url)
      .then(res => {
        if (!res.ok) throw new Error(`HTTP error ${res.status}`);
        return res.arrayBuffer();
      })
      .catch(err => {
        console.warn('GaplessAudio: Web Audio fetch failed, falling back to HTML5 Audio:', err);
        this._fallback = new Audio(this.url);
        this._fallback.loop = true;
        this._fallback.volume = this._volume;
        return null;
      });
  }

  async _ensureBuffer() {
    if (this.buffer || this._fallback) return true;
    if (this._decodePromise) return this._decodePromise;

    this._decodePromise = (async () => {
      try {
        this._fetchData();
        const rawData = await this._arrayBufferPromise;
        if (!rawData) return !!this._fallback;

        if (!audio.ctx) audio.init();
        this.buffer = await audio.ctx.decodeAudioData(rawData.slice(0));
        return true;
      } catch (e) {
        console.warn('GaplessAudio: Decode failed, falling back to HTML5 Audio:', e);
        this._fallback = new Audio(this.url);
        this._fallback.loop = true;
        this._fallback.volume = this._volume;
        return true;
      }
    })();

    return this._decodePromise;
  }

  _startSource(offset = 0) {
    if (!audio.ctx || !this.buffer) return;

    if (this.source) {
      try {
        this.source.stop();
        this.source.disconnect();
      } catch (e) {}
      this.source = null;
    }

    if (!this.gainNode) {
      this.gainNode = audio.ctx.createGain();
      this.gainNode.gain.setValueAtTime(this._volume, audio.ctx.currentTime);
      this.gainNode.connect(audio.ctx.destination);
    }

    this.source = audio.ctx.createBufferSource();
    this.source.buffer = this.buffer;
    this.source.loop = true;
    this.source.connect(this.gainNode);

    const safeOffset = offset % this.buffer.duration;
    this.source.start(0, safeOffset);
    this.startTime = audio.ctx.currentTime - safeOffset;
    this.paused = false;
  }

  async play() {

    if (!this.paused && this.source) return;

    this.paused = false;

    if (this._fallback) {
      return this._fallback.play().catch(() => {});
    }

    if (!audio.ctx) audio.init();
    if (audio.ctx && audio.ctx.state === 'suspended') {
      await audio.ctx.resume().catch(() => {});
    }

    const ready = await this._ensureBuffer();
    if (this._fallback) {
      return this._fallback.play().catch(() => {});
    }

    if (!ready || !this.buffer || this.paused) return;

    this._startSource(this.pauseOffset);
  }

  pause() {
    this.paused = true;
    if (this._fallback) {
      this._fallback.pause();
      return;
    }

    if (!this.source) return;

    if (audio.ctx && this.buffer) {
      this.pauseOffset = (audio.ctx.currentTime - this.startTime) % this.buffer.duration;
    }

    try {
      this.source.stop();
      this.source.disconnect();
    } catch (e) {}

    this.source = null;
  }
}

// different types of music here
const SOUNDTRACK_PACKS = {
  default: {
    name: 'DEFAULT OST',
    pillText: 'DEFAULT OST',
    pillColor: 'var(--purple)',
    discImage: 'musicdiscdefault.png',
    tracks: {
      menu: new GaplessAudio('Glider_Menu_Theme_v2.wav'),
      shop: new GaplessAudio('elevatorshopmusic.wav'),
      pause: new GaplessAudio('okayithinkthisisdone.mp3') 
    }
  },
  g64: {
    name: 'GLIDER 64 OST',
    pillText: 'GLIDER 64',
    pillColor: 'var(--red)',
    discImage: 'musicdisc64.png',
    tracks: {
      menu: new GaplessAudio('glidermenutheme2.wav'),
      shop: new GaplessAudio('escmusicglider2.mp3'),
      pause: new GaplessAudio('shopmenumusic2.mp3') 
    }
  }
};

let currentDiscKey = localStorage.getItem('glider_soundtrack_disc') || 'default';
let currentAudioContext = 'menu'; // 'menu', 'shop', or 'pause'
let activeAudioTrack = null;
let isEjectAnimating = false;

function getCurrentAudioTrack(contextKey) {
  const pack = SOUNDTRACK_PACKS[currentDiscKey] || SOUNDTRACK_PACKS.default;
  const track = pack.tracks[contextKey];
  if (track && track.url) return track;
  return pack.tracks.menu;
}

const INTERACT_SFX = [
  'interact1.mp3',
  'interact 2.mp3',
  'interact 3.mp3',
  'interact 4.mp3'
];

let splashDismissed = false;

function playMenuTheme(context = currentAudioContext) {
  if (!splashDismissed) return;
  if (gameState === 'RACING' || gameState === 'RUNUP') return;

  currentAudioContext = context;
  const targetTrack = getCurrentAudioTrack(context);

  if (activeAudioTrack === targetTrack && !targetTrack.paused) return;

  stopMenuTheme(false);
  activeAudioTrack = targetTrack;
  activeAudioTrack.volume = musicVolume;
  activeAudioTrack.play().catch(() => {});
}

function stopMenuTheme(reset = false) {
  Object.values(SOUNDTRACK_PACKS).forEach(pack => {
    Object.values(pack.tracks).forEach(track => {
      if (track) {
        track.pause();
        if (reset) track.currentTime = 0;
      }
    });
  });
  if (reset) activeAudioTrack = null;
}

function updateDiscVisuals(discKey) {
  const pack = SOUNDTRACK_PACKS[discKey];
  const pill = document.getElementById('disc-pill');
  const discImg = document.getElementById('disc-img');
  const fallback = document.getElementById('disc-fallback');

  if (pill) {
    pill.innerText = pack.pillText;
    pill.style.color = pack.pillColor;
    pill.style.borderColor = pack.pillColor;
    pill.style.boxShadow = `0 0 10px ${pack.pillColor}`;
  }

  if (discImg && pack.discImage) {
    discImg.src = pack.discImage;
    discImg.onload = () => {
      discImg.style.display = 'block';
      if (fallback) fallback.style.display = 'none';
    };
    discImg.onerror = () => {
      discImg.style.display = 'none';
      if (fallback) fallback.style.display = 'flex';
    };
  }
}

function triggerJukeboxEject() {
  if (isEjectAnimating) return;
  isEjectAnimating = true;

  audio.init();

  const widget = document.getElementById('jukebox-widget');
  if (widget) {
    widget.classList.remove('ejecting');
    void widget.offsetWidth;
    widget.classList.add('ejecting');
  }

  audio.playBeep(240, 'sawtooth', 0.08, 0.18);
  setTimeout(() => audio.playBeep(280, 'sawtooth', 0.08, 0.20), 120);

  setTimeout(() => {
    currentDiscKey = (currentDiscKey === 'default') ? 'g64' : 'default';
    try {
      localStorage.setItem('glider_soundtrack_disc', currentDiscKey);
    } catch (e) {}

    updateDiscVisuals(currentDiscKey);

    audio.playBeep(780, 'sine', 0.14, 0.25);
    setTimeout(() => audio.playBeep(1040, 'triangle', 0.18, 0.22), 60);

    stopMenuTheme(true);
    playMenuTheme(currentAudioContext);
  }, 460);

  setTimeout(() => {
    audio.playBeep(140, 'square', 0.09, 0.28);
  }, 780);

  setTimeout(() => {
    audio.playBeep(320, 'triangle', 0.06, 0.22);
  }, 1780);

  setTimeout(() => {
    if (widget) widget.classList.remove('ejecting');
    isEjectAnimating = false;
  }, 2050);
}





function updateMusicVolume(val) {
  musicVolume = Math.max(0, Math.min(1, val));
  try {
    localStorage.setItem('glider_music_volume', musicVolume);
  } catch (e) {}

if (typeof bgStartup !== 'undefined') bgStartup.volume = musicVolume;

  if (typeof SOUNDTRACK_PACKS !== 'undefined') {
    Object.values(SOUNDTRACK_PACKS).forEach(pack => {
      Object.values(pack.tracks).forEach(track => {
        if (track) track.volume = musicVolume;
      });
    });
  }

  document.querySelectorAll('.music-volume-slider').forEach(slider => {
    slider.value = Math.round(musicVolume * 100);
  });
  document.querySelectorAll('.music-vol-label').forEach(label => {
    label.innerText = `${Math.round(musicVolume * 100)}%`;
  });
}

function updateSfxVolume(val) {
  sfxVolume = Math.max(0, Math.min(1, val));
  try {
    localStorage.setItem('glider_sfx_volume', sfxVolume);
  } catch (e) {}

  if (typeof audio !== 'undefined' && audio.setMasterVolume) {
    audio.setMasterVolume(sfxVolume);
  }

  document.querySelectorAll('.sfx-volume-slider').forEach(slider => {
    slider.value = Math.round(sfxVolume * 100);
  });
  document.querySelectorAll('.sfx-vol-label').forEach(label => {
    label.innerText = `${Math.round(sfxVolume * 100)}%`;
  });
}

let scene, camera, renderer, hudCanvas, hudCtx;
let hemiLight = null, sunLight = null;
let minimapCanvas, minimapCtx;
let gameState = 'START';

let selectedCourseId = localStorage.getItem('glider_last_course') || 'canyon';
if (selectedCourseId === 'caves') selectedCourseId = 'glacial';
if (!['canyon', 'islands', 'coastal', 'volcano', 'glacial', 'moon'].includes(selectedCourseId)) {
  selectedCourseId = 'canyon';
}

let selectedSubtrack = 'A';
let gameMode = localStorage.getItem('glider_game_mode') || 'race';
let selectedDifficulty = localStorage.getItem('glider_difficulty') || 'medium';
let controlScheme = localStorage.getItem('glider_control_scheme') || 'wasd';
let invertControls = localStorage.getItem('glider_invert_controls') === 'true';
let raceStartTime = 0;
let raceElapsedTime = 0;

let countdownElapsed = 0;
let countdownStage = 3;

let environmentGroup = new THREE.Group();
let cloudsGroup = new THREE.Group();
let lowerCloudsGroup = new THREE.Group();
let thermalSystems = [];
let lateralShoveSystems = [];
let activeBirdFlocks = [];
let birdStrikeDragTimer = 0;
let lastBirdStrikeTime = 0;
let lastGliderBumpTime = 0;
let camSmoothYaw = 0, camSmoothPitch = 0, camSmoothRoll = 0;
let menuCamCenter = new THREE.Vector3(0, 420, 0);
let paragliderWingGroup = null;
let gateMeshes = [];
let aiGliders = [];
let screenShake = 0;
let lighthouseBeams = [];
let volcanoEruptionSystem = null;
let volcanoLavaLight = null;

const volcanoEvent = {
  warningActive: false,
  exploded: false,
  rocks: [],
  smokeSystem: null,
  denseSmokeMeshes: [],
  explosionGroup: null
};

const lunarMeteorEvent = {
  triggered: false,
  active: false,
  timer: 0,
  spawnTimer: 0,
  spawnedCount: 0,
  meteors: [],
  meteorPool: [],
  impactMeshes: [],
  group: null
};

function createMeteorMesh() {
  const group = new THREE.Group();

  const rockGeom = new THREE.DodecahedronGeometry(7.5, 1);
  const pos = rockGeom.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const vx = pos.getX(i);
    const vy = pos.getY(i);
    const vz = pos.getZ(i);
    const distort = 1.0 + Math.sin(vx * 1.8 + vy * 2.4) * 0.28;
    pos.setXYZ(i, vx * distort * 1.15, vy * distort * 0.88, vz * distort * 1.35);
  }
  rockGeom.computeVertexNormals();

  const rockMat = new THREE.MeshStandardMaterial({
    color: 0x22150f,
    emissive: 0xff3b00,
    emissiveIntensity: 0.95,
    roughness: 0.82,
    metalness: 0.45,
    flatShading: true
  });
  const rockMesh = new THREE.Mesh(rockGeom, rockMat);
  group.add(rockMesh);

  const noseGeom = new THREE.SphereGeometry(5.2, 8, 8);
  const noseMat = new THREE.MeshBasicMaterial({ color: 0xfffcee });
  const noseMesh = new THREE.Mesh(noseGeom, noseMat);
  noseMesh.position.set(0, 0, 7.5);
  group.add(noseMesh);

  const outerTailGeom = new THREE.ConeGeometry(9.5, 280, 7, 1, true);
  outerTailGeom.rotateX(-Math.PI / 2);
  outerTailGeom.translate(0, 0, -135);
  const outerTailMat = new THREE.MeshBasicMaterial({
    color: 0xff4500,
    transparent: true,
    opacity: 0.85,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    depthWrite: false
  });
  const outerTail = new THREE.Mesh(outerTailGeom, outerTailMat);
  group.add(outerTail);

  const coreTailGeom = new THREE.ConeGeometry(4.2, 220, 6, 1, true);
  coreTailGeom.rotateX(-Math.PI / 2);
  coreTailGeom.translate(0, 0, -105);
  const coreTailMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.95,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    depthWrite: false
  });
  const coreTail = new THREE.Mesh(coreTailGeom, coreTailMat);
  group.add(coreTail);

  for (let s = 0; s < 4; s++) {
    const spark = new THREE.Mesh(
      new THREE.DodecahedronGeometry(1.8 + Math.random() * 1.8, 0),
      new THREE.MeshBasicMaterial({ color: (s % 2 === 0 ? 0xffaa00 : 0xff3b00) })
    );
    spark.position.set(
      (Math.random() - 0.5) * 8,
      (Math.random() - 0.5) * 8,
      -25 - Math.random() * 110
    );
    group.add(spark);
  }

  group.visible = false;
  return group;
}

function spawnMeteorImpact(x, y, z) {
  if (!lunarMeteorEvent.group) return;

  const impGroup = new THREE.Group();
  impGroup.position.set(x, y + 1.5, z);

  const flashGeom = new THREE.SphereGeometry(12, 8, 8);
  const flashMat = new THREE.MeshBasicMaterial({ color: 0xfffae0, transparent: true, opacity: 0.95 });
  const flash = new THREE.Mesh(flashGeom, flashMat);
  impGroup.add(flash);

  const ringGeom = new THREE.RingGeometry(3.0, 12.0, 16);
  ringGeom.rotateX(-Math.PI / 2);
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0xff5500,
    transparent: true,
    opacity: 0.9,
    side: THREE.DoubleSide,
    depthWrite: false
  });
  const ring = new THREE.Mesh(ringGeom, ringMat);
  impGroup.add(ring);

  const sparks = [];
  for (let s = 0; s < 5; s++) {
    const spMesh = new THREE.Mesh(
      new THREE.DodecahedronGeometry(2.2 + Math.random() * 2.0, 0),
      new THREE.MeshBasicMaterial({ color: (s % 2 === 0 ? 0xffaa00 : 0xff3b00) })
    );
    impGroup.add(spMesh);
    const spAngle = Math.random() * Math.PI * 2;
    const spSpeed = 80 + Math.random() * 120;
    sparks.push({
      mesh: spMesh,
      vel: new THREE.Vector3(
        Math.cos(spAngle) * spSpeed,
        60 + Math.random() * 90,
        Math.sin(spAngle) * spSpeed
      )
    });
  }

  lunarMeteorEvent.group.add(impGroup);
  lunarMeteorEvent.impactMeshes.push({
    group: impGroup,
    ring: ring,
    flash: flash,
    sparks: sparks,
    life: 0.65,
    maxLife: 0.65
  });

  audio.playBeep(850 + Math.random() * 250, 'triangle', 0.08, 0.12);
  screenShake = Math.max(screenShake, 0.28);
}

function triggerLunarMeteorShower() {
  if (lunarMeteorEvent.triggered) return;
  lunarMeteorEvent.triggered = true;
  lunarMeteorEvent.active = true;
  lunarMeteorEvent.timer = 0;
  lunarMeteorEvent.spawnTimer = 0.2; // First meteor drops almost immediately
  lunarMeteorEvent.spawnedCount = 0;
  lunarMeteorEvent.meteors = [];
  lunarMeteorEvent.impactMeshes = [];

  if (lunarMeteorEvent.group) {
    environmentGroup.remove(lunarMeteorEvent.group);
  }
  lunarMeteorEvent.group = new THREE.Group();
  environmentGroup.add(lunarMeteorEvent.group);

  lunarMeteorEvent.meteorPool = [];
  for (let i = 0; i < 12; i++) {
    const mesh = createMeteorMesh();
    lunarMeteorEvent.group.add(mesh);
    lunarMeteorEvent.meteorPool.push(mesh);
  }

  audio.playBeep(160, 'sawtooth', 0.5, 0.3);
  screenShake = Math.max(screenShake, 0.5);
}

function updateLunarMeteorShower(dt) {
  if (!lunarMeteorEvent.active) return;
  lunarMeteorEvent.timer += dt;
  lunarMeteorEvent.spawnTimer += dt;

  const canSpawnMore = lunarMeteorEvent.spawnedCount < 55 && player.pos.x > -1300;
  if (canSpawnMore && lunarMeteorEvent.spawnTimer >= 0.38) {
    lunarMeteorEvent.spawnTimer = 0;
    lunarMeteorEvent.spawnedCount++;

    const mesh = lunarMeteorEvent.meteorPool.find(m => !m.visible);
    if (mesh) {
      mesh.visible = true;

      const leadDist = 380 + Math.random() * 500;
      const lateralSpread = (Math.random() - 0.5) * 360;
      const targetX = player.pos.x - leadDist;
      const targetZ = -5600 + lateralSpread;
      const targetY = getTerrainHeight(targetX, targetZ, 'moon');

      const streakH = 800 + Math.random() * 350;
      const startX = targetX + (200 + Math.random() * 240);
      const startY = targetY + streakH;
      const startZ = targetZ - 160 - Math.random() * 160;

      const flightDur = 0.85 + Math.random() * 0.35; // 0.85s to 1.2s visible streak

      const dir = new THREE.Vector3(targetX - startX, targetY - startY, targetZ - startZ).normalize();
      mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);

      lunarMeteorEvent.meteors.push({
        mesh: mesh,
        start: new THREE.Vector3(startX, startY, startZ),
        target: new THREE.Vector3(targetX, targetY, targetZ),
        flightDur: flightDur,
        elapsed: 0
      });
    }
  }

  for (let i = lunarMeteorEvent.meteors.length - 1; i >= 0; i--) {
    const m = lunarMeteorEvent.meteors[i];
    m.elapsed += dt;
    const progress = Math.min(1.0, m.elapsed / m.flightDur);

    m.mesh.position.lerpVectors(m.start, m.target, progress);

    if (progress >= 1.0) {
      m.mesh.visible = false;
      lunarMeteorEvent.meteors.splice(i, 1);

      spawnMeteorImpact(m.target.x, m.target.y, m.target.z);
    }
  }

  for (let i = lunarMeteorEvent.impactMeshes.length - 1; i >= 0; i--) {
    const imp = lunarMeteorEvent.impactMeshes[i];
    imp.life -= dt;
    const tNorm = 1.0 - (imp.life / imp.maxLife);

    if (imp.ring) {
      const sc = 1.0 + tNorm * 5.2;
      imp.ring.scale.set(sc, sc, sc);
      imp.ring.material.opacity = (1.0 - tNorm) * 0.9;
    }

    if (imp.flash) {
      imp.flash.scale.set(1.0 + tNorm * 2.5, 1.0 + tNorm * 2.5, 1.0 + tNorm * 2.5);
      imp.flash.material.opacity = Math.max(0, 1.0 - tNorm * 2.5);
    }

    if (imp.sparks) {
      imp.sparks.forEach(sp => {
        sp.mesh.position.addScaledVector(sp.vel, dt);
        sp.vel.y -= 90 * dt;
        sp.mesh.scale.setScalar(Math.max(0.1, 1.0 - tNorm));
      });
    }

    if (imp.life <= 0) {
      if (lunarMeteorEvent.group && imp.group) {
        lunarMeteorEvent.group.remove(imp.group);
      }
      lunarMeteorEvent.impactMeshes.splice(i, 1);
    }
  }

  if (lunarMeteorEvent.spawnedCount >= 55 && lunarMeteorEvent.meteors.length === 0 && lunarMeteorEvent.impactMeshes.length === 0) {
    lunarMeteorEvent.active = false;
  }
}

let runupProgress = 0;
let cliffLaunchPos = new THREE.Vector3();
let cliffForwardDir = new THREE.Vector3();

let playerDraftTimer = 0;

let currentGhostRun = [];
let savedGhostData = null;
let ghostDroneGroup = null;
let ghostFrameIdx = 0;
const ghostCache = {};

let impossibleDifficultyUnlocked = false;
let devFreeCam = false;
let devTimeFrozen = false;
let devFreeCamPos = new THREE.Vector3();
let devFreeCamYaw = 0;
let devFreeCamPitch = 0;
let devWarpTimer = 0;
let devFadeInTimer = 0;

let graphicsQuality = isMobileDevice() ? 'low' : (localStorage.getItem('glider_graphics_quality') || 'low');
let playerShadowMesh = null;

const blobShadowTexture = (() => {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 4, 64, 64, 64);
  g.addColorStop(0, 'rgba(0, 0, 0, 0.95)');
  g.addColorStop(0.35, 'rgba(0, 0, 0, 0.82)');
  g.addColorStop(0.70, 'rgba(0, 0, 0, 0.40)');
  g.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(64, 64, 64, 0, Math.PI * 2);
  ctx.fill();
  const tex = new THREE.CanvasTexture(canvas);
  return tex;
})();

const _upVec = new THREE.Vector3(0, 1, 0);
const _shadowNorm = new THREE.Vector3();

function getSurfaceInfo(x, z, courseKey) {
  const course = COURSES[courseKey];
  const hTerrain = getTerrainHeight(x, z, courseKey);
  const waterLvl = course ? course.waterLevel : -999;
  const isOverWater = (waterLvl > -500 && hTerrain <= waterLvl);

  if (isOverWater) {
    _shadowNorm.set(0, 1, 0);
    return { surfaceY: waterLvl, isVoid: false, normal: _shadowNorm };
  }

  if (hTerrain < -500) {
    return { surfaceY: -999, isVoid: true, normal: _shadowNorm };
  }

  const d = 6.0;
  const hL = getTerrainHeight(x - d, z, courseKey);
  const hR = getTerrainHeight(x + d, z, courseKey);
  const hD = getTerrainHeight(x, z - d, courseKey);
  const hU = getTerrainHeight(x, z + d, courseKey);
  _shadowNorm.set(hL - hR, 2.0 * d, hD - hU).normalize();

  return { surfaceY: hTerrain, isVoid: false, normal: _shadowNorm };
}

function updateShadowMesh(mesh, x, y, z, yaw, courseKey) {
  if (!mesh) return;
  if (graphicsQuality !== 'high') {
    mesh.visible = false;
    return;
  }

  const surf = getSurfaceInfo(x, z, courseKey);
  if (surf.isVoid) {
    mesh.visible = false;
    return;
  }

  const agl = y - surf.surfaceY;

  if (agl > 0 && agl < 1200) {
    mesh.visible = true;
    const n = surf.normal;
    mesh.position.set(x + n.x * 1.4, surf.surfaceY + n.y * 1.4, z + n.z * 1.4);
    mesh.quaternion.setFromUnitVectors(_upVec, n);
    mesh.rotateY(yaw);

    const t = Math.min(1.0, agl / 1200);
    const sc = THREE.MathUtils.lerp(22, 115, t);
    mesh.scale.set(sc, 1, sc * 0.65);

    mesh.material.opacity = THREE.MathUtils.lerp(0.88, 0.40, t);
  } else {
    mesh.visible = false;
  }
}

const waterRippleTexture = (() => {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(size, size);

  let s = 4242;
  const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  const waves = [];
  for (let i = 0; i < 12; i++) {
    waves.push({
      fx: Math.floor(1 + rnd() * 7) * (rnd() > 0.5 ? 1 : -1),
      fy: Math.floor(1 + rnd() * 7),
      amp: 1.0 / (1.0 + i * 0.35),
      ph: rnd() * Math.PI * 2
    });
  }

  const k = 2 * Math.PI / size;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let dhdx = 0, dhdy = 0;
      for (let i = 0; i < waves.length; i++) {
        const w = waves[i];
        const c = Math.cos((w.fx * x + w.fy * y) * k + w.ph) * w.amp * k;
        dhdx += c * w.fx;
        dhdy += c * w.fy;
      }
      // Turn slope into a normal vector
      let nx = -dhdx * 9.0, ny = -dhdy * 9.0, nz = 1.0;
      const len = Math.hypot(nx, ny, nz);
      nx /= len; ny /= len; nz /= len;
      const idx = (y * size + x) * 4;
      img.data[idx]     = (nx * 0.5 + 0.5) * 255;
      img.data[idx + 1] = (ny * 0.5 + 0.5) * 255;
      img.data[idx + 2] = (nz * 0.5 + 0.5) * 255;
      img.data[idx + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  //change ripple ammount
      tex.repeat.set(14, 14);
  return tex;
})();

const COURSE_LIGHTING = {
  canyon: {
    sunColor: 0xfff2dc, sunIntensity: 1.15,
    hemiSky: 0xddeeff, hemiGround: 0x554433, hemiIntensity: 0.85,
    zenith: '#3572a8', mid: '#88c4eb', horiz: '#aad4f5'
  },
  islands: {
    sunColor: 0xfffaee, sunIntensity: 1.05,
    hemiSky: 0xcce8ff, hemiGround: 0x445544, hemiIntensity: 0.80,
    zenith: '#2d5b94', mid: '#6ca6e8', horiz: '#9bc2f2'
  },
  coastal: {
    sunColor: 0x6a849e, sunIntensity: 0.35,
    hemiSky: 0x1a2632, hemiGround: 0x0c141c, hemiIntensity: 0.40,
    zenith: '#080d14', mid: '#121c27', horiz: '#1c2834'
  },
  volcano: {
    sunColor: 0xff5522, sunIntensity: 0.30,
    hemiSky: 0x220e12, hemiGround: 0x100406, hemiIntensity: 0.35,
    zenith: '#050305', mid: '#10070a', horiz: '#1c0c11'
  },
glacial: {
    sunColor: 0xf0faff, sunIntensity: 1.20,
    hemiSky: 0xd4eeff, hemiGround: 0x334a5e, hemiIntensity: 0.85,
    zenith: '#36678e', mid: '#7faed4', horiz: '#a8d3ed'
  },
  moon: {
    sunColor: 0xffffff, sunIntensity: 1.55,
    hemiSky: 0x12141c, hemiGround: 0x050608, hemiIntensity: 0.22,
    zenith: '#010103', mid: '#020205', horiz: '#040508'
  }
};

const skyTextureCache = {};
function getSkyTextureForCourse(courseKey) {
  if (skyTextureCache[courseKey]) return skyTextureCache[courseKey];
  const course = COURSES[courseKey];
  const profile = COURSE_LIGHTING[courseKey];
  if (!course || !profile) return null;

  const canvas = document.createElement('canvas');
  canvas.width = 2;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');

  const grad = ctx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, profile.zenith);
  grad.addColorStop(0.55, profile.mid);
  grad.addColorStop(1.0, profile.horiz);

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 2, 256);

  const tex = new THREE.CanvasTexture(canvas);
  tex.generateMipmaps = false;
  tex.minFilter = THREE.LinearFilter;
  skyTextureCache[courseKey] = tex;
  return tex;
}

function applySkySetting() {
  const course = COURSES[selectedCourseId];
  const profile = COURSE_LIGHTING[selectedCourseId];
  if (!course || !scene) return;

  if (isHalloweenBossDuel) {
    scene.background = new THREE.Color(0x020005);
    if (sunLight) { sunLight.color.setHex(0x550088); sunLight.intensity = 0.25; }
    if (hemiLight) { hemiLight.color.setHex(0x280538); hemiLight.groundColor.setHex(0x0a0014); hemiLight.intensity = 0.35; }
    return;
  }

  if (isHalloweenThemeActive()) {
    scene.background = new THREE.Color(0x220516);
    if (sunLight) { sunLight.color.setHex(0xff4422); sunLight.intensity = 0.85; }
    if (hemiLight) { hemiLight.color.setHex(0x3a1240); hemiLight.groundColor.setHex(0x180612); hemiLight.intensity = 0.70; }
    return;
  }

  if (graphicsQuality === 'high' && profile) {
    scene.background = getSkyTextureForCourse(selectedCourseId);
    if (sunLight) {
      sunLight.color.setHex(profile.sunColor);
      sunLight.intensity = profile.sunIntensity;
    }
    if (hemiLight) {
      hemiLight.color.setHex(profile.hemiSky);
      hemiLight.groundColor.setHex(profile.hemiGround);
      hemiLight.intensity = profile.hemiIntensity;
    }
  } else {
    scene.background = new THREE.Color(course.skyColor);
    if (sunLight) {
      sunLight.color.setHex(0xfff5e4);
      sunLight.intensity = 1.2;
    }
    if (hemiLight) {
      hemiLight.color.setHex(0xffffff);
      hemiLight.groundColor.setHex(0x445566);
      hemiLight.intensity = 0.95;
    }
  }
}

function setGraphicsQuality(quality) {
  graphicsQuality = quality === 'high' ? 'high' : 'low';
  try {
    localStorage.setItem('glider_graphics_quality', graphicsQuality);
  } catch (e) {}

  document.querySelectorAll('.gfx-btn').forEach(btn => {
    if (btn.getAttribute('data-gfx') === graphicsQuality) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  if (renderer) {
    renderer.toneMapping = (graphicsQuality === 'high') ? THREE.ACESFilmicToneMapping : THREE.NoToneMapping;
    renderer.toneMappingExposure = (graphicsQuality === 'high') ? 1.05 : 1.0;
  }

  applySkySetting();

  if (gameState !== 'RACING' && gameState !== 'RUNUP' && typeof buildCourse === 'function' && selectedCourseId) {
    buildCourse(selectedCourseId);
  }

  if (playerShadowMesh) {
    playerShadowMesh.visible = (graphicsQuality === 'high');
  }
  if (aiGliders && aiGliders.length > 0) {
    aiGliders.forEach(ai => {
      if (ai.shadowMesh) ai.shadowMesh.visible = (graphicsQuality === 'high');
    });
  }
}

function createPixelTexture(url) {
    const fallbackCanvas = document.createElement('canvas');
    fallbackCanvas.width = 256;
    fallbackCanvas.height = 128;
    const ctx = fallbackCanvas.getContext('2d');
    ctx.fillStyle = '#ff00ff';
    ctx.fillRect(0, 0, 256, 128);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 34px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('WAYPOINT', 128, 64); // change waypoint to something dummer if found
    
    const fallbackTex = new THREE.CanvasTexture(fallbackCanvas);
    fallbackTex.magFilter = THREE.NearestFilter;
    fallbackTex.minFilter = THREE.NearestFilter;
    fallbackTex.generateMipmaps = false;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    const tex = new THREE.Texture(img);
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.generateMipmaps = false;

    img.onload = () => {
        tex.image = img;
        tex.needsUpdate = true;
        tex.hasUpdatedOnce = true;
    };
    img.onerror = () => {
        tex.image = fallbackCanvas;
        tex.needsUpdate = true;
        tex.hasUpdatedOnce = true;
        console.warn('Image failed to load, using fallback:', url);
    };
    img.src = url;

    if (img.complete && img.naturalWidth) {
        tex.image = img;
        tex.needsUpdate = true;
        tex.hasUpdatedOnce = true;
    } else {
        tex.image = fallbackCanvas;
        tex.needsUpdate = true;
        tex.hasUpdatedOnce = true;
    }
    return tex;
}

const speedometerImg = new Image();
speedometerImg.src = 'speed.png';

const spriteTextures = {
  back: createPixelTexture('16-bit_chaser_back.gif'),
  top: createPixelTexture('16_bite_glider_top.png'),
  left: createPixelTexture('16_bite_glider_left.png'),
  right: createPixelTexture('16_bite_glider_right.png')
};

const waypointTextures = {
  blue: createPixelTexture('bluering.png'),
  gray: createPixelTexture('grayring.png')
};

const waypointMaterials = {
  blue: new THREE.MeshBasicMaterial({
    map: waypointTextures.blue,
    transparent: true,
    alphaTest: 0.05,
    depthWrite: false,
    side: THREE.DoubleSide
  }),
  gray: new THREE.MeshBasicMaterial({
    map: waypointTextures.gray,
    transparent: true,
    alphaTest: 0.05,
    depthWrite: false,
    side: THREE.DoubleSide
  })
};
spriteTextures.bottom = spriteTextures.top;
spriteTextures.rear1 = spriteTextures.back;
spriteTextures.rear2 = spriteTextures.back;

let backGifFrames = [];
let backGifDuration = 0;
let backGifCanvas = null;
let backGifCtx = null;
let lastBackGifFrameIdx = -1;

if (typeof window !== 'undefined' && 'ImageDecoder' in window) {
  try {
    fetch('16-bit_chaser_back.gif')
      .then(res => {
        if (!res.ok) throw new Error('Fetch failed');
        return res.arrayBuffer();
      })
      .then(async buffer => {
        const decoder = new ImageDecoder({ data: buffer, type: 'image/gif' });
        await decoder.tracks.ready;
        const track = decoder.tracks.selectedTrack;
        const count = track ? track.frameCount : 0;
        if (count > 1) {
          const frames = [];
          let totalTime = 0;
          for (let i = 0; i < count; i++) {
            const { image } = await decoder.decode({ frameIndex: i });
            const dur = (image.duration || 100000) / 1000000;
            const c = document.createElement('canvas');
            c.width = image.displayWidth;
            c.height = image.displayHeight;
            const cx = c.getContext('2d');
            cx.drawImage(image, 0, 0);
            frames.push({ canvas: c, duration: dur > 0 ? dur : 0.1 });
            totalTime += dur > 0 ? dur : 0.1;
            image.close();
          }
          if (frames.length > 0) {
            backGifFrames = frames;
            backGifDuration = totalTime;
            backGifCanvas = document.createElement('canvas');
            backGifCanvas.width = frames[0].canvas.width;
            backGifCanvas.height = frames[0].canvas.height;
            backGifCtx = backGifCanvas.getContext('2d');
            backGifCtx.drawImage(frames[0].canvas, 0, 0);
            spriteTextures.back.image = backGifCanvas;
            spriteTextures.back.needsUpdate = true;
          }
        }
      })
      .catch(() => {});
  } catch (e) {}
}

function updateBackGifFrame() {
  if (!backGifFrames || backGifFrames.length <= 1 || !backGifCanvas || !backGifCtx) return;
  const t = (performance.now() * 0.001) % backGifDuration;
  let accumulated = 0;
  let frameIdx = 0;
  for (let i = 0; i < backGifFrames.length; i++) {
    accumulated += backGifFrames[i].duration;
    if (t < accumulated) {
      frameIdx = i;
      break;
    }
  }
  if (frameIdx !== lastBackGifFrameIdx) {
    lastBackGifFrameIdx = frameIdx;
    backGifCtx.clearRect(0, 0, backGifCanvas.width, backGifCanvas.height);
    backGifCtx.drawImage(backGifFrames[frameIdx].canvas, 0, 0);
    spriteTextures.back.needsUpdate = true;
  }
}

function select2DSpriteTexture(localDir) {
  const lx = localDir.x;
  const ly = localDir.y;
  const lz = localDir.z;

  if (ly > 0.58 || ly < -0.58) {
    return spriteTextures.top;
  }

  if (lz > 0.22) {
    if (lx < -0.62) return spriteTextures.left;
    if (lx > 0.62) return spriteTextures.right;
    return spriteTextures.back;
  } else {
    if (lx < -0.2) return spriteTextures.left;
    if (lx > 0.2) return spriteTextures.right;
    return spriteTextures.top;
  }
}

function update2DDroneMesh(droneGroup, cam) {
  if (!droneGroup) return;
  const quad = droneGroup.getObjectByName('spriteDroneQuad') ||
              droneGroup.getObjectByName('shopSpriteQuad') ||
              droneGroup.getObjectByName('shopGliderSpriteQuad');
  if (!quad || !spriteTextures) return;

  _tempVec1.subVectors(cam.position, droneGroup.position);
  const invQuat = droneGroup.quaternion.clone().invert();
  const localDir = _tempVec1.applyQuaternion(invQuat).normalize();

  const tex = select2DSpriteTexture(localDir);
  if (tex) {
    if (tex.image && (tex.image.complete !== false) && !tex.hasUpdatedOnce) {
      tex.needsUpdate = true;
      tex.hasUpdatedOnce = true;
    }
    if (quad.material.map !== tex) {
      quad.material.map = tex;
      quad.material.needsUpdate = true;
    }
    if (tex.image && tex.image.width && tex.image.height) {
    let naturalAspect = 1.0;  // fallback
if (tex.image && tex.image.width > 0 && tex.image.height > 0) {
    naturalAspect = tex.image.width / tex.image.height;
}
const baseAspect = 1.8746;
quad.scale.set(naturalAspect / baseAspect, 1, 1);
    }
  }

  quad.quaternion.copy(droneGroup.quaternion).invert().multiply(cam.quaternion);

  if (tex === spriteTextures.back || tex === spriteTextures.rear1 || tex === spriteTextures.rear2) {
    quad.rotateZ(-droneGroup.rotation.z * 0.75);
  }
}

function showUnlockedMessage() {
  const overlay = document.getElementById('unlocked-message-overlay');
  const img = document.getElementById('unlocked-message-img');
  const fallback = document.getElementById('unlocked-message-fallback');
  if (!overlay) return;

  const isImgBroken = !img || (img.complete && img.naturalWidth === 0);

  if (isImgBroken) {
    if (img) img.style.display = 'none';
    if (fallback) fallback.style.display = 'block';
  } else {
    if (img) img.style.display = 'block';
    if (fallback) fallback.style.display = 'none';
    if (img) {
      img.onerror = () => {
        img.style.display = 'none';
        if (fallback) fallback.style.display = 'block';
      };
    }
  }

  overlay.style.display = 'flex';
  audio.playRecoveryBoost();

  setTimeout(() => {
    overlay.style.display = 'none';
  }, 5000);
}

function triggerDevToolsUnlock() {
  audio.init();
  const devFilter = document.getElementById('dev-filter-overlay');
  const impBtn = document.getElementById('btn-diff-impossible');
  const impGpBtn = document.getElementById('btn-gp-diff-impossible');

  if (impossibleDifficultyUnlocked) {
    if (devFilter) {
      const isVisible = devFilter.style.display === 'block';
      devFilter.style.display = isVisible ? 'none' : 'block';
      if (isVisible) {
        audio.playBeep(260, 'sine', 0.15);
      } else {
        audio.playRecoveryBoost();
      }
    }
    return;
  }

  impossibleDifficultyUnlocked = true;
  showUnlockedMessage();
  
  // Play the custom unlock sound
  const devUnlockSfx = new Audio('impossible_mode_unlock.mp3');
  devUnlockSfx.volume = sfxVolume;
  devUnlockSfx.play().catch(() => {});

  if (devFilter) {
    devFilter.style.display = 'block';
  }
  
  if (impBtn) impBtn.classList.remove('hidden');
  if (impGpBtn) impGpBtn.classList.remove('hidden');

  const mmContainer = document.getElementById('minimap-container');
  if (mmContainer) mmContainer.style.pointerEvents = 'auto';
  if (minimapCanvas) {
    minimapCanvas.style.pointerEvents = 'auto';
    minimapCanvas.style.cursor = 'crosshair';
  }

  const hadAchievement = localStorage.getItem('glider_achieve_devtools') === 'true';
  localStorage.setItem('glider_achieve_devtools', 'true');

  if (!hadAchievement) {
    showAchievementNotifications([{
      name: "Hey Thats The Dev's Tools!"
    }]);
  } else {
    audio.playRecoveryBoost();
  }

  const shopScreen = document.getElementById('screen-shop');
  if (shopScreen && !shopScreen.classList.contains('hidden')) {
    renderShop();
  }
}

const { aphelionApexTexture, aphelionApexEmissiveTexture } = (() => {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');

  const emCanvas = document.createElement('canvas');
  emCanvas.width = 1024;
  emCanvas.height = 256;
  const emCtx = emCanvas.getContext('2d');

  ctx.fillStyle = '#06080c';
  ctx.fillRect(0, 0, 1024, 256);
  emCtx.fillStyle = '#000000';
  emCtx.fillRect(0, 0, 1024, 256);

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.035)';
  ctx.lineWidth = 1;
  for (let x = 0; x < 1024; x += 10) {
    ctx.beginPath();
    ctx.moveTo(x, 0); ctx.lineTo(x, 256);
    ctx.stroke();
  }
  for (let y = 0; y < 256; y += 10) {
    ctx.beginPath();
    ctx.moveTo(0, y); ctx.lineTo(1024, y);
    ctx.stroke();
  }

  // Small sparkling starfield scattered across the surface for APHELION APEX
  let seed = 10842;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  for (let s = 0; s < 220; s++) {
    const sx = rnd() * 1024;
    const sy = 24 + rnd() * 224;
    const sr = 0.75 + rnd() * 1.5;
    const isCyan = rnd() > 0.45;
    const starCol = isCyan ? '#a020f0' : (rnd() > 0.5 ? '#f1c40f' : '#ffffff');
    ctx.fillStyle = starCol;
    ctx.beginPath();
    ctx.arc(sx, sy, sr, 0, Math.PI * 2);
    ctx.fill();

    emCtx.fillStyle = starCol;
    emCtx.beginPath();
    emCtx.arc(sx, sy, sr * 1.2, 0, Math.PI * 2);
    emCtx.fill();
  }

  ctx.fillStyle = '#f1c40f'; // Gold pinstripe
  ctx.fillRect(0, 0, 1024, 4);
  emCtx.fillStyle = '#f1c40f';
  emCtx.fillRect(0, 0, 1024, 4);

  ctx.fillStyle = '#0a0d14'; // Metallic separator
  ctx.fillRect(0, 4, 1024, 2);
  // APHELION APEX
  ctx.fillStyle = '#a020f0'; // Clean purple top border
  ctx.fillRect(0, 0, 1024, 16);
  emCtx.fillStyle = '#a020f0';
  emCtx.fillRect(0, 0, 1024, 16);

  ctx.fillStyle = '#dfb12c';
  ctx.fillRect(0, 16, 1024, 3);
  emCtx.fillStyle = '#dfb12c';
  emCtx.fillRect(0, 16, 1024, 3);

  ctx.save();
  ctx.translate(512, 128);
  ctx.fillStyle = '#ffffff';
  ctx.font = '900 22px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('APHELION APEX', 0, 8);
  emCtx.save();
  emCtx.translate(512, 128);
  emCtx.fillStyle = '#a020f0';
  emCtx.font = '900 22px monospace';
  emCtx.textAlign = 'center';
  emCtx.fillText('APHELION APEX', 0, 8);
  ctx.restore();
  emCtx.restore();

  // Wingtip trim
  [0, 1008].forEach((wx) => {
    ctx.fillStyle = '#a020f0';
    ctx.fillRect(wx, 20, 16, 220);
    emCtx.fillStyle = '#a020f0';
    emCtx.fillRect(wx, 20, 16, 220);
    ctx.fillStyle = '#a020f0';
    ctx.fillRect(wx + 4, 28, 8, 200);
    emCtx.fillStyle = '#a020f0';
    emCtx.fillRect(wx + 4, 28, 8, 200);
  });

  const diffTex = new THREE.CanvasTexture(canvas);
  const emTex = new THREE.CanvasTexture(emCanvas);
  return { aphelionApexTexture: diffTex, aphelionApexEmissiveTexture: emTex };
})();

const { halloweenGliderTexture, halloweenGliderEmissiveTexture } = (() => {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');

  const emCanvas = document.createElement('canvas');
  emCanvas.width = 1024;
  emCanvas.height = 256;
  const emCtx = emCanvas.getContext('2d');

  ctx.fillStyle = '#ff6600';
  ctx.fillRect(0, 0, 1024, 256);
  emCtx.fillStyle = '#000000';
  emCtx.fillRect(0, 0, 1024, 256);

  for (let x = 0; x < 1024; x += 48) {
    ctx.fillStyle = 'rgba(70, 22, 0, 0.45)';
    ctx.fillRect(x, 0, 6, 256);
    ctx.fillStyle = 'rgba(255, 150, 40, 0.40)';
    ctx.fillRect(x + 6, 0, 4, 256);
  }

  ctx.fillStyle = '#1c0f06';
  ctx.fillRect(0, 0, 1024, 18);
  ctx.fillRect(0, 238, 1024, 18);

  const cx = 512, cy = 128;
  const drawFace = (targetCtx, fillCol) => {
    targetCtx.fillStyle = fillCol;
    // Eyes
    targetCtx.beginPath();
    targetCtx.moveTo(cx - 75, cy - 25);
    targetCtx.lineTo(cx - 30, cy - 60);
    targetCtx.lineTo(cx - 20, cy - 20);
    targetCtx.closePath();
    targetCtx.fill();

    targetCtx.beginPath();
    targetCtx.moveTo(cx + 75, cy - 25);
    targetCtx.lineTo(cx + 30, cy - 60);
    targetCtx.lineTo(cx + 20, cy - 20);
    targetCtx.closePath();
    targetCtx.fill();

    // Nose
    targetCtx.beginPath();
    targetCtx.moveTo(cx, cy - 35);
    targetCtx.lineTo(cx - 15, cy - 10);
    targetCtx.lineTo(cx + 15, cy - 10);
    targetCtx.closePath();
    targetCtx.fill();

    // Jagged wicked grin
    targetCtx.beginPath();
    targetCtx.moveTo(cx - 110, cy + 15);
    targetCtx.lineTo(cx - 75, cy + 30);
    targetCtx.lineTo(cx - 50, cy + 18);
    targetCtx.lineTo(cx - 25, cy + 34);
    targetCtx.lineTo(cx, cy + 20);
    targetCtx.lineTo(cx + 25, cy + 34);
    targetCtx.lineTo(cx + 50, cy + 18);
    targetCtx.lineTo(cx + 75, cy + 30);
    targetCtx.lineTo(cx + 110, cy + 15);
    targetCtx.lineTo(cx + 80, cy + 46);
    targetCtx.lineTo(cx + 45, cy + 38);
    targetCtx.lineTo(cx + 20, cy + 50);
    targetCtx.lineTo(cx, cy + 36);
    targetCtx.lineTo(cx - 20, cy + 50);
    targetCtx.lineTo(cx - 45, cy + 38);
    targetCtx.lineTo(cx - 80, cy + 46);
    targetCtx.closePath();
    targetCtx.fill();
  };

  drawFace(ctx, '#1a0500');
  drawFace(emCtx, '#ffaa00');

  [80, 944].forEach(bx => {
    ctx.fillStyle = '#1c0f06';
    ctx.beginPath();
    ctx.arc(bx, 128, 28, 0, Math.PI * 2);
    ctx.fill();
    emCtx.fillStyle = '#ff4400';
    emCtx.beginPath();
    emCtx.arc(bx, 128, 30, 0, Math.PI * 2);
    emCtx.fill();
  });

  const diffTex = new THREE.CanvasTexture(canvas);
  const emTex = new THREE.CanvasTexture(emCanvas);
  return { halloweenGliderTexture: diffTex, halloweenGliderEmissiveTexture: emTex };
})();

const { santaGliderTexture, santaGliderEmissiveTexture } = (() => {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');

  const emCanvas = document.createElement('canvas');
  emCanvas.width = 1024;
  emCanvas.height = 256;
  const emCtx = emCanvas.getContext('2d');

  ctx.fillStyle = '#b81420';
  ctx.fillRect(0, 0, 1024, 256);
  emCtx.fillStyle = '#000000';
  emCtx.fillRect(0, 0, 1024, 256);

  ctx.fillStyle = '#f5f6fa';
  ctx.fillRect(0, 0, 1024, 18);
  ctx.fillRect(0, 238, 1024, 18);
  emCtx.fillStyle = '#444444';
  emCtx.fillRect(0, 0, 1024, 18);
  emCtx.fillRect(0, 238, 1024, 18);

  ctx.fillStyle = '#dfb12c';
  ctx.fillRect(0, 18, 1024, 4);
  ctx.fillRect(0, 234, 1024, 4);
  emCtx.fillStyle = '#dfb12c';
  emCtx.fillRect(0, 18, 1024, 4);
  emCtx.fillRect(0, 234, 1024, 4);

  let seed = 1225;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  for (let s = 0; s < 140; s++) {
    const sx = rnd() * 1024;
    const sy = 28 + rnd() * 200;
    const sr = 1.0 + rnd() * 1.5;
    ctx.fillStyle = rnd() > 0.5 ? '#dfb12c' : '#ffffff';
    ctx.beginPath();
    ctx.arc(sx, sy, sr, 0, Math.PI * 2);
    ctx.fill();
    emCtx.fillStyle = '#dfb12c';
    emCtx.beginPath();
    emCtx.arc(sx, sy, sr * 1.2, 0, Math.PI * 2);
    emCtx.fill();
  }

  const cx = 512, cy = 128;
  ctx.fillStyle = '#222222';
  ctx.fillRect(0, cy - 14, 1024, 28);
  ctx.fillStyle = '#dfb12c';
  ctx.fillRect(cx - 32, cy - 22, 64, 44);
  ctx.fillStyle = '#222222';
  ctx.fillRect(cx - 20, cy - 12, 40, 24);
  ctx.fillStyle = '#dfb12c';
  ctx.fillRect(cx - 5, cy - 12, 10, 24);

  emCtx.fillStyle = '#dfb12c';
  emCtx.fillRect(cx - 32, cy - 22, 64, 44);
  emCtx.fillStyle = '#000000';
  emCtx.fillRect(cx - 20, cy - 12, 40, 24);
  emCtx.fillStyle = '#dfb12c';
  emCtx.fillRect(cx - 5, cy - 12, 10, 24);

  [0, 1008].forEach(wx => {
    ctx.fillStyle = '#dfb12c';
    ctx.fillRect(wx, 20, 16, 216);
    emCtx.fillStyle = '#dfb12c';
    emCtx.fillRect(wx, 20, 16, 216);
  });

  const diffTex = new THREE.CanvasTexture(canvas);
  const emTex = new THREE.CanvasTexture(emCanvas);
  return { santaGliderTexture: diffTex, santaGliderEmissiveTexture: emTex };
})();

function isHalloweenGliderEquipped() {
  return getEquippedSkinId() === 'glider_halloween';
}

function isHalloweenThemeActive() {
  return HALLOWEEN_EVENT_ACTIVE || isHalloweenBossDuel || isHalloweenGliderEquipped();
}

const GLIDER_SKINS = [
  {
    id: 'glider_santa',
    name: 'Santa Glider',
    colorName: 'Velvet Red',
    color: 0xc41220,
    previewColor: '#c41220',
    emissive: 0xdfb12c,
    emissiveIntensity: 0.45,
    roughness: 0.3,
    metalness: 0.4,
    isGlowing: true,
    reqText: 'Unlock during Christmas event!',
    checkUnlocked: () => !!localStorage.getItem('glider_unlocked_santa')
  },
  {
    id: 'glider_halloween',
    name: 'Jack-o\'-Lantern',
    colorName: 'Pumpkin',
    color: 0xff6600,
    previewColor: '#ff6600',
    emissive: 0xff4500,
    emissiveIntensity: 0.75,
    roughness: 0.35,
    metalness: 0.15,
    isGlowing: true,
    reqText: 'Unlock during halloween event!',
    checkUnlocked: () => !!localStorage.getItem('glider_unlocked_halloween')
  },
  {
    id: 'glider_16bit',
    name: '16-bit glider',
    colorName: '2D Pixel Sprite',
    color: 0xffffff,
    previewColor: '#ffffff',
    roughness: 0.5,
    metalness: 0.1,
    is2D: true,
    reqText: 'Achievement: "Hey Thats The Dev\'s Tools!"',
    checkUnlocked: (stats) => !!stats.hasDevTools
  },
  {
    id: 'default',
    name: 'Default Red',
    colorName: 'Red',
    color: 0xee2233,
    previewColor: '#ee2233',
    roughness: 0.35,
    metalness: 0.1,
    reqText: 'Default canopy. (No achievements required)',
    checkUnlocked: () => true
  },
  {
    id: 'lava_core',
    name: 'Lava Forged Core',
    colorName: 'Molten Lava / Ember Glow',
    color: 0xcc3300,
    previewColor: '#cc3300',
    emissive: 0xff6600,
    emissiveIntensity: 0.9,
    roughness: 0.4,
    metalness: 0.6,
    isGlowing: true,
    reqText: 'Complete Volcano Track C (Gold or better) to unlock',
    checkUnlocked: (stats) => {
      const pb = parseFloat(localStorage.getItem('pb_volcano_C'));
      if (pb === null || isNaN(pb)) return false;
      return pb <= 190;
    }
  },
{
    id: 'lunar_voyager',
    name: 'Apollo Voyager',
    colorName: 'Kapton Gold / Lunar White',
    color: 0xe5a93b,
    previewColor: '#e5a93b',
    emissive: 0xffaa00,
    emissiveIntensity: 0.55,
    roughness: 0.28,
    metalness: 0.72,
    isGlowing: true,
    reqText: 'Complete Moon Track C (Gold or better) to unlock',
    checkUnlocked: (stats) => {
      const pb = parseFloat(localStorage.getItem('pb_moon_C'));
      if (pb === null || isNaN(pb)) return false;
      return pb <= 136;
    }
  },
  {
    id: 'glider_tv_static',
    name: 'Channel 3',
    colorName: 'TV Static',
    color: 0xffffff,
    previewColor: '#ffffff',
    roughness: 0.25,
    metalness: 0.2,
    isGlowing: true,
    reqText: 'Mess around with the shop TV',
    checkUnlocked: (stats) => !!stats.hasTvEasterEgg
  },
  {
    id: 'first_silver',
    name: 'The Beginning Of A Pro',
    colorName: 'Chrome / Silver',
    color: 0xd0d7de,
    previewColor: '#d0d7de',
    roughness: 0.12,
    metalness: 0.95,
    reqText: 'Earn your first Silver medal (or higher) on any track.',
    checkUnlocked: (stats) => stats.hasSilver
  },
  {
    id: 'all_bronze',
    name: 'First Time!',
    colorName: 'Copper / Bronze',
    color: 0xc87533,
    previewColor: '#c87533',
    roughness: 0.28,
    metalness: 0.75,
    reqText: 'Earn a Bronze medal or better on any 5 tracks.',
    checkUnlocked: (stats) => stats.totalBronzeOrBetter >= 5
  },
  {
    id: 'first_gold',
    name: 'Wow! Im Fast',
    colorName: 'Satin Gold',
    color: 0xdfb12c,
    previewColor: '#dfb12c',
    roughness: 0.45,
    metalness: 0.5,
    reqText: 'Earn your first Gold medal (or higher) on any track.',
    checkUnlocked: (stats) => stats.hasGold
  },
  {
    id: 'all_silver',
    name: 'Silver Glider',
    colorName: 'Platinum / White-Silver',
    color: 0xeef2f6,
    previewColor: '#eef2f6',
    roughness: 0.18,
    metalness: 0.85,
    reqText: 'Earn a Silver medal or better on any 10 tracks.',
    checkUnlocked: (stats) => stats.totalSilverOrBetter >= 10
  },
  {
    id: 'all_gold',
    name: 'Golden Glider!',
    colorName: 'Rich Polished Gold',
    color: 0xffcc00,
    previewColor: '#ffcc00',
    roughness: 0.15,
    metalness: 0.95,
    reqText: 'Earn a Gold medal or better on any 14 tracks.',
    checkUnlocked: (stats) => stats.totalGoldOrBetter >= 14
  },
  {
    id: 'aphelion_apex',
    name: 'Aphelion Apex',
    colorName: 'Purple Starlight',
    color: 0x06080c,
    previewColor: '#a020f0',
    emissive: 0xa020f0,
    emissiveIntensity: 0.55,
    roughness: 0.18,
    metalness: 0.85,
    isGlowing: true,
    reqText: 'Earn 3 stars in all 6 Grand Prix Cups (defeat Insane AI in every race)',
    checkUnlocked: () => {
      const cups = ['sunrise', 'ember', 'gale', 'aether', 'odyssey', 'aphelion'];
      return cups.every(c => (parseInt(localStorage.getItem(`gp_stars_${c}`) || '0', 10) >= 3));
    }
  },
  {
    id: 'all_ace',
    name: 'The Greatest Glider To Ever Live',
    colorName: 'Glowing 24k Pure Violet Gold',
    color: 0x4A148C,
    previewColor: '#4A148C',
    emissive: 0x4A148C,
    emissiveIntensity: 0.65,
    roughness: 0.05,
    metalness: 0.98,
    isGlowing: true,
    reqText: 'Earn Ace medals on all 20 tracks IN TIME TRIALS',
    checkUnlocked: (stats) => stats.totalAceOrBetter >= 20 && stats.hasGhost
  }
];

const GHOST_SKINS = [
  {
    id: 'ghost_krampus',
    name: 'Krampus Drone',
    colorName: 'Shadow Black & Horns',
    color: 0x0a0a0a,
    previewColor: '#0a0a0a',
    emissive: 0x000000,
    emissiveIntensity: 0.0,
    roughness: 0.25,
    metalness: 0.85,
    isGlowing: false,
    reqText: 'Unlocked During Christmas Event.',
    checkUnlocked: () => !!localStorage.getItem('glider_unlocked_krampus_ghost')
  },
  {
    id: 'ghost_16bit',
    name: '16-bit Chaser',
    colorName: '2D Pixel Sprite',
    color: 0xffffff,
    previewColor: '#ffffff',
    roughness: 0.5,
    metalness: 0.1,
    is2D: true,
    reqText: 'Achievement: "Hey Thats The Dev\'s Tools!"',
    checkUnlocked: (stats) => !!stats.hasDevTools
  },
  {
    id: 'ghost_default',
    name: 'Default Red Drone',
    colorName: 'Crimson Red',
    color: 0xee2233,
    previewColor: '#ee2233',
    roughness: 0.35,
    metalness: 0.1,
    reqText: 'Standard Time Trial ghost drone.',
    checkUnlocked: () => true
  },
  {
    id: 'ghost_purple',
    name: 'Purple Drone',
    colorName: 'Purple',
    color: 0xca8aff,
    previewColor: '#ca8aff',
    emissive: 0x6e22cc,
    emissiveIntensity: 0.45,
    roughness: 0.2,
    metalness: 0.7,
    reqText: 'Earn your first Gold medal in Time Trials.',
    checkUnlocked: (stats) => stats.hasGold
  },
  {
    id: 'ghost_gold',
    name: '24k Golden Drone',
    colorName: 'Pure Gold Interceptor',
    color: 0xffc312,
    previewColor: '#ffc312',
    emissive: 0xe67e22,
    emissiveIntensity: 0.4,
    roughness: 0.18,
    metalness: 0.92,
    isGlowing: true,
    reqText: 'Earn Ace medals on any 18 tracks + record a Ghost (TIME TRIAL ONLY).',
    checkUnlocked: (stats) => stats.totalAceOrBetter >= 18 && stats.hasGhost
  }
];

let shopRenderer = null;
let shopScene = null;
let shopCamera = null;
let shopGliderGroup = null;
let shopGliderCanopy = null;
let shopDroneGroup = null;
let pausedState = 'RACING';

let inspectedType = 'glider';
let inspectedGliderId = 'default';
let inspectedGhostId = 'ghost_default';

const _tempVec1 = new THREE.Vector3();
const _tempVec2 = new THREE.Vector3();
const _trackDirVec = new THREE.Vector3();
const _targetWp = new THREE.Vector3();
const _toTarget = new THREE.Vector3();
const _playerForward = new THREE.Vector3();

const weather = {
  windAngle: 0,
  targetWindAngle: 0,
  windSpeed: 12,
  targetWindSpeed: 12,
  windVector: new THREE.Vector3(),
  rainIntensity: 0.0,
  targetRainIntensity: 0.0,
  fogBaseDensity: 0.00015,
  weatherTimer: 0,
  conditionText: 'CLEAR',
  isStormy2X: false,
  lightningTimer: 0,
  lightningFlash: 0
};

const stallMechanic = {
  active: false,
  recoveryWindowTimer: 0,
  bonusBannerTimer: 0,
  canBonus: true
};

const rudderBoost = {
  charging: false,
  chargeTimer: 0,
  cooldownTimer: 0,
  rearmed: true,
  releasePitch: 0,
  activeDir: 0
};

const player = {
  pos: new THREE.Vector3(0, 350, 0),
  pitch: 0,
  yaw: 0,
  roll: 0,
  flightPathPitch: 0,
  speed: 0,
  targetPitch: 0,
  targetRoll: 0,
  rudderDeflection: 0,
  nextGateIdx: 1,
  rank: 1,
  airbrake: false,
  inThermal: false,
  verticalVelocity: 0
};

const isMobileDeviceCheck = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0) || window.matchMedia('(pointer: coarse)').matches;
const rainParticles = [];
for (let i = 0; i < (isMobileDeviceCheck ? 50 : 110); i++) {
  rainParticles.push({
    x: (Math.random() - 0.5) * 800,
    y: (Math.random() - 0.5) * 600,
    len: 12 + Math.random() * 24,
    speed: 18 + Math.random() * 28
  });
}

const keys = {};
let mouseX = 0, mouseY = 0;
let mouseLeftPressed = false, mouseRightPressed = false;
let restartHoldTimer = 0, restartPromptOpacity = 0;

const COURSES = {
  canyon: {
    name: "Mountain Canyons",
    skyColor: 0x88c4eb, fogColor: 0xaad4f5, fogDensity: 0.00014,
    groundColor: 0x5a4838, grassColor: 0x2e5927, snowColor: 0xffffff,
    waterColor: 0x1f5c8b, waterLevel: 15,
    cliffPos: new THREE.Vector3(0, 420, 0),
    cliffForward: new THREE.Vector3(0, -0.04, -1).normalize(),
    bounds: { minX: -5000, maxX: 5000, minZ: -11500, maxZ: 800 },
    subtracks: {
      A: {
        name: "Red Rock Slalom",
        desc: "Low altitude canyon carving along river thermals.",
        waypoints: [
          new THREE.Vector3(0, 410, -140),
          new THREE.Vector3(600, 390, -1800),
          new THREE.Vector3(2200, 380, -4200),
          new THREE.Vector3(1200, 380, -6800),
          new THREE.Vector3(-1200, 440, -8400),
          new THREE.Vector3(-3400, 560, -5800),
          new THREE.Vector3(-2200, 460, -2800),
          new THREE.Vector3(-600, 430, -1000),
          new THREE.Vector3(0, 410, -140)
        ],
        thermals: [
          { pos: new THREE.Vector3(600, 290, -1800), radius: 340, boost: 38 },
          { pos: new THREE.Vector3(-1200, 240, -8400), radius: 360, boost: 42 },
          { pos: new THREE.Vector3(-3400, 340, -5800), radius: 340, boost: 40 },
          { pos: new THREE.Vector3(1700, 230, -5500), radius: 340, boost: 38 },
        ],
        medals: { bronze: 120, silver: 100, gold: 92, ace: 85 }
      },
      B: {
        name: "Needle Peak Ascent",
        desc: "Climb through north snow peaks and needle spires ",
        waypoints: [
          new THREE.Vector3(0, 410, -140),
          new THREE.Vector3(-1600, 560, -1800),
          new THREE.Vector3(-3600, 660, -4200),
          new THREE.Vector3(-4200, 680, -7200),
          new THREE.Vector3(-2200, 590, -9600),
          new THREE.Vector3(600, 540, -9200),
          new THREE.Vector3(2600, 560, -6200),
          new THREE.Vector3(1200, 480, -2600),
          new THREE.Vector3(0, 410, -140)
        ],
        thermals: [
          { pos: new THREE.Vector3(-3600, 480, -4200), radius: 380, boost: 44 },
          { pos: new THREE.Vector3(-2200, 420, -9600), radius: 400, boost: 45 },
          { pos: new THREE.Vector3(2600, 380, -6200), radius: 360, boost: 42 },
          { pos: new THREE.Vector3(-1600, 250, -1800), radius: 360, boost: 42 },
        ],
        sinks: [
          { pos: new THREE.Vector3(-3200, 550, -8400), radius: 300, strength: 150 }
        ],
        medals: { bronze: 145, silver: 121, gold: 111, ace: 103 }
      },
      C: {
        name: "Grand Canyon",
        desc: "The GRAND canyons tour!",
        waypoints: [
          new THREE.Vector3(0, 410, -140),    
          new THREE.Vector3(1800, 580, -1600),  
          new THREE.Vector3(4000, 600, -3800),  
          new THREE.Vector3(4500, 700, -6000),  
          new THREE.Vector3(3500, 800, -8500),  
          new THREE.Vector3(1500, 750, -10000), 
          new THREE.Vector3(0, 700, -10500),
          new THREE.Vector3(-2800, 800, -10500),
        ],
        thermals: [
          { pos: new THREE.Vector3(0, 210, -140), radius: 380, boost: 44 },
          { pos: new THREE.Vector3(4500, 500, -6000), radius: 420, boost: 44 },
          { pos: new THREE.Vector3(1500, 550, -10000), radius: 400, boost: 42 },
        ],
        sinks: [
          { pos: new THREE.Vector3(2900, 550, -2700), radius: 300, strength: 150 },
          { pos: new THREE.Vector3(4000, 700, -7250), radius: 300, strength: 150 },
          { pos: new THREE.Vector3(-1400, 680, -10500), radius: 280, strength: 150 },
        ],
          medals: { bronze: 102, silver: 85, gold: 78, ace: 72 }
      },
      D: {
        name: "Aphelion Horizon",
        desc: "Reach the bounds where no glider dares too!",
        waypoints: [
          new THREE.Vector3(0, 410, -140),
          new THREE.Vector3(1400, 480, -2000),
          new THREE.Vector3(4200, 550, -3500),
          new THREE.Vector3(8000, 620, -4000),
          new THREE.Vector3(11500, 680, -5500),
          new THREE.Vector3(12000, 720, -9000),
          new THREE.Vector3(9500, 750, -12500),
          new THREE.Vector3(4500, 780, -13500),
          new THREE.Vector3(0, 800, -13800),
          new THREE.Vector3(-4500, 780, -13500),
          new THREE.Vector3(-9500, 750, -12500),
          new THREE.Vector3(-12000, 720, -9000),
          new THREE.Vector3(-11500, 680, -5500),
          new THREE.Vector3(-8000, 600, -2500),
          new THREE.Vector3(-5000, 540, 500),
          new THREE.Vector3(-2500, 500, 2000),
          new THREE.Vector3(0, 480, 2400),
          new THREE.Vector3(0, 480, 1200),
          new THREE.Vector3(0, 440, 300),
          new THREE.Vector3(0, 410, -140)
        ],
        thermals: [
          { pos: new THREE.Vector3(1400, 280, -2000), radius: 440, boost: 48 },
          { pos: new THREE.Vector3(11500, 480, -5500), radius: 450, boost: 50 },
          { pos: new THREE.Vector3(9500, 550, -12500), radius: 450, boost: 50 },
          { pos: new THREE.Vector3(0, 600, -13800), radius: 460, boost: 52 },
          { pos: new THREE.Vector3(-9500, 550, -12500), radius: 450, boost: 50 },
          { pos: new THREE.Vector3(-11500, 480, -5500), radius: 450, boost: 50 },
          { pos: new THREE.Vector3(0, 280, 2400), radius: 440, boost: 48 }
        ],
        sinks: [
          { pos: new THREE.Vector3(6100, 580, -3750), radius: 300, strength: 150 },
          { pos: new THREE.Vector3(-6500, 570, -1000), radius: 300, strength: 150 },
          { pos: new THREE.Vector3(-3750, 520, 1250), radius: 300, strength: 150 },
          { pos: new THREE.Vector3(0, 460, 750), radius: 280, strength: 140 }
        ],
        medals: { bronze: 382, silver: 319, gold: 293, ace: 270 }
      }
    }
  },
  islands: {
    name: "Sky islands & ruins",
    skyColor: 0x6ca6e8, fogColor: 0x9bc2f2, fogDensity: 0.00012,
    groundColor: 0x3d473b, grassColor: 0x3f6b36, snowColor: 0xe0e6eb,
    waterColor: 0x1a3348, waterLevel: -999,
    cliffPos: new THREE.Vector3(0, 680, 0),
    cliffForward: new THREE.Vector3(0, -0.04, -1).normalize(),
    bounds: { minX: -5500, maxX: 5500, minZ: -11000, maxZ: 800 },
    subtracks: {
      A: {
        name: "Broken Gates",
        desc: "Weave through ancient ruin gates & sky colonnades.",
        waypoints: [
          new THREE.Vector3(0, 700, -240),
          new THREE.Vector3(1400, 720, -2200),
          new THREE.Vector3(3200, 620, -4800),
          new THREE.Vector3(2200, 860, -7800),
          new THREE.Vector3(-800, 750, -9200),
          new THREE.Vector3(-3200, 680, -6200),
          new THREE.Vector3(-2200, 800, -2800),
          new THREE.Vector3(0, 700, -240)
        ],
        thermals: [
          { pos: new THREE.Vector3(0, 600, -600), radius: 340, boost: 44 },
          { pos: new THREE.Vector3(3200, 420, -4800), radius: 420, boost: 46 },
          { pos: new THREE.Vector3(-800, 540, -9200), radius: 420, boost: 44 }
        ],
        sinks: [
          { pos: new THREE.Vector3(2200, 600, -3600), radius: 300, strength: 150 },
          { pos: new THREE.Vector3(-2000, 620, -6400), radius: 320, strength: 150 }
        ],
        medals: { bronze: 134, silver: 112, gold: 103, ace: 95 }
      },
      B: {
        name: "Abyssal",
        desc: "High risk plunge into the cloud base with updraft elevator.",
        waypoints: [
          new THREE.Vector3(0, 700, -240),
          new THREE.Vector3(-1800, 660, -1900),
          new THREE.Vector3(-3600, 560, -4400),
          new THREE.Vector3(-3800, 520, -7600),
          new THREE.Vector3(-1600, 740, -9800),
          new THREE.Vector3(1600, 720, -8800),
          new THREE.Vector3(3000, 640, -5400),
          new THREE.Vector3(1600, 740, -2100),
          new THREE.Vector3(0, 700, -240)
        ],
        thermals: [
          { pos: new THREE.Vector3(-1800, 360, -1900), radius: 450, boost: 48 },
          { pos: new THREE.Vector3(-3600, 320, -4400), radius: 450, boost: 48 },
          { pos: new THREE.Vector3(-3800, 260, -7600), radius: 460, boost: 50 },
          { pos: new THREE.Vector3(1600, 480, -8800), radius: 400, boost: 44 }
        ],
        sinks: [
          { pos: new THREE.Vector3(-2700, 480, -3150), radius: 340, strength: 150 },
          { pos: new THREE.Vector3(800, 720, -1170), radius: 300, strength: 150 }
        ],
        medals: { bronze: 147, silver: 123, gold: 112, ace: 104 }
      },
      C: {
        name: "Sky Citadel",
        desc: "The GRAND Sky Islands tour!",
        waypoints: [
          new THREE.Vector3(0, 700, -240),      
          new THREE.Vector3(1200, 650, -2200),   
          new THREE.Vector3(2400, 850, -4200),   
          new THREE.Vector3(400, 620, -5700),    
          new THREE.Vector3(-1200, 480, -6100),  
          new THREE.Vector3(-3200, 560, -6200),   
          new THREE.Vector3(-1600, 500, -10500), 
          new THREE.Vector3(1800, 720, -10500),
        ],
        thermals: [
          { pos: new THREE.Vector3(1200, 100, -2200), radius: 400, boost: 46 },
          { pos: new THREE.Vector3(2400, 650, -4200), radius: 420, boost: 48 },
          { pos: new THREE.Vector3(-3200, 360, -6200), radius: 420, boost: 46 }
        ],
        sinks: [
          { pos: new THREE.Vector3(1400, 500, -4800), radius: 300, strength: 150 },
          { pos: new THREE.Vector3(-2000, 500, -6100), radius: 310, strength: 150 },
          { pos: new THREE.Vector3(100, 600, -10350), radius: 300, strength: 150 }
        ],
        medals: { bronze: 111, silver: 93, gold: 85, ace: 78 }
      }
    }
  },
  coastal: {
    name: "Stormy Coastal cliffs",
    skyColor: 0x1a2634, fogColor: 0x223242, fogDensity: 0.00018,
    groundColor: 0x282e30, grassColor: 0x223c2a, snowColor: 0x829191,
    waterColor: 0x0a2233, waterLevel: 8,
    cliffPos: new THREE.Vector3(0, 460, 0),
    cliffForward: new THREE.Vector3(0, -0.04, -1).normalize(),
    bounds: { minX: -6500, maxX: 6500, minZ: -12000, maxZ: 800 },
    subtracks: {
      A: {
        name: "Storm Beacon",
        desc: "Ocean sea stack run clear of the headland lighthouse ",
        waypoints: [
          new THREE.Vector3(0, 480, -220),
          new THREE.Vector3(-1200, 460, -2200),
          new THREE.Vector3(-3000, 420, -4800),
          new THREE.Vector3(-1400, 580, -7400),
          new THREE.Vector3(1800, 580, -8600),
          new THREE.Vector3(3200, 460, -5800),
          new THREE.Vector3(1800, 520, -2200),
          new THREE.Vector3(0, 480, -220)
        ],
        thermals: [
          { pos: new THREE.Vector3(-600, 270, -1210), radius: 440, boost: 44 },
          { pos: new THREE.Vector3(-3000, 240, -4800), radius: 440, boost: 44 },
          { pos: new THREE.Vector3(1800, 320, -8600), radius: 420, boost: 42 },
          { pos: new THREE.Vector3(1600, 320, -3200), radius: 380, boost: 40 }
        ],
        sinks: [
          { pos: new THREE.Vector3(-2000, 420, -3500), radius: 310, strength: 150 },
          { pos: new THREE.Vector3(2600, 440, -7200), radius: 300, strength: 150 }
        ],
        medals: { bronze: 127, silver: 106, gold: 98, ace: 90 }
      },
      B: {
        name: "Ghost Fleet",
        desc: "Over-ocean gauntlet skimming cargo ships.",
        waypoints: [
          new THREE.Vector3(0, 480, -220),
          new THREE.Vector3(-2200, 540, -1800),
          new THREE.Vector3(-4400, 420, -4000),
          new THREE.Vector3(-4800, 400, -7400),
          new THREE.Vector3(-2600, 540, -9800),
          new THREE.Vector3(800, 540, -10000),
          new THREE.Vector3(3000, 460, -7400),
          new THREE.Vector3(1400, 500, -3800),
          new THREE.Vector3(0, 480, -220)
        ],
        thermals: [
          { pos: new THREE.Vector3(0, 280, -220), radius: 450, boost: 46 },
          { pos: new THREE.Vector3(-4400, 220, -4000), radius: 450, boost: 46 },
          { pos: new THREE.Vector3(-2600, 280, -9800), radius: 440, boost: 44 },
          { pos: new THREE.Vector3(1800, 240, -6000), radius: 420, boost: 42 }
        ],
        sinks: [
          { pos: new THREE.Vector3(-3400, 380, -3000), radius: 320, strength: 150 },
          { pos: new THREE.Vector3(-4000, 380, -6000), radius: 330, strength: 150 },
          { pos: new THREE.Vector3(2000, 420, -8400), radius: 310, strength: 150 }
        ],
        medals: { bronze: 159, silver: 133, gold: 122, ace: 113 }
      },
      C: {
        name: "Jagged Horizon",
        desc: "The GRAND coastal cliffs tour!",
        waypoints: [
          new THREE.Vector3(0, 480, -220),
          new THREE.Vector3(2000, 500, -2000), 
          new THREE.Vector3(4000, 520, -4000),  
          new THREE.Vector3(5000, 560, -6000),  
          new THREE.Vector3(5000, 600, -8500),  
          new THREE.Vector3(3000, 650, -10500), 
          new THREE.Vector3(0, 600, -11000),    
          new THREE.Vector3(-3000, 550, -10000),
          new THREE.Vector3(-4000, 500, -8000),
        ],
        thermals: [
          { pos: new THREE.Vector3(2000, 200, -2000), radius: 420, boost: 44 },
          { pos: new THREE.Vector3(4000, 400, -5000), radius: 420, boost: 44 },
          { pos: new THREE.Vector3(0, 300, -11000), radius: 400, boost: 42 }
        ],
        sinks: [
          { pos: new THREE.Vector3(3800, 580, -9400), radius: 300, strength: 150 },
          { pos: new THREE.Vector3(-3500, 520, -9000), radius: 310, strength: 150 }
        ],
        medals: { bronze: 127, silver: 106, gold: 97, ace: 90 }
      }
    }
  },
  volcano: {
  name: "Volcanic Island",
  skyColor: 0x140a0e, fogColor: 0x221115, fogDensity: 0.00017,
  groundColor: 0x120d0f, grassColor: 0x2b1d16, snowColor: 0x3d302a,
  waterColor: 0x071118, waterLevel: 12,
  cliffPos: new THREE.Vector3(0, 510, 0),
  cliffForward: new THREE.Vector3(0, -0.04, -1).normalize(),
  bounds: { minX: -6500, maxX: 6500, minZ: -12800, maxZ: 800 },
  subtracks: {
A: {
  name: "Obsidian Shore",
  desc: "Low-altitude base loop around the volcano hug the shoreline, skim the lava rivers, and keep your speed up through the thermal valleys.",
  waypoints: [
    new THREE.Vector3(0, 500, -220),
    new THREE.Vector3(1800, 500, -1400),
    new THREE.Vector3(3800, 500, -3000),
    new THREE.Vector3(3800, 500, -5200),
    new THREE.Vector3(2000, 500, -6500),
    new THREE.Vector3(0, 500, -6800),
    new THREE.Vector3(-2000, 500, -6500),
    new THREE.Vector3(-3800, 500, -5200),
    new THREE.Vector3(-3800, 500, -3000),
    new THREE.Vector3(-1800, 500, -1400),
    new THREE.Vector3(0, 500, -220)
  ],
  thermals: [
    { pos: new THREE.Vector3(1800, 300, -1400), radius: 420, boost: 44 },   
    { pos: new THREE.Vector3(2000, 300, -6500), radius: 420, boost: 48 },  
    { pos: new THREE.Vector3(-3800, 320, -5200), radius: 420, boost: 44 },
  ],
  sinks: [
    { pos: new THREE.Vector3(2800, 500, -2200), radius: 320, strength: 140 },
    { pos: new THREE.Vector3(1000, 500, -6600), radius: 320, strength: 140 },
    { pos: new THREE.Vector3(-2800, 500, -4100), radius: 320, strength: 140 },
  ],
    medals: { bronze: 131, silver: 110, gold: 101, ace: 93 }
},
B: {
  name: "Ashfall Ridge",
  desc: "Low-altitude west loop around the volcano hug the western shore, skim the ash fields, and ride the coastal thermals.",
  waypoints: [
    new THREE.Vector3(0, 500, -220),
    new THREE.Vector3(-1800, 500, -1400),
    new THREE.Vector3(-3800, 500, -3000),
    new THREE.Vector3(-3800, 500, -5200),
    new THREE.Vector3(-2000, 500, -6500),
    new THREE.Vector3(0, 500, -6800),
    new THREE.Vector3(2000, 500, -6500),
    new THREE.Vector3(3800, 500, -5200),
    new THREE.Vector3(3800, 500, -3000),
    new THREE.Vector3(1800, 500, -1400),
    new THREE.Vector3(0, 500, -220)
  ],
  thermals: [
    { pos: new THREE.Vector3(-1800, 300, -1400), radius: 420, boost: 44 }, 
    { pos: new THREE.Vector3(-2000, 300, -6500), radius: 420, boost: 48 },   
    { pos: new THREE.Vector3(3800, 320, -5200), radius: 420, boost: 44 }     
  ],
  sinks: [
    { pos: new THREE.Vector3(-2800, 500, -2200), radius: 320, strength: 140 },
    { pos: new THREE.Vector3(-1000, 500, -6600), radius: 320, strength: 140 }, 
    { pos: new THREE.Vector3(2800, 500, -4100), radius: 320, strength: 140 }   
  ],
  medals: { bronze: 131, silver: 110, gold: 101, ace: 93 }
},
C: {
      name: "Caldera Breach",
      desc: "The GRAND volcanic tour.",
      waypoints: [
        new THREE.Vector3(0, 500, -220),
        new THREE.Vector3(400, 480, -1000),
        new THREE.Vector3(-800, 460, -2400),
        new THREE.Vector3(-2800, 500, -3800),
        new THREE.Vector3(-3600, 560, -4800),
        new THREE.Vector3(-2400, 740, -5200),
        new THREE.Vector3(-1200, 940, -5500),
        new THREE.Vector3(0, 1280, -6000),
        new THREE.Vector3(1200, 880, -5200),
        new THREE.Vector3(2400, 660, -4200),
        new THREE.Vector3(3200, 540, -5800),
        new THREE.Vector3(2600, 520, -7800),
        new THREE.Vector3(1200, 500, -9400),
        new THREE.Vector3(-400, 480, -10800),
        new THREE.Vector3(0, 460, -12200)
      ],
      thermals: [
        { pos: new THREE.Vector3(400, 280, -1000), radius: 440, boost: 48 },
        { pos: new THREE.Vector3(-1800, 800, -5200), radius: 440, boost: 48 }, 
        { pos: new THREE.Vector3(-3600, 360, -4800), radius: 460, boost: 52 },
        { pos: new THREE.Vector3(3200, 340, -5800), radius: 460, boost: 50 },
        { pos: new THREE.Vector3(-400, 480, -10800), radius: 440, boost: 46 }
      ],
      sinks: [
        { pos: new THREE.Vector3(-200, 460, -1700), radius: 320, strength: 140 },
        { pos: new THREE.Vector3(1800, 720, -4600), radius: 320, strength: 150 }, 
        { pos: new THREE.Vector3(1800, 500, -8600), radius: 320, strength: 150 },
        { pos: new THREE.Vector3(0, 880, -5500), radius: 400, strength: 200 }
      ],
      medals: { bronze: 135, silver: 113, gold: 104, ace: 96 }
    }
  }
},
glacial: {
    name: "Glacial Peaks",
    skyColor: 0x7faed4, fogColor: 0xa8d3ed, fogDensity: 0.00015,
    groundColor: 0x2e3b48, grassColor: 0x48718f, snowColor: 0xf5faff,
    waterColor: 0xd2effa, waterLevel: 18,
    cliffPos: new THREE.Vector3(0, 480, 0),
    cliffForward: new THREE.Vector3(0, -0.04, -1).normalize(),
    bounds: { minX: -6500, maxX: 6500, minZ: -12500, maxZ: 800 },
    subtracks: {
      A: {
        name: "Subzero Summit",
        desc: "Bank right through the eastern crystal fields, dive down the canyon chute, and loop home along the west ridges.",
        waypoints: [
          new THREE.Vector3(0, 470, -180),     
          new THREE.Vector3(1350, 440, -1500), 
          new THREE.Vector3(2400, 390, -3200),  
          new THREE.Vector3(1900, 480, -5300),  
          new THREE.Vector3(850, 340, -6800),   
          new THREE.Vector3(-450, 360, -8800), 
          new THREE.Vector3(-2200, 530, -7400), 
          new THREE.Vector3(-2600, 560, -4500), 
          new THREE.Vector3(-1400, 490, -2200), 
          new THREE.Vector3(0, 470, -180)       
        ],
        thermals: [
          { pos: new THREE.Vector3(1350, 240, -1500), radius: 420, boost: 41 }, 
          { pos: new THREE.Vector3(1900, 280, -5300), radius: 420, boost: 46 }, 
          { pos: new THREE.Vector3(-450, 160, -8800), radius: 440, boost: 52 }, 
          { pos: new THREE.Vector3(-2600, 360, -4500), radius: 420, boost: 45 } 
        ],
        sinks: [
          { pos: new THREE.Vector3(1850, 410, -2350), radius: 320, strength: 150 }, 
          { pos: new THREE.Vector3(1400, 380, -6050), radius: 300, strength: 150 }, 
          { pos: new THREE.Vector3(-1300, 440, -8100), radius: 310, strength: 150 },
          { pos: new THREE.Vector3(-2000, 520, -3350), radius: 290, strength: 140 }  
        ],
        medals: { bronze: 121, silver: 101, gold: 92, ace: 85 }
      },
      B: {
        name: "Razor Pass",
        desc: "Veer left into mountain shadow, climb the razor horn summits, and loop back high over the eastern glacier.",
        waypoints: [
          new THREE.Vector3(0, 470, -180),      
          new THREE.Vector3(-1400, 460, -1600),
          new THREE.Vector3(-2800, 570, -3600), 
          new THREE.Vector3(-3600, 680, -5800), 
          new THREE.Vector3(-2400, 580, -8400), 
          new THREE.Vector3(0, 370, -9600),    
          new THREE.Vector3(2200, 640, -8400),  
          new THREE.Vector3(3400, 670, -5600),  
          new THREE.Vector3(2000, 520, -2600),  
          new THREE.Vector3(700, 480, -1000),  
          new THREE.Vector3(0, 470, -180)      
        ],
        thermals: [

          { pos: new THREE.Vector3(-2800, 370, -3600), radius: 440, boost: 50 }, 
          { pos: new THREE.Vector3(0, 270, -9600),     radius: 460, boost: 54 }, 
          { pos: new THREE.Vector3(3400, 470, -5600), radius: 440, boost: 48 }  
        ],
        sinks: [
          { pos: new THREE.Vector3(-700, 460, -890),   radius: 310, strength: 150 }, 
          { pos: new THREE.Vector3(-3200, 620, -4700), radius: 320, strength: 160 }, 
          { pos: new THREE.Vector3(-3000, 630, -7100), radius: 330, strength: 150 }, 
          { pos: new THREE.Vector3(2700, 590, -4100),  radius: 300, strength: 150 }  
        ],
      medals: { bronze: 143, silver: 120, gold: 110, ace: 101 }

      },
      C: {
        name: "Polar Expedition",
        desc: "The GRAND Glacial Peaks tour!",
        waypoints: [
          new THREE.Vector3(0, 470, -180),     
          new THREE.Vector3(-250, 360, -1200),  
          new THREE.Vector3(0, 60, -2400),    
          new THREE.Vector3(260, 130, -3800),   
          new THREE.Vector3(900, 310, -4300),    
          new THREE.Vector3(2800, 590, -5600),  
          new THREE.Vector3(4200, 720, -7200),   
          new THREE.Vector3(3600, 750, -9200),  
          new THREE.Vector3(-300, 360, -8000),  
          new THREE.Vector3(-2800, 680, -9600),  
          new THREE.Vector3(-3600, 620, -11100), 
          new THREE.Vector3(-1800, 740, -12000), 
          new THREE.Vector3(0, 520, -12400)      
        ],
        thermals: [
          { pos: new THREE.Vector3(260, 30, -3800),   radius: 460, boost: 58 }, 
          { pos: new THREE.Vector3(2800, 390, -5600),  radius: 450, boost: 52 },
          { pos: new THREE.Vector3(-300, 160, -8000),  radius: 480, boost: 60 }, 
          { pos: new THREE.Vector3(-3600, 420, -11100),radius: 460, boost: 54 }  
        ],
        sinks: [
          { pos: new THREE.Vector3(-120, 290, -1800),  radius: 300, strength: 150 }, 
          { pos: new THREE.Vector3(3500, 650, -6400),  radius: 320, strength: 160 }, 
          { pos: new THREE.Vector3(3900, 730, -8200),  radius: 330, strength: 160 }, 
          { pos: new THREE.Vector3(1650, 550, -8600),  radius: 340, strength: 170 }, 
          { pos: new THREE.Vector3(-1550, 520, -8800), radius: 320, strength: 150 }, 
          { pos: new THREE.Vector3(-3200, 650, -10350),radius: 310, strength: 150 }, 
          { pos: new THREE.Vector3(-900, 630, -12200), radius: 300, strength: 150 }  
        ],
          medals: { bronze: 140, silver: 117, gold: 107, ace: 99 }
      }
    }
  },
  moon: {
    name: "The Moon",
    skyColor: 0x010103, fogColor: 0x010103, fogDensity: 0.00003,
    groundColor: 0x6e7178, grassColor: 0x44464c, snowColor: 0xa6abb5,
    waterColor: 0x000000, waterLevel: -999,
    cliffPos: new THREE.Vector3(0, 480, 0),
    cliffForward: new THREE.Vector3(0, -0.04, -1).normalize(),
    bounds: { minX: -6500, maxX: 6500, minZ: -12500, maxZ: 800 },
    subtracks: {
      A: {
        name: "Apollo Landing",
        desc: "Carve between impact craters and fly directly over the Apollo 11 landing site.",
        waypoints: [
          new THREE.Vector3(0, 470, -180),
          new THREE.Vector3(600, 420, -1600),
          new THREE.Vector3(1800, 400, -3800),
          new THREE.Vector3(1400, 430, -6400),
          new THREE.Vector3(-600, 450, -8200),
          new THREE.Vector3(-2400, 480, -6200),
          new THREE.Vector3(-2000, 450, -3200),
          new THREE.Vector3(-600, 440, -1200),
          new THREE.Vector3(0, 470, -180)
        ],
        thermals: [
          { pos: new THREE.Vector3(0, 470, -180), radius: 420, boost: 44 },
          { pos: new THREE.Vector3(1800, 200, -3800), radius: 420, boost: 44 },
          { pos: new THREE.Vector3(-600, 250, -8200), radius: 440, boost: 46 }
        ],
        sinks: [
          { pos: new THREE.Vector3(1600, 415, -5100), radius: 310, strength: 150 },
          { pos: new THREE.Vector3(-2200, 465, -4700), radius: 310, strength: 150 }
        ],
        medals: { bronze: 110, silver: 92, gold: 84, ace: 78 }
      },
      B: {
        name: "Rover Rally",
        desc: "Low-altitude canyon slalom through a collapsed lunar lava rille.",
        waypoints: [
          new THREE.Vector3(0, 470, -180),
          new THREE.Vector3(-1400, 450, -1800),
          new THREE.Vector3(-2800, 520, -4200),
          new THREE.Vector3(-3600, 540, -7000),
          new THREE.Vector3(-1800, 480, -9600),
          new THREE.Vector3(800, 460, -9200),
          new THREE.Vector3(2800, 500, -6600),
          new THREE.Vector3(1800, 470, -2800),
          new THREE.Vector3(0, 470, -180)
        ],
        thermals: [
          { pos: new THREE.Vector3(-2800, 320, -4200), radius: 440, boost: 48 },
          { pos: new THREE.Vector3(800, 260, -9200), radius: 440, boost: 46 }
        ],
        sinks: [
          { pos: new THREE.Vector3(-2700, 510, -8300), radius: 300, strength: 150 },
          { pos: new THREE.Vector3(2300, 485, -4700), radius: 300, strength: 150 }
        ],
        medals: { bronze: 141, silver: 118, gold: 108, ace: 100 }
      },
C: {
        name: "The Final Step",
        desc: "The GRAND Moon Tour!",
        cliffPos: new THREE.Vector3(2600, 500, -9200),
        cliffForward: new THREE.Vector3(-0.65, -0.04, -0.75).normalize(),
        waypoints: [
          new THREE.Vector3(2300, 200, -9400),  
          new THREE.Vector3(0, 520, -11400),    
          new THREE.Vector3(-2200, 510, -10600),
          new THREE.Vector3(-3600, 500, -8200),  
          new THREE.Vector3(-4000, 480, -5500),  
          new THREE.Vector3(-3400, 470, -3200), 
          new THREE.Vector3(-2000, 460, -1800),  
          new THREE.Vector3(0, 450, -1200),     
          new THREE.Vector3(2000, 460, -1800), 
          new THREE.Vector3(3400, 480, -3400),   
          new THREE.Vector3(3400, 510, -5600),   
          new THREE.Vector3(2000, 520, -5600), 
          new THREE.Vector3(500, 510, -5600),    
          new THREE.Vector3(-1200, 490, -5600)   
        ],
        thermals: [
          { pos: new THREE.Vector3(-4000, 280, -5500), radius: 440, boost: 46 },
          { pos: new THREE.Vector3(2300, 50, -9400), radius: 440, boost: 46 }, 
          { pos: new THREE.Vector3(0, 250, -1200), radius: 460, boost: 52 },    
          { pos: new THREE.Vector3(3400, 310, -5600), radius: 440, boost: 48 }   
        ],
        sinks: [
          { pos: new THREE.Vector3(-1100, 515, -11000), radius: 300, strength: 150 }, 
          { pos: new THREE.Vector3(2700, 470, -2600), radius: 300, strength: 150 }  
        ],
        medals: { bronze: 167, silver: 140, gold: 128, ace: 118 }
      },
      D: {
        name: "Aphelion's Earth elevator!",
        desc: "To earth and back!",
        waypoints: [
          new THREE.Vector3(0, 470, -180),       
          new THREE.Vector3(600, 850, -2800),    
          new THREE.Vector3(1200, 1350, -6000),   
          new THREE.Vector3(1800, 1950, -9200),    
          new THREE.Vector3(2400, 2550, -12400),  
          new THREE.Vector3(3250, 3300, -15600),    
          new THREE.Vector3(5300, 3400, -18300),   
          new THREE.Vector3(4900, 3400, -21750),   
          new THREE.Vector3(1000, 3400, -24000),  
          new THREE.Vector3(-2900, 3400, -21750),  
          new THREE.Vector3(-3350, 3400, -18300),  
          new THREE.Vector3(-1250, 3300, -15600),  
          new THREE.Vector3(-1000, 2600, -12400),  
          new THREE.Vector3(-800, 2000, -9200),    
          new THREE.Vector3(-550, 1400, -6000),    
          new THREE.Vector3(-300, 900, -2800),      
          new THREE.Vector3(-100, 580, -1000),     
          new THREE.Vector3(0, 470, -180)          
        ],
        thermals: [
          { pos: new THREE.Vector3(0, 270, -180), radius: 480, boost: 52 },
          { pos: new THREE.Vector3(600, 650, -2800), radius: 480, boost: 52 },
          { pos: new THREE.Vector3(1200, 1150, -6000), radius: 480, boost: 52 },
          { pos: new THREE.Vector3(1800, 1750, -9200), radius: 480, boost: 52 },
          { pos: new THREE.Vector3(2400, 2350, -12400), radius: 480, boost: 52 },
          { pos: new THREE.Vector3(3250, 3100, -15600), radius: 480, boost: 52 },
          { pos: new THREE.Vector3(5300, 3200, -18300), radius: 480, boost: 52 },
          { pos: new THREE.Vector3(4900, 3200, -21750), radius: 480, boost: 52 },
          { pos: new THREE.Vector3(1000, 3200, -24000), radius: 480, boost: 52 },
          { pos: new THREE.Vector3(-2900, 3200, -21750), radius: 480, boost: 52 },
          { pos: new THREE.Vector3(-3350, 3200, -18300), radius: 480, boost: 52 },
          { pos: new THREE.Vector3(-1250, 3100, -15600), radius: 480, boost: 52 }
        ],
        sinks: [], 
        medals: { bronze: 321, silver: 268, gold: 246, ace: 227 }
      }
    }
  }
}

let islandPlates = [];
let seaStacks = [];

function islandProfile(dist, radius, peakHeight) {
  if (dist >= radius) return 0;
  const t = dist / radius;
  return peakHeight * Math.pow(0.5 * (1 + Math.cos(t * Math.PI)), 1.4);
}

const LUNAR_CRATERS = [
  { cx: 1350, cz: -1500, r: 420, depth: 135 }, 
  { cx: -150, cz: -1850, r: 380, depth: 120 },
  { cx: -2500, cz: -3100, r: 480, depth: 150 },
  { cx: -3400, cz: -6200, r: 640, depth: 200 },
  { cx: 0, cz: -10600, r: 820, depth: 240 },  
  { cx: 2800, cz: -8500, r: 540, depth: 170 }, 
  { cx: 1200, cz: -5600, r: 460, depth: 150 },  
  { cx: -1200, cz: -7500, r: 400, depth: 130 } 
];

function getTerrainHeight(x, z, courseKey = selectedCourseId) {
  const course = COURSES[courseKey];
  if (!course) return 0;

  if (courseKey === 'canyon') {
    if (Math.abs(x) < 140 && z >= 0 && z < 300) {
      const t = z / 300;
      return 418 - t * 8; // Solid natural cliff runway
    }
    if (Math.abs(x) < 180 && z < 0 && z > -240) {
      const dropT = (-z) / 240;
      return 410 - dropT * 260; // Clean vertical drop-off into gorge
    }

    let h = Math.sin(x * 0.0006) * 440 + Math.cos(z * 0.0006) * 440 + Math.sin(x * 0.002 + z * 0.002) * 160;
    const valley = Math.abs(x - Math.sin(z * 0.0004) * 1200);
    if (valley < 1300) {
      const vRatio = valley / 1300;
      h = h * (vRatio * 0.85 + 0.15);
      if (h < course.waterLevel + 10) h = course.waterLevel + 10;
    }
    if (graphicsQuality === 'high') {
      const crags = (Math.sin(x * 0.007 + z * 0.004) + Math.cos(z * 0.007 - x * 0.004)) * 16.0;
      const baseH = h;
      const fade = THREE.MathUtils.clamp((baseH - course.waterLevel) / 80, 0, 1);
      h += crags * fade;
      if (baseH >= course.waterLevel) h = Math.max(h, course.waterLevel + 2);
    }
    return h;
  } else if (courseKey === 'islands') {
    if (Math.abs(x) < 140 && z >= 0 && z < 320) {
      const t = z / 320;
      return 678 - t * 10;
    }
    if (z < 0 && z >= -850 && Math.abs(x) < 650) {
      return -999;
    }

    let highestSurface = -999;
    for (let i = 0; i < islandPlates.length; i++) {
      const isl = islandPlates[i];
      const d = Math.hypot(x - isl.x, z - isl.z);
      if (d < isl.radius) {
        const surf = isl.height; 
        if (surf > highestSurface) highestSurface = surf;
      }
    }
    return highestSurface;
  } else if (courseKey === 'coastal') {
    if (Math.hypot(x, z) < 300 && z >= 0) {
      return 458 - (z / 300) * 12;
    }
    if (z < 0 && z > -280 && Math.abs(x) < 260) {
      const dropT = (-z) / 280;
      return 446 - dropT * 400; // Steep drop to sea level
    }

    for (let i = 0; i < seaStacks.length; i++) {
      const stk = seaStacks[i];
      const dx = x - stk.x, dz = z - stk.z;
      if (Math.abs(dx) < stk.radius && Math.abs(dz) < stk.radius) {
        if (Math.hypot(dx, dz) < stk.radius) {
          return stk.height;
        }
      }
    }

    const dx1 = x - 2200, dz1 = z + 5500;
    let hM1 = 0;
    if (Math.abs(dx1) < 2400 && Math.abs(dz1) < 2400) {
      const dM1 = Math.hypot(dx1, dz1);
      if (dM1 < 2400) hM1 = Math.cos((dM1 / 2400) * (Math.PI * 0.5)) * 540 + Math.sin(x * 0.003) * 50;
    }

    const dx2 = x - 800, dz2 = z + 9400;
    let hM2 = 0;
    if (Math.abs(dx2) < 2600 && Math.abs(dz2) < 2600) {
      const dM2 = Math.hypot(dx2, dz2);
      if (dM2 < 2600) hM2 = Math.cos((dM2 / 2600) * (Math.PI * 0.5)) * 590;
    }

    const dx3 = x + 2800, dz3 = z + 6500;
    let hM3 = 0;
    if (Math.abs(dx3) < 2200 && Math.abs(dz3) < 2200) {
      const dM3 = Math.hypot(dx3, dz3);
      if (dM3 < 2200) hM3 = Math.cos((dM3 / 2200) * (Math.PI * 0.5)) * 490;
    }

    const dx4 = x + 2400, dz4 = z + 2400;
    let hM4 = 0;
    if (Math.abs(dx4) < 1900 && Math.abs(dz4) < 1900) {
      const dM4 = Math.hypot(dx4, dz4);
      if (dM4 < 1900) hM4 = Math.cos((dM4 / 1900) * (Math.PI * 0.5)) * 440;
    }

    const maxM = Math.max(hM1, hM2, hM3, hM4);
    if (maxM > 0) return Math.max(10, maxM);
    return -5;
  } else if (courseKey === 'volcano') {
    if (Math.abs(x) < 160 && z >= 0 && z < 320) {
      return 508 - (z / 320) * 12; // Solid launch ridge
    }

    const dx1 = x, dz1 = z - 80;
    let hI1 = (Math.abs(dx1) < 1500 && Math.abs(dz1) < 1500) ? islandProfile(Math.hypot(dx1, dz1), 1500, 520) : 0;

    if (z < 0 && z > -800 && Math.abs(x) < 450) {
      const dropT = Math.min(1.0, (-z) / 260);
      hI1 = Math.min(hI1, 496 - dropT * 260);
    }

    const dxV = x, dzV = z + 5500;
    let hVolc = 0;
    if (Math.abs(dxV) < 3600 && Math.abs(dzV) < 3600) {
      const dVolc = Math.hypot(dxV, dzV);
      if (dVolc < 3600) {
        if (dVolc < 600) {
          const craterT = dVolc / 600;
          hVolc = 880 + (1080 - 880) * Math.pow(craterT, 1.5);
        } else {
          const tOuter = (dVolc - 600) / 3000;
          hVolc = 1080 * Math.pow(1.0 - tOuter, 1.6);
        }
        const angle = Math.atan2(dxV, dzV);
        hVolc += Math.sin(angle * 8) * Math.cos(dVolc * 0.004) * 32;
      }
    }

    const dx3 = x + 3600, dz3 = z + 4200;
    const hI3 = (Math.abs(dx3) < 1900 && Math.abs(dz3) < 1900) ? islandProfile(Math.hypot(dx3, dz3), 1900, 480) : 0;

    const dx4 = x - 3500, dz4 = z + 7200;
    const hI4 = (Math.abs(dx4) < 2000 && Math.abs(dz4) < 2000) ? islandProfile(Math.hypot(dx4, dz4), 2000, 510) : 0;

    const dx5 = x + 600, dz5 = z + 10800;
    const hI5 = (Math.abs(dx5) < 1700 && Math.abs(dz5) < 1700) ? islandProfile(Math.hypot(dx5, dz5), 1700, 460) : 0;

    let hStack = 0;
    for (let i = 0; i < seaStacks.length; i++) {
      const stk = seaStacks[i];
      const dx = x - stk.x, dz = z - stk.z;
      if (Math.abs(dx) < stk.radius && Math.abs(dz) < stk.radius) {
        if (Math.hypot(dx, dz) < stk.radius) {
          hStack = stk.height;
          break;
        }
      }
    }

    const maxH = Math.max(hI1, hVolc, hI3, hI4, hI5, hStack);
    if (maxH > 3) {
      return Math.max(16, maxH);
    }
    return -120;
  } else if (courseKey === 'glacial') {
    if (Math.abs(x) < 140 && z >= 0 && z < 320) {
      return 478 - (z / 320) * 10;
    }
    if (z < 0 && z > -260 && Math.abs(x) < 180) {
      const dropT = (-z) / 260;
      return 468 - dropT * 320;
    }

    const fjordCenter = Math.sin(z * 0.0004) * 1250;
    const distFromCenter = Math.abs(x - fjordCenter);

    const ridgeNoise = Math.sin(x * 0.0011) * Math.cos(z * 0.0011);
    const horns = Math.pow(Math.abs(ridgeNoise), 2.4) * 620;
    const crags = Math.sin(x * 0.0024 + z * 0.0016) * 110;

    let mountainHeight = 280 + horns + crags;

    if (distFromCenter < 1700) {
      const uFactor = distFromCenter / 1700;
      const wallSteepness = Math.pow(uFactor, 3.8);
      let valleyFloor = course.waterLevel + 26 + (wallSteepness * (mountainHeight - 30));

      if (distFromCenter > 750 && distFromCenter < 1450) {
        valleyFloor = Math.floor(valleyFloor / 75) * 70;
      }
      return Math.max(course.waterLevel + 6, valleyFloor);
    }

    return Math.max(course.waterLevel + 14, mountainHeight);
  } else if (courseKey === 'moon') {
    if (Math.abs(x) < 150 && z >= 0 && z < 320) {
      return 478 - (z / 320) * 10;
    }
    if (z < 0 && z > -260 && Math.abs(x) < 180) {
      const dropT = (-z) / 260;
      return 468 - dropT * 220;
    }

    const mcdx = x - 2600;
    const mcdz = z - (-9200);
    const mcProj = mcdx * (-0.6544) + mcdz * (-0.7561); // positive in front, negative behind
    const mcLat = Math.hypot(mcdx - mcProj * (-0.6544), mcdz - mcProj * (-0.7561));
    if (mcProj <= 0 && mcProj > -280 && mcLat < 130) {
      return 492 - (Math.abs(mcProj) / 280) * 10; // solid natural plateau behind cliff edge
    }
    if (mcProj > 0 && mcProj < 280 && mcLat < 150) {
      const dropT = Math.min(1.0, mcProj / 200);
      return 490 - dropT * 210; // clean crater drop-off in front
    }

    let h = 260 + Math.sin(x * 0.0008) * 110 + Math.cos(z * 0.0008) * 110 + Math.sin(x * 0.0019 + z * 0.0015) * 40;

    for (let i = 0; i < LUNAR_CRATERS.length; i++) {
      const cr = LUNAR_CRATERS[i];
      const d = Math.hypot(x - cr.cx, z - cr.cz);
      if (d < cr.r * 1.35) {
        if (d < cr.r) {
          const t = d / cr.r;
          h -= cr.depth * (1.0 - t * t);
        } else {
          const t = (d - cr.r) / (cr.r * 0.35);
          h += (cr.depth * 0.32) * Math.sin(t * Math.PI);
        }
      }
    }

    return Math.max(16, h);
  }
  return 0;
}