// nuh uh this isnt the tutorial... why are you tampering?
let tutorialBeat = 0;
let tutorialBulletTime = false;
let tutorialDelayTimer = 0;
let tutorialForced = false;
let tutorialMobileStep = 0;
let activeSpotlightEl = null;
let activeSpotlightLabel = '';

function hasExistingPB() {
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith('pb_')) return true;
  }
  return false;
}

function checkTutorialTrigger() {
  if (tutorialActive) return false;
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
}

function startTutorial(force = false) {
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
    card.innerHTML = `
      <div class="tutorial-card-title">FLIGHT CONTROLS</div>
      <div style="font-size: 11px; letter-spacing: 1.5px; color: var(--mono-90); text-transform: uppercase;">
        DRAG JOYSTICK OR TILT TO STEER
      </div>
      <div class="tutorial-card-prompt">TOUCH TO BEGIN</div>
    `;
  } else {
    card.innerHTML = `
      <div class="tutorial-card-title">FLIGHT CONTROLS</div>
      <div class="tutorial-key-grid">
        <div class="tutorial-key-row">
          <div class="tutorial-key-cap">W</div>
        </div>
        <div class="tutorial-key-desc">PITCH DOWN (DIVE)</div>
        <div class="tutorial-key-row" style="margin-top: 6px;">
          <div class="tutorial-key-cap">A</div>
          <div class="tutorial-key-cap">S</div>
          <div class="tutorial-key-cap">D</div>
        </div>
        <div class="tutorial-key-desc">BANK LEFT / CLIMB / BANK RIGHT</div>
      </div>
      <div class="tutorial-card-prompt">PRESS W, A, S, OR D TO BEGIN</div>
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
      tutorialDelayTimer = 2.0;
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
      tutorialDelayTimer = 1.0; 
    } else {
      // Initial state
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
      tutorialDelayTimer = 1.6;
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
  }
}

function graduateTutorial() {
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
      THAT'S IT FOR THE TUTORIAL!<br>HAVE FUN!
    </div>
    <div class="tutorial-card-prompt" style="margin-top: 20px;">${isMob ? 'TAP TO CONTINUE' : 'PRESS ANY KEY TO CONTINUE'}</div>
  `;
  card.style.display = 'flex';

  function onContinue(e) {
    if (e && e.code === 'KeyR') return;

    window.removeEventListener('keydown', onContinue);
    window.removeEventListener('pointerdown', onContinue);
    card.style.display = 'none';
    
    if (typeof startCountdown === 'function') {
      startCountdown();
    }
  }

  setTimeout(() => {
    window.addEventListener('keydown', onContinue);
    window.addEventListener('pointerdown', onContinue);
  }, 300);
}

function restartTutorialFromSpotlight() {
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
      if (typeof keys !== 'undefined') {
        savedQ = !!keys['KeyQ'];
        savedE = !!keys['KeyE'];
        keys['KeyQ'] = false;
        keys['KeyE'] = false;
      }
      if (typeof mobileYawLeft !== 'undefined') {
        savedYawL = !!mobileYawLeft;
        savedYawR = !!mobileYawRight;
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

    // Restore yaw
    if (tutorialActive && tutorialBeat < 3) {
      if (typeof keys !== 'undefined') {
        if (savedQ) keys['KeyQ'] = true;
        if (savedE) keys['KeyE'] = true;
      }
      if (typeof mobileYawLeft !== 'undefined') {
        if (savedYawL) mobileYawLeft = true;
        if (savedYawR) mobileYawRight = true;
      }
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
    if (tutorialActive) {
      if (screenId === 'screen-pause') {
        const pBtn = document.querySelector('#screen-pause .btn-menu');
        if (pBtn) pBtn.innerText = 'SKIP TUTORIAL';
        if (tutorialBeat === 5 && typeof isMobileDevice === 'function' && isMobileDevice()) {
          tutorialMobileStep = 2;
          hideElementSpotlight();
          const restartBtn = document.getElementById('btn-pause-restart');
          showElementSpotlight(restartBtn, 'HERE');
        }
      } else if (screenId === 'screen-lose') {
        const rBtn = document.querySelector('#screen-lose .btn-retry');
        if (rBtn) rBtn.innerText = 'RESTART TUTORIAL';
        const mBtn = document.querySelector('#screen-lose .btn-menu');
        if (mBtn) mBtn.innerText = 'COURSE SELECT';
      }
    }
  };
}

window.addEventListener('resize', () => {
  if (tutorialActive && activeSpotlightEl) {
    showElementSpotlight(activeSpotlightEl, activeSpotlightLabel);
  }
});