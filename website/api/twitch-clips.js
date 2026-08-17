export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');

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

    // Clips from the last 30 days, most-viewed first out of the returned page.
    const startedAt = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const clipsRes = await fetch(
      `https://api.twitch.tv/helix/clips?broadcaster_id=${BROADCASTER_ID}&started_at=${startedAt}&first=20`,
      {
        headers: {
          'Client-ID': CLIENT_ID,
          'Authorization': `Bearer ${accessToken}`
        }
      }
    );

    const clipsData = await clipsRes.json();
    const clips = clipsData.data || [];

    if (!clips.length) {
      return res.status(200).json({ clip: null });
    }

    const topClip = clips.reduce((best, clip) => (clip.view_count > best.view_count ? clip : best), clips[0]);

    return res.status(200).json({
      clip: {
        id: topClip.id,
        url: topClip.url,
        embedUrl: topClip.embed_url,
        title: topClip.title,
        thumbnailUrl: topClip.thumbnail_url,
        viewCount: topClip.view_count
      }
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
