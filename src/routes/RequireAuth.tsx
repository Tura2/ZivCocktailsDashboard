import { ReactNode, useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthUser } from '@/lib/useAuthUser';
import { LogoLoading } from '@/components/ui/LogoLoading';

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, initializing } = useAuthUser();

  const [showSplash, setShowSplash] = useState(true);
  const [splashLoading, setSplashLoading] = useState(true);
  const [splashMessage, setSplashMessage] = useState('Authenticating…');

  useEffect(() => {
    if (initializing) {
      setShowSplash(true);
      setSplashLoading(true);
      setSplashMessage('Authenticating…');
      return;
    }

    // Auth state is resolved; don't block app startup with any heavy network work.
    setShowSplash(false);
  }, [initializing, user]);

  if (showSplash) {
    return <LogoLoading loading={splashLoading} message={splashMessage} />;
  }

  if (!user) {
    return <Navigate to="/auth/login" replace />;
  }

  return <>{children}</>;
}
