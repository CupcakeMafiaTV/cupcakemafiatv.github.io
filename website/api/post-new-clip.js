// Runs on a daily Vercel Cron schedule (see vercel.json). Checks for new
// Twitch clips created of the channel and posts each one to Discord via
// webhook. Dedup state (the last clip seen) is kept in Upstash Redis so the
// same clip is never posted twice.

import { getTwitchToken } from './_twitch-token.js';
import { acquireLock, releaseLock } from './_kv-lock.js';

const ACCENT_COLOR = 0x654cff;
const STATE_KEY = 'last-posted-clip';
const LOCK_KEY = 'lock:post-new-clip';

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

async function fetchClipsSince(clientId, accessToken, broadcasterId, sinceISOString) {
  return fetch(
    `https://api.twitch.tv/helix/clips?broadcaster_id=${broadcasterId}&first=100&started_at=${sinceISOString}&ended_at=${new Date().toISOString()}`,
    {
      headers: {
        'Client-ID': clientId,
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );
}

async function postToDiscord(webhookUrl, clip) {
  const res = await fetch(webhookUrl, {
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
  // Deliberately not gated behind CRON_SECRET: poll-clips.yml pings this
  // endpoint every 30 minutes via plain curl (no secret) to work around
  // Vercel Hobby-tier cron's unreliable timing. Repeat/unauthenticated calls
  // are harmless -- the KV dedup state means an extra call can't cause a
  // duplicate post on its own, and the lock below covers the case where two
  // calls genuinely overlap in time.
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
  if (!(await acquireLock(LOCK_KEY))) {
    return res.status(200).json({ skipped: 'Another check is already in progress' });
  }

  try {
    let state = await kvGet(STATE_KEY);
    if (!state) {
      // First run ever (fresh KV store): prime with "now" instead of
      // backfilling every existing clip as if it were new.
      state = { lastClipId: '', lastCreatedAt: new Date().toISOString() };
      await kvSet(STATE_KEY, state);
      return res.status(200).json({ posted: 0, primed: true });
    }

    let accessToken = await getTwitchToken(CLIENT_ID, CLIENT_SECRET);
    let clipsRes = await fetchClipsSince(CLIENT_ID, accessToken, BROADCASTER_ID, state.lastCreatedAt);

    if (clipsRes.status === 401) {
      accessToken = await getTwitchToken(CLIENT_ID, CLIENT_SECRET, true);
      clipsRes = await fetchClipsSince(CLIENT_ID, accessToken, BROADCASTER_ID, state.lastCreatedAt);
    }

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
      await postToDiscord(WEBHOOK_URL, clip);
      state.lastClipId = clip.id;
      state.lastCreatedAt = clip.created_at;
      // Persist after each successful post (not once at the end) so a later
      // clip failing (Discord rate-limit, transient 5xx) doesn't leave
      // earlier, already-posted clips unrecorded and get them reposted next run.
      await kvSet(STATE_KEY, state);
      postedIds.push(clip.id);
    }

    return res.status(200).json({ posted: postedIds.length, clips: postedIds });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  } finally {
    await releaseLock(LOCK_KEY);
  }
}
