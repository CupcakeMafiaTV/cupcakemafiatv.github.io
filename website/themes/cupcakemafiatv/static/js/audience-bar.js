// Show saved counts immediately and replace them directly as live data arrives.
(async () => {
  const band = document.querySelector('.audience-band, .work-with-me-page .social-stat-grid');
  if (!band) return;
  const format = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
  const count = value => {
    if (value === null || value === undefined || String(value).trim() === '') return null;
    const number = Number(value);
    return Number.isSafeInteger(number) && number >= 0 ? number : null;
  };
  const cached = key => {
    try { return count(localStorage.getItem(key)); } catch { return null; }
  };
  const save = (key, value) => {
    try { localStorage.setItem(key, String(value)); } catch { /* Storage is optional. */ }
  };
  const cacheKeys = { 'youtube-sub-count': 'cmtv_youtube_subs', 'twitch-follower-count': 'cmtv_twitch_followers', 'discord-member-count': 'cmtv_discord_members' };
  for (const el of band.querySelectorAll('.audience-value strong, .brand-card-title-lg')) {
    const value = cacheKeys[el.id] ? cached(cacheKeys[el.id]) : count(el.dataset.countTarget);
    if (value !== null) el.textContent = format.format(value);
  }
  band.setAttribute('aria-busy', 'true');
  async function load(endpoint, fields) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    let data = {};
    try {
      const response = await fetch('https://cupcakemafiatv-github-io.vercel.app/api/' + endpoint, { signal: controller.signal });
      if (!response.ok) throw new Error('Stat request failed');
      data = await response.json();
    } catch { /* Keep saved values if this service is unavailable. */ }
    finally { clearTimeout(timeout); }
    for (const [id, field, key] of fields) {
      const el = band.querySelector('#' + id);
      if (!el) continue;
      const fresh = count(data?.[field]);
      const value = fresh === null ? cached(key) : fresh;
      if (fresh !== null) save(key, fresh);
      if (value !== null) { el.textContent = format.format(value); el.removeAttribute('title'); }
      else { el.textContent = '—'; el.title = 'Count temporarily unavailable'; }
    }
  }
  await Promise.all([
    load('subscribers', [['youtube-sub-count', 'subscriberCount', 'cmtv_youtube_subs']]),
    load('twitch-followers', [['twitch-follower-count', 'followerCount', 'cmtv_twitch_followers']]),
    load('discord-widget', [['discord-member-count', 'memberCount', 'cmtv_discord_members']])
  ]);
  band.setAttribute('aria-busy', 'false');
})();
