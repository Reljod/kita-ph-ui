/**
 * Tests for the agent-facing pages: dashboard, the agent list, the profile and
 * edit shells, and the chat route.
 *
 * These are mostly composition, so the cases that matter are the states around
 * the happy path — an organization with no agents yet, a request that fails,
 * and a chat URL naming an agent that does not exist. Each of those has to say
 * something, not spin.
 */

import { fireEvent, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const push = vi.fn();
const params = vi.fn<() => Record<string, unknown>>(() => ({ agentId: 'agent_1' }));
vi.mock('next/navigation', () => ({
    useRouter: () => ({ push, replace: vi.fn() }),
    useParams: () => params(),
    usePathname: () => '/agents',
}));

const apiGet = vi.fn();
vi.mock('@/lib/api', () => ({ api: { get: (...args: unknown[]) => apiGet(...args) } }));

// The chat surface and the edit form have their own suites; these pages are
// only responsible for choosing whether to render them at all.
vi.mock('@/components/chat/ChatView', () => ({
    ChatView: ({ agent }: { agent: { name: string } }) => <div>chat with {agent.name}</div>,
    parseBackendMessages: (m: unknown[]) => m,
}));
vi.mock('@/components/agents/AgentEditForm', () => ({
    AgentEditForm: ({ agentId, readOnly }: { agentId: string; readOnly?: boolean }) => (
        <div>
            form for {agentId} {readOnly ? '(read only)' : '(editable)'}
        </div>
    ),
}));

const { renderWithQuery } = await import('../support/render');
const DashboardPage = (await import('@/app/(main)/dashboard/page')).default;
const AgentsPage = (await import('@/app/(main)/agents/page')).default;
const AgentViewPage = (await import('@/app/(main)/agents/[agentId]/page')).default;
const AgentEditPage = (await import('@/app/(main)/agents/[agentId]/edit/page')).default;
const AgentChatPage = (
    await import('@/app/(main)/agents/[agentId]/chat/[[...chatId]]/page')
).default;

const AGENTS = [
    { id: 'agent_1', name: 'Scribe', role: 'writer', updated_at: '2026-01-01T00:00:00Z' },
    { id: 'agent_2', name: 'Scout', role: 'researcher', updated_at: '2026-01-01T00:00:00Z' },
];

beforeEach(() => {
    push.mockClear();
    params.mockReturnValue({ agentId: 'agent_1' });
    apiGet.mockReset().mockImplementation(async (url: string) => {
        if (url === '/agent') return { data: AGENTS };
        if (url.includes('/chat?preview=true')) return { data: [] };
        return { data: { messages: [] } };
    });
});

describe('the dashboard', () => {
    it('spins while loading', () => {
        renderWithQuery(<DashboardPage />);
        expect(document.querySelector('.animate-spin')).toBeTruthy();
    });

    it('lists the agents', async () => {
        renderWithQuery(<DashboardPage />);
        expect(await screen.findByText('Scribe')).toBeInTheDocument();
    });

    it('invites the user to pick one', async () => {
        renderWithQuery(<DashboardPage />);
        expect(await screen.findByText(/select an agent/i)).toBeInTheDocument();
    });

    it('gives a new organization somewhere to start', async () => {
        apiGet.mockResolvedValue({ data: [] });
        renderWithQuery(<DashboardPage />);
        expect(await screen.findByText(/build your/i)).toBeInTheDocument();
    });

    it('does not render an empty grid', async () => {
        apiGet.mockResolvedValue({ data: [] });
        renderWithQuery(<DashboardPage />);
        await screen.findByText(/build your/i);
        expect(screen.queryByText('Create New Agent')).not.toBeInTheDocument();
    });

    it('treats a failed request as an empty workspace', async () => {
        // Not ideal, but it is deliberate: the page catches and returns [].
        // Pinning it means a change to that decision is visible in review.
        apiGet.mockRejectedValue(new Error('offline'));
        renderWithQuery(<DashboardPage />);
        expect(await screen.findByText(/build your/i)).toBeInTheDocument();
    });

    it('copes with a null body', async () => {
        apiGet.mockResolvedValue({ data: null });
        renderWithQuery(<DashboardPage />);
        expect(await screen.findByText(/build your/i)).toBeInTheDocument();
    });

    it('generates an avatar for an agent without one', async () => {
        renderWithQuery(<DashboardPage />);
        await screen.findByText('Scribe');
        expect(screen.getByAltText('Scribe')).toHaveAttribute(
            'src',
            expect.stringContaining('dicebear')
        );
    });

    it('keeps a supplied avatar', async () => {
        apiGet.mockResolvedValue({
            data: [{ ...AGENTS[0], avatar: 'https://img/s.png' }],
        });
        renderWithQuery(<DashboardPage />);
        expect(await screen.findByAltText('Scribe')).toHaveAttribute(
            'src',
            'https://img/s.png'
        );
    });
});

describe('the agents page', () => {
    it('spins while loading', () => {
        renderWithQuery(<AgentsPage />);
        expect(document.querySelector('.animate-spin')).toBeTruthy();
    });

    it('lists the agents', async () => {
        renderWithQuery(<AgentsPage />);
        expect(await screen.findByText('Scout')).toBeInTheDocument();
    });

    it('explains how to chat', async () => {
        renderWithQuery(<AgentsPage />);
        expect(await screen.findByText(/click one to start chatting/i)).toBeInTheDocument();
    });

    it('says when there are none', async () => {
        apiGet.mockResolvedValue({ data: [] });
        renderWithQuery(<AgentsPage />);
        expect(await screen.findByText(/no agents yet/i)).toBeInTheDocument();
    });

    it('treats a failed request as empty', async () => {
        apiGet.mockRejectedValue(new Error('offline'));
        renderWithQuery(<AgentsPage />);
        expect(await screen.findByText(/no agents yet/i)).toBeInTheDocument();
    });
});

describe('the agent profile page', () => {
    it('renders the form read-only', () => {
        renderWithQuery(<AgentViewPage />);
        expect(screen.getByText(/form for agent_1 \(read only\)/)).toBeInTheDocument();
    });

    it('goes back to the list', () => {
        renderWithQuery(<AgentViewPage />);
        fireEvent.click(screen.getAllByRole('button')[0]);
        expect(push).toHaveBeenCalledWith('/agents');
    });

    it('offers the editor', () => {
        renderWithQuery(<AgentViewPage />);
        fireEvent.click(screen.getByText(/edit agent/i));
        expect(push).toHaveBeenCalledWith('/agents/agent_1/edit');
    });
});

describe('the agent edit page', () => {
    it('renders the form editable', () => {
        renderWithQuery(<AgentEditPage />);
        expect(screen.getByText(/form for agent_1 \(editable\)/)).toBeInTheDocument();
    });

    it('goes back to the list', () => {
        renderWithQuery(<AgentEditPage />);
        fireEvent.click(screen.getAllByRole('button')[0]);
        expect(push).toHaveBeenCalledWith('/agents');
    });
});

describe('the chat page', () => {
    it('spins while the agent list loads', () => {
        renderWithQuery(<AgentChatPage />);
        expect(document.querySelector('.animate-spin')).toBeTruthy();
    });

    it('opens the chat once it arrives', async () => {
        renderWithQuery(<AgentChatPage />);
        expect(await screen.findByText(/chat with Scribe/)).toBeInTheDocument();
    });

    it('says so when the agent list fails', async () => {
        // This branch used to be unreachable — the loading check also covered
        // a missing agent, so a failed request spun forever.
        apiGet.mockRejectedValue(new Error('offline'));
        renderWithQuery(<AgentChatPage />);
        expect(await screen.findByText(/could not load this agent/i)).toBeInTheDocument();
    });

    it('says so for an agent that does not exist', async () => {
        params.mockReturnValue({ agentId: 'nope' });
        renderWithQuery(<AgentChatPage />);
        expect(await screen.findByText(/could not load this agent/i)).toBeInTheDocument();
    });

    it('loads the messages of the chat in the URL', async () => {
        params.mockReturnValue({ agentId: 'agent_1', chatId: ['chat_9'] });
        renderWithQuery(<AgentChatPage />);
        await screen.findByText(/chat with Scribe/);
        expect(apiGet).toHaveBeenCalledWith('/agent/agent_1/chat/chat_9');
    });

    it('asks for no messages without a chat id', async () => {
        renderWithQuery(<AgentChatPage />);
        await screen.findByText(/chat with Scribe/);
        expect(apiGet).not.toHaveBeenCalledWith(expect.stringMatching(/\/chat\/[^?]+$/));
    });

    it('fetches the history list for the agent', async () => {
        renderWithQuery(<AgentChatPage />);
        await screen.findByText(/chat with Scribe/);
        expect(apiGet).toHaveBeenCalledWith('/agent/agent_1/chat?preview=true');
    });
});
