import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Fitters from '@/components/Fitters';
import * as apiModule from '@/services/api';

// The data layer: the fitters list comes through useEntityData -> fetchEntities.
jest.mock('@/services/api', () => ({
  fetchEntities: jest.fn(),
}));

jest.mock('@/services/fitters', () => ({
  ...jest.requireActual('@/services/fitters'),
  fetchFitterCountries: jest.fn().mockResolvedValue([]),
}));

jest.mock('sonner', () => ({ toast: { success: jest.fn(), error: jest.fn() } }));

// The modals pull in Radix dialogs; they are not under test here.
jest.mock('@/components/shared/FitterDetailModal', () => ({ FitterDetailModal: () => null }));
jest.mock('@/components/shared/FitterEditModal', () => ({ FitterEditModal: () => null }));

const fetchEntities = apiModule.fetchEntities as jest.Mock;

const TOTAL = 285;

function fitterPage(page: number, size: number) {
  const start = (page - 1) * size;
  return Array.from({ length: Math.min(size, TOTAL - start) }, (_, i) => ({
    id: TOTAL - start - i,
    name: `Fitter ${TOTAL - start - i}`,
    username: `fitter${TOTAL - start - i}`,
    enabled: true,
  }));
}

describe('Fitters pagination', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    fetchEntities.mockImplementation(async ({ page = 1, extraParams = {} }) => {
      const size = Number(extraParams.limit ?? 10);
      return {
        'hydra:member': fitterPage(page, size),
        'hydra:totalItems': TOTAL,
      };
    });
  });

  async function renderFitters() {
    render(<Fitters />);
    await waitFor(() => expect(screen.getByText(new RegExp(`of ${TOTAL}$`))).toBeInTheDocument());
  }

  it('requests page 2 when NEXT is clicked', async () => {
    await renderFitters();

    fireEvent.click(screen.getByRole('button', { name: 'NEXT >' }));

    await waitFor(() =>
      expect(fetchEntities).toHaveBeenLastCalledWith(
        expect.objectContaining({ entity: 'fitters', page: 2 }),
      ),
    );
    expect(screen.getByRole('button', { name: '< PREVIOUS' })).toBeEnabled();
  });

  it('jumps to the final page when LAST is clicked and back with FIRST', async () => {
    await renderFitters();

    fireEvent.click(screen.getByRole('button', { name: 'LAST >>' }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'NEXT >' })).toBeDisabled(),
    );
    const lastCall = fetchEntities.mock.calls.at(-1)![0];
    expect(lastCall.page).toBeGreaterThan(1);

    fireEvent.click(screen.getByRole('button', { name: '<< FIRST' }));
    await waitFor(() =>
      expect(fetchEntities).toHaveBeenLastCalledWith(
        expect.objectContaining({ entity: 'fitters', page: 1 }),
      ),
    );
  });

  it('asks the API for the same page size it displays', async () => {
    await renderFitters();

    const { extraParams } = fetchEntities.mock.calls[0][0];
    const rows = screen.getAllByRole('row').length - 1; // minus header row
    expect(Number(extraParams.limit)).toBe(rows);
    expect(screen.getByText(`Displaying results: 1-${rows} of ${TOTAL}`)).toBeInTheDocument();
  });
});
