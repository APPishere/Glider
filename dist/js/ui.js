function drawHudCanvas() {
  hudCtx.clearRect(0, 0, hudCanvas.width, hudCanvas.height);
  if (gameState !== 'RACING' && gameState !== 'RUNUP') return;
  if (devTimeFrozen) return; 

  const w = hudCanvas.width;
  const h = hudCanvas.height;

  if (devWarpTimer > 0) {
    const warpProgress = Math.min(1.0, devWarpTimer / 0.7);
    hudCtx.fillStyle = `rgba(0, 0, 0, ${warpProgress})`;
    hudCtx.fillRect(0, 0, w, h);
  }

  if (weather.lightningFlash > 0) {
    const flashAlpha = Math.min(weather.lightningFlash * 3.5, 0.32);
    hudCtx.fillStyle = `rgba(225, 238, 255, ${flashAlpha})`;
    hudCtx.fillRect(0, 0, w, h);
  }

  if (player.speed > 75) {
    const intensity = (player.speed - 75) / 105;
    hudCtx.strokeStyle = `rgba(255, 255, 255, ${Math.min(intensity * 0.5, 0.45)})`;
    hudCtx.lineWidth = 1.5;
    for (let i = 0; i < 18; i++) {
      const angle = (i / 18) * Math.PI * 2;
      const r1 = Math.min(w, h) * 0.30;
      const r2 = r1 + intensity * 85;
      hudCtx.beginPath();
      hudCtx.moveTo(w / 2 + Math.cos(angle) * r1, h / 2 + Math.sin(angle) * r1);
      hudCtx.lineTo(w / 2 + Math.cos(angle) * r2, h / 2 + Math.sin(angle) * r2);
      hudCtx.stroke();
    }
  }

  if (playerDraftTimer > 0 && (gameMode === 'race' || devWarpTimer > 0)) {
    const intensity = Math.min(playerDraftTimer / 3.0, 1.0);
    const isBoosted = playerDraftTimer >= 3.0;
    hudCtx.save();
    hudCtx.strokeStyle = isBoosted ? 'rgba(0, 240, 255, 0.9)' : `rgba(0, 240, 255, ${0.15 + intensity * 0.55})`;
    hudCtx.lineWidth = isBoosted ? 2.5 : 1.5;

    const t = performance.now() * 0.003;
    for (let i = 0; i < 14; i++) {
      const angle = (i / 14) * Math.PI * 2 + Math.sin(t + i) * 0.2;
      const progress = ((t * 4.0 + i / 14) % 1.0);
      const r1 = Math.min(w, h) * (0.45 - progress * 0.25);
      const r2 = r1 + (15 + intensity * 45);
      const cx = w / 2;
      const cy = h / 2;
      hudCtx.beginPath();
      hudCtx.moveTo(cx + Math.cos(angle) * r1, cy + Math.sin(angle) * r1);
      hudCtx.lineTo(cx + Math.cos(angle) * r2, cy + Math.sin(angle) * r2);
      hudCtx.stroke();
    }
    hudCtx.restore();
  }

  if (weather.rainIntensity > 0.05) {
    hudCtx.strokeStyle = `rgba(180, 225, 255, ${weather.rainIntensity * 0.55})`;
    hudCtx.lineWidth = weather.isStormy2X ? 2.0 : 1.5;

    const slant = (weather.windVector.x * 0.6) - (player.roll * 15);
    rainParticles.forEach(p => {
      p.y += p.speed * (1.0 + (player.speed / 60));
      p.x += slant * 0.5;
      if (p.y > h) {
        p.y = -20;
        p.x = Math.random() * w;
      }
      if (p.x < 0) p.x += w;
      if (p.x > w) p.x -= w;

      hudCtx.beginPath();
      hudCtx.moveTo(p.x, p.y);
      hudCtx.lineTo(p.x + slant, p.y + p.len);
      hudCtx.stroke();
    });
  }

  const course = COURSES[selectedCourseId];
  const activeSubtrack = course.subtracks[selectedSubtrack];
  if (course && gateMeshes[player.nextGateIdx]) {
    const targetWp = activeSubtrack.waypoints[player.nextGateIdx];
    const dx = targetWp.x - player.pos.x;
    const dz = targetWp.z - player.pos.z;
    const bearing = Math.atan2(-dx, -dz);
    let relAngle = bearing - player.yaw;

    while (relAngle > Math.PI) relAngle -= Math.PI * 2;
    while (relAngle < -Math.PI) relAngle += Math.PI * 2;

    const arrowX = w / 2;
    const arrowY = 115;
    const distMeters = Math.round(Math.hypot(dx, dz) * 0.3048);

    hudCtx.save();
    hudCtx.translate(arrowX, arrowY);

    hudCtx.strokeStyle = 'rgba(0, 240, 255, 0.25)';
    hudCtx.lineWidth = 1.5;
    hudCtx.beginPath();
    hudCtx.arc(0, 0, 20, 0, Math.PI * 2);
    hudCtx.stroke();

    if (isMobileDevice() && rudderBoost && (rudderBoost.charging || (rudderBoost.chargeTimer && rudderBoost.chargeTimer > 0))) {
      const chargeProgress = Math.min((rudderBoost.chargeTimer || 0) / 1.2, 1.0);
      if (chargeProgress > 0) {
        hudCtx.save();
        hudCtx.beginPath();
        hudCtx.arc(0, 0, 23.5, -Math.PI / 2, -Math.PI / 2 + chargeProgress * Math.PI * 2);
        hudCtx.strokeStyle = '#39ff14';
        hudCtx.lineWidth = chargeProgress >= 1.0 ? 3.5 : 2.5;
        if (chargeProgress >= 1.0) {
          hudCtx.shadowColor = '#39ff14';
          hudCtx.shadowBlur = 10;
        }
        hudCtx.stroke();
        hudCtx.restore();
      }
    }

    hudCtx.rotate(-relAngle);

    hudCtx.fillStyle = '#00f0ff';
    hudCtx.beginPath();
    hudCtx.moveTo(0, -14);
    hudCtx.lineTo(7, 7);
    hudCtx.lineTo(0, 3);
    hudCtx.lineTo(-7, 7);
    hudCtx.closePath();
    hudCtx.fill();

    hudCtx.restore();

    hudCtx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    hudCtx.font = '10px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    hudCtx.textAlign = 'center';
    hudCtx.letterSpacing = '1.5px';
    hudCtx.fillText(`${distMeters} M`, arrowX, arrowY + 36);
  }

    if (!isMobileDevice()) {
      drawCustomSpeedometer(hudCtx, w - 370, h - 175, player.speed, rudderBoost);
    }

  if (restartPromptOpacity > 0.005) {
    const rx = w / 2;
    const isHw = (HALLOWEEN_EVENT_ACTIVE || isHalloweenBossDuel);
    const ry = isHw ? (h - 138) : (h - 122);
    const circleRadius = 22;
    const ringRadius = 25.5;
    const progress = Math.min(restartHoldTimer / 2.0, 1.0);

    hudCtx.save();
    hudCtx.globalAlpha = restartPromptOpacity;

    hudCtx.fillStyle = 'rgba(0, 0, 0, 0.88)';
    hudCtx.beginPath();
    hudCtx.arc(rx, ry, circleRadius, 0, Math.PI * 2);
    hudCtx.fill();

    hudCtx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
    hudCtx.lineWidth = 2.0;
    hudCtx.beginPath();
    hudCtx.arc(rx, ry, ringRadius, 0, Math.PI * 2);
    hudCtx.stroke();

    if (progress > 0) {
      hudCtx.beginPath();
      hudCtx.arc(rx, ry, ringRadius, -Math.PI / 2, -Math.PI / 2 + progress * Math.PI * 2);
      hudCtx.strokeStyle = '#ffffff';
      hudCtx.lineWidth = progress >= 1.0 ? 3.5 : 2.5;
      if (progress >= 1.0) {
        hudCtx.shadowColor = '#ffffff';
        hudCtx.shadowBlur = 12;
      }
      hudCtx.stroke();
      hudCtx.shadowBlur = 0;
    }

    hudCtx.fillStyle = '#ffffff';
    hudCtx.font = '900 18px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    hudCtx.textAlign = 'center';
    hudCtx.textBaseline = 'middle';
    hudCtx.fillText('R', rx, ry + 1);

    hudCtx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    hudCtx.font = '700 9.5px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    hudCtx.textAlign = 'center';
    hudCtx.textBaseline = 'top';
    hudCtx.letterSpacing = '1.5px';
    hudCtx.fillText('HOLD FOR 2 SECONDS', rx, ry + circleRadius + 9);

    hudCtx.restore();
  }

  if (devFadeInTimer > 0) {
    const alpha = Math.min(1.0, Math.max(0, devFadeInTimer / 0.75));
    hudCtx.fillStyle = `rgba(0, 0, 0, ${alpha})`;
    hudCtx.fillRect(0, 0, w, h);
  }
}

function drawCustomSpeedometer(ctx, x, y, speed, rBoost) {
  ctx.save();
  ctx.translate(x, y);

  const scale = 0.50;
  ctx.scale(scale, scale);

  const chargeProgress = Math.min((rBoost.chargeTimer || 0) / 1.2, 1.0);
  const isPrimed = (rBoost.chargeTimer || 0) >= 0.4;

  if (chargeProgress > 0) {
    ctx.save();

    ctx.beginPath();
    ctx.moveTo(220, 308);
    ctx.lineTo(238, 272);
    ctx.lineTo(522, 271); 
    ctx.lineTo(558, 246); 
    ctx.lineTo(583, 199); 
    ctx.lineTo(638, 199); 
    ctx.lineTo(646, 314); 
    ctx.closePath();
    ctx.clip(); 

    const minX = 220;
    const maxX = 615;
    const fillX = minX + (maxX - minX) * chargeProgress;

    if (isPrimed) {
      ctx.fillStyle = '#39ff14';
      ctx.shadowColor = '#39ff14';
      ctx.shadowBlur = 10;
    } else {
      const fillGrad = ctx.createLinearGradient(minX, 0, fillX, 0);
      fillGrad.addColorStop(0, '#55cc00');
      fillGrad.addColorStop(1, '#a3e635');
      ctx.fillStyle = fillGrad;
    }

    ctx.fillRect(minX, 195, fillX - minX, 125);

    ctx.shadowBlur = 0;
    ctx.shadowColor = 'transparent';

    ctx.strokeStyle = 'rgba(0, 0, 0, 0.55)';
    ctx.lineWidth = 2.5;
    for (let rx = minX + 16; rx <= fillX; rx += 16) {
      ctx.beginPath();
      ctx.moveTo(rx, 195);
      ctx.lineTo(rx, 320);
      ctx.stroke();
    }

    ctx.restore();
  }

  if (speedometerImg && speedometerImg.complete && speedometerImg.naturalWidth > 0) {
    ctx.drawImage(speedometerImg, 0, 0);
  }

  const speedInt = Math.min(999, Math.max(0, Math.round(speed || 0)));
  const speedStr = String(speedInt).padStart(3, '0');

  ctx.fillStyle = '#08080c';
  ctx.font = '900 42px "Courier New", Courier, monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.letterSpacing = '3px';
  ctx.fillText(speedStr, 540, 156);

  const pivotX = 380;
  const pivotY = 197;

  const startAngle = 160 * (Math.PI / 180);
  const totalSweep = 160 * (Math.PI / 180);
  const clampedSpeed = Math.min(180, Math.max(0, speed || 0));
  const speedRatio = clampedSpeed / 180;
  const needleAngle = startAngle + speedRatio * totalSweep;

  const equippedPointer = localStorage.getItem('glider_speedo_pointer') || 'default';

  if (equippedPointer === 'pointer2' && speedometerPointer2Img && speedometerPointer2Img.complete && speedometerPointer2Img.naturalWidth > 0) {
    ctx.save();
    ctx.translate(pivotX, pivotY);
    ctx.rotate(needleAngle - 0.344);
    const s = 1.13;
    ctx.scale(s, s);
    ctx.drawImage(speedometerPointer2Img, -15, -25);
    ctx.restore();
  } else {
    ctx.save();
    ctx.translate(pivotX, pivotY);
    ctx.rotate(needleAngle);

    const needleLen = 148;
    const tailLen = 46;
    const halfWidth = 14;

    ctx.beginPath();
    ctx.moveTo(needleLen, 0);
    ctx.lineTo(22, halfWidth);
    ctx.lineTo(-tailLen, 0);
    ctx.closePath();
    ctx.fillStyle = '#b347f7';
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(needleLen, 0);
    ctx.lineTo(-tailLen, 0);
    ctx.lineTo(22, -halfWidth);
    ctx.closePath();
    ctx.fillStyle = '#5f189e';
    ctx.fill();

    ctx.strokeStyle = '#f3e8ff';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(-tailLen, 0);
    ctx.lineTo(needleLen, 0);
    ctx.stroke();

    // Original Purple Center Cap
    ctx.beginPath();
    ctx.arc(0, 0, 24, 0, Math.PI * 2);
    ctx.fillStyle = '#2c0c4d';
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#a855f7';
    ctx.stroke();

    ctx.restore();
  }
  ctx.restore();
}
let lastMinimapDrawTime = 0;
function drawMinimap() {
  if (!minimapCtx) return;
  const now = performance.now();
  if (now - lastMinimapDrawTime < 55) return;
  lastMinimapDrawTime = now;

  const mw = minimapCanvas.width;
  const mh = minimapCanvas.height;
  const course = COURSES[selectedCourseId];
  const activeSubtrack = course.subtracks[selectedSubtrack];
const b = (selectedCourseId === 'canyon' && selectedSubtrack === 'D')
    ? { minX: -13500, maxX: 13500, minZ: -15000, maxZ: 3500 }
    : (selectedCourseId === 'moon' && selectedSubtrack === 'D')
    ? { minX: -7000, maxX: 7000, minZ: -26000, maxZ: 1000 }
    : course.bounds;

  minimapCtx.clearRect(0, 0, mw, mh);

  if (selectedCourseId === 'canyon') {
    minimapCtx.fillStyle = '#261c16';
  } else if (selectedCourseId === 'islands') {
    minimapCtx.fillStyle = '#0d131a';
  } else if (selectedCourseId === 'volcano') {
    minimapCtx.fillStyle = '#100a0d';
  } else {
    minimapCtx.fillStyle = '#0a1a24';
  }
  minimapCtx.fillRect(0, 0, mw, mh);

  function toMapX(wx) {
    return THREE.MathUtils.mapLinear(wx, b.minX, b.maxX, 12, mw - 12);
  }
  function toMapY(wz) {
    return THREE.MathUtils.mapLinear(wz, b.minZ, b.maxZ, 12, mh - 12);
  }

  if (selectedCourseId === 'islands') {
    minimapCtx.fillStyle = 'rgba(65, 105, 60, 0.45)';
    islandPlates.forEach(isl => {
      const ix = toMapX(isl.x);
      const iy = toMapY(isl.z);
      const ir = (isl.radius / (b.maxX - b.minX)) * mw * 1.5;
      minimapCtx.beginPath();
      minimapCtx.arc(ix, iy, Math.max(3, ir), 0, Math.PI * 2);
      minimapCtx.fill();
    });
  } else if (selectedCourseId === 'coastal') {
    minimapCtx.fillStyle = 'rgba(120, 120, 120, 0.8)';
    seaStacks.forEach(stk => {
      const sx = toMapX(stk.x);
      const sy = toMapY(stk.z);
      minimapCtx.beginPath();
      minimapCtx.arc(sx, sy, 2.5, 0, Math.PI * 2);
      minimapCtx.fill();
    });
  } else if (selectedCourseId === 'volcano') {
    const drawIsland = (wx, wz, wr, fill = 'rgba(38, 26, 28, 0.85)') => {
      const mx = toMapX(wx);
      const my = toMapY(wz);
      const mr = (wr / (b.maxX - b.minX)) * mw;
      minimapCtx.fillStyle = fill;
      minimapCtx.beginPath();
      minimapCtx.arc(mx, my, Math.max(5, mr), 0, Math.PI * 2);
      minimapCtx.fill();
    };

    drawIsland(0, 80, 1500);          
    drawIsland(-3600, -4200, 1900);   
    drawIsland(3500, -7200, 2000);    
    drawIsland(600, -10800, 1700);    

    const vX = toMapX(0);
    const vY = toMapY(-5500);
    const vR = (3600 / (b.maxX - b.minX)) * mw;

    minimapCtx.fillStyle = 'rgba(20, 12, 14, 0.95)';
    minimapCtx.beginPath();
    minimapCtx.arc(vX, vY, vR, 0, Math.PI * 2);
    minimapCtx.fill();

    minimapCtx.strokeStyle = 'rgba(255, 65, 0, 0.25)';
    minimapCtx.lineWidth = 1.5;
    minimapCtx.beginPath();
    minimapCtx.arc(vX, vY, vR * 0.55, 0, Math.PI * 2);
    minimapCtx.stroke();

    minimapCtx.fillStyle = 'rgba(255, 55, 0, 0.9)';
    minimapCtx.beginPath();
    minimapCtx.arc(vX, vY, 7, 0, Math.PI * 2);
    minimapCtx.fill();

    minimapCtx.fillStyle = '#ffaa00';
    minimapCtx.beginPath();
    minimapCtx.arc(vX, vY, 3.5, 0, Math.PI * 2);
    minimapCtx.fill();
  }

else if (selectedCourseId === 'glacial') {
    minimapCtx.fillStyle = '#0e1f2b'; 
  }
else if (selectedCourseId === 'moon') {
    minimapCtx.fillStyle = '#050608'; 
  }

  minimapCtx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
  minimapCtx.lineWidth = 1;
  minimapCtx.setLineDash([3, 3]);
  minimapCtx.beginPath();
  activeSubtrack.waypoints.forEach((wp, i) => {
    const mx = toMapX(wp.x);
    const my = toMapY(wp.z);
    if (i === 0) minimapCtx.moveTo(mx, my);
    else minimapCtx.lineTo(mx, my);
  });

const isPointToPoint = (selectedSubtrack === 'C' && (selectedCourseId === 'volcano' || selectedCourseId === 'glacial' || selectedCourseId === 'moon'));  if (!isPointToPoint) {
    minimapCtx.closePath();
  }
  minimapCtx.stroke();
  minimapCtx.setLineDash([]);

  const pulse = Math.sin(performance.now() * 0.006) * 2;
  activeSubtrack.thermals.forEach(th => {
    const tx = toMapX(th.pos.x);
    const ty = toMapY(th.pos.z);
    minimapCtx.strokeStyle = 'rgba(0, 240, 255, 0.7)';
    minimapCtx.lineWidth = 1.5;
    minimapCtx.beginPath();
    minimapCtx.arc(tx, ty, 6 + pulse, 0, Math.PI * 2);
    minimapCtx.stroke();
  });

  activeBirdFlocks.forEach(flock => {
    flock.subClusters.forEach(cluster => {
      const bx = toMapX(cluster.worldPos.x);
      const by = toMapY(cluster.worldPos.z);
      minimapCtx.fillStyle = 'rgba(215, 225, 235, 0.85)';
      minimapCtx.beginPath();
      minimapCtx.arc(bx, by, 2.0, 0, Math.PI * 2);
      minimapCtx.fill();
    });
  });

  activeSubtrack.waypoints.forEach((wp, idx) => {
    const gx = toMapX(wp.x);
    const gy = toMapY(wp.z);
    if (idx === player.nextGateIdx) {
      minimapCtx.fillStyle = '#00f0ff';
      minimapCtx.beginPath();
      minimapCtx.arc(gx, gy, 4, 0, Math.PI * 2);
      minimapCtx.fill();
    } else {
      minimapCtx.fillStyle = 'rgba(255, 255, 255, 0.5)';
      minimapCtx.beginPath();
      minimapCtx.arc(gx, gy, 2, 0, Math.PI * 2);
      minimapCtx.fill();
    }
  });

  if (gameMode === 'race') {
    aiGliders.forEach(ai => {
      const ax = toMapX(ai.pos.x);
      const ay = toMapY(ai.pos.z);
      if (ai.isPhantomBoss) {
        minimapCtx.fillStyle = '#050505';
        minimapCtx.strokeStyle = 'rgba(255, 255, 255, 0.65)';
        minimapCtx.lineWidth = 1.2;
        minimapCtx.beginPath();
        minimapCtx.arc(ax, ay, 3.5, 0, Math.PI * 2);
        minimapCtx.fill();
        minimapCtx.stroke();
      } else if (ai.isKrampusBoss) {
        minimapCtx.fillStyle = '#0a0a0a';
        minimapCtx.strokeStyle = '#ff1111';
        minimapCtx.lineWidth = 1.4;
        minimapCtx.beginPath();
        minimapCtx.arc(ax, ay, 3.5, 0, Math.PI * 2);
        minimapCtx.fill();
        minimapCtx.stroke();
      } else {
        minimapCtx.fillStyle = `#${ai.color.toString(16).padStart(6, '0')}`;
        minimapCtx.beginPath();
        minimapCtx.arc(ax, ay, 3, 0, Math.PI * 2);
        minimapCtx.fill();
      }
    });
  }

  if (gameMode === 'timetrial' && ghostDroneGroup) {
    const gx = toMapX(ghostDroneGroup.position.x);
    const gy = toMapY(ghostDroneGroup.position.z);
    const curGhostSkin = GHOST_SKINS.find(s => s.id === getEquippedGhostSkinId()) || GHOST_SKINS[0];
    minimapCtx.fillStyle = curGhostSkin.previewColor || '#ee2233';
    minimapCtx.beginPath();
    minimapCtx.arc(gx, gy, 3.5, 0, Math.PI * 2);
    minimapCtx.fill();
  }

  const px = toMapX(player.pos.x);
  const py = toMapY(player.pos.z);

  minimapCtx.save();
  minimapCtx.translate(px, py);
  minimapCtx.rotate(-player.yaw);

  minimapCtx.fillStyle = 'rgba(0, 240, 255, 0.25)';
  minimapCtx.beginPath();
  minimapCtx.moveTo(0, 0);
  minimapCtx.arc(0, 0, 16, -Math.PI * 0.7, -Math.PI * 0.3);
  minimapCtx.closePath();
  minimapCtx.fill();

  minimapCtx.fillStyle = '#ffffff';
  minimapCtx.beginPath();
  minimapCtx.moveTo(0, -6);
  minimapCtx.lineTo(4, 4);
  minimapCtx.lineTo(0, 2);
  minimapCtx.lineTo(-4, 4);
  minimapCtx.closePath();
  minimapCtx.fill();

  minimapCtx.restore();

  const wx0 = 16;
  const wy0 = mh - 16;
  const wAngle = weather.windAngle;
  minimapCtx.strokeStyle = 'rgba(0, 240, 255, 0.8)';
  minimapCtx.lineWidth = 1.5;
  minimapCtx.beginPath();
  minimapCtx.moveTo(wx0, wy0);
  minimapCtx.lineTo(wx0 + Math.sin(wAngle) * 9, wy0 + Math.cos(wAngle) * 9);
  minimapCtx.stroke();
}

