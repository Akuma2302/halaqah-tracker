/**
 * `study_groups` + `study_group_members` + `study_group_schedule`.
 * @typedef {Object} StudyGroup
 * @property {string} id
 * @property {string} name
 * @property {string} subject
 * @property {string} admin_id
 * @property {string} invite_code
 * @property {string} created_at
 * @property {string} updated_at
 *
 * @typedef {Object} ScheduleEntry
 * @property {string} id
 * @property {string} study_group_id
 * @property {string} title
 * @property {string} datetime
 * @property {string} notes
 * @property {boolean} reminded
 */
module.exports = {};
