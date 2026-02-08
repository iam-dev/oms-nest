"use client";
import dynamic from 'next/dynamic';
import { withPageRequiredAuth } from '@/services/auth/withPageRequiredAuth';
import { UserRole } from '@/types/Role';

const Orders = dynamic(() => import('@/components/Orders'), {
  loading: () => (
    <div className="flex items-center justify-center min-h-[200px]">
      <p>Loading orders...</p>
    </div>
  ),
});

export default withPageRequiredAuth(Orders, { roles: [UserRole.ADMIN, UserRole.USER, UserRole.SUPERVISOR] });
