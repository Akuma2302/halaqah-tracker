const { OAuth2Client } = require('google-auth-library');
const userRepository = require('../repositories/userRepository');

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

async function loginWithGoogle(credential) {
  const ticket = await client.verifyIdToken({ idToken: credential, audience: process.env.GOOGLE_CLIENT_ID });
  const payload = ticket.getPayload();

  let user = await userRepository.findByGoogleId(payload.sub);
  if (!user) {
    user = await userRepository.create({
      googleId: payload.sub,
      email: payload.email,
      name: payload.name,
      avatarUrl: payload.picture || ''
    });
  }
  return user;
}

async function getCurrentUser(userId) {
  return userRepository.findById(userId);
}

async function updateProfile(userId, { name, kampus }) {
  const updates = {};
  if (typeof name === 'string' && name.trim()) updates.name = name.trim();
  if (typeof kampus === 'string') updates.kampus = kampus.trim();
  return userRepository.update(userId, updates);
}

module.exports = { loginWithGoogle, getCurrentUser, updateProfile };
