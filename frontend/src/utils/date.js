// Returns YYYY-MM-DD for a Date, matching the format the backend stores mutabaah entries under.
export function toDateKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}
