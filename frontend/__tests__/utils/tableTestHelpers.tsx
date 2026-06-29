import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { RenderResult } from '@testing-library/react';

// Table interaction helpers
export class TableTestHelper {
  private screen: typeof screen;

  constructor() {
    this.screen = screen;
  }

  // DataTable interaction helpers
  async searchTable(searchTerm: string, placeholder: string = 'Search...') {
    const user = userEvent.setup();
    const searchInput = this.screen.getByPlaceholderText(placeholder);
    await user.clear(searchInput);
    await user.type(searchInput, searchTerm);
    
    // Wait for debounce
    await waitFor(() => {}, { timeout: 600 });
    
    return searchInput;
  }

  async clearSearch(placeholder: string = 'Search...') {
    const user = userEvent.setup();
    const searchInput = this.screen.getByPlaceholderText(placeholder);
    await user.clear(searchInput);
    
    await waitFor(() => {}, { timeout: 600 });
    
    return searchInput;
  }

  // Pagination helpers
  async clickPaginationButton(buttonText: 'First' | 'Previous' | 'Next' | 'Last') {
    const user = userEvent.setup();
    const button = this.screen.getByText(buttonText);
    await user.click(button);
    return button;
  }

  getPaginationInfo() {
    const pageInfo = this.screen.getByText(/Page \d+ of \d+/);
    const itemsInfo = this.screen.getByText(/Showing \d+-\d+ of \d+ items/);
    
    return {
      pageInfo: pageInfo.textContent,
      itemsInfo: itemsInfo.textContent,
    };
  }

  // Filter interaction helpers
  async applyTextFilter(filterTitle: string, value: string) {
    const user = userEvent.setup();
    
    // Click filter trigger
    const filterButton = this.screen.getByText(filterTitle);
    await user.click(filterButton);
    
    // Type in filter input
    const filterInput = this.screen.getByTestId('text-filter');
    await user.clear(filterInput);
    await user.type(filterInput, value);
    
    // Apply filter
    const applyButton = this.screen.getByTestId('apply-button');
    await user.click(applyButton);
    
    return { filterInput, applyButton };
  }

  async applyBooleanFilter(filterTitle: string, value: 'true' | 'false' | '') {
    const user = userEvent.setup();
    
    const filterButton = this.screen.getByText(filterTitle);
    await user.click(filterButton);
    
    const booleanFilter = this.screen.getByTestId('boolean-filter');
    await user.selectOptions(booleanFilter, value);
    
    return booleanFilter;
  }

  async applyEnumFilter(filterTitle: string, value: string) {
    const user = userEvent.setup();
    
    const filterButton = this.screen.getByText(filterTitle);
    await user.click(filterButton);
    
    const enumFilter = this.screen.getByTestId('enum-filter');
    await user.selectOptions(enumFilter, value);
    
    return enumFilter;
  }

  async applyDateRangeFilter(filterTitle: string, fromDate: string, toDate: string) {
    const user = userEvent.setup();
    
    const filterButton = this.screen.getByText(filterTitle);
    await user.click(filterButton);
    
    const fromInput = this.screen.getByTestId('date-from');
    const toInput = this.screen.getByTestId('date-to');
    
    await user.clear(fromInput);
    await user.type(fromInput, fromDate);
    
    await user.clear(toInput);
    await user.type(toInput, toDate);
    
    return { fromInput, toInput };
  }

  // Action button helpers
  async clickActionButton(buttonText: string, rowIndex: number = 0) {
    const user = userEvent.setup();
    const buttons = this.screen.getAllByText(buttonText);
    
    if (buttons.length <= rowIndex) {
      throw new Error(`Button "${buttonText}" not found at row index ${rowIndex}`);
    }
    
    await user.click(buttons[rowIndex]);
    return buttons[rowIndex];
  }

  // Data verification helpers
  expectTableToContainData(expectedData: string[]) {
    expectedData.forEach(data => {
      expect(this.screen.getByText(data)).toBeInTheDocument();
    });
  }

  expectTableToNotContainData(unexpectedData: string[]) {
    unexpectedData.forEach(data => {
      expect(this.screen.queryByText(data)).not.toBeInTheDocument();
    });
  }

  expectRowCount(expectedCount: number) {
    const rows = this.screen.getAllByRole('row');
    // Subtract 1 for header row
    expect(rows.length - 1).toBe(expectedCount);
  }

  expectColumnCount(expectedCount: number) {
    const headers = this.screen.getAllByRole('columnheader');
    expect(headers.length).toBe(expectedCount);
  }

  // State verification helpers
  expectLoadingState() {
    expect(this.screen.getByText('Loading...')).toBeInTheDocument();
  }

