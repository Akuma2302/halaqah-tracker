import { useEffect, useRef, useState } from 'react';
import { BookOpen, LayoutGrid, LogOut, Moon, Sun, UserRound } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useDelayedFlag } from '../hooks/useDelayedFlag';
import { useTheme } from '../hooks/useTheme';
import ProfileSheet from '../components/ProfileSheet';
import WidgetSheet from '../components/WidgetSheet';

export default function TopBar() {
  const { user, logout, serverReady } = useAuth();
  const waking = useDelayedFlag(!serverReady);
  const { theme, toggleTheme } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [widgetOpen, setWidgetOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e) => !menuRef.current?.contains(e.target) && setMenuOpen(false);
    const onKey = (e) => e.key === 'Escape' && setMenuOpen(false);
    document.addEventListener('pointerdown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  function pick(action) {
    setMenuOpen(false);
    action();
  }

  return (
    <>
    <header className="top-bar">
      <div className="top-bar-inner">
        <div className="top-bar-brand">
          <span className="brand-mark">
            <BookOpen size={15} />
          </span>
          <span className="top-bar-brand-name">Double 4 Flat</span>
        </div>

        {waking && (
          <span className="waking-pill" role="status">
            <span className="waking-dot" /> Connecting…
          </span>
        )}

        <div className="user-menu" ref={menuRef}>
          <button
            className="user-chip user-chip-btn"
            onClick={() => setMenuOpen((v) => !v)}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-label="Account menu"
          >
            {user?.avatarUrl ? <img className="avatar" src={user.avatarUrl} alt="" /> : <div className="avatar" />}
            <span className="name">{user?.name}</span>
          </button>

          {menuOpen && (
            <div className="user-menu-pop" role="menu">
              <div className="user-menu-head">
                <span className="user-menu-name">{user?.name}</span>
                <span className="user-menu-sub">{user?.kampus || 'No kampus set'}</span>
              </div>
              <button role="menuitem" className="user-menu-item" onClick={() => pick(() => setProfileOpen(true))}>
                <UserRound size={16} /> Edit profile
              </button>
              <button role="menuitem" className="user-menu-item" onClick={() => pick(() => setWidgetOpen(true))}>
                <LayoutGrid size={16} /> Home screen widget
              </button>
              <button role="menuitem" className="user-menu-item" onClick={() => pick(toggleTheme)}>
                {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
                {theme === 'dark' ? 'Light mode' : 'Dark mode'}
              </button>
              <button role="menuitem" className="user-menu-item danger" onClick={() => pick(logout)}>
                <LogOut size={16} /> Log out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>

    {/* Outside the sticky header so its stacking context doesn't trap the sheet under the bottom nav */}
    <ProfileSheet open={profileOpen} onClose={() => setProfileOpen(false)} />
    <WidgetSheet open={widgetOpen} onClose={() => setWidgetOpen(false)} />
    </>
  );
}
