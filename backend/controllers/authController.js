// Simple authentication controller
// In production, use bcrypt for password hashing

export const login = (req, res) => {
  const { password } = req.body;

  // Check password against environment variable
  // In production, use bcrypt.compare()
  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

  if (password === ADMIN_PASSWORD) {
    req.session.isAuthenticated = true;
    return res.json({ success: true, message: 'Login successful' });
  }

  return res.status(401).json({ error: 'Invalid password' });
};

export const logout = (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: 'Logout failed' });
    }
    res.clearCookie('connect.sid'); // Clear session cookie
    return res.json({ success: true, message: 'Logout successful' });
  });
};

export const checkAuth = (req, res) => {
  const isAuthenticated = !!(req.session && req.session.isAuthenticated);
  return res.json({ isAuthenticated });
};
