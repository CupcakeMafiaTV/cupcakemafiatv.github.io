export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  const CLIENT_ID = process.env.TWITCH_CLIENT_ID;
  const CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET;
  const BROADCASTER_ID = process.env.TWITCH_BROADCASTER_ID;

  if (!CLIENT_ID || !CLIENT_SECRET || !BROADCASTER_ID) {
    return res.status(500).json({ error: 'Missing Twitch environment variables in Vercel' });
  }

  try {
    const tokenRes = await fetch(`https://id.twitch.tv/oauth2/token?client_id=${CLIENT_ID}&client_secret=${CLIENT_SECRET}&grant_type=client_credentials`, {
      method: 'POST'
    });
    
    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;

    if (!accessToken) {
      return res.status(500).json({ error: 'Failed to authenticate with Twitch API', details: tokenData });
    }

    const followersRes = await fetch(`https://api.twitch.tv/helix/channels/followers?broadcaster_id=${BROADCASTER_ID}`, {
      headers: {
        'Client-ID': CLIENT_ID,
        'Authorization': `Bearer ${accessToken}`
      }
    });

    const followersData = await followersRes.json();
    const followerCount = followersData.total || 0;

    return res.status(200).json({ followerCount });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}