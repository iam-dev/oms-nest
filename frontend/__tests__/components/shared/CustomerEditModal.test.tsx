import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CustomerEditModal } from '@/components/shared/CustomerEditModal';
import type { Customer } from '@/services/customers';

// Mock shadcn dialog — renders children only when open=true
jest.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children, open }: { children: React.ReactNode; open: boolean }) =>
    open ? <div data-testid="dialog">{children}</div> : null,
  DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => (
    <h2 data-testid="dialog-title">{children}</h2>
  ),
  DialogDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
}));

// Mock Input — spread all props so onChange / value / placeholder work correctly
jest.mock('@/components/ui/input', () => ({
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => (
    <input data-testid={`input-${props.placeholder}`} {...props} />
  ),
}));

// Mock Button — forward all props so onClick / disabled work
jest.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
    disabled,
    ...rest
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    [key: string]: unknown;
  }) => (
    <button onClick={onClick} disabled={disabled} {...rest}>
      {children}
    </button>
  ),
}));

jest.mock('@/components/ui/select', () => ({
  Select: ({
    children,
  }: {
    children: React.ReactNode;
    onValueChange?: (value: string) => void;
    value?: string;
  }) => <div data-testid="select">{children}</div>,
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectValue: ({ placeholder }: { placeholder?: string }) => <span>{placeholder}</span>,
  SelectContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children, value }: { children: React.ReactNode; value: string }) => (
    <div data-value={value}>{children}</div>
  ),
}));

jest.mock('lucide-react', () => ({
  AlertTriangle: () => <span data-testid="alert-icon" />,
}));

