// Runs on a daily Vercel Cron schedule (see vercel.json). Checks for a new
// long-form video AND a new VOD upload in the same run (folded together so
// the free Vercel plan's cron-job cap isn't a factor) and posts each to its
// own Discord channel via its own webhook. Shorts are excluded from the main
// channel using YouTube's Shorts duration cutoff (<=180s). Dedup state (the
// last item posted, per feed) is kept in Upstash Redis so nothing is ever
// posted twice, even if the check runs again before the next upload.
//
// Vercel Cron only supports fixed UTC schedules, but we want this to always
// fire at true 8PM US Eastern time regardless of Daylight Saving. vercel.json
// schedules TWO triggers (covering both the EST and EDT UTC offsets); this
// handler checks the real Eastern-time hour and no-ops unless it's actually
// 8PM there, so only one of the two triggers ever does real work on a given
// day. Manual testing can bypass this with ?force=1.

const SHORTS_MAX_SECONDS = 180;
const ACCENT_COLOR = 0x00dbc9;
const VOD_ACCENT_COLOR = 0x654cff;
const STATE_KEY = 'last-posted-video';
const VOD_STATE_KEY = 'last-posted-vod';
const VODS_HANDLE = 'CupcakeMafiaTVODs';
const TARGET_EASTERN_HOUR = 20; // 8PM

function currentEasternHour() {
  return Number(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      hour: 'numeric',
      hour12: false,
    }).format(new Date())
  );
}

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
    body: JSON.stringify(value),
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

async function fetchRecentVods(apiKey) {
  const channelRes = await fetch(
    `https://www.googleapis.com/youtube/v3/channels?part=contentDetails&forHandle=${VODS_HANDLE}&key=${apiKey}`
  );
  const channelData = await channelRes.json();
  const uploadsPlaylistId = channelData.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
  if (!uploadsPlaylistId) throw new Error('Could not resolve uploads playlist for VODs channel');

  const playlistRes = await fetch(
    `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${uploadsPlaylistId}&maxResults=10&key=${apiKey}`
  );
  const playlistData = await playlistRes.json();

  return (playlistData.items || []).map((item) => ({
    id: item.snippet.resourceId.videoId,
    title: item.snippet.title,
    publishedAt: item.snippet.publishedAt,
    thumbnail:
      item.snippet.thumbnails.maxres?.url ||
      item.snippet.thumbnails.high?.url ||
      item.snippet.thumbnails.medium.url,
  }));
}

async function postToDiscord(webhookUrl, item, { emoji, label, color }) {
  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: 'CupcakeMafiaTV',
      avatar_url: 'https://cupcakemafiatv.com/img/emotes/MainCupcake.png',
      content: `${emoji} ${label} https://youtu.be/${item.id}`,
      embeds: [
        {
          title: item.title,
          url: `https://youtu.be/${item.id}`,
          color,
          image: { url: item.thumbnail },
        },
      ],
    }),
  });
  if (!res.ok) {
    throw new Error(`Discord webhook failed: ${res.status} ${await res.text()}`);
  }
}

async function checkAndPostFeed({ stateKey, fetchItems, webhookUrl, emoji, label, color }) {
  let state = await kvGet(stateKey);
  if (!state) {
    // First run ever (fresh KV store): prime with "now" instead of
    // backfilling every existing item as if it were new.
    state = { lastId: '', lastPublishedAt: new Date().toISOString() };
    await kvSet(stateKey, state);
    return { posted: 0, primed: true };
  }

  const items = await fetchItems();
  const newItems = items
    .filter((v) => new Date(v.publishedAt) > new Date(state.lastPublishedAt))
    .sort((a, b) => new Date(a.publishedAt) - new Date(b.publishedAt));

  if (newItems.length === 0) {
    return { posted: 0 };
  }

  for (const item of newItems) {
    await postToDiscord(webhookUrl, item, { emoji, label, color });
    state.lastId = item.id;
    state.lastPublishedAt = item.publishedAt;
  }
  await kvSet(stateKey, state);

  return { posted: newItems.length, ids: newItems.map((v) => v.id) };
}

export default async function handler(req, res) {
  if (req.query.force !== '1' && currentEasternHour() !== TARGET_EASTERN_HOUR) {
    return res.status(200).json({ skipped: 'Not 8PM Eastern yet', easternHour: currentEasternHour() });
  }

  if (process.env.CRON_SECRET) {
    const authHeader = req.headers.authorization;
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  const API_KEY = process.env.YouTube_Live_Checker;
  const CHANNEL_ID = process.env.CHANNEL_ID;
  const WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;
  const VODS_WEBHOOK_URL = process.env.DISCORD_VODS_WEBHOOK_URL;

  if (!API_KEY || !CHANNEL_ID || !WEBHOOK_URL) {
    return res.status(500).json({ error: 'Missing required env vars' });
  }
  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
    return res.status(500).json({ error: 'Missing KV env vars (add the Upstash Redis integration in Vercel)' });
  }

  const results = {};

  try {
    results.video = await checkAndPostFeed({
      stateKey: STATE_KEY,
      fetchItems: () => fetchRecentLongFormVideos(API_KEY, CHANNEL_ID),
      webhookUrl: WEBHOOK_URL,
      emoji: '🎬',
      label: 'New video is up!',
      color: ACCENT_COLOR,
    });
  } catch (error) {
    results.video = { error: error.message };
  }

  if (VODS_WEBHOOK_URL) {
    try {
      results.vod = await checkAndPostFeed({
        stateKey: VOD_STATE_KEY,
        fetchItems: () => fetchRecentVods(API_KEY),
        webhookUrl: VODS_WEBHOOK_URL,
        emoji: '🎞️',
        label: 'New VOD is up!',
        color: VOD_ACCENT_COLOR,
      });
    } catch (error) {
      results.vod = { error: error.message };
    }
  } else {
    results.vod = { skipped: 'DISCORD_VODS_WEBHOOK_URL not set' };
  }

  return res.status(200).json(results);
}
