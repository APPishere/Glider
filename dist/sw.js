const CACHE_NAME = 'glider-cache-v5';

const ASSETS = [
  // Core Files
  './',
  './index.html',
  './manifest.json',
  './icon.png',
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
  './input_file_1.png',

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
  './input_file_8.png',
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
  './input_file_4.png',
  './halloweenminimap.png',
  './input_file_9.png',
  './pumpkin.png',
  './cornercobweb.png',
  './input_file_5.png',
  './bigcobweb.png',
  './input_file_3.png',
  './halloweenfence.png',
  './input_file_6.png',
  './halloweenfence2.png',
  './input_file_7.png',
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
    caches.open(CACHE_NAME).then((cache) => {
      console.log('Caching all Glider assets for offline play');
      return cache.addAll(ASSETS);
    }).catch((err) => {
      console.error('Failed to cache some assets. Check your filenames!', err);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('Clearing old cache', key);
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then((response) => {
      return response || fetch(e.request);
    })
  );
});