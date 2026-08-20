export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  // search.list is capped at just 100 calls/day by YouTube, a separate and
  // much stricter limit than the general 10,000-unit quota shared with the
  // subscriber-count and latest-video endpoints. Cached long enough that
  // even with steady traffic, origin hits stay well under that 100/day cap
  // (max ~72/day at this duration).
  res.setHeader('Cache-Control', 's-maxage=1200, stale-while-revalidate=1800');

  const API_KEY = process.env.YouTube_Live_Checker;
  const CHANNEL_ID = process.env.CHANNEL_ID;

  if (!API_KEY || !CHANNEL_ID) {
    return res.status(500).json({ isLive: false, error: 'Missing YouTube environment variables' });
  }

  try {
    const response = await fetch(
      `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${CHANNEL_ID}&eventType=live&type=video&key=${API_KEY}`
    );

    if (!response.ok) {
      const errorBody = await response.text();
      return res.status(200).json({ isLive: false, error: `YouTube API request failed with status ${response.status}: ${errorBody}` });
    }

    const data = await response.json();
    const isLive = Boolean(data.items && data.items.length > 0);

    return res.status(200).json({ isLive });
  } catch (error) {
    return res.status(500).json({ isLive: false, error: error.message });
  }
}
