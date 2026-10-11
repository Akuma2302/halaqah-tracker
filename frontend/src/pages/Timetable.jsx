import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, Clock, MapPin, Plus, Trash2, UserPlus, Users, X } from 'lucide-react';
import client from '../services/apiClient';
import Sheet from '../components/Sheet';
import { useToast } from '../hooks/useToast';
import { useAuth } from '../hooks/useAuth';
import HomeScreenShortcut from '../features/timetable/HomeScreenShortcut';
import { CLASS_KINDS, DAYS, KIND_LABEL, SHORT_DAYS, TASK_KINDS, clock, hueFor, minutes } from '../features/timetable/timetable';
import { ASSESSMENT_LABEL, dueLabel, formatDueDate, isExam } from '../features/academic/deadlines';
import { addDays, toDateKey } from '../features/academic/weekUtils';

function duration(mins) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h && m ? `${h}h ${m}m` : h ? `${h}h` : `${m} min`;
}

function nameOf(entry) {
  return entry.title || entry.subject?.name || KIND_LABEL[entry.kind] || 'Task';
}

// "d4f8", "8" or "D4F-0008" -> "D4F-0008"; null when it isn't a User ID.
function tidyMemberId(input) {
  const digits = String(input || '')
    .trim()
    .replace(/^d4f[-\s]*/i, '');
  return /^\d{1,9}$/.test(digits) ? `D4F-${digits.padStart(4, '0')}` : null;
}

