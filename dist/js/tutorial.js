// nuh uh this isnt the tutorial... why are you tampering?
let tutorialBeat = 0;
let tutorialBulletTime = false;
let tutorialDelayTimer = 0;
let tutorialForced = false;
let tutorialMobileStep = 0;
let activeSpotlightEl = null;
let activeSpotlightLabel = '';
let sinkTrapTimer = 0;
let stallReactionTimer = 0;
let stallCheckpoint = null;

function showMapSwitchBanner() {
  let el = document.getElementById('tutorial-map-switch-banner');
  if (!el) {
    el = document.createElement('div');
    el.id = 'tutorial-map-switch-banner';
    document.body.appendChild(el);
  }
  el.style.cssText = 'position:fixed;top:20%;left:50%;transform:translateX(-50%);background:rgba(0,0,0,0.88);border:2px solid var(--gold);color:var(--gold);font-family:var(--font-stack);font-size:26px;font-weight:900;letter-spacing:4px;text-transform:uppercase;padding:12px 28px;border-radius:4px;box-shadow:0 0 24px rgba(241,196,15,0.7);z-index:585;pointer-events:none;text-align:center;display:block;animation:promptPulse 1s ease-in-out infinite alternate;';
  el.innerText = 'Now, Lets Practice on another map';
}

function hideMapSwitchBanner() {
  const el = document.getElementById('tutorial-map-switch-banner');
  if (el) el.style.display = 'none';
}

function showCompassPointer() {
  let el = document.getElementById('tutorial-compass-pointer');
  if (!el) {
    el = document.createElement('div');
    el.id = 'tutorial-compass-pointer';
    document.body.appendChild(el);
  }
  el.style.cssText = 'position:fixed;top:168px;left:50%;transform:translateX(-50%);display:flex;flex-direction:column;align-items:center;z-index:585;pointer-events:none;';
  el.innerHTML = '<div style="font-size:26px;line-height:1;color:var(--cyan);animation:tutPulse 0.6s ease-in-out infinite alternate;">▲</div><div style="font-size:12px;font-weight:900;letter-spacing:2px;color:#ffffff;background:rgba(0,0,0,0.88);border:2px solid var(--cyan);box-shadow:0 0 16px var(--cyan);padding:6px 16px;border-radius:4px;text-transform:uppercase;margin-top:2px;white-space:nowrap;">FOLLOW THIS IF LOST</div>';
  el.style.display = 'flex';
}

function hideCompassPointer() {
  const el = document.getElementById('tutorial-compass-pointer');
  if (el) el.style.display = 'none';
}

function triggerTutorialFlash(color, duration = 300) {
  let flash = document.getElementById('tutorial-flash-overlay');
  if (!flash) {
    flash = document.createElement('div');
    flash.id = 'tutorial-flash-overlay';
    document.body.appendChild(flash);
  }
  flash.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:650;transition:opacity ' + (duration / 1000) + 's ease-out;';
  flash.style.background = color;
  flash.style.opacity = '1';
  flash.style.display = 'block';
  setTimeout(() => {
    flash.style.opacity = '0';
    setTimeout(() => { flash.style.display = 'none'; }, duration);
  }, 40);
}

function hasExistingPB() {
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith('pb_')) return true;
  }
  return false;
}

function checkTutorialTrigger() {
  if (tutorialActive) return false;
  if (challengeActive) return false;
  if (hasExistingPB()) {
    try { localStorage.setItem('glider_tutorial_complete', 'true'); } catch (e) {}
    return false;
  }
  if (localStorage.getItem('glider_tutorial_complete') === 'true') {
    return false;
  }
  startTutorial(false);
  return true;
}

function getVisiblePauseButton() {
  const btn1 = document.getElementById('btn-hud-pause');
  const btn2 = document.getElementById('mobile-btn-pause');
  if (btn2 && btn2.offsetParent !== null && window.getComputedStyle(btn2).display !== 'none') {
    return btn2;
  }
  if (btn1 && btn1.offsetParent !== null && window.getComputedStyle(btn1).display !== 'none') {
    return btn1;
  }
  return btn1 || btn2;
}

function showTutorialBanner(text) {
  let b = document.getElementById('tutorial-prompt-banner');
  if (!b) {
    b = document.createElement('div');
    b.id = 'tutorial-prompt-banner';
    document.body.appendChild(b);
  }
  b.style.display = 'block';
  b.innerText = text;
}

function hideTutorialBanner() {
  const b = document.getElementById('tutorial-prompt-banner');
  if (b) b.style.display = 'none';
}

