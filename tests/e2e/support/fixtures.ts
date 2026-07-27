import { readFileSync } from 'node:fs';
import path from 'node:path';

import { test as base, expect } from '@playwright/test';

export interface Runtime {
    mongoUri: string;
    mongoSource: 'cloud' | 'local' | 'remote';
    redisSource: 'cloud' | 'local' | 'remote';
    dbName: string;
    /** Where the API actually is — a deployment URL, or the local process. */
    backendUrl?: string;
    /** False when the API is deployed: nothing here owns its database. */
    provisionedDb?: boolean;
    apiPort: number;
    clientId: string;
    apiKey: string;
    llm: 'mock' | 'live';
    notes: string[];
}

export function runtime(): Runtime {
    return JSON.parse(
        readFileSync(path.resolve(__dirname, '../.runtime.json'), 'utf8')
    ) as Runtime;
}

/** A unique-per-run account, so reruns never collide on the email index. */
export function newAccount(label: string) {
    const stamp = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
    return {
        email: `e2e-${label}-${stamp}@example.com`,
        password: 'E2ePassw0rd!',
        firstName: 'Ada',
        lastName: 'Lovelace',
        orgName: `E2E Org ${stamp}`,
        orgCode: `e2e-${stamp}`,
    };
}

export type Account = ReturnType<typeof newAccount>;

// Accounts are registered through the API (see support/api-client.ts), not
// through the page: the login route only logs in, there is no signup form to
// drive. A UI helper for it existed here and was never called by any spec.

export const test = base.extend<{ account: Account }>({
    // The second argument is Playwright's fixture callback. It is passed
    // positionally, so it is named `provide` rather than the conventional
    // `use`: the shared React lint config reads a call to `use(...)` as a
    // React hook and rejects it outside a component.
    account: async ({}, provide, testInfo) => {
        await provide(newAccount(testInfo.title.slice(0, 12).replace(/\W+/g, '-').toLowerCase()));
    },
});

export { expect };
