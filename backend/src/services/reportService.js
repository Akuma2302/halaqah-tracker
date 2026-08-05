const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');
const weeklyLogService = require('./weeklyLogService');
const { getWeekEnd } = require('../utils/weekUtils');

function subjectLabel(subject) {
  if (!subject) return '—';
  return subject.code ? `${subject.name} (${subject.code})` : subject.name;
}

async function generatePdf(userId, weekStart, userName) {
  const week = await weeklyLogService.getWeek(userId, weekStart);
  const weekEnd = getWeekEnd(weekStart);
  const totalHours = week.studySessions.reduce((sum, s) => sum + s.hours, 0);

  const doc = new PDFDocument({ margin: 40, size: 'A4' });
  const chunks = [];
  doc.on('data', (chunk) => chunks.push(chunk));
  const done = new Promise((resolve) => doc.on('end', () => resolve(Buffer.concat(chunks))));

  doc.fontSize(18).font('Helvetica-Bold').text('Academic Journal — Weekly Report');
  doc.fontSize(10).font('Helvetica').fillColor('#555').text(`${userName} · ${weekStart} to ${weekEnd}`);
  doc.moveDown(1);

  doc.fillColor('#000').fontSize(13).font('Helvetica-Bold').text(`Study Hours — ${totalHours.toFixed(1)} hrs this week`);
  doc.moveDown(0.3);
  doc.fontSize(10).font('Helvetica');
  if (!week.studySessions.length) {
    doc.text('No study sessions logged this week.');
  }
  week.studySessions.forEach((s) => {
    doc.text(`${s.date}  ·  ${subjectLabel(s.subject)}  ·  ${s.hours}h  ·  ${s.categories.join(', ') || '—'}`);
  });
  doc.moveDown(1);

  doc.fontSize(13).font('Helvetica-Bold').text('Question Practice');
  doc.moveDown(0.3);
  doc.fontSize(10).font('Helvetica');
  if (!week.questionPractice.length) {
    doc.text('No question practice logged this week.');
  }
  week.questionPractice.forEach((q) => {
    doc.text(`${subjectLabel(q.subject)}  ·  ${q.questionCount} questions  ·  ${q.isValidated ? 'Validated' : 'Not validated'}`);
  });
  doc.moveDown(1);

  doc.fontSize(13).font('Helvetica-Bold').text('Lecturer Consultations');
  doc.moveDown(0.3);
  doc.fontSize(10).font('Helvetica');
  if (!week.consultations.length) {
    doc.text('No consultations logged this week.');
  }
  week.consultations.forEach((c) => {
    doc.text(`${c.date || '—'}  ·  ${subjectLabel(c.subject)}  ·  ${c.lecturerName || '—'}  ·  ${c.venue || '—'}`);
    if (c.detail) doc.fillColor('#555').text(`  ${c.detail}`, { indent: 10 }).fillColor('#000');
  });
  doc.moveDown(1);

  doc.fontSize(13).font('Helvetica-Bold').text('Mentor Validation');
  doc.moveDown(0.3);
  doc.fontSize(10).font('Helvetica');
  doc.text(
    week.mentorValidation.isValidated
      ? `Validated on ${week.mentorValidation.validatedDate}`
      : 'Not yet validated this week.'
  );

  doc.end();
  return done;
}

async function generateExcel(userId, weekStart, userName) {
  const week = await weeklyLogService.getWeek(userId, weekStart);
  const weekEnd = getWeekEnd(weekStart);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Mutabaah Academic Journal';

  const summarySheet = workbook.addWorksheet('Summary');
  summarySheet.addRow(['Academic Journal — Weekly Report']);
  summarySheet.addRow([userName, `${weekStart} to ${weekEnd}`]);
  summarySheet.addRow([]);
  const totalHours = week.studySessions.reduce((sum, s) => sum + s.hours, 0);
  summarySheet.addRow(['Total study hours', totalHours]);
  summarySheet.addRow(['Mentor validated', week.mentorValidation.isValidated ? 'Yes' : 'No']);
  summarySheet.getRow(1).font = { bold: true, size: 14 };

  const studySheet = workbook.addWorksheet('Study Hours');
  studySheet.addRow(['Date', 'Subject', 'Hours', 'Categories']).font = { bold: true };
  week.studySessions.forEach((s) => {
    studySheet.addRow([s.date, subjectLabel(s.subject), s.hours, s.categories.join(', ')]);
  });

  const questionSheet = workbook.addWorksheet('Question Practice');
  questionSheet.addRow(['Subject', 'Question Count', 'Validated']).font = { bold: true };
  week.questionPractice.forEach((q) => {
    questionSheet.addRow([subjectLabel(q.subject), q.questionCount, q.isValidated ? 'Yes' : 'No']);
  });

  const consultSheet = workbook.addWorksheet('Consultations');
  consultSheet.addRow(['Date', 'Subject', 'Lecturer', 'Venue', 'Detail']).font = { bold: true };
  week.consultations.forEach((c) => {
    consultSheet.addRow([c.date, subjectLabel(c.subject), c.lecturerName, c.venue, c.detail]);
  });

  return workbook.xlsx.writeBuffer();
}

module.exports = { generatePdf, generateExcel };
