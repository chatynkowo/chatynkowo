/* ---------- Chatynkowo — fairytale map & cottage loader ---------- */
(() => {
  'use strict';

  const COTTAGES_URL = 'data/cottages.json';
  const MD_DIR       = 'cottages';
  const AUDIO_DIR    = 'assets/stories';

  // Persistent state (localStorage I/O + badge registry) lives in
  // app_logic.js and is exposed on window.chatynkowo. Loaded with `defer`
  // before this file in index.html, so it's ready by the time we run.
  const { persist, BADGES } = window.chatynkowo;

  const state = {
    cottages: [],
  };

  /* ---------- Load cottages ---------- */
  async function loadCottages() {
    const res = await fetch(COTTAGES_URL);
    state.cottages = await res.json();
  }

  /* ---------- Cottage hotspots (image overlay) ----------
     The map is a bitmap at assets/img/map-base.png. For each cottage, we
     place a transparent <button> at its mapX/mapY position (expressed as a
     PERCENTAGE of the image in data/cottages.json). CSS gives it a gold
     pulsing glow on hover/focus and an animated zoom on click. */
  const ZOOM_DELAY_MS = 360;  // matches the .is-clicked CSS transition

  function makeHotspot(c, onActivate) {
    const x = Number(c.mapX);
    const y = Number(c.mapY);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'cottage-hotspot';
    if (persist.isFound(c.slug)) btn.classList.add('cottage-hotspot--found');
    btn.dataset.slug  = c.slug;
    btn.dataset.label = c.title;
    const stateLabel = persist.isFound(c.slug) ? ' (odkryta)' : '';
    btn.setAttribute(
      'aria-label',
      `${c.title}${stateLabel}. Kliknij, aby otworzyć opis i nawigację.`
    );
    btn.style.left = x + '%';
    btn.style.top  = y + '%';
    btn.addEventListener('click', (e) => {
      // Don't let the click bubble up to the map-stage / map-zoom handlers.
      e.stopPropagation();
      onActivate(btn, c);
    });
    return btn;
  }

  function drawCottages() {
    const host = document.getElementById('mapHotspots');
    if (!host) return;
    host.innerHTML = '';

    const modal = document.getElementById('pinModal');

    state.cottages.forEach((c) => {
      const btn = makeHotspot(c, (el, cot) => {
        el.classList.add('is-clicked');
        setTimeout(() => {
          openPinInfo(cot);
          const reset = () => {
            el.classList.remove('is-clicked');
            if (modal) modal.removeEventListener('close', reset);
          };
          if (modal) modal.addEventListener('close', reset);
        }, ZOOM_DELAY_MS);
      });
      if (btn) host.appendChild(btn);
    });

    drawZoomHotspots();
  }

  /* Zoom-mode hotspots: same positions, but click goes straight to the
     pin-info dialog — the map is already large, no extra zoom animation. */
  function drawZoomHotspots() {
    const host = document.getElementById('mapZoomHotspots');
    if (!host) return;
    host.innerHTML = '';
    state.cottages.forEach((c) => {
      const btn = makeHotspot(c, (_el, cot) => openPinInfo(cot));
      if (btn) host.appendChild(btn);
    });
  }

  function showDialog(modal) {
    if (typeof modal.showModal === 'function') modal.showModal();
    else modal.setAttribute('open', '');
  }
  function closeDialog(modal) {
    if (typeof modal.close === 'function') modal.close();
    else modal.removeAttribute('open');
  }

  /* Sections of every cottage .md file that belong in the PIN dialog (how
     to get there + what to do once you arrive). Everything else stays in
     the STORY dialog. */
  const PIN_SECTIONS = ['Jak znaleźć Chatynkę', 'Co zrobić, gdy trafisz pod chatynkę?'];

  async function fetchCottageMd(slug) {
    const res = await fetch(`${MD_DIR}/${slug}.md`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const raw = await res.text();
    return raw.replace(/^---[\s\S]*?---\s*/, '');  // strip YAML frontmatter
  }

  /* Split markdown by `## …` headings into { intro, sections: [{title, body}] }
     where intro is everything before the first h2. */
  function splitMd(raw) {
    const lines = raw.split('\n');
    let intro = [];
    const sections = [];
    let cur = null;
    for (const line of lines) {
      const m = line.match(/^##\s+(.+?)\s*$/);
      if (m) {
        if (cur) sections.push(cur);
        cur = { title: m[1], lines: [] };
      } else if (cur) {
        cur.lines.push(line);
      } else {
        intro.push(line);
      }
    }
    if (cur) sections.push(cur);
    return {
      intro: intro.join('\n').trim(),
      sections: sections.map(s => ({ title: s.title, body: s.lines.join('\n').trim() })),
    };
  }

  function renderSections(sections, includeTitles) {
    const include = new Set(includeTitles);
    return sections
      .filter(s => include.has(s.title))
      .map(s => `## ${s.title}\n\n${s.body}`)
      .join('\n\n');
  }
  function renderStoryMd(parts) {
    const exclude = new Set(PIN_SECTIONS);
    const rest = parts.sections
      .filter(s => !exclude.has(s.title))
      .map(s => `## ${s.title}\n\n${s.body}`)
      .join('\n\n');
    return [parts.intro, rest].filter(Boolean).join('\n\n');
  }
  function mdToHtml(md) {
    return window.marked ? window.marked.parse(md) : escapeHtml(md);
  }

  /* Renders a small badge under the title in the pin dialog reflecting
     whether this cottage has already been uncovered. Driven by exactly
     the same persist.isFound(slug) check that paints the pin blue, so
     the two indicators can never disagree. */
  function pinStatusHtml(slug) {
    if (persist.isFound(slug)) {
      const entry = persist.data.found[slug] || {};
      let when = '';
      if (entry.foundAt) {
        try {
          when = new Date(entry.foundAt)
            .toLocaleDateString('pl-PL', { dateStyle: 'long' });
        } catch (_) { /* fall back to no date */ }
      }
      return `<p class="pin-status pin-status--found">
                <span class="pin-status__check" aria-hidden="true">✓</span>
                Chatynka odkryta${when
                  ? ` <span class="pin-status__sep">·</span> <time datetime="${entry.foundAt}">${when}</time>`
                  : ''}
              </p>`;
    }
    return `<p class="pin-status pin-status--unfound">
              Jeszcze nie odkryta — znajdź ją w lesie i wpisz tajny kod z&nbsp;tabliczki.
            </p>`;
  }

  /* ---------- Pin-click dialog ----------
     Shown when the user clicks a pin on either the inline map or the
     fullscreen zoomed map. Renders only the "Jak znaleźć Chatynkę" and
     "Co zrobić, gdy trafisz pod chatynkę?" sections of the cottage's
     markdown — the rest (story body + audio) is the reward for finding
     it and entering the code. */
  async function openPinInfo(c) {
    const modal   = document.getElementById('pinModal');
    const content = document.getElementById('pinContent');
    const title   = document.getElementById('pinTitle');
    if (!modal || !content) return;
    title.textContent = c.title;
    // Mirror the pin's "found" flag on the dialog itself so future styling
    // hooks (border, header tint, ...) can react to discovery state.
    modal.classList.toggle('modal--found', persist.isFound(c.slug));
    const status = pinStatusHtml(c.slug);
    content.replaceChildren(title, document.createRange().createContextualFragment(
      status + '<p><em>Ładuję wskazówki…</em></p>'));
    showDialog(modal);
    try {
      const parts = splitMd(await fetchCottageMd(c.slug));
      const md    = renderSections(parts.sections, PIN_SECTIONS);
      content.replaceChildren(title, document.createRange().createContextualFragment(
        status + mdToHtml(md)));
    } catch (err) {
      content.replaceChildren(title, document.createRange().createContextualFragment(
        status + '<p>Nie udało się wczytać wskazówek do tej Chatynki.</p>'));
    }
  }

  /* ---------- Story dialog (after entering a valid code) ----------
     Shows the full markdown story (without the "how to find" sections) +
     the gramophone audio player. NO map navigation — the user has already
     found the cottage. */
  async function openStory(c) {
    const modal   = document.getElementById('storyModal');
    const content = document.getElementById('storyContent');
    if (!modal || !content) return;

    content.innerHTML = '<p><em>Ładuję opowieść…</em></p>';
    loadCottageAudio(c.slug);

    showDialog(modal);

    try {
      const parts = splitMd(await fetchCottageMd(c.slug));
      content.innerHTML = mdToHtml(renderStoryMd(parts));
    } catch (err) {
      content.innerHTML = `<p>Nie udało się wczytać opowieści.</p>`;
    }
  }

  /* ---------- Audio (gramophone) ---------- */
  function fmtTime(s) {
    if (!Number.isFinite(s) || s < 0) return '0:00';
    const m = Math.floor(s / 60);
    const ss = Math.floor(s % 60).toString().padStart(2, '0');
    return `${m}:${ss}`;
  }

  function loadCottageAudio(slug) {
    const audio  = document.getElementById('audioElement');
    const player = document.getElementById('audioPlayer');
    const seek   = document.getElementById('audioSeek');
    const cur    = document.getElementById('audioCurrent');
    const dur    = document.getElementById('audioDuration');
    if (!audio || !player) return;

    // Reset previous state.
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
    player.classList.remove('is-playing');
    player.setAttribute('hidden', '');
    seek.value = 0;
    cur.textContent = '0:00';
    dur.textContent = '0:00';

    // Reveal the player only once we know the file is loadable.
    audio.preload = 'metadata';
    audio.src = `${AUDIO_DIR}/${slug}.mp3`;
    audio.load();
  }

  function wireAudioPlayer() {
    const audio  = document.getElementById('audioElement');
    const player = document.getElementById('audioPlayer');
    const playBtn = document.getElementById('audioPlay');
    const seek   = document.getElementById('audioSeek');
    const cur    = document.getElementById('audioCurrent');
    const dur    = document.getElementById('audioDuration');
    if (!audio || !player) return;

    playBtn.addEventListener('click', () => {
      if (audio.paused) audio.play().catch(() => {});
      else audio.pause();
    });
    audio.addEventListener('play',  () => player.classList.add('is-playing'));
    audio.addEventListener('pause', () => player.classList.remove('is-playing'));
    audio.addEventListener('ended', () => player.classList.remove('is-playing'));

    audio.addEventListener('loadedmetadata', () => {
      player.removeAttribute('hidden');
      dur.textContent = fmtTime(audio.duration);
    });
    audio.addEventListener('error', () => {
      // No mp3 for this cottage — keep the player hidden.
      player.setAttribute('hidden', '');
    });

    audio.addEventListener('timeupdate', () => {
      cur.textContent = fmtTime(audio.currentTime);
      if (audio.duration > 0) {
        seek.value = (audio.currentTime / audio.duration) * 1000;
      }
    });

    let scrubbing = false;
    seek.addEventListener('input', () => { scrubbing = true; });
    seek.addEventListener('change', () => {
      if (audio.duration > 0) {
        audio.currentTime = (seek.value / 1000) * audio.duration;
      }
      scrubbing = false;
    });

    // Pause when the story dialog closes so audio doesn't keep playing in
    // the background after the user dismisses it.
    const story = document.getElementById('storyModal');
    if (story) story.addEventListener('close', () => audio.pause());
  }

  function escapeHtml(s) {
    return s.replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  }

  function wireDialog(modalId, closeId) {
    const modal = document.getElementById(modalId);
    const close = document.getElementById(closeId);
    if (!modal || !close) return;
    close.addEventListener('click', () => closeDialog(modal));
    // Close on backdrop click (click outside the dialog rect).
    modal.addEventListener('click', (e) => {
      const rect = modal.getBoundingClientRect();
      const inside = e.clientX >= rect.left && e.clientX <= rect.right &&
                     e.clientY >= rect.top  && e.clientY <= rect.bottom;
      if (!inside) closeDialog(modal);
    });
  }
  function wireModal() {
    wireDialog('pinModal',   'pinClose');
    wireDialog('storyModal', 'storyClose');
  }

  /* ---------- Hub buttons (toggle collapsible sections) ----------
     Each .hub__btn carries data-target with the id of the section it controls.
     At most ONE panel may be open at a time: clicking another button closes
     whichever panel is currently visible before opening the new one. */
  function wireHubButtons() {
    const buttons = Array.from(document.querySelectorAll('.hub__btn'));
    buttons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.target;
        const panel = document.getElementById(id);
        if (!panel) return;
        const willOpen = panel.hasAttribute('hidden');
        // Close every panel + reset every button.
        buttons.forEach((b) => {
          const p = document.getElementById(b.dataset.target);
          if (p) p.setAttribute('hidden', '');
          b.setAttribute('aria-expanded', 'false');
        });
        if (willOpen) {
          panel.removeAttribute('hidden');
          btn.setAttribute('aria-expanded', 'true');
          // Defer scroll so the layout settles after the panel becomes visible.
          requestAnimationFrame(() => {
            panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
          });
        }
      });
    });
  }

  /* ---------- Map zoom dialog ----------
     Click anywhere on the map (except a pin) to open the full-resolution
     map in a fullscreen scrollable dialog. Pins keep their own behaviour. */
  function wireMapZoom() {
    const stage = document.getElementById('mapStage');
    const dialog = document.getElementById('mapZoom');
    const scroll = document.getElementById('mapZoomScroll');
    const img = document.getElementById('mapZoomImg');
    const close = document.getElementById('mapZoomClose');
    const sourceImg = document.getElementById('mapImage');
    if (!stage || !dialog || !img || !close || !scroll || !sourceImg) return;

    function openZoom() {
      // Lazy-set src on first open so the (cached) image loads on demand.
      if (!img.getAttribute('src')) img.src = sourceImg.currentSrc || sourceImg.src;
      if (typeof dialog.showModal === 'function') dialog.showModal();
      else dialog.setAttribute('open', '');
      // Center the image once it's laid out.
      requestAnimationFrame(() => {
        scroll.scrollLeft = (scroll.scrollWidth  - scroll.clientWidth)  / 2;
        scroll.scrollTop  = (scroll.scrollHeight - scroll.clientHeight) / 2;
      });
    }
    function closeZoom() {
      if (typeof dialog.close === 'function') dialog.close();
      else dialog.removeAttribute('open');
    }

    stage.addEventListener('click', (e) => {
      // Pins have their own click handler; don't open the zoom for them.
      if (e.target.closest('.cottage-hotspot')) return;
      // Wait until the map image is actually loaded.
      if (!stage.classList.contains('has-image')) return;
      openZoom();
    });

    close.addEventListener('click', closeZoom);
    // Click on backdrop area (the dialog itself, outside the scroll container)
    // closes the zoom.
    dialog.addEventListener('click', (e) => {
      if (e.target === dialog) closeZoom();
    });

    // Click-drag panning for desktop (touch already pans natively).
    let dragging = false;
    let startX = 0, startY = 0, startScrollX = 0, startScrollY = 0;
    scroll.addEventListener('pointerdown', (e) => {
      // Skip touch/pen — let the browser handle native scrolling/pinching.
      if (e.pointerType !== 'mouse') return;
      // Don't capture clicks that started on a pin — pointer capture would
      // re-route the pointerup to the scroll element and swallow the click.
      if (e.target.closest('.cottage-hotspot')) return;
      dragging = true;
      startX = e.clientX; startY = e.clientY;
      startScrollX = scroll.scrollLeft; startScrollY = scroll.scrollTop;
      scroll.classList.add('is-dragging');
      scroll.setPointerCapture(e.pointerId);
    });
    scroll.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      scroll.scrollLeft = startScrollX - (e.clientX - startX);
      scroll.scrollTop  = startScrollY - (e.clientY - startY);
    });
    const endDrag = (e) => {
      if (!dragging) return;
      dragging = false;
      scroll.classList.remove('is-dragging');
      try { scroll.releasePointerCapture(e.pointerId); } catch (_) {}
    };
    scroll.addEventListener('pointerup', endDrag);
    scroll.addEventListener('pointercancel', endDrag);
  }

  /* ---------- Hero slideshow ----------
     Crossfades through the cottage photos stacked inside .hero__slides. The
     .is-active class controls opacity; only one slide is opaque at a time. */
  function wireHeroSlideshow() {
    const slides = document.querySelectorAll('.hero__slide');
    if (slides.length < 2) return;
    const SLIDE_MS = 5000;
    let i = 0;
    // Make sure exactly one slide starts active (defensive — markup already
    // sets it on the first one).
    slides.forEach((s, idx) => s.classList.toggle('is-active', idx === 0));
    setInterval(() => {
      slides[i].classList.remove('is-active');
      i = (i + 1) % slides.length;
      slides[i].classList.add('is-active');
    }, SLIDE_MS);
  }

  /* ---------- Trophies (Skarbiec) ----------
     Renders the union of (defined badges in BADGES) ∪ (earned badges in
     persist.data.badges) as cards inside #trophyGrid. Earned badges get
     full colour + the date; not-yet-earned defined badges show locked.
     Earned-but-undefined badges (a future definition arrived later? a
     console-awarded test?) still render so progress isn't hidden. The
     numeric pip on the floating button mirrors the earned count. */
  function renderTrophies() {
    const grid    = document.getElementById('trophyGrid');
    const empty   = document.getElementById('trophyEmpty');
    const toggle  = document.getElementById('trophiesOpen');
    const countEl = document.getElementById('trophiesCount');
    if (!grid || !empty || !toggle || !countEl) return;

    const earnedIds = persist.earnedBadges();
    const earnedSet = new Set(earnedIds);
    countEl.textContent = String(earnedIds.length);
    toggle.classList.toggle('trophies-toggle--has', earnedIds.length > 0);

    // Show every defined badge plus any earned ones we don't have a
    // definition for yet (preserves progress across registry edits).
    const ids = Array.from(new Set([...Object.keys(BADGES), ...earnedIds]));
    grid.replaceChildren();

    if (ids.length === 0) {
      empty.removeAttribute('hidden');
      grid.setAttribute('hidden', '');
      return;
    }
    empty.setAttribute('hidden', '');
    grid.removeAttribute('hidden');

    for (const id of ids) {
      const def = BADGES[id] || {};
      const meta = persist.data.badges[id];
      const isEarned = earnedSet.has(id);

      const li = document.createElement('li');
      li.className = 'trophy ' + (isEarned ? 'trophy--earned' : 'trophy--locked');
      li.dataset.badge = id;

      const art = document.createElement('div');
      art.className = 'trophy__art';
      if (def.image) {
        const img = document.createElement('img');
        img.src = def.image;
        img.alt = def.name || id;
        img.loading = 'lazy';
        img.decoding = 'async';
        art.appendChild(img);
      } else {
        art.textContent = isEarned ? '★' : '?';
      }

      const body = document.createElement('div');
      body.className = 'trophy__body';

      const h3 = document.createElement('h3');
      h3.className = 'trophy__name';
      h3.textContent = def.name || id;
      body.appendChild(h3);

      if (def.description) {
        const p = document.createElement('p');
        p.className = 'trophy__desc';
        p.textContent = def.description;
        body.appendChild(p);
      }

      if (isEarned && meta && meta.earnedAt) {
        const p = document.createElement('p');
        p.className = 'trophy__date';
        let when = meta.earnedAt;
        try {
          when = new Date(meta.earnedAt)
            .toLocaleDateString('pl-PL', { dateStyle: 'long' });
        } catch (_) {}
        p.innerHTML = `Zdobyto: <time datetime="${meta.earnedAt}">${escapeHtml(when)}</time>`;
        body.appendChild(p);
      }

      li.appendChild(art);
      li.appendChild(body);
      grid.appendChild(li);
    }
  }

  function wireTrophies() {
    const modal = document.getElementById('trophiesModal');
    const open  = document.getElementById('trophiesOpen');
    const close = document.getElementById('trophiesClose');
    if (!modal || !open || !close) return;
    open.addEventListener('click', () => {
      renderTrophies();   // refresh the grid each time the dialog opens
      showDialog(modal);
    });
    close.addEventListener('click', () => closeDialog(modal));
    modal.addEventListener('click', (e) => {
      const r = modal.getBoundingClientRect();
      const inside = e.clientX >= r.left && e.clientX <= r.right &&
                     e.clientY >= r.top  && e.clientY <= r.bottom;
      if (!inside) closeDialog(modal);
    });
  }

  /* ---------- 4-digit code form ---------- */
  function wireCodeForm() {
    const form = document.getElementById('codeForm');
    const input = document.getElementById('historiaKod');
    const out = document.getElementById('codeResult');
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const v = (input.value || '').trim();
      if (!/^\d{4}$/.test(v)) {
        out.textContent = 'Podaj prawidłowy 4-cyfrowy kod znaleziony na tabliczce Chatynki.';
        return;
      }
      const c = state.cottages.find(x => x.code === v);
      if (!c) {
        out.textContent = 'Nieznany kod. Sprawdź tabliczkę na chatynce.';
        return;
      }
      const justFound = persist.markFound(c.slug, { code: v });
      // Repaint pins so the just-uncovered cottage shows in "found" colour
      // both on the inline map and in the zoom dialog. Also refresh the
      // trophies pip — future award rules (driven by foundSlugs.length,
      // for example) may have unlocked a badge.
      if (justFound) {
        drawCottages();
        renderTrophies();
      }
      out.innerHTML = `✨ Magia ożywa… Elf z <strong>${c.title}</strong> chce Ci coś opowiedzieć.`;
      openStory(c);
    });
  }

  /* ---------- Boot ---------- */
  async function init() {
    persist.load();
    // Wire UI affordances first so toggles work even if data loading fails.
    wireHeroSlideshow();
    wireHubButtons();
    wireModal();
    wireCodeForm();
    wireMapZoom();
    wireAudioPlayer();
    wireTrophies();
    renderTrophies();   // initial paint of the count pip
    try {
      await loadCottages();
      drawCottages();
    } catch (err) {
      console.error('[Chatynkowo] init failed', err);
      const host = document.getElementById('mapHotspots');
      if (host) host.innerHTML =
        `<p style="padding:2rem;color:#f5e6b8;background:rgba(0,0,0,.6);">
           Nie udało się wczytać chatynek. Otwórz stronę przez serwer HTTP
           (np. <code>python3 -m http.server</code>).
         </p>`;
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
