/* Chatynkowo internal editor — local HTTP server.
   Reads/writes cottage data on disk. Never deployed (private/ is stripped
   from the GitHub Pages artifact). Run with: `node private/admin/server.mjs`.

   Endpoints:
     GET    /api/cottages              → list all cottages w/ frontmatter, body, mapX/Y, audio
     PUT    /api/cottages/:slug        → save frontmatter+body+mapX/Y (writes .md and patches cottages.json)
     POST   /api/cottages/:slug/audio  → replace assets/stories/<slug>.mp3 (raw body)
     DELETE /api/cottages/:slug/audio  → remove the mp3
     POST   /api/git/publish           → git add/commit/push, returns combined stdout/stderr
     GET    /api/git/status            → short porcelain status

   Anything else is served as a static file from the project root. */

import http from 'node:http';
import fs from 'node:fs/promises';
import { existsSync, statSync, createReadStream } from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import { spawn } from 'node:child_process';

const HERE = path.dirname(url.fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const PORT = Number(process.env.ADMIN_PORT) || 8787;
const HOST = process.env.ADMIN_HOST || '127.0.0.1';

const COTTAGES_DIR = path.join(ROOT, 'cottages');
const CJSON_PATH = path.join(ROOT, 'data', 'cottages.json');
const STORIES_DIR = path.join(ROOT, 'assets', 'stories');
const PHOTOS_ROOT = path.join(ROOT, 'assets', 'img', 'cottages');

const SLUG_RE = /^[a-z0-9-]+$/;
const PHOTO_NAME_RE = /^[A-Za-z0-9._-]+\.(webp|jpe?g|png|gif|avif)$/i;
const MAX_AUDIO_BYTES = 30 * 1024 * 1024;
const MAX_PHOTO_BYTES = 15 * 1024 * 1024;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.mp3': 'audio/mpeg',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
};

/* ---------- frontmatter ---------- */

function parseFrontmatter(raw) {
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) return { fm: {}, body: raw };
  const fm = {};
  for (const line of m[1].split(/\r?\n/)) {
    const mm = line.match(/^([A-Za-z_][\w-]*)\s*:\s*(.*?)\s*$/);
    if (!mm) continue;
    let v = mm[2];
    if (v.startsWith('"') && v.endsWith('"')) {
      v = v.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, '\\');
    } else if (/^-?\d+(\.\d+)?$/.test(v)) {
      v = Number(v);
    }
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
    if (typeof v === 'number') {
      lines.push(`${k}: ${v}`);
    } else {
      const s = String(v);
      // Quote if contains spaces/colons/quotes; bare otherwise (matches existing files).
      if (/[\s:"#&*?|<>=%@`]/.test(s) || s === '') {
        lines.push(`${k}: "${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`);
      } else {
        lines.push(`${k}: ${s}`);
      }
    }
  };
  for (const k of order) {
    if (k in fm) { emit(k, fm[k]); seen.add(k); }
  }
  for (const k of Object.keys(fm)) {
    if (!seen.has(k)) emit(k, fm[k]);
  }
  lines.push('---');
  // Body: exactly one blank line between `---` and the first content line,
  // and exactly one trailing newline at EOF.
  const trimmed = String(body || '').replace(/^\r?\n+/, '').replace(/\r?\n+$/, '');
  return lines.join('\n') + '\n\n' + trimmed + '\n';
}

/* ---------- cottages.json (one record per line, padded; matches existing style) ---------- */

/* Mirror the existing data/cottages.json layout: one record per line, each
   non-last `"key": value,` segment padded with trailing spaces so the next
   key aligns across rows; segments separated by a single space. Idempotent. */
function serializeCottagesJson(records) {
  const fields = ['slug', 'title', 'lat', 'lng', 'mapX', 'mapY', 'code'];
  const segMax = {};
  for (const f of fields) {
    let max = 0;
    for (const r of records) {
      if (r[f] === undefined) continue;
      const seg = `"${f}": ${JSON.stringify(r[f])},`;
      if (seg.length > max) max = seg.length;
    }
    segMax[f] = max;
  }
  const lines = records.map(r => {
    const present = fields.filter(f => r[f] !== undefined);
    const parts = present.map((f, i) => {
      const v = JSON.stringify(r[f]);
      if (i < present.length - 1) return `"${f}": ${v},`.padEnd(segMax[f]);
      return `"${f}": ${v}`;
    });
    return '  { ' + parts.join(' ') + ' }';
  });
  return '[\n' + lines.join(',\n') + '\n]\n';
}

