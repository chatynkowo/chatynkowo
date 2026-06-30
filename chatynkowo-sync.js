/* ---------- Chatynkowo — Ranking sync (Supabase + Google) ----------
   Shared module for the main page (main.js calls it via window.chatynkowoSync)
   and the ranking page (ranking.js imports the functions directly).

   Google sign-in is handled by Supabase Auth (Google provider). Play stays
   anonymous (localStorage); you only sign in to appear in the ranking. On
   sign-in, the localStorage finds are pushed to the server with their REAL
   foundAt dates, so the completion time is genuine and syncs across devices.

   Config: fill in the two constants below (see Readme.md → "Ranking Zdobywców —
   Supabase configuration"). Without them the module is safely disabled
   (supabase === null) and nothing breaks. */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

/* ====================================================================
   CONFIG — paste the values from your Supabase project.
   Project URL: the BASE project URL — https://<ref>.supabase.co
     ⚠️ WITHOUT the /rest/v1/ suffix! The client appends /auth/v1/, /rest/v1/,
     etc. itself. (The "Data API" page shows the URL with /rest/v1/ — do NOT copy
     that suffix, or sign-in goes to /rest/v1/… and you get "No API key found".)
   Key: Project Settings → API Keys → Publishable key (sb_publishable_…), the
     successor to the old "anon" key. Both values are public by design.
   ==================================================================== */
export const SUPABASE_URL      = 'https://wqlodfnukdjrulcvzvtk.supabase.co';
export const SUPABASE_ANON_KEY = 'sb_publishable_ASCFENexhyJ0sMopHKJIzQ_WhodJFoc';
/* ==================================================================== */

/* Cottage count taken DYNAMICALLY from data/cottages.json (the single source of
   truth) — never hardcoded. Fetched once and cached; works on ranking.html too,
   where main.js is not loaded. The path is relative to the page (index/ranking
   live at the root), so it resolves to /data/cottages.json. */
const COTTAGES_URL = 'data/cottages.json';
let _totalCottages = null;

export async function totalCottages() {
  if (_totalCottages != null) return _totalCottages;
  try {
    const res = await fetch(COTTAGES_URL, { cache: 'no-cache' });
    const arr = await res.json();
    _totalCottages = Array.isArray(arr) ? arr.length : 0;
  } catch (e) {
    console.error('[ranking] totalCottages', e);
    _totalCottages = 0;
  }
  return _totalCottages;
}

export const configured =
  !/YOUR-PROJECT|YOUR-ANON/.test(`${SUPABASE_URL}${SUPABASE_ANON_KEY}`);

export const supabase = configured
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

const STORAGE_KEY = 'chatynkowo:state:v1';   // same key as app_logic.js

/* Short, non-sensitive id for the ?me= link (NOT the Google sub). */
function newPublicId() {
  const a = new Uint8Array(9);
  crypto.getRandomValues(a);
  return Array.from(a, (b) => b.toString(36)).join('').slice(0, 12);
}

/* Read finds from localStorage (works on the ranking page too). */
export function localFinds() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    return parsed && parsed.version === 1 ? (parsed.found || {}) : {};
  } catch (_) { return {}; }
}

export async function getSession() {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session ?? null;
}

export function onAuthChange(cb) {
  if (!supabase) return () => {};
  const { data } = supabase.auth.onAuthStateChange((_e, session) => cb(session));
  return () => data.subscription.unsubscribe();
}

export async function signInWithGoogle(redirectTo = location.href) {
  if (!supabase) throw new Error('Supabase nie jest skonfigurowane — uzupełnij chatynkowo-sync.js.');
  return supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo } });
}

export async function signOut() { if (supabase) await supabase.auth.signOut(); }

/* Profile created lazily on first sign-in. Default display name = the Google
   given name; the photo is NOT copied automatically (opt-in in the profile
   editor on the ranking page). */
export async function ensureProfile(session) {
  if (!supabase || !session) return null;
  const uid = session.user.id;
  const { data: existing } = await supabase
    .from('profiles').select('*').eq('id', uid).maybeSingle();
  if (existing) return existing;

  const md = session.user.user_metadata || {};
  const name = (md.given_name || md.name || md.full_name || 'Zdobywca').trim().slice(0, 40);
  const { data: created, error } = await supabase
    .from('profiles')
    .insert({ id: uid, public_id: newPublicId(), display_name: name })
    .select('*').single();
  if (error) { console.error('[ranking] ensureProfile', error); return null; }
  return created;
}

/* Push the full set of localStorage finds (idempotent). */
export async function syncFinds(session, foundMap = localFinds()) {
  if (!supabase || !session) return;
  const rows = Object.entries(foundMap).map(([slug, v]) => ({
    user_id: session.user.id,
    slug,
    found_at: (v && v.foundAt) || new Date().toISOString(),
  }));
  if (!rows.length) return;
  const { error } = await supabase
    .from('finds').upsert(rows, { onConflict: 'user_id,slug', ignoreDuplicates: true });
  if (error) { console.error('[ranking] syncFinds', error); return; }
  await maybeMarkCompleted(session, rows.length);
}

/* A single find (live sync on the main page when signed in). */
export async function recordFind(session, slug, foundAt, foundCount = 0) {
  if (!supabase || !session) return;
  const { error } = await supabase.from('finds').upsert(
    { user_id: session.user.id, slug, found_at: foundAt || new Date().toISOString() },
    { onConflict: 'user_id,slug', ignoreDuplicates: true });
  if (error) { console.error('[ranking] recordFind', error); return; }
  await maybeMarkCompleted(session, foundCount);
}

async function maybeMarkCompleted(session, count) {
  const total = await totalCottages();
  if (!supabase || total <= 0 || count < total) return;
  await supabase.from('profiles')
    .update({ completed_at: new Date().toISOString() })
    .eq('id', session.user.id);
}

export async function updateProfile(session, patch) {
  if (!supabase || !session) return null;
  const clean = {};
  if (typeof patch.display_name === 'string') clean.display_name = patch.display_name.trim().slice(0, 40);
  if ('avatar_url' in patch) clean.avatar_url = patch.avatar_url || null;   // null = hide the photo
  const { data, error } = await supabase
    .from('profiles').update(clean).eq('id', session.user.id).select('*').single();
  if (error) { console.error('[ranking] updateProfile', error); return null; }
  return data;
}

export async function fetchLeaderboard() {
  if (!supabase) return [];
  const total = await totalCottages();
  if (!total) return [];   // without a known cottage count we can't judge "completion"
  const { data, error } = await supabase.rpc('leaderboard', { p_total: total });
  if (error) { console.error('[ranking] fetchLeaderboard', error); return []; }
  return data || [];
}

/* ---------- Bridge for the classic (non-module) main.js ---------- */
window.chatynkowoSync = {
  configured,
  signInWithGoogle,
  getSession,
  /* Called on every NEW find on the main page. A no-op when the visitor isn't
     signed in — the sync then happens after they sign in. */
  async onFound(slug, foundAt, foundCount) {
    const session = await getSession();
    if (!session) return;
    await ensureProfile(session);
    await recordFind(session, slug, foundAt, foundCount);
  },
};
