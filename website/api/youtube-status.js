export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  // Pulling directly from your Vercel Environment Variables
  const CHANNEL_ID = process.env.CHANNEL_ID;
  const API_KEY = process.env.YouTube_Live_Checker;

  if (!CHANNEL_ID || !API_KEY) {
    return res.status(500).json({ isLive: false, error: 'Missing YouTube environment variables' });
  }

  try {
    const response = await fetch(
      `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${CHANNEL_ID}&type=video&eventType=live&key=${API_KEY}`
    );
    const data = await response.json();
    
    // If items array has length > 0, a stream is currently live
    const isLive = data?.items && data.items.length > 0;

    return res.status(200).json({ isLive });
  } catch (error) {
    return res.status(500).json({ isLive: false, error: error.message });
  }
}