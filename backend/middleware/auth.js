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
