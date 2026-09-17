import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SupplierEditModal } from '@/components/shared/SupplierEditModal';
import type { Supplier } from '@/services/suppliers';

jest.mock('lucide-react', () => ({
  AlertTriangle: ({ className }: { className?: string }) => (
    <span data-testid="alert-icon" className={className} />
  ),
}));

jest.mock('@/utils/logger', () => ({
  logger: { log: jest.fn(), debug: jest.fn(), warn: jest.fn(), error: jest.fn(), info: jest.fn() },
}));

jest.mock('@/components/ui/dialog', () => ({
  Dialog: ({ open, children }: { open: boolean; children: React.ReactNode }) =>
    open ? <div data-testid="dialog">{children}</div> : null,
  DialogContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dialog-content">{children}</div>
  ),
  DialogHeader: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dialog-header">{children}</div>
  ),
  DialogTitle: ({ children }: { children: React.ReactNode }) => (
    <h2 data-testid="dialog-title">{children}</h2>
  ),
  DialogDescription: ({ children }: { children: React.ReactNode }) => (
    <p data-testid="dialog-description">{children}</p>
  ),
}));

jest.mock('@/components/ui/input', () => ({
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => (
    <input data-testid={`input-${props.placeholder}`} {...props} />
  ),
}));

jest.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
    disabled,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
  }) => (
    <button
      data-testid={`btn-${typeof children === 'string' ? children : 'button'}`}
      onClick={onClick}
      disabled={disabled}
      type="button"
    >
      {children}
    </button>
  ),
}));

// Native <select> stand-in for the shadcn Select, keyed by the `name` prop.
jest.mock('@/components/ui/select', () => {
  const mockReact = jest.requireActual('react') as typeof import('react');
  const mockSelectCtx = mockReact.createContext<{
    value?: string;
    onValueChange?: (v: string) => void;
    name?: string;
  }>({});

  function Select({
    value,
    onValueChange,
    children,
    name,
  }: {
    value?: string;
    onValueChange?: (v: string) => void;
    children: React.ReactNode;
    name?: string;
  }) {
    return mockReact.createElement(
      mockSelectCtx.Provider,
      { value: { value, onValueChange, name } },
      mockReact.createElement('div', { 'data-testid': 'select-root' }, children),
    );
  }
  function SelectTrigger({ children }: { children: React.ReactNode }) {
    return mockReact.createElement('div', null, children);
  }
  function SelectValue({ placeholder }: { placeholder?: string }) {
    return mockReact.createElement('span', null, placeholder);
  }
  function SelectContent({ children }: { children: React.ReactNode }) {
    const { value, onValueChange, name } = mockReact.useContext(mockSelectCtx);
    return mockReact.createElement(
      'select',
      {
        'data-testid': name ? `select-${name}` : 'select-content',
        value: value ?? '',
        onChange: (e: { target: { value: string } }) => onValueChange?.(e.target.value),
      },
      children,
    );
  }
  function SelectItem({ value, children }: { value: string; children: React.ReactNode }) {
    return mockReact.createElement('option', { value }, children);
  }
  return { Select, SelectTrigger, SelectValue, SelectContent, SelectItem };
});

const sampleSupplier: Supplier = {
  id: 7,
  userId: 417,
  name: 'Lex International',
  username: 'rohansuri',
  email: 'rohansuri@lexintnl.com',
  address: '86/300-A, Raipurwa, G.T.Road',
  city: 'Kanpur',
  country: 'India',
  state: 'Uttar Pradesh',
  zipcode: '208003',
  phoneNo: '+91-512-1',
  cellNo: '+91-98-2',
  currency: 1,
  enabled: true,
};

const makeDefaultProps = () => ({
  isOpen: true,
  onClose: jest.fn(),
  onSave: jest.fn().mockResolvedValue(undefined),
});

async function fillValidCreateForm(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByTestId('input-Full Name'), 'New Factory Ltd');
  await user.type(screen.getByTestId('input-Username'), 'newfactory');
  await user.type(screen.getByTestId('input-Email Address'), 'new@factory.test');
  await user.type(screen.getByTestId('input-Street Address'), '1 Industrial Way');
  await user.type(screen.getByTestId('input-City'), 'Walsall');
  await user.selectOptions(screen.getByTestId('select-country'), 'United Kingdom');
}

