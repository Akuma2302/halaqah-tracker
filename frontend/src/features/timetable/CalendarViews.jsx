import { useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

// The week and month as a calendar, in the app's own look. Both take
// `itemsOn(dateKey)`: what is on a date, each as
// { key, title, start, end (minutes, or null), allDay, hue, tone, sub, open }.

const pad = (n) => String(n).padStart(2, '0');
const keyOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const dateOf = (key) => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
};
export const shiftKey = (key, days) => {
  const d = dateOf(key);
  d.setDate(d.getDate() + days);
  return keyOf(d);
};
export const sundayOf = (key) => shiftKey(key, -dateOf(key).getDay());

// "9am", "12:30pm"
export function shortTime(mins) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h % 12 || 12}${m ? `:${pad(m)}` : ''}${h < 12 ? 'am' : 'pm'}`;
}

// Side by side when times overlap: each item gets a column and how many
// columns its cluster needs.
function layout(items) {
  const sorted = [...items].sort((a, b) => a.start - b.start || b.end - a.end);
  const placed = [];
  let cluster = [];
  let clusterEnd = -1;
  const close = () => {
    const cols = Math.max(1, ...cluster.map((x) => x.col + 1));
    cluster.forEach((x) => placed.push({ ...x, cols }));
    cluster = [];
  };
  sorted.forEach((item) => {
    if (cluster.length && item.start >= clusterEnd) close();
    const taken = new Set(cluster.filter((x) => x.end > item.start).map((x) => x.col));
    let col = 0;
    while (taken.has(col)) col += 1;
    cluster.push({ ...item, col });
    clusterEnd = Math.max(clusterEnd, item.end);
  });
  if (cluster.length) close();
  return placed;
}

const HOUR = 46; // px for an hour

// Sunday to Saturday as columns, the hours down the side, each thing a block
// at its time. Things with no time (and events over several days) sit in a
// row along the top.
export function WeekGrid({ weekStart, todayKey, nowMinutes, itemsOn, onShift, onToday }) {
  const days = Array.from({ length: 7 }, (_, i) => shiftKey(weekStart, i));
  const perDay = days.map((key) => itemsOn(key));
  // Nothing runs past midnight on the grid.
  const timed = perDay.map((list) =>
    list
      .filter((x) => !x.allDay && x.start !== null)
      .map((x) => ({ ...x, start: Math.min(x.start, 24 * 60 - 20), end: Math.min(Math.max(x.end ?? x.start + 30, x.start + 20), 24 * 60) }))
  );
  const allDay = perDay.map((list) => list.filter((x) => x.allDay || x.start === null));
  const anyAllDay = allDay.some((l) => l.length);

  // The hours on show: 7am to 10pm, stretched to fit anything earlier or later.
  const starts = timed.flat().map((x) => x.start);
  const ends = timed.flat().map((x) => x.end);
  const first = Math.min(7, ...starts.map((m) => Math.floor(m / 60)));
  const last = Math.min(24, Math.max(22, ...ends.map((m) => Math.ceil(m / 60))));
  const hours = Array.from({ length: last - first }, (_, i) => first + i);
  const top = (mins) => ((mins - first * 60) / 60) * HOUR;

  const thisWeek = days.includes(todayKey);
  const label = (() => {
    const a = dateOf(days[0]);
    const b = dateOf(days[6]);
    const month = (d) => d.toLocaleDateString(undefined, { month: 'short' });
    return a.getMonth() === b.getMonth()
      ? `${a.getDate()} – ${b.getDate()} ${month(b)} ${b.getFullYear()}`
      : `${a.getDate()} ${month(a)} – ${b.getDate()} ${month(b)} ${b.getFullYear()}`;
  })();

  // Open at the morning (or at now, this week) rather than at midnight.
  const scroller = useRef(null);
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const at = thisWeek ? Math.max(first * 60, nowMinutes - 90) : Math.min(...starts, 8 * 60);
    el.scrollTop = Math.max(0, top(at) - 8);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekStart]);

  return (
    <div className="card wk-card">
      <div className="month-head">
        <button type="button" className="icon-btn" onClick={() => onShift(-1)} aria-label="Previous week">
          <ChevronLeft size={16} />
        </button>
        <div className="month-title">
          <strong>{label}</strong>
          {!thisWeek && (
            <button type="button" className="week-bar-today" onClick={onToday}>
              Back to this week
            </button>
          )}
        </div>
        <button type="button" className="icon-btn" onClick={() => onShift(1)} aria-label="Next week">
          <ChevronRight size={16} />
        </button>
      </div>

      <div className="wk-scroll" ref={scroller}>
        <div className="wk">
          {/* the days along the top */}
          <div className="wk-head">
            <span className="wk-corner" />
            {days.map((key) => {
              const d = dateOf(key);
              return (
                <div key={key} className={`wk-day${key === todayKey ? ' today' : ''}${key < todayKey ? ' past' : ''}`}>
                  <small>{d.toLocaleDateString(undefined, { weekday: 'short' })}</small>
                  <b>{d.getDate()}</b>
                </div>
              );
            })}
          </div>
          {anyAllDay && (
            <div className="wk-allday">
              <span className="wk-corner">all day</span>
              {allDay.map((list, i) => (
                <div key={days[i]} className="wk-allday-cell">
                  {list.map((x) => (
                    <button key={x.key} type="button" className={`wk-chip tone-${x.tone}`} style={{ '--hue': x.hue }} onClick={x.open} title={x.title}>
                      {x.title}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          )}

          {/* the hours down the side, a column a day */}
          <div className="wk-body" style={{ height: hours.length * HOUR }}>
            <div className="wk-gutter">
              {hours.map((h) => (
                <span key={h} style={{ top: (h - first) * HOUR }}>
                  {h === 0 ? '' : shortTime(h * 60).replace(':00', '')}
                </span>
              ))}
            </div>
            {days.map((key, i) => (
              <div key={key} className={`wk-col${key === todayKey ? ' today' : ''}`} style={{ '--hour': `${HOUR}px` }}>
                {layout(timed[i]).map((x) => {
                  const h = Math.max(((x.end - x.start) / 60) * HOUR - 2, 18);
                  return (
                    <button
                      key={x.key}
                      type="button"
                      className={`wk-block tone-${x.tone}${h < 34 ? ' short' : ''}${key < todayKey || (key === todayKey && x.end <= nowMinutes) ? ' past' : ''}`}
                      style={{
                        '--hue': x.hue,
                        top: top(x.start) + 1,
                        height: h,
                        left: `calc(${(x.col / x.cols) * 100}% + 1px)`,
                        width: `calc(${100 / x.cols}% - 3px)`
                      }}
                      onClick={x.open}
                      title={`${x.title} · ${shortTime(x.start)} – ${shortTime(x.end)}`}
                    >
                      <strong>{x.title}</strong>
                      <span>
                        {shortTime(x.start)} – {shortTime(x.end)}
                      </span>
                    </button>
                  );
                })}
                {key === todayKey && nowMinutes >= first * 60 && nowMinutes <= last * 60 && <i className="wk-now" style={{ top: top(nowMinutes) }} />}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// What a month cell shows: the first few things, then "N more".
export function MonthCellItems({ items, max }) {
  const shown = items.slice(0, max);
  return (
    <span className="mc-items">
      {shown.map((x) => (
        <span key={x.key} className={`mc-item tone-${x.tone}${x.allDay || x.start === null ? ' bar' : ''}`} style={{ '--hue': x.hue }}>
          {!x.allDay && x.start !== null && <em>{shortTime(x.start)}</em>}
          {x.title}
        </span>
      ))}
      {items.length > max && <span className="mc-more">{items.length - max} more</span>}
    </span>
  );
}
