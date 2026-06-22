import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import ScrollToTop from './components/ScrollToTop';
import ProtectedRoute from '@/components/ProtectedRoute';

// Splash
import SplashScreen from '@/pages/SplashScreen';

// Auth pages
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import ForgotPassword from '@/pages/ForgotPassword';
import ResetPassword from '@/pages/ResetPassword';

// Layout
import RootLayout from '@/components/RootLayout';

// Admin pages
import Dashboard from '@/pages/admin/Dashboard';
import Jobs from '@/pages/admin/Jobs';
import JobDetail from '@/pages/admin/JobDetail';
import MatchCentre from '@/pages/admin/MatchCentre';
import Contractors from '@/pages/admin/Contractors';
import Clients from '@/pages/admin/Clients';
import Compliance from '@/pages/admin/Compliance';
import Messages from '@/pages/admin/Messages';
import Timesheets from '@/pages/admin/Timesheets';
import Invoices from '@/pages/admin/Invoices';
import Reports from '@/pages/admin/Reports';
import Leads from '@/pages/admin/Leads';
import Settings from '@/pages/admin/Settings';
import CalendarPage from '@/pages/admin/Calendar';

// Contractor pages
import ContractorHome from '@/pages/contractor/ContractorHome';
import ContractorCalendar from '@/pages/contractor/ContractorCalendar';
import ContractorJobs from '@/pages/contractor/ContractorJobs';
import ContractorTimesheets from '@/pages/contractor/ContractorTimesheets';
import ContractorMedia from '@/pages/contractor/ContractorMedia';
import ContractorProfile from '@/pages/contractor/ContractorProfile';
import ContractorJobDetail from '@/pages/contractor/ContractorJobDetail';

// Client pages
import ClientHome from '@/pages/client/ClientHome';
import ClientProjects from '@/pages/client/ClientProjects';
import ClientDocuments from '@/pages/client/ClientDocuments';
import ClientMessages from '@/pages/client/ClientMessages';
import ClientProfile from '@/pages/client/ClientProfile';

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      navigateToLogin();
      return null;
    }
  }

  return (
    <Routes>
      {/* Splash */}
      <Route path="/splash" element={<SplashScreen />} />

      {/* Public auth routes */}
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />

      {/* Protected app routes */}
      <Route element={<ProtectedRoute unauthenticatedElement={<Navigate to="/login" replace />} />}>
        <Route element={<RootLayout />}>
          {/* Admin */}
          <Route path="/" element={<Dashboard />} />
          <Route path="/jobs" element={<Jobs />} />
          <Route path="/jobs/:id" element={<JobDetail />} />
          <Route path="/match-centre" element={<MatchCentre />} />
          <Route path="/contractors" element={<Contractors />} />
          <Route path="/clients" element={<Clients />} />
          <Route path="/compliance" element={<Compliance />} />
          <Route path="/messages" element={<Messages />} />
          <Route path="/timesheets" element={<Timesheets />} />
          <Route path="/invoices" element={<Invoices />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/leads" element={<Leads />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/calendar" element={<CalendarPage />} />

          {/* Contractor */}
          <Route path="/contractor" element={<ContractorHome />} />
          <Route path="/contractor/jobs" element={<ContractorJobs />} />
          <Route path="/contractor/timesheets" element={<ContractorTimesheets />} />
          <Route path="/contractor/media" element={<ContractorMedia />} />
          <Route path="/contractor/calendar" element={<ContractorCalendar />} />
          <Route path="/contractor/profile" element={<ContractorProfile />} />
          <Route path="/contractor/job/:id" element={<ContractorJobDetail />} />

          {/* Client */}
          <Route path="/client" element={<ClientHome />} />
          <Route path="/client/projects" element={<ClientProjects />} />
          <Route path="/client/documents" element={<ClientDocuments />} />
          <Route path="/client/messages" element={<ClientMessages />} />
          <Route path="/client/profile" element={<ClientProfile />} />
        </Route>
      </Route>

      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <ScrollToTop />
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  );
}

export default App;