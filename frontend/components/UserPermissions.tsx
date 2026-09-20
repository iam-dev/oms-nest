"use client";

import React from 'react';
import { PageHeader } from '@/components/shared/PageHeader';
import { UserRole } from '@/types/Role';
import { SCREEN_PERMISSIONS, getRoleDisplayName, hasScreenPermission } from '@/utils/rolePermissions';

// Screen categories for better organization
const SCREEN_CATEGORIES = {
  'Main Navigation': [
    'DASHBOARD',
    'ORDERS', 
    'CUSTOMERS',
    'FITTERS',
    'REPORTS'
  ],
  'Saddle Modeling': [
    'SADDLE_MODELING',
    'BRANDS',
    'MODELS', 
    'LEATHER_TYPES',
    'OPTIONS',
    'EXTRAS',
    'PRESETS',
    'SUPPLIERS'
  ],
  'Account Management': [
    'ACCOUNT_MANAGEMENT',
    'USER_MANAGEMENT',
    'WAREHOUSE_MANAGEMENT',
    'USER_PERMISSIONS_VIEW'
  ],
  'Order Actions': [
    'ORDER_CREATE',
    'ORDER_EDIT',
    'ORDER_DELETE',
    'ORDER_APPROVE',
    'ORDER_VIEW'
  ],
  'Entity Actions': [
    'CUSTOMER_CREATE',
    'CUSTOMER_EDIT',
    'CUSTOMER_DELETE',
    'FITTER_CREATE',
    'FITTER_EDIT',
    'FITTER_DELETE',
    'SUPPLIER_CREATE',
    'SUPPLIER_EDIT',
    'SUPPLIER_DELETE',
    'USER_CREATE',
    'USER_EDIT',
    'USER_DELETE',
    'USER_VIEW',
    'WAREHOUSE_CREATE',
    'WAREHOUSE_EDIT',
    'WAREHOUSE_DELETE',
    'WAREHOUSE_VIEW'
  ]
};

/**
 * Get human-readable screen name
 */
function getScreenDisplayName(screen: string): string {
  const names: Record<string, string> = {
    'DASHBOARD': 'Dashboard',
    'ORDERS': 'Orders',
    'CUSTOMERS': 'Customers',
    'FITTERS': 'Fitters',
    'REPORTS': 'Reports',
    'SADDLE_MODELING': 'Saddle Modeling',
    'BRANDS': 'Brands',
    'MODELS': 'Models',
    'LEATHER_TYPES': 'Leather Types',
    'OPTIONS': 'Options',
    'EXTRAS': 'Extras',
    'PRESETS': 'Presets',
    'SUPPLIERS': 'Suppliers',
    'ACCOUNT_MANAGEMENT': 'Account Management',
    'USER_MANAGEMENT': 'User Management',
    'WAREHOUSE_MANAGEMENT': 'Warehouse Management',
    'USER_PERMISSIONS_VIEW': 'User Permissions View',
    'ORDER_CREATE': 'Create Orders',
    'ORDER_EDIT': 'Edit Orders',
    'ORDER_DELETE': 'Delete Orders',
    'ORDER_APPROVE': 'Approve Orders',
    'ORDER_VIEW': 'View Orders',
    'CUSTOMER_CREATE': 'Create Customers',
    'CUSTOMER_EDIT': 'Edit Customers',
    'CUSTOMER_DELETE': 'Delete Customers',
    'FITTER_CREATE': 'Create Fitters',
    'FITTER_EDIT': 'Edit Fitters',
    'FITTER_DELETE': 'Delete Fitters',
    'SUPPLIER_CREATE': 'Create Suppliers',
    'SUPPLIER_EDIT': 'Edit Suppliers',
    'SUPPLIER_DELETE': 'Delete Suppliers',
    'USER_CREATE': 'Create Users',
    'USER_EDIT': 'Edit Users',
    'USER_DELETE': 'Delete Users',
    'USER_VIEW': 'View Users',
    'WAREHOUSE_CREATE': 'Create Warehouses',
    'WAREHOUSE_EDIT': 'Edit Warehouses',
    'WAREHOUSE_DELETE': 'Delete Warehouses',
    'WAREHOUSE_VIEW': 'View Warehouses',
  };
  
  return names[screen] || screen.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
}

