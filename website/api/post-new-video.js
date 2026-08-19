// Runs on a daily Vercel Cron schedule (see vercel.json). Checks for a new
// long-form video and posts it to Discord via webhook. Shorts are excluded
// using YouTube's Shorts duration cutoff (<=180s). Dedup state (the last
// video posted) is kept in Upstash Redis so the same video is never posted
// twice, even if the check runs again before the next upload.

const SHORTS_MAX_SECONDS = 180;
const ACCENT_COLOR = 0x00dbc9;
const STATE_KEY = 'last-posted-video';

function parseDurationSeconds(iso8601) {
  const match = iso8601.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!match) return 0;
  const [, h, m, s] = match;
  return (Number(h) || 0) * 3600 + (Number(m) || 0) * 60 + (Number(s) || 0);
}

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
    body: JSON.stringify(JSON.stringify(value)),
  });
}

async function fetchRecentLongFormVideos(apiKey, channelId) {
  const channelRes = await fetch(
    `https://www.googleapis.com/youtube/v3/channels?part=contentDetails&id=${channelId}&key=${apiKey}`
  );
  const channelData = await channelRes.json();
  const uploadsPlaylistId = channelData.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
  if (!uploadsPlaylistId) throw new Error('Could not resolve uploads playlist for channel');

  const playlistRes = await fetch(
    `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${uploadsPlaylistId}&maxResults=10&key=${apiKey}`
  );
  const playlistData = await playlistRes.json();
  const videoIds = (playlistData.items || []).map((item) => item.snippet.resourceId.videoId);
  if (videoIds.length === 0) return [];

  const detailsRes = await fetch(
    `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails&id=${videoIds.join(',')}&key=${apiKey}`
  );
  const detailsData = await detailsRes.json();

  return (detailsData.items || [])
    .filter((video) => parseDurationSeconds(video.contentDetails.duration) > SHORTS_MAX_SECONDS)
    .map((video) => ({
      id: video.id,
      title: video.snippet.title,
      publishedAt: video.snippet.publishedAt,
      thumbnail:
        video.snippet.thumbnails.maxres?.url ||
        video.snippet.thumbnails.high?.url ||
        video.snippet.thumbnails.medium.url,
    }));
}

async function postToDiscord(webhookUrl, video) {
  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: 'CupcakeMafiaTV',
      avatar_url: 'https://cupcakemafiatv.com/img/emotes/MainCupcake.png',
      content: `🎬 New video is up! https://youtu.be/${video.id}`,
      embeds: [
        {
          title: video.title,
          url: `https://youtu.be/${video.id}`,
          color: ACCENT_COLOR,
          image: { url: video.thumbnail },
        },
      ],
    }),
  });
  if (!res.ok) {
    throw new Error(`Discord webhook failed: ${res.status} ${await res.text()}`);
  }
}

export default async function handler(req, res) {
  if (process.env.CRON_SECRET) {
    const authHeader = req.headers.authorization;
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  const API_KEY = process.env.YouTube_Live_Checker;
  const CHANNEL_ID = process.env.CHANNEL_ID;
  const WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;

  if (!API_KEY || !CHANNEL_ID || !WEBHOOK_URL) {
    return res.status(500).json({ error: 'Missing required env vars' });
  }
  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
    return res.status(500).json({ error: 'Missing KV env vars (add the Upstash Redis integration in Vercel)' });
  }

  try {
    let state = await kvGet(STATE_KEY);
    if (!state) {
      // First run ever (fresh KV store): prime with "now" instead of
      // backfilling every existing video as if it were new.
      state = { lastVideoId: '', lastPublishedAt: new Date().toISOString() };
      await kvSet(STATE_KEY, state);
      return res.status(200).json({ posted: 0, primed: true });
    }

    const videos = await fetchRecentLongFormVideos(API_KEY, CHANNEL_ID);

    const newVideos = videos
      .filter((v) => new Date(v.publishedAt) > new Date(state.lastPublishedAt))
      .sort((a, b) => new Date(a.publishedAt) - new Date(b.publishedAt));

    if (newVideos.length === 0) {
      return res.status(200).json({ posted: 0 });
    }

    for (const video of newVideos) {
      await postToDiscord(WEBHOOK_URL, video);
      state.lastVideoId = video.id;
      state.lastPublishedAt = video.publishedAt;
    }
    await kvSet(STATE_KEY, state);

    return res.status(200).json({ posted: newVideos.length, videos: newVideos.map((v) => v.id) });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
