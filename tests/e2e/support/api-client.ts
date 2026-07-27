/**
 * Thin client for seeding state the specs need but do not themselves assert.
 *
 * Registration has no UI yet — the login page only logs in — so accounts and
 * organizations are created through the API and the browser then exercises the
 * flows that *do* have a UI. Anything a spec is actually testing goes through
 * the page, never through here.
 */

import { runtime } from './fixtures';

function baseUrl(): string {
    // globalSetup records where the API actually is; it may be a deployment
    // rather than the local process. apiPort is the fallback for runtime files
    // written before backendUrl existed.
    const { backendUrl, apiPort } = runtime();
    return backendUrl ?? `http://127.0.0.1:${apiPort}`;
}

function headers(extra: Record<string, string> = {}): Record<string, string> {
    const { clientId, apiKey } = runtime();
    return { 'x-client-id': clientId, 'x-api-key': apiKey, ...extra };
}

export interface SeededUser {
    email: string;
    password: string;
    accessToken: string;
}

export interface SeededOrg {
    id: string;
    orgCode: string;
    /** A token scoped to the organization — what the UI holds after login. */
    accessToken: string;
}

async function expectOk(res: Response, what: string): Promise<unknown> {
    if (!res.ok) {
        throw new Error(`${what} failed: ${res.status} ${await res.text()}`);
    }
    return res.json();
}

export async function registerUser(account: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
}): Promise<SeededUser> {
    const res = await fetch(`${baseUrl()}/auth/register`, {
        method: 'POST',
        headers: headers({ 'content-type': 'application/json' }),
        body: JSON.stringify({
            email: account.email,
            password: account.password,
            first_name: account.firstName,
            last_name: account.lastName,
        }),
    });
    const body = (await expectOk(res, 'register')) as { access_token: string };
    return { email: account.email, password: account.password, accessToken: body.access_token };
}

export async function createOrg(
    user: SeededUser,
    org: { orgName: string; orgCode: string }
): Promise<SeededOrg> {
    const res = await fetch(`${baseUrl()}/org/`, {
        method: 'POST',
        headers: headers({
            'content-type': 'application/json',
            authorization: `Bearer ${user.accessToken}`,
        }),
        body: JSON.stringify({ org_name: org.orgName, org_code: org.orgCode }),
    });
    const body = (await expectOk(res, 'create org')) as { id: string };
    return { id: body.id, orgCode: org.orgCode, accessToken: user.accessToken };
}

/** Log in against the API to obtain an org-scoped token pair. */
export async function loginForTokens(
    email: string,
    password: string,
    orgCode: string
): Promise<{ access_token: string; refresh_token: string }> {
    const form = new URLSearchParams({ username: email, password, org_code: orgCode });
    const res = await fetch(`${baseUrl()}/auth/login`, {
        method: 'POST',
        headers: headers({ 'content-type': 'application/x-www-form-urlencoded' }),
        body: form.toString(),
    });
    return (await expectOk(res, 'login')) as { access_token: string; refresh_token: string };
}

/** Register a user and an organization in one step. */
export async function seedAccountWithOrg(account: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    orgName: string;
    orgCode: string;
}): Promise<SeededOrg> {
    const user = await registerUser(account);
    return createOrg(user, account);
}
