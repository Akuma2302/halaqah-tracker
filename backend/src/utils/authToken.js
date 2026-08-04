const jwt = require('jsonwebtoken');

// Bearer tokens instead of cookies. This matters specifically because the
// frontend (Netlify) and backend (Render) are different domains — iOS Safari
// (and every WebKit browser on iOS) blocks third-party cookies by default
// regardless of SameSite settings, which silently broke every authenticated
// request there. A token sent via the Authorization header isn't a cookie at
// all, so none of Safari's cross-site cookie rules apply to it.
const EXPIRES_IN = '30d';

function signToken(userId) {
  return jwt.sign({ userId }, process.env.SESSION_SECRET, { expiresIn: EXPIRES_IN });
}

function verifyToken(token) {
  try {
    const payload = jwt.verify(token, process.env.SESSION_SECRET);
    return payload.userId;
  } catch {
    return null;
  }
}

module.exports = { signToken, verifyToken };
