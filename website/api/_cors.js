// Shared CORS allowlist for the public read-only stat endpoints (Twitch/
// YouTube/League stats). Previously these set Access-Control-Allow-Origin: *,
// letting any third-party site pull live stats directly off this API for
// free. Underscore-prefixed files under /api are not treated as routes by
// Vercel, so this can be imported by the sibling handler files.
const ALLOWED_ORIGINS = [
  'https://cupcakemafiatv.com',
  'http://localhost:1313',
];

export function setCors(req, res, methods = 'GET') {
  const origin = req.headers.origin;
  if (ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', methods);
}
