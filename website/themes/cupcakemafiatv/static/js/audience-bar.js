// The homepage stats share one data-loading phase and one animation clock.
(async () => {
  const band = document.querySelector('.audience-band');
  if (!band) return;
  const count = value => {
    if (value === null || value === undefined || String(value).trim() === '') return null;
    const number = Number(value);
    return Number.isSafeInteger(number) && number >= 0 ? number : null;
  };
  const targets = new Map();
  const elements = [...band.querySelectorAll('.audience-value strong')];
  for (const el of elements) {
    const target = count((el.dataset.countTarget || el.textContent).replace(/,/g, ''));
    if (target !== null && (el.dataset.countTarget || !el.id)) targets.set(el, target);
    el.textContent = '0';

  }
  band.setAttribute('aria-busy', 'true');
  const cached = key => {
    try { return count(localStorage.getItem(key)); } catch { return null; }
  };
  const save = (key, value) => {
    try { localStorage.setItem(key, String(value)); } catch { /* Storage is optional. */ }
  };
  // Keep existing values visible; restore the last good live counts immediately.
  const cacheKeys = { 'youtube-sub-count': 'cmtv_youtube_subs', 'twitch-follower-count': 'cmtv_twitch_followers', 'discord-member-count': 'cmtv_discord_members' };
  for (const el of elements) {
    const value = cacheKeys[el.id] ? cached(cacheKeys[el.id]) : null;
    if (value !== null) { targets.set(el, value); el.textContent = '0'; }
  }
  async function load(endpoint, fields) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    let data = {};
    try {
      const response = await fetch('https://cupcakemafiatv-github-io.vercel.app/api/' + endpoint, { signal: controller.signal });
      if (!response.ok) throw new Error('Stat request failed');
      data = await response.json();
    } catch { /* Use the last good values without blocking the other stats. */ }
    finally { clearTimeout(timeout); }
    for (const [id, field, key] of fields) {
      const el = band.querySelector('#' + id);
      if (!el) continue;
      const fresh = count(data?.[field]);
      const target = fresh === null ? cached(key) : fresh;
      if (fresh !== null) save(key, fresh);
      if (target !== null) { targets.set(el, target); el.textContent = '0'; }
    }
  }
  await Promise.all([
    load('subscribers', [['youtube-sub-count', 'subscriberCount', 'cmtv_youtube_subs']]),
    load('twitch-followers', [['twitch-follower-count', 'followerCount', 'cmtv_twitch_followers']]),
    load('discord-widget', [['discord-member-count', 'memberCount', 'cmtv_discord_members']])
  ]);
  const format = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
  const render = progress => {
    const eased = 1 - Math.pow(1 - progress, 3);
    for (const [el, target] of targets) {
      // Hold each positive count below its final integer until the common last frame.
      const value = progress === 1 ? target : Math.min(Math.max(0, target - 1), Math.floor(target * eased));
      el.textContent = format.format(value);
    }
    if (progress === 1) band.setAttribute('aria-busy', 'false');
  };
  function begin() {
    if (document.hidden) return;
    document.removeEventListener('visibilitychange', begin);
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { render(1); return; }
    let start;
    function step(now) {
      if (start === undefined) start = now;
      const progress = Math.min((now - start) / 1200, 1);
      render(progress);
      if (progress < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }
  document.addEventListener('visibilitychange', begin);
  begin();
})();
