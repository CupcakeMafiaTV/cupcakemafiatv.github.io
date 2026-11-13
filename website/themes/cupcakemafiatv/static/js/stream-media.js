// Keep one selected clip through layout changes; narrow screens open Twitch directly.
export function mountStreamMedia(container, { isLive, clip }, signal) {
  const heading = document.getElementById('watch-live-heading');
  if (heading) heading.textContent = 'Watch Live';
  document.getElementById('stream-state-label')?.remove();
  let layout = null;
  let stopPlayer = () => {};
  const clipId = clip && /^[\w-]+$/.test(clip.id) ? clip.id : null;
  const target = clipId ? 'https://clips.twitch.tv/' + clipId : 'https://www.twitch.tv/cupcakemafiatv';
  function render() {
    if (signal.aborted) return;
    const next = container.clientWidth >= 400 && (isLive || clipId) ? 'embed' : 'link';
    if (layout === next) return;
    layout = next;
    stopPlayer();
    container.classList.toggle('is-twitch-embed', next === 'embed');
    if (next === 'link') {
      const link = document.createElement('a');
      link.className = 'twitch-mobile-link'; link.href = target; link.target = '_blank'; link.rel = 'noopener noreferrer';
      const img = document.createElement('img'); img.alt = ''; img.loading = 'lazy'; img.width = 640; img.height = 360;
      img.src = '/img/CodySetup.webp';
      try {
        const thumbnail = new URL(clip?.thumbnailUrl);
        if (thumbnail.protocol === 'https:' && ['static-cdn.jtvnw.net','clips-media-assets2.twitch.tv','clips-media-assets.twitch.tv'].includes(thumbnail.hostname) && !thumbnail.username && !thumbnail.password) img.src = thumbnail.href;
      } catch {}
      img.addEventListener('error', () => { img.src = '/img/CodySetup.webp'; }, { once: true });
      const label = document.createElement('span'); label.className = 'twitch-mobile-label';
      label.textContent = clipId ? 'Watch clip on Twitch \u2197' : 'Watch on Twitch \u2197';
      if (clip?.title) link.title = clip.title;
      link.append(img, label); container.replaceChildren(link);
      return;
    }
    const frame = document.createElement('iframe');
    frame.id = isLive ? 'twitch-live-iframe' : 'twitch-clip-iframe';
    frame.title = isLive ? 'CupcakeMafiaTV live stream' : 'Twitch clip: ' + (clip.title || 'CupcakeMafiaTV');
    if (clipId) frame.dataset.clipId = clipId;
    frame.allow = 'autoplay; fullscreen'; frame.allowFullscreen = true;
    const url = new URL(isLive ? 'https://player.twitch.tv/' : 'https://clips.twitch.tv/embed');
    url.searchParams.set(isLive ? 'channel' : 'clip', isLive ? 'cupcakemafiatv' : clipId);
    url.searchParams.set('parent', location.hostname);
    url.searchParams.set('autoplay', 'true'); url.searchParams.set('muted', 'true');
    container.replaceChildren(frame);
    let nearby = false, started = false, observer;
    const start = () => {
      if (started || !nearby || document.hidden || signal.aborted) return;
      started = true; frame.src = url.href;
      observer?.disconnect(); document.removeEventListener('visibilitychange', start);
    };
    stopPlayer = () => { observer?.disconnect(); document.removeEventListener('visibilitychange', start); };
    document.addEventListener('visibilitychange', start);
    if ('IntersectionObserver' in window) {
      // Prepare the muted player shortly before it enters view, rather than
      // waiting until half of a tall player has already been scrolled past.
      // This site's body is its own scrollport. Use the nearest scrolling
      // ancestor so its clipping does not cancel the early-loading margin.
      let root = null;
      for (let ancestor = container.parentElement; ancestor && ancestor !== document.documentElement; ancestor = ancestor.parentElement) {
        if (/^(auto|scroll)$/.test(getComputedStyle(ancestor).overflowY) && ancestor.scrollHeight > ancestor.clientHeight) { root = ancestor; break; }
      }
      observer = new IntersectionObserver(entries => { nearby = entries.some(e => e.isIntersecting); start(); }, { root, rootMargin: '0px 0px 300px 0px', threshold: 0 });
      observer.observe(container);
    } else { url.searchParams.set('autoplay','false'); nearby = true; start(); }
  }
  const resize = new ResizeObserver(render);
  resize.observe(container);
  signal.addEventListener('abort', () => { resize.disconnect(); stopPlayer(); }, { once: true });
  render();
}
