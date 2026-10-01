import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import Login from './components/Login';
import BootScreen from './components/BootScreen';
import SideNav from './layout/SideNav';
import BottomNav from './layout/BottomNav';
import TopBar from './layout/TopBar';
import Dashboard from './pages/Dashboard';
import Checklist from './pages/Checklist';
import StudyGroups from './pages/StudyGroups';
import StudyGroupRoom from './pages/StudyGroupRoom';
import AcademicJournal from './pages/AcademicJournal';
import SubjectList from './pages/SubjectList';
import Notifications from './pages/Notifications';

// Loaded on demand: the Mathurat text is the largest chunk of the app.
const Mathurat = lazy(() => import('./pages/Mathurat'));
const QuranIndex = lazy(() => import('./pages/QuranIndex'));
const QuranSurah = lazy(() => import('./pages/QuranSurah'));

const pageFallback = (
  <div className="page">
    <div className="spinner" />
  </div>
);

export default function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return <BootScreen />;
  }

  if (!user) {
    return <Login />;
  }

  return (
    <div className="app-shell">
      <SideNav />
      <div className="app-main">
        <TopBar />
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/checklist" element={<Checklist />} />
          <Route path="/study-groups" element={<StudyGroups />} />
          <Route path="/study-groups/:id" element={<StudyGroupRoom />} />
          <Route path="/academic-journal" element={<AcademicJournal />} />
          <Route path="/subject-list" element={<SubjectList />} />
          <Route
            path="/mathurat"
            element={
              <Suspense fallback={pageFallback}>
                <Mathurat />
              </Suspense>
            }
          />
          <Route
            path="/quran"
            element={
              <Suspense fallback={pageFallback}>
                <QuranIndex />
              </Suspense>
            }
          />
          <Route
            path="/quran/:surah"
            element={
              <Suspense fallback={pageFallback}>
                <QuranSurah />
              </Suspense>
            }
          />
          <Route path="/compilation" element={<Navigate to="/mathurat" replace />} />
          <Route path="/notifications" element={<Notifications />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
      <BottomNav />
    </div>
  );
}
