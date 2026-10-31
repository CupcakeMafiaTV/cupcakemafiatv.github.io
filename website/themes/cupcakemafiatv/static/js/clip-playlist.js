const MANIFEST = '/data/twitch-playlist.json';
const MAX_AGE = 90 * 86400000;

export function eligibleClips(clips, now = Date.now()) {
  const ids = new Set();
  return (Array.isArray(clips) ? clips : []).filter(clip => {
    if (!clip || typeof clip !== 'object') return false;
    const created = Date.parse(clip.createdAt);
    if (!clip.id || ids.has(clip.id) || !Number.isFinite(created) || created < now - MAX_AGE || created > now) return false;
    if (typeof clip.src !== 'string' || !/^\/clips\/[\w-]+\.mp4$/.test(clip.src)) return false;
    ids.add(clip.id);
    return true;
  }).sort((a, b) => Number(b.viewCount || 0) - Number(a.viewCount || 0)).slice(0, 10);
}

export function shuffledRound(clips, previousId, random = Math.random) {
  const result = [...clips];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  if (result.length > 1 && result[0].id === previousId) [result[0], result[1]] = [result[1], result[0]];
  return result;
}

export async function mountClipPlaylist(media, fallback) {
  if (!media) return false;
  const response = await fetch(MANIFEST, { cache: 'no-store' });
  if (!response.ok) return false;
  let pool = eligibleClips((await response.json()).clips);
  if (!pool.length) return false;

  const video = document.createElement('video');
  video.id = 'twitch-clip-video';
  video.className = 'absolute top-0 left-0 w-full h-full';
  video.style.objectFit = 'contain';
  video.controls = true;
  video.muted = true;
  video.defaultMuted = true;
  video.playsInline = true;
  video.preload = 'none';
  video.setAttribute('aria-label', 'Recent Twitch clips');
  media.replaceChildren(video);

  let queue = shuffledRound(pool);
  let currentId;
  let waiting = true;
  let visible = !('IntersectionObserver' in window);
  let failures = 0;
  let stopped = false;
  let advancing = false;
  let observer;

  const cleanup = () => {
    stopped = true;
    observer?.disconnect();
    document.removeEventListener('visibilitychange', advance);
    video.pause();
    video.removeAttribute('src');
    video.load();
  };

  async function advance() {
    if (stopped || advancing || !waiting || !visible || document.hidden) return;
    advancing = true;
    waiting = false;
    if (!queue.length) {
      try {
        const updated = await fetch(MANIFEST, { cache: 'no-store' });
        if (updated.ok) pool = eligibleClips((await updated.json()).clips);
      } catch { pool = eligibleClips(pool); }
      if (!pool.length) { cleanup(); void fallback?.(); return; }
      queue = shuffledRound(pool, currentId);
    }
    if (stopped) return;
    // A manifest request can finish after the viewer switches tabs or scrolls away.
    if (!visible || document.hidden) { waiting = true; advancing = false; return; }
    const clip = queue.shift();
    currentId = clip.id;
    video.dataset.clipId = clip.id;
    video.setAttribute('aria-label', clip.title ? 'Twitch clip: ' + clip.title : 'Twitch clip');
    video.src = clip.src;
    advancing = false;
    // If autoplay is blocked, native controls remain available; do not skip the clip.
    void video.play().catch(() => {});
  }

  video.addEventListener('ended', () => { waiting = true; void advance(); });
  video.addEventListener('playing', () => { failures = 0; });
  video.addEventListener('error', () => {
    if (stopped) return;
    if (++failures >= pool.length) { cleanup(); void fallback?.(); return; }
    waiting = true;
    void advance();
  });
  document.addEventListener('visibilitychange', advance);
  if ('IntersectionObserver' in window) {
    observer = new IntersectionObserver(entries => {
      visible = entries.some(entry => entry.isIntersecting && entry.intersectionRatio >= 0.5);
      void advance();
    }, { threshold: 0.5 });
    observer.observe(media);
  } else { void advance(); }
  return true;
}
