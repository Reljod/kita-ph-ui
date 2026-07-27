import '@testing-library/jest-dom/vitest';
import { cleanup, configure } from '@testing-library/react';
import { afterEach, beforeEach, vi } from 'vitest';

// Public env the app reads at module scope. Pinned here so a unit run does not
// depend on whichever Doppler config happens to be exported.
process.env.NEXT_PUBLIC_API_URL = '/api';
process.env.NEXT_PUBLIC_BACKEND_URL = 'http://localhost:8080';

// The page suites settle over two query cycles — the agent list lands,
// which selects an agent, which re-keys the memories query. Under a full
// file that lands just past the 1s default, so findBy* times out on a
// render that was going to succeed.
configure({ asyncUtilTimeout: 5000 });

// jsdom implements neither of these, and Radix/shadcn components call both.
globalThis.ResizeObserver =
    globalThis.ResizeObserver ??
    class {
        observe() {}
        unobserve() {}
        disconnect() {}
    };

if (!window.matchMedia) {
    window.matchMedia = ((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
    })) as typeof window.matchMedia;
}

// Radix uses these for focus management inside portals.
if (!Element.prototype.hasPointerCapture) {
    Element.prototype.hasPointerCapture = () => false;
    Element.prototype.setPointerCapture = () => {};
    Element.prototype.releasePointerCapture = () => {};
}
if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = () => {};
}

beforeEach(() => {
    // Cookies are shared mutable state across tests; wipe them between cases.
    document.cookie.split(';').forEach((c) => {
        const name = c.split('=')[0].trim();
        if (name) document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
    });
});

afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    vi.restoreAllMocks();
});
