import { LogOut } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

export default function TopBar() {
  const { user, logout } = useAuth();

  return (
    <header className="top-bar">
      <div className="top-bar-inner">
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