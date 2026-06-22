import { Outlet, Navigate, useLocation } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useUserProfile } from '@/lib/useUserProfile';
import AdminSidebar from '@/components/layout/AdminSidebar';
import ContractorLayout from '@/components/layout/ContractorLayout';
import ClientLayout from '@/components/layout/ClientLayout';
import { isAdmin, isContractor, isClient } from '@/lib/roles';
import { canAccessPath, homePathForRole, isAppRole } from '@/domain/auth/roles';

export default function RootLayout() {
  const { userProfile, loading } = useUserProfile();
  const location = useLocation();

  if (loading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  const role = userProfile?.role;

  // Defence-in-depth route confinement: a signed-in user may only render routes
  // belonging to their own role group. This complements (never replaces) the
  // server-side / RLS authorization that protects the underlying data.
  if (isAppRole(role) && !canAccessPath(role, location.pathname)) {
    return <Navigate to={homePathForRole(role)} replace />;
  }

  if (isAdmin(role)) {
    return (
      <AdminSidebar userProfile={userProfile}>
        <Outlet />
      </AdminSidebar>
    );
  }

  if (isContractor(role)) {
    return (
      <ContractorLayout>
        <Outlet />
      </ContractorLayout>
    );
  }

  if (isClient(role)) {
    return (
      <ClientLayout>
        <Outlet />
      </ClientLayout>
    );
  }

  // Default fallback for unrecognised role
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="text-center">
        <h1 className="text-xl font-bold mb-2">Access Pending</h1>
        <p className="text-sm text-muted-foreground mb-4">Your account is awaiting approval. Please contact your administrator.</p>
        <button onClick={() => base44.auth.logout()} className="text-sm text-primary hover:underline">Sign out</button>
      </div>
    </div>
  );
}