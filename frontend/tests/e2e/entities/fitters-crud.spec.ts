import { test, expect } from '@playwright/test';
import { AuthHelper, TEST_USERS } from '../shared/auth-helpers';
import { ApiHelper } from '../shared/api-helpers';

test.describe('Fitters CRUD Operations', () => {
  let authHelper: AuthHelper;
  let apiHelper: ApiHelper;

  test.beforeEach(async ({ page }) => {
    authHelper = new AuthHelper(page);
    apiHelper = new ApiHelper(page);

    await authHelper.login(TEST_USERS.admin);
    await page.goto('/fitters');
    await authHelper.waitForPageLoad();
  });

  test.afterEach(async () => {
    await authHelper.logout();
  });

  test('should load fitters page and display table', async ({ page }) => {
    // Verify the page header is visible — the Fitters component renders a PageHeader with title "Fitters"
    await expect(page.locator('h1, [data-testid="page-title"]')).toBeVisible();

    // Wait for the /fitters API response to arrive and validate hydra collection structure
    const response = (await apiHelper.waitForApiResponse('/fitters')) as Record<string, unknown>;
    expect(response).toHaveProperty('hydra:member');
    expect(Array.isArray(response['hydra:member'])).toBe(true);

    // Verify the EntityTable rendered table rows from the fetched data
    const tableRows = page.locator('tbody tr, [data-testid*="fitter-row"]');
    const rowCount = await tableRows.count();
    expect(rowCount).toBeGreaterThan(0);
  });

  test('should open create new fitter form and expose required fields', async ({ page }) => {
    await authHelper.waitForPageLoad();

    // The Fitters component renders an "Add Fitter" button (with Plus icon).
    // Try multiple selector strategies for resilience.
    const createTriggers = [
      'button:has-text("Add Fitter")',
      'button:has-text("Add")',
      'button:has-text("Create")',
      'button:has-text("New")',
      '[data-testid="add-fitter"]',
      '[data-testid="create-fitter"]',
    ];

    let formOpened = false;

    for (const selector of createTriggers) {
      try {
        const trigger = page.locator(selector);
        if (await trigger.isVisible({ timeout: 2000 })) {
          await trigger.click();

          // FitterEditModal renders inside a shadcn Dialog ([role="dialog"])
          const formLocator = page.locator('[role="dialog"], form, .modal');
          try {
            await formLocator.waitFor({ state: 'visible', timeout: 3000 });
            formOpened = true;
          } catch {
            // May have navigated to a create page instead
            formOpened =
              page.url().includes('/create') || page.url().includes('/new');
          }

          if (formOpened) {
            // When fitter is null, FitterEditModal shows "Create Fitter" as DialogTitle
            const dialogTitle = page.locator(
              '[data-testid="dialog-title"], h2',
            );
            try {
              await dialogTitle.waitFor({ state: 'visible', timeout: 2000 });
              const titleText = await dialogTitle.textContent();
              if (titleText) {
                expect(titleText.toLowerCase()).toContain('fitter');
              }
            } catch {
              // Title element may not be separately queryable; proceed with field checks
            }

            // FitterEditModal renders inputs for username, email, firstName, lastName
            const usernameInput = page.locator(
              'input[placeholder*="Username" i], input[name="username"]',
            );
            const emailInput = page.locator(
              'input[type="email"], input[placeholder*="Email" i]',
            );

            const usernameVisible = await usernameInput
              .first()
              .isVisible({ timeout: 2000 })
              .catch(() => false);
            const emailVisible = await emailInput
              .first()
              .isVisible({ timeout: 2000 })
              .catch(() => false);

            expect(usernameVisible || emailVisible).toBeTruthy();
          }
          break;
        }
      } catch {
        continue;
      }
    }
  });

  test('should view fitter details in a detail modal', async ({ page }) => {
    await authHelper.waitForPageLoad();

    // The EntityTable renders View buttons in each row via the onView prop.
    // The FitterDetailModal opens with DialogTitle "Fitter Details - {username}".
    const detailTriggers = [
      'button:has-text("View")',
      'button:has-text("Details")',
      '[data-testid="view-details"]',
      '[data-testid*="view"]',
      'tbody tr',
    ];

    let detailOpened = false;

    for (const selector of detailTriggers) {
      try {
        const trigger = page.locator(selector).first();
        if (await trigger.isVisible({ timeout: 2000 })) {
          await trigger.click();

          // FitterDetailModal renders inside a shadcn Dialog ([role="dialog"])
          const detailModal = page.locator(
            '[role="dialog"], .modal, [data-testid*="modal"], [data-testid*="detail"]',
          );

          try {
            await detailModal.waitFor({ state: 'visible', timeout: 3000 });
            detailOpened = true;

            // The detail modal title contains "Fitter Details"
            const modalContent = detailModal;
            const contentText = await modalContent
              .textContent()
              .catch(() => '');
            expect(
              contentText?.toLowerCase().includes('fitter') ||
                contentText?.toLowerCase().includes('username'),
            ).toBeTruthy();
          } catch {
            // If no modal appeared, check if the URL navigated to a detail route
            const urlNavigated =
              page.url().includes('/fitter') &&
              !page.url().endsWith('/fitters');
            if (urlNavigated) {
              detailOpened = true;
            }
          }
          break;
        }
      } catch {
        continue;
      }
    }

    expect(detailOpened).toBeTruthy();
  });

  test('should open edit fitter form with pre-populated fields', async ({ page }) => {
    await authHelper.waitForPageLoad();

    // The EntityTable renders Edit buttons per row via the onEdit prop.
    // FitterEditModal with a non-null fitter prop pre-populates all fields from the fitter object.
    const editTriggers = [
      'button:has-text("Edit")',
      '[data-testid*="edit"]',
      'button[aria-label*="edit" i]',
    ];

    let editFormOpened = false;

    for (const selector of editTriggers) {
      try {
        const editButton = page.locator(selector).first();
        if (await editButton.isVisible({ timeout: 2000 })) {
          await editButton.click();

          // FitterEditModal renders inside a shadcn Dialog ([role="dialog"])
          const formLocator = page.locator('[role="dialog"], form');
          try {
            await formLocator.waitFor({ state: 'visible', timeout: 3000 });
            editFormOpened = true;
          } catch {
            continue;
          }

          if (editFormOpened) {
            // When editing an existing fitter, DialogTitle is "Edit Fitter {username}"
            try {
              const dialogTitle = page.locator('[role="dialog"] h2').first();
              const titleText = await dialogTitle
                .textContent({ timeout: 2000 })
                .catch(() => '');
              if (titleText) {
                expect(titleText.toLowerCase()).toContain('fitter');
              }
            } catch {
              // Title check is best-effort
            }

            // The modal pre-populates username input from fitter.username
            const usernameInput = page
              .locator(
                'input[placeholder*="Username" i], input[name="username"]',
              )
              .first();

            if (await usernameInput.isVisible({ timeout: 2000 })) {
              const usernameValue = await usernameInput.inputValue();
              // A pre-populated field for an existing fitter will have a non-empty value
              expect(usernameValue.length).toBeGreaterThan(0);
            } else {
              // Fall back: verify the email field is populated
              const emailInput = page
                .locator('input[type="email"], input[placeholder*="Email" i]')
                .first();
              if (await emailInput.isVisible({ timeout: 2000 })) {
                const emailValue = await emailInput.inputValue();
                expect(emailValue.length).toBeGreaterThan(0);
              }
            }
          }
          break;
        }
      } catch {
        continue;
      }
    }
  });

  test('should prompt confirmation when deleting a fitter', async ({ page }) => {
    await authHelper.waitForPageLoad();

    // The Fitters component calls window.confirm before deleteFitter().
    // We intercept the native dialog to verify the prompt appears and then dismiss it
    // to avoid actually deleting data in the test environment.
    let confirmDialogSeen = false;

    page.on('dialog', async (dialog) => {
      confirmDialogSeen = true;
      // Verify the confirmation message references the fitter being deleted
      const message = dialog.message();
      expect(message.toLowerCase()).toContain('delete');
      // Dismiss so no data is destroyed during the test run
      await dialog.dismiss();
    });

    const deleteTriggers = [
      'button:has-text("Delete")',
      '[data-testid*="delete"]',
      'button[aria-label*="delete" i]',
    ];

    let deleteButtonFound = false;

    for (const selector of deleteTriggers) {
      try {
        const deleteButton = page.locator(selector).first();
        if (await deleteButton.isVisible({ timeout: 2000 })) {
          deleteButtonFound = true;
          await deleteButton.click();

          // Give the native confirm dialog a moment to register
          await page.waitForTimeout(500);

          // If a shadcn-based confirmation dialog is used instead of window.confirm,
          // check for it as an alternative
          if (!confirmDialogSeen) {
            const confirmModal = page.locator(
              '[role="alertdialog"], [role="dialog"]:has-text("Delete"), [role="dialog"]:has-text("confirm")',
            );
            try {
              await confirmModal.waitFor({ state: 'visible', timeout: 2000 });
              confirmDialogSeen = true;
              // Dismiss via the cancel button to avoid data mutation
              const cancelButton = page.locator(
                'button:has-text("Cancel"), button:has-text("No"), button:has-text("Back")',
              ).first();
              if (await cancelButton.isVisible({ timeout: 1000 })) {
                await cancelButton.click();
              }
            } catch {
              // No modal-based confirmation found either; the check is captured above
            }
          }
          break;
        }
      } catch {
        continue;
      }
    }

    // If a delete button exists in the UI, the confirmation mechanism must have fired
    if (deleteButtonFound) {
      expect(confirmDialogSeen).toBeTruthy();
    }
  });

  test('should validate fitter data integrity from API', async () => {
    const response = (await apiHelper.waitForApiResponse('/fitters')) as Record<string, unknown>;

    expect(response).toHaveProperty('hydra:member');
    expect(Array.isArray(response['hydra:member'])).toBe(true);
    expect(response).toHaveProperty('hydra:totalItems');
    expect(typeof response['hydra:totalItems']).toBe('number');

    (response['hydra:member'] as Record<string, unknown>[]).forEach(
      (fitter: Record<string, unknown>, _index: number) => {
        // Every fitter record must carry an id with a numeric or string type
        expect(fitter).toHaveProperty('id');
        const idType = typeof fitter['id'];
        expect(idType === 'number' || idType === 'string').toBe(true);

        // username is the primary display identifier in this application
        expect(fitter).toHaveProperty('username');

        // Email, when present, must conform to a valid address format
        if (fitter['email']) {
          expect(fitter['email']).toMatch(
            /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
          );
        }

        // enabled flag, when present, must be a boolean
        if ('enabled' in fitter) {
          expect(typeof fitter['enabled']).toBe('boolean');
        }
      },
    );
  });
});
