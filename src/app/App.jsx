import { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClientInstance } from '@/lib/query-client';
import { Toaster } from '@/components/ui/toaster';
import { isAdminRole } from '@/domain/auth/roles';
import { AuthProvider, useAuth } from '@/app/auth/AuthProvider';
import { ProtectedRoute } from '@/app/auth/ProtectedRoute';
import { AppShell } from '@/app/AppShell';
import { ErrorBoundary } from '@/app/ErrorBoundary';
import { OfflineSync } from '@/offline/OfflineSync';

// Auth pages
import Landing from '@/app/pages/Landing';
import Register from '@/app/pages/Register';
import ForgotPassword from '@/app/pages/ForgotPassword';
import ResetPassword from '@/app/pages/ResetPassword';

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
import Timesheets from '@/app/pages/admin/Timesheets';
import Clients from '@/app/pages/admin/Clients';

// Contractor pages
import ContractorJobs from '@/app/pages/contractor/ContractorJobs';
import ContractorTimesheets from '@/app/pages/contractor/ContractorTimesheets';
import ContractorCredentials from '@/app/pages/contractor/ContractorCredentials';
import ContractorProfile from '@/app/pages/contractor/ContractorProfile';

// Client pages
import ClientProjects from '@/app/pages/client/ClientProjects';
import ClientJobSubmit from '@/app/pages/client/ClientJobSubmit';
import ClientSignup from '@/app/pages/ClientSignup';

// Admin — standalone match engine
import ContractorMatchEngine from '@/app/pages/admin/ContractorMatchEngine';
import ComplianceDashboard from '@/app/pages/admin/ComplianceDashboard';
import JobStatusBoard from '@/app/pages/admin/JobStatusBoard';

// Commercial / agency (labour supply)
import CommercialAccounts from '@/features/commercial-workforce/accounts/CommercialAccounts';
import CommercialAccountDetail from '@/features/commercial-workforce/accounts/CommercialAccountDetail';
import CommercialProjectDetail from '@/features/commercial-workforce/projects/CommercialProjectDetail';
import Workers from '@/features/commercial-workforce/workers/Workers';
import WorkerDetail from '@/features/commercial-workforce/workers/WorkerDetail';
import Gangs from '@/features/commercial-workforce/gangs/Gangs';
import GangDetail from '@/features/commercial-workforce/gangs/GangDetail';
import LabourRequests from '@/features/commercial-workforce/labour-requests/LabourRequests';
import LabourRequestDetail from '@/features/commercial-workforce/labour-requests/LabourRequestDetail';

// Shared
import Messages from '@/app/pages/Messages';
import Onboarding from '@/app/pages/Onboarding';
import CheckIn from '@/app/pages/CheckIn';

// Heavy, route-split pages (calendar/gantt/charts kept out of the main bundle)
const Schedule = lazy(() => import('@/app/pages/admin/Schedule'));
const Reports = lazy(() => import('@/app/pages/admin/Reports'));

/** Admin-only gate */
function AdminRoute({ children }) {
  const { principal } = useAuth();
  if (!isAdminRole(principal?.role)) return <Navigate to="/" replace />;
  return children;
}

/** Restrict a route to a specific app role */
function RoleRoute({ appRole, children }) {
  const { principal } = useAuth();
  if (principal?.role !== appRole) return <Navigate to="/" replace />;
  return children;
}

/** Sends users who haven't completed onboarding to the onboarding wizard.
 *  Admins (owner/ops_admin) are exempt. */
function OnboardingGate({ children }) {
  const { isLoading, principal, profile } = useAuth();
  if (isLoading) return null;
  const role = principal?.role;
  const isAdmin = role === 'owner' || role === 'ops_admin';
  const needsOnboarding = !isAdmin && (!profile || !profile.onboarding_completed_at);
  if (needsOnboarding) return <Navigate to="/onboarding" replace />;
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
    <OnboardingGate>
      <AppShell>{node}</AppShell>
    </OnboardingGate>
  </ProtectedRoute>
);

