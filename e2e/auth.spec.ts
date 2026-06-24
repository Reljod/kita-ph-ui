import { test, expect } from '@playwright/test';
import { setupApiMocks } from './mocks/handlers';
import { mockLoggedIn, loginAsUser } from './test-utils';

test.describe('Authentication', () => {
  test.beforeEach(async ({ page }) => {
    await setupApiMocks(page);
  });

  test('shows login page when unauthenticated', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
  });

  test('successful login redirects to dashboard', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();

    await page.getByPlaceholder('you@company.com').fill('test@kita.ai');
    await page.getByPlaceholder('••••••••').fill('password123');
    await page.getByPlaceholder('e.g. KITA-123').fill('KITA-123');
    await page.getByRole('button', { name: 'Sign In' }).click();

    await page.waitForURL('/dashboard');
    await expect(page.getByText('Select an Agent')).toBeVisible();
  });

  test('shows error on invalid credentials', async ({ page }) => {
    // Override login to return 401
    await page.route(/\/auth\/login/, async (route) => {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ detail: 'Incorrect email, password, or organization code.' }),
      });
    });

    await page.goto('/login');

    await page.getByPlaceholder('you@company.com').fill('wrong@kita.ai');
    await page.getByPlaceholder('••••••••').fill('wrongpassword');
    await page.getByPlaceholder('e.g. KITA-123').fill('WRONG-CODE');
    await page.getByRole('button', { name: 'Sign In' }).click();

    await expect(page.getByText('Incorrect email, password, or organization code.')).toBeVisible();
  });

  test('logout clears session and redirects to login', async ({ page }) => {
    await loginAsUser(page);

    // Click user menu by the displayed name (email.split('@')[0] = 'test')
    await page.getByText('test').click();
    await page.getByRole('button', { name: 'Logout' }).click();
    await expect(page).toHaveURL(/\/login/);
  });
});
