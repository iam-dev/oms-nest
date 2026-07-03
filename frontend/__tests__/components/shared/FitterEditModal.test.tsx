import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FitterEditModal } from '@/components/shared/FitterEditModal';
import type { Fitter } from '@/services/fitters';

// ---------------------------------------------------------------------------
// Mock lucide-react icons
// ---------------------------------------------------------------------------
jest.mock('lucide-react', () => ({
  AlertTriangle: ({ className }: { className?: string }) => (
    <span data-testid="alert-icon" className={className} />
  ),
  Eye: ({ className }: { className?: string }) => (
    <span data-testid="eye-icon" className={className} />
  ),
  EyeOff: ({ className }: { className?: string }) => (
    <span data-testid="eye-off-icon" className={className} />
  ),
}));

// ---------------------------------------------------------------------------
// Mock logger — silences output and lets us assert calls if needed
// ---------------------------------------------------------------------------
jest.mock('@/utils/logger', () => ({
  logger: {
    log: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
  },
}));

// ---------------------------------------------------------------------------
// Mock shadcn/ui Dialog — renders children only while open=true
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// Mock shadcn/ui Input — plain <input> with a data-testid derived from
// placeholder so tests can locate fields unambiguously.
// ---------------------------------------------------------------------------
jest.mock('@/components/ui/input', () => ({
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => (
    <input data-testid={`input-${props.placeholder}`} {...props} />
  ),
}));

// ---------------------------------------------------------------------------
// Mock shadcn/ui Button — plain <button> with a data-testid derived from
// the text content so tests can locate buttons unambiguously.
// ---------------------------------------------------------------------------
jest.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
    disabled,
    className,
    variant,
    type,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    className?: string;
    variant?: string;
    type?: 'button' | 'submit' | 'reset';
  }) => (
    <button
      data-testid={`btn-${typeof children === 'string' ? children : 'button'}`}
      onClick={onClick}
      disabled={disabled}
      className={className}
      data-variant={variant}
      type={type ?? 'button'}
    >
      {children}
    </button>
  ),
}));

// ---------------------------------------------------------------------------
// Mock shadcn/ui Select — uses React context (required inside the factory to
// avoid the jest.mock out-of-scope variable restriction) so that
// SelectContent can reach the parent Select's onValueChange handler.
// Renders a native <select> element so userEvent.selectOptions() works.
// ---------------------------------------------------------------------------
jest.mock('@/components/ui/select', () => {
  // Use jest.requireActual to avoid the no-require-imports lint rule while still
  // loading React fresh inside the mock factory (top-level imports cannot be
  // referenced here due to jest.mock hoisting).
  const mockReact = jest.requireActual('react') as typeof import('react');

  const mockSelectCtx = mockReact.createContext<{ value?: string; onValueChange?: (v: string) => void }>({});

  function Select({
    value,
    onValueChange,
    children,
  }: {
    value?: string;
    onValueChange?: (v: string) => void;
    children: React.ReactNode;
  }) {
    return mockReact.createElement(
      mockSelectCtx.Provider,
      { value: { value, onValueChange } },
      mockReact.createElement('div', { 'data-testid': 'select-root' }, children)
    );
  }

  function SelectTrigger({ children }: { children: React.ReactNode }) {
    return mockReact.createElement('div', { 'data-testid': 'select-trigger' }, children);
  }

  function SelectValue({ placeholder }: { placeholder?: string }) {
    return mockReact.createElement('span', { 'data-testid': 'select-value' }, placeholder);
  }

  function SelectContent({ children }: { children: React.ReactNode }) {
    const { value, onValueChange } = mockReact.useContext(mockSelectCtx);
    return mockReact.createElement(
      'select',
      {
        'data-testid': 'select-content',
        value: value ?? '',
        onChange: (e: { target: { value: string } }) => onValueChange?.(e.target.value),
      },
      children
    );
  }

  function SelectItem({ value, children }: { value: string; children: React.ReactNode }) {
    return mockReact.createElement('option', { value }, children);
  }

  return { Select, SelectTrigger, SelectValue, SelectContent, SelectItem };
});

