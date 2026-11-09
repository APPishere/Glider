let multiplayerActive = false;
let isMultiplayerHost = false;
let mpPeer = null;
let mpHostConn = null;
let mpConnections = {};
let mpRoomCode = '';
let mpLocalReady = false;
let mpPlayers = {};
let mpSlotIndex = 0;
let mpSendTimer = 0;
let mpRemoteDrones = {};
let mpRemoteTargets = {};
let mpLeaderboard = [];
let mpPfpImageCache = {};
const _mpProjVec = new THREE.Vector3();

const MP_SEND_INTERVAL = 0.05;
const MP_MAX_PLAYERS = 5;
const MP_ROOM_PREFIX = 'aphelion-glider-';

let mpCreateRetryCount = 0;
let mpGpMode = false;
let mpGpCupId = null;
let mpUseTurn = false;
let mpIsDedicatedServer = false;
let mpServerActive = false;
let mpBannedPeerIds = new Set();
let mpIsSpectating = false;
let mpFinishedRacers = new Set();
let mpDnfTimer = 0;
let mpDnfTimerActive = false;
let mpRaceOver = false;
let mpGpRaceIndex = 0;
let mpGpRaces = [];
let mpGpPoints = {};
let mpPlayerWins = {};
let mpRaceInProgress = false;
let mpTacticalOverlayOpen = false;
let mpLoadingTimers = [];
let mpPlayerPings = {};

setInterval(() => {
  if (!multiplayerActive || document.hidden) return;
  const now = performance.now();
  if (isMultiplayerHost) {
    if (mpPeer) mpPlayerPings[mpPeer.id] = 0;
    for (const peerId in mpConnections) {
      const conn = mpConnections[peerId];
      if (conn && conn.open) {
        conn.send({ type: 'PING', t: now });
      }
    }
  } else if (mpHostConn && mpHostConn.open) {
    mpHostConn.send({ type: 'PING', t: now });
  }
}, 1500);

let mpModifiers = {
  disableYaw: false,
  disableAirbrake: false,
  disablePitchUp: false,
  disableRudderBoost: false,
  hideHUD: false,
  hideThermalVisuals: false
};
let mpTempModifiers = {
  disableYaw: false,
  disableAirbrake: false,
  disablePitchUp: false,
  disableRudderBoost: false,
  hideHUD: false,
  hideThermalVisuals: false
};

function cancelActiveDailyChallenge() {
  if (typeof challengeActive !== 'undefined') challengeActive = null;
  if (typeof challengeMod !== 'undefined') {
    challengeMod = (typeof multiplayerActive !== 'undefined' && multiplayerActive && typeof mpModifiers !== 'undefined' && mpModifiers && Object.values(mpModifiers).some(Boolean)) ? Object.assign({}, mpModifiers) : null;
  }
  if (typeof challengeActiveDateKey !== 'undefined') challengeActiveDateKey = null;
  if (typeof challengeActiveDayOffset !== 'undefined') challengeActiveDayOffset = 0;
}

function getActiveModNames(mods) {
  if (!mods) return [];
  const names = [];
  if (mods.disableYaw) names.push('NO YAW');
  if (mods.disableAirbrake) names.push('NO BRAKE');
  if (mods.disablePitchUp) names.push('NO PITCH UP');
  if (mods.disableRudderBoost) names.push('NO BOOST');
  if (mods.hideHUD) names.push('NO HUD');
  if (mods.hideThermalVisuals) names.push('NO THERMALS');
  return names;
}

function clearMpLoadingTimers() {
  mpLoadingTimers.forEach(t => clearTimeout(t));
  mpLoadingTimers = [];
}

function recordMpBanOrKick() {
  try {
    const now = Date.now();
    let sheet = JSON.parse(localStorage.getItem('glider_mp_rap_sheet') || '[]');
    sheet = sheet.filter(t => typeof t === 'number' && (now - t) < 10 * 60 * 1000);
    sheet.push(now);
    localStorage.setItem('glider_mp_rap_sheet', JSON.stringify(sheet));
    if (sheet.length >= 3) {
      localStorage.setItem('glider_mp_suspension_until', String(now + 12 * 60 * 60 * 1000));
    }
  } catch (e) {}
}

function checkMpSuspension() {
  try {
    const until = parseInt(localStorage.getItem('glider_mp_suspension_until') || '0', 10);
    const now = Date.now();
    if (until > now) {
      const remainingHours = Math.max(1, Math.ceil((until - now) / (60 * 60 * 1000)));
      const msg = 'MULTIPLAYER SUSPENDED: You have been banned from too many lobbies recently. Try again in ' + remainingHours + ' hours.';
      showHostDisconnectModal('MULTIPLAYER SUSPENDED', msg);
      setMultiplayerStatus('MULTIPLAYER SUSPENDED');
      return true;
    }
  } catch (e) {}
  return false;
}

const MP_BANNERS = [
  { id: 'default', name: 'DEFAULT', src: 'gliderdefaultbanner.png', color: '#00f0ff' },
  { id: 'block', name: 'BLOCK', src: 'blockBanner.png', color: '#f1c40f' },
  { id: 'piggy', name: 'CASH GRAB', src: 'pigbanner.png', color: '#ffa0b8' },
  { id: 'moon', name: 'LUNAR SURFACE', src: 'moonbanner.png', color: '#888888' },
  { id: 'fish', name: 'FISH', src: 'fishbanner.png', color: '#EE844C' },
  { id: 'akane_banner', name: 'AKANE BANNER', src: 'akane.png', color: '#14098b' },
  { id: 'aphelion_apex_banner', name: 'APHELION APEX', src: 'aphelionapexname.png', color: '#a020f0', devOnly: true },
  { id: 'dev_tools_banner', name: 'DEV TOOLS', src: 'devtoolsonly.png', color: '#ff4444', devOnly: true }
];

const MP_PFPS = [
  { id: 'default', name: 'NO PFP', src: 'nopfpequiped.png' },
  { id: 'boat', name: 'BOAT', src: 'boatPFP.png' },
  { id: 'glider_rgba', name: 'GLIDER RGBA', src: 'gliderPFPrga.png', hasColorPicker: true },
  { id: 'emptypfp', name: 'EMPTY PFP', src: 'emptypfp.png' },
  { id: 'kraken', name: 'KRAKEN', src: 'krakenPFP.png' },
  { id: 'waves', name: 'WAVES', src: 'wavesPFP.png' },
  { id: 'gliderInAir_rgba', name: 'GLIDER IN AIR', src: 'gliderinair.png', hasColorPicker: true },
  { id: 'susguy', name: 'SUS GUY', src: 'susguyPFP.png' },
  { id: 'meatycrimson', name: 'MEATY CRIMSON', src: 'MeatyCrismson.png' },
  { id: 'mobile_port', name: 'MOBILE PORT', src: 'mobilePortPFP.png' },
  { id: 'deterious_mind', name: 'DETERIOUS MIND', src: 'deterious mind.png' },
  { id: 'big_blue_heart', name: 'BIG BLUE HEART', src: 'bigblueheart.png' },
  { id: 'akane_pfp', name: 'AKANE PFP', src: 'akanePFP.png' },
  { id: 'tristar', name: 'TRISTAR', src: 'TriStar.png' },
  { id: 'artist1', name: 'ARTIST 1', src: 'artistpfp1.png', devOnly: true },
  { id: 'artist2', name: 'ARTIST 2', src: 'artistpfp2.png', devOnly: true },
  { id: 'apex_logo', name: 'APEX LOGO', src: 'aphelionapexlogo.png', devOnly: true },
  { id: 'End', name: 'End', src: 'thatsallfools.png' },
];

function isDevToolsActive() {
  return (typeof impossibleDifficultyUnlocked !== 'undefined' && impossibleDifficultyUnlocked) ||
         localStorage.getItem('glider_achieve_devtools') === 'true';
}

function sanitizeMpProfile(p) {
  p = (p && typeof p === 'object') ? p : {};
  const name = String(p.name || 'PILOT').replace(/[^a-zA-Z0-9_ -]/g, '').trim().substring(0, 16) || 'PILOT';
  const pDef = MP_PFPS.find(x => x.src === p.pfp);
  const bDef = MP_BANNERS.find(x => x.id === p.banner);
  return {
    name,
    pfp: pDef ? pDef.src : 'nopfpequiped.png',
    banner: bDef ? bDef.id : 'default',
    pfpColor: /^#[0-9a-fA-F]{6}$/.test(p.pfpColor) ? p.pfpColor : '#00f0ff'
  };
}

function getLocalProfile() {
  const name = (localStorage.getItem('glider_profile_name') || 'PILOT').replace(/[^a-zA-Z0-9_ -]/g, '').trim().substring(0, 16) || 'PILOT';
  let pfp = localStorage.getItem('glider_profile_pfp') || 'nopfpequiped.png';
  let banner = localStorage.getItem('glider_profile_banner') || 'default';
  const pfpColor = localStorage.getItem('glider_profile_pfp_color') || '#00f0ff';
  const bDef = MP_BANNERS.find(b => b.id === banner);
  if (!bDef || (bDef.devOnly && !isDevToolsActive())) banner = 'default';
  const pDef = MP_PFPS.find(p => p.src === pfp);
  if (!pDef || (pDef.devOnly && !isDevToolsActive())) pfp = 'nopfpequiped.png';
  return { name, pfp, banner, pfpColor };
}

function saveLocalProfile(name, pfp, banner, pfpColor) {
  const cleanName = String(name || 'PILOT').replace(/[^a-zA-Z0-9_ -]/g, '').trim().substring(0, 16) || 'PILOT';
  localStorage.setItem('glider_profile_name', cleanName);
  localStorage.setItem('glider_profile_pfp', pfp || 'nopfpequiped.png');
  localStorage.setItem('glider_profile_banner', banner || 'default');
  if (pfpColor) {
    localStorage.setItem('glider_profile_pfp_color', pfpColor);
  }
  
  updateProfileCardElements();
  renderDashboardMultiplayerCustomizer();

  if (multiplayerActive && mpPeer && !mpPeer.destroyed) {
    if (mpPlayers[mpPeer.id]) {
      mpPlayers[mpPeer.id].profile = getLocalProfile();
    }
    renderMultiplayerLobby();

    if (isMultiplayerHost) {
      broadcastRoomState();
    } else if (mpHostConn && mpHostConn.open) {
      mpHostConn.send({
        type: 'PROFILE_UPDATE',
        profile: getLocalProfile()
      });
    }
  }
}

function updateProfileCardElements() {
  const prof = getLocalProfile();
  const bannerDef = MP_BANNERS.find(b => b.id === prof.banner) || MP_BANNERS[0];
  const pfpSrc = prof.pfp || 'nopfpequiped.png';

  document.querySelectorAll('.mp-profile-card').forEach(card => {
    card.style.backgroundImage = 'url(' + bannerDef.src + ')';
    card.style.backgroundSize = '100% 100%';
    card.style.backgroundPosition = 'center';
    card.style.backgroundRepeat = 'no-repeat';
    card.style.border = 'none';
    card.style.aspectRatio = '512 / 128';
    const nameEl = card.querySelector('.mp-profile-name');
    if (nameEl) nameEl.innerText = prof.name;
    const pfpEl = card.querySelector('.mp-profile-pfp-img');
    if (pfpEl) {
      pfpEl.src = pfpSrc;
      const pfpDef = MP_PFPS.find(p => p.src === pfpSrc);
      if (pfpDef && pfpDef.hasColorPicker) {
        pfpEl.style.backgroundColor = prof.pfpColor || '#00f0ff';
      } else {
        pfpEl.style.backgroundColor = 'transparent';
      }
    }
  });

  if (typeof updateProfileCardVisibility === 'function') {
    updateProfileCardVisibility();
  }
}

let profileEditCurrentColor = '#00F0FF';
let profileEditCurrentPfp = 'nopfpequiped.png';
let profileEditCurrentBanner = 'default';

function openProfileEditModal() {
  const modal = document.getElementById('profile-edit-modal');
  if (!modal) return;
  const prof = getLocalProfile();
  profileEditCurrentColor = prof.pfpColor || '#00F0FF';
  profileEditCurrentPfp = prof.pfp || 'nopfpequiped.png';
  profileEditCurrentBanner = prof.banner || 'default';

  const inputName = document.getElementById('profile-edit-name-input');
  if (inputName) inputName.value = prof.name;

  const colorWrap = document.getElementById('profile-pfp-color-wrap');
  const colorPicker = document.getElementById('profile-pfp-color-picker');
  const hexInput = document.getElementById('profile-pfp-hex-input');

  if (colorPicker) colorPicker.value = profileEditCurrentColor;
  if (hexInput) hexInput.value = profileEditCurrentColor.toUpperCase();

  const syncColor = (col) => {
    profileEditCurrentColor = col;
    if (colorPicker) colorPicker.value = col;
    if (hexInput) hexInput.value = col.toUpperCase();
    const activePfpImg = document.querySelector('#profile-edit-pfp-list .mp-pfp-opt.active img');
    const pfpDef = MP_PFPS.find(p => p.src === profileEditCurrentPfp);
    if (activePfpImg && pfpDef && pfpDef.hasColorPicker) {
      activePfpImg.style.backgroundColor = col;
    }
  };

  if (colorPicker) {
    colorPicker.oninput = (e) => syncColor(e.target.value);
  }
  if (hexInput) {
    hexInput.oninput = (e) => {
      let val = e.target.value.trim();
      if (!val.startsWith('#')) val = '#' + val;
      if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
        syncColor(val);
      }
    };
  }

  const pfpWrap = document.getElementById('profile-edit-pfp-list');
  if (pfpWrap) {
    pfpWrap.innerHTML = '';
    const visiblePfps = MP_PFPS.filter(p => !p.devOnly || isDevToolsActive());
    visiblePfps.forEach(p => {
      const isSel = (p.src === profileEditCurrentPfp);
      const item = document.createElement('div');
      item.className = 'mp-pfp-opt ' + (isSel ? 'active' : '');
      item.style.cssText = 'width: 48px; height: 48px; border-radius: 6px; border: 2px solid ' + (isSel ? 'var(--cyan)' : 'var(--mono-20)') + '; padding: 2px; cursor: pointer; transition: all 0.15s ease; display: flex; align-items: center; justify-content: center; box-shadow: ' + (isSel ? '0 0 10px rgba(0, 240, 255, 0.6)' : 'none') + '; background: rgba(0,0,0,0.5);';

      const img = document.createElement('img');
      img.src = p.src;
      img.alt = p.name;
      img.style.cssText = 'width: 100%; height: 100%; object-fit: contain; border-radius: 4px; display: block;';
      if (p.hasColorPicker) {
        img.style.backgroundColor = isSel ? profileEditCurrentColor : (prof.pfpColor || '#00f0ff');
      }

      item.appendChild(img);

      item.setAttribute('data-src', p.src);

      item.onclick = () => {
        pfpWrap.querySelectorAll('.mp-pfp-opt').forEach(el => {
          el.classList.remove('active');
          el.style.borderColor = 'var(--mono-20)';
          el.style.boxShadow = 'none';
          
          const innerImg = el.querySelector('img');
          if (innerImg) {
            const elSrc = el.getAttribute('data-src');
            const elDef = MP_PFPS.find(dp => dp.src === elSrc);
            
            if (elDef && elDef.hasColorPicker) {
              innerImg.style.backgroundColor = prof.pfpColor || '#00f0ff';
            } else {
              innerImg.style.backgroundColor = 'transparent';
            }
          }
        });
        
        item.classList.add('active');
        item.style.borderColor = 'var(--cyan)';
        item.style.boxShadow = '0 0 10px rgba(0, 240, 255, 0.6)';
        profileEditCurrentPfp = p.src;
        
        if (p.hasColorPicker) {
          img.style.backgroundColor = profileEditCurrentColor;
          if (colorWrap) colorWrap.style.display = 'flex';
        } else {
          if (colorWrap) colorWrap.style.display = 'none';
        }
      };

      pfpWrap.appendChild(item);
    });

  if (colorWrap) {
      const pfpDef = MP_PFPS.find(p => p.src === profileEditCurrentPfp);
      colorWrap.style.display = (pfpDef && pfpDef.hasColorPicker) ? 'flex' : 'none';
    }
  }

  const bannerWrap = document.getElementById('profile-edit-banner-list');
  if (bannerWrap) {
    bannerWrap.innerHTML = '';
    const visibleBanners = MP_BANNERS.filter(b => !b.devOnly || isDevToolsActive());
    visibleBanners.forEach(b => {
      const isSel = (b.id === profileEditCurrentBanner);
      const item = document.createElement('div');
      item.className = 'mp-banner-opt ' + (isSel ? 'active' : '');
      item.style.cssText = 'position: relative; width: 100%; aspect-ratio: 512 / 128; max-height: 64px; flex-shrink: 0; border: 2px solid ' + (isSel ? 'var(--cyan)' : 'var(--mono-20)') + '; border-radius: 4px; overflow: hidden; cursor: pointer; transition: all 0.15s ease; background-size: cover; background-position: center; background-image: url(' + b.src + '); box-shadow: ' + (isSel ? '0 0 12px rgba(0, 240, 255, 0.5)' : 'none') + ';';

      item.onclick = () => {
        bannerWrap.querySelectorAll('.mp-banner-opt').forEach(el => {
          el.classList.remove('active');
          el.style.borderColor = 'var(--mono-20)';
          el.style.boxShadow = 'none';
        });
        item.classList.add('active');
        item.style.borderColor = 'var(--cyan)';
        item.style.boxShadow = '0 0 12px rgba(0, 240, 255, 0.5)';
        profileEditCurrentBanner = b.id;
      };

      bannerWrap.appendChild(item);
    });
  }

  modal.style.display = 'flex';
}

function closeProfileEditModal(save = false) {
  const modal = document.getElementById('profile-edit-modal');
  if (save) {
    const inputName = document.getElementById('profile-edit-name-input');
    const name = (inputName ? inputName.value : 'PILOT').replace(/[^a-zA-Z0-9_ -]/g, '').trim().substring(0, 16) || 'PILOT';
    saveLocalProfile(name, profileEditCurrentPfp, profileEditCurrentBanner, profileEditCurrentColor);
  }
  if (modal) modal.style.display = 'none';
}

