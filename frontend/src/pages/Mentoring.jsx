import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { BarChart3, Bell, CalendarClock, Check, ChevronRight, Clock, Copy, Lock, MapPin, Network, Pencil, Plus, Share2, Trash2, UserMinus, UserPlus, Users, X } from 'lucide-react';
import MentoringDashboard from '../features/mentoring/MentoringDashboard';
import client from '../services/apiClient';
import { useToast } from '../hooks/useToast';
import { toDateKey } from '../features/academic/weekUtils';
import { ASSESSMENT_LABEL, daysUntil } from '../features/academic/deadlines';
import { DAYS, MAX_REMINDERS, MAX_REMINDER_MINUTES, REMINDER_UNITS, SHORT_DAYS, clock, reminderMinutes, reminderParts } from '../features/timetable/timetable';
import Sheet from '../components/Sheet';
import SocialLinks from '../components/SocialLinks';
import { Select, SelectMenu, TimeInput } from '../components/pickers';
import { TreeSkeleton } from '../components/PageSkeletons';

// A steady colour per person (from their name), so faces in the tree are easy
// to tell apart when there is no photo.
function hueFor(name) {
  let sum = 0;
  for (const ch of name || '') sum = (sum * 31 + ch.charCodeAt(0)) % 360;
  return sum;
}

function Avatar({ person }) {
  return person.avatarUrl ? (
    <img className="avatar mentor-avatar" src={person.avatarUrl} alt="" />
  ) : (
    <div className="avatar mentor-avatar mentor-avatar-letter" style={{ '--hue': hueFor(person.name) }}>
      {(person.name || '?').trim()[0]?.toUpperCase()}
    </div>
  );
}

// Today's mutabaah as a small ring: how much of the day's list is done.
function TodayRing({ done, total }) {
  const percent = total ? Math.round((done / total) * 100) : 0;
  const tone = done === total ? 'done' : done === 0 ? 'none' : percent >= 50 ? 'mid' : 'low';
  return (
    <span className={`today-ring tone-${tone}`} style={{ '--p': percent }} title={`Mutabaah today: ${done} of ${total}`}>
      <span>
        {done}
        <small>/{total}</small>
      </span>
    </span>
  );
}

// A mentee or mentoring mate in the tree: opens their detail page. A mate
// outside my group shows only who they are: no mutabaah, nothing to open.
function PersonNode({ person }) {
  if (person.sameGroup === false)
    return (
      <div className="tree-node tree-private">
        <Avatar person={person} />
        <div className="mentor-body">
          <div className="mentor-name">{person.name}</div>
          <div className="mentor-meta">{[person.memberId, person.kampus].filter(Boolean).join(' · ')}</div>
        </div>
        <Lock size={13} className="tree-private-lock" aria-label="Mutabaah private" />
      </div>
    );
  return (
    <Link to={`/mentoring/${person._id}`} className="tree-node tree-link">
      <Avatar person={person} />
      <div className="mentor-body">
        <div className="mentor-name">{person.name}</div>
        <div className="mentor-meta">{[person.memberId, person.kampus].filter(Boolean).join(' · ')}</div>
      </div>
      <TodayRing done={person.mutabaahDone} total={person.mutabaahTotal} />
      <ChevronRight size={16} className="mentee-chevron" />
    </Link>
  );
}

// Mentoring Tree, drawn as one: my mentor at the top, then me and my
// mentoring mates on the branch below them, then my mentees under me.
// "Thu · 8:30 pm · Surau" for a mentoring group; empty when nothing is set.
function meetingText(group, days = SHORT_DAYS) {
  return [
    group.dayOfWeek === null || group.dayOfWeek === undefined ? '' : days[group.dayOfWeek],
    group.startTime ? clock(group.startTime) : '',
    group.venue
  ]
    .filter(Boolean)
    .join(' · ');
}

