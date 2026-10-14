import { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarCheck, CalendarClock, Users } from 'lucide-react';
import client from '../../services/apiClient';
import { DAYS, SHORT_DAYS, clock, hueFor, kindLabel, minutes } from '../timetable/timetable';
import { GroupTimetableSkeleton } from '../../components/PageSkeletons';

// The whole day is looked at for a time to meet, 12 am to 12 am.
const DAY_START = 0;
const DAY_END = 24 * 60;
const HOURS = Array.from({ length: (DAY_END - DAY_START) / 60 }, (_, i) => DAY_START + i * 60);
// A gap shorter than this isn't offered as a time to meet.
const MIN_WINDOW = 60;

// Midnight at the end of the day reads as 12 am, not 12 pm.
const hhmm = (mins) => {
  const m = mins % (24 * 60);
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
};
const span = (from, to) => `${clock(hhmm(from))} to ${clock(hhmm(to))}`;
const hourLabel = (mins) => clock(hhmm(mins)).replace(':00', '');
const nameOf = (entry) => entry.title || entry.subject?.name || kindLabel(entry);
const firstName = (person) => (person.isMe ? 'You' : (person.name || '').split(' ')[0]);

function duration(mins) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h && m ? `${h}h ${m}m` : h ? `${h}h` : `${m} min`;
}

// The stretches of one day, from midnight to midnight, when none of these
// entries is on. Each is { from, to } in minutes.
function freeWindows(entries) {
  const busy = entries
    .map((e) => [Math.max(DAY_START, minutes(e.startTime)), Math.min(DAY_END, minutes(e.endTime))])
    .filter(([from, to]) => to > from)
    .sort((a, b) => a[0] - b[0]);
  const windows = [];
  let cursor = DAY_START;
  busy.forEach(([from, to]) => {
    if (from - cursor >= MIN_WINDOW) windows.push({ from: cursor, to: from });
    cursor = Math.max(cursor, to);
  });
  if (DAY_END - cursor >= MIN_WINDOW) windows.push({ from: cursor, to: DAY_END });
  return windows;
}