function generateRoomCode() {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let s = '';
  for (let i = 0; i < 4; i++) {
    s += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return s;
}

function initPeerInstance(peerId, onSuccess, onError, useTurn = false) {
  if (typeof Peer === 'undefined') {
    if (onError) onError('PeerJS library not loaded');
    return null;
  }
  if (mpPeer && !mpPeer.destroyed) {
    try { mpPeer.destroy(); } catch (e) {}
  }
  const peerConfig = useTurn ? {
    debug: 0,
    config: {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun.relay.metered.ca:80' },
        { urls: 'turn:openrelay.metered.ca:80', username: 'openrelayproject', credential: 'openrelayproject' },
        { urls: 'turn:openrelay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject' },
        { urls: 'turn:openrelay.metered.ca:443?transport=tcp', username: 'openrelayproject', credential: 'openrelayproject' }
      ]
    }
  } : { debug: 0 };
  const p = peerId ? new Peer(peerId, peerConfig) : new Peer(peerConfig);
  p.on('open', id => {
    if (onSuccess) onSuccess(id);
  });
  p.on('error', err => {
    if (onError) onError(err);
  });
  return p;
}

function showMobileHostWarning() {
  let modal = document.getElementById('mp-mobile-host-warning-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'mp-mobile-host-warning-modal';
    modal.style.cssText = 'position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: var(--mono-bg); border: 1.5px solid var(--gold); box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.88), 0 10px 30px rgba(0, 0, 0, 0.9); padding: 22px 26px; text-align: center; z-index: 710; border-radius: 4px; max-width: 90vw; width: 420px; display: none; flex-direction: column; align-items: center; gap: 14px;';
    document.body.appendChild(modal);
  }

  const renderStep1 = () => {
    modal.innerHTML = `
      <div class="tutorial-card-title" style="font-size: 16px; color: var(--gold); text-shadow: 0 0 10px rgba(241, 196, 15, 0.5);">HOSTING NOTICE</div>
      <div style="font-size: 11px; letter-spacing: 1.2px; color: var(--mono-90); text-transform: uppercase; text-align: center; line-height: 1.5;">
        HOSTING A GAME ON MOBILE IS NOT RECOMMENDED, HOWEVER YOU MAY STILL HOST ONE IF YOU CHOOSE TO.
      </div>
      <div style="display: flex; flex-direction: column; gap: 8px; width: 100%; margin-top: 6px;">
        <button class="mono-btn btn-warn-turn" style="border-color: var(--cyan); color: var(--cyan); font-weight: 800; padding: 10px;">USE TURN SERVER</button>
        <button class="mono-btn btn-warn-anyway" style="border-color: var(--gold); color: var(--gold); font-weight: 800; padding: 10px;">START ANYWAY</button>
        <button class="mono-btn btn-warn-close" style="padding: 9px;">CLOSE</button>
      </div>
    `;
    modal.querySelector('.btn-warn-close').onclick = () => { modal.style.display = 'none'; };
    modal.querySelector('.btn-warn-anyway').onclick = () => {
      modal.style.display = 'none';
      createMultiplayerRoom(false);
    };
    modal.querySelector('.btn-warn-turn').onclick = () => {
      renderStep2();
    };
  };

  const renderStep2 = () => {
    modal.innerHTML = `
      <div class="tutorial-card-title" style="font-size: 15px; color: var(--cyan); text-shadow: 0 0 10px rgba(0, 240, 255, 0.5);">TURN SERVER CONFIRMATION</div>
      <div style="font-size: 11px; letter-spacing: 1.2px; color: var(--mono-90); text-transform: uppercase; text-align: center; line-height: 1.5;">
        UNDERSTAND THAT TURN SERVERS BEING USED ARE FREE AND ARE NOT GUARANTEED IT WILL STAY UP FOREVER.
      </div>
      <div style="display: flex; gap: 10px; width: 100%; margin-top: 6px;">
        <button class="mono-btn btn-turn-back" style="flex: 1; padding: 10px;">BACK</button>
        <button class="mono-btn btn-turn-start" style="flex: 1.3; border-color: var(--cyan); color: var(--cyan); font-weight: 800; padding: 10px;">START ANYWAY</button>
      </div>
    `;
    modal.querySelector('.btn-turn-back').onclick = () => { renderStep1(); };
    modal.querySelector('.btn-turn-start').onclick = () => {
      modal.style.display = 'none';
      createMultiplayerRoom(true);
    };
  };

  renderStep1();
  modal.style.display = 'flex';
}

function toggleDedicatedServer() {
  if (!isMultiplayerHost || !mpPeer) return;
  const hostId = mpPeer.id;
  const nonHostPlayers = Object.values(mpPlayers).filter(p => p.id !== hostId);

  if (!mpIsDedicatedServer) {
    mpIsDedicatedServer = true;
    mpServerActive = true;
    mpPlayers[hostId] = {
      id: hostId,
      slot: -1,
      profile: getLocalProfile(),
      droneSkinId: getEquippedGhostSkinId(),
      ready: true,
      isHost: true,
      isDedicatedServer: true
    };
    let slotNum = 0;
    for (const p of nonHostPlayers) {
      p.slot = slotNum++;
    }
  } else {
    if (nonHostPlayers.length >= MP_MAX_PLAYERS) {
      alert('Lobby full (5/5 racers). Kick a player to rejoin as racer.');
      return;
    }
    mpIsDedicatedServer = false;
    mpPlayers[hostId] = {
      id: hostId,
      slot: 0,
      profile: getLocalProfile(),
      droneSkinId: getEquippedGhostSkinId(),
      ready: false,
      isHost: true,
      isDedicatedServer: false
    };
    let slotNum = 1;
    for (const p of nonHostPlayers) {
      p.slot = slotNum++;
    }
  }
  broadcastRoomState();
  renderMultiplayerLobby();
}

function createMultiplayerRoom(useTurn = false) {
  if (checkMpSuspension()) return;
  cancelActiveDailyChallenge();
  setMultiplayerStatus('CREATING ROOM...');
  mpUseTurn = useTurn;
  const code = generateRoomCode();
  const peerId = MP_ROOM_PREFIX + code;

  mpPeer = initPeerInstance(peerId, id => {
    mpCreateRetryCount = 0;
    isMultiplayerHost = true;
    multiplayerActive = true;
    mpRoomCode = code;
    mpLocalReady = false;
    mpConnections = {};
    mpPlayers = {};
    mpSlotIndex = 0;
    mpIsDedicatedServer = false;

    mpPlayers[id] = {
      id: id,
      slot: 0,
      profile: getLocalProfile(),
      droneSkinId: getEquippedGhostSkinId(),
      gliderSkinId: typeof getEquippedSkinId === 'function' ? getEquippedSkinId() : (localStorage.getItem('glider_equipped_skin') || 'default'),
      ready: false,
      isHost: true,
      isDedicatedServer: false
    };

    mpPeer.on('connection', conn => {
      handleHostIncomingConnection(conn);
    });

    renderMultiplayerLobby();
    setMultiplayerStatus('ROOM READY');
    if (!isMobileDevice() && typeof openDashboardRight === 'function') {
      openDashboardRight('multiplayer');
    }
  }, err => {
    if (err && err.type === 'unavailable-id' && mpCreateRetryCount < 3) {
      mpCreateRetryCount++;
      setTimeout(() => createMultiplayerRoom(useTurn), 500);
    } else {
      mpCreateRetryCount = 0;
      setMultiplayerStatus('CREATE FAILED');
    }
  }, useTurn);
}

function handleHostIncomingConnection(conn) {
  if (mpBannedPeerIds.has(conn.peer)) {
    conn.on('open', () => {
      conn.send({ type: 'REJECT', reason: 'YOU ARE BANNED FROM THIS ROOM' });
      setTimeout(() => conn.close(), 200);
    });
    return;
  }
  const nonServerPlayers = Object.values(mpPlayers).filter(p => !p.isDedicatedServer);
  if (nonServerPlayers.length >= MP_MAX_PLAYERS) {
    conn.on('open', () => {
      conn.send({ type: 'REJECT', reason: 'ROOM FULL (MAX 5)' });
      setTimeout(() => conn.close(), 200);
    });
    return;
  }

  mpConnections[conn.peer] = conn;

  conn.on('data', data => {
    handleHostReceivedData(conn.peer, data);
  });

  conn.on('close', () => {
    handlePlayerDisconnected(conn.peer);
  });

  conn.on('error', () => {
    handlePlayerDisconnected(conn.peer);
  });
}

function checkAllRacersFinished() {
  if (!isMultiplayerHost || mpRaceOver) return;
  const activeRacers = Object.values(mpPlayers).filter(p => !p.isDedicatedServer && p.slot >= 0 && !p.isSpectator);
  if (activeRacers.length > 0 && activeRacers.every(p => mpFinishedRacers.has(p.id))) {
    hostTriggerRaceOver();
  }
}

function hostTriggerRaceOver() {
  if (mpRaceOver) return;
  mpRaceOver = true;
  mpDnfTimerActive = false;

  if (mpGpMode) {
    const ptTable = [10, 6, 4, 3, 2];
    mpLeaderboard.forEach((entry, idx) => {
      if (!entry.isDnf) {
        const pts = ptTable[idx] !== undefined ? ptTable[idx] : 0;
        mpGpPoints[entry.id] = (mpGpPoints[entry.id] || 0) + pts;
      }
    });
  }

  if (mpLeaderboard.length > 0 && !mpLeaderboard[0].isDnf) {
    const winnerId = mpLeaderboard[0].id;
    mpPlayerWins[winnerId] = (mpPlayerWins[winnerId] || 0) + 1;
  }

  relayPacketToClients({
    type: 'MP_RACE_OVER',
    leaderboard: mpLeaderboard,
    gpPoints: mpGpPoints,
    gpRaceIndex: mpGpRaceIndex,
    gpTotalRaces: mpGpRaces ? mpGpRaces.length : 0,
    isGp: !!mpGpMode,
    playerWins: mpPlayerWins
  });
  showMultiplayerResultsScreen(mpLeaderboard);
}

function hostReturnAllToLobby() {
  relayPacketToClients({ type: 'RETURN_TO_LOBBY' });
  returnToMultiplayerLobby();
}

function handleHostReceivedData(peerId, data) {
  if (!data || !data.type) return;

  if (data.type === 'JOIN') {
    if (mpBannedPeerIds.has(peerId)) {
      const conn = mpConnections[peerId];
      if (conn && conn.open) {
        conn.send({ type: 'REJECT', reason: 'YOU ARE BANNED FROM THIS ROOM' });
        setTimeout(() => conn.close(), 200);
      }
      return;
    }
    const nonServerPlayers = Object.values(mpPlayers).filter(p => !p.isDedicatedServer);
    if (nonServerPlayers.length >= MP_MAX_PLAYERS) {
      const conn = mpConnections[peerId];
      if (conn && conn.open) {
        conn.send({ type: 'REJECT', reason: 'ROOM FULL (MAX 5)' });
        setTimeout(() => conn.close(), 200);
      }
      return;
    }
    if (mpRaceInProgress) {
      mpPlayers[peerId] = {
        id: peerId,
        slot: -1,
        profile: sanitizeMpProfile(data.profile),
        droneSkinId: data.droneSkinId || 'ghost_default',
        gliderSkinId: data.gliderSkinId || 'default',
        ready: false,
        isHost: false,
        isDedicatedServer: false,
        isSpectator: true
      };
      broadcastRoomState();
      const conn = mpConnections[peerId];
      if (conn && conn.open) {
        conn.send({
          type: 'START_RACE',
          courseId: selectedCourseId,
          subtrack: selectedSubtrack,
          isGp: !!mpGpMode,
          gpCupId: mpGpCupId || null,
          gpRaceIndex: mpGpRaceIndex,
          gpRaces: mpGpRaces,
          modifiers: mpModifiers,
          startIn: 0,
          spectate: true
        });
      }
      if (mpTacticalOverlayOpen) {
        renderMatchOverview();
      }
      return;
    }
    const slot = nonServerPlayers.length;
    mpPlayers[peerId] = {
      id: peerId,
      slot: slot,
      profile: sanitizeMpProfile(data.profile),
      droneSkinId: data.droneSkinId || 'ghost_default',
      gliderSkinId: data.gliderSkinId || 'default',
      ready: false,
      isHost: false,
      isDedicatedServer: false,
      isSpectator: false
    };
    broadcastRoomState();
    renderMultiplayerLobby();
  } else if (data.type === 'READY_TOGGLE') {
    if (mpPlayers[peerId]) {
      mpPlayers[peerId].ready = !!data.ready;
      broadcastRoomState();
      renderMultiplayerLobby();
    }
  } else if (data.type === 'DRONE_UPDATE') {
    if (mpPlayers[peerId]) {
      mpPlayers[peerId].droneSkinId = data.droneSkinId;
      broadcastRoomState();
      renderMultiplayerLobby();
    }
  } else if (data.type === 'GLIDER_UPDATE') {
    if (mpPlayers[peerId]) {
      mpPlayers[peerId].gliderSkinId = data.gliderSkinId || 'default';
      broadcastRoomState();
      renderMultiplayerLobby();
    }
  } else if (data.type === 'PROFILE_UPDATE') {
    if (mpPlayers[peerId]) {
      mpPlayers[peerId].profile = sanitizeMpProfile(data.profile);
      broadcastRoomState();
      renderMultiplayerLobby();
    }
  } else if (data.type === 'PING') {
    const conn = mpConnections[peerId];
    if (conn && conn.open) {
      conn.send({ type: 'PONG', t: data.t, pings: mpPlayerPings });
    }
  } else if (data.type === 'PONG') {
    const rtt = Math.max(1, Math.round(performance.now() - data.t));
    mpPlayerPings[peerId] = rtt;
    if (mpTacticalOverlayOpen) {
      renderMatchOverview();
    }
  } else if (data.type === 'F') {
    relayFlightData(peerId, data);
  } else if (data.type === 'GATE') {
    data.id = peerId;
    relayPacketToClients(data);
  } else if (data.type === 'FINISH') {
    data.id = peerId;
    if (!Number.isFinite(data.time) || data.time <= 0) return;
    relayPacketToClients(data);
    updateMultiplayerLeaderboard(data);
    mpFinishedRacers.add(peerId);
    if (!mpDnfTimerActive) {
      mpDnfTimerActive = true;
      mpDnfTimer = 60.0;
    }
    checkAllRacersFinished();
  } else if (data.type === 'REQUEST_RETURN_TO_LOBBY') {
    if (mpIsDedicatedServer) {
      hostReturnAllToLobby();
    }
  } else if (data.type === 'REQUEST_NEXT_GP_RACE') {
    if (mpIsDedicatedServer) {
      hostStartNextGpRace();
    }
  }
}

function handlePlayerKickedOrBanned(peerId, isBan) {
  if (mpRaceInProgress && !mpFinishedRacers.has(peerId)) {
    mpFinishedRacers.add(peerId);
    updateMultiplayerLeaderboard({ id: peerId, time: 9999, isDnf: true, type: 'DNF' });
    relayPacketToClients({ id: peerId, type: 'FINISH', time: 9999, isDnf: true });
    checkAllRacersFinished();
  }
  if (mpRemoteDrones[peerId] && environmentGroup) {
    environmentGroup.remove(mpRemoteDrones[peerId]);
  }
  delete mpConnections[peerId];
  delete mpPlayers[peerId];
  delete mpRemoteDrones[peerId];
  delete mpRemoteTargets[peerId];
  delete mpLastPacketTime[peerId];

  if (!mpRaceInProgress) {
    let newSlot = mpIsDedicatedServer ? 0 : 1;
    for (const id in mpPlayers) {
      if (!mpPlayers[id].isHost && !mpPlayers[id].isDedicatedServer) {
        mpPlayers[id].slot = newSlot++;
      }
    }
  }

  broadcastRoomState();
  renderMultiplayerLobby();
  if (mpTacticalOverlayOpen) {
    renderMatchOverview();
  }
}

function kickPlayer(peerId) {
  if (!isMultiplayerHost || !mpPlayers[peerId] || mpPlayers[peerId].isHost) return;
  const conn = mpConnections[peerId];
  if (conn && conn.open) {
    conn.send({ type: 'KICK', reason: 'YOU WERE KICKED BY THE HOST' });
    setTimeout(() => {
      try { conn.close(); } catch (e) {}
    }, 100);
  }
  handlePlayerKickedOrBanned(peerId, false);
}
window.kickPlayer = kickPlayer;

function banPlayer(peerId) {
  if (!isMultiplayerHost || !mpPlayers[peerId] || mpPlayers[peerId].isHost) return;
  mpBannedPeerIds.add(peerId);
  const conn = mpConnections[peerId];
  if (conn && conn.open) {
    conn.send({ type: 'KICK', reason: 'YOU HAVE BEEN BANNED FROM THIS ROOM' });
    setTimeout(() => {
      try { conn.close(); } catch (e) {}
    }, 100);
  }
  handlePlayerKickedOrBanned(peerId, true);
}
window.banPlayer = banPlayer;

function handlePlayerDisconnected(peerId) {
  if (mpRaceInProgress && !mpFinishedRacers.has(peerId)) {
    mpFinishedRacers.add(peerId);
    updateMultiplayerLeaderboard({ id: peerId, time: 9999, isDnf: true, type: 'DNF' });
    checkAllRacersFinished();
  }
  if (mpRemoteDrones[peerId] && environmentGroup) {
    environmentGroup.remove(mpRemoteDrones[peerId]);
  }
  delete mpConnections[peerId];
  delete mpPlayers[peerId];
  delete mpRemoteDrones[peerId];
  delete mpRemoteTargets[peerId];
  delete mpLastPacketTime[peerId];
  if (!mpRaceInProgress) {
    let newSlot = mpIsDedicatedServer ? 0 : 1;
    for (const id in mpPlayers) {
      if (!mpPlayers[id].isHost && !mpPlayers[id].isDedicatedServer) {
        mpPlayers[id].slot = newSlot++;
      }
    }
  }
  broadcastRoomState();
  renderMultiplayerLobby();
  if (mpTacticalOverlayOpen) {
    renderMatchOverview();
  }
}

