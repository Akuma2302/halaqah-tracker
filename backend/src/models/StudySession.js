/**
 * `study_sessions` — one row per logged study block within a Sun-Sat week.
 * @typedef {Object} StudySession
 * @property {string} id
 * @property {string} user_id
 * @property {string} subject_id
 * @property {string} week_start  Sunday of the week, "YYYY-MM-DD"
 * @property {string} date
 * @property {string[]} categories  subset of notes/question/project/study_group
 * @property {number} hours  1-24
 */
const STUDY_CATEGORIES = ['notes', 'question', 'project', 'study_group'];
module.exports = { STUDY_CATEGORIES };
