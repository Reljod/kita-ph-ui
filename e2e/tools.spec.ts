import { test, expect } from '@playwright/test';
import { setupApiMocks } from './mocks/handlers';
import { mockLoggedIn } from './test-utils';

test.describe('Tools Browser', () => {
  test.beforeEach(async ({ page }) => {
    await setupApiMocks(page);
    await mockLoggedIn(page);
  });

  test('shows tool list', async ({ page }) => {
    await page.goto('/tools');
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('heading', { name: 'Tools Registry' })).toBeVisible();
    await expect(page.getByText('Web Search')).toBeVisible();
    await expect(page.getByText('Code Interpreter')).toBeVisible();
    await expect(page.getByText('Memory Search')).toBeVisible();
  });

  test('clicking a tool selects it and shows detail panel', async ({ page }) => {
    await page.goto('/tools');
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: /Web Search/ }).click();

    await expect(page.getByText('Linked Agents')).toBeVisible();
    await expect(page.getByText('ResearchBot')).toBeVisible();
    await expect(page.getByText('DevHelper')).toBeVisible();
  });

  test('shows linked agents for a tool', async ({ page }) => {
    await page.goto('/tools');
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: /Web Search/ }).click();

    await expect(page.getByText('ResearchBot')).toBeVisible();
    await expect(page.getByText('DevHelper')).toBeVisible();

    const agentLink = page.getByRole('link', { name: /ResearchBot/ });
    await expect(agentLink).toBeVisible();
    await expect(agentLink).toHaveAttribute('href', '/agents/agent-1');
  });

  test('searching tools filters results', async ({ page }) => {
    await page.goto('/tools');
    await page.waitForLoadState('networkidle');

    const searchInput = page.getByPlaceholder('Search tools...');
    await searchInput.fill('Web');

    await expect(page.getByText('Web Search')).toBeVisible();
    await expect(page.getByText('Code Interpreter')).not.toBeVisible();
  });
});