function broadcastRoomState() {
  const statePacket = {
    type: 'ROOM_STATE',
    code: mpRoomCode,
    players: mpPlayers,
    courseId: selectedCourseId,
    subtrack: selectedSubtrack,
    serverActive: mpIsDedicatedServer,
    isGp: !!mpGpMode,
    gpCupId: mpGpCupId,
    gpRaceIndex: mpGpRaceIndex,
    raceInProgress: mpRaceInProgress,
    modifiers: mpModifiers
  };
  relayPacketToClients(statePacket);
}

function relayPacketToClients(packet, excludePeerId = null) {
  for (const peerId in mpConnections) {
    if (peerId !== excludePeerId) {
      const conn = mpConnections[peerId];
      if (conn && conn.open) {
        conn.send(packet);
      }
    }
  }
}
let mpLastPacketTime = {};

function relayFlightData(senderPeerId, packet) {
  const now = performance.now();
  
  if (!mpLastPacketTime[senderPeerId]) mpLastPacketTime[senderPeerId] = 0;
  if (now - mpLastPacketTime[senderPeerId] < 33) {
    return; 
  }
  mpLastPacketTime[senderPeerId] = now;
  packet.id = senderPeerId;
  for (const peerId in mpConnections) {
    if (peerId !== senderPeerId) {
      const conn = mpConnections[peerId];
      if (conn && conn.open) {
        conn.send(packet);
      }
    }
  }
  handleRemoteFlightPacket(packet);
}

function joinMultiplayerRoom(rawCode) {
  if (checkMpSuspension()) return;
  const code = (rawCode || '').trim().toUpperCase();
  if (code.length !== 4) {
    setMultiplayerStatus('CODE MUST BE 4 CHARACTERS');
    return;
  }

  document.querySelectorAll('.mp-join-code-input').forEach(inp => { inp.value = ''; });
  const dtInp = document.getElementById('mp-join-input-dt');
  if (dtInp) dtInp.value = '';
  const mobInp = document.getElementById('mp-join-input-mob');
  if (mobInp) mobInp.value = '';

  setMultiplayerStatus('JOINING ROOM ' + code + '...');
  const hostPeerId = MP_ROOM_PREFIX + code;

  mpPeer = initPeerInstance(null, id => {
    isMultiplayerHost = false;
    multiplayerActive = true;
    mpRoomCode = code;
    mpLocalReady = false;

    mpHostConn = mpPeer.connect(hostPeerId, { reliable: true });

    mpHostConn.on('open', () => {
      cancelActiveDailyChallenge();
      setMultiplayerStatus('CONNECTED');
      mpHostConn.send({
        type: 'JOIN',
        profile: getLocalProfile(),
        droneSkinId: getEquippedGhostSkinId(),
        gliderSkinId: typeof getEquippedSkinId === 'function' ? getEquippedSkinId() : (localStorage.getItem('glider_equipped_skin') || 'default')
      });
      if (!isMobileDevice()) {
        if (typeof setDashboardCategory === 'function' && currentDashboardCat !== 'multiplayer') {
          setDashboardCategory('multiplayer');
        }
        if (typeof openDashboardRight === 'function') {
          openDashboardRight('multiplayer');
        }
      } else {
        if (typeof showScreen === 'function') {
          showScreen('screen-multiplayer');
        }
      }
    });

    mpHostConn.on('data', data => {
      handleClientReceivedData(data);
    });

    mpHostConn.on('close', () => {
      showHostDisconnectModal('HOST DISCONNECTED', 'HOST DISCONNECTED, POSSIBLY DUE TO CONNECTION ISSUES.');
    });

    mpHostConn.on('error', () => {
      showHostDisconnectModal('CONNECTION ERROR', 'FAILED TO COMMUNICATE WITH THE HOST.');
    });
  }, err => {
    setMultiplayerStatus('JOIN FAILED');
  });
}

function handleClientReceivedData(data) {
  if (!data || !data.type) return;

  if (data.type === 'ROOM_STATE') {
    mpPlayers = data.players || {};
    for (const id in mpPlayers) {
      if (mpPlayers[id]) mpPlayers[id].profile = sanitizeMpProfile(mpPlayers[id].profile);
    }
    mpRoomCode = data.code || mpRoomCode;
    mpServerActive = !!data.serverActive;
    if (data.courseId) selectedCourseId = data.courseId;
    if (data.subtrack) selectedSubtrack = data.subtrack;
    if (data.modifiers) mpModifiers = Object.assign({}, data.modifiers);
    if (mpPlayers[mpPeer.id]) {
      mpSlotIndex = mpPlayers[mpPeer.id].slot;
      mpLocalReady = mpPlayers[mpPeer.id].ready;
    }
    renderMultiplayerLobby();
    if (!isMobileDevice()) {
      if (typeof setDashboardCategory === 'function' && currentDashboardCat !== 'multiplayer') {
        setDashboardCategory('multiplayer');
      }
      if (typeof openDashboardRight === 'function') {
        openDashboardRight('multiplayer');
      }
    } else {
      if (typeof showScreen === 'function') {
        showScreen('screen-multiplayer');
      }
    }
  } else if (data.type === 'START_RACE') {
    selectedCourseId = data.courseId;
    selectedSubtrack = data.subtrack;
    mpGpMode = !!data.isGp;
    mpGpCupId = data.gpCupId || null;
    mpGpRaceIndex = data.gpRaceIndex || 0;
    if (data.gpRaces) mpGpRaces = data.gpRaces;
    if (data.modifiers) {
      mpModifiers = Object.assign({}, data.modifiers);
      challengeMod = Object.assign({}, mpModifiers);
    }
    const resultsModal = document.getElementById('screen-mp-results');
    if (resultsModal) resultsModal.style.display = 'none';
    if (data.spectate) {
      mpIsSpectating = true;
      launchMultiplayerRace();
    } else {
      mpIsSpectating = false;
      launchMultiplayerRace();
    }
  } else if (data.type === 'START_COUNTDOWN') {
    clearMpLoadingTimers();
    hideMultiplayerLoadingScreen();
    finishMultiplayerCinematic();
  } else if (data.type === 'F') {
    handleRemoteFlightPacket(data);
  } else if (data.type === 'GATE') {
    if (mpPlayers[data.id]) {
      mpPlayers[data.id].gate = data.gate;
    }
  } else if (data.type === 'FINISH') {
    updateMultiplayerLeaderboard(data);
  } else if (data.type === 'MP_RACE_OVER') {
    mpRaceOver = true;
    mpLeaderboard = data.leaderboard || mpLeaderboard;
    if (data.gpPoints) mpGpPoints = data.gpPoints;
    if (data.playerWins) mpPlayerWins = data.playerWins;
    if (data.isGp !== undefined) mpGpMode = data.isGp;
    if (data.gpRaceIndex !== undefined) mpGpRaceIndex = data.gpRaceIndex;
    showMultiplayerResultsScreen(mpLeaderboard);
  } else if (data.type === 'PING') {
    if (mpHostConn && mpHostConn.open) {
      mpHostConn.send({ type: 'PONG', t: data.t });
    }
  } else if (data.type === 'PONG') {
    const rtt = Math.max(1, Math.round(performance.now() - data.t));
    if (mpPeer) mpPlayerPings[mpPeer.id] = rtt;
    if (data.pings) Object.assign(mpPlayerPings, data.pings);
    if (mpTacticalOverlayOpen) {
      renderMatchOverview();
    }
  } else if (data.type === 'RETURN_TO_LOBBY') {
    returnToMultiplayerLobby();
  } else if (data.type === 'KICK' || data.type === 'REJECT') {
    recordMpBanOrKick();
    const reason = data.reason || 'KICKED FROM ROOM';
    const isBan = reason.toUpperCase().includes('BAN');
    const title = isBan ? 'BANNED FROM ROOM' : (data.type === 'REJECT' ? 'CONNECTION REJECTED' : 'KICKED FROM ROOM');
    showHostDisconnectModal(title, reason);
  }
}

function leaveMultiplayerRoom() {
  if (mpHostConn) {
    try { mpHostConn.close(); } catch (e) {}
    mpHostConn = null;
  }
  for (const id in mpConnections) {
    try { mpConnections[id].close(); } catch (e) {}
  }
  mpConnections = {};
  if (mpPeer && !mpPeer.destroyed) {
    try { mpPeer.destroy(); } catch (e) {}
  }
  mpPeer = null;

  for (const id in mpRemoteDrones) {
    if (mpRemoteDrones[id] && environmentGroup) {
      environmentGroup.remove(mpRemoteDrones[id]);
    }
  }
  const loadOverlay = document.getElementById('mp-loading-screen');
  if (loadOverlay) loadOverlay.style.display = 'none';
  const resultsModal = document.getElementById('screen-mp-results');
  if (resultsModal) resultsModal.style.display = 'none';
  mpCinematicActive = false;
  mpRemoteDrones = {};
  mpRemoteTargets = {};
  mpPlayers = {};
  mpRoomCode = '';
  mpLocalReady = false;
  isMultiplayerHost = false;
  multiplayerActive = false;
  mpGpMode = false;
  mpGpCupId = null;
  mpIsDedicatedServer = false;
  mpServerActive = false;
  mpIsSpectating = false;
  mpFinishedRacers.clear();
  mpDnfTimerActive = false;
  mpDnfTimer = 0;
  mpRaceOver = false;
  mpRaceInProgress = false;
  mpGpRaceIndex = 0;
  mpTacticalOverlayOpen = false;
  mpPlayerPings = {};
  if (typeof challengeMod !== 'undefined') challengeMod = null;
  clearMpLoadingTimers();
  const mOver = document.getElementById('mp-match-overview-overlay');
  if (mOver) mOver.style.display = 'none';

  if (typeof closeDashboardRight === 'function') {
    closeDashboardRight();
  }
  renderMultiplayerLobby();
  setMultiplayerStatus('IDLE');
}

function toggleMultiplayerReady() {
  mpLocalReady = !mpLocalReady;
  if (isMultiplayerHost) {
    if (mpPlayers[mpPeer.id]) {
      mpPlayers[mpPeer.id].ready = mpLocalReady;
    }
    broadcastRoomState();
    renderMultiplayerLobby();
  } else if (mpHostConn && mpHostConn.open) {
    mpHostConn.send({
      type: 'READY_TOGGLE',
      ready: mpLocalReady
    });
  }
}

function equipMultiplayerDrone(droneId) {
  localStorage.setItem('glider_equipped_ghost_skin', droneId);
  if (isMultiplayerHost) {
    if (mpPlayers[mpPeer.id]) {
      mpPlayers[mpPeer.id].droneSkinId = droneId;
    }
    broadcastRoomState();
    renderMultiplayerLobby();
  } else if (mpHostConn && mpHostConn.open) {
    mpHostConn.send({
      type: 'DRONE_UPDATE',
      droneSkinId: droneId
    });
  }
}

function equipMultiplayerGlider(gliderId) {
  localStorage.setItem('glider_equipped_skin', gliderId);
  if (isMultiplayerHost) {
    if (mpPlayers[mpPeer && mpPeer.id]) {
      mpPlayers[mpPeer.id].gliderSkinId = gliderId;
    }
    broadcastRoomState();
    renderMultiplayerLobby();
  } else if (mpHostConn && mpHostConn.open) {
    mpHostConn.send({
      type: 'GLIDER_UPDATE',
      gliderSkinId: gliderId
    });
  }
}

function updateMultiplayerTrack(courseId, subtrack) {
  if (!isMultiplayerHost) return;
  selectedCourseId = courseId;
  selectedSubtrack = subtrack;
  broadcastRoomState();
  renderMultiplayerLobby();
}

function triggerMultiplayerStart(force = false) {
  if (!isMultiplayerHost) return;
  const pList = Object.values(mpPlayers).filter(p => !p.isDedicatedServer && p.slot >= 0 && !p.isSpectator);
  if (pList.length === 0) return;
  const allReady = pList.every(p => p.ready);
  if (!allReady && !force) {
    setMultiplayerStatus('ALL PLAYERS MUST BE READY');
    return;
  }

  mpRaceInProgress = true;
  if (mpGpMode) {
    mpGpRaceIndex = 0;
    mpGpPoints = {};
    if (mpGpCupId === 'shuffle') {
      mpGpRaces = (typeof generateRandomShuffleTracks === 'function') ? generateRandomShuffleTracks() : [{ courseId: 'canyon', subtrack: 'A' }];
    } else {
      const cup = typeof GRAND_PRIX_CUPS !== 'undefined' ? GRAND_PRIX_CUPS.find(c => c.id === mpGpCupId) : null;
      mpGpRaces = cup ? [...cup.races] : [];
    }
    if (mpGpRaces.length > 0) {
      selectedCourseId = mpGpRaces[0].courseId;
      selectedSubtrack = mpGpRaces[0].subtrack;
    }
  }

  const startPacket = {
    type: 'START_RACE',
    courseId: selectedCourseId,
    subtrack: selectedSubtrack,
    isGp: !!mpGpMode,
    gpCupId: mpGpCupId || null,
    gpRaceIndex: mpGpRaceIndex,
    gpRaces: mpGpRaces,
    modifiers: mpModifiers,
    startIn: 0
  };
  relayPacketToClients(startPacket);
  launchMultiplayerRace();
}

function hostStartNextGpRace() {
  if (!isMultiplayerHost) return;
  mpGpRaceIndex++;
  if (!mpGpRaces || mpGpRaceIndex >= mpGpRaces.length) {
    hostReturnAllToLobby();
    return;
  }
  const nextTrack = mpGpRaces[mpGpRaceIndex];
  selectedCourseId = nextTrack.courseId;
  selectedSubtrack = nextTrack.subtrack;

  let slotNum = mpIsDedicatedServer ? 0 : 1;
  for (const id in mpPlayers) {
    if (!mpPlayers[id].isHost && !mpPlayers[id].isDedicatedServer) {
      if (slotNum < MP_MAX_PLAYERS) {
        mpPlayers[id].slot = slotNum++;
        mpPlayers[id].isSpectator = false;
      }
    }
  }

  mpFinishedRacers.clear();
  mpLeaderboard = [];
  mpRaceOver = false;
  mpDnfTimerActive = false;
  mpDnfTimer = 0;
  mpIsSpectating = false;

  const startPacket = {
    type: 'START_RACE',
    courseId: selectedCourseId,
    subtrack: selectedSubtrack,
    isGp: true,
    gpCupId: mpGpCupId,
    gpRaceIndex: mpGpRaceIndex,
    gpRaces: mpGpRaces,
    modifiers: mpModifiers,
    startIn: 300
  };
  relayPacketToClients(startPacket);
  const resultsModal = document.getElementById('screen-mp-results');
  if (resultsModal) resultsModal.style.display = 'none';
  setTimeout(() => launchMultiplayerRace(), 300);
}

let mpCinematicActive = false;
let mpCinematicTimer = 0;
const mpCinematicDuration = 4.5;
const mpCineCam = {
  p1: new THREE.Vector3(),
  p2: new THREE.Vector3(),
  p3: new THREE.Vector3(),
  t1: new THREE.Vector3(),
  t2: new THREE.Vector3(),
  t3: new THREE.Vector3()
};
const _mpCineLook = new THREE.Vector3();

function showMultiplayerLoadingScreen() {
  let overlay = document.getElementById('mp-loading-screen');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'mp-loading-screen';
    document.body.appendChild(overlay);
  }

  const randomMsg = typeof getRandomStartMessage === 'function' ? getRandomStartMessage() : 'PITCH / BANK / YAW FLIGHT SYSTEM';

  overlay.style.cssText = 'position:fixed;inset:0;background:transparent;z-index:680;display:flex;pointer-events:none;overflow:hidden;transition:opacity 0.5s ease;';

  overlay.innerHTML = `
    <div style="width:40%;min-width:280px;height:100%;background:linear-gradient(90deg, rgba(0, 0, 0, 0.95) 0%, rgba(0, 0, 0, 0.82) 45%, rgba(0, 0, 0, 0.45) 85%, transparent 100%);display:flex;flex-direction:column;justify-content:space-between;padding:40px 36px;box-sizing:border-box;pointer-events:auto;">
      <div style="display:flex;flex-direction:column;align-items:flex-start;">
        <img src="gliderfontthing.png" alt="GLIDER" style="max-width:320px;width:100%;height:auto;display:block;filter:drop-shadow(0 4px 14px rgba(0, 0, 0, 0.95));">
        <div style="font-size:14px;letter-spacing:1.5px;line-height:1.6;color:var(--mono-90);text-transform:uppercase;text-shadow:0 2px 8px rgba(0, 0, 0, 0.95);margin-top:28px;">
          ${randomMsg}
        </div>
      </div>
      <div style="font-size:12px;font-weight:900;letter-spacing:2.5px;color:var(--cyan);text-transform:uppercase;text-shadow:0 0 10px rgba(0, 240, 255, 0.6);padding-bottom:10px;">
        PRESS [TAB] TO VIEW PILOTS
      </div>
    </div>
    <div style="position:absolute;bottom:28px;right:36px;font-family:monospace;font-size:22px;font-weight:900;letter-spacing:4px;color:var(--cyan);text-shadow:0 0 14px rgba(0, 240, 255, 0.7);text-transform:uppercase;animation:promptPulse 1s ease-in-out infinite alternate;">
      LOADING...
    </div>
  `;

  overlay.style.opacity = '1';
  overlay.style.display = 'flex';
}

function hideMultiplayerLoadingScreen() {
  const overlay = document.getElementById('mp-loading-screen');
  if (overlay) {
    overlay.style.opacity = '0';
    setTimeout(() => {
      overlay.style.display = 'none';
    }, 500);
  }
}

