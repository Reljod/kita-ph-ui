/**
 * Tests for the agent editor.
 *
 * This one component is the whole agent configuration surface: identity, the
 * model, personality traits, the knowledge base and the tool assignments. It
 * renders the same markup in two modes, and `readOnly` is what stands between
 * "viewing an agent" and "editing it" — so most of these cases check that the
 * read-only view really cannot mutate anything.
 *
 * The knowledge tab merges two sources, org-wide and agent-scoped, and the
 * endpoint each entry saves to depends on which it came from. Sending an
 * org-wide edit to the agent endpoint would fork it into a private copy.
 */

import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const push = vi.fn();
const back = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, back }) }));

const apiGet = vi.fn();
const apiPut = vi.fn();
const apiPost = vi.fn();
const apiDelete = vi.fn();
vi.mock('@/lib/api', () => ({
    api: {
        get: (...a: unknown[]) => apiGet(...a),
        put: (...a: unknown[]) => apiPut(...a),
        post: (...a: unknown[]) => apiPost(...a),
        delete: (...a: unknown[]) => apiDelete(...a),
    },
}));

const { renderWithQuery } = await import('../support/render');
const { AgentEditForm } = await import('@/components/agents/AgentEditForm');

const AGENT = {
    id: 'agent_1',
    name: 'Scribe',
    role: 'writer',
    goal: 'write things down',
    backstory: 'trained on the archive',
    llm_id: 'llm_1',
    personalities: ['Friendly', 'Concise'],
    tools: ['tool_1'],
};

const LLMS = [
    { id: 'llm_1', name: 'Sonnet', provider: 'anthropic', model: 'claude-sonnet' },
    { id: 'llm_2', name: 'Haiku', provider: 'anthropic', model: 'claude-haiku' },
];

const TOOLS = [
    { id: 'tool_1', name: 'web_search', description: 'Search the web.' },
    { id: 'tool_2', name: 'send_email', description: 'Send a message.' },
];

const AGENT_MEMORY = {
    id: 'mem_agent',
    org_id: 'org_1',
    agent_id: 'agent_1',
    title: 'Agent note',
    content: 'Only this agent knows this.',
    status: 'completed' as const,
    updated_at: '2026-03-05T10:00:00Z',
};

const ORG_MEMORY = {
    id: 'mem_org',
    org_id: 'org_1',
    title: 'Org note',
    content: 'Everyone knows this.',
    status: 'pending' as const,
    updated_at: '2026-03-04T10:00:00Z',
};

function respond(overrides: Record<string, unknown> = {}) {
    const data = {
        agent: AGENT,
        llms: LLMS,
        tools: TOOLS,
        agentMemories: [AGENT_MEMORY],
        orgMemories: [ORG_MEMORY],
        ...overrides,
    };
    apiGet.mockImplementation(async (url: string) => {
        if (url === '/agent/agent_1') return { data: data.agent };
        if (url === '/llm') return { data: data.llms };
        if (url === '/tool') return { data: data.tools };
        if (url === '/agent/agent_1/memory') return { data: data.agentMemories };
        if (url === '/memory') return { data: data.orgMemories };
        throw new Error(`unexpected GET ${url}`);
    });
}

beforeEach(() => {
    push.mockClear();
    back.mockClear();
    apiGet.mockReset();
    apiPut.mockReset().mockResolvedValue({ data: AGENT });
    apiPost.mockReset().mockResolvedValue({ data: {} });
    apiDelete.mockReset().mockResolvedValue({ data: {} });
    respond();
});

async function renderForm(props: Record<string, unknown> = {}) {
    const result = renderWithQuery(
        <AgentEditForm
            agentId="agent_1"
            {...(props as Partial<React.ComponentProps<typeof AgentEditForm>>)}
        />
    );
    await screen.findByDisplayValue('Scribe');
    return result;
}

function openTab(name: RegExp) {
    fireEvent.click(screen.getByRole('button', { name }));
}

