// ==UserScript==
// @name         Feed Filter
// @namespace    feed-filter
// @version      1.0.0
// @description  Facebook/Instagram: text-only (photos and videos blacked out, Reels/Explore/Watch blocked). YouTube: home feed and Shorts blocked.
// @match        *://*.facebook.com/*
// @match        *://*.instagram.com/*
// @match        *://*.youtube.com/*
// @run-at       document-start
// @noframes
// @grant        none
// @updateURL    https://iwanttomlb-collab.github.io/feed-filter/feed-filter.user.js
// @downloadURL  https://iwanttomlb-collab.github.io/feed-filter/feed-filter.user.js
// ==/UserScript==

(function () {
  'use strict';

  const host = location.hostname;
  const SITE = host.endsWith('youtube.com') ? 'yt'
    : host.endsWith('instagram.com') ? 'ig'
    : host.endsWith('facebook.com') ? 'fb'
    : null;
  if (!SITE) return;

  // FB and IG: text-only mode. YouTube: normal media, only home + Shorts blocked.
  const TEXT_ONLY = SITE === 'fb' || SITE === 'ig';

  // Images at or below this rendered size (px, both sides) stay visible: avatars, icons, emoji.
  const SMALL = 88;

  const root = document.documentElement;
  if (TEXT_ONLY) root.classList.add('ff-text');

  // ---------- Elements turned into solid black boxes (not clickable) ----------
  const BOX = {
    yt: [
      // Shorts shelves and items (mobile m.youtube.com + desktop)
      'ytm-reel-shelf-renderer',
      'ytd-reel-shelf-renderer',
      'ytd-rich-shelf-renderer[is-shorts]',
      'ytm-shorts-lockup-view-model',
      'ytm-shorts-lockup-view-model-v2',
      'grid-shelf-view-model:has(a[href^="/shorts/"])',
      'ytm-rich-section-renderer:has(a[href^="/shorts/"])',
      'ytd-rich-section-renderer:has(a[href^="/shorts/"])',
      'ytm-rich-item-renderer:has(a[href^="/shorts/"])',
      'ytd-rich-item-renderer:has(a[href^="/shorts/"])',
      'ytm-video-with-context-renderer:has(a[href^="/shorts/"])',
      'ytm-compact-video-renderer:has(a[href^="/shorts/"])',
      'ytd-video-renderer:has(a[href^="/shorts/"])',
      'ytd-grid-video-renderer:has(a[href^="/shorts/"])',
      'ytd-compact-video-renderer:has(a[href^="/shorts/"])',
      // Shorts nav buttons and channel tab
      'ytm-pivot-bar-item-renderer:has(.pivot-shorts)',
      'ytm-pivot-bar-item-renderer:has(a[href^="/shorts"])',
      'ytd-guide-entry-renderer:has(a[title="Shorts"])',
      'ytd-mini-guide-entry-renderer[aria-label="Shorts"]',
      'yt-tab-shape[tab-title="Shorts"]',
      'a[href^="/shorts/"]',
      'a[href$="/shorts"]',
    ],
    ig: [
      'a[href*="/reels/"]',
      'a[href*="/reel/"]',
      // Explore grid (the Explore page itself stays open so its search box still works)
      'html[data-ff-ig-explore] main a[href^="/p/"]',
      'html[data-ff-ig-explore] main a[href*="/reel/"]',
    ],
    fb: [
      'a[href*="/reel/"]',
      'a[href*="/reels/"]',
      'a[href*="/watch"]',
      '[aria-label="Reels"]',
      '[aria-label="Video"]',
      '[aria-label="連續短片"]',
      '[aria-label="影片"]',
    ],
  }[SITE];

  // ---------- Pages fully covered by a black screen ----------
  function blockedPage() {
    const p = location.pathname;
    if (SITE === 'yt') {
      if (p.startsWith('/shorts')) return 'Shorts blocked';
    }
    if (SITE === 'ig') {
      // /reels/, /reel/ID, and a profile's Reels tab (/name/reels/)
      if (p.startsWith('/reel') || p.includes('/reels')) return 'Reels blocked';
    }
    if (SITE === 'fb') {
      if (p.startsWith('/reel') || p.includes('/reels')) return 'Reels blocked';
      if (p.startsWith('/watch') || p.startsWith('/video')) return 'Video tab blocked';
    }
    return null;
  }

  const isYtHome = () => SITE === 'yt' && location.pathname === '/';

  // ---------- CSS (injected before the page draws) ----------
  const boxSel = ':is(' + BOX.join(',') + ')';
  const css = `
    ${boxSel} {
      background: #000 !important;
      pointer-events: none !important;
      border-radius: 6px !important;
    }
    ${boxSel} * { visibility: hidden !important; }

    /* Text-only: every image/video starts black; small ones get data-ff-keep from JS. */
    html.ff-text img:not([data-ff-keep]),
    html.ff-text video,
    html.ff-text [data-ff-black] {
      filter: brightness(0) !important;
    }
    html.ff-text video { pointer-events: none !important; }
    html.ff-text [data-ff-bgtext] {
      background-image: none !important;
      background-color: #000 !important;
    }
    html.ff-text [data-ff-bgtext] * { color: #fff !important; }

    /* YouTube home feed: replaced by a black panel; header + search still work. */
    html[data-ff-yt-home] ytm-browse > *,
    html[data-ff-yt-home] ytd-browse[page-subtype="home"] > * {
      display: none !important;
    }
    html[data-ff-yt-home] ytm-browse,
    html[data-ff-yt-home] ytd-browse[page-subtype="home"] {
      background: #000 !important;
      min-height: 100vh !important;
    }
    html[data-ff-yt-home] ytm-browse::before,
    html[data-ff-yt-home] ytd-browse[page-subtype="home"]::before {
      content: "Home feed blocked. Use search or Subscriptions.";
      display: block;
      padding: 40px 20px;
      color: #888;
      font: 15px/1.4 -apple-system, system-ui, sans-serif;
      text-align: center;
    }

    #ff-overlay {
      position: fixed; inset: 0; z-index: 2147483647;
      background: #000; color: #888;
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      gap: 18px; font: 16px/1.4 -apple-system, system-ui, sans-serif;
    }
    #ff-overlay a {
      color: #ddd; text-decoration: none; padding: 10px 18px;
      border: 1px solid #444; border-radius: 8px;
    }
  `;

  function injectCss() {
    if (document.getElementById('ff-style')) return;
    const style = document.createElement('style');
    style.id = 'ff-style';
    style.textContent = css;
    (document.head || root).appendChild(style);
  }
  injectCss();

  // ---------- Full-screen block for blocked pages ----------
  function homeLink() {
    return SITE === 'yt' ? '/feed/subscriptions' : '/';
  }

  function updateOverlay() {
    const reason = blockedPage();
    let ov = document.getElementById('ff-overlay');
    if (reason) {
      if (!ov) {
        ov = document.createElement('div');
        ov.id = 'ff-overlay';
        const msg = document.createElement('div');
        const link = document.createElement('a');
        link.href = homeLink();
        link.textContent = SITE === 'yt' ? 'Go to Subscriptions' : 'Go to feed';
        ov.append(msg, link);
        root.appendChild(ov);
      }
      ov.firstChild.textContent = reason;
    } else if (ov) {
      ov.remove();
    }
    setFlag('data-ff-yt-home', isYtHome());
    setFlag('data-ff-ig-explore', SITE === 'ig' && /^\/explore\/?$/.test(location.pathname));
  }

  function setFlag(name, on) {
    if (on && !root.hasAttribute(name)) root.setAttribute(name, '');
    if (!on && root.hasAttribute(name)) root.removeAttribute(name);
  }

  // ---------- Video control ----------
  function shouldStopVideo() {
    return TEXT_ONLY || !!blockedPage() || isYtHome();
  }

  function stopVideo(v) {
    try {
      v.muted = true;
      if (!v.paused) v.pause();
    } catch (e) { /* ignore */ }
  }

  document.addEventListener('play', (e) => {
    if (e.target instanceof HTMLMediaElement && shouldStopVideo()) stopVideo(e.target);
  }, true);
  document.addEventListener('playing', (e) => {
    if (e.target instanceof HTMLMediaElement && shouldStopVideo()) stopVideo(e.target);
  }, true);

  // ---------- Text-only image handling (FB/IG) ----------
  function isSmall(el) {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && r.width <= SMALL && r.height <= SMALL;
  }

  function setAttr(el, name, on) {
    if (on && !el.hasAttribute(name)) el.setAttribute(name, '');
    if (!on && el.hasAttribute(name)) el.removeAttribute(name);
  }

  function scanMedia() {
    // Read all sizes first, then write, so the page is laid out only once per scan.
    const writes = [];

    document.querySelectorAll('img').forEach((img) => {
      writes.push([img, 'data-ff-keep', isSmall(img)]);
    });

    // SVG <image> (FB uses these for avatars and some thumbnails): black out the whole svg if large.
    document.querySelectorAll('svg image').forEach((im) => {
      const svg = im.ownerSVGElement;
      if (svg) writes.push([svg, 'data-ff-black', !isSmall(svg)]);
    });

    // Inline background-image: black box, or black background with white text if it holds text.
    document.querySelectorAll('[style*="background-image"]').forEach((el) => {
      const small = isSmall(el);
      const hasText = !small && el.textContent.trim().length > 0;
      writes.push([el, 'data-ff-black', !small && !hasText]);
      writes.push([el, 'data-ff-bgtext', hasText]);
    });

    for (const [el, name, on] of writes) setAttr(el, name, on);
  }

  function sweep() {
    lastSweep = Date.now();
    injectCss();
    updateOverlay();
    if (shouldStopVideo()) document.querySelectorAll('video, audio').forEach(stopVideo);
    if (TEXT_ONLY) scanMedia();
  }

  // Run on DOM changes (at most every 150 ms), on image loads, on resize, and every second as a backstop.
  let lastSweep = 0;
  let queued = false;
  function queueSweep() {
    if (queued) return;
    queued = true;
    const wait = Math.max(0, 150 - (Date.now() - lastSweep));
    setTimeout(() => requestAnimationFrame(() => { queued = false; sweep(); }), wait);
  }

  new MutationObserver(queueSweep).observe(root, {
    childList: true, subtree: true, attributes: true, attributeFilter: ['src', 'style', 'href'],
  });
  document.addEventListener('load', (e) => {
    if (e.target instanceof HTMLImageElement) queueSweep();
  }, true);
  window.addEventListener('resize', queueSweep);
  window.addEventListener('popstate', queueSweep);
  setInterval(sweep, 1000);

  // Single-page-app navigation does not reload the page: watch the URL.
  let lastUrl = location.href;
  setInterval(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      sweep();
    }
  }, 250);

  sweep();
})();
