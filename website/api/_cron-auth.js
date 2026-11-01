import { timingSafeEqual } from 'node:crypto';

export function authorizeCron(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    res.status(405).json({ error: 'Method not allowed' });
    return false;
  }
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    res.status(503).json({ error: 'Scheduled task authentication is not configured' });
    return false;
  }
  const authorization = req.headers?.authorization;
  const expected = Buffer.from('Bearer ' + secret);
  const actual = Buffer.from(typeof authorization === 'string' ? authorization : '');
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    res.status(401).json({ error: 'Unauthorized' });
    return false;
  }
  return true;
}