function startMultiplayerLoadingSequence() {
  clearMpLoadingTimers();
  showMultiplayerLoadingScreen();
  if (typeof buildCourse === 'function') {
    buildCourse(selectedCourseId);
  }

  const course = COURSES[selectedCourseId];
  if (course && camera) {
    const sub = course.subtracks[selectedSubtrack] || course.subtracks['A'];
    const cp = sub.cliffPos || course.cliffPos;
    const cf = sub.cliffForward || course.cliffForward;
    const fwd = new THREE.Vector3(cf.x, 0, cf.z).normalize();
    camera.position.set(cp.x, cp.y + 45, cp.z).addScaledVector(fwd, -50);
    camera.lookAt(new THREE.Vector3(cp.x, cp.y + 15, cp.z).addScaledVector(fwd, 900));
  }
  gameState = 'MP_LOADING';

  if (cloudsGroup) cloudsGroup.visible = false;
  if (lowerCloudsGroup) lowerCloudsGroup.visible = false;
  if (thermalSystems) thermalSystems.forEach(s => { if (s.points) s.points.visible = false; });
  if (gateMeshes) gateMeshes.forEach(g => { if (g.group) g.group.visible = false; });
  if (paragliderWingGroup) paragliderWingGroup.visible = false;
  if (environmentGroup) {
    environmentGroup.children.forEach(child => {
      if (child.name !== 'terrain') child.visible = false;
    });
  }

  if (typeof audio !== 'undefined' && audio.playRecoveryBoost) {
    audio.playRecoveryBoost();
  }

  mpLoadingTimers.push(setTimeout(() => {
    if (cloudsGroup) cloudsGroup.visible = true;
    if (lowerCloudsGroup) lowerCloudsGroup.visible = true;
  }, 1000));

  mpLoadingTimers.push(setTimeout(() => {
    if (thermalSystems) thermalSystems.forEach(s => { if (!s.isSink && s.points) s.points.visible = true; });
  }, 2000));

  mpLoadingTimers.push(setTimeout(() => {
    if (thermalSystems) thermalSystems.forEach(s => { if (s.isSink && s.points) s.points.visible = true; });
    if (environmentGroup) {
      environmentGroup.children.forEach(child => {
        if (child.name !== 'hazard' && child.name !== 'gate') child.visible = true;
      });
    }
  }, 3000));

  mpLoadingTimers.push(setTimeout(() => {
    if (lateralShoveSystems) lateralShoveSystems.forEach(s => { if (s.mesh) s.mesh.visible = true; });
    if (activeBirdFlocks) activeBirdFlocks.forEach(f => { if (f.mesh) f.mesh.visible = true; });
  }, 4000));

  mpLoadingTimers.push(setTimeout(() => {
    if (gateMeshes) gateMeshes.forEach(g => { if (g.group) g.group.visible = true; });
  }, 5000));

  mpLoadingTimers.push(setTimeout(() => {
    hideMultiplayerLoadingScreen();
    startMultiplayerCinematic();
  }, 6000));
}

function startMultiplayerCinematic() {
  const course = COURSES[selectedCourseId];
  if (!course) {
    startCountdown();
    return;
  }
  const sub = course.subtracks[selectedSubtrack] || course.subtracks['A'];
  const cp = sub.cliffPos || course.cliffPos;
  const cf = sub.cliffForward || course.cliffForward;

  const cfRaw = new THREE.Vector3(cf.x, cf.y, cf.z);
  const fwd = new THREE.Vector3(cf.x, 0, cf.z).normalize();
  const right = new THREE.Vector3(-fwd.z, 0, fwd.x).normalize();
  const runway = new THREE.Vector3(cp.x, cp.y, cp.z).addScaledVector(cfRaw, -220);

  const c = mpCineCam;
  c.p1.copy(runway).addScaledVector(fwd, -420).addScaledVector(right, 260);
  c.p1.y += 220;
  c.t1.copy(runway).addScaledVector(fwd, 60);
  c.t1.y += 20;

  c.p2.copy(runway).addScaledVector(fwd, -110).addScaledVector(right, -140);
  c.p2.y += 50;
  c.t2.copy(runway).addScaledVector(fwd, 150);
  c.t2.y += 10;

  c.p3.copy(runway).addScaledVector(fwd, 80).addScaledVector(right, 40);
  c.p3.y += 22;
  c.t3.copy(cp);

  mpCinematicActive = true;
  mpCinematicTimer = 0;
  gameState = 'MP_CINEMATIC';

  if (paragliderWingGroup) paragliderWingGroup.visible = false;
  if (gateMeshes) gateMeshes.forEach(g => { g.group.visible = true; });
  
  if (!mpIsDedicatedServer && typeof createRemoteDroneMesh === 'function') {
    const pData = mpPlayers[mpPeer.id] || { droneSkinId: getEquippedGhostSkinId() };
    const slotOff = (mpSlotIndex - 2) * 35;
    const startPos = runway.clone().add(right.clone().multiplyScalar(slotOff));
    const localDrone = createRemoteDroneMesh(pData.droneSkinId);
    localDrone.position.copy(startPos);
    localDrone.rotation.y = Math.atan2(-cfRaw.x, -cfRaw.z);
    environmentGroup.add(localDrone);
    window._mpCinematicLocalDrone = localDrone;
  }

  const hudOverlay = document.getElementById('hud-overlay');
  if (hudOverlay) hudOverlay.style.display = 'none';
  const countBox = document.getElementById('countdown-box');
  if (countBox) countBox.style.display = 'none';

  if (typeof audio !== 'undefined' && audio.playBeep) {
    audio.playBeep(90, 'sawtooth', 1.4, 0.3);
    setTimeout(() => audio.playBeep(60, 'square', 1.6, 0.25), 500);
  }
}

function updateMultiplayerCinematic(dt) {
  if (!mpCinematicActive) return;
  mpCinematicTimer += dt;
  const progress = Math.min(1.0, mpCinematicTimer / mpCinematicDuration);
  const c = mpCineCam;
  const ease = t => t * t * (3 - 2 * t);

  if (progress < 0.50) {
    const t = ease(progress / 0.50);
    camera.position.lerpVectors(c.p1, c.p2, t);
    _mpCineLook.lerpVectors(c.t1, c.t2, t);
  } else {
    const t = ease((progress - 0.50) / 0.50);
    camera.position.lerpVectors(c.p2, c.p3, t);
    _mpCineLook.lerpVectors(c.t2, c.t3, t);
  }

  camera.lookAt(_mpCineLook);

  if (progress >= 1.0) {
    if (isMultiplayerHost) {
      finishMultiplayerCinematic();
      relayPacketToClients({ type: 'START_COUNTDOWN' });
    } else {
      mpCinematicTimer = mpCinematicDuration;
    }
  }
}

function finishMultiplayerCinematic() {
  if (!mpCinematicActive) return;
  mpCinematicActive = false;
  
  if (paragliderWingGroup) paragliderWingGroup.visible = true;
  
  if (window._mpCinematicLocalDrone) {
    environmentGroup.remove(window._mpCinematicLocalDrone);
    window._mpCinematicLocalDrone = null;
  }

  startCountdown();
}

function launchMultiplayerRace() {
  cancelActiveDailyChallenge();
  challengeActive = null;
  challengeActiveDateKey = null;
  challengeActiveDayOffset = 0;
  challengeMod = (mpModifiers && Object.values(mpModifiers).some(Boolean)) ? mpModifiers : null;
  multiplayerActive = true;
  gameMode = 'race';
  mpLeaderboard = [];
  mpFinishedRacers.clear();
  mpDnfTimerActive = false;
  mpDnfTimer = 0;
  mpRaceOver = false;
  mpRaceInProgress = true;
  const modal = document.getElementById('screen-multiplayer');
  if (modal) modal.classList.add('hidden');
  const dashEl = document.getElementById('desktop-dashboard');
  if (dashEl) dashEl.style.display = 'none';

  if (mpIsDedicatedServer) {
    mpIsSpectating = true;
  }

  if (mpIsSpectating) {
    if (typeof buildCourse === 'function') {
      buildCourse(selectedCourseId);
    }
    const course = COURSES[selectedCourseId];
    if (course) {
      const sub = course.subtracks[selectedSubtrack] || course.subtracks['A'];
      const cp = sub.cliffPos || course.cliffPos;
      const cf = sub.cliffForward || course.cliffForward;
      devFreeCam = true;
      devFreeCamPos.set(cp.x, cp.y + 60, cp.z);
      devFreeCamYaw = Math.atan2(-cf.x, -cf.z);
      devFreeCamPitch = 0;
    }
    if (paragliderWingGroup) paragliderWingGroup.visible = false;
    const countBox = document.getElementById('countdown-box');
    if (countBox) countBox.style.display = 'none';
    const hudOverlay = document.getElementById('hud-overlay');
    if (hudOverlay) hudOverlay.style.display = 'block';
    gameState = 'RACING';
    return;
  }

  startMultiplayerLoadingSequence();
}

function getMultiplayerSlotOffset() {
  return (mpSlotIndex - 2) * 35;
}

function createRemoteDroneMesh(droneSkinId) {
  const grp = new THREE.Group();
  const mat = typeof createGhostSkinMaterial === 'function' ? createGhostSkinMaterial(droneSkinId) : new THREE.MeshBasicMaterial({ color: 0x00f0ff });

  if (droneSkinId === 'ghost_16bit') {
    const quadGeom = new THREE.PlaneGeometry(38, 20.27);
    const quadMat = new THREE.MeshBasicMaterial({
      map: (typeof spriteTextures !== 'undefined' && spriteTextures.back) ? spriteTextures.back : null,
      transparent: true,
      alphaTest: 0.1,
      depthWrite: false,
      side: THREE.DoubleSide
    });
    const quadMesh = new THREE.Mesh(quadGeom, quadMat);
    quadMesh.name = 'spriteDroneQuad';
    grp.add(quadMesh);
    grp.is2DDrone = true;
  } else if (droneSkinId === 'ghost_gold' && typeof buildGoldDrone === 'function') {
    buildGoldDrone(grp, mat);
  } else if (droneSkinId === 'ghost_krampus' && typeof buildKrampusDrone === 'function') {
    buildKrampusDrone(grp, mat);
  } else if (droneSkinId === 'ghost_clockwork' && typeof buildClockworkDrone === 'function') {
    buildClockworkDrone(grp, mat);
  } else if (droneSkinId === 'ghost_apex_warden' && typeof buildApexWardenDrone === 'function') {
    buildApexWardenDrone(grp, mat);
  } else if (droneSkinId === 'ghost_404' && typeof buildMatrixDrone === 'function') {
    buildMatrixDrone(grp, mat);
  } else if (droneSkinId === 'ghost_scrapheap' && typeof buildScrapheapDrone === 'function') {
    buildScrapheapDrone(grp);
  } else if (droneSkinId === 'ghost_t9' && typeof buildT9Drone === 'function') {
    buildT9Drone(grp);
  } else if (droneSkinId === 'ghost_paper_airplane' && typeof buildPaperAirplane === 'function') {
    buildPaperAirplane(grp, mat);
  } else if (droneSkinId === 'ghost_ace_circuit' && typeof buildAceCircuitDrone === 'function') {
    buildAceCircuitDrone(grp, mat);
  } else if (droneSkinId === 'ghost_piggy_bank' && typeof buildPiggyBankDrone === 'function') {
    buildPiggyBankDrone(grp, mat);
  } else {
    const bodyGeom = new THREE.ConeGeometry(5, 24, 4);
    bodyGeom.rotateX(-Math.PI / 2);
    const body = new THREE.Mesh(bodyGeom, mat);
    grp.add(body);
    const wingGeom = new THREE.BoxGeometry(42, 0.4, 6);
    const wing = new THREE.Mesh(wingGeom, mat);
    wing.position.set(0, 0, 3);
    grp.add(wing);
  }

  return grp;
}

function setupMultiplayerWorld(course, activeSubtrack) {
  for (const id in mpRemoteDrones) {
    if (mpRemoteDrones[id] && environmentGroup) {
      environmentGroup.remove(mpRemoteDrones[id]);
    }
  }
  mpRemoteDrones = {};
  mpRemoteTargets = {};

  const cCliffPos = activeSubtrack.cliffPos || course.cliffPos;
  const cCliffForward = activeSubtrack.cliffForward || course.cliffForward;
  const cCliffRight = new THREE.Vector3(-cCliffForward.z, 0, cCliffForward.x).normalize();
  const runwayBasePos = new THREE.Vector3().copy(cCliffPos).sub(new THREE.Vector3().copy(cCliffForward).multiplyScalar(220));

  const myId = mpPeer ? mpPeer.id : 'me';

  for (const pId in mpPlayers) {
    if (pId !== myId && !mpPlayers[pId].isDedicatedServer && mpPlayers[pId].slot >= 0) {
      const pData = mpPlayers[pId];
      const droneGroup = createRemoteDroneMesh(pData.droneSkinId);
      const slotOff = (pData.slot - 2) * 35;
      const startPos = runwayBasePos.clone().add(cCliffRight.clone().multiplyScalar(slotOff));
      droneGroup.position.copy(startPos);
      droneGroup.rotation.set(0, 0, 0);
      droneGroup.rotation.order = 'YXZ';
      droneGroup.rotation.y = Math.atan2(-cCliffForward.x, -cCliffForward.z);
      environmentGroup.add(droneGroup);

      mpRemoteDrones[pId] = droneGroup;
      mpRemoteTargets[pId] = {
        pos: startPos.clone(),
        yaw: droneGroup.rotation.y,
        pitch: 0,
        roll: 0,
        speed: 0
      };
    }
  }
}

function updateMultiplayerFlight(dt) {
  if (!multiplayerActive) return;

  if (isMultiplayerHost && mpDnfTimerActive && !mpRaceOver) {
    mpDnfTimer -= dt;
    if (mpDnfTimer <= 0) {
      mpDnfTimerActive = false;
      const activeRacers = Object.values(mpPlayers).filter(p => !p.isDedicatedServer && p.slot >= 0 && !p.isSpectator);
      for (const r of activeRacers) {
        if (!mpFinishedRacers.has(r.id)) {
          mpFinishedRacers.add(r.id);
          updateMultiplayerLeaderboard({ id: r.id, time: 9999, isDnf: true, type: 'DNF' });
        }
      }
      hostTriggerRaceOver();
    }
  }

  if (!document.hidden && !mpIsDedicatedServer && !mpIsSpectating && (gameState === 'RACING' || gameState === 'RUNUP')) {
    mpSendTimer += dt;
    if (mpSendTimer >= MP_SEND_INTERVAL) {
      mpSendTimer = 0;
      broadcastLocalFlightPacket();
    }
  }

  for (const pId in mpRemoteDrones) {
    const drone = mpRemoteDrones[pId];
    const target = mpRemoteTargets[pId];
    if (drone && target) {
      drone.position.lerp(target.pos, Math.min(1.0, 8.0 * dt));

      let dYaw = target.yaw - drone.rotation.y;
      while (dYaw > Math.PI) dYaw -= Math.PI * 2;
      while (dYaw < -Math.PI) dYaw += Math.PI * 2;
      drone.rotation.y += dYaw * Math.min(1.0, 8.0 * dt);

      drone.rotation.x = THREE.MathUtils.lerp(drone.rotation.x, target.pitch, Math.min(1.0, 8.0 * dt));
      let dRoll = target.roll - drone.rotation.z;
      while (dRoll > Math.PI) dRoll -= Math.PI * 2;
      while (dRoll < -Math.PI) dRoll += Math.PI * 2;
      drone.rotation.z += dRoll * Math.min(1.0, 8.0 * dt);

      if (drone.is2DDrone && typeof update2DDroneMesh === 'function' && camera) {
        update2DDroneMesh(drone, camera);
      }
    }
  }

  calculateMultiplayerRank();
}

function broadcastLocalFlightPacket() {
  const packet = {
    type: 'F',
    d: [
      parseFloat(player.pos.x.toFixed(1)),
      parseFloat(player.pos.y.toFixed(1)),
      parseFloat(player.pos.z.toFixed(1)),
      parseFloat(player.pitch.toFixed(3)),
      parseFloat(player.yaw.toFixed(3)),
      parseFloat(player.roll.toFixed(3)),
      parseFloat(player.speed.toFixed(1)),
      player.nextGateIdx
    ]
  };

  if (isMultiplayerHost) {
    relayFlightData(mpPeer.id, packet);
  } else if (mpHostConn && mpHostConn.open) {
    mpHostConn.send(packet);
  }
}

function handleRemoteFlightPacket(packet) {
  const pId = packet.id;
  if (!pId) return;
  const d = packet.d;
  if (!d || d.length < 7) return;
  for (let i = 0; i < 7; i++) {
    if (!Number.isFinite(d[i])) return;
  }

  if (!mpRemoteTargets[pId]) {
    mpRemoteTargets[pId] = {
      pos: new THREE.Vector3(d[0], d[1], d[2]),
      pitch: d[3],
      yaw: d[4],
      roll: d[5],
      speed: d[6]
    };
  } else {
    mpRemoteTargets[pId].pos.set(d[0], d[1], d[2]);
    mpRemoteTargets[pId].pitch = d[3];
    mpRemoteTargets[pId].yaw = d[4];
    mpRemoteTargets[pId].roll = d[5];
    mpRemoteTargets[pId].speed = d[6];
  }

  if (mpPlayers[pId] && d[7] !== undefined) {
    mpPlayers[pId].gate = d[7];
  }
}

function onMultiplayerGatePassed(idx) {
  if (!multiplayerActive) return;
  const packet = { type: 'GATE', id: mpPeer ? mpPeer.id : 'me', gate: idx };
  if (isMultiplayerHost) {
    relayPacketToClients(packet);
  } else if (mpHostConn && mpHostConn.open) {
    mpHostConn.send(packet);
  }
}

function onMultiplayerFinished() {
  if (!multiplayerActive) return;
  const myId = mpPeer ? mpPeer.id : 'me';
  const packet = { type: 'FINISH', id: myId, time: raceElapsedTime };
  mpFinishedRacers.add(myId);
  updateMultiplayerLeaderboard(packet);
  if (isMultiplayerHost) {
    relayPacketToClients(packet);
    if (!mpDnfTimerActive) {
      mpDnfTimerActive = true;
      mpDnfTimer = 60.0;
    }
    checkAllRacersFinished();
  } else if (mpHostConn && mpHostConn.open) {
    mpHostConn.send(packet);
  }
}

function onMultiplayerCrashed() {
  return;
}

