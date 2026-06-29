import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClientInstance } from '@/lib/query-client';
import { Toaster } from '@/components/ui/toaster';
import { isAdminRole } from '@/domain/auth/roles';
import { AuthProvider, useAuth } from '@/app/auth/AuthProvider';
import { ProtectedRoute } from '@/app/auth/ProtectedRoute';
import { AppShell } from '@/app/AppShell';
import Login from '@/app/pages/Landing';
import Register from '@/app/pages/Register';
import Dashboard from '@/app/pages/Dashboard';
import Jobs from '@/app/pages/admin/Jobs';
import JobDetail from '@/app/pages/admin/JobDetail';
import Contractors from '@/app/pages/admin/Contractors';
import Leads from '@/app/pages/admin/Leads';
import Compliance from '@/app/pages/admin/Compliance';
import ContractorJobs from '@/app/pages/contractor/ContractorJobs';
import ContractorTimesheets from '@/app/pages/contractor/ContractorTimesheets';
import ContractorCredentials from '@/app/pages/contractor/ContractorCredentials';
import ContractorProfile from '@/app/pages/contractor/ContractorProfile';
import ClientProjects from '@/app/pages/client/ClientProjects';

/** Admin-only gate: non-admins are sent back to their dashboard. */
function AdminRoute({ children }) {
  const { principal } = useAuth();
  if (!isAdminRole(principal?.role)) return <Navigate to="/" replace />;
  return children;
}

/** Restrict a route to a specific app role. */
function RoleRoute({ role, children }) {
  const { principal } = useAuth();
  if (principal?.role !== role) return <Navigate to="/" replace />;
  return children;
}

const shell = (node) => (
  <ProtectedRoute>
    <AppShell>{node}</AppShell>
  </ProtectedRoute>
);

const adminShell = (node) => shell(<AdminRoute>{node}</AdminRoute>);
const contractorShell = (node) => shell(<RoleRoute role="contractor">{node}</RoleRoute>);
const clientShell = (node) => shell(<RoleRoute role="client">{node}</RoleRoute>);

/**
 * Cloudflare-native CCG Connect app (Better Auth + the native API). Per-role
 * screens hang off the protected shell; admin routes are role-guarded.
 */
export default function App() {
  return (
    <QueryClientProvider client={queryClientInstance}>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/" element={shell(<Dashboard />)} />
            <Route path="/jobs" element={adminShell(<Jobs />)} />
            <Route path="/jobs/:id" element={adminShell(<JobDetail />)} />
            <Route path="/contractors" element={adminShell(<Contractors />)} />
            <Route path="/compliance" element={adminShell(<Compliance />)} />
            <Route path="/leads" element={adminShell(<Leads />)} />
            <Route path="/contractor/jobs" element={contractorShell(<ContractorJobs />)} />
            <Route path="/contractor/timesheets" element={contractorShell(<ContractorTimesheets />)} />
            <Route path="/contractor/credentials" element={contractorShell(<ContractorCredentials />)} />
            <Route path="/contractor/profile" element={contractorShell(<ContractorProfile />)} />
            <Route path="/client/projects" element={clientShell(<ClientProjects />)} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
      <Toaster />
    </QueryClientProvider>
  );
}