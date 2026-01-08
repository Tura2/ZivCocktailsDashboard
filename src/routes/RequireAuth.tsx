import { ReactNode, useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthUser } from '@/lib/useAuthUser';
import { LogoLoading } from '@/components/ui/LogoLoading';
import { triggerRefresh } from '@/lib/api/refresh';
import { setRefreshJobId } from '@/lib/refresh/refreshRuntime';

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

  useEffect(() => {
    if (!user) return;

    // One-time per app session. Don't show the logo loading overlay for this.
    const key = 'ziv.autoRefresh.dashboard.v1';
    try {
      if (sessionStorage.getItem(key) === '1') return;
      sessionStorage.setItem(key, '1');
    } catch {
      // If sessionStorage is unavailable for any reason, fall back to best-effort.
    }

    void (async () => {
      try {
        // Best-effort: ignore errors and keep the UI responsive.
        const res = await triggerRefresh();
        if (res.ok) {
          setRefreshJobId(res.jobId);
          return;
        }
        if (res.code === 'already_running' && res.jobId) {
          setRefreshJobId(res.jobId);
        }
      } catch {
        // ignore
      }
    })();
  }, [user]);

  if (showSplash) {
    return <LogoLoading loading={splashLoading} message={splashMessage} />;
  }

  if (!user) {
    return <Navigate to="/auth/login" replace />;
  }

  return <>{children}</>;
}