const adminShell = (node) => shell(<AdminRoute>{node}</AdminRoute>);
const contractorShell = (node) => shell(<RoleRoute appRole="contractor">{node}</RoleRoute>);
const clientShell = (node) => shell(<RoleRoute appRole="client">{node}</RoleRoute>);

export default function App() {
  return (
    <QueryClientProvider client={queryClientInstance}>
      <OfflineSync />
      <BrowserRouter>
        <ErrorBoundary>
        <AuthProvider>
          <Routes>
            {/* Public */}
            <Route path="/login" element={<Landing />} />
            <Route path="/register" element={<Register />} />
            <Route path="/client-signup" element={<ClientSignup />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />

            {/* Onboarding (authenticated, but outside the shell + gate) */}
            <Route
              path="/onboarding"
              element={
                <ProtectedRoute>
                  <Onboarding />
                </ProtectedRoute>
              }
            />

            {/* Site check-in (QR target) — authenticated; access enforced server-side */}
            <Route
              path="/checkin/:jobId"
              element={
                <ProtectedRoute>
                  <CheckIn />
                </ProtectedRoute>
              }
            />

            {/* Role-aware root dashboard */}
            <Route path="/" element={shell(<RoleDashboard />)} />

            {/* Admin */}
            <Route path="/jobs" element={adminShell(<Jobs />)} />
            <Route path="/jobs/:id" element={adminShell(<JobWorkflow />)} />
            <Route path="/jobs/:id/match" element={adminShell(<MatchEngine />)} />
            <Route path="/invoices" element={adminShell(<BulkInvoice />)} />
            <Route path="/timesheets" element={adminShell(<Timesheets />)} />
            <Route
              path="/reports"
              element={adminShell(
                <Suspense fallback={<p className="text-sm text-muted-foreground">Loading reports…</p>}>
                  <Reports />
                </Suspense>,
              )}
            />
            <Route path="/contractors" element={adminShell(<Contractors />)} />
            <Route path="/clients" element={adminShell(<Clients />)} />
            <Route path="/compliance" element={adminShell(<Compliance />)} />
            <Route path="/leads" element={adminShell(<Leads />)} />
            <Route path="/users" element={adminShell(<UserManagement />)} />
            <Route path="/commercial" element={adminShell(<CommercialAccounts />)} />
            <Route path="/commercial/accounts/:id" element={adminShell(<CommercialAccountDetail />)} />
            <Route path="/commercial/projects/:id" element={adminShell(<CommercialProjectDetail />)} />
            <Route path="/workforce/workers" element={adminShell(<Workers />)} />
            <Route path="/workforce/workers/:id" element={adminShell(<WorkerDetail />)} />
            <Route path="/workforce/gangs" element={adminShell(<Gangs />)} />
            <Route path="/workforce/gangs/:id" element={adminShell(<GangDetail />)} />
            <Route path="/workforce/requests" element={adminShell(<LabourRequests />)} />
            <Route path="/workforce/requests/:id" element={adminShell(<LabourRequestDetail />)} />
            <Route path="/match-engine" element={adminShell(<ContractorMatchEngine />)} />
            <Route path="/compliance-dashboard" element={adminShell(<ComplianceDashboard />)} />
            <Route path="/job-board" element={adminShell(<JobStatusBoard />)} />
            <Route
              path="/calendar"
              element={adminShell(
                <Suspense fallback={<p className="text-sm text-muted-foreground">Loading schedule…</p>}>
                  <Schedule />
                </Suspense>,
              )}
            />
            <Route
              path="/schedule"
              element={<Navigate to="/calendar" replace />}
            />
            <Route path="/messages" element={shell(<Messages />)} />

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
        </ErrorBoundary>
      </BrowserRouter>
      <Toaster />
    </QueryClientProvider>
  );
}