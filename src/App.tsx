import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { BoardingManagement } from './pages/BoardingManagement';
import ReservationManagement from './pages/ReservationManagement';
import { ShiftManagement } from './pages/ShiftManagement';
import { TimeClock } from './pages/TimeClock';
import { Messages } from './pages/Messages';
import { Weather } from './pages/Weather';
import { Settings } from './pages/Settings';
import { KnowledgeBase } from './pages/KnowledgeBase';
import DailyClosing from './pages/DailyClosing';
import DailyReportsPage from './pages/DailyReportsPage';
import DailyReportDetail from './pages/DailyReportDetail';
import { BulkUpload } from './pages/BulkUpload';
import { doc, getDoc } from 'firebase/firestore';
import { db, auth } from './lib/firebase';
import { signOut } from 'firebase/auth';

function UserExistenceCheck() {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser } = useAuth();

  useEffect(() => {
    const checkUserExists = async () => {
      if (!auth.currentUser) return;
      if (location.pathname === '/login') return;

      try {
        const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));

        if (!userDoc.exists()) {
          alert('⚠️ このアカウントは無効化されています。\n管理者に連絡してください。');
          await signOut(auth);
          navigate('/login');
        }
      } catch (error) {
        console.error('ユーザー存在チェックエラー:', error);
      }
    };

    checkUserExists();
  }, [currentUser, navigate, location]);

  return null;
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <UserExistenceCheck />
          <Routes>
            <Route path="/login" element={<Login />} />

            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              }
            />

            <Route
              path="/boarding"
              element={
                <ProtectedRoute allowedRoles={['owner_executive', 'admin', 'reception']}>
                  <BoardingManagement />
                </ProtectedRoute>
              }
            />

            <Route
              path="/reservations"
              element={
                <ProtectedRoute allowedRoles={['owner_executive', 'admin', 'reception']}>
                  <ReservationManagement />
                </ProtectedRoute>
              }
            />

            <Route
              path="/shifts"
              element={
                <ProtectedRoute>
                  <ShiftManagement />
                </ProtectedRoute>
              }
            />

            <Route
              path="/time-clock"
              element={
                <ProtectedRoute allowedRoles={['owner_executive', 'admin']}>
                  <TimeClock />
                </ProtectedRoute>
              }
            />

            <Route
              path="/messages"
              element={
                <ProtectedRoute>
                  <Messages />
                </ProtectedRoute>
              }
            />

            <Route
              path="/weather"
              element={
                <ProtectedRoute>
                  <Weather />
                </ProtectedRoute>
              }
            />

            <Route
              path="/daily-closing"
              element={
                <ProtectedRoute allowedRoles={['owner_executive', 'admin']}>
                  <DailyClosing />
                </ProtectedRoute>
              }
            />

            <Route
              path="/daily-reports"
              element={
                <ProtectedRoute>
                  <DailyReportsPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/daily-reports/:date"
              element={
                <ProtectedRoute>
                  <DailyReportDetail />
                </ProtectedRoute>
              }
            />

            <Route
              path="/settings"
              element={
                <ProtectedRoute allowedRoles={['owner_executive', 'admin']}>
                  <Settings />
                </ProtectedRoute>
              }
            />

            <Route
              path="/knowledge"
              element={
                <ProtectedRoute>
                  <KnowledgeBase />
                </ProtectedRoute>
              }
            />

            <Route
              path="/bulk-upload"
              element={
                <ProtectedRoute allowedRoles={['owner_executive', 'admin']}>
                  <BulkUpload />
                </ProtectedRoute>
              }
            />

            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
