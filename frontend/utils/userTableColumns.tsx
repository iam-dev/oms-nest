import React from 'react';
import { Button } from '@/components/ui/button';
import { Eye, Edit, Trash2 } from 'lucide-react';
import { User, UserRole } from '@/types/Role';
import { Column } from '@/components/shared/DataTable';
import { getRoleDisplayName } from '@/utils/rolePermissions';
import { TableHeaderFilter } from '../components/shared/TableHeaderFilter';

export type UserHeaderFilters = Record<string, string>;
export type SetUserHeaderFilters = (key: string, value: string) => void;

/**
 * Get display name for user role
 */
function getRoleLabel(role: UserRole): string {
  return getRoleDisplayName(role);
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

/**
 * Render role badge
 */
function renderRoleBadge(role: UserRole) {
  return (
    <span 
      className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${getRoleBadgeStyle(role)}`}
    >
      {getRoleLabel(role)}
    </span>
  );
}

/**
 * Get table columns for users (with actions)
 */
export function getUserTableColumns({
  onView,
  onEdit,
  onDelete,
  canEdit = true,
  canDelete = true,
}: {
  onView?: (user: User) => void;
  onEdit?: (user: User) => void;
  onDelete?: (user: User) => void;
  canEdit?: boolean;
  canDelete?: boolean;
} = {}): Column<User>[] {
  const columns: Column<User>[] = [
    {
      key: 'username',
      title: 'Username',
      render: (value: string) => (
        <span className="font-medium text-gray-900">{value}</span>
      ),
    },
    {
      key: 'email',
      title: 'Email',
      render: (value: string) => value || '-',
    },
    {
      key: 'firstName',
      title: 'First Name',
      render: (value: string) => value || '-',
    },
    {
      key: 'lastName',
      title: 'Last Name',
      render: (value: string) => value || '-',
    },
    {
      key: 'role',
      title: 'Role',
      render: (value: UserRole) => renderRoleBadge(value),
    },
  ];

  // Add actions column if any action handlers are provided
  if (onView || onEdit || onDelete) {
    columns.push({
      key: 'actions',
      title: 'Actions',
      render: (_, user) => (
        <div className="flex items-center gap-2">
          {onView && user && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onView(user)}
              title="View user details"
            >
              <Eye className="h-4 w-4" />
            </Button>
          )}
          {onEdit && canEdit && user && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onEdit(user)}
              title="Edit user"
            >
              <Edit className="h-4 w-4" />
            </Button>
          )}
          {onDelete && canDelete && user && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onDelete(user)}
              title="Delete user"
              className="text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      ),
    });
  }

  return columns;
}

/**
 * Get filterable user table columns for EntityTable
 */
export function getUserTableColumnsFiltered(headerFilters: UserHeaderFilters, setHeaderFilters: SetUserHeaderFilters) {
  // Get available role options for filter
  const roleOptions = [
    { value: UserRole.USER, label: getRoleDisplayName(UserRole.USER) },
    { value: UserRole.FITTER, label: getRoleDisplayName(UserRole.FITTER) },
    { value: UserRole.SUPPLIER, label: getRoleDisplayName(UserRole.SUPPLIER) },
    { value: UserRole.ADMIN, label: getRoleDisplayName(UserRole.ADMIN) },
    { value: UserRole.SUPERVISOR, label: getRoleDisplayName(UserRole.SUPERVISOR) },
  ];

  return [
    {
      key: 'username',
      title: (
        <TableHeaderFilter
          title="Username"
          value={headerFilters.username || ''}
          onFilter={value => setHeaderFilters('username', value)}
          type="text"
          entityType="user"
        />
      ),
      render: (value: string) => (
        <span className="font-medium text-gray-900">{value || '-'}</span>
      ),
    },
    {
      key: 'email',
      title: (
        <TableHeaderFilter
          title="Email"
          value={headerFilters.email || ''}
          onFilter={value => setHeaderFilters('email', value)}
          type="text"
          entityType="user"
        />
      ),
      render: (value: string) => value || '-',
    },
    {
      key: 'firstName',
      title: (
        <TableHeaderFilter
          title="First Name"
          value={headerFilters.firstName || ''}
          onFilter={value => setHeaderFilters('firstName', value)}
          type="text"
          entityType="user"
        />
      ),
      render: (value: string) => value || '-',
    },
    {
      key: 'lastName',
      title: (
        <TableHeaderFilter
          title="Last Name"
          value={headerFilters.lastName || ''}
          onFilter={value => setHeaderFilters('lastName', value)}
          type="text"
          entityType="user"
        />
      ),
      render: (value: string) => value || '-',
    },
    {
      key: 'role',
      title: (
        <TableHeaderFilter
          title="Role"
          value={headerFilters.role || ''}
          onFilter={value => setHeaderFilters('role', value)}
          type="enum"
          data={roleOptions}
          entityType="user"
        />
      ),
      render: (value: unknown) => {
        // Handle different role value formats
        let roleValue: UserRole = UserRole.USER;

        if (typeof value === 'string') {
          // Check if it's already a UserRole enum value
          if (Object.values(UserRole).includes(value as UserRole)) {
            roleValue = value as UserRole;
          } else {
            // Try to map common role strings to UserRole enum
            const roleMapping: Record<string, UserRole> = {
              'admin': UserRole.ADMIN,
              'user': UserRole.USER,
              'fitter': UserRole.FITTER,
              'supplier': UserRole.SUPPLIER,
              'supervisor': UserRole.SUPERVISOR,
              'ADMIN': UserRole.ADMIN,
              'USER': UserRole.USER,
              'FITTER': UserRole.FITTER,
              'SUPPLIER': UserRole.SUPPLIER,
              'SUPERVISOR': UserRole.SUPERVISOR,
              'ROLE_ADMIN': UserRole.ADMIN,
              'ROLE_USER': UserRole.USER,
              'ROLE_FITTER': UserRole.FITTER,
              'ROLE_SUPPLIER': UserRole.SUPPLIER,
              'ROLE_SUPERVISOR': UserRole.SUPERVISOR,
            };
            roleValue = roleMapping[value] || UserRole.USER;
          }
        } else if (value === null || value === undefined) {
          // Handle null/undefined values
          roleValue = UserRole.USER;
        } else {
          // Handle any other non-string values
          roleValue = UserRole.USER;
        }

        return renderRoleBadge(roleValue);
      },
    },
  ];
}

/**
 * Default columns without actions for EntityTable (legacy)
 */
export function getDefaultUserTableColumns(): Column<User>[] {
  return [
    {
      key: 'username',
      title: 'Username',
      render: (value: string) => (
        <span className="font-medium text-gray-900">{value}</span>
      ),
    },
    {
      key: 'email',
      title: 'Email',
      render: (value: string) => value || '-',
    },
    {
      key: 'firstName',
      title: 'First Name',
      render: (value: string) => value || '-',
    },
    {
      key: 'lastName',
      title: 'Last Name',
      render: (value: string) => value || '-',
    },
    {
      key: 'role',
      title: 'Role',
      render: (value: UserRole) => renderRoleBadge(value),
    },
  ];
}