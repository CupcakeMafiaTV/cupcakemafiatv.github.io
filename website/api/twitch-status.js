import { setCors } from './_cors.js';

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
    const tokenRes = await fetch(`https://id.twitch.tv/oauth2/token?client_id=${CLIENT_ID}&client_secret=${CLIENT_SECRET}&grant_type=client_credentials`, {
      method: 'POST'
    });

    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;

    if (!accessToken) {
      return res.status(500).json({ isLive: false, error: 'Failed to authenticate with Twitch API', details: tokenData });
    }

    const streamRes = await fetch(`https://api.twitch.tv/helix/streams?user_id=${BROADCASTER_ID}`, {
      headers: {
        'Client-ID': CLIENT_ID,
        'Authorization': `Bearer ${accessToken}`
      }
    });

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
