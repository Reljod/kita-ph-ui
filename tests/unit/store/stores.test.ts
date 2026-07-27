/**
 * Tests for the zustand stores.
 *
 * `useAuthStore` is the only place cookies are written, and every request the
 * app makes depends on what it puts there. Its logout also navigates, which
 * makes it the one store with a side effect outside React.
 */

import Cookies from 'js-cookie';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useAuthStore } from '@/store/useAuthStore';
import { useSidebarStore } from '@/store/useSidebarStore';

const A_USER = {
    id: 'user_1',
    email: 'someone@example.com',
    name: 'Someone',
    org_id: 'org_1',
};

/** jsdom refuses real navigation; capture the assignment instead. */
function captureNavigation() {
    const navigated: string[] = [];
    Object.defineProperty(window, 'location', {
        configurable: true,
        value: {
            ...window.location,
            get href() {
                return navigated.at(-1) ?? '';
            },
            set href(value: string) {
                navigated.push(value);
            },
        },
    });
    return navigated;
}

describe('useAuthStore', () => {
    beforeEach(() => {
        useAuthStore.setState({ user: null, isAuthenticated: false, isLoading: true });
    });

    afterEach(() => {
        Cookies.remove('token');
        Cookies.remove('refreshToken');
    });

    describe('initial state', () => {
        it('starts unauthenticated', () => {
            expect(useAuthStore.getState().isAuthenticated).toBe(false);
        });

        it('starts loading', () => {
            // The layout renders a spinner until checkAuth settles; starting
            // at false would flash the login page for an authenticated user.
            expect(useAuthStore.getState().isLoading).toBe(true);
        });

        it('starts with no user', () => {
            expect(useAuthStore.getState().user).toBeNull();
        });
    });

    describe('login', () => {
        it('stores the user', () => {
            useAuthStore.getState().login(A_USER, 'tok', 'refresh');
            expect(useAuthStore.getState().user).toEqual(A_USER);
        });

        it('marks the session authenticated', () => {
            useAuthStore.getState().login(A_USER, 'tok', 'refresh');
            expect(useAuthStore.getState().isAuthenticated).toBe(true);
        });

        it('stops loading', () => {
            useAuthStore.getState().login(A_USER, 'tok', 'refresh');
            expect(useAuthStore.getState().isLoading).toBe(false);
        });

        it('writes the access token to a cookie', () => {
            // The middleware reads this cookie, so a token kept only in memory
            // would be lost on the next navigation.
            useAuthStore.getState().login(A_USER, 'tok', 'refresh');
            expect(Cookies.get('token')).toBe('tok');
        });

        it('writes the refresh token to a cookie', () => {
            useAuthStore.getState().login(A_USER, 'tok', 'refresh');
            expect(Cookies.get('refreshToken')).toBe('refresh');
        });
    });

    describe('logout', () => {
        // Every logout assigns window.location.href; without the stub jsdom
        // logs "Not implemented: navigation" for each one.
        let navigated: string[];
        beforeEach(() => {
            navigated = captureNavigation();
        });

        it('clears the user', () => {
            useAuthStore.getState().login(A_USER, 'tok', 'refresh');
            useAuthStore.getState().logout();
            expect(useAuthStore.getState().user).toBeNull();
        });

        it('marks the session unauthenticated', () => {
            useAuthStore.getState().login(A_USER, 'tok', 'refresh');
            useAuthStore.getState().logout();
            expect(useAuthStore.getState().isAuthenticated).toBe(false);
        });

        it('removes both cookies', () => {
            // Leaving either behind would let the middleware wave the next
            // navigation straight past the login page.
            useAuthStore.getState().login(A_USER, 'tok', 'refresh');
            useAuthStore.getState().logout();
            expect(Cookies.get('token')).toBeUndefined();
            expect(Cookies.get('refreshToken')).toBeUndefined();
        });

        it('sends the browser to the login page', () => {
            useAuthStore.getState().logout();
            expect(navigated).toContain('/login');
        });

        it('is safe to call when already logged out', () => {
            expect(() => useAuthStore.getState().logout()).not.toThrow();
        });
    });

    describe('checkAuth', () => {
        it('authenticates when a token is present', () => {
            Cookies.set('token', 'tok');
            useAuthStore.getState().checkAuth();
            expect(useAuthStore.getState().isAuthenticated).toBe(true);
        });

        it('does not authenticate without a token', () => {
            useAuthStore.getState().checkAuth();
            expect(useAuthStore.getState().isAuthenticated).toBe(false);
        });

        it('stops loading either way', () => {
            useAuthStore.getState().checkAuth();
            expect(useAuthStore.getState().isLoading).toBe(false);
        });

        it('does not invent a user from a bare cookie', () => {
            // The cookie proves a session, not an identity; the profile has
            // to come from the API.
            Cookies.set('token', 'tok');
            useAuthStore.getState().checkAuth();
            expect(useAuthStore.getState().user).toBeNull();
        });
    });
});

describe('useSidebarStore', () => {
    beforeEach(() => {
        useSidebarStore.setState({ isOpen: false });
    });

    it('starts closed', () => {
        expect(useSidebarStore.getState().isOpen).toBe(false);
    });

    it('opens', () => {
        useSidebarStore.getState().open();
        expect(useSidebarStore.getState().isOpen).toBe(true);
    });

    it('closes', () => {
        useSidebarStore.getState().open();
        useSidebarStore.getState().close();
        expect(useSidebarStore.getState().isOpen).toBe(false);
    });

    it('toggles from closed to open', () => {
        useSidebarStore.getState().toggle();
        expect(useSidebarStore.getState().isOpen).toBe(true);
    });

    it('toggles from open to closed', () => {
        useSidebarStore.getState().open();
        useSidebarStore.getState().toggle();
        expect(useSidebarStore.getState().isOpen).toBe(false);
    });

    it('opening twice leaves it open', () => {
        useSidebarStore.getState().open();
        useSidebarStore.getState().open();
        expect(useSidebarStore.getState().isOpen).toBe(true);
    });

    it('notifies subscribers', () => {
        const listener = vi.fn();
        const unsubscribe = useSidebarStore.subscribe(listener);
        useSidebarStore.getState().toggle();
        expect(listener).toHaveBeenCalled();
        unsubscribe();
    });
});
