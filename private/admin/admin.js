/* Chatynkowo internal editor — client.
   Loads /api/cottages, lets you edit one at a time, saves back via PUT.
   Pin pickers: click on the symbolic map to set mapX/Y; click on the
   Leaflet map (or drag the marker) to set lat/lng. */

(() => {
  'use strict';

  const $ = sel => document.querySelector(sel);

  const els = {
    select: $('#cottage-select'),
    save: $('#btn-save'),
    publish: $('#btn-publish'),
    add: $('#btn-add'),
    delete: $('#btn-delete'),
    addDialog: $('#add-dialog'),
    addSlug: $('#add-slug'),
    addTitle: $('#add-title'),
    addError: $('#add-error'),
    addConfirm: $('#btn-add-confirm'),
    status: $('#status-pill'),
    title: $('#f-title'),
    occupant: $('#f-occupant'),
    virtue: $('#f-virtue'),
    code: $('#f-code'),
    lat: $('#f-lat'),
    lng: $('#f-lng'),
    mapX: $('#f-mapx'),
    mapY: $('#f-mapy'),
    bodyEditor: $('#f-body-editor'),
    audioPreview: $('#audio-preview'),
    audioFile: $('#audio-file'),
    audioDelete: $('#btn-audio-delete'),
    audioMeta: $('#audio-meta'),
    photosGrid: $('#photos-grid'),
    photosFile: $('#photos-file'),
    photosMeta: $('#photos-meta'),
    symbolicMap: $('#symbolic-map'),
    symbolicImg: $('#symbolic-img'),
    symbolicPin: $('#symbolic-pin'),
    geoMap: $('#geo-map'),
    publishDialog: $('#publish-dialog'),
    publishMessage: $('#publish-message'),
    publishLog: $('#publish-log'),
    publishConfirm: $('#btn-publish-confirm'),
  };

  /** Per-session state. */
  const state = {
    cottages: [],
    current: null,
    dirty: false,
    geo: null,
    cleanBody: '',         // markdown snapshot at last load/save — for dirty detection
  };

  /* ---------- HTTP helpers ---------- */

  async function api(method, path, body, isBinary) {
    const opts = { method };
    if (body != null) {
      if (isBinary) {
        opts.body = body;
        opts.headers = { 'content-type': 'application/octet-stream' };
      } else {
        opts.body = JSON.stringify(body);
        opts.headers = { 'content-type': 'application/json' };
      }
    }
    const res = await fetch(path, opts);
    const ct = res.headers.get('content-type') || '';
    const data = ct.includes('json') ? await res.json() : await res.text();
    if (!res.ok) throw new Error(data?.error || data || res.statusText);
    return data;
  }

  /* ---------- status pill ---------- */

  function setStatus(state_, text) {
    els.status.dataset.state = state_;
    els.status.textContent = text;
  }
  function markDirty() {
    state.dirty = true;
    els.save.disabled = false;
    setStatus('dirty', 'niezapisane zmiany');
  }
  function markClean() {
    state.dirty = false;
    els.save.disabled = true;
    setStatus('clean', 'zapisane');
  }

  /* ---------- cottage list ---------- */

  async function loadAll(preferSlug) {
    state.cottages = await api('GET', '/api/cottages');
    els.select.innerHTML = state.cottages
      .map(c => `<option value="${c.slug}">${escapeHtml(c.frontmatter.title || c.slug)} — ${c.slug}</option>`)
      .join('');
    const has = slug => state.cottages.some(c => c.slug === slug);
    let target = null;
    if (preferSlug && has(preferSlug)) target = preferSlug;
    else if (state.current && has(state.current.slug)) target = state.current.slug;
    else if (state.cottages.length) target = state.cottages[0].slug;
    if (target) {
      selectCottage(target);
    } else {
      // Empty list — disable per-cottage actions until something is added.
      state.current = null;
      els.delete.disabled = true;
      els.save.disabled = true;
      setStatus('clean', 'brak chatynek');
    }
  }

  function selectCottage(slug) {
    if (state.dirty && !confirm('Masz niezapisane zmiany. Porzucić je?')) {
      els.select.value = state.current?.slug || '';
      return;
    }
    const c = state.cottages.find(x => x.slug === slug);
    if (!c) return;
    state.current = c;
    els.select.value = slug;
    els.delete.disabled = false;
    fillForm(c);
    placeSymbolicPin(c.mapX, c.mapY);
    placeGeoMarker(c.frontmatter.lat, c.frontmatter.lng);
    refreshAudio();
    refreshPhotos();
    markClean();
  }

  /* ---------- form ---------- */

  function fillForm(c) {
    els.title.value = c.frontmatter.title ?? '';
    els.occupant.value = c.frontmatter.occupant ?? '';
    els.virtue.value = c.frontmatter.virtue ?? '';
    els.code.value = c.code ?? '';
    els.lat.value = c.frontmatter.lat ?? '';
    els.lng.value = c.frontmatter.lng ?? '';
    els.mapX.value = c.mapX ?? '';
    els.mapY.value = c.mapY ?? '';
    state.mde.setMarkdown(c.body ?? '');
    state.cleanBody = state.mde.getMarkdown();
  }

  function harvestForm() {
    const c = state.current;
    return {
      frontmatter: {
        title: els.title.value.trim(),
        slug: c.slug,
        occupant: els.occupant.value.trim(),
        lat: numOrNull(els.lat.value),
        lng: numOrNull(els.lng.value),
        virtue: els.virtue.value.trim(),
      },
      body: state.mde.getMarkdown(),
      mapX: numOrNull(els.mapX.value),
      mapY: numOrNull(els.mapY.value),
      code: els.code.value.trim() || null,
    };
  }

  function numOrNull(v) {
    if (v === '' || v == null) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }

  function codeConflict(code) {
    if (!code) return null;
    return state.cottages.find(c => c.code === code && c.slug !== state.current?.slug) || null;
  }

  function checkCodeUniqueness() {
    const code = els.code.value.trim();
    const conflict = codeConflict(code);
    els.code.setCustomValidity(conflict ? `Kod ${code} jest już używany przez chatynkę „${conflict.frontmatter?.title || conflict.slug}".` : '');
    els.code.reportValidity();
  }

  /* ---------- save ---------- */

  async function save() {
    if (!state.current) return;
    const code = els.code.value.trim();
    const conflict = codeConflict(code);
    if (conflict) {
      setStatus('error', `kod ${code} zajęty przez „${conflict.frontmatter?.title || conflict.slug}"`);
      els.code.focus();
      return;
    }
    setStatus('saving', 'zapisuję…');
    els.save.disabled = true;
    try {
      const payload = harvestForm();
      await api('PUT', `/api/cottages/${state.current.slug}`, payload);
      // Refresh in-memory record to mirror what we just wrote.
      Object.assign(state.current, {
        frontmatter: payload.frontmatter,
        body: payload.body,
        mapX: payload.mapX,
        mapY: payload.mapY,
      });
      state.cleanBody = state.mde.getMarkdown();
      markClean();
    } catch (e) {
      setStatus('error', `błąd: ${e.message}`);
      els.save.disabled = false;
    }
  }

  /* ---------- audio ---------- */

  function refreshAudio() {
    const c = state.current;
    if (c.audio.exists) {
      els.audioPreview.src = c.audio.url;
      els.audioMeta.textContent = `assets/stories/${c.slug}.mp3 — ${formatBytes(c.audio.size)}`;
      els.audioDelete.disabled = false;
    } else {
      els.audioPreview.removeAttribute('src');
      els.audioPreview.load();
      els.audioMeta.textContent = 'brak pliku audio';
      els.audioDelete.disabled = true;
    }
  }

  function formatBytes(n) {
    if (n < 1024) return n + ' B';
    if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' kB';
    return (n / (1024 * 1024)).toFixed(2) + ' MB';
  }

  async function uploadAudio(file) {
    if (!state.current) return;
    if (!file) return;
    const buf = await file.arrayBuffer();
    setStatus('saving', 'wgrywam audio…');
    try {
      await api('POST', `/api/cottages/${state.current.slug}/audio`, buf, true);
      // Refetch list to get updated mtime/size.
      const fresh = await api('GET', '/api/cottages');
      const updated = fresh.find(x => x.slug === state.current.slug);
      if (updated) state.current.audio = updated.audio;
      refreshAudio();
      setStatus('clean', 'audio wgrane');
    } catch (e) {
      setStatus('error', `błąd: ${e.message}`);
    }
  }

  async function deleteAudio() {
    if (!state.current) return;
    if (!confirm(`Usunąć plik assets/stories/${state.current.slug}.mp3?`)) return;
    try {
      await api('DELETE', `/api/cottages/${state.current.slug}/audio`);
      state.current.audio = { exists: false, url: null, size: 0 };
      refreshAudio();
      setStatus('clean', 'audio usunięte');
    } catch (e) {
      setStatus('error', `błąd: ${e.message}`);
    }
  }

  /* ---------- photos ---------- */

  function refreshPhotos() {
    const c = state.current;
    const photos = c?.photos || [];
    els.photosGrid.innerHTML = photos.map(p => `
      <figure class="photo-thumb" data-name="${escapeHtml(p.name)}">
        <img src="${escapeHtml(p.url)}" alt="${escapeHtml(p.name)}" loading="lazy">
        <figcaption>
          <span class="photo-name" title="${escapeHtml(p.name)}">${escapeHtml(p.name)}</span>
          <button type="button" class="photo-delete" aria-label="Usuń ${escapeHtml(p.name)}">×</button>
        </figcaption>
      </figure>
    `).join('');
    const total = photos.reduce((n, p) => n + (p.size || 0), 0);
    els.photosMeta.textContent = photos.length
      ? `${photos.length} ${pluralPL(photos.length, 'zdjęcie', 'zdjęcia', 'zdjęć')} · ${formatBytes(total)}`
      : '—';
  }

  function pluralPL(n, one, few, many) {
    if (n === 1) return one;
    const last = n % 10, lastTwo = n % 100;
    if (last >= 2 && last <= 4 && (lastTwo < 12 || lastTwo > 14)) return few;
    return many;
  }

  async function uploadPhotos(files) {
    if (!state.current) return;
    if (!files?.length) return;
    setStatus('saving', `wgrywam ${files.length} ${pluralPL(files.length, 'plik', 'pliki', 'plików')}…`);
    let added = 0;
    let lastErr = null;
    for (const file of files) {
      try {
        const buf = await file.arrayBuffer();
        const safeName = encodeURIComponent(file.name);
        const photo = await api(
          'POST',
          `/api/cottages/${state.current.slug}/photos/${safeName}`,
          buf,
          true,
        );
        state.current.photos = state.current.photos || [];
        state.current.photos.push(photo);
        added++;
      } catch (e) {
        lastErr = e;
      }
    }
    // Re-sort by name to mirror server's listing.
    state.current.photos.sort((a, b) => a.name.localeCompare(b.name));
    refreshPhotos();
    if (lastErr) setStatus('error', `błąd: ${lastErr.message}`);
    else setStatus('clean', `wgrano ${added} ${pluralPL(added, 'plik', 'pliki', 'plików')}`);
  }

  async function deletePhoto(name) {
    if (!state.current) return;
    if (!confirm(`Usunąć zdjęcie "${name}"?`)) return;
    try {
      await api('DELETE', `/api/cottages/${state.current.slug}/photos/${encodeURIComponent(name)}`);
      state.current.photos = (state.current.photos || []).filter(p => p.name !== name);
      refreshPhotos();
      setStatus('clean', 'zdjęcie usunięte');
    } catch (e) {
      setStatus('error', `błąd: ${e.message}`);
    }
  }

  /* ---------- symbolic pin ---------- */

  function placeSymbolicPin(x, y) {
    if (x == null || y == null || isNaN(x) || isNaN(y)) {
      els.symbolicPin.hidden = true;
      return;
    }
    els.symbolicPin.hidden = false;
    els.symbolicPin.style.left = `${x}%`;
    els.symbolicPin.style.top = `${y}%`;
  }

  function symbolicMapClick(ev) {
    const rect = els.symbolicImg.getBoundingClientRect();
    const x = ((ev.clientX - rect.left) / rect.width) * 100;
    const y = ((ev.clientY - rect.top) / rect.height) * 100;
    if (x < 0 || x > 100 || y < 0 || y > 100) return;
    const xr = round2(x), yr = round2(y);
    els.mapX.value = xr;
    els.mapY.value = yr;
    placeSymbolicPin(xr, yr);
    markDirty();
  }

  function round2(n) { return Math.round(n * 100) / 100; }

  /* ---------- Leaflet geo map ---------- */

  function initGeoMap() {
    const map = L.map(els.geoMap, { zoomControl: true }).setView([50.32, 19.6], 12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);
    const marker = L.marker([50.32, 19.6], { draggable: true });
    marker.on('dragend', () => {
      const p = marker.getLatLng();
      els.lat.value = round6(p.lat);
      els.lng.value = round6(p.lng);
      markDirty();
    });
    map.on('click', ev => {
      marker.setLatLng(ev.latlng).addTo(map);
      els.lat.value = round6(ev.latlng.lat);
      els.lng.value = round6(ev.latlng.lng);
      markDirty();
    });
    state.geo = { map, marker };
    // Recompute size whenever the container changes (image above loads async, shifts layout).
    new ResizeObserver(() => map.invalidateSize()).observe(els.geoMap);
  }

  function placeGeoMarker(lat, lng) {
    if (!state.geo) return;
    const { map, marker } = state.geo;
    const ok = Number.isFinite(lat) && Number.isFinite(lng);
    if (ok) {
      marker.setLatLng([lat, lng]).addTo(map);
      map.setView([lat, lng], 14);
    } else {
      map.removeLayer(marker);
      map.setView([50.32, 19.6], 12);
    }
  }

  function round6(n) { return Math.round(n * 1e6) / 1e6; }

  /* ---------- lat/lng inputs → marker ---------- */

  function syncMarkerFromInputs() {
    const lat = numOrNull(els.lat.value);
    const lng = numOrNull(els.lng.value);
    placeGeoMarker(lat, lng);
  }

  /* ---------- add / delete cottage ---------- */

  function openAddDialog() {
    if (state.dirty && !confirm('Masz niezapisane zmiany. Porzucić je?')) return;
    els.addSlug.value = '';
    els.addTitle.value = '';
    els.addError.hidden = true;
    els.addError.textContent = '';
    els.addDialog.showModal();
    setTimeout(() => els.addSlug.focus(), 0);
  }

  function showAddError(msg) {
    els.addError.textContent = msg;
    els.addError.hidden = false;
  }

  async function confirmAdd() {
    const slug = els.addSlug.value.trim();
    const title = els.addTitle.value.trim();
    if (!/^[a-z0-9-]+$/.test(slug)) return showAddError('Slug może zawierać tylko małe litery, cyfry i myślniki.');
    if (!title) return showAddError('Podaj tytuł chatynki.');
    if (state.cottages.some(c => c.slug === slug)) return showAddError(`Chatynka "${slug}" już istnieje.`);
    els.addConfirm.disabled = true;
    try {
      await api('POST', '/api/cottages', { slug, title });
      state.dirty = false; // suppress confirm during reload
      els.addDialog.close();
      await loadAll(slug);
    } catch (e) {
      showAddError(`Błąd: ${e.message}`);
    } finally {
      els.addConfirm.disabled = false;
    }
  }

  async function deleteCurrent() {
    const c = state.current;
    if (!c) return;
    const lines = [
      `Usunąć chatynkę "${c.frontmatter.title || c.slug}" (${c.slug})?`,
      '',
      'Zostaną usunięte:',
      `• cottages/${c.slug}.md`,
      `• wpis w data/cottages.json`,
    ];
    if (c.audio?.exists) lines.push(`• assets/stories/${c.slug}.mp3`);
    lines.push('', 'Można cofnąć przez `git checkout` przed publikacją.');
    if (!confirm(lines.join('\n'))) return;
    try {
      await api('DELETE', `/api/cottages/${c.slug}`);
      state.dirty = false;
      state.current = null;
      await loadAll();
    } catch (e) {
      setStatus('error', `błąd: ${e.message}`);
    }
  }

  /* ---------- publish ---------- */

  async function openPublish() {
    if (state.dirty && !confirm('Masz niezapisane zmiany. Publikować mimo to?')) return;
    els.publishLog.hidden = true;
    els.publishLog.textContent = '';
    els.publishMessage.value = state.current ? `edit: ${state.current.slug}` : '';
    els.publishDialog.showModal();
  }

  async function doPublish() {
    els.publishConfirm.disabled = true;
    els.publishLog.hidden = false;
    els.publishLog.textContent = 'publikuję…';
    try {
      const r = await api('POST', '/api/git/publish', { message: els.publishMessage.value });
      els.publishLog.textContent = r.log || '(ok)';
    } catch (e) {
      els.publishLog.textContent = `BŁĄD:\n${e.message}`;
    } finally {
      els.publishConfirm.disabled = false;
    }
  }

  /* ---------- escape helper ---------- */

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  /* ---------- wire up ---------- */

  function wire() {
    initGeoMap();

    state.mde = new toastui.Editor({
      el: els.bodyEditor,
      height: 'auto',
      minHeight: '360px',
      initialEditType: 'wysiwyg',
      previewStyle: 'tab',
      toolbarItems: [
        ['heading', 'bold', 'italic'],
        ['ul', 'ol'],
        ['link'],
      ],
      hideModeSwitch: false,
    });
    state.mde.on('change', () => { if (state.mde.getMarkdown() !== state.cleanBody) markDirty(); });

    els.select.addEventListener('change', () => selectCottage(els.select.value));
    els.save.addEventListener('click', save);
    els.publish.addEventListener('click', openPublish);
    els.publishConfirm.addEventListener('click', doPublish);
    els.add.addEventListener('click', openAddDialog);
    els.delete.addEventListener('click', deleteCurrent);
    els.addConfirm.addEventListener('click', confirmAdd);
    els.addSlug.addEventListener('keydown', ev => { if (ev.key === 'Enter') { ev.preventDefault(); els.addTitle.focus(); } });
    els.addTitle.addEventListener('keydown', ev => { if (ev.key === 'Enter') { ev.preventDefault(); confirmAdd(); } });

    // Mark dirty on any field change.
    for (const id of ['title', 'occupant', 'virtue', 'code', 'lat', 'lng', 'mapX', 'mapY']) {
      els[id].addEventListener('input', () => {
        markDirty();
        if (id === 'code') checkCodeUniqueness();
        if (id === 'mapX' || id === 'mapY') {
          placeSymbolicPin(numOrNull(els.mapX.value), numOrNull(els.mapY.value));
        }
        if (id === 'lat' || id === 'lng') syncMarkerFromInputs();
      });
    }

    els.symbolicMap.addEventListener('click', symbolicMapClick);

    els.audioFile.addEventListener('change', ev => {
      const f = ev.target.files?.[0];
      if (f) uploadAudio(f);
      ev.target.value = '';
    });
    els.audioDelete.addEventListener('click', deleteAudio);

    els.photosFile.addEventListener('change', ev => {
      const files = Array.from(ev.target.files || []);
      if (files.length) uploadPhotos(files);
      ev.target.value = '';
    });
    els.photosGrid.addEventListener('click', ev => {
      const btn = ev.target.closest('.photo-delete');
      if (!btn) return;
      const fig = btn.closest('.photo-thumb');
      if (fig?.dataset.name) deletePhoto(fig.dataset.name);
    });

    // Ctrl+S to save.
    window.addEventListener('keydown', ev => {
      if ((ev.ctrlKey || ev.metaKey) && ev.key === 's') {
        ev.preventDefault();
        if (!els.save.disabled) save();
      }
    });

    window.addEventListener('beforeunload', ev => {
      if (state.dirty) { ev.preventDefault(); ev.returnValue = ''; }
    });
  }

  wire();
  loadAll().catch(e => setStatus('error', `nie mogę wczytać: ${e.message}`));
})();