/* ---------- handlers ---------- */

/* ---------- photos ---------- */

function photoDir(slug) { return path.join(PHOTOS_ROOT, slug); }

async function listPhotos(slug) {
  const dir = photoDir(slug);
  if (!existsSync(dir)) return [];
  const files = (await fs.readdir(dir)).filter(f => PHOTO_NAME_RE.test(f));
  files.sort((a, b) => a.localeCompare(b));
  return files.map(f => {
    const full = path.join(dir, f);
    const st = statSync(full);
    return {
      name: f,
      url: `/assets/img/cottages/${slug}/${f}?t=${st.mtimeMs}`,
      size: st.size,
    };
  });
}

function sanitizePhotoName(raw) {
  const base = String(raw || '').replace(/^.*[/\\]/, '');
  const cleaned = base.replace(/[^\w.-]+/g, '-').replace(/^-+|-+$/g, '');
  return cleaned;
}

async function uniquePhotoName(dir, name) {
  if (!existsSync(path.join(dir, name))) return name;
  const ext = path.extname(name);
  const stem = path.basename(name, ext);
  for (let i = 1; i < 1000; i++) {
    const candidate = `${stem}-${i}${ext}`;
    if (!existsSync(path.join(dir, candidate))) return candidate;
  }
  throw httpErr(500, 'too many name collisions');
}

async function savePhoto(slug, rawName, body) {
  if (!SLUG_RE.test(slug)) throw httpErr(400, 'invalid slug');
  if (body.length > MAX_PHOTO_BYTES) throw httpErr(413, 'photo too large');
  const sanitized = sanitizePhotoName(rawName);
  if (!PHOTO_NAME_RE.test(sanitized)) {
    throw httpErr(400, 'invalid filename — must end with .webp/.jpg/.jpeg/.png/.gif/.avif');
  }
  const dir = photoDir(slug);
  await fs.mkdir(dir, { recursive: true });
  const finalName = await uniquePhotoName(dir, sanitized);
  await fs.writeFile(path.join(dir, finalName), body);
  const st = statSync(path.join(dir, finalName));
  return {
    name: finalName,
    url: `/assets/img/cottages/${slug}/${finalName}?t=${st.mtimeMs}`,
    size: st.size,
  };
}

async function deletePhoto(slug, name) {
  if (!SLUG_RE.test(slug)) throw httpErr(400, 'invalid slug');
  if (!PHOTO_NAME_RE.test(name)) throw httpErr(400, 'invalid filename');
  const p = path.join(photoDir(slug), name);
  if (existsSync(p)) await fs.unlink(p);
  // Remove now-empty cottage photo dir to keep the tree tidy.
  const dir = photoDir(slug);
  if (existsSync(dir)) {
    const remaining = await fs.readdir(dir);
    if (remaining.length === 0) await fs.rmdir(dir);
  }
  return { ok: true };
}

async function listCottages() {
  const files = (await fs.readdir(COTTAGES_DIR)).filter(f => f.endsWith('.md'));
  const json = JSON.parse(await fs.readFile(CJSON_PATH, 'utf8'));
  const bySlug = new Map(json.map(c => [c.slug, c]));
  const out = [];
  for (const f of files) {
    const slug = f.replace(/\.md$/, '');
    const raw = await fs.readFile(path.join(COTTAGES_DIR, f), 'utf8');
    const { fm, body } = parseFrontmatter(raw);
    const j = bySlug.get(slug) || {};
    const audioPath = path.join(STORIES_DIR, slug + '.mp3');
    const hasAudio = existsSync(audioPath);
    out.push({
      slug,
      frontmatter: fm,
      body,
      mapX: j.mapX ?? null,
      mapY: j.mapY ?? null,
      code: j.code ?? null,
      jsonTitle: j.title ?? null,
      jsonLat: j.lat ?? null,
      jsonLng: j.lng ?? null,
      audio: {
        exists: hasAudio,
        url: hasAudio ? `/assets/stories/${slug}.mp3?t=${statSync(audioPath).mtimeMs}` : null,
        size: hasAudio ? statSync(audioPath).size : 0,
      },
      photos: await listPhotos(slug),
    });
  }
  // Order by JSON order for familiarity.
  const order = new Map(json.map((c, i) => [c.slug, i]));
  out.sort((a, b) => (order.get(a.slug) ?? 999) - (order.get(b.slug) ?? 999));
  return out;
}