function calculateMultiplayerRank() {
  if (!multiplayerActive) return;
  let rank = 1;
  const myGate = player.nextGateIdx;
  const myProg = typeof getTrackProgress === 'function' ? getTrackProgress(player.pos, player.nextGateIdx, 0) : 0;

  for (const pId in mpPlayers) {
    if (mpPeer && pId === mpPeer.id) continue;
    if (mpPlayers[pId].isDedicatedServer || mpPlayers[pId].isSpectator || mpPlayers[pId].slot < 0) continue;
    const remP = mpPlayers[pId];
    const remGate = remP.gate || 1;
    if (remGate > myGate) {
      rank++;
    } else if (remGate === myGate && mpRemoteTargets[pId]) {
      const remProg = typeof getTrackProgress === 'function' ? getTrackProgress(mpRemoteTargets[pId].pos, remGate, 0) : 0;
      if (remProg > myProg) rank++;
    }
  }

  player.rank = rank;
}

function updateMultiplayerLeaderboard(entry) {
  const pName = (mpPlayers[entry.id] && mpPlayers[entry.id].profile) ? mpPlayers[entry.id].profile.name : 'PILOT';
  const existing = mpLeaderboard.find(e => e.id === entry.id);
  const isDnf = entry.type === 'CRASH' || entry.type === 'DNF' || !!entry.isDnf;
  if (!existing) {
    mpLeaderboard.push({
      id: entry.id,
      name: pName,
      time: entry.time || 9999,
      isDnf: isDnf
    });
  } else {
    existing.name = pName;
    existing.time = entry.time || existing.time;
    existing.isDnf = isDnf || existing.isDnf;
  }
  mpLeaderboard.sort((a, b) => {
    if (a.isDnf && !b.isDnf) return 1;
    if (!a.isDnf && b.isDnf) return -1;
    return a.time - b.time;
  });
}

function showMultiplayerResultsScreen(leaderboard) {
  let modal = document.getElementById('screen-mp-results');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'screen-mp-results';
    modal.className = 'menu-screen';
    modal.style.cssText = 'position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); max-width: 680px; width: 92%; z-index: 690; padding: 24px 28px; display: none; flex-direction: column; align-items: center; background: var(--mono-bg); border: 1.5px solid var(--mono-20); box-shadow: 0 10px 40px rgba(0,0,0,0.9);';
    document.body.appendChild(modal);
  }

  const renderContent = () => {
    const banner = document.getElementById('race-finish-banner');
    if (banner) banner.style.display = 'none';

    const courseData = COURSES[selectedCourseId];
    const trackName = courseData ? courseData.name : selectedCourseId;
    const totalGpRaces = (mpGpRaces && mpGpRaces.length) ? mpGpRaces.length : 3;
    const isGpLastRace = mpGpMode && (mpGpRaceIndex >= totalGpRaces - 1);

    let rowsHtml = '';
    const sortedBoard = [...leaderboard];
    if (isGpLastRace) {
      sortedBoard.sort((a, b) => (mpGpPoints[b.id] || 0) - (mpGpPoints[a.id] || 0));
    }

    sortedBoard.forEach((entry, idx) => {
      const isMe = mpPeer && entry.id === mpPeer.id;
      const timeStr = entry.isDnf ? '<span style="color: var(--red);">DNF</span>' : (typeof formatTime === 'function' ? formatTime(entry.time) : entry.time.toFixed(1) + 's');
      const roundPts = entry.isDnf ? 0 : ([10, 6, 4, 3, 2][idx] || 0);
      const totalPts = mpGpPoints[entry.id] || 0;
      const pData = mpPlayers[entry.id] || {};
      const gSkin = pData.gliderSkinId || (isMe ? (typeof getEquippedSkinId === 'function' ? getEquippedSkinId() : 'default') : 'default');
      const pilotColor = typeof getPlayerGliderColor === 'function' ? getPlayerGliderColor(gSkin) : '#00f0ff';

      rowsHtml += `
        <tr class="${isMe ? 'highlight-player' : ''}">
          <td style="text-align: center; font-weight: 800; width: 45px; ${mpGpMode ? `color: ${pilotColor};` : ''}">${idx + 1}</td>
          <td style="font-weight: 700; text-align: left; padding-left: 12px; ${mpGpMode ? `color: ${pilotColor};` : ''}">${entry.name}</td>
          <td style="text-align: center; font-weight: 700;">${timeStr}</td>
          ${mpGpMode ? `<td style="text-align: center; font-weight: 700; color: var(--gold);">${isGpLastRace ? '' : '+' + roundPts}</td><td style="text-align: center; font-weight: 800; color: var(--gold);">${totalPts} PTS</td>` : ''}
        </tr>
      `;
    });

    let titleText = 'RACE RESULTS';
    let subText = `${trackName.toUpperCase()} (TRACK ${selectedSubtrack})`;
    if (mpGpMode) {
      if (isGpLastRace) {
        titleText = 'CHAMPIONSHIP FINISHED';
        subText = 'FINAL GRAND PRIX STANDINGS';
      } else {
        titleText = `RACE ${mpGpRaceIndex + 1} OF ${totalGpRaces} COMPLETE`;
      }
    }

    modal.innerHTML = `
      <div class="menu-title" style="margin-bottom: 2px;">${titleText}</div>
      <div class="menu-subtitle" style="margin-bottom: 14px;">${subText}</div>
      <div style="width: 100%; max-height: 240px; overflow-y: auto; margin-bottom: 16px; border: 1px solid var(--mono-20); background: rgba(0, 0, 0, 0.45);">
        <table class="arcade-table">
          <thead>
            <tr>
              <th style="width: 45px; text-align: center;">POS</th>
              <th style="text-align: left; padding-left: 12px;">PILOT</th>
              <th style="text-align: center;">TIME</th>
              ${mpGpMode ? `<th style="text-align: center;">${isGpLastRace ? '' : 'ROUND'}</th><th style="text-align: center;">TOTAL</th>` : ''}
            </tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
        </table>
      </div>
      <div class="row-group" style="margin-bottom: 0; width: 100%; justify-content: center;">
        ${(mpGpMode && !isGpLastRace) ? `
          <button class="mono-btn btn-mp-next-race" style="padding: 11px 32px; border-color: var(--cyan); background: var(--cyan); color: #000000; font-weight: 900; letter-spacing: 2px;">NEXT RACE (${mpGpRaceIndex + 2}/${totalGpRaces})</button>
        ` : `
          <button class="mono-btn btn-mp-results-lobby" style="padding: 11px 32px; border-color: var(--cyan); background: var(--cyan); color: #000000; font-weight: 900; letter-spacing: 2px;">RETURN TO LOBBY</button>
        `}
      </div>
    `;

    const btnNext = modal.querySelector('.btn-mp-next-race');
    if (btnNext) {
      if (isMultiplayerHost) {
        btnNext.onclick = () => hostStartNextGpRace();
      } else if (mpIsDedicatedServer) {
        btnNext.onclick = () => {
          if (mpHostConn && mpHostConn.open) {
            mpHostConn.send({ type: 'REQUEST_NEXT_GP_RACE' });
          }
          btnNext.innerText = 'STARTING...';
          btnNext.disabled = true;
        };
      } else {
        btnNext.innerText = 'WAITING ON HOST...';
        btnNext.disabled = true;
        btnNext.style.opacity = '0.5';
        btnNext.style.borderColor = 'var(--mono-20)';
        btnNext.style.background = 'transparent';
        btnNext.style.color = 'var(--mono-60)';
      }
    }

    const btnLobby = modal.querySelector('.btn-mp-results-lobby');
    if (btnLobby) {
      btnLobby.onclick = () => {
        if (isMultiplayerHost) {
          hostReturnAllToLobby();
        } else if (mpIsDedicatedServer) {
          if (mpHostConn && mpHostConn.open) {
            mpHostConn.send({ type: 'REQUEST_RETURN_TO_LOBBY' });
          }
          btnLobby.innerText = 'RETURNING...';
          btnLobby.disabled = true;
        } else {
          btnLobby.innerText = 'WAITING ON HOST...';
          btnLobby.disabled = true;
          btnLobby.style.opacity = '0.5';
          btnLobby.style.borderColor = 'var(--mono-20)';
          btnLobby.style.background = 'transparent';
          btnLobby.style.color = 'var(--mono-60)';
        }
      };
    }

    modal.style.display = 'flex';
  };

  if (!mpIsDedicatedServer && !mpIsSpectating) {
    const banner = document.getElementById('race-finish-banner');
    if (banner) banner.style.display = 'flex';
    setTimeout(() => {
      renderContent();
    }, 2000);
  } else {
    renderContent();
  }
}

function returnToMultiplayerLobby() {
  const resultsModal = document.getElementById('screen-mp-results');
  if (resultsModal) resultsModal.style.display = 'none';
  const finishBanner = document.getElementById('race-finish-banner');
  if (finishBanner) finishBanner.style.display = 'none';
  const mOver = document.getElementById('mp-match-overview-overlay');
  if (mOver) mOver.style.display = 'none';
  mpTacticalOverlayOpen = false;

  gameState = 'START';
  devFreeCam = false;
  mpIsSpectating = false;
  mpRaceOver = false;
  mpRaceInProgress = false;
  mpDnfTimerActive = false;
  mpFinishedRacers.clear();
  mpLeaderboard = [];
  mpLocalReady = false;
  mpGpRaceIndex = 0;
  if (typeof challengeMod !== 'undefined') challengeMod = null;
  clearMpLoadingTimers();

  let newSlot = mpIsDedicatedServer ? 0 : 1;
  for (const id in mpPlayers) {
    if (mpPlayers[id].isDedicatedServer) {
      mpPlayers[id].ready = true;
    } else {
      mpPlayers[id].ready = false;
      mpPlayers[id].isSpectator = false;
      if (!mpPlayers[id].isHost) {
        mpPlayers[id].slot = newSlot++;
      }
    }
  }

  for (const id in mpRemoteDrones) {
    if (mpRemoteDrones[id] && environmentGroup) {
      environmentGroup.remove(mpRemoteDrones[id]);
    }
  }
  mpRemoteDrones = {};
  mpRemoteTargets = {};

  if (paragliderWingGroup) paragliderWingGroup.visible = true;

  if (typeof audio !== 'undefined' && audio.stopAllAudio) audio.stopAllAudio();
  if (typeof playMenuTheme === 'function') playMenuTheme('menu');

  if (isMobileDevice()) {
    if (typeof showScreen === 'function') showScreen('screen-multiplayer');
  } else {
    if (typeof showScreen === 'function') showScreen('screen-start');
    if (typeof setDashboardCategory === 'function') setDashboardCategory('multiplayer');
    if (typeof openDashboardRight === 'function') openDashboardRight('multiplayer');
  }

  if (isMultiplayerHost) {
    broadcastRoomState();
  }
  renderMultiplayerLobby();
  updateServerPlayersButton();
}

function drawMultiplayerNametags(ctx, w, h) {
  if (!multiplayerActive || !camera) return;

  ctx.save();
  for (const pId in mpRemoteDrones) {
    const drone = mpRemoteDrones[pId];
    const target = mpRemoteTargets[pId];
    if (!drone || !target) continue;

    _mpProjVec.set(drone.position.x, drone.position.y + 14, drone.position.z).project(camera);
    if (_mpProjVec.z < 1.0 && _mpProjVec.x > -1.1 && _mpProjVec.x < 1.1 && _mpProjVec.y > -1.1 && _mpProjVec.y < 1.1) {
      const sx = (_mpProjVec.x * 0.5 + 0.5) * w;
      const sy = (-_mpProjVec.y * 0.5 + 0.5) * h;
      const distM = Math.round(player.pos.distanceTo(drone.position) * 0.3048);

      if (distM < 2200) {
        const pData = mpPlayers[pId] || {};
        const pProf = pData.profile || { name: 'PILOT', banner: 'default' };
        const bDef = MP_BANNERS.find(b => b.id === pProf.banner) || MP_BANNERS[0];
        const strokeColor = (mpGpMode && typeof getPlayerGliderColor === 'function')
          ? getPlayerGliderColor(pData.gliderSkinId || 'default')
          : bDef.color;

        const text = pProf.name + ' [' + distM + 'M]';
        ctx.font = '900 10.5px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        const txtWidth = ctx.measureText(text).width;
        const pillW = txtWidth + 24;
        const pillH = 20;

        ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = 1.5;

        ctx.beginPath();
        ctx.rect(sx - pillW / 2, sy - pillH / 2, pillW, pillH, 4);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.letterSpacing = '1px';
        ctx.fillText(text, sx, sy + 0.5);
      }
    }
  }
  ctx.restore();
}

