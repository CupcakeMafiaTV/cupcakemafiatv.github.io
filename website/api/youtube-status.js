import { setCors } from './_cors.js';

// search.list is capped at just 100 calls/day by YouTube (quota metric
// 'Search Queries per day', separate from the general 10,000-unit budget).
// CDN edge caching (Cache-Control: s-maxage) isn't a reliable enough gate for
// that: every deploy resets it, and it's fragmented per-region, so viewers
// hitting the site from different regions during a stream can each cause an
// independent origin call — exactly when traffic (and the risk of exhausting
// the cap) is highest. Instead, the last check result is stored in the same
// Upstash Redis used by post-new-video.js, so the refresh interval is
// enforced globally across every visitor/region/deploy, not per-edge-node.
const CACHE_KEY = 'youtube-live-status';
const CACHE_TTL_SECONDS = 1200; // 20 min -> max 72 real YouTube calls/day

async function kvGet(key) {
  const res = await fetch(`${process.env.KV_REST_API_URL}/get/${key}`, {
    headers: { Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}` },
  });
  const data = await res.json();
  return data.result ? JSON.parse(data.result) : null;
}

async function kvSet(key, value) {
  await fetch(`${process.env.KV_REST_API_URL}/set/${key}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(value),
  });
}

async function checkYouTubeLive(apiKey, channelId) {
  const response = await fetch(
    `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${channelId}&eventType=live&type=video&key=${apiKey}`
  );

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`YouTube API request failed with status ${response.status}: ${errorBody}`);
  }

  const data = await response.json();
  return Boolean(data.items && data.items.length > 0);
}

export default async function handler(req, res) {
  setCors(req, res, 'GET');
  // Belt-and-suspenders: still avoids a KV round trip for rapid repeat hits
  // to the same edge node, but the KV check below is the real quota gate.
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120');

  const API_KEY = process.env.YouTube_Live_Checker;
  const CHANNEL_ID = process.env.CHANNEL_ID;

  if (!API_KEY || !CHANNEL_ID) {
    return res.status(500).json({ isLive: false, error: 'Missing YouTube environment variables' });
  }
  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
    return res.status(500).json({ isLive: false, error: 'Missing KV env vars (add the Upstash Redis integration in Vercel)' });
  }

  let cached = null;
  try {
    cached = await kvGet(CACHE_KEY);
  } catch (error) {
    // KV being unreachable shouldn't take down the badge; fall through and
    // hit YouTube directly for this request.
  }

  const isFresh = cached && (Date.now() - cached.checkedAt) < CACHE_TTL_SECONDS * 1000;
  if (isFresh) {
    return res.status(200).json({ isLive: cached.isLive });
  }

  try {
    const isLive = await checkYouTubeLive(API_KEY, CHANNEL_ID);
    await kvSet(CACHE_KEY, { isLive, checkedAt: Date.now() });
    return res.status(200).json({ isLive });
  } catch (error) {
    // Fresh check failed (quota exceeded, network blip, etc). Prefer a stale
    // cached value over always reporting not-live.
    if (cached) {
      return res.status(200).json({ isLive: cached.isLive, error: error.message, stale: true });
    }
    return res.status(200).json({ isLive: false, error: error.message });
  }
}
