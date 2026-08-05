/**
 * `subjects` + `subject_assessments`.
 * @typedef {Object} Subject
 * @property {string} id
 * @property {string} user_id
 * @property {string} name
 * @property {string} code
 * @property {string} lecturer_name
 * @property {number} credit_hour
 * @property {boolean} is_visible
 *
 * @typedef {Object} SubjectAssessment
 * @property {string} id
 * @property {string} subject_id
 * @property {'quiz'|'test'|'assignment'|'project'|'presentation'|'final_exam'} type
 * @property {number} percentage
 */
const ASSESSMENT_TYPES = ['quiz', 'test', 'assignment', 'project', 'presentation', 'final_exam'];
module.exports = { ASSESSMENT_TYPES };
