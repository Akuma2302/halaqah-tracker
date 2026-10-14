import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, BookOpen, CalendarDays, ChevronLeft, ChevronRight, Clock, MapPin, Pencil, Plus, Search, Tag, Trash2, UserPlus, Users, X } from 'lucide-react';
import client from '../services/apiClient';
import Sheet from '../components/Sheet';
import { useToast } from '../hooks/useToast';
import { useAuth } from '../hooks/useAuth';
import HomeScreenShortcut from '../features/timetable/HomeScreenShortcut';
import TypeMenu from '../features/timetable/TypeMenu';
import { DateMenu, SelectMenu, TimeMenu } from '../components/pickers';
import {
  CLASS_KINDS,
  DAYS,
  MAX_REMINDERS,
  MAX_REMINDER_MINUTES,
  REMINDER_UNITS,
  SHORT_DAYS,
  TASK_KINDS,
  clock,
  hueFor,
  kindLabel,
  minutes,
  reminderMinutes,
  reminderParts,
  reminderText
} from '../features/timetable/timetable';
import { ASSESSMENT_LABEL, dueLabel, formatDueDate, isExam } from '../features/academic/deadlines';
import { addDays, toDateKey } from '../features/academic/weekUtils';

function duration(mins) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h && m ? `${h}h ${m}m` : h ? `${h}h` : `${m} min`;
}

function nameOf(entry) {
  return entry.title || entry.subject?.name || kindLabel(entry);
}

const dateOf = (key) => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
};
// "Wed, 14 Oct"
const shortDay = (key) => dateOf(key).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
// "Wednesday, 14 October"
const longDay = (key) => dateOf(key).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
const weekdayOf = (key) => dateOf(key).getDay();
// The next date (from today) that falls on a weekday.
const nextDateOn = (weekday) => {
  const d = new Date();
  return toDateKey(addDays(d, (weekday - d.getDay() + 7) % 7));
};

// The repeat menu's choice in words.
function repeatText(f, custom) {
  const choice = repeatOf(f, custom);
  if (choice === 'weekly') return `Weekly on ${f.startDate ? DAYS[weekdayOf(f.startDate)] : 'this day'}`;
  return { none: 'Does not repeat', daily: 'Daily', weekdays: 'Every weekday', custom: 'Custom' }[choice];
}

// Whether an entry happens on a date: a weekly one may have been deleted on
// that date, or ended before it.
function occursOn(entry, dateKey) {
  if (entry.startDate) return true;
  return !(entry.skipDates || []).includes(dateKey) && (!entry.repeatUntil || dateKey <= entry.repeatUntil);
}

// The date and time of one event, as the details card shows it.
function occurrenceText(entry, dateKey) {
  const from = clock(entry.startTime);
  const to = clock(entry.endTime);
  if (!entry.startDate) return `${longDay(dateKey)} · ${from} – ${to}`;
  const end = entry.endDate || entry.startDate;
  return end === entry.startDate ? `${longDay(entry.startDate)} · ${from} – ${to}` : `${longDay(entry.startDate)}, ${from} – ${longDay(end)}, ${to}`;
}

// How the form repeats, as the repeat menu shows it.
function repeatOf(f, custom) {
  if (f.repeat === 'once') return 'none';
  if (custom) return 'custom';
  const days = [...f.days].sort().join();
  if (days === '0,1,2,3,4,5,6') return 'daily';
  if (days === '1,2,3,4,5') return 'weekdays';
  if (f.days.length === 1 && f.days[0] === weekdayOf(f.startDate)) return 'weekly';
  return 'custom';
}

// When an entry happens, in words: every week, on one day, or across several.
function whenText(entry) {
  const from = clock(entry.startTime);
  const to = clock(entry.endTime);
  if (!entry.startDate) return `${DAYS[entry.dayOfWeek]}s, ${from} to ${to}`;
  const end = entry.endDate || entry.startDate;
  return end === entry.startDate ? `${shortDay(entry.startDate)}, ${from} to ${to}` : `${shortDay(entry.startDate)} ${from} to ${shortDay(end)} ${to}`;
}

// "d4f8", "8" or "D4F-0008" -> "D4F-0008"; null when it isn't a User ID.
function tidyMemberId(input) {
  const digits = String(input || '')
    .trim()
    .replace(/^d4f[-\s]*/i, '');
  return /^\d{1,9}$/.test(digits) ? `D4F-${digits.padStart(4, '0')}` : null;
}

// `repeat` is 'weekly' (on chosen days, every week) or 'once' (from one date
// and time to another). `reminders` are { n, unit } rows.
function emptyForm(day, date) {
  return {
    subjectId: '',
    title: '',
    kind: 'study',
    customKind: '',
    repeat: 'weekly',
    days: [day],
    startDate: date,
    endDate: date,
    startTime: '09:00',
    endTime: '10:00',
    venue: '',
    people: [],
    reminders: []
  };
}