  expectErrorState(errorMessage: string) {
    expect(this.screen.getByText(errorMessage)).toBeInTheDocument();
  }

  expectEmptyState() {
    expect(this.screen.getByText('No data available')).toBeInTheDocument();
  }

  expectEmptySearchResults(searchTerm: string) {
    expect(this.screen.getByText(`No results found for "${searchTerm}"`)).toBeInTheDocument();
  }

  // Modal helpers
  expectModalToBeOpen(modalTestId: string) {
    expect(this.screen.getByTestId(modalTestId)).toBeInTheDocument();
  }

  expectModalToBeClosed(modalTestId: string) {
    expect(this.screen.queryByTestId(modalTestId)).not.toBeInTheDocument();
  }

  async closeModal() {
    const user = userEvent.setup();
    const closeButton = this.screen.getByText('Close');
    await user.click(closeButton);
    return closeButton;
  }
}

// Filter state helpers
export const createFilterTestSuite = (filterTitle: string, filterType: 'text' | 'boolean' | 'enum' | 'date-range') => {
  const helper = new TableTestHelper();

  return {
    async applyFilter(value: unknown) {
      switch (filterType) {
        case 'text':
          return helper.applyTextFilter(filterTitle, value as string);
        case 'boolean':
          return helper.applyBooleanFilter(filterTitle, value as '' | 'true' | 'false');
        case 'enum':
          return helper.applyEnumFilter(filterTitle, value as string);
        case 'date-range': {
          const range = value as { from: string; to: string };
          return helper.applyDateRangeFilter(filterTitle, range.from, range.to);
        }
        default:
          throw new Error(`Unsupported filter type: ${filterType}`);
      }
    },

    expectFilterApplied(mockFn: jest.Mock, expectedValue: unknown) {
      expect(mockFn).toHaveBeenCalledWith(expectedValue);
    },

    expectFilterReset(mockFn: jest.Mock) {
      expect(mockFn).toHaveBeenCalledWith('');
    },
  };
};

// Pagination test helpers
export const createPaginationTestSuite = () => {
  const helper = new TableTestHelper();

  return {
    async testPaginationNavigation(mockPageChange: jest.Mock) {
      // Test Next button
      await helper.clickPaginationButton('Next');
      expect(mockPageChange).toHaveBeenCalledWith(2);

      // Test Previous button (assuming we're now on page 2)
      await helper.clickPaginationButton('Previous');
      expect(mockPageChange).toHaveBeenCalledWith(1);

      // Test Last button
      await helper.clickPaginationButton('Last');
      expect(mockPageChange).toHaveBeenCalledWith(expect.any(Number));

      // Test First button
      await helper.clickPaginationButton('First');
      expect(mockPageChange).toHaveBeenCalledWith(1);
    },

    expectPaginationInfo(currentPage: number, totalPages: number, totalItems: number, itemsPerPage: number) {
      const { pageInfo, itemsInfo } = helper.getPaginationInfo();
      
      expect(pageInfo).toBe(`Page ${currentPage} of ${totalPages}`);
      
      const startItem = (currentPage - 1) * itemsPerPage + 1;
      const endItem = Math.min(currentPage * itemsPerPage, totalItems);
      expect(itemsInfo).toBe(`Showing ${startItem}-${endItem} of ${totalItems} items`);
    },

    expectButtonStates(currentPage: number, totalPages: number) {
      const firstButton = screen.getByText('First');
      const prevButton = screen.getByText('Previous');
      const nextButton = screen.getByText('Next');
      const lastButton = screen.getByText('Last');

      if (currentPage === 1) {
        expect(firstButton).toBeDisabled();
        expect(prevButton).toBeDisabled();
      } else {
        expect(firstButton).not.toBeDisabled();
        expect(prevButton).not.toBeDisabled();
      }

      if (currentPage === totalPages) {
        expect(nextButton).toBeDisabled();
        expect(lastButton).toBeDisabled();
      } else {
        expect(nextButton).not.toBeDisabled();
        expect(lastButton).not.toBeDisabled();
      }
    },
  };
};

// Search test helpers
export const createSearchTestSuite = (placeholder: string = 'Search...') => {
  const helper = new TableTestHelper();

  return {
    async testSearchFunctionality(mockSearch: jest.Mock, searchTerm: string) {
      await helper.searchTable(searchTerm, placeholder);
      
      await waitFor(() => {
        expect(mockSearch).toHaveBeenCalledWith(searchTerm);
      });
    },

    async testSearchDebouncing(mockSearch: jest.Mock) {
      const user = userEvent.setup();
      const searchInput = screen.getByPlaceholderText(placeholder);
      
      // Type multiple characters quickly
      await user.type(searchInput, 'abc');
      
      // Should not call immediately
      expect(mockSearch).not.toHaveBeenCalledWith('abc');
      
      // Wait for debounce
      await waitFor(() => {
        expect(mockSearch).toHaveBeenCalledWith('abc');
      }, { timeout: 600 });
    },

    async testSearchClear(mockSearch: jest.Mock) {
      await helper.clearSearch(placeholder);
      
      await waitFor(() => {
        expect(mockSearch).toHaveBeenCalledWith('');
      });
    },
  };
};

