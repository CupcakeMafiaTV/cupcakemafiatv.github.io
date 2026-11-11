import { easternParts, getNextStream, formatCountdown, STREAM_TIME_ZONE } from './schedule-time.mjs?v=1';

const cards = [...document.querySelectorAll('.schedule-day, .watch-schedule-day')];
const scheduleData = document.getElementById('stream-schedule-data');
let schedule = [];
try { schedule = scheduleData ? JSON.parse(scheduleData.textContent) : []; } catch { /* Keep the static weekly schedule usable. */ }
const upcoming = document.getElementById('next-stream-time');
const banner = document.getElementById('next-stream-banner');
const countdown = document.getElementById('next-stream-countdown');
const bannerLabel = document.getElementById('next-stream-label');
const liveLink = document.getElementById('next-stream-live-link');
const startFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: STREAM_TIME_ZONE, weekday: 'long', hour: 'numeric', minute: '2-digit', hour12: true
});
let next = null;
let activeDay = null;
let lastRefresh = 0;
let twitchIsLive = window.cmtvTwitchIsLive === true;

function refreshSchedule(now) {
  activeDay = easternParts(now).weekday;
  cards.forEach(card => card.classList.toggle('schedule-day-today', Number(card.dataset.day) === activeDay));
  next = getNextStream(schedule, now);
  lastRefresh = now.getTime();
  if (upcoming && next) {
    const label = next.dayOffset === 0 ? 'Today' : next.dayOffset === 1 ? 'Tomorrow' : next.name;
    const clock = new Intl.DateTimeFormat('en-US', {
      timeZone: STREAM_TIME_ZONE, hour: 'numeric', minute: '2-digit', hour12: true
    }).format(next.startsAt).replace(':00', '');
    upcoming.textContent = `${label} · ${clock} ET`;
  }
  if (!banner) return;
  const targetDay = twitchIsLive ? activeDay : next?.day;
  const target = targetDay != null && cards.find(card => card.closest('.weekly-schedule-list') && Number(card.dataset.day) === Number(targetDay));
  if (!target) { banner.hidden = true; return; }
  if (banner.parentElement !== target) target.append(banner);
  banner.hidden = false;
  banner.classList.toggle('is-live', twitchIsLive);
  bannerLabel.textContent = twitchIsLive ? 'Live now' : 'Next stream';
  countdown.hidden = twitchIsLive;
  liveLink.hidden = !twitchIsLive;
  if (next) countdown.title = `${startFormatter.format(next.startsAt)} Eastern`;
}

function tick() {
  const now = new Date();
  if (!lastRefresh || now.getTime() - lastRefresh >= 60000 || now.getTime() < lastRefresh || (next && now >= next.startsAt)) refreshSchedule(now);
  if (countdown && next && !twitchIsLive) countdown.textContent = formatCountdown(next.startsAt.getTime() - now.getTime());
}

document.addEventListener('cmtv:twitchstatus', event => {
  if (typeof event.detail?.isLive !== 'boolean') return;
  twitchIsLive = event.detail.isLive;
  lastRefresh = 0;
  tick();
});

tick();
// A visible countdown is a local clock. It makes no API requests.
setInterval(tick, banner ? 1000 : 60000);
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) { lastRefresh = 0; tick(); }
});
