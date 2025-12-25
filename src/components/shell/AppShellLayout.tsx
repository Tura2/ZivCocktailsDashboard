import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useOnlineStatus } from '@/lib/useOnlineStatus';
import { OfflineBanner } from '@/components/shell/OfflineBanner';
import { OfflineScreen } from '@/components/shell/OfflineScreen';

function NavItem({ to, label }: { to: string; label: string }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        [
          'rounded-lg px-3 py-2 text-sm font-medium transition-colors',
          isActive
            ? 'bg-slate-900 text-white shadow-sm'
            : 'text-slate-700 hover:bg-slate-100',
        ].join(' ')
      }
    >
      {label}
    </NavLink>
  );
}

export function AppShellLayout() {
  const navigate = useNavigate();
  const { isOnline } = useOnlineStatus();

  const handleSignOut = async () => {
    if (!auth) return;
    await signOut(auth);
    navigate('/auth/login', { replace: true });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {!isOnline ? <OfflineBanner /> : null}

      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3 lg:px-8">
          <div className="flex items-center gap-2">
            <div className="text-sm font-semibold tracking-tight text-slate-900">Ziv Cocktails</div>
            <nav className="ml-4 flex items-center gap-1 rounded-xl bg-slate-50 p-1">
              <NavItem to="/dashboard" label="Dashboard" />
              <NavItem to="/history" label="History" />
              <NavItem to="/scripts" label="Scripts" />
            </nav>
          </div>
          <button
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-900 shadow-sm transition hover:bg-slate-50"
            onClick={handleSignOut}
          >
            Sign out
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-6 lg:px-8">
        {!isOnline ? <OfflineScreen onRetry={() => window.location.reload()} /> : <Outlet />}
      </main>
    </div>
  );
}
