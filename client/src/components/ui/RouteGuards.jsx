import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { LoadingBlock } from './Feedback.jsx';

export const ProtectedRoute = ({ children, roles }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <LoadingBlock label="Checking your session…" />;

  if (!user) {
    const redirect = `${location.pathname}${location.search}`;
    return <Navigate to={`/login?redirect=${encodeURIComponent(redirect)}`} replace />;
  }

  if (roles && !roles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  return children;
};

export const GuestOnlyRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <LoadingBlock label="Checking your session…" />;
  if (user) return <Navigate to={user.role === 'CUSTOMER' ? '/' : '/admin'} replace />;
  return children;
};
