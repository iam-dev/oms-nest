import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import Customers from '@/components/Customers';
import * as customersModule from '@/services/customers';
import * as fittersModule from '@/services/fitters';
import { useUserRole } from '@/hooks/useUserRole';
import { useAuth } from '@/context/AuthContext';

jest.mock('@/services/customers', () => ({
  fetchCustomers: jest.fn().mockResolvedValue({ 'hydra:member': [], 'hydra:totalItems': 0 }),
  createCustomer: jest.fn(),
  updateCustomer: jest.fn(),
  deleteCustomer: jest.fn(),
}));

jest.mock('@/services/fitters', () => ({
  fetchActiveFitters: jest.fn(),
}));

jest.mock('@/hooks/useUserRole', () => ({ useUserRole: jest.fn() }));
jest.mock('@/context/AuthContext', () => ({ useAuth: jest.fn() }));

// Capture what the page hands to the modal; the modal itself is tested on its own.
const modalProps: Record<string, unknown>[] = [];
jest.mock('@/components/shared/CustomerEditModal', () => ({
  CustomerEditModal: (props: Record<string, unknown>) => {
    modalProps.push(props);
    return null;
  },
}));
jest.mock('@/components/shared/CustomerDetailModal', () => ({ CustomerDetailModal: () => null }));

const fetchActiveFitters = fittersModule.fetchActiveFitters as jest.Mock;
const fetchCustomers = customersModule.fetchCustomers as jest.Mock;
const mockUseUserRole = useUserRole as jest.Mock;
const mockUseAuth = useAuth as jest.Mock;

function roleInfo(overrides: Partial<{ isAdmin: boolean; isFitter: boolean }>) {
  return {
    role: overrides.isFitter ? 'ROLE_FITTER' : 'ROLE_ADMIN',
    isAdmin: false,
    isSupervisor: false,
    isFitter: false,
    isSupplier: false,
    isUser: false,
    hasRole: jest.fn(),
    hasAnyRole: jest.fn(),
    ...overrides,
  };
}

function latestCreateModalProps() {
  // The page renders an edit modal (customer set/null) and a create modal (customer null,
  // onSave = create). Take the last props of the create instance.
  return [...modalProps].reverse().find((p) => p.customer === null)!;
}

describe('Customers page — Fitter LOV wiring', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    modalProps.length = 0;
    fetchCustomers.mockResolvedValue({ 'hydra:member': [], 'hydra:totalItems': 0 });
  });

  it('loads the active fitters for an admin and passes them to the modal', async () => {
    mockUseUserRole.mockReturnValue(roleInfo({ isAdmin: true }));
    mockUseAuth.mockReturnValue({ user: { username: 'customcary', role: 'ROLE_ADMIN' } });
    fetchActiveFitters.mockResolvedValue([
      { id: 312, name: 'Alice Fitter' },
      { id: 77, name: 'Bob Fitter' },
    ]);

    render(<Customers />);

    await waitFor(() => expect(fetchActiveFitters).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(latestCreateModalProps().fitters).toEqual([
        { id: 312, name: 'Alice Fitter' },
        { id: 77, name: 'Bob Fitter' },
      ]),
    );
    expect(latestCreateModalProps().lockedFitterName).toBeUndefined();
  });

  it('does not call the admin-only fitters endpoint for a fitter and locks the LOV to their name', async () => {
    mockUseUserRole.mockReturnValue(roleInfo({ isFitter: true }));
    mockUseAuth.mockReturnValue({
      user: { username: 'janef', firstName: 'Jane', lastName: 'Fitter', role: 'ROLE_FITTER' },
    });

    render(<Customers />);

    await waitFor(() => expect(screen.getByText('Customers')).toBeInTheDocument());
    expect(fetchActiveFitters).not.toHaveBeenCalled();
    expect(latestCreateModalProps().lockedFitterName).toBe('Jane Fitter');
    expect(latestCreateModalProps().fitters).toBeUndefined();
  });

  it('falls back to the username when the fitter has no first/last name', async () => {
    mockUseUserRole.mockReturnValue(roleInfo({ isFitter: true }));
    mockUseAuth.mockReturnValue({ user: { username: 'janef', role: 'ROLE_FITTER' } });

    render(<Customers />);

    await waitFor(() => expect(screen.getByText('Customers')).toBeInTheDocument());
    expect(latestCreateModalProps().lockedFitterName).toBe('janef');
  });
});
