import { randomUUID } from 'node:crypto';
const LOCK_TTL_SECONDS = 55;
const WORK_BUDGET_MS = 40000;
const RELEASE = 'if redis.call("get",KEYS[1]) == ARGV[1] then return redis.call("del",KEYS[1]) else return 0 end';
async function upstash(command) {
  const response = await fetch(process.env.KV_REST_API_URL, {
    method: 'POST', headers: { Authorization: 'Bearer ' + process.env.KV_REST_API_TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify(command), signal: AbortSignal.timeout(1500)
  });
  if (!response.ok) throw new Error('Task lock unavailable');
  const data = await response.json();
  if (data.error) throw new Error('Task lock unavailable');
  return data.result;
}
export async function acquireLock(key) {
  const token = randomUUID();
  // Start the budget before acquiring: work ends with a margin before Redis expiry.
  const deadline = performance.now() + WORK_BUDGET_MS;
  const signal = AbortSignal.timeout(WORK_BUDGET_MS);
  if (await upstash(['SET', key, token, 'NX', 'EX', LOCK_TTL_SECONDS]) !== 'OK') return null;
  const assertTime = (reserve = 0) => {
    if (signal.aborted || performance.now() + reserve >= deadline) throw new Error('Task time budget reached; remaining items will retry next run');
  };
  const request = (url, options = {}) => {
    assertTime();
    const remaining = Math.max(1, Math.floor(deadline - performance.now()));
    const signals = [signal, AbortSignal.timeout(Math.min(8000, remaining))];
    if (options.signal) signals.push(options.signal);
    return fetch(url, { ...options, signal: AbortSignal.any(signals) });
  };
  request.assertTime = assertTime;
  return { key, token, signal, request };
}
export async function releaseLock(lease) {
  if (!lease) return;
  // A late worker may only release its own lease, never a newer worker's lock.
  await upstash(['EVAL', RELEASE, 1, lease.key, lease.token]);
}
