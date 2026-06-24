/* ---------- Chatynkowo — Ranking sync (Supabase + Google) ----------
   Wspólny moduł dla strony głównej (main.js woła go przez window.chatynkowoSync)
   i strony rankingu (ranking.js importuje funkcje wprost).

   Logowanie kontem Google realizuje Supabase Auth (provider Google). Gra dalej
   działa anonimowo (localStorage); logujesz się dopiero, by trafić do rankingu.
   Przy logowaniu znaleziska z localStorage są wysyłane na serwer z PRAWDZIWYMI
   datami foundAt, więc czas ukończenia jest realny i synchronizuje się między
   urządzeniami.

   Konfiguracja: uzupełnij trzy stałe poniżej (patrz Readme.md → "Ranking
   Zdobywców — konfiguracja Supabase"). Bez nich moduł jest bezpiecznie
   wyłączony (supabase === null) i nic nie psuje. */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

/* ====================================================================
   KONFIGURACJA — wklej dane ze swojego projektu Supabase
   (Project Settings → API). Oba pola są publiczne z założenia.
   ==================================================================== */
export const SUPABASE_URL      = 'https://YOUR-PROJECT.supabase.co';
export const SUPABASE_ANON_KEY = 'YOUR-ANON-PUBLIC-KEY';
export const TOTAL_COTTAGES    = 25;   // liczba chatynek (data/cottages.json)
/* ==================================================================== */

export const configured =
  !/YOUR-PROJECT|YOUR-ANON/.test(`${SUPABASE_URL}${SUPABASE_ANON_KEY}`);

export const supabase = configured
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

const STORAGE_KEY = 'chatynkowo:state:v1';   // ten sam klucz co app_logic.js

/* Krótki, niewrażliwy identyfikator do linku ?me= (NIE jest to Google sub). */
function newPublicId() {
  const a = new Uint8Array(9);
  crypto.getRandomValues(a);
  return Array.from(a, (b) => b.toString(36)).join('').slice(0, 12);
}

/* Odczyt znalezisk z localStorage (działa też na stronie rankingu). */
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

/* Profil tworzony leniwie przy pierwszym logowaniu. Domyślny pseudonim =
   imię z konta Google; zdjęcie NIE jest kopiowane automatycznie (opt-in
   w edytorze profilu na stronie rankingu). */
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

/* Wysyła komplet znalezisk z localStorage (idempotentnie). */
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

/* Pojedyncze znalezisko (sync na żywo na stronie głównej, gdy zalogowany). */
export async function recordFind(session, slug, foundAt, foundCount = 0) {
  if (!supabase || !session) return;
  const { error } = await supabase.from('finds').upsert(
    { user_id: session.user.id, slug, found_at: foundAt || new Date().toISOString() },
    { onConflict: 'user_id,slug', ignoreDuplicates: true });
  if (error) { console.error('[ranking] recordFind', error); return; }
  await maybeMarkCompleted(session, foundCount);
}

async function maybeMarkCompleted(session, count) {
  if (!supabase || count < TOTAL_COTTAGES) return;
  await supabase.from('profiles')
    .update({ completed_at: new Date().toISOString() })
    .eq('id', session.user.id);
}

export async function updateProfile(session, patch) {
  if (!supabase || !session) return null;
  const clean = {};
  if (typeof patch.display_name === 'string') clean.display_name = patch.display_name.trim().slice(0, 40);
  if ('avatar_url' in patch) clean.avatar_url = patch.avatar_url || null;   // null = ukryj zdjęcie
  const { data, error } = await supabase
    .from('profiles').update(clean).eq('id', session.user.id).select('*').single();
  if (error) { console.error('[ranking] updateProfile', error); return null; }
  return data;
}

export async function fetchLeaderboard() {
  if (!supabase) return [];
  const { data, error } = await supabase.rpc('leaderboard', { p_total: TOTAL_COTTAGES });
  if (error) { console.error('[ranking] fetchLeaderboard', error); return []; }
  return data || [];
}

/* ---------- Most dla klasycznego main.js (nie-modułowego) ---------- */
window.chatynkowoSync = {
  configured,
  signInWithGoogle,
  getSession,
  /* Wywoływane przy każdym NOWYM znalezisku na stronie głównej. Nic nie robi,
     gdy gość nie jest zalogowany — wtedy synchronizacja nastąpi po zalogowaniu. */
  async onFound(slug, foundAt, foundCount) {
    const session = await getSession();
    if (!session) return;
    await ensureProfile(session);
    await recordFind(session, slug, foundAt, foundCount);
  },
};
