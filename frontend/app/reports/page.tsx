"use client";
import dynamic from 'next/dynamic';
import { withPageRequiredAuth } from '@/services/auth/withPageRequiredAuth';
import { UserRole } from '@/types/Role';

const Reports = dynamic(() => import('@/components/Reports'), {
  loading: () => (
    <div className="flex items-center justify-center min-h-[200px]">
      <p>Loading reports...</p>
    </div>
  ),
});

export default withPageRequiredAuth(Reports, { roles: [UserRole.ADMIN, UserRole.SUPERVISOR] });
