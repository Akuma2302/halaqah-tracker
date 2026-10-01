import { BookOpen, LogOut, Moon, Sun } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useDelayedFlag } from '../hooks/useDelayedFlag';
import { useTheme } from '../hooks/useTheme';

export default function TopBar() {
  const { user, logout, serverReady } = useAuth();
  const waking = useDelayedFlag(!serverReady);
  const { theme, toggleTheme } = useTheme();
  const nextLabel = theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode';

  return (
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

        <div className="user-chip">
          <button className="icon-btn" onClick={toggleTheme} title={nextLabel} aria-label={nextLabel}>
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          {user?.avatarUrl ? <img className="avatar" src={user.avatarUrl} alt={user.name} /> : <div className="avatar" />}
          <span className="name">{user?.name}</span>
          <button className="icon-btn" onClick={logout} title="Log out" aria-label="Log out">
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </header>
  );
}
