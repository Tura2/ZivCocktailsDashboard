import { ReactNode, useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthUser } from '@/lib/useAuthUser';
import { LogoLoading } from '@/components/ui/LogoLoading';
import { triggerRefresh } from '@/lib/api/refresh';

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

    // If not authenticated, don't block the login/register screens.
    if (!user) {
      setShowSplash(false);
      return;
    }

    // Run refresh once per app start (session).
    const SESSION_KEY = 'ziv:startup:refresh:v1';
    let alreadyRan = false;
    try {
      alreadyRan = sessionStorage.getItem(SESSION_KEY) === '1';
    } catch {
      alreadyRan = false;
    }

    if (alreadyRan) {
      setShowSplash(false);
      return;
    }

    try {
      sessionStorage.setItem(SESSION_KEY, '1');
    } catch {
      // ignore
    }

    let cancelled = false;
    const startedAt = Date.now();
    const MIN_GREY_MS = 1200;
    setShowSplash(true);
    setSplashLoading(true);
    setSplashMessage('Refreshing dashboard…');

    (async () => {
      try {
        await triggerRefresh();
      } finally {
        if (cancelled) return;
        const elapsed = Date.now() - startedAt;
        const remaining = Math.max(0, MIN_GREY_MS - elapsed);

        // Keep grey while the app is doing work; switch to color only at the end.
        window.setTimeout(() => {
          if (cancelled) return;
          setSplashMessage('Loading dashboard…');
          setSplashLoading(false);

          window.setTimeout(() => {
            if (!cancelled) setShowSplash(false);
          }, 500);
        }, remaining);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [initializing, user]);

  if (showSplash) {
    return <LogoLoading loading={splashLoading} message={splashMessage} />;
  }

  if (!user) {
    return <Navigate to="/auth/login" replace />;
  }

  return <>{children}</>;
}
