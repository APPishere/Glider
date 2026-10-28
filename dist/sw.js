const CACHE_NAME = 'glider-cache-v10';

function isHalloweenSeason() {
  const md = (new Date().getMonth() + 1) * 100 + new Date().getDate();
  return md >= 1027 && md <= 1102;
}
function isChristmasSeason() {
  const md = (new Date().getMonth() + 1) * 100 + new Date().getDate();
  return (md >= 1220 && md <= 1231) || (md === 101);
}

const ASSETS = [
  // CORE very important files no check these files bad bad
  './',
  './index.html',
  './style.css',
  './manifest.json',
  './sw.js',
  './icon.png',
  './js/core.js',
  './js/game.js',
  './js/ui.js',
  'https://cdn.jsdelivr.net/npm/three@0.152.0/build/three.min.js',

  // Audio Files
  './startup.mp3',
  './intro64.mp3',
  './impossible_mode_unlock.mp3',
  './Glider_Menu_Theme_v2.wav',
  './glidermenutheme2.wav',
  './elevatorshopmusic.wav',
  './escmusicglider2.mp3',
  './okayithinkthisisdone.mp3',
  './shopmenumusic2.mp3',
  './creditsgliderscreen.mp3',
  './interact1.mp3',
  './interact 2.mp3',
  './interact 3.mp3',
  './interact 4.mp3',

  // Cursors
  './glidercurser.png',
  './glidercurser_select.png',
  './Keycurser.png',

  // Mobile Controls 
  './rudderleft.png',
  './rudderRight.png',
  './rudderleftclick.png',
  './rudderrightclick.png',
  './breakbutton.png',
  './D-pad.png',
  './dpadright.png',
  './dpaddownright.png',
  './dpaddown.png',
  './dpaddownleft.png',
  './dpadleft.png',
  './dpadupleft.png',
  './Dpadup.png',
  './dpadupright.png',

  // Menu Images
  './gliderfontthing.png',
  './aphelionlogo.png',
  './singletrack.png',
  './grandprix.png',
  './canyon.png',
  './islands.png',
  './cliffs.png',
  './volcanomap.png',
  './glacial.png',
  './moon.png',
  './shop.png',
  './flightcontrols.png',
  './randomshuffle.png',
  './sunrisecup.png',
  './embercup.png',
  './galecup.png',
  './aethercup.png',
  './odysseycup.png',
  './aphelioncup.png',

  // In Game Assets
  './finishbanner.png',
  './finish.png',
  './lessthan1stbanner.png',
  './1stplace.png',
  './2ndplace.png',
  './3rdplace.png',
  './4thplace.png',
  './5thplace.png',
  './2ndplacefinish.png',
  './3rdplacefinish.png',
  './4thplacefinish.png',
  './5thplacefinish.png',
  './upcomingevent.gif',
  './speed.png',
  './speedemeterpointer2.png',
  './bluering.png',
  './grayring.png',
  './16-bit_chaser_back.gif',
  './16_bite_glider_top.png',
  './16_bite_glider_left.png',
  './16_bite_glider_right.png',
  './unlockedmessage.png',
  './gratestgliderunlockimage.png',
  './aphelionapex.png',

  // TV / Jukebox / Shop
  './jukebox.png',
  './musicdiscdefault.png',
  './musicdisc64.png',
  './suspiciousfella.gif',
  './love.gif',
  './maneatingburg.gif',
  './skulltv.png',
  './suspiciousfellaloop.gif',
  './what_a_concept.gif',

  // Halloween Assets
  './halloweenbar.png',
  './halloweenminimap.png',
  './pumpkin.png',
  './cornercobweb.png',
  './bigcobweb.png',
  './halloweenfence.png',
  './halloweenfence2.png',
  './filter.png',

  // Credits
  './gamedirector.png',
  './theapp_herename.png',
  './leadprogramming.png',
  './phyicsandaero.png',
  './uiuxdesgin.png',
  './glidercanopyanddrone.png',
  './flightharnesanimation.png',
  './aphleionsaveencoder.png',
  './defaultOST.png',
  './artand16bitvis.png',
  './konekofirename.gif',
  './2dsprites.png',
  './konekofirename2.png',
  './glider64disc2.png',
  './seniorflightsaftey.png',
  './LeadQA.png',
  './doge_notdetectedname.png',
  './juniorplay.png',
  './rip_n00bname.png',
  './foxbutbettername.png',
  './specialthankseveryone.png',

  // Christmas Assets
  './present.png',
  './gliderbirdbackground.png',
  './FlappyGlider.png',
  './chimneytopclosed.png',
  './brickwallforflappyglider.png',
  './chimneytop.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      console.log('Caching Glider assets...');
      await Promise.all(
        ASSETS.map((url) =>
          cache.add(url).catch((err) => {
            console.warn(`Could not cache asset: ${url}`, err);
          })
        )
      );
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('Deleting old cache:', key);
            return caches.delete(key);
          }
        })
      )
    )
  );
  self.clients.claim();
});

async function handleRangeRequest(request, cachedResponse) {
  const rangeHeader = request.headers.get('range');
  if (!rangeHeader) return cachedResponse;

  const arrayBuffer = await cachedResponse.arrayBuffer();
  const bytes = rangeHeader.replace(/bytes=/, '').split('-');
  const start = parseInt(bytes[0], 10);
  const end = bytes[1] ? parseInt(bytes[1], 10) : arrayBuffer.byteLength - 1;
  const slicedBuffer = arrayBuffer.slice(start, end + 1);

  return new Response(slicedBuffer, {
    status: 206,
    statusText: 'Partial Content',
    headers: {
      ...Object.fromEntries(cachedResponse.headers.entries()),
      'Content-Range': `bytes ${start}-${end}/${arrayBuffer.byteLength}`,
      'Content-Length': slicedBuffer.byteLength,
      'Accept-Ranges': 'bytes'
    }
  });
}

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request).catch(() => caches.match('./index.html') || caches.match('./'))
    );
    return;
  }

  if (url.origin === self.location.origin && /\.(js|css|html)$/.test(url.pathname)) {
    e.respondWith(
      fetch(e.request)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((c) => c.put(e.request, copy));
          }
          return res;
        })
        .catch(() => caches.match(e.request, { ignoreSearch: true }))
    );
    return;
  }

  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then(async (cachedResponse) => {
      if (cachedResponse) {
        if (e.request.headers.get('range')) {
          return handleRangeRequest(e.request, cachedResponse);
        }
        return cachedResponse;
      }
      return fetch(e.request);
    })
  );
});