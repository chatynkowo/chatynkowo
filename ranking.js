/* ---------- Chatynkowo — Ranking Zdobywców (widok) ----------
   Renderuje publiczny ranking, obsługuje logowanie Google, udostępnianie
   linku z podświetleniem własnego wpisu (?me=) oraz edycję profilu. */

import {
  TOTAL_COTTAGES, configured,
  getSession, signInWithGoogle, signOut,
  ensureProfile, syncFinds, updateProfile, fetchLeaderboard, localFinds,
} from './chatynkowo-sync.js';

const $ = (id) => document.getElementById(id);
const closeModal = (m) => { if (typeof m.close === 'function') m.close(); else m.removeAttribute('open'); };

let session = null;
let myProfile = null;
let myPublicId = new URLSearchParams(location.search).get('me') || null;

/* ---------- helpers ---------- */
function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function initials(name) {
  return String(name || '?').trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
}

/* Czas ukończenia w zwięzłej, bezdeklinacyjnej formie: "3 d 5 h", "5 h 12 min", "12 min". */
function formatDuration(sec) {
  if (sec == null) return '';
  sec = Number(sec);
  if (!Number.isFinite(sec) || sec < 1) return 'błyskawicznie';
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (d > 0) return `${d} d ${h} h`;
  if (h > 0) return `${h} h ${m} min`;
  if (m > 0) return `${m} min`;
  return `${Math.floor(sec)} s`;
}

function avatarHtml(row) {
  if (row.avatar_url) {
    return `<img class="rank-ava" src="${escapeHtml(row.avatar_url)}" alt="" loading="lazy" decoding="async"/>`;
  }
  return `<span class="rank-ava rank-ava--initials" aria-hidden="true">${escapeHtml(initials(row.display_name))}</span>`;
}

/* Czas całkowity od pierwszej do ostatnio odkrytej chatki — pokazywany dla
   KAŻDEGO gracza (dla ukończonych = czas zebrania kompletu). Przy 1 chatce
   nie ma jeszcze rozpiętości, więc pokazujemy „—”. */
function metricHtml(row) {
  const sec = Number(row.elapsed_seconds);   // bigint bywa zwracany jako string
  if (!row.found || row.found < 2 || !sec) {
    return `<span class="rank-metric rank-metric--time rank-metric--partial" title="Czas naliczany od drugiej chatki">⏱ —</span>`;
  }
  const t = escapeHtml(formatDuration(sec));
  const label = row.completed
    ? 'Czas zebrania kompletu (1. → ostatnia chatka)'
    : 'Czas od 1. do ostatnio znalezionej chatki';
  const cls = row.completed ? 'rank-metric--time' : 'rank-metric--time rank-metric--partial';
  return `<span class="rank-metric ${cls}" title="${label}">⏱ ${t}</span>`;
}

/* ---------- render ---------- */
function renderPodium(rows) {
  const host = $('podium');
  const top = rows.slice(0, 3);
  if (top.length < 3) { host.setAttribute('hidden', ''); return; }
  host.removeAttribute('hidden');
  // Kolejność wizualna: 2 — 1 — 3 (jedynka w środku, najwyżej).
  const order = [1, 0, 2];
  host.innerHTML = order.map((i) => {
    const r = top[i];
    const place = i + 1;
    const mine = isMine(r) ? ' podium__card--mine' : '';
    const medal = ['🥇', '🥈', '🥉'][i];
    return `<div class="podium__card podium__card--p${place}${mine}">
      <div class="podium__medal" aria-hidden="true">${medal}</div>
      ${avatarHtml(r)}
      <div class="podium__name">${escapeHtml(r.display_name)}</div>
      <div class="podium__found">${r.found}/${TOTAL_COTTAGES}</div>
      <div class="podium__metric">${metricHtml(r)}</div>
      <div class="podium__base">${place}</div>
    </div>`;
  }).join('');
}

function isMine(row) {
  return myPublicId && row.public_id === myPublicId;
}

