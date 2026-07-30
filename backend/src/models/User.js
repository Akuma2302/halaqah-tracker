/**
 * Shape of a row in the `users` table (see backend/supabase/schema.sql).
 * Data access lives in repositories/userRepository.js — this file just
 * documents the schema so controllers/services know what to expect.
 *
 * @typedef {Object} User
 * @property {string} id
 * @property {string} google_id
 * @property {string} email
 * @property {string} name
 * @property {string} kampus
 * @property {string} avatar_url
 * @property {string} created_at
 * @property {string} updated_at
 */
module.exports = {};
