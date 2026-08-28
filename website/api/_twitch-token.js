// Shared Twitch app-access-token cache. twitch-status.js, twitch-followers.js,
// and twitch-clips.js were each fetching a brand new OAuth token on every
// single request -- a full token exchange before every real API call, on
// every page view. Twitch app tokens are valid for ~60 days, so this caches
// one in the same Upstash Redis already used elsewhere in /api and reuses it
// for its full lifetime instead of reissuing it constantly.
const TOKEN_KEY = 'twitch-access-token';
const TOKEN_TTL_SECONDS = 50 * 24 * 60 * 60; // 50 days (Twitch tokens last ~60)

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

async function fetchNewToken(clientId, clientSecret) {
  const tokenRes = await fetch(
    `https://id.twitch.tv/oauth2/token?client_id=${clientId}&client_secret=${clientSecret}&grant_type=client_credentials`,
    { method: 'POST' }
  );
  const tokenData = await tokenRes.json();
  if (!tokenData.access_token) {
    throw new Error(`Failed to authenticate with Twitch API: ${JSON.stringify(tokenData)}`);
  }
  return tokenData.access_token;
}

// Returns a valid Twitch app access token, reusing a cached one when
// possible. Pass forceRefresh true after a Helix call comes back 401 to
// discard a revoked/stale cached token and fetch a fresh one.
export async function getTwitchToken(clientId, clientSecret, forceRefresh = false) {
  const hasKV = process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN;

  if (hasKV && !forceRefresh) {
    try {
      const cached = await kvGet(TOKEN_KEY);
      if (cached && (Date.now() - cached.issuedAt) < TOKEN_TTL_SECONDS * 1000) {
        return cached.token;
      }
    } catch (error) {
      // KV unreachable: fall through and fetch a fresh token directly.
    }
  }

  const token = await fetchNewToken(clientId, clientSecret);

  if (hasKV) {
    try {
      await kvSet(TOKEN_KEY, { token, issuedAt: Date.now() });
    } catch (error) {
      // Caching failed; the token itself is still valid for this request.
    }
  }

  return token;
}
