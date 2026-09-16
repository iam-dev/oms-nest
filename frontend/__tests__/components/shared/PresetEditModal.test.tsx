import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PresetEditModal } from '@/components/shared/PresetEditModal';
import type { Preset } from '@/services/presets';
import * as modelsSvc from '@/services/models';

jest.mock('lucide-react', () => ({
  AlertTriangle: () => <span data-testid="alert-icon" />,
}));

jest.mock('@/utils/logger', () => ({
  logger: { log: jest.fn(), debug: jest.fn(), warn: jest.fn(), error: jest.fn(), info: jest.fn() },
}));

jest.mock('@/components/ui/dialog', () => ({
  Dialog: ({ open, children }: { open: boolean; children: React.ReactNode }) =>
    open ? <div data-testid="dialog">{children}</div> : null,
  DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  DialogDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
}));

jest.mock('@/components/ui/button', () => ({
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{children}</button>
  ),
}));
jest.mock('@/components/ui/input', () => ({
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
}));
jest.mock('@/components/ui/textarea', () => ({
  Textarea: (props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea {...props} />,
}));

// Native <select> stand-in that enforces the Radix rule that broke production:
// every <Select.Item> must have a non-empty value.
jest.mock('@/components/ui/select', () => {
  const Select = ({
    value,
    onValueChange,
    children,
    disabled,
  }: {
    value?: string;
    onValueChange?: (v: string) => void;
    children: React.ReactNode;
    disabled?: boolean;
  }) => (
    <select data-testid="select" value={value} disabled={disabled} onChange={e => onValueChange?.(e.target.value)}>
      {children}
    </select>
  );
  const Passthrough = ({ children }: { children?: React.ReactNode }) => <>{children}</>;
  const SelectItem = ({ value, children }: { value: string; children: React.ReactNode }) => {
    if (value === '') {
      throw new Error('A <Select.Item /> must have a value prop that is not an empty string.');
    }
    return <option value={value}>{children}</option>;
  };
  return { Select, SelectContent: Passthrough, SelectTrigger: Passthrough, SelectValue: () => null, SelectItem };
});

jest.mock('@/services/models', () => ({ fetchModels: jest.fn() }));
const mockFetchModels = jest.mocked(modelsSvc.fetchModels);

const preset: Preset = { id: '24', name: 'AVIAR SMOOTH Black', sequence: 1, active: true, modelId: '' };

beforeEach(() => {
  jest.clearAllMocks();
  mockFetchModels.mockResolvedValue({
    'hydra:member': [{ id: '100', name: 'Ace Jump (twin flap)' }],
    'hydra:totalItems': 1,
  } as unknown as Awaited<ReturnType<typeof modelsSvc.fetchModels>>);
});

describe('PresetEditModal', () => {
  test('opens for a preset without a model (the "No Model" item must not use an empty value)', async () => {
    render(<PresetEditModal preset={preset} isOpen onClose={jest.fn()} onSave={jest.fn()} />);

    await waitFor(() => expect(screen.getByText('Ace Jump (twin flap)')).toBeInTheDocument());
    expect(screen.getByRole('option', { name: 'No Model' })).toBeInTheDocument();
  });

  test('choosing "No Model" saves an empty modelId, choosing a model saves its id', async () => {
    const onSave = jest.fn().mockResolvedValue(undefined);
    render(<PresetEditModal preset={{ ...preset, modelId: '100' }} isOpen onClose={jest.fn()} onSave={onSave} />);
    await waitFor(() => expect(screen.getByText('Ace Jump (twin flap)')).toBeInTheDocument());

    const [modelSelect] = screen.getAllByTestId('select');
    await userEvent.selectOptions(modelSelect, 'No Model');
    await userEvent.click(screen.getByRole('button', { name: /save/i }));
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave.mock.calls[0][0]).toMatchObject({ modelId: '' });

    await userEvent.selectOptions(modelSelect, 'Ace Jump (twin flap)');
    await userEvent.click(screen.getByRole('button', { name: /save/i }));
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(2));
    expect(onSave.mock.calls[1][0]).toMatchObject({ modelId: '100' });
  });
});
