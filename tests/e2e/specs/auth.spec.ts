import { seedAccountWithOrg } from '../support/api-client';
import {
    LOGIN_TIMEOUT,
    expect,
    newAccount,
    runtime,
    test,
    type Account,
} from '../support/fixtures';

/**
 * Login and route protection: the happy path plus every way the form can be
 * told "no". These run against the real API and a real database.
 */

const emailBox = /you@company\.com/;
const passwordBox = /^•+$/;
const orgCodeBox = /e\.g\. KITA-/;

async function fillLogin(
    page: import('@playwright/test').Page,
    creds: { email: string; password: string; orgCode: string }
) {
    await page.getByPlaceholder(emailBox).fill(creds.email);
    await page.getByPlaceholder(passwordBox).fill(creds.password);
    await page.getByPlaceholder(orgCodeBox).fill(creds.orgCode);
}

test.describe('environment', () => {
    test('records which backing services the run used', async () => {
        const info = runtime();
        // Not an assertion about correctness — it puts the provenance of the
        // run in the report, so a reviewer can see whether the cloud cluster
        // or a local fallback was exercised.
        test.info().annotations.push(
            { type: 'mongo', description: info.mongoSource },
            { type: 'redis', description: info.redisSource },
            { type: 'llm', description: info.llm }
        );
        expect(info.dbName).toContain('e2e');
    });
});

test.describe('login', () => {
    let account: Account;

    test.beforeAll(async () => {
        account = newAccount('auth');
        await seedAccountWithOrg(account);
    });

    test('an unauthenticated visitor is sent to the login page', async ({ page }) => {
        await page.goto('/dashboard');
        await expect(page).toHaveURL(/\/login/);
    });

    test('the login page renders its three fields', async ({ page }) => {
        await page.goto('/login');
        await expect(page.getByPlaceholder(emailBox)).toBeVisible();
        await expect(page.getByPlaceholder(passwordBox)).toBeVisible();
        await expect(page.getByPlaceholder(orgCodeBox)).toBeVisible();
    });

    test('valid credentials reach the dashboard', async ({ page }) => {
        await page.goto('/login');
        await fillLogin(page, account);
        await page.getByRole('button', { name: /sign in/i }).click();
        await expect(page).toHaveURL(/\/dashboard/, { timeout: LOGIN_TIMEOUT });
    });

    test('a session cookie is set on success', async ({ page, context }) => {
        await page.goto('/login');
        await fillLogin(page, account);
        await page.getByRole('button', { name: /sign in/i }).click();
        await expect(page).toHaveURL(/\/dashboard/, { timeout: LOGIN_TIMEOUT });
        const cookies = await context.cookies();
        expect(cookies.find((c) => c.name === 'token')?.value).toBeTruthy();
    });

    test('an already-authenticated visitor is bounced off /login', async ({ page }) => {
        await page.goto('/login');
        await fillLogin(page, account);
        await page.getByRole('button', { name: /sign in/i }).click();
        await expect(page).toHaveURL(/\/dashboard/, { timeout: LOGIN_TIMEOUT });
        await page.goto('/login');
        await expect(page).toHaveURL(/\/dashboard/);
    });

    test('the deep link is preserved as ?from=', async ({ page }) => {
        await page.goto('/knowledge-base');
        await expect(page).toHaveURL(/\/login\?from=%2Fknowledge-base/);
    });
});

test.describe('login failures', () => {
    let account: Account;

    test.beforeAll(async () => {
        account = newAccount('authfail');
        await seedAccountWithOrg(account);
    });

    test('a wrong password is rejected without leaving the page', async ({ page }) => {
        await page.goto('/login');
        await fillLogin(page, { ...account, password: 'WrongPassword!1' });
        await page.getByRole('button', { name: /sign in/i }).click();
        await expect(page).toHaveURL(/\/login/);
    });

    test('a wrong password shows the ambiguous error', async ({ page }) => {
        await page.goto('/login');
        await fillLogin(page, { ...account, password: 'WrongPassword!1' });
        await page.getByRole('button', { name: /sign in/i }).click();
        await expect(page.getByText(/incorrect email, password, or organization code/i)).toBeVisible();
    });

    test('an unknown email gives the same message as a wrong password', async ({ page }) => {
        await page.goto('/login');
        await fillLogin(page, { ...account, email: 'nobody-at-all@example.com' });
        await page.getByRole('button', { name: /sign in/i }).click();
        await expect(page.getByText(/incorrect email, password, or organization code/i)).toBeVisible();
    });

    test('an unknown organization code does not reveal that it is unknown', async ({ page }) => {
        await page.goto('/login');
        await fillLogin(page, { ...account, orgCode: 'no-such-org-code' });
        await page.getByRole('button', { name: /sign in/i }).click();
        const body = await page.locator('body').innerText();
        expect(body.toLowerCase()).not.toMatch(/organization (code )?(does not exist|not found)/);
    });

    test('submit stays disabled until every field is filled', async ({ page }) => {
        await page.goto('/login');
        const submit = page.getByRole('button', { name: /sign in/i });
        await expect(submit).toBeDisabled();

        await page.getByPlaceholder(emailBox).fill(account.email);
        await expect(submit).toBeDisabled();

        await page.getByPlaceholder(passwordBox).fill(account.password);
        await expect(submit).toBeDisabled();

        await page.getByPlaceholder(orgCodeBox).fill(account.orgCode);
        await expect(submit).toBeEnabled();
    });

    test('clearing a field disables submit again', async ({ page }) => {
        await page.goto('/login');
        await fillLogin(page, account);
        const submit = page.getByRole('button', { name: /sign in/i });
        await expect(submit).toBeEnabled();
        await page.getByPlaceholder(orgCodeBox).fill('');
        await expect(submit).toBeDisabled();
    });

    test('a malformed email is rejected by the field', async ({ page }) => {
        await page.goto('/login');
        await page.getByPlaceholder(emailBox).fill('not-an-email');
        await page.getByPlaceholder(passwordBox).fill(account.password);
        await page.getByPlaceholder(orgCodeBox).fill(account.orgCode);
        await page.getByRole('button', { name: /sign in/i }).click();
        await expect(page).toHaveURL(/\/login/);
    });
});