function startCountdown() {
  audio.init();
  if (screen.orientation && screen.orientation.lock) {
    screen.orientation.lock('landscape').catch(() => {});
  }
  gameState = 'RUNUP';
  const hwDecor = document.getElementById('halloween-decor-wrap');
  if (hwDecor) hwDecor.style.display = 'none';
  const hwBanner = document.getElementById('happy-halloween-banner');
  if (hwBanner) {
    hwBanner.style.display = 'none';
    hwBanner.classList.remove('visible');
  }
  showScreen(null);
  stopMenuTheme(true);
  buildCourse(selectedCourseId);

  const course = COURSES[selectedCourseId];
  const activeSubtrack = course.subtracks[selectedSubtrack];
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

  const banner = document.getElementById('race-finish-banner');
  if (banner) banner.style.display = 'none';
  if (paragliderWingGroup) paragliderWingGroup.visible = true;
  updateCameraView(0, 0);

currentGhostRun = [];
ghostFrameIdx = 0;
playerDraftTimer = 0;
screenShake = 0;
devFreeCam = false;
devTimeFrozen = false;
devWarpTimer = 0;
raceElapsedTime = 0;
pauseStartTime = 0;
pausedState = 'RACING';
restartHoldTimer = 0;
restartPromptOpacity = 0;
mouseLeftPressed = false;
mouseRightPressed = false;

stallMechanic.active = false;
  stallMechanic.recoveryWindowTimer = 0;
  stallMechanic.bonusBannerTimer = 0;
  stallMechanic.canBonus = true;
  rudderBoost.charging = false;
  rudderBoost.chargeTimer = 0;
  rudderBoost.cooldownTimer = 0;
  rudderBoost.rearmed = true;
  rudderBoost.releasePitch = 0;
  rudderBoost.activeDir = 0;
  lunarMeteorEvent.triggered = false;
  lunarMeteorEvent.active = false;
  lunarMeteorEvent.timer = 0;
  lunarMeteorEvent.impactMeshes = [];
  if (lunarMeteorEvent.group) {
    environmentGroup.remove(lunarMeteorEvent.group);
    lunarMeteorEvent.group = null;
  }

  volcanoEvent.warningActive = false;
  volcanoEvent.exploded = false;
  if (volcanoEvent.explosionGroup) {
    environmentGroup.remove(volcanoEvent.explosionGroup);
    volcanoEvent.explosionGroup = null;
    volcanoEvent.rocks = [];
    volcanoEvent.smokeSystem = null;
    volcanoEvent.denseSmokeMeshes = [];
  }
  const warnEl = document.getElementById('volcano-event-warning');
  if (warnEl) warnEl.style.display = 'none';

  if (gameMode === 'timetrial' && ghostDroneGroup) {
    const forward = cliffForwardDir.clone();
    forward.y = 0;
    forward.normalize();
    
    const left = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), forward).normalize();
    const offset = left.clone().multiplyScalar(35).add(forward.clone().multiplyScalar(15));
    const ghostStartPos = runwayBasePos.clone().add(offset);
    
    ghostDroneGroup.position.copy(ghostStartPos);
    ghostDroneGroup.rotation.set(0, 0, 0);
    ghostDroneGroup.rotation.order = 'YXZ';
    ghostDroneGroup.rotation.y = player.yaw;
    update2DDroneMesh(ghostDroneGroup, camera);
  }

  const hudStatsBar = document.querySelector('.hud-stats');
  const mmContainer = document.getElementById('minimap-container');
  const isHwTheme = (isHalloweenBossDuel || HALLOWEEN_EVENT_ACTIVE);
  if (hudStatsBar) hudStatsBar.classList.toggle('halloween-theme', isHwTheme);
  if (mmContainer) mmContainer.classList.toggle('halloween-theme', isHwTheme);

  gameState = 'RUNUP';
  runupProgress = 0;
  countdownElapsed = 0;
  countdownStage = 3;

  if (typeof updateHalloweenThemeVisibility === 'function') {
    updateHalloweenThemeVisibility();
  }

  if (mobileJoystickMode === 'gyro') {
    calibrateGyro();
  }

  const countBox = document.getElementById('countdown-box');
  countBox.style.display = 'block';
  countBox.innerText = '3';
  audio.playBeep(440, 'sine', 0.15);

   updateJoystickVisibility();
}

function updateRunup(dt) {
  if (gameState !== 'RUNUP') return;

  countdownElapsed += dt;

  if (countdownElapsed >= 0.9 && countdownStage === 3) {
    countdownStage = 2;
    document.getElementById('countdown-box').innerText = '2';
    audio.playBeep(440, 'sine', 0.15);
  } else if (countdownElapsed >= 1.8 && countdownStage === 2) {
    countdownStage = 1;
    document.getElementById('countdown-box').innerText = '1';
    audio.playBeep(440, 'sine', 0.15);
  } else if (countdownElapsed >= 2.7 && countdownStage === 1) {
    countdownStage = 0;
    if (mobileJoystickMode === 'gyro') {
      calibrateGyro();
    }
    document.getElementById('countdown-box').innerText = 'GO!';
    audio.playBeep(880, 'triangle', 0.3);
    camera.fov = 88;
    camera.updateProjectionMatrix();
    screenShake = 0.8;
  } else if (countdownElapsed >= 3.6 && countdownStage === 0) {
    countdownStage = -1;
    document.getElementById('countdown-box').style.display = 'none';
  }

  runupProgress += dt * 0.37;
  const runupSpeed = THREE.MathUtils.lerp(10, 68, Math.min(runupProgress, 1.0));
  player.speed = runupSpeed;

  player.pos.addScaledVector(cliffForwardDir, runupSpeed * dt * 2.2);

  if (gameMode === 'timetrial' && ghostDroneGroup) {
    ghostDroneGroup.position.addScaledVector(cliffForwardDir, runupSpeed * dt * 2.2);
    ghostDroneGroup.rotation.set(0, 0, 0);
    ghostDroneGroup.rotation.order = 'YXZ';
    ghostDroneGroup.rotation.y = player.yaw;
    update2DDroneMesh(ghostDroneGroup, camera);
  }

if (runupProgress >= 1.0) {
    player.flightPathPitch = 0;
    raceStartTime = performance.now();
    gameState = 'RACING';
    document.getElementById('countdown-box').style.display = 'none';
    updateJoystickVisibility();
    const hwDecor = document.getElementById('halloween-decor-wrap');
    if (hwDecor) hwDecor.style.display = 'none';
    const hwBanner = document.getElementById('happy-halloween-banner');
    if (hwBanner) {
      hwBanner.style.display = 'none';
      hwBanner.classList.remove('visible');
    }
    if (typeof updateHalloweenThemeVisibility === 'function') {
      updateHalloweenThemeVisibility();
    }
  }

  updateCameraView(0, 0);
  updateShadowMesh(playerShadowMesh, player.pos.x, player.pos.y, player.pos.z, player.yaw, selectedCourseId);
  audio.updateWind(player.speed, false);
  updateAI(dt);
}


function getPlayerGliderColor() {
  const skinId = getEquippedSkinId();
  switch (skinId) {
    case 'glider_santa':
      return '#c41220';
    case 'glider_halloween':
      return '#ff6600'; 
    case 'glider_16bit':
      return '#8e44ad';
    case 'default':
      return '#ee2233'; 
    case 'lava_core':
      return '#ff6600'; 
    case 'glider_tv_static':
      return '#ffffff'; 
    case 'lunar_voyager':
      return '#e5a93b'; 
    case 'first_silver':
      return '#d0d7de'; 
    case 'all_bronze':
      return '#c87533'; 
    case 'first_gold':
      return '#dfb12c'; 
    case 'all_silver':
      return '#eef2f6'; 
    case 'all_gold':
      return '#ffcc00'; 
    case 'aphelion_apex':
      return '#00f0ff'; 
    case 'all_ace':
      return '#ca8aff'; 
    default:
      return '#00f0ff';
  }
}

let gpTrophyScene = null, gpTrophyCamera = null, gpTrophyRenderer = null;
let gpTrophyGroup = null, gpConfettiSystem = null;
let gpConfettiVels = [];

function initGrandPrixTrophy3D() {
  const canvas = document.getElementById('gp-trophy-canvas');
  if (!canvas) return;

  gpTrophyScene = new THREE.Scene();
  gpTrophyCamera = new THREE.PerspectiveCamera(40, canvas.width / canvas.height, 0.1, 100);
  gpTrophyCamera.position.set(0, 0.9, 10.8);
  gpTrophyCamera.lookAt(0, 0.2, 0);

  gpTrophyRenderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  gpTrophyRenderer.setSize(canvas.width, canvas.height);
  gpTrophyRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  const amb = new THREE.AmbientLight(0xffffff, 0.95);
  gpTrophyScene.add(amb);

  const sun = new THREE.DirectionalLight(0xfffae0, 1.4);
  sun.position.set(8, 14, 10);
  gpTrophyScene.add(sun);

  const rim = new THREE.DirectionalLight(0x00f0ff, 0.6);
  rim.position.set(-8, -4, -6);
  gpTrophyScene.add(rim);

  const count = 52;
  const cGeom = new THREE.BufferGeometry();
  const cPos = new Float32Array(count * 3);
  const cCols = new Float32Array(count * 3);
  gpConfettiVels = [];
  const palette = [
    [1.0, 0.85, 0.1], // gold
    [0.0, 0.95, 1.0], // cyan
    [1.0, 0.25, 0.6], // magenta
    [0.2, 0.95, 0.4], // green
    [1.0, 0.35, 0.15] // red/orange
  ];

  for (let i = 0; i < count; i++) {
    cPos[i * 3] = (Math.random() - 0.5) * 8.5;
    cPos[i * 3 + 1] = (Math.random() - 0.5) * 7.5;
    cPos[i * 3 + 2] = (Math.random() - 0.5) * 5.0;
    const col = palette[Math.floor(Math.random() * palette.length)];
    cCols[i * 3] = col[0];
    cCols[i * 3 + 1] = col[1];
    cCols[i * 3 + 2] = col[2];
    gpConfettiVels.push({
      speedY: 1.5 + Math.random() * 2.2,
      driftX: (Math.random() - 0.5) * 0.8,
      wobbleSpeed: 2.2 + Math.random() * 3.5,
      wobblePhase: Math.random() * Math.PI * 2
    });
  }

  cGeom.setAttribute('position', new THREE.BufferAttribute(cPos, 3));
  cGeom.setAttribute('color', new THREE.BufferAttribute(cCols, 3));
  const cMat = new THREE.PointsMaterial({
    size: 2.2,
    sizeAttenuation: false,
    vertexColors: true,
    transparent: true,
    opacity: 0.85,
    depthWrite: false
  });
  gpConfettiSystem = new THREE.Points(cGeom, cMat);
  gpTrophyScene.add(gpConfettiSystem);
}

function updateGrandPrixTrophyModel(rank) {
  if (!gpTrophyScene) initGrandPrixTrophy3D();
  if (!gpTrophyScene) return;

  if (gpTrophyGroup) {
    gpTrophyScene.remove(gpTrophyGroup);
    gpTrophyGroup = null;
  }

  gpTrophyGroup = new THREE.Group();

  let mat;
  if (rank === 1) {
    mat = new THREE.MeshStandardMaterial({ color: 0xffcc00, emissive: 0x443000, metalness: 0.95, roughness: 0.12 });
  } else if (rank === 2) {
    mat = new THREE.MeshStandardMaterial({ color: 0xdce2ea, emissive: 0x161c22, metalness: 0.96, roughness: 0.10 });
  } else if (rank === 3) {
    mat = new THREE.MeshStandardMaterial({ color: 0xcd7f32, emissive: 0x2e1406, metalness: 0.88, roughness: 0.20 });
  } else {
    mat = new THREE.MeshStandardMaterial({ color: 0x767e87, emissive: 0x101316, metalness: 0.78, roughness: 0.32 });
  }

  const baseMat = new THREE.MeshStandardMaterial({ color: 0x181210, roughness: 0.55, metalness: 0.35 });

  // Marble tiered base
  const base = new THREE.Mesh(new THREE.CylinderGeometry(2.1, 2.5, 0.9, 16), baseMat);
  base.position.y = -2.1;
  gpTrophyGroup.add(base);

  const baseTier2 = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.9, 0.45, 16), mat);
  baseTier2.position.y = -1.48;
  gpTrophyGroup.add(baseTier2);

  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.40, 0.62, 1.7, 14), mat);
  stem.position.y = -0.45;
  gpTrophyGroup.add(stem);

  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.72, 0.18, 8, 20), mat);
  collar.rotation.x = Math.PI / 2;
  collar.position.y = -0.45;
  gpTrophyGroup.add(collar);

  // Chalice cup bowl
  const bowl = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 0.85, 2.4, 20, 1, false), mat);
  bowl.position.y = 1.35;
  gpTrophyGroup.add(bowl);

  const rim = new THREE.Mesh(new THREE.TorusGeometry(2.2, 0.18, 8, 24), mat);
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 2.55;
  gpTrophyGroup.add(rim);

  [-1, 1].forEach(side => {
    const handle = new THREE.Mesh(
      new THREE.TorusGeometry(0.95, 0.16, 10, 22, Math.PI),
      mat
    );
    handle.position.set(side * 2.65, 1.35, 0);
    handle.rotation.z = -side * Math.PI / 2;
    gpTrophyGroup.add(handle);
  });

  const medallionMat = new THREE.MeshStandardMaterial({
    color: 0xffe066,
    emissive: 0x6b3a00,
    emissiveIntensity: 0.55,
    metalness: 0.95,
    roughness: 0.15
  });

  const medallion = new THREE.Mesh(
    new THREE.SphereGeometry(0.38, 20, 20),
    medallionMat
  );
  medallion.position.set(0, 1.55, 1.55);
  medallion.scale.set(1.0, 1.0, 0.5); 
  gpTrophyGroup.add(medallion);

  const medallionRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.5, 0.07, 8, 20),
    medallionMat
  );
  medallionRing.position.set(0, 1.55, 1.53);
  gpTrophyGroup.add(medallionRing);

  gpTrophyScene.add(gpTrophyGroup);
}


