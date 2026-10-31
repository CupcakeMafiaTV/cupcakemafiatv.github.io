(() => {
  const link = document.querySelector('.youtube-audience');
  const subscribers = link?.querySelector('[data-youtube-metric="subscribers"]');
  const views = link?.querySelector('[data-youtube-metric="views"]');
  if (!link || !subscribers || !views) return;
  let hovered = false;
  let focused = false;
  const render = () => {
    const showViews = hovered || focused;
    subscribers.hidden = showViews;
    views.hidden = !showViews;
  };
  link.addEventListener('mouseenter', () => { hovered = true; render(); });
  link.addEventListener('mouseleave', () => { hovered = false; render(); });
  link.addEventListener('focusin', () => { focused = true; render(); });
  link.addEventListener('focusout', event => {
    focused = link.contains(event.relatedTarget);
    render();
  });
  render();
})();
