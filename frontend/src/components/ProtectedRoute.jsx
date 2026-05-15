import { Navigate } from 'react-router-dom';
import { getToken } from '../lib/auth';

export default function ProtectedRoute({ children }) {
  const storedToken = getToken();
  if (!storedToken) return <Navigate to="/login" replace />;
  return children;
}