describe('SupplierEditModal', () => {
  let defaultProps: ReturnType<typeof makeDefaultProps>;

  beforeEach(() => {
    defaultProps = makeDefaultProps();
  });

  describe('field set — mirrors the legacy factory form', () => {
    it('renders every legacy field in create mode', () => {
      render(<SupplierEditModal {...defaultProps} supplier={null} />);

      for (const placeholder of [
        'Full Name',
        'Username',
        'Email Address',
        'Street Address',
        'City',
        'State/Province',
        'Postal/Zip Code',
        'Phone Number',
        'Cellphone Number',
      ]) {
        expect(screen.getByTestId(`input-${placeholder}`)).toBeInTheDocument();
      }
      expect(screen.getByTestId('select-country')).toBeInTheDocument();
      expect(screen.getByTestId('select-enabled')).toBeInTheDocument();
    });

    it('has no Currency select (legacy factories have no currency)', () => {
      render(<SupplierEditModal {...defaultProps} supplier={null} />);

      expect(screen.queryByTestId('select-currency')).not.toBeInTheDocument();
      expect(screen.queryByText(/currency/i)).not.toBeInTheDocument();
    });

    it('has no password field — the factory sets its own via the welcome email', () => {
      render(<SupplierEditModal {...defaultProps} supplier={null} />);

      expect(screen.queryByTestId('input-Enter password')).not.toBeInTheDocument();
      expect(screen.queryByTestId('input-Confirm new password')).not.toBeInTheDocument();
      expect(document.querySelector('input[type="password"]')).toBeNull();
    });

    it('titles the dialog "Add New Factory" in create mode', () => {
      render(<SupplierEditModal {...defaultProps} supplier={null} />);

      expect(screen.getByTestId('dialog-title')).toHaveTextContent('Add New Factory');
      expect(screen.getByTestId('btn-Create factory')).toBeInTheDocument();
    });
  });

  describe('edit mode — pre-population', () => {
    it('fills every field from the supplier prop', () => {
      render(<SupplierEditModal {...defaultProps} supplier={sampleSupplier} />);

      expect(screen.getByTestId('input-Full Name')).toHaveValue('Lex International');
      expect(screen.getByTestId('input-Username')).toHaveValue('rohansuri');
      expect(screen.getByTestId('input-Email Address')).toHaveValue('rohansuri@lexintnl.com');
      expect(screen.getByTestId('input-Street Address')).toHaveValue('86/300-A, Raipurwa, G.T.Road');
      expect(screen.getByTestId('input-City')).toHaveValue('Kanpur');
      expect(screen.getByTestId('input-State/Province')).toHaveValue('Uttar Pradesh');
      expect(screen.getByTestId('input-Postal/Zip Code')).toHaveValue('208003');
      expect(screen.getByTestId('input-Phone Number')).toHaveValue('+91-512-1');
      expect(screen.getByTestId('input-Cellphone Number')).toHaveValue('+91-98-2');
      expect(screen.getByTestId('select-enabled')).toHaveValue('true');
    });

    it('shows the stored country even when it is not in the preset list', () => {
      render(<SupplierEditModal {...defaultProps} supplier={sampleSupplier} />);

      expect(screen.getByTestId('select-country')).toHaveValue('India');
    });

    it('makes username read-only (login names are immutable)', () => {
      render(<SupplierEditModal {...defaultProps} supplier={sampleSupplier} />);

      expect(screen.getByTestId('input-Username')).toBeDisabled();
    });

    it('titles the dialog with the factory name', () => {
      render(<SupplierEditModal {...defaultProps} supplier={sampleSupplier} />);

      expect(screen.getByTestId('dialog-title')).toHaveTextContent('Edit Factory Lex International');
      expect(screen.getByTestId('btn-Save factory')).toBeInTheDocument();
    });
  });

  describe('validation', () => {
    it.each([
      ['Full Name', 'Full name is required'],
      ['Username', 'Username is required'],
      ['Email Address', 'Email is required'],
      ['Street Address', 'Address is required'],
      ['City', 'City is required'],
    ])('blocks save when %s is empty', async (placeholder, message) => {
      const user = userEvent.setup();
      render(<SupplierEditModal {...defaultProps} supplier={null} />);
      await fillValidCreateForm(user);
      await user.clear(screen.getByTestId(`input-${placeholder}`));

      await user.click(screen.getByTestId('btn-Create factory'));

      expect(await screen.findByText(message)).toBeInTheDocument();
      expect(defaultProps.onSave).not.toHaveBeenCalled();
    });

    it('blocks save when no country is selected', async () => {
      const user = userEvent.setup();
      render(<SupplierEditModal {...defaultProps} supplier={null} />);
      await user.type(screen.getByTestId('input-Full Name'), 'X');
      await user.type(screen.getByTestId('input-Username'), 'x');
      await user.type(screen.getByTestId('input-Email Address'), 'x@y.test');
      await user.type(screen.getByTestId('input-Street Address'), '1');
      await user.type(screen.getByTestId('input-City'), 'C');

      await user.click(screen.getByTestId('btn-Create factory'));

      expect(await screen.findByText('Country is required')).toBeInTheDocument();
      expect(defaultProps.onSave).not.toHaveBeenCalled();
    });

    it('rejects a malformed email', async () => {
      const user = userEvent.setup();
      render(<SupplierEditModal {...defaultProps} supplier={null} />);
      await fillValidCreateForm(user);
      await user.clear(screen.getByTestId('input-Email Address'));
      await user.type(screen.getByTestId('input-Email Address'), 'not-an-email');

      await user.click(screen.getByTestId('btn-Create factory'));

      expect(await screen.findByText('Please enter a valid email address')).toBeInTheDocument();
      expect(defaultProps.onSave).not.toHaveBeenCalled();
    });
  });

  describe('happy path', () => {
    it('passes the full form (incl. phone/cell/state/zip) to onSave on create', async () => {
      const user = userEvent.setup();
      render(<SupplierEditModal {...defaultProps} supplier={null} />);
      await fillValidCreateForm(user);
      await user.type(screen.getByTestId('input-State/Province'), 'West Midlands');
      await user.type(screen.getByTestId('input-Postal/Zip Code'), 'WS1 1AA');
      await user.type(screen.getByTestId('input-Phone Number'), '+44-1');
      await user.type(screen.getByTestId('input-Cellphone Number'), '+44-2');

      await user.click(screen.getByTestId('btn-Create factory'));

      await waitFor(() => expect(defaultProps.onSave).toHaveBeenCalledTimes(1));
      expect(defaultProps.onSave).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'New Factory Ltd',
          username: 'newfactory',
          email: 'new@factory.test',
          address: '1 Industrial Way',
          city: 'Walsall',
          country: 'United Kingdom',
          state: 'West Midlands',
          zipcode: 'WS1 1AA',
          phoneNo: '+44-1',
          cellNo: '+44-2',
          enabled: true,
        }),
      );
    });

    it('passes the changed status to onSave on edit', async () => {
      const user = userEvent.setup();
      render(<SupplierEditModal {...defaultProps} supplier={sampleSupplier} />);
      await user.selectOptions(screen.getByTestId('select-enabled'), 'false');

      await user.click(screen.getByTestId('btn-Save factory'));

      await waitFor(() => expect(defaultProps.onSave).toHaveBeenCalledTimes(1));
      expect(defaultProps.onSave.mock.calls[0][0]).toMatchObject({
        name: 'Lex International',
        enabled: false,
      });
    });
  });

  describe('error handling', () => {
    it('keeps the modal open and shows the error when onSave rejects', async () => {
      const user = userEvent.setup();
      defaultProps.onSave.mockRejectedValue(new Error('Failed to create factory: Username already exists'));
      render(<SupplierEditModal {...defaultProps} supplier={null} />);
      await fillValidCreateForm(user);

      await user.click(screen.getByTestId('btn-Create factory'));

      expect(await screen.findByText('Failed to create factory: Username already exists')).toBeInTheDocument();
      expect(defaultProps.onClose).not.toHaveBeenCalled();
    });
  });
});