async function saveCottage(slug, payload) {
  if (!SLUG_RE.test(slug)) throw httpErr(400, 'invalid slug');
  const fm = { ...(payload.frontmatter || {}) };
  fm.slug = slug; // enforce slug consistency
  if (typeof fm.lat === 'string') fm.lat = Number(fm.lat);
  if (typeof fm.lng === 'string') fm.lng = Number(fm.lng);
  const md = serializeMd(fm, payload.body || '');
  await fs.writeFile(path.join(COTTAGES_DIR, slug + '.md'), md, 'utf8');

  // Sync cottages.json.
  const json = JSON.parse(await fs.readFile(CJSON_PATH, 'utf8'));
  let entry = json.find(c => c.slug === slug);
  if (!entry) {
    entry = { slug };
    json.push(entry);
  }
  if (fm.title) entry.title = fm.title;
  if (Number.isFinite(fm.lat)) entry.lat = fm.lat;
  if (Number.isFinite(fm.lng)) entry.lng = fm.lng;
  if (payload.mapX != null && payload.mapX !== '') entry.mapX = Number(payload.mapX);
  if (payload.mapY != null && payload.mapY !== '') entry.mapY = Number(payload.mapY);
  if (payload.code != null) entry.code = String(payload.code).trim() || undefined;
  if (entry.code === undefined) delete entry.code;
  await fs.writeFile(CJSON_PATH, serializeCottagesJson(json), 'utf8');
  return { ok: true };
}

/* Defaults for a freshly created cottage. lat/lng are the rough centroid
   of the existing cluster; mapX/mapY put the pin at the centre of the
   symbolic illustration so the editor can immediately drag/click it. */
const DEFAULT_LAT = 50.32;
const DEFAULT_LNG = 19.6;
const DEFAULT_MAP_X = 50;
const DEFAULT_MAP_Y = 50;

function newCottageBody(title, lat, lng) {
  return [
    `# ${title}`,
    '',
    '> Krótki opis chatynki.',
    '',
    '## Jak znaleźć Chatynkę',
    '',
    `- **Współrzędne:** \`${lat}, ${lng}\``,
    '',
    '## Mieszka tu',
    '',
    '(uzupełnij: kto mieszka, jakiej cnoty uczy)',
    '',
    '## Co zrobić, gdy trafisz pod chatynkę?',
    '',
    '1. Przystań na chwilę.',
    '2. Posłuchaj.',
  ].join('\n');
}

async function createCottage(payload) {
  const slug = String(payload.slug || '').trim();
  if (!SLUG_RE.test(slug)) throw httpErr(400, 'invalid slug — use lowercase letters, digits, dashes');
  const mdPath = path.join(COTTAGES_DIR, slug + '.md');
  if (existsSync(mdPath)) throw httpErr(409, `cottage "${slug}" already exists`);
  const title = String(payload.title || '').trim() || `Chatynka ${slug}`;
  const fm = {
    title,
    slug,
    occupant: '',
    lat: DEFAULT_LAT,
    lng: DEFAULT_LNG,
    virtue: '',
  };
  await fs.writeFile(mdPath, serializeMd(fm, newCottageBody(title, DEFAULT_LAT, DEFAULT_LNG)), 'utf8');

  const json = JSON.parse(await fs.readFile(CJSON_PATH, 'utf8'));
  if (!json.find(c => c.slug === slug)) {
    const newEntry = { slug, title, lat: DEFAULT_LAT, lng: DEFAULT_LNG, mapX: DEFAULT_MAP_X, mapY: DEFAULT_MAP_Y };
    if (payload.code) newEntry.code = String(payload.code).trim();
    json.push(newEntry);
    await fs.writeFile(CJSON_PATH, serializeCottagesJson(json), 'utf8');
  }
  return { ok: true, slug };
}

