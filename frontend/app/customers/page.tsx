"use client";
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { useUserRole } from '@/hooks/useUserRole';
import { hasScreenPermission } from '@/utils/rolePermissions';

const Customers = dynamic(() => import('@/components/Customers'), {
  loading: () => (
    <div className="flex items-center justify-center min-h-[200px]">
      <p>Loading customers...</p>
    </div>
  ),
});

export default function CustomersPage() {
  const router = useRouter();
  const { role } = useUserRole();

  useEffect(() => {
    if (role && !hasScreenPermission(role, 'CUSTOMERS')) {
      router.push('/not-authorized');
    }
  }, [role, router]);

  // Don't render if user doesn't have permission
  if (!role || !hasScreenPermission(role, 'CUSTOMERS')) {
    return null; // or loading spinner
  }

  return <Customers />;
}
