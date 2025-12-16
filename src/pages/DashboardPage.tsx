import { signOut } from 'firebase/auth';
import { auth, firebaseEnabled } from '@/lib/firebase';

export function DashboardPage() {
    const logToken = async () => {
        const currentUser = auth?.currentUser;
        if (!currentUser) {
            console.log('No authenticated user available');
            return;
        }
        const token = await currentUser.getIdToken(true);
        console.log('ID_TOKEN:', token);
    };

    const handleSignOut = async () => {
        if (!auth) {
            return;
        }
        await signOut(auth);
    };

  return (
    <div className="min-h-screen p-6">
      <h1 className="text-xl font-semibold">Dashboard</h1>
      <p className="mt-2 text-sm text-gray-600">
        Connected to Firebase: {firebaseEnabled ? 'yes' : 'no (configure .env)'}
      </p>
      <button
        className="mt-4 rounded-md border px-3 py-2 text-sm"
        onClick={logToken}
        disabled={!auth}
      >
        Log Firebase ID Token
      </button>
      <button
        className="mt-6 rounded-md border px-3 py-2 text-sm"
        onClick={handleSignOut}
        disabled={!auth}
      >
        Sign out
      </button>
    </div>
  );
}


