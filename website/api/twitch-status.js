import { setCors } from './_cors.js';
import { getTwitchToken } from './_twitch-token.js';

async function fetchStream(clientId, accessToken, broadcasterId) {
  return fetch(`https://api.twitch.tv/helix/streams?user_id=${broadcasterId}`, {
    headers: {
      'Client-ID': clientId,
      'Authorization': `Bearer ${accessToken}`
    }
  });
}

export default async function handler(req, res) {
  setCors(req, res, 'GET');
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120');

  const CLIENT_ID = process.env.TWITCH_CLIENT_ID;
  const CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET;
  const BROADCASTER_ID = process.env.TWITCH_BROADCASTER_ID;

  if (!CLIENT_ID || !CLIENT_SECRET || !BROADCASTER_ID) {
    return res.status(500).json({ isLive: false, error: 'Missing Twitch environment variables in Vercel' });
  }

  try {
    let accessToken = await getTwitchToken(CLIENT_ID, CLIENT_SECRET);
    let streamRes = await fetchStream(CLIENT_ID, accessToken, BROADCASTER_ID);

    if (streamRes.status === 401) {
      // Cached token was revoked/stale: get a fresh one and retry once.
      accessToken = await getTwitchToken(CLIENT_ID, CLIENT_SECRET, true);
      streamRes = await fetchStream(CLIENT_ID, accessToken, BROADCASTER_ID);
    }

    const streamData = await streamRes.json();
    const stream = streamData.data && streamData.data[0];

    if (!stream) {
      return res.status(200).json({ isLive: false });
    }

    return res.status(200).json({
      isLive: true,
      title: stream.title,
      game: stream.game_name,
      viewerCount: stream.viewer_count
    });
  } catch (error) {
    return res.status(500).json({ isLive: false, error: error.message });
  }
}
