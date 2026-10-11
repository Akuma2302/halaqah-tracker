const userRepository = require('../repositories/userRepository');
const { isAdmin } = require('../utils/accountState');

// After requireAuth: lets the request through only for an admin account.
module.exports = async function requireAdmin(req, res, next) {
  try {
    const user = await userRepository.findById(req.userId);
    if (!isAdmin(user)) return res.status(403).json({ error: 'Admins only' });
    req.adminUser = user;
    next();
  } catch (err) {
    next(err);
  }
};