jest.mock('@/utils/logger', () => ({
  logger: { log: jest.fn(), error: jest.fn(), warn: jest.fn() },
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const baseCustomer: Customer = {
  id: 'cust-42',
  name: 'Jane Doe',
  address: '123 Main St',
  city: 'Springfield',
  country: 'United States',
  state: 'IL',
  zipcode: '62701',
  email: 'jane@example.com',
  phoneNo: '555-1234',
  cellNo: '555-5678',
};

const defaultProps = {
  customer: null as Customer | null,
  isOpen: true,
  onClose: jest.fn(),
  onSave: jest.fn(() => Promise.resolve()),
};

function buildProps(overrides: Partial<typeof defaultProps> = {}) {
  return { ...defaultProps, ...overrides };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getNameInput(): HTMLInputElement {
  return screen.getByTestId('input-Customer Name') as HTMLInputElement;
}

/**
 * Returns the primary save button — the one whose text content is NOT
 * "Back to customers". Works for both "Create customer", "Save customer",
 * and "Saving..." states.
 */
function getSaveButton(): HTMLButtonElement {
  return screen
    .getAllByRole('button')
    .find((btn) => btn.textContent !== 'Back to customers') as HTMLButtonElement;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CustomerEditModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── Rendering: create mode ────────────────────────────────────────────────

  describe('Rendering — create mode (customer prop is null)', () => {
    it('renders the dialog when isOpen is true', () => {
      render(<CustomerEditModal {...buildProps()} />);

      expect(screen.getByTestId('dialog')).toBeInTheDocument();
    });

    it('does not render the dialog when isOpen is false', () => {
      render(<CustomerEditModal {...buildProps({ isOpen: false })} />);

      expect(screen.queryByTestId('dialog')).not.toBeInTheDocument();
    });

    it('shows "Create Customer" as the dialog title', () => {
      render(<CustomerEditModal {...buildProps()} />);

      expect(screen.getByTestId('dialog-title')).toHaveTextContent('Create Customer');
    });

    it('renders the save button with "Create customer" label', () => {
      render(<CustomerEditModal {...buildProps()} />);

      expect(getSaveButton()).toHaveTextContent('Create customer');
    });

    it('renders all expected input fields', () => {
      render(<CustomerEditModal {...buildProps()} />);

      expect(screen.getByTestId('input-Customer Name')).toBeInTheDocument();
      expect(screen.getByTestId('input-Street Address')).toBeInTheDocument();
      expect(screen.getByTestId('input-City')).toBeInTheDocument();
      expect(screen.getByTestId('input-State/Province')).toBeInTheDocument();
      expect(screen.getByTestId('input-Postal/Zip Code')).toBeInTheDocument();
      expect(screen.getByTestId('input-Email Address')).toBeInTheDocument();
      expect(screen.getByTestId('input-Phone Number')).toBeInTheDocument();
      expect(screen.getByTestId('input-Cell Number')).toBeInTheDocument();
    });

    it('name field starts empty in create mode', () => {
      render(<CustomerEditModal {...buildProps()} />);

      expect(getNameInput()).toHaveValue('');
    });

    it('renders the "Back to customers" cancel button', () => {
      render(<CustomerEditModal {...buildProps()} />);

      expect(screen.getByText('Back to customers')).toBeInTheDocument();
    });
  });

  // ── Rendering: edit mode ──────────────────────────────────────────────────

  describe('Rendering — edit mode (customer prop provided)', () => {
    it('shows "Edit Customer {id}" as the dialog title', () => {
      render(<CustomerEditModal {...buildProps({ customer: baseCustomer })} />);

      expect(screen.getByTestId('dialog-title')).toHaveTextContent(
        `Edit Customer ${baseCustomer.id}`
      );
    });

    it('renders the save button with "Save customer" label', () => {
      render(<CustomerEditModal {...buildProps({ customer: baseCustomer })} />);

      expect(getSaveButton()).toHaveTextContent('Save customer');
    });

    it('pre-populates the name field from the customer prop', () => {
      render(<CustomerEditModal {...buildProps({ customer: baseCustomer })} />);

      expect(getNameInput()).toHaveValue(baseCustomer.name);
    });

    it('pre-populates the address field from the customer prop', () => {
      render(<CustomerEditModal {...buildProps({ customer: baseCustomer })} />);

      expect(screen.getByTestId('input-Street Address')).toHaveValue(baseCustomer.address);
    });

    it('pre-populates the city field from the customer prop', () => {
      render(<CustomerEditModal {...buildProps({ customer: baseCustomer })} />);

      expect(screen.getByTestId('input-City')).toHaveValue(baseCustomer.city);
    });

    it('pre-populates the state field from the customer prop', () => {
      render(<CustomerEditModal {...buildProps({ customer: baseCustomer })} />);

      expect(screen.getByTestId('input-State/Province')).toHaveValue(baseCustomer.state);
    });

    it('pre-populates the zipcode field from the customer prop', () => {
      render(<CustomerEditModal {...buildProps({ customer: baseCustomer })} />);

      expect(screen.getByTestId('input-Postal/Zip Code')).toHaveValue(baseCustomer.zipcode);
    });

    it('pre-populates the email field from the customer prop', () => {
      render(<CustomerEditModal {...buildProps({ customer: baseCustomer })} />);

      expect(screen.getByTestId('input-Email Address')).toHaveValue(baseCustomer.email);
    });

    it('pre-populates the phone and cell number fields from the customer prop', () => {
      render(<CustomerEditModal {...buildProps({ customer: baseCustomer })} />);

      expect(screen.getByTestId('input-Phone Number')).toHaveValue(baseCustomer.phoneNo);
      expect(screen.getByTestId('input-Cell Number')).toHaveValue(baseCustomer.cellNo);
    });
  });

  // ── Validation ────────────────────────────────────────────────────────────

  describe('Validation', () => {
    it('shows "Customer name is required" error when name is empty and save is clicked', async () => {
      const onSave = jest.fn(() => Promise.resolve());
      render(<CustomerEditModal {...buildProps({ onSave })} />);

      // Name input is already empty in create mode — click save immediately
      fireEvent.click(getSaveButton());

      await waitFor(() => {
        expect(screen.getByText('Customer name is required')).toBeInTheDocument();
      });
      expect(onSave).not.toHaveBeenCalled();
    });

    it('shows the alert icon alongside the validation error', async () => {
      render(<CustomerEditModal {...buildProps()} />);

      fireEvent.click(getSaveButton());

      await waitFor(() => {
        expect(screen.getByTestId('alert-icon')).toBeInTheDocument();
      });
    });

    it('shows the "Error" heading alongside the error message', async () => {
      render(<CustomerEditModal {...buildProps()} />);

      fireEvent.click(getSaveButton());

      await waitFor(() => {
        expect(screen.getByText('Error')).toBeInTheDocument();
        expect(screen.getByText('Customer name is required')).toBeInTheDocument();
      });
    });

    it('rejects a name consisting only of whitespace', async () => {
      const user = userEvent.setup();
      const onSave = jest.fn(() => Promise.resolve());
      render(<CustomerEditModal {...buildProps({ onSave })} />);

      await user.type(getNameInput(), '   ');
      fireEvent.click(getSaveButton());

      await waitFor(() => {
        expect(screen.getByText('Customer name is required')).toBeInTheDocument();
      });
      expect(onSave).not.toHaveBeenCalled();
    });

    it('clears the validation error when the modal is reopened', async () => {
      const { rerender } = render(<CustomerEditModal {...buildProps()} />);

      // Trigger a validation error
      fireEvent.click(getSaveButton());
      await waitFor(() => {
        expect(screen.getByText('Customer name is required')).toBeInTheDocument();
      });

      // Close and reopen the modal
      rerender(<CustomerEditModal {...buildProps({ isOpen: false })} />);
      rerender(<CustomerEditModal {...buildProps({ isOpen: true })} />);

      expect(screen.queryByText('Customer name is required')).not.toBeInTheDocument();
    });
  });

  // ── Successful save ───────────────────────────────────────────────────────

  describe('Happy path — successful save', () => {
    it('calls onSave with the form data when a valid name is provided in create mode', async () => {
      const user = userEvent.setup();
      const onSave = jest.fn(() => Promise.resolve());
      render(<CustomerEditModal {...buildProps({ onSave })} />);

      await user.type(getNameInput(), 'New Customer');
      fireEvent.click(getSaveButton());

      await waitFor(() => {
        expect(onSave).toHaveBeenCalledTimes(1);
      });

      const savedPayload = (onSave.mock.calls[0] as unknown[])[0] as Partial<Customer>;
      expect(savedPayload.name).toBe('New Customer');
    });

    it('calls onSave with the complete edited customer in edit mode', async () => {
      const user = userEvent.setup();
      const onSave = jest.fn(() => Promise.resolve());
      render(<CustomerEditModal {...buildProps({ customer: baseCustomer, onSave })} />);

      // Clear and retype the name to simulate an edit
      await user.clear(getNameInput());
      await user.type(getNameInput(), 'Updated Name');
      fireEvent.click(getSaveButton());

      await waitFor(() => {
        expect(onSave).toHaveBeenCalledTimes(1);
      });

      const savedPayload = (onSave.mock.calls[0] as unknown[])[0] as Partial<Customer>;
      expect(savedPayload.name).toBe('Updated Name');
      // Unchanged fields should also be present in the payload
      expect(savedPayload.email).toBe(baseCustomer.email);
      expect(savedPayload.address).toBe(baseCustomer.address);
      expect(savedPayload.city).toBe(baseCustomer.city);
    });

    it('calls onClose after onSave resolves successfully', async () => {
      const user = userEvent.setup();
      const onClose = jest.fn();
      const onSave = jest.fn(() => Promise.resolve());
      render(<CustomerEditModal {...buildProps({ onClose, onSave })} />);

      await user.type(getNameInput(), 'Valid Name');
      fireEvent.click(getSaveButton());

      await waitFor(() => {
        expect(onClose).toHaveBeenCalledTimes(1);
      });
    });

    it('does not call onClose when onSave fails', async () => {
      const user = userEvent.setup();
      const onClose = jest.fn();
      const onSave = jest.fn(() => Promise.reject(new Error('Network error')));
      render(<CustomerEditModal {...buildProps({ onClose, onSave })} />);

      await user.type(getNameInput(), 'Valid Name');
      fireEvent.click(getSaveButton());

      await waitFor(() => {
        expect(screen.getByText('Network error')).toBeInTheDocument();
      });

      expect(onClose).not.toHaveBeenCalled();
    });
  });

  // ── onSave error handling ─────────────────────────────────────────────────

  describe('Error handling — onSave rejection', () => {
    it('displays the error message thrown by onSave', async () => {
      const user = userEvent.setup();
      const onSave = jest.fn(() => Promise.reject(new Error('Server unavailable')));
      render(<CustomerEditModal {...buildProps({ onSave })} />);

      await user.type(getNameInput(), 'Valid Name');
      fireEvent.click(getSaveButton());

      await waitFor(() => {
        expect(screen.getByText('Server unavailable')).toBeInTheDocument();
      });
    });

    it('displays a generic fallback message when onSave rejects with a non-Error value', async () => {
      const user = userEvent.setup();
      const onSave = jest.fn(() => Promise.reject('string rejection'));
      render(<CustomerEditModal {...buildProps({ onSave })} />);

      await user.type(getNameInput(), 'Valid Name');
      fireEvent.click(getSaveButton());

      await waitFor(() => {
        expect(
          screen.getByText('Failed to save customer. Please try again.')
        ).toBeInTheDocument();
      });
    });

    it('renders the alert icon when an onSave error is displayed', async () => {
      const user = userEvent.setup();
      const onSave = jest.fn(() => Promise.reject(new Error('Conflict')));
      render(<CustomerEditModal {...buildProps({ onSave })} />);

      await user.type(getNameInput(), 'Valid Name');
      fireEvent.click(getSaveButton());

      await waitFor(() => {
        expect(screen.getByTestId('alert-icon')).toBeInTheDocument();
      });
    });
  });

  // ── Saving state ──────────────────────────────────────────────────────────

  describe('Saving state', () => {
    it('shows "Saving..." text on the save button while onSave is in progress', async () => {
      const user = userEvent.setup();
      let resolveSave!: () => void;
      const onSave = jest.fn(
        () =>
          new Promise<void>((resolve) => {
            resolveSave = resolve;
          })
      );
      render(<CustomerEditModal {...buildProps({ onSave })} />);

      await user.type(getNameInput(), 'Valid Name');
      fireEvent.click(getSaveButton());

      await waitFor(() => {
        expect(getSaveButton()).toHaveTextContent('Saving...');
      });

      // Clean up pending promise so there are no dangling async operations
      resolveSave();
    });

    it('disables the save button while saving', async () => {
      const user = userEvent.setup();
      let resolveSave!: () => void;
      const onSave = jest.fn(
        () =>
          new Promise<void>((resolve) => {
            resolveSave = resolve;
          })
      );
      render(<CustomerEditModal {...buildProps({ onSave })} />);

      await user.type(getNameInput(), 'Valid Name');
      fireEvent.click(getSaveButton());

      await waitFor(() => {
        expect(getSaveButton()).toBeDisabled();
      });

      resolveSave();
    });

    it('disables the "Back to customers" button while saving', async () => {
      const user = userEvent.setup();
      let resolveSave!: () => void;
      const onSave = jest.fn(
        () =>
          new Promise<void>((resolve) => {
            resolveSave = resolve;
          })
      );
      render(<CustomerEditModal {...buildProps({ onSave })} />);

      await user.type(getNameInput(), 'Valid Name');
      fireEvent.click(getSaveButton());

      await waitFor(() => {
        expect(screen.getByText('Back to customers')).toBeDisabled();
      });

      resolveSave();
    });

    it('restores the "Create customer" label after onSave rejects (dialog stays open)', async () => {
      const user = userEvent.setup();
      const onSave = jest.fn(() => Promise.reject(new Error('Failure')));
      render(<CustomerEditModal {...buildProps({ onSave })} />);

      await user.type(getNameInput(), 'Valid Name');
      fireEvent.click(getSaveButton());

      // Wait for the error to surface — saving=false at this point
      await waitFor(() => {
        expect(screen.getByText('Failure')).toBeInTheDocument();
      });

      // In create mode, button label returns to "Create customer" after save ends
      expect(getSaveButton()).toHaveTextContent('Create customer');
    });
  });

  // ── Cancel button ─────────────────────────────────────────────────────────

  describe('onClose interaction', () => {
    it('calls onClose when "Back to customers" button is clicked', () => {
      const onClose = jest.fn();
      render(<CustomerEditModal {...buildProps({ onClose })} />);

      fireEvent.click(screen.getByText('Back to customers'));

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('does not call onSave when the cancel button is clicked', () => {
      const onSave = jest.fn(() => Promise.resolve());
      render(<CustomerEditModal {...buildProps({ onSave })} />);

      fireEvent.click(screen.getByText('Back to customers'));

      expect(onSave).not.toHaveBeenCalled();
    });
  });
});
