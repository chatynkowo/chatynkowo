/* Chatynkowo internal editor — GitHub Pages edition.
   Reads/writes files directly through the GitHub Contents & Git Data APIs.
   Authentication: GitHub Personal Access Token stored in localStorage.
   No server required. */

(() => {
  'use strict';

  const GH = 'https://api.github.com';
  const CONFIG_KEY = 'chatynkowo_editor_v1';
  const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
  const MAX_AUDIO_BYTES = 30 * 1024 * 1024;

  /* ---------- config ---------- */

  function detectRepo() {
    const m = location.hostname.match(/^([a-z0-9-]+)\.github\.io$/i);
    if (!m) return { owner: '', repo: '' };
    const owner = m[1];
    const seg = location.pathname.split('/').filter(Boolean)[0] || '';
    const repo = seg === 'admin' ? '' : seg; // single-page site at root
    return { owner, repo };
  }

  function loadConfig() {
    try { return JSON.parse(localStorage.getItem(CONFIG_KEY) || 'null') || {}; }
    catch { return {}; }
  }

  function saveConfig(partial) {
    const current = loadConfig();
    localStorage.setItem(CONFIG_KEY, JSON.stringify({ ...current, ...partial }));
  }

  const detected = detectRepo();
  let cfg = (() => {
    const stored = loadConfig();
    return {
      owner:  stored.owner  || detected.owner  || '',
      repo:   stored.repo   || detected.repo   || '',
      branch: stored.branch || 'main',
      token:  stored.token  || '',
    };
  })();

  /* ---------- GitHub API ---------- */

  async function ghFetch(method, endpoint, body) {
    const url = endpoint.startsWith('https://')
      ? endpoint
      : `${GH}/repos/${cfg.owner}/${cfg.repo}/${endpoint}`;
    const res = await fetch(url, {
      method,
      // GitHub API responses carry `Cache-Control: max-age=60`; the browser's
      // HTTP cache would serve a pre-save branch tip for up to a minute,
      // making the next commit a non-fast-forward (422 on PATCH git/refs).
      cache: 'no-store',
      headers: {
        Authorization: `token ${cfg.token}`,
        Accept: 'application/vnd.github.v3+json',
        ...(body != null ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body != null ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: res.statusText }));
      const e = new Error(err.message || `HTTP ${res.status}`);
      e.status = res.status;
      throw e;
    }
    if (res.status === 204) return null;
    return res.json();
  }

  /* Commit multiple files (add/modify/delete) in a single Git commit.
     changes: [{path, text?, binary?: ArrayBuffer, delete?: true}] */
  async function commitChanges(changes, message) {
    const ref = await ghFetch('GET', `git/refs/heads/${cfg.branch}`);
    const parentSha = ref.object.sha;
    const parentCommit = await ghFetch('GET', `git/commits/${parentSha}`);

    const treeItems = await Promise.all(changes.map(async ch => {
      if (ch.delete) return { path: ch.path, mode: '100644', type: 'blob', sha: null };
      const content = ch.binary ? arrayBufferToBase64(ch.binary) : utf8ToBase64(ch.text || '');
      const blob = await ghFetch('POST', 'git/blobs', { content, encoding: 'base64' });
      return { path: ch.path, mode: '100644', type: 'blob', sha: blob.sha };
    }));

    let newTree = await ghFetch('POST', 'git/trees', {
      base_tree: parentCommit.tree.sha,
      tree: treeItems,
    });
    let newCommit = await ghFetch('POST', 'git/commits', {
      message, tree: newTree.sha, parents: [parentSha],
    });
    try {
      await ghFetch('PATCH', `git/refs/heads/${cfg.branch}`, { sha: newCommit.sha });
    } catch (e) {
      if (e.status !== 422) throw e;
      // Branch moved between our GET and PATCH — rebuild tree on the new HEAD and retry once.
      const freshRef = await ghFetch('GET', `git/refs/heads/${cfg.branch}`);
      const freshParent = await ghFetch('GET', `git/commits/${freshRef.object.sha}`);
      newTree = await ghFetch('POST', 'git/trees', {
        base_tree: freshParent.tree.sha,
        tree: treeItems,
      });
      newCommit = await ghFetch('POST', 'git/commits', {
        message, tree: newTree.sha, parents: [freshRef.object.sha],
      });
      await ghFetch('PATCH', `git/refs/heads/${cfg.branch}`, { sha: newCommit.sha });
    }

    // Update local SHA cache from the returned tree.
    for (const item of newTree.tree) {
      if (item.sha) state.sha.set(item.path, item.sha);
    }
    for (const ch of changes) {
      if (ch.delete) state.sha.delete(ch.path);
    }
    return newCommit;
  }

  /* ---------- encoding helpers ---------- */

  function base64ToUtf8(b64) {
    const bytes = Uint8Array.from(atob(b64.replace(/\n/g, '')), c => c.charCodeAt(0));
    return new TextDecoder('utf-8').decode(bytes);
  }

  function utf8ToBase64(str) {
    return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (_, p) => String.fromCharCode(parseInt(p, 16))));
  }

  function arrayBufferToBase64(buf) {
    const bytes = new Uint8Array(buf);
    let bin = '';
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
    }
    return btoa(bin);
  }

  function rawUrl(path) {
    const sha = state.sha.get(path) || 'HEAD';
    return `https://raw.githubusercontent.com/${cfg.owner}/${cfg.repo}/${cfg.branch}/${path}?v=${sha.slice(0, 8)}`;
  }

  /* ---------- frontmatter / JSON serialisers ---------- */

  function parseFrontmatter(raw) {
    const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
    if (!m) return { fm: {}, body: raw };
    const fm = {};
    for (const line of m[1].split(/\r?\n/)) {
      const mm = line.match(/^([A-Za-z_][\w-]*)\s*:\s*(.*?)\s*$/);
      if (!mm) continue;
      let v = mm[2];
      if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, '\\');
      else if (/^-?\d+(\.\d+)?$/.test(v)) v = Number(v);
      fm[mm[1]] = v;
    }
    return { fm, body: m[2] };
  }

  function serializeMd(fm, body) {
    const order = ['title', 'slug', 'occupant', 'lat', 'lng', 'virtue'];
    const seen = new Set();
    const lines = ['---'];
    const emit = (k, v) => {
      if (v === undefined || v === null) return;
      if (typeof v === 'number') { lines.push(`${k}: ${v}`); return; }
      const s = String(v);
      if (/[\s:"#&*?|<>=%@`]/.test(s) || s === '') lines.push(`${k}: "${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`);
      else lines.push(`${k}: ${s}`);
    };
    for (const k of order) { if (k in fm) { emit(k, fm[k]); seen.add(k); } }
    for (const k of Object.keys(fm)) { if (!seen.has(k)) emit(k, fm[k]); }
    lines.push('---');
    const trimmed = String(body || '').replace(/^\r?\n+/, '').replace(/\r?\n+$/, '');
    return lines.join('\n') + '\n\n' + trimmed + '\n';
  }

  function serializeCottagesJson(records) {
    // NO 'code' here — cottages.json is published with the site, and the
    // plaque codes are secret. They live in private/codes.json instead.
    const fields = ['slug', 'title', 'lat', 'lng', 'mapX', 'mapY'];
    const segMax = {};
    for (const f of fields) {
      let max = 0;
      for (const r of records) {
        if (r[f] === undefined) continue;
        const l = `"${f}": ${JSON.stringify(r[f])},`.length;
        if (l > max) max = l;
      }
      segMax[f] = max;
    }
    const lines = records.map(r => {
      const present = fields.filter(f => r[f] !== undefined);
      const parts = present.map((f, i) => {
        const v = JSON.stringify(r[f]);
        return i < present.length - 1 ? `"${f}": ${v},`.padEnd(segMax[f]) : `"${f}": ${v}`;
      });
      return '  { ' + parts.join(' ') + ' }';
    });
    return '[\n' + lines.join(',\n') + '\n]\n';
  }

  /* ---------- secret plaque codes (private/codes.json) ----------
     The codes never enter any published file in plaintext. The site validates
     an entered code against data/code_hashes.json — sha256(`${salt}:${code}`)
     hex, the same algorithm as private/build-code-hashes.mjs — so whenever
     the codes change, BOTH files must be rewritten in the same commit. */

  function serializeCodesJson(file) {
    const w = Math.max(0, ...file.codes.map(e => e.slug.length));
    const lines = file.codes.map(e =>
      `    { "slug": "${e.slug}",${' '.repeat(w - e.slug.length)} "code": "${e.code}" }`);
    return '{\n'
      + `  "_comment": ${JSON.stringify(file._comment || '')},\n`
      + `  "salt": ${JSON.stringify(file.salt)},\n`
      + `  "codes": [\n${lines.join(',\n')}\n  ]\n}\n`;
  }

  async function sha256Hex(text) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return Array.from(new Uint8Array(buf), b => b.toString(16).padStart(2, '0')).join('');
  }

  async function buildCodeHashesJson(file) {
    const entries = {};
    for (const { slug, code } of file.codes) {
      entries[await sha256Hex(`${file.salt}:${code}`)] = slug;
    }
    return JSON.stringify({ salt: file.salt, entries }, null, 2) + '\n';
  }

  /* Clone the codes file with one slug's code set (or removed when null),
     preserving entry order. */
  function withCode(file, slug, code) {
    const codes = file.codes.filter(e => e.slug !== slug || code != null)
      .map(e => e.slug === slug ? { ...e, code } : { ...e });
    if (code != null && !file.codes.some(e => e.slug === slug)) codes.push({ slug, code });
    return { ...file, codes };
  }

  /* The two generated/secret files every code change must rewrite together. */
  async function codeFileChanges(codesFile) {
    return [
      { path: 'private/codes.json', text: serializeCodesJson(codesFile) },
      { path: 'data/code_hashes.json', text: await buildCodeHashesJson(codesFile) },
    ];
  }


  /* ---------- state ---------- */

  const state = {
    cottages: [],
    cottagesJson: [],      // in-memory copy of data/cottages.json
    codesFile: null,       // in-memory copy of private/codes.json ({_comment, salt, codes})
    sha: new Map(),        // path → git blob SHA (for writes)
    current: null,
    dirty: false,
    geo: null,
    cleanBody: '',         // markdown snapshot at last load/save — for dirty detection
  };

  /* ---------- load all ---------- */

  async function loadAll(preferSlug) {
    setStatus('saving', 'wczytuję…');

    // One API call fetches the entire tree with all SHAs.
    const tree = await ghFetch('GET', `git/trees/${cfg.branch}?recursive=1`);
    if (tree.truncated) console.warn('Tree truncated — some files may be missing');

    state.sha.clear();
    for (const item of tree.tree) state.sha.set(item.path, item.sha);

    const baseUrl = `https://raw.githubusercontent.com/${cfg.owner}/${cfg.repo}/${cfg.branch}`;

    // Identify cottage slugs from tree.
    const slugs = tree.tree
      .filter(i => i.type === 'blob' && i.path.startsWith('cottages/') && i.path.endsWith('.md'))
      .map(i => i.path.slice('cottages/'.length, -'.md'.length));

    // Fetch file content via blob API — authoritative, no CDN propagation delay.
    const fetchBlob = sha => ghFetch('GET', `git/blobs/${sha}`).then(b => base64ToUtf8(b.content));
    const codesSha = state.sha.get('private/codes.json');
    const [jsonRaw, codesRaw, ...mdTexts] = await Promise.all([
      fetchBlob(state.sha.get('data/cottages.json')).then(t => JSON.parse(t)),
      // Branches that predate the secret-codes split have no private/codes.json;
      // start empty there and the first code edit will create the file.
      codesSha ? fetchBlob(codesSha).then(t => JSON.parse(t)) : Promise.resolve(null),
      ...slugs.map(s => fetchBlob(state.sha.get(`cottages/${s}.md`))),
    ]);

    state.cottagesJson = jsonRaw;
    state.codesFile = codesRaw || {
      _comment: 'TAJNE pary slug → code. Nigdy nie publikować — patrz private/build-code-hashes.mjs.',
      salt: Array.from(crypto.getRandomValues(new Uint8Array(12)), b => b.toString(16).padStart(2, '0')).join(''),
      codes: [],
    };
    const codeBySlug = new Map(state.codesFile.codes.map(e => [e.slug, e.code]));
    const bySlug = new Map(jsonRaw.map(c => [c.slug, c]));

    state.cottages = slugs.map((slug, i) => {
      const { fm, body } = parseFrontmatter(mdTexts[i]);
      const j = bySlug.get(slug) || {};
      const audioPath = `assets/stories/${slug}.mp3`;
      const photos = tree.tree
        .filter(item => item.type === 'blob' && item.path.startsWith(`assets/img/cottages/${slug}/`))
        .map(item => ({
          name: item.path.split('/').pop(),
          url: `${baseUrl}/${item.path}?v=${item.sha.slice(0, 8)}`,
        }));
      return {
        slug, frontmatter: fm, body,
        mapX: j.mapX ?? null, mapY: j.mapY ?? null,
        code: codeBySlug.get(slug) ?? null,
        audio: {
          exists: state.sha.has(audioPath),
          url: state.sha.has(audioPath) ? `${baseUrl}/${audioPath}?v=${state.sha.get(audioPath).slice(0, 8)}` : null,
        },
        photos,
      };
    });

    const order = new Map(jsonRaw.map((c, i) => [c.slug, i]));
    state.cottages.sort((a, b) => (order.get(a.slug) ?? 999) - (order.get(b.slug) ?? 999));

    // Rebuild dropdown.
    els.select.innerHTML = state.cottages
      .map(c => `<option value="${c.slug}">${escapeHtml(c.frontmatter.title || c.slug)} — ${c.slug}</option>`)
      .join('');

    const target = (preferSlug && state.cottages.some(c => c.slug === preferSlug))
      ? preferSlug
      : (state.current && state.cottages.some(c => c.slug === state.current.slug))
        ? state.current.slug
        : state.cottages[0]?.slug;

    if (target) selectCottage(target);
    else { state.current = null; setStatus('clean', 'brak chatynek'); }
  }

  /* ---------- select / form ---------- */

  function selectCottage(slug) {
    if (state.dirty && !confirm('Masz niezapisane zmiany. Porzucić je?')) {
      els.select.value = state.current?.slug || ''; return;
    }
    const c = state.cottages.find(x => x.slug === slug);
    if (!c) return;
    state.current = c;
    els.select.value = slug;
    els.delete.disabled = false;
    fillForm(c);
    placeSymbolicPin(c.mapX, c.mapY);
    renderGhostPins();
    checkPinProximity();
    placeGeoMarker(c.frontmatter.lat, c.frontmatter.lng);
    refreshAudio();
    refreshPhotos();
    markClean();
  }

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
    return {
      frontmatter: {
        title: els.title.value.trim(),
        slug: state.current.slug,
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

  /* ---------- status ---------- */

  function setStatus(s, text) { els.status.dataset.state = s; els.status.textContent = text; }
  function markDirty() { state.dirty = true; els.save.disabled = false; els.discard.disabled = false; setStatus('dirty', 'niezapisane'); }
  function markClean() { state.dirty = false; els.save.disabled = true; els.discard.disabled = true; setStatus('clean', 'zapisane'); }

  /* ---------- discard changes ----------
     Throw away unsaved edits to the current cottage and reload the canonical
     version straight from the repository (GitHub). */
  async function discardChanges() {
    if (!state.current || !state.dirty) return;
    if (!confirm('Odrzucić niezapisane zmiany i wczytać aktualną wersję z repozytorium?')) return;
    const slug = state.current.slug;
    // Clear the dirty flag first so the reload doesn't trigger the
    // "unsaved changes" prompt again inside selectCottage().
    state.dirty = false;
    els.discard.disabled = true;
    setStatus('saving', 'wczytuję z repozytorium…');
    try {
      await loadAll(slug);   // re-fetches the tree + blobs from the remote
    } catch (e) {
      setStatus('error', `błąd: ${e.message}`);
      state.dirty = true;
      els.discard.disabled = false;
    }
  }

  /* ---------- save cottage ---------- */

  async function save() {
    if (!state.current) return;
    const code = els.code.value.trim();
    const conflict = codeConflict(code);
    if (conflict) {
      setStatus('error', `kod ${code} zajęty przez „${conflict.frontmatter?.title || conflict.slug}"`);
      els.code.focus();
      return;
    }
    // Soft guard: overlapping pins are hard to tap on a phone. Let the author
    // save anyway (two cottages may genuinely share a trailhead), but not by
    // accident — require an explicit confirm.
    const near = nearestConflict(numOrNull(els.mapX.value), numOrNull(els.mapY.value));
    if (near) {
      const t = near.cottage.frontmatter?.title || near.cottage.slug;
      if (!confirm(`Pinezka nakłada się z chatynką „${t}" — będzie trudno ją kliknąć na telefonie. Zapisać mimo to?`)) {
        return;
      }
    }
    setStatus('saving', 'zapisuję…');
    els.save.disabled = true;
    try {
      const payload = harvestForm();
      const slug = state.current.slug;

      const fm = { ...(payload.frontmatter || {}), slug };
      if (typeof fm.lat === 'string') fm.lat = Number(fm.lat);
      if (typeof fm.lng === 'string') fm.lng = Number(fm.lng);
      const mdText = serializeMd(fm, payload.body || '');

      const freshJson = state.cottagesJson.map(e => ({ ...e }));
      let entry = freshJson.find(c => c.slug === slug);
      if (!entry) { entry = { slug }; freshJson.push(entry); }
      if (fm.title) entry.title = fm.title;
      if (Number.isFinite(fm.lat)) entry.lat = fm.lat;
      if (Number.isFinite(fm.lng)) entry.lng = fm.lng;
      if (payload.mapX != null) entry.mapX = Number(payload.mapX);
      if (payload.mapY != null) entry.mapY = Number(payload.mapY);

      const changes = [
        { path: `cottages/${slug}.md`, text: mdText },
        { path: 'data/cottages.json', text: serializeCottagesJson(freshJson) },
      ];
      // The plaque code is secret — it goes to private/codes.json (plus the
      // regenerated public hash file), never into data/cottages.json.
      const oldCode = state.codesFile.codes.find(e => e.slug === slug)?.code ?? null;
      const freshCodes = payload.code !== oldCode
        ? withCode(state.codesFile, slug, payload.code) : null;
      if (freshCodes) changes.push(...await codeFileChanges(freshCodes));

      await commitChanges(changes, `edit: ${slug}`);

      // Update in-memory state to the freshly committed version.
      state.cottagesJson = freshJson;
      if (freshCodes) state.codesFile = freshCodes;
      Object.assign(state.current, { frontmatter: fm, body: payload.body, mapX: payload.mapX, mapY: payload.mapY, code: payload.code });

      // Refresh the dropdown option label to reflect the new title.
      const opt = Array.from(els.select.options).find(o => o.value === slug);
      if (opt) opt.textContent = `${fm.title || slug} — ${slug}`;

      state.cleanBody = state.mde.getMarkdown();
      markClean();
    } catch (e) {
      setStatus('error', `błąd: ${e.message}`);
      els.save.disabled = false;
    }
  }

  /* ---------- add / delete cottage ---------- */

  const DEFAULT_LAT = 50.32, DEFAULT_LNG = 19.6;

  function newCottageBody(title) {
    return [
      `# ${title}`, '', '> Krótki opis chatynki.', '',
      '## Jak znaleźć Chatynkę', '', `- **Współrzędne:** \`${DEFAULT_LAT}, ${DEFAULT_LNG}\``, '',
      '## Mieszka tu', '', '(uzupełnij: kto mieszka, jakiej cnoty uczy)', '',
      '## Co zrobić, gdy trafisz pod chatynkę?', '', '1. Przystań na chwilę.', '2. Posłuchaj.',
    ].join('\n');
  }

  function openAddDialog() {
    if (state.dirty && !confirm('Masz niezapisane zmiany. Porzucić je?')) return;
    els.addSlug.value = ''; els.addTitle.value = '';
    els.addError.hidden = true;
    els.addDialog.showModal();
    setTimeout(() => els.addSlug.focus(), 0);
  }

  async function confirmAdd() {
    const slug = els.addSlug.value.trim();
    const title = els.addTitle.value.trim();
    if (!/^[a-z0-9-]+$/.test(slug)) { showAddError('Slug: małe litery, cyfry, myślniki.'); return; }
    if (!title) { showAddError('Podaj tytuł.'); return; }
    if (state.cottages.some(c => c.slug === slug)) { showAddError(`Chatynka „${slug}" już istnieje.`); return; }
    els.addConfirm.disabled = true;
    try {
      const fm = { title, slug, occupant: '', lat: DEFAULT_LAT, lng: DEFAULT_LNG, virtue: '' };
      const newEntry = { slug, title, lat: DEFAULT_LAT, lng: DEFAULT_LNG, mapX: 50, mapY: 50 };
      const freshJson = state.cottagesJson.map(e => ({ ...e }));
      if (freshJson.some(c => c.slug === slug)) { showAddError(`Chatynka „${slug}" już istnieje.`); return; }
      freshJson.push(newEntry);
      await commitChanges([
        { path: `cottages/${slug}.md`, text: serializeMd(fm, newCottageBody(title)) },
        { path: 'data/cottages.json', text: serializeCottagesJson(freshJson) },
      ], `add: ${slug}`);
      state.cottagesJson = freshJson;
      state.dirty = false;
      els.addDialog.close();
      await loadAll(slug);
    } catch (e) {
      showAddError(`Błąd: ${e.message}`);
    } finally { els.addConfirm.disabled = false; }
  }

  function showAddError(msg) { els.addError.textContent = msg; els.addError.hidden = false; }

  async function deleteCurrent() {
    const c = state.current;
    if (!c) return;
    const lines = [
      `Usunąć chatynkę „${c.frontmatter.title || c.slug}" (${c.slug})?`, '',
      'Zostaną usunięte:', `• cottages/${c.slug}.md`, '• wpis w data/cottages.json',
      ...(c.audio?.exists ? [`• assets/stories/${c.slug}.mp3`] : []),
      ...(c.photos?.length ? [`• ${c.photos.length} zdjęcia`] : []),
      '', 'Można cofnąć przez git przed kolejną edycją.',
    ];
    if (!confirm(lines.join('\n'))) return;
    setStatus('saving', 'usuwam…');
    try {
      const freshJson = state.cottagesJson;
      const changes = [
        { path: `cottages/${c.slug}.md`, delete: true },
        { path: 'data/cottages.json', text: serializeCottagesJson(freshJson.filter(x => x.slug !== c.slug)) },
        ...(c.audio?.exists ? [{ path: `assets/stories/${c.slug}.mp3`, delete: true }] : []),
        ...(c.photos || []).map(p => ({ path: `assets/img/cottages/${c.slug}/${p.name}`, delete: true })),
      ];
      const freshCodes = state.codesFile.codes.some(e => e.slug === c.slug)
        ? withCode(state.codesFile, c.slug, null) : null;
      if (freshCodes) changes.push(...await codeFileChanges(freshCodes));
      await commitChanges(changes, `delete: ${c.slug}`);
      state.cottagesJson = freshJson.filter(x => x.slug !== c.slug);
      if (freshCodes) state.codesFile = freshCodes;
      state.dirty = false; state.current = null;
      await loadAll();
    } catch (e) { setStatus('error', `błąd: ${e.message}`); }
  }

  /* ---------- audio ---------- */

  function refreshAudio() {
    const c = state.current;
    if (c?.audio.exists) {
      els.audioPreview.src = c.audio.url;
      els.audioMeta.textContent = `assets/stories/${c.slug}.mp3`;
      els.audioDelete.disabled = false;
    } else {
      els.audioPreview.removeAttribute('src'); els.audioPreview.load();
      els.audioMeta.textContent = 'brak pliku audio';
      els.audioDelete.disabled = true;
    }
  }

  async function uploadAudio(file) {
    if (!state.current || !file) return;
    if (file.size > MAX_AUDIO_BYTES) { setStatus('error', 'plik za duży (maks. 30 MB)'); return; }
    setStatus('saving', 'wgrywam audio…');
    try {
      const buf = await file.arrayBuffer();
      const path = `assets/stories/${state.current.slug}.mp3`;
      await commitChanges([{ path, binary: buf }], `audio: ${state.current.slug}`);
      const url = `${rawUrl(path)}`;
      state.current.audio = { exists: true, url };
      els.audioPreview.src = url;
      els.audioMeta.textContent = `assets/stories/${state.current.slug}.mp3`;
      els.audioDelete.disabled = false;
      setStatus('clean', 'audio wgrane');
    } catch (e) { setStatus('error', `błąd: ${e.message}`); }
  }

  async function deleteAudio() {
    if (!state.current || !state.current.audio.exists) return;
    if (!confirm(`Usunąć plik audio dla chatynki „${state.current.slug}"?`)) return;
    setStatus('saving', 'usuwam audio…');
    try {
      const path = `assets/stories/${state.current.slug}.mp3`;
      await commitChanges([{ path, delete: true }], `remove audio: ${state.current.slug}`);
      state.current.audio = { exists: false, url: null };
      refreshAudio();
      setStatus('clean', 'audio usunięte');
    } catch (e) { setStatus('error', `błąd: ${e.message}`); }
  }

  /* ---------- photos ---------- */

  function refreshPhotos() {
    const photos = state.current?.photos || [];
    els.photosGrid.innerHTML = photos.map(p => `
      <figure class="photo-thumb" data-name="${escapeHtml(p.name)}">
        <img src="${escapeHtml(p.url)}" alt="${escapeHtml(p.name)}" loading="lazy">
        <figcaption>
          <span class="photo-name" title="${escapeHtml(p.name)}">${escapeHtml(p.name)}</span>
          <button type="button" class="photo-delete" aria-label="Usuń ${escapeHtml(p.name)}">×</button>
        </figcaption>
      </figure>`).join('');
    const n = photos.length;
    els.photosMeta.textContent = n ? `${n} ${n === 1 ? 'zdjęcie' : n < 5 ? 'zdjęcia' : 'zdjęć'}` : '—';
  }

  function sanitizePhotoName(raw) {
    return String(raw).replace(/^.*[/\\]/, '').replace(/[^\w.-]+/g, '-').replace(/^-+|-+$/g, '');
  }

  async function uploadPhotos(files) {
    if (!state.current || !files.length) return;
    const slug = state.current.slug;
    setStatus('saving', `wgrywam ${files.length} plik${files.length > 1 ? 'i' : ''}…`);
    const changes = [];
    const newPhotos = [];
    for (const file of files) {
      if (file.size > MAX_PHOTO_BYTES) { setStatus('error', `${file.name} za duży (maks. 10 MB)`); continue; }
      const buf = await file.arrayBuffer();
      const name = sanitizePhotoName(file.name) || 'photo.jpg';
      const path = `assets/img/cottages/${slug}/${name}`;
      changes.push({ path, binary: buf });
      newPhotos.push({ name, url: URL.createObjectURL(new Blob([buf], { type: file.type })) });
    }
    if (!changes.length) return;
    try {
      await commitChanges(changes, `photos: ${slug}`);
      // Replace blob URLs with raw.githubusercontent.com now that SHA is known.
      for (const p of newPhotos) {
        const path = `assets/img/cottages/${slug}/${p.name}`;
        p.url = rawUrl(path);
      }
      state.current.photos = [...(state.current.photos || []), ...newPhotos]
        .sort((a, b) => a.name.localeCompare(b.name));
      refreshPhotos();
      setStatus('clean', `wgrano ${changes.length} zdjęci${changes.length === 1 ? 'e' : 'a'}`);
    } catch (e) { setStatus('error', `błąd: ${e.message}`); }
  }

  async function deletePhoto(name) {
    if (!state.current) return;
    if (!confirm(`Usunąć zdjęcie „${name}"?`)) return;
    const slug = state.current.slug;
    setStatus('saving', 'usuwam zdjęcie…');
    try {
      await commitChanges([{ path: `assets/img/cottages/${slug}/${name}`, delete: true }], `remove photo: ${slug}/${name}`);
      state.current.photos = state.current.photos.filter(p => p.name !== name);
      refreshPhotos();
      setStatus('clean', 'zdjęcie usunięte');
    } catch (e) { setStatus('error', `błąd: ${e.message}`); }
  }

  /* ---------- symbolic pin ---------- */

  // Pins closer than this — measured in native map-image pixels (the image is
  // 1024x1536) — merge into an untappable blob on a phone. dx/dy are percentages,
  // so scale to native px before measuring.
  const MIN_GAP_PX = 50;
  const gapPx = (ax, ay, bx, by) =>
    Math.hypot((ax - bx) * 10.24, (ay - by) * 15.36);

  function placeSymbolicPin(x, y) {
    if (x == null || y == null || isNaN(x) || isNaN(y)) { els.symbolicPin.hidden = true; return; }
    els.symbolicPin.hidden = false;
    els.symbolicPin.style.left = `${x}%`;
    els.symbolicPin.style.top = `${y}%`;
  }

  // Dimmed markers for every OTHER cottage, so the author can place into empty
  // space instead of on top of an existing pin.
  function renderGhostPins() {
    els.symbolicMap.querySelectorAll('.symbolic-pin--ghost').forEach(n => n.remove());
    const cur = state.current?.slug;
    for (const c of state.cottages) {
      if (c.slug === cur) continue;
      const x = Number(c.mapX), y = Number(c.mapY);
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
      const g = document.createElement('div');
      g.className = 'symbolic-pin--ghost';
      g.dataset.slug = c.slug;
      g.style.left = `${x}%`;
      g.style.top = `${y}%`;
      g.title = c.frontmatter?.title || c.slug;
      els.symbolicMap.appendChild(g);
    }
  }

  // Closest OTHER cottage within MIN_GAP_PX of (x,y), or null.
  function nearestConflict(x, y) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    let best = null;
    for (const c of state.cottages) {
      if (c.slug === state.current?.slug) continue;
      const cx = Number(c.mapX), cy = Number(c.mapY);
      if (!Number.isFinite(cx) || !Number.isFinite(cy)) continue;
      const d = gapPx(x, y, cx, cy);
      if (d < MIN_GAP_PX && (!best || d < best.gapPx)) best = { cottage: c, gapPx: d };
    }
    return best;
  }

  // Live proximity feedback — mirrors checkCodeUniqueness().
  function checkPinProximity() {
    const hit = nearestConflict(numOrNull(els.mapX.value), numOrNull(els.mapY.value));
    els.symbolicMap.querySelectorAll('.symbolic-pin--ghost.is-conflict')
      .forEach(n => n.classList.remove('is-conflict'));
    els.symbolicPin.classList.toggle('is-conflict', !!hit);
    if (hit) {
      const g = els.symbolicMap.querySelector(`.symbolic-pin--ghost[data-slug="${hit.cottage.slug}"]`);
      if (g) g.classList.add('is-conflict');
      const title = hit.cottage.frontmatter?.title || hit.cottage.slug;
      els.pinWarning.textContent =
        `⚠ Za blisko chatynki „${title}" — na telefonie pinezki będą się nakładać. Przesuń pinezkę dalej.`;
      els.pinWarning.hidden = false;
    } else {
      els.pinWarning.hidden = true;
      els.pinWarning.textContent = '';
    }
  }

  function symbolicMapClick(ev) {
    const rect = els.symbolicImg.getBoundingClientRect();
    const x = Math.round(((ev.clientX - rect.left) / rect.width) * 10000) / 100;
    const y = Math.round(((ev.clientY - rect.top) / rect.height) * 10000) / 100;
    if (x < 0 || x > 100 || y < 0 || y > 100) return;
    els.mapX.value = x; els.mapY.value = y;
    placeSymbolicPin(x, y);
    checkPinProximity();
    markDirty();
  }

  /* ---------- Leaflet geo map ---------- */

  function initGeoMap() {
    const map = L.map(els.geoMap, { zoomControl: true }).setView([50.32, 19.6], 12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors', maxZoom: 19,
    }).addTo(map);
    const marker = L.marker([50.32, 19.6], { draggable: true });
    const updateLatLng = ll => {
      els.lat.value = Math.round(ll.lat * 1e6) / 1e6;
      els.lng.value = Math.round(ll.lng * 1e6) / 1e6;
      markDirty();
    };
    marker.on('dragend', () => updateLatLng(marker.getLatLng()));
    map.on('click', ev => { marker.setLatLng(ev.latlng).addTo(map); updateLatLng(ev.latlng); });
    state.geo = { map, marker };
    new ResizeObserver(() => map.invalidateSize()).observe(els.geoMap);
  }

  function placeGeoMarker(lat, lng) {
    if (!state.geo) return;
    const { map, marker } = state.geo;
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      marker.setLatLng([lat, lng]).addTo(map);
      map.setView([lat, lng], 14);
    } else {
      map.removeLayer(marker);
      map.setView([50.32, 19.6], 12);
    }
  }

  /* ---------- auth / settings ---------- */

  const $ = sel => document.querySelector(sel);

  const els = {
    authOverlay: $('#auth-overlay'),
    authToken: $('#auth-token'),
    authOwner: $('#auth-owner'),
    authRepo: $('#auth-repo'),
    authBranch: $('#auth-branch'),
    authError: $('#auth-error'),
    authConfirm: $('#btn-auth-confirm'),
    authCancel: $('#btn-auth-cancel'),
    editorRoot: $('#editor-root'),
    select: $('#cottage-select'),
    save: $('#btn-save'),
    discard: $('#btn-discard'),
    add: $('#btn-add'),
    delete: $('#btn-delete'),
    settings: $('#btn-settings'),
    status: $('#status-pill'),
    title: $('#f-title'), occupant: $('#f-occupant'), virtue: $('#f-virtue'), code: $('#f-code'),
    lat: $('#f-lat'), lng: $('#f-lng'), mapX: $('#f-mapx'), mapY: $('#f-mapy'),
    bodyEditor: $('#f-body-editor'),
    audioPreview: $('#audio-preview'), audioFile: $('#audio-file'),
    audioDelete: $('#btn-audio-delete'), audioMeta: $('#audio-meta'),
    photosGrid: $('#photos-grid'), photosFile: $('#photos-file'), photosMeta: $('#photos-meta'),
    symbolicMap: $('#symbolic-map'), symbolicImg: $('#symbolic-img'), symbolicPin: $('#symbolic-pin'),
    pinWarning: $('#pin-warning'),
    geoMap: $('#geo-map'),
    addDialog: $('#add-dialog'), addSlug: $('#add-slug'), addTitle: $('#add-title'),
    addError: $('#add-error'), addConfirm: $('#btn-add-confirm'),
  };

  function prefillAuthForm() {
    els.authToken.value = cfg.token || '';
    els.authOwner.value = cfg.owner || '';
    els.authRepo.value  = cfg.repo  || '';
    els.authBranch.value = cfg.branch || 'main';
  }

  function showAuthOverlay(errorMsg) {
    prefillAuthForm();
    if (errorMsg) { els.authError.textContent = errorMsg; els.authError.hidden = false; }
    else els.authError.hidden = true;
    // Show cancel only when editor was already loaded (settings mode, not initial auth).
    els.authCancel.hidden = els.editorRoot.hidden;
    els.authOverlay.hidden = false;
    els.editorRoot.hidden = true;
    setTimeout(() => els.authToken.focus(), 0);
  }

  function hideAuthOverlay() {
    els.authOverlay.hidden = true;
    els.editorRoot.hidden = false;
  }

  async function tryAuth() {
    const token = els.authToken.value.trim();
    const owner = els.authOwner.value.trim() || detected.owner;
    const repo  = els.authRepo.value.trim()  || detected.repo;
    const branch = els.authBranch.value.trim() || 'main';
    if (!token) { els.authError.textContent = 'Podaj token.'; els.authError.hidden = false; return; }
    if (!owner || !repo) { els.authError.textContent = 'Podaj właściciela i nazwę repozytorium.'; els.authError.hidden = false; return; }
    els.authConfirm.disabled = true;
    els.authError.hidden = true;
    // Validate by probing the repo.
    cfg = { token, owner, repo, branch };
    try {
      await ghFetch('GET', `git/refs/heads/${branch}`);
      saveConfig(cfg);
      els.authOverlay.hidden = true;
      els.editorRoot.hidden = false;
      await loadAll();
    } catch (e) {
      const msg = e.status === 401 ? 'Nieprawidłowy token.' : e.status === 404 ? 'Nie znaleziono repozytorium lub gałęzi.' : e.message;
      els.authError.textContent = msg;
      els.authError.hidden = false;
    } finally { els.authConfirm.disabled = false; }
  }

  /* ---------- wiring ---------- */

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

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

    els.authConfirm.addEventListener('click', tryAuth);
    els.authCancel.addEventListener('click', hideAuthOverlay);
    els.authToken.addEventListener('keydown', ev => { if (ev.key === 'Enter') tryAuth(); });

    els.select.addEventListener('change', () => selectCottage(els.select.value));
    els.save.addEventListener('click', save);
    els.discard.addEventListener('click', discardChanges);
    els.settings.addEventListener('click', () => showAuthOverlay());
    els.add.addEventListener('click', openAddDialog);
    els.delete.addEventListener('click', deleteCurrent);
    els.addConfirm.addEventListener('click', confirmAdd);
    els.addSlug.addEventListener('keydown', ev => { if (ev.key === 'Enter') { ev.preventDefault(); els.addTitle.focus(); } });
    els.addTitle.addEventListener('keydown', ev => { if (ev.key === 'Enter') { ev.preventDefault(); confirmAdd(); } });

    for (const id of ['title', 'occupant', 'virtue', 'code', 'lat', 'lng', 'mapX', 'mapY']) {
      els[id].addEventListener('input', () => {
        markDirty();
        if (id === 'code') checkCodeUniqueness();
        if (id === 'mapX' || id === 'mapY') { placeSymbolicPin(numOrNull(els.mapX.value), numOrNull(els.mapY.value)); checkPinProximity(); }
        if ((id === 'lat' || id === 'lng') && state.geo) {
          const lat = numOrNull(els.lat.value), lng = numOrNull(els.lng.value);
          placeGeoMarker(lat, lng);
        }
      });
    }

    els.symbolicMap.addEventListener('click', symbolicMapClick);

    els.audioFile.addEventListener('change', ev => {
      const f = ev.target.files?.[0]; if (f) uploadAudio(f); ev.target.value = '';
    });
    els.audioDelete.addEventListener('click', deleteAudio);

    els.photosFile.addEventListener('change', ev => {
      const files = Array.from(ev.target.files || []); if (files.length) uploadPhotos(files); ev.target.value = '';
    });
    els.photosGrid.addEventListener('click', ev => {
      const btn = ev.target.closest('.photo-delete');
      if (btn) { const fig = btn.closest('.photo-thumb'); if (fig?.dataset.name) deletePhoto(fig.dataset.name); }
    });

    window.addEventListener('keydown', ev => {
      if ((ev.ctrlKey || ev.metaKey) && ev.key === 's') { ev.preventDefault(); if (!els.save.disabled) save(); }
    });
    window.addEventListener('beforeunload', ev => { if (state.dirty) { ev.preventDefault(); ev.returnValue = ''; } });
  }

  /* ---------- boot ---------- */

  wire();
  if (cfg.token && cfg.owner && cfg.repo) {
    els.editorRoot.hidden = false;
    loadAll().catch(e => showAuthOverlay(e.message));
  } else {
    showAuthOverlay();
  }
})();
