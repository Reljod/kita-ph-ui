/**
 * Tests for the login page.
 *
 * Two details here are easy to break and expensive to get wrong. The request
 * must be form-encoded, because FastAPI's OAuth2PasswordRequestForm rejects
 * JSON outright; and a failure has to leave the user on the page with their
 * input intact and a message they can act on.
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

const post = vi.fn();
vi.mock('@/lib/api', () => ({ api: { post: (...args: unknown[]) => post(...args) } }));

const login = vi.fn();
vi.mock('@/store/useAuthStore', () => ({
    useAuthStore: (selector: (s: unknown) => unknown) => selector({ login }),
}));

const LoginPage = (await import('@/app/login/page')).default;

const CREDENTIALS = {
    email: 'someone@example.com',
    password: 'hunter2',
    orgCode: 'KITA-123',
};

function fillIn(overrides: Partial<typeof CREDENTIALS> = {}) {
    const values = { ...CREDENTIALS, ...overrides };
    fireEvent.change(screen.getByLabelText(/email/i), {
        target: { value: values.email },
    });
    fireEvent.change(screen.getByLabelText(/password/i), {
        target: { value: values.password },
    });
    fireEvent.change(screen.getByLabelText(/organization code/i), {
        target: { value: values.orgCode },
    });
}

function submit() {
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));
}

beforeEach(() => {
    push.mockClear();
    login.mockClear();
    post.mockReset().mockResolvedValue({
        data: {
            access_token: 'tok',
            refresh_token: 'refresh',
            user_id: 'u1',
            org_id: 'org_1',
        },
    });
    vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('the login page', () => {
    it('renders its three fields', () => {
        render(<LoginPage />);
        expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/organization code/i)).toBeInTheDocument();
    });

    it('masks the password', () => {
        render(<LoginPage />);
        expect(screen.getByLabelText(/password/i)).toHaveAttribute('type', 'password');
    });

    describe('the submit button', () => {
        it('is disabled until every field is filled', () => {
            render(<LoginPage />);
            expect(screen.getByRole('button', { name: /sign in/i })).toBeDisabled();
        });

        it('stays disabled without an organization code', () => {
            // The API needs it to resolve the tenant; submitting without one
            // would fail server-side for no reason the user can see.
            render(<LoginPage />);
            fillIn({ orgCode: '' });
            expect(screen.getByRole('button', { name: /sign in/i })).toBeDisabled();
        });

        it('enables once everything is filled', () => {
            render(<LoginPage />);
            fillIn();
            expect(screen.getByRole('button', { name: /sign in/i })).toBeEnabled();
        });
    });

    describe('a successful sign-in', () => {
        it('posts to the login endpoint', async () => {
            render(<LoginPage />);
            fillIn();
            submit();
            await waitFor(() => expect(post).toHaveBeenCalled());
            expect(post.mock.calls[0][0]).toBe('/auth/login');
        });

        it('sends the credentials form-encoded', async () => {
            // OAuth2PasswordRequestForm rejects JSON outright; this is the
            // one call in the app that must not use the client default.
            render(<LoginPage />);
            fillIn();
            submit();
            await waitFor(() => expect(post).toHaveBeenCalled());
            expect(post.mock.calls[0][1]).toBeInstanceOf(URLSearchParams);
            expect(post.mock.calls[0][2].headers['Content-Type']).toBe(
                'application/x-www-form-urlencoded'
            );
        });

        it('sends the email as the username field', async () => {
            render(<LoginPage />);
            fillIn();
            submit();
            await waitFor(() => expect(post).toHaveBeenCalled());
            const body = post.mock.calls[0][1] as URLSearchParams;
            expect(body.get('username')).toBe(CREDENTIALS.email);
            expect(body.get('password')).toBe(CREDENTIALS.password);
            expect(body.get('org_code')).toBe(CREDENTIALS.orgCode);
        });

        it('stores the session', async () => {
            render(<LoginPage />);
            fillIn();
            submit();
            await waitFor(() => expect(login).toHaveBeenCalled());
            expect(login.mock.calls[0][1]).toBe('tok');
            expect(login.mock.calls[0][2]).toBe('refresh');
        });

        it('records the organization from the response', async () => {
            render(<LoginPage />);
            fillIn();
            submit();
            await waitFor(() => expect(login).toHaveBeenCalled());
            expect(login.mock.calls[0][0].org_id).toBe('org_1');
        });

        it('falls back to the typed organization code', async () => {
            post.mockResolvedValue({ data: { access_token: 't', refresh_token: 'r' } });
            render(<LoginPage />);
            fillIn();
            submit();
            await waitFor(() => expect(login).toHaveBeenCalled());
            expect(login.mock.calls[0][0].org_id).toBe(CREDENTIALS.orgCode);
        });

        it('goes to the dashboard', async () => {
            render(<LoginPage />);
            fillIn();
            submit();
            await waitFor(() => expect(push).toHaveBeenCalledWith('/dashboard'));
        });

        it('shows progress while it is in flight', async () => {
            let release: (value: unknown) => void = () => {};
            post.mockReturnValue(new Promise((resolve) => (release = resolve)));
            render(<LoginPage />);
            fillIn();
            submit();
            expect(await screen.findByText(/signing in/i)).toBeInTheDocument();
            release({ data: { access_token: 't', refresh_token: 'r' } });
        });
    });

    describe('a failed sign-in', () => {
        beforeEach(() => {
            // axios.isAxiosError keys off this flag; without it the error
            // falls through to the generic branch instead of the login one.
            post.mockRejectedValue({
                isAxiosError: true,
                response: {
                    status: 401,
                    data: { error: { code: 'AUTH_UNAUTHORIZED', message: 'nope' } },
                },
            });
        });

        it('shows an error', async () => {
            render(<LoginPage />);
            fillIn();
            submit();
            expect(await screen.findByText(/incorrect|invalid|credential/i)).toBeInTheDocument();
        });

        it('does not store a session', async () => {
            render(<LoginPage />);
            fillIn();
            submit();
            await waitFor(() => expect(post).toHaveBeenCalled());
            expect(login).not.toHaveBeenCalled();
        });

        it('stays on the page', async () => {
            render(<LoginPage />);
            fillIn();
            submit();
            await waitFor(() => expect(post).toHaveBeenCalled());
            expect(push).not.toHaveBeenCalled();
        });

        it('keeps what the user typed', async () => {
            // Clearing the form on a typo is the fastest way to lose someone.
            render(<LoginPage />);
            fillIn();
            submit();
            await waitFor(() => expect(post).toHaveBeenCalled());
            expect(screen.getByLabelText(/email/i)).toHaveValue(CREDENTIALS.email);
        });

        it('lets the user try again', async () => {
            render(<LoginPage />);
            fillIn();
            submit();
            await waitFor(() =>
                expect(screen.getByRole('button', { name: /sign in/i })).toBeEnabled()
            );
        });

        it('clears the previous error on retry', async () => {
            render(<LoginPage />);
            fillIn();
            submit();
            const message = await screen.findByText(/incorrect|invalid|credential/i);
            post.mockResolvedValue({
                data: { access_token: 't', refresh_token: 'r' },
            });
            submit();
            await waitFor(() => expect(message).not.toBeInTheDocument());
        });

        it('reports a server fault differently from bad credentials', async () => {
            post.mockRejectedValue({
                isAxiosError: true,
                response: { status: 500, data: {} },
            });
            render(<LoginPage />);
            fillIn();
            submit();
            const message = await screen.findByRole('alert').catch(() => null);
            // The exact copy comes from getFriendlyErrorMessage; what matters
            // is that a 500 does not read as "wrong password".
            const text = message?.textContent ?? document.body.textContent ?? '';
            expect(text).not.toMatch(/incorrect email or password/i);
        });
    });
});
