import bcrypt from 'bcrypt';

export const login = async (req, res) => {
  const { password } = req.body;
  const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH;

  if (!ADMIN_PASSWORD_HASH) {
    console.error('ADMIN_PASSWORD_HASH가 설정되지 않았습니다.');
    return res.status(500).json({ error: 'Server misconfiguration' });
  }

  if (typeof password !== 'string' || !password) {
    return res.status(401).json({ error: 'Invalid password' });
  }

  const isMatch = await bcrypt.compare(password, ADMIN_PASSWORD_HASH);

  if (isMatch) {
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
