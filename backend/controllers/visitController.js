import { recordVisit, getRecentVisits, getVisitStats } from '../services/visitService.js';

// POST /api/visits - Record a page visit (called internally by the frontend SSR middleware
// over loopback; internalOnly middleware in visitRoutes.js rejects any request that came
// in through nginx/the public internet, so `ip` here is only ever supplied by our own
// trusted frontend process, which itself derived it from nginx's un-spoofable header)
export const createVisit = async (req, res) => {
  try {
    const { path, method, ip, userAgent, referrer } = req.body;

    if (!path) {
      return res.status(400).json({ error: 'path is required' });
    }

    const visit = await recordVisit({ path, method, ip, userAgent, referrer });
    res.status(201).json(visit);
  } catch (error) {
    console.error('Error creating visit:', error);
    res.status(500).json({ error: 'Failed to record visit' });
  }
};

// GET /api/visits - List recent visits (admin only)
export const getVisits = async (req, res) => {
  try {
    const limit = Math.min(500, parseInt(req.query.limit, 10) || 100);
    const visits = await getRecentVisits(limit);
    res.json(visits);
  } catch (error) {
    console.error('Error fetching visits:', error);
    res.status(500).json({ error: 'Failed to fetch visits' });
  }
};

// GET /api/visits/stats - Aggregate visit stats (admin only)
export const getStats = async (req, res) => {
  try {
    const stats = await getVisitStats();
    res.json(stats);
  } catch (error) {
    console.error('Error fetching visit stats:', error);
    res.status(500).json({ error: 'Failed to fetch visit stats' });
  }
};
