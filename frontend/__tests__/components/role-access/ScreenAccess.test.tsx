import React from 'react';
import { render, screen } from '@testing-library/react';
import { UserRole } from '@/types/Role';
import { RoleProtectedComponent } from '@/components/shared/RoleProtectedComponent';
import { getAllRoles, roleTestCases, hasScreenAccess } from '../../utils/roleTestHelpers';
import * as useUserRoleModule from '@/hooks/useUserRole';
import * as rolePermissionsModule from '@/utils/rolePermissions';

// Mock the hooks and utilities
jest.mock('@/hooks/useUserRole', () => ({
  useUserRole: jest.fn()
}));

jest.mock('@/utils/rolePermissions', () => ({
  hasScreenPermission: jest.fn(),
  SCREEN_PERMISSIONS: {
    DASHBOARD: 'DASHBOARD',
    ORDERS: 'ORDERS',
    CUSTOMERS: 'CUSTOMERS',
    FITTERS: 'FITTERS',
    REPORTS: 'REPORTS',
    SUPPLIERS: 'SUPPLIERS',
    BRANDS: 'BRANDS',
    MODELS: 'MODELS',
    LEATHER_TYPES: 'LEATHER_TYPES',
    OPTIONS: 'OPTIONS',
    EXTRAS: 'EXTRAS',
    PRESETS: 'PRESETS'
  }
}));

const mockUseUserRole = useUserRoleModule.useUserRole as jest.Mock;
const mockHasScreenPermission = rolePermissionsModule.hasScreenPermission as jest.Mock;

// Mock components representing different screens
const DashboardScreen = () => <div data-testid="dashboard-screen">Dashboard Content</div>;
const OrdersScreen = () => <div data-testid="orders-screen">Orders Content</div>;
const CustomersScreen = () => <div data-testid="customers-screen">Customers Content</div>;
const FittersScreen = () => <div data-testid="fitters-screen">Fitters Content</div>;
const ReportsScreen = () => <div data-testid="reports-screen">Reports Content</div>;
const SuppliersScreen = () => <div data-testid="suppliers-screen">Suppliers Content</div>;
const BrandsScreen = () => <div data-testid="brands-screen">Brands Content</div>;
const ModelsScreen = () => <div data-testid="models-screen">Models Content</div>;
const LeatherTypesScreen = () => <div data-testid="leathertypes-screen">Leather Types Content</div>;
const OptionsScreen = () => <div data-testid="options-screen">Options Content</div>;
const ExtrasScreen = () => <div data-testid="extras-screen">Extras Content</div>;
const PresetsScreen = () => <div data-testid="presets-screen">Presets Content</div>;