function showElementSpotlight(el, labelText) {
  if (!el) return;
  activeSpotlightEl = el;
  activeSpotlightLabel = labelText;
  const rect = el.getBoundingClientRect();
  let cutout = document.getElementById('tutorial-spotlight-cutout');
  if (!cutout) {
    cutout = document.createElement('div');
    cutout.id = 'tutorial-spotlight-cutout';
    document.body.appendChild(cutout);
  }
  const pad = 6;
  cutout.style.display = 'block';
  cutout.style.left = (rect.left - pad) + 'px';
  cutout.style.top = (rect.top - pad) + 'px';
  cutout.style.width = (rect.width + pad * 2) + 'px';
  cutout.style.height = (rect.height + pad * 2) + 'px';

  let label = document.getElementById('tutorial-spotlight-label');
  if (!label) {
    label = document.createElement('div');
    label.id = 'tutorial-spotlight-label';
    label.className = 'tutorial-spotlight-label';
    document.body.appendChild(label);
  }
  label.style.display = 'block';
  label.innerText = labelText;
  if (rect.top > 80) {
    label.style.top = Math.max(10, rect.top - 42) + 'px';
    label.style.left = Math.max(10, rect.left + rect.width / 2 - 60) + 'px';
  } else {
    label.style.top = (rect.bottom + 12) + 'px';
    label.style.left = Math.max(10, rect.left + rect.width / 2 - 60) + 'px';
  }
}

function hideElementSpotlight() {
  activeSpotlightEl = null;
  activeSpotlightLabel = '';
  const cutout = document.getElementById('tutorial-spotlight-cutout');
  if (cutout) cutout.style.display = 'none';
  const label = document.getElementById('tutorial-spotlight-label');
  if (label) label.style.display = 'none';
}

function cleanupTutorialUI() {
  tutorialBulletTime = false;
  hideTutorialBanner();
  hideElementSpotlight();
  hideMapSwitchBanner();
  hideCompassPointer();
  const card = document.getElementById('tutorial-controls-card');
  if (card) card.style.display = 'none';
  document.querySelectorAll('.tutorial-pulse').forEach(el => el.classList.remove('tutorial-pulse'));
  const yl = document.getElementById('mobile-btn-yaw-l');
  const yr = document.getElementById('mobile-btn-yaw-r');
  if (yl) {
    yl.style.opacity = '';
    yl.style.pointerEvents = '';
  }
  if (yr) {
    yr.style.opacity = '';
    yr.style.pointerEvents = '';
  }
  const banner = document.getElementById('tutorial-prompt-banner');
  if (banner) {
    banner.style.color = '';
    banner.style.borderColor = '';
    banner.style.boxShadow = '';
  }
  const stallEl = document.getElementById('stall-warning');
  if (stallEl) stallEl.style.display = 'none';
}

function startTutorial(force = false) {
  challengeActive = null;
  challengeMod = null;
  challengeActiveDateKey = null;
  challengeActiveDayOffset = 0;
  tutorialActive = true;
  tutorialForced = force;
  tutorialBulletTime = false;
  tutorialMobileStep = 0;
  tutorialDelayTimer = 0;

  selectedCourseId = 'canyon';
  selectedSubtrack = 'A';
  gameMode = 'timetrial';

  if (typeof audio !== 'undefined' && audio.init) audio.init();
  if (typeof stopMenuTheme === 'function') stopMenuTheme(true);

  if (typeof buildCourse === 'function') buildCourse('canyon');

  const course = COURSES['canyon'];
  const activeSubtrack = course.subtracks['A'];
  cliffLaunchPos.copy(activeSubtrack.cliffPos || course.cliffPos);
  cliffForwardDir.copy(activeSubtrack.cliffForward || course.cliffForward);

  const runwayBasePos = _tempVec1.copy(cliffLaunchPos).sub(_tempVec2.copy(cliffForwardDir).multiplyScalar(220));
  player.pos.copy(runwayBasePos);
  player.pitch = 0;
  player.roll = 0;
  player.flightPathPitch = 0;
  player.targetPitch = 0;
  player.targetRoll = 0;
  player.rudderDeflection = 0;
  player.speed = 0;
  player.nextGateIdx = 1;
  player.rank = 1;
  player.airbrake = false;
  player.verticalVelocity = 0;
  player.yaw = Math.atan2(-cliffForwardDir.x, -cliffForwardDir.z);
  mouseX = 0;
  mouseY = 0;

  if (typeof showScreen === 'function') showScreen(null);
  const hudEl = document.getElementById('hud-overlay');
  if (hudEl) hudEl.style.display = 'block';
  const countBox = document.getElementById('countdown-box');
  if (countBox) countBox.style.display = 'none';

  if (paragliderWingGroup) paragliderWingGroup.visible = true;
  if (typeof updateCameraView === 'function') updateCameraView(0, 0);

  tutorialBeat = 1;
  showBeat1Spotlight();
}

