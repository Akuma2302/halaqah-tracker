import { BookOpen, LogOut } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useDelayedFlag } from '../hooks/useDelayedFlag';

export default function TopBar() {
  const { user, logout, serverReady } = useAuth();
  const waking = useDelayedFlag(!serverReady);

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
