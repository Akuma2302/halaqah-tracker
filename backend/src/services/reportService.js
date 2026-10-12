const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');
const weeklyLogService = require('./weeklyLogService');
const userRepository = require('../repositories/userRepository');
const subjectRepository = require('../repositories/subjectRepository');
const { serializeUser } = require('../utils/serializers');
const { ASSESSMENT_LABEL, isExam, clock } = require('../utils/assessments');
const { getWeekEnd, addDays } = require('../utils/weekUtils');

// Matches WEEKLY_TARGET_HOURS in frontend/src/features/academic/constants.js.
const WEEKLY_TARGET_HOURS = 10;
const DAY_LETTERS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Colours of the app's light theme.
const GREEN = '#0f6e56';
const GREEN_TINT = '#e3f1ec';
const INK = '#16302b';
const SOFT = '#5d726d';
const LINE = '#dfe6e3';
const PAPER = '#f5f7f6';

function subjectLabel(subject) {
  if (!subject) return 'No subject';
  return subject.code ? `${subject.name} (${subject.code})` : subject.name;
}

// "2026-10-11" -> "Sun, 11 Oct 2026" (or without the year / weekday).
function prettyDate(dateKey, { weekday = true, year = false } = {}) {
  if (!dateKey) return '';
  return new Date(`${dateKey}T00:00:00Z`).toLocaleDateString('en-GB', {
    ...(weekday ? { weekday: 'short' } : {}),
    day: 'numeric',
    month: 'short',
    ...(year ? { year: 'numeric' } : {}),
    timeZone: 'UTC'
  });
}

