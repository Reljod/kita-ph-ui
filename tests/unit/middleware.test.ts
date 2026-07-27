/**
 * Tests for the route middleware.
 *
 * This is the only thing standing between an unauthenticated visitor and a
 * workspace page, and it runs before any component does. Its matcher is as
 * load-bearing as its logic: a pattern that accidentally covered /api would
 * bounce the proxy's own requests to the login page.
 */

import { describe, expect, it } from 'vitest';

import { config, middleware } from '@/middleware';

const ORIGIN = 'https://app.kita.ph';

function aRequest(path: string, { token }: { token?: string } = {}) {
    const url = new URL(path, ORIGIN);
    return {
        nextUrl: url,
        url: url.toString(),
        cookies: {
            get: (name: string) =>
                name === 'token' && token ? { name, value: token } : undefined,
        },
    } as unknown as Parameters<typeof middleware>[0];
}

function redirectTarget(response: ReturnType<typeof middleware>) {
    return new URL(response!.headers.get('location')!);
}

describe('middleware', () => {
    describe('an unauthenticated visitor', () => {
        it('is redirected away from a workspace page', () => {
            const response = middleware(aRequest('/dashboard'));
            expect(response?.status).toBe(307);
        });

        it('lands on the login page', () => {
            const response = middleware(aRequest('/dashboard'));
            expect(redirectTarget(response).pathname).toBe('/login');
        });

        it('keeps the page it was trying to reach', () => {
            // Without this the user logs in and lands on the dashboard,
            // having lost the link they actually followed.
            const response = middleware(aRequest('/agents/a1/chat'));
            expect(redirectTarget(response).searchParams.get('from')).toBe(
                '/agents/a1/chat'
            );
        });

        it('keeps the query string too', () => {
            const response = middleware(aRequest('/knowledge-base?tab=files'));
            expect(redirectTarget(response).searchParams.get('from')).toBe(
                '/knowledge-base?tab=files'
            );
        });

        it('encodes the deep link so it survives the round trip', () => {
            const response = middleware(aRequest('/memory?q=a%20b&x=1'));
            const location = response!.headers.get('location')!;
            expect(location).toContain('from=%2Fmemory%3Fq%3Da');
        });

        it('is allowed onto the login page', () => {
            expect(middleware(aRequest('/login'))).toBeNull();
        });
    });

    describe('an authenticated visitor', () => {
        it('passes through to a workspace page', () => {
            expect(middleware(aRequest('/dashboard', { token: 'tok' }))).toBeNull();
        });

        it('is bounced off the login page', () => {
            // Otherwise the app shows a login form to someone already in.
            const response = middleware(aRequest('/login', { token: 'tok' }));
            expect(redirectTarget(response).pathname).toBe('/dashboard');
        });

        it('is bounced off a login sub-path too', () => {
            const response = middleware(aRequest('/login/reset', { token: 'tok' }));
            expect(redirectTarget(response).pathname).toBe('/dashboard');
        });

        it('reaches the root', () => {
            expect(middleware(aRequest('/', { token: 'tok' }))).toBeNull();
        });
    });

    describe('the matcher', () => {
        // Next compiles matcher patterns as full-path matches. Anchoring here
        // reproduces that; left unanchored the regex can start matching partway
        // through, so "/api/agents" would appear to match via "/agents".
        const pattern = new RegExp(`^${config.matcher[0]}$`);

        it.each(['/dashboard', '/agents', '/memory', '/knowledge-base', '/tools'])(
            'guards %s',
            (path) => {
                expect(pattern.test(path)).toBe(true);
            }
        );

        it('leaves the API proxy alone', () => {
            // The proxy injects the server-side credentials; bouncing it to
            // the login page would break every request the app makes.
            expect(pattern.test('/api/agents')).toBe(false);
        });

        it.each([
            '/_next/static/chunk.js',
            '/_next/image',
            '/favicon.ico',
            '/sitemap.xml',
            '/robots.txt',
        ])('leaves %s alone', (path) => {
            expect(pattern.test(path)).toBe(false);
        });
    });
});