// Everyone's weekly timetable side by side, to find a time when the whole
// group is free: when that is, the week as a grid of how many are busy each
// hour, and each person's day. `people` are the ones on show in the dashboard
// (they follow its People choice).
export default function GroupTimetable({ people }) {
  const [timetables, setTimetables] = useState(null);
  const [error, setError] = useState(false);
  const [day, setDay] = useState(() => new Date().getDay());
  const [picked, setPicked] = useState(null); // an hour tapped in the grid: { day, hour }
  const gridScroll = useRef(null);

  function load() {
    setError(false);
    client
      .get('/mentoring/timetables')
      .then((res) => setTimetables(res.data || {}))
      .catch(() => setError(true));
  }
  useEffect(load, []);

  // The grid opens at 8 am once it is drawn; the night is a scroll up.
  const loaded = !!timetables;
  useEffect(() => {
    const box = gridScroll.current;
    const row = box?.querySelector('[data-hour="480"]');
    if (box && row) box.scrollTop = row.offsetTop - box.querySelector('.gt-grid-head').offsetHeight - 4;
  }, [loaded]);

  // Each person with their own weekly entries.
  const rows = useMemo(() => people.map((p) => ({ person: p, entries: timetables?.[p._id] || [] })), [people, timetables]);
  const on = (entries, d) => entries.filter((e) => e.dayOfWeek === d).sort((a, b) => a.startTime.localeCompare(b.startTime));

  // For each day: when nobody has anything, and how much of the day that is.
  const common = useMemo(
    () =>
      DAYS.map((_, d) => {
        const windows = freeWindows(rows.flatMap((r) => on(r.entries, d)));
        return { windows, total: windows.reduce((sum, w) => sum + (w.to - w.from), 0) };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rows]
  );

  // Who is busy in each hour of each day.
  const busyAt = (d, hour) => rows.filter((r) => on(r.entries, d).some((e) => minutes(e.startTime) < hour + 60 && hour < minutes(e.endTime)));

  if (error) {
    return (
      <div className="card empty-state">
        <h3>Couldn't load the timetables</h3>
        <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={load}>
          Try again
        </button>
      </div>
    );
  }
  if (!timetables) return <GroupTimetableSkeleton />;

  const n = rows.length;
  const everyone = n === 1 ? firstName(rows[0].person) : n === 2 ? 'both' : `all ${n}`;
  const withNothing = rows.filter((r) => r.entries.length === 0);
  const freeDays = DAYS.filter((_, d) => common[d].total === DAY_END - DAY_START);
  const noDays = DAYS.filter((_, d) => common[d].windows.length === 0);
  // The longest single stretch in the week when everyone is free.
  const best = common
    .flatMap((c, d) => c.windows.map((w) => ({ ...w, day: d })))
    .filter((w) => w.to - w.from < DAY_END - DAY_START)
    .sort((a, b) => b.to - b.from - (a.to - a.from))[0];
  const pickedBusy = picked ? busyAt(picked.day, picked.hour) : [];

  return (
    <>
      {/* ---------- when the whole group is free ---------- */}
      <div className="card gt-card">
        <div className="log-section-head">
          <span className="log-section-icon">
            <CalendarCheck size={16} />
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="log-section-title">When {everyone} {n === 1 ? 'is' : 'are'} free</div>
            <div className="log-section-sub">Across the whole day, from everyone's weekly timetable</div>
          </div>
        </div>
        <p className="gt-lead">
          {best ? (
            <>
              The longest time free together is <strong>{DAYS[best.day]}, {span(best.from, best.to)}</strong> ({duration(best.to - best.from)}).
            </>
          ) : freeDays.length === 7 ? (
            <>Nobody has anything in their timetable, so any time works.</>
          ) : (
            <>There is no hour in the week when everyone is free.</>
          )}
          {freeDays.length > 0 && freeDays.length < 7 && <> Free all day: <strong>{freeDays.join(', ')}</strong>.</>}
          {noDays.length > 0 && <> No shared free time on <strong>{noDays.join(', ')}</strong>.</>}
        </p>
        <div className="gt-days">
          {DAYS.map((label, d) => (
            <div className={`gt-day${common[d].windows.length ? '' : ' none'}`} key={label}>
              <span className="gt-day-name">{SHORT_DAYS[d]}</span>
              <span className="gt-day-windows">
                {common[d].total === DAY_END - DAY_START ? (
                  <span className="gt-window all">Free all day</span>
                ) : common[d].windows.length ? (
                  common[d].windows.map((w) => (
                    <span className="gt-window" key={w.from}>
                      {span(w.from, w.to)}
                    </span>
                  ))
                ) : (
                  <span className="gt-window busy">No shared free time</span>
                )}
              </span>
            </div>
          ))}
        </div>
        {withNothing.length > 0 && (
          <p className="adm-foot">
            {withNothing.map((r) => firstName(r.person)).join(', ')} {withNothing.length === 1 && !withNothing[0].person.isMe ? 'has' : 'have'} nothing in{' '}
            {withNothing.length === 1 ? 'their' : 'their'} timetable yet, so they count as free all week. Ask them to add their classes for this to be right.
          </p>
        )}
      </div>

      {/* ---------- the week as a grid: how many are busy each hour ---------- */}
      <div className="card gt-card">
        <div className="log-section-head">
          <span className="log-section-icon">
            <CalendarClock size={16} />
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="log-section-title">The week at a glance</div>
            <div className="log-section-sub">Tap an hour to see who is busy and who is free</div>
          </div>
        </div>
        {/* The whole day scrolls in its own box, opening at 8 am */}
        <div className="gt-grid-scroll" ref={gridScroll}>
        <div className="gt-grid" role="grid" aria-label="How many are busy each hour">
          <span />
          {SHORT_DAYS.map((label) => (
            <span className="gt-grid-head" key={label}>
              {label[0]}
            </span>
          ))}
          {HOURS.map((hour) => (
            <div className="gt-grid-row" key={hour}>
              <span className="gt-grid-hour" data-hour={hour}>
                {hourLabel(hour)}
              </span>
              {DAYS.map((_, d) => {
                const busy = busyAt(d, hour).length;
                const level = busy === 0 ? 'free' : busy === n ? 'full' : 'some';
                const isPicked = picked?.day === d && picked?.hour === hour;
                return (
                  <button
                    type="button"
                    key={d}
                    className={`gt-cell ${level}${isPicked ? ' picked' : ''}`}
                    style={busy && busy < n ? { '--share': busy / n } : undefined}
                    onClick={() => setPicked(isPicked ? null : { day: d, hour })}
                    aria-label={`${DAYS[d]} ${hourLabel(hour)}: ${busy ? `${busy} of ${n} busy` : 'everyone free'}`}
                    aria-pressed={isPicked}
                  >
                    {busy > 0 && busy < n ? busy : ''}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
        </div>
        <div className="gt-legend">
          <span>
            <i className="free" /> Everyone free
          </span>
          <span>
            <i className="some" /> Some busy (how many)
          </span>
          <span>
            <i className="full" /> Everyone busy
          </span>
        </div>
        {picked && (
          <div className="gt-picked">
            <strong>
              {DAYS[picked.day]}, {span(picked.hour, picked.hour + 60)}
            </strong>
            {pickedBusy.length === 0 ? (
              <p>Everyone is free.</p>
            ) : (
              <>
                <p>
                  <b>Busy:</b>{' '}
                  {pickedBusy
                    .map((r) => {
                      const e = on(r.entries, picked.day).find((x) => minutes(x.startTime) < picked.hour + 60 && picked.hour < minutes(x.endTime));
                      return `${firstName(r.person)} (${nameOf(e)}, ${clock(e.startTime)} to ${clock(e.endTime)})`;
                    })
                    .join('; ')}
                </p>
                <p>
                  <b>Free:</b>{' '}
                  {rows
                    .filter((r) => !pickedBusy.includes(r))
                    .map((r) => firstName(r.person))
                    .join(', ') || 'nobody'}
                </p>
              </>
            )}
          </div>
        )}
      </div>

      {/* ---------- each person's day ---------- */}
      <div className="card gt-card">
        <div className="log-section-head">
          <span className="log-section-icon">
            <Users size={16} />
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="log-section-title">By person</div>
            <div className="log-section-sub">{DAYS[day]}: what each one has, and when they are free</div>
          </div>
        </div>
        <div className="day-tabs gt-day-tabs" role="tablist" aria-label="Day of the week">
          {SHORT_DAYS.map((label, d) => (
            <button key={label} type="button" role="tab" aria-selected={d === day} className={`day-tab${d === day ? ' selected' : ''}`} onClick={() => setDay(d)}>
              <span>{label}</span>
              <small>{rows.filter((r) => on(r.entries, d).length).length || '·'}</small>
            </button>
          ))}
        </div>
        <div className="gt-scale" aria-hidden="true">
          {[0, 6, 12, 18].map((h) => (
            <span key={h} style={{ left: `${((h * 60 - DAY_START) / (DAY_END - DAY_START)) * 100}%` }}>
              {hourLabel(h * 60)}
            </span>
          ))}
        </div>
        {rows.map(({ person, entries }) => {
          const items = on(entries, day);
          const free = freeWindows(items);
          return (
            <div className="gt-person" key={person._id}>
              <div className="gt-person-head">
                <strong>
                  {person.name}
                  {person.isMe && <span className="badge badge-gold">You</span>}
                </strong>
                <span>{items.length ? `${items.length} on ${SHORT_DAYS[day]}` : entries.length ? 'Free all day' : 'No timetable yet'}</span>
              </div>
              <div className="gt-bar" role="img" aria-label={items.map((e) => `${nameOf(e)} ${clock(e.startTime)} to ${clock(e.endTime)}`).join(', ') || 'Nothing on'}>
                {items.map((e) => {
                  const from = Math.max(DAY_START, minutes(e.startTime));
                  const to = Math.min(DAY_END, minutes(e.endTime));
                  if (to <= from) return null;
                  return (
                    <span
                      key={e._id}
                      title={`${nameOf(e)}: ${clock(e.startTime)} to ${clock(e.endTime)}`}
                      style={{
                        left: `${((from - DAY_START) / (DAY_END - DAY_START)) * 100}%`,
                        width: `${((to - from) / (DAY_END - DAY_START)) * 100}%`,
                        '--hue': hueFor(e.subject?.name || e.title)
                      }}
                    />
                  );
                })}
              </div>
              {items.length > 0 && (
                <div className="gt-items">
                  {items.map((e) => (
                    <span key={e._id}>
                      <b>{clock(e.startTime)}</b> {nameOf(e)}
                    </span>
                  ))}
                </div>
              )}
              {items.length > 0 && (
                <p className="gt-free">{free.length ? `Free: ${free.map((w) => span(w.from, w.to)).join(', ')}` : 'No free hour all day.'}</p>
              )}
            </div>
          );
        })}
      </div>

      <p className="mentor-note">
        This uses what repeats every week in each person's timetable: classes and weekly tasks. One-off dated events are not counted, and a time someone hasn't put in their
        timetable shows as free.
      </p>
    </>
  );
}
