import { setCors } from './_cors.js';

const SNAPSHOT_KEY = 'cmtv:league:solo:last-confirmed:v1';
const PROFILE_URL = 'https://www.op.gg/summoners/na/CupcakeMafia-NA1';
async function redis(command) {
  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) return null;
  const response = await fetch(process.env.KV_REST_API_URL, {
    method: 'POST', headers: { Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(command), signal: AbortSignal.timeout(1500),
  });
  if (!response.ok) return null;
  return (await response.json()).result;
}
async function fallback(res) {
  let saved;
  try { saved = JSON.parse(await redis(['GET', SNAPSHOT_KEY])); } catch {}
  if (saved && Number.isFinite(Date.parse(saved.updatedAt))) {
    return res.status(200).json({ ...saved, available: true, stale: true, inGame: false, liveGame: null, profileUrl: PROFILE_URL });
  }
  // No invented rank, and upstream errors are not mistaken for Unranked.
  return res.status(200).json({ available: false, stale: true, rank: null, inGame: false, updatedAt: null, profileUrl: PROFILE_URL });
}
export default async function handler(req, res) {
  setCors(req, res, 'GET');
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=900');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return res.status(405).json({ error: 'Method not allowed' }); }
  const key = process.env.RIOT_API_KEY;
  if (!key) return fallback(res);
  const riot = (url, timeout = 2500) => fetch(url, { headers: { 'X-Riot-Token': key }, signal: AbortSignal.timeout(timeout) });
  try {
    const accountRes = await riot('https://americas.api.riotgames.com/riot/account/v1/accounts/by-riot-id/CupcakeMafia/NA1');
    if (!accountRes.ok) return fallback(res);
    const account = await accountRes.json();
    if (!account.puuid) return fallback(res);
    const puuid = encodeURIComponent(account.puuid);
    const [leagueRes, spectatorRes] = await Promise.all([
      riot(`https://na1.api.riotgames.com/lol/league/v4/entries/by-puuid/${puuid}`),
      riot(`https://na1.api.riotgames.com/lol/spectator/v5/active-games/by-puuid/${puuid}`, 1500).catch(() => null),
    ]);
    if (!leagueRes.ok) return fallback(res);
    const entries = await leagueRes.json();
    if (!Array.isArray(entries)) return fallback(res);
    const solo = entries.find(entry => entry.queueType === 'RANKED_SOLO_5x5');
    if (solo && (typeof solo.tier !== 'string' || typeof solo.rank !== 'string' || !['leaguePoints', 'wins', 'losses'].every(k => Number.isFinite(solo[k])))) return fallback(res);
    const snapshot = {
      rank: solo ? { tier: solo.tier, division: solo.rank, leaguePoints: solo.leaguePoints, wins: solo.wins, losses: solo.losses } : null,
      updatedAt: new Date().toISOString(),
    };
    let game = null;
    if (spectatorRes?.ok) { try { game = await spectatorRes.json(); } catch {} }
    const inGame = game?.gameQueueConfigId === 420;
    // Keep the last successful snapshot across visitors and serverless restarts.
    // A failed write must not prevent fresh stats from reaching the page.
    try { await redis(['SET', SNAPSHOT_KEY, JSON.stringify(snapshot)]); } catch {}
    return res.status(200).json({ ...snapshot, available: true, stale: false, inGame, liveGame: inGame ? { gameMode: game.gameMode, gameLengthSeconds: game.gameLength } : null, profileUrl: PROFILE_URL });
  } catch { return fallback(res); }
}
