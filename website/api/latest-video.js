import { setCors } from './_cors.js';

export default async function handler(req, res) {
    setCors(req, res, 'GET,OPTIONS');
    res.setHeader('Cache-Control', 's-maxage=900, stale-while-revalidate=3600');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const API_KEY = process.env.YouTube_Live_Checker;
    const CHANNEL_ID = process.env.CHANNEL_ID;

    if (!API_KEY || !CHANNEL_ID) {
        return res.status(500).json({ error: `Missing env vars: Key=${!!API_KEY}, Channel=${!!CHANNEL_ID}` });
    }

    try {
        // 1. Get uploads playlist ID
        const channelRes = await fetch(`https://www.googleapis.com/youtube/v3/channels?part=contentDetails&id=${CHANNEL_ID}&key=${API_KEY}`);
        const channelData = await channelRes.json();
        
        if (!channelData.items || channelData.items.length === 0) {
            return res.status(500).json({ error: 'Channel ID not found or invalid' });
        }
        
        const uploadsPlaylistId = channelData.items[0].contentDetails.relatedPlaylists.uploads;

        // 2. Fetch recent videos
        const playlistRes = await fetch(`https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${uploadsPlaylistId}&maxResults=10&key=${API_KEY}`);
        const playlistData = await playlistRes.json();
        
        if (!playlistData.items || playlistData.items.length === 0) {
            return res.status(500).json({ error: 'No playlist items found' });
        }

        const videoIds = playlistData.items.map(item => item.snippet.resourceId.videoId).join(',');

        // 3. Fetch video details to check duration
        const detailsRes = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails&id=${videoIds}&key=${API_KEY}`);
        const detailsData = await detailsRes.json();

        const longFormVideo = detailsData.items.find(video => {
            const duration = video.contentDetails.duration;
            return duration.includes('M') || duration.includes('H');
        });

        if (longFormVideo) {
            return res.status(200).json({
                title: longFormVideo.snippet.title,
                videoId: longFormVideo.id,
                thumbnail: longFormVideo.snippet.thumbnails.maxres?.url || longFormVideo.snippet.thumbnails.high?.url || longFormVideo.snippet.thumbnails.medium.url
            });
        } else {
            return res.status(404).json({ error: 'No long-form videos found (all might be shorts)' });
        }
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}