const GRAND_PRIX_CUPS = [
  {
    id: 'sunrise',
    name: 'Sunrise Cup',
    image: 'sunrisecup.png',
    tier: 'Select Start Championship to begin!',
    vibe: 'Rookie / Cruising',
    races: [
      { courseId: 'canyon', subtrack: 'A', name: 'Red Rock Slalom' },
      { courseId: 'islands', subtrack: 'A', name: 'Broken Gates' },
      { courseId: 'coastal', subtrack: 'A', name: 'Storm Beacon' }
    ]
  },
  {
    id: 'ember',
    name: 'Ember Cup',
    image: 'embercup.png',
    tier: 'Select Start Championship to begin!',
    vibe: 'Rookie / Alien',
    races: [
      { courseId: 'volcano', subtrack: 'A', name: 'Obsidian Shore' },
      { courseId: 'glacial', subtrack: 'A', name: 'Subzero Summit' },
      { courseId: 'moon', subtrack: 'A', name: 'Apollo Landing' }
    ]
  },
  {
    id: 'gale',
    name: 'Gale Cup',
    image: 'galecup.png',
    tier: 'Select Start Championship to begin!',
    vibe: 'Pro / Sinks',
    races: [
      { courseId: 'canyon', subtrack: 'B', name: 'Needle Peak Ascent' },
      { courseId: 'islands', subtrack: 'B', name: 'Abyssal' },
      { courseId: 'coastal', subtrack: 'B', name: 'Ghost Fleet' }
    ]
  },
  {
    id: 'aether',
    name: 'Aether Cup',
    image: 'aethercup.png',
    tier: 'Select Start Championship to begin!',
    vibe: 'Pro / Endurance',
    races: [
      { courseId: 'volcano', subtrack: 'B', name: 'Ashfall Ridge' },
      { courseId: 'glacial', subtrack: 'B', name: 'Razor Pass' },
      { courseId: 'moon', subtrack: 'B', name: 'Rover Rally' }
    ]
  },
  {
    id: 'odyssey',
    name: 'Odyssey Cup',
    image: 'odysseycup.png',
    tier: 'Select Start Championship to begin!',
    vibe: 'Master / Marathon',
    races: [
      { courseId: 'canyon', subtrack: 'C', name: 'Grand Canyon' },
      { courseId: 'islands', subtrack: 'C', name: 'Sky Citadel' },
      { courseId: 'coastal', subtrack: 'C', name: 'Jagged Horizon' }
    ]
  },
  {
    id: 'aphelion',
    name: 'Aphelion Cup',
    image: 'aphelioncup.png',
    tier: 'Select Start Championship to begin!',
    vibe: 'Aphelion / Finale',
    races: [
      { courseId: 'volcano', subtrack: 'C', name: 'Caldera Breach' },
      { courseId: 'glacial', subtrack: 'C', name: 'Polar Expedition' },
      { courseId: 'moon', subtrack: 'C', name: 'The Final Step' }
    ]
  }
];

const ALL_STANDARD_TRACKS = [
  { courseId: 'canyon', subtrack: 'A', name: 'Red Rock Slalom' },
  { courseId: 'canyon', subtrack: 'B', name: 'Needle Peak Ascent' },
  { courseId: 'canyon', subtrack: 'C', name: 'Grand Canyon' },
  { courseId: 'islands', subtrack: 'A', name: 'Broken Gates' },
  { courseId: 'islands', subtrack: 'B', name: 'Abyssal' },
  { courseId: 'islands', subtrack: 'C', name: 'Sky Citadel' },
  { courseId: 'coastal', subtrack: 'A', name: 'Storm Beacon' },
  { courseId: 'coastal', subtrack: 'B', name: 'Ghost Fleet' },
  { courseId: 'coastal', subtrack: 'C', name: 'Jagged Horizon' },
  { courseId: 'volcano', subtrack: 'A', name: 'Obsidian Shore' },
  { courseId: 'volcano', subtrack: 'B', name: 'Ashfall Ridge' },
  { courseId: 'volcano', subtrack: 'C', name: 'Caldera Breach' },
  { courseId: 'glacial', subtrack: 'A', name: 'Subzero Summit' },
  { courseId: 'glacial', subtrack: 'B', name: 'Razor Pass' },
  { courseId: 'glacial', subtrack: 'C', name: 'Polar Expedition' },
  { courseId: 'moon', subtrack: 'A', name: 'Apollo Landing' },
  { courseId: 'moon', subtrack: 'B', name: 'Rover Rally' },
  { courseId: 'moon', subtrack: 'C', name: 'The Final Step' }
];

let selectedSelectTab = 'single'; // 'single' | 'gp'
let selectedGpCupId = 'sunrise';
let selectedGpDifficulty = localStorage.getItem('glider_gp_difficulty') || 'medium';
let shuffleTracksCache = null;

const grandPrixState = {
  active: false,
  cupId: 'sunrise',
  cupData: null,
  currentRaceIndex: 0,
  difficulty: 'medium',
  races: [],
  racers: []
};

const GP_POINTS_TABLE = { 1: 10, 2: 6, 3: 4, 4: 3, 5: 2 };

function generateRandomShuffleTracks() {
  const pool = [...ALL_STANDARD_TRACKS];
  const chosen = [];
  for (let i = 0; i < 4; i++) {
    const idx = Math.floor(Math.random() * pool.length);
    chosen.push(pool.splice(idx, 1)[0]);
  }
  return chosen;
}

function sortGrandPrixStandings(racers) {
  return [...racers].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    const aWins = a.finishes.filter(f => f === 1).length;
    const bWins = b.finishes.filter(f => f === 1).length;
    if (bWins !== aWins) return bWins - aWins;
    const aTotalTime = a.times.reduce((sum, t) => sum + t, 0);
    const bTotalTime = b.times.reduce((sum, t) => sum + t, 0);
    if (Math.abs(aTotalTime - bTotalTime) > 0.05) return aTotalTime - bTotalTime;
    const aMinTime = Math.min(...a.times);
    const bMinTime = Math.min(...b.times);
    return aMinTime - bMinTime;
  });
}

