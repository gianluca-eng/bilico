import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import { useStore } from './lib/store';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import OnboardingPage from './pages/OnboardingPage';
import FamilyPage from './pages/FamilyPage';
import JoinPage from './pages/JoinPage';
import ProtectedRoute from './components/ProtectedRoute';
import { Wordmark } from './components/BalanceScale';
import { CREAM } from './components/tokens';

function Splash() {
  return (
    <div style={{
      minHeight: '100svh',
      backgroundColor: CREAM,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      <Wordmark size={22} />
    </div>
  );
}

function App() {
  useAuth();
  const { authLoading } = useStore();

  if (authLoading) return <Splash />;

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/onboarding" element={<OnboardingPage />} />
        <Route path="/join/:familyId" element={<JoinPage />} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/family"
          element={
            <ProtectedRoute>
              <FamilyPage />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
