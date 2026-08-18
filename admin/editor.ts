import L from 'leaflet'
import Editor from '@toast-ui/editor'
import { marked } from 'marked'
import { DEFAULT_LANGUAGE, LANGUAGES } from '../src/i18n/registry'
import 'leaflet/dist/leaflet.css'
import '@toast-ui/editor/dist/toastui-editor.css'

/* Chatynkowo internal editor — GitHub Pages edition.
   Reads/writes files directly through the GitHub Contents & Git Data APIs.
   Authentication: GitHub Personal Access Token stored in localStorage.
   No server required.

   The editor edits exactly what the published site reads, and nothing else:
     • cottages/<slug>.md      — title/occupant/virtue + the story markdown
     • data/cottages.json      — slug, lat/lng, and the photo manifest
     • private/codes.json      — the secret plaque codes (+ the public hashes)
     • assets/stories/<lang>/<slug>.mp3, assets/img/cottages/<slug>/…
     • data/rewards.json       — the Kronika: intro + reward levels
*/

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

  /* Drop changes that would not actually change the repository.

     GitHub accepts a tree identical to its parent and records an EMPTY commit:
     no files, no diff. To the author that reads as "the editor threw my work
     away" — the commit is right there in the history with nothing in it. It
     happens whenever the dirty flag is set by an action that does not alter
     content (re-picking the same image is the easy way to trigger it), because
     the flag tracks "the user did something", not "the bytes differ".

     Compare each change against the blob SHA we already know for that path and
     drop the no-ops. Needs crypto.subtle (HTTPS/localhost) — where it is
     missing we commit as before rather than skip a real change. */
  async function effectiveChanges(changes) {
    if (!window.isSecureContext || !window.crypto?.subtle) return changes;
    const out = [];
    for (const ch of changes) {
      if (ch.delete) {
        if (state.sha.has(ch.path)) out.push(ch);   // deleting a missing file: no-op
        continue;
      }
      const known = state.sha.get(ch.path);
      if (known) {
        const bytes = ch.binary ? ch.binary : new TextEncoder().encode(ch.text || '');
        if (await gitBlobSha(bytes) === known) continue;   // byte-identical already
      }
      out.push(ch);
    }
    return out;
  }

  /* Commit multiple files (add/modify/delete) in a single Git commit.
     changes: [{path, text?, binary?: ArrayBuffer, delete?: true}]
     Returns null when nothing would change — callers must not report a save
     that never happened. */
  async function commitChanges(rawChanges, message) {
    const changes = await effectiveChanges(rawChanges);
    if (!changes.length) return null;

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

    // Update the local SHA cache from the blobs we just created — NOT from
    // newTree.tree. Git trees are hierarchical, so the create-tree response
    // lists the root's DIRECT children ("data", "assets", … as type "tree"),
    // never "data/rewards.json". Reading SHAs back from it cached directory
    // SHAs under directory names and left every real file path stale, which
    // broke two things at once: rawUrl() kept minting the pre-save "?v=" so the
    // browser re-served the cached OLD image after an upload, and
    // effectiveChanges() compared against SHAs that never moved.
    for (const item of treeItems) {
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

  /* git's blob object hash: sha1("blob <byteLength>\0" + bytes). Computing it
     in-browser lets us compare a file's bytes against the repo blob SHA from
     the tree, with no manual version stamping to forget to bump. */
  async function gitBlobSha(buf) {
    const data = new Uint8Array(buf);
    const header = new TextEncoder().encode(`blob ${data.length}\0`);
    const full = new Uint8Array(header.length + data.length);
    full.set(header, 0);
    full.set(data, header.length);
    const digest = await crypto.subtle.digest('SHA-1', full);
    return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
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
    const order = ['title', 'slug', 'occupant', 'virtue'];
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
    // Location + the photo manifest ONLY. No 'title' — the .md frontmatter is
    // the single source for text. No 'code' — the secret codes live in
    // private/codes.json.
    // NOTE: every save rewrites the whole file through this whitelist, so any
    // field missing here is silently dropped from ALL records — when adding a
    // new optional field to cottages.json, it MUST be listed here too.
    const fields = ['slug', 'lat', 'lng', 'photos'];
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
     hex, the same algorithm as private/build-code-hashes.ts — so whenever
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
    // crypto.subtle exists only in secure contexts (HTTPS or localhost) —
    // surface a clear error instead of a cryptic TypeError when the editor
    // runs over plain http:// on a LAN hostname.
    if (!window.isSecureContext || !window.crypto?.subtle) {
      throw new Error(`zapis kodów wymaga bezpiecznego połączenia (HTTPS lub localhost), a edytor działa na „${location.origin}”`);
    }
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
    mde: null,             // toastui editor for the cottage story
    cleanBody: '',         // markdown snapshot at last load/save — for dirty detection
    // ---- Rewards / Kronika mode ----
    mode: 'cottages',      // active editor mode: 'cottages' | 'rewards'
    rewards: null,         // in-memory data/rewards.json ({ treasury, levels })
    rewardsLoaded: null,   // snapshot from last load/save — for discard
    rwCurrent: 'treasury', // current reward selection: 'treasury' | level id
    rwDirty: false,
    rwMde: null,           // toastui editor for treasury intro / level body (lazy)
    rwFilling: false,      // suppress dirty/preview while programmatically filling
    rwPendingImages: new Map(), // path → { buffer, type, url } staged image uploads
    // ---- Content language (translation mode) ----
    // Polish is the canonical original; any other language turns both
    // categories into translation mode, editing the parallel files
    // (cottages/<lang>/<slug>.md, data/rewards.<lang>.json). The
    // language-neutral fields (code, pin, photos, thresholds, order,
    // images) hide or lock — the Polish original owns them. Audio stays
    // editable: each language keeps its own recording and the site falls
    // back to the Polish one when a language has none.
    language: DEFAULT_LANGUAGE,
    trCache: new Map(),    // `${lang}/${slug}` → { fm, body, exists } last loaded/saved cottage translation
    rwTr: new Map(),       // lang → { treasury, byId, loaded } rewards translation draft + clean snapshot
  };

  const translating = () => state.language !== DEFAULT_LANGUAGE;
  const trKey = slug => `${state.language}/${slug}`;

  /* Blob content for a path from the already-fetched tree, or null when the
     file does not exist in the repository. */
  async function fetchBlobPath(path) {
    const sha = state.sha.get(path);
    if (!sha) return null;
    const blob = await ghFetch('GET', `git/blobs/${sha}`);
    return base64ToUtf8(blob.content);
  }

  /* ---------- load all ---------- */

  async function loadAll(preferSlug) {
    setStatus('saving', 'wczytuję…');

    // One API call fetches the entire tree with all SHAs.
    const tree = await ghFetch('GET', `git/trees/${cfg.branch}?recursive=1`);
    if (tree.truncated) console.warn('Tree truncated — some files may be missing');

    state.sha.clear();
    for (const item of tree.tree) state.sha.set(item.path, item.sha);
    // A fresh tree invalidates any cached translations.
    state.trCache.clear();
    state.rwTr.clear();

    const baseUrl = `https://raw.githubusercontent.com/${cfg.owner}/${cfg.repo}/${cfg.branch}`;

    // Identify cottage slugs from tree. Subdirectories hold translations
    // (cottages/<lang>/<slug>.md) — only the top-level Polish originals are
    // the cottages this editor manages.
    const slugs = tree.tree
      .filter(i => i.type === 'blob' && i.path.startsWith('cottages/') && i.path.endsWith('.md'))
      .map(i => i.path.slice('cottages/'.length, -'.md'.length))
      .filter(slug => !slug.includes('/'));

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
      _comment: 'TAJNE pary slug → code. Nigdy nie publikować — patrz private/build-code-hashes.ts.',
      salt: Array.from(crypto.getRandomValues(new Uint8Array(12)), b => b.toString(16).padStart(2, '0')).join(''),
      codes: [],
    };
    const codeBySlug = new Map(state.codesFile.codes.map(e => [e.slug, e.code]));
    const bySlug = new Map(jsonRaw.map(c => [c.slug, c]));

    state.cottages = slugs.map((slug, i) => {
      const { fm, body } = parseFrontmatter(mdTexts[i]);
      const j = bySlug.get(slug) || {};
      // The git tree is the truth about which files exist; the manifest in
      // cottages.json only decides the ORDER the site shows them in, so a
      // photo uploaded outside the editor is still picked up here.
      const present = tree.tree
        .filter(item => item.type === 'blob' && item.path.startsWith(`assets/img/cottages/${slug}/`))
        .map(item => item.path.split('/').pop());
      const manifest = Array.isArray(j.photos) ? j.photos.filter(n => present.includes(n)) : [];
      const photos = [...manifest, ...present.filter(n => !manifest.includes(n)).sort()]
        .map(name => ({ name, url: `${baseUrl}/assets/img/cottages/${slug}/${name}?v=${state.sha.get(`assets/img/cottages/${slug}/${name}`).slice(0, 8)}` }));
      return {
        slug, frontmatter: fm, body,
        lat: j.lat ?? null, lng: j.lng ?? null,
        code: codeBySlug.get(slug) ?? null,
        photos,
      };
    });

    const order = new Map(jsonRaw.map((c, i) => [c.slug, i]));
    state.cottages.sort((a, b) => (order.get(a.slug) ?? 999) - (order.get(b.slug) ?? 999));

    // Rebuild the shared dropdown (a no-op for the list when the rewards mode
    // is the active one — it is rebuilt again once rewards.json is parsed).
    renderItemSelect();

    const target = (preferSlug && state.cottages.some(c => c.slug === preferSlug))
      ? preferSlug
      : (state.current && state.cottages.some(c => c.slug === state.current.slug))
        ? state.current.slug
        : state.cottages[0]?.slug;

    if (target) selectCottage(target);
    else { state.current = null; setStatus('clean', 'brak chatynek'); }

    // ---- Rewards / Kronika config (data/rewards.json) ----
    // Absent on branches that predate this feature; start from a default so the
    // first save creates the file.
    const rewardsSha = state.sha.get('data/rewards.json');
    const rewardsRaw = rewardsSha
      ? await fetchBlob(rewardsSha).then(t => JSON.parse(t)).catch(() => null)
      : null;
    state.rewards = normalizeRewardsEditor(rewardsRaw);
    state.rewardsLoaded = cloneRewards(state.rewards);
    state.rwPendingImages.clear();
    rwMarkClean();
    renderItemSelect();
    // If the rewards editor is already open, re-fill its current view (no
    // harvest — the freshly loaded config replaces any stale form values).
    if (state.rwMde) rwFillCurrent(rwSelectionKey());
  }

  /* ---------- select / form ---------- */

  function selectCottage(slug) {
    if (state.dirty && !confirm('Masz niezapisane zmiany. Porzucić je?')) {
      syncSelectValue(); return;
    }
    const c = state.cottages.find(x => x.slug === slug);
    if (!c) return;
    state.current = c;
    syncSelectValue();
    els.delete.disabled = translating();
    if (translating()) void fillTranslationForm(c);
    else fillForm(c);
    placeGeoMarker(c.lat, c.lng);
    refreshAudio();
    refreshPhotos();
    markClean();
  }

  /* Fill the form with one cottage's translation — from the cache, from the
     repository, or (when the translation does not exist yet) prefilled with
     the Polish original as the starting point for the translator. */
  async function fillTranslationForm(c) {
    const key = trKey(c.slug);
    let tr = state.trCache.get(key);
    if (!tr) {
      setStatus('saving', 'wczytuję tłumaczenie…');
      let raw = null;
      try {
        raw = await fetchBlobPath(`cottages/${state.language}/${c.slug}.md`);
      } catch (e) {
        setStatus('error', `błąd: ${e.message}`);
        return;
      }
      // The selection or the language may have moved on while the blob loaded.
      if (state.current !== c || trKey(c.slug) !== key) return;
      if (raw != null) {
        const { fm, body } = parseFrontmatter(raw);
        tr = { fm, body, exists: true };
      } else {
        tr = { fm: { ...c.frontmatter, slug: c.slug }, body: c.body, exists: false };
      }
      state.trCache.set(key, tr);
    }
    els.title.value = tr.fm.title ?? '';
    els.occupant.value = tr.fm.occupant ?? '';
    els.virtue.value = tr.fm.virtue ?? '';
    state.mde.setMarkdown(tr.body ?? '');
    state.cleanBody = state.mde.getMarkdown();
    markClean();
  }

  function fillForm(c) {
    els.title.value = c.frontmatter.title ?? '';
    els.occupant.value = c.frontmatter.occupant ?? '';
    els.virtue.value = c.frontmatter.virtue ?? '';
    els.code.value = c.code ?? '';
    els.lat.value = c.lat ?? '';
    els.lng.value = c.lng ?? '';
    state.mde.setMarkdown(c.body ?? '');
    state.cleanBody = state.mde.getMarkdown();
  }

  function harvestForm() {
    return {
      // Text only — the .md frontmatter is the single source for title &co.
      // Location goes to data/cottages.json instead.
      frontmatter: {
        title: els.title.value.trim(),
        slug: state.current.slug,
        occupant: els.occupant.value.trim(),
        virtue: els.virtue.value.trim(),
      },
      body: state.mde.getMarkdown(),
      lat: numOrNull(els.lat.value),
      lng: numOrNull(els.lng.value),
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

  /* The photo manifest the site reads for one cottage: file names in display
     order, or undefined when there are none (keeps the JSON clean). */
  function photoManifest(c) {
    const names = (c?.photos || []).map(p => p.name);
    return names.length ? names : undefined;
  }

  /* A fresh copy of data/cottages.json with one cottage's entry updated. */
  function cottagesJsonWith(slug, patch) {
    const fresh = state.cottagesJson.map(e => ({ ...e }));
    let entry = fresh.find(c => c.slug === slug);
    if (!entry) { entry = { slug }; fresh.push(entry); }
    for (const [k, v] of Object.entries(patch)) {
      if (v === undefined) delete entry[k];
      else entry[k] = v;
    }
    return fresh;
  }

  /* ---------- status ----------
     One status pill and one discard/save pair serve both categories, so each
     category keeps its own status text and dirty flag while the toolbar shows
     whichever category is active. Every mutation goes through setModeStatus()
     / renderToolbar() rather than poking els.* directly — that way a save in
     one category can never mislabel the other one's pill. */

  const modeStatus = {
    cottages: { state: 'clean', text: 'gotowy' },
    rewards:  { state: 'clean', text: 'gotowy' },
  };

  function isDirty(mode) { return mode === 'rewards' ? state.rwDirty : state.dirty; }

  function renderToolbar() {
    const st = modeStatus[state.mode];
    els.status.dataset.state = st.state;
    els.status.textContent = st.text;
    // Nothing to save/discard when clean; nothing to touch while a commit or
    // a reload is in flight (a second click would commit twice).
    const busy = st.state === 'saving';
    const dirty = isDirty(state.mode);
    els.save.disabled = busy || !dirty;
    els.discard.disabled = busy || !dirty;
    // The toolbar only ever describes the ACTIVE category, so unsaved work in
    // the other one would be invisible until you switched back into it.
    els.tabCottages.classList.toggle('has-unsaved', state.dirty);
    els.tabRewards.classList.toggle('has-unsaved', state.rwDirty);
  }

  /* Always re-render: the pill reads the ACTIVE mode either way, but the
     unsaved dots describe both, so a background category going clean (e.g. a
     reload) still has to clear its own dot. */
  function setModeStatus(mode, s, text) {
    modeStatus[mode] = { state: s, text };
    renderToolbar();
  }

  function setStatus(s, text) { setModeStatus('cottages', s, text); }
  function markDirty() { state.dirty = true; setStatus('dirty', 'niezapisane'); }
  function markClean() { state.dirty = false; setStatus('clean', 'zapisane'); }

  /* ---------- discard changes ----------
     The shared Discard button, always scoped to the ACTIVE category: throw away
     its unsaved edits and reload the canonical version straight from the
     repository (GitHub). loadAll() necessarily refreshes BOTH categories, so
     unsaved work in the other one is called out before we pull the trigger
     rather than vanishing silently. */
  async function discardActive() {
    const mode = state.mode;
    if (!isDirty(mode)) return;
    const other = mode === 'rewards' ? 'cottages' : 'rewards';
    const lines = [`Odrzucić niezapisane zmiany w ${MODE_LABEL[mode]} i wczytać aktualną wersję z repozytorium?`];
    if (isDirty(other)) {
      lines.push('', `Uwaga: przeładowanie z repozytorium odrzuci też niezapisane zmiany w ${MODE_LABEL[other]}.`);
    }
    if (!confirm(lines.join('\n'))) return;

    const slug = state.current?.slug;
    for (const [, img] of state.rwPendingImages) URL.revokeObjectURL(img.url);
    // Clear the dirty flags first so the reload doesn't trigger the
    // "unsaved changes" prompt again inside selectCottage().
    const hadDirty = { cottages: state.dirty, rewards: state.rwDirty };
    state.dirty = false;
    state.rwDirty = false;
    setModeStatus(mode, 'saving', 'wczytuję z repozytorium…');
    try {
      await loadAll(slug);   // re-fetches the tree + blobs from the remote
    } catch (e) {
      state.dirty = hadDirty.cottages;
      state.rwDirty = hadDirty.rewards;
      setModeStatus(mode, 'error', `błąd: ${e.message}`);
      renderToolbar();
    }
  }

  /* ---------- save cottage ---------- */

  /* Resolves true only when the commit landed — callers (e.g. the category
     switch) must not move on after a failed or refused save. */
  async function save() {
    if (!state.current) return false;
    if (translating()) return saveTranslation();
    const code = els.code.value.trim();
    const conflict = codeConflict(code);
    if (conflict) {
      setStatus('error', `kod ${code} zajęty przez „${conflict.frontmatter?.title || conflict.slug}"`);
      els.code.focus();
      return false;
    }
    setStatus('saving', 'zapisuję…');   // renderToolbar() locks the buttons
    try {
      const payload = harvestForm();
      const slug = state.current.slug;

      const fm = { ...(payload.frontmatter || {}), slug };
      const mdText = serializeMd(fm, payload.body || '');

      // cottages.json carries ONLY location + the photo manifest — no title
      // (md frontmatter owns the text), no code (private/codes.json owns those).
      const freshJson = cottagesJsonWith(slug, {
        lat: payload.lat ?? undefined,
        lng: payload.lng ?? undefined,
        photos: photoManifest(state.current),
      });

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

      const commit = await commitChanges(changes, `edit: ${slug}`);

      // Update in-memory state to the freshly committed version.
      state.cottagesJson = freshJson;
      if (freshCodes) state.codesFile = freshCodes;
      Object.assign(state.current, { frontmatter: fm, body: payload.body, lat: payload.lat, lng: payload.lng, code: payload.code });

      // Refresh the dropdown option label to reflect the new title.
      renderItemSelect();

      state.cleanBody = state.mde.getMarkdown();
      markClean();
      if (!commit) setStatus('clean', 'brak zmian do zapisania');
      return true;
    } catch (e) {
      setStatus('error', `błąd: ${e.message}`);
      renderToolbar();
      return false;
    }
  }

  /* Save the current cottage's translation — one file, nothing else: the
     location, code, audio and photos are language-neutral and stay with the
     Polish original. */
  async function saveTranslation() {
    const c = state.current;
    const lang = state.language;
    setStatus('saving', 'zapisuję…');
    try {
      const fm = {
        title: els.title.value.trim(),
        slug: c.slug,
        occupant: els.occupant.value.trim(),
        virtue: els.virtue.value.trim(),
      };
      const body = state.mde.getMarkdown();
      const commit = await commitChanges(
        [{ path: `cottages/${lang}/${c.slug}.md`, text: serializeMd(fm, body) }],
        `i18n(${lang}): ${c.slug}`,
      );
      state.trCache.set(`${lang}/${c.slug}`, { fm, body, exists: true });
      state.cleanBody = state.mde.getMarkdown();
      markClean();
      if (!commit) setStatus('clean', 'brak zmian do zapisania');
      renderItemSelect();
      return true;
    } catch (e) {
      setStatus('error', `błąd: ${e.message}`);
      renderToolbar();
      return false;
    }
  }

  /* ---------- add / delete cottage ---------- */

  const DEFAULT_LAT = 50.32, DEFAULT_LNG = 19.6;

  function newCottageBody(title) {
    // Everything above "Co zrobić, gdy trafisz pod chatynkę?" is the reward for
    // entering the plaque code; the section below it is public and shows in the
    // cottage panel on the map, so it holds the on-site instructions.
    return [
      `# ${title}`, '', '> Krótki opis chatynki.', '',
      '## Mieszka tu', '', '(uzupełnij: kto mieszka, jakiej cnoty uczy)', '',
      '## Co zrobić, gdy trafisz pod chatynkę?', '', '1. Przystań na chwilę.', '2. Posłuchaj.',
    ].join('\n');
  }

  function openAddDialog() {
    if (translating()) return;
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
      const fm = { title, slug, occupant: '', virtue: '' };
      const freshJson = state.cottagesJson.map(e => ({ ...e }));
      if (freshJson.some(c => c.slug === slug)) { showAddError(`Chatynka „${slug}" już istnieje.`); return; }
      freshJson.push({ slug, lat: DEFAULT_LAT, lng: DEFAULT_LNG });
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
    if (!c || translating()) return;
    // Recordings and translated stories of this cottage — scanned from the
    // tree, so files of a language later removed from the registry are
    // cleaned up too. The optional path segment also catches a recording
    // left at the legacy flat location assets/stories/<slug>.mp3.
    const companions = [...state.sha.keys()].filter(p =>
      new RegExp(`^assets/stories/([^/]+/)?${c.slug}\\.mp3$`).test(p)
      || new RegExp(`^cottages/[^/]+/${c.slug}\\.md$`).test(p));
    const lines = [
      `Usunąć chatynkę „${c.frontmatter.title || c.slug}" (${c.slug})?`, '',
      'Zostaną usunięte:', `• cottages/${c.slug}.md`, '• wpis w data/cottages.json',
      ...companions.map(p => `• ${p}`),
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
        ...companions.map(p => ({ path: p, delete: true })),
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

  /* ---------- audio ----------
     Recordings live in one directory per language:
     assets/stories/<lang>/<slug>.mp3, with pl/ holding the originals. The
     site prefers the current language's file and falls back to the Polish
     one, so a translation may ship without audio. Existence comes straight
     from the git tree (state.sha), which commitChanges keeps current. */

  function audioPath(slug) {
    return `assets/stories/${state.language}/${slug}.mp3`;
  }

  function refreshAudio() {
    const c = state.current;
    const path = c && audioPath(c.slug);
    if (path && state.sha.has(path)) {
      els.audioPreview.src = rawUrl(path);
      els.audioMeta.textContent = path;
      els.audioDelete.disabled = false;
    } else {
      els.audioPreview.removeAttribute('src'); els.audioPreview.load();
      els.audioMeta.textContent = c && translating()
        ? 'brak nagrania w tym języku — strona odtwarza polski oryginał'
        : 'brak pliku audio';
      els.audioDelete.disabled = true;
    }
  }

  async function uploadAudio(file) {
    const c = state.current;
    if (!c || !file) return;
    if (file.size > MAX_AUDIO_BYTES) { setStatus('error', 'plik za duży (maks. 30 MB)'); return; }
    const path = audioPath(c.slug);
    const message = translating() ? `audio(${state.language}): ${c.slug}` : `audio: ${c.slug}`;
    setStatus('saving', 'wgrywam audio…');
    try {
      const buf = await file.arrayBuffer();
      await commitChanges([{ path, binary: buf }], message);
      refreshAudio();
      setStatus('clean', 'audio wgrane');
    } catch (e) { setStatus('error', `błąd: ${e.message}`); }
  }

  async function deleteAudio() {
    const c = state.current;
    if (!c) return;
    const path = audioPath(c.slug);
    if (!state.sha.has(path)) return;
    const what = translating() ? `nagranie (${state.language})` : 'plik audio';
    if (!confirm(`Usunąć ${what} dla chatynki „${c.slug}"?`)) return;
    const message = translating() ? `remove audio(${state.language}): ${c.slug}` : `remove audio: ${c.slug}`;
    setStatus('saving', 'usuwam audio…');
    try {
      await commitChanges([{ path, delete: true }], message);
      refreshAudio();
      setStatus('clean', 'audio usunięte');
    } catch (e) { setStatus('error', `błąd: ${e.message}`); }
  }

  /* ---------- photos ----------
     Uploads and deletions commit immediately, together with the rewritten
     manifest in data/cottages.json — the static site has no directory listing,
     so a file on disk that is missing from the manifest is invisible. */

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
    if (!state.current || !files.length || translating()) return;
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
      const merged = [...(state.current.photos || []).filter(p => !newPhotos.some(n => n.name === p.name)), ...newPhotos]
        .sort((a, b) => a.name.localeCompare(b.name));
      const freshJson = cottagesJsonWith(slug, { photos: merged.map(p => p.name) });
      changes.push({ path: 'data/cottages.json', text: serializeCottagesJson(freshJson) });

      await commitChanges(changes, `photos: ${slug}`);
      state.cottagesJson = freshJson;
      // Replace blob URLs with raw.githubusercontent.com now that SHA is known.
      for (const p of merged) p.url = rawUrl(`assets/img/cottages/${slug}/${p.name}`);
      state.current.photos = merged;
      refreshPhotos();
      setStatus('clean', `wgrano ${newPhotos.length} zdjęci${newPhotos.length === 1 ? 'e' : 'a'}`);
    } catch (e) { setStatus('error', `błąd: ${e.message}`); }
  }

  async function deletePhoto(name) {
    if (!state.current || translating()) return;
    if (!confirm(`Usunąć zdjęcie „${name}"?`)) return;
    const slug = state.current.slug;
    setStatus('saving', 'usuwam zdjęcie…');
    try {
      const remaining = state.current.photos.filter(p => p.name !== name);
      const freshJson = cottagesJsonWith(slug, {
        photos: remaining.length ? remaining.map(p => p.name) : undefined,
      });
      await commitChanges([
        { path: `assets/img/cottages/${slug}/${name}`, delete: true },
        { path: 'data/cottages.json', text: serializeCottagesJson(freshJson) },
      ], `remove photo: ${slug}/${name}`);
      state.cottagesJson = freshJson;
      state.current.photos = remaining;
      refreshPhotos();
      setStatus('clean', 'zdjęcie usunięte');
    } catch (e) { setStatus('error', `błąd: ${e.message}`); }
  }

  /* ---------- Leaflet geo map ---------- */

  function initGeoMap() {
    const map = L.map(els.geoMap, { zoomControl: true }).setView([DEFAULT_LAT, DEFAULT_LNG], 12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors', maxZoom: 19,
    }).addTo(map);
    const marker = L.marker([DEFAULT_LAT, DEFAULT_LNG], { draggable: true });
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
      map.setView([DEFAULT_LAT, DEFAULT_LNG], 12);
    }
  }

  /* ---------- Rewards / Kronika editor ----------
     Edits data/rewards.json — the Kronika intro and the ordered reward levels
     (collectible cards): name, threshold (or the final full-set flag), an
     illustration, and a markdown description. Mirrors the cottage editor: one
     selection at a time, one shared markdown editor, staged image uploads,
     everything committed to GitHub in a single commit on Save.

     All edits accumulate in state.rewards (in memory) until Save, so switching
     between the Kronika and the levels never loses work and never prompts —
     Discard is the only thing that reloads from the repository. */

  function normalizeRewardsEditor(raw) {
    const t = (raw && raw.treasury) || {};
    const levels = Array.isArray(raw && raw.levels) ? raw.levels : [];
    return {
      treasury: {
        title: t.title || 'Twoja Kronika',
        intro: t.intro || '',
        image: t.image || '',
      },
      levels: levels.filter(l => l && l.id).map(l => ({
        id: String(l.id),
        name: l.name || '',
        threshold: (l.threshold == null || l.threshold === '') ? null : Number(l.threshold),
        final: Boolean(l.final),
        image: l.image || '',
        body: l.body || '',
      })),
    };
  }

  function cloneRewards(rw) { return JSON.parse(JSON.stringify(rw)); }

  /* Pretty, stable JSON so diffs stay readable in git. Keys in a fixed order. */
  function serializeRewardsJson(rw) {
    const out = {
      treasury: {
        title: rw.treasury.title || '',
        intro: rw.treasury.intro || '',
        image: rw.treasury.image || '',
      },
      levels: rw.levels.map(l => ({
        id: l.id,
        name: l.name || '',
        threshold: l.final ? null : (l.threshold == null || l.threshold === '' ? null : Number(l.threshold)),
        final: Boolean(l.final),
        image: l.image || '',
        body: l.body || '',
      })),
    };
    return JSON.stringify(out, null, 2) + '\n';
  }

  function rewardHas(id) {
    return Boolean(state.rewards && state.rewards.levels.some(l => l.id === id));
  }

  function rwCurrentObj() {
    if (!state.rewards) return null;
    return state.rwCurrent === 'treasury'
      ? state.rewards.treasury
      : state.rewards.levels.find(l => l.id === state.rwCurrent) || null;
  }

  /* All reward-image paths under assets/img/rewards/ referenced by a config. */
  function rewardImagePaths(rw) {
    if (!rw) return [];
    const out = [];
    if (rw.treasury && rw.treasury.image) out.push(rw.treasury.image);
    for (const l of rw.levels || []) if (l.image) out.push(l.image);
    return out.filter(p => p.startsWith('assets/img/rewards/'));
  }

  /* Preview URL for an image path: a staged blob if freshly picked, else the
     committed raw.githubusercontent.com URL. */
  function rewardImageUrl(path) {
    if (!path) return '';
    const pending = state.rwPendingImages.get(path);
    return pending ? pending.url : rawUrl(path);
  }

  /* ---------- mode switching ---------- */

  const MODE_LABEL = { cottages: 'chatynce', rewards: 'nagrodach' };

  /* Ask what to do with unsaved work before leaving a category (or changing
     the content language). Resolves to 'save' | 'discard' | 'cancel'. */
  function askUnsaved(mode, action = 'przełączeniem kategorii') {
    return new Promise(resolve => {
      let done = false;
      const finish = choice => {
        if (done) return;
        done = true;
        els.unsavedSave.removeEventListener('click', onSave);
        els.unsavedDiscard.removeEventListener('click', onDiscard);
        els.unsavedDialog.removeEventListener('close', onClose);
        resolve(choice);
      };
      const onSave = () => { els.unsavedDialog.close(); finish('save'); };
      const onDiscard = () => { els.unsavedDialog.close(); finish('discard'); };
      // Anuluj, Esc, and any other dismissal. close() delivers this event
      // asynchronously, so one queued by a PREVIOUS prompt can land after this
      // one already reopened the dialog — that stale event must not answer a
      // question the user is still looking at. If the dialog is open, it isn't
      // ours to answer.
      const onClose = () => { if (!els.unsavedDialog.open) finish('cancel'); };
      els.unsavedSave.addEventListener('click', onSave);
      els.unsavedDiscard.addEventListener('click', onDiscard);
      els.unsavedDialog.addEventListener('close', onClose);
      els.unsavedText.textContent =
        `Masz niezapisane zmiany w ${MODE_LABEL[mode]}. Zapisać je przed ${action}?`;
      els.unsavedDialog.showModal();
    });
  }

  /* Category switch. Unsaved work in the category being left is never dropped
     silently — save it, discard it, or stay put. */
  let modeSwitching = false;   // a second tab click must not stack dialogs/saves

  async function setMode(mode) {
    if (mode === state.mode || modeSwitching) return;
    modeSwitching = true;
    try { await switchMode(mode); } finally { modeSwitching = false; }
  }

  async function switchMode(mode) {
    const leaving = state.mode;
    if (isDirty(leaving)) {
      const choice = await askUnsaved(leaving);
      if (choice === 'cancel') return;
      if (choice === 'save') {
        const saved = leaving === 'rewards' ? await rwSave() : await save();
        if (!saved) return;   // save failed or was refused — the pill says why
      } else {
        revertMode(leaving);
      }
    }
    applyMode(mode);
  }

  /* Drop unsaved edits in one category WITHOUT touching the other one: both
     categories keep their own last-loaded state in memory, so reverting is a
     local re-fill rather than a repo reload (which would take the other
     category's unsaved work down with it). */
  function revertMode(mode) {
    if (mode === 'rewards') {
      if (translating()) {
        // Translation drafts keep their own clean snapshot per language.
        const trE = state.rwTr.get(state.language);
        if (trE && trE.loaded) {
          trE.treasury = cloneRewards(trE.loaded.treasury);
          trE.byId = cloneRewards(trE.loaded.byId);
        }
        rwMarkClean();
        renderItemSelect();
        if (state.rwMde) rwFill(rwSelectionKey());
        return;
      }
      for (const [, img] of state.rwPendingImages) URL.revokeObjectURL(img.url);
      state.rwPendingImages.clear();
      state.rewards = cloneRewards(state.rewardsLoaded);
      rwMarkClean();
      renderItemSelect();
      if (state.rwMde) rwFill(rwSelectionKey());
    } else {
      // Cottage edits live only in the form until Save, so re-filling from
      // state.current restores exactly the last loaded/saved version.
      state.dirty = false;
      if (state.current) selectCottage(state.current.slug);
      else markClean();
    }
  }

  function applyMode(mode) {
    state.mode = mode;
    const rewards = mode === 'rewards';
    els.tabCottages.classList.toggle('is-active', !rewards);
    els.tabRewards.classList.toggle('is-active', rewards);
    els.tabCottages.setAttribute('aria-selected', String(!rewards));
    els.tabRewards.setAttribute('aria-selected', String(rewards));
    els.cottageActions.hidden = rewards;
    els.rewardsActions.hidden = !rewards;
    els.cottageView.hidden = rewards;
    els.rewardsView.hidden = !rewards;
    if (rewards) ensureRewardsEditor();
    renderItemSelect();   // repopulate the shared dropdown for this category
    renderToolbar();      // …and the shared status/discard/save
  }

  /* ---------- content language switching ---------- */

  function syncLangSelect() {
    if (els.langSelect) els.langSelect.value = state.language;
  }

  async function setLanguage(lang) {
    if (lang === state.language || modeSwitching) { syncLangSelect(); return; }
    modeSwitching = true;
    try {
      // Only the ACTIVE category can be dirty (category switches always
      // resolve the one being left), so one prompt settles everything.
      const mode = state.mode;
      if (isDirty(mode)) {
        const choice = await askUnsaved(mode, 'zmianą języka');
        if (choice === 'cancel') { syncLangSelect(); return; }
        if (choice === 'save') {
          const saved = mode === 'rewards' ? await rwSave() : await save();
          if (!saved) { syncLangSelect(); return; }
        } else {
          revertMode(mode);
        }
      }
      state.language = lang;
      applyLanguage();
    } finally { modeSwitching = false; }
  }

  /* Re-skin both categories for the chosen language: hide the Polish-only
     sections, show the translation hints, and refill the forms with the
     chosen language's content. */
  function applyLanguage() {
    const tr = translating();
    syncLangSelect();
    document.body.classList.toggle('is-translating', tr);
    for (const el of document.querySelectorAll('[data-pl-only]')) el.hidden = tr;
    for (const el of document.querySelectorAll('[data-tr-only]')) el.hidden = !tr;
    els.add.disabled = tr;
    els.delete.disabled = tr || !state.current;
    els.rwAdd.disabled = tr;
    els.rwDelete.disabled = tr || state.rwCurrent === 'treasury';
    renderItemSelect();
    if (state.current) {
      if (tr) void fillTranslationForm(state.current);
      else { fillForm(state.current); markClean(); }
    }
    refreshAudio();
    if (state.rwMde) rwFillCurrent(rwSelectionKey());
    renderToolbar();
  }

  /* Create the markdown editor the first time the rewards view is shown (so
     toastui measures a visible container), then fill the current selection. */
  function ensureRewardsEditor() {
    if (state.rwMde) { rwRenderPreview(); rwUpdateToolbarButtons(); return; }
    state.rwMde = new Editor({
      el: els.rwBodyEditor,
      height: 'auto',
      minHeight: '320px',
      initialEditType: 'wysiwyg',
      previewStyle: 'tab',
      toolbarItems: [['heading', 'bold', 'italic'], ['ul', 'ol'], ['link']],
      hideModeSwitch: false,
    });
    state.rwMde.on('change', () => { if (!state.rwFilling) rwOnEdit(); });
    renderItemSelect();
    rwFillCurrent(rwSelectionKey());
  }

  /* ---------- shared dropdown ----------
     A single <select> serves both categories: it is rebuilt from whichever
     data set the ACTIVE mode owns, so the two lists can never show up side by
     side. Everything that changes a label (rename, threshold, reorder, add,
     delete, load) calls renderItemSelect(). */

  function cottageOptionsHtml() {
    return state.cottages
      .map(c => {
        const missing = translating()
          && !state.trCache.get(trKey(c.slug))?.exists
          && !state.sha.has(`cottages/${state.language}/${c.slug}.md`);
        const label = `${c.frontmatter.title || c.slug} — ${c.slug}${missing ? ' · brak tłumaczenia' : ''}`;
        return `<option value="${escapeHtml(c.slug)}">${escapeHtml(label)}</option>`;
      })
      .join('');
  }

  function rewardOptionsHtml() {
    if (!state.rewards) return '';
    const trE = translating() ? state.rwTr.get(state.language) : null;
    const opts = ['<option value="treasury">🏛 Kronika (wstęp)</option>'];
    state.rewards.levels.forEach((l, idx) => {
      const thr = l.final ? 'komplet' : (l.threshold != null ? `próg ${l.threshold}` : 'próg —');
      const name = (trE && trE.byId[l.id] && trE.byId[l.id].name) || l.name || l.id;
      opts.push(`<option value="${escapeHtml(l.id)}">${idx + 1}. ${escapeHtml(name)} — ${thr}</option>`);
    });
    return opts.join('');
  }

  /* The reward selection, falling back to the Kronika when the level is gone. */
  function rwSelectionKey() {
    return (state.rwCurrent === 'treasury' || rewardHas(state.rwCurrent)) ? state.rwCurrent : 'treasury';
  }

  function syncSelectValue() {
    if (state.mode === 'rewards') els.select.value = rwSelectionKey();
    else if (state.current) els.select.value = state.current.slug;
  }

  function renderItemSelect() {
    if (!els.select) return;
    els.select.innerHTML = state.mode === 'rewards' ? rewardOptionsHtml() : cottageOptionsHtml();
    syncSelectValue();
  }

  // User-initiated selection change: keep the outgoing edits, then fill.
  function rwSelect(key) {
    rwHarvestCurrent();
    rwFillCurrent(key);
  }

  /* rwFill reads the translation draft in translation mode, so it has to be
     loaded first; Polish fills synchronously as before. */
  function rwFillCurrent(key) {
    if (!translating()) { rwFill(key); return; }
    void rwEnsureTranslation()
      .then(entry => { if (entry && translating()) rwFill(key); })
      .catch(e => rwSetStatus('error', `błąd: ${e.message}`));
  }

  /* The rewards translation draft for the current language: treasury texts and
     per-level name/body, prefilled from the Polish config wherever the
     translation file is missing a piece. `loaded` snapshots the clean state
     for revert. */
  async function rwEnsureTranslation() {
    const lang = state.language;
    let entry = state.rwTr.get(lang);
    if (entry) return entry;
    const raw = await fetchBlobPath(`data/rewards.${lang}.json`);
    if (state.language !== lang) return null;
    let norm = null;
    if (raw != null) {
      try { norm = normalizeRewardsEditor(JSON.parse(raw)); } catch { norm = null; }
    }
    const byId = {};
    for (const l of state.rewards.levels) {
      const t = norm && norm.levels.find(x => x.id === l.id);
      byId[l.id] = { name: (t && t.name) || l.name, body: t ? t.body : l.body };
    }
    entry = {
      treasury: {
        title: (norm && norm.treasury.title) || state.rewards.treasury.title,
        intro: norm ? norm.treasury.intro : state.rewards.treasury.intro,
      },
      byId,
    };
    entry.loaded = cloneRewards({ treasury: entry.treasury, byId: entry.byId });
    state.rwTr.set(lang, entry);
    return entry;
  }

  // Programmatic fill (no harvest) — used after loads, adds, deletes, reorders.
  function rwFill(key) {
    if (!state.rewards || !state.rwMde) return;
    if (key !== 'treasury' && !rewardHas(key)) key = 'treasury';
    state.rwCurrent = key;
    syncSelectValue();
    state.rwFilling = true;
    const trE = translating() ? state.rwTr.get(state.language) : null;
    if (key === 'treasury') {
      els.rwTreasuryFields.hidden = false;
      els.rwLevelFields.hidden = true;
      els.rwTreTitle.value = (trE ? trE.treasury.title : state.rewards.treasury.title) || '';
      els.rwBodyLabel.textContent = 'Wstęp do Kroniki (markdown)';
      els.rwBodyHint.textContent = 'Tekst pokazywany pod tytułem Kroniki.';
      state.rwMde.setMarkdown((trE ? trE.treasury.intro : state.rewards.treasury.intro) || '');
    } else {
      const l = state.rewards.levels.find(x => x.id === key);
      const trL = trE && trE.byId[key];
      els.rwTreasuryFields.hidden = true;
      els.rwLevelFields.hidden = false;
      els.rwName.value = (trL ? trL.name : l.name) || '';
      els.rwThreshold.value = (l.threshold == null ? '' : l.threshold);
      els.rwFinal.checked = Boolean(l.final);
      els.rwBodyLabel.textContent = 'Opis nagrody (markdown)';
      els.rwBodyHint.textContent = 'Treść pokazywana po kliknięciu karty nagrody.';
      state.rwMde.setMarkdown((trL ? trL.body : l.body) || '');
      rwUpdateFinalUI();
    }
    state.rwFilling = false;
    rwRefreshImage();
    rwUpdateToolbarButtons();
    rwRenderPreview();
  }

  function rwHarvestCurrent() {
    if (!state.rwMde || !state.rewards) return;
    const md = state.rwMde.getMarkdown();
    if (translating()) {
      // Translation drafts hold texts only; the structure stays Polish.
      const trE = state.rwTr.get(state.language);
      if (!trE) return;
      if (state.rwCurrent === 'treasury') {
        trE.treasury.title = els.rwTreTitle.value;
        trE.treasury.intro = md;
      } else {
        const t = trE.byId[state.rwCurrent];
        if (t) { t.name = els.rwName.value; t.body = md; }
      }
      return;
    }
    if (state.rwCurrent === 'treasury') {
      state.rewards.treasury.title = els.rwTreTitle.value;
      state.rewards.treasury.intro = md;
    } else {
      const l = state.rewards.levels.find(x => x.id === state.rwCurrent);
      if (l) {
        l.name = els.rwName.value;
        l.threshold = numOrNull(els.rwThreshold.value);
        l.final = els.rwFinal.checked;
        l.body = md;
      }
    }
  }

  function rwOnEdit() {
    rwHarvestCurrent();
    rwMarkDirty();
    renderItemSelect();   // keep the dropdown label in sync (name/threshold)
    rwRenderPreview();
  }

  function rwUpdateFinalUI() {
    const final = els.rwFinal.checked;
    els.rwThreshold.disabled = final;
    els.rwFinalHint.hidden = !final || translating();
  }

  function rwUpdateToolbarButtons() {
    const tr = translating();
    const isLevel = state.rwCurrent !== 'treasury';
    els.rwAdd.disabled = tr;
    els.rwDelete.disabled = tr || !isLevel;
    const arr = (state.rewards && state.rewards.levels) || [];
    const i = arr.findIndex(l => l.id === state.rwCurrent);
    els.rwMoveUp.disabled = tr || !isLevel || i <= 0;
    els.rwMoveDown.disabled = tr || !isLevel || i < 0 || i >= arr.length - 1;
  }

  /* ---------- reward image ---------- */

  function rwRefreshImage() {
    const obj = rwCurrentObj();
    const src = obj && obj.image ? rewardImageUrl(obj.image) : '';
    if (src) {
      els.rwImagePreview.src = src;
      els.rwImagePreview.hidden = false;
      els.rwImageEmpty.hidden = true;
      els.rwImageDelete.disabled = false;
    } else {
      els.rwImagePreview.removeAttribute('src');
      els.rwImagePreview.hidden = true;
      els.rwImageEmpty.hidden = false;
      els.rwImageDelete.disabled = true;
    }
  }

  /* Content-addressed name: assets/img/rewards/<id>/card.<hash8>.webp

     A fixed name would republish new bytes under an URL the visitor already
     has cached. The Kronika renders `<img src={level.image}>` with no cache
     buster and Pages serves assets with max-age=600, so a swapped card would
     keep showing the old artwork to anyone who had seen it before — invisibly,
     with the correct file sitting in the repo. Hashing the content into the
     name means new artwork is always a new URL. The file it replaces is
     removed by the orphan sweep in rwSave(), in the same commit.

     Without crypto.subtle (plain http on a LAN host) there is no hash to use —
     fall back to the fixed name, since a working upload beats a fresh URL. */
  async function rewardImagePath(key, buffer, ext) {
    const dir = key === 'treasury' ? 'treasury' : key;
    const stem = key === 'treasury' ? 'cover' : 'card';
    const tag = (window.isSecureContext && window.crypto?.subtle)
      ? `.${(await gitBlobSha(buffer)).slice(0, 8)}`
      : '';
    return `assets/img/rewards/${dir}/${stem}${tag}.${ext}`;
  }

  async function rwImageChosen(file) {
    const obj = rwCurrentObj();
    if (!file || !obj || translating()) return;
    if (file.size > MAX_PHOTO_BYTES) { rwSetStatus('error', `${file.name} za duży (maks. 10 MB)`); return; }
    const ext = (file.name.match(/\.([a-z0-9]+)$/i)?.[1] || 'jpg').toLowerCase();
    // Pin the selection now: the awaits below let the user switch levels, and
    // the bytes must land on the level they were picked for.
    const key = state.rwCurrent;
    const buffer = await file.arrayBuffer();
    const path = await rewardImagePath(key, buffer, ext);
    const url = URL.createObjectURL(new Blob([buffer], { type: file.type }));
    // Every pick with different bytes lands on a different path, so release the
    // blob staged by the pick this one replaces.
    if (obj.image && obj.image !== path && state.rwPendingImages.has(obj.image)) {
      URL.revokeObjectURL(state.rwPendingImages.get(obj.image).url);
      state.rwPendingImages.delete(obj.image);
    }
    state.rwPendingImages.set(path, { buffer, type: file.type, url });
    obj.image = path;
    rwMarkDirty();
    rwRefreshImage();
    rwRenderPreview();
  }

  function rwDeleteImage() {
    const obj = rwCurrentObj();
    if (!obj || !obj.image || translating()) return;
    if (state.rwPendingImages.has(obj.image)) {
      URL.revokeObjectURL(state.rwPendingImages.get(obj.image).url);
      state.rwPendingImages.delete(obj.image);
    }
    // The committed file (if any) is removed as an orphan on the next Save.
    obj.image = '';
    rwMarkDirty();
    rwRefreshImage();
    rwRenderPreview();
  }

  /* ---------- add / delete / reorder level ---------- */

  function rwOpenAddDialog() {
    if (translating()) return;
    els.rwAddId.value = ''; els.rwAddName.value = ''; els.rwAddError.hidden = true;
    els.rwAddDialog.showModal();
    setTimeout(() => els.rwAddId.focus(), 0);
  }

  function rwAddErr(msg) { els.rwAddError.textContent = msg; els.rwAddError.hidden = false; }

  function rwConfirmAddLevel() {
    const id = els.rwAddId.value.trim();
    const name = els.rwAddName.value.trim();
    if (!/^[a-z0-9-]+$/.test(id)) { rwAddErr('Identyfikator: małe litery, cyfry, myślniki.'); return; }
    if (!name) { rwAddErr('Podaj nazwę.'); return; }
    if (rewardHas(id)) { rwAddErr(`Poziom „${id}" już istnieje.`); return; }
    rwHarvestCurrent();
    const maxThr = Math.max(0, ...state.rewards.levels.map(l => Number(l.threshold) || 0));
    state.rewards.levels.push({ id, name, threshold: maxThr + 1, final: false, image: '', body: '' });
    els.rwAddDialog.close();
    rwMarkDirty();
    renderItemSelect();
    rwFill(id);
  }

  function rwDeleteLevel() {
    if (state.rwCurrent === 'treasury' || translating()) return;
    const l = state.rewards.levels.find(x => x.id === state.rwCurrent);
    if (!l) return;
    if (!confirm(`Usunąć poziom nagrody „${l.name || l.id}"?\n\n`
      + 'Gracze, którzy już go zdobyli, zachowają nagrodę w swojej Kronice.')) return;
    state.rewards.levels = state.rewards.levels.filter(x => x.id !== state.rwCurrent);
    rwMarkDirty();
    renderItemSelect();
    rwFill('treasury');
  }

  function rwMove(dir) {
    if (state.rwCurrent === 'treasury' || translating()) return;
    const arr = state.rewards.levels;
    const i = arr.findIndex(l => l.id === state.rwCurrent);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= arr.length) return;
    rwHarvestCurrent();
    [arr[i], arr[j]] = [arr[j], arr[i]];
    rwMarkDirty();
    renderItemSelect();
    rwFill(state.rwCurrent);
  }

  /* ---------- preview ---------- */

  function rwRenderPreview() {
    if (!els.rwPreview) return;
    const obj = rwCurrentObj();
    if (!obj) { els.rwPreview.innerHTML = '<p class="rp-empty">—</p>'; return; }
    const isTre = state.rwCurrent === 'treasury';
    // Texts come from the translation draft in translation mode; the image is
    // language-neutral, so it always comes from the Polish config (obj).
    const trE = translating() ? state.rwTr.get(state.language) : null;
    const trL = trE && !isTre ? trE.byId[state.rwCurrent] : null;
    const name = isTre
      ? ((trE ? trE.treasury.title : obj.title) || 'Twoja Kronika')
      : ((trL ? trL.name : obj.name) || state.rwCurrent);
    const text = isTre
      ? (trE ? trE.treasury.intro : obj.intro)
      : (trL ? trL.body : obj.body);
    const art = obj.image
      ? `<div class="rp-art"><img src="${escapeHtml(rewardImageUrl(obj.image))}" alt=""></div>`
      : '';
    const bodyHtml = text ? `<div class="rp-body">${marked.parse(text)}</div>` : '<p class="rp-empty">(brak opisu)</p>';
    els.rwPreview.innerHTML = `<p class="rp-name">${escapeHtml(name)}</p>${art}${bodyHtml}`;
  }

  /* ---------- status / dirty ---------- */

  function rwSetStatus(s, text) { setModeStatus('rewards', s, text); }
  function rwMarkDirty() { state.rwDirty = true; rwSetStatus('dirty', 'niezapisane'); }
  function rwMarkClean() { state.rwDirty = false; rwSetStatus('clean', 'zapisane'); }

  /* ---------- save rewards ---------- */

  /* Resolves true only when the commit landed — see save(). */
  async function rwSave() {
    if (!state.rewards) return false;
    if (translating()) return rwSaveTranslation();
    rwHarvestCurrent();
    const ids = state.rewards.levels.map(l => l.id);
    if (new Set(ids).size !== ids.length) { rwSetStatus('error', 'zduplikowane identyfikatory poziomów'); return false; }
    rwSetStatus('saving', 'zapisuję…');
    try {
      const changes = [{ path: 'data/rewards.json', text: serializeRewardsJson(state.rewards) }];
      for (const [path, img] of state.rwPendingImages) changes.push({ path, binary: img.buffer });
      // Orphan cleanup: reward images referenced before but not now (extension
      // changed, image cleared, or level deleted) are removed in this commit.
      const newPaths = new Set(rewardImagePaths(state.rewards));
      const staged = new Set(state.rwPendingImages.keys());
      for (const oldPath of rewardImagePaths(state.rewardsLoaded)) {
        if (!newPaths.has(oldPath) && !staged.has(oldPath) && state.sha.has(oldPath)) {
          changes.push({ path: oldPath, delete: true });
        }
      }
      const commit = await commitChanges(changes, 'rewards: edytuj Kronikę');
      for (const [, img] of state.rwPendingImages) URL.revokeObjectURL(img.url);
      state.rwPendingImages.clear();
      state.rewardsLoaded = cloneRewards(state.rewards);
      rwMarkClean();
      // Nothing differed from the repository — say so instead of implying a
      // commit that was never made.
      if (!commit) rwSetStatus('clean', 'brak zmian do zapisania');
      renderItemSelect();
      rwRefreshImage();
      rwRenderPreview();
      return true;
    } catch (e) {
      rwSetStatus('error', `błąd: ${e.message}`);
      renderToolbar();
      return false;
    }
  }

  /* Save the rewards translation: the Polish structure (ids, thresholds,
     order, images) merged with the translated texts, so the translation file
     can never drift structurally from the original. */
  async function rwSaveTranslation() {
    const lang = state.language;
    const trE = state.rwTr.get(lang);
    if (!trE || !state.rewards) return false;
    rwHarvestCurrent();
    rwSetStatus('saving', 'zapisuję…');
    try {
      const merged = {
        treasury: { ...state.rewards.treasury, title: trE.treasury.title, intro: trE.treasury.intro },
        levels: state.rewards.levels.map(l => ({
          ...l,
          name: (trE.byId[l.id] && trE.byId[l.id].name) || l.name,
          body: trE.byId[l.id] ? trE.byId[l.id].body : l.body,
        })),
      };
      const commit = await commitChanges(
        [{ path: `data/rewards.${lang}.json`, text: serializeRewardsJson(merged) }],
        `i18n(${lang}): nagrody`,
      );
      trE.loaded = cloneRewards({ treasury: trE.treasury, byId: trE.byId });
      rwMarkClean();
      if (!commit) rwSetStatus('clean', 'brak zmian do zapisania');
      renderItemSelect();
      rwRenderPreview();
      return true;
    } catch (e) {
      rwSetStatus('error', `błąd: ${e.message}`);
      renderToolbar();
      return false;
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
    authAdvanced: $('#auth-advanced'),
    authError: $('#auth-error'),
    authConfirm: $('#btn-auth-confirm'),
    authCancel: $('#btn-auth-cancel'),
    editorRoot: $('#editor-root'),
    // Shared toolbar — one dropdown, one status pill, one discard/save pair.
    // All four always describe the ACTIVE category (state.mode).
    select: $('#item-select'),
    langSelect: $('#lang-select'),
    save: $('#btn-save'),
    discard: $('#btn-discard'),
    add: $('#btn-add'),
    delete: $('#btn-delete'),
    settings: $('#btn-settings'),
    status: $('#status-pill'),
    title: $('#f-title'), occupant: $('#f-occupant'), virtue: $('#f-virtue'), code: $('#f-code'),
    lat: $('#f-lat'), lng: $('#f-lng'),
    bodyEditor: $('#f-body-editor'),
    audioPreview: $('#audio-preview'), audioFile: $('#audio-file'),
    audioDelete: $('#btn-audio-delete'), audioMeta: $('#audio-meta'),
    photosGrid: $('#photos-grid'), photosFile: $('#photos-file'), photosMeta: $('#photos-meta'),
    geoMap: $('#geo-map'),
    addDialog: $('#add-dialog'), addSlug: $('#add-slug'), addTitle: $('#add-title'),
    addError: $('#add-error'), addConfirm: $('#btn-add-confirm'),
    unsavedDialog: $('#unsaved-dialog'), unsavedText: $('#unsaved-text'),
    unsavedSave: $('#btn-unsaved-save'), unsavedDiscard: $('#btn-unsaved-discard'),
    // ---- Rewards mode ----
    tabCottages: $('#tab-cottages'), tabRewards: $('#tab-rewards'),
    cottageActions: $('#cottage-actions'), rewardsActions: $('#rewards-actions'),
    cottageView: $('#cottage-view'), rewardsView: $('#rewards-view'),
    rwAdd: $('#rw-add'), rwDelete: $('#rw-delete'),
    rwTreasuryFields: $('#rw-treasury-fields'), rwLevelFields: $('#rw-level-fields'),
    rwTreTitle: $('#rw-tre-title'),
    rwName: $('#rw-name'), rwThreshold: $('#rw-threshold'), rwFinal: $('#rw-final'),
    rwFinalHint: $('#rw-final-hint'), rwMoveUp: $('#rw-move-up'), rwMoveDown: $('#rw-move-down'),
    rwImage: $('#rw-image'), rwImagePreview: $('#rw-image-preview'), rwImageEmpty: $('#rw-image-empty'),
    rwImageFile: $('#rw-image-file'), rwImageDelete: $('#rw-image-delete'),
    rwBodyLabel: $('#rw-body-label'), rwBodyHint: $('#rw-body-hint'), rwBodyEditor: $('#rw-body-editor'),
    rwPreview: $('#rw-preview'),
    rwAddDialog: $('#rw-add-dialog'), rwAddId: $('#rw-add-id'), rwAddName: $('#rw-add-name'),
    rwAddError: $('#rw-add-error'), rwAddConfirm: $('#rw-add-confirm'),
  };

  function prefillAuthForm() {
    els.authToken.value = cfg.token || '';
    els.authOwner.value = cfg.owner || '';
    els.authRepo.value  = cfg.repo  || '';
    els.authBranch.value = cfg.branch || 'main';
  }

  function showAuthOverlay(errorMsg) {
    prefillAuthForm();
    // Repo auto-detection only works on the live *.github.io host. Anywhere
    // else (localhost above all) these fields are mandatory, so don't hide
    // them behind a fold the user has no reason to suspect.
    els.authAdvanced.open = !detected.owner || !detected.repo || Boolean(errorMsg);
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

  /* The sticky preview pane has to start below the toolbar, and the toolbar
     wraps to two or three rows as the window narrows — publish its real height
     so the CSS offset follows instead of guessing. */
  function trackTopbarHeight() {
    const bar = document.querySelector('.topbar');
    if (!bar) return;
    new ResizeObserver(() => {
      document.documentElement.style.setProperty('--topbar-h', `${bar.offsetHeight}px`);
    }).observe(bar);
  }

  function wire() {
    initGeoMap();
    trackTopbarHeight();

    state.mde = new Editor({
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

    // Content language: the registry is shared with the site, so a language
    // added there automatically shows up here.
    els.langSelect.innerHTML = LANGUAGES
      .map(l => `<option value="${l.code}">${l.code === DEFAULT_LANGUAGE ? `${l.nativeName} (oryginał)` : l.nativeName}</option>`)
      .join('');
    syncLangSelect();
    els.langSelect.addEventListener('change', () => { void setLanguage(els.langSelect.value); });

    // The shared dropdown / save / discard all dispatch on the active category.
    els.select.addEventListener('change', () => {
      if (state.mode === 'rewards') rwSelect(els.select.value);
      else selectCottage(els.select.value);
    });
    els.save.addEventListener('click', () => {
      if (state.mode === 'rewards') rwSave(); else save();
    });
    els.discard.addEventListener('click', discardActive);
    els.settings.addEventListener('click', () => showAuthOverlay());
    els.add.addEventListener('click', openAddDialog);
    els.delete.addEventListener('click', deleteCurrent);
    els.addConfirm.addEventListener('click', confirmAdd);
    els.addSlug.addEventListener('keydown', ev => { if (ev.key === 'Enter') { ev.preventDefault(); els.addTitle.focus(); } });
    els.addTitle.addEventListener('keydown', ev => { if (ev.key === 'Enter') { ev.preventDefault(); confirmAdd(); } });

    for (const id of ['title', 'occupant', 'virtue', 'code', 'lat', 'lng']) {
      els[id].addEventListener('input', () => {
        markDirty();
        if (id === 'code') checkCodeUniqueness();
        if ((id === 'lat' || id === 'lng') && state.geo) {
          placeGeoMarker(numOrNull(els.lat.value), numOrNull(els.lng.value));
        }
      });
    }

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

    /* ---- Rewards mode ---- */
    els.tabCottages.addEventListener('click', () => setMode('cottages'));
    els.tabRewards.addEventListener('click', () => setMode('rewards'));
    els.rwAdd.addEventListener('click', rwOpenAddDialog);
    els.rwDelete.addEventListener('click', rwDeleteLevel);
    els.rwAddConfirm.addEventListener('click', rwConfirmAddLevel);
    els.rwAddId.addEventListener('keydown', ev => { if (ev.key === 'Enter') { ev.preventDefault(); els.rwAddName.focus(); } });
    els.rwAddName.addEventListener('keydown', ev => { if (ev.key === 'Enter') { ev.preventDefault(); rwConfirmAddLevel(); } });
    els.rwMoveUp.addEventListener('click', () => rwMove(-1));
    els.rwMoveDown.addEventListener('click', () => rwMove(1));
    for (const el of [els.rwTreTitle, els.rwName, els.rwThreshold]) {
      el.addEventListener('input', () => { if (!state.rwFilling) rwOnEdit(); });
    }
    els.rwFinal.addEventListener('change', () => {
      if (state.rwFilling) return;
      rwUpdateFinalUI();
      rwOnEdit();
    });
    els.rwImageFile.addEventListener('change', ev => {
      const f = ev.target.files?.[0]; if (f) rwImageChosen(f); ev.target.value = '';
    });
    els.rwImageDelete.addEventListener('click', rwDeleteImage);

    window.addEventListener('keydown', ev => {
      if ((ev.ctrlKey || ev.metaKey) && ev.key === 's') {
        ev.preventDefault();
        if (els.save.disabled) return;
        if (state.mode === 'rewards') rwSave(); else save();
      }
    });
    window.addEventListener('beforeunload', ev => {
      if (state.dirty || state.rwDirty) { ev.preventDefault(); ev.returnValue = ''; }
    });
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
