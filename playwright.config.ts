import { defineConfig, devices } from '@playwright/test';

const UI_PORT = Number(process.env.E2E_UI_PORT ?? 3000);
const BASE_URL = process.env.E2E_BASE_URL ?? `http://127.0.0.1:${UI_PORT}`;

export default defineConfig({
    testDir: './tests/e2e/specs',
    // Booting Mongo, Redis, the API and Next takes a while on a cold machine.
    timeout: 90_000,
    expect: { timeout: 15_000 },
    globalSetup: './tests/e2e/support/global-setup.ts',
    globalTeardown: './tests/e2e/support/global-teardown.ts',
    // Serial: the specs share one database and one set of seeded accounts, so
    // parallel workers would race each other's fixtures.
    workers: 1,
    fullyParallel: false,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 1 : 0,
    reporter: [
        ['list'],
        ['html', { outputFolder: 'tests/e2e/artifacts/html-report', open: 'never' }],
        ['json', { outputFile: 'tests/e2e/artifacts/results.json' }],
    ],
    outputDir: 'tests/e2e/artifacts/test-results',
    use: {
        baseURL: BASE_URL,
        // Evidence for PR review: a video of every spec and a screenshot at
        // the end of each, uploaded as CI artifacts rather than committed.
        video: 'on',
        screenshot: 'on',
        trace: 'retain-on-failure',
        actionTimeout: 15_000,
        navigationTimeout: 30_000,
    },
    projects: [
        {
            name: 'chromium',
            use: {
                ...devices['Desktop Chrome'],
                viewport: { width: 1440, height: 900 },
                launchOptions: {
                    // Honour a preinstalled browser when the image ships one
                    // that does not match this Playwright release's expected
                    // build number (CI images commonly pin their own). Falls
                    // back to Playwright's own download when unset.
                    ...(process.env.E2E_CHROMIUM_PATH
                        ? { executablePath: process.env.E2E_CHROMIUM_PATH }
                        : {}),
                },
            },
        },
    ],
    webServer: {
        // Production build: `next dev` recompiles per route, which turns the
        // first visit to each page into a multi-second stall and makes the
        // whole suite flaky on timing.
        command: process.env.E2E_SKIP_BUILD === "1"
            ? `npx next start -p ${UI_PORT}`
            : `npm run build && npx next start -p ${UI_PORT}`,
        url: BASE_URL,
        reuseExistingServer: !process.env.CI,
        timeout: 300_000,
        stdout: 'pipe',
        stderr: 'pipe',
    },
});
