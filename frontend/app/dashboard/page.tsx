"use client";
import dynamic from 'next/dynamic';
// import { withPageRequiredAuth } from '@/services/auth/withPageRequiredAuth';
// import { UserRole } from '@/types/Role';

const Dashboard = dynamic(() => import('@/components/Dashboard'), {
  loading: () => (
    <div className="flex items-center justify-center min-h-[200px]">
      <p>Loading dashboard...</p>
    </div>
  ),
});

// Temporarily disable auth for testing
export default Dashboard;
// export default withPageRequiredAuth(Dashboard, { roles: [UserRole.ADMIN, UserRole.USER, UserRole.SUPERVISOR] });
