import { setCors } from './_cors.js';

export default async function handler(req, res) {
  setCors(req, res, 'GET,OPTIONS');
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=1800');

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
      const viewCount = data.items[0].statistics.viewCount;
      return res.status(200).json({ subscriberCount, viewCount });
    } else {
      return res.status(404).json({ error: 'Channel not found' });
    }
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch from YouTube API' });
  }
}