// Mates and mentees open their detail; a mentor's own detail is never shown
// to their mentees.
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function Mentoring() {
  const [params, setParams] = useSearchParams();
  const view = params.get('view') === 'dashboard' ? 'dashboard' : 'tree';
  const [tree, setTree] = useState(null);
  const [error, setError] = useState(false);
  const [mentorInput, setMentorInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [copied, setCopied] = useState(false);
  const [toast, showToast] = useToast();
  // The mentoring group being added or edited: null, or its form.
  const [groupForm, setGroupForm] = useState(null);
  const [groupSaving, setGroupSaving] = useState(false);
  const [groupError, setGroupError] = useState('');

  function load() {
    setError(false);
    client
      .get('/mentoring/tree', { params: { date: toDateKey(new Date()) } })
      .then((res) => setTree(res.data))
      .catch(() => setError(true));
  }

  useEffect(load, []);

  async function saveMentor(memberId) {
    setSaving(true);
    setFormError('');
    try {
      const res = await client.put('/mentoring/mentor', { memberId });
      setTree((t) => ({ ...t, mentor: res.data.mentor, mates: [] }));
      setMentorInput('');
      load(); // mates depend on who the mentor is
      showToast(res.data.mentor ? `${res.data.mentor.name} is now your mentor` : 'Mentor removed');
    } catch (err) {
      setFormError(err.response?.data?.error || "Couldn't save. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  function removeMentor() {
    const message = `Remove ${tree.mentor.name} as your mentor? They and your group mates will no longer see your mutabaah and academic detail, and you will no longer see your group mates'.`;
    if (window.confirm(message)) saveMentor('');
  }

  function copyId() {
    navigator.clipboard?.writeText(tree.me.memberId).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  // Hand your ID to a mentee: the phone's share sheet where there is one,
  // otherwise it is copied.
  function shareId() {
    const text = `Add me as your mentor on Double 4 Flat. My User ID is ${tree.me.memberId}.`;
    if (navigator.share) navigator.share({ text }).catch(() => {});
    else navigator.clipboard?.writeText(text).then(() => showToast('Invite copied'));
  }

  const mates = tree?.mates || [];
  // Mates in my group (their mutabaah is shared with me) and the rest.
  const groupMates = mates.filter((m) => m.sameGroup !== false);
  const otherMates = mates.filter((m) => m.sameGroup === false);
  const mentees = tree?.mentees || [];
  const examsThisWeek = (tree?.menteeExams || []).filter((x) => daysUntil(x.dueDate) <= 7).length;
  const groups = tree?.groups || [];
  const ungrouped = mentees.filter((m) => !groups.some((g) => g._id === m.groupId));

  function openGroup(group) {
    setGroupError('');
    setGroupForm(
      group
        ? {
            _id: group._id,
            name: group.name,
            dayOfWeek: group.dayOfWeek === null || group.dayOfWeek === undefined ? '' : String(group.dayOfWeek),
            startTime: group.startTime || '',
            endTime: group.endTime || '',
            venue: group.venue || '',
            reminders: (group.reminders || []).map(reminderParts),
            memberIds: mentees.filter((m) => m.groupId === group._id).map((m) => m._id)
          }
        : { name: `Mentoring ${groups.length + 1}`, dayOfWeek: '', startTime: '', endTime: '', venue: '', reminders: [], memberIds: ungrouped.map((m) => m._id) }
    );
  }

  const setGroupReminder = (i, change) => setGroupForm((f) => ({ ...f, reminders: f.reminders.map((r, j) => (j === i ? { ...r, ...change } : r)) }));

  function toggleMember(id) {
    setGroupForm((f) => ({ ...f, memberIds: f.memberIds.includes(id) ? f.memberIds.filter((x) => x !== id) : [...f.memberIds, id] }));
  }

  async function saveGroup() {
    if (!groupForm.name.trim()) return setGroupError('Give the group a name.');
    const reminders = groupForm.reminders.map(reminderMinutes);
    if (reminders.some((m) => !Number.isFinite(m) || m < 0)) return setGroupError('Each reminder needs a number.');
    if (reminders.some((m) => m > MAX_REMINDER_MINUTES)) return setGroupError('A reminder can be at most 4 weeks before.');
    setGroupSaving(true);
    setGroupError('');
    const body = {
      name: groupForm.name.trim(),
      dayOfWeek: groupForm.dayOfWeek === '' ? null : Number(groupForm.dayOfWeek),
      startTime: groupForm.startTime || null,
      endTime: groupForm.startTime && groupForm.endTime ? groupForm.endTime : null,
      venue: groupForm.venue.trim(),
      reminders,
      memberIds: groupForm.memberIds
    };
    try {
      if (groupForm._id) await client.put(`/mentoring/groups/${groupForm._id}`, body);
      else await client.post('/mentoring/groups', body);
      setGroupForm(null);
      load();
      showToast(groupForm._id ? 'Group updated' : 'Group added');
    } catch (err) {
      setGroupError(err.response?.data?.error || "Couldn't save the group. Please try again.");
    } finally {
      setGroupSaving(false);
    }
  }

  async function deleteGroup() {
    if (!window.confirm(`Delete "${groupForm.name}"? Its mentees stay your mentees; they just won't be in a group.`)) return;
    setGroupSaving(true);
    try {
      await client.delete(`/mentoring/groups/${groupForm._id}`);
      setGroupForm(null);
      load();
      showToast('Group deleted');
    } catch {
      setGroupError("Couldn't delete the group. Please try again.");
    } finally {
      setGroupSaving(false);
    }
  }

  // "You", with your mentees branching underneath.
  const youNode = tree && (
    <div className="tree-item">
      <div className="tree-node you">
        <Avatar person={tree.me} />
        <div className="mentor-body">
          <div className="tree-role">You</div>
          <div className="mentor-name">{tree.me.name}</div>
          {!tree.me.memberId && <div className="mentor-meta">Your User ID is being set up</div>}
        </div>
        {tree.me.memberId && (
          <button type="button" className="id-chip" onClick={copyId} aria-label={`Copy your User ID, ${tree.me.memberId}`} title="Copy your User ID">
            <span>{copied ? 'Copied' : tree.me.memberId}</span>
            {copied ? <Check size={13} /> : <Copy size={13} />}
          </button>
        )}
      </div>

      <div className="tree-branch">
        <div className="tree-caption tree-caption-row">
          <span>My mentees ({mentees.length})</span>
          {mentees.length > 0 && (
            <button type="button" className="tree-group-add" onClick={() => openGroup(null)}>
              <Plus size={12} /> New group
            </button>
          )}
        </div>

        {/* Each mentoring group, with when it meets, then anyone not in one. */}
        {groups.map((g) => {
          const members = mentees.filter((m) => m.groupId === g._id);
          const meeting = meetingText(g);
          return (
            <div className="tree-group" key={g._id}>
              <button type="button" className="tree-group-head" onClick={() => openGroup(g)} aria-label={`Edit ${g.name}`}>
                <span className="tree-group-name">
                  {g.name}
                  <small>{members.length}</small>
                </span>
                <span className="tree-group-meta">
                  {meeting ? (
                    <>
                      <Clock size={11} /> {meeting}
                    </>
                  ) : (
                    'Set a day and time'
                  )}
                </span>
                <Pencil size={13} className="tree-group-edit" />
              </button>
              {members.map((m) => (
                <div className="tree-item" key={m._id}>
                  <PersonNode person={m} />
                </div>
              ))}
              {members.length === 0 && <div className="tree-group-empty">Nobody in this group yet. Tap it to add mentees.</div>}
            </div>
          );
        })}
        {groups.length > 0 && ungrouped.length > 0 && <div className="tree-caption tree-caption-sub">Not in a group ({ungrouped.length})</div>}
        {ungrouped.map((m) => (
          <div className="tree-item" key={m._id}>
            <PersonNode person={m} />
          </div>
        ))}
        {mentees.length === 0 && (
          <div className="tree-item">
            <div className="tree-node empty">
              <div className="mentor-body">
                <div className="tree-empty-title">No mentees yet</div>
                <div className="mentor-meta">They appear here once they add your User ID as their mentor.</div>
              </div>
              {tree.me.memberId && (
                <button type="button" className="btn btn-primary btn-sm" onClick={shareId}>
                  <Share2 size={13} /> Share ID
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Mentoring Tree</h1>
          <p className="page-subtitle">Your mentor, your mentoring mates and your mentees</p>
        </div>
      </div>

      <div className="range-toggle segmented">
        <button className={view === 'tree' ? 'active' : ''} onClick={() => setParams({}, { replace: true })}>
          <Network size={14} /> Tree
        </button>
        <button className={view === 'dashboard' ? 'active' : ''} onClick={() => setParams({ view: 'dashboard' }, { replace: true })}>
          <BarChart3 size={14} /> Dashboard
        </button>
      </div>

      {view === 'dashboard' ? (
        <MentoringDashboard />
      ) : error ? (
        <div className="card empty-state">
          <h3>Couldn't load your mentoring tree</h3>
          <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={load}>
            Try again
          </button>
        </div>
      ) : !tree ? (
        <TreeSkeleton />
      ) : (
        <>
          <div className="tree-counts">
            <span>
              <strong>{tree.mentor ? 1 : 0}</strong> mentor
            </span>
            <span>
              <strong>{mates.length}</strong> mate{mates.length === 1 ? '' : 's'}
            </span>
            <span>
              <strong>{mentees.length}</strong> mentee{mentees.length === 1 ? '' : 's'}
            </span>
          </div>

          <div className="tree">
            {/* ---------- top of the tree: my mentor, or the place to add one ---------- */}
            {tree.mentor ? (
              <div className="tree-node mentor">
                <Avatar person={tree.mentor} />
                <div className="mentor-body">
                  <div className="tree-role">My mentor</div>
                  <div className="mentor-name">{tree.mentor.name}</div>
                  <div className="mentor-meta">{[tree.mentor.memberId, tree.mentor.kampus].filter(Boolean).join(' · ')}</div>
                  <SocialLinks person={tree.mentor} />
                  {tree.myGroup && (
                    <div className="mentor-meta tree-my-group">
                      <Clock size={11} /> {[tree.myGroup.name, meetingText(tree.myGroup)].filter(Boolean).join(' · ')}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  className="icon-btn tree-remove"
                  onClick={removeMentor}
                  disabled={saving}
                  aria-label={`Remove ${tree.mentor.name} as your mentor`}
                  title="Remove mentor"
                >
                  <UserMinus size={15} />
                </button>
              </div>
            ) : (
              <form
                className="tree-node empty tree-add-mentor"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (mentorInput.trim()) saveMentor(mentorInput);
                }}
              >
                <label htmlFor="mentor-id" className="tree-role">
                  <UserPlus size={13} /> Add your mentor by their User ID
                </label>
                <div className="mentor-form-row">
                  <input
                    id="mentor-id"
                    className="input"
                    value={mentorInput}
                    onChange={(e) => setMentorInput(e.target.value)}
                    placeholder="e.g. D4F-0007"
                    autoCapitalize="characters"
                  />
                  <button className="btn btn-primary" type="submit" disabled={saving || !mentorInput.trim()}>
                    {saving ? 'Saving…' : 'Add'}
                  </button>
                </div>
                {formError && <p className="form-error">{formError}</p>}
                <p className="mentor-note">
                  Your mentor, and the mates your mentor puts in your group, will see your mutabaah and academic detail.
                  You can remove them at any time.
                </p>
              </form>
            )}

            {/* ---------- the branch under my mentor: me and my mates ---------- */}
            <div className="tree-branch">
              {tree.mentor && (
                <div className="tree-caption">
                  Under your mentor · {mates.length ? `you and ${mates.length} mate${mates.length === 1 ? '' : 's'}` : 'just you so far'}
                </div>
              )}
              {/* My group: me and my group mates, whose mutabaah we share */}
              {tree.mentor && (
                <div className="tree-caption tree-caption-sub tree-my-group-caption">
                  {tree.myGroup ? (
                    <>
                      <Users size={11} /> Your group · {tree.myGroup.name} ({groupMates.length + 1})
                    </>
                  ) : (
                    'You are not in a group yet'
                  )}
                </div>
              )}
              {groupMates.map((m) => (
                <div className="tree-item" key={m._id}>
                  <PersonNode person={m} />
                </div>
              ))}
              {/* Me last in my group, since my own mentees hang under me */}
              {youNode}
              {tree.mentor && !tree.myGroup && (
                <p className="tree-group-note">When {tree.mentor.name} puts you in a group, you and your group mates will see each other's mutabaah.</p>
              )}
              {/* Everyone else under my mentor: who they are, but not their mutabaah */}
              {otherMates.length > 0 && (
                <div className="tree-caption tree-caption-sub">
                  {tree.myGroup ? 'In other groups or none' : 'Other mates'} ({otherMates.length}) · mutabaah private
                </div>
              )}
              {otherMates.map((m) => (
                <div className="tree-item" key={m._id}>
                  <PersonNode person={m} />
                </div>
              ))}
              {tree.mentor && mates.length === 0 && (
                <div className="tree-item">
                  <div className="tree-node empty">
                    <div className="mentor-body">
                      <div className="tree-empty-title">No mentoring mates yet</div>
                      <div className="mentor-meta">Others who add {tree.mentor.name} as their mentor will appear here.</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
          {/* ---------- a mentor's view of every mentee's exams ---------- */}
          {tree.menteeExams?.length > 0 && (
            <div className="card mentee-exams">
              <div className="log-section-head">
                <span className="log-section-icon">
                  <CalendarClock size={16} />
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="log-section-title">My mentees' exams</div>
                  <div className="log-section-sub">
                    {examsThisWeek
                      ? `${examsThisWeek} in the next 7 days · ${tree.menteeExams.length} to come`
                      : 'Quizzes, tests and finals still to come'}
                  </div>
                </div>
              </div>
              {/* The same tile as your own deadlines; tapping one opens that mentee */}
              <div className="md-deadlines">
                {tree.menteeExams.map((x) => {
                  const days = daysUntil(x.dueDate);
                  const [, month, day] = x.dueDate.split('-').map(Number);
                  const weekday = SHORT_DAYS[new Date(`${x.dueDate}T00:00:00`).getDay()];
                  const subject = x.subject?.code ? `${x.subject.name} (${x.subject.code})` : x.subject?.name;
                  return (
                    <Link
                      to={`/mentoring/${x.mentee._id}`}
                      className={`md-deadline tone-${days <= 3 ? 'urgent' : days <= 7 ? 'soon' : 'later'}`}
                      key={`${x.mentee._id}-${x._id}`}
                    >
                      <span className="md-date" aria-hidden="true">
                        <small>{MONTHS[month - 1]}</small>
                        <strong>{day}</strong>
                      </span>
                      <div className="md-deadline-body">
                        <div className="md-deadline-title">
                          {x.mentee.name}
                          <span className="md-kind exam">{ASSESSMENT_LABEL[x.type] || x.type}</span>
                        </div>
                        <div className="md-deadline-meta">{subject || 'No subject'}</div>
                        <div className="md-deadline-meta">{[weekday, x.dueTime && clock(x.dueTime)].filter(Boolean).join(' · ')}</div>
                      </div>
                      <span className="md-countdown">{days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : `${days} days`}</span>
                      {typeof x.progressPercentage === 'number' && (
                        <div className="dl-progress">
                          <span className="dl-progress-bar">
                            <span style={{ width: `${x.progressPercentage}%` }} />
                          </span>
                          <span className="dl-progress-text">{x.progressPercentage}% revised</span>
                        </div>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          )}
          {(groupMates.length > 0 || mentees.length > 0) && (
            <p className="mentor-note">The ring beside each person is their mutabaah today, out of 7. Tap someone to see their updates.</p>
          )}
        </>
      )}
      <Sheet open={!!groupForm} onClose={() => setGroupForm(null)} title={groupForm?._id ? 'Edit mentoring group' : 'New mentoring group'}>
        {groupForm && (
          <div className="entry-form">
            <div className="field">
              <label htmlFor="group-name">Name</label>
              <input
                id="group-name"
                className="input"
                value={groupForm.name}
                onChange={(e) => setGroupForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Mentoring 1"
                maxLength={40}
              />
            </div>
            <div className="group-when">
              <div className="field">
                <label htmlFor="group-day">Day</label>
                <Select id="group-day" className="input" value={groupForm.dayOfWeek} onChange={(e) => setGroupForm((f) => ({ ...f, dayOfWeek: e.target.value }))}>
                  <option value="">Not set</option>
                  {DAYS.map((label, d) => (
                    <option key={label} value={d}>
                      {label}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="field">
                <label htmlFor="group-time">Starts</label>
                <TimeInput
                  id="group-time"
                  className="input"
                  value={groupForm.startTime}
                  onChange={(e) => setGroupForm((f) => ({ ...f, startTime: e.target.value }))}
                />
              </div>
              <div className="field">
                <label htmlFor="group-end">Ends</label>
                <TimeInput
                  id="group-end"
                  className="input"
                  value={groupForm.endTime}
                  disabled={!groupForm.startTime}
                  onChange={(e) => setGroupForm((f) => ({ ...f, endTime: e.target.value }))}
                />
              </div>
            </div>
            <p className="field-hint group-when-hint">
              With a day and a start time, the meeting goes on your timetable and every member's, and updates there when you change it.
              No end time means 1h 30m.
            </p>
            <div className="field">
              <label htmlFor="group-venue">
                <MapPin size={11} /> Place (optional)
              </label>
              <input
                id="group-venue"
                className="input"
                value={groupForm.venue}
                onChange={(e) => setGroupForm((f) => ({ ...f, venue: e.target.value }))}
                placeholder="e.g. Surau, Google Meet"
                maxLength={80}
              />
            </div>
            {/* ---------- reminders before each meeting, for the mentor and every member ---------- */}
            <div className="field">
              <label>
                <Bell size={11} /> Reminders
              </label>
              {groupForm.reminders.map((r, i) => (
                <div className="tt-reminder" key={i}>
                  <input
                    className="input"
                    type="number"
                    inputMode="numeric"
                    min="0"
                    value={r.n}
                    onChange={(e) => setGroupReminder(i, { n: e.target.value })}
                    aria-label="How long before"
                  />
                  <SelectMenu
                    look="box"
                    ariaLabel="Unit"
                    value={r.unit}
                    onChange={(unit) => setGroupReminder(i, { unit })}
                    options={REMINDER_UNITS.map(([key, word]) => ({ value: key, label: `${word} before` }))}
                  />
                  <button
                    type="button"
                    className="icon-btn"
                    onClick={() => setGroupForm((f) => ({ ...f, reminders: f.reminders.filter((_, j) => j !== i) }))}
                    aria-label="Remove this reminder"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
              {groupForm.reminders.length < MAX_REMINDERS && (
                <button
                  type="button"
                  className="gc-link tt-reminder-add"
                  onClick={() =>
                    setGroupForm((f) => ({
                      ...f,
                      // A sensible next one: an hour, then a day, then ten minutes.
                      reminders: [...f.reminders, [{ n: 1, unit: 'h' }, { n: 1, unit: 'd' }, { n: 10, unit: 'm' }][f.reminders.length] || { n: 30, unit: 'm' }]
                    }))
                  }
                >
                  <Plus size={13} /> Add notification
                </button>
              )}
              <p className="field-hint">
                {groupForm.dayOfWeek === '' || !groupForm.startTime ? 'Set a day and a start time for reminders to be sent. ' : ''}
                {groupForm.reminders.length
                  ? 'You and everyone in the group get a notification before each meeting.'
                  : 'No reminder set. Add one so you and the group are notified before each meeting.'}
              </p>
            </div>
            <div className="field">
              <label>
                Mentees in this group ({groupForm.memberIds.length} of {mentees.length})
              </label>
              <div className="group-members">
                {mentees.map((m) => {
                  const on = groupForm.memberIds.includes(m._id);
                  const other = groups.find((g) => g._id === m.groupId && g._id !== groupForm._id);
                  return (
                    <button type="button" key={m._id} className={`group-member${on ? ' on' : ''}`} onClick={() => toggleMember(m._id)} aria-pressed={on}>
                      <Avatar person={m} />
                      <span className="group-member-text">
                        <strong>{m.name}</strong>
                        <small>{other ? (on ? `Moves here from ${other.name}` : `In ${other.name}`) : m.memberId}</small>
                      </span>
                      <span className="group-member-check">{on && <Check size={13} strokeWidth={3} />}</span>
                    </button>
                  );
                })}
              </div>
            </div>
            {groupError && <p className="form-error">{groupError}</p>}
            <div className="form-row">
              {groupForm._id && (
                <button className="btn btn-ghost danger-text" onClick={deleteGroup} disabled={groupSaving}>
                  <Trash2 size={14} /> Delete
                </button>
              )}
              <button className="btn btn-primary" onClick={saveGroup} disabled={groupSaving} style={{ flex: 1 }}>
                {groupSaving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        )}
      </Sheet>
      {toast}
    </div>
  );
}