function drawMultiplayerMinimap(ctx, toMapX, toMapY) {
  if (!multiplayerActive) return;
  for (const pId in mpRemoteDrones) {
    const drone = mpRemoteDrones[pId];
    if (drone) {
      const mx = toMapX(drone.position.x);
      const my = toMapY(drone.position.z);
      const pData = mpPlayers[pId] || {};
      const pProf = pData.profile || { banner: 'default' };
      const bDef = MP_BANNERS.find(b => b.id === pProf.banner) || MP_BANNERS[0];
      const dotColor = (mpGpMode && typeof getPlayerGliderColor === 'function')
        ? getPlayerGliderColor(pData.gliderSkinId || 'default')
        : bDef.color;

      ctx.fillStyle = dotColor;
      ctx.beginPath();
      ctx.arc(mx, my, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function setMultiplayerStatus(text) {
  document.querySelectorAll('.mp-status-banner').forEach(el => {
    el.innerText = text;
  });
}

function renderMultiplayerLobby() {
  updateProfileCardElements();

  const serverBadges = document.querySelectorAll('.mp-server-badge-container');
  serverBadges.forEach(wrap => {
    wrap.innerHTML = '';
    if (mpIsDedicatedServer || mpServerActive) {
      const badge = document.createElement('div');
      badge.style.cssText = 'background: #000000; color: #ffffff; border: 1.5px solid #ffffff; font-size: 9.5px; font-weight: 900; letter-spacing: 1.5px; padding: 4px 10px; border-radius: 3px; text-transform: uppercase; display: inline-flex; align-items: center;';
      badge.innerText = '[ SERVER ACTIVE ]';
      wrap.appendChild(badge);
    }
    if (isMultiplayerHost && !isMobileDevice()) {
      const btn = document.createElement('button');
      btn.className = 'mono-btn btn-toggle-server-mode';
      btn.style.cssText = 'padding: 4px 10px; font-size: 9px; font-weight: 800; border-color: #ffffff; color: #ffffff; margin-left: 6px;';
      btn.innerText = mpIsDedicatedServer ? 'BECOME RACER' : 'BECOME SERVER';
      btn.onclick = () => {
        toggleDedicatedServer();
      };
      wrap.appendChild(btn);
    }
  });

  const codeContainers = document.querySelectorAll('.mp-room-code-display');
  codeContainers.forEach(el => {
    el.innerText = mpRoomCode || '----';
  });

  const slotsLists = document.querySelectorAll('.mp-slots-list');
  slotsLists.forEach(list => {
    list.innerHTML = '';
    const pList = Object.values(mpPlayers).filter(p => !p.isDedicatedServer && p.slot >= 0);

    for (let s = 0; s < MP_MAX_PLAYERS; s++) {
      const p = pList.find(item => item.slot === s);
      const card = document.createElement('div');
      card.className = 'mp-slot-card ' + (p ? 'occupied' : 'empty');

      if (p) {
        const prof = p.profile || { name: 'PILOT', pfp: 'nopfpequiped.png', banner: 'default' };
        const bDef = MP_BANNERS.find(b => b.id === prof.banner) || MP_BANNERS[0];
        const drone = GHOST_SKINS.find(d => d.id === p.droneSkinId) || GHOST_SKINS[0];
        const isMe = mpPeer && p.id === mpPeer.id;

        card.style.backgroundImage = 'url(' + bDef.src + ')';
        card.style.backgroundSize = '100% 100%';
        card.style.backgroundPosition = 'center';
        card.style.backgroundRepeat = 'no-repeat';
        card.style.borderColor = p.ready ? 'var(--cyan)' : 'var(--mono-20)';
        card.style.minHeight = '78px';

        card.innerHTML = `
          <div style="display: flex; align-items: flex-start; gap: 12px; width: 100%; padding: 4px 6px; box-sizing: border-box;">
            <img src="${prof.pfp || 'nopfpequiped.png'}" style="width: 48px; height: 48px; aspect-ratio: 1 / 1; border-radius: 4px; object-fit: contain; background: ${(MP_PFPS.find(p => p.src === prof.pfp)?.hasColorPicker) ? (prof.pfpColor || '#00f0ff') : 'rgba(0,0,0,0.55)'}; flex-shrink: 0; box-shadow: 0 2px 8px rgba(0,0,0,0.8);">
            <div style="flex: 1; text-align: left; min-width: 0;">
              <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
                <span style="font-size: 13px; font-weight: 900; letter-spacing: 1.5px; color: #ffffff; text-shadow: 0 0 8px rgba(0,0,0,0.95), 0 2px 4px rgba(0,0,0,0.9); text-transform: uppercase;">${prof.name}</span>
                ${p.isHost ? '<span style="color: var(--gold); font-size: 9.5px; font-weight: 800; text-shadow: 0 1px 4px rgba(0,0,0,0.9);">★ HOST</span>' : ''}
                ${isMe ? '<span style="color: rgba(255,255,255,0.7); font-size: 8.5px; font-weight: 700; text-shadow: 0 1px 4px rgba(0,0,0,0.9);">(YOU)</span>' : ''}
                ${(isMultiplayerHost && !p.isHost) ? `
                  <div style="position: relative; display: inline-block;">
                    <button class="mono-btn mp-dots-btn" data-peerid="${p.id}" title="Manage ${prof.name}" style="background: rgba(255, 255, 255, 0.12); border: 1.5px solid var(--mono-20); color: #ffffff; font-size: 14px; font-weight: 900; line-height: 1; padding: 2px 7px; margin-left: 6px; border-radius: 3px; cursor: pointer;">⋮</button>
                    <div class="mp-action-menu" id="mp-action-menu-${p.id}" style="display: none; position: absolute; top: calc(100% + 4px); right: 0; background: #000000; border: 1.5px solid var(--mono-20); border-radius: 4px; box-shadow: 0 6px 18px rgba(0,0,0,0.95); z-index: 100; min-width: 90px; overflow: hidden;">
                      <button class="mp-menu-kick-opt" data-peerid="${p.id}" style="width: 100%; padding: 8px 12px; background: transparent; border: none; border-bottom: 1px solid var(--mono-20); color: #ff8888; font-family: inherit; font-size: 10px; font-weight: 800; letter-spacing: 1px; text-transform: uppercase; text-align: left; cursor: pointer;">KICK</button>
                      <button class="mp-menu-ban-opt" data-peerid="${p.id}" style="width: 100%; padding: 8px 12px; background: transparent; border: none; color: var(--red); font-family: inherit; font-size: 10px; font-weight: 800; letter-spacing: 1px; text-transform: uppercase; text-align: left; cursor: pointer;">BAN</button>
                    </div>
                  </div>
                ` : ''}
              </div>
              <div style="font-size: 9.5px; color: #ffffff; letter-spacing: 1px; margin-top: 4px; text-transform: uppercase; text-shadow: 0 1px 4px rgba(0,0,0,0.95), 0 0 6px rgba(0,0,0,0.9);">
                DRONE: <span style="color: var(--cyan); font-weight: 800;">${drone.name}</span>
              </div>
            </div>
            <div style="font-size: 9.5px; font-weight: 900; letter-spacing: 1.5px; padding: 5px 9px; border-radius: 3px; border: 1.5px solid ${p.ready ? 'var(--cyan)' : 'rgba(255,255,255,0.4)'}; color: ${p.ready ? 'var(--cyan)' : 'rgba(255,255,255,0.7)'}; background: rgba(0,0,0,0.7); text-shadow: 0 1px 3px rgba(0,0,0,0.9); box-shadow: 0 2px 6px rgba(0,0,0,0.6); flex-shrink: 0;">
              ${p.ready ? 'READY' : 'NOT READY'}
            </div>
          </div>
        `;
      } else {
        card.style.backgroundImage = 'none';
        card.style.background = 'rgba(0, 0, 0, 0.6)';
        card.style.borderColor = 'var(--mono-20)';
        card.style.minHeight = '78px';
        card.innerHTML = `
          <div style="display: flex; align-items: center; justify-content: center; width: 100%; color: var(--mono-20); font-size: 10px; font-weight: 700; letter-spacing: 2px; height: 78px;">
            [ OPEN SLOT ${s + 1} ]
          </div>
        `;
      }

      list.appendChild(card);

      card.querySelectorAll('.mp-dots-btn').forEach(btn => {
        btn.onclick = (e) => {
          e.stopPropagation();
          const targetId = btn.getAttribute('data-peerid');
          const menu = document.getElementById('mp-action-menu-' + targetId);
          const wasOpen = menu && menu.style.display === 'block';
          document.querySelectorAll('.mp-action-menu').forEach(m => { m.style.display = 'none'; });
          if (menu && !wasOpen) {
            menu.style.display = 'block';
          }
        };
      });

      card.querySelectorAll('.mp-menu-kick-opt').forEach(btn => {
        btn.onclick = (e) => {
          e.stopPropagation();
          document.querySelectorAll('.mp-action-menu').forEach(m => { m.style.display = 'none'; });
          const targetId = btn.getAttribute('data-peerid');
          if (!targetId || !mpPlayers[targetId]) return;
          const pName = (mpPlayers[targetId].profile && mpPlayers[targetId].profile.name) || 'PILOT';
          if (confirm('Are you sure you want to kick ' + pName + '?')) {
            kickPlayer(targetId);
          }
        };
      });

      card.querySelectorAll('.mp-menu-ban-opt').forEach(btn => {
        btn.onclick = (e) => {
          e.stopPropagation();
          document.querySelectorAll('.mp-action-menu').forEach(m => { m.style.display = 'none'; });
          const targetId = btn.getAttribute('data-peerid');
          if (!targetId || !mpPlayers[targetId]) return;
          const pName = (mpPlayers[targetId].profile && mpPlayers[targetId].profile.name) || 'PILOT';
          if (confirm('Are you sure you want to BAN ' + pName + ' from this session?')) {
            banPlayer(targetId);
          }
        };
      });
    }
  });

  const readyBtns = document.querySelectorAll('.btn-mp-toggle-ready');
  readyBtns.forEach(btn => {
    btn.style.display = (isMultiplayerHost && mpIsDedicatedServer) ? 'none' : '';
    btn.innerText = mpLocalReady ? 'UNREADY' : 'READY';
    btn.style.borderColor = mpLocalReady ? 'var(--gold)' : 'var(--cyan)';
    btn.style.color = mpLocalReady ? 'var(--gold)' : 'var(--cyan)';
  });

  const startBtns = document.querySelectorAll('.btn-mp-start-race');
  startBtns.forEach(btn => {
    let wrap = btn.closest('.mp-start-wrap');
    if (!wrap && btn.parentElement) {
      wrap = document.createElement('div');
      wrap.className = 'mp-start-wrap';
      wrap.style.cssText = 'position: relative; flex: 1.5; display: none;';
      btn.parentElement.insertBefore(wrap, btn);
      wrap.appendChild(btn);

      const menu = document.createElement('div');
      menu.className = 'mp-force-start-menu';
      menu.style.cssText = 'display: none; position: absolute; bottom: calc(100% + 6px); right: 0; left: 0; background: #000000; border: 1.5px solid var(--gold); border-radius: 4px; box-shadow: 0 0 16px rgba(0,0,0,0.95); z-index: 200; padding: 4px;';

      const forceBtn = document.createElement('button');
      forceBtn.className = 'mono-btn btn-mp-force-start';
      forceBtn.style.cssText = 'width: 100%; padding: 8px 10px; border-color: var(--gold); color: var(--gold); font-size: 10px; font-weight: 800; letter-spacing: 1.5px; text-transform: uppercase; background: transparent; cursor: pointer;';
      forceBtn.innerText = 'FORCE START';

      forceBtn.onclick = (e) => {
        e.stopPropagation();
        menu.style.display = 'none';
        if (confirm('Are you sure you want to force start?')) {
          triggerMultiplayerStart(true);
        }
      };

      menu.appendChild(forceBtn);
      wrap.appendChild(menu);
    }

    if (wrap) {
      wrap.style.display = isMultiplayerHost ? 'flex' : 'none';
    }
    btn.style.width = '100%';
    btn.style.display = isMultiplayerHost ? 'block' : 'none';

    if (isMultiplayerHost) {
      const pList = Object.values(mpPlayers).filter(p => !p.isDedicatedServer && p.slot >= 0 && !p.isSpectator);
      const allReady = pList.length > 0 && pList.every(p => p.ready);
      btn.setAttribute('data-allready', allReady ? 'true' : 'false');
      btn.disabled = false;
      btn.style.opacity = allReady ? '1' : '0.45';
      btn.style.borderColor = allReady ? 'var(--cyan)' : 'var(--mono-20)';
      btn.style.color = allReady ? '#000000' : 'var(--mono-40)';
      btn.style.background = allReady ? 'var(--cyan)' : 'transparent';
      btn.style.cursor = 'pointer';
      if (allReady && wrap) {
        const menu = wrap.querySelector('.mp-force-start-menu');
        if (menu) menu.style.display = 'none';
      }
    }
  });

  const hostTrackSelects = document.querySelectorAll('.mp-host-track-box');
  hostTrackSelects.forEach(box => {
    box.style.display = isMultiplayerHost ? 'flex' : 'none';
  });

  const curDrone = GHOST_SKINS.find(d => d.id === getEquippedGhostSkinId()) || GHOST_SKINS[0];
  document.querySelectorAll('.mp-selected-drone-name').forEach(el => {
    el.innerText = curDrone.name;
  });

  document.querySelectorAll('.mp-selected-track-display').forEach(el => {
    let baseText = '';
    if (mpGpMode) {
      if (mpGpCupId === 'shuffle') {
        baseText = 'GRAND PRIX: RANDOM SHUFFLE';
      } else {
        const cup = typeof GRAND_PRIX_CUPS !== 'undefined' ? GRAND_PRIX_CUPS.find(c => c.id === mpGpCupId) : null;
        baseText = 'GRAND PRIX: ' + (cup ? cup.name.toUpperCase() : 'CHAMPIONSHIP');
      }
    } else {
      const cData = COURSES[selectedCourseId];
      const trackName = cData ? cData.name : selectedCourseId;
      baseText = trackName.toUpperCase() + ' (TRACK ' + selectedSubtrack + ')';
    }
    const activeMods = getActiveModNames(mpModifiers);
    if (activeMods.length > 0) {
      baseText += ' [MODS: ' + activeMods.join(', ') + ']';
    }
    el.innerText = baseText;
  });

  document.querySelectorAll('.btn-mp-open-track-select').forEach(btn => {
    btn.innerText = 'CUSTOMIZE';
  });

  const clientTrackBanners = document.querySelectorAll('.mp-client-track-banner');
  clientTrackBanners.forEach(banner => {
    if (!isMultiplayerHost && multiplayerActive) {
      banner.style.display = 'block';
      let text = '';
      if (mpGpMode) {
        if (mpGpCupId === 'shuffle') {
          text = 'CHAMPIONSHIP: RANDOM SHUFFLE';
        } else {
          const cup = typeof GRAND_PRIX_CUPS !== 'undefined' ? GRAND_PRIX_CUPS.find(c => c.id === mpGpCupId) : null;
          text = 'CHAMPIONSHIP: ' + (cup ? cup.name.toUpperCase() : 'GRAND PRIX');
        }
      } else {
        const cData = COURSES[selectedCourseId];
        const trackName = cData ? cData.name : selectedCourseId;
        text = 'MAP: ' + trackName.toUpperCase() + ' (' + selectedSubtrack + ')';
      }
      const activeMods = getActiveModNames(mpModifiers);
      if (activeMods.length > 0) {
        text += ' • MODS: ' + activeMods.join(', ');
      }
      banner.innerText = text;
    } else {
      banner.style.display = 'none';
    }
  });

  renderDashboardMultiplayerCustomizer();
}

function showHostDisconnectModal(customTitle, customMsg) {
  const wasActive = multiplayerActive;
  leaveMultiplayerRoom();
  if (!wasActive) return;

  if (typeof audio !== 'undefined' && audio.stopAllAudio) audio.stopAllAudio();
  if (typeof gameState !== 'undefined' && gameState !== 'START') {
    gameState = 'START';
  }

  const screens = ['screen-multiplayer', 'screen-pause', 'screen-win', 'screen-lose'];
  screens.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.add('hidden');
  });

  const hudEl = document.getElementById('hud-overlay');
  if (hudEl) hudEl.style.display = 'none';

  let modal = document.getElementById('mp-host-disconnect-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'mp-host-disconnect-modal';
    document.body.appendChild(modal);
  }

  const isMob = typeof isMobileDevice === 'function' && isMobileDevice();
  modal.style.cssText = 'position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: var(--mono-bg); border: 1px solid var(--mono-20); box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.88), 0 10px 30px rgba(0, 0, 0, 0.9); padding: 26px 36px; text-align: center; z-index: 700; border-radius: 4px; max-width: 90vw; display: flex; flex-direction: column; align-items: center; gap: 14px;';

  const titleText = customTitle || 'HOST DISCONNECTED';
  const descText = customMsg || 'HOST DISCONNECTED, POSSIBLY DUE TO CONNECTION ISSUES.';

  modal.innerHTML = `
    <div class="tutorial-card-title" style="font-size: 22px; color: var(--red); text-shadow: 0 0 10px rgba(255, 68, 68, 0.6);">${titleText}</div>
    <div style="font-size: 12px; letter-spacing: 1.5px; color: var(--mono-90); text-transform: uppercase; text-align: center; line-height: 1.6; max-width: 420px;">
      ${descText}
    </div>
    <div class="tutorial-card-prompt" style="margin-top: 10px; color: var(--gold);">${isMob ? 'TAP TO RETURN TO MENU' : 'PRESS ANY KEY TO RETURN TO MENU'}</div>
  `;
  modal.style.display = 'flex';

  let canDismiss = false;
  setTimeout(() => {
    canDismiss = true;
  }, 800);

  function onDismiss(e) {
    if (!canDismiss) return;
    window.removeEventListener('keydown', onDismiss);
    window.removeEventListener('pointerdown', onDismiss);
    modal.style.display = 'none';
    if (typeof showScreen === 'function') showScreen('screen-start');
    if (typeof playMenuTheme === 'function') playMenuTheme('menu');
  }

  window.addEventListener('keydown', onDismiss);
  window.addEventListener('pointerdown', onDismiss);
}

function openMultiplayerDroneModal() {
  const modal = document.getElementById('mp-drone-picker-modal');
  const grid = document.getElementById('mp-drone-grid-list');
  if (!modal || !grid) return;

  grid.innerHTML = '';
  const stats = typeof getTrackStats === 'function' ? getTrackStats() : {};
  const currentEquipped = getEquippedGhostSkinId();

  GHOST_SKINS.forEach(d => {
    const isUnlocked = typeof d.checkUnlocked === 'function' ? d.checkUnlocked(stats) : true;
    if (!isUnlocked) return;

    const isSelected = (d.id === currentEquipped);
    const card = document.createElement('div');
    card.className = 'mp-drone-grid-card ' + (isSelected ? 'active' : '');
    card.style.cssText = 'border: 1.5px solid ' + (isSelected ? 'var(--cyan)' : 'var(--mono-20)') + '; background: ' + (isSelected ? 'rgba(0,240,255,0.12)' : 'rgba(0,0,0,0.65)') + '; border-radius: 4px; padding: 12px 8px; display: flex; flex-direction: column; align-items: center; justify-content: center; cursor: pointer; text-align: center; gap: 8px; transition: all 0.15s ease; box-shadow: ' + (isSelected ? '0 0 12px rgba(0,240,255,0.4)' : 'none') + ';';

    card.innerHTML = `
      <div style="display: flex; flex-direction: column; align-items: center; pointer-events: none;">
        <svg width="46" height="18" viewBox="0 0 46 18" style="display:block;">
          <polygon points="23,1 30,17 23,12 16,17" fill="${d.previewColor}" stroke="${d.isGlowing ? '#ffffff' : 'rgba(255,255,255,0.3)'}" stroke-width="1"/>
          <line x1="4" y1="11" x2="42" y2="11" stroke="${d.previewColor}" stroke-width="2.5" stroke-linecap="round"/>
        </svg>
      </div>
      <div style="font-size: 10px; font-weight: 800; letter-spacing: 1px; color: var(--mono); text-transform: uppercase; pointer-events: none;">${d.name}</div>
    `;

    card.onclick = () => {
      grid.querySelectorAll('.mp-drone-grid-card').forEach(el => {
        el.classList.remove('active');
        el.style.borderColor = 'var(--mono-20)';
        el.style.background = 'rgba(0,0,0,0.65)';
        el.style.boxShadow = 'none';
      });
      card.classList.add('active');
      card.style.borderColor = 'var(--cyan)';
      card.style.background = 'rgba(0,240,255,0.12)';
      card.style.boxShadow = '0 0 12px rgba(0,240,255,0.4)';
      equipMultiplayerDrone(d.id);
      document.querySelectorAll('.mp-selected-drone-name').forEach(el => {
        el.innerText = d.name;
      });
    };

    grid.appendChild(card);
  });

  modal.style.display = 'flex';
}

let mpTempCourseId = 'canyon';
let mpTempSubtrack = 'A';
let mpTempIsGp = false;
let mpTempCupId = null;

function openMultiplayerTrackModal() {
  const modal = document.getElementById('mp-track-select-modal');
  if (!modal) return;

  mpTempCourseId = selectedCourseId;
  mpTempSubtrack = selectedSubtrack;
  mpTempIsGp = !!mpGpMode;
  mpTempCupId = mpGpCupId;
  mpTempModifiers = Object.assign({}, mpModifiers);

  let singleList = document.getElementById('mp-single-tracks-list');
  let gpList = document.getElementById('mp-gp-cups-list');
  let optionsCol = document.getElementById('mp-col-options');

  if (!singleList || !gpList || !optionsCol) {
    modal.innerHTML = `
      <div class="menu-screen mp-customize-modal-card" style="position: relative; transform: none; top: auto; left: auto; max-width: 960px; width: 96%; max-height: 92vh; padding: 18px 22px; display: flex; flex-direction: column;">
        <div class="menu-title" style="font-size: 18px; margin-bottom: 2px;">CUSTOMIZE MATCH</div>
        <div class="menu-subtitle" style="margin-bottom: 12px;">SELECT TRACK OR GRAND PRIX AND CONFIGURE MODIFIERS</div>

        <div class="mp-customize-grid" style="display: flex; gap: 14px; width: 100%; flex: 1; min-height: 0; max-height: 65vh; align-items: stretch;">
          <div id="mp-col-single" style="flex: 1.2; min-width: 0; display: flex; flex-direction: column; border-right: 1px solid var(--mono-20); padding-right: 12px;">
            <div style="font-size: 11px; font-weight: 800; letter-spacing: 1.5px; color: var(--cyan); text-transform: uppercase; margin-bottom: 8px; text-align: left;">SINGLE TRACKS</div>
            <div id="mp-single-tracks-list" style="flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 6px; padding-right: 4px;"></div>
          </div>

          <div id="mp-col-gp" style="flex: 1.2; min-width: 0; display: flex; flex-direction: column; border-right: 1px solid var(--mono-20); padding-right: 12px; padding-left: 2px;">
            <div style="font-size: 11px; font-weight: 800; letter-spacing: 1.5px; color: var(--gold); text-transform: uppercase; margin-bottom: 8px; text-align: left;">GRAND PRIX</div>
            <div id="mp-gp-cups-list" style="flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 6px; padding-right: 4px;"></div>
          </div>

          <div id="mp-col-options" style="flex: 1; min-width: 0; display: flex; flex-direction: column; justify-content: space-between; padding-left: 2px; gap: 10px;">
            <div style="display: flex; flex-direction: column; gap: 8px; flex: 1; overflow-y: auto; padding-right: 2px;">
              <div style="font-size: 11px; font-weight: 800; letter-spacing: 1.5px; color: var(--mono); text-transform: uppercase; text-align: left;">SELECTION & MODS</div>
              <div id="mp-selected-summary-box" style="padding: 10px 12px; background: rgba(0,0,0,0.6); border: 1.5px solid var(--mono-20); border-radius: 4px; text-align: left;">
                <div style="font-size: 8.5px; letter-spacing: 1px; color: var(--mono-60); text-transform: uppercase;">CURRENT CHOICE:</div>
                <div id="mp-modal-choice-title" style="font-size: 12px; font-weight: 800; color: var(--cyan); text-transform: uppercase; margin-top: 3px;">CANYON (TRACK A)</div>
                <div id="mp-modal-mods-summary" style="font-size: 9px; color: var(--mono-60); margin-top: 4px;">MODIFIERS: NONE</div>
              </div>
              <button class="mono-btn" id="btn-mp-modifiers-toggle" style="width: 100%; border-color: var(--cyan); color: var(--cyan); font-weight: 800; padding: 8px;">MODIFIERS</button>
              <div id="mp-modifiers-list" style="display: flex; flex-direction: column; gap: 5px;"></div>
            </div>
            <button class="mono-btn" id="btn-mp-track-modal-close" style="width: 100%; border-color: var(--gold); color: var(--gold); font-weight: 900; padding: 11px 20px;">SAVE & CLOSE</button>
          </div>
        </div>
      </div>
    `;
    singleList = document.getElementById('mp-single-tracks-list');
    gpList = document.getElementById('mp-gp-cups-list');
    optionsCol = document.getElementById('mp-col-options');
  }

  const coursesList = [
    { id: 'canyon', name: 'MOUNTAIN CANYONS', img: 'canyon.png', subs: ['A', 'B', 'C', 'D'] },
    { id: 'islands', name: 'SKY ISLANDS', img: 'islands.png', subs: ['A', 'B', 'C'] },
    { id: 'coastal', name: 'COASTAL CLIFFS', img: 'cliffs.png', subs: ['A', 'B', 'C'] },
    { id: 'volcano', name: 'VOLCANIC ISLAND', img: 'volcanomap.png', subs: ['A', 'B', 'C'] },
    { id: 'glacial', name: 'GLACIAL PEAKS', img: 'glacial.png', subs: ['A', 'B', 'C'] },
    { id: 'moon', name: 'THE MOON', img: 'moon.png', subs: ['A', 'B', 'C', 'D'] }
  ];

  const cupsList = (typeof GRAND_PRIX_CUPS !== 'undefined') ? [...GRAND_PRIX_CUPS] : [
    { id: 'sunrise', name: 'Sunrise Cup', image: 'sunrisecup.png', tier: 'Rookie / Cruising', races: [{ courseId: 'canyon', subtrack: 'A' }] },
    { id: 'ember', name: 'Ember Cup', image: 'embercup.png', tier: 'Rookie / Alien', races: [{ courseId: 'volcano', subtrack: 'A' }] },
    { id: 'gale', name: 'Gale Cup', image: 'galecup.png', tier: 'Pro / Sinks', races: [{ courseId: 'canyon', subtrack: 'B' }] },
    { id: 'aether', name: 'Aether Cup', image: 'aethercup.png', tier: 'Pro / Endurance', races: [{ courseId: 'volcano', subtrack: 'B' }] },
    { id: 'odyssey', name: 'Odyssey Cup', image: 'odysseycup.png', tier: 'Master / Marathon', races: [{ courseId: 'canyon', subtrack: 'C' }] },
    { id: 'aphelion', name: 'Aphelion Cup', image: 'aphelioncup.png', tier: 'Aphelion / Finale', races: [{ courseId: 'volcano', subtrack: 'C' }] }
  ];
  cupsList.push({ id: 'shuffle', name: 'Random Shuffle', image: 'randomshuffle.png', tier: '4 Random Tracks' });

  const MOD_DEFINITIONS = [
    { key: 'disableYaw', label: 'NO RUDDER YAW' },
    { key: 'disableAirbrake', label: 'NO AIRBRAKE' },
    { key: 'disablePitchUp', label: 'NO PITCH UP' },
    { key: 'disableRudderBoost', label: 'NO RUDDER BOOST' },
    { key: 'hideHUD', label: 'HIDE HUD / MAP' },
    { key: 'hideThermalVisuals', label: 'HIDE THERMAL PARTICLES' }
  ];

  const updateModalSelectionVisuals = () => {
    const choiceTitle = document.getElementById('mp-modal-choice-title');
    const modsSummary = document.getElementById('mp-modal-mods-summary');
    if (choiceTitle) {
      if (mpTempIsGp) {
        if (mpTempCupId === 'shuffle') {
          choiceTitle.innerText = 'GRAND PRIX: RANDOM SHUFFLE';
        } else {
          const cupDef = cupsList.find(c => c.id === mpTempCupId);
          choiceTitle.innerText = 'GRAND PRIX: ' + (cupDef ? cupDef.name.toUpperCase() : 'CHAMPIONSHIP');
        }
        choiceTitle.style.color = 'var(--gold)';
      } else {
        const cDef = coursesList.find(c => c.id === mpTempCourseId);
        choiceTitle.innerText = (cDef ? cDef.name : mpTempCourseId.toUpperCase()) + ' (TRACK ' + mpTempSubtrack + ')';
        choiceTitle.style.color = 'var(--cyan)';
      }
    }
    if (modsSummary) {
      const activeNames = getActiveModNames(mpTempModifiers);
      modsSummary.innerText = activeNames.length > 0 ? 'MODS: ' + activeNames.join(' • ') : 'MODIFIERS: NONE';
      modsSummary.style.color = activeNames.length > 0 ? 'var(--cyan)' : 'var(--mono-60)';
    }

    if (singleList) {
      singleList.querySelectorAll('.mp-modal-course-card').forEach(card => {
        const cId = card.getAttribute('data-course');
        const isCurrentCourse = (!mpTempIsGp && mpTempCourseId === cId);
        card.style.borderColor = isCurrentCourse ? 'var(--cyan)' : 'var(--mono-20)';
        card.style.background = isCurrentCourse ? 'rgba(0, 240, 255, 0.12)' : 'rgba(0, 0, 0, 0.65)';
        const nameEl = card.querySelector('.mp-course-name');
        if (nameEl) nameEl.style.color = isCurrentCourse ? 'var(--cyan)' : '#ffffff';

        card.querySelectorAll('.sub-pill').forEach(pill => {
          const sId = pill.getAttribute('data-sub');
          const isCurrentSub = isCurrentCourse && (mpTempSubtrack === sId);
          pill.style.borderColor = isCurrentSub ? 'var(--cyan)' : 'var(--mono-20)';
          pill.style.color = isCurrentSub ? 'var(--cyan)' : 'var(--mono-60)';
          pill.style.background = isCurrentSub ? 'rgba(0, 240, 255, 0.25)' : 'rgba(0, 0, 0, 0.4)';
        });
      });
    }

    if (gpList) {
      gpList.querySelectorAll('.mp-modal-cup-card').forEach(card => {
        const cupId = card.getAttribute('data-cup');
        const isCurrentCup = (mpTempIsGp && mpTempCupId === cupId);
        card.style.borderColor = isCurrentCup ? 'var(--gold)' : 'var(--mono-20)';
        card.style.background = isCurrentCup ? 'rgba(241, 196, 15, 0.15)' : 'rgba(0, 0, 0, 0.65)';
        const nameEl = card.querySelector('.mp-cup-name');
        if (nameEl) nameEl.style.color = isCurrentCup ? 'var(--gold)' : '#ffffff';
      });
    }
  };

  singleList.innerHTML = '';
  coursesList.forEach(c => {
    const isCurrentCourse = (!mpTempIsGp && mpTempCourseId === c.id);
    const card = document.createElement('div');
    card.className = 'mp-modal-course-card';
    card.setAttribute('data-course', c.id);
    card.style.cssText = 'border: 1.5px solid ' + (isCurrentCourse ? 'var(--cyan)' : 'var(--mono-20)') + '; background: ' + (isCurrentCourse ? 'rgba(0, 240, 255, 0.12)' : 'rgba(0,0,0,0.65)') + '; border-radius: 4px; padding: 7px 9px; display: flex; flex-direction: column; gap: 5px; cursor: pointer; text-align: left; transition: all 0.15s ease;';

    card.innerHTML = `
      <img src="${c.img}" alt="${c.name}" style="max-height: 40px; max-width: 95%; width: auto; object-fit: contain; pointer-events: none; display: block; margin: 0 auto 4px auto;" onerror="this.style.display='none';">
      <div class="mp-course-name" style="font-size: 10px; font-weight: 800; letter-spacing: 1px; color: ${isCurrentCourse ? 'var(--cyan)' : '#ffffff'}; text-transform: uppercase; text-align: center;">${c.name}</div>
    `;

    const subRow = document.createElement('div');
    subRow.style.cssText = 'display: flex; gap: 4px; width: 100%;';
    c.subs.forEach(sub => {
      const isSubActive = isCurrentCourse && (mpTempSubtrack === sub);
      const subBtn = document.createElement('button');
      subBtn.className = 'mono-btn sub-pill';
      subBtn.setAttribute('data-sub', sub);
      subBtn.style.cssText = 'flex: 1; padding: 3px 0; font-size: 9px; font-weight: 800; border-color: ' + (isSubActive ? 'var(--cyan)' : 'var(--mono-20)') + '; color: ' + (isSubActive ? 'var(--cyan)' : 'var(--mono-60)') + '; background: ' + (isSubActive ? 'rgba(0, 240, 255, 0.25)' : 'rgba(0,0,0,0.4)') + '; text-align: center;';
      subBtn.innerText = sub;
      subBtn.onclick = (e) => {
        e.stopPropagation();
        mpTempIsGp = false;
        mpTempCupId = null;
        mpTempCourseId = c.id;
        mpTempSubtrack = sub;
        updateModalSelectionVisuals();
      };
      subRow.appendChild(subBtn);
    });
    card.appendChild(subRow);

    card.onclick = () => {
      mpTempIsGp = false;
      mpTempCupId = null;
      mpTempCourseId = c.id;
      if (!c.subs.includes(mpTempSubtrack)) mpTempSubtrack = 'A';
      updateModalSelectionVisuals();
    };

    singleList.appendChild(card);
  });

  gpList.innerHTML = '';
  cupsList.forEach(cup => {
    const isCurrentCup = (mpTempIsGp && mpTempCupId === cup.id);
    const card = document.createElement('div');
    card.className = 'mp-modal-cup-card';
    card.setAttribute('data-cup', cup.id);
    card.style.cssText = 'border: 1.5px solid ' + (isCurrentCup ? 'var(--gold)' : 'var(--mono-20)') + '; background: ' + (isCurrentCup ? 'rgba(241, 196, 15, 0.15)' : 'rgba(0,0,0,0.65)') + '; border-radius: 4px; padding: 7px 9px; display: flex; flex-direction: column; cursor: pointer; text-align: left; transition: all 0.15s ease; gap: 2px;';

    card.innerHTML = `
      <img src="${cup.image}" alt="${cup.name}" style="max-height: 40px; max-width: 95%; width: auto; object-fit: contain; pointer-events: none; display: block; margin: 0 auto 4px auto;" onerror="this.style.display='none';">
      <div class="mp-cup-name" style="font-size: 10px; font-weight: 800; letter-spacing: 1px; color: ${isCurrentCup ? 'var(--gold)' : '#ffffff'}; text-transform: uppercase; text-align: center;">${cup.name}</div>
      <div style="font-size: 8px; color: var(--mono-60); text-transform: uppercase; text-align: center;">${cup.tier}</div>
    `;

    card.onclick = () => {
      mpTempIsGp = true;
      mpTempCupId = cup.id;
      if (cup.races && cup.races[0]) {
        mpTempCourseId = cup.races[0].courseId;
        mpTempSubtrack = cup.races[0].subtrack;
      }
      updateModalSelectionVisuals();
    };

    gpList.appendChild(card);
  });

  const modsList = document.getElementById('mp-modifiers-list');
  const btnModToggle = document.getElementById('btn-mp-modifiers-toggle');
  let modsPanelVisible = true;

  const renderModifiersList = () => {
    if (!modsList) return;
    modsList.innerHTML = '';
    MOD_DEFINITIONS.forEach(mod => {
      const isOn = !!mpTempModifiers[mod.key];
      const btn = document.createElement('button');
      btn.className = 'mono-btn';
      btn.style.cssText = 'width: 100%; padding: 5px 8px; font-size: 9px; font-weight: 800; letter-spacing: 0.8px; text-transform: uppercase; text-align: left; display: flex; justify-content: space-between; align-items: center; border-color: ' + (isOn ? 'var(--cyan)' : 'var(--mono-20)') + '; color: ' + (isOn ? 'var(--cyan)' : 'var(--mono-60)') + '; background: ' + (isOn ? 'rgba(0, 240, 255, 0.15)' : 'rgba(0,0,0,0.5)') + ';';
      btn.innerHTML = `<span>${mod.label}</span><span style="font-weight: 900;">${isOn ? '[ON]' : '[OFF]'}</span>`;
      btn.onclick = () => {
        mpTempModifiers[mod.key] = !mpTempModifiers[mod.key];
        renderModifiersList();
        updateModalSelectionVisuals();
      };
      modsList.appendChild(btn);
    });

    const activeCount = Object.values(mpTempModifiers).filter(Boolean).length;
    if (btnModToggle) {
      btnModToggle.innerText = activeCount > 0 ? 'MODIFIERS (' + activeCount + ' ACTIVE)' : 'MODIFIERS';
      btnModToggle.style.color = activeCount > 0 ? 'var(--cyan)' : 'var(--mono)';
      btnModToggle.style.borderColor = activeCount > 0 ? 'var(--cyan)' : 'var(--mono-20)';
    }
  };

  if (btnModToggle) {
    btnModToggle.onclick = () => {
      modsPanelVisible = !modsPanelVisible;
      if (modsList) modsList.style.display = modsPanelVisible ? 'flex' : 'none';
    };
  }

  renderModifiersList();
  updateModalSelectionVisuals();

  const btnClose = document.getElementById('btn-mp-track-modal-close');
  if (btnClose) {
    btnClose.onclick = () => {
      selectedCourseId = mpTempCourseId;
      selectedSubtrack = mpTempSubtrack;
      mpGpMode = mpTempIsGp;
      mpGpCupId = mpTempCupId;
      mpModifiers = Object.assign({}, mpTempModifiers);

      broadcastRoomState(); 
    renderMultiplayerLobby();

    modal.style.display = 'none';

      if (mpGpMode && mpGpCupId === 'shuffle') {
        if (typeof generateRandomShuffleTracks === 'function') {
          shuffleTracksCache = generateRandomShuffleTracks();
          selectedCourseId = shuffleTracksCache[0].courseId;
          selectedSubtrack = shuffleTracksCache[0].subtrack;
        }
      }

      broadcastRoomState();
      renderMultiplayerLobby();

      modal.style.display = 'none';
    };
  }

  modal.style.display = 'flex';
}

function renderDashboardMultiplayerCustomizer() {
  const pfpWrap = document.getElementById('dash-mp-pfp-list');
  const bannerWrap = document.getElementById('dash-mp-banner-list');
  const gliderWrap = document.getElementById('dash-mp-glider-list');
  if (!pfpWrap || !bannerWrap || !gliderWrap) return;

  const prof = getLocalProfile();
  const equippedGlider = (typeof getEquippedSkinId === 'function') ? getEquippedSkinId() : (localStorage.getItem('glider_equipped_skin') || 'default');
  const stats = (typeof getTrackStats === 'function') ? getTrackStats() : {};

  pfpWrap.innerHTML = '';
  const visiblePfps = MP_PFPS.filter(p => !p.devOnly || isDevToolsActive());
  visiblePfps.forEach(p => {
    const isSel = (p.src === prof.pfp);
    const item = document.createElement('div');
    item.className = 'mp-pfp-opt ' + (isSel ? 'active' : '');
    item.style.cssText = 'width: 40px; height: 40px; border-radius: 4px; border: 2px solid ' + (isSel ? 'var(--cyan)' : 'var(--mono-20)') + '; padding: 2px; cursor: pointer; display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,0.6); box-shadow: ' + (isSel ? '0 0 10px rgba(0, 240, 255, 0.6)' : 'none') + '; transition: all 0.15s ease;';

    const img = document.createElement('img');
    img.src = p.src;
    img.alt = p.name;
    img.style.cssText = 'width: 100%; height: 100%; object-fit: contain; border-radius: 2px; display: block;';
    if (p.hasColorPicker) {
      img.style.backgroundColor = prof.pfpColor || '#00f0ff';
    }

    item.appendChild(img);
    item.onclick = () => {
      const cur = getLocalProfile();
      saveLocalProfile(cur.name, p.src, cur.banner, cur.pfpColor);
    };
    pfpWrap.appendChild(item);
  });

  bannerWrap.innerHTML = '';
  const visibleBanners = MP_BANNERS.filter(b => !b.devOnly || isDevToolsActive());
  visibleBanners.forEach(b => {
    const isSel = (b.id === prof.banner);
    const item = document.createElement('div');
    item.className = 'mp-banner-opt ' + (isSel ? 'active' : '');
    item.style.cssText = 'position: relative; width: 100%; aspect-ratio: 512 / 128; max-height: 48px; flex-shrink: 0; border: 2px solid ' + (isSel ? 'var(--cyan)' : 'var(--mono-20)') + '; border-radius: 4px; overflow: hidden; cursor: pointer; transition: all 0.15s ease; background-size: cover; background-position: center; background-image: url(' + b.src + '); box-shadow: ' + (isSel ? '0 0 10px rgba(0, 240, 255, 0.5)' : 'none') + ';';

    item.onclick = () => {
      const cur = getLocalProfile();
      saveLocalProfile(cur.name, cur.pfp, b.id, cur.pfpColor);
    };
    bannerWrap.appendChild(item);
  });

  gliderWrap.innerHTML = '';
  if (typeof GLIDER_SKINS !== 'undefined') {
    GLIDER_SKINS.forEach(g => {
      const isUnlocked = (typeof g.checkUnlocked === 'function') ? g.checkUnlocked(stats) : true;
      if (!isUnlocked) return;
      const isSel = (g.id === equippedGlider);

      const card = document.createElement('div');
      card.className = 'mp-glider-card ' + (isSel ? 'active' : '');
      card.style.cssText = 'padding: 8px 10px; border-radius: 4px; border: 1.5px solid ' + (isSel ? 'var(--cyan)' : 'var(--mono-20)') + '; background: ' + (isSel ? 'rgba(0, 240, 255, 0.12)' : 'rgba(0,0,0,0.6)') + '; cursor: pointer; display: flex; align-items: center; gap: 8px; transition: all 0.15s ease; box-shadow: ' + (isSel ? '0 0 8px rgba(0, 240, 255, 0.4)' : 'none') + ';';

      card.innerHTML = `
        <svg width="28" height="10" viewBox="0 0 46 15" style="display:block; flex-shrink: 0;">
          <path d="M 2,13 Q 23,1 44,13 Q 23,7 2,13 Z" fill="${g.previewColor}" stroke="${g.isGlowing ? '#ffffff' : 'rgba(255,255,255,0.3)'}" stroke-width="1"/>
        </svg>
        <div style="font-size: 9.5px; font-weight: 800; letter-spacing: 1px; color: ${isSel ? 'var(--cyan)' : '#ffffff'}; text-transform: uppercase; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${g.name}</div>
      `;

      card.onclick = () => {
        localStorage.setItem('glider_equipped_skin', g.id);
        if (typeof buildParagliderMesh === 'function') {
          buildParagliderMesh();
        }
        if (multiplayerActive && mpPeer && !mpPeer.destroyed) {
          equipMultiplayerGlider(g.id);
        }
        renderDashboardMultiplayerCustomizer();
      };
      gliderWrap.appendChild(card);
    });
  }
}

function setupMultiplayerUI() {
  updateProfileCardElements();

  document.querySelectorAll('.mp-profile-card').forEach(card => {
    card.onclick = () => {
      openProfileEditModal();
    };
  });

  const btnProfileSave = document.getElementById('btn-profile-save');
  if (btnProfileSave) btnProfileSave.onclick = () => closeProfileEditModal(true);

  const btnProfileClose = document.getElementById('btn-profile-close');
  if (btnProfileClose) btnProfileClose.onclick = () => closeProfileEditModal(false);

  renderDashboardMultiplayerCustomizer();

  document.querySelectorAll('.btn-mp-create-room').forEach(btn => {
    btn.onclick = () => {
      if (typeof isMobileDevice === 'function' && isMobileDevice()) {
        showMobileHostWarning();
      } else {
        createMultiplayerRoom(false);
      }
    };
  });

  document.querySelectorAll('.btn-mp-join-room').forEach(btn => {
    btn.onclick = () => {
      const input = btn.parentElement.querySelector('.mp-join-code-input') || document.getElementById('mp-join-input-dt') || document.getElementById('mp-join-input-mob');
      const val = input ? input.value : '';
      if (input) input.value = '';
      joinMultiplayerRoom(val);
    };
  });

  document.querySelectorAll('.btn-mp-toggle-ready').forEach(btn => {
    btn.onclick = () => {
      toggleMultiplayerReady();
    };
  });

  document.querySelectorAll('.btn-mp-start-race').forEach(btn => {
    let wrap = btn.closest('.mp-start-wrap');
    if (!wrap && btn.parentElement) {
      wrap = document.createElement('div');
      wrap.className = 'mp-start-wrap';
      wrap.style.cssText = 'position: relative; flex: 1.5; display: none;';
      btn.parentElement.insertBefore(wrap, btn);
      wrap.appendChild(btn);

      const menu = document.createElement('div');
      menu.className = 'mp-force-start-menu';
      menu.style.cssText = 'display: none; position: absolute; bottom: calc(100% + 6px); right: 0; left: 0; background: #000000; border: 1.5px solid var(--gold); border-radius: 4px; box-shadow: 0 0 16px rgba(0,0,0,0.95); z-index: 200; padding: 4px;';

      const forceBtn = document.createElement('button');
      forceBtn.className = 'mono-btn btn-mp-force-start';
      forceBtn.style.cssText = 'width: 100%; padding: 8px 10px; border-color: var(--gold); color: var(--gold); font-size: 10px; font-weight: 800; letter-spacing: 1.5px; text-transform: uppercase; background: transparent; cursor: pointer;';
      forceBtn.innerText = 'FORCE START';

      forceBtn.onclick = (e) => {
        e.stopPropagation();
        menu.style.display = 'none';
        if (confirm('Are you sure you want to force start?')) {
          triggerMultiplayerStart(true);
        }
      };

      menu.appendChild(forceBtn);
      wrap.appendChild(menu);
    }

    btn.style.width = '100%';
    btn.onclick = (e) => {
      e.stopPropagation();
      const wrap = btn.closest('.mp-start-wrap');
      const menu = wrap ? wrap.querySelector('.mp-force-start-menu') : null;
      const isAllReady = btn.getAttribute('data-allready') === 'true';

      if (isAllReady) {
        if (menu) menu.style.display = 'none';
        triggerMultiplayerStart(false);
      } else {
        if (menu) {
          const isOpen = menu.style.display === 'block';
          document.querySelectorAll('.mp-force-start-menu').forEach(m => { m.style.display = 'none'; });
          menu.style.display = isOpen ? 'none' : 'block';
        }
      }
    };
  });

  window.addEventListener('click', () => {
    document.querySelectorAll('.mp-force-start-menu').forEach(m => { m.style.display = 'none'; });
  });

  document.querySelectorAll('.btn-mp-leave-room').forEach(btn => {
    btn.onclick = () => {
      leaveMultiplayerRoom();
    };
  });

  document.querySelectorAll('.mp-room-code-display').forEach(el => {
    el.onclick = () => {
      if (mpRoomCode) {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(mpRoomCode).then(() => {
            setMultiplayerStatus('CODE ' + mpRoomCode + ' COPIED');
          });
        }
      }
    };
  });

  document.querySelectorAll('.btn-mp-open-drone-picker').forEach(btn => {
    btn.onclick = () => {
      openMultiplayerDroneModal();
    };
  });

  const btnCloseMpDrone = document.getElementById('btn-mp-drone-modal-close');
  if (btnCloseMpDrone) {
    btnCloseMpDrone.onclick = () => {
      const modal = document.getElementById('mp-drone-picker-modal');
      if (modal) modal.style.display = 'none';
    };
  }

  document.querySelectorAll('.btn-mp-open-track-select').forEach(btn => {
    btn.onclick = () => {
      openMultiplayerTrackModal();
    };
  });

  const btnCloseMpTrack = document.getElementById('btn-mp-track-modal-close');
  if (btnCloseMpTrack) {
    btnCloseMpTrack.onclick = () => {
      selectedCourseId = mpTempCourseId;
      selectedSubtrack = mpTempSubtrack;
      mpGpMode = mpTempIsGp;
      mpGpCupId = mpTempCupId;

      if (mpGpMode && mpGpCupId === 'shuffle') {
        if (typeof generateRandomShuffleTracks === 'function') {
          shuffleTracksCache = generateRandomShuffleTracks();
          selectedCourseId = shuffleTracksCache[0].courseId;
          selectedSubtrack = shuffleTracksCache[0].subtrack;
        }
      }

      broadcastRoomState();
      renderMultiplayerLobby();

      const modal = document.getElementById('mp-track-select-modal');
      if (modal) modal.style.display = 'none';
    };
  }
}

function createMatchOverviewElements() {
  let overlay = document.getElementById('mp-match-overview-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'mp-match-overview-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.72);backdrop-filter:blur(5px);-webkit-backdrop-filter:blur(5px);z-index:670;display:none;align-items:center;justify-content:center;pointer-events:auto;';
    overlay.onclick = (e) => {
      if (e.target === overlay) toggleMatchOverview();
    };

    const card = document.createElement('div');
    card.className = 'menu-screen mp-match-overview-card';
    card.style.cssText = 'position:relative;transform:none;top:auto;left:auto;max-width:650px;width:92%;max-height:85vh;padding:24px 28px;border:1.5px solid var(--mono-20);background:var(--mono-bg);border-radius:4px;box-shadow:0 10px 40px rgba(0,0,0,0.95);display:flex;flex-direction:column;align-items:center;';

    card.innerHTML = `
      <div class="menu-title" style="margin-bottom: 2px;">MATCH OVERVIEW</div>
      <div class="menu-subtitle mp-match-room-code" style="margin-bottom: 14px;">ROOM: ----</div>
      <div id="mp-match-overview-rows" style="display: flex; flex-direction: column; gap: 8px; width: 100%; max-height: 52vh; overflow-y: auto;"></div>
      <div style="font-size: 10px; letter-spacing: 1.5px; color: var(--mono-60); text-align: center; margin-top: 14px; text-transform: uppercase;">PRESS [TAB] TO CLOSE</div>
    `;

    overlay.appendChild(card);
    document.body.appendChild(overlay);
  }
}