function showBeat1Spotlight() {
  const isMob = typeof isMobileDevice === 'function' && isMobileDevice();
  let card = document.getElementById('tutorial-controls-card');
  if (!card) {
    card = document.createElement('div');
    card.id = 'tutorial-controls-card';
    document.body.appendChild(card);
  }
  if (isMob) {
    const yl = document.getElementById('mobile-btn-yaw-l');
    const yr = document.getElementById('mobile-btn-yaw-r');
    if (yl) {
      yl.style.opacity = '0.25';
      yl.style.pointerEvents = 'none';
    }
    if (yr) {
      yr.style.opacity = '0.25';
      yr.style.pointerEvents = 'none';
    }
  }

  if (isMob) {
    const mobDesc = (mobileJoystickMode === 'gyro') ? 'TILT DEVICE TO STEER' : ((mobileJoystickMode === 'dpad') ? 'USE D-PAD TO STEER' : 'DRAG JOYSTICK TO STEER');
    card.innerHTML = `
      <div class="tutorial-card-title">FLIGHT CONTROLS</div>
      <div style="font-size: 11px; letter-spacing: 1.5px; color: var(--mono-90); text-transform: uppercase;">
        ${mobDesc}
      </div>
      <div class="tutorial-card-prompt">TOUCH TO BEGIN</div>
    `;
  } else {
    const topKey = typeof formatKeyName === 'function' ? formatKeyName(((keybinds && keybinds.pitchDown) || defaultKeybinds.pitchDown || [])[0]) : 'W';
    const bottomKey = typeof formatKeyName === 'function' ? formatKeyName(((keybinds && keybinds.pitchUp) || defaultKeybinds.pitchUp || [])[0]) : 'S';
    const leftKey = typeof formatKeyName === 'function' ? formatKeyName(((keybinds && keybinds.rollLeft) || defaultKeybinds.rollLeft || [])[0]) : 'A';
    const rightKey = typeof formatKeyName === 'function' ? formatKeyName(((keybinds && keybinds.rollRight) || defaultKeybinds.rollRight || [])[0]) : 'D';
    const topActionDesc = invertPitch ? 'PITCH DOWN (DIVE)' : 'PITCH UP (CLIMB)';
    const bottomActionDesc = invertPitch ? 'BANK LEFT / CLIMB / BANK RIGHT' : 'BANK LEFT / DIVE / BANK RIGHT';
    card.innerHTML = `
      <div class="tutorial-card-title">FLIGHT CONTROLS</div>
      <div class="tutorial-key-grid">
        <div class="tutorial-key-row">
          <div class="tutorial-key-cap">${topKey}</div>
        </div>
        <div class="tutorial-key-desc">${topActionDesc}</div>
        <div class="tutorial-key-row" style="margin-top: 6px;">
          <div class="tutorial-key-cap">${leftKey}</div>
          <div class="tutorial-key-cap">${bottomKey}</div>
          <div class="tutorial-key-cap">${rightKey}</div>
        </div>
        <div class="tutorial-key-desc">${bottomActionDesc}</div>
      </div>
      <div class="tutorial-card-prompt">PRESS ${topKey}, ${leftKey}, ${bottomKey}, OR ${rightKey} TO BEGIN</div>
    `;
  }
  card.style.display = 'flex';

  function onAdvanceInput(e) {
    if (isMob) {
      cleanupInput();
      advanceFromBeat1();
    } else if (e && e.code) {
      const steeringCodes = ['KeyW', 'KeyS', 'KeyA', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
      if (steeringCodes.includes(e.code) || (typeof isActionPressed === 'function' && (isActionPressed('pitchDown') || isActionPressed('pitchUp') || isActionPressed('rollLeft') || isActionPressed('rollRight')))) {
        cleanupInput();
        advanceFromBeat1();
      }
    }
  }

  function cleanupInput() {
    window.removeEventListener('keydown', onAdvanceInput);
    window.removeEventListener('pointerdown', onAdvanceInput);
    if (card) card.style.display = 'none';
  }

  if (isMob) {
    setTimeout(() => {
      window.addEventListener('pointerdown', onAdvanceInput, { once: true });
    }, 150);
  } else {
    window.addEventListener('keydown', onAdvanceInput);
  }
}

function advanceFromBeat1() {
  if (typeof audio !== 'undefined' && audio.playBeep) audio.playBeep(520, 'sine', 0.1);
  gameState = 'RUNUP';
  runupProgress = 0;
  countdownElapsed = 0;
  countdownStage = 3;
  const countBox = document.getElementById('countdown-box');
  if (countBox) {
    countBox.style.display = 'block';
    countBox.innerText = '3';
  }
  if (typeof audio !== 'undefined' && audio.playBeep) audio.playBeep(440, 'sine', 0.15);

  tutorialBeat = 2;
  showTutorialBanner('GATE 1: FOLLOW THE ARROW');
}

function tickTutorial(dt) {
  if (!tutorialActive) return;

  const isMob = typeof isMobileDevice === 'function' && isMobileDevice();

  if (tutorialBeat === 2) {
    if (player.nextGateIdx >= 2) {
      tutorialBeat = 2.5;
      tutorialDelayTimer = 3.0;
      showTutorialBanner('GATE 1 CLEARED!');
    }
  } else if (tutorialBeat === 2.5) {
    tutorialDelayTimer -= dt;
    if (tutorialDelayTimer <= 0) {
      tutorialBeat = 3;
      tutorialBulletTime = true;
      showTutorialBanner(isMob ? 'HOLD YAW BUTTONS TO CHARGE' : 'HOLD Q OR E TO CHARGE');
      if (isMob) {
        const yl = document.getElementById('mobile-btn-yaw-l');
        const yr = document.getElementById('mobile-btn-yaw-r');
        if (yl) {
          yl.style.opacity = '';
          yl.style.pointerEvents = 'auto';
          yl.classList.add('tutorial-pulse');
        }
        if (yr) {
          yr.style.opacity = '';
          yr.style.pointerEvents = 'auto';
          yr.classList.add('tutorial-pulse');
        }
      }
    }
  } else if (tutorialBeat === 3) {
    if (rudderBoost.charging) {
      tutorialBulletTime = false;
      if (rudderBoost.chargeTimer >= 0.4) {
        showTutorialBanner(isMob ? 'MAX CHARGE! LET GO!' : 'MAX CHARGE! RELEASE Q OR E!');
      } else {
        showTutorialBanner(isMob ? 'KEEP HOLDING...' : 'KEEP HOLDING Q OR E...');
      }
    } else if (rudderBoost.cooldownTimer > 0) {
      tutorialBulletTime = false;
      showTutorialBanner('BOOST ACTIVATED!');
      if (typeof audio !== 'undefined' && audio.playRecoveryBoost) audio.playRecoveryBoost();
      
      if (isMob) {
        const yl = document.getElementById('mobile-btn-yaw-l');
        const yr = document.getElementById('mobile-btn-yaw-r');
        if (yl) yl.classList.remove('tutorial-pulse');
        if (yr) yr.classList.remove('tutorial-pulse');
      }

      tutorialBeat = 3.5;
      tutorialDelayTimer = 2.5;
    } else {
      showTutorialBanner(isMob ? 'HOLD YAW BUTTONS TO CHARGE' : 'HOLD Q OR E TO CHARGE');
    }
  } else if (tutorialBeat === 3.5) {
    tutorialDelayTimer -= dt;
    if (tutorialDelayTimer <= 0) {
      tutorialBeat = 4;
      tutorialBulletTime = true;
      showTutorialBanner(isMob ? 'TAP BRAKE TO SLOW DOWN' : 'PRESS SPACE TO AIRBRAKE');
      if (isMob) {
        const brk = document.getElementById('mobile-btn-brake');
        if (brk) brk.classList.add('tutorial-pulse');
      }
    }
  } else if (tutorialBeat === 4) {
    const brkPressedDesktop = (typeof keys !== 'undefined' && keys['Space']) || (typeof player !== 'undefined' && player.airbrake);
    const brkPressedMobile = (typeof mobileAirbrake !== 'undefined' && mobileAirbrake) || (typeof player !== 'undefined' && player.airbrake);

    if (brkPressedDesktop || brkPressedMobile) {
      tutorialBulletTime = false;
      if (typeof audio !== 'undefined' && audio.playRecoveryBoost) audio.playRecoveryBoost();
      showTutorialBanner('FLY THROUGH GATE 2');
      if (isMob) {
        const brk = document.getElementById('mobile-btn-brake');
        if (brk) brk.classList.remove('tutorial-pulse');
      }
      tutorialBeat = 4.5;
    }
 } else if (tutorialBeat === 4.5) {
    if (player.nextGateIdx >= 3) {
      tutorialBeat = 4.8;
      tutorialDelayTimer = 3.0;
      showTutorialBanner('GATE 2 CLEARED!');
      if (typeof audio !== 'undefined' && audio.playRecoveryBoost) audio.playRecoveryBoost();
    }
  } else if (tutorialBeat === 4.8) {
    tutorialDelayTimer -= dt;
    if (tutorialDelayTimer <= 0) {
      tutorialBeat = 5;
      tutorialBulletTime = true;
      if (isMob) {
        tutorialMobileStep = 1;
        hideTutorialBanner();
        const pBtn = getVisiblePauseButton();
        showElementSpotlight(pBtn, 'PAUSE TO RESTART');
      } else {
        showTutorialBanner('Perfect! HOLD [R] TO RESTART');
      }
    }
  } else if (tutorialBeat === 5) {
    tutorialBulletTime = true;
    if (player.nextGateIdx > 3) player.nextGateIdx = 3;
  } else if (tutorialBeat === 10) {
    if (gameState === 'RACING') {
      hideMapSwitchBanner();
      showCompassPointer();
      hideTutorialBanner();
      tutorialBeat = 11;
    }
  } else if (tutorialBeat === 11) {
    if (player.nextGateIdx >= 2) {
      tutorialBeat = 11.5;
      tutorialDelayTimer = 2.5;
      showTutorialBanner('GATE 1 CLEARED! HEADING TO THERMAL...');
    }
  } else if (tutorialBeat === 11.5) {
    tutorialDelayTimer -= dt;
    if (tutorialDelayTimer <= 0) {
      tutorialBeat = 12;
      showTutorialBanner('BLUE THERMAL: RIDE UPDRAFTS FOR SPEED & ALTITUDE');
    }
  } else if (tutorialBeat === 12) {
    const dTh = Math.hypot(player.pos.x - (-3600), player.pos.z - (-4200));
    if (player.inThermal || dTh < 380) {
      hideCompassPointer();
      showTutorialBanner('RIDING THERMAL! NOTICE HOW IT PUSHES YOU UPWARD');
    }
    if (player.nextGateIdx >= 3) {
      tutorialBeat = 13;
      tutorialDelayTimer = 3.5;
      showTutorialBanner('GREAT! NOW FOLLOW THE ARROW TO GATE 3');
    }
  } else if (tutorialBeat === 13) {
    if (tutorialDelayTimer > 0) {
      tutorialDelayTimer -= dt;
      if (tutorialDelayTimer <= 0) hideTutorialBanner();
    }
    if (player.nextGateIdx >= 4) {
      tutorialBeat = 14;
      showTutorialBanner('FOLLOW THE ARROW TO GATE 4');
    }
  } else if (tutorialBeat === 14) {
    const passedBypass = player.pos.z <= -8450 || (player.pos.x > -2800 && player.pos.z <= -8300);
    const targetX = passedBypass ? -2200 : -3800;
    const targetZ = passedBypass ? -9600 : -8400;
    const targetY = passedBypass ? 590 : 620;

    const dx = targetX - player.pos.x;
    const dz = targetZ - player.pos.z;
    const toTargetYaw = Math.atan2(-dx, -dz);
    let diffY = toTargetYaw - player.yaw;
    while (diffY > Math.PI) diffY -= Math.PI * 2;
    while (diffY < -Math.PI) diffY += Math.PI * 2;

    if (Math.abs(diffY) > 0.08) {
      player.yaw += diffY * 3.0 * dt;
      player.targetRoll = THREE.MathUtils.clamp(-diffY * 2.5, -0.6, 0.6);
    }
    player.targetPitch = THREE.MathUtils.clamp((targetY - player.pos.y) * 0.005, -0.2, 0.2);

    if (!passedBypass) {
      showTutorialBanner('SINK AHEAD! AUTOPILOT STEERING AROUND TO AVOID...');
    } else {
      showTutorialBanner('SINK AVOIDED! PROCEED TO GATE 4');
      if (player.nextGateIdx >= 5) {
        stallCheckpoint = {
          x: player.pos.x,
          y: player.pos.y,
          z: player.pos.z,
          yaw: player.yaw,
          speed: 85
        };
        tutorialBeat = 15.5;
        tutorialDelayTimer = 4.0;
      }
    }
  } else if (tutorialBeat === 15.5) {
    tutorialDelayTimer -= dt;
    if (tutorialDelayTimer <= 0) {
      tutorialBeat = 16;
    }
  } else if (tutorialBeat === 16) {
    showTutorialBanner('STALL DRILL: CLIMB STRAIGHT UP!');
    mobilePitchInput = 0;
    gpPitch = 0;
    mouseY = 0;
    player.targetPitch = 0.65;
    player.pitch = THREE.MathUtils.lerp(player.pitch, 0.65, 4.0 * dt);
    player.flightPathPitch = THREE.MathUtils.lerp(player.flightPathPitch, 0.65, 3.5 * dt);
    player.roll = THREE.MathUtils.lerp(player.roll, 0, 5.0 * dt);
    player.speed = Math.max(10, player.speed - 36.0 * dt);
    const stallEl = document.getElementById('stall-warning');
    if (stallEl) stallEl.style.display = 'block';
    if (typeof audio !== 'undefined' && audio.playStallAlarm) audio.playStallAlarm();
    screenShake = Math.max(screenShake, 0.85);
    if (player.speed <= 24) {
      tutorialBeat = 16.5;
      tutorialBulletTime = true;
      stallReactionTimer = 4.0;
      const diveAction = invertPitch ? 'pitchDown' : 'pitchUp';
      const diveCode = ((keybinds && keybinds[diveAction]) || defaultKeybinds[diveAction] || [])[0];
      const diveKeyName = typeof formatKeyName === 'function' ? formatKeyName(diveCode) : 'S';
      const mobDiveText = (mobileJoystickMode === 'gyro') ? 'TILT FORWARD TO DIVE' : (invertPitch ? 'DRAG JOYSTICK UP' : 'DRAG JOYSTICK DOWN');
      showTutorialBanner(isMob ? `STALL! PITCH DOWN TO DIVE! (${mobDiveText})` : `STALL! PITCH DOWN TO DIVE! (PRESS ${diveKeyName})`);
    }
  } else if (tutorialBeat === 16.5) {
    stallReactionTimer -= (dt / 0.10);
    const isDiving = (typeof player !== 'undefined' && (player.targetPitch < -0.15 || player.pitch < -0.1));
    if (isDiving) {
      tutorialBulletTime = false;
      triggerTutorialFlash('rgba(0, 240, 255, 0.7)', 450);
      player.speed = 135;
      player.pitch = -0.28;
      player.flightPathPitch = -0.28;
      player.verticalVelocity = -15;
      screenShake = 0.5;
      const stallEl = document.getElementById('stall-warning');
      if (stallEl) stallEl.style.display = 'none';
      if (typeof audio !== 'undefined' && audio.playRecoveryBoost) audio.playRecoveryBoost();
      showTutorialBanner('PERFECT DIVE RECOVERY! SPEED BOOST!');
      tutorialBeat = 17;
      tutorialDelayTimer = 4.0;
    } else if (stallReactionTimer <= 0) {
      triggerTutorialFlash('#000000', 400);
      player.pos.set(stallCheckpoint.x, stallCheckpoint.y, stallCheckpoint.z);
      player.yaw = stallCheckpoint.yaw;
      player.pitch = 0;
      player.flightPathPitch = 0;
      player.roll = 0;
      player.verticalVelocity = 0;
      player.speed = stallCheckpoint.speed;
      player.nextGateIdx = 5;
      tutorialBulletTime = false;
      const stallEl = document.getElementById('stall-warning');
      if (stallEl) stallEl.style.display = 'none';
      if (typeof audio !== 'undefined' && audio.playBeep) audio.playBeep(260, 'sine', 0.15);
      showTutorialBanner('STALL FAILED! RETRYING...');
      tutorialBeat = 16;
    }
  } else if (tutorialBeat === 17) {
    tutorialDelayTimer -= dt;
    if (tutorialDelayTimer <= 0) {
      showTutorialBanner('FLY THROUGH GATE 5');
    }
    if (player.nextGateIdx >= 6) {
      tutorialBeat = 17.5;
      tutorialDelayTimer = 3.5;
      showTutorialBanner('GATE 5 CLEARED! WATCH FOR HAZARDS...');
    }
  } else if (tutorialBeat === 17.5) {
    tutorialDelayTimer -= dt;
    if (tutorialDelayTimer <= 0) {
      const fwd = new THREE.Vector3(-Math.sin(player.yaw), 0, -Math.cos(player.yaw)).normalize();
      const right = new THREE.Vector3(-fwd.z, 0, fwd.x).normalize();
      const flockStart = player.pos.clone().addScaledVector(fwd, 520);
      flockStart.y = player.pos.y;
      const flockEnd = player.pos.clone().addScaledVector(fwd, -350);
      flockEnd.y = player.pos.y;
      createBirdFlockMesh({
        start: flockStart,
        end: flockEnd,
        speed: 60,
        startTime: typeof raceElapsedTime !== 'undefined' ? raceElapsedTime : 0,
        tiers: [
          { dx: -140, dy: -25, dz: -40, radius: 70, count: 30 },
          { dx: -70, dy: 15, dz: -15, radius: 75, count: 35 },
          { dx: 0, dy: 0, dz: 0, radius: 85, count: 45 },
          { dx: 70, dy: -15, dz: 15, radius: 75, count: 35 },
          { dx: 140, dy: 25, dz: 40, radius: 70, count: 30 },
          { dx: -35, dy: 35, dz: -20, radius: 65, count: 25 },
          { dx: 35, dy: -35, dz: 20, radius: 65, count: 25 }
        ]
      });
      tutorialBulletTime = true;
      tutorialBeat = 18;
      barrelRoll.cooldownTimer = 0;
      barrelRoll.active = false;
      lastRollLeftTapTime = 0;
      lastRollRightTapTime = 0;
      const bRollCode = ((keybinds && keybinds.barrelRoll) || defaultKeybinds.barrelRoll || [])[0];
      const bRollKeyName = typeof formatKeyName === 'function' ? formatKeyName(bRollCode) : 'F';
      showTutorialBanner(isMob ? 'BIRDS AHEAD! PRESS F TO BARREL ROLL!' : `BIRDS AHEAD! PRESS ${bRollKeyName} TO BARREL ROLL!`);
    }
  } else if (tutorialBeat === 18) {
    if (barrelRoll.active || barrelRoll.immunityTimer > 0) {
      tutorialBulletTime = false;
      tutorialBeat = 18.5;
      tutorialDelayTimer = 4.0;
      showTutorialBanner('BARREL ROLL! IMMUNE TO BIRD STRIKES AND SINKS!');
      if (typeof audio !== 'undefined' && audio.playRecoveryBoost) audio.playRecoveryBoost();
    } else if (player.nextGateIdx >= 7) {
      tutorialBulletTime = false;
      tutorialBeat = 19;
      tutorialDelayTimer = 4.0;
      showTutorialBanner('FLY THROUGH THE REMAINING GATES TO FINISH!');
    }
  } else if (tutorialBeat === 18.5) {
    tutorialDelayTimer -= dt;
    if (tutorialDelayTimer <= 0) {
      tutorialBeat = 19;
      tutorialDelayTimer = 4.0;
      showTutorialBanner('FLY THROUGH THE REMAINING GATES TO FINISH!');
    }
  } else if (tutorialBeat === 19) {
    tutorialDelayTimer -= dt;
    if (tutorialDelayTimer <= 0) {
      hideTutorialBanner();
    }
  }
}

function startCanyonB() {
  cleanupTutorialUI();
  selectedCourseId = 'canyon';
  selectedSubtrack = 'B';
  gameMode = 'timetrial';
  if (typeof buildCourse === 'function') buildCourse('canyon');
  const course = COURSES['canyon'];
  const activeSubtrack = course.subtracks['B'];
  cliffLaunchPos.copy(activeSubtrack.cliffPos || course.cliffPos);
  cliffForwardDir.copy(activeSubtrack.cliffForward || course.cliffForward);
  const runwayBasePos = _tempVec1.copy(cliffLaunchPos).sub(_tempVec2.copy(cliffForwardDir).multiplyScalar(220));
  player.pos.copy(runwayBasePos);
  player.pitch = 0;
  player.roll = 0;
  player.flightPathPitch = 0;
  player.targetPitch = 0;
  player.targetRoll = 0;
  player.rudderDeflection = 0;
  player.speed = 0;
  player.nextGateIdx = 1;
  player.rank = 1;
  player.airbrake = false;
  player.verticalVelocity = 0;
  player.yaw = Math.atan2(-cliffForwardDir.x, -cliffForwardDir.z);
  mouseX = 0;
  mouseY = 0;
  if (typeof showScreen === 'function') showScreen(null);
  const hudEl = document.getElementById('hud-overlay');
  if (hudEl) hudEl.style.display = 'block';
  if (paragliderWingGroup) paragliderWingGroup.visible = true;
  if (typeof updateCameraView === 'function') updateCameraView(0, 0);
  tutorialBeat = 10;
  tutorialBulletTime = false;
  sinkTrapTimer = 0;
  stallReactionTimer = 0;
  barrelRoll.active = false;
  barrelRoll.timer = 0;
  barrelRoll.direction = 0;
  barrelRoll.cooldownTimer = 0;
  barrelRoll.immunityTimer = 0;
  lastRollLeftTapTime = 0;
  lastRollRightTapTime = 0;
  if (typeof keys !== 'undefined') {
    for (const k in keys) keys[k] = false;
  }
  gameState = 'RUNUP';
  runupProgress = 0;
  countdownElapsed = 0;
  countdownStage = 3;
  const countBox = document.getElementById('countdown-box');
  if (countBox) {
    countBox.style.display = 'block';
    countBox.innerText = '3';
  }
  if (typeof audio !== 'undefined' && audio.playBeep) audio.playBeep(440, 'sine', 0.15);
  showMapSwitchBanner();
  hideCompassPointer();
}

function startTransitionToCanyonB() {
  startCanyonB();
}

function completeTutorial() {
  tutorialActive = false;
  try {
    localStorage.setItem('glider_tutorial_complete', 'true');
  } catch (e) {}
  cleanupTutorialUI();
  if (typeof gameState !== 'undefined') {
    gameState = 'PAUSED';
  }
  if (typeof audio !== 'undefined' && audio.stopAllAudio) audio.stopAllAudio();
  const hudEl = document.getElementById('hud-overlay');
  if (hudEl) hudEl.style.display = 'none';
  const pauseScreen = document.getElementById('screen-pause');
  if (pauseScreen) pauseScreen.classList.add('hidden');
  const winScreen = document.getElementById('screen-win');
  if (winScreen) winScreen.classList.add('hidden');
  const isMob = typeof isMobileDevice === 'function' && isMobileDevice();
  let card = document.getElementById('tutorial-controls-card');
  if (!card) {
    card = document.createElement('div');
    card.id = 'tutorial-controls-card';
    document.body.appendChild(card);
  }
  card.innerHTML = `
    <div class="tutorial-card-title" style="font-size: 24px; color: var(--gold); text-shadow: 0 0 10px rgba(241, 196, 15, 0.5);">TUTORIAL COMPLETE!</div>
    <div style="font-size: 12px; letter-spacing: 1.5px; color: var(--mono-90); text-transform: uppercase; text-align: center; line-height: 1.6; margin-top: 10px;">
      THATS IT FOR THE TUTORIAL!<br>HAVE FUN!
    </div>
    <div class="tutorial-card-prompt" style="margin-top: 20px;">${isMob ? 'TAP TO RETURN TO MENU' : 'PRESS ANY KEY TO RETURN TO MENU'}</div>
  `;
  card.style.display = 'flex';

  function onFinishTutorial(e) {
    if (e && e.code === 'KeyR') return;
    window.removeEventListener('keydown', onFinishTutorial);
    window.removeEventListener('pointerdown', onFinishTutorial);
    card.style.display = 'none';
    gameState = 'START';
    if (typeof showScreen === 'function') showScreen('screen-start');
    if (typeof playMenuTheme === 'function') playMenuTheme('menu');
  }

  setTimeout(() => {
    window.addEventListener('keydown', onFinishTutorial);
    window.addEventListener('pointerdown', onFinishTutorial);
  }, 400);
}

function graduateTutorial() {
  if (tutorialBeat === 5) {
    startTransitionToCanyonB();
    return;
  }
  completeTutorial();
}

function restartTutorialFromSpotlight() {
  if (tutorialBeat === 5 || tutorialMobileStep >= 1) {
    startTransitionToCanyonB();
    return;
  }
  if (tutorialBeat >= 10) {
    cleanupTutorialUI();
    startCanyonB();
    return;
  }
  cleanupTutorialUI();
  startTutorial(true);
}

function skipTutorial(toCourseSelect = false) {
  tutorialActive = false;
  try {
    localStorage.setItem('glider_tutorial_complete', 'true');
  } catch (e) {}
  cleanupTutorialUI();
  const countBox = document.getElementById('countdown-box');
  if (countBox) countBox.style.display = 'none';
  gameState = 'START';
  if (typeof audio !== 'undefined' && audio.stopAllAudio) audio.stopAllAudio();
  if (typeof showScreen === 'function') {
    if (toCourseSelect) showScreen('screen-select');
    else showScreen('screen-start');
  }
}

function applySilentUpdraft(dt) {
  if (!tutorialActive || typeof player === 'undefined' || typeof getTerrainHeight !== 'function') return;
  const hTerrain = getTerrainHeight(player.pos.x, player.pos.z, selectedCourseId);
  const altitudeAGL = player.pos.y - hTerrain;
  const floorThreshold = 85.0;
  if (altitudeAGL < floorThreshold) {
    const cushion = THREE.MathUtils.clamp((floorThreshold - altitudeAGL) / floorThreshold, 0, 1);
    const liftForce = cushion * 42.0 * 2.2 * dt;
    player.pos.y += liftForce;
    if (player.verticalVelocity < 0) {
      player.verticalVelocity = THREE.MathUtils.lerp(player.verticalVelocity, Math.max(player.verticalVelocity, 8.0), cushion * 5.0 * dt);
    } else {
      player.verticalVelocity += cushion * 18.0 * dt;
    }
    if (player.pitch < -0.05) {
      player.pitch = THREE.MathUtils.lerp(player.pitch, 0.04, cushion * 3.5 * dt);
    }
    if (player.flightPathPitch < -0.05) {
      player.flightPathPitch = THREE.MathUtils.lerp(player.flightPathPitch, 0.04, cushion * 3.5 * dt);
    }
    if (player.speed < 45) {
      player.speed = THREE.MathUtils.lerp(player.speed, 55, cushion * 2.5 * dt);
    }
  }
}

if (typeof isActionPressed === 'function') {
  const _origIsAction = isActionPressed;
  isActionPressed = function(action) {
    if (tutorialActive) {
      if (tutorialBeat < 3 && (action === 'yawLeft' || action === 'yawRight')) {
        return false;
      }
      if (tutorialBeat >= 3 && tutorialBeat < 4) {
        if (action === 'pitchDown' || action === 'pitchUp' || action === 'rollLeft' || action === 'rollRight' || action === 'airbrake') {
          return false;
        }
      }
      if (tutorialBeat === 16 && (action === 'pitchDown' || action === 'pitchUp')) {
        return false;
      }
    }
    return _origIsAction(action);
  };
}

if (typeof updateFlight === 'function') {
  const _origUpdateFlight = updateFlight;
  updateFlight = function(dt) {
    let savedQ = false, savedE = false, savedYawL = false, savedYawR = false;
    let savedPitch = 0, savedRoll = 0, savedAirbrake = false, savedM1 = false, savedM2 = false;

    if (tutorialActive && tutorialBeat < 3) {
      if (typeof mobileYawLeft !== 'undefined') {
        mobileYawLeft = false;
        mobileYawRight = false;
      }
      if (typeof player !== 'undefined') {
        player.rudderDeflection = 0;
      }
    }

    if (tutorialActive && tutorialBeat >= 3 && tutorialBeat < 4) {
      savedPitch = gpPitch; savedRoll = gpRoll;
      gpPitch = 0; gpRoll = 0;
      savedAirbrake = player.airbrake;
      player.airbrake = false;
      mobilePitchInput = 0; mobileRollInput = 0; mobileAirbrake = false;
      savedM1 = mouseLeftPressed; savedM2 = mouseRightPressed;
      mouseLeftPressed = false; mouseRightPressed = false;
    }

    if (tutorialActive && tutorialBulletTime) {
      dt *= 0.10;
    }

    _origUpdateFlight(dt);

    if (tutorialActive && tutorialBeat < 3) {
      if (typeof player !== 'undefined') {
        player.rudderDeflection = 0;
      }
    }

    if (tutorialActive && tutorialBeat >= 3 && tutorialBeat < 4) {
      gpPitch = savedPitch; gpRoll = savedRoll;
      player.airbrake = savedAirbrake;
      mouseLeftPressed = savedM1; mouseRightPressed = savedM2;
    }

    if (tutorialActive) {
      applySilentUpdraft(dt);
      tickTutorial(dt);
    }
  };
}

if (typeof showScreen === 'function') {
  const _origShowScreen = showScreen;
  showScreen = function(screenId) {
  _origShowScreen(screenId);

  if (screenId === 'screen-pause') {
    const pBtn = document.querySelector('#screen-pause .btn-menu');
    if (pBtn) pBtn.innerText = tutorialActive ? 'SKIP TUTORIAL' : 'QUIT TO MENU';

    if (tutorialActive && tutorialBeat === 5 && isMobileDevice()) {
      tutorialMobileStep = 2;
      hideElementSpotlight();
      const restartBtn = document.getElementById('btn-pause-restart');
      if (restartBtn) restartBtn.scrollIntoView({ block: 'nearest' });
      setTimeout(() => { showElementSpotlight(restartBtn, 'HERE'); }, 50);
    }
  } else if (screenId === 'screen-lose') {
    const rBtn = document.querySelector('#screen-lose .btn-retry');
    if (rBtn) rBtn.innerText = tutorialActive ? 'RESTART TUTORIAL' : 'TRY AGAIN';
    const mBtn = document.querySelector('#screen-lose .btn-menu');
    if (mBtn) mBtn.innerText = 'COURSE SELECT';
  }
};
}

window.addEventListener('resize', () => {
  if (tutorialActive && activeSpotlightEl) {
    showElementSpotlight(activeSpotlightEl, activeSpotlightLabel);
  }
});

if (typeof finishRace === 'function') {
  const _origFinishRace = finishRace;
  finishRace = function() {
    if (tutorialActive) {
      completeTutorial();
      return;
    }
    _origFinishRace();
  };
}