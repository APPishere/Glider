const CACHE_NAME = 'glider-cache-v36';

const CORE_ASSETS = [
  './',
  './index.html',
  './style.css',
  './manifest.json',
  './icon.png',
  './js/core.js',
  './js/game.js',
  './js/ui.js',
  './js/tutorial.js',
  './js/multiplayer.js',
  './aphelionlogo.png',
  './gliderfontthing.png',
  './glidercurser.png',
  './glidercurser_select.png',
  'https://cdn.jsdelivr.net/npm/three@0.152.0/build/three.min.js',
  'https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js'
];

const EXTRA_ASSETS = [
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
  './jingle64.mp3',
  './jingle64-2.mp3',
  './jingle64-3.mp3',
  './jingle64-4.mp3',
  './jingle64-5.mp3',
  './jingle64-6.mp3',
  './jingle64-8.mp3',
  './Keycurser.png',
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
  './gliderfonthting2.png',
  './singletrack.png',
  './grandprix.png',
  './challenges.png',
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
  './topleftstats.png',
  './bottomhud.png',
  './theme2minimap.png',
  './stuntsbutton.png',
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
  './Grandprixtrophy.png',
  './Tvturnedoff.gif',
  './brokenTV.png',
  './jukebox.png',
  './musicdiscdefault.png',
  './musicdisc64.png',
  './suspiciousfella.gif',
  './love.gif',
  './maneatingburg.gif',
  './skulltv.png',
  './suspiciousfellaloop.gif',
  './what_a_concept.gif',
  './gliderdefaultbanner.png',
  './blockBanner.png',
  './pigbanner.png',
  './moonbanner.png',
  './fishbanner.png',
  './akane.png',
  './victoriusBanner.png',
  './aphelionapexname.png',
  './devtoolsonly.png',
  './nopfpequiped.png',
  './boatPFP.png',
  './gliderPFPrga.png',
  './RGBglider64PFP.png',
  './victoriusPFP.png',
  './emptypfp.png',
  './krakenPFP.png',
  './wavesPFP.png',
  './gliderinair.png',
  './susguyPFP.png',
  './MeatyCrismson.png',
  './mobilePortPFP.png',
  './deterious mind.png',
  './bigblueheart.png',
  './akanePFP.png',
  './TriStar.png',
  './artistpfp1.png',
  './artistpfp2.png',
  './aphelionapexlogo.png',
  './thatsallfools.png',
  './halloweenbar.png',
  './halloweenminimap.png',
  './pumpkin.png',
  './cornercobweb.png',
  './bigcobweb.png',
  './halloweenfence.png',
  './halloweenfence2.png',
  './filter.png',
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
  './present.png',
  './gliderbirdbackground.png',
  './FlappyGlider.png',
  './chimneytopclosed.png',
  './brickwallforflappyglider.png',
  './chimneytop.png'
];

function delayMs(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function precacheExtrasSlowly() {
  await delayMs(2000);
  const cache = await caches.open(CACHE_NAME);
  for (let i = 0; i < EXTRA_ASSETS.length; i += 2) {
    const batch = EXTRA_ASSETS.slice(i, i + 2);
    await Promise.all(
      batch.map(async (url) => {
        try {
          const hit = await cache.match(url, { ignoreSearch: true });
          if (!hit) {
            await cache.add(url);
          }
        } catch (err) {}
      })
    );
    await delayMs(200);
  }
}

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      await Promise.all(
        CORE_ASSETS.map((url) => cache.add(url).catch(() => {}))
      );
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map(k => k !== CACHE_NAME ? caches.delete(k) : null));
    await self.clients.claim();
    await precacheExtrasSlowly().catch(() => {});   
  })());
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

function fetchWithTimeout(request, ms) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return fetch(request, { signal: controller.signal }).finally(() => clearTimeout(timer));
}

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);

  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetchWithTimeout(e.request, 5000)
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((c) => c.put(e.request, copy));
          }
          return res;
        })
        .catch(async () => {
          return (await caches.match('./index.html')) || (await caches.match('./'));
        })
    );
    return;
  }

if (url.origin === self.location.origin && /\.(js|css|html)$/.test(url.pathname)) {
  e.respondWith(
    fetchWithTimeout(e.request, 5000)  
      .then((res) => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(e.request, copy));
        }
        return res;
      })
      .catch(async () => {
        const exact = await caches.match(e.request);
        if (exact) return exact;
        const loose = await caches.match(e.request, { ignoreSearch: true });
        if (loose) return loose;
        return new Response('', { status: 504, statusText: 'Offline' });
      })
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
      return fetch(e.request)
        .then((res) => {
          if (res && res.status === 200 && (url.origin === self.location.origin || url.hostname.includes('cdn.jsdelivr.net') || url.hostname.includes('unpkg.com'))) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((c) => c.put(e.request, copy));
          }
          return res;
        })
        .catch(() => new Response('', { status: 404, statusText: 'Not Found' }));
    })
  );
});