async function removeCottage(slug) {
  if (!SLUG_RE.test(slug)) throw httpErr(400, 'invalid slug');
  const mdPath = path.join(COTTAGES_DIR, slug + '.md');
  if (!existsSync(mdPath)) throw httpErr(404, `cottage "${slug}" not found`);
  await fs.unlink(mdPath);

  const json = JSON.parse(await fs.readFile(CJSON_PATH, 'utf8'));
  const filtered = json.filter(c => c.slug !== slug);
  if (filtered.length !== json.length) {
    await fs.writeFile(CJSON_PATH, serializeCottagesJson(filtered), 'utf8');
  }

  const audioPath = path.join(STORIES_DIR, slug + '.mp3');
  if (existsSync(audioPath)) await fs.unlink(audioPath);

  const pdir = photoDir(slug);
  if (existsSync(pdir)) await fs.rm(pdir, { recursive: true, force: true });

  return { ok: true };
}

async function saveAudio(slug, body) {
  if (!SLUG_RE.test(slug)) throw httpErr(400, 'invalid slug');
  if (body.length > MAX_AUDIO_BYTES) throw httpErr(413, 'audio file too large');
  await fs.mkdir(STORIES_DIR, { recursive: true });
  await fs.writeFile(path.join(STORIES_DIR, slug + '.mp3'), body);
  return { ok: true, bytes: body.length };
}

async function deleteAudio(slug) {
  if (!SLUG_RE.test(slug)) throw httpErr(400, 'invalid slug');
  const p = path.join(STORIES_DIR, slug + '.mp3');
  if (existsSync(p)) await fs.unlink(p);
  return { ok: true };
}

function runGit(args) {
  return new Promise((resolve) => {
    const child = spawn('git', args, { cwd: ROOT });
    let stdout = '', stderr = '';
    child.stdout.on('data', d => { stdout += d.toString(); });
    child.stderr.on('data', d => { stderr += d.toString(); });
    child.on('close', code => resolve({ code, stdout, stderr }));
    child.on('error', err => resolve({ code: -1, stdout, stderr: String(err) }));
  });
}

async function gitStatus() {
  const r = await runGit(['status', '--porcelain']);
  return { code: r.code, lines: r.stdout.split('\n').filter(Boolean) };
}

async function gitPublish(message) {
  const log = [];
  const step = async (label, args) => {
    const r = await runGit(args);
    log.push(`$ git ${args.join(' ')}\n${r.stdout}${r.stderr}`.trim());
    if (r.code !== 0) throw httpErr(500, log.join('\n\n'));
  };
  await step('add', ['add', 'cottages', 'data/cottages.json', 'assets/stories', 'assets/img/cottages']);
  // Bail early if nothing to commit.
  const diff = await runGit(['diff', '--cached', '--quiet']);
  if (diff.code === 0) return { ok: true, log: 'Nothing to commit.' };
  const msg = (message && String(message).trim()) || 'edit: cottage data';
  await step('commit', ['commit', '-m', msg]);
  await step('push', ['push']);
  return { ok: true, log: log.join('\n\n') };
}

/* ---------- HTTP plumbing ---------- */

function httpErr(status, message) {
  const e = new Error(message);
  e.status = status;
  return e;
}

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body),
    'cache-control': 'no-store',
  });
  res.end(body);
}

