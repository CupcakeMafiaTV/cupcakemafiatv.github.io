// Shared Upstash Redis lock so post-new-video.js and post-new-clip.js can't
// double-post to Discord if two invocations ever overlap (a manual ?force=1
// test racing a scheduled cron fire, or a retried request). Uses Redis SET
// with NX (only set if not already present) and EX (auto-expiring TTL, so a
// crashed run can't leave the lock stuck forever) via Upstash's REST API.

// Auto-expire well above how long a single check-and-post run should ever
// take, so a slow-but-healthy run never gets its own lock evicted mid-flight.
const LOCK_TTL_SECONDS = 55;

async function upstash(command) {
  const res = await fetch(process.env.KV_REST_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(command),
  });
  return res.json();
}

// Returns true if the lock was acquired, false if another run already holds it.
export async function acquireLock(key) {
  const result = await upstash(['SET', key, '1', 'NX', 'EX', LOCK_TTL_SECONDS]);
  return result.result === 'OK';
}

export async function releaseLock(key) {
  await upstash(['DEL', key]);
}
