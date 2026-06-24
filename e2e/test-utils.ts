import { Page, expect } from '@playwright/test';
import { setupApiMocks } from './mocks/handlers';

export async function mockLoggedIn(page: Page) {
  await page.context().addCookies([
    { name: 'token', value: 'mock-access-token', domain: 'localhost', path: '/' },
    { name: 'refreshToken', value: 'mock-refresh-token', domain: 'localhost', path: '/' },
  ]);
}

export async function loginAsUser(page: Page) {
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();

  await page.getByPlaceholder('you@company.com').fill('test@kita.ai');
  await page.getByPlaceholder('••••••••').fill('password123');
  await page.getByPlaceholder('e.g. KITA-123').fill('KITA-123');
  await page.getByRole('button', { name: 'Sign In' }).click();

  await page.waitForURL('/dashboard');
}
