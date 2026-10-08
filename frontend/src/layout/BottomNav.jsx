import { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Home, ListChecks, GraduationCap, NotebookText, Menu, ClipboardList, BookMarked, BookOpenText, Bell, CalendarDays, ChevronRight, Network } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

// Mobile-only navigation (hidden above 720px, where SideNav takes over).
const TABS = [
  { to: '/', label: 'Home', icon: Home, end: true },
  { to: '/checklist', label: 'Mutabaah', icon: ListChecks },
  { to: '/study-groups', label: 'Groups', icon: GraduationCap },
  { to: '/academic-journal', label: 'Academic', icon: NotebookText }
];

const MORE = [
  { to: '/subject-list', label: 'Subjects', icon: ClipboardList },
  { to: '/timetable', label: 'Timetable', icon: CalendarDays },
  { to: '/quran', label: 'Al-Quran', icon: BookOpenText },
  { to: '/mathurat', label: 'Al-Mathurat', icon: BookMarked },
  { to: '/mentoring', label: 'Mentoring Tree', icon: Network },
  { to: '/notifications', label: 'Notifications', icon: Bell }
];

export default function BottomNav() {
  const { unreadCount } = useAuth();
  const { pathname } = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);

  const moreActive = MORE.some((m) => pathname.startsWith(m.to));
  const badge = unreadCount > 9 ? '9+' : unreadCount;

  useEffect(() => setMoreOpen(false), [pathname]);

  useEffect(() => {
    if (!moreOpen) return;
    const onKey = (e) => e.key === 'Escape' && setMoreOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [moreOpen]);

  return (
    <>
      {moreOpen && (
        <div className="more-backdrop" onClick={() => setMoreOpen(false)}>
          <div className="more-sheet" role="dialog" aria-label="More" onClick={(e) => e.stopPropagation()}>
            <span className="more-handle" />
            {MORE.map(({ to, label, icon: Icon }) => (
              <NavLink key={to} to={to} className={({ isActive }) => `more-link${isActive ? ' active' : ''}`}>
                <span className="more-link-icon">
                  <Icon size={18} />
                </span>
                <span className="more-link-label">{label}</span>
                {to === '/notifications' && unreadCount > 0 && <span className="tab-badge">{badge}</span>}
                <ChevronRight size={16} className="more-link-chevron" />
              </NavLink>
            ))}
          </div>
        </div>
      )}

      <nav className="bottom-nav" aria-label="Main">
        {TABS.map(({ to, label, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end} className={({ isActive }) => `bottom-nav-link${isActive ? ' active' : ''}`}>
            <span className="bottom-nav-icon">
              <Icon size={20} />
            </span>
            <span>{label}</span>
          </NavLink>
        ))}
        <button
          type="button"
          className={`bottom-nav-link${moreActive || moreOpen ? ' active' : ''}`}
          onClick={() => setMoreOpen((v) => !v)}
          aria-expanded={moreOpen}
        >
          <span className="bottom-nav-icon">
            <Menu size={20} />
            {unreadCount > 0 && <span className="side-nav-badge">{badge}</span>}
          </span>
          <span>More</span>
        </button>
      </nav>
    </>
  );
}
