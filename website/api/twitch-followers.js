import { setCors } from './_cors.js';
import { getTwitchToken } from './_twitch-token.js';

async function fetchFollowers(clientId, accessToken, broadcasterId) {
  return fetch(`https://api.twitch.tv/helix/channels/followers?broadcaster_id=${broadcasterId}`, {
    headers: {
      'Client-ID': clientId,
      'Authorization': `Bearer ${accessToken}`
    }
  });
}

export default async function handler(req, res) {
  setCors(req, res, 'GET');
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=1800');

  const CLIENT_ID = process.env.TWITCH_CLIENT_ID;
  const CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET;
  const BROADCASTER_ID = process.env.TWITCH_BROADCASTER_ID;

  if (!CLIENT_ID || !CLIENT_SECRET || !BROADCASTER_ID) {
    return res.status(500).json({ error: 'Missing Twitch environment variables in Vercel' });
  }

  try {
    let accessToken = await getTwitchToken(CLIENT_ID, CLIENT_SECRET);
    let followersRes = await fetchFollowers(CLIENT_ID, accessToken, BROADCASTER_ID);

    if (followersRes.status === 401) {
      accessToken = await getTwitchToken(CLIENT_ID, CLIENT_SECRET, true);
      followersRes = await fetchFollowers(CLIENT_ID, accessToken, BROADCASTER_ID);
    }

    const followersData = await followersRes.json();
    const followerCount = followersData.total || 0;

    return res.status(200).json({ followerCount });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
