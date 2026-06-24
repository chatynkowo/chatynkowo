/* ---------- Chatynkowo — durable analytics queue (GoatCounter) ----------
   Why this file exists:

   Turning a cottage pin "found" is a local, offline-safe localStorage write
   (app_logic.js → markFound), but the matching GoatCounter event needs the
   network — and the cottages are found out in the field, where the signal is
   patchy. Two things used to silently swallow those events:

     1. count.js is loaded async from an external CDN (//gc.zgo.at); with no
        signal it never loads, so window.goatcounter is undefined and nothing
        is sent.
     2. goatcounter.count() is fire-and-forget (sendBeacon / img) with no retry
        and no offline queue, so even when it runs the event can be dropped.

   Result: a seeker could discover every cottage (all pins blue, all in local-
   Storage) while progress-N / found-* events for the low-signal spots never
   reached the server.

   This module owns those events instead. Every event is appended to a small
   localStorage queue first, then we try to deliver it by building the request
   ourselves (same shape count.js uses) — so delivery does NOT depend on the
   external script having loaded. Anything that fails (offline, storage write,
   CDN down) stays queued and is retried on the next page load, when the
   connection returns, and when the tab becomes visible again.

   Note: like the rest of the app, this leans on localStorage; if storage is
   unavailable the queue can't persist and events are best-effort only. The
   events themselves are anonymous, aggregate paths (e.g. "progress-12") and
   carry no visitor data — same as before, just delivered reliably. */
(() => {
  'use strict';

  const QUEUE_KEY = 'chatynkowo:gc-queue:v1';
  const MAX_QUEUE = 200;   // safety cap (~66 finds); drop oldest beyond this

  // Single source of truth for the endpoint: the same <script data-goatcounter>
  // tag count.js reads. Falls back to the known URL if the tag is absent (e.g.
  // a page that doesn't embed count.js but still wants to drain the queue).
  const endpoint = (() => {
    const s = document.querySelector('script[data-goatcounter]');
    return (s && s.dataset.goatcounter) || 'https://chatynkowo.goatcounter.com/count';
  })();

  const rnd = () => Math.random().toString(36).slice(2, 10);

  const readQueue = () => {
    try {
      const arr = JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
      return Array.isArray(arr) ? arr : [];
    } catch (_) { return []; }
  };
  const writeQueue = (arr) => {
    try { localStorage.setItem(QUEUE_KEY, JSON.stringify(arr)); } catch (_) {}
  };

  // Build the GoatCounter count URL for one queued event. Mirrors the params
  // count.js sends for an event: p(ath), t(itle), e(vent)=true, plus a random
  // cache-buster (browsers don't always honour Cache-Control).
  const urlFor = (ev) => {
    const q = new URLSearchParams();
    q.set('p', ev.p);
    if (ev.t) q.set('t', ev.t);
    q.set('e', 'true');
    q.set('rnd', rnd());
    return endpoint + '?' + q.toString();
  };

  // Attempt delivery of one event. Resolves true once the request reaches the
  // server, false on a network failure (so it stays queued). no-cors gives an
  // opaque response — fine, we only need "did it leave the device". keepalive
  // lets the request finish even if the page is unloading right after a find.
  const deliver = (ev) => {
    const url = urlFor(ev);
    if (typeof fetch === 'function') {
      return fetch(url, { method: 'GET', mode: 'no-cors', cache: 'no-store', keepalive: true })
        .then(() => true)
        .catch(() => false);
    }
    // Ancient-browser fallback: sendBeacon (best-effort, can't confirm).
    try { return Promise.resolve(Boolean(navigator.sendBeacon && navigator.sendBeacon(url))); }
    catch (_) { return Promise.resolve(false); }
  };

  let flushing = false;
  async function flush() {
    if (flushing) return;
    // navigator.onLine === false is a reliable "definitely offline" signal;
    // true is only a hint, so we still try in that case.
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
    flushing = true;
    try {
      // Drain the head of the queue one at a time, re-reading each round so
      // events enqueued mid-flush (a find fires three at once) go out too.
      while (true) {
        const queue = readQueue();
        if (!queue.length) break;
        const ev = queue[0];
        const ok = await deliver(ev);
        if (!ok) break;                       // offline — keep everything, retry later
        writeQueue(readQueue().filter((e) => e.id !== ev.id));
        // If the removal didn't actually persist (storage disabled/full), stop
        // rather than spin and re-send the same event forever.
        if (readQueue().some((e) => e.id === ev.id)) break;
      }
    } finally {
      flushing = false;
    }
  }

  // Public API: queue an anonymous event, then immediately try to send it.
  function track(path, title) {
    if (!path) return;
    const queue = readQueue();
    queue.push({ id: rnd() + rnd(), p: String(path), t: title ? String(title) : '', at: new Date().toISOString() });
    while (queue.length > MAX_QUEUE) queue.shift();   // overflow drops oldest
    writeQueue(queue);
    flush();
  }

  // Retry whenever conditions might have improved.
  window.addEventListener('online', flush);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') flush();
  });

  window.chatynkowoStats = { track, flush };

  // Drain anything left from earlier (offline) sessions as soon as we load.
  flush();
})();