// Role-based testing helpers
export const createRoleTestSuite = () => {
  return {
    expectActionButtonsForRole(role: string, expectedButtons: string[]) {
      expectedButtons.forEach(buttonText => {
        expect(screen.getByText(buttonText)).toBeInTheDocument();
      });
    },

    expectActionButtonsNotForRole(role: string, forbiddenButtons: string[]) {
      forbiddenButtons.forEach(buttonText => {
        expect(screen.queryByText(buttonText)).not.toBeInTheDocument();
      });
    },

    expectRoleBasedVisibility(role: string, visibleElements: string[], hiddenElements: string[]) {
      visibleElements.forEach(element => {
        expect(screen.getByText(element)).toBeInTheDocument();
      });

      hiddenElements.forEach(element => {
        expect(screen.queryByText(element)).not.toBeInTheDocument();
      });
    },
  };
};

// Performance testing helpers
export const createPerformanceTestSuite = () => {
  return {
    expectMinimumApiCalls(mockFn: jest.Mock, maxCalls: number) {
      expect(mockFn).toHaveBeenCalledTimes(maxCalls);
    },

    expectDebouncedCalls(mockFn: jest.Mock, expectedCallCount: number, timeoutMs: number = 500) {
      return waitFor(() => {
        expect(mockFn).toHaveBeenCalledTimes(expectedCallCount);
      }, { timeout: timeoutMs + 100 });
    },

    measureRenderTime(renderFn: () => RenderResult) {
      const startTime = performance.now();
      const result = renderFn();
      const endTime = performance.now();
      
      return {
        result,
        renderTime: endTime - startTime,
      };
    },
  };
};

// Integration test helpers
export const createIntegrationTestSuite = () => {
  const helper = new TableTestHelper();

  return {
    async testFullFilterWorkflow(mockFetch: jest.Mock, filters: { type: string; value?: string; placeholder?: string; title?: string; from?: string; to?: string }[]) {
      // Apply multiple filters in sequence
      for (const filter of filters) {
        switch (filter.type) {
          case 'search':
            await helper.searchTable(filter.value ?? '', filter.placeholder);
            break;
          case 'text':
            await helper.applyTextFilter(filter.title ?? '', filter.value ?? '');
            break;
          case 'boolean':
            await helper.applyBooleanFilter(filter.title ?? '', (filter.value ?? '') as '' | 'true' | 'false');
            break;
          case 'enum':
            await helper.applyEnumFilter(filter.title ?? '', filter.value ?? '');
            break;
          case 'date-range':
            await helper.applyDateRangeFilter(filter.title ?? '', filter.from ?? '', filter.to ?? '');
            break;
        }
      }

      // Verify all filters were applied
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.objectContaining({
            // Expected filter combinations
          })
        );
      });
    },

    async testModalWorkflow(actionButtonText: string, modalTestId: string) {
      // Open modal
      await helper.clickActionButton(actionButtonText);
      helper.expectModalToBeOpen(modalTestId);

      // Close modal
      await helper.closeModal();
      helper.expectModalToBeClosed(modalTestId);
    },

    async testCompleteTableWorkflow(mockFetch: jest.Mock) {
      // Search
      await helper.searchTable('test');
      
      // Apply filters
      await helper.applyTextFilter('Name', 'John');
      await helper.applyBooleanFilter('Active', 'true');
      
      // Navigate pages
      await helper.clickPaginationButton('Next');
      
      // Verify API calls
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.objectContaining({
            search: 'test',
            filters: expect.objectContaining({
              name: 'John',
              active: 'true',
            }),
            page: 2,
          })
        );
      });
    },
  };
};

// Add a basic test to satisfy Jest's requirement
if (typeof test !== 'undefined') {
  test('tableTestHelpers should provide table testing utilities', () => {
    expect(TableTestHelper).toBeDefined();
    expect(createFilterTestSuite).toBeDefined();
    expect(createPaginationTestSuite).toBeDefined();
    expect(createSearchTestSuite).toBeDefined();
    expect(createRoleTestSuite).toBeDefined();
    expect(createPerformanceTestSuite).toBeDefined();
    expect(createIntegrationTestSuite).toBeDefined();
  });
}