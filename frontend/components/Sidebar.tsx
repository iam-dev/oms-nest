"use client";

import { useState, useEffect } from 'react';
import { LayoutDashboard, Users, ShoppingCart, BarChart3, Search, ChevronRight, ChevronLeft, Wrench, Factory } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useRouter, usePathname } from 'next/navigation';
import Image from 'next/image';
import { SaddlesSidebarSection } from './SaddlesSidebarSection';
import { AccountManagementSidebarSection } from './AccountManagementSidebarSection';
import { useUserRole } from '@/hooks/useUserRole';
import { hasScreenPermission } from '@/utils/rolePermissions';

interface NavItem {
  id: string;
  label: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  icon: any;
  href: string;
  permission: keyof typeof import('@/utils/rolePermissions').SCREEN_PERMISSIONS;
}

const navItems: NavItem[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: LayoutDashboard,
    href: '/dashboard',
    permission: 'DASHBOARD'
  },
  {
    id: 'orders',
    label: 'Orders',
    icon: ShoppingCart,
    href: '/orders',
    permission: 'ORDERS'
  },
  {
    id: 'factories',
    label: 'Factories',
    icon: Factory,
    href: '/factories',
    permission: 'SUPPLIERS_MANAGEMENT'
  },
  {
    id: 'customers',
    label: 'Customers',
    icon: Users,
    href: '/customers',
    permission: 'CUSTOMERS'
  },
  {
    id: 'fitters',
    label: 'Fitters',
    icon: Users,
    href: '/fitters',
    permission: 'FITTERS'
  },
  {
    id: 'reports',
    label: 'Reports',
    icon: BarChart3,
    href: '/reports',
    permission: 'REPORTS'
  },
  {
    id: 'repairs',
    label: 'Repairs',
    icon: Wrench,
    href: '/repairs',
    permission: 'REPAIRS'
  },
  {
    id: 'findSaddle',
    label: 'Find Saddle',
    icon: Search,
    href: '/find-saddle',
    permission: 'DASHBOARD' // Using dashboard permission for find saddle for now
  },
];

export function Sidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const { role } = useUserRole();

  // Filter navigation items based on user role
  const visibleNavItems = navItems.filter(item => 
    hasScreenPermission(role, item.permission)
  );

  useEffect(() => {
    const checkScreenSize = () => {
      setIsMobile(window.innerWidth < 1024);
      setIsCollapsed(window.innerWidth < 1024);
    };
    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  return (
    <div
      className={cn(
        "min-h-screen bg-[#F5F5F5] border-r transition-all duration-300 relative",
        isCollapsed ? "w-16" : "w-64"
      )}
    >
      {/* Logo at the top of sidebar, always centered horizontally */}
      <div style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '18px 0 18px 0', minHeight: 72 }}>
        <Image src="/logo.png" alt="Custom Saddlery Logo" width={80} height={36} style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }} />
      </div>

      <nav className={cn(
        "px-2 space-y-1",
        isCollapsed && "px-1"
      )}>
        {/* Render nav items up to but not including Factories */}
        {visibleNavItems.slice(0, visibleNavItems.findIndex(item => item.id === 'factories')).map((item) => {
          const isActive = item.href && pathname && pathname.startsWith(item.href);
          return (
            <button
              key={item.id}
              onClick={() => router.push(item.href)}
              className={cn(
                "w-full flex items-center gap-2 px-4 py-2 rounded-md text-gray-700 hover:bg-gray-200 transition-colors",
                isActive && "bg-gray-300 font-bold text-[#8B0000]",
                isCollapsed && "justify-center px-2"
              )}
            >
              <item.icon className="h-5 w-5" />
              {!isCollapsed && item.label}
            </button>
          );
        })}
        {/* Insert Saddle Modelling section after saddle stock items */}
        <SaddlesSidebarSection isCollapsed={isCollapsed} />
        {/* Render Factories and remaining nav items */}
        {visibleNavItems.slice(visibleNavItems.findIndex(item => item.id === 'factories')).map((item) => {
          const isActive = item.href && pathname && pathname.startsWith(item.href);
          return (
            <button
              key={item.id}
              onClick={() => router.push(item.href)}
              className={cn(
                "w-full flex items-center gap-2 px-4 py-2 rounded-md text-gray-700 hover:bg-gray-200 transition-colors",
                isActive && "bg-gray-300 font-bold text-[#8B0000]",
                isCollapsed && "justify-center px-2"
              )}
            >
              <item.icon className="h-5 w-5" />
              {!isCollapsed && item.label}
            </button>
          );
        })}
        {/* Insert Account Management section */}
        <AccountManagementSidebarSection isCollapsed={isCollapsed} initiallyCollapsed={true} />
      </nav>

      {!isMobile && (
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="absolute -right-3 top-1/2 -translate-y-1/2 h-6 w-6 bg-white border rounded-full flex items-center justify-center hover:bg-gray-100 transition-colors"
        >
          {isCollapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </button>
      )}
    </div>
  );
}