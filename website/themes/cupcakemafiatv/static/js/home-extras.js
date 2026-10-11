// Highlight the current day in the stream's timezone; times stay in Eastern Time.
function highlightToday() {
  const weekday = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Toronto', weekday: 'short' }).format(new Date());
  const today = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(weekday);
  document.querySelectorAll('.schedule-day').forEach(card => card.classList.toggle('schedule-day-today', Number(card.dataset.day) === today));
}
highlightToday();
setInterval(highlightToday, 60000);

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