function renderMatchOverview() {
  createMatchOverviewElements();
  const overlay = document.getElementById('mp-match-overview-overlay');
  if (!overlay) return;
  const roomCodeEl = overlay.querySelector('.mp-match-room-code');
  if (roomCodeEl) roomCodeEl.innerText = `ROOM: ${mpRoomCode || '----'}`;

  const rowsContainer = document.getElementById('mp-match-overview-rows');
  if (!rowsContainer) return;
  rowsContainer.innerHTML = '';

  const pList = Object.values(mpPlayers).filter(p => !p.isDedicatedServer);
  pList.sort((a, b) => (mpPlayerWins[b.id] || 0) - (mpPlayerWins[a.id] || 0));

  pList.forEach(p => {
    const prof = p.profile || { name: 'PILOT', pfp: 'nopfpequiped.png', banner: 'default' };
    const bDef = MP_BANNERS.find(b => b.id === prof.banner) || MP_BANNERS[0];
    const pfpDef = MP_PFPS.find(x => x.src === prof.pfp);
    const bgColor = (pfpDef && pfpDef.hasColorPicker) ? (prof.pfpColor || '#00f0ff') : 'rgba(0,0,0,0.55)';
    const isMe = mpPeer && p.id === mpPeer.id;
    const pData = mpPlayers[p.id] || p;
    const gSkin = pData.gliderSkinId || (isMe ? (typeof getEquippedSkinId === 'function' ? getEquippedSkinId() : 'default') : 'default');
    const pilotColor = (mpGpMode && typeof getPlayerGliderColor === 'function') ? getPlayerGliderColor(gSkin) : '#ffffff';

    let pStatus = 'RACING';
    if (p.isSpectator) pStatus = 'SPECTATING';
    else if (mpFinishedRacers.has(p.id)) pStatus = 'FINISHED';
    else if (p.gate) pStatus = `GATE ${p.gate}`;
    else pStatus = 'WAITING';

    const playerPing = (mpPlayerPings[p.id] !== undefined) ? `${mpPlayerPings[p.id]} MS` : (p.isHost ? '0 MS' : '-- MS');

    const card = document.createElement('div');
    card.style.cssText = `width: 100%; aspect-ratio: 512 / 128; min-height: 60px; background-image: url('${bDef.src}'); background-size: 100% 100%; background-position: center; border: 1.5px solid ${bDef.color}; border-radius: 4px; padding: 6px 10px; display: flex; align-items: flex-start; justify-content: space-between; box-sizing: border-box; gap: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.8);`;

    card.innerHTML = `
      <div style="display: flex; align-items: center; gap: 8px; min-width: 0; flex: 1;">
        <img src="${prof.pfp || 'nopfpequiped.png'}" style="width: 30px; height: 30px; border-radius: 4px; object-fit: contain; background: ${bgColor}; flex-shrink: 0; box-shadow: 0 2px 6px rgba(0,0,0,0.8);">
        <div style="min-width: 0; text-align: left; background: rgba(0, 0, 0, 0.65); border: 1px solid rgba(255, 255, 255, 0.15); border-radius: 3px; padding: 2px 7px;">
          <div style="font-size: 11px; font-weight: 900; letter-spacing: 1.2px; color: ${pilotColor}; text-shadow: 0 0 8px rgba(0,0,0,0.95), 0 2px 4px rgba(0,0,0,0.9); text-transform: uppercase; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
            ${prof.name} ${p.isHost ? '<span style="color: var(--gold); font-size: 8.5px; font-weight: 800;">★ HOST</span>' : ''} ${isMe ? '<span style="color: rgba(255,255,255,0.7); font-size: 8px;">(YOU)</span>' : ''}
          </div>
        </div>
      </div>
      <div style="display: flex; align-items: center; gap: 6px; flex-shrink: 0;">
        <span style="font-size: 9.5px; font-weight: 800; letter-spacing: 1px; color: var(--gold); background: rgba(0,0,0,0.75); padding: 3px 6px; border-radius: 3px; border: 1px solid var(--gold); text-shadow: 0 1px 3px rgba(0,0,0,0.9);">
          [W: ${mpPlayerWins[p.id] || 0}]
        </span>
        <span style="font-size: 9.5px; font-weight: 800; letter-spacing: 1px; color: #39ff14; background: rgba(0,0,0,0.75); padding: 3px 6px; border-radius: 3px; border: 1px solid rgba(57, 255, 20, 0.4); text-shadow: 0 1px 3px rgba(0,0,0,0.9);">
          [${playerPing}]
        </span>
        <span style="font-size: 9.5px; font-weight: 800; letter-spacing: 1px; color: var(--cyan); background: rgba(0,0,0,0.75); padding: 3px 6px; border-radius: 3px; border: 1px solid var(--mono-20); text-shadow: 0 1px 3px rgba(0,0,0,0.9);">
          [${pStatus}]
        </span>
        ${(isMultiplayerHost && !p.isHost) ? `
          <div style="position: relative; display: inline-block;">
            <button class="mono-btn mp-match-dots-btn" data-peerid="${p.id}" style="background: rgba(255, 255, 255, 0.15); border: 1.5px solid var(--mono-20); color: #ffffff; font-size: 13px; font-weight: 900; line-height: 1; padding: 2px 7px; border-radius: 3px; cursor: pointer;">⋮</button>
            <div class="mp-match-action-menu" id="mp-match-menu-${p.id}" style="display: none; position: absolute; top: calc(100% + 4px); right: 0; background: #000000; border: 1.5px solid var(--mono-20); border-radius: 4px; box-shadow: 0 6px 18px rgba(0,0,0,0.95); z-index: 700; min-width: 90px; overflow: hidden;">
              <button class="mp-match-kick-opt" data-peerid="${p.id}" style="width: 100%; padding: 8px 12px; background: transparent; border: none; border-bottom: 1px solid var(--mono-20); color: #ff8888; font-family: inherit; font-size: 10px; font-weight: 800; letter-spacing: 1px; text-transform: uppercase; text-align: left; cursor: pointer;">KICK</button>
              <button class="mp-match-ban-opt" data-peerid="${p.id}" style="width: 100%; padding: 8px 12px; background: transparent; border: none; color: var(--red); font-family: inherit; font-size: 10px; font-weight: 800; letter-spacing: 1px; text-transform: uppercase; text-align: left; cursor: pointer;">BAN</button>
            </div>
          </div>
        ` : ''}
      </div>
    `;

    rowsContainer.appendChild(card);
  });

  rowsContainer.querySelectorAll('.mp-match-dots-btn').forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const targetId = btn.getAttribute('data-peerid');
      const menu = document.getElementById('mp-match-menu-' + targetId);
      const wasOpen = menu && menu.style.display === 'block';
      rowsContainer.querySelectorAll('.mp-match-action-menu').forEach(m => { m.style.display = 'none'; });
      if (menu && !wasOpen) menu.style.display = 'block';
    };
  });

  rowsContainer.querySelectorAll('.mp-match-kick-opt').forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      rowsContainer.querySelectorAll('.mp-match-action-menu').forEach(m => { m.style.display = 'none'; });
      const targetId = btn.getAttribute('data-peerid');
      if (!targetId || !mpPlayers[targetId]) return;
      const pName = (mpPlayers[targetId].profile && mpPlayers[targetId].profile.name) || 'PILOT';
      if (confirm('Are you sure you want to kick ' + pName + '?')) {
        kickPlayer(targetId);
      }
    };
  });

  rowsContainer.querySelectorAll('.mp-match-ban-opt').forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      rowsContainer.querySelectorAll('.mp-match-action-menu').forEach(m => { m.style.display = 'none'; });
      const targetId = btn.getAttribute('data-peerid');
      if (!targetId || !mpPlayers[targetId]) return;
      const pName = (mpPlayers[targetId].profile && mpPlayers[targetId].profile.name) || 'PILOT';
      if (confirm('Are you sure you want to BAN ' + pName + ' from this session?')) {
        banPlayer(targetId);
      }
    };
  });
}

