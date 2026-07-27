import { AxiosError, AxiosHeaders } from 'axios';
import { describe, expect, it } from 'vitest';

import { getFriendlyErrorMessage } from '@/lib/error';

/** Build an AxiosError carrying the given response body/status. */
function axiosError(data: unknown, status = 400): AxiosError {
    const err = new AxiosError('Request failed');
    err.response = {
        data,
        status,
        statusText: '',
        headers: {},
        config: { headers: new AxiosHeaders() },
    } as AxiosError['response'];
    return err;
}

describe('getFriendlyErrorMessage', () => {
    describe('empty input', () => {
        it.each([null, undefined, 0, '', false])('returns the unknown fallback for %p', (input) => {
            expect(getFriendlyErrorMessage(input)).toBe('An unknown error occurred.');
        });
    });

    describe('structured API errors', () => {
        it('maps an expired session to a re-login prompt', () => {
            const err = axiosError({ error: { code: 'AUTH_SESSION_EXPIRED' } }, 401);
            expect(getFriendlyErrorMessage(err)).toBe(
                'Your session has expired. Please log in again.'
            );
        });

        it('maps unauthorized to an authentication prompt', () => {
            const err = axiosError({ error: { code: 'AUTH_UNAUTHORIZED' } }, 401);
            expect(getFriendlyErrorMessage(err)).toBe(
                'Authentication required. Please log in again.'
            );
        });

        it('maps forbidden to an access-denied message', () => {
            const err = axiosError({ error: { code: 'AUTH_FORBIDDEN' } }, 403);
            expect(getFriendlyErrorMessage(err)).toContain('Access denied');
        });

        it('maps not-found to a resource message', () => {
            const err = axiosError({ error: { code: 'RESOURCE_NOT_FOUND' } }, 404);
            expect(getFriendlyErrorMessage(err)).toBe(
                'The requested resource could not be found.'
            );
        });

        it('maps a validation error to an input-check message', () => {
            const err = axiosError({ error: { code: 'SYSTEM_VALIDATION_ERROR' } }, 422);
            expect(getFriendlyErrorMessage(err)).toContain('inputs are invalid');
        });

        it.each(['SYSTEM_INTERNAL_ERROR', 'SYSTEM_DATABASE_ERROR', 'SYSTEM_REDIS_ERROR'])(
            'collapses %s into one generic server message',
            (code) => {
                const err = axiosError({ error: { code } }, 500);
                expect(getFriendlyErrorMessage(err)).toContain('unexpected database or server error');
            }
        );

        it('appends the trace id when the server supplies one', () => {
            const err = axiosError(
                { error: { code: 'SYSTEM_INTERNAL_ERROR', trace_id: 'trace-abc' } },
                500
            );
            expect(getFriendlyErrorMessage(err)).toContain('Trace ID: trace-abc');
        });

        it('omits the trace id when absent', () => {
            const err = axiosError({ error: { code: 'SYSTEM_INTERNAL_ERROR' } }, 500);
            expect(getFriendlyErrorMessage(err)).not.toContain('Trace ID');
        });

        it('passes through an unrecognised code with its message', () => {
            const err = axiosError({ error: { code: 'SOMETHING_NEW', message: 'Be more specific.' } });
            expect(getFriendlyErrorMessage(err)).toBe('Be more specific.');
        });
    });

    describe('status-only errors', () => {
        it.each([
            [401, 'Authentication required. Please log in again.'],
            [403, 'Access denied. You do not have permission to access this resource.'],
            [404, 'The requested resource could not be found.'],
        ])('derives a message from a bare %i', (status, expected) => {
            expect(getFriendlyErrorMessage(axiosError(undefined, status))).toBe(expected);
        });

        it('falls back to the generic message for an unmapped status', () => {
            expect(getFriendlyErrorMessage(axiosError(undefined, 418))).toContain(
                'An unexpected error occurred'
            );
        });
    });

    describe("FastAPI's plain detail shape", () => {
        it('surfaces the detail string', () => {
            expect(getFriendlyErrorMessage(axiosError({ detail: 'Agent name is taken.' }))).toBe(
                'Agent name is taken.'
            );
        });

        it('prefers the structured error over detail when both are present', () => {
            const err = axiosError({
                error: { code: 'AUTH_FORBIDDEN' },
                detail: 'raw detail that should not win',
            });
            expect(getFriendlyErrorMessage(err)).toContain('Access denied');
        });
    });

    describe('non-Axios errors', () => {
        it('uses the message of a plain Error', () => {
            expect(getFriendlyErrorMessage(new Error('Something broke'))).toBe('Something broke');
        });

        it('falls back for a non-Error, non-Axios value', () => {
            expect(getFriendlyErrorMessage({ weird: true })).toContain('An unexpected error occurred');
        });

        it('falls back for a thrown string', () => {
            expect(getFriendlyErrorMessage('a bare string')).toContain('An unexpected error occurred');
        });
    });

    describe('login context', () => {
        it.each([
            ['AUTH_UNAUTHORIZED'],
            ['AUTH_SESSION_EXPIRED'],
            ['RESOURCE_NOT_FOUND'],
        ])('gives the same ambiguous answer for %s', (code) => {
            const err = axiosError({ error: { code } });
            expect(getFriendlyErrorMessage(err, 'login')).toBe(
                'Incorrect email, password, or organization code.'
            );
        });

        it('does not reveal whether the organization code exists', () => {
            const err = axiosError({ error: { code: 'RESOURCE_NOT_FOUND' } }, 404);
            const message = getFriendlyErrorMessage(err, 'login');
            expect(message.toLowerCase()).not.toContain('organization code could not');
            expect(message).toBe('Incorrect email, password, or organization code.');
        });

        it.each(['Bad credential supplied', 'Wrong PASSWORD'])(
            'treats a credential-flavoured message (%s) as a login failure',
            (message) => {
                const err = axiosError({ error: { message } });
                expect(getFriendlyErrorMessage(err, 'login')).toBe(
                    'Incorrect email, password, or organization code.'
                );
            }
        );

        it('explains a membership problem distinctly', () => {
            const err = axiosError({ error: { code: 'AUTH_FORBIDDEN' } }, 403);
            expect(getFriendlyErrorMessage(err, 'login')).toContain('verify your membership');
        });
    });

    describe('internal-detail suppression', () => {
        it.each([
            'MongoServerError: E11000 duplicate key',
            'redis connection refused',
            'Connection reset by peer',
            'socket hang up',
            'Unhandled exception in worker',
            'File "x.py", line 42',
            'Traceback (most recent call last)',
        ])('never leaks %s to the user', (raw) => {
            const message = getFriendlyErrorMessage(axiosError({ detail: raw }));
            expect(message).toBe('A server connectivity issue occurred. Please try again later.');
        });

        it('attaches the trace id to a suppressed message so support can still find it', () => {
            const err = axiosError({
                error: { message: 'mongo timeout', trace_id: 'trace-xyz' },
            });
            expect(getFriendlyErrorMessage(err)).toContain('Trace ID: trace-xyz');
        });

        it('suppression is case-insensitive', () => {
            const message = getFriendlyErrorMessage(axiosError({ detail: 'MONGO went away' }));
            expect(message).toContain('server connectivity issue');
        });

        it('lets an ordinary message through untouched', () => {
            expect(getFriendlyErrorMessage(axiosError({ detail: 'Name must be unique.' }))).toBe(
                'Name must be unique.'
            );
        });
    });
});