function renderGrandPrixCupList() {
  const listEl = document.getElementById('gp-cup-list');
  const listElDt = document.getElementById('gp-cup-list-dt');
  
  if (listEl) listEl.innerHTML = '';
  if (listElDt) listElDt.innerHTML = '';

  GRAND_PRIX_CUPS.forEach(cup => {
    const isActive = (selectedGpCupId === cup.id);
    const savedStars = parseInt(localStorage.getItem(`gp_stars_${cup.id}`) || '0', 10);
    const bestPos = parseInt(localStorage.getItem(`gp_best_pos_${cup.id}`) || '99', 10);
    const bestPts = localStorage.getItem(`gp_best_pts_${cup.id}`);

    let bestBadge = '';
    if (bestPos <= 5 && bestPts !== null) {
      const posNames = { 1: '1ST', 2: '2ND', 3: '3RD', 4: '4TH', 5: '5TH' };
      const col = bestPos === 1 ? 'var(--gold)' : (bestPos === 2 ? '#d0d7de' : (bestPos === 3 ? '#cd7f32' : 'var(--mono-60)'));
      bestBadge = `<div class="pb-tag" style="color: ${col}; font-size: 8.5px; margin-top: 3px;">BEST: ${posNames[bestPos]} (${bestPts} PTS)</div>`;
    }

    let starSlotsHtml = '';
    for (let s = 0; s < 3; s++) {
      const earned = s < savedStars;
      const starChar = earned ? '★' : '☆';
      const col = earned ? 'var(--gold)' : 'var(--mono-20)';
      starSlotsHtml += `<span style="color: ${col}; font-size: 13px; line-height: 1;">${starChar}</span>`;
    }

    if (listEl) {
      const card = document.createElement('div');
      card.className = `course-grid-card cup-opt ${isActive ? 'active' : ''}`;
      card.setAttribute('data-cup', cup.id);
      card.innerHTML = `
        <img src="${cup.image}" alt="${cup.name}">
        <div class="course-grid-name">${cup.name}</div>
        <div style="display: flex; gap: 4px; margin-top: 4px; align-items: center;">${starSlotsHtml}</div>
        ${bestBadge}
      `;
      card.addEventListener('click', () => {
        audio.init();
        document.querySelectorAll('.cup-opt').forEach(c => c.classList.remove('active'));
        document.querySelectorAll(`.cup-opt[data-cup="${cup.id}"]`).forEach(c => c.classList.add('active'));
        selectedGpCupId = cup.id;
        openGrandPrixPreview();
      });
      listEl.appendChild(card);
    }
    
    if (listElDt) {
      const cardDt = document.createElement('div');
      cardDt.className = `track-opt cup-opt ${isActive ? 'active' : ''}`;
      cardDt.setAttribute('data-cup', cup.id);
      cardDt.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: flex-start; gap: 4px; pointer-events: none;">
          <img src="${cup.image}" alt="${cup.name}" style="max-height: 42px; width: auto; object-fit: contain;">
          <div class="track-desc">${cup.tier}</div>
          ${bestBadge}
        </div>
        <div style="display: flex; gap: 4px; align-items: center; pointer-events: none;">${starSlotsHtml}</div>
      `;
      cardDt.addEventListener('click', () => {
        audio.init();
        selectedGpCupId = cup.id;
        document.querySelectorAll('.cup-opt').forEach(c => {
          c.classList.toggle('active', c.getAttribute('data-cup') === cup.id);
        });
      });
      listElDt.appendChild(cardDt);
    }
  });

  const btnShuffle = document.getElementById('btn-gp-shuffle') || document.getElementById('gp-cup-shuffle');
  if (btnShuffle) {
    btnShuffle.onclick = () => {
      audio.init();
      selectedGpCupId = 'shuffle';
      openGrandPrixPreview();
    };
  }
}

function openGrandPrixPreview() {
  audio.init();
  let cupData, races;

  if (selectedGpCupId === 'shuffle') {
    shuffleTracksCache = generateRandomShuffleTracks();
    cupData = {
      id: 'shuffle',
      name: 'Random Shuffle',
      tier: 'ARCADE / 4 RANDOM TRACKS'
    };
    races = shuffleTracksCache;
  } else {
    cupData = GRAND_PRIX_CUPS.find(c => c.id === selectedGpCupId) || GRAND_PRIX_CUPS[0];
    races = cupData.races;
  }

  grandPrixState.cupId = selectedGpCupId;
  grandPrixState.cupData = cupData;
  grandPrixState.races = races;
  grandPrixState.difficulty = selectedGpDifficulty;

  document.getElementById('gp-preview-title').innerText = cupData.name.toUpperCase();
  document.getElementById('gp-preview-subtitle').innerText = cupData.tier;

  const diffNameMap = { easy: 'EASY', medium: 'MEDIUM', hard: 'INSANE', impossible: 'IMPOSSIBLE' };
  document.getElementById('gp-preview-diff-label').innerText = diffNameMap[selectedGpDifficulty] || 'MEDIUM';

  const previewList = document.getElementById('gp-preview-tracks');
  previewList.innerHTML = '';
  races.forEach((r, idx) => {
    const item = document.createElement('div');
    item.className = 'track-opt';
    item.style.pointerEvents = 'none';
    item.style.cursor = 'default';
    item.innerHTML = `
      <div>
        <div class="track-name" style="color: var(--white);">RACE ${idx + 1}: ${r.courseId.toUpperCase()} ${r.subtrack}</div>
        <div class="track-desc">${r.name}</div>
      </div>
    `;
    previewList.appendChild(item);
  });

  showScreen('screen-gp-preview');
}

function startGrandPrixCup() {
  audio.init();
  grandPrixState.active = true;
  grandPrixState.currentRaceIndex = 0;

grandPrixState.racers = [
    { id: 'player', name: 'YOU', color: getPlayerGliderColor(), isPlayer: true, points: 0, finishes: [], times: [] },
    { id: 'ai0', name: 'VORTEX', color: '#e74c3c', isPlayer: false, points: 0, finishes: [], times: [] },
    { id: 'ai1', name: 'ZEPHYR', color: '#f39c12', isPlayer: false, points: 0, finishes: [], times: [] },
    { id: 'ai2', name: 'PHANTOM', color: '#9b59b6', isPlayer: false, points: 0, finishes: [], times: [] },
    { id: 'ai3', name: 'ECHO', color: '#2ecc71', isPlayer: false, points: 0, finishes: [], times: [] }
  ];

  const firstRace = grandPrixState.races[0];
  selectedCourseId = firstRace.courseId;
  selectedSubtrack = firstRace.subtrack;
  selectedDifficulty = grandPrixState.difficulty;
  gameMode = 'race';

  startCountdown();
}

function handleGrandPrixRaceFinish(playerPos, playerTime, isDnf) {
  const activeSubtrack = COURSES[selectedCourseId].subtracks[selectedSubtrack];
  const playerProgress = getTrackProgress(player.pos, player.nextGateIdx, 0);

  const sortedAi = aiGliders.map((ai, idx) => ({
    index: idx,
    progress: ai.progress,
    speed: Math.max(ai.currentSpeed, 40)
  })).sort((a, b) => b.progress - a.progress);

  const results = [];

  if (isDnf) {
    results.push({ racerIdx: 0, position: 5, time: 9999, isDnf: true, points: 0 });
    sortedAi.forEach((ai, rankIdx) => {
      const pos = rankIdx + 1;
      const estTime = Math.max(25, 95 - (4 - pos) * 6 + (Math.random() - 0.5) * 4);
      results.push({ racerIdx: ai.index + 1, position: pos, time: estTime, isDnf: false, points: GP_POINTS_TABLE[pos] || 0 });
    });
  } else {
    results.push({ racerIdx: 0, position: playerPos, time: playerTime, isDnf: false, points: GP_POINTS_TABLE[playerPos] || 0 });
    let aiRank = 1;
    sortedAi.forEach(ai => {
      if (aiRank === playerPos) aiRank++;
      const pos = aiRank++;
      let botTime;
      if (pos < playerPos) {
        botTime = Math.max(10, playerTime - Math.abs(ai.progress - playerProgress) / ai.speed);
      } else {
        botTime = playerTime + Math.abs(playerProgress - ai.progress) / ai.speed;
      }
      results.push({ racerIdx: ai.index + 1, position: pos, time: botTime, isDnf: false, points: GP_POINTS_TABLE[pos] || 0 });
    });
  }

  results.forEach(res => {
    const racer = grandPrixState.racers[res.racerIdx];
    racer.finishes.push(res.position);
    racer.times.push(res.time);
    racer.points += res.points;
  });

  const isLastRace = (grandPrixState.currentRaceIndex >= grandPrixState.races.length - 1);
  if (isLastRace) {
    showGrandPrixSummary();
  } else {
    showGrandPrixInterstitial(results.find(r => r.racerIdx === 0));
  }
}

function showGrandPrixInterstitial(playerResult) {
  const currentNum = grandPrixState.currentRaceIndex + 1;
  const totalNum = grandPrixState.races.length;

  document.getElementById('gp-inter-title').innerText = `RACE ${currentNum} OF ${totalNum} COMPLETE`;

  const posEl = document.getElementById('gp-inter-player-pos');
  const ptsEl = document.getElementById('gp-inter-player-pts');
  const timeEl = document.getElementById('gp-inter-player-time');
  const totalEl = document.getElementById('gp-inter-player-total');

  if (playerResult.isDnf) {
    posEl.innerText = 'CRASH / DNF';
    posEl.style.color = 'var(--red)';
    ptsEl.innerText = '+0 PTS';
    ptsEl.style.color = 'var(--red)';
    timeEl.innerText = 'STATUS: DID NOT FINISH';
  } else {
    const ord = ['ST', 'ND', 'RD', 'TH', 'TH'][playerResult.position - 1] || 'TH';
    posEl.innerText = `${playerResult.position}${ord} PLACE`;
    posEl.style.color = getPlayerGliderColor();
    ptsEl.innerText = `+${playerResult.points} PTS`;
    ptsEl.style.color = 'var(--gold)';
    timeEl.innerText = `TIME: ${formatTime(playerResult.time)}`;
  }

  totalEl.innerText = `TOTAL: ${grandPrixState.racers[0].points} PTS`;

  const tbody = document.getElementById('gp-inter-table-body');
  tbody.innerHTML = '';

  const standings = sortGrandPrixStandings(grandPrixState.racers);
  standings.forEach((r, idx) => {
    const tr = document.createElement('tr');
    if (r.isPlayer) tr.className = 'highlight-player';
    const lastFinish = r.finishes[r.finishes.length - 1];
    const lastPts = (lastFinish === 5 && r.times[r.times.length - 1] === 9999) ? 0 : (GP_POINTS_TABLE[lastFinish] || 0);

    tr.innerHTML = `
      <td style="text-align: center; font-weight: 700; ${r.isPlayer ? `color: ${r.color};` : ''}">${idx + 1}</td>
      <td style="color: ${r.color};">${r.name}</td>
      <td style="text-align: center;">+${lastPts}</td>
      <td style="text-align: center; font-weight: 700;">${r.points} PTS</td>
    `;
    tbody.appendChild(tr);
  });

  document.getElementById('btn-gp-inter-next').onclick = () => {
    audio.init();
    grandPrixState.currentRaceIndex++;
    const nextRace = grandPrixState.races[grandPrixState.currentRaceIndex];
    selectedCourseId = nextRace.courseId;
    selectedSubtrack = nextRace.subtrack;
    startCountdown();
  };

  showScreen('screen-gp-interstitial');
}

function showGrandPrixSummary() {
  const standings = sortGrandPrixStandings(grandPrixState.racers);
  const playerRank = standings.findIndex(r => r.isPlayer) + 1;
  const playerRacer = grandPrixState.racers[0];
  const isAce = playerRacer.finishes.every(f => f === 1);

  updateGrandPrixTrophyModel(playerRank);

  const titleEl = document.getElementById('gp-summary-title');
  const subtitleEl = document.getElementById('gp-summary-subtitle');

  if (playerRank === 1) {
    titleEl.innerText = `${grandPrixState.cupData.name.toUpperCase()} CHAMPION!`;
    titleEl.style.color = 'var(--gold)';
    subtitleEl.innerText = `1ST PLACE OVERALL • ${playerRacer.points} TOTAL POINTS`;
  } else if (playerRank === 2) {
    titleEl.innerText = '2ND PLACE OVERALL';
    titleEl.style.color = '#d0d7de';
    subtitleEl.innerText = `${grandPrixState.cupData.name.toUpperCase()} • SILVER TROPHY`;
  } else if (playerRank === 3) {
    titleEl.innerText = '3RD PLACE OVERALL';
    titleEl.style.color = '#cd7f32';
    subtitleEl.innerText = `${grandPrixState.cupData.name.toUpperCase()} • BRONZE TROPHY`;
  } else {
    titleEl.innerText = 'CHAMPIONSHIP FINISHED';
    titleEl.style.color = 'var(--mono-60)';
    subtitleEl.innerText = `FINAL POSITION: ${playerRank}TH • PARTICIPANT MEDALLION`;
  }

  const aceBanner = document.getElementById('gp-ace-banner');
  if (isAce) {
    aceBanner.style.display = 'block';
  } else {
    aceBanner.style.display = 'none';
  }

  const starsEl = document.getElementById('gp-summary-stars-earned');
  starsEl.innerText = '';
  let justUnlockedApex = false;

  if (grandPrixState.cupId !== 'shuffle') {
    const cid = grandPrixState.cupId;
    if (impossibleDifficultyUnlocked) {
      starsEl.innerHTML = '<span style="color: #ff4444; font-weight: 700;">DEV TOOLS ACTIVE </span>';
    } else {
      let earnedStars = 0;
      if (isAce) {
        if (grandPrixState.difficulty === 'hard' || grandPrixState.difficulty === 'impossible') earnedStars = 3;
        else if (grandPrixState.difficulty === 'medium') earnedStars = 2;
        else if (grandPrixState.difficulty === 'easy') earnedStars = 1;
      }

      const currentSavedStars = parseInt(localStorage.getItem(`gp_stars_${cid}`) || '0', 10);
      const newStarTotal = Math.max(currentSavedStars, earnedStars);
      localStorage.setItem(`gp_stars_${cid}`, newStarTotal);

      const prevBestPos = parseInt(localStorage.getItem(`gp_best_pos_${cid}`) || '99', 10);
      if (playerRank < prevBestPos) localStorage.setItem(`gp_best_pos_${cid}`, playerRank);

      const prevBestPts = parseInt(localStorage.getItem(`gp_best_pts_${cid}`) || '0', 10);
      if (playerRacer.points > prevBestPts) localStorage.setItem(`gp_best_pts_${cid}`, playerRacer.points);

      starsEl.innerHTML = `CUP PROGRESSION: <span style="color: var(--gold); text-shadow: 0 0 8px var(--gold);">${'★'.repeat(newStarTotal)}</span><span style="color: var(--mono-20);">${'☆'.repeat(3 - newStarTotal)}</span> (${newStarTotal}/3 STARS)`;
    }

    const allCups = ['sunrise', 'ember', 'gale', 'aether', 'odyssey', 'aphelion'];
    const hasAll18 = allCups.every(c => parseInt(localStorage.getItem(`gp_stars_${c}`) || '0', 10) >= 3);
    const hadApexAchieve = localStorage.getItem('glider_achieve_apex') === 'true';
    if (hasAll18 && !hadApexAchieve) {
      localStorage.setItem('glider_achieve_apex', 'true');
      justUnlockedApex = true;
    }
  } else {
    const prevBestPos = parseInt(localStorage.getItem('gp_best_pos_shuffle') || '99', 10);
    if (playerRank < prevBestPos) localStorage.setItem('gp_best_pos_shuffle', playerRank);
    const prevBestPts = parseInt(localStorage.getItem('gp_best_pts_shuffle') || '0', 10);
    if (playerRacer.points > prevBestPts) localStorage.setItem('gp_best_pts_shuffle', playerRacer.points);
  }

  const thead = document.getElementById('gp-summary-table-head');
  const tbody = document.getElementById('gp-summary-table-body');
  const rCount = grandPrixState.races.length;

  let headCols = '<th>POS</th><th style="text-align: left;">PILOT</th>';
  for (let r = 1; r <= rCount; r++) headCols += `<th>R${r}</th>`;
  headCols += '<th>TOTAL</th>';
  thead.innerHTML = `<tr>${headCols}</tr>`;

  tbody.innerHTML = '';
  standings.forEach((r, idx) => {
    const tr = document.createElement('tr');
    if (r.isPlayer) tr.className = 'highlight-player';
    let rowHtml = `<td style="text-align: center; font-weight: 700;">${idx + 1}</td><td style="color: ${r.color};">${r.name}</td>`;
    r.finishes.forEach((fin, fIdx) => {
      const isCrash = (fin === 5 && r.times[fIdx] === 9999);
      const pts = isCrash ? 0 : (GP_POINTS_TABLE[fin] || 0);
      rowHtml += `<td style="text-align: center;">${pts}</td>`;
    });
    rowHtml += `<td style="text-align: center; font-weight: 800; color: var(--gold);">${r.points}</td>`;
    tr.innerHTML = rowHtml;
    tbody.appendChild(tr);
  });

  document.getElementById('btn-gp-retry').onclick = () => {
    audio.init();
    openGrandPrixPreview();
  };

  document.getElementById('btn-gp-next-cup').onclick = () => {
    audio.init();
    const curIdx = GRAND_PRIX_CUPS.findIndex(c => c.id === grandPrixState.cupId);
    if (curIdx >= 0) {
      const nextCup = GRAND_PRIX_CUPS[(curIdx + 1) % GRAND_PRIX_CUPS.length];
      selectedGpCupId = nextCup.id;
    } else {
      selectedGpCupId = 'sunrise';
    }
    openGrandPrixPreview();
  };

  document.getElementById('btn-gp-select').onclick = () => {
    audio.init();
    grandPrixState.active = false;
    renderGrandPrixCupList();
    showScreen('screen-select');
  };

  if (justUnlockedApex) {
    startCredits({
      unlockType: 'aphelion_apex',
      onFinish: () => {
        gameState = 'START';
        showScreen('screen-gp-summary');
        showAchievementNotifications([{ name: 'Aphelion Apex Glider' }]);
      }
    });
  } else {
    showScreen('screen-gp-summary');
  }
}

function finishRace() {
  gameState = 'FINISHED';
  audio.stopAllAudio();

  const warnEl = document.getElementById('volcano-event-warning');
  if (warnEl) warnEl.style.display = 'none';

  if (isHalloweenBossDuel) {
    const wonDuel = (player.rank === 1);
    isHalloweenBossDuel = false;
    if (wonDuel) {
      localStorage.setItem('glider_unlocked_halloween', 'true');
      showAchievementNotifications([{ name: "Jack-o'-Lantern Glider Unlocked!" }]);
    } else {
      localStorage.setItem('glider_equipped_skin', halloweenPreviousSkin || 'default');
      halloweenPreviousSkin = null;
      buildParagliderMesh();
      applySkySetting();
    }
    updateHalloweenThemeVisibility();
  }

if (isKrampusBossDuel) {
  const wonDuel = (player.rank === 1);
  isKrampusBossDuel = false;
  krampusRetryPending = !wonDuel; 
  if (wonDuel) {
    localStorage.setItem('glider_unlocked_santa', 'true');
    localStorage.setItem('glider_unlocked_krampus_ghost', 'true');
    showAchievementNotifications([
      { name: "Santa Glider Unlocked!" },
      { name: "Krampus Drone Unlocked!" }
    ]);
  }
  }

  if (grandPrixState.active) {
    handleGrandPrixRaceFinish(player.rank, raceElapsedTime, false);
    return;
  }

  const timeStr = formatTime(raceElapsedTime);
  const activeSubtrack = COURSES[selectedCourseId].subtracks[selectedSubtrack];
  const trackMedals = activeSubtrack.medals;

  const prevStats = getTrackStats();
  const prevUnlockedGliders = {};
  GLIDER_SKINS.forEach(s => { prevUnlockedGliders[s.id] = s.checkUnlocked(prevStats); });
  const prevUnlockedGhosts = {};
  GHOST_SKINS.forEach(s => { prevUnlockedGhosts[s.id] = s.checkUnlocked(prevStats); });

  let medalEarned = 'NO MEDAL';
  if (raceElapsedTime <= trackMedals.ace) medalEarned = '🏆 ACE MEDAL';
  else if (raceElapsedTime <= trackMedals.gold) medalEarned = '🥇 GOLD MEDAL';
  else if (raceElapsedTime <= trackMedals.silver) medalEarned = '🥈 SILVER MEDAL';
  else if (raceElapsedTime <= trackMedals.bronze) medalEarned = '🥉 BRONZE MEDAL';

  const pbKey = `pb_${selectedCourseId}_${selectedSubtrack}`;
  const currentPB = parseFloat(localStorage.getItem(pbKey)) || 9999;
  const isNewPB = raceElapsedTime < currentPB;

  if (!impossibleDifficultyUnlocked) {
    if (gameMode === 'timetrial' && isNewPB) {
      try {
        localStorage.setItem(pbKey, raceElapsedTime.toFixed(2));
      } catch (e) {}
      updatePBTags();
    }

    if (gameMode === 'timetrial' && currentGhostRun.length > 10) {
      const ghostKey = `ghost_${selectedCourseId}_${selectedSubtrack}`;
      const hasGhost = ghostCache[ghostKey] || localStorage.getItem(ghostKey);
      if (isNewPB || !hasGhost) {
        try {
          localStorage.setItem(ghostKey, JSON.stringify(currentGhostRun));
        } catch (e) {}
        ghostCache[ghostKey] = currentGhostRun.slice();
        savedGhostData = ghostCache[ghostKey];
      }
    }

    const postStats = getTrackStats();
    const newlyUnlocked = [];
    GLIDER_SKINS.forEach(s => {
      if (s.checkUnlocked(postStats) && !prevUnlockedGliders[s.id]) {
        newlyUnlocked.push(s);
      }
    });
    GHOST_SKINS.forEach(s => {
      if (s.checkUnlocked(postStats) && !prevUnlockedGhosts[s.id]) {
        newlyUnlocked.push(s);
      }
    });

    if (newlyUnlocked.length > 0) {
      showAchievementNotifications(newlyUnlocked);
    }

    const didUnlockGreatestGlider = newlyUnlocked.some(s => s.id === 'all_ace') ||
      (postStats.totalAceOrBetter >= 20 && postStats.hasGhost && localStorage.getItem('glider_credits_seen') !== 'true');

    if (didUnlockGreatestGlider) {
      setTimeout(() => {
        startCredits({ unlockType: 'greatest_glider' });
      }, 1200);
      return;
    }

    if (newlyUnlocked.some(s => s.id === 'aphelion_apex')) {
      localStorage.setItem('glider_achieve_apex', 'true');
      setTimeout(() => {
        startCredits({
          unlockType: 'aphelion_apex',
          onFinish: () => {
            gameState = 'START';
            showScreen('screen-win');
            showAchievementNotifications([{ name: 'Aphelion Apex Glider' }]);
          }
        });
      }, 1200);
      return;
    }
  }

  const winTitleEl = document.getElementById('win-title');
  const winStatsEl = document.getElementById('win-stats');
  const winMedalEl = document.getElementById('win-medal');

  if (impossibleDifficultyUnlocked) {
    winTitleEl.innerText = gameMode === 'timetrial' ? 'Cheating Is ILLEGAL' : `POSITION ${player.rank} / 5`;
    winStatsEl.innerText = `FINAL TIME: ${timeStr}`;
    winMedalEl.innerText = 'Dev Tools = Invalid Run';
    winMedalEl.style.color = '#ff4444';
  } else {
    winTitleEl.innerText = gameMode === 'timetrial' ? 'TIME TRIAL COMPLETED' : `POSITION ${player.rank} / 5`;
    winStatsEl.innerText = `FINAL TIME: ${timeStr}`;
    winMedalEl.innerText = medalEarned;
    winMedalEl.style.color = 'var(--gold)';
  }

  showScreen('screen-win');
}

function endRace(reason) {
  gameState = 'FINISHED';
  audio.stopAllAudio();

  const warnEl = document.getElementById('volcano-event-warning');
  if (warnEl) warnEl.style.display = 'none';

  if (isHalloweenBossDuel) {
  isHalloweenBossDuel = false;
  localStorage.setItem('glider_equipped_skin', halloweenPreviousSkin || 'default');
  halloweenPreviousSkin = null;
  buildParagliderMesh();
  applySkySetting();
  updateHalloweenThemeVisibility();
}

  if (isKrampusBossDuel) {
    isKrampusBossDuel = false;
    krampusRetryPending = true; 
  }

  if (grandPrixState.active) {
    handleGrandPrixRaceFinish(5, 9999, true);
    return;
  }

  document.getElementById('lose-stats').innerText = reason === 'lose-crash' ? 'TERRAIN IMPACT DETECTED' : 'DRIFTED OUT OF COURSE BOUNDS';
  showScreen('screen-lose');
}

let flappyCanvas = null;
let flappyCtx = null;
let flappyAnimId = null;
let flappyState = 'READY';
let flappyScore = 0;
let flappyGlider = { x: 80, y: 300, vy: 0, rot: 0 };
let flappyPipes = [];
let flappySpawnTimer = 0;
let flappyPipesSpawned = 0;
let flappyPresentsDelivered = 0;
let flappyDropStage = 'NONE';
let flappyDropTimer = 0;
let flappyChimneyY = 720;
let flappyPresent = { x: 228, y: 280, vy: 0, visible: false };

const flappyAssets = {
  bg: new Image(),
  glider: new Image(),
  chimneyClosed: new Image(),
  brick: new Image(),
  chimneyTop: new Image(),
  present: new Image()
};
flappyAssets.bg.src = 'gliderbirdbackground.png';
flappyAssets.glider.src = 'FlappyGlider.png';
flappyAssets.chimneyClosed.src = 'chimneytopclosed.png';
flappyAssets.brick.src = 'brickwallforflappyglider.png';
flappyAssets.chimneyTop.src = 'chimneytop.png';
flappyAssets.present.src = 'present.png';

function startKrampusBossRace(skipCinematic = false) {
  audio.init();
  isKrampusBossDuel = true;
  grandPrixState.active = false;
  selectedCourseId = 'glacial';
  selectedSubtrack = 'B';
  selectedDifficulty = 'hard';
  gameMode = 'race';
  showScreen(null);
  stopMenuTheme(true);

  if (skipCinematic) {
    startCountdown();
  } else {
    buildCourse(selectedCourseId);
    startKrampusCinematic();
  }
}

function handleRetryClick() {
  if (krampusRetryPending) {
    krampusRetryPending = false;
    startKrampusBossRace(true);
    return;
  }
  if (grandPrixState.active) {
    startGrandPrixCup(); 
    return;
  }
  startCountdown();
}

function closeFlappyMinigame() {
  if (flappyAnimId) {
    cancelAnimationFrame(flappyAnimId);
    flappyAnimId = null;
  }
  const overlay = document.getElementById('flappy-minigame-overlay');
  if (overlay) overlay.style.display = 'none';
}

function openFlappyMinigame() {
  const overlay = document.getElementById('flappy-minigame-overlay');
  if (!overlay) return;
  overlay.style.display = 'flex';

  flappyCanvas = document.getElementById('flappy-canvas');
  flappyCtx = flappyCanvas.getContext('2d');
  flappyCtx.imageSmoothingEnabled = false;

  resetFlappyGame();

  const closeBtn = document.getElementById('btn-flappy-close');
  if (closeBtn) {
    closeBtn.onclick = (e) => {
      e.stopPropagation();
      closeFlappyMinigame();
    };
  }


  if (!flappyAnimId) {
    let lastT = performance.now();
    function loop(now) {
      const dt = Math.min((now - lastT) / 1000, 0.05);
      lastT = now;
      updateFlappyGame(dt);
      drawFlappyGame();
      if (document.getElementById('flappy-minigame-overlay').style.display !== 'none') {
        flappyAnimId = requestAnimationFrame(loop);
      } else {
        flappyAnimId = null;
      }
    }
    flappyAnimId = requestAnimationFrame(loop);
  }
}

function resetFlappyGame() {
  flappyState = 'READY';
  flappyScore = 0;
  flappyGlider = { x: 80, y: 300, vy: 0, rot: 0 };
  flappyPipes = [];
  flappySpawnTimer = 0;
  flappyPipesSpawned = 0;
  flappyPresentsDelivered = 0;
  flappyDropStage = 'NONE';
  flappyDropTimer = 0;
  flappyChimneyY = 720;
  flappyPresent = { x: 228, y: 280, vy: 0, visible: false };
}

function flappyTriggerFlap() {
  if (flappyState === 'READY') {
    flappyState = 'PLAYING';
    flappyGlider.vy = -310;
    audio.playBeep(520, 'sine', 0.08);
  } else if (flappyState === 'PLAYING') {
    flappyGlider.vy = -310;
    audio.playBeep(520, 'sine', 0.08);
  } else if (flappyState === 'GAME_OVER') {
    resetFlappyGame();
  }
}

function updateFlappyGame(dt) {
  if (flappyState === 'PLAYING') {
    flappyGlider.vy += 920 * dt;
    flappyGlider.y += flappyGlider.vy * dt;
    flappyGlider.rot = Math.max(-0.55, Math.min(1.2, flappyGlider.vy * 0.003));

    if (flappyGlider.y < 0) {
      flappyGlider.y = 0;
      flappyGlider.vy = 0;
    }
    if (flappyGlider.y + 30 > 690) {
      flappyState = 'GAME_OVER';
      audio.playCrash();
      return;
    }

    const currentWaveTarget = (flappyPresentsDelivered + 1) * 10;
    if (flappyPipesSpawned < currentWaveTarget) {
      flappySpawnTimer += dt;
      if (flappySpawnTimer >= 1.65) {
        flappySpawnTimer = 0;
        const topH = 80 + Math.random() * 260;
        const gap = 200;
        flappyPipes.push({
          x: 480,
          topH: topH,
          bottomY: topH + gap,
          passed: false
        });
        flappyPipesSpawned++;
      }
    }

    const gx = flappyGlider.x + 4;
    const gy = flappyGlider.y + 4;
    const gw = 24;
    const gh = 24;

    for (let i = flappyPipes.length - 1; i >= 0; i--) {
      const p = flappyPipes[i];
      p.x -= 140 * dt;

      if (!p.passed && p.x + 48 < flappyGlider.x) {
        p.passed = true;
        flappyScore++;
        audio.playGateWhoosh();
      }

      const rx = p.x + 2;
      const rw = 44;
      const topRect = { x: rx, y: 0, w: rw, h: p.topH };
      const botRect = { x: rx, y: p.bottomY, w: rw, h: 720 - p.bottomY };

      const hitTop = (gx + gw > topRect.x && gx < topRect.x + topRect.w && gy + gh > topRect.y && gy < topRect.y + topRect.h);
      const hitBot = (gx + gw > botRect.x && gx < botRect.x + botRect.w && gy + gh > botRect.y && gy < botRect.y + botRect.h);

      if (hitTop || hitBot) {
        flappyState = 'GAME_OVER';
        audio.playCrash();
        return;
      }

      if (p.x + 48 < -20) {
        flappyPipes.splice(i, 1);
      }
    }

    if (flappyPipesSpawned >= currentWaveTarget && flappyPipes.length === 0) {
      flappyState = 'DROP';
      flappyDropStage = 'RISING';
      flappyDropTimer = 0;
      flappyChimneyY = 720;
      flappyPresent.visible = false;
    }
  } else if (flappyState === 'DROP') {
    flappyDropTimer += dt;
    flappyGlider.x = THREE.MathUtils.lerp(flappyGlider.x, 224, 3.0 * dt);
    flappyGlider.y = THREE.MathUtils.lerp(flappyGlider.y, 240, 3.0 * dt);
    flappyGlider.vy = 0;
    flappyGlider.rot = THREE.MathUtils.lerp(flappyGlider.rot, 0, 4.0 * dt);

    if (flappyDropStage === 'RISING') {
      flappyChimneyY = THREE.MathUtils.lerp(flappyChimneyY, 480, 4.0 * dt);
      if (Math.abs(flappyChimneyY - 480) < 3.0 && Math.abs(flappyGlider.x - 224) < 6.0) {
        flappyChimneyY = 480;
        flappyDropStage = 'DROPPING';
        flappyPresent.x = 228;
        flappyPresent.y = 264;
        flappyPresent.vy = 40;
        flappyPresent.visible = true;
      }
    } else if (flappyDropStage === 'DROPPING') {
      flappyPresent.vy += 700 * dt;
      flappyPresent.y += flappyPresent.vy * dt;

      if (flappyPresent.y >= 505) {
        flappyPresent.visible = false;
        flappyPresentsDelivered++;
        flappyDropStage = 'CELEBRATE';
        flappyDropTimer = 0;
        audio.playRecoveryBoost();
      }
    } else if (flappyDropStage === 'CELEBRATE') {
      if (flappyDropTimer >= 1.5) {
        if (flappyPresentsDelivered >= 3) {
          flappyState = 'WON';
          flappyDropTimer = 0;
          audio.playFinishFanfare();
          localStorage.setItem('glider_xmas_minigame_won', 'true');
        } else {
          flappyDropStage = 'LOWERING';
        }
      }
    } else if (flappyDropStage === 'LOWERING') {
      flappyChimneyY = THREE.MathUtils.lerp(flappyChimneyY, 720, 4.5 * dt);
      if (flappyChimneyY >= 715) {
        flappyChimneyY = 720;
        flappyState = 'PLAYING';
        flappySpawnTimer = 0;
      }
    }
  } else if (flappyState === 'WON') {
    flappyDropTimer += dt;
    if (flappyDropTimer >= 2.2) {
      closeFlappyMinigame();
      startKrampusBossRace();
    }
  }
}

function drawFlappyGame() {
  if (!flappyCtx) return;

  if (flappyAssets.bg.complete) {
    flappyCtx.drawImage(flappyAssets.bg, 0, 0, 480, 720);
  } else {
    flappyCtx.fillStyle = '#6ba4d8';
    flappyCtx.fillRect(0, 0, 480, 720);
  }

  for (let i = 0; i < flappyPipes.length; i++) {
    const p = flappyPipes[i];

    if (flappyAssets.chimneyClosed.complete) {
      flappyCtx.save();
      flappyCtx.translate(p.x, p.topH);
      flappyCtx.scale(1, -1);
      flappyCtx.drawImage(flappyAssets.chimneyClosed, 0, 0, 48, 48);
      flappyCtx.restore();
    }
    if (flappyAssets.brick.complete) {
      for (let by = 0; by < p.topH - 48; by += 32) {
        const bh = Math.min(32, (p.topH - 48) - by);
        flappyCtx.drawImage(flappyAssets.brick, 0, 0, 48, bh, p.x, by, 48, bh);
      }
    }

    if (flappyAssets.chimneyClosed.complete) {
      flappyCtx.drawImage(flappyAssets.chimneyClosed, p.x, p.bottomY, 48, 48);
    }
    if (flappyAssets.brick.complete) {
      for (let by = p.bottomY + 48; by < 720; by += 32) {
        const bh = Math.min(32, 720 - by);
        flappyCtx.drawImage(flappyAssets.brick, 0, 0, 48, bh, p.x, by, 48, bh);
      }
    }
  }

  if (flappyChimneyY < 720) {
    if (flappyAssets.chimneyTop.complete) {
      flappyCtx.drawImage(flappyAssets.chimneyTop, 192, flappyChimneyY, 96, 128);
    }
    if (flappyAssets.brick.complete) {
      for (let by = flappyChimneyY + 128; by < 720; by += 32) {
        const bh = Math.min(32, 720 - by);
        flappyCtx.drawImage(flappyAssets.brick, 0, 0, 48, bh, 192, by, 48, bh);
        flappyCtx.drawImage(flappyAssets.brick, 0, 0, 48, bh, 240, by, 48, bh);
      }
    }
  }

  if (flappyPresent.visible && flappyAssets.present.complete) {
    flappyCtx.drawImage(flappyAssets.present, flappyPresent.x, flappyPresent.y, 24, 24);
  }

  flappyCtx.save();
  flappyCtx.translate(flappyGlider.x + 16, flappyGlider.y + 16);
  flappyCtx.rotate(flappyGlider.rot);
  if (flappyAssets.glider.complete) {
    flappyCtx.drawImage(flappyAssets.glider, -16, -16, 32, 32);
  } else {
    flappyCtx.fillStyle = '#ff2222';
    flappyCtx.fillRect(-16, -16, 32, 32);
  }
  flappyCtx.restore();

  flappyCtx.fillStyle = 'rgba(0, 0, 0, 0.45)';
  flappyCtx.fillRect(16, 14, 220, 68);
  flappyCtx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
  flappyCtx.lineWidth = 1.5;
  flappyCtx.strokeRect(16, 14, 220, 68);

  flappyCtx.fillStyle = '#ffffff';
  flappyCtx.font = '900 18px "Courier New", Courier, monospace';
  flappyCtx.textAlign = 'left';
  flappyCtx.fillText('PIPES: ' + flappyScore + ' / 30', 28, 42);
  flappyCtx.fillStyle = '#f1c40f';
  flappyCtx.fillText('GIFTS: ' + flappyPresentsDelivered + ' / 3', 28, 68);

  if (flappyState === 'READY') {
    flappyCtx.fillStyle = 'rgba(0, 0, 0, 0.65)';
    flappyCtx.fillRect(40, 260, 400, 160);
    flappyCtx.strokeStyle = '#00f0ff';
    flappyCtx.strokeRect(40, 260, 400, 160);

    flappyCtx.fillStyle = '#ffffff';
    flappyCtx.font = '900 24px "Courier New", Courier, monospace';
    flappyCtx.textAlign = 'center';
    flappyCtx.fillText('GIFT DROP', 240, 315);
    flappyCtx.fillStyle = '#00f0ff';
    flappyCtx.font = '700 14px "Courier New", Courier, monospace';
    flappyCtx.fillText('PRESS SPACE OR TAP TO GLIDE', 240, 360);
    flappyCtx.fillStyle = '#f1c40f';
    flappyCtx.font = '700 12px "Courier New", Courier, monospace';
    flappyCtx.fillText('SURVIVE 30 CHIMNEYS & DELIVER 3 GIFTS', 240, 390);
  } else if (flappyState === 'GAME_OVER') {
    flappyCtx.fillStyle = 'rgba(0, 0, 0, 0.75)';
    flappyCtx.fillRect(40, 260, 400, 150);
    flappyCtx.strokeStyle = '#ff3333';
    flappyCtx.strokeRect(40, 260, 400, 150);

    flappyCtx.fillStyle = '#ff3333';
    flappyCtx.font = '900 26px "Courier New", Courier, monospace';
    flappyCtx.textAlign = 'center';
    flappyCtx.fillText('CRASHED!', 240, 320);
    flappyCtx.fillStyle = '#ffffff';
    flappyCtx.font = '700 14px "Courier New", Courier, monospace';
    flappyCtx.fillText('PRESS SPACE OR TAP TO RETRY', 240, 370);
  } else if (flappyState === 'DROP' && flappyDropStage === 'CELEBRATE') {
    flappyCtx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    flappyCtx.fillRect(40, 120, 400, 70);
    flappyCtx.strokeStyle = '#2ecc71';
    flappyCtx.strokeRect(40, 120, 400, 70);

    flappyCtx.fillStyle = '#2ecc71';
    flappyCtx.font = '900 20px "Courier New", Courier, monospace';
    flappyCtx.textAlign = 'center';
    flappyCtx.fillText('PRESENT ' + flappyPresentsDelivered + ' / 3 DELIVERED!', 240, 162);
  } else if (flappyState === 'WON') {
    flappyCtx.fillStyle = 'rgba(0, 0, 0, 0.85)';
    flappyCtx.fillRect(30, 230, 420, 190);
    flappyCtx.strokeStyle = '#f1c40f';
    flappyCtx.strokeRect(30, 230, 420, 190);

    flappyCtx.fillStyle = '#f1c40f';
    flappyCtx.font = '900 24px "Courier New", Courier, monospace';
    flappyCtx.textAlign = 'center';
    flappyCtx.fillText('ALL PRESENTS DELIVERED!', 240, 290);
    flappyCtx.fillStyle = '#ffffff';
    flappyCtx.font = '700 15px "Courier New", Courier, monospace';
    flappyCtx.fillText('PREPARE FOR BATTLE...', 240, 340);
    flappyCtx.fillStyle = '#ff4444';
    flappyCtx.font = '900 16px "Courier New", Courier, monospace';
    flappyCtx.fillText('KRAMPUS AWAITS ON RAZOR PASS', 240, 380);
  }
}

function setupUI() {
  const btnCredits = document.getElementById('btn-settings-credits');
  if (btnCredits) {
    btnCredits.addEventListener('click', () => {
      audio.init();
      const sOverlay = document.getElementById('settings-overlay');
      if (sOverlay) sOverlay.style.display = 'none';
      startCredits();
    });
  }

  function handleResetSavedScores() {
    audio.init();
    if (!confirm('Are you sure you want to reset all saved course times and ghost records?')) return;
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && (k.startsWith('pb_') || k.startsWith('ghost_'))) {
        keysToRemove.push(k);
      }
    }
    keysToRemove.forEach(k => {
      localStorage.removeItem(k);
      delete ghostCache[k];
    });
    savedGhostData = null;
    updatePBTags();
    updateMedalDisplay();
    audio.playCrash();
    refreshCourseCards();
    showAchievementNotifications([{ name: 'Saved Times Reset' }]);
  }
  const btnResetMobile = document.getElementById('btn-reset-scores');
  if (btnResetMobile) btnResetMobile.addEventListener('click', handleResetSavedScores);
  const btnResetDt = document.getElementById('btn-reset-scores-dt');
  if (btnResetDt) btnResetDt.addEventListener('click', handleResetSavedScores);

  function openSaveModal(mode) {
    audio.init();
    const overlay = document.getElementById('save-transfer-overlay');
    const title = document.getElementById('save-modal-title');
    const sub = document.getElementById('save-modal-subtitle');
    const textarea = document.getElementById('save-key-textarea');
    const status = document.getElementById('save-modal-status');
    const actionBtn = document.getElementById('btn-save-modal-action');
    if (!overlay || !textarea || !actionBtn) return;

    overlay.style.display = 'flex';
    if (mode === 'export') {
      title.innerText = 'EXPORT SAVE CODE';
      sub.innerText = 'COPY THIS CODE TO TRANSFER YOUR PROGRESS';
      const pbs = {};
      const ghosts = {};
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith('pb_')) {
          pbs[k.substring(3)] = parseFloat(localStorage.getItem(k));
        } else if (k && k.startsWith('ghost_')) {
          try {
            ghosts[k.substring(6)] = JSON.parse(localStorage.getItem(k));
          } catch (e) {}
        }
      }
      for (const k in ghostCache) {
        if (k.startsWith('ghost_') && !ghosts[k.substring(6)]) {
          ghosts[k.substring(6)] = ghostCache[k];
        }
      }
      const hw = !!localStorage.getItem('glider_unlocked_halloween');
      const sn = !!localStorage.getItem('glider_unlocked_santa');
      const kr = !!localStorage.getItem('glider_unlocked_krampus_ghost');
      const xm = hasAllChristmasPresents() ? 1 : 0;
      try {
        const code = AphelionEncoder.encode({ pbs, ghosts, halloweenUnlocked: hw, santaUnlocked: sn, krampusUnlocked: kr, xm });
        textarea.value = code;
        status.innerText = 'SAVE CODE GENERATED';
        status.style.color = 'var(--cyan)';
        actionBtn.innerText = 'COPY TO CLIPBOARD';
        actionBtn.onclick = () => {
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(code).then(() => {
              status.innerText = 'COPIED TO CLIPBOARD!';
              status.style.color = 'var(--gold)';
              audio.playRecoveryBoost();
            }).catch(() => {
              textarea.select();
              document.execCommand('copy');
              status.innerText = 'COPIED TO CLIPBOARD!';
              status.style.color = 'var(--gold)';
            });
          } else {
            textarea.select();
            document.execCommand('copy');
            status.innerText = 'COPIED TO CLIPBOARD!';
            status.style.color = 'var(--gold)';
          }
        };
      } catch (err) {
        textarea.value = '';
        status.innerText = 'ERROR ENCODING SAVE DATA';
        status.style.color = 'var(--red)';
      }
    } else {
      title.innerText = 'IMPORT SAVE CODE';
      sub.innerText = 'PASTE AN ENCRYPTED SAVE CODE BELOW';
      textarea.value = '';
      status.innerText = 'PASTE YOUR CODE AND CLICK RESTORE';
      status.style.color = 'var(--mono-60)';
      actionBtn.innerText = 'RESTORE SAVE';
      actionBtn.onclick = () => {
        const raw = textarea.value.trim();
        if (!raw) {
          status.innerText = 'PLEASE PASTE A SAVE CODE';
          status.style.color = 'var(--red)';
          return;
        }
        try {
          const data = AphelionEncoder.decode(raw);
          if (!data || typeof data !== 'object') throw new Error('Invalid');
          if (data.pbs) {
            for (const trk in data.pbs) {
              localStorage.setItem('pb_' + trk, data.pbs[trk]);
            }
          }
          if (data.ghosts) {
            for (const trk in data.ghosts) {
              localStorage.setItem('ghost_' + trk, JSON.stringify(data.ghosts[trk]));
              ghostCache['ghost_' + trk] = data.ghosts[trk];
            }
          }
          if (data.halloweenUnlocked) {
            localStorage.setItem('glider_unlocked_halloween', 'true');
          }
          if (data.santaUnlocked) {
            localStorage.setItem('glider_unlocked_santa', 'true');
          }
          if (data.krampusUnlocked) {
            localStorage.setItem('glider_unlocked_krampus_ghost', 'true');
          }
          if (data.xm) {
            ['A', 'B', 'C'].forEach(s => localStorage.setItem(`glider_xmas_present_${s}`, 'true'));
          }
          updatePBTags();
          updateMedalDisplay();
          status.innerText = 'SAVE RESTORED SUCCESSFULLY!';
          status.style.color = 'var(--gold)';
          audio.playFinishFanfare();
          setTimeout(() => { overlay.style.display = 'none'; }, 1200);
        } catch (err) {
          status.innerText = 'INVALID OR CORRUPTED CODE';
          status.style.color = 'var(--red)';
          audio.playCrash();
        }
      };
    }
  }

  ['btn-save-export', 'btn-save-export-dt'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('click', () => openSaveModal('export'));
  });
  ['btn-save-import', 'btn-save-import-dt'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('click', () => openSaveModal('import'));
  });
  const btnSaveClose = document.getElementById('btn-save-modal-close');
  if (btnSaveClose) {
    btnSaveClose.addEventListener('click', () => {
      document.getElementById('save-transfer-overlay').style.display = 'none';
    });
  }

  document.getElementById('btn-to-select').addEventListener('click', () => {
    audio.init();
    if (mobileJoystickMode === 'gyro') {
      requestGyroPermission();
    }
    showScreen('screen-select');
  });

  document.getElementById('btn-open-shop-dt').addEventListener('click', () => {
    audio.init();
    openShopMenu();
    updateCellarDoorVisibility();
  });

  document.getElementById('btn-start-race-dt').addEventListener('click', () => {
    audio.init();
    if (btnTabGpDt && btnTabGpDt.classList.contains('active')) {
      openGrandPrixPreview();
      return;
    }
    grandPrixState.active = false;
    refreshDispatchModal();
    showScreen('screen-dispatch');
  });

  document.querySelectorAll('#screen-select .track-opt').forEach(opt => {
    opt.addEventListener('click', () => {
      document.querySelectorAll('#screen-select .track-opt').forEach(o => o.classList.remove('active'));
      opt.classList.add('active');
      selectedCourseId = opt.getAttribute('data-course');
      try { localStorage.setItem('glider_last_course', selectedCourseId); } catch (e) {}
      buildCourse(selectedCourseId);
    });
  });

  const btnTabSingleDt = document.getElementById('btn-tab-single-dt');
  const btnTabGpDt = document.getElementById('btn-tab-gp-dt');
  const singleListDt = document.getElementById('single-track-list-dt');
  const gpContainerDt = document.getElementById('gp-select-container-dt');

  if (btnTabSingleDt && btnTabGpDt) {
    btnTabSingleDt.addEventListener('click', () => {
      btnTabSingleDt.classList.add('active');
      btnTabGpDt.classList.remove('active');
      singleListDt.style.display = 'flex';
      gpContainerDt.style.display = 'none';
    });
    btnTabGpDt.addEventListener('click', () => {
      btnTabSingleDt.classList.remove('active');
      btnTabGpDt.classList.add('active');
      singleListDt.style.display = 'none';
      gpContainerDt.style.display = 'flex';
      renderGrandPrixCupList();
    });
  }

  const btnOpenKeybinds = document.getElementById('btn-open-keybinds');
  const keybindModal = document.getElementById('keybind-modal-overlay');
  const btnKeybindReset = document.getElementById('btn-keybind-reset');
  const btnKeybindClose = document.getElementById('btn-keybind-close');

  if (btnOpenKeybinds) {
    btnOpenKeybinds.addEventListener('click', () => {
      audio.init();
      if (isMobileDevice()) {
        const sOverlay = document.getElementById('settings-overlay');
        if (sOverlay) sOverlay.style.display = 'none';
        openMobileRepositionEditor();
        return;
      }
      activeRebindAction = null;
      activeRebindIndex = -1;
      renderKeybindList();
      if (keybindModal) keybindModal.style.display = 'flex';
    });
  }

  if (btnKeybindReset) {
    btnKeybindReset.addEventListener('click', () => {
      audio.init();
      keybinds = JSON.parse(JSON.stringify(defaultKeybinds));
      try {
        localStorage.setItem('glider_keybinds', JSON.stringify(keybinds));
      } catch (err) {}
      audio.playRecoveryBoost();
      renderKeybindList();
    });
  }

  if (btnKeybindClose) {
    btnKeybindClose.addEventListener('click', () => {
      audio.init();
      activeRebindAction = null;
      activeRebindIndex = -1;
      if (keybindModal) keybindModal.style.display = 'none';
    });
  }

  const btnTabSingle = document.getElementById('btn-tab-single');
  const btnTabGp = document.getElementById('btn-tab-gp');
  const singleList = document.getElementById('single-track-list');
  const gpContainer = document.getElementById('gp-select-container');

  function setSelectTab(tab) {
    audio.init();
    selectedSelectTab = tab;
    if (tab === 'single') {
      if (btnTabSingle) btnTabSingle.classList.add('active');
      if (btnTabGp) btnTabGp.classList.remove('active');
      if (singleList) {
        singleList.classList.remove('hidden');
        singleList.style.display = 'grid';
      }
      if (gpContainer) {
        gpContainer.classList.add('hidden');
        gpContainer.style.display = 'none';
      }
    } else {
      if (btnTabSingle) btnTabSingle.classList.remove('active');
      if (btnTabGp) btnTabGp.classList.add('active');
      if (singleList) {
        singleList.classList.add('hidden');
        singleList.style.display = 'none';
      }
      if (gpContainer) {
        gpContainer.classList.remove('hidden');
        gpContainer.style.display = 'flex';
      }
      renderGrandPrixCupList();
    }
  }

  if (btnTabSingle && btnTabGp) {
    btnTabSingle.addEventListener('click', () => setSelectTab('single'));
    btnTabGp.addEventListener('click', () => setSelectTab('gp'));
  }

  const btnStartPlay = document.getElementById('btn-start-play');
  if (btnStartPlay) {
    btnStartPlay.addEventListener('click', () => {
      audio.init();
      if (mobileJoystickMode === 'gyro') {
        requestGyroPermission();
      }
      setSelectTab('single');
      showScreen('screen-select');
    });
  }

  const btnStartSingle = document.getElementById('btn-start-single');
  if (btnStartSingle) {
    btnStartSingle.addEventListener('click', () => {
      audio.init();
      setSelectTab('single');
      showScreen('screen-select');
    });
  }

  const btnStartGp = document.getElementById('btn-start-gp');
  if (btnStartGp) {
    btnStartGp.addEventListener('click', () => {
      audio.init();
      setSelectTab('gp');
      showScreen('screen-select');
    });
  }

  document.getElementById('btn-start-shop').addEventListener('click', () => {
    audio.init();
    openShopMenu();
    updateCellarDoorVisibility();
  });

  document.getElementById('btn-select-back').addEventListener('click', () => {
    audio.init();
    showScreen('screen-start');
  });

  document.getElementById('btn-shop-back').addEventListener('click', () => showScreen('screen-select'));

  document.querySelectorAll('#screen-select-mobile .track-opt').forEach(opt => {
    opt.addEventListener('click', () => {
      document.querySelectorAll('#screen-select-mobile .track-opt').forEach(o => o.classList.remove('active'));
      opt.classList.add('active');
      selectedCourseId = opt.getAttribute('data-course');
      try { localStorage.setItem('glider_last_course', selectedCourseId); } catch (e) {}
      buildCourse(selectedCourseId);
      grandPrixState.active = false;
      refreshDispatchModal();
      showScreen('screen-dispatch');
    });
  });

  refreshHalloweenBubble = setupBannerBubble(
  'happy-halloween-banner',
  'hw-banner-bubble',
  (clicks) => {
    if (halloween_door_unlocked) return 'what? you did your job! go to shop to collect it.';
    if (clicks === 1) return "2 pumpkins. one secret. Tap tap";
    return 'STILL cant find it? fine change your controls.';
  },
  () => halloween_door_unlocked
);

refreshChristmasBubble = setupBannerBubble(
  'merry-christmas-banner',
  'xmas-banner-bubble',
  (clicks) => {
    if (hasAllChristmasPresents()) return 'Nice job collecting the chirstmas pressents! check shop for your rewards!';
    return 'Oh no! Santa dropped 3 presents in the North Pole! Will you help him find them?';
  },
  () => hasAllChristmasPresents()
);

  if (HALLOWEEN_EVENT_ACTIVE) {
    updateHalloweenThemeVisibility();
    updateCellarDoorVisibility();

    const pumpkinProp = document.getElementById('settings-pumpkin-prop');
    if (pumpkinProp) {
      pumpkinProp.style.display = 'block';
      pumpkinProp.addEventListener('click', () => {
        audio.init();
        audio.playChainRattle();
        pumpkinProp.style.transform = 'scale(1.25) rotate(-10deg)';
        setTimeout(() => { pumpkinProp.style.transform = ''; }, 200);

        if (!halloween_door_unlocked) {
          halloween_door_unlocked = true;
          updateCellarDoorVisibility();
          showAchievementNotifications([{ name: 'Wait What was that?!' }]);
        }
      });
    }

    const pumpkinDecoy = document.getElementById('settings-pumpkin-decoy');
    if (pumpkinDecoy) {
      pumpkinDecoy.style.display = 'block';
      pumpkinDecoy.addEventListener('click', () => {
        audio.init();
        audio.playBeep(140, 'sawtooth', 0.12, 0.2);
        pumpkinDecoy.style.transform = 'scale(1.2) rotate(10deg)';
        setTimeout(() => { pumpkinDecoy.style.transform = ''; }, 200);
      });
    }

    }

  const cellarWrap = document.getElementById('shop-cellar-door-wrap');
  if (cellarWrap) {
    cellarWrap.addEventListener('click', () => {
      audio.init();
      audio.playCreakAndDeadbolt();

      if (CHRISTMAS_EVENT_ACTIVE && hasAllChristmasPresents()) {
  if (localStorage.getItem('glider_xmas_minigame_won') === 'true') {
    startKrampusBossRace();
  } else {
    openFlappyMinigame();
  }
  return;
}

      if (HALLOWEEN_EVENT_ACTIVE && halloween_door_unlocked) {
        isHalloweenBossDuel = true;
        grandPrixState.active = false;
        selectedCourseId = 'coastal';
        selectedSubtrack = 'B';
        selectedDifficulty = 'hard';
        gameMode = 'race';

        halloweenPreviousSkin = localStorage.getItem('glider_equipped_skin') || 'default';
        localStorage.setItem('glider_equipped_skin', 'glider_halloween');
        buildParagliderMesh();
        buildCourse('coastal');
        applySkySetting();
        updateHalloweenThemeVisibility();

        showScreen(null);
        stopMenuTheme(true);

        startGhostFleetCinematic();
      }
    });
  }

document.getElementById('btn-dispatch-back').addEventListener('click', () => {
    showScreen('screen-select');
  });

  document.getElementById('btn-launch-flight').addEventListener('click', () => {
    if (mobileJoystickMode === 'gyro') {
      requestGyroPermission();
    }
    startCountdown();
  });

  document.getElementById('btn-gp-preview-back').addEventListener('click', () => {
    showScreen('screen-select');
  });

  document.getElementById('btn-gp-start').addEventListener('click', () => {
    if (mobileJoystickMode === 'gyro') {
      requestGyroPermission();
    }
    startGrandPrixCup();
  });

  document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      gameMode = btn.getAttribute('data-gmode');
      try {
        localStorage.setItem('glider_game_mode', gameMode);
      } catch (e) {}
      const diffBox = document.getElementById('ai-diff-box');
      if (diffBox) diffBox.style.display = gameMode === 'timetrial' ? 'none' : 'flex';
      document.getElementById('mode-desc').innerText = gameMode === 'timetrial'
        ? 'Time Trials'
        : 'Race Against AI';
    });
  });

  document.querySelectorAll('.subtrack-opt').forEach(opt => {
    opt.addEventListener('click', () => {
      document.querySelectorAll('.subtrack-opt').forEach(o => o.classList.remove('active'));
      opt.classList.add('active');
      selectedSubtrack = opt.getAttribute('data-sub');
      updateMedalDisplay();
    });
  });

  document.querySelectorAll('.diff-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const diff = btn.getAttribute('data-diff');
      if (btn.classList.contains('gp-diff-btn') || btn.classList.contains('gp-diff-btn-dt')) {
        selectedGpDifficulty = diff;
        try {
          localStorage.setItem('glider_gp_difficulty', selectedGpDifficulty);
        } catch (e) {}
        document.querySelectorAll('.gp-diff-btn, .gp-diff-btn-dt').forEach(b => {
          b.classList.toggle('active', b.getAttribute('data-diff') === diff);
        });
      } else {
        selectedDifficulty = diff;
        try {
          localStorage.setItem('glider_difficulty', selectedDifficulty);
        } catch (e) {}
        document.querySelectorAll('#ai-diff-box .diff-btn').forEach(b => {
          b.classList.toggle('active', b.getAttribute('data-diff') === diff);
        });
      }
    });
  });

  document.querySelectorAll('.ctrl-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.ctrl-btn').forEach(b => b.classList.remove('active'));
      const mode = btn.getAttribute('data-mode');
      controlScheme = mode;
      try {
        localStorage.setItem('glider_control_scheme', controlScheme);
      } catch (e) {}
      document.querySelectorAll(`.ctrl-btn[data-mode="${mode}"]`).forEach(b => b.classList.add('active'));
    });
  });

  document.querySelectorAll('.invert-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      invertControls = (btn.getAttribute('data-invert') === 'on');
      try {
        localStorage.setItem('glider_invert_controls', invertControls ? 'true' : 'false');
      } catch (e) {}
      updateInvertButtons();
    });
  });

  document.querySelectorAll('.gfx-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      audio.init();
      setGraphicsQuality(btn.getAttribute('data-gfx'));
    });
  });

  document.querySelectorAll('.sfx-volume-slider').forEach(slider => {
    slider.addEventListener('input', (e) => {
      updateSfxVolume(e.target.value / 100);
    });
  });
  document.querySelectorAll('.music-volume-slider').forEach(slider => {
    slider.addEventListener('input', (e) => {
      updateMusicVolume(e.target.value / 100);
    });
  });

  updateInvertButtons();

  document.querySelectorAll('.joystick-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      audio.init();
      mobileJoystickMode = btn.getAttribute('data-joystick');
      if (mobileJoystickMode === 'gyro') {
        requestGyroPermission();
      } else {
        mobilePitchInput = 0;
        mobileRollInput = 0;
      }
      try {
        localStorage.setItem('glider_mobile_joystick', mobileJoystickMode);
      } catch (e) {}
      updateJoystickVisibility();
    });
  });

  updateJoystickVisibility();

  // Speedometer Needle Selector
  const pointerBox = document.getElementById('settings-pointer-box');
  if (pointerBox && localStorage.getItem('glider_unlocked_pointer2') === 'true') {
    pointerBox.style.display = 'flex';
  }
  const curPointer = localStorage.getItem('glider_speedo_pointer') || 'default';
  document.querySelectorAll('.pointer-btn').forEach(btn => {
    if (btn.getAttribute('data-pointer') === curPointer) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
    btn.addEventListener('click', () => {
      audio.init();
      const pMode = btn.getAttribute('data-pointer');
      localStorage.setItem('glider_speedo_pointer', pMode);
      document.querySelectorAll('.pointer-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  document.getElementById('btn-settings-toggle').addEventListener('click', () => {
    audio.init();
    document.getElementById('settings-overlay').style.display = 'flex';
    updateHalloweenThemeVisibility();
  });
  document.getElementById('btn-settings-close').addEventListener('click', () => {
    audio.init();
    document.getElementById('settings-overlay').style.display = 'none';
    updateHalloweenThemeVisibility();
  });
  document.getElementById('btn-resume').addEventListener('click', togglePauseMenu);  document.querySelectorAll('.btn-retry').forEach(btn => btn.addEventListener('click', handleRetryClick));
  document.querySelectorAll('.btn-menu').forEach(btn => btn.addEventListener('click', () => {
    krampusRetryPending = false;
    document.getElementById('countdown-box').style.display = 'none';
    gameState = 'START';
    audio.stopAllAudio();
    if (isHalloweenBossDuel) {
      isHalloweenBossDuel = false;
      localStorage.setItem('glider_equipped_skin', halloweenPreviousSkin || 'default');
      halloweenPreviousSkin = null;
      buildParagliderMesh();
      applySkySetting();
      updateHalloweenThemeVisibility();
    }
    if (isKrampusBossDuel) {
      isKrampusBossDuel = false;
    }
    if (grandPrixState.active) {
      grandPrixState.active = false;
      setSelectTab('gp');
      showScreen('screen-select');
    } else {
      refreshDispatchModal();
      showScreen('screen-dispatch');
    }
  }));

  const jbWidget = document.getElementById('jukebox-widget');
  if (jbWidget) {
    jbWidget.addEventListener('click', triggerJukeboxEject);
  }
  updateDiscVisuals(currentDiscKey);

  document.querySelectorAll('.ctrl-btn').forEach(b => {
    b.classList.toggle('active', b.getAttribute('data-mode') === controlScheme);
  });
  document.querySelectorAll('.gp-diff-btn, .gp-diff-btn-dt').forEach(b => {
    b.classList.toggle('active', b.getAttribute('data-diff') === selectedGpDifficulty);
  });

  updateMusicVolume(musicVolume);
  updateSfxVolume(sfxVolume);

  updateMedalDisplay();
}

function refreshDispatchModal() {
  const course = COURSES[selectedCourseId];
  document.getElementById('dispatch-course-title').innerText = course.name.toUpperCase();

  ['A', 'B', 'C', 'D'].forEach(sub => {
    const st = course.subtracks[sub];
    if (st) {
      const nameEl = document.getElementById(`st-name-${sub}`);
      const descEl = document.getElementById(`st-desc-${sub}`);
      if (nameEl) nameEl.innerText = st.name;
      if (descEl) descEl.innerText = st.desc;
    }
  });

  const optD = document.getElementById('subtrack-opt-D');
  if (optD) {
    if (selectedCourseId === 'canyon' || selectedCourseId === 'moon') {
      optD.classList.remove('hidden');
    } else {
      optD.classList.add('hidden');
      if (selectedSubtrack === 'D') {
        selectedSubtrack = 'A';
        document.querySelectorAll('.subtrack-opt').forEach(b => {
          if (b.getAttribute('data-sub') === 'A') b.classList.add('active');
          else b.classList.remove('active');
        });
      }
    }
  }

  const impDiffBtn = document.getElementById('btn-diff-impossible');
  if (impDiffBtn) {
    if (impossibleDifficultyUnlocked) {
      impDiffBtn.classList.remove('hidden');
    } else {
      impDiffBtn.classList.add('hidden');
      if (selectedDifficulty === 'impossible') {
        selectedDifficulty = 'medium';
        document.querySelectorAll('.diff-btn').forEach(b => {
          if (b.getAttribute('data-diff') === 'medium') b.classList.add('active');
          else b.classList.remove('active');
        });
      }
    }
  }

  document.querySelectorAll('#dispatch-flight-mode-box .mode-btn').forEach(b => {
    b.classList.toggle('active', b.getAttribute('data-gmode') === gameMode);
  });

  const diffBox = document.getElementById('ai-diff-box');
  if (diffBox) {
    diffBox.style.display = (gameMode === 'timetrial') ? 'none' : 'flex';
  }

  document.querySelectorAll('#ai-diff-box .diff-btn').forEach(b => {
    b.classList.toggle('active', b.getAttribute('data-diff') === selectedDifficulty);
  });

  const modeDesc = document.getElementById('mode-desc');
  if (modeDesc) {
    modeDesc.innerText = (gameMode === 'timetrial') ? 'TIME TRIAL' : 'RACE AI';
  }

  updatePBTags();
  updateMedalDisplay();
}

function updatePBTags() {
  ['A', 'B', 'C', 'D'].forEach(sub => {
    const pb = localStorage.getItem(`pb_${selectedCourseId}_${sub}`);
    const el = document.getElementById(`pb-${sub}`);
    if (el) el.innerText = pb ? `BEST: ${formatTime(parseFloat(pb))}` : 'BEST: --:--.-';
  });
}

function updateMedalDisplay() {
  const m = COURSES[selectedCourseId].subtracks[selectedSubtrack].medals;
  document.getElementById('m-bronze').innerText = formatTime(m.bronze);
  document.getElementById('m-silver').innerText = formatTime(m.silver);
  document.getElementById('m-gold').innerText = formatTime(m.gold);
  document.getElementById('m-ace').innerText = formatTime(m.ace);
}

function showScreen(screenId) {
  const isMobile = isMobileDevice() || window.innerWidth <= 950 || window.innerHeight <= 600;
  if (screenId === 'screen-start' || screenId === 'screen-start-mobile') {
    screenId = isMobile ? 'screen-start-mobile' : 'screen-start';
  }
  if (screenId === 'screen-select' || screenId === 'screen-select-mobile') {
    screenId = isMobile ? 'screen-select-mobile' : 'screen-select';
  }
  if (screenId !== 'screen-shop') {
    clearShopTvTimer();
  }

  const screens = ['screen-start', 'screen-select', 'screen-start-mobile', 'screen-select-mobile', 'screen-shop', 'screen-dispatch', 'screen-pause', 'screen-win', 'screen-lose', 'screen-gp-preview', 'screen-gp-interstitial', 'screen-gp-summary'];
  screens.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.classList.add('hidden');
      el.style.display = 'none';
    }
  });

  lastActiveScreenId = null;
  document.querySelectorAll('.mono-btn, .track-opt, .subtrack-opt, .shop-item-card, .ctrl-btn, .mode-btn, .diff-btn, .invert-btn').forEach(el => {
    el.style.borderColor = '';
    el.style.boxShadow = '';
  });

  const settingsBtn = document.getElementById('btn-settings-toggle');
  const jbWidget = document.getElementById('jukebox-widget');
  if (settingsBtn) {
    settingsBtn.style.display = screenId ? 'flex' : 'none';
  }
  if (jbWidget) {
    jbWidget.style.display = screenId ? 'flex' : 'none';
  }

  if (screenId) {
    const targetEl = document.getElementById(screenId);
    if (targetEl) {
      targetEl.classList.remove('hidden');
      targetEl.style.display = (screenId === 'screen-start-mobile') ? 'flex' : '';
    }
    document.getElementById('hud-overlay').style.display = 'none';
    const mobileWrap = document.getElementById('mobile-controls-wrap');
    if (mobileWrap && !isRepositionMode) mobileWrap.style.display = 'none';
    const mobileSpd = document.getElementById('mobile-speedometer');
    if (mobileSpd) mobileSpd.style.display = 'none';

    if (screenId === 'screen-shop') {
      playMenuTheme('shop');
    } else if (screenId === 'screen-pause') {
      playMenuTheme('pause');
    } else {
      playMenuTheme('menu');
    }

    if (screenId === 'screen-start' || screenId === 'screen-start-mobile') {
      const startMessages = [
        'PITCH / BANK / YAW FLIGHT SYSTEM<br>PRESS W + ctrl /cmd for free golden time trial ghost!',
        'Wait... you were expecting a tutorial? <br>Aphelion Code of Conduct says: "Git Gud."',
        'Did you know Aphelion has their own AI? <br>And now this 3D game?',
        'Dev Count: 1... <br>and that artist "Konekofire"',
        'Thermals go up. Sinks go down.<br>And either way you will find a way to get stuck in the sinks!',
        'Warning: Stalling may result in a boost.<br>Or a crater. Good luck!',
        'Wait what theres mouse controls? since when?!',
        'Waitttt if aphelion is coding this then who turned off the stove?!',
        'Did you know: Every thermal in this game was placed by hand?<br> yeah i came down and placed it was kinda fun',
        'What you crashed? <br> must have been the wind!',
        '8 ball isnt this game the best? <br>"[8 Ball] hmmm i was going to say no, but I am a kind ai and so i say no"',
        'Who ever made this game should get paid more <br> what? stop looking at me i dont money either!',
        'Did you know? sink wells exist in real life <br> if this game was named real life',
        'You think sink wells are bad? <br> We almost added bird stikes.. oh wait we did',
        'How much does the red glider cost? <br> uh $2 i mean 100k yeah we went a little high end',
        'The Greatest Glider To Ever Live <br> sheesh thats so long anyways i was going to say its not actually 24k gold its actually 26k gold',
        'This game runs better than a print command! <br> Share it with everyone! no one is gonna say it doesnt work',
        'Aim DOWN to build momentum <br> aim too far down and you might get turbulence',
        'Now with Controller support!',
        'belive it or not this game has playtesters!',
        'Z fighting? where? <br> no no no you dont see z fighting nuh uh',
        'V2.5.1: Added 1 Thermal',
        '©2026 Aphelion Team',
        'Bondo Reems <br> is happy to announce hes trying to get addicted to alchohol',
        'Very funny joke: I told my glider to aim down in the storm for speed. <br>It aimed down too hard and found a sink well instead of a thermal.',
        "Super Funny joke: I told my glider to ride the volcano's thermals <br> Now it's a 'lava' glider… and not in the cool way.",
        'Dont go pressing random keybinds like: <br> cmd/ctrl + W or cmd/ctrl + T or alt + shift+ D especially not that one',
        'i rate those 2 funny jokes a solid 6.25/10!',
        'Did you know: this game alone is just about 17k lines <br> as of making this message, but it will hit 20k soon stay tuned!',
        'Hey you better NOT get that greatest glider to ever live! <br> it costs TREE(3) EACH to make and that can get expensive yk',
        'Our state of the art anti theft and anti robbery Aphelion Encoder™ <br> will not allow cheators from editing their save files!',
        'Watch out! playing this game might cause you to get <br> BUTTERFINGERS',
        'Check out Butterfingers by team Aphelion! <br> available right in your kitchen! (and on your computer)',
        "NASA said we're good to use the Moon.<br>They did NOT say we could keep it.",
        'Warning: If lost on the moon <br> FLY BACK',
        'Ice spikes in glacial are inspired by: <br> Hyper Karts Blizzard Circuit!',
        'Holy cow, this project is a lot of lines.<br>At least 3 of them work. I think.',
        'I heard the craters on the Moon<br>were caused by meteors.',
        'Bet you cant get 17/16 stars in grand prix <br> guess what? i just did.',
        "Tip: The ground is not a valid flight path.",
        'Sheesh that TV always seems to be on.',
        "Due to recent events, this game will be renamed to America.",
        "Glider? An APP?",
        "Now FULLY supports mobile!",
      ];

      const randomIndex = Math.floor(Math.random() * startMessages.length);
      const instrEl = document.querySelector('#screen-start .instructions');
      const instrElMobile = document.querySelector('#screen-start-mobile .instructions');

      if (instrEl) instrEl.innerHTML = startMessages[randomIndex];
      if (instrElMobile) instrElMobile.innerHTML = startMessages[randomIndex];
    }
} else {
    document.getElementById('hud-overlay').style.display = 'block';
    stopMenuTheme();
    const hwDecor = document.getElementById('halloween-decor-wrap');
    if (hwDecor) hwDecor.style.display = 'none';
    const hwBanner = document.getElementById('happy-halloween-banner');
    if (hwBanner) {
      hwBanner.style.display = 'none';
      hwBanner.classList.remove('visible');
    }
    const mobileWrap = document.getElementById('mobile-controls-wrap');
    if (mobileWrap) {
      const showMobileWrap = isMobile || window.matchMedia('(pointer: coarse)').matches;
      mobileWrap.style.display = showMobileWrap ? 'block' : 'none';
    }
    const mobileSpd = document.getElementById('mobile-speedometer');
    if (mobileSpd) mobileSpd.style.display = isMobileDevice() ? 'flex' : 'none';
    if (isMobileDevice()) {
      applyMobileButtonPositions();
      updateJoystickVisibility();
    }
  }

  try {
    updateHalloweenThemeVisibility();
  } catch (e) {
    console.warn('[showScreen] theme update failed (non-fatal):', e);
  }

  try {
    refreshCourseCards();
  } catch (e) {}
}

function courseHasAce(courseId) {
  const course = COURSES[courseId];
  if (!course) return false;
  return ['A', 'B', 'C', 'D'].some(sub => {
    const st = course.subtracks[sub];
    const pb = parseFloat(localStorage.getItem(`pb_${courseId}_${sub}`));
    return !!st && !isNaN(pb) && pb <= st.medals.ace;
  });
}

function refreshCourseCards() {
  document.querySelectorAll('#single-track-list .track-opt[data-course], #single-track-list-dt .track-opt[data-course]').forEach(card => {
    const id = card.getAttribute('data-course');
    card.classList.toggle('active', id === selectedCourseId);

    const hasAce = courseHasAce(id);
    let star = card.querySelector('.ace-star');
    if (hasAce && !star) {
      star = document.createElement('span');
      star.className = 'ace-star';
      star.textContent = '★';
      star.title = 'Ace medal earned';
      card.appendChild(star);
    } else if (!hasAce && star) {
      star.remove();
    }
  });
}

function updateHUD() {
  if (gameState !== 'RACING') return;
  const course = COURSES[selectedCourseId];
  const activeSubtrack = course.subtracks[selectedSubtrack];

  const oldSpdEl = document.getElementById('hud-spd');
  if (oldSpdEl) oldSpdEl.innerText = Math.round(player.speed);
  document.getElementById('hud-alt').innerText = Math.round(player.pos.y * 3.2);
  document.getElementById('hud-gate').innerText = `${player.nextGateIdx}/${activeSubtrack.waypoints.length - 1}`;
  document.getElementById('hud-time').innerText = formatTime(raceElapsedTime);

  const mobileSpdVal = document.getElementById('mobile-speed-val');
  if (mobileSpdVal) {
    const spd = Math.round(player.speed || 0);
    mobileSpdVal.innerText = String(spd).padStart(3, '0');
    if (spd < 24) {
      mobileSpdVal.style.color = 'var(--red)';
    } else if (spd > 130) {
      mobileSpdVal.style.color = 'var(--gold)';
    } else {
      mobileSpdVal.style.color = '#ffffff';
    }
  }

  const posLabel = document.getElementById('hud-pos-label');
  const posVal = document.getElementById('hud-pos');
  const deltaElem = document.getElementById('hud-delta');

if (gameMode === 'race') {
    posLabel.innerText = 'POS';
    posVal.innerText = `${player.rank}/${(isKrampusBossDuel || isHalloweenBossDuel) ? 2 : 5}`;

    const liveBoard = document.getElementById('live-race-leaderboard');
    if (liveBoard) liveBoard.style.display = 'none';

    if (aiGliders.length > 0) {
      const playerProgress = getTrackProgress(player.pos, player.nextGateIdx, 0);
      let targetAI = null;
      if (player.rank === 1) {
        let maxAiProg = -Infinity;
        aiGliders.forEach(ai => {
          if (ai.progress > maxAiProg) {
            maxAiProg = ai.progress;
            targetAI = ai;
          }
        });
      } else {
        let minAheadDist = Infinity;
        aiGliders.forEach(ai => {
          if (ai.progress > playerProgress) {
            const diff = ai.progress - playerProgress;
            if (diff < minAheadDist) {
              minAheadDist = diff;
              targetAI = ai;
            }
          }
        });
        if (!targetAI) targetAI = aiGliders[0];
      }

      if (!targetAI) targetAI = aiGliders[0];

      const progressDiff = playerProgress - targetAI.progress;
      const deltaSeconds = progressDiff / Math.max(player.speed * 2.2, 45);

      if (deltaElem) {
        if (deltaSeconds >= 0) {
          deltaElem.style.color = 'var(--cyan)';
          deltaElem.innerText = `(+${deltaSeconds.toFixed(1)}s)`;
        } else {
          deltaElem.style.color = 'var(--red)';
          deltaElem.innerText = `(${deltaSeconds.toFixed(1)}s)`;
        }
      }
    }
  } else {
    posLabel.innerText = 'MODE';
    posVal.innerText = 'TT';
    if (ghostDroneGroup) {
      _tempVec1.subVectors(player.pos, ghostDroneGroup.position);
      const dotAhead = _tempVec1.dot(_playerForward);
      const gSeconds = dotAhead / Math.max(player.speed, 45);
      if (gSeconds >= 0) {
        deltaElem.style.color = 'var(--cyan)';
        deltaElem.innerText = `(+${gSeconds.toFixed(1)}s GHOST)`;
      } else {
        deltaElem.style.color = 'var(--red)';
        deltaElem.innerText = `(${gSeconds.toFixed(1)}s GHOST)`;
      }
    } else {
      deltaElem.style.color = 'var(--mono-60)';
      deltaElem.innerText = '(Time Trial)';
    }
  }
}

function formatTime(s) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  const ms = Math.floor((s % 1) * 10);
  return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}.${ms}`;
}

const creditsAudio = new Audio('creditsgliderscreen.mp3');
creditsAudio.preload = 'auto';

const CREDITS_TRACK_SEQUENCE = [
  {
    courseId: 'canyon',
    name: 'MOUNTAIN CANYONS',
    align: 'center',
    camStart: [0, 480, 150],
    camEnd: [250, 410, -2200],
    lookAt: [600, 360, -3200]
  },
  {
    courseId: 'islands',
    name: 'SKY ISLANDS & RUINS',
    align: 'center',
    camStart: [800, 720, -1200],
    camEnd: [300, 580, -3800],
    lookAt: [300, 450, -5200]
  },
  {
    courseId: 'coastal',
    name: 'STORMY COASTAL CLIFFS',
    align: 'center',
    camStart: [-1400, 540, -1600],
    camEnd: [-800, 440, -4200],
    lookAt: [0, 200, -6500]
  },
  {
    courseId: 'volcano',
    name: 'VOLCANIC ISLAND',
    align: 'right', // To the right side, highlighting the central caldera & eruption
    camStart: [0, 1180, -2800],
    camEnd: [150, 960, -4800],
    lookAt: [0, 882, -5500]
  },
  {
    courseId: 'glacial',
    name: 'GLACIAL PEAKS',
    align: 'left', // To the left side, keeping diamond ice arches clearly visible
    camStart: [350, 560, -1200],
    camEnd: [120, 400, -3800],
    lookAt: [0, 180, -5200]
  },
  {
    courseId: 'moon',
    name: 'THE MOON & DEEP SPACE',
    align: 'left', // Left side, leaving Earthrise and the Tesla Roadster open on the right
    camStart: [400, 620, -1100],
    camEnd: [800, 760, -3200],
    lookAt: [1000, 3400, -19500]
  }
];

let creditsActive = false;
let canSkipCredits = false;
let creditsUnlockMode = null; // null | 'greatest_glider' | 'aphelion_apex'
let creditsOnFinishCallback = null;
let creditsTimer = 0;
let creditsTotalDuration = 62; // 62 second default
let creditsCurrentStageIdx = -1;
let greatestGliderSplashActive = false;
let aphelionApexCinematicActive = false;

const _camStartVec = new THREE.Vector3();
const _camEndVec = new THREE.Vector3();
const _camLookAtVec = new THREE.Vector3();

function startCredits(options = {}) {
  const unlockType = options.unlockType || (options.isGreatestGliderUnlock ? 'greatest_glider' : null);
  const hasSeenCredits = (localStorage.getItem('glider_credits_seen') === 'true');

  creditsActive = true;
  creditsUnlockMode = unlockType;
  creditsOnFinishCallback = options.onFinish || null;
  canSkipCredits = !(unlockType && !hasSeenCredits);

  gameState = 'CREDITS';
  creditsTimer = 0;
  creditsCurrentStageIdx = -1;

  audio.init();
  stopMenuTheme(true);
  audio.stopAllAudio();

  if (paragliderWingGroup) paragliderWingGroup.visible = false;
  document.getElementById('hud-overlay').style.display = 'none';

  // Hide any open menus
  const screens = ['screen-start', 'screen-select', 'screen-shop', 'screen-dispatch', 'screen-pause', 'screen-win', 'screen-lose', 'screen-gp-preview', 'screen-gp-interstitial', 'screen-gp-summary'];
  screens.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.add('hidden');
  });

  const settingsBtn = document.getElementById('btn-settings-toggle');
  const jbWidget = document.getElementById('jukebox-widget');
  if (settingsBtn) settingsBtn.style.display = 'none';
  if (jbWidget) jbWidget.style.display = 'none';

  const creditsScreen = document.getElementById('screen-credits');
  const dimOverlay = document.getElementById('credits-dim-overlay');
  const scrollContent = document.getElementById('credits-scroll-content');
  const scrollWrap = document.getElementById('credits-scroll-wrap');

  if (creditsScreen) creditsScreen.style.display = 'block';
  if (dimOverlay) dimOverlay.style.opacity = '1.0';

  if (scrollWrap) {
    scrollWrap.className = 'align-center';
  }

  if (scrollContent) {
    scrollContent.style.transform = `translateY(${window.innerHeight * 0.40}px)`;
  }

  creditsAudio.currentTime = 0;
  creditsAudio.volume = 1.0;
  creditsAudio.play().catch(() => {});

  creditsAudio.onloadedmetadata = () => {
    if (creditsAudio.duration && !isNaN(creditsAudio.duration) && creditsAudio.duration > 10) {
      creditsTotalDuration = creditsAudio.duration;
    }
  };

  const creditsHw = document.getElementById('credits-halloween-final');
  if (creditsHw) {
    creditsHw.style.display = HALLOWEEN_EVENT_ACTIVE ? 'block' : 'none';
  }

  loadCreditsStage(0);
}

function loadCreditsStage(stageIdx) {
  if (stageIdx === creditsCurrentStageIdx) return;
  creditsCurrentStageIdx = stageIdx;

  const stage = CREDITS_TRACK_SEQUENCE[stageIdx];
  if (!stage) return;

  selectedSubtrack = 'A';
  selectedCourseId = stage.courseId;
  buildCourse(selectedCourseId);

  if (paragliderWingGroup) paragliderWingGroup.visible = false;
  if (gateMeshes) gateMeshes.forEach(g => { g.group.visible = false; });

  _camStartVec.set(...stage.camStart);
  _camEndVec.set(...stage.camEnd);
  _camLookAtVec.set(...stage.lookAt);

  camera.position.copy(_camStartVec);
  camera.lookAt(_camLookAtVec);

  const stepEl = document.getElementById('credits-track-step');
  const titleEl = document.getElementById('credits-track-title');
  if (stepEl) stepEl.innerText = `0${stageIdx + 1} / 06`;
  if (titleEl) titleEl.innerText = stage.name;

  // Shift text position smoothly (center, left, or right)
  const scrollWrap = document.getElementById('credits-scroll-wrap');
  if (scrollWrap) {
    scrollWrap.classList.remove('align-center', 'align-left', 'align-right');
    scrollWrap.classList.add('align-' + (stage.align || 'center'));
  }
}

function updateCredits(dt) {
  if (!creditsActive) return;

  if (creditsAudio.duration && !isNaN(creditsAudio.duration) && creditsAudio.duration > 10) {
    creditsTotalDuration = creditsAudio.duration;
  }

  if (!creditsAudio.paused && creditsAudio.currentTime > 0) {
    creditsTimer = creditsAudio.currentTime;
  } else {
    creditsTimer += dt;
  }

  const progress = Math.min(1.0, creditsTimer / creditsTotalDuration);

  const dimOverlay = document.getElementById('credits-dim-overlay');
  if (dimOverlay) {
    if (creditsTimer < 3.2) {
      dimOverlay.style.opacity = '1.0';
    } else if (creditsTimer < 5.8) {
      const t = (creditsTimer - 3.2) / 2.6;
      dimOverlay.style.opacity = String(THREE.MathUtils.lerp(1.0, 0.25, t));
    } else if (progress > 0.90) {
      const t = (progress - 0.90) / 0.10;
      dimOverlay.style.opacity = String(THREE.MathUtils.lerp(0.25, 1.0, t));
    } else {
      dimOverlay.style.opacity = '0.25';
    }
  }

  const stageDuration = creditsTotalDuration / CREDITS_TRACK_SEQUENCE.length;
  const stageIdx = Math.min(CREDITS_TRACK_SEQUENCE.length - 1, Math.floor(creditsTimer / stageDuration));
  if (stageIdx !== creditsCurrentStageIdx) {
    loadCreditsStage(stageIdx);
  }

  const stage = CREDITS_TRACK_SEQUENCE[stageIdx];
  if (stage) {
    const stageProgress = (creditsTimer % stageDuration) / stageDuration;
    camera.position.lerpVectors(_camStartVec, _camEndVec, stageProgress);
    camera.lookAt(_camLookAtVec);
  }

  if (volcanoEruptionSystem) updateVolcanoEruption(dt);
  if (lighthouseBeams && lighthouseBeams.length > 0) {
    lighthouseBeams.forEach(b => { b.rotation.y += 0.8 * dt; });
  }

  const scrollContent = document.getElementById('credits-scroll-content');
  if (scrollContent) {
    const startY = window.innerHeight * 0.40;
    const totalScrollHeight = scrollContent.scrollHeight + window.innerHeight + 120;
    const currentY = startY - (progress * totalScrollHeight);
    scrollContent.style.transform = `translateY(${currentY}px)`;
  }

  if (progress >= 1.0 || creditsAudio.ended) {
    finishCreditsSequence();
  }
}

function finishCreditsSequence() {
  if (!creditsActive) return;
  creditsActive = false;

  creditsAudio.pause();
  creditsAudio.currentTime = 0;

  const dimOverlay = document.getElementById('credits-dim-overlay');
  if (dimOverlay) dimOverlay.style.opacity = '1.0';

  try {
    localStorage.setItem('glider_credits_seen', 'true');
  } catch (e) {}

  const unlockMode = creditsUnlockMode;
  const finishCb = creditsOnFinishCallback;
  creditsUnlockMode = null;
  creditsOnFinishCallback = null;

  if (unlockMode === 'greatest_glider') {
    setTimeout(() => {
      const creditsScreen = document.getElementById('screen-credits');
      if (creditsScreen) creditsScreen.style.display = 'none';
      triggerGreatestGliderCinematic(() => {
        if (finishCb) finishCb();
        else exitCreditsToMenu();
      });
    }, 700);
  } else if (unlockMode === 'aphelion_apex') {
    setTimeout(() => {
      const creditsScreen = document.getElementById('screen-credits');
      if (creditsScreen) creditsScreen.style.display = 'none';
      triggerAphelionApexCinematic(() => {
        if (finishCb) finishCb();
        else exitCreditsToMenu();
      });
    }, 700);
  } else {
    setTimeout(() => {
      const creditsScreen = document.getElementById('screen-credits');
      if (creditsScreen) creditsScreen.style.display = 'none';
      if (finishCb) finishCb();
      else exitCreditsToMenu();
    }, 900);
  }
}

const aphelionApexPreload = new Image();
aphelionApexPreload.src = 'aphelionapex.png';

function triggerAphelionApexCinematic(onFinish) {
  const overlay = document.getElementById('aphelion-apex-cinematic');
  const img = document.getElementById('aphelion-apex-cinematic-img');
  if (!overlay || !img) {
    if (onFinish) onFinish();
    return;
  }

  aphelionApexCinematicActive = true;
  let finished = false;

  overlay.style.transition = 'opacity 1.2s ease-in-out';
  overlay.style.opacity = '0';
  overlay.style.display = 'flex';
  overlay.style.pointerEvents = 'none';
  img.classList.remove('show');

  void overlay.offsetWidth;

  overlay.style.opacity = '1';

  function startFadeOut() {
    if (finished) return;
    finished = true;
    overlay.style.transition = 'opacity 1.4s ease-in-out';
    overlay.style.opacity = '0';

    setTimeout(() => {
      overlay.style.display = 'none';
      img.classList.remove('show');
      aphelionApexCinematicActive = false;
      if (onFinish) onFinish();
    }, 1450);
  }

  setTimeout(() => {
    if (finished) return;
    img.classList.add('show');
    audio.playFinishFanfare();

    setTimeout(() => {
      startFadeOut();
    }, 2800);
  }, 1200);
}

function triggerGreatestGliderCinematic(onFinish) {
  const overlay = document.getElementById('greatest-glider-splash');
  const img = document.getElementById('greatest-glider-img');
  if (!overlay || !img) {
    if (onFinish) onFinish();
    return;
  }

  greatestGliderSplashActive = true;
  let finished = false;

  overlay.style.transition = 'opacity 1.2s ease-in-out';
  overlay.style.opacity = '0';
  overlay.style.display = 'flex';
  overlay.style.pointerEvents = 'none';
  img.classList.remove('show');

  void overlay.offsetWidth;

  overlay.style.opacity = '1';

  function startFadeOut() {
    if (finished) return;
    finished = true;
    overlay.style.transition = 'opacity 1.4s ease-in-out';
    overlay.style.opacity = '0';

    setTimeout(() => {
      overlay.style.display = 'none';
      img.classList.remove('show');
      greatestGliderSplashActive = false;
      if (onFinish) onFinish();
    }, 1450);
  }

  setTimeout(() => {
    if (finished) return;
    img.classList.add('show');
    audio.playFinishFanfare();

    setTimeout(() => {
      startFadeOut();
    }, 2800);
  }, 1200);
}

function exitCreditsToMenu() {
  creditsActive = false;
  greatestGliderSplashActive = false;
  aphelionApexCinematicActive = false;
  gameState = 'START';

  creditsAudio.pause();
  creditsAudio.currentTime = 0;

  const creditsScreen = document.getElementById('screen-credits');
  if (creditsScreen) creditsScreen.style.display = 'none';

  const splash = document.getElementById('greatest-glider-splash');
  if (splash) splash.style.display = 'none';

  const apexOverlay = document.getElementById('aphelion-apex-cinematic');
  if (apexOverlay) apexOverlay.style.display = 'none';

  if (paragliderWingGroup) paragliderWingGroup.visible = true;

  selectedCourseId = localStorage.getItem('glider_last_course') || 'canyon';
  selectedSubtrack = 'A';
  buildCourse(selectedCourseId);
  showScreen('screen-start');
  playMenuTheme('menu');
}

let lastTime = performance.now();

function updateRestartHold(dt) {
  if (!keys['KeyR']) restartNeedsRelease = false;

  if ((gameState === 'RACING' || gameState === 'RUNUP') && !devFreeCam) {
    if (keys['KeyR'] && !restartNeedsRelease) {
      restartHoldTimer += dt;
      restartPromptOpacity = Math.min(1.0, restartPromptOpacity + dt * 6.0);
      if (restartHoldTimer >= 2.0) {
        restartHoldTimer = 0;
        restartPromptOpacity = 0;
        restartNeedsRelease = true; 
        audio.playBeep(880, 'sine', 0.2);
        if (grandPrixState.active) startGrandPrixCup(); 
        else startCountdown();
        return;
      }
    } else {
      restartHoldTimer = 0;
      restartPromptOpacity = Math.max(0, restartPromptOpacity - dt * 4.0);
    }
  } else {
    restartHoldTimer = 0;
    restartPromptOpacity = Math.max(0, restartPromptOpacity - dt * 6.0);
  }
}

function animate() {
  requestAnimationFrame(animate);

  document.body.classList.toggle('in-flight',
    gameState === 'RUNUP' || gameState === 'RACING' ||
    gameState === 'FINISHING' || gameState === 'CREDITS' ||
    gameState === 'GHOST_FLEET_CINEMATIC' || gameState === 'KRAMPUS_CINEMATIC');

  const now = performance.now();
  const dt = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;

  if (gameState !== lastMobileCtrlGameState) {
    lastMobileCtrlGameState = gameState;
    if (isMobileDevice()) updateJoystickVisibility();
  }

  handleGamepadUI(dt);
  updateBackGifFrame();
  updateTvStaticTexture();
  updateRestartHold(dt);

  if (devFadeInTimer > 0) {
    devFadeInTimer = Math.max(0, devFadeInTimer - dt);
  }

  if (getEquippedSkinId() === 'aphelion_apex' && paragliderWingGroup && paragliderWingGroup.children[0]) {
    const mesh = paragliderWingGroup.children[0];
    if (mesh.material && mesh.material.emissiveIntensity !== undefined) {
      mesh.material.emissiveIntensity = 0.50 + Math.sin(now * 0.0035) * 0.22;
    }
  }

  if (gameState === 'GHOST_FLEET_CINEMATIC') {
    updateGhostFleetCinematic(dt);
  } else if (gameState === 'KRAMPUS_CINEMATIC') {
    updateKrampusCinematic(dt);
  } else if (gameState === 'CREDITS') {
    updateCredits(dt);
  } else if (gameState === 'RUNUP') {
    updateRunup(dt);
  } else if (gameState === 'RACING' || gameState === 'FINISHING') {
    updateFlight(dt);
  } else if (gameState === 'START' || gameState === 'SELECT' || gameState === 'DISPATCH') {
    const course = COURSES[selectedCourseId];
    const cPos = course ? course.cliffPos : { x: 0, y: 420, z: 0 };
    menuCamCenter.lerp(cPos, Math.min(1.0, 5.0 * dt));
    const t = now * 0.00015;
    camera.position.set(menuCamCenter.x + Math.sin(t) * 800, menuCamCenter.y + 80, menuCamCenter.z + Math.cos(t) * 800);
    camera.lookAt(menuCamCenter.x, menuCamCenter.y - 170, menuCamCenter.z);
    if (volcanoEruptionSystem) {
      updateVolcanoEruption(dt);
    }
  }

  const gpSummaryScreen = document.getElementById('screen-gp-summary');
  if (gpSummaryScreen && !gpSummaryScreen.classList.contains('hidden') && gpTrophyScene) {
    if (gpTrophyGroup) {
      gpTrophyGroup.rotation.y += 0.018;
      gpTrophyGroup.position.y = Math.sin(now * 0.003) * 0.22;
    }
    if (gpConfettiSystem && gpConfettiVels.length > 0) {
      const pos = gpConfettiSystem.geometry.attributes.position.array;
      const tSec = now * 0.001;
      for (let i = 0; i < gpConfettiVels.length; i++) {
        const vel = gpConfettiVels[i];
        pos[i * 3 + 1] -= vel.speedY * dt;
        pos[i * 3] += Math.sin(tSec * vel.wobbleSpeed + vel.wobblePhase) * 0.02 + vel.driftX * dt;
        if (pos[i * 3 + 1] < -4.0) {
          pos[i * 3 + 1] = 4.8;
          pos[i * 3] = (Math.random() - 0.5) * 8.5;
        }
      }
      gpConfettiSystem.geometry.attributes.position.needsUpdate = true;
    }
    if (gpTrophyRenderer && gpTrophyCamera) {
      gpTrophyRenderer.render(gpTrophyScene, gpTrophyCamera);
    }
  }

  const shopScreen = document.getElementById('screen-shop');
  if (shopScreen && !shopScreen.classList.contains('hidden')) {
    if (shopGliderGroup && shopGliderGroup.visible) {
      shopGliderGroup.rotation.y += 0.016;
      if (shopGliderGroup.is2DGlider) {
        update2DDroneMesh(shopGliderGroup, shopCamera);
      }
    }
    if (shopDroneGroup && shopDroneGroup.visible) {
      shopDroneGroup.rotation.y += 0.016;
      if (shopDroneGroup.is2DDrone) {
        update2DDroneMesh(shopDroneGroup, shopCamera);
      }
    }
    if (shopRenderer) {
      shopRenderer.render(shopScene, shopCamera);
    }
  }

if (lighthouseBeams.length > 0) {
    lighthouseBeams.forEach(b => { b.rotation.y += 0.8 * dt; });
  }

  if (graphicsQuality === 'high' && waterRippleTexture) {
    const tw = now * 0.001;
    waterFoamTime.value = tw;
    waterRippleTexture.offset.x += (0.028 + Math.sin(tw * 0.35) * 0.012) * dt;
    waterRippleTexture.offset.y += (0.019 + Math.cos(tw * 0.27) * 0.010) * dt;
  }

  if (getEquippedSkinId() === 'glider_16bit') {
    for (let i = 0; i < gateMeshes.length; i++) {
      const g = gateMeshes[i];
      if (g.sprite && g.sprite.visible) {
        g.sprite.quaternion.copy(g.group.quaternion).invert().multiply(camera.quaternion);
      }
    }
  }

renderer.render(scene, camera);
  
  if (!window.lastHudDrawTime) window.lastHudDrawTime = 0;
  if (now - window.lastHudDrawTime > 33.3) { // ~30 FPS
    drawHudCanvas();
    window.lastHudDrawTime = now;
  }
}
function initSplashIntro() {
  const splash = document.getElementById('splash-intro');
  const logo = document.getElementById('splash-logo');
  const prompt = document.getElementById('splash-prompt');
  if (!splash || !logo) return;

  const savedDisc = localStorage.getItem('glider_soundtrack_disc') || 'default';
  if (savedDisc === 'g64') {
    bgStartup.src = 'intro64.mp3';
  } else {
    bgStartup.src = 'startup.mp3';
  }

  bgStartup.play().catch(() => {

    const onFirstTouch = () => {
      if (!dismissed) bgStartup.play().catch(() => {});
      window.removeEventListener('pointerdown', onFirstTouch);
    };
    window.addEventListener('pointerdown', onFirstTouch);
  });

  let dismissed = false;

  function dismissSplash() {
    if (dismissed) return;
    dismissed = true;

    // Primes the audio
    audio.init();


    bgStartup.pause();
    bgStartup.currentTime = 0;

const randomSound = INTERACT_SFX[Math.floor(Math.random() * INTERACT_SFX.length)];
    const sfx = new Audio(randomSound);
      sfx.volume = sfxVolume;
    sfx.play().catch(() => {});

    prompt.style.opacity = '0';
    logo.classList.add('fly-out');
    splash.style.pointerEvents = 'none';

    setTimeout(() => {
      splash.style.opacity = '0';
    }, 280);

    setTimeout(() => {
      splash.style.display = 'none';
      splashDismissed = true;
      playMenuTheme();
      //change delay
    }, 600);

    window.removeEventListener('keydown', dismissSplash);
    splash.removeEventListener('click', dismissSplash);
  }

  window.addEventListener('keydown', dismissSplash);
  splash.addEventListener('click', dismissSplash);
}
window.onload = () => {
  init();
  buildCourse(selectedCourseId);
  initSplashIntro();
};