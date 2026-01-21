import { BrowserRouter, Routes, Route, Link, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { Home } from './pages/Home';
import { TeacherLogin } from './pages/TeacherLogin';
import { TeacherDashboard } from './pages/TeacherDashboard';
import { TeacherMonitor } from './pages/TeacherMonitor';
import { StudentLogin } from './pages/StudentLogin';
import { StudentExam } from './pages/StudentExam';
import { StudentResult } from './pages/StudentResult';
import { Settings } from './pages/Settings';
import { GraduationCap, Settings as SettingsIcon, AlertCircle, LogOut } from 'lucide-react';
import { hasApiKey } from './lib/geminiService';
import { isTeacherLoggedIn, getTeacherSession, logoutTeacher } from './data/accountvip';
import './index.css';

// Modal bắt buộc nhập API Key
function ApiKeyModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="modal-overlay">
      <div className="modal" style={{ maxWidth: '500px' }}>
        <div className="text-center">
          <div style={{
            width: '80px',
            height: '80px',
            borderRadius: '50%',
            background: 'rgba(239, 68, 68, 0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 1rem'
          }}>
            <AlertCircle size={40} style={{ color: 'var(--danger)' }} />
          </div>
          <h2 className="mb-2">Cần API Key để sử dụng App</h2>
          <p className="text-muted mb-4">
            Bạn cần nhập Gemini API Key để sử dụng tính năng phân tích đề thi.
          </p>

          <div style={{
            background: 'var(--bg-tertiary)',
            padding: '1rem',
            borderRadius: 'var(--radius-md)',
            textAlign: 'left',
            marginBottom: '1.5rem'
          }}>
            <p className="text-sm mb-2"><strong>Cách lấy API Key:</strong></p>
            <ol className="text-sm text-muted" style={{ paddingLeft: '1.25rem', lineHeight: '1.6' }}>
              <li>Truy cập <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer">aistudio.google.com/app/apikey</a></li>
              <li>Đăng nhập Google và tạo API Key</li>
              <li>Copy key và nhập vào phần Cài đặt</li>
            </ol>
          </div>

          <Link to="/settings" className="btn btn-primary btn-lg" onClick={onClose}>
            <SettingsIcon size={20} />
            Đến trang Cài đặt
          </Link>
        </div>
      </div>
    </div>
  );
}

// Component bảo vệ route giáo viên
function ProtectedTeacherRoute({ children }: { children: React.ReactNode }) {
  if (!isTeacherLoggedIn()) {
    return <Navigate to="/teacher/login" replace />;
  }
  return <>{children}</>;
}

function App() {
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [hasKey, setHasKey] = useState(true);
  const [teacherLoggedIn, setTeacherLoggedIn] = useState(isTeacherLoggedIn());

  useEffect(() => {
    // Kiểm tra API key khi app load
    const checkKey = () => {
      const hasIt = hasApiKey();
      setHasKey(hasIt);
      if (!hasIt) {
        setShowApiKeyModal(true);
      }
    };
    checkKey();

    // Kiểm tra lại khi localStorage thay đổi
    const handleStorage = () => {
      checkKey();
      setTeacherLoggedIn(isTeacherLoggedIn());
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  // Cập nhật trạng thái đăng nhập
  useEffect(() => {
    const interval = setInterval(() => {
      setTeacherLoggedIn(isTeacherLoggedIn());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleLogout = () => {
    logoutTeacher();
    setTeacherLoggedIn(false);
    window.location.href = '/';
  };

  const teacherSession = getTeacherSession();

  return (
    <BrowserRouter>
      <div className="app">
        <nav className="navbar">
          <Link to="/" className="navbar-brand">
            <GraduationCap size={32} />
            <span>ExamApp</span>
          </Link>
          <div className="navbar-nav flex items-center gap-4">
            {/* Hiển thị thông tin giáo viên nếu đã đăng nhập */}
            {teacherLoggedIn && teacherSession && (
              <div className="flex items-center gap-2">
                <span className="text-sm" style={{ color: 'var(--success)' }}>
                  👋 Xin chào, {teacherSession.name}
                </span>
                <button
                  onClick={handleLogout}
                  className="btn btn-sm"
                  style={{ background: 'var(--danger)', color: 'white' }}
                  title="Đăng xuất"
                >
                  <LogOut size={16} />
                </button>
              </div>
            )}

            {/* Nút Settings với text đỏ nếu chưa có API Key */}
            <Link
              to="/settings"
              className="btn btn-outline btn-sm"
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                padding: '0.5rem 1rem',
                gap: '0.25rem'
              }}
            >
              <div className="flex items-center gap-2">
                <SettingsIcon size={18} />
                <span>Cài đặt API Key</span>
              </div>
              {!hasKey && (
                <span style={{
                  color: 'var(--danger)',
                  fontSize: '0.7rem',
                  fontWeight: 'bold'
                }}>
                  ⚠️ Lấy API key để sử dụng app
                </span>
              )}
            </Link>
          </div>
        </nav>

        {showApiKeyModal && !hasKey && (
          <ApiKeyModal onClose={() => setShowApiKeyModal(false)} />
        )}

        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/teacher/login" element={<TeacherLogin />} />
          <Route path="/teacher" element={
            <ProtectedTeacherRoute>
              <TeacherDashboard />
            </ProtectedTeacherRoute>
          } />
          <Route path="/teacher/monitor/:examId" element={
            <ProtectedTeacherRoute>
              <TeacherMonitor />
            </ProtectedTeacherRoute>
          } />
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
