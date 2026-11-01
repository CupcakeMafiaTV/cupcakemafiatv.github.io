import { setCors } from './_cors.js';
import { isShort } from './_youtube-duration.js';
const SNAPSHOT_KEY = 'cmtv:latest-regular-video:v1';
const valid = data => data && /^[A-Za-z0-9_-]{11}$/.test(data.videoId) && typeof data.title === 'string';

async function snapshot(command) {
  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) return null;
  const response = await fetch(process.env.KV_REST_API_URL, {
    method: 'POST', headers: { Authorization: 'Bearer ' + process.env.KV_REST_API_TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify(command), signal: AbortSignal.timeout(1000)
  });
  if (!response.ok) throw new Error('Snapshot unavailable');
  const data = await response.json();
  if (data.error) throw new Error('Snapshot unavailable');
  return data.result;
}
async function fallback(res, status) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    const saved = JSON.parse(await snapshot(['GET', SNAPSHOT_KEY]));
    if (valid(saved)) return res.status(200).json({ ...saved, stale: true });
  } catch {}
  return res.status(status).json({ error: 'Latest video temporarily unavailable' });
}

export default async function handler(req, res) {
  setCors(req, res, 'GET,OPTIONS');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return res.status(405).json({ error: 'Method not allowed' }); }
  const apiKey = process.env.YouTube_Live_Checker;
  const channelId = process.env.CHANNEL_ID;
  if (!apiKey || !channelId) return fallback(res, 503);
  const signal = AbortSignal.timeout(12000);
  const youtube = async (resource, params) => {
    const query = new URLSearchParams({ ...params, key: apiKey });
    const response = await fetch('https://www.googleapis.com/youtube/v3/' + resource + '?' + query, { signal });
    if (!response.ok) throw new Error('YouTube unavailable');
    const data = await response.json();
    if (!Array.isArray(data.items)) throw new Error('Invalid YouTube response');
    return data;
  };
  try {
    const channel = await youtube('channels', { part: 'contentDetails', id: channelId });
    const playlistId = channel.items[0]?.contentDetails?.relatedPlaylists?.uploads;
    if (!playlistId) throw new Error('Uploads unavailable');
    let pageToken = '';
    // Up to 250 uploads, bounded by the shared timeout and a five-page cap.
    for (let page = 0; page < 5; page++) {
      const playlist = await youtube('playlistItems', { part: 'snippet', playlistId, maxResults: '50', ...(pageToken ? { pageToken } : {}) });
      const ids = playlist.items.map(item => item.snippet?.resourceId?.videoId).filter(id => /^[A-Za-z0-9_-]{11}$/.test(id));
      if (ids.length) {
        const details = await youtube('videos', { part: 'snippet,contentDetails,status', id: ids.join(',') });
        const byId = new Map(details.items.map(video => [video.id, video]));
        // Keep playlist order: the details response need not be sorted.
        const video = ids.map(id => byId.get(id)).find(video => video &&
          video.snippet?.liveBroadcastContent === 'none' && video.status?.privacyStatus === 'public' &&
          video.status.embeddable === true && typeof video.contentDetails?.duration === 'string' &&
          !isShort(video.contentDetails.duration));
        if (video) {
          const data = { videoId: video.id, title: video.snippet.title,
            thumbnail: video.snippet.thumbnails?.maxres?.url || video.snippet.thumbnails?.high?.url || 'https://i.ytimg.com/vi/' + video.id + '/hqdefault.jpg' };
          if (!valid(data)) throw new Error('Invalid video');
          try { await snapshot(['SET', SNAPSHOT_KEY, JSON.stringify(data), 'EX', 2592000]); } catch {}
          res.setHeader('Cache-Control', 's-maxage=900, stale-while-revalidate=3600');
          return res.status(200).json(data);
        }
      }
      if (!playlist.nextPageToken || playlist.nextPageToken === pageToken) break;
      pageToken = playlist.nextPageToken;
    }
    return fallback(res, 404);
  } catch { return fallback(res, 502); }
}