describe('Screen Access Control', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup realistic permission implementation
    mockHasScreenPermission.mockImplementation((role, permission) => {
      const permissionMap = {
        'DASHBOARD': [UserRole.USER, UserRole.FITTER, UserRole.SUPPLIER, UserRole.ADMIN, UserRole.SUPERVISOR],
        'ORDERS': [UserRole.USER, UserRole.FITTER, UserRole.ADMIN, UserRole.SUPERVISOR],
        'CUSTOMERS': [UserRole.FITTER, UserRole.ADMIN, UserRole.SUPERVISOR],
        'FITTERS': [UserRole.ADMIN, UserRole.SUPERVISOR],
        'REPORTS': [UserRole.ADMIN, UserRole.SUPERVISOR],
        'SUPPLIERS': [UserRole.SUPPLIER, UserRole.ADMIN, UserRole.SUPERVISOR],
        'BRANDS': [UserRole.USER, UserRole.ADMIN, UserRole.SUPERVISOR],
        'MODELS': [UserRole.USER, UserRole.ADMIN, UserRole.SUPERVISOR],
        'LEATHER_TYPES': [UserRole.USER, UserRole.ADMIN, UserRole.SUPERVISOR],
        'OPTIONS': [UserRole.USER, UserRole.ADMIN, UserRole.SUPERVISOR],
        'EXTRAS': [UserRole.USER, UserRole.ADMIN, UserRole.SUPERVISOR],
        'PRESETS': [UserRole.USER, UserRole.ADMIN, UserRole.SUPERVISOR]
      };
      
      const allowedRoles = permissionMap[permission as keyof typeof permissionMap] || [];
      
      // Handle supervisor inheritance
      if (role === UserRole.SUPERVISOR) {
        return allowedRoles.includes(UserRole.SUPERVISOR) || allowedRoles.includes(UserRole.ADMIN);
      }
      
      return allowedRoles.includes(role);
    });
  });

  const TestApp = ({ userRole }: { userRole: UserRole | null }) => {
    mockUseUserRole.mockReturnValue({
      role: userRole,
      hasRole: jest.fn()
    });

    return (
      <div data-testid="app">
        <RoleProtectedComponent requiredPermission="DASHBOARD">
          <DashboardScreen />
        </RoleProtectedComponent>
        
        <RoleProtectedComponent requiredPermission="ORDERS">
          <OrdersScreen />
        </RoleProtectedComponent>
        
        <RoleProtectedComponent requiredPermission="CUSTOMERS">
          <CustomersScreen />
        </RoleProtectedComponent>
        
        <RoleProtectedComponent requiredPermission="FITTERS">
          <FittersScreen />
        </RoleProtectedComponent>
        
        <RoleProtectedComponent requiredPermission="REPORTS">
          <ReportsScreen />
        </RoleProtectedComponent>
        
        <RoleProtectedComponent requiredPermission="SUPPLIERS">
          <SuppliersScreen />
        </RoleProtectedComponent>
        
        <RoleProtectedComponent requiredPermission="BRANDS">
          <BrandsScreen />
        </RoleProtectedComponent>
        
        <RoleProtectedComponent requiredPermission="MODELS">
          <ModelsScreen />
        </RoleProtectedComponent>
        
        <RoleProtectedComponent requiredPermission="LEATHER_TYPES">
          <LeatherTypesScreen />
        </RoleProtectedComponent>
        
        <RoleProtectedComponent requiredPermission="OPTIONS">
          <OptionsScreen />
        </RoleProtectedComponent>
        
        <RoleProtectedComponent requiredPermission="EXTRAS">
          <ExtrasScreen />
        </RoleProtectedComponent>
        
        <RoleProtectedComponent requiredPermission="PRESETS">
          <PresetsScreen />
        </RoleProtectedComponent>
      </div>
    );
  };

  describe('Individual Role Screen Access', () => {
    getAllRoles().forEach(role => {
      const testCase = roleTestCases.find(tc => tc.role === role);
      if (!testCase) return;

      describe(`${testCase.roleName} Role Access`, () => {
        test(`${testCase.roleName} can access allowed screens`, () => {
          render(<TestApp userRole={role} />);

          testCase.expectedAccess.screens.forEach(screenName => {
            const testId = getTestIdFromScreen(screenName);
            if (testId) {
              expect(screen.getByTestId(testId)).toBeInTheDocument();
            }
          });
        });

        test(`${testCase.roleName} cannot access denied screens`, () => {
          render(<TestApp userRole={role} />);

          testCase.expectedAccess.deniedScreens.forEach(screenName => {
            const testId = getTestIdFromScreen(screenName);
            if (testId) {
              expect(screen.queryByTestId(testId)).not.toBeInTheDocument();
            }
          });
        });

        test(`${testCase.roleName} screen access matches expected configuration`, () => {
          render(<TestApp userRole={role} />);

          // Define all possible screens and their test IDs
          const allScreens = [
            { name: 'dashboard', testId: 'dashboard-screen' },
            { name: 'orders', testId: 'orders-screen' },
            { name: 'customers', testId: 'customers-screen' },
            { name: 'fitters', testId: 'fitters-screen' },
            { name: 'reports', testId: 'reports-screen' },
            { name: 'suppliers', testId: 'suppliers-screen' },
            { name: 'brands', testId: 'brands-screen' },
            { name: 'models', testId: 'models-screen' },
            { name: 'leathertypes', testId: 'leathertypes-screen' },
            { name: 'options', testId: 'options-screen' },
            { name: 'extras', testId: 'extras-screen' },
            { name: 'presets', testId: 'presets-screen' }
          ];

          allScreens.forEach(({ name, testId }) => {
            const shouldHaveAccess = hasScreenAccess(role, name);
            const element = screen.queryByTestId(testId);

            if (shouldHaveAccess) {
              expect(element).toBeInTheDocument();
            } else {
              expect(element).not.toBeInTheDocument();
            }
          });
        });
      });
    });
  });

  describe('Universal Access Screens', () => {
    test('Dashboard is accessible to all authenticated users', () => {
      getAllRoles().forEach(role => {
        const { unmount } = render(<TestApp userRole={role} />);
        expect(screen.getByTestId('dashboard-screen')).toBeInTheDocument();
        unmount();
      });
    });
  });

  describe('Admin-Only Screens', () => {
    const adminOnlyScreens = ['fitters', 'reports'];
    const adminRoles = [UserRole.ADMIN, UserRole.SUPERVISOR];
    const nonAdminRoles = [UserRole.USER, UserRole.FITTER, UserRole.SUPPLIER];

    adminOnlyScreens.forEach(screenName => {
      test(`${screenName} screen is only accessible to admin roles`, () => {
        const testId = getTestIdFromScreen(screenName);
        if (!testId) return;

        // Test admin access
        adminRoles.forEach(role => {
          const { unmount } = render(<TestApp userRole={role} />);
          expect(screen.getByTestId(testId)).toBeInTheDocument();
          unmount();
        });

        // Test non-admin denial
        nonAdminRoles.forEach(role => {
          const { unmount } = render(<TestApp userRole={role} />);
          expect(screen.queryByTestId(testId)).not.toBeInTheDocument();
          unmount();
        });
      });
    });
  });

  describe('Role-Specific Access', () => {
    test('Suppliers can only access dashboard and suppliers screen', () => {
      render(<TestApp userRole={UserRole.SUPPLIER} />);

      // Should have access
      expect(screen.getByTestId('dashboard-screen')).toBeInTheDocument();
      expect(screen.getByTestId('suppliers-screen')).toBeInTheDocument();

      // Should not have access
      expect(screen.queryByTestId('orders-screen')).not.toBeInTheDocument();
      expect(screen.queryByTestId('customers-screen')).not.toBeInTheDocument();
      expect(screen.queryByTestId('fitters-screen')).not.toBeInTheDocument();
      expect(screen.queryByTestId('reports-screen')).not.toBeInTheDocument();
      expect(screen.queryByTestId('brands-screen')).not.toBeInTheDocument();
    });

    test('Users can access dashboard, orders, and saddle modeling screens', () => {
      render(<TestApp userRole={UserRole.USER} />);

      // Should have access
      expect(screen.getByTestId('dashboard-screen')).toBeInTheDocument();
      expect(screen.getByTestId('orders-screen')).toBeInTheDocument();
      expect(screen.getByTestId('brands-screen')).toBeInTheDocument();
      expect(screen.getByTestId('models-screen')).toBeInTheDocument();
      expect(screen.getByTestId('leathertypes-screen')).toBeInTheDocument();
      expect(screen.getByTestId('options-screen')).toBeInTheDocument();
      expect(screen.getByTestId('extras-screen')).toBeInTheDocument();
      expect(screen.getByTestId('presets-screen')).toBeInTheDocument();

      // Should not have access
      expect(screen.queryByTestId('customers-screen')).not.toBeInTheDocument();
      expect(screen.queryByTestId('fitters-screen')).not.toBeInTheDocument();
      expect(screen.queryByTestId('reports-screen')).not.toBeInTheDocument();
      expect(screen.queryByTestId('suppliers-screen')).not.toBeInTheDocument();
    });

    test('Fitters can access dashboard, orders, and customers but not saddle modeling', () => {
      render(<TestApp userRole={UserRole.FITTER} />);

      // Should have access
      expect(screen.getByTestId('dashboard-screen')).toBeInTheDocument();
      expect(screen.getByTestId('orders-screen')).toBeInTheDocument();
      expect(screen.getByTestId('customers-screen')).toBeInTheDocument();

      // Should not have access
      expect(screen.queryByTestId('fitters-screen')).not.toBeInTheDocument();
      expect(screen.queryByTestId('reports-screen')).not.toBeInTheDocument();
      expect(screen.queryByTestId('suppliers-screen')).not.toBeInTheDocument();
      expect(screen.queryByTestId('brands-screen')).not.toBeInTheDocument();
      expect(screen.queryByTestId('models-screen')).not.toBeInTheDocument();
      expect(screen.queryByTestId('leathertypes-screen')).not.toBeInTheDocument();
      expect(screen.queryByTestId('options-screen')).not.toBeInTheDocument();
      expect(screen.queryByTestId('extras-screen')).not.toBeInTheDocument();
      expect(screen.queryByTestId('presets-screen')).not.toBeInTheDocument();
    });

    test('Admins can access all screens', () => {
      render(<TestApp userRole={UserRole.ADMIN} />);

      const allScreens = [
        'dashboard-screen', 'orders-screen', 'customers-screen', 'fitters-screen',
        'reports-screen', 'suppliers-screen', 'brands-screen', 'models-screen',
        'leathertypes-screen', 'options-screen', 'extras-screen', 'presets-screen'
      ];

      allScreens.forEach(testId => {
        expect(screen.getByTestId(testId)).toBeInTheDocument();
      });
    });

    test('Supervisors can access all screens (inherits admin permissions)', () => {
      render(<TestApp userRole={UserRole.SUPERVISOR} />);

      const allScreens = [
        'dashboard-screen', 'orders-screen', 'customers-screen', 'fitters-screen',
        'reports-screen', 'suppliers-screen', 'brands-screen', 'models-screen',
        'leathertypes-screen', 'options-screen', 'extras-screen', 'presets-screen'
      ];

      allScreens.forEach(testId => {
        expect(screen.getByTestId(testId)).toBeInTheDocument();
      });
    });
  });

  describe('Unauthenticated Access', () => {
    test('null user cannot access any screens', () => {
      render(<TestApp userRole={null} />);

      const allScreens = [
        'dashboard-screen', 'orders-screen', 'customers-screen', 'fitters-screen',
        'reports-screen', 'suppliers-screen', 'brands-screen', 'models-screen',
        'leathertypes-screen', 'options-screen', 'extras-screen', 'presets-screen'
      ];

      allScreens.forEach(testId => {
        expect(screen.queryByTestId(testId)).not.toBeInTheDocument();
      });
    });
  });

  describe('Permission System Integration', () => {
    test('hasScreenPermission is called with correct parameters for each screen', () => {
      render(<TestApp userRole={UserRole.ADMIN} />);

      // Check that hasScreenPermission was called for each screen
      const expectedCalls = [
        [UserRole.ADMIN, 'DASHBOARD'],
        [UserRole.ADMIN, 'ORDERS'],
        [UserRole.ADMIN, 'CUSTOMERS'],
        [UserRole.ADMIN, 'FITTERS'],
        [UserRole.ADMIN, 'REPORTS'],
        [UserRole.ADMIN, 'SUPPLIERS'],
        [UserRole.ADMIN, 'BRANDS'],
        [UserRole.ADMIN, 'MODELS'],
        [UserRole.ADMIN, 'LEATHER_TYPES'],
        [UserRole.ADMIN, 'OPTIONS'],
        [UserRole.ADMIN, 'EXTRAS'],
        [UserRole.ADMIN, 'PRESETS']
      ];

      expectedCalls.forEach(([role, permission]) => {
        expect(mockHasScreenPermission).toHaveBeenCalledWith(role, permission);
      });
    });
  });
});

// Helper function to map screen names to test IDs
function getTestIdFromScreen(screen: string): string | null {
  const mapping: Record<string, string> = {
    'dashboard': 'dashboard-screen',
    'orders': 'orders-screen',
    'customers': 'customers-screen',
    'fitters': 'fitters-screen',
    'reports': 'reports-screen',
    'suppliers': 'suppliers-screen',
    'brands': 'brands-screen',
    'models': 'models-screen',
    'leathertypes': 'leathertypes-screen',
    'options': 'options-screen',
    'extras': 'extras-screen',
    'presets': 'presets-screen'
  };

  return mapping[screen] || null;
}