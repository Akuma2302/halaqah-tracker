const authService = require('../services/authService');
const { signToken } = require('../utils/authToken');
const { serializeUser } = require('../utils/serializers');
const { isAdmin } = require('../utils/accountState');

// The signed-in user's own record, with whether they may open the admin dashboard.
const serializeMe = (user) => ({ ...serializeUser(user), isAdmin: isAdmin(user) });

async function googleLogin(req, res) {
  let user;
  try {
    user = await authService.loginWithGoogle(req.body.credential);
  } catch (err) {
    console.error('Google auth error:', err.message);
    return res.status(401).json({ error: 'Google sign-in failed' });
  }
  if (user.suspended_at) {
    return res.status(403).json({ error: 'This account has been suspended. Contact the admin.', suspended: true });
  }
  res.json({ user: serializeMe(user), token: signToken(user.id) });
}

async function me(req, res) {
  const user = await authService.getCurrentUser(req.userId);
  if (!user) return res.status(401).json({ error: 'Not logged in' });
  res.json(serializeMe(user));
}

async function updateMe(req, res) {
  const user = await authService.updateProfile(req.userId, req.body);
  res.json(serializeMe(user));
}

function logout(req, res) {
  // Stateless tokens — there's nothing to invalidate server-side. The
  // frontend just deletes its stored token; this endpoint exists for
  // symmetry (and a future denylist, if ever needed).
  res.json({ ok: true });
}

module.exports = { googleLogin, me, updateMe, logout };
