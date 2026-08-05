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
 * @property {number} percentage  weightage toward the final grade
 * @property {string} due_date
 * @property {number} progress_percentage  how much of this assessment is done, 0-100
 * @property {boolean} is_done
 */
const ASSESSMENT_TYPES = ['quiz', 'test', 'assignment', 'project', 'presentation', 'final_exam'];
module.exports = { ASSESSMENT_TYPES };
