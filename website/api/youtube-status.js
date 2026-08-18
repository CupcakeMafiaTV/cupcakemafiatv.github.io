export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  // search.list costs 100 quota units per call against a 10,000/day quota
  // shared with the subscriber-count and latest-video endpoints, so this is
  // cached much longer than a simple status check would otherwise need.
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');

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
