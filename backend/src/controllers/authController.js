const authService = require('../services/authService');
const { signToken } = require('../utils/authToken');
const { serializeUser } = require('../utils/serializers');

async function googleLogin(req, res) {
  try {
    const user = await authService.loginWithGoogle(req.body.credential);
    const token = signToken(user.id);
    res.json({ user: serializeUser(user), token });
  } catch (err) {
    console.error('Google auth error:', err.message);
    res.status(401).json({ error: 'Google sign-in failed' });
  }
}

async function me(req, res) {
  const user = await authService.getCurrentUser(req.userId);
  if (!user) return res.status(401).json({ error: 'Not logged in' });
  res.json(serializeUser(user));
}

async function updateMe(req, res) {
  const user = await authService.updateProfile(req.userId, req.body);
  res.json(serializeUser(user));
}

function logout(req, res) {
  // Stateless tokens — there's nothing to invalidate server-side. The
  // frontend just deletes its stored token; this endpoint exists for
  // symmetry (and a future denylist, if ever needed).
  res.json({ ok: true });
}

module.exports = { googleLogin, me, updateMe, logout };
