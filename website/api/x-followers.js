export default async function handler(req, res) {
  // Allow requests from your domain (or use '*' for public access)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const BEARER_TOKEN = process.env.X_BEARER_TOKEN;
  const USERNAME = 'cupcakemafiatv';

  if (!BEARER_TOKEN) {
    return res.status(500).json({ error: 'Missing X Bearer Token environment variable' });
  }

  try {
    const response = await fetch(
      `https://api.twitter.com/2/users/by/username/${USERNAME}?user.fields=public_metrics`,
      {
        headers: {
          Authorization: `Bearer ${BEARER_TOKEN}`
        }
      }
    );
    
    const data = await response.json();
    
    if (!response.ok) {
      return res.status(response.status).json({ error: data.detail || 'Error fetching from X API' });
    }

    const followerCount = data?.data?.public_metrics?.followers_count || 0;

    return res.status(200).json({ followerCount });
  } catch (error) {
    return res.status(500).json({ followerCount: 0, error: error.message });
  }
}