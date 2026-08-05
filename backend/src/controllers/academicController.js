const academicSummaryService = require('../services/academicSummaryService');
const reportService = require('../services/reportService');
const authService = require('../services/authService');
const { getWeekStart } = require('../utils/weekUtils');

async function weeklySummary(req, res) {
  const weekStart = req.query.week || getWeekStart(new Date().toISOString().slice(0, 10));
  const summary = await academicSummaryService.getWeeklySummary(req.userId, weekStart);
  res.json(summary);
}

async function overview(req, res) {
  const data = await academicSummaryService.getOverview(req.userId);
  res.json(data);
}

async function downloadReport(req, res) {
  const weekStart = req.params.weekStart;
  const format = (req.query.format || 'pdf').toLowerCase();

  try {
    const user = await authService.getCurrentUser(req.userId);
    const userName = user?.name || 'Student';

    if (format === 'excel' || format === 'xlsx') {
      const buffer = await reportService.generateExcel(req.userId, weekStart, userName);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="academic-report-${weekStart}.xlsx"`);
      res.send(Buffer.from(buffer));
    } else {
      const buffer = await reportService.generatePdf(req.userId, weekStart, userName);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="academic-report-${weekStart}.pdf"`);
      res.send(buffer);
    }
  } catch (err) {
    console.error('Report generation error:', err.message);
    res.status(500).json({ error: 'Could not generate report' });
  }
}

module.exports = { weeklySummary, overview, downloadReport };
