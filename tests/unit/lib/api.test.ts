import axios from 'axios';
import Cookies from 'js-cookie';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The auth store is a module-level singleton; stub it before importing the
// api module so the interceptor closes over the stub.
const logout = vi.fn();
vi.mock('@/store/useAuthStore', () => ({
    useAuthStore: { getState: () => ({ logout }) },
}));

vi.mock('uuid', () => ({ v4: () => 'fixed-uuid' }));

const { api } = await import('@/lib/api');

type Interceptor<T> = { fulfilled: (v: T) => unknown; rejected: (e: unknown) => unknown };

/** Reach into the axios instance for the handlers we registered. */
function requestInterceptor(): Interceptor<Record<string, unknown>> {
    // @ts-expect-error -- axios does not type its internal handler list
    return api.interceptors.request.handlers[0];
}
function responseInterceptor(): Interceptor<unknown> {
    // @ts-expect-error -- axios does not type its internal handler list
    return api.interceptors.response.handlers[0];
}

function unauthorized(url = '/agents', extra: Record<string, unknown> = {}) {
    return {
        config: { url, headers: {}, ...extra },
        response: { status: 401 },
    };
}

beforeEach(() => {
    logout.mockClear();
    Cookies.remove('token');
    Cookies.remove('refreshToken');
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe('api instance', () => {
    it('uses the public API url as its base', () => {
        expect(api.defaults.baseURL).toBe('/api');
    });

    it('sends JSON by default', () => {
        expect(api.defaults.headers['Content-Type']).toBe('application/json');
    });
});

describe('request interceptor', () => {
    it('attaches the bearer token when a cookie is present', () => {
        Cookies.set('token', 'tok-123');
        const config = requestInterceptor().fulfilled({ headers: {} }) as {
            headers: Record<string, string>;
        };
        expect(config.headers.Authorization).toBe('Bearer tok-123');
    });

    it('omits the header when there is no token', () => {
        const config = requestInterceptor().fulfilled({ headers: {} }) as {
            headers: Record<string, string>;
        };
        expect(config.headers.Authorization).toBeUndefined();
    });

    it('generates correlation headers', () => {
        const config = requestInterceptor().fulfilled({ headers: {} }) as {
            headers: Record<string, string>;
        };
        expect(config.headers['x-request-id']).toBe('fixed-uuid');
        expect(config.headers['x-trace-id']).toBe('fixed-uuid');
    });

    it('does not overwrite correlation headers the caller already set', () => {
        const config = requestInterceptor().fulfilled({
            headers: { 'x-request-id': 'caller-req', 'x-trace-id': 'caller-trace' },
        }) as { headers: Record<string, string> };
        expect(config.headers['x-request-id']).toBe('caller-req');
        expect(config.headers['x-trace-id']).toBe('caller-trace');
    });

    it('rejects transport failures untouched', async () => {
        const boom = new Error('offline');
        await expect(requestInterceptor().rejected(boom)).rejects.toBe(boom);
    });
});

describe('response interceptor', () => {
    it('passes successful responses straight through', () => {
        const response = { status: 200, data: { ok: true } };
        expect(responseInterceptor().fulfilled(response)).toBe(response);
    });

    it('rejects a non-401 error without touching auth state', async () => {
        const err = { config: { url: '/agents', headers: {} }, response: { status: 500 } };
        await expect(responseInterceptor().rejected(err)).rejects.toBe(err);
        expect(logout).not.toHaveBeenCalled();
    });

    it.each(['/auth/login', '/auth/register', '/auth/refresh'])(
        'does not attempt a refresh for a 401 from %s',
        async (url) => {
            Cookies.set('refreshToken', 'refresh-1');
            const err = unauthorized(url);
            await expect(responseInterceptor().rejected(err)).rejects.toBe(err);
            expect(logout).not.toHaveBeenCalled();
        }
    );

    it('does not retry a request that already retried once', async () => {
        Cookies.set('refreshToken', 'refresh-1');
        const err = unauthorized('/agents', { _retry: true });
        await expect(responseInterceptor().rejected(err)).rejects.toBe(err);
    });

    describe('successful token refresh', () => {
        /** Replace the transport so the replayed request never hits jsdom's XHR. */
        function stubTransport() {
            const adapter = vi.fn(async (config) => ({
                data: 'replayed',
                status: 200,
                statusText: 'OK',
                headers: {},
                config,
            }));
            api.defaults.adapter = adapter as never;
            return adapter;
        }

        afterEach(() => {
            delete (api.defaults as { adapter?: unknown }).adapter;
        });

        it('stores the refreshed pair', async () => {
            stubTransport();
            Cookies.set('refreshToken', 'refresh-1');
            vi.spyOn(axios, 'post').mockResolvedValue({
                data: { access_token: 'new-access', refresh_token: 'new-refresh' },
            });

            await responseInterceptor().rejected(unauthorized());

            expect(Cookies.get('token')).toBe('new-access');
            expect(Cookies.get('refreshToken')).toBe('new-refresh');
        });

        it('replays the original request and returns its response', async () => {
            const adapter = stubTransport();
            Cookies.set('refreshToken', 'refresh-1');
            vi.spyOn(axios, 'post').mockResolvedValue({
                data: { access_token: 'new-access', refresh_token: 'new-refresh' },
            });

            const result = (await responseInterceptor().rejected(unauthorized())) as {
                data: string;
            };

            expect(adapter).toHaveBeenCalledTimes(1);
            expect(result.data).toBe('replayed');
        });

        it('replays with the refreshed bearer token', async () => {
            const adapter = stubTransport();
            Cookies.set('refreshToken', 'refresh-1');
            vi.spyOn(axios, 'post').mockResolvedValue({
                data: { access_token: 'new-access', refresh_token: 'new-refresh' },
            });

            await responseInterceptor().rejected(unauthorized());

            const replayed = adapter.mock.calls[0][0] as { headers: Record<string, string> };
            expect(replayed.headers.Authorization).toBe('Bearer new-access');
        });

        it('sends the refresh token to the refresh endpoint', async () => {
            stubTransport();
            Cookies.set('refreshToken', 'refresh-1');
            const post = vi.spyOn(axios, 'post').mockResolvedValue({
                data: { access_token: 'a', refresh_token: 'r' },
            });
            await responseInterceptor().rejected(unauthorized());
            expect(post.mock.calls[0][0]).toContain('refresh_token=refresh-1');
        });

        it('marks the request so a second 401 cannot loop', async () => {
            const adapter = stubTransport();
            Cookies.set('refreshToken', 'refresh-1');
            vi.spyOn(axios, 'post').mockResolvedValue({
                data: { access_token: 'a', refresh_token: 'r' },
            });
            await responseInterceptor().rejected(unauthorized());
            const replayed = adapter.mock.calls[0][0] as { _retry?: boolean };
            expect(replayed._retry).toBe(true);
        });
    });

    describe('failed token refresh', () => {
        it('logs the user out', async () => {
            Cookies.set('refreshToken', 'refresh-1');
            vi.spyOn(axios, 'post').mockRejectedValue(new Error('refresh rejected'));
            vi.spyOn(console, 'error').mockImplementation(() => {});
            await responseInterceptor()
                .rejected(unauthorized())
                .catch(() => {});
            expect(logout).toHaveBeenCalledTimes(1);
        });

        it('rejects rather than resolving with undefined', async () => {
            // Resolving here makes `await api.get(...)` hand the caller
            // `undefined`, so the very next `.data` access throws a
            // TypeError far from the real cause — the auth failure is
            // swallowed instead of surfacing.
            Cookies.set('refreshToken', 'refresh-1');
            vi.spyOn(axios, 'post').mockRejectedValue(new Error('refresh rejected'));
            vi.spyOn(console, 'error').mockImplementation(() => {});
            await expect(responseInterceptor().rejected(unauthorized())).rejects.toBeDefined();
        });
    });

    describe('no refresh token available', () => {
        it('logs the user out', async () => {
            await responseInterceptor()
                .rejected(unauthorized())
                .catch(() => {});
            expect(logout).toHaveBeenCalledTimes(1);
        });

        it('rejects rather than resolving with undefined', async () => {
            await expect(responseInterceptor().rejected(unauthorized())).rejects.toBeDefined();
        });
    });
});
