import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import Login from './components/Login';
import TabNav from './layout/TabNav';
import Dashboard from './pages/Dashboard';
import Checklist from './pages/Checklist';
import Groups from './pages/Groups';
import StudyGroups from './pages/StudyGroups';
import StudyGroupRoom from './pages/StudyGroupRoom';
import AcademicJournal from './pages/AcademicJournal';
import SubjectList from './pages/SubjectList';
import Compilation from './pages/Compilation';
import Notifications from './pages/Notifications';

export default function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="center-screen">
        <div className="spinner" />
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  return (
    <div className="app-shell">
      <TabNav />
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/checklist" element={<Checklist />} />
        <Route path="/groups" element={<Groups />} />
        <Route path="/study-groups" element={<StudyGroups />} />
        <Route path="/study-groups/:id" element={<StudyGroupRoom />} />
        <Route path="/academic-journal" element={<AcademicJournal />} />
        <Route path="/subject-list" element={<SubjectList />} />
        <Route path="/compilation" element={<Compilation />} />
        <Route path="/notifications" element={<Notifications />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}
