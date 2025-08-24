'use client';

import { useAuth } from '@/components/auth-provider';
import AdminDashboard from '@/components/dashboard/admin-dashboard';
import UserDashboard from '@/components/dashboard/user-dashboard';

export default function DashboardPage() {
  const { appUser, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <p>Loading...</p>
      </div>
    );
  }

  if (!appUser) {
    // This should ideally be handled by a higher-level layout or middleware
    return <p>User not found. Please log in again.</p>;
  }

  if (appUser.role === 'admin') {
    return <AdminDashboard user={appUser} />;
  }

  return <UserDashboard user={appUser} />;
}
