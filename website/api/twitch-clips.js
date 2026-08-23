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

    // League of Legends' Twitch game ID. The clips endpoint doesn't support
    // filtering by broadcaster_id and game_id at the same time, so we filter
    // client-side after fetching.
    const LEAGUE_OF_LEGENDS_GAME_ID = '21779';

    const now = new Date();
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const clipsRes = await fetch(
      `https://api.twitch.tv/helix/clips?broadcaster_id=${BROADCASTER_ID}&first=100&started_at=${ninetyDaysAgo.toISOString()}&ended_at=${now.toISOString()}`,
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
