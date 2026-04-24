import { Navigate } from 'react-router-dom';
import { useStore } from '../lib/store';

interface Props {
  children: React.ReactNode;
}

export default function ProtectedRoute({ children }: Props) {
  const { user, authLoading, profile } = useStore();

  if (authLoading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (!profile?.onboardingComplete) return <Navigate to="/onboarding" replace />;

  return <>{children}</>;
}
