import { defineConfig, devices } from '@playwright/test';

const UI_PORT = Number(process.env.E2E_UI_PORT ?? 3000);
const BASE_URL = process.env.E2E_BASE_URL ?? `http://127.0.0.1:${UI_PORT}`;

/**
 * A deployed API is an order of magnitude slower than a local one. Measured
 * against FastAPI Cloud: register 6.8s, create org 11.8s, login 10.5s, and a
 * *rejected* login 21.5s — the failure path is the slowest of the lot.
 *
 * The stock 15s expect timeout sits under that last figure, so every assertion
 * about a rejected login failed on the clock rather than on the behaviour. The
 * assertions are unchanged; only the patience is. Local runs keep the tight
 * numbers, where a slow login really is a regression worth failing on.
 */
const REMOTE_API = !!process.env.E2E_API_URL;
const scale = (local: number, factor = 3) => (REMOTE_API ? local * factor : local);

export default defineConfig({
    testDir: './tests/e2e/specs',
    // Booting Mongo, Redis, the API and Next takes a while on a cold machine.
    timeout: scale(90_000, 2),
    expect: { timeout: scale(15_000) },
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
        // Evidence for PR review: a screenshot from every spec, uploaded as a
        // CI artifact rather than committed. Video is off on purpose — it was
        // the bulk of the ~11MB per run and the screenshots carry the same
        // review signal. A failing spec still gets a trace, which is more
        // useful than video for diagnosis anyway.
        video: 'off',
        screenshot: 'on',
        trace: 'retain-on-failure',
        actionTimeout: scale(15_000),
        navigationTimeout: scale(30_000, 2),
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
    // Next is deliberately NOT started via `webServer`: Playwright launches
    // that before globalSetup runs, so the server would come up before the
    // API client credentials exist and its /api proxy would forward empty
    // x-api-key/x-client-id headers — every login 401s. globalSetup starts it
    // instead, once the credentials are known.
});
