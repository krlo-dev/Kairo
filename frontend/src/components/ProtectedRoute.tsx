import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useMe } from '../hooks/useMe';
import { useAuthStore } from '../store/auth.store';

export function ProtectedRoute() {
  const location = useLocation();
  const { isLoading, isError } = useMe();
  const user = useAuthStore((s) => s.user);

  if (isLoading && !user) {
    return (
      <div className="flex min-h-full items-center justify-center">
        <p className="text-kairo-small text-neutral-500">Cargando...</p>
      </div>
    );
  }

  if (isError || !user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (!user.emailVerified) {
    return <Navigate to="/verify-email" replace />;
  }

  return <Outlet />;
}
