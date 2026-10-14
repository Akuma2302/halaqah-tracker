import { useEffect, useState } from 'react';
import { CalendarDays, Copy, Check, RefreshCw, Smartphone } from 'lucide-react';
import Sheet from './Sheet';
import client from '../services/apiClient';
import { buildScriptableScript } from '../features/widget/scriptableScript';
import { buildAgendaScript } from '../features/widget/agendaScript';
import Skeleton from './Skeleton';

// The widget URL must be absolute (it's used outside the app). In production
// the API lives on Render (VITE_API_URL); in dev it's proxied on this origin.
// `path` picks what is read: '' for today's mutabaah, '/agenda' for the
// timetable, '/calendar.ics' for the calendar feed.
function widgetUrl(token, path = '') {
  const base = import.meta.env.VITE_API_URL || window.location.origin;
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return `${base}/api/widget/${token}${path}${tz ? `?tz=${encodeURIComponent(tz)}` : ''}`;
}

function CopyButton({ text, label }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }
  return (
    <button type="button" className="btn btn-ghost btn-sm" onClick={copy}>
      {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? 'Copied' : label}
    </button>
  );
}

export default function WidgetSheet({ open, onClose }) {
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [platform, setPlatform] = useState(() => (/android/i.test(navigator.userAgent) ? 'android' : 'iphone'));
  // Which widget is being set up: today's mutabaah score, or the timetable.
  const [what, setWhat] = useState('timetable');

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError('');
    client
      .get('/widget/token')
      .then((res) => setToken(res.data.token))
      .catch(() => setError("Couldn't load your widget settings."))
      .finally(() => setLoading(false));
  }, [open]);

  async function run(request) {
    setBusy(true);
    setError('');
    try {
      const res = await request();
      setToken(res.data.token);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  const createLink = () => run(() => client.post('/widget/token'));
  const newLink = () => {
    if (window.confirm('Make a new link? Widgets using the old link will stop updating until you paste the new one.')) {
      run(() => client.post('/widget/token'));
    }
  };
  const turnOff = () => {
    if (window.confirm('Turn off the widget link? Any widgets using it will stop updating.')) {
      run(() => client.delete('/widget/token'));
    }
  };

  const url = token ? widgetUrl(token) : '';
  const agendaUrl = token ? widgetUrl(token, '/agenda') : '';
  const calendarUrl = token ? widgetUrl(token, '/calendar.ics') : '';
  const appUrl = window.location.origin;

  return (
    <Sheet open={open} onClose={onClose} title="Home screen widget">
      {loading ? (
        <Skeleton variant="lines" count={4} />
      ) : !token ? (
        <div className="widget-intro">
          <span className="widget-intro-icon">
            <Smartphone size={22} />
          </span>
          <p>
Put your timetable or today's mutabaah score on your phone's home screen. This makes a private link that
            widget and calendar apps can read. It shows only your timetable, your exams and due dates, and today's
            mutabaah score.
          </p>
          {error && <p className="widget-error">{error}</p>}
          <button className="btn btn-primary btn-block" onClick={createLink} disabled={busy}>
            {busy ? 'Creating…' : 'Create widget link'}
          </button>
        </div>
      ) : (
        <div>
          <div className="range-toggle segmented widget-what">
            <button className={what === 'timetable' ? 'active' : ''} onClick={() => setWhat('timetable')}>
              <CalendarDays size={14} /> Timetable
            </button>
            <button className={what === 'mutabaah' ? 'active' : ''} onClick={() => setWhat('mutabaah')}>
              <Smartphone size={14} /> Mutabaah score
            </button>
          </div>
          <div className="range-toggle segmented">
            <button className={platform === 'iphone' ? 'active' : ''} onClick={() => setPlatform('iphone')}>
              iPhone
            </button>
            <button className={platform === 'android' ? 'active' : ''} onClick={() => setPlatform('android')}>
              Android
            </button>
          </div>

          {what === 'timetable' ? (
            <>
              <h3 className="widget-heading">1. In your calendar app's own widget</h3>
              <p className="widget-lead">
                Subscribe once and your classes, exams, due dates and timed tasks appear in your calendar app, so its
                home screen widget shows them too.
              </p>
              {platform === 'iphone' ? (
                <ol className="widget-steps">
                  <li>
                    Tap the button to subscribe in <strong>Apple Calendar</strong>, then tap <strong>Subscribe</strong> and{' '}
                    <strong>Add</strong>.
                    <div className="widget-step-action">
                      <a className="btn btn-primary btn-sm" href={calendarUrl.replace(/^https?:/, 'webcal:')}>
                        <CalendarDays size={13} /> Subscribe in Calendar
                      </a>
                      <CopyButton text={calendarUrl} label="Copy calendar link" />
                    </div>
                  </li>
                  <li>
                    Long-press your home screen, tap <strong>+</strong>, and add the <strong>Calendar</strong> widget.
                  </li>
                  <li>
                    Prefer <strong>Google Calendar</strong>? On a computer open calendar.google.com, choose <strong>Other calendars +</strong>,{' '}
                    <strong>From URL</strong>, and paste the calendar link. Then add the Google Calendar widget.
                  </li>
                </ol>
              ) : (
                <ol className="widget-steps">
                  <li>
                    Copy your calendar link.
                    <div className="widget-step-action">
                      <CopyButton text={calendarUrl} label="Copy calendar link" />
                    </div>
                  </li>
                  <li>
                    On a computer open <strong>calendar.google.com</strong>, choose <strong>Other calendars +</strong>, <strong>From URL</strong>,
                    paste the link and add it. Google only allows this on the website, not in the phone app.
                  </li>
                  <li>
                    On your phone open <strong>Google Calendar</strong>, go to <strong>Settings</strong>, tap <strong>Double 4 Flat</strong> and turn on{' '}
                    <strong>Sync</strong>.
                  </li>
                  <li>
                    Long-press your home screen, tap <strong>Widgets</strong>, and add the <strong>Google Calendar</strong> widget.
                  </li>
                </ol>
              )}
              <p className="widget-note">Calendar apps fetch the link on their own schedule. Apple Calendar is usually within the hour; Google can take up to a day to show a change.</p>

              <h3 className="widget-heading">2. A Double 4 Flat widget</h3>
              {platform === 'iphone' ? (
                <ol className="widget-steps">
                  <li>
                    Install <strong>Scriptable</strong> (free) from the App Store.
                  </li>
                  <li>
                    Copy the script, open Scriptable, tap <strong>+</strong>, paste it and name it "Timetable".
                    <div className="widget-step-action">
                      <CopyButton text={buildAgendaScript({ dataUrl: agendaUrl, appUrl })} label="Copy script" />
                    </div>
                  </li>
                  <li>
                    Long-press your home screen, tap <strong>+</strong>, add a <strong>Scriptable</strong> widget. Small shows the date and what's
                    next, medium shows today and tomorrow, large adds the month.
                  </li>
                  <li>
                    Long-press the new widget, choose <strong>Edit Widget</strong>, and set Script to "Timetable".
                  </li>
                </ol>
              ) : (
                <ol className="widget-steps">
                  <li>
                    Install <strong>KWGT Kustom Widget Maker</strong> (free) from the Play Store, add a <strong>KWGT</strong> widget and tap it to
                    edit.
                  </li>
                  <li>
                    Add a <strong>Text</strong> item and set its text to this formula. It lists today's classes and tasks, one per line.
                    <code className="widget-code">$wg("{agendaUrl}", json, ".summary")$</code>
                    <div className="widget-step-action">
                      <CopyButton text={`$wg("${agendaUrl}", json, ".summary")$`} label="Copy formula" />
                    </div>
                  </li>
                  <li>
                    Swap <code>.summary</code> for <code>.tomorrow</code> in a second Text item to show tomorrow as well.
                  </li>
                </ol>
              )}
            </>
          ) : platform === 'iphone' ? (
            <ol className="widget-steps">
              <li>
                Install <strong>Scriptable</strong> (free) from the App Store.
              </li>
              <li>
                Copy the script below, open Scriptable, tap <strong>+</strong>, paste it and name it "Mutabaah".
                <div className="widget-step-action">
                  <CopyButton text={buildScriptableScript({ dataUrl: url, appUrl })} label="Copy script" />
                </div>
              </li>
              <li>
                Long-press your home screen, tap <strong>+</strong>, add a <strong>Scriptable</strong> widget (small or
                medium).
              </li>
              <li>
                Long-press the new widget, choose <strong>Edit Widget</strong>, and set Script to "Mutabaah".
              </li>
            </ol>
          ) : (
            <ol className="widget-steps">
              <li>
                Install <strong>KWGT Kustom Widget Maker</strong> (free) from the Play Store.
              </li>
              <li>
                Long-press your home screen, add a <strong>KWGT</strong> widget, then tap it to edit.
              </li>
              <li>
                Add a <strong>Text</strong> item and set its text to this formula:
                <code className="widget-code">$wg("{url}", json, ".summary")$</code>
                <div className="widget-step-action">
                  <CopyButton text={`$wg("${url}", json, ".summary")$`} label="Copy formula" />
                </div>
              </li>
              <li>
                Save. It shows e.g. "3/7 · 43%". Swap <code>.summary</code> for <code>.percent</code>,{' '}
                <code>.streak</code> or <code>.tilawahPages</code> to show other values.
              </li>
            </ol>
          )}

          <div className="widget-link">
            <span className="field-label">Your private link</span>
            <code className="widget-code">{url}</code>
            <div className="widget-link-actions">
              <CopyButton text={url} label="Copy link" />
              <button className="btn btn-ghost btn-sm" onClick={newLink} disabled={busy}>
                <RefreshCw size={13} /> New link
              </button>
              <button className="btn btn-ghost btn-sm widget-off" onClick={turnOff} disabled={busy}>
                Turn off
              </button>
            </div>
            <p className="widget-note">
Anyone with this link can see your timetable, exams, due dates and today's score, so don't share it.
              Widgets refresh every 15–30 minutes; the first refresh can be slow while the server wakes up.
            </p>
            {error && <p className="widget-error">{error}</p>}
          </div>
        </div>
      )}
    </Sheet>
  );
}
