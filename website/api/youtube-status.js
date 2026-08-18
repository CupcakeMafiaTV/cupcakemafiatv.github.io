// Extracts the JSON object that follows `marker` in `html` by counting braces
// (rather than a regex), since a naive regex can end early if the JSON
// contains a literal "};" inside a string value.
function extractJsonAfter(html, marker) {
  const start = html.indexOf(marker);
  if (start === -1) return null;

  const jsonStart = start + marker.length;
  let depth = 0;
  let inString = false;
  let escapeNext = false;

  for (let i = jsonStart; i < html.length; i++) {
    const char = html[i];

    if (inString) {
      if (escapeNext) {
        escapeNext = false;
      } else if (char === '\\') {
        escapeNext = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
    } else if (char === '{') {
      depth++;
    } else if (char === '}') {
      depth--;
      if (depth === 0) {
        return html.slice(jsonStart, i + 1);
      }
    }
  }

  return null;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  // Refresh at the edge every ~90s rather than scraping YouTube on every
  // single visitor request/poll.
  res.setHeader('Cache-Control', 's-maxage=90, stale-while-revalidate=300');

  const CHANNEL_ID = process.env.CHANNEL_ID;

  if (!CHANNEL_ID) {
    return res.status(500).json({ isLive: false, error: 'Missing YouTube environment variables' });
  }

  try {
    // The Data API's search.list endpoint costs 100 quota units per call
    // against a 10,000/day default quota, capping this check at ~100
    // calls/day project-wide. Instead, read the channel's public /live page:
    // YouTube renders the live video's player data into it when the channel
    // is streaming, with no API key or quota involved.
    const response = await fetch(`https://www.youtube.com/channel/${CHANNEL_ID}/live`, {
      headers: {
        // A full, current browser-request header set. Serverless functions run
        // from datacenter IPs, which YouTube is more likely to serve a stripped
        // fallback page (no player data) to when the request looks bot-like;
        // matching a real Chrome navigation as closely as possible reduces that.
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-User': '?1',
        'Sec-Ch-Ua': '"Chromium";v="126", "Not.A/Brand";v="24", "Google Chrome";v="126"',
        'Sec-Ch-Ua-Mobile': '?0',
        'Sec-Ch-Ua-Platform': '"Windows"',
        'Upgrade-Insecure-Requests': '1',
        // Bypasses the EU cookie-consent interstitial, which would otherwise
        // replace the channel page with a consent form (no player data) for
        // requests originating from EU-region servers.
        'Cookie': 'CONSENT=YES+1'
      },
      redirect: 'follow'
    });

    if (!response.ok) {
      return res.status(200).json({ isLive: false, error: `YouTube page request failed with status ${response.status}` });
    }

    const html = await response.text();
    const jsonStr = extractJsonAfter(html, 'var ytInitialPlayerResponse = ');

    if (!jsonStr) {
      // No player data on the page means the channel isn't currently live.
      return res.status(200).json({ isLive: false });
    }

    const playerResponse = JSON.parse(jsonStr);
    const isLive = Boolean(playerResponse?.videoDetails?.isLive);

    return res.status(200).json({ isLive });
  } catch (error) {
    return res.status(500).json({ isLive: false, error: error.message });
  }
}
