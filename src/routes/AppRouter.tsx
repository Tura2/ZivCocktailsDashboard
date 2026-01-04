import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthLoginPage } from '@/pages/AuthLoginPage';
import { AuthRegisterPage } from '@/pages/AuthRegisterPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { HistoryPage } from '@/pages/HistoryPage';
import { SalariesPage } from '@/pages/SalariesPage';
import { ScriptsPage } from '@/pages/ScriptsPage';
import { RequireAuth } from '@/routes/RequireAuth';
import { AppShellLayout } from '@/components/shell/AppShellLayout';

export function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="/auth/login" element={<AuthLoginPage />} />
      <Route path="/auth/register" element={<AuthRegisterPage />} />

      <Route
        element={
          <RequireAuth>
            <AppShellLayout />
          </RequireAuth>
        }
      >
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/history" element={<HistoryPage />} />
        <Route path="/salaries" element={<SalariesPage />} />
        <Route path="/scripts" element={<ScriptsPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/auth/login" replace />} />
    </Routes>
  );
}
