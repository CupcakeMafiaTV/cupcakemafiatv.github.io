const MAX_AGE = 365 * 86400000;

export function eligibleClips(clips, now = Date.now()) {
  const ids = new Set();
  return (Array.isArray(clips) ? clips : []).filter(clip => {
    if (!clip || typeof clip !== 'object' || typeof clip.id !== 'string' || !/^[\w-]+$/.test(clip.id) || ids.has(clip.id)) return false;
    const created = Date.parse(clip.createdAt);
    if (!Number.isFinite(created) || created <= now - MAX_AGE || created > now) return false;
    try {
      const url = new URL(clip.embedUrl);
      if (url.origin !== 'https://clips.twitch.tv' || url.pathname !== '/embed' || url.searchParams.get('clip') !== clip.id) return false;
    } catch { return false; }
    ids.add(clip.id);
    return true;
  });
}

// Remember displayed clips across reloads; storage failures must not prevent playback.
export function pickNextClip(clips, storage, random = Math.random) {
  if (!clips.length) return null;
  if (storage === undefined) { try { storage = globalThis.localStorage; } catch {} }
  let seen = [];
  try { const saved = JSON.parse(storage?.getItem('cupcake-seen-clips-v1') || '[]'); if (Array.isArray(saved)) seen = saved.filter(id => clips.some(c => c.id === id)); } catch {}
  let choices = clips.filter(c => !seen.includes(c.id));
  if (!choices.length) {
    const last = seen.at(-1);
    seen = [];
    choices = clips.length > 1 ? clips.filter(c => c.id !== last) : clips;
  }
  const clip = choices[Math.floor(random() * choices.length)];
  try { storage?.setItem('cupcake-seen-clips-v1', JSON.stringify([...seen, clip.id])); } catch {}
  return clip;
}