function emptyForm(day) {
  return { subjectId: '', title: '', kind: 'study', days: [day], startTime: '09:00', endTime: '10:00', venue: '', people: [] };
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

  const [editing, setEditing] = useState(null); // null = closed, 'new', or the entry being edited
  const [form, setForm] = useState(emptyForm(1));
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [idInput, setIdInput] = useState('');
  // Someone else's task I was added to, open to look at (it can't be edited).
  const [viewing, setViewing] = useState(null);
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
  }, []);

  // Keep "now" fresh so the current / next class moves on by itself.
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);

  const today = now.getDay();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  const byDay = useMemo(() => {
    const groups = DAYS.map(() => []);
    (entries || []).forEach((e) => groups[e.dayOfWeek]?.push(e));
    groups.forEach((g) => g.sort((a, b) => a.startTime.localeCompare(b.startTime)));
    return groups;
  }, [entries]);

  // Dated things from the subjects, still to come, soonest first: quizzes,
  // tests and final exams, and any assessment task given a date and a time.
  const todayKey = toDateKey(now);
  const exams = useMemo(
    () =>
      subjects
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
  const todays = byDay[today];
  const current = todays.find((e) => minutes(e.startTime) <= nowMinutes && nowMinutes < minutes(e.endTime));
  const next = todays.find((e) => minutes(e.startTime) > nowMinutes);

  function openNew(forDay = day) {
    setForm(emptyForm(forDay));
    setFormError('');
    setIdInput('');
    setEditing('new');
  }

  function openEdit(entry) {
    if (entry.shared) return setViewing(entry);
    setIdInput('');
    setForm({
      people: (entry.participants || []).map((p) => ({ memberId: p.memberId, name: p.name })),
      subjectId: entry.subject?._id || '',
      title: entry.title || '',
      kind: entry.kind || 'lecture',
      days: [entry.dayOfWeek],
      startTime: entry.startTime,
      endTime: entry.endTime,
      venue: entry.venue || ''
    });
    setFormError('');
    setEditing(entry);
  }

  // Other classes that overlap what's in the form (same day, times crossing).
  const clashes = useMemo(() => {
    if (!editing || !form.startTime || !form.endTime || form.endTime <= form.startTime) return [];
    return (entries || []).filter(
      (e) =>
        e._id !== editing?._id &&
        form.days.includes(e.dayOfWeek) &&
        minutes(e.startTime) < minutes(form.endTime) &&
        minutes(form.startTime) < minutes(e.endTime)
    );
  }, [editing, form, entries]);

  // Add the User ID in the box to the people on this task.
  function addPerson() {
    const memberId = tidyMemberId(idInput);
    if (!memberId) return setFormError('Enter a User ID such as D4F-0008.');
    setFormError('');
    setIdInput('');
    setForm((f) => (f.people.some((p) => p.memberId === memberId) ? f : { ...f, people: [...f.people, { memberId }] }));
  }

  async function leave() {
    const left = viewing;
    setViewing(null);
    setEntries((list) => list.filter((e) => e._id !== left._id));
    try {
      await client.delete(`/timetable/${left._id}`);
      showToast('Removed from your timetable');
    } catch {
      showToast("Couldn't remove it.");
      load();
    }
  }

  async function save() {
    if (!form.subjectId && !form.title.trim()) return setFormError('Choose a subject or give it a name.');
    if (idInput.trim()) return setFormError('Tap Add to include that User ID, or clear the box.');
    if (!form.days.length) return setFormError('Choose at least one day.');
    if (!form.startTime || !form.endTime) return setFormError('Set the start and end time.');
    if (form.endTime <= form.startTime) return setFormError('The end time must be after the start time.');

    setSaving(true);
    setFormError('');
    const body = (dayOfWeek) => ({
      subjectId: form.subjectId || null,
      title: form.title.trim(),
      kind: form.kind,
      dayOfWeek,
      startTime: form.startTime,
      endTime: form.endTime,
      venue: form.venue.trim(),
      memberIds: form.people.map((p) => p.memberId)
    });
    try {
      if (editing === 'new') {
        // One class per chosen day (e.g. the same lecture on Monday and Wednesday).
        const created = [];
        for (const d of [...form.days].sort()) created.push((await client.post('/timetable', body(d))).data);
        setEntries((list) => [...(list || []), ...created]);
        // Stay on the day being viewed if the class was added there too.
        if (!created.some((c) => c.dayOfWeek === day)) setDay(created[0].dayOfWeek);
        showToast(created.length > 1 ? `Added on ${created.length} days` : 'Added to your timetable');
      } else {
        const res = await client.put(`/timetable/${editing._id}`, body(form.days[0]));
        setEntries((list) => list.map((e) => (e._id === res.data._id ? res.data : e)));
        setDay(res.data.dayOfWeek);
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

  async function remove() {
    if (!window.confirm(`Remove ${nameOf(editing)} on ${DAYS[editing.dayOfWeek]} from your timetable?`)) return;
    const removed = editing;
    setEditing(null);
    setEntries((list) => list.filter((e) => e._id !== removed._id));
    try {
      await client.delete(`/timetable/${removed._id}`);
      showToast('Removed');
    } catch {
      showToast("Couldn't remove it.");
      load();
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

  function ClassCard({ entry, showState }) {
    const start = minutes(entry.startTime);
    const end = minutes(entry.endTime);
    const isNow = showState && entry.dayOfWeek === today && start <= nowMinutes && nowMinutes < end;
    const isPast = showState && entry.dayOfWeek === today && end <= nowMinutes;
    return (
      <button
        type="button"
        className={`class-card${isNow ? ' now' : ''}${isPast ? ' past' : ''}`}
        style={{ '--hue': hueFor(entry.subject?.name || entry.title) }}
        onClick={() => openEdit(entry)}
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
            {[entry.subject?.code, KIND_LABEL[entry.kind] || entry.kind, duration(end - start)].filter(Boolean).join(' · ')}
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
          {entry.shared ? (
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
    return (
      <Link to={`/subject-list?edit=${exam.subject._id}`} className={`class-card static dated ${exam.task ? 'task' : 'exam'}`}>
        <span className="class-time">
          <strong>{exam.time ? clock(exam.time) : 'All day'}</strong>
          <span>{formatDueDate(exam.date)}</span>
        </span>
        <span className="class-body">
          <span className="class-name">
            {exam.task || label}
            <span className={`badge ${exam.task ? 'badge-primary' : 'badge-gold'}`}>{exam.task ? 'Task' : 'Exam'}</span>
          </span>
          <span className="class-meta">{[exam.task ? `For ${label}` : '', exam.subject.name, exam.subject.code].filter(Boolean).join(' · ')}</span>
          <span className="class-meta">
            {due.text.replace(/^due /, '')}
            {exam.task ? '' : ` · ${exam.progress}% revised`}
          </span>
          {exam.topics && <span className="class-meta exam-topics">Focus: {exam.topics}</span>}
        </span>
      </Link>
    );
  }

  const total = entries?.length || 0;
  const isClassKind = CLASS_KINDS.some(([value]) => value === form.kind);
  // Who else is on a task someone added me to (not me).
  const others = (viewing?.participants || []).filter((x) => x._id !== user?._id);

  return (
    <div className="page timetable">
      <div className="page-header">
        <div>
          <h1 className="page-title">Timetable</h1>
          <p className="page-subtitle">
            {entries ? (total ? `${total} class${total === 1 ? '' : 'es'} a week` : 'Your weekly classes') : 'Your weekly classes'}
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
                    <small>{byDay[d].length + examsByDay[d].length || '·'}</small>
                  </button>
                ))}
              </div>

              {byDay[day].length + examsByDay[day].length === 0 ? (
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
                  {byDay[day].map((e) => (
                    <ClassCard key={e._id} entry={e} showState />
                  ))}
                </div>
              )}
            </>
          ) : (
            DAYS.map((label, d) =>
              byDay[d].length + examsByDay[d].length ? (
                <section key={label} className="week-group">
                  <h2 className={`week-group-title${d === today ? ' today' : ''}`}>
                    {label}
                    {d === today && <span className="badge badge-primary">Today</span>}
                    <small>
                      {byDay[d].length} class{byDay[d].length === 1 ? '' : 'es'}
                    </small>
                  </h2>
                  <div className="class-list">
                    {examsByDay[d].map((x) => (
                      <ExamCard key={x.id} exam={x} />
                    ))}
                    {byDay[d].map((e) => (
                      <ClassCard key={e._id} entry={e} showState />
                    ))}
                  </div>
                </section>
              ) : null
            )
          )}

          {/* ---------- every exam still to come, from the subjects ---------- */}
          {exams.length > 0 && (
            <section className="week-group exam-list">
              <h2 className="week-group-title">
                Coming up
                <small>Exams and timed tasks from your subjects</small>
              </h2>
              <div className="class-list">
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
        <div className="entry-form">
          {subjects.length > 0 && (
            <div className="field">
              <label htmlFor="tt-subject">Subject</label>
              <select
                id="tt-subject"
                className="input"
                value={form.subjectId}
                onChange={(e) => setForm((f) => ({ ...f, subjectId: e.target.value }))}
              >
                <option value="">Not one of my subjects</option>
                {subjects.map((s) => (
                  <option key={s._id} value={s._id}>
                    {s.code ? `${s.name} (${s.code})` : s.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="field">
            <label htmlFor="tt-title">{form.subjectId ? 'Title (optional)' : 'Title'}</label>
            <input
              id="tt-title"
              className="input"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder={form.subjectId ? 'e.g. Revise chapter 3' : 'e.g. Study group, Halaqah mingguan'}
              maxLength={80}
            />
          </div>
          <div className="field">
            <label>Type</label>
            <div className="chip-row">
              {/* Classes are set on the subject; one made earlier keeps its own kind here. */}
              {[...CLASS_KINDS.filter(([value]) => value === form.kind), ...TASK_KINDS].map(([value, label]) => (
                <button key={value} type="button" className={`chip${form.kind === value ? ' on' : ''}`} onClick={() => setForm((f) => ({ ...f, kind: value }))}>
                  {label}
                </button>
              ))}
            </div>
            {editing === 'new' && (
              <p className="field-hint">
                Lectures, tutorials and labs are added as class times in <strong>Subjects</strong>.
              </p>
            )}
          </div>
          <div className="field">
            <label>{editing === 'new' ? 'Days (pick one or more)' : 'Day'}</label>
            <div className="chip-row">
              {SHORT_DAYS.map((label, d) => (
                <button key={label} type="button" className={`chip${form.days.includes(d) ? ' on' : ''}`} onClick={() => toggleDay(d)} aria-pressed={form.days.includes(d)}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="timetable-times">
            <div className="field">
              <label htmlFor="tt-start">Starts</label>
              <input id="tt-start" className="input" type="time" value={form.startTime} onChange={(e) => setForm((f) => ({ ...f, startTime: e.target.value }))} />
            </div>
            <div className="field">
              <label htmlFor="tt-end">Ends</label>
              <input id="tt-end" className="input" type="time" value={form.endTime} onChange={(e) => setForm((f) => ({ ...f, endTime: e.target.value }))} />
            </div>
          </div>
          <div className="field">
            <label htmlFor="tt-venue">Venue</label>
            <input
              id="tt-venue"
              className="input"
              value={form.venue}
              onChange={(e) => setForm((f) => ({ ...f, venue: e.target.value }))}
              placeholder="e.g. Dewan Kuliah 3"
              maxLength={80}
            />
          </div>

          <div className="field">
            <label htmlFor="tt-person">
              <UserPlus size={12} /> With other users (optional)
            </label>
            <div className="tt-person-row">
              <input
                id="tt-person"
                className="input"
                value={idInput}
                onChange={(e) => setIdInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addPerson();
                  }
                }}
                placeholder="Their User ID, e.g. D4F-0008"
                autoCapitalize="characters"
                autoCorrect="off"
              />
              <button type="button" className="btn btn-ghost" onClick={addPerson} disabled={!idInput.trim()}>
                Add
              </button>
            </div>
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
            <p className="field-hint">It appears in their timetable too, and they get a notification. They can take themselves off.</p>
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
            <button className="btn btn-ghost danger-text" onClick={remove} disabled={saving}>
              <Trash2 size={14} /> Delete
            </button>
          )}
          <button className="btn btn-primary" onClick={save} disabled={saving}>
            {saving ? 'Saving…' : editing === 'new' ? 'Add task' : 'Save'}
          </button>
        </div>
      </Sheet>

      <Sheet open={!!viewing} onClose={() => setViewing(null)} title={viewing ? nameOf(viewing) : ''}>
        {viewing && (
          <div className="as-detail">
            <div className="as-facts">
              <div className="as-fact">
                <CalendarDays size={15} />
                <span>When</span>
                <strong>
                  {DAYS[viewing.dayOfWeek]}s, {clock(viewing.startTime)} to {clock(viewing.endTime)}
                </strong>
              </div>
              <div className="as-fact">
                <Clock size={15} />
                <span>Kind</span>
                <strong>{KIND_LABEL[viewing.kind] || viewing.kind}</strong>
              </div>
              {viewing.venue && (
                <div className="as-fact">
                  <MapPin size={15} />
                  <span>Venue</span>
                  <strong>{viewing.venue}</strong>
                </div>
              )}
              <div className="as-fact">
                <Users size={15} />
                <span>Added by</span>
                <strong>{[viewing.owner?.name, viewing.owner?.memberId].filter(Boolean).join(' · ') || 'Someone'}</strong>
              </div>
            </div>
            {others.length > 0 && (
              <div className="as-block">
                <div className="as-block-title">
                  <Users size={14} /> Also on it
                </div>
                <p>{others.map((x) => x.name).join(', ')}</p>
              </div>
            )}
            <button className="btn btn-ghost danger-text as-edit" onClick={leave}>
              <Trash2 size={14} /> Remove from my timetable
            </button>
          </div>
        )}
      </Sheet>

      {toast}
    </div>
  );
}
