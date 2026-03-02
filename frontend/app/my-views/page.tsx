"use client";
import dynamic from 'next/dynamic';
import { withPageRequiredAuth } from '@/services/auth/withPageRequiredAuth';
import { UserRole } from '@/types/Role';

const CustomOrderViews = dynamic(() => import('@/components/CustomOrderViews'), {
  loading: () => (
    <div className="flex items-center justify-center min-h-[200px]">
      <p>Loading views...</p>
    </div>
  ),
});

export default withPageRequiredAuth(CustomOrderViews, { roles: [UserRole.ADMIN, UserRole.SUPERVISOR] });
