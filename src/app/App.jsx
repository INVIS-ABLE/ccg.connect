import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClientInstance } from '@/lib/query-client';
import { Toaster } from '@/components/ui/toaster';
import { AuthProvider } from '@/app/auth/AuthProvider';
import { ProtectedRoute } from '@/app/auth/ProtectedRoute';
import { AppShell } from '@/app/AppShell';
import Login from '@/app/pages/Login';
import Register from '@/app/pages/Register';
import Dashboard from '@/app/pages/Dashboard';

/**
 * Cloudflare-native CCG Connect app (Better Auth + the native API). Replaces the
 * legacy Base44 app. Per-role screens expand off the protected dashboard.
 */
export default function App() {
  return (
    <QueryClientProvider client={queryClientInstance}>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <AppShell>
                    <Dashboard />
                  </AppShell>
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
      <Toaster />
    </QueryClientProvider>
  );
}
