import { signOut } from 'firebase/auth';
import { auth, firebaseEnabled } from '@/lib/firebase';

export function DashboardPage() {
  return (
    <div className="min-h-screen p-6">
      <h1 className="text-xl font-semibold">Dashboard</h1>
      <p className="mt-2 text-sm text-gray-600">
        Connected to Firebase: {firebaseEnabled ? 'yes' : 'no (configure .env)'}
      </p>
      <button
        className="mt-6 rounded-md border px-3 py-2 text-sm"
        onClick={() => auth && signOut(auth)}
        disabled={!auth}
      >
        Sign out
      </button>
    </div>
  );
}