function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;
    req.on('data', chunk => {
      total += chunk.length;
      if (total > limit) {
        reject(httpErr(413, 'request body too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

async function readJson(req) {
  const buf = await readBody(req, 5 * 1024 * 1024);
  if (!buf.length) return {};
  return JSON.parse(buf.toString('utf8'));
}

async function serveStatic(req, res) {
  const u = new URL(req.url, `http://${req.headers.host}`);
  let pathname = decodeURIComponent(u.pathname);
  if (pathname === '/') pathname = '/index.html';
  if (pathname === '/admin' || pathname === '/admin/') pathname = '/admin/index.html';
  // Map /admin/* to private/admin/*
  let abs;
  if (pathname.startsWith('/admin/')) {
    abs = path.join(HERE, pathname.replace(/^\/admin\//, ''));
  } else {
    abs = path.join(ROOT, pathname);
  }
  // Prevent path traversal: must stay under ROOT.
  if (!abs.startsWith(ROOT) && !abs.startsWith(HERE)) {
    res.writeHead(403); res.end('forbidden'); return;
  }
  if (!existsSync(abs) || !statSync(abs).isFile()) {
    res.writeHead(404); res.end('not found'); return;
  }
  const ext = path.extname(abs).toLowerCase();
  res.writeHead(200, {
    'content-type': MIME[ext] || 'application/octet-stream',
    'cache-control': 'no-store',
  });
  createReadStream(abs).pipe(res);
}

async function route(req, res) {
  const u = new URL(req.url, `http://${req.headers.host}`);
  const mCottage = u.pathname.match(/^\/api\/cottages\/([a-z0-9-]+)$/);
  const mAudio = u.pathname.match(/^\/api\/cottages\/([a-z0-9-]+)\/audio$/);
  const mPhotos = u.pathname.match(/^\/api\/cottages\/([a-z0-9-]+)\/photos$/);
  const mPhoto = u.pathname.match(/^\/api\/cottages\/([a-z0-9-]+)\/photos\/([^/]+)$/);

  if (u.pathname === '/api/cottages' && req.method === 'GET') {
    return sendJson(res, 200, await listCottages());
  }
  if (u.pathname === '/api/cottages' && req.method === 'POST') {
    const payload = await readJson(req);
    return sendJson(res, 201, await createCottage(payload));
  }
  if (mCottage && req.method === 'PUT') {
    const payload = await readJson(req);
    return sendJson(res, 200, await saveCottage(mCottage[1], payload));
  }
  if (mCottage && req.method === 'DELETE') {
    return sendJson(res, 200, await removeCottage(mCottage[1]));
  }
  if (mAudio && req.method === 'POST') {
    const buf = await readBody(req, MAX_AUDIO_BYTES);
    return sendJson(res, 200, await saveAudio(mAudio[1], buf));
  }
  if (mAudio && req.method === 'DELETE') {
    return sendJson(res, 200, await deleteAudio(mAudio[1]));
  }
  if (mPhotos && req.method === 'GET') {
    return sendJson(res, 200, await listPhotos(mPhotos[1]));
  }
  if (mPhoto && req.method === 'POST') {
    const buf = await readBody(req, MAX_PHOTO_BYTES);
    return sendJson(res, 201, await savePhoto(mPhoto[1], decodeURIComponent(mPhoto[2]), buf));
  }
  if (mPhoto && req.method === 'DELETE') {
    return sendJson(res, 200, await deletePhoto(mPhoto[1], decodeURIComponent(mPhoto[2])));
  }
  if (u.pathname === '/api/git/status' && req.method === 'GET') {
    return sendJson(res, 200, await gitStatus());
  }
  if (u.pathname === '/api/git/publish' && req.method === 'POST') {
    const payload = await readJson(req);
    return sendJson(res, 200, await gitPublish(payload.message));
  }

  return serveStatic(req, res);
}

const server = http.createServer(async (req, res) => {
  try {
    await route(req, res);
  } catch (e) {
    const status = e.status || 500;
    sendJson(res, status, { error: e.message || String(e) });
  }
});

server.listen(PORT, HOST, () => {
  const where = `http://${HOST}:${PORT}`;
  console.log(`Chatynkowo editor running:`);
  console.log(`  Public site : ${where}/`);
  console.log(`  Admin UI    : ${where}/admin/`);
  console.log(`  Project root: ${ROOT}`);
  console.log(`Press Ctrl+C to stop.`);
});
