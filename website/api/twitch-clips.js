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

    // All-time clips (no started_at/ended_at filter), max page size, so small
    // channels with infrequent clips still get a real pool of options instead
    // of whatever few clips happen to fall in a narrow recent window.
    const clipsRes = await fetch(
      `https://api.twitch.tv/helix/clips?broadcaster_id=${BROADCASTER_ID}&first=100`,
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
      return res.status(200).json({ clips: [] });
    }

    const topClips = clips
      .slice()
      .sort((a, b) => b.view_count - a.view_count)
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
