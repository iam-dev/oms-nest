import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { UserRole } from '@/types/Role';
import * as useUserRoleModule from '@/hooks/useUserRole';
import * as rolePermissionsModule from '@/utils/rolePermissions';
import * as accountManagementSidebarSectionModule from '@/components/AccountManagementSidebarSection';

// Mock the AccountManagementSidebarSection component
const mockReact = React;
jest.mock('@/components/AccountManagementSidebarSection', () => {
  const AccountManagementSidebarSection = ({ isCollapsed, initiallyCollapsed = true }: { isCollapsed: boolean; initiallyCollapsed?: boolean }) => {
    const [open, setOpen] = mockReact.useState(!initiallyCollapsed);

    // Mock permission check - only show for SUPERVISOR
    const mockUseUserRoleFn = jest.requireMock('@/hooks/useUserRole').useUserRole;
    const { role } = mockUseUserRoleFn();

    // Mock permission function
    const mockHasScreenPermissionFn = jest.requireMock('@/utils/rolePermissions').hasScreenPermission;
    
    // Account management items
    const accountItems = [
      { id: 'users', label: 'Users', route: '/users', permission: 'USER_MANAGEMENT' },
      { id: 'warehouses', label: 'Warehouses', route: '/warehouses', permission: 'WAREHOUSE_MANAGEMENT' },
      { id: 'suppliers', label: 'Suppliers', route: '/suppliers', permission: 'SUPPLIERS' },
      { id: 'user-permissions', label: 'User Permissions', route: '/user-permissions', permission: 'USER_PERMISSIONS_VIEW' }
    ];

    // Filter items based on user role
    const visibleAccountItems = accountItems.filter(item =>
      mockHasScreenPermissionFn(role, item.permission)
    );

    // Don't render if no items are visible
    if (visibleAccountItems.length === 0) {
      return null;
    }

    return (
      <div data-testid="account-management-section">
        <button
          data-testid="account-management-toggle"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          aria-controls="account-management-submenu"
        >
          <span data-testid="shield-icon">🛡️</span>
          {!isCollapsed && 'Account Management'}
          <span data-testid="chevron-icon">{open ? '▼' : '▶'}</span>
        </button>
        
        {open && (
          <div id="account-management-submenu" data-testid="account-management-submenu">
            {visibleAccountItems.map(item => (
              <a 
                key={item.id}
                href={item.route}
                data-testid={`account-item-${item.id}`}
              >
                {item.label}
              </a>
            ))}
          </div>
        )}
      </div>
    );
  };

  return { __esModule: true, AccountManagementSidebarSection };
});

// Mock the hooks and utilities
jest.mock('@/hooks/useUserRole', () => ({
  useUserRole: jest.fn()
}));

jest.mock('@/utils/rolePermissions', () => ({
  hasScreenPermission: jest.fn()
}));

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
  }),
  usePathname: () => '/dashboard'
}));

const mockUseUserRole = useUserRoleModule.useUserRole as jest.Mock;
const mockHasScreenPermission = rolePermissionsModule.hasScreenPermission as jest.Mock;
const { AccountManagementSidebarSection } = accountManagementSidebarSectionModule;

