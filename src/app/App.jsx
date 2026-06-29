import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClientInstance } from '@/lib/query-client';
import { Toaster } from '@/components/ui/toaster';
import { isAdminRole } from '@/domain/auth/roles';
import { AuthProvider, useAuth } from '@/app/auth/AuthProvider';
import { ProtectedRoute } from '@/app/auth/ProtectedRoute';
import { AppShell } from '@/app/AppShell';

// Auth pages
import Landing from '@/app/pages/Landing';
import Register from '@/app/pages/Register';

// Dashboards
import AdminDashboard from '@/app/pages/admin/AdminDashboard';
import ContractorDashboard from '@/app/pages/contractor/ContractorDashboard';
import ClientDashboard from '@/app/pages/client/ClientDashboard';

// Admin pages
import Jobs from '@/app/pages/admin/Jobs';
import JobWorkflow from '@/app/pages/admin/JobWorkflow';
import MatchEngine from '@/app/pages/admin/MatchEngine';
import BulkInvoice from '@/app/pages/admin/BulkInvoice';
import Contractors from '@/app/pages/admin/Contractors';
import Leads from '@/app/pages/admin/Leads';
import Compliance from '@/app/pages/admin/Compliance';
import UserManagement from '@/app/pages/admin/UserManagement';

// Contractor pages
import ContractorJobs from '@/app/pages/contractor/ContractorJobs';
import ContractorTimesheets from '@/app/pages/contractor/ContractorTimesheets';
import ContractorCredentials from '@/app/pages/contractor/ContractorCredentials';
import ContractorProfile from '@/app/pages/contractor/ContractorProfile';

// Client pages
import ClientProjects from '@/app/pages/client/ClientProjects';
import ClientJobSubmit from '@/app/pages/client/ClientJobSubmit';

/** Admin-only gate */
function AdminRoute({ children }) {
  const { principal } = useAuth();
  if (!isAdminRole(principal?.role)) return <Navigate to="/" replace />;
  return children;
}

/** Restrict a route to a specific app role */
function RoleRoute({ role, children }) {
  const { principal } = useAuth();
  if (principal?.role !== role) return <Navigate to="/" replace />;
  return children;
}

/** Role-aware root redirect — sends each role to their correct dashboard */
function RoleDashboard() {
  const { principal } = useAuth();
  const role = principal?.role;
  if (isAdminRole(role)) return <AdminDashboard />;
  if (role === 'contractor') return <ContractorDashboard />;
  if (role === 'client') return <ClientDashboard />;
  return <AdminDashboard />;
}

const shell = (node) => (
  <ProtectedRoute>
    <AppShell>{node}</AppShell>
  </ProtectedRoute>
);

const adminShell = (node) => shell(<AdminRoute>{node}</AdminRoute>);
const contractorShell = (node) => shell(<RoleRoute role="contractor">{node}</RoleRoute>);
const clientShell = (node) => shell(<RoleRoute role="client">{node}</RoleRoute>);

export default function App() {
  return (
    <QueryClientProvider client={queryClientInstance}>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            {/* Public */}
            <Route path="/login" element={<Landing />} />
            <Route path="/register" element={<Register />} />

            {/* Role-aware root dashboard */}
            <Route path="/" element={shell(<RoleDashboard />)} />

            {/* Admin */}
            <Route path="/jobs" element={adminShell(<Jobs />)} />
            <Route path="/jobs/:id" element={adminShell(<JobWorkflow />)} />
            <Route path="/jobs/:id/match" element={adminShell(<MatchEngine />)} />
            <Route path="/invoices" element={adminShell(<BulkInvoice />)} />
            <Route path="/contractors" element={adminShell(<Contractors />)} />
            <Route path="/compliance" element={adminShell(<Compliance />)} />
            <Route path="/leads" element={adminShell(<Leads />)} />
            <Route path="/users" element={adminShell(<UserManagement />)} />

            {/* Contractor */}
            <Route path="/contractor/jobs" element={contractorShell(<ContractorJobs />)} />
            <Route path="/contractor/timesheets" element={contractorShell(<ContractorTimesheets />)} />
            <Route path="/contractor/credentials" element={contractorShell(<ContractorCredentials />)} />
            <Route path="/contractor/profile" element={contractorShell(<ContractorProfile />)} />

            {/* Client */}
            <Route path="/client/projects" element={clientShell(<ClientProjects />)} />
            <Route path="/client/submit-job" element={clientShell(<ClientJobSubmit />)} />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
      <Toaster />
    </QueryClientProvider>
  );
}