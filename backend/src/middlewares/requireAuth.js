const { verifyToken } = require('../utils/authToken');

module.exports = function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  const userId = token && verifyToken(token);

  if (!userId) {
    return res.status(401).json({ error: 'Not logged in' });
  }
  req.userId = userId;
  next();
};