describe('AgentEditForm', () => {
    it('spins while the agent loads', () => {
        renderWithQuery(<AgentEditForm agentId="agent_1" />);
        expect(document.querySelector('.animate-spin')).toBeTruthy();
    });

    it('prefills the identity', async () => {
        await renderForm();
        expect(screen.getByLabelText(/agent name/i)).toHaveValue('Scribe');
        expect(screen.getByLabelText(/role/i)).toHaveValue('writer');
    });

    it('prefills the goal and backstory', async () => {
        await renderForm();
        expect(screen.getByDisplayValue('write things down')).toBeInTheDocument();
        expect(screen.getByDisplayValue('trained on the archive')).toBeInTheDocument();
    });

    it('selects the configured model', async () => {
        await renderForm();
        expect(screen.getByLabelText(/selected model/i)).toHaveValue('llm_1');
    });

    it('offers every registered model', async () => {
        await renderForm();
        expect(screen.getByRole('option', { name: /haiku/i })).toBeInTheDocument();
    });

    it('copes with an agent whose fields are empty', async () => {
        respond({ agent: { id: 'agent_1' } });
        renderWithQuery(<AgentEditForm agentId="agent_1" />);
        expect(await screen.findByText('Untitled Agent')).toBeInTheDocument();
    });

    it('says when no role is set', async () => {
        respond({ agent: { id: 'agent_1', name: 'Scribe' } });
        renderWithQuery(<AgentEditForm agentId="agent_1" />);
        expect(await screen.findByText(/no role defined/i)).toBeInTheDocument();
    });

    it('falls back to a generated avatar', async () => {
        await renderForm();
        expect(screen.getByAltText('Scribe')).toHaveAttribute(
            'src',
            expect.stringContaining('dicebear')
        );
    });

    describe('saving', () => {
        it('sends the edited fields', async () => {
            await renderForm();
            fireEvent.change(screen.getByLabelText(/agent name/i), {
                target: { value: 'Scribe v2' },
            });
            fireEvent.click(screen.getByRole('button', { name: /save changes/i }));
            await waitFor(() =>
                expect(apiPut).toHaveBeenCalledWith(
                    '/agent/agent_1',
                    expect.objectContaining({ name: 'Scribe v2' })
                )
            );
        });

        it('sends the traits along', async () => {
            await renderForm();
            fireEvent.click(screen.getByRole('button', { name: /save changes/i }));
            await waitFor(() =>
                expect(apiPut).toHaveBeenCalledWith(
                    '/agent/agent_1',
                    expect.objectContaining({ personalities: ['Friendly', 'Concise'] })
                )
            );
        });

        it('sends a model change', async () => {
            await renderForm();
            fireEvent.change(screen.getByLabelText(/selected model/i), {
                target: { value: 'llm_2' },
            });
            fireEvent.click(screen.getByRole('button', { name: /save changes/i }));
            await waitFor(() =>
                expect(apiPut).toHaveBeenCalledWith(
                    '/agent/agent_1',
                    expect.objectContaining({ llm_id: 'llm_2' })
                )
            );
        });

        it('confirms the save', async () => {
            await renderForm();
            fireEvent.click(screen.getByRole('button', { name: /save changes/i }));
            expect(await screen.findByText(/saved!/i)).toBeInTheDocument();
        });

        it('recovers when the save fails', async () => {
            // The button must come back, or the only way out is a reload.
            apiPut.mockRejectedValue(new Error('conflict'));
            await renderForm();
            fireEvent.click(screen.getByRole('button', { name: /save changes/i }));
            await waitFor(() =>
                expect(screen.getByRole('button', { name: /save changes/i })).toBeEnabled()
            );
        });

        it('says the save failed', async () => {
            // Silently resetting the button is indistinguishable from success,
            // and the user walks away thinking the change stuck.
            apiPut.mockRejectedValue(new Error('conflict'));
            await renderForm();
            fireEvent.click(screen.getByRole('button', { name: /save changes/i }));
            expect(await screen.findByRole('alert')).toHaveTextContent('conflict');
        });

        it('does not claim success after a failure', async () => {
            apiPut.mockRejectedValue(new Error('conflict'));
            await renderForm();
            fireEvent.click(screen.getByRole('button', { name: /save changes/i }));
            await screen.findByRole('alert');
            expect(screen.queryByText(/saved!/i)).not.toBeInTheDocument();
        });

        it('clears the error on a retry', async () => {
            apiPut.mockRejectedValueOnce(new Error('conflict'));
            await renderForm();
            fireEvent.click(screen.getByRole('button', { name: /save changes/i }));
            await screen.findByRole('alert');
            fireEvent.click(screen.getByRole('button', { name: /save changes/i }));
            await waitFor(() =>
                expect(screen.queryByRole('alert')).not.toBeInTheDocument()
            );
        });

        it('leaves without saving', async () => {
            await renderForm();
            fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
            expect(back).toHaveBeenCalled();
            expect(apiPut).not.toHaveBeenCalled();
        });
    });

    describe('language', () => {
        it('defaults to English for an agent that predates the setting', async () => {
            // Nothing migrates the stored agents, so most of them arrive with
            // no language at all. Rendering an empty select would look like
            // the setting had been cleared.
            await renderForm();
            expect(screen.getByLabelText(/speaks in/i)).toHaveValue('english');
        });

        it('selects the configured language', async () => {
            respond({ agent: { ...AGENT, language: 'filipino' } });
            await renderForm();
            expect(screen.getByLabelText(/speaks in/i)).toHaveValue('filipino');
        });

        it('offers Filipino', async () => {
            await renderForm();
            expect(
                screen.getByRole('option', { name: /filipino \(taglish\)/i })
            ).toBeInTheDocument();
        });

        it('sends a language change', async () => {
            await renderForm();
            fireEvent.change(screen.getByLabelText(/speaks in/i), {
                target: { value: 'filipino' },
            });
            fireEvent.click(screen.getByRole('button', { name: /save changes/i }));
            await waitFor(() =>
                expect(apiPut).toHaveBeenCalledWith(
                    '/agent/agent_1',
                    expect.objectContaining({ language: 'filipino' })
                )
            );
        });

        it('sends the language along with an unrelated edit', async () => {
            // The form PUTs the whole of formData, so a field it forgets to
            // carry would blank the agent's language on any other save.
            respond({ agent: { ...AGENT, language: 'filipino' } });
            await renderForm();
            fireEvent.change(screen.getByLabelText(/agent name/i), {
                target: { value: 'Scribe v2' },
            });
            fireEvent.click(screen.getByRole('button', { name: /save changes/i }));
            await waitFor(() =>
                expect(apiPut).toHaveBeenCalledWith(
                    '/agent/agent_1',
                    expect.objectContaining({ language: 'filipino' })
                )
            );
        });

        it('explains what Filipino does', async () => {
            respond({ agent: { ...AGENT, language: 'filipino' } });
            await renderForm();
            expect(screen.getByText(/natural na Taglish/i)).toBeInTheDocument();
        });

        it('cannot be changed in the read-only view', async () => {
            await renderForm({ readOnly: true });
            expect(screen.getByLabelText(/speaks in/i)).toBeDisabled();
        });
    });

    describe('personality traits', () => {
        it('lists the current traits', async () => {
            await renderForm();
            expect(screen.getByText('Friendly')).toBeInTheDocument();
        });

        it('says when there are none', async () => {
            respond({ agent: { ...AGENT, personalities: [] } });
            await renderForm();
            expect(screen.getByText(/no traits added yet/i)).toBeInTheDocument();
        });

        it('adds one', async () => {
            await renderForm();
            fireEvent.change(screen.getByPlaceholderText(/add a trait/i), {
                target: { value: 'Curious' },
            });
            fireEvent.click(
                screen.getByPlaceholderText(/add a trait/i).nextElementSibling!
            );
            expect(screen.getByText('Curious')).toBeInTheDocument();
        });

        it('adds one on Enter', async () => {
            await renderForm();
            const input = screen.getByPlaceholderText(/add a trait/i);
            fireEvent.change(input, { target: { value: 'Curious' } });
            fireEvent.keyPress(input, { key: 'Enter', charCode: 13 });
            expect(screen.getByText('Curious')).toBeInTheDocument();
        });

        it('clears the box afterwards', async () => {
            await renderForm();
            const input = screen.getByPlaceholderText(/add a trait/i);
            fireEvent.change(input, { target: { value: 'Curious' } });
            fireEvent.keyPress(input, { key: 'Enter', charCode: 13 });
            expect(input).toHaveValue('');
        });

        it('refuses a duplicate', async () => {
            // Two identical traits would go into the prompt twice.
            await renderForm();
            const input = screen.getByPlaceholderText(/add a trait/i);
            fireEvent.change(input, { target: { value: 'Friendly' } });
            fireEvent.keyPress(input, { key: 'Enter', charCode: 13 });
            expect(screen.getAllByText('Friendly')).toHaveLength(1);
        });

        it('refuses an empty trait', async () => {
            await renderForm();
            const input = screen.getByPlaceholderText(/add a trait/i);
            fireEvent.change(input, { target: { value: '   ' } });
            fireEvent.keyPress(input, { key: 'Enter', charCode: 13 });
            expect(screen.getAllByText(/friendly|concise/i)).toHaveLength(2);
        });

        it('trims what it stores', async () => {
            await renderForm();
            const input = screen.getByPlaceholderText(/add a trait/i);
            fireEvent.change(input, { target: { value: '  Curious  ' } });
            fireEvent.keyPress(input, { key: 'Enter', charCode: 13 });
            expect(screen.getByText('Curious')).toBeInTheDocument();
        });

        it('removes one', async () => {
            await renderForm();
            const chip = screen.getByText('Friendly').closest('span')!;
            fireEvent.click(within(chip).getByRole('button'));
            expect(screen.queryByText('Friendly')).not.toBeInTheDocument();
        });

        it('ignores other keys', async () => {
            await renderForm();
            const input = screen.getByPlaceholderText(/add a trait/i);
            fireEvent.change(input, { target: { value: 'Curious' } });
            fireEvent.keyPress(input, { key: 'a', charCode: 97 });
            expect(screen.queryByText('Curious')).not.toBeInTheDocument();
        });
    });

    describe('the knowledge tab', () => {
        it('shows both scopes together', async () => {
            await renderForm();
            openTab(/memory & knowledge/i);
            expect(screen.getByText('Agent note')).toBeInTheDocument();
            expect(screen.getByText('Org note')).toBeInTheDocument();
        });

        it('marks the org-wide entries', async () => {
            // Editing one changes it for every agent, so the badge is the only
            // warning the user gets.
            await renderForm();
            openTab(/memory & knowledge/i);
            expect(screen.getByText(/org wide/i)).toBeInTheDocument();
        });

        it('does not mark agent-scoped entries', async () => {
            await renderForm();
            openTab(/memory & knowledge/i);
            expect(screen.getAllByText(/org wide/i)).toHaveLength(1);
        });

        it('shows the ingestion status', async () => {
            await renderForm();
            openTab(/memory & knowledge/i);
            expect(screen.getByText('pending')).toBeInTheDocument();
        });

        it('orders the newest first', async () => {
            await renderForm();
            openTab(/memory & knowledge/i);
            const titles = screen
                .getAllByRole('heading', { level: 3 })
                .map((h) => h.textContent);
            expect(titles).toEqual(['Agent note', 'Org note']);
        });

        it('de-duplicates an entry returned by both queries', async () => {
            // The agent query already includes agent-scoped entries; if the org
            // query returns one too it must not render twice.
            respond({ orgMemories: [ORG_MEMORY, AGENT_MEMORY] });
            await renderForm();
            openTab(/memory & knowledge/i);
            expect(screen.getAllByText('Agent note')).toHaveLength(1);
        });

        it('says when there is nothing', async () => {
            respond({ agentMemories: [], orgMemories: [] });
            await renderForm();
            openTab(/memory & knowledge/i);
            expect(screen.getByText(/no knowledge entries found/i)).toBeInTheDocument();
        });

        it('opens an entry for editing', async () => {
            await renderForm();
            openTab(/memory & knowledge/i);
            const row = screen.getByText('Agent note').closest('.p-6')!;
            fireEvent.click(within(row as HTMLElement).getAllByRole('button')[0]);
            expect(await screen.findByText('Edit Memory')).toBeInTheDocument();
        });

        it('saves an agent entry to the agent endpoint', async () => {
            await renderForm();
            openTab(/memory & knowledge/i);
            const row = screen.getByText('Agent note').closest('.p-6')!;
            fireEvent.click(within(row as HTMLElement).getAllByRole('button')[0]);
            await screen.findByText('Edit Memory');
            fireEvent.click(screen.getByRole('button', { name: /save changes/i }));
            await waitFor(() =>
                expect(apiPut).toHaveBeenCalledWith(
                    '/agent/agent_1/memory/mem_agent',
                    expect.anything()
                )
            );
        });

        it('saves an org entry to the org endpoint', async () => {
            // Routing this through the agent endpoint would fork the shared
            // entry into a private copy.
            await renderForm();
            openTab(/memory & knowledge/i);
            const row = screen.getByText('Org note').closest('.p-6')!;
            fireEvent.click(within(row as HTMLElement).getAllByRole('button')[0]);
            await screen.findByText('Edit Memory');
            fireEvent.click(screen.getByRole('button', { name: /save changes/i }));
            await waitFor(() =>
                expect(apiPut).toHaveBeenCalledWith('/memory/mem_org', expect.anything())
            );
        });

        it('sends the edited text', async () => {
            await renderForm();
            openTab(/memory & knowledge/i);
            const row = screen.getByText('Agent note').closest('.p-6')!;
            fireEvent.click(within(row as HTMLElement).getAllByRole('button')[0]);
            await screen.findByText('Edit Memory');
            fireEvent.change(screen.getByLabelText(/title/i), {
                target: { value: 'Renamed note' },
            });
            fireEvent.click(screen.getByRole('button', { name: /save changes/i }));
            await waitFor(() =>
                expect(apiPut).toHaveBeenCalledWith(
                    expect.any(String),
                    expect.objectContaining({ title: 'Renamed note' })
                )
            );
        });

        it('abandons an edit on cancel', async () => {
            await renderForm();
            openTab(/memory & knowledge/i);
            const row = screen.getByText('Agent note').closest('.p-6')!;
            fireEvent.click(within(row as HTMLElement).getAllByRole('button')[0]);
            await screen.findByText('Edit Memory');
            fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
            await waitFor(() =>
                expect(screen.queryByText('Edit Memory')).not.toBeInTheDocument()
            );
            expect(apiPut).not.toHaveBeenCalled();
        });

        it('deletes an agent entry from the agent endpoint', async () => {
            await renderForm();
            openTab(/memory & knowledge/i);
            const row = screen.getByText('Agent note').closest('.p-6')!;
            fireEvent.click(within(row as HTMLElement).getAllByRole('button')[1]);
            await waitFor(() =>
                expect(apiDelete).toHaveBeenCalledWith('/agent/agent_1/memory/mem_agent')
            );
        });

        it('deletes an org entry from the org endpoint', async () => {
            await renderForm();
            openTab(/memory & knowledge/i);
            const row = screen.getByText('Org note').closest('.p-6')!;
            fireEvent.click(within(row as HTMLElement).getAllByRole('button')[1]);
            await waitFor(() =>
                expect(apiDelete).toHaveBeenCalledWith('/memory/mem_org')
            );
        });

        it('adds an entry scoped to this agent', async () => {
            await renderForm();
            openTab(/memory & knowledge/i);
            fireEvent.click(screen.getByRole('button', { name: /add knowledge/i }));
            await screen.findByText('Add Knowledge');
            fireEvent.change(screen.getByLabelText(/title/i), {
                target: { value: 'New note' },
            });
            fireEvent.click(screen.getByRole('button', { name: /add knowledge/i }));
            await waitFor(() =>
                expect(apiPost).toHaveBeenCalledWith(
                    '/agent/agent_1/memory',
                    expect.objectContaining({ title: 'New note', agent_id: 'agent_1' })
                )
            );
        });

        it('abandons a new entry on cancel', async () => {
            await renderForm();
            openTab(/memory & knowledge/i);
            fireEvent.click(screen.getByRole('button', { name: /add knowledge/i }));
            await screen.findByText('Add Knowledge');
            fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
            await waitFor(() => expect(apiPost).not.toHaveBeenCalled());
        });
    });

    describe('the tools tab', () => {
        it('lists the assigned tools by name', async () => {
            await renderForm();
            openTab(/tools & capabilities/i);
            expect(screen.getByText('web_search')).toBeInTheDocument();
        });

        it('counts them', async () => {
            await renderForm();
            openTab(/tools & capabilities/i);
            expect(screen.getByText(/1 enabled/i)).toBeInTheDocument();
        });

        it('falls back to the raw id for an unknown tool', async () => {
            // A tool can be deregistered while agents still reference it.
            respond({ agent: { ...AGENT, tools: ['ghost_tool'] } });
            await renderForm();
            openTab(/tools & capabilities/i);
            expect(screen.getByText('ghost_tool')).toBeInTheDocument();
        });

        it('says when none are assigned', async () => {
            respond({ agent: { ...AGENT, tools: [] } });
            await renderForm();
            openTab(/tools & capabilities/i);
            expect(screen.getByText(/no tools assigned/i)).toBeInTheDocument();
        });

        it('offers the unassigned ones', async () => {
            await renderForm();
            openTab(/tools & capabilities/i);
            expect(screen.getByText('send_email')).toBeInTheDocument();
        });

        it('does not offer one that is already on', async () => {
            await renderForm();
            openTab(/tools & capabilities/i);
            expect(screen.getAllByText('web_search')).toHaveLength(1);
        });

        it('says when everything is enabled', async () => {
            respond({ agent: { ...AGENT, tools: ['tool_1', 'tool_2'] } });
            await renderForm();
            openTab(/tools & capabilities/i);
            expect(screen.getByText(/all capabilities are already enabled/i)).toBeInTheDocument();
        });

        it('assigns a tool', async () => {
            await renderForm();
            openTab(/tools & capabilities/i);
            fireEvent.click(screen.getByText('send_email'));
            await waitFor(() =>
                expect(apiPost).toHaveBeenCalledWith('/agent/agent_1/tools/add', {
                    tool_ids: ['tool_2'],
                })
            );
        });

        it('removes a tool', async () => {
            await renderForm();
            openTab(/tools & capabilities/i);
            const row = screen.getByText('web_search').closest('.flex.items-center.justify-between')!;
            fireEvent.click(within(row as HTMLElement).getByRole('button'));
            await waitFor(() =>
                expect(apiPost).toHaveBeenCalledWith('/agent/agent_1/tools/remove', {
                    tool_ids: ['tool_1'],
                })
            );
        });

        it('matches an assignment stored by name rather than id', async () => {
            // Older agents carry tool names; both forms have to resolve.
            respond({ agent: { ...AGENT, tools: ['web_search'] } });
            await renderForm();
            openTab(/tools & capabilities/i);
            expect(screen.getAllByText('web_search')).toHaveLength(1);
        });
    });

    describe('the read-only view', () => {
        it('disables the identity fields', async () => {
            await renderForm({ readOnly: true });
            expect(screen.getByLabelText(/agent name/i)).toBeDisabled();
            expect(screen.getByLabelText(/selected model/i)).toBeDisabled();
        });

        it('offers no save button', async () => {
            await renderForm({ readOnly: true });
            expect(
                screen.queryByRole('button', { name: /save changes/i })
            ).not.toBeInTheDocument();
        });

        it('sends the user to the editor instead', async () => {
            await renderForm({ readOnly: true });
            fireEvent.click(screen.getByRole('button', { name: /edit agent/i }));
            expect(push).toHaveBeenCalledWith('/agents/agent_1/edit');
        });

        it('cannot add a trait', async () => {
            await renderForm({ readOnly: true });
            expect(screen.queryByPlaceholderText(/add a trait/i)).not.toBeInTheDocument();
        });

        it('cannot remove a trait', async () => {
            await renderForm({ readOnly: true });
            const chip = screen.getByText('Friendly').closest('span')!;
            expect(within(chip).queryByRole('button')).not.toBeInTheDocument();
        });

        it('cannot add knowledge', async () => {
            await renderForm({ readOnly: true });
            openTab(/memory & knowledge/i);
            expect(
                screen.queryByRole('button', { name: /add knowledge/i })
            ).not.toBeInTheDocument();
        });

        it('cannot edit or delete an entry', async () => {
            await renderForm({ readOnly: true });
            openTab(/memory & knowledge/i);
            const row = screen.getByText('Agent note').closest('.p-6')!;
            expect(within(row as HTMLElement).queryAllByRole('button')).toHaveLength(0);
        });

        it('cannot remove a tool', async () => {
            await renderForm({ readOnly: true });
            openTab(/tools & capabilities/i);
            const row = screen.getByText('web_search').closest('.flex.items-center.justify-between')!;
            expect(within(row as HTMLElement).queryByRole('button')).not.toBeInTheDocument();
        });

        it('cannot assign a tool', async () => {
            await renderForm({ readOnly: true });
            openTab(/tools & capabilities/i);
            expect(screen.queryByText('send_email')).not.toBeInTheDocument();
        });

        it('still shows everything', async () => {
            await renderForm({ readOnly: true });
            expect(screen.getByLabelText(/agent name/i)).toHaveValue('Scribe');
        });
    });

    describe('the tabs', () => {
        it('starts on details', async () => {
            await renderForm();
            expect(screen.getByLabelText(/agent name/i)).toBeInTheDocument();
        });

        it('switches to knowledge', async () => {
            await renderForm();
            openTab(/memory & knowledge/i);
            expect(screen.queryByLabelText(/agent name/i)).not.toBeInTheDocument();
        });

        it('switches to tools', async () => {
            await renderForm();
            openTab(/tools & capabilities/i);
            expect(screen.getByText(/active tools/i)).toBeInTheDocument();
        });

        it('comes back to details', async () => {
            await renderForm();
            openTab(/tools & capabilities/i);
            openTab(/agent details/i);
            expect(screen.getByLabelText(/agent name/i)).toBeInTheDocument();
        });
    });
});
