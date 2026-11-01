import { setCors } from './_cors.js';
import { getTwitchToken } from './_twitch-token.js';



export default async function handler(req, res) {
  setCors(req, res, 'GET');
  const clientId = process.env.TWITCH_CLIENT_ID;
  const clientSecret = process.env.TWITCH_CLIENT_SECRET;
  const broadcasterId = process.env.TWITCH_BROADCASTER_ID;
  if (!clientId || !clientSecret || !broadcasterId) {
    return res.status(500).json({ error: 'Missing Twitch environment variables in Vercel' });
  }
  try {
    const now = new Date();
    const startedAt = new Date(now.getTime() - 365 * 86400000).toISOString();
    let accessToken = await getTwitchToken(clientId, clientSecret);
    let cursor = '';
    const clips = new Map();
    // Twitch sorts by views, so read subsequent pages before choosing recent clips.
    for (let page = 0; page < 10; page++) {
      const query = new URLSearchParams({broadcaster_id:broadcasterId, first:'100', started_at:startedAt, ended_at:now.toISOString()});
      if (cursor) query.set('after', cursor);
      const request = () => fetch('https://api.twitch.tv/helix/clips?' + query, {headers:{'Client-ID':clientId, Authorization:'Bearer ' + accessToken}, signal:AbortSignal.timeout(10000)});
      let response = await request();
      if (response.status === 401) {
        accessToken = await getTwitchToken(clientId, clientSecret, true);
        response = await request();
      }
      if (!response.ok) throw Error('Twitch clips request failed (' + response.status + ')');
      const data = await response.json();
      for (const clip of data.data || []) clips.set(clip.id, clip);
      const next = data.pagination?.cursor;
      if (!next || next === cursor) break;
      cursor = next;
    }
    const pool = [...clips.values()].sort((a,b) => Date.parse(b.created_at) - Date.parse(a.created_at)).map(clip => ({
      id:clip.id, url:clip.url, embedUrl:clip.embed_url, title:clip.title,
      thumbnailUrl:clip.thumbnail_url, viewCount:clip.view_count, createdAt:clip.created_at
    }));
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');
    return res.status(200).json({clips:pool});
  } catch (error) {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(502).json({error:error.message});
  }
}
