import { NavLink } from 'react-router-dom';
import { LayoutDashboard, ListChecks, Users, GraduationCap, BookMarked, Bell, LogOut } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

const TABS = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/checklist', label: 'Checklist', icon: ListChecks },
  { to: '/groups', label: 'Groups', icon: Users },
  { to: '/study-groups', label: 'Study groups', icon: GraduationCap },
  { to: '/compilation', label: 'Compilation', icon: BookMarked },
  { to: '/notifications', label: 'Notifications', icon: Bell }
];

export default function TabNav() {
  const { user, logout } = useAuth();

  return (
    <>
      <header className="top-bar">
        <div className="top-bar-inner">
          <div className="brand">
            <span className="brand-mark">M</span>
            Mutabaah
          </div>
          <div className="user-chip">
            {user?.avatarUrl ? (
              <img className="avatar" src={user.avatarUrl} alt={user.name} />
            ) : (
              <div className="avatar" />
            )}
            <span className="name">{user?.name}</span>
            <button className="icon-btn" onClick={logout} title="Log out" aria-label="Log out">
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </header>

      <nav className="tab-nav">
        <div className="tab-nav-inner">
          {TABS.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) => `tab-link${isActive ? ' active' : ''}`}
            >
              <Icon size={15} />
              {label}
            </NavLink>
          ))}
        </div>
      </nav>
    </>
  );
}
