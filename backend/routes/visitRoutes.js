import express from 'express';
import rateLimit from 'express-rate-limit';
import { createVisit, getVisits, getStats } from '../controllers/visitController.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

// The frontend SSR process calls this over loopback directly (bypassing nginx),
// so a legitimate call never carries X-Forwarded-For. nginx always adds that
// header for anything it proxies from the public internet, so its presence
// means this request did NOT come from our trusted frontend — reject it.
const internalOnly = (req, res, next) => {
  if (req.headers['x-forwarded-for']) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
};

const visitLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  standardHeaders: true,
  legacyHeaders: false,
});

// Called by the frontend SSR middleware on every page request
router.post('/', internalOnly, visitLimiter, createVisit);

// Admin-only inspection
router.get('/stats', requireAuth, getStats);
router.get('/', requireAuth, getVisits);

export default router;
