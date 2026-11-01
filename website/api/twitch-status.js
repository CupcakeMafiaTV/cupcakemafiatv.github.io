import { setCors } from './_cors.js';
import { getTwitchToken } from './_twitch-token.js';

export default async function handler(req, res) {
  setCors(req, res, 'GET,OPTIONS');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return res.status(405).json({ error: 'Method not allowed' }); }
  const clientId = process.env.TWITCH_CLIENT_ID;
  const clientSecret = process.env.TWITCH_CLIENT_SECRET;
  const broadcasterId = process.env.TWITCH_BROADCASTER_ID;
  if (!clientId || !clientSecret || !broadcasterId) return res.status(503).json({ isLive: null, available: false });
  const signal = AbortSignal.timeout(8000);
  try {
    let token = await getTwitchToken(clientId, clientSecret, false, signal);
    const request = () => fetch('https://api.twitch.tv/helix/streams?user_id=' + encodeURIComponent(broadcasterId), {
      headers: { 'Client-ID': clientId, Authorization: 'Bearer ' + token }, signal
    });
    let response = await request();
    if (response.status === 401) { token = await getTwitchToken(clientId, clientSecret, true, signal); response = await request(); }
    if (!response.ok) throw new Error('Twitch status unavailable');
    const data = await response.json();
    if (!Array.isArray(data.data)) throw new Error('Invalid Twitch status');
    const stream = data.data[0];
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120');
    return res.status(200).json(stream ? {
      available: true, isLive: true, title: stream.title, game: stream.game_name, viewerCount: stream.viewer_count
    } : { available: true, isLive: false });
  } catch {
    // Unknown must never be interpreted as a confirmed offline state.
    return res.status(502).json({ available: false, isLive: null, error: 'Twitch status temporarily unavailable' });
  }
}
