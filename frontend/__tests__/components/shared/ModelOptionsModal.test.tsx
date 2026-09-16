import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ModelOptionsModal } from '@/components/shared/ModelOptionsModal';
import type { Model } from '@/services/models';
import * as optionsSvc from '@/services/options';
import * as leathertypesSvc from '@/services/leathertypes';
import * as optionsItemsSvc from '@/services/optionsItems';
import * as soiSvc from '@/services/saddleOptionsItems';

jest.mock('lucide-react', () => ({
  ChevronDown: () => <span data-testid="chevron-down" />,
  ChevronRight: () => <span data-testid="chevron-right" />,
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

jest.mock('@/services/options', () => ({ fetchOptions: jest.fn() }));
jest.mock('@/services/leathertypes', () => ({ fetchLeathertypes: jest.fn() }));
jest.mock('@/services/optionsItems', () => ({ fetchOptionsItemsByOptionId: jest.fn() }));
jest.mock('@/services/saddleOptionsItems', () => ({
  fetchSaddleOptionsItemsBySaddleId: jest.fn(),
  createSaddleOptionsItem: jest.fn(),
  deleteSaddleOptionsItem: jest.fn(),
}));

const mockFetchOptions = jest.mocked(optionsSvc.fetchOptions);
const mockFetchLeathertypes = jest.mocked(leathertypesSvc.fetchLeathertypes);
const mockFetchItems = jest.mocked(optionsItemsSvc.fetchOptionsItemsByOptionId);
const mockFetchLinks = jest.mocked(soiSvc.fetchSaddleOptionsItemsBySaddleId);
const mockCreateLink = jest.mocked(soiSvc.createSaddleOptionsItem);
const mockDeleteLink = jest.mocked(soiSvc.deleteSaddleOptionsItem);

const model: Model = { id: '100', name: 'Ace Jump (twin flap)', brandName: 'Aviar' } as Model;

// Seat Size (custom, type 0) and Seat Leather (leather option, type 1)
const options = [
  { id: '1', name: 'Seat Size', type: 0 },
  { id: '11', name: 'Seat Leather', type: 1 },
];
const leathertypes = [{ id: '48', name: 'ASBLV - Aviar SMOOTH Black Vienna' }];
const seatSizeItems = [
  { id: 3, optionId: 1, leatherId: 0, name: '16' },
  { id: 4, optionId: 1, leatherId: 0, name: '16.5' },
];
const seatLeatherItems = [{ id: 8293, optionId: 11, leatherId: 48, name: '' }];

let nextId = 1000;

beforeEach(() => {
  jest.clearAllMocks();
  nextId = 1000;
  mockFetchOptions.mockResolvedValue({ 'hydra:member': options, 'hydra:totalItems': 2 });
  mockFetchLeathertypes.mockResolvedValue({ 'hydra:member': leathertypes, 'hydra:totalItems': 1 });
  mockFetchItems.mockImplementation(async (optionId) =>
    optionId === 1 ? seatSizeItems : seatLeatherItems,
  );
  mockCreateLink.mockImplementation(async (data) => ({ id: nextId++, ...data, deleted: 0, isActive: true }));
  mockDeleteLink.mockResolvedValue(undefined);
});

async function renderOpen(links: soiSvc.SaddleOptionsItem[]) {
  mockFetchLinks.mockResolvedValue(links);
  render(<ModelOptionsModal model={model} isOpen onClose={jest.fn()} />);
  await waitFor(() => expect(screen.getByText('Seat Size')).toBeInTheDocument());
}

const link = (optionId: number, optionItemId: number, leatherId: number, id = nextId++) =>
  ({ id, saddleId: 100, optionId, optionItemId, leatherId, deleted: 0, isActive: true }) as soiSvc.SaddleOptionsItem;

describe('ModelOptionsModal', () => {
  test('loads the whole catalogue excluding extras', async () => {
    await renderOpen([]);

    expect(mockFetchOptions).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1, limit: expect.any(Number), excludeType: 2 }),
    );
    expect(mockFetchOptions.mock.calls[0][0]?.limit).toBeGreaterThanOrEqual(100);
  });

  test('marks an option checked when its header link exists', async () => {
    await renderOpen([link(1, 0, 0)]);

    expect(screen.getByRole('checkbox', { name: 'Seat Size' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Seat Leather' })).not.toBeChecked();
  });

  test('enabling an option creates the header link (optionItemId 0, leatherId 0)', async () => {
    await renderOpen([]);

    await userEvent.click(screen.getByRole('checkbox', { name: 'Seat Size' }));

    expect(mockCreateLink).toHaveBeenCalledWith({ saddleId: 100, optionId: 1, optionItemId: 0, leatherId: 0 });
    await waitFor(() => expect(screen.getByRole('checkbox', { name: 'Seat Size' })).toBeChecked());
  });

  test('disabling an option deletes every link for it, items included', async () => {
    await renderOpen([link(1, 0, 0, 1), link(1, 3, 0, 2)]);

    await userEvent.click(screen.getByRole('checkbox', { name: 'Seat Size' }));

    await waitFor(() => expect(mockDeleteLink).toHaveBeenCalledTimes(2));
    expect(mockDeleteLink).toHaveBeenCalledWith(1);
    expect(mockDeleteLink).toHaveBeenCalledWith(2);
  });

  test('expanding a custom option lists its items and reflects which are enabled', async () => {
    await renderOpen([link(1, 0, 0), link(1, 3, 0)]);

    await userEvent.click(screen.getByRole('button', { name: /Show items for Seat Size/ }));

    const row = screen.getByTestId('option-row-1');
    await waitFor(() => expect(within(row).getByLabelText('16')).toBeInTheDocument());
    expect(mockFetchItems).toHaveBeenCalledWith(1);
    expect(within(row).getByLabelText('16')).toBeChecked();
    expect(within(row).getByLabelText('16.5')).not.toBeChecked();
  });

  test('enabling a custom item links it by optionItemId and adds the header link when missing', async () => {
    await renderOpen([]);

    await userEvent.click(screen.getByRole('button', { name: /Show items for Seat Size/ }));
    const row = screen.getByTestId('option-row-1');
    await waitFor(() => expect(within(row).getByLabelText('16.5')).toBeInTheDocument());

    await userEvent.click(within(row).getByLabelText('16.5'));

    await waitFor(() => expect(mockCreateLink).toHaveBeenCalledTimes(2));
    expect(mockCreateLink).toHaveBeenNthCalledWith(1, { saddleId: 100, optionId: 1, optionItemId: 0, leatherId: 0 });
    expect(mockCreateLink).toHaveBeenNthCalledWith(2, { saddleId: 100, optionId: 1, optionItemId: 4, leatherId: 0 });
    expect(screen.getByRole('checkbox', { name: 'Seat Size' })).toBeChecked();
    expect(within(row).getByLabelText('16.5')).toBeChecked();
  });

  test('leather options show leathertype names and link by leatherId', async () => {
    await renderOpen([link(11, 0, 0)]);

    await userEvent.click(screen.getByRole('button', { name: /Show items for Seat Leather/ }));
    const row = screen.getByTestId('option-row-11');
    const leatherCheckbox = await within(row).findByLabelText('ASBLV - Aviar SMOOTH Black Vienna');
    expect(leatherCheckbox).not.toBeChecked();

    await userEvent.click(leatherCheckbox);

    await waitFor(() => expect(mockCreateLink).toHaveBeenCalledTimes(1));
    expect(mockCreateLink).toHaveBeenCalledWith({ saddleId: 100, optionId: 11, optionItemId: 0, leatherId: 48 });
  });

  test('disabling a leather item deletes only that link', async () => {
    await renderOpen([link(11, 0, 0, 7), link(11, 0, 48, 8)]);

    await userEvent.click(screen.getByRole('button', { name: /Show items for Seat Leather/ }));
    const row = screen.getByTestId('option-row-11');
    const leatherCheckbox = await within(row).findByLabelText('ASBLV - Aviar SMOOTH Black Vienna');
    expect(leatherCheckbox).toBeChecked();

    await userEvent.click(leatherCheckbox);

    await waitFor(() => expect(mockDeleteLink).toHaveBeenCalledWith(8));
    expect(mockDeleteLink).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('checkbox', { name: 'Seat Leather' })).toBeChecked();
  });
});
