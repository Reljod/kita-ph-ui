/**
 * Shared render helper for the page suites.
 *
 * Every page is a react-query consumer, so each needs a provider. The client
 * is rebuilt per render with retries off and no cache: a retrying query turns
 * an assertion about an error state into a five-second timeout, and a shared
 * cache leaks one test's fixtures into the next.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import type { ReactElement } from 'react';

export function makeQueryClient() {
    return new QueryClient({
        defaultOptions: {
            queries: { retry: false, gcTime: 0, staleTime: 0 },
            mutations: { retry: false },
        },
        // react-query logs every rejected query; the error paths here are
        // deliberate, so the noise is not worth reading past.
        logger: { log: () => {}, warn: () => {}, error: () => {} },
    } as never);
}

export function renderWithQuery(ui: ReactElement) {
    const client = makeQueryClient();
    const result = render(
        <QueryClientProvider client={client}>{ui}</QueryClientProvider>
    );
    return { ...result, client };
}
