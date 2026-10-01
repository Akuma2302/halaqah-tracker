import { useEffect, useState } from 'react';
import { Copy, Check, RefreshCw, Smartphone } from 'lucide-react';
import Sheet from './Sheet';
import client from '../services/apiClient';
import { buildScriptableScript } from '../features/widget/scriptableScript';

// The widget URL must be absolute (it's used outside the app). In production
// the API lives on Render (VITE_API_URL); in dev it's proxied on this origin.
function widgetUrl(token) {
  const base = import.meta.env.VITE_API_URL || window.location.origin;
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return `${base}/api/widget/${token}${tz ? `?tz=${encodeURIComponent(tz)}` : ''}`;
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
  const appUrl = window.location.origin;

  return (
    <Sheet open={open} onClose={onClose} title="Home screen widget">
      {loading ? (
        <div className="spinner" style={{ margin: '20px auto' }} />
      ) : !token ? (
        <div className="widget-intro">
          <span className="widget-intro-icon">
            <Smartphone size={22} />
          </span>
          <p>
            Show today's mutabaah score on your phone's home screen. This makes a private link that widget apps can
            read. Only your score for today is shared, nothing else.
          </p>
          {error && <p className="widget-error">{error}</p>}
          <button className="btn btn-primary btn-block" onClick={createLink} disabled={busy}>
            {busy ? 'Creating…' : 'Create widget link'}
          </button>
        </div>
      ) : (
        <div>
          <div className="range-toggle segmented">
            <button className={platform === 'iphone' ? 'active' : ''} onClick={() => setPlatform('iphone')}>
              iPhone
            </button>
            <button className={platform === 'android' ? 'active' : ''} onClick={() => setPlatform('android')}>
              Android
            </button>
          </div>

          {platform === 'iphone' ? (
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
              Anyone with this link can see today's score, so don't share it. Widgets refresh every 15–30 minutes;
              the first refresh can be slow while the server wakes up.
            </p>
            {error && <p className="widget-error">{error}</p>}
          </div>
        </div>
      )}
    </Sheet>
  );
}
