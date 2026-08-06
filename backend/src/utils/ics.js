// Hand-rolled .ics (iCalendar) generator — deliberately no external
// dependency, since the format is simple and well-specified (RFC 5545).
// Works with Google Calendar, Apple Calendar, Outlook, anything.

function pad(n) {
  return String(n).padStart(2, '0');
}

// Formats a JS Date as a UTC iCalendar timestamp: YYYYMMDDTHHMMSSZ
function toIcsDate(date) {
  return (
    `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}` +
    `T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`
  );
}

// Escapes text per RFC 5545 (commas, semicolons, backslashes, newlines)
function escapeText(text = '') {
  return String(text).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

function buildIcsEvent({ id, title, description, location, start, durationMinutes = 60 }) {
  const startDate = new Date(start);
  const endDate = new Date(startDate.getTime() + durationMinutes * 60 * 1000);
  const now = new Date();

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Mutabaah Halaqah Tracker//Study Group Session//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${id}@halaqah-tracker`,
    `DTSTAMP:${toIcsDate(now)}`,
    `DTSTART:${toIcsDate(startDate)}`,
    `DTEND:${toIcsDate(endDate)}`,
    `SUMMARY:${escapeText(title)}`
  ];
  if (description) lines.push(`DESCRIPTION:${escapeText(description)}`);
  if (location) lines.push(`LOCATION:${escapeText(location)}`);
  lines.push('END:VEVENT', 'END:VCALENDAR');

  return lines.join('\r\n');
}

module.exports = { buildIcsEvent };