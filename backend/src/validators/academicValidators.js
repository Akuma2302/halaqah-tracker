const { z } = require('zod');
const { ASSESSMENT_TYPES } = require('../models/Subject');
const { STUDY_CATEGORIES } = require('../models/StudySession');

const assessmentSchema = z.object({
  type: z.enum(ASSESSMENT_TYPES),
  percentage: z.number().min(0).max(100),
  dueDate: z.string().nullish(),
  progressPercentage: z.number().min(0).max(100).optional(),
  isDone: z.boolean().optional()
});

const createSubjectSchema = z.object({
  name: z.string().trim().min(1, 'Subject name is required'),
  code: z.string().trim().optional(),
  lecturerName: z.string().trim().optional(),
  creditHour: z.number().min(0).max(20).optional(),
  assessments: z.array(assessmentSchema).optional()
});

const updateSubjectSchema = createSubjectSchema.partial().extend({
  isVisible: z.boolean().optional()
});

const createAssignmentSchema = z.object({
  subjectId: z.string().uuid().nullish(),
  title: z.string().trim().min(1, 'Title is required'),
  type: z.enum(['assignment', 'project']).optional(),
  dueDate: z.string().nullish()
});

const updateAssignmentSchema = createAssignmentSchema.partial().extend({
  isDone: z.boolean().optional()
});

const createStudySessionSchema = z.object({
  subjectId: z.string().uuid().nullish(),
  date: z.string().min(1, 'Date is required'),
  categories: z.array(z.enum(STUDY_CATEGORIES)).optional(),
  hours: z.number().min(1).max(24)
});

const createQuestionPracticeSchema = z.object({
  subjectId: z.string().uuid().nullish(),
  weekStart: z.string().min(1, 'Week is required'),
  questionCount: z.number().int().min(0),
  isValidated: z.boolean().optional()
});

const createConsultationSchema = z.object({
  subjectId: z.string().uuid().nullish(),
  weekStart: z.string().min(1, 'Week is required'),
  lecturerName: z.string().trim().optional(),
  detail: z.string().trim().optional(),
  date: z.string().nullish(),
  venue: z.string().trim().optional(),
  photoUrl: z.string().trim().optional()
});

const setMentorValidationSchema = z.object({
  isValidated: z.boolean(),
  validatedDate: z.string().nullish()
});

module.exports = {
  createSubjectSchema,
  updateSubjectSchema,
  createAssignmentSchema,
  updateAssignmentSchema,
  createStudySessionSchema,
  createQuestionPracticeSchema,
  createConsultationSchema,
  setMentorValidationSchema
};
