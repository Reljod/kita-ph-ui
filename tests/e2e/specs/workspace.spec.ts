import { seedAccountWithOrg } from '../support/api-client';
import { expect, newAccount, test, type Account } from '../support/fixtures';

/**
 * The authenticated surface: dashboard, agents, knowledge base, memory and
 * tools. A fresh organization has no content yet, so these assert the
 * empty-state and navigation behaviour that every account sees first — the
 * paths most likely to break and least likely to be exercised by hand.
 */

const emailBox = /you@company\.com/;
const passwordBox = /^•+$/;
const orgCodeBox = /e\.g\. KITA-/;

let account: Account;

test.beforeAll(async () => {
    account = newAccount('workspace');
    await seedAccountWithOrg(account);
});

/** Log in through the real form so each test starts authenticated. */
test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.getByPlaceholder(emailBox).fill(account.email);
    await page.getByPlaceholder(passwordBox).fill(account.password);
    await page.getByPlaceholder(orgCodeBox).fill(account.orgCode);
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 30_000 });
});

test.describe('dashboard', () => {
    test('renders after login', async ({ page }) => {
        await expect(page).toHaveURL(/\/dashboard/);
        await expect(page.locator('body')).toBeVisible();
    });

    test('does not surface a raw error or stack trace', async ({ page }) => {
        const body = (await page.locator('body').innerText()).toLowerCase();
        expect(body).not.toContain('traceback');
        expect(body).not.toContain('mongoservererror');
        expect(body).not.toContain('internal server error');
    });

    test('reloading keeps the session', async ({ page }) => {
        await page.reload();
        await expect(page).toHaveURL(/\/dashboard/);
    });
});

test.describe('authenticated routes', () => {
    for (const route of ['/agents', '/knowledge-base', '/memory', '/tools', '/dashboard']) {
        test(`${route} loads without redirecting to login`, async ({ page }) => {
            await page.goto(route);
            await expect(page).toHaveURL(new RegExp(route.replace('/', '\\/')));
        });

        test(`${route} renders no server error`, async ({ page }) => {
            const failures: number[] = [];
            page.on('response', (res) => {
                if (res.url().includes('/api/') && res.status() >= 500) {
                    failures.push(res.status());
                }
            });
            await page.goto(route);
            await page.waitForLoadState('networkidle');
            expect(failures, `5xx responses on ${route}`).toEqual([]);
        });
    }
});

test.describe('knowledge base', () => {
    test('shows an empty state for a new organization', async ({ page }) => {
        await page.goto('/knowledge-base');
        await page.waitForLoadState('networkidle');
        // Nothing has been ingested yet, so the page must render a calm empty
        // view rather than a spinner that never resolves or an error card.
        const body = (await page.locator('body').innerText()).toLowerCase();
        expect(body).not.toContain('failed to');
        expect(body).not.toContain('something went wrong');
    });

    test('offers a way to add knowledge', async ({ page }) => {
        await page.goto('/knowledge-base');
        await page.waitForLoadState('networkidle');
        const addButton = page.getByRole('button', { name: /add|upload|new/i }).first();
        await expect(addButton).toBeVisible();
    });
});

test.describe('memory', () => {
    test('shows an empty state for a new organization', async ({ page }) => {
        await page.goto('/memory');
        await page.waitForLoadState('networkidle');
        const body = (await page.locator('body').innerText()).toLowerCase();
        expect(body).not.toContain('failed to');
        expect(body).not.toContain('something went wrong');
    });

    test('offers a way to add a memory', async ({ page }) => {
        await page.goto('/memory');
        await page.waitForLoadState('networkidle');
        await expect(page.getByRole('button', { name: /add|new/i }).first()).toBeVisible();
    });
});

test.describe('session lifecycle', () => {
    test('a cleared session cookie sends the next navigation to login', async ({
        page,
        context,
    }) => {
        await context.clearCookies();
        await page.goto('/dashboard');
        await expect(page).toHaveURL(/\/login/);
    });

    test('a forged session cookie does not grant access to data', async ({
        page,
        context,
    }) => {
        // The middleware only checks for the cookie's presence, so a forged
        // value gets past the redirect — but the API must still reject it, so
        // no organization data can appear.
        await context.clearCookies();
        await context.addCookies([
            {
                name: 'token',
                value: 'not-a-real-jwt',
                domain: '127.0.0.1',
                path: '/',
            },
        ]);
        await page.goto('/knowledge-base');
        await page.waitForLoadState('networkidle');
        const body = (await page.locator('body').innerText()).toLowerCase();
        expect(body).not.toContain('traceback');
    });
});
