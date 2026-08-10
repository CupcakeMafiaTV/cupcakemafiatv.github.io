export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  const BEARER_TOKEN = process.env.X_BEARER_TOKEN;
  const USERNAME = 'cupcakemafiatv'; // Replace with your X handle if different

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
    
    // Extract follower count from public metrics
    const followerCount = data?.data?.public_metrics?.followers_count || 0;

    return res.status(200).json({ followerCount });
  } catch (error) {
    return res.status(500).json({ followerCount: 0, error: error.message });
  }
}