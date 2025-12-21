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
          'rounded-md px-3 py-2 text-sm',
          isActive ? 'bg-gray-100 font-medium' : 'text-gray-700 hover:bg-gray-50',
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

      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="text-sm font-semibold">Ziv Cocktails</div>
            <nav className="ml-4 flex items-center gap-1">
              <NavItem to="/dashboard" label="Dashboard" />
              <NavItem to="/history" label="History" />
              <NavItem to="/scripts" label="Scripts" />
            </nav>
          </div>
          <button className="rounded-md border px-3 py-2 text-sm" onClick={handleSignOut}>
            Sign out
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6">
        {!isOnline ? <OfflineScreen onRetry={() => window.location.reload()} /> : <Outlet />}
      </main>
    </div>
  );
}