function toggleMatchOverview() {
  if (!multiplayerActive) return;
  mpTacticalOverlayOpen = !mpTacticalOverlayOpen;
  createMatchOverviewElements();
  const el = document.getElementById('mp-match-overview-overlay');
  if (el) {
    if (mpTacticalOverlayOpen) {
      renderMatchOverview();
      el.style.display = 'flex';
    } else {
      el.style.display = 'none';
      document.querySelectorAll('.mp-match-action-menu').forEach(m => { m.style.display = 'none'; });
    }
  }
}

function updateServerPlayersButton() {
  let btn = document.getElementById('mp-server-players-btn');
  if (!btn) {
    btn = document.createElement('button');
    btn.id = 'mp-server-players-btn';
    btn.className = 'mono-btn';
    btn.style.cssText = 'position:fixed;top:18px;right:80px;z-index:500;font-size:11px;font-weight:800;letter-spacing:1.5px;border-color:var(--cyan);color:var(--cyan);background:rgba(0,0,0,0.85);padding:6px 14px;border-radius:3px;display:none;cursor:pointer;';
    btn.innerText = 'PLAYERS';
    btn.onclick = () => toggleMatchOverview();
    document.body.appendChild(btn);
  }
  const showBtn = multiplayerActive && mpIsDedicatedServer && (gameState === 'RACING' || gameState === 'RUNUP' || mpIsSpectating);
  btn.style.display = showBtn ? 'block' : 'none';
}

window.addEventListener('load', () => {
  setupMultiplayerUI();
});