// Shared YouTube ISO 8601 duration parsing and Shorts cutoff, so every
// endpoint classifies Shorts vs long-form the same way. latest-video.js used
// to do its own `duration.includes('M')` check, which misclassified any
// Short between 61-180s (e.g. "PT1M30S" contains "M") as long-form.
export const SHORTS_MAX_SECONDS = 180;

export function parseDurationSeconds(iso8601) {
  const match = iso8601.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!match) return 0;
  const [, h, m, s] = match;
  return (Number(h) || 0) * 3600 + (Number(m) || 0) * 60 + (Number(s) || 0);
}

export function isShort(iso8601) {
  return parseDurationSeconds(iso8601) <= SHORTS_MAX_SECONDS;
}
