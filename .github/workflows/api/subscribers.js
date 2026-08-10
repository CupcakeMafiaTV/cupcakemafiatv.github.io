export default async function handler(req, res) {
  const API_KEY = process.env.YOUTUBE_API_KEY;
  const CHANNEL_ID = process.env.CHANNEL_ID;

  if (!API_KEY || !CHANNEL_ID) {
    return res.status(500).json({ error: 'Missing environment variables on Vercel' });
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