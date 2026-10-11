const { verifyToken } = require('../utils/authToken');
const accountState = require('../utils/accountState');

module.exports = function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  const userId = token && verifyToken(token);

  if (!userId) {
    return res.status(401).json({ error: 'Not logged in' });
  }
  // An account an admin has switched off is signed out everywhere.
  if (accountState.isSuspended(userId)) {
    return res.status(403).json({ error: 'This account has been suspended. Contact the admin.', suspended: true });
  }
  req.userId = userId;
  accountState.touch(userId);
  next();
};
