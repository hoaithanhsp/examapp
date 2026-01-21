import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import { Home } from './pages/Home';
import { TeacherDashboard } from './pages/TeacherDashboard';
import { TeacherMonitor } from './pages/TeacherMonitor';
import { StudentLogin } from './pages/StudentLogin';
import { StudentExam } from './pages/StudentExam';
import { StudentResult } from './pages/StudentResult';
import { Settings } from './pages/Settings';
import { GraduationCap, Settings as SettingsIcon } from 'lucide-react';
import './index.css';

function App() {
  return (
    <BrowserRouter>
      <div className="app">
        <nav className="navbar">
          <Link to="/" className="navbar-brand">
            <GraduationCap size={32} />
            <span>ExamApp</span>
          </Link>
          <div className="navbar-nav">
            <Link to="/settings" className="btn btn-outline btn-sm">
              <SettingsIcon size={18} />
              Cài đặt
            </Link>
          </div>
        </nav>

        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/teacher" element={<TeacherDashboard />} />
          <Route path="/teacher/monitor/:examId" element={<TeacherMonitor />} />
          <Route path="/student" element={<StudentLogin />} />
          <Route path="/student/exam/:submissionId" element={<StudentExam />} />
          <Route path="/student/result/:submissionId" element={<StudentResult />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;
