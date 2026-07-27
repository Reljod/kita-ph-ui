/**
 * Tests for the tools registry page.
 *
 * Two queries drive it: the tool list, and the agents linked to whichever tool
 * is selected. The second is gated on a selection, and the gate is the part
 * worth pinning — without it the page fires `/tool/null/agents` on first paint.
 */

import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const get = vi.fn();
vi.mock('@/lib/api', () => ({ api: { get: (...args: unknown[]) => get(...args) } }));

vi.mock('next/link', () => ({
    default: ({ children, href, ...rest }: React.ComponentProps<'a'>) => (
        <a href={href} {...rest}>
            {children}
        </a>
    ),
}));

const { renderWithQuery } = await import('../support/render');
const ToolsPage = (await import('@/app/(main)/tools/page')).default;

const TOOLS = [
    { id: 't1', name: 'web_search', description: 'Search the public web.' },
    { id: 't2', name: 'memory_lookup', description: 'Read the memory vault.' },
    { id: 't3', name: 'python_exec', description: 'Run a code snippet.' },
    { id: 't4', name: 'agent_creator', description: 'Create another agent.' },
    { id: 't5', name: 'send_email', description: 'Deliver a message.' },
];

const AGENTS = [
    { id: 'a1', name: 'Scribe', role: 'writer' },
    { id: 'a2', name: 'Scout', role: 'researcher', avatar: 'https://img/scout.png' },
];

function respond({ tools = TOOLS, agents = AGENTS }: Record<string, unknown[]> = {}) {
    get.mockImplementation(async (url: string) => {
        if (url === '/tool') return { data: tools };
        if (url.endsWith('/agents')) return { data: agents };
        throw new Error(`unexpected GET ${url}`);
    });
}

beforeEach(() => {
    get.mockReset();
    respond();
});

async function renderPage() {
    const result = renderWithQuery(<ToolsPage />);
    await screen.findByText('web_search');
    return result;
}

describe('the tools page', () => {
    it('shows a loading state first', () => {
        renderWithQuery(<ToolsPage />);
        expect(screen.getByText(/loading tools/i)).toBeInTheDocument();
    });

    it('lists the registered tools', async () => {
        await renderPage();
        expect(screen.getByText('memory_lookup')).toBeInTheDocument();
    });

    it('shows each description', async () => {
        await renderPage();
        expect(screen.getByText('Search the public web.')).toBeInTheDocument();
    });

    it('says nothing is selected yet', async () => {
        await renderPage();
        expect(screen.getByText(/select a tool to see agents/i)).toBeInTheDocument();
    });

    it('does not ask for linked agents before a tool is picked', async () => {
        // The query is gated on `enabled`; without it this fires
        // /tool/null/agents on every page load.
        await renderPage();
        expect(get.mock.calls.every(([url]) => url === '/tool')).toBe(true);
    });

    describe('search', () => {
        it('filters by name', async () => {
            await renderPage();
            fireEvent.change(screen.getByPlaceholderText(/search tools/i), {
                target: { value: 'memory' },
            });
            expect(screen.queryByText('web_search')).not.toBeInTheDocument();
            expect(screen.getByText('memory_lookup')).toBeInTheDocument();
        });

        it('also matches the description', async () => {
            // Someone looking for "email" should find send_email by what it
            // does, not only by what it is called.
            await renderPage();
            fireEvent.change(screen.getByPlaceholderText(/search tools/i), {
                target: { value: 'deliver a message' },
            });
            expect(screen.getByText('send_email')).toBeInTheDocument();
        });

        it('ignores case', async () => {
            await renderPage();
            fireEvent.change(screen.getByPlaceholderText(/search tools/i), {
                target: { value: 'WEB_SEARCH' },
            });
            expect(screen.getByText('web_search')).toBeInTheDocument();
        });

        it('reports no match', async () => {
            await renderPage();
            fireEvent.change(screen.getByPlaceholderText(/search tools/i), {
                target: { value: 'zzz' },
            });
            expect(screen.getByText(/no tools found/i)).toBeInTheDocument();
        });

        it('restores the list when cleared', async () => {
            await renderPage();
            const search = screen.getByPlaceholderText(/search tools/i);
            fireEvent.change(search, { target: { value: 'zzz' } });
            fireEvent.change(search, { target: { value: '' } });
            expect(screen.getByText('web_search')).toBeInTheDocument();
        });
    });

    describe('selecting a tool', () => {
        it('fetches the agents linked to it', async () => {
            await renderPage();
            fireEvent.click(screen.getByText('web_search'));
            await waitFor(() =>
                expect(get).toHaveBeenCalledWith('/tool/t1/agents')
            );
        });

        it('lists them', async () => {
            await renderPage();
            fireEvent.click(screen.getByText('web_search'));
            expect(await screen.findByText('Scribe')).toBeInTheDocument();
        });

        it('shows each role', async () => {
            await renderPage();
            fireEvent.click(screen.getByText('web_search'));
            expect(await screen.findByText('researcher')).toBeInTheDocument();
        });

        it('links through to the agent', async () => {
            await renderPage();
            fireEvent.click(screen.getByText('web_search'));
            const link = await screen.findByText('Scribe');
            expect(link.closest('a')).toHaveAttribute('href', '/agents/a1');
        });

        it('falls back to a generated avatar', async () => {
            await renderPage();
            fireEvent.click(screen.getByText('web_search'));
            const image = await screen.findByAltText('Scribe');
            expect(image).toHaveAttribute('src', expect.stringContaining('dicebear'));
        });

        it('uses a supplied avatar', async () => {
            await renderPage();
            fireEvent.click(screen.getByText('web_search'));
            expect(await screen.findByAltText('Scout')).toHaveAttribute(
                'src',
                'https://img/scout.png'
            );
        });

        it('highlights the selection', async () => {
            await renderPage();
            const card = screen.getByText('web_search').closest('button')!;
            fireEvent.click(card);
            await waitFor(() => expect(card.className).toContain('border-indigo-500'));
        });

        it('switches to another tool', async () => {
            await renderPage();
            fireEvent.click(screen.getByText('web_search'));
            await screen.findByText('Scribe');
            fireEvent.click(screen.getByText('memory_lookup'));
            await waitFor(() =>
                expect(get).toHaveBeenCalledWith('/tool/t2/agents')
            );
        });

        it('reports a tool nobody uses', async () => {
            respond({ agents: [] });
            await renderPage();
            fireEvent.click(screen.getByText('web_search'));
            expect(await screen.findByText(/no agents linked yet/i)).toBeInTheDocument();
        });
    });

    describe('the tool icon', () => {
        it.each([
            ['web_search', 'text-blue-500'],
            ['memory_lookup', 'text-amber-500'],
            ['agent_creator', 'text-indigo-500'],
            ['python_exec', 'text-emerald-500'],
            ['send_email', 'text-slate-400'],
        ])('picks one for %s by family', async (name, expected) => {
            const { container } = await renderPage();
            const card = screen.getByText(name).closest('button')!;
            expect(container.contains(card)).toBe(true);
            expect(card.querySelector(`svg.${expected}`)).toBeTruthy();
        });
    });

    it('renders with no tools registered at all', async () => {
        respond({ tools: [] });
        renderWithQuery(<ToolsPage />);
        expect(await screen.findByText(/no tools found/i)).toBeInTheDocument();
    });
});
