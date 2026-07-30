const authService = require('../services/authService');
const { serializeUser } = require('../utils/serializers');

async function googleLogin(req, res) {
  try {
    const user = await authService.loginWithGoogle(req.body.credential);
    req.session.userId = user.id;
    res.json(serializeUser(user));
  } catch (err) {
    console.error('Google auth error:', err.message);
    res.status(401).json({ error: 'Google sign-in failed' });
  }
}

async function me(req, res) {
  const user = await authService.getCurrentUser(req.session.userId);
  if (!user) return res.status(401).json({ error: 'Not logged in' });
  res.json(serializeUser(user));
}

async function updateMe(req, res) {
  const user = await authService.updateProfile(req.session.userId, req.body);
  res.json(serializeUser(user));
}

function logout(req, res) {
  req.session.destroy(() => {
    res.clearCookie('connect.sid');
    res.json({ ok: true });
  });
}

module.exports = { googleLogin, me, updateMe, logout };
