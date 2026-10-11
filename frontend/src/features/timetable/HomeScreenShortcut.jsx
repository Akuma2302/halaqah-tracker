import { useEffect, useState } from 'react';
import { Smartphone } from 'lucide-react';
import Sheet from '../../components/Sheet';

// What "Add to Home Screen" should make while this page is open: the
// Timetable's own name, icon and starting page instead of the main app's.
// The page's head is put back when you leave.
function useTimetableInstallTarget() {
  useEffect(() => {
    const swaps = [
      ['link[rel="manifest"]', 'href', '/manifest-timetable.json'],
      ['link[rel="apple-touch-icon"]', 'href', '/apple-touch-icon-timetable.png'],
      ['meta[name="apple-mobile-web-app-title"]', 'content', 'Timetable']
    ]
      .map(([selector, attribute, value]) => {
        const element = document.querySelector(selector);
        if (!element) return null;
        const before = element.getAttribute(attribute);
        element.setAttribute(attribute, value);
        return () => element.setAttribute(attribute, before);
      })
      .filter(Boolean);
    return () => swaps.forEach((restore) => restore());
  }, []);
}

// A link under the Timetable that explains how to put it on the phone's home
// screen as its own icon, for iPhone and for Android.
export default function HomeScreenShortcut() {
  useTimetableInstallTarget();
  const [open, setOpen] = useState(false);
  const [platform, setPlatform] = useState(() => (/android/i.test(navigator.userAgent) ? 'android' : 'iphone'));
  const address = `${window.location.origin}/timetable`;

  return (
    <>
      <button type="button" className="home-shortcut-link" onClick={() => setOpen(true)}>
        <Smartphone size={14} /> Put the Timetable on your home screen
      </button>

      <Sheet open={open} onClose={() => setOpen(false)} title="Timetable on your home screen">
        <p className="home-shortcut-intro">
          <img src="/icon-timetable-192.png" alt="" width="44" height="44" />
          <span>An icon of its own that opens straight to your Timetable.</span>
        </p>
        <div className="range-toggle segmented">
          <button className={platform === 'iphone' ? 'active' : ''} onClick={() => setPlatform('iphone')}>
            iPhone
          </button>
          <button className={platform === 'android' ? 'active' : ''} onClick={() => setPlatform('android')}>
            Android
          </button>
        </div>

        {platform === 'iphone' ? (
          <ol className="widget-steps home-shortcut-steps">
            <li>
              Open <strong>Safari</strong> and go to <code>{address}</code>. It has to be Safari, not the app icon you already have.
            </li>
            <li>
              Tap the <strong>Share</strong> button, then <strong>Add to Home Screen</strong>.
            </li>
            <li>
              The name should say <strong>Timetable</strong> with a calendar icon. Tap <strong>Add</strong>.
            </li>
            <li>Open the new icon and sign in once. iPhone keeps each home screen icon's sign-in separate.</li>
          </ol>
        ) : (
          <ol className="widget-steps home-shortcut-steps">
            <li>
              <strong>Quickest:</strong> if the app is already installed, press and hold its icon and tap <strong>Timetable</strong>. You can drag
              that shortcut onto the home screen.
            </li>
            <li>
              <strong>Or its own icon:</strong> open <strong>Chrome</strong> and go to <code>{address}</code>.
            </li>
            <li>
              Tap the <strong>⋮</strong> menu, then <strong>Add to Home screen</strong> (or <strong>Install app</strong>), and confirm.
            </li>
          </ol>
        )}
        <p className="field-hint">The long-press shortcuts appear after the app has been reinstalled or updated by the phone, which can take a day.</p>
      </Sheet>
    </>
  );
}
