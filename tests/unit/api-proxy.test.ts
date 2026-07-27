/**
 * Tests for the /api/[...path] proxy route.
 *
 * This is where the Kita API credentials live. They are read from the server's
 * own environment and injected here so they never reach the browser, which
 * makes two things worth pinning hard: that they are always attached, and that
 * a client cannot talk the proxy into using its own.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DELETE, GET, HEAD, OPTIONS, PATCH, POST, PUT } from '@/app/api/[...path]/route';

const BACKEND = 'https://api.example.test';

function aRequest(
    path: string,
    { method = 'GET', headers = {}, body }: {
        method?: string;
        headers?: Record<string, string>;
        body?: string;
    } = {}
) {
    const url = new URL(path, 'https://app.kita.ph');
    return {
        nextUrl: url,
        url: url.toString(),
        method,
        headers: new Headers(headers),
        arrayBuffer: async () => new TextEncoder().encode(body ?? '').buffer,
    } as unknown as Parameters<typeof GET>[0];
}

function lastFetch() {
    const [target, options] = vi.mocked(globalThis.fetch).mock.calls.at(-1)!;
    return { target: String(target), options: options as RequestInit };
}

function sentHeaders(): Headers {
    return lastFetch().options.headers as Headers;
}

beforeEach(() => {
    process.env.KITA_BACKEND_URL = BACKEND;
    process.env.KITA_API_KEY = 'server-side-key';
    process.env.KITA_CLIENT_ID = 'server-side-client';
    vi.stubGlobal(
        'fetch',
        vi.fn(async () => new Response('{}', { status: 200, statusText: 'OK' }))
    );
});

describe('the API proxy', () => {
    describe('credentials', () => {
        it('attaches the server-side api key', () => {
            // The browser never sees this value; if the proxy stopped adding
            // it every request would come back 401.
            return GET(aRequest('/api/agents')).then(() => {
                expect(sentHeaders().get('x-api-key')).toBe('server-side-key');
            });
        });

        it('attaches the server-side client id', async () => {
            await GET(aRequest('/api/agents'));
            expect(sentHeaders().get('x-client-id')).toBe('server-side-client');
        });

        it('overrides a client-supplied api key', async () => {
            // Otherwise the browser could pick which client it authenticates
            // as, which is the whole thing this proxy exists to prevent.
            await GET(aRequest('/api/agents', { headers: { 'x-api-key': 'forged' } }));
            expect(sentHeaders().get('x-api-key')).toBe('server-side-key');
        });

        it('overrides a client-supplied client id', async () => {
            await GET(
                aRequest('/api/agents', { headers: { 'x-client-id': 'forged' } })
            );
            expect(sentHeaders().get('x-client-id')).toBe('server-side-client');
        });

        it('sends empty credentials rather than the literal undefined', async () => {
            delete process.env.KITA_API_KEY;
            await GET(aRequest('/api/agents'));
            expect(sentHeaders().get('x-api-key')).toBe('');
        });
    });

    describe('routing', () => {
        it('strips the /api prefix', async () => {
            await GET(aRequest('/api/agents'));
            expect(lastFetch().target).toBe(`${BACKEND}/agents`);
        });

        it('keeps the rest of the path', async () => {
            await GET(aRequest('/api/agents/a1/chat'));
            expect(lastFetch().target).toBe(`${BACKEND}/agents/a1/chat`);
        });

        it('keeps the query string', async () => {
            await GET(aRequest('/api/files?agent_id=a1'));
            expect(lastFetch().target).toBe(`${BACKEND}/files?agent_id=a1`);
        });

        it('only strips the leading prefix', async () => {
            // A path segment that happens to be called "api" is data, not a
            // prefix to remove.
            await GET(aRequest('/api/tools/api/x'));
            expect(lastFetch().target).toBe(`${BACKEND}/tools/api/x`);
        });

        it('falls back to a local backend', async () => {
            delete process.env.KITA_BACKEND_URL;
            await GET(aRequest('/api/agents'));
            expect(lastFetch().target).toContain('localhost:8080');
        });

        it('follows redirects internally', async () => {
            // The API redirects on trailing slashes; surfacing that to the
            // browser would turn one call into two and drop the credentials
            // on the second.
            await GET(aRequest('/api/org'));
            expect(lastFetch().options.redirect).toBe('follow');
        });
    });

    describe('correlation', () => {
        it('generates a request id when the client sends none', async () => {
            await GET(aRequest('/api/agents'));
            expect(sentHeaders().get('x-request-id')).toBeTruthy();
        });

        it('generates a trace id when the client sends none', async () => {
            await GET(aRequest('/api/agents'));
            expect(sentHeaders().get('x-trace-id')).toBeTruthy();
        });

        it('keeps a client-supplied request id', async () => {
            // The browser uses it to tie a console error to a server log line.
            await GET(
                aRequest('/api/agents', { headers: { 'x-request-id': 'from-client' } })
            );
            expect(sentHeaders().get('x-request-id')).toBe('from-client');
        });

        it('keeps a client-supplied trace id', async () => {
            await GET(
                aRequest('/api/agents', { headers: { 'x-trace-id': 'trace-1' } })
            );
            expect(sentHeaders().get('x-trace-id')).toBe('trace-1');
        });
    });

    describe('header forwarding', () => {
        it('passes the authorization header through', async () => {
            await GET(
                aRequest('/api/agents', { headers: { authorization: 'Bearer tok' } })
            );
            expect(sentHeaders().get('authorization')).toBe('Bearer tok');
        });

        it('passes the agent scope through', async () => {
            await GET(
                aRequest('/api/memory', { headers: { 'x-agent-id': 'agent_1' } })
            );
            expect(sentHeaders().get('x-agent-id')).toBe('agent_1');
        });

        it('drops the host header', async () => {
            // Forwarding the app's host would make the API generate links back
            // to the proxy rather than to itself.
            await GET(aRequest('/api/agents', { headers: { host: 'app.kita.ph' } }));
            expect(sentHeaders().get('host')).toBeNull();
        });

        it('drops the connection header', async () => {
            await GET(
                aRequest('/api/agents', { headers: { connection: 'keep-alive' } })
            );
            expect(sentHeaders().get('connection')).toBeNull();
        });
    });

    describe('bodies', () => {
        it('forwards a POST body', async () => {
            await POST(aRequest('/api/agents', { method: 'POST', body: '{"a":1}' }));
            expect(lastFetch().options.body).toBeDefined();
        });

        it('sends no body on a GET', async () => {
            // fetch rejects a GET carrying one.
            await GET(aRequest('/api/agents'));
            expect(lastFetch().options.body).toBeUndefined();
        });

        it('sends no body on a HEAD', async () => {
            await HEAD(aRequest('/api/agents', { method: 'HEAD' }));
            expect(lastFetch().options.body).toBeUndefined();
        });
    });

    describe('responses', () => {
        it('passes the status through', async () => {
            vi.mocked(globalThis.fetch).mockResolvedValue(
                new Response('{}', { status: 404 })
            );
            expect((await GET(aRequest('/api/agents'))).status).toBe(404);
        });

        it('passes an error status through rather than masking it', async () => {
            vi.mocked(globalThis.fetch).mockResolvedValue(
                new Response('{}', { status: 401 })
            );
            expect((await GET(aRequest('/api/agents'))).status).toBe(401);
        });

        it('passes response headers through', async () => {
            vi.mocked(globalThis.fetch).mockResolvedValue(
                new Response('{}', { headers: { 'x-request-id': 'req-1' } })
            );
            const response = await GET(aRequest('/api/agents'));
            expect(response.headers.get('x-request-id')).toBe('req-1');
        });

        it('drops the content encoding header', async () => {
            // fetch has already decoded the body; claiming it is still gzipped
            // makes the browser fail to parse it.
            vi.mocked(globalThis.fetch).mockResolvedValue(
                new Response('{}', { headers: { 'content-encoding': 'gzip' } })
            );
            const response = await GET(aRequest('/api/agents'));
            expect(response.headers.get('content-encoding')).toBeNull();
        });

        it('reports an unreachable backend as a gateway error', async () => {
            // A 500 would blame the app for the API being down.
            vi.mocked(globalThis.fetch).mockRejectedValue(new Error('ECONNREFUSED'));
            vi.spyOn(console, 'error').mockImplementation(() => {});
            expect((await GET(aRequest('/api/agents'))).status).toBe(502);
        });
    });

    describe('methods', () => {
        it.each([
            ['GET', GET],
            ['POST', POST],
            ['PUT', PUT],
            ['DELETE', DELETE],
            ['PATCH', PATCH],
            ['OPTIONS', OPTIONS],
            ['HEAD', HEAD],
        ])('%s is proxied', async (method, handler) => {
            await handler(aRequest('/api/agents', { method }));
            expect(lastFetch().options.method).toBe(method);
        });
    });
});
