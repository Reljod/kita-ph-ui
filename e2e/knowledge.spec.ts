import { test, expect } from '@playwright/test';
import { setupApiMocks } from './mocks/handlers';
import { mockLoggedIn } from './test-utils';

test.describe('Knowledge Base', () => {
  test.beforeEach(async ({ page }) => {
    await setupApiMocks(page);
    await mockLoggedIn(page);
  });

  test('shows knowledge base files', async ({ page }) => {
    await page.goto('/knowledge-base');
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('heading', { name: 'Knowledge Base' })).toBeVisible();
    await expect(page.getByText('project_requirements.pdf')).toBeVisible();
    await expect(page.getByText('api_documentation.md')).toBeVisible();
  });

  test('opening add knowledge modal shows form', async ({ page }) => {
    await page.goto('/knowledge-base');
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: 'Add Knowledge' }).click();
    await expect(page.getByText('Add to Knowledge Base')).toBeVisible();
    await expect(page.getByText('Knowledge Scope')).toBeVisible();
  });

  test('updating file metadata opens edit modal', async ({ page }) => {
    await page.goto('/knowledge-base');
    await page.waitForLoadState('networkidle');

    const editButton = page.locator('button[title="Edit metadata"]').first();
    await editButton.click();

    await expect(page.getByText('Edit Knowledge')).toBeVisible();
    await expect(page.getByPlaceholder('Update filename')).toBeVisible();
  });

  test('deleting a file removes it', async ({ page }) => {
    await page.goto('/knowledge-base');
    await page.waitForLoadState('networkidle');

    const deleteButton = page.locator('button[title="Delete file"]').first();
    await deleteButton.click();

    await expect(page.getByText('Delete Knowledge File')).toBeVisible();
    await page.getByRole('button', { name: 'Delete', exact: true }).click();

    // Wait for dialog to close and refetch to complete
    await expect(page.getByText('Delete Knowledge File')).not.toBeVisible();
    await page.waitForTimeout(1000);

    await expect(page.getByText('project_requirements.pdf', { exact: true })).not.toBeVisible();
  });
});
