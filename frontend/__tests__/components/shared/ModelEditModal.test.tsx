import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ModelEditModal } from '@/components/shared/ModelEditModal';
import type { Model } from '@/services/models';
import * as brandsSvc from '@/services/brands';
import * as factoriesSvc from '@/services/factories';

jest.mock('lucide-react', () => ({
  AlertTriangle: () => <span data-testid="alert-icon" />,
  Loader2: () => <span data-testid="loader" />,
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

// Native <select> stand-in so option lists are inspectable in jsdom
jest.mock('@/components/ui/select', () => {
  const Select = ({
    value,
    onValueChange,
    children,
    ...rest
  }: {
    value?: string;
    onValueChange?: (v: string) => void;
    children: React.ReactNode;
    disabled?: boolean;
  }) => (
    <select
      aria-label={(rest as { 'aria-label'?: string })['aria-label']}
      value={value}
      disabled={rest.disabled}
      onChange={e => onValueChange?.(e.target.value)}
    >
      {children}
    </select>
  );
  const Passthrough = ({ children }: { children?: React.ReactNode }) => <>{children}</>;
  const SelectItem = ({ value, children }: { value: string; children: React.ReactNode }) => (
    <option value={value}>{children}</option>
  );
  return {
    Select,
    SelectContent: Passthrough,
    SelectTrigger: Passthrough,
    SelectValue: () => null,
    SelectItem,
  };
});

jest.mock('@/services/brands', () => ({ fetchBrands: jest.fn() }));
jest.mock('@/services/factories', () => ({ fetchFactories: jest.fn() }));

const mockFetchBrands = jest.mocked(brandsSvc.fetchBrands);
const mockFetchFactories = jest.mocked(factoriesSvc.fetchFactories);

const factories = [
  { id: 1, displayName: 'Aiken USA' },
  { id: 3, displayName: 'Custom / Aviar LTD' },
  { id: 2, displayName: 'Manor' },
] as unknown as factoriesSvc.Factory[];

const model: Model = {
  id: '100',
  name: 'Ace Jump (twin flap)',
  brandName: 'Aviar',
  sequence: 1,
  active: true,
  type: 1,
  factoryEu: 3, factoryUs: 3, factoryGb: 3, factoryCa: 3, factoryAud: 3, factoryNl: 3, factoryDe: 0,
} as Model;

beforeEach(() => {
  jest.clearAllMocks();
  mockFetchBrands.mockResolvedValue({
    'hydra:member': [{ id: '4', name: 'Aviar' }, { id: '1', name: 'Custom' }],
    'hydra:totalItems': 2,
  } as unknown as Awaited<ReturnType<typeof brandsSvc.fetchBrands>>);
  mockFetchFactories.mockResolvedValue({
    'hydra:member': factories,
    'hydra:totalItems': factories.length,
  } as unknown as Awaited<ReturnType<typeof factoriesSvc.fetchFactories>>);
});

async function renderOpen(onSave = jest.fn()) {
  render(<ModelEditModal model={model} isOpen onClose={jest.fn()} onSave={onSave} />);
  await waitFor(() => expect(screen.getByLabelText('Factory for EU:')).toBeInTheDocument());
  return onSave;
}

describe('ModelEditModal (production "Manage information" layout)', () => {
  test('titles the dialog like the legacy page', async () => {
    await renderOpen();
    expect(screen.getByRole('heading', { name: 'Manage information for Aviar Ace Jump (twin flap)' })).toBeInTheDocument();
  });

  test('lists the fields in the legacy order: factories, brand, model, type, status', async () => {
    await renderOpen();

    const labels = screen.getAllByTestId('field-label').map(l => l.textContent?.replace(/\s*\*\s*$/, '').trim());
    expect(labels).toEqual([
      'Factory for EU:',
      'Factory for US:',
      'Factory for GB:',
      'Factory for CA:',
      'Factory for AUD:',
      'Factory for NL:',
      'Factory for DE:',
      'Brand:',
      'Model:',
      'Type:',
      'Status:',
    ]);
  });

  test('every factory dropdown offers "- Choose factory -" plus all factories', async () => {
    await renderOpen();

    const select = screen.getByLabelText('Factory for DE:') as HTMLSelectElement;
    const options = within(select).getAllByRole('option').map(o => o.textContent);
    expect(options).toEqual(['- Choose factory -', 'Aiken USA', 'Custom / Aviar LTD', 'Manor']);
    expect(select.value).toBe('0');
    expect((screen.getByLabelText('Factory for EU:') as HTMLSelectElement).value).toBe('3');
  });

  test('brand is a free-text field (saddles use brands not in the brands table) with suggestions', async () => {
    await renderOpen();

    const brand = screen.getByLabelText('Brand:') as HTMLInputElement;
    expect(brand.tagName).toBe('INPUT');
    expect(brand.value).toBe('Aviar');
    const list = document.getElementById(brand.getAttribute('list') || '');
    expect(list).not.toBeNull();
    expect([...list!.querySelectorAll('option')].map(o => o.value)).toEqual(['Aviar', 'Custom']);
  });

  test('"Save information" submits the edited values including factories', async () => {
    const onSave = await renderOpen();

    await userEvent.selectOptions(screen.getByLabelText('Factory for DE:'), '2');
    await userEvent.clear(screen.getByLabelText('Model:'));
    await userEvent.type(screen.getByLabelText('Model:'), 'Ace Jump v2');
    await userEvent.click(screen.getByRole('button', { name: 'Save information' }));

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave.mock.calls[0][0]).toMatchObject({ name: 'Ace Jump v2', brandName: 'Aviar', factoryDe: 2, sequence: 1 });
  });

  test('refuses to save without a model name', async () => {
    const onSave = await renderOpen();

    await userEvent.clear(screen.getByLabelText('Model:'));
    await userEvent.click(screen.getByRole('button', { name: 'Save information' }));

    expect(await screen.findByText('Model name is required')).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
  });
});
