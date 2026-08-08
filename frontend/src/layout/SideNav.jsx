import { NavLink } from 'react-router-dom';
import { LayoutDashboard, ListChecks, GraduationCap, BookMarked, Bell, BookOpen, ClipboardList } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

const TABS = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/checklist', label: 'Checklist', icon: ListChecks },
  { to: '/study-groups', label: 'Your Groups', icon: GraduationCap },
  { to: '/academic-journal', label: 'Academic', icon: BookOpen },
  { to: '/subject-list', label: 'Subjects', icon: ClipboardList },
  { to: '/compilation', label: 'Compilation', icon: BookMarked },
  { to: '/notifications', label: 'Notify', icon: Bell }
];

export default function SideNav() {
  const { unreadCount } = useAuth();

  return (
    <nav className="side-nav">
      <div className="side-nav-brand">
        <span className="brand-mark">M</span>
      </div>

      <div className="side-nav-links">
        {TABS.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) => `side-nav-link${isActive ? ' active' : ''}`}
            title={label}
          >
            <span className="side-nav-icon-wrap">
              <Icon size={19} />
              {to === '/notifications' && unreadCount > 0 && (
                <span className="side-nav-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>
              )}
            </span>
            <span className="side-nav-label">{label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}