function renderList(rows) {
  const list = $('rankList');
  const status = $('rankStatus');
  list.innerHTML = '';
  if (!rows.length) {
    status.textContent = configured
      ? 'Ranking jest jeszcze pusty — bądź pierwszym zdobywcą!'
      : 'Ranking nie jest jeszcze skonfigurowany.';
    return;
  }
  status.textContent = '';
  let mineSeen = false;
  rows.forEach((r, i) => {
    const li = document.createElement('li');
    li.className = 'rank-row' + (isMine(r) ? ' rank-row--mine' : '') + (r.completed ? ' rank-row--done' : '');
    if (isMine(r)) { li.id = 'myRow'; mineSeen = true; }
    li.innerHTML = `
      <span class="rank-pos">${i + 1}</span>
      ${avatarHtml(r)}
      <span class="rank-name">${escapeHtml(r.display_name)}${isMine(r) ? ' <em class="rank-you">(Ty)</em>' : ''}</span>
      <span class="rank-count">${r.found}<small>/${TOTAL_COTTAGES}</small></span>
      <span class="rank-meta">${metricHtml(r)}</span>`;
    list.appendChild(li);
  });
  // Po wejściu z linku ?me= — przewiń do podświetlonego wpisu.
  if (mineSeen && new URLSearchParams(location.search).has('me')) {
    requestAnimationFrame(() => $('myRow')?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
  }
}

async function refresh() {
  const rows = await fetchLeaderboard();
  renderPodium(rows);
  renderList(rows);
}

/* ---------- account bar ---------- */
function renderAccount() {
  const bar = $('rankAccount');
  if (!configured) {
    bar.innerHTML = `<p class="rank-note">Ranking nie jest jeszcze skonfigurowany (brak danych Supabase).</p>`;
    return;
  }
  if (!session) {
    bar.innerHTML = `<button class="rank-btn rank-btn--primary" id="loginBtn">Zaloguj przez Google, aby dołączyć</button>`;
    $('loginBtn').addEventListener('click', () => signInWithGoogle(location.href.split('?')[0]));
    return;
  }
  const name = myProfile?.display_name || 'Zdobywca';
  bar.innerHTML = `
    <span class="rank-hello">Zalogowano jako <strong>${escapeHtml(name)}</strong></span>
    <span class="rank-account__actions">
      <button class="rank-btn rank-btn--primary" id="shareBtn">Udostępnij mój wynik</button>
      <button class="rank-btn rank-btn--fb" id="fbBtn" aria-label="Udostępnij na Facebooku">f</button>
      <button class="rank-btn" id="editBtn">Edytuj wpis</button>
      <button class="rank-btn rank-btn--ghost" id="logoutBtn">Wyloguj</button>
    </span>
    <span class="rank-toast" id="toast" hidden></span>`;
  $('shareBtn').addEventListener('click', share);
  $('fbBtn').addEventListener('click', shareFacebook);
  $('editBtn').addEventListener('click', openProfile);
  $('logoutBtn').addEventListener('click', async () => { await signOut(); location.href = location.pathname; });
}

function myShareUrl() {
  return `${location.origin}${location.pathname}?me=${encodeURIComponent(myPublicId || '')}`;
}

async function share() {
  const url = myShareUrl();
  const text = 'Zobacz mój wynik w Rankingu Zdobywców Chatynkowa!';
  if (navigator.share) {
    try { await navigator.share({ title: 'Chatynkowo', text, url }); return; } catch (_) { /* anulowano */ }
  }
  try { await navigator.clipboard.writeText(url); toast('Skopiowano link do schowka ✓'); }
  catch (_) { prompt('Skopiuj link do swojego wyniku:', url); }
}

function shareFacebook() {
  const u = encodeURIComponent(myShareUrl());
  window.open(`https://www.facebook.com/sharer/sharer.php?u=${u}`, '_blank', 'noopener,width=640,height=480');
}

function toast(msg) {
  const t = $('toast');
  if (!t) return;
  t.textContent = msg;
  t.removeAttribute('hidden');
  setTimeout(() => t.setAttribute('hidden', ''), 2500);
}

/* ---------- profile editor ---------- */
function openProfile() {
  const modal = $('profileModal');
  $('profileName').value = myProfile?.display_name || '';
  $('profileAvatar').checked = Boolean(myProfile?.avatar_url);
  if (typeof modal.showModal === 'function') modal.showModal(); else modal.setAttribute('open', '');
}

function wireProfile() {
  const modal = $('profileModal');
  $('profileClose').addEventListener('click', () => closeModal(modal));
  $('profileSave').addEventListener('click', async () => {
    const display_name = $('profileName').value.trim() || (myProfile?.display_name || 'Zdobywca');
    const googlePic = session?.user?.user_metadata?.avatar_url || session?.user?.user_metadata?.picture || null;
    const avatar_url = $('profileAvatar').checked ? googlePic : null;
    myProfile = await updateProfile(session, { display_name, avatar_url }) || myProfile;
    closeModal(modal);
    await refresh();
    renderAccount();
  });
}

/* ---------- boot ---------- */
async function init() {
  wireProfile();
  session = await getSession();
  if (session) {
    myProfile = await ensureProfile(session);
    myPublicId = myProfile?.public_id || myPublicId;
    // Po zalogowaniu (np. po komplecie na stronie głównej) wyślij postęp z localStorage.
    await syncFinds(session, localFinds());
  }
  renderAccount();
  await refresh();
}

init().catch((e) => {
  console.error('[ranking] init', e);
  $('rankStatus').textContent = 'Nie udało się wczytać rankingu — odśwież stronę.';
});
