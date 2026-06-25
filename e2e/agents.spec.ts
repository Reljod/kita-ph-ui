import { test, expect } from '@playwright/test';
import { setupApiMocks } from './mocks/handlers';
import { loginAsUser } from './test-utils';

test.describe('Agents', () => {
  test.beforeEach(async ({ page }) => {
    await setupApiMocks(page);
    await loginAsUser(page);
  });

  test('lists agents on the agents page', async ({ page }) => {
    await page.goto('/agents');

    await expect(page.getByRole('heading', { name: /Your Agents/ })).toBeVisible();
    await expect(page.getByText('ResearchBot')).toBeVisible();
    await expect(page.getByText('DevHelper')).toBeVisible();
  });

  test('navigating to agent detail shows agent info', async ({ page }) => {
    await page.goto('/agents/agent-1');

    await expect(page.getByText('Agent Profile')).toBeVisible();
    await expect(page.getByText('Research Assistant')).toBeVisible();
  });

  test('edit page loads with agent data', async ({ page }) => {
    await page.goto('/agents/agent-1/edit');

    await expect(page.getByText('Configure Workspace')).toBeVisible();
    const nameInput = page.getByPlaceholder('e.g. Research Assistant');
    await expect(nameInput).toBeVisible();
    await expect(nameInput).toHaveValue('ResearchBot');
  });

  test('agent chat page loads and shows chat UI', async ({ page }) => {
    await page.goto('/agents/agent-1/chat');

    await expect(page.getByPlaceholder(/Message/)).toBeVisible();
  });
});
