import { setCors } from './_cors.js';

export default async function handler(req, res) {
    setCors(req, res, 'GET,OPTIONS');
    res.setHeader('Cache-Control', 's-maxage=900, stale-while-revalidate=3600');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const API_KEY = process.env.YouTube_Live_Checker;
    const HANDLE = 'CupcakeMafiaTVODs';

    if (!API_KEY) {
        return res.status(500).json({ error: 'Missing env var: YouTube_Live_Checker' });
    }

    try {
        // 1. Resolve the VODs channel handle to its uploads playlist ID.
        const channelRes = await fetch(`https://www.googleapis.com/youtube/v3/channels?part=contentDetails&forHandle=${HANDLE}&key=${API_KEY}`);
        const channelData = await channelRes.json();

        if (!channelData.items || channelData.items.length === 0) {
            return res.status(500).json({ error: 'VODs channel handle not found or invalid' });
        }

        const uploadsPlaylistId = channelData.items[0].contentDetails.relatedPlaylists.uploads;

        // 2. Fetch most recent upload.
        const playlistRes = await fetch(`https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${uploadsPlaylistId}&maxResults=1&key=${API_KEY}`);
        const playlistData = await playlistRes.json();

        if (!playlistData.items || playlistData.items.length === 0) {
            return res.status(404).json({ error: 'No VODs found' });
        }

        const latest = playlistData.items[0].snippet;

        return res.status(200).json({
            title: latest.title,
            videoId: latest.resourceId.videoId,
            thumbnail: latest.thumbnails.maxres?.url || latest.thumbnails.high?.url || latest.thumbnails.medium.url
        });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}