// ---------------------------------------------------------------------------
// Shared test fixtures
// ---------------------------------------------------------------------------

const sampleFitter: Fitter = {
  id: 42,
  name: 'John Doe',
  username: 'johndoe',
  firstName: 'John',
  lastName: 'Doe',
  email: 'john@example.com',
  address: '123 Main St',
  city: 'Springfield',
  country: 'US',
  state: 'IL',
  zipcode: '62701',
  phoneNo: '555-1234',
  cellNo: '555-5678',
  enabled: true,
};

// Default props shared across tests — onSave / onClose are re-created per test
// via beforeEach so jest.clearAllMocks() resets call history cleanly.
const makeDefaultProps = () => ({
  isOpen: true,
  onClose: jest.fn(),
  onSave: jest.fn().mockResolvedValue(undefined),
});

// ---------------------------------------------------------------------------
// Helper — fill every required field for a valid create-mode submission
// ---------------------------------------------------------------------------
async function fillValidCreateForm(
  user: ReturnType<typeof userEvent.setup>,
  overrides: {
    username?: string;
    email?: string;
    address?: string;
    city?: string;
    password?: string;
    confirmPassword?: string;
  } = {}
) {
  const {
    username = 'newuser',
    email = 'new@example.com',
    address = '99 Test Ave',
    city = 'Testville',
    password = 'secret1',
    confirmPassword = 'secret1',
  } = overrides;

  await user.clear(screen.getByTestId('input-Username'));
  await user.type(screen.getByTestId('input-Username'), username);

  await user.clear(screen.getByTestId('input-Email Address'));
  await user.type(screen.getByTestId('input-Email Address'), email);

  await user.clear(screen.getByTestId('input-Street Address'));
  await user.type(screen.getByTestId('input-Street Address'), address);

  await user.clear(screen.getByTestId('input-City'));
  await user.type(screen.getByTestId('input-City'), city);

  await user.clear(screen.getByTestId('input-Enter password'));
  await user.type(screen.getByTestId('input-Enter password'), password);

  await user.clear(screen.getByTestId('input-Confirm new password'));
  await user.type(screen.getByTestId('input-Confirm new password'), confirmPassword);
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------
describe('FitterEditModal', () => {
  let defaultProps: ReturnType<typeof makeDefaultProps>;

  beforeEach(() => {
    defaultProps = makeDefaultProps();
  });

  // ── 1. Create mode: title ─────────────────────────────────────────────────

  describe('create mode — fitter prop is null', () => {
    it('renders "Create Fitter" as the dialog title', () => {
      render(<FitterEditModal {...defaultProps} fitter={null} />);

      expect(screen.getByTestId('dialog-title')).toHaveTextContent('Create Fitter');
    });

    it('renders the create-mode description text', () => {
      render(<FitterEditModal {...defaultProps} fitter={null} />);

      expect(screen.getByTestId('dialog-description')).toHaveTextContent(
        'Fill in the fitter information below.'
      );
    });

    it('renders "Create fitter" as the save button label', () => {
      render(<FitterEditModal {...defaultProps} fitter={null} />);

      expect(screen.getByTestId('btn-Create fitter')).toBeInTheDocument();
    });

    it('renders all text inputs empty on first open', () => {
      render(<FitterEditModal {...defaultProps} fitter={null} />);

      expect(screen.getByTestId('input-Username')).toHaveValue('');
      expect(screen.getByTestId('input-First Name')).toHaveValue('');
      expect(screen.getByTestId('input-Last Name')).toHaveValue('');
      expect(screen.getByTestId('input-Email Address')).toHaveValue('');
      expect(screen.getByTestId('input-Street Address')).toHaveValue('');
      expect(screen.getByTestId('input-City')).toHaveValue('');
      expect(screen.getByTestId('input-State/Province')).toHaveValue('');
      expect(screen.getByTestId('input-Postal/Zip Code')).toHaveValue('');
    });

    it('renders the "Enter password" placeholder for the password field', () => {
      render(<FitterEditModal {...defaultProps} fitter={null} />);

      expect(screen.getByTestId('input-Enter password')).toBeInTheDocument();
    });
  });

  // ── 2. Edit mode: title ───────────────────────────────────────────────────

  describe('edit mode — fitter object is provided', () => {
    it('renders "Edit Fitter {username}" as the dialog title', () => {
      render(<FitterEditModal {...defaultProps} fitter={sampleFitter} />);

      expect(screen.getByTestId('dialog-title')).toHaveTextContent(
        `Edit Fitter ${sampleFitter.username}`
      );
    });

    it('renders the edit-mode description text', () => {
      render(<FitterEditModal {...defaultProps} fitter={sampleFitter} />);

      expect(screen.getByTestId('dialog-description')).toHaveTextContent(
        'Update the fitter information below.'
      );
    });

    it('renders "Save fitter" as the save button label', () => {
      render(<FitterEditModal {...defaultProps} fitter={sampleFitter} />);

      expect(screen.getByTestId('btn-Save fitter')).toBeInTheDocument();
    });
  });

  // ── 3. Edit mode: field pre-population ────────────────────────────────────

  describe('edit mode — field pre-population from fitter prop', () => {
    it('pre-populates username', () => {
      render(<FitterEditModal {...defaultProps} fitter={sampleFitter} />);

      expect(screen.getByTestId('input-Username')).toHaveValue('johndoe');
    });

    it('pre-populates first name and last name', () => {
      render(<FitterEditModal {...defaultProps} fitter={sampleFitter} />);

      expect(screen.getByTestId('input-First Name')).toHaveValue('John');
      expect(screen.getByTestId('input-Last Name')).toHaveValue('Doe');
    });

    it('pre-populates email', () => {
      render(<FitterEditModal {...defaultProps} fitter={sampleFitter} />);

      expect(screen.getByTestId('input-Email Address')).toHaveValue('john@example.com');
    });

    it('pre-populates address', () => {
      render(<FitterEditModal {...defaultProps} fitter={sampleFitter} />);

      expect(screen.getByTestId('input-Street Address')).toHaveValue('123 Main St');
    });

    it('pre-populates city', () => {
      render(<FitterEditModal {...defaultProps} fitter={sampleFitter} />);

      expect(screen.getByTestId('input-City')).toHaveValue('Springfield');
    });

    it('pre-populates state and zipcode', () => {
      render(<FitterEditModal {...defaultProps} fitter={sampleFitter} />);

      expect(screen.getByTestId('input-State/Province')).toHaveValue('IL');
      expect(screen.getByTestId('input-Postal/Zip Code')).toHaveValue('62701');
    });

    it('pre-populates phone and cell numbers', () => {
      render(<FitterEditModal {...defaultProps} fitter={sampleFitter} />);

      expect(screen.getByTestId('input-Phone Number')).toHaveValue('555-1234');
      expect(screen.getByTestId('input-Cell Number')).toHaveValue('555-5678');
    });

    it('leaves password fields empty — never pre-populated from stored data', () => {
      render(<FitterEditModal {...defaultProps} fitter={sampleFitter} />);

      // In edit mode the placeholder changes to indicate the field is optional
      expect(screen.getByTestId('input-Leave blank to keep current')).toHaveValue('');
      expect(screen.getByTestId('input-Confirm new password')).toHaveValue('');
    });
  });

  // ── 4. Validation: username required ──────────────────────────────────────

  describe('validation — username required', () => {
    it('shows "Username is required" error when username is empty', async () => {
      const user = userEvent.setup();
      render(<FitterEditModal {...defaultProps} fitter={null} />);

      await user.click(screen.getByTestId('btn-Create fitter'));

      await waitFor(() => {
        expect(screen.getByText('Username is required')).toBeInTheDocument();
      });
    });

    it('renders the alert icon alongside the username-required error', async () => {
      const user = userEvent.setup();
      render(<FitterEditModal {...defaultProps} fitter={null} />);

      await user.click(screen.getByTestId('btn-Create fitter'));

      await waitFor(() => {
        expect(screen.getByTestId('alert-icon')).toBeInTheDocument();
      });
    });

    it('does not call onSave when username is empty', async () => {
      const user = userEvent.setup();
      render(<FitterEditModal {...defaultProps} fitter={null} />);

      await user.click(screen.getByTestId('btn-Create fitter'));

      await waitFor(() => {
        expect(screen.getByText('Username is required')).toBeInTheDocument();
      });
      expect(defaultProps.onSave).not.toHaveBeenCalled();
    });
  });

  // ── 5. Validation: password required in create mode ───────────────────────

  describe('validation — password required in create mode', () => {
    it('shows "Password is required for new fitters" when password is empty in create mode', async () => {
      const user = userEvent.setup();
      render(<FitterEditModal {...defaultProps} fitter={null} />);

      await user.type(screen.getByTestId('input-Username'), 'validuser');
      await user.type(screen.getByTestId('input-Email Address'), 'valid@example.com');
      await user.type(screen.getByTestId('input-Street Address'), '1 Main St');
      await user.type(screen.getByTestId('input-City'), 'Anytown');
      // Intentionally leave password fields empty

      await user.click(screen.getByTestId('btn-Create fitter'));

      await waitFor(() => {
        expect(
          screen.getByText('Password is required for new fitters')
        ).toBeInTheDocument();
      });
      expect(defaultProps.onSave).not.toHaveBeenCalled();
    });

    it('does NOT require password in edit mode when password fields are left blank', async () => {
      const user = userEvent.setup();
      render(<FitterEditModal {...defaultProps} fitter={sampleFitter} />);

      // All required fields are pre-populated; leave password empty
      await user.click(screen.getByTestId('btn-Save fitter'));

      await waitFor(() => {
        expect(defaultProps.onSave).toHaveBeenCalledTimes(1);
      });
      expect(screen.queryByText('Password is required for new fitters')).not.toBeInTheDocument();
    });
  });

  // ── 6. Validation: passwords don't match ──────────────────────────────────

  describe('validation — passwords must match', () => {
    it('shows "Passwords do not match" when confirmation differs from password', async () => {
      const user = userEvent.setup();
      render(<FitterEditModal {...defaultProps} fitter={null} />);

      await fillValidCreateForm(user, {
        password: 'password1',
        confirmPassword: 'password2',
      });
      await user.click(screen.getByTestId('btn-Create fitter'));

      await waitFor(() => {
        expect(screen.getByText('Passwords do not match')).toBeInTheDocument();
      });
      expect(defaultProps.onSave).not.toHaveBeenCalled();
    });

    it('shows "Password must be at least 6 characters" for a short password', async () => {
      const user = userEvent.setup();
      render(<FitterEditModal {...defaultProps} fitter={null} />);

      await fillValidCreateForm(user, {
        password: 'abc',
        confirmPassword: 'abc',
      });
      await user.click(screen.getByTestId('btn-Create fitter'));

      await waitFor(() => {
        expect(
          screen.getByText('Password must be at least 6 characters')
        ).toBeInTheDocument();
      });
      expect(defaultProps.onSave).not.toHaveBeenCalled();
    });
  });

  // ── 7. Happy path: onSave called with correct data ────────────────────────

  describe('happy path — valid submission', () => {
    it('calls onSave with complete fitter data in create mode', async () => {
      const user = userEvent.setup();
      render(<FitterEditModal {...defaultProps} fitter={null} />);

      await fillValidCreateForm(user, {
        username: 'newuser',
        email: 'new@example.com',
        address: '99 Test Ave',
        city: 'Testville',
        password: 'secret1',
        confirmPassword: 'secret1',
      });
      await user.click(screen.getByTestId('btn-Create fitter'));

      await waitFor(() => {
        expect(defaultProps.onSave).toHaveBeenCalledTimes(1);
      });

      const [savedPayload] = defaultProps.onSave.mock.calls[0] as [Record<string, unknown>];
      expect(savedPayload.username).toBe('newuser');
      expect(savedPayload.email).toBe('new@example.com');
      expect(savedPayload.address).toBe('99 Test Ave');
      expect(savedPayload.city).toBe('Testville');
      expect(savedPayload.password).toBe('secret1');
    });

    it('calls onSave with the pre-populated fitter data in edit mode (no password change)', async () => {
      const user = userEvent.setup();
      render(<FitterEditModal {...defaultProps} fitter={sampleFitter} />);

      await user.click(screen.getByTestId('btn-Save fitter'));

      await waitFor(() => {
        expect(defaultProps.onSave).toHaveBeenCalledTimes(1);
      });

      const [savedPayload] = defaultProps.onSave.mock.calls[0] as [Record<string, unknown>];
      expect(savedPayload).toMatchObject({
        id: 42,
        username: 'johndoe',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        address: '123 Main St',
        city: 'Springfield',
        country: 'US',
        state: 'IL',
        zipcode: '62701',
        phoneNo: '555-1234',
        cellNo: '555-5678',
        enabled: true,
      });
    });

    it('omits "password" key when no new password is entered in edit mode', async () => {
      const user = userEvent.setup();
      render(<FitterEditModal {...defaultProps} fitter={sampleFitter} />);

      await user.click(screen.getByTestId('btn-Save fitter'));

      await waitFor(() => {
        expect(defaultProps.onSave).toHaveBeenCalledTimes(1);
      });

      const [savedPayload] = defaultProps.onSave.mock.calls[0] as [Record<string, unknown>];
      expect(savedPayload.password).toBeUndefined();
    });

    it('includes the new password in the payload when one is provided in edit mode', async () => {
      const user = userEvent.setup();
      render(<FitterEditModal {...defaultProps} fitter={sampleFitter} />);

      const passwordInput = screen.getByTestId('input-Leave blank to keep current');
      await user.clear(passwordInput);
      await user.type(passwordInput, 'newpass1');

      const confirmInput = screen.getByTestId('input-Confirm new password');
      await user.clear(confirmInput);
      await user.type(confirmInput, 'newpass1');

      await user.click(screen.getByTestId('btn-Save fitter'));

      await waitFor(() => {
        expect(defaultProps.onSave).toHaveBeenCalledTimes(1);
      });

      const [savedPayload] = defaultProps.onSave.mock.calls[0] as [Record<string, unknown>];
      expect(savedPayload.password).toBe('newpass1');
    });

    it('calls onClose after a successful save', async () => {
      const user = userEvent.setup();
      render(<FitterEditModal {...defaultProps} fitter={null} />);

      await fillValidCreateForm(user);
      await user.click(screen.getByTestId('btn-Create fitter'));

      await waitFor(() => {
        expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
      });
    });
  });

  // ── 8. Error handling: onSave rejects ────────────────────────────────────

  describe('error handling — onSave rejects', () => {
    it('displays the rejection error message in the alert box', async () => {
      defaultProps.onSave.mockRejectedValueOnce(new Error('Server error: duplicate username'));
      const user = userEvent.setup();
      render(<FitterEditModal {...defaultProps} fitter={null} />);

      await fillValidCreateForm(user);
      await user.click(screen.getByTestId('btn-Create fitter'));

      await waitFor(() => {
        expect(
          screen.getByText('Server error: duplicate username')
        ).toBeInTheDocument();
      });
    });

    it('renders the alert icon alongside the save-rejection error', async () => {
      defaultProps.onSave.mockRejectedValueOnce(new Error('Server error'));
      const user = userEvent.setup();
      render(<FitterEditModal {...defaultProps} fitter={null} />);

      await fillValidCreateForm(user);
      await user.click(screen.getByTestId('btn-Create fitter'));

      await waitFor(() => {
        expect(screen.getByTestId('alert-icon')).toBeInTheDocument();
      });
    });

    it('shows a generic fallback message when rejection value is not an Error instance', async () => {
      defaultProps.onSave.mockRejectedValueOnce('unexpected string error');
      const user = userEvent.setup();
      render(<FitterEditModal {...defaultProps} fitter={null} />);

      await fillValidCreateForm(user);
      await user.click(screen.getByTestId('btn-Create fitter'));

      await waitFor(() => {
        expect(
          screen.getByText('Failed to save fitter. Please try again.')
        ).toBeInTheDocument();
      });
    });

    it('does NOT call onClose after a failed save', async () => {
      defaultProps.onSave.mockRejectedValueOnce(new Error('Bad gateway'));
      const user = userEvent.setup();
      render(<FitterEditModal {...defaultProps} fitter={null} />);

      await fillValidCreateForm(user);
      await user.click(screen.getByTestId('btn-Create fitter'));

      await waitFor(() => {
        expect(screen.getByText('Bad gateway')).toBeInTheDocument();
      });
      expect(defaultProps.onClose).not.toHaveBeenCalled();
    });

    it('re-enables the save button after a failed save', async () => {
      defaultProps.onSave.mockRejectedValueOnce(new Error('Temporary failure'));
      const user = userEvent.setup();
      render(<FitterEditModal {...defaultProps} fitter={null} />);

      await fillValidCreateForm(user);
      await user.click(screen.getByTestId('btn-Create fitter'));

      await waitFor(() => {
        expect(screen.getByText('Temporary failure')).toBeInTheDocument();
      });

      // After the async rejection resolves, the button must no longer be disabled
      expect(screen.getByTestId('btn-Create fitter')).not.toBeDisabled();
    });
  });

  // ── Additional validation paths ───────────────────────────────────────────

  describe('validation — email and address checks', () => {
    it('shows "Email is required" when email is empty', async () => {
      const user = userEvent.setup();
      render(<FitterEditModal {...defaultProps} fitter={null} />);

      await user.type(screen.getByTestId('input-Username'), 'someuser');
      await user.click(screen.getByTestId('btn-Create fitter'));

      await waitFor(() => {
        expect(screen.getByText('Email is required')).toBeInTheDocument();
      });
      expect(defaultProps.onSave).not.toHaveBeenCalled();
    });

    it('shows "Address is required" when address is empty', async () => {
      const user = userEvent.setup();
      render(<FitterEditModal {...defaultProps} fitter={null} />);

      await user.type(screen.getByTestId('input-Username'), 'someuser');
      await user.type(screen.getByTestId('input-Email Address'), 'some@user.com');
      await user.click(screen.getByTestId('btn-Create fitter'));

      await waitFor(() => {
        expect(screen.getByText('Address is required')).toBeInTheDocument();
      });
      expect(defaultProps.onSave).not.toHaveBeenCalled();
    });

    it('shows "City is required" when city is empty', async () => {
      const user = userEvent.setup();
      render(<FitterEditModal {...defaultProps} fitter={null} />);

      await user.type(screen.getByTestId('input-Username'), 'someuser');
      await user.type(screen.getByTestId('input-Email Address'), 'some@user.com');
      await user.type(screen.getByTestId('input-Street Address'), '1 Oak Lane');
      await user.click(screen.getByTestId('btn-Create fitter'));

      await waitFor(() => {
        expect(screen.getByText('City is required')).toBeInTheDocument();
      });
      expect(defaultProps.onSave).not.toHaveBeenCalled();
    });

    it('shows "Please enter a valid email address" for a malformed email', async () => {
      const user = userEvent.setup();
      render(<FitterEditModal {...defaultProps} fitter={null} />);

      await user.type(screen.getByTestId('input-Username'), 'someuser');
      await user.type(screen.getByTestId('input-Email Address'), 'not-an-email');
      await user.type(screen.getByTestId('input-Street Address'), '1 Oak Lane');
      await user.type(screen.getByTestId('input-City'), 'Anytown');
      // Leave password empty — validation fires on email format before password check
      await user.click(screen.getByTestId('btn-Create fitter'));

      await waitFor(() => {
        expect(
          screen.getByText('Please enter a valid email address')
        ).toBeInTheDocument();
      });
      expect(defaultProps.onSave).not.toHaveBeenCalled();
    });
  });

  // ── Modal visibility ──────────────────────────────────────────────────────

  describe('modal visibility', () => {
    it('renders the dialog element when isOpen is true', () => {
      render(<FitterEditModal {...defaultProps} fitter={null} isOpen={true} />);

      expect(screen.getByTestId('dialog')).toBeInTheDocument();
    });

    it('renders nothing when isOpen is false', () => {
      render(<FitterEditModal {...defaultProps} fitter={null} isOpen={false} />);

      expect(screen.queryByTestId('dialog')).not.toBeInTheDocument();
    });
  });

  // ── Cancel / Back button ──────────────────────────────────────────────────

  describe('cancel button', () => {
    it('calls onClose when "Back to fitters" is clicked', async () => {
      const user = userEvent.setup();
      render(<FitterEditModal {...defaultProps} fitter={null} />);

      await user.click(screen.getByTestId('btn-Back to fitters'));

      expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
    });
  });

  // ── Saving state ──────────────────────────────────────────────────────────

  describe('saving state', () => {
    it('changes save button label to "Saving..." while onSave is pending', async () => {
      let resolveOnSave!: () => void;
      const onSave = jest.fn(
        () => new Promise<void>((resolve) => { resolveOnSave = resolve; })
      );
      const user = userEvent.setup();
      render(<FitterEditModal {...defaultProps} fitter={sampleFitter} onSave={onSave} />);

      await user.click(screen.getByTestId('btn-Save fitter'));

      // The button label must switch to "Saving..." immediately after the click
      expect(screen.getByTestId('btn-Saving...')).toBeInTheDocument();

      // Resolve so the component settles and React state updates complete
      resolveOnSave();
      await waitFor(() => {
        expect(screen.queryByTestId('btn-Saving...')).not.toBeInTheDocument();
      });
    });

    it('disables both action buttons while saving is in progress', async () => {
      let resolveOnSave!: () => void;
      const onSave = jest.fn(
        () => new Promise<void>((resolve) => { resolveOnSave = resolve; })
      );
      const user = userEvent.setup();
      render(<FitterEditModal {...defaultProps} fitter={sampleFitter} onSave={onSave} />);

      await user.click(screen.getByTestId('btn-Save fitter'));

      expect(screen.getByTestId('btn-Saving...')).toBeDisabled();
      expect(screen.getByTestId('btn-Back to fitters')).toBeDisabled();

      resolveOnSave();
      await waitFor(() => {
        expect(screen.queryByTestId('btn-Saving...')).not.toBeInTheDocument();
      });
    });
  });

  // ── Password visibility toggle ────────────────────────────────────────────

  describe('password visibility toggle', () => {
    it('starts with the password input type set to "password" (hidden)', () => {
      render(<FitterEditModal {...defaultProps} fitter={null} />);

      expect(screen.getByTestId('input-Enter password')).toHaveAttribute('type', 'password');
    });

    it('switches the password input type to "text" when the toggle button is clicked', async () => {
      const user = userEvent.setup();
      render(<FitterEditModal {...defaultProps} fitter={null} />);

      const passwordInput = screen.getByTestId('input-Enter password');
      // The toggle button is the native <button> inside the same relative wrapper
      const toggleButton = passwordInput.closest('div')!.querySelector('button')!;
      await user.click(toggleButton);

      expect(passwordInput).toHaveAttribute('type', 'text');
    });

    it('switches the confirm-password input type to "text" together with the main field', async () => {
      const user = userEvent.setup();
      render(<FitterEditModal {...defaultProps} fitter={null} />);

      // Toggle is shared between both fields
      const passwordInput = screen.getByTestId('input-Enter password');
      const confirmInput = screen.getByTestId('input-Confirm new password');
      const toggleButton = passwordInput.closest('div')!.querySelector('button')!;

      expect(confirmInput).toHaveAttribute('type', 'password');
      await user.click(toggleButton);
      expect(confirmInput).toHaveAttribute('type', 'text');
    });
  });
});