/**
 * Get role badge styling
 */
function getRoleBadgeStyle(role: UserRole): string {
  switch (role) {
    case UserRole.SUPERVISOR:
      return 'bg-purple-100 text-purple-800 border-purple-300';
    case UserRole.ADMIN:
      return 'bg-red-100 text-red-800 border-red-300';
    case UserRole.FITTER:
      return 'bg-blue-100 text-blue-800 border-blue-300';
    case UserRole.SUPPLIER:
      return 'bg-green-100 text-green-800 border-green-300';
    case UserRole.USER:
      return 'bg-gray-100 text-gray-800 border-gray-300';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-300';
  }
}

export default function UserPermissions() {
  const allRoles = Object.values(UserRole);

  return (
    <div className="space-y-6">
      <PageHeader
        title="User Permissions"
        description="View role-based permissions and screen access for all user roles"
      />

      <div className="bg-white rounded-lg border p-6 space-y-8">
        {/* Role Overview */}
        <div>
          <h3 className="text-lg font-semibold mb-4">Role Overview</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {allRoles.map(role => (
              <div key={role} className="border rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${getRoleBadgeStyle(role)}`}>
                    {getRoleDisplayName(role)}
                  </span>
                </div>
                <p className="text-sm text-gray-600">
                  {role === UserRole.SUPERVISOR && 'Full system access with administrative privileges'}
                  {role === UserRole.ADMIN && 'Administrative access to most system features'}
                  {role === UserRole.FITTER && 'Customer and order management access'}
                  {role === UserRole.SUPPLIER && 'Supplier-specific features and order viewing'}
                  {role === UserRole.USER && 'Basic user access to saddle modeling and orders'}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Detailed Permissions by Category */}
        {Object.entries(SCREEN_CATEGORIES).map(([category, screens]) => (
          <div key={category}>
            <h3 className="text-lg font-semibold mb-4">{category}</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full border border-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-900 border-b">
                      Permission
                    </th>
                    {allRoles.map(role => (
                      <th key={role} className="px-4 py-3 text-center text-sm font-medium text-gray-900 border-b">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${getRoleBadgeStyle(role)}`}>
                          {getRoleDisplayName(role)}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white">
                  {screens.map((screen, index) => {
                    const permissionKey = screen as keyof typeof SCREEN_PERMISSIONS;
                    if (!SCREEN_PERMISSIONS[permissionKey]) return null;
                    
                    return (
                      <tr key={screen} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                        <td className="px-4 py-3 text-sm text-gray-900 border-b">
                          {getScreenDisplayName(screen)}
                        </td>
                        {allRoles.map(role => (
                          <td key={role} className="px-4 py-3 text-center border-b">
                            {hasScreenPermission(role, permissionKey) ? (
                              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-green-100 text-green-600">
                                ✓
                              </span>
                            ) : (
                              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-red-100 text-red-600">
                                ✗
                              </span>
                            )}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ))}

        {/* Role Hierarchy Information */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="text-sm font-medium text-blue-900 mb-2">Role Hierarchy Notes</h4>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• <strong>Supervisor</strong>: Has the highest level of access and inherits all Admin permissions</li>
            <li>• <strong>Admin</strong>: Has administrative access to most system features</li>
            <li>• <strong>Fitter</strong>: Can manage customers and has order access</li>
            <li>• <strong>Supplier</strong>: Has access to supplier-specific features and can view orders</li>
            <li>• <strong>User</strong>: Has basic access to saddle modeling and order creation</li>
          </ul>
        </div>
      </div>
    </div>
  );
}