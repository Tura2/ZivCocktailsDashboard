import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthUser } from '@/lib/useAuthUser';

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, initializing } = useAuthUser();

  if (initializing) {
    return <div className="min-h-screen grid place-items-center">Loading…</div>;
  }

  if (!user) {
    return <Navigate to="/auth/login" replace />;
  }

  return <>{children}</>;
}