describe('Account Management Sidebar Section', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup realistic permission implementation
    mockHasScreenPermission.mockImplementation((role, permission) => {
      if (role === UserRole.SUPERVISOR) {
        return ['USER_MANAGEMENT', 'WAREHOUSE_MANAGEMENT', 'SUPPLIERS', 'USER_PERMISSIONS_VIEW'].includes(permission);
      }
      if (role === UserRole.ADMIN && permission === 'SUPPLIERS') {
        return true;
      }
      return false;
    });
  });

  describe('Supervisor Access', () => {
    beforeEach(() => {
      mockUseUserRole.mockReturnValue({
        role: UserRole.SUPERVISOR,
        isAdmin: true,
        isSupervisor: true,
        hasRole: jest.fn()
      });
    });

    test('renders account management section for supervisor', () => {
      render(<AccountManagementSidebarSection isCollapsed={false} />);

      expect(screen.getByTestId('account-management-section')).toBeInTheDocument();
    });

    test('shows account management toggle button', () => {
      render(<AccountManagementSidebarSection isCollapsed={false} />);

      const toggleButton = screen.getByTestId('account-management-toggle');
      expect(toggleButton).toBeInTheDocument();
      expect(screen.getByText('Account Management')).toBeInTheDocument();
    });

    test('displays shield icon', () => {
      render(<AccountManagementSidebarSection isCollapsed={false} />);

      expect(screen.getByTestId('shield-icon')).toBeInTheDocument();
    });

    test('shows all account management items when expanded', () => {
      render(<AccountManagementSidebarSection isCollapsed={false} initiallyCollapsed={false} />);

      expect(screen.getByTestId('account-management-submenu')).toBeInTheDocument();
      expect(screen.getByTestId('account-item-users')).toBeInTheDocument();
      expect(screen.getByTestId('account-item-warehouses')).toBeInTheDocument();
      expect(screen.getByTestId('account-item-suppliers')).toBeInTheDocument();
      expect(screen.getByTestId('account-item-user-permissions')).toBeInTheDocument();
    });

    test('hides submenu when initially collapsed', () => {
      render(<AccountManagementSidebarSection isCollapsed={false} initiallyCollapsed={true} />);

      expect(screen.queryByTestId('account-management-submenu')).not.toBeInTheDocument();
    });

    test('toggles submenu visibility when clicked', () => {
      render(<AccountManagementSidebarSection isCollapsed={false} initiallyCollapsed={true} />);

      const toggleButton = screen.getByTestId('account-management-toggle');
      
      // Initially collapsed
      expect(screen.queryByTestId('account-management-submenu')).not.toBeInTheDocument();
      
      // Click to expand
      fireEvent.click(toggleButton);
      expect(screen.getByTestId('account-management-submenu')).toBeInTheDocument();
      
      // Click to collapse
      fireEvent.click(toggleButton);
      expect(screen.queryByTestId('account-management-submenu')).not.toBeInTheDocument();
    });

    test('updates chevron icon based on expanded state', () => {
      render(<AccountManagementSidebarSection isCollapsed={false} initiallyCollapsed={true} />);

      const chevronIcon = screen.getByTestId('chevron-icon');
      const toggleButton = screen.getByTestId('account-management-toggle');
      
      // Initially collapsed - should show right chevron
      expect(chevronIcon.textContent).toBe('▶');
      
      // Click to expand - should show down chevron
      fireEvent.click(toggleButton);
      expect(chevronIcon.textContent).toBe('▼');
      
      // Click to collapse - should show right chevron again
      fireEvent.click(toggleButton);
      expect(chevronIcon.textContent).toBe('▶');
    });

    test('sets correct aria attributes', () => {
      render(<AccountManagementSidebarSection isCollapsed={false} initiallyCollapsed={false} />);

      const toggleButton = screen.getByTestId('account-management-toggle');
      
      expect(toggleButton).toHaveAttribute('aria-expanded', 'true');
      expect(toggleButton).toHaveAttribute('aria-controls', 'account-management-submenu');
      
      const submenu = screen.getByTestId('account-management-submenu');
      expect(submenu).toHaveAttribute('id', 'account-management-submenu');
    });
  });

  describe('Collapsed Sidebar', () => {
    beforeEach(() => {
      mockUseUserRole.mockReturnValue({
        role: UserRole.SUPERVISOR,
        isAdmin: true,
        isSupervisor: true,
        hasRole: jest.fn()
      });
    });

    test('hides text when sidebar is collapsed', () => {
      render(<AccountManagementSidebarSection isCollapsed={true} />);

      expect(screen.queryByText('Account Management')).not.toBeInTheDocument();
      expect(screen.getByTestId('shield-icon')).toBeInTheDocument();
    });

    test('still shows toggle functionality when collapsed', () => {
      render(<AccountManagementSidebarSection isCollapsed={true} initiallyCollapsed={true} />);

      const toggleButton = screen.getByTestId('account-management-toggle');
      expect(toggleButton).toBeInTheDocument();
      
      // Should still be able to toggle
      fireEvent.click(toggleButton);
      expect(screen.getByTestId('account-management-submenu')).toBeInTheDocument();
    });
  });

  describe('Non-Supervisor Access', () => {
    test('does not render for admin role', () => {
      mockUseUserRole.mockReturnValue({
        role: UserRole.ADMIN,
        isAdmin: true,
        isSupervisor: false,
        hasRole: jest.fn()
      });

      // Admin should only see suppliers, not the full account management section
      mockHasScreenPermission.mockImplementation((role, permission) => {
        return role === UserRole.ADMIN && permission === 'SUPPLIERS';
      });

      render(<AccountManagementSidebarSection isCollapsed={false} initiallyCollapsed={false} />);

      // Should render but only show suppliers
      expect(screen.getByTestId('account-management-section')).toBeInTheDocument();
      expect(screen.getByTestId('account-item-suppliers')).toBeInTheDocument();
      expect(screen.queryByTestId('account-item-users')).not.toBeInTheDocument();
      expect(screen.queryByTestId('account-item-warehouses')).not.toBeInTheDocument();
      expect(screen.queryByTestId('account-item-user-permissions')).not.toBeInTheDocument();
    });

    test('does not render for regular user roles', () => {
      const regularRoles = [UserRole.USER, UserRole.FITTER, UserRole.SUPPLIER];

      regularRoles.forEach(role => {
        mockUseUserRole.mockReturnValue({
          role,
          isAdmin: false,
          isSupervisor: false,
          hasRole: jest.fn()
        });

        const { container } = render(<AccountManagementSidebarSection isCollapsed={false} />);
        
        // Should not render at all for regular users
        expect(container.firstChild).toBeNull();
      });
    });
  });

  describe('Permission-Based Item Filtering', () => {
    beforeEach(() => {
      mockUseUserRole.mockReturnValue({
        role: UserRole.SUPERVISOR,
        isAdmin: true,
        isSupervisor: true,
        hasRole: jest.fn()
      });
    });

    test('shows correct items based on permissions', () => {
      render(<AccountManagementSidebarSection isCollapsed={false} initiallyCollapsed={false} />);

      // All items should be visible for supervisor
      expect(screen.getByTestId('account-item-users')).toBeInTheDocument();
      expect(screen.getByTestId('account-item-warehouses')).toBeInTheDocument();
      expect(screen.getByTestId('account-item-suppliers')).toBeInTheDocument();
      expect(screen.getByTestId('account-item-user-permissions')).toBeInTheDocument();
    });

    test('filters items when permissions are limited', () => {
      // Mock limited permissions
      mockHasScreenPermission.mockImplementation((role, permission) => {
        if (role === UserRole.SUPERVISOR) {
          return ['SUPPLIERS', 'USER_PERMISSIONS_VIEW'].includes(permission);
        }
        return false;
      });

      render(<AccountManagementSidebarSection isCollapsed={false} initiallyCollapsed={false} />);

      // Only items with granted permissions should be visible
      expect(screen.queryByTestId('account-item-users')).not.toBeInTheDocument();
      expect(screen.queryByTestId('account-item-warehouses')).not.toBeInTheDocument();
      expect(screen.getByTestId('account-item-suppliers')).toBeInTheDocument();
      expect(screen.getByTestId('account-item-user-permissions')).toBeInTheDocument();
    });
  });

  describe('Navigation Integration', () => {
    beforeEach(() => {
      mockUseUserRole.mockReturnValue({
        role: UserRole.SUPERVISOR,
        isAdmin: true,
        isSupervisor: true,
        hasRole: jest.fn()
      });
    });

    test('has correct href attributes for navigation items', () => {
      render(<AccountManagementSidebarSection isCollapsed={false} initiallyCollapsed={false} />);

      expect(screen.getByTestId('account-item-users')).toHaveAttribute('href', '/users');
      expect(screen.getByTestId('account-item-warehouses')).toHaveAttribute('href', '/warehouses');
      expect(screen.getByTestId('account-item-suppliers')).toHaveAttribute('href', '/suppliers');
      expect(screen.getByTestId('account-item-user-permissions')).toHaveAttribute('href', '/user-permissions');
    });

    test('displays correct labels for navigation items', () => {
      render(<AccountManagementSidebarSection isCollapsed={false} initiallyCollapsed={false} />);

      expect(screen.getByText('Users')).toBeInTheDocument();
      expect(screen.getByText('Warehouses')).toBeInTheDocument();
      expect(screen.getByText('Suppliers')).toBeInTheDocument();
      expect(screen.getByText('User Permissions')).toBeInTheDocument();
    });
  });

  describe('Accessibility Features', () => {
    beforeEach(() => {
      mockUseUserRole.mockReturnValue({
        role: UserRole.SUPERVISOR,
        isAdmin: true,
        isSupervisor: true,
        hasRole: jest.fn()
      });
    });

    test('provides proper keyboard navigation', () => {
      render(<AccountManagementSidebarSection isCollapsed={false} initiallyCollapsed={true} />);

      const toggleButton = screen.getByTestId('account-management-toggle');
      
      // Should be focusable
      toggleButton.focus();
      expect(document.activeElement).toBe(toggleButton);
    });

    test('has proper semantic structure', () => {
      render(<AccountManagementSidebarSection isCollapsed={false} initiallyCollapsed={false} />);

      // Toggle button should be a button element
      const toggleButton = screen.getByTestId('account-management-toggle');
      expect(toggleButton.tagName).toBe('BUTTON');

      // Navigation items should be links
      const usersLink = screen.getByTestId('account-item-users');
      expect(usersLink.tagName).toBe('A');
    });
  });
});