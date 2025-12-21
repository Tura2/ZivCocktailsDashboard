import { AppRouter } from './routes/AppRouter';
import { ErrorBoundary } from '@/components/shell/ErrorBoundary';

export default function App() {
  return (
    <ErrorBoundary
      onGoToLogin={() => {
        // Use a direct hash navigation so this works even if router state is broken.
        window.location.hash = '#/auth/login';
      }}
    >
      <AppRouter />
    </ErrorBoundary>
  );
}
