// Simple authentication controller
// In production, use bcrypt for password hashing

export const login = (req, res) => {
  const { password } = req.body;
  const clientIp = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket.remoteAddress;

  // Check password against environment variable
  // In production, use bcrypt.compare()
  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

  if (password === ADMIN_PASSWORD) {
    req.session.isAuthenticated = true;
    console.log(`[AUTH] Login successful - ${clientIp}`);
    return res.json({ success: true, message: 'Login successful' });
  }

  console.warn(`[AUTH] Login failed (invalid password) - ${clientIp}`);
  return res.status(401).json({ error: 'Invalid password' });
};

export const logout = (req, res) => {
  const clientIp = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket.remoteAddress;

  req.session.destroy((err) => {
    if (err) {
      console.error(`[AUTH] Logout failed - ${clientIp}:`, err.message);
      return res.status(500).json({ error: 'Logout failed' });
    }
    res.clearCookie('connect.sid'); // Clear session cookie
    console.log(`[AUTH] Logout successful - ${clientIp}`);
    return res.json({ success: true, message: 'Logout successful' });
  });
};

export const checkAuth = (req, res) => {
  const isAuthenticated = !!(req.session && req.session.isAuthenticated);
  return res.json({ isAuthenticated });
};
