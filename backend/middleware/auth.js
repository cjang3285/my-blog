// Check if IP is trusted (localhost only)
const isTrustedIp = (ip) => {
  const trustedIps = [
    '127.0.0.1',
    '::1',
    'localhost',
    '::ffff:127.0.0.1'
  ];

  // Add custom trusted IPs from environment variable
  const customIps = process.env.TRUSTED_IPS?.split(',').map(ip => ip.trim()) || [];

  return trustedIps.includes(ip) || customIps.includes(ip);
};

// Auto-authenticate trusted IPs (development only — relies on Express's
// hop-aware req.ip, never on raw client-supplied headers)
export const autoAuth = (req, res, next) => {
  if (process.env.NODE_ENV !== 'development') {
    return next();
  }

  // Skip if already authenticated
  if (req.session && req.session.isAuthenticated) {
    return next();
  }

  // req.ip resolves correctly per Express's `trust proxy` setting (app.js),
  // unlike manually parsing X-Forwarded-For which a client can spoof.
  if (isTrustedIp(req.ip)) {
    req.session.isAuthenticated = true;
    req.session.autoAuthenticated = true; // Mark as auto-authenticated
  }

  next();
};

// Authentication middleware
export const requireAuth = (req, res, next) => {
  if (req.session && req.session.isAuthenticated) {
    return next();
  }
  return res.status(401).json({ error: 'Unauthorized' });
};

// Optional auth - doesn't block, just adds auth info to request
export const optionalAuth = (req, res, next) => {
  req.isAuthenticated = !!(req.session && req.session.isAuthenticated);
  next();
};
