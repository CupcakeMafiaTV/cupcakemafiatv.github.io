export default async function handler(req, res) {
  // Allow requests from your website domain
  res.setHeader('Access-Control-Allow-Origin', '*'); // Or replace '*' with 'https://cupcakemafiatv.github.io' or your custom domain
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const API_KEY = process.env.YouTube_Live_Checker;
  const CHANNEL_ID = process.env.CHANNEL_ID;

  if (!API_KEY || !CHANNEL_ID) {
    return res.status(500).json({ error: 'Missing environment variables' });
  }

  try {
    const response = await fetch(
      `https://www.googleapis.com/youtube/v3/channels?part=statistics&id=${CHANNEL_ID}&key=${API_KEY}`
    );
    const data = await response.json();

    if (data.items && data.items.length > 0) {
      const subscriberCount = data.items[0].statistics.subscriberCount;
      return res.status(200).json({ subscriberCount });
    } else {
      return res.status(404).json({ error: 'Channel not found' });
    }
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch from YouTube API' });
  }
}