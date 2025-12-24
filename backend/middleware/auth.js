// Get client IP address
const getClientIp = (req) => {
  return req.headers['x-forwarded-for']?.split(',')[0].trim() ||
         req.headers['x-real-ip'] ||
         req.socket.remoteAddress ||
         req.connection.remoteAddress;
};

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

// Auto-authenticate trusted IPs
export const autoAuth = (req, res, next) => {
  // Skip if already authenticated
  if (req.session && req.session.isAuthenticated) {
    return next();
  }

  const clientIp = getClientIp(req);

  // Auto-authenticate localhost
  if (isTrustedIp(clientIp)) {
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
