import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthLoginPage } from '@/pages/AuthLoginPage';
import { AuthRegisterPage } from '@/pages/AuthRegisterPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { RequireAuth } from '@/routes/RequireAuth';

export function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="/auth/login" element={<AuthLoginPage />} />
      <Route path="/auth/register" element={<AuthRegisterPage />} />
      <Route
        path="/dashboard"
        element={
          <RequireAuth>
            <DashboardPage />
          </RequireAuth>
        }
      />
      <Route path="*" element={<Navigate to="/auth/login" replace />} />
    </Routes>
  );
}