const hoursText = (h) => `${Math.round(h * 10) / 10}h`;
const titleCase = (s) =>
  String(s || '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());

// Everything the report shows: the week's log, who it is for, and what is due
// in the two weeks after it starts. The extras are best-effort, so a problem
// reading them never stops the report itself.
async function gather(userId, weekStart) {
  const week = await weeklyLogService.getWeek(userId, weekStart);
  const [userRow, subjects] = await Promise.all([
    userRepository.findById(userId).catch(() => null),
    subjectRepository.findVisibleForUser(userId).catch(() => [])
  ]);
  const until = addDays(weekStart, 20);
  const upcoming = subjects
    .flatMap((s) =>
      (s.subject_assessments || [])
        .filter((a) => !a.is_done && a.due_date && a.due_date >= weekStart && a.due_date <= until)
        .map((a) => ({
          label: ASSESSMENT_LABEL[a.type] || a.type,
          exam: isExam(a.type),
          date: a.due_date,
          time: a.due_time ? String(a.due_time).slice(0, 5) : '',
          weight: Number(a.percentage) || 0,
          progress: Number(a.progress_percentage) || 0,
          subject: { name: s.name, code: s.code }
        }))
    )
    .sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`));
  // Who validates the week, to name them beside the signature line.
  const mentorRow = userRow?.mentor_id ? await userRepository.findById(userRow.mentor_id).catch(() => null) : null;
  return { week, user: userRow ? serializeUser(userRow) : null, upcoming, mentorName: mentorRow?.name || '' };
}

// A signature image from storage, for the PDF. Best-effort: a signature that
// can't be fetched in a few seconds is left as a blank line to sign by hand.
async function fetchImage(url) {
  if (!/^https:\/\//.test(url || '')) return null;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch {
    return null;
  }
}

async function generatePdf(userId, weekStart, userName) {
  const { week, user, upcoming, mentorName } = await gather(userId, weekStart);
  // Lecturers' signatures, fetched before drawing starts.
  const signatures = await Promise.all(week.consultations.map((c) => (c.signatureUrl ? fetchImage(c.signatureUrl) : null)));
  const weekEnd = getWeekEnd(weekStart);
  const sessions = [...week.studySessions].sort((a, b) => a.date.localeCompare(b.date));
  const totalHours = sessions.reduce((sum, s) => sum + s.hours, 0);
  const totalQuestions = week.questionPractice.reduce((sum, q) => sum + (q.questionCount || 0), 0);
  const percent = Math.min(100, Math.round((totalHours / WEEKLY_TARGET_HOURS) * 100));
  const validated = !!week.mentorValidation.isValidated;

  const doc = new PDFDocument({ margin: 40, size: 'A4', bufferPages: true });
  const chunks = [];
  doc.on('data', (chunk) => chunks.push(chunk));
  const done = new Promise((resolve) => doc.on('end', () => resolve(Buffer.concat(chunks))));

  const LEFT = 40;
  const WIDTH = doc.page.width - 80;
  const BOTTOM = doc.page.height - 60;

  // Starts a new page when what comes next would not fit.
  const need = (height) => {
    if (doc.y + height > BOTTOM) doc.addPage();
  };

  // ---------- header band ----------
  doc.rect(0, 0, doc.page.width, 96).fill(GREEN);
  doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(20).text('Academic Journal', LEFT, 26);
  doc.font('Helvetica').fontSize(11).fillColor('#cfe7df').text('Weekly report', LEFT, 51);
  doc
    .font('Helvetica-Bold')
    .fontSize(11)
    .fillColor('#ffffff')
    .text(`${prettyDate(weekStart, { weekday: false })} to ${prettyDate(weekEnd, { weekday: false, year: true })}`, LEFT, 30, {
      width: WIDTH,
      align: 'right'
    });
  doc
    .font('Helvetica')
    .fontSize(10)
    .fillColor('#cfe7df')
    .text([userName, user?.memberId, user?.kampus].filter(Boolean).join('  ·  '), LEFT, 48, { width: WIDTH, align: 'right' });
  doc
    .fontSize(9)
    .text('Double 4 Flat', LEFT, 64, { width: WIDTH, align: 'right' });
  doc.y = 116;

  // ---------- the week in four figures ----------
  const tiles = [
    { value: hoursText(totalHours), label: 'Study hours', note: `${percent}% of the ${WEEKLY_TARGET_HOURS}h target` },
    { value: String(sessions.length), label: `Study session${sessions.length === 1 ? '' : 's'}`, note: sessions.length ? 'logged this week' : 'none logged' },
    { value: String(totalQuestions), label: 'Practice questions', note: `${week.questionPractice.length} set${week.questionPractice.length === 1 ? '' : 's'}` },
    { value: String(week.consultations.length), label: `Consultation${week.consultations.length === 1 ? '' : 's'}`, note: week.consultations.length ? 'with a lecturer' : 'none logged' }
  ];
  const gap = 10;
  const tileWidth = (WIDTH - gap * 3) / 4;
  const tilesTop = doc.y;
  tiles.forEach((t, i) => {
    const x = LEFT + i * (tileWidth + gap);
    doc.roundedRect(x, tilesTop, tileWidth, 62, 8).fill(PAPER);
    doc.fillColor(GREEN).font('Helvetica-Bold').fontSize(20).text(t.value, x + 10, tilesTop + 9, { width: tileWidth - 20 });
    doc.fillColor(INK).font('Helvetica-Bold').fontSize(9).text(t.label, x + 10, tilesTop + 34, { width: tileWidth - 20 });
    doc.fillColor(SOFT).font('Helvetica').fontSize(8).text(t.note, x + 10, tilesTop + 46, { width: tileWidth - 20 });
  });
  doc.y = tilesTop + 76;

  // ---------- progress to the target, and mentor validation ----------
  const barTop = doc.y;
  const barWidth = WIDTH - 170;
  doc.fillColor(SOFT).font('Helvetica').fontSize(8.5).text(`PROGRESS TO THE ${WEEKLY_TARGET_HOURS}H WEEKLY TARGET`, LEFT, barTop, { characterSpacing: 0.4 });
  doc.roundedRect(LEFT, barTop + 14, barWidth, 8, 4).fill(LINE);
  if (percent > 0) doc.roundedRect(LEFT, barTop + 14, Math.max(8, (barWidth * percent) / 100), 8, 4).fill(GREEN);
  doc.fillColor(INK).font('Helvetica-Bold').fontSize(9).text(`${hoursText(totalHours)} of ${WEEKLY_TARGET_HOURS}h`, LEFT, barTop + 27);
  // the mentor's stamp, on the right
  const stampX = LEFT + WIDTH - 150;
  doc.roundedRect(stampX, barTop, 150, 38, 8).fill(validated ? GREEN_TINT : PAPER);
  doc
    .fillColor(validated ? GREEN : SOFT)
    .font('Helvetica-Bold')
    .fontSize(9.5)
    .text(validated ? 'Validated by mentor' : 'Not validated yet', stampX + 10, barTop + 8, { width: 130 });
  doc
    .fillColor(SOFT)
    .font('Helvetica')
    .fontSize(8)
    .text(
      validated
        ? week.mentorValidation.validatedDate
          ? `on ${prettyDate(week.mentorValidation.validatedDate, { year: true })}`
          : 'this week'
        : 'Waiting for your mentor',
      stampX + 10,
      barTop + 21,
      { width: 130 }
    );
  doc.y = barTop + 54;

  // ---------- hours for each day, as bars ----------
  const byDay = Array(7).fill(0);
  sessions.forEach((s) => {
    const i = Math.round((new Date(`${s.date}T00:00:00Z`) - new Date(`${weekStart}T00:00:00Z`)) / 86400000);
    if (i >= 0 && i < 7) byDay[i] += s.hours;
  });
  const maxDay = Math.max(1, ...byDay);
  const chartTop = doc.y;
  const chartHeight = 62;
  const colWidth = WIDTH / 7;
  doc.fillColor(SOFT).font('Helvetica').fontSize(8.5).text('HOURS EACH DAY', LEFT, chartTop, { characterSpacing: 0.4 });
  byDay.forEach((h, i) => {
    const x = LEFT + i * colWidth + 8;
    const w = colWidth - 16;
    const baseY = chartTop + 18 + chartHeight;
    doc.roundedRect(x, chartTop + 18, w, chartHeight, 5).fill(PAPER);
    if (h > 0) {
      const barH = Math.max(6, (chartHeight * h) / maxDay);
      doc.roundedRect(x, baseY - barH, w, barH, 5).fill(GREEN);
      doc
        .fillColor(barH > 18 ? '#ffffff' : INK)
        .font('Helvetica-Bold')
        .fontSize(8)
        .text(hoursText(h), x, barH > 18 ? baseY - barH + 5 : baseY - barH - 11, { width: w, align: 'center' });
    }
    doc
      .fillColor(SOFT)
      .font('Helvetica')
      .fontSize(8)
      .text(`${DAY_LETTERS[i]} ${new Date(`${addDays(weekStart, i)}T00:00:00Z`).getUTCDate()}`, x, baseY + 5, { width: w, align: 'center' });
  });
  doc.y = chartTop + 18 + chartHeight + 26;

  // ---------- helpers for the sections below ----------
  const heading = (title, aside) => {
    need(90);
    const y = doc.y;
    doc.rect(LEFT, y + 1, 3, 13).fill(GREEN);
    doc.fillColor(INK).font('Helvetica-Bold').fontSize(12.5).text(title, LEFT + 10, y);
    if (aside) doc.fillColor(SOFT).font('Helvetica').fontSize(9).text(aside, LEFT, y + 2, { width: WIDTH, align: 'right' });
    doc.y = y + 22;
  };

  const emptyLine = (text) => {
    doc.fillColor(SOFT).font('Helvetica-Oblique').fontSize(9.5).text(text, LEFT + 10, doc.y);
    doc.y += 14;
  };

  // A table: a tinted header row, then rows separated by hairlines. `columns`
  // are { label, width (a share of the page), align }.
  const table = (columns, rows) => {
    const widths = columns.map((c) => c.width * WIDTH);
    const xs = widths.map((_, i) => LEFT + widths.slice(0, i).reduce((a, b) => a + b, 0));
    const drawHead = () => {
      const y = doc.y;
      doc.roundedRect(LEFT, y, WIDTH, 18, 4).fill(GREEN_TINT);
      columns.forEach((c, i) => {
        doc
          .fillColor(GREEN)
          .font('Helvetica-Bold')
          .fontSize(8)
          .text(c.label.toUpperCase(), xs[i] + 8, y + 5.5, { width: widths[i] - 16, align: c.align || 'left', characterSpacing: 0.3, lineBreak: false });
      });
      doc.y = y + 22;
    };
    // Keep the header row with at least its first row.
    need(62);
    drawHead();
    rows.forEach((cells) => {
      // The first cell is drawn bold, which is wider, so it is measured bold too.
      const height =
        Math.max(
          ...cells.map((cell, i) =>
            doc
              .font(i === 0 ? 'Helvetica-Bold' : 'Helvetica')
              .fontSize(9.5)
              .heightOfString(String(cell ?? ''), { width: widths[i] - 16 })
          )
        ) + 9;
      if (doc.y + height > BOTTOM) {
        doc.addPage();
        drawHead();
      }
      const y = doc.y;
      cells.forEach((cell, i) => {
        doc
          .fillColor(i === 0 ? INK : SOFT)
          .font(i === 0 ? 'Helvetica-Bold' : 'Helvetica')
          .fontSize(9.5)
          .text(String(cell ?? ''), xs[i] + 8, y + 4, { width: widths[i] - 16, align: columns[i].align || 'left' });
      });
      doc.moveTo(LEFT, y + height).lineTo(LEFT + WIDTH, y + height).lineWidth(0.5).strokeColor(LINE).stroke();
      doc.y = y + height + 1;
    });
  };

  // ---------- study sessions ----------
  heading('Study sessions', `${sessions.length} session${sessions.length === 1 ? '' : 's'} · ${hoursText(totalHours)}`);
  if (!sessions.length) emptyLine('No study sessions were logged this week.');
  else
    table(
      [
        { label: 'Day', width: 0.2 },
        { label: 'Subject', width: 0.42 },
        { label: 'Worked on', width: 0.26 },
        { label: 'Hours', width: 0.12, align: 'right' }
      ],
      sessions.map((s) => [prettyDate(s.date), subjectLabel(s.subject), s.categories.map(titleCase).join(', ') || '–', hoursText(s.hours)])
    );
  doc.y += 14;

  // ---------- practice questions ----------
  heading('Practice questions', `${totalQuestions} question${totalQuestions === 1 ? '' : 's'}`);
  if (!week.questionPractice.length) emptyLine('No practice questions were logged this week.');
  else
    table(
      [
        { label: 'Subject', width: 0.58 },
        { label: 'Checked', width: 0.24 },
        { label: 'Questions', width: 0.18, align: 'right' }
      ],
      week.questionPractice.map((q) => [subjectLabel(q.subject), q.isValidated ? 'Validated' : 'Not validated', String(q.questionCount)])
    );
  doc.y += 14;

  // ---------- lecturer consultations ----------
  heading('Lecturer consultations', `${week.consultations.length} this week`);
  if (!week.consultations.length) emptyLine('No lecturer consultations were logged this week.');
  else
    table(
      [
        { label: 'Lecturer', width: 0.24 },
        { label: 'Subject', width: 0.26 },
        { label: 'When and where', width: 0.22 },
        { label: 'Discussed', width: 0.28 }
      ],
      week.consultations.map((c) => [
        c.lecturerName || c.subject?.lecturerName || 'Lecturer',
        subjectLabel(c.subject),
        [c.date && prettyDate(c.date), c.venue].filter(Boolean).join(', ') || '–',
        c.detail || '–'
      ])
    );
  // A box for each lecturer to sign: their drawn signature if they signed in
  // the app, otherwise an empty line to sign on the printed page.
  if (week.consultations.length) {
    const perRow = 3;
    const boxGap = 10;
    const boxWidth = (WIDTH - boxGap * (perRow - 1)) / perRow;
    const boxHeight = 78;
    // Drawing text moves the cursor, so the row's top is kept here instead.
    let rowY = doc.y + 10;
    week.consultations.forEach((c, i) => {
      const col = i % perRow;
      if (col === 0) {
        if (i > 0) rowY += boxHeight + 8;
        if (rowY + boxHeight > BOTTOM) {
          doc.addPage();
          rowY = doc.y;
        }
      }
      const x = LEFT + col * (boxWidth + boxGap);
      const y = rowY;
      doc.roundedRect(x, y, boxWidth, boxHeight, 6).lineWidth(0.6).strokeColor(LINE).stroke();
      doc.fillColor(SOFT).font('Helvetica').fontSize(7.5).text("LECTURER'S SIGNATURE", x + 8, y + 7, { characterSpacing: 0.3, lineBreak: false });
      let drawn = false;
      if (signatures[i]) {
        try {
          doc.image(signatures[i], x + 8, y + 18, { fit: [boxWidth - 16, 34], align: 'center', valign: 'center' });
          drawn = true;
        } catch {
          // Not an image pdfkit can read: fall back to the empty line.
        }
      }
      doc.moveTo(x + 8, y + 54).lineTo(x + boxWidth - 8, y + 54).lineWidth(0.6).strokeColor(drawn ? LINE : SOFT).stroke();
      doc
        .fillColor(INK)
        .font('Helvetica-Bold')
        .fontSize(8.5)
        .text(c.lecturerName || c.subject?.lecturerName || 'Lecturer', x + 8, y + 58, { width: boxWidth - 16, height: 10, ellipsis: true });
      doc
        .fillColor(SOFT)
        .font('Helvetica')
        .fontSize(7.5)
        .text(c.date ? prettyDate(c.date, { year: true }) : 'Date:', x + 8, y + 68, { width: boxWidth - 16, lineBreak: false });
    });
    doc.y = rowY + boxHeight;
  }
  doc.y += 14;

  // ---------- what is coming up ----------
  heading('Exams and deadlines coming up', 'Within three weeks of this week');
  if (!upcoming.length) emptyLine('Nothing is due in your subjects in this period.');
  else
    table(
      [
        { label: 'Assessment', width: 0.2 },
        { label: 'Subject', width: 0.31 },
        { label: 'Date', width: 0.24 },
        { label: 'Weight', width: 0.11, align: 'right' },
        { label: 'Progress', width: 0.14, align: 'right' }
      ],
      upcoming.map((a) => [
        `${a.label}${a.exam ? ' (exam)' : ''}`,
        subjectLabel(a.subject),
        `${prettyDate(a.date)}${a.time ? `, ${clock(a.time)}` : ''}`,
        a.weight ? `${a.weight}%` : '–',
        `${a.progress}%`
      ])
    );

  // ---------- validated by my mentor: a place to sign ----------
  doc.y += 18;
  need(118);
  heading('Validated by my mentor', validated ? 'Validated in the app' : 'Not validated in the app yet');
  const signTop = doc.y + 2;
  const signWidth = WIDTH * 0.56;
  doc.roundedRect(LEFT, signTop, WIDTH, 84, 8).lineWidth(0.6).strokeColor(LINE).stroke();
  doc
    .fillColor(SOFT)
    .font('Helvetica')
    .fontSize(8.5)
    .text('I have checked this week\'s academic journal with my mentee.', LEFT + 12, signTop + 10, { width: WIDTH - 24 });
  // signature line on the left; name and date on the right
  doc.moveTo(LEFT + 12, signTop + 60).lineTo(LEFT + signWidth, signTop + 60).lineWidth(0.7).strokeColor(SOFT).stroke();
  doc.fillColor(SOFT).font('Helvetica').fontSize(7.5).text("MENTOR'S SIGNATURE", LEFT + 12, signTop + 64, { characterSpacing: 0.3, lineBreak: false });
  const rightX = LEFT + signWidth + 18;
  const rightWidth = WIDTH - signWidth - 30;
  doc.fillColor(SOFT).font('Helvetica').fontSize(7.5).text('NAME', rightX, signTop + 28, { characterSpacing: 0.3, lineBreak: false });
  if (mentorName) doc.fillColor(INK).font('Helvetica-Bold').fontSize(9.5).text(mentorName, rightX + 34, signTop + 26, { width: rightWidth - 34, height: 11, ellipsis: true });
  doc.moveTo(rightX + 34, signTop + 38).lineTo(rightX + rightWidth, signTop + 38).lineWidth(0.5).strokeColor(LINE).stroke();
  doc.fillColor(SOFT).font('Helvetica').fontSize(7.5).text('DATE', rightX, signTop + 52, { characterSpacing: 0.3, lineBreak: false });
  if (validated && week.mentorValidation.validatedDate)
    doc
      .fillColor(INK)
      .font('Helvetica-Bold')
      .fontSize(9.5)
      .text(prettyDate(week.mentorValidation.validatedDate, { year: true }), rightX + 34, signTop + 50, { width: rightWidth - 34, lineBreak: false });
  doc.moveTo(rightX + 34, signTop + 62).lineTo(rightX + rightWidth, signTop + 62).lineWidth(0.5).strokeColor(LINE).stroke();
  doc.y = signTop + 92;

  // ---------- footer on every page ----------
  const pages = doc.bufferedPageRange();
  const generated = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kuala_Lumpur' });
  for (let i = 0; i < pages.count; i += 1) {
    doc.switchToPage(pages.start + i);
    const y = doc.page.height - 42;
    doc.moveTo(LEFT, y).lineTo(LEFT + WIDTH, y).lineWidth(0.5).strokeColor(LINE).stroke();
    // lineBreak off, or text this close to the bottom would start a new page
    doc.fillColor(SOFT).font('Helvetica').fontSize(8);
    doc.text(`Double 4 Flat · Academic Journal · generated ${generated}`, LEFT, y + 8, { lineBreak: false });
    const label = `Page ${i + 1} of ${pages.count}`;
    doc.text(label, LEFT + WIDTH - doc.widthOfString(label), y + 8, { lineBreak: false });
  }

  doc.end();
  return done;
}

async function generateExcel(userId, weekStart, userName) {
  const { week, user, upcoming } = await gather(userId, weekStart);
  const weekEnd = getWeekEnd(weekStart);
  const totalHours = week.studySessions.reduce((sum, s) => sum + s.hours, 0);
  const totalQuestions = week.questionPractice.reduce((sum, q) => sum + (q.questionCount || 0), 0);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Double 4 Flat';

  const headFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F6E56' } };
  // A sheet with a green header row, set column widths and a frozen header.
  const sheet = (name, columns, rows) => {
    const ws = workbook.addWorksheet(name, { views: [{ state: 'frozen', ySplit: 1 }] });
    ws.columns = columns.map(([header, width]) => ({ header, width }));
    const head = ws.getRow(1);
    head.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    head.fill = headFill;
    head.alignment = { vertical: 'middle' };
    head.height = 20;
    rows.forEach((r) => ws.addRow(r));
    ws.eachRow((row, n) => {
      if (n > 1) row.alignment = { vertical: 'top', wrapText: true };
    });
    return ws;
  };

  const summary = workbook.addWorksheet('Summary');
  summary.columns = [{ width: 30 }, { width: 44 }];
  summary.addRow(['Academic Journal — Weekly Report']).font = { bold: true, size: 15, color: { argb: 'FF0F6E56' } };
  summary.addRow([[userName, user?.memberId, user?.kampus].filter(Boolean).join(' · ')]);
  summary.addRow([`${prettyDate(weekStart, { weekday: false })} to ${prettyDate(weekEnd, { weekday: false, year: true })}`]);
  summary.addRow([]);
  [
    ['Study hours', Math.round(totalHours * 10) / 10],
    ['Weekly target (hours)', WEEKLY_TARGET_HOURS],
    ['Share of target', `${Math.min(100, Math.round((totalHours / WEEKLY_TARGET_HOURS) * 100))}%`],
    ['Study sessions', week.studySessions.length],
    ['Practice questions', totalQuestions],
    ['Lecturer consultations', week.consultations.length],
    ['Validated by mentor', week.mentorValidation.isValidated ? `Yes${week.mentorValidation.validatedDate ? ` (${week.mentorValidation.validatedDate})` : ''}` : 'Not yet']
  ].forEach(([label, value]) => {
    const row = summary.addRow([label, value]);
    row.getCell(1).font = { bold: true };
    row.getCell(2).alignment = { horizontal: 'left' };
  });

  sheet(
    'Study hours',
    [
      ['Date', 18],
      ['Subject', 38],
      ['Worked on', 28],
      ['Hours', 10]
    ],
    [...week.studySessions]
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((s) => [prettyDate(s.date, { year: true }), subjectLabel(s.subject), s.categories.map(titleCase).join(', '), s.hours])
  );
  sheet(
    'Practice questions',
    [
      ['Subject', 40],
      ['Questions', 12],
      ['Checked', 16]
    ],
    week.questionPractice.map((q) => [subjectLabel(q.subject), q.questionCount, q.isValidated ? 'Validated' : 'Not validated'])
  );
  sheet(
    'Consultations',
    [
      ['Date', 18],
      ['Lecturer', 26],
      ['Subject', 34],
      ['Venue', 24],
      ['Discussed', 50]
    ],
    week.consultations.map((c) => [
      c.date ? prettyDate(c.date, { year: true }) : '',
      c.lecturerName || c.subject?.lecturerName || '',
      subjectLabel(c.subject),
      c.venue || '',
      c.detail || ''
    ])
  );
  sheet(
    'Coming up',
    [
      ['Assessment', 20],
      ['Kind', 10],
      ['Subject', 36],
      ['Date', 18],
      ['Time', 12],
      ['Weight %', 10],
      ['Progress %', 12]
    ],
    upcoming.map((a) => [a.label, a.exam ? 'Exam' : 'Due', subjectLabel(a.subject), prettyDate(a.date, { year: true }), a.time ? clock(a.time) : '', a.weight, a.progress])
  );

  return workbook.xlsx.writeBuffer();
}

module.exports = { generatePdf, generateExcel };
