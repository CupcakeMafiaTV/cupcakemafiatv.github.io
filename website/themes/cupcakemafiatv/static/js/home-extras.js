import { nextStreams, easternParts, calendarEvent } from './stream-schedule.js';

// These demos are entirely local; no stream controls, mic, or camera access.
const cards = [...document.querySelectorAll('.chaos-card')];
let previewTimer;
function stopPreviews() {
  clearTimeout(previewTimer);
  cards.forEach(card => { card.classList.remove('is-playing'); const button = card.querySelector('.chaos-play'); button.setAttribute('aria-pressed', 'false'); button.innerHTML = button.dataset.label; });
}
function weather(card, type) {
  card.dataset.weather = type;
  card.querySelectorAll('[data-weather]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.weather === type)));
  const stage = card.querySelector('.demo-weather');
  stage.replaceChildren();
  for (let i = 0; i < 18; i++) {
    const particle = document.createElement('i'); particle.className = type;
    particle.style.cssText = `--x:${(i * 37) % 100}%;--y:${(i * 43) % 90}%;--speed:${type === 'rain' ? .7 + i % 3 * .15 : 2 + i % 4 * .4}s;--delay:-${i * .21}s;--color:${['#e3adcf', '#bd9ce9', '#f0d28e', '#91cfdf'][i % 4]}`;
    stage.append(particle);
  }
}
cards.forEach(card => {
  const button = card.querySelector('.chaos-play'); button.dataset.label = button.innerHTML;
  button.addEventListener('click', () => {
    const playing = card.classList.contains('is-playing'); stopPreviews(); if (playing) return;
    card.classList.add('is-playing'); button.setAttribute('aria-pressed', 'true'); button.textContent = 'Stop preview ■';
    previewTimer = setTimeout(stopPreviews, card.dataset.preview === 'weather' ? 10000 : 8000);
  });
  if (card.dataset.preview === 'weather') {
    weather(card, 'rain');
    card.querySelectorAll('button[data-weather]').forEach(choice => choice.addEventListener('click', () => {
      weather(card, choice.dataset.weather);
      if (!card.classList.contains('is-playing')) button.click();
    }));
  }
});
document.addEventListener('visibilitychange', () => { if (document.hidden) stopPreviews(); });

// Small brand touches stay clear of video controls and page text.
const wrapper = document.getElementById('video-container-wrapper');
if (wrapper) {
  wrapper.style.position = 'relative';
  const peek = document.createElement('img'); peek.src = '/img/emotes/Lurk.webp'; peek.alt = ''; peek.className = 'cupcake-clip-peek'; peek.loading = 'lazy'; wrapper.append(peek);
}
const aside = document.createElement('div'); aside.className = 'cupcake-aside'; aside.hidden = true; aside.style.display = 'none';
aside.innerHTML = '<img src="/img/emotes/HeroMascot.webp" width="58" height="58" alt="" loading="lazy"><span>Back soon. The frosting needs a break.</span>';
document.querySelector('.watch-live-split')?.after(aside);
function liveMascot(isLive) { aside.hidden = isLive; aside.style.display = isLive ? 'none' : 'flex'; }
document.addEventListener('cmtv:livestatus', event => liveMascot(event.detail.isLive));
if (typeof window.cmtvIsLive === 'boolean') liveMascot(window.cmtvIsLive);

const zonePicker = document.getElementById('schedule-zone');
let calendarUrls = [];
function renderSchedule() {
  calendarUrls.forEach(URL.revokeObjectURL); calendarUrls = [];
  const localZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Toronto';
  const zone = zonePicker.value === 'eastern' ? 'America/Toronto' : localZone;
  document.getElementById('schedule-zone-note').textContent = `Cards show ${zone.replaceAll('_', ' ')} time for each next scheduled stream. Off days follow Eastern Time.`;
  const now = new Date(), parts = easternParts(now);
  const easternDay = new Date(Date.UTC(parts.year, parts.month - 1, parts.day)).getUTCDay();
  document.querySelectorAll('.schedule-day').forEach(card => card.classList.toggle('schedule-day-today', Number(card.dataset.day) === easternDay));
  const streams = nextStreams(now);
  for (const stream of streams) {
    const card = document.querySelector(`.schedule-day[data-day="${stream.day}"]`);
    card.firstElementChild.textContent = new Intl.DateTimeFormat(undefined, { timeZone: zone, weekday: 'long' }).format(stream.start);
    const startParts = easternParts(stream.start);
    card.classList.toggle('schedule-day-today', startParts.year === parts.year && startParts.month === parts.month && startParts.day === parts.day);
    card.querySelector('.text-gold').textContent = new Intl.DateTimeFormat(undefined, { timeZone: zone, hour: 'numeric', minute: '2-digit', timeZoneName: 'short' }).format(stream.start);
    let date = card.querySelector('.schedule-local-date');
    if (!date) { date = document.createElement('p'); date.className = 'schedule-local-date'; card.append(date); }
    date.textContent = new Intl.DateTimeFormat(undefined, { timeZone: zone, weekday: 'short', month: 'short', day: 'numeric' }).format(stream.start);
    let link = card.querySelector('.calendar-link');
    if (!link) { link = document.createElement('a'); link.className = 'calendar-link'; link.textContent = 'Add to calendar'; card.append(link); }
    const url = URL.createObjectURL(new Blob([calendarEvent(stream)], { type: 'text/calendar;charset=utf-8' })); calendarUrls.push(url);
    link.href = url; link.download = `cupcakemafia-${stream.start.toISOString().slice(0,10)}.ics`;
    link.setAttribute('aria-label', `Add ${stream.title}, ${date.textContent}, to calendar`);
  }
  const next = streams[0];
  document.getElementById('schedule-next').textContent = window.cmtvIsLive ? 'Live now — come hang out!' : `Next scheduled: ${next.title} · ${new Intl.DateTimeFormat(undefined, { timeZone: zone, weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' }).format(next.start)}`;
}
zonePicker.addEventListener('change', renderSchedule);
document.addEventListener('cmtv:livestatus', renderSchedule);
renderSchedule(); setInterval(renderSchedule, 60000);

const rankKey = 'cmtv_rank_snapshot_v1';
function validRank(data) {
  return data && Number.isFinite(Date.parse(data.updatedAt)) && (data.rank === null || (typeof data.rank?.tier === 'string' && typeof data.rank.division === 'string' && ['leaguePoints', 'wins', 'losses'].every(k => Number.isFinite(data.rank[k]))));
}
function renderRank(data, stale) {
  const rank = data.rank;
  document.getElementById('lol-rank-tier').textContent = rank ? `${rank.tier[0]}${rank.tier.slice(1).toLowerCase()} ${rank.division}` : 'Unranked';
  document.getElementById('lol-rank-lp').textContent = rank ? `${rank.leaguePoints} LP` : '';
  document.getElementById('lol-rank-wl').textContent = rank ? `${rank.wins}W · ${rank.losses}L` : '';
  document.getElementById('lol-rank-updated').textContent = `${stale ? 'Last confirmed' : 'Updated'} ${new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(data.updatedAt))}${stale ? '. Live updates are temporarily unavailable.' : '.'}`;
  const badge = document.getElementById('lol-live-badge'); badge.classList.remove('hidden'); badge.style.display = !stale && data.inGame === true ? 'inline-flex' : 'none';
}
async function loadRank() {
  let cached;
  try { cached = JSON.parse(localStorage.getItem(rankKey)); if (validRank(cached)) renderRank(cached, true); } catch {}
  try {
    const response = await fetch('https://cupcakemafiatv-github-io.vercel.app/api/league-rank', { signal: AbortSignal.timeout(9000) });
    const data = await response.json();
    if (!response.ok || data.available === false || !validRank(data)) return;
    if (data.stale && validRank(cached) && Date.parse(cached.updatedAt) > Date.parse(data.updatedAt)) return;
    renderRank(data, Boolean(data.stale));
    try { localStorage.setItem(rankKey, JSON.stringify({ ...data, inGame: false, liveGame: null })); } catch {}
  } catch { /* The dated snapshot or profile link stays visible. */ }
}
loadRank(); setInterval(loadRank, 300000);