// Weekly class timetable: a day at a time or the whole week, with what's on
// now and what's next today. Classes are added and edited in a sheet.
export default function Timetable() {
  const [entries, setEntries] = useState(null);
  const [subjects, setSubjects] = useState([]);
  const [error, setError] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const [day, setDay] = useState(() => new Date().getDay());
  const [view, setView] = useState('day');
  // Month view: the month on show (its first day) and the date picked in it.
  const [monthStart, setMonthStart] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [pickedDate, setPickedDate] = useState(() => toDateKey(new Date()));

  const [editing, setEditing] = useState(null); // null = closed, 'new', or the entry being edited
  const [form, setForm] = useState(() => emptyForm(1, toDateKey(new Date())));
  // My own task types, kept in my account and offered beside the built-in ones.
  const [myKinds, setMyKinds] = useState([]);
  const [newKind, setNewKind] = useState(null); // null = not adding; otherwise what is typed
  // Finding people to add: what is typed, and who it matches.
  const [found, setFound] = useState([]);
  const [searching, setSearching] = useState(false);
  const searchSeq = useRef(0);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  // The repeat menu's "Custom…" (pick the days), and a one-off that ends on a later day.
  const [customDays, setCustomDays] = useState(false);
  const [endApart, setEndApart] = useState(false);
  const [idInput, setIdInput] = useState('');
  // Someone else's task I was added to, open to look at (it can't be edited).
  const [viewing, setViewing] = useState(null);
  // The date the open entry was tapped on (a weekly entry happens on many).
  const [viewDate, setViewDate] = useState(null);
  // Asking before a delete: { entry, date, recurring, scope }.
  const [askDel, setAskDel] = useState(null);
  const [toast, showToast] = useToast();
  const { user } = useAuth();

  function load() {
    setError(false);
    client
      .get('/timetable')
      .then((res) => setEntries(res.data))
      .catch(() => setError(true));
  }

  useEffect(() => {
    load();
    client
      .get('/academic/subjects')
      .then((res) => setSubjects(res.data))
      .catch(() => setSubjects([]));
    client
      .get('/timetable/kinds')
      .then((res) => setMyKinds(Array.isArray(res.data) ? res.data : []))
      .catch(() => setMyKinds([]));
  }, []);

  // Look people up as the box is typed in: by User ID, or by two or more letters of a name.
  useEffect(() => {
    const q = idInput.trim();
    if (!editing || (q.length < 2 && !tidyMemberId(q))) {
      setFound([]);
      setSearching(false);
      return undefined;
    }
    const seq = (searchSeq.current += 1);
    setSearching(true);
    const timer = setTimeout(() => {
      client
        .get('/timetable/people', { params: { q } })
        .then((res) => seq === searchSeq.current && setFound(Array.isArray(res.data) ? res.data : []))
        .catch(() => seq === searchSeq.current && setFound([]))
        .finally(() => seq === searchSeq.current && setSearching(false));
    }, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idInput, !!editing]);

  // Keep "now" fresh so the current / next class moves on by itself.
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);

  const today = now.getDay();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  // Classes of a subject hidden in Subjects are left out here.
  const shown = useMemo(() => (entries || []).filter((e) => e.subject?.isVisible !== false), [entries]);

  // What repeats every week, by weekday.
  const weekly = useMemo(() => shown.filter((e) => !e.startDate), [shown]);
  const byDay = useMemo(() => {
    const groups = DAYS.map(() => []);
    weekly.forEach((e) => groups[e.dayOfWeek]?.push(e));
    groups.forEach((g) => g.sort((a, b) => a.startTime.localeCompare(b.startTime)));
    return groups;
  }, [weekly]);

  // The date each weekday falls on in the coming seven days (the day and week views).
  const weekDates = useMemo(() => DAYS.map((_, d) => toDateKey(addDays(dateOf(toDateKey(now)), (d - now.getDay() + 7) % 7))), [now]);
  // The weekly entries on a weekday, leaving out a date they were deleted on.
  const onDay = (d, dateKey) => byDay[d].filter((e) => occursOn(e, dateKey));

  // One-off events, on every date they cover (an event can run over several days).
  const eventsByDate = useMemo(() => {
    const map = {};
    shown
      .filter((e) => e.startDate)
      .forEach((e) => {
        const end = e.endDate || e.startDate;
        let day = dateOf(e.startDate);
        for (let i = 0; i < 62 && toDateKey(day) <= end; i += 1) {
          (map[toDateKey(day)] ||= []).push(e);
          day = addDays(day, 1);
        }
      });
    Object.values(map).forEach((list) => list.sort((a, b) => a.startTime.localeCompare(b.startTime)));
    return map;
  }, [shown]);

  // Dated things from the subjects, still to come, soonest first: quizzes,
  // tests and final exams, and any assessment task given a date and a time.
  const todayKey = toDateKey(now);
  const exams = useMemo(
    () =>
      subjects
        .filter((s) => s.isVisible !== false)
        .flatMap((s) =>
          (s.assessments || []).flatMap((a, i) => {
            const items = [];
            if (isExam(a.type) && a.dueDate && !a.isDone && a.dueDate >= todayKey) {
              items.push({
                id: a._id || `${s._id}-${i}`,
                type: a.type,
                date: a.dueDate,
                time: a.dueTime || '',
                topics: a.focusTopics || '',
                progress: Number(a.progressPercentage) || 0,
                subject: s
              });
            }
            (a.tasks || []).forEach((t, j) => {
              if (!t.isDone && !a.isDone && t.dueDate && t.dueTime && t.dueDate >= todayKey) {
                items.push({ id: `${a._id || `${s._id}-${i}`}-task-${j}`, task: t.title, type: a.type, date: t.dueDate, time: t.dueTime, subject: s });
              }
            });
            return items;
          })
        )
        .sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`)),
    [subjects, todayKey]
  );

  // Everything with a date, for the month view: exams, due dates and tasks,
  // whether or not they have a time. Finished ones are left out.
  const datedByDate = useMemo(() => {
    const map = {};
    const add = (item) => (map[item.date] ||= []).push(item);
    subjects
      .filter((s) => s.isVisible !== false)
      .forEach((s) =>
        (s.assessments || []).forEach((a, i) => {
          if (a.isDone) return;
          const id = a._id || `${s._id}-${i}`;
          if (a.dueDate) {
            add({
              id: `m-${id}`,
              kind: isExam(a.type) ? 'exam' : 'due',
              type: a.type,
              date: a.dueDate,
              time: a.dueTime || '',
              topics: a.focusTopics || '',
              progress: Number(a.progressPercentage) || 0,
              subject: s
            });
          }
          (a.tasks || []).forEach((t, j) => {
            if (!t.isDone && t.dueDate) add({ id: `m-${id}-task-${j}`, kind: 'task', task: t.title, type: a.type, date: t.dueDate, time: t.dueTime || '', subject: s });
          });
        })
      );
    Object.values(map).forEach((list) => list.sort((a, b) => (a.time || '00:00').localeCompare(b.time || '00:00')));
    return map;
  }, [subjects]);

  // The weeks of the month on show, Sunday first; days outside it are null.
  const monthCells = useMemo(() => {
    const lead = monthStart.getDay();
    const count = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0).getDate();
    const cells = Array(lead).fill(null);
    for (let d = 1; d <= count; d += 1) cells.push(toDateKey(new Date(monthStart.getFullYear(), monthStart.getMonth(), d)));
    while (cells.length % 7) cells.push(null);
    return cells;
  }, [monthStart]);

  const shiftMonth = (n) => setMonthStart((m) => new Date(m.getFullYear(), m.getMonth() + n, 1));
  const goToToday = () => {
    setMonthStart(new Date(now.getFullYear(), now.getMonth(), 1));
    setPickedDate(todayKey);
  };
  const pickedWeekday = (() => {
    const [y, m, d] = pickedDate.split('-').map(Number);
    return new Date(y, m - 1, d).getDay();
  })();

  // One-off events still to come (or going on now), soonest first.
  const upcomingEvents = useMemo(
    () =>
      shown
        .filter((e) => e.startDate && (e.endDate || e.startDate) >= todayKey)
        .sort((a, b) => `${a.startDate}${a.startTime}`.localeCompare(`${b.startDate}${b.startTime}`)),
    [shown, todayKey]
  );

  // One-off events in the next 7 days, by weekday, to sit with that day's classes.
  const eventsByDay = useMemo(() => {
    const groups = DAYS.map(() => []);
    for (let i = 0; i < 7; i += 1) {
      const day = addDays(dateOf(todayKey), i);
      groups[day.getDay()] = eventsByDate[toDateKey(day)] || [];
    }
    return groups;
  }, [eventsByDate, todayKey]);

  // The ones in the next 7 days, by weekday, so they sit with that day's classes.
  const examsByDay = useMemo(() => {
    const groups = DAYS.map(() => []);
    const [y, m, d] = todayKey.split('-').map(Number);
    const limit = toDateKey(addDays(new Date(y, m - 1, d), 6));
    exams
      .filter((x) => x.date <= limit)
      .forEach((x) => {
        const [ey, em, ed] = x.date.split('-').map(Number);
        groups[new Date(ey, em - 1, ed).getDay()].push(x);
      });
    return groups;
  }, [exams, todayKey]);

  // Today: the class in progress, and the next one still to start.
  // (A one-off event counts on the day it starts and ends on the same day.)
  const todays = useMemo(
    () =>
      [...onDay(today, todayKey), ...(eventsByDate[todayKey] || []).filter((e) => e.startDate === todayKey && (e.endDate || e.startDate) === todayKey)].sort((a, b) =>
        a.startTime.localeCompare(b.startTime)
      ),
    [byDay, eventsByDate, today, todayKey]
  );
  const current = todays.find((e) => minutes(e.startTime) <= nowMinutes && nowMinutes < minutes(e.endTime));
  const next = todays.find((e) => minutes(e.startTime) > nowMinutes);

  // Adding from the month view starts as a one-off event on the day picked there.
  function openNew(forDay = day) {
    const fromMonth = view === 'month';
    setForm({ ...emptyForm(fromMonth ? pickedWeekday : forDay, fromMonth ? pickedDate : nextDateOn(forDay)), repeat: fromMonth ? 'once' : 'weekly' });
    setFormError('');
    setCustomDays(false);
    setEndApart(false);
    setIdInput('');
    setNewKind(null);
    setEditing('new');
  }

  function openEdit(entry) {
    if (entry.shared || entry.fromGroup) return setViewing(entry);
    setIdInput('');
    setNewKind(null);
    setForm({
      people: (entry.participants || []).map((p) => ({ memberId: p.memberId, name: p.name })),
      subjectId: entry.subject?._id || '',
      title: entry.title || '',
      kind: entry.kind || 'lecture',
      customKind: entry.customKind || '',
      repeat: entry.startDate ? 'once' : 'weekly',
      days: [entry.dayOfWeek],
      // A weekly one shows the next date it falls on.
      startDate: entry.startDate || nextDateOn(entry.dayOfWeek),
      endDate: entry.endDate || entry.startDate || nextDateOn(entry.dayOfWeek),
      startTime: entry.startTime,
      endTime: entry.endTime,
      venue: entry.venue || '',
      reminders: (entry.reminders || []).map(reminderParts)
    });
    setFormError('');
    setCustomDays(false);
    setEndApart(!!entry.endDate && entry.endDate !== entry.startDate);
    setEditing(entry);
  }

  // Other classes that overlap what's in the form (same day, times crossing).
  const clashes = useMemo(() => {
    // Only weekly entries are checked against each other.
    if (!editing || form.repeat === 'once' || !form.startTime || !form.endTime || form.endTime <= form.startTime) return [];
    return weekly.filter(
      (e) =>
        e._id !== editing?._id &&
        form.days.includes(e.dayOfWeek) &&
        minutes(e.startTime) < minutes(form.endTime) &&
        minutes(form.startTime) < minutes(e.endTime)
    );
  }, [editing, form, weekly]);

  // Put someone found by the search on this task.
  function addPerson(person) {
    setFormError('');
    setIdInput('');
    setFound([]);
    setForm((f) => (f.people.some((p) => p.memberId === person.memberId) ? f : { ...f, people: [...f.people, { memberId: person.memberId, name: person.name }] }));
  }

  // Keep my own types in my account, then use the new one for this task.
  async function saveKinds(kinds, pick) {
    setMyKinds(kinds);
    if (pick !== undefined) setForm((f) => ({ ...f, kind: 'other', customKind: pick }));
    try {
      const res = await client.put('/timetable/kinds', { kinds });
      setMyKinds(res.data);
    } catch {
      showToast("Couldn't save your types. They are kept for this task only.");
    }
  }

  function addKind() {
    const name = (newKind || '').trim().slice(0, 30);
    if (!name) return;
    setNewKind(null);
    // A built-in type typed by name just selects it.
    const builtIn = TASK_KINDS.find(([value, label]) => value !== 'other' && label.toLowerCase() === name.toLowerCase());
    if (builtIn) return setForm((f) => ({ ...f, kind: builtIn[0], customKind: '' }));
    const existing = myKinds.find((k) => k.toLowerCase() === name.toLowerCase());
    if (existing) return setForm((f) => ({ ...f, kind: 'other', customKind: existing }));
    saveKinds([...myKinds, name], name);
  }

  function removeKind(name) {
    saveKinds(myKinds.filter((k) => k !== name));
    setForm((f) => (f.customKind === name ? { ...f, kind: 'other', customKind: '' } : f));
  }

  // The date picked: a one-off moves to it; "weekly on" follows its weekday.
  function pickDate(value) {
    if (!value) return;
    setForm((f) => {
      const next = { ...f, startDate: value, endDate: !endApart || f.endDate < value ? value : f.endDate };
      if (repeatOf(f, customDays) === 'weekly') next.days = [weekdayOf(value)];
      return next;
    });
  }

  function pickRepeat(value) {
    setCustomDays(value === 'custom');
    setForm((f) => {
      if (value === 'none') return { ...f, repeat: 'once', endDate: f.endDate < f.startDate ? f.startDate : f.endDate };
      const days = { daily: [0, 1, 2, 3, 4, 5, 6], weekdays: [1, 2, 3, 4, 5], weekly: [weekdayOf(f.startDate)] }[value] || f.days;
      return { ...f, repeat: 'weekly', days };
    });
  }

  // A time picker. Moving the start keeps the length, as a calendar does;
  // the end lists only later times, unless it ends on another day.
  const timeBox = (key, label) => (
    <TimeMenu
      value={form[key]}
      ariaLabel={label}
      align={key === 'endTime' ? 'end' : 'start'}
      from={key === 'endTime' && !(form.repeat === 'once' && endApart) ? form.startTime : undefined}
      onChange={(t) =>
        setForm((f) => {
          if (key !== 'startTime') return { ...f, endTime: t };
          if (f.repeat === 'once' && endApart) return { ...f, startTime: t };
          const len = minutes(f.endTime) - minutes(f.startTime);
          const end = Math.min(minutes(t) + (len > 0 ? len : 60), 24 * 60 - 1);
          return { ...f, startTime: t, endTime: `${String(Math.floor(end / 60)).padStart(2, '0')}:${String(end % 60).padStart(2, '0')}` };
        })
      }
    />
  );

  const setReminder = (i, change) => setForm((f) => ({ ...f, reminders: f.reminders.map((r, j) => (j === i ? { ...r, ...change } : r)) }));

  // The details card for an entry, on the date it was tapped.
  function openDetail(entry, date) {
    setViewing(entry);
    setViewDate(date || entry.startDate || nextDateOn(entry.dayOfWeek));
  }

  function askToDelete(entry, date) {
    setAskDel({
      entry,
      date: date || entry.startDate || nextDateOn(entry.dayOfWeek),
      // Only the owner of a weekly entry chooses which events go.
      recurring: !entry.startDate && !entry.shared,
      scope: 'this'
    });
  }

  // Delete after asking: the whole entry, or (weekly) one date or that date onwards.
  async function confirmDelete() {
    const { entry, date, recurring, scope } = askDel;
    const whole = !recurring || scope === 'all';
    const dayBefore = toDateKey(addDays(dateOf(date), -1));
    setAskDel(null);
    setViewing(null);
    setEditing(null);
    setEntries((list) =>
      whole
        ? list.filter((e) => e._id !== entry._id)
        : list.map((e) =>
            e._id !== entry._id ? e : scope === 'this' ? { ...e, skipDates: [...(e.skipDates || []), date] } : { ...e, repeatUntil: !e.repeatUntil || dayBefore < e.repeatUntil ? dayBefore : e.repeatUntil }
          )
    );
    try {
      await client.delete(`/timetable/${entry._id}`, { params: whole ? {} : { scope, date } });
      showToast(entry.shared ? 'Removed from your timetable' : whole ? 'Deleted' : scope === 'this' ? `Deleted on ${shortDay(date)}` : `Deleted from ${shortDay(date)} onwards`);
    } catch {
      showToast("Couldn't delete it.");
      load();
    }
  }

  // Escape closes the question, not the sheet under it.
  useEffect(() => {
    if (!askDel) return undefined;
    const esc = (e) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      setAskDel(null);
    };
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [askDel]);


  async function save() {
    const once = form.repeat === 'once';
    if (!form.subjectId && !form.title.trim()) return setFormError('Choose a subject or give it a name.');
    if (idInput.trim()) return setFormError('Pick the person from the list under the search box, or clear the box.');
    if (newKind !== null && newKind.trim()) return setFormError('Tap Add to keep the new type, or clear it.');
    if (!form.startTime || !form.endTime) return setFormError('Set the start and end time.');
    if (once) {
      if (!form.startDate || !form.endDate) return setFormError('Set the start and end date.');
      if (form.endDate < form.startDate) return setFormError('The end date must not be before the start date.');
      if (form.endDate === form.startDate && form.endTime <= form.startTime) return setFormError('The end time must be after the start time.');
    } else {
      if (!form.days.length) return setFormError('Choose at least one day.');
      if (form.endTime <= form.startTime) return setFormError('The end time must be after the start time.');
    }
    const reminders = form.reminders.map(reminderMinutes);
    if (reminders.some((m) => !Number.isFinite(m) || m < 0)) return setFormError('Each reminder needs a number.');
    if (reminders.some((m) => m > MAX_REMINDER_MINUTES)) return setFormError('A reminder can be at most 4 weeks before.');

    setSaving(true);
    setFormError('');
    const body = (dayOfWeek) => ({
      subjectId: form.subjectId || null,
      title: form.title.trim(),
      kind: form.kind,
      customKind: form.kind === 'other' ? form.customKind : '',
      // A one-off event is placed by its dates; a weekly one by its weekday.
      ...(once ? { startDate: form.startDate, endDate: form.endDate } : { dayOfWeek, startDate: null, endDate: null }),
      startTime: form.startTime,
      endTime: form.endTime,
      venue: form.venue.trim(),
      reminders,
      memberIds: form.people.map((p) => p.memberId)
    });
    // After saving a one-off event, show the month on its date.
    const showDate = (dateKey) => {
      const d = dateOf(dateKey);
      setMonthStart(new Date(d.getFullYear(), d.getMonth(), 1));
      setPickedDate(dateKey);
      setView('month');
    };
    try {
      if (editing === 'new') {
        // One class per chosen day (e.g. the same lecture on Monday and Wednesday).
        const created = [];
        for (const d of once ? [null] : [...form.days].sort()) created.push((await client.post('/timetable', body(d))).data);
        setEntries((list) => [...(list || []), ...created]);
        if (once) showDate(created[0].startDate);
        // Stay on the day being viewed if the class was added there too.
        else if (!created.some((c) => c.dayOfWeek === day)) setDay(created[0].dayOfWeek);
        showToast(created.length > 1 ? `Added on ${created.length} days` : once ? 'Added to your calendar' : 'Added to your timetable');
      } else {
        const res = await client.put(`/timetable/${editing._id}`, body(form.days[0]));
        setEntries((list) => list.map((e) => (e._id === res.data._id ? res.data : e)));
        if (res.data.startDate) showDate(res.data.startDate);
        else setDay(res.data.dayOfWeek);
        showToast('Updated');
      }
      setEditing(null);
    } catch (err) {
      setFormError(err.response?.data?.error || "Couldn't save. Please try again.");
      if (editing === 'new') load(); // some days may have been saved before the failure
    } finally {
      setSaving(false);
    }
  }



  function toggleDay(d) {
    setForm((f) => {
      // Editing moves one class; adding can repeat it on several days.
      if (editing !== 'new') return { ...f, days: [d] };
      const days = f.days.includes(d) ? f.days.filter((x) => x !== d) : [...f.days, d];
      return { ...f, days };
    });
  }

  function ClassCard({ entry, showState, on }) {
    const start = minutes(entry.startTime);
    const end = minutes(entry.endTime);
    const isNow = showState && entry.dayOfWeek === today && start <= nowMinutes && nowMinutes < end;
    const isPast = showState && entry.dayOfWeek === today && end <= nowMinutes;
    return (
      <button
        type="button"
        className={`class-card${isNow ? ' now' : ''}${isPast ? ' past' : ''}`}
        style={{ '--hue': hueFor(entry.subject?.name || entry.title) }}
        onClick={() => openDetail(entry, on)}
      >
        <span className="class-time">
          <strong>{clock(entry.startTime)}</strong>
          <span>{clock(entry.endTime)}</span>
        </span>
        <span className="class-body">
          <span className="class-name">
            {nameOf(entry)}
            {isNow && <span className="badge badge-gold">Now</span>}
          </span>
          <span className="class-meta">
            {[entry.subject?.code, kindLabel(entry), duration(end - start)].filter(Boolean).join(' · ')}
            {entry.reminders?.length > 0 && (
              <span className="class-bell" title={entry.reminders.map(reminderText).join(', ')}>
                <Bell size={10} /> {entry.reminders.length}
              </span>
            )}
          </span>
          {(entry.venue || entry.subject?.lecturerName) && (
            <span className="class-meta">
              {entry.venue && (
                <>
                  <MapPin size={11} /> {entry.venue}
                </>
              )}
              {entry.venue && entry.subject?.lecturerName ? ' · ' : ''}
              {entry.subject?.lecturerName}
            </span>
          )}
          {entry.fromGroup ? (
            <span className="class-meta class-people">
              <Users size={11} /> Mentoring group{entry.shared && entry.owner ? ` · ${entry.owner.name}` : ''}
            </span>
          ) : entry.shared ? (
            <span className="class-meta class-people">
              <Users size={11} /> Added by {entry.owner?.name || 'someone'}
            </span>
          ) : (
            entry.participants?.length > 0 && (
              <span className="class-meta class-people">
                <Users size={11} /> With {entry.participants.map((p) => p.name.split(' ')[0]).join(', ')}
              </span>
            )
          )}
        </span>
      </button>
    );
  }

  // A one-off event, on one of the days it covers (`on`): its start time on
  // its first day, "until" on its last, all day in between.
  function EventCard({ entry, on }) {
    const end = entry.endDate || entry.startDate;
    const single = end === entry.startDate;
    const isNow = single && entry.startDate === todayKey && minutes(entry.startTime) <= nowMinutes && nowMinutes < minutes(entry.endTime);
    const over = end < todayKey || (end === todayKey && minutes(entry.endTime) <= nowMinutes);
    const first = !on || on === entry.startDate;
    return (
      <button
        type="button"
        className={`class-card event-card${isNow ? ' now' : ''}${over ? ' past' : ''}`}
        style={{ '--hue': hueFor(entry.subject?.name || entry.title) }}
        onClick={() => openDetail(entry, on || entry.startDate)}
      >
        <span className="class-time">
          <strong>{first ? clock(entry.startTime) : on === end ? 'Until' : 'All day'}</strong>
          <span>{first ? (single ? clock(entry.endTime) : formatDueDate(entry.startDate)) : on === end ? clock(entry.endTime) : formatDueDate(on)}</span>
        </span>
        <span className="class-body">
          <span className="class-name">
            {nameOf(entry)}
            {isNow && <span className="badge badge-gold">Now</span>}
          </span>
          <span className="class-meta">
            {[kindLabel(entry), single ? shortDay(entry.startDate) : `${shortDay(entry.startDate)} to ${shortDay(end)}`].join(' · ')}
            {entry.reminders?.length > 0 && (
              <span className="class-bell" title={entry.reminders.map(reminderText).join(', ')}>
                <Bell size={10} /> {entry.reminders.length}
              </span>
            )}
          </span>
          {entry.venue && (
            <span className="class-meta">
              <MapPin size={11} /> {entry.venue}
            </span>
          )}
          {entry.fromGroup ? (
            <span className="class-meta class-people">
              <Users size={11} /> Mentoring group{entry.shared && entry.owner ? ` · ${entry.owner.name}` : ''}
            </span>
          ) : entry.shared ? (
            <span className="class-meta class-people">
              <Users size={11} /> Added by {entry.owner?.name || 'someone'}
            </span>
          ) : (
            entry.participants?.length > 0 && (
              <span className="class-meta class-people">
                <Users size={11} /> With {entry.participants.map((p) => p.name.split(' ')[0]).join(', ')}
              </span>
            )
          )}
        </span>
      </button>
    );
  }

  // An exam, or a timed task towards an assessment, on its date. Read-only
  // here: tapping it opens the subject, where it is edited.
  function ExamCard({ exam }) {
    const due = dueLabel(exam.date);
    const label = ASSESSMENT_LABEL[exam.type] || exam.type;
    const kind = exam.kind || (exam.task ? 'task' : 'exam');
    return (
      <Link to={`/subject-list?edit=${exam.subject._id}`} className={`class-card static dated ${kind === 'exam' ? 'exam' : 'task'}`}>
        <span className="class-time">
          <strong>{exam.time ? clock(exam.time) : 'All day'}</strong>
          <span>{formatDueDate(exam.date)}</span>
        </span>
        <span className="class-body">
          <span className="class-name">
            {exam.task || label}
            <span className={`badge ${kind === 'exam' ? 'badge-gold' : 'badge-primary'}`}>{kind === 'exam' ? 'Exam' : kind === 'due' ? 'Due' : 'Task'}</span>
          </span>
          <span className="class-meta">{[exam.task ? `For ${label}` : '', exam.subject.name, exam.subject.code].filter(Boolean).join(' · ')}</span>
          <span className="class-meta">
            {due.text.replace(/^due /, '')}
            {kind === 'task' ? '' : ` · ${exam.progress}% ${kind === 'exam' ? 'revised' : 'done'}`}
          </span>
          {exam.topics && <span className="class-meta exam-topics">Focus: {exam.topics}</span>}
        </span>
      </Link>
    );
  }

  const total = shown.length;
  const weeklyTotal = weekly.length;
  const isClassKind = CLASS_KINDS.some(([value]) => value === form.kind);
  // Who else is on a task someone added me to (not me).
  const others = (viewing?.participants || []).filter((x) => x._id !== user?._id);

  return (
    <div className="page timetable">
      <div className="page-header">
        <div>
          <h1 className="page-title">Timetable</h1>
          <p className="page-subtitle">
            {entries && total
              ? [weeklyTotal ? `${weeklyTotal} a week` : '', upcomingEvents.length ? `${upcomingEvents.length} dated event${upcomingEvents.length === 1 ? '' : 's'} coming up` : '']
                  .filter(Boolean)
                  .join(' · ') || 'Your classes, tasks and events'
              : 'Your classes, tasks and events'}
          </p>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => openNew()}>
          <Plus size={14} /> Add task
        </button>
      </div>

      {error ? (
        <div className="card empty-state">
          <h3>Couldn't load your timetable</h3>
          <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={load}>
            Try again
          </button>
        </div>
      ) : !entries ? (
        <div className="spinner" style={{ margin: '24px auto', display: 'block' }} />
      ) : total === 0 && exams.length === 0 ? (
        <div className="card empty-state">
          <CalendarDays size={28} style={{ color: 'var(--primary)' }} />
          <h3>No classes yet</h3>
          <p>Add your lectures, tutorials and halaqah so you can see your week at a glance.</p>
          <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={() => openNew()}>
            <Plus size={14} /> Add your first task
          </button>
        </div>
      ) : (
        <>
          {/* ---------- today: now and next ---------- */}
          <div className={`card now-card${current ? ' live' : ''}`}>
            <span className="now-icon">
              <Clock size={18} />
            </span>
            <div className="now-body">
              {current ? (
                <>
                  <div className="now-label">Happening now</div>
                  <div className="now-title">{nameOf(current)}</div>
                  <div className="now-meta">
                    Ends at {clock(current.endTime)} · {duration(minutes(current.endTime) - nowMinutes)} left
                    {current.venue ? ` · ${current.venue}` : ''}
                  </div>
                  {next && (
                    <div className="now-meta">
                      Then {nameOf(next)} at {clock(next.startTime)}
                    </div>
                  )}
                </>
              ) : next ? (
                <>
                  <div className="now-label">Next today</div>
                  <div className="now-title">{nameOf(next)}</div>
                  <div className="now-meta">
                    {clock(next.startTime)} · in {duration(minutes(next.startTime) - nowMinutes)}
                    {next.venue ? ` · ${next.venue}` : ''}
                  </div>
                </>
              ) : (
                <>
                  <div className="now-label">Today</div>
                  <div className="now-title">{todays.length ? 'No more classes today' : 'No classes today'}</div>
                  <div className="now-meta">{todays.length ? `${todays.length} done` : `It's ${DAYS[today]}`}</div>
                </>
              )}
            </div>
          </div>

          <div className="range-toggle segmented timetable-view">
            <button className={view === 'day' ? 'active' : ''} onClick={() => setView('day')}>
              Day
            </button>
            <button className={view === 'week' ? 'active' : ''} onClick={() => setView('week')}>
              Week
            </button>
            <button className={view === 'month' ? 'active' : ''} onClick={() => setView('month')}>
              Month
            </button>
          </div>

          {view === 'day' ? (
            <>
              <div className="day-tabs" role="tablist" aria-label="Day of the week">
                {SHORT_DAYS.map((label, d) => (
                  <button
                    key={label}
                    type="button"
                    role="tab"
                    aria-selected={d === day}
                    className={`day-tab${d === day ? ' selected' : ''}${d === today ? ' today' : ''}`}
                    onClick={() => setDay(d)}
                  >
                    <span>{label}</span>
                    <small>{onDay(d, weekDates[d]).length + examsByDay[d].length + eventsByDay[d].length || '·'}</small>
                  </button>
                ))}
              </div>

              {onDay(day, weekDates[day]).length + examsByDay[day].length + eventsByDay[day].length === 0 ? (
                <div className="card class-empty">
                  <p>No classes on {DAYS[day]}.</p>
                  <button className="btn btn-ghost btn-sm" onClick={() => openNew(day)}>
                    <Plus size={13} /> Add a task
                  </button>
                </div>
              ) : (
                <div className="class-list">
                  {examsByDay[day].map((x) => (
                    <ExamCard key={x.id} exam={x} />
                  ))}
                  {eventsByDay[day].map((e) => (
                    <EventCard key={e._id} entry={e} on={toDateKey(addDays(dateOf(todayKey), (day - today + 7) % 7))} />
                  ))}
                  {onDay(day, weekDates[day]).map((e) => (
                    <ClassCard key={e._id} entry={e} showState on={weekDates[day]} />
                  ))}
                </div>
              )}
            </>
          ) : view === 'week' ? (
            DAYS.map((label, d) =>
              onDay(d, weekDates[d]).length + examsByDay[d].length + eventsByDay[d].length ? (
                <section key={label} className="week-group">
                  <h2 className={`week-group-title${d === today ? ' today' : ''}`}>
                    {label}
                    {d === today && <span className="badge badge-primary">Today</span>}
                    <small>
                      {onDay(d, weekDates[d]).length} class{onDay(d, weekDates[d]).length === 1 ? '' : 'es'}
                    </small>
                  </h2>
                  <div className="class-list">
                    {examsByDay[d].map((x) => (
                      <ExamCard key={x.id} exam={x} />
                    ))}
                    {eventsByDay[d].map((e) => (
                      <EventCard key={e._id} entry={e} on={toDateKey(addDays(dateOf(todayKey), (d - today + 7) % 7))} />
                    ))}
                    {onDay(d, weekDates[d]).map((e) => (
                      <ClassCard key={e._id} entry={e} showState on={weekDates[d]} />
                    ))}
                  </div>
                </section>
              ) : null
            )
          ) : (
            <>
              {/* ---------- a month at a time ---------- */}
              <div className="card month-card">
                <div className="month-head">
                  <button type="button" className="icon-btn" onClick={() => shiftMonth(-1)} aria-label="Previous month">
                    <ChevronLeft size={16} />
                  </button>
                  <div className="month-title">
                    <strong>{monthStart.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</strong>
                    {(monthStart.getMonth() !== now.getMonth() || monthStart.getFullYear() !== now.getFullYear() || pickedDate !== todayKey) && (
                      <button type="button" className="week-bar-today" onClick={goToToday}>
                        Back to today
                      </button>
                    )}
                  </div>
                  <button type="button" className="icon-btn" onClick={() => shiftMonth(1)} aria-label="Next month">
                    <ChevronRight size={16} />
                  </button>
                </div>
                <div className="month-grid" role="grid" aria-label="Month">
                  {SHORT_DAYS.map((label) => (
                    <span key={label} className="month-weekday">
                      {label[0]}
                    </span>
                  ))}
                  {monthCells.map((dateKey, i) => {
                    if (!dateKey) return <span key={`blank-${i}`} />;
                    const dated = datedByDate[dateKey] || [];
                    const classes = onDay(i % 7, dateKey).length + (eventsByDate[dateKey] || []).length;
                    return (
                      <button
                        key={dateKey}
                        type="button"
                        className={`month-day${dateKey === todayKey ? ' today' : ''}${dateKey === pickedDate ? ' picked' : ''}${dateKey < todayKey ? ' past' : ''}`}
                        onClick={() => setPickedDate(dateKey)}
                        aria-pressed={dateKey === pickedDate}
                        aria-label={`${dateKey}: ${classes} classes, ${dated.length} dated`}
                      >
                        <span>{Number(dateKey.slice(8))}</span>
                        <i>
                          {classes > 0 && <b className="dot-class" />}
                          {dated.some((x) => x.kind === 'exam') && <b className="dot-exam" />}
                          {dated.some((x) => x.kind !== 'exam') && <b className="dot-task" />}
                        </i>
                      </button>
                    );
                  })}
                </div>
                <div className="month-legend">
                  <span>
                    <b className="dot-class" /> Class or task
                  </span>
                  <span>
                    <b className="dot-exam" /> Exam
                  </span>
                  <span>
                    <b className="dot-task" /> Due date
                  </span>
                </div>
              </div>

              <h2 className={`week-group-title month-day-title${pickedDate === todayKey ? ' today' : ''}`}>
                {(() => {
                  const [y, m, d] = pickedDate.split('-').map(Number);
                  return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
                })()}
                {pickedDate === todayKey && <span className="badge badge-primary">Today</span>}
              </h2>
              {(datedByDate[pickedDate] || []).length + onDay(pickedWeekday, pickedDate).length + (eventsByDate[pickedDate] || []).length === 0 ? (
                <div className="card class-empty">
                  <p>Nothing on this day.</p>
                  <button className="btn btn-ghost btn-sm" onClick={() => openNew()}>
                    <Plus size={13} /> Add an event
                  </button>
                </div>
              ) : (
                <div className="class-list">
                  {(datedByDate[pickedDate] || []).map((x) => (
                    <ExamCard key={x.id} exam={x} />
                  ))}
                  {(eventsByDate[pickedDate] || []).map((e) => (
                    <EventCard key={e._id} entry={e} on={pickedDate} />
                  ))}
                  {onDay(pickedWeekday, pickedDate).map((e) => (
                    <ClassCard key={e._id} entry={e} showState={pickedDate === todayKey} on={pickedDate} />
                  ))}
                </div>
              )}
            </>
          )}

          {/* ---------- every exam still to come, from the subjects ---------- */}
          {view !== 'month' && exams.length + upcomingEvents.length > 0 && (
            <section className="week-group exam-list">
              <h2 className="week-group-title">
                Coming up
                <small>Your dated events, and exams and timed tasks from your subjects</small>
              </h2>
              <div className="class-list">
                {upcomingEvents.map((e) => (
                  <EventCard key={e._id} entry={e} />
                ))}
                {exams.map((x) => (
                  <ExamCard key={x.id} exam={x} />
                ))}
              </div>
            </section>
          )}
        </>
      )}

      {/* ---------- add / edit a class ---------- */}
      <HomeScreenShortcut />

      <Sheet open={!!editing} onClose={() => setEditing(null)} title={editing === 'new' ? 'Add task' : isClassKind ? 'Edit class' : 'Edit task'}>
        <div className="entry-form gc-form">
          <input
            className="gc-title"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            placeholder={form.subjectId ? 'Add title (optional)' : 'Add title'}
            aria-label="Title"
            maxLength={80}
          />

          {/* ---------- the type: built-in ones, then my own, and a way to add one ---------- */}
          <div className="gc-row">
            <Tag size={18} className="gc-icon" />
            <div className="gc-body">
              {/* Classes are set on the subject; one made earlier keeps its own kind here. A plain "Other" only shows for one saved that way. */}
              <TypeMenu
                value={form.kind === 'other' ? (form.customKind ? `my:${form.customKind}` : 'other') : form.kind}
                options={[
                  ...[
                    ...CLASS_KINDS.filter(([v]) => v === form.kind),
                    ...TASK_KINDS.filter(([v]) => v !== 'other' || (form.kind === 'other' && !form.customKind))
                  ].map(([v, label]) => ({ value: v, label })),
                  // My own types, and one this task already has that I have since removed
                  ...[...new Set([...myKinds, ...(form.kind === 'other' && form.customKind ? [form.customKind] : [])])].map((name) => ({
                    value: `my:${name}`,
                    label: name,
                    mine: myKinds.includes(name)
                  }))
                ]}
                onPick={(v) => {
                  setNewKind(null);
                  if (v.startsWith('my:')) setForm((f) => ({ ...f, kind: 'other', customKind: v.slice(3) }));
                  else setForm((f) => ({ ...f, kind: v, customKind: '' }));
                }}
                onNew={() => setNewKind('')}
                onRemove={removeKind}
                canAdd={myKinds.length < 12}
              />
            {newKind !== null && (
              <div className="tt-person-row tt-kind-row">
                <input
                  className="input"
                  value={newKind}
                  onChange={(e) => setNewKind(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addKind();
                    }
                  }}
                  placeholder="Your own type, e.g. Gym, Usrah"
                  maxLength={30}
                  aria-label="Your own type"
                  autoFocus
                />
                <button type="button" className="btn btn-ghost" onClick={addKind} disabled={!newKind.trim()}>
                  Add
                </button>
                <button type="button" className="icon-btn" onClick={() => setNewKind(null)} aria-label="Cancel">
                  <X size={14} />
                </button>
              </div>
            )}
            </div>
          </div>

          {/* ---------- when: the date, from and to, and how it repeats ---------- */}
          <div className="gc-row">
            <Clock size={18} className="gc-icon" />
            <div className="gc-body">
              {/* Over several days: a line for the start and a line for the end. Otherwise the date, then from and to. */}
              {form.repeat === 'once' && endApart ? (
                <div className="gc-when gc-span">
                  <div className="gc-span-line">
                    <DateMenu value={form.startDate} onChange={pickDate} ariaLabel="Start date">
                      <span>{longDay(form.startDate)}</span>
                    </DateMenu>
                    {timeBox('startTime', 'Starts at')}
                  </div>
                  <div className="gc-span-line">
                    <DateMenu value={form.endDate} min={form.startDate} onChange={(d) => setForm((f) => ({ ...f, endDate: d }))} ariaLabel="End date">
                      <span>{longDay(form.endDate)}</span>
                    </DateMenu>
                    {timeBox('endTime', 'Ends at')}
                  </div>
                </div>
              ) : (
                <div className="gc-when">
                  <DateMenu value={form.startDate} onChange={pickDate} ariaLabel={form.repeat === 'once' ? 'Date' : 'Starting on'}>
                    <span>{form.startDate ? longDay(form.startDate) : 'Pick a date'}</span>
                  </DateMenu>
                  <span className="gc-times">
                    {timeBox('startTime', 'Starts at')}
                    <span className="gc-dash">–</span>
                    {timeBox('endTime', 'Ends at')}
                  </span>
                </div>
              )}
              <div className="gc-when-more">
                {isClassKind ? (
                  <span className="gc-note">Weekly on {DAYS[form.days[0]]}. Class times are set in Subjects.</span>
                ) : (
                  <SelectMenu
                    look="text"
                    ariaLabel="Repeat"
                    value={repeatOf(form, customDays)}
                    display={repeatText(form, customDays)}
                    onChange={pickRepeat}
                    options={[
                      { value: 'none', label: 'Does not repeat' },
                      ...(editing === 'new' ? [{ value: 'daily', label: 'Daily' }] : []),
                      { value: 'weekly', label: `Weekly on ${form.startDate ? DAYS[weekdayOf(form.startDate)] : 'this day'}` },
                      ...(editing === 'new'
                        ? [
                            { value: 'weekdays', label: 'Every weekday (Monday to Friday)' },
                            { value: 'custom', label: 'Custom…' }
                          ]
                        : [])
                    ]}
                  />
                )}
                {form.repeat === 'once' && !endApart && (
                  <button type="button" className="gc-link" onClick={() => setEndApart(true)}>
                    Ends on another day
                  </button>
                )}
                {form.repeat === 'once' && endApart && (
                  <button
                    type="button"
                    className="gc-link"
                    onClick={() => {
                      setEndApart(false);
                      setForm((f) => ({ ...f, endDate: f.startDate }));
                    }}
                  >
                    Same day
                  </button>
                )}
              </div>
              {repeatOf(form, customDays) === 'custom' && (
                <div className="chip-row gc-days">
                  {SHORT_DAYS.map((label, d) => (
                    <button key={label} type="button" className={`chip${form.days.includes(d) ? ' on' : ''}`} onClick={() => toggleDay(d)} aria-pressed={form.days.includes(d)}>
                      {label}
                    </button>
                  ))}
                </div>
              )}
              {editing === 'new' && form.repeat === 'weekly' && form.days.length > 1 && (
                <p className="gc-note">Added as {form.days.length} weekly times, one on each day.</p>
              )}
            </div>
          </div>

          {/* ---------- subject ---------- */}
          {subjects.length > 0 && (
            <div className="gc-row">
              <BookOpen size={18} className="gc-icon" />
              <div className="gc-body">
                <SelectMenu
                  ariaLabel="Subject"
                  value={form.subjectId}
                  onChange={(v) => setForm((f) => ({ ...f, subjectId: v }))}
                  options={[
                    { value: '', label: 'No subject' },
                    ...subjects
                      .filter((s) => s.isVisible !== false || s._id === form.subjectId)
                      .map((s) => ({ value: s._id, label: s.code ? `${s.name} (${s.code})` : s.name }))
                  ]}
                />
              </div>
            </div>
          )}

          {/* ---------- guests: other users, found by name or User ID ---------- */}
          <div className="gc-row">
            <Users size={18} className="gc-icon" />
            <div className="gc-body">
                <label className="perf-search tt-people-search">
                  <Search size={15} />
                  <input
                    id="tt-person"
                    type="search"
                    value={idInput}
                    onChange={(e) => setIdInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        if (found.length === 1) addPerson(found[0]);
                      }
                    }}
                    placeholder="Add guests: name or User ID"
                    autoCorrect="off"
                    autoComplete="off"
                  />
                  {idInput && (
                    <button type="button" onClick={() => setIdInput('')} aria-label="Clear">
                      <X size={13} />
                    </button>
                  )}
                </label>
                {idInput.trim() && (
                  <div className="tt-found" role="listbox" aria-label="People found">
                    {searching && found.length === 0 ? (
                      <p>Searching…</p>
                    ) : found.length === 0 ? (
                      <p>{idInput.trim().length < 2 && !tidyMemberId(idInput) ? 'Type at least 2 letters of a name, or a User ID.' : 'Nobody found. Check the name or User ID.'}</p>
                    ) : (
                      found.map((x) => {
                        const added = form.people.some((q) => q.memberId === x.memberId);
                        return (
                          <button type="button" key={x._id} role="option" aria-selected={added} className="tt-found-row" onClick={() => addPerson(x)} disabled={added}>
                            <span className="avatar mentor-avatar-letter" style={{ '--hue': hueFor(x.name) }}>
                              {(x.name || '?').trim()[0]?.toUpperCase()}
                            </span>
                            <span className="tt-found-text">
                              <strong>{x.name}</strong>
                              <small>{[x.memberId, x.kampus].filter(Boolean).join(' · ')}</small>
                            </span>
                            <span className="tt-found-add">{added ? 'Added' : 'Add'}</span>
                          </button>
                        );
                      })
                    )}
                  </div>
                )}
                {form.people.length > 0 && (
                  <div className="tt-people">
                    {form.people.map((p) => (
                      <span className="tt-person" key={p.memberId}>
                        {p.name ? `${p.name} · ${p.memberId}` : p.memberId}
                        <button
                          type="button"
                          onClick={() => setForm((f) => ({ ...f, people: f.people.filter((x) => x.memberId !== p.memberId) }))}
                          aria-label={`Remove ${p.name || p.memberId}`}
                        >
                          <X size={12} />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              {form.people.length > 0 && <p className="gc-note">It appears in their timetable too, and they get a notification.</p>}
            </div>
          </div>

          {/* ---------- location ---------- */}
          <div className="gc-row">
            <MapPin size={18} className="gc-icon" />
            <div className="gc-body">
              <input
                id="tt-venue"
                className="input gc-plain"
                value={form.venue}
                onChange={(e) => setForm((f) => ({ ...f, venue: e.target.value }))}
                placeholder="Add location"
                aria-label="Location"
                maxLength={80}
              />
            </div>
          </div>

          {/* ---------- notifications: as many as wanted, each any length before ---------- */}
          <div className="gc-row">
            <Bell size={18} className="gc-icon" />
            <div className="gc-body">
                {form.reminders.map((r, i) => (
                  <div className="tt-reminder" key={i}>
                    <input
                      className="input"
                      type="number"
                      inputMode="numeric"
                      min="0"
                      value={r.n}
                      onChange={(e) => setReminder(i, { n: e.target.value })}
                      aria-label="How long before"
                    />
                    <SelectMenu
                      look="box"
                      ariaLabel="Unit"
                      value={r.unit}
                      onChange={(unit) => setReminder(i, { unit })}
                      options={REMINDER_UNITS.map(([key, word]) => ({ value: key, label: `${word} before` }))}
                    />
                    <button
                      type="button"
                      className="icon-btn"
                      onClick={() => setForm((f) => ({ ...f, reminders: f.reminders.filter((_, j) => j !== i) }))}
                      aria-label="Remove this reminder"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
                {form.reminders.length < MAX_REMINDERS && (
                  <button
                    type="button"
                    className="gc-link tt-reminder-add"
                    onClick={() =>
                      setForm((f) => ({
                        ...f,
                        // A sensible next one: 10 minutes, then an hour, then a day.
                        reminders: [...f.reminders, [{ n: 10, unit: 'm' }, { n: 1, unit: 'h' }, { n: 1, unit: 'd' }][f.reminders.length] || { n: 30, unit: 'm' }]
                      }))
                    }
                  >
                    <Plus size={13} /> Add notification
                  </button>
                )}
            </div>
          </div>

          {clashes.length > 0 && (
            <p className="timetable-clash">
              Overlaps with {clashes.map((c) => `${nameOf(c)} (${SHORT_DAYS[c.dayOfWeek]} ${clock(c.startTime)})`).join(', ')}. You can still save it.
            </p>
          )}
        </div>

        {formError && <p className="form-error">{formError}</p>}
        <div className="entry-actions">
          {editing !== 'new' && (
            <button className="btn btn-ghost danger-text" onClick={() => askToDelete(editing, viewDate)} disabled={saving}>
              <Trash2 size={14} /> Delete
            </button>
          )}
          <button className="btn btn-primary" onClick={save} disabled={saving}>
            {saving ? 'Saving…' : editing === 'new' ? (form.repeat === 'once' ? 'Add event' : 'Add task') : 'Save'}
          </button>
        </div>
      </Sheet>

      {/* ---------- one entry in detail, with edit and delete ---------- */}
      <Sheet open={!!viewing} onClose={() => setViewing(null)} title={viewing ? nameOf(viewing) : ''}>
        {viewing && (
          <div className="ev-detail">
            <div className="ev-actions">
              {!viewing.shared && !viewing.fromGroup && (
                <button
                  type="button"
                  className="icon-btn"
                  onClick={() => {
                    const e = viewing;
                    setViewing(null);
                    openEdit(e);
                  }}
                  aria-label="Edit"
                  title="Edit"
                >
                  <Pencil size={15} />
                </button>
              )}
              {!viewing.fromGroup && (
                <button
                  type="button"
                  className="icon-btn"
                  onClick={() => askToDelete(viewing, viewDate)}
                  aria-label={viewing.shared ? 'Remove from my timetable' : 'Delete'}
                  title={viewing.shared ? 'Remove from my timetable' : 'Delete'}
                >
                  <Trash2 size={15} />
                </button>
              )}
            </div>
            <div className="ev-when">
              <i className="ev-dot" style={{ '--hue': hueFor(viewing.subject?.name || viewing.title) }} />
              <div>
                <strong>{occurrenceText(viewing, viewDate)}</strong>
                <span>
                  {viewing.startDate
                    ? 'Does not repeat'
                    : `Weekly on ${DAYS[viewing.dayOfWeek]}${viewing.repeatUntil ? `, until ${shortDay(viewing.repeatUntil)}` : ''}`}
                </span>
              </div>
            </div>
            <div className="ev-rows">
              <div className="ev-row">
                <Tag size={16} />
                <span>{[kindLabel(viewing), viewing.subject && (viewing.subject.code ? `${viewing.subject.name} (${viewing.subject.code})` : viewing.subject.name)].filter(Boolean).join(' · ')}</span>
              </div>
              {viewing.venue && (
                <div className="ev-row">
                  <MapPin size={16} />
                  <span>{viewing.venue}</span>
                </div>
              )}
              {viewing.reminders?.length > 0 && (
                <div className="ev-row">
                  <Bell size={16} />
                  <span>{viewing.reminders.map(reminderText).join(', ')}</span>
                </div>
              )}
              {(viewing.shared || viewing.fromGroup) && (
                <div className="ev-row">
                  <CalendarDays size={16} />
                  <span>
                    {viewing.fromGroup ? 'Mentor: ' : 'Added by '}
                    {[viewing.owner?.name, viewing.owner?.memberId].filter(Boolean).join(' · ') || 'someone'}
                  </span>
                </div>
              )}
              {others.length > 0 && (
                <div className="ev-row">
                  <Users size={16} />
                  <span>{(viewing.shared ? 'Also on it: ' : 'With ') + others.map((x) => x.name).join(', ')}</span>
                </div>
              )}
            </div>
            {viewing.fromGroup && (
              /* Read from the mentoring group: it changes when the mentor changes the group */
              <p className="as-group-note">
                {viewing.shared
                  ? 'Your mentoring group meets at this time every week. It updates here whenever your mentor changes it.'
                  : "Your mentoring group, on every member's timetable. Change the day, time or place in Mentoring."}
                {!viewing.shared && (
                  <>
                    {' '}
                    <Link to="/mentoring" onClick={() => setViewing(null)}>
                      Open Mentoring
                    </Link>
                  </>
                )}
              </p>
            )}
          </div>
        )}
      </Sheet>

      {/* ---------- asking before a delete ---------- */}
      {askDel && (
        <div className="ev-dialog-backdrop" onClick={() => setAskDel(null)}>
          <div className="ev-dialog" role="dialog" aria-modal="true" aria-labelledby="ev-dialog-title" onClick={(e) => e.stopPropagation()}>
            <h3 id="ev-dialog-title">
              {askDel.recurring ? 'Delete recurring event' : askDel.entry.shared ? 'Remove from your timetable?' : `Delete ${nameOf(askDel.entry)}?`}
            </h3>
            {askDel.recurring ? (
              <div className="ev-choices" role="radiogroup">
                {[
                  ['this', 'This event', shortDay(askDel.date)],
                  ['following', 'This and following events', `From ${shortDay(askDel.date)}`],
                  ['all', 'All events', `Every ${DAYS[askDel.entry.dayOfWeek]}`]
                ].map(([value, label, hint]) => (
                  <label key={value} className={`ev-choice${askDel.scope === value ? ' on' : ''}`}>
                    <input type="radio" name="ev-scope" value={value} checked={askDel.scope === value} onChange={() => setAskDel((a) => ({ ...a, scope: value }))} />
                    <span>
                      {label}
                      <small>{hint}</small>
                    </span>
                  </label>
                ))}
              </div>
            ) : (
              <p>
                {askDel.entry.shared
                  ? `${askDel.entry.owner?.name || 'The person who added it'} still keeps it; it just leaves your timetable.`
                  : `${occurrenceText(askDel.entry, askDel.date)}. This can't be undone.`}
              </p>
            )}
            <div className="ev-dialog-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setAskDel(null)}>
                Cancel
              </button>
              <button type="button" className={`btn ${askDel.recurring ? 'btn-primary' : 'btn-danger'}`} onClick={confirmDelete}>
                {askDel.recurring ? 'OK' : askDel.entry.shared ? 'Remove' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast}
    </div>
  );
}
