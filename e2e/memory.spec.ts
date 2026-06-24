import { test, expect } from '@playwright/test';
import { setupApiMocks } from './mocks/handlers';
import { mockLoggedIn } from './test-utils';

test.describe('Memory Vault', () => {
  test.beforeEach(async ({ page }) => {
    await setupApiMocks(page);
    await mockLoggedIn(page);
  });

  test('shows memories list', async ({ page }) => {
    await page.goto('/memory');
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('heading', { name: 'Memory Vault' })).toBeVisible();
    await expect(page.getByText('User Greeting Preferences')).toBeVisible();
    await expect(page.getByText('Research Source Priority')).toBeVisible();
  });

  test('creating a memory entry works and appears', async ({ page }) => {
    await page.goto('/memory');
    await page.waitForLoadState('networkidle');

    // Click the header "Add Memory" button (first one)
    await page.getByRole('button', { name: 'Add Memory' }).first().click();

    await expect(page.getByText('Add New Memory')).toBeVisible();

    const titleInput = page.getByPlaceholder('e.g. User Greeting Preferences');
    await titleInput.fill('Test Memory Title');

    const textarea = page.locator('textarea');
    await textarea.fill('Test memory content description');

    // Submit the form
    await page.locator('form button[type="submit"]').click();

    await expect(page.getByText('Test Memory Title')).toBeVisible();
  });

  test('searching memories filters results', async ({ page }) => {
    await page.goto('/memory');
    await page.waitForLoadState('networkidle');

    const searchInput = page.getByPlaceholder('Search memories...');
    await searchInput.fill('Greeting');

    await page.waitForTimeout(500);
    await expect(page.getByText('User Greeting Preferences')).toBeVisible();
    await expect(page.getByText('Research Source Priority')).not.toBeVisible();
  });

  test('deleting a memory removes it from the list', async ({ page }) => {
    await page.goto('/memory');
    await page.waitForLoadState('networkidle');

    const deleteButton = page.locator('button[title="Delete memory"]').first();
    await expect(deleteButton).toBeVisible();
    await deleteButton.click();

    await expect(page.getByText('Delete Memory')).toBeVisible();
    await page.getByRole('button', { name: 'Delete', exact: true }).click();

    // Wait for dialog to close and refetch to complete
    await expect(page.getByText('Delete Memory')).not.toBeVisible();
    await page.waitForTimeout(1000);

    await expect(page.getByText('User Greeting Preferences', { exact: true })).not.toBeVisible();
  });
});
