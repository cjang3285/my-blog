// Get client IP address
const getClientIp = (req) => {
  return req.headers['x-forwarded-for']?.split(',')[0].trim() ||
         req.headers['x-real-ip'] ||
         req.socket.remoteAddress ||
         req.connection.remoteAddress;
};

// Check if IP is trusted (localhost or private network)
const isTrustedIp = (ip) => {
  const trustedIps = [
    '127.0.0.1',
    '::1',
    'localhost',
    '::ffff:127.0.0.1'
  ];

  // Check if IP is from private network
  const isPrivateNetwork =
    ip.startsWith('192.168.') ||          // 가정용 네트워크
    ip.startsWith('10.') ||                // 기업용 네트워크
    ip.startsWith('172.16.') ||            // 기업용 네트워크
    ip.startsWith('172.17.') ||
    ip.startsWith('172.18.') ||
    ip.startsWith('172.19.') ||
    ip.startsWith('172.20.') ||
    ip.startsWith('172.21.') ||
    ip.startsWith('172.22.') ||
    ip.startsWith('172.23.') ||
    ip.startsWith('172.24.') ||
    ip.startsWith('172.25.') ||
    ip.startsWith('172.26.') ||
    ip.startsWith('172.27.') ||
    ip.startsWith('172.28.') ||
    ip.startsWith('172.29.') ||
    ip.startsWith('172.30.') ||
    ip.startsWith('172.31.');

  // Add custom trusted IPs from environment variable
  const customIps = process.env.TRUSTED_IPS?.split(',').map(ip => ip.trim()) || [];

  return trustedIps.includes(ip) || isPrivateNetwork || customIps.includes(ip);
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
