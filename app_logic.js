/* ---------- Chatynkowo — persistent client-side state ----------
   Owns the localStorage I/O for "found cottages" and earned badges, plus
   the BADGES registry. Other scripts (main.js today, future modules
   tomorrow) read and update progress through window.chatynkowo so the
   data shape stays in one place.

   Storage shape (localStorage key 'chatynkowo:state:v1'):
     {
       version: 1,
       found:  { "<cottage-slug>": { foundAt:  "<ISO date>", ... }, ... },
       badges: { "<badge-id>":     { earnedAt: "<ISO date>", ... }, ... }
     }

   Loaded by main.js's init() with chatynkowo.persist.load(). All other
   accessors are safe to call before load() — they just see an empty
   state until then. */
(() => {
  'use strict';

  const STORAGE_KEY = 'chatynkowo:state:v1';

  const persist = {
    data: { version: 1, found: {}, badges: {} },

    load() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return;
        const parsed = JSON.parse(raw);
        if (parsed && parsed.version === 1) {
          this.data.found  = parsed.found  || {};
          this.data.badges = parsed.badges || {};
        }
      } catch (_) { /* localStorage disabled or quota exceeded — ignore */ }
    },
    save() {
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data)); }
      catch (_) {}
    },

    // ---- Cottage discovery ----
    isFound(slug)   { return Boolean(this.data.found[slug]); },
    foundSlugs()    { return Object.keys(this.data.found); },
    /* Returns true only on first discovery, so callers can trigger one-shot
       reactions (e.g. badge awards, celebratory animation). */
    markFound(slug, extra = {}) {
      if (this.data.found[slug]) return false;
      this.data.found[slug] = { foundAt: new Date().toISOString(), ...extra };
      this.save();
      return true;
    },

    // ---- Badges / rewards ----
    hasBadge(id)    { return Boolean(this.data.badges[id]); },
    earnedBadges()  { return Object.keys(this.data.badges); },
    awardBadge(id, meta = {}) {
      if (this.data.badges[id]) return false;
      this.data.badges[id] = { earnedAt: new Date().toISOString(), ...meta };
      this.save();
      return true;
    },

    // Wipe all progress — useful for development / a future "reset" UI.
    reset() {
      this.data = { version: 1, found: {}, badges: {} };
      try { localStorage.removeItem(STORAGE_KEY); } catch (_) {}
    },
  };

  /* Badge registry — FALLBACK reward definitions.
     The live reward levels (herb cards) and the treasury text are authored in
     the admin panel and published as data/rewards.json; main.js loads that at
     startup and it drives both the Skarbiec display and the award thresholds.
     This registry is only used when rewards.json can't be loaded (older deploy
     / offline), so awarding and the Skarbiec keep working. The ids here are the
     same ones seeded into rewards.json, so earned progress (stored by id in
     localStorage) matches whichever source is in effect.
     `threshold` is the number of discovered Chatynki required to earn the badge;
     `final: true` marks the full set (threshold = the total cottage count,
     computed dynamically in main.js) and unlocks the way to the ranking.
     The award logic (main.js) calls persist.awardBadge(id, …) when a threshold is met. */
  const BADGES = {
    'first-find': {
      name: 'Pierwsza Chatynka',
      description: 'Odkryto pierwszą Chatynkę.',
      threshold: 1,
    },
    'tropiciel': {
      name: 'Tropiciel',
      description: 'Odkryto 5 Chatynek.',
      threshold: 5,
    },
    'polowa-drogi': {
      name: 'Połowa drogi',
      description: 'Odkryto połowę wszystkich Chatynek.',
      threshold: 13,
    },
    'mistrz-chatynkowa': {
      name: 'Mistrz Chatynkowa',
      description: 'Odkryto wszystkie Chatynki! Czas trafić do Rankingu Zdobywców.',
      final: true,
    },
  };

  // Expose for main.js and for browser-console debugging. Use Object.assign
  // so any earlier definitions (none today) survive.
  window.chatynkowo = Object.assign(window.chatynkowo || {}, { persist, BADGES });
})();
