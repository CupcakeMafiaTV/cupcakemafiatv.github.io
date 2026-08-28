import { setCors } from './_cors.js';
import { getTwitchToken } from './_twitch-token.js';

// League of Legends' Twitch game ID. The clips endpoint doesn't support
// filtering by broadcaster_id and game_id at the same time, so we filter
// client-side after fetching.
const LEAGUE_OF_LEGENDS_GAME_ID = '21779';

async function fetchClips(clientId, accessToken, broadcasterId, startedAt, endedAt) {
  return fetch(
    `https://api.twitch.tv/helix/clips?broadcaster_id=${broadcasterId}&first=100&started_at=${startedAt}&ended_at=${endedAt}`,
    {
      headers: {
        'Client-ID': clientId,
        'Authorization': `Bearer ${accessToken}`
      }
    }
  );
}

export default async function handler(req, res) {
  setCors(req, res, 'GET');
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');

  const CLIENT_ID = process.env.TWITCH_CLIENT_ID;
  const CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET;
  const BROADCASTER_ID = process.env.TWITCH_BROADCASTER_ID;

  if (!CLIENT_ID || !CLIENT_SECRET || !BROADCASTER_ID) {
    return res.status(500).json({ error: 'Missing Twitch environment variables in Vercel' });
  }

  try {
    const now = new Date();
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    let accessToken = await getTwitchToken(CLIENT_ID, CLIENT_SECRET);
    let clipsRes = await fetchClips(CLIENT_ID, accessToken, BROADCASTER_ID, ninetyDaysAgo.toISOString(), now.toISOString());

    if (clipsRes.status === 401) {
      accessToken = await getTwitchToken(CLIENT_ID, CLIENT_SECRET, true);
      clipsRes = await fetchClips(CLIENT_ID, accessToken, BROADCASTER_ID, ninetyDaysAgo.toISOString(), now.toISOString());
    }

    const clipsData = await clipsRes.json();
    const clips = clipsData.data || [];

    if (!clips.length) {
      return res.status(200).json({ clips: [] });
    }

    const topClips = clips
      .filter(clip => clip.game_id === LEAGUE_OF_LEGENDS_GAME_ID)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 10)
      .map(clip => ({
        id: clip.id,
        url: clip.url,
        embedUrl: clip.embed_url,
        title: clip.title,
        thumbnailUrl: clip.thumbnail_url,
        viewCount: clip.view_count
      }));

    return res.status(200).json({ clips: topClips });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
