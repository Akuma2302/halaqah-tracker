const studySessionRepository = require('../repositories/studySessionRepository');
const questionPracticeRepository = require('../repositories/questionPracticeRepository');
const consultationRepository = require('../repositories/consultationRepository');
const mentorValidationRepository = require('../repositories/mentorValidationRepository');
const { getWeekStart } = require('../utils/weekUtils');
const {
  serializeStudySession,
  serializeQuestionPractice,
  serializeConsultation,
  serializeMentorValidation
} = require('../utils/serializers');

async function getWeek(userId, weekStart) {
  const [studySessions, questionPractice, consultations, mentorValidation] = await Promise.all([
    studySessionRepository.findForWeek(userId, weekStart),
    questionPracticeRepository.findForWeek(userId, weekStart),
    consultationRepository.findForWeek(userId, weekStart),
    mentorValidationRepository.findForWeek(userId, weekStart)
  ]);

  return {
    weekStart,
    studySessions: studySessions.map(serializeStudySession),
    questionPractice: questionPractice.map(serializeQuestionPractice),
    consultations: consultations.map(serializeConsultation),
    mentorValidation: serializeMentorValidation(mentorValidation, weekStart)
  };
}

async function addStudySession(userId, { subjectId, date, categories, hours }) {
  const weekStart = getWeekStart(date);
  const row = await studySessionRepository.create(userId, { subjectId, weekStart, date, categories, hours });
  return serializeStudySession(row);
}

async function removeStudySession(id, userId) {
  await studySessionRepository.remove(id, userId);
}

async function addQuestionPractice(userId, { subjectId, weekStart, questionCount, isValidated }) {
  const row = await questionPracticeRepository.create(userId, { subjectId, weekStart, questionCount, isValidated });
  return serializeQuestionPractice(row);
}

async function removeQuestionPractice(id, userId) {
  await questionPracticeRepository.remove(id, userId);
}

async function addConsultation(userId, { subjectId, weekStart, lecturerName, detail, date, venue, photoUrl }) {
  const row = await consultationRepository.create(userId, { subjectId, weekStart, lecturerName, detail, date, venue, photoUrl });
  return serializeConsultation(row);
}

async function removeConsultation(id, userId) {
  await consultationRepository.remove(id, userId);
}

async function setMentorValidation(userId, weekStart, { isValidated, validatedDate }) {
  const row = await mentorValidationRepository.upsert(userId, weekStart, { isValidated, validatedDate });
  return serializeMentorValidation(row, weekStart);
}

module.exports = {
  getWeek,
  addStudySession,
  removeStudySession,
  addQuestionPractice,
  removeQuestionPractice,
  addConsultation,
  removeConsultation,
  setMentorValidation
};
