import { authorizeCron } from './_cron-auth.js';

// Runs on a daily Vercel Cron schedule (see vercel.json). Checks for new
// Twitch clips created of the channel and posts each one to Discord via
// webhook. Dedup state (the last clip seen) is kept in Upstash Redis so the
// same clip is never posted twice.

import { getTwitchToken } from './_twitch-token.js';
import { acquireLock, releaseLock } from './_kv-lock.js';

const ACCENT_COLOR = 0x654cff;
const STATE_KEY = 'last-posted-clip';
const LOCK_KEY = 'lock:post-new-clip';

async function kvGet(key, request) {
  const res = await request(`${process.env.KV_REST_API_URL}/get/${key}`, {
    headers: { Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}` },
  });
  if (!res.ok) throw new Error('Task state unavailable');
  const data = await res.json();
  if (data.error) throw new Error('Task state unavailable');
  return data.result ? JSON.parse(data.result) : null;
}

async function kvSet(key, value, request) {
  const response = await request(`${process.env.KV_REST_API_URL}/set/${key}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(value),
  });
  if (!response.ok || (await response.json()).error) throw new Error('Could not save task state');
}

async function fetchClipsSince(clientId, accessToken, broadcasterId, sinceISOString, request) {
  return request(
    `https://api.twitch.tv/helix/clips?broadcaster_id=${broadcasterId}&first=100&started_at=${sinceISOString}&ended_at=${new Date().toISOString()}`,
    {
      headers: {
        'Client-ID': clientId,
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );
}

async function postToDiscord(webhookUrl, clip, request) {
  request.assertTime(12000);
  const res = await request(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: 'CupcakeMafiaTV',
      avatar_url: 'https://cupcakemafiatv.com/img/emotes/MainCupcake.png',
      content: `📎 New clip! ${clip.url}`,
      embeds: [
        {
          title: clip.title,
          url: clip.url,
          color: ACCENT_COLOR,
          image: { url: clip.thumbnail_url },
        },
      ],
    }),
  });
  if (!res.ok) {
    throw new Error(`Discord webhook failed: ${res.status} ${await res.text()}`);
  }
}

export default async function handler(req, res) {
  if (!authorizeCron(req, res)) return;
  const CLIENT_ID = process.env.TWITCH_CLIENT_ID;
  const CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET;
  const BROADCASTER_ID = process.env.TWITCH_BROADCASTER_ID;
  const WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;

  if (!CLIENT_ID || !CLIENT_SECRET || !BROADCASTER_ID || !WEBHOOK_URL) {
    return res.status(500).json({ error: 'Missing required env vars' });
  }
  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
    return res.status(500).json({ error: 'Missing KV env vars (add the Upstash Redis integration in Vercel)' });
  }

  // Guards against two overlapping invocations (e.g. the 30-min poll firing
  // again before a slow prior run finished) both reading the same stale
  // dedup state and double-posting to Discord.
  let lease;
  try { lease = await acquireLock(LOCK_KEY); } catch { return res.status(503).json({ error: 'Task lock unavailable' }); }
  if (!lease) {
    return res.status(200).json({ skipped: 'Another check is already in progress' });
  }
  const request = lease.request;

  try {
    let state = await kvGet(STATE_KEY, request);
    if (!state) {
      // First run ever (fresh KV store): prime with "now" instead of
      // backfilling every existing clip as if it were new.
      state = { lastClipId: '', lastCreatedAt: new Date().toISOString() };
      await kvSet(STATE_KEY, state, request);
      return res.status(200).json({ posted: 0, primed: true });
    }

    let accessToken = await getTwitchToken(CLIENT_ID, CLIENT_SECRET, false, lease.signal);
    let clipsRes = await fetchClipsSince(CLIENT_ID, accessToken, BROADCASTER_ID, state.lastCreatedAt, request);

    if (clipsRes.status === 401) {
      accessToken = await getTwitchToken(CLIENT_ID, CLIENT_SECRET, true, lease.signal);
      clipsRes = await fetchClipsSince(CLIENT_ID, accessToken, BROADCASTER_ID, state.lastCreatedAt, request);
    }

    if (!clipsRes.ok) throw new Error('Twitch clips temporarily unavailable');
    const clipsData = await clipsRes.json();
    const clips = clipsData.data || [];

    const newClips = clips
      .filter((c) => new Date(c.created_at) > new Date(state.lastCreatedAt))
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

    if (newClips.length === 0) {
      return res.status(200).json({ posted: 0 });
    }

    const postedIds = [];
    for (const clip of newClips) {
      await postToDiscord(WEBHOOK_URL, clip, request);
      state.lastClipId = clip.id;
      state.lastCreatedAt = clip.created_at;
      // Persist after each successful post (not once at the end) so a later
      // clip failing (Discord rate-limit, transient 5xx) doesn't leave
      // earlier, already-posted clips unrecorded and get them reposted next run.
      await kvSet(STATE_KEY, state, request);
      postedIds.push(clip.id);
    }

    return res.status(200).json({ posted: postedIds.length, clips: postedIds });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  } finally {
    try { await releaseLock(lease); } catch { /* The owned lock expires automatically. */ }
  }
}
