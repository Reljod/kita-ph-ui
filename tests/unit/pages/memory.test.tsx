/**
 * Tests for the Memory Vault page and its add/edit modal.
 *
 * Scope is the load-bearing concept here: an org-wide memory is visible to
 * every agent, an agent-scoped one is not, and the difference is carried by
 * whether an `x-agent-id` header rides along. The page decides that from a
 * toggle, so these cases follow the toggle down into the service call.
 *
 * The delete path is the other focus — it goes through a confirmation, and the
 * dialog has to name the right entry.
 */

import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const get = vi.fn();
vi.mock('@/lib/api', () => ({ api: { get: (...args: unknown[]) => get(...args) } }));

const memoryService = {
    getAll: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
};
vi.mock('@/services/memoryService', () => ({ memoryService }));

const { renderWithQuery } = await import('../support/render');
const MemoryPage = (await import('@/app/(main)/memory/page')).default;
const { AddMemoryModal } = await import('@/components/memory/AddMemoryModal');

const AGENTS = [
    { id: 'a1', name: 'Scribe', role: 'writer' },
    { id: 'a2', name: 'Scout', role: 'researcher' },
];

const ORG_MEMORY = {
    id: 'mem_1',
    org_id: 'org_1',
    title: 'Company holidays',
    content: 'The office closes on the 24th.',
    status: 'completed' as const,
    updated_at: '2026-03-04T10:00:00Z',
};

const AGENT_MEMORY = {
    ...ORG_MEMORY,
    id: 'mem_2',
    agent_id: 'a1',
    title: 'Scribe tone',
    content: 'Write in short sentences.',
};

beforeEach(() => {
    get.mockReset().mockResolvedValue({ data: AGENTS });
    memoryService.getAll.mockReset().mockResolvedValue([ORG_MEMORY]);
    memoryService.create.mockReset().mockResolvedValue(ORG_MEMORY);
    memoryService.update.mockReset().mockResolvedValue(ORG_MEMORY);
    memoryService.delete.mockReset().mockResolvedValue(undefined);
});

async function renderPage() {
    const result = renderWithQuery(<MemoryPage />);
    await screen.findByText('Company holidays');
    return result;
}

describe('the memory vault page', () => {
    it('shows a loading state first', () => {
        renderWithQuery(<MemoryPage />);
        expect(screen.getByText(/loading memories/i)).toBeInTheDocument();
    });

    it('starts organization-wide', async () => {
        await renderPage();
        expect(memoryService.getAll).toHaveBeenCalledWith(undefined);
    });

    it('lists the memories', async () => {
        await renderPage();
        expect(screen.getByText('Company holidays')).toBeInTheDocument();
    });

    it('survives the agent list failing', async () => {
        // The vault is still usable org-wide without agents; a rejected
        // /agent must not take the whole page down.
        get.mockRejectedValue(new Error('boom'));
        await renderPage();
        expect(screen.getByText('Company holidays')).toBeInTheDocument();
    });

    describe('the scope toggle', () => {
        it('switches to agent scope', async () => {
            await renderPage();
            fireEvent.click(screen.getByText('Agent Specific'));
            await waitFor(() =>
                expect(memoryService.getAll).toHaveBeenCalledWith('a1')
            );
        });

        it('offers an agent picker only in agent scope', async () => {
            await renderPage();
            expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
            fireEvent.click(screen.getByText('Agent Specific'));
            expect(await screen.findByRole('combobox')).toBeInTheDocument();
        });

        it('defaults to the first agent', async () => {
            await renderPage();
            fireEvent.click(screen.getByText('Agent Specific'));
            expect(await screen.findByRole('combobox')).toHaveValue('a1');
        });

        it('refetches for another agent', async () => {
            await renderPage();
            fireEvent.click(screen.getByText('Agent Specific'));
            fireEvent.change(await screen.findByRole('combobox'), {
                target: { value: 'a2' },
            });
            await waitFor(() =>
                expect(memoryService.getAll).toHaveBeenCalledWith('a2')
            );
        });

        it('goes back to org scope', async () => {
            await renderPage();
            fireEvent.click(screen.getByText('Agent Specific'));
            await waitFor(() => expect(memoryService.getAll).toHaveBeenCalledWith('a1'));
            fireEvent.click(screen.getByText('Organization Wide'));
            await waitFor(() =>
                expect(memoryService.getAll).toHaveBeenLastCalledWith(undefined)
            );
        });

        it('hides the picker when no agents exist', async () => {
            get.mockResolvedValue({ data: [] });
            await renderPage();
            fireEvent.click(screen.getByText('Agent Specific'));
            expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
        });
    });

    describe('search', () => {
        beforeEach(() => {
            memoryService.getAll.mockResolvedValue([ORG_MEMORY, AGENT_MEMORY]);
        });

        it('filters by title', async () => {
            await renderPage();
            fireEvent.change(screen.getByPlaceholderText(/search memories/i), {
                target: { value: 'holidays' },
            });
            expect(screen.queryByText('Scribe tone')).not.toBeInTheDocument();
        });

        it('also matches the content', async () => {
            await renderPage();
            fireEvent.change(screen.getByPlaceholderText(/search memories/i), {
                target: { value: 'short sentences' },
            });
            expect(screen.getByText('Scribe tone')).toBeInTheDocument();
        });

        it('ignores case', async () => {
            await renderPage();
            fireEvent.change(screen.getByPlaceholderText(/search memories/i), {
                target: { value: 'HOLIDAYS' },
            });
            expect(screen.getByText('Company holidays')).toBeInTheDocument();
        });

        it('says what it searched for when nothing matches', async () => {
            await renderPage();
            fireEvent.change(screen.getByPlaceholderText(/search memories/i), {
                target: { value: 'zzz' },
            });
            expect(screen.getByText(/matching "zzz"/)).toBeInTheDocument();
        });

        it('does not offer to create one from a failed search', async () => {
            // The create prompt belongs to a genuinely empty vault; offering
            // it here reads as "no memories exist", which is wrong.
            await renderPage();
            fireEvent.change(screen.getByPlaceholderText(/search memories/i), {
                target: { value: 'zzz' },
            });
            expect(screen.queryByText(/create your first memory/i)).not.toBeInTheDocument();
        });

        it('searches without re-querying the API', async () => {
            // Filtering is local; a request per keystroke would be a request
            // per keystroke.
            await renderPage();
            const before = memoryService.getAll.mock.calls.length;
            fireEvent.change(screen.getByPlaceholderText(/search memories/i), {
                target: { value: 'holiday' },
            });
            expect(memoryService.getAll).toHaveBeenCalledTimes(before);
        });
    });

    describe('the empty state', () => {
        beforeEach(() => memoryService.getAll.mockResolvedValue([]));

        it('explains an empty organization', async () => {
            renderWithQuery(<MemoryPage />);
            expect(
                await screen.findByText(/no organization-wide memories yet/i)
            ).toBeInTheDocument();
        });

        it('explains an empty agent scope differently', async () => {
            renderWithQuery(<MemoryPage />);
            await screen.findByText(/no memories found/i);
            fireEvent.click(screen.getByText('Agent Specific'));
            expect(
                await screen.findByText(/doesn't have any specific memories/i)
            ).toBeInTheDocument();
        });

        it('offers to create the first one', async () => {
            renderWithQuery(<MemoryPage />);
            expect(
                await screen.findByText(/create your first memory/i)
            ).toBeInTheDocument();
        });

        it('opens the modal from that prompt', async () => {
            renderWithQuery(<MemoryPage />);
            fireEvent.click(await screen.findByText(/create your first memory/i));
            expect(await screen.findByText('Add New Memory')).toBeInTheDocument();
        });
    });

    describe('the view toggle', () => {
        it('starts as a list', async () => {
            await renderPage();
            expect(screen.getByRole('table')).toBeInTheDocument();
        });

        it('switches to cards', async () => {
            await renderPage();
            fireEvent.click(screen.getByTitle('Grid View'));
            expect(screen.queryByRole('table')).not.toBeInTheDocument();
        });

        it('switches back', async () => {
            await renderPage();
            fireEvent.click(screen.getByTitle('Grid View'));
            fireEvent.click(screen.getByTitle('List View'));
            expect(screen.getByRole('table')).toBeInTheDocument();
        });
    });

    describe('deleting', () => {
        it('asks first', async () => {
            await renderPage();
            fireEvent.click(screen.getByTitle('Delete memory'));
            expect(await screen.findByText('Delete Memory')).toBeInTheDocument();
        });

        it('names the entry being deleted', async () => {
            // A confirm dialog that does not say what it is deleting is not a
            // confirmation.
            await renderPage();
            fireEvent.click(screen.getByTitle('Delete memory'));
            expect(
                await screen.findByText(/"Company holidays"/)
            ).toBeInTheDocument();
        });

        it('does nothing until confirmed', async () => {
            await renderPage();
            fireEvent.click(screen.getByTitle('Delete memory'));
            await screen.findByText('Delete Memory');
            expect(memoryService.delete).not.toHaveBeenCalled();
        });

        it('deletes on confirm', async () => {
            await renderPage();
            fireEvent.click(screen.getByTitle('Delete memory'));
            fireEvent.click(await screen.findByRole('button', { name: /^delete$/i }));
            await waitFor(() =>
                expect(memoryService.delete).toHaveBeenCalledWith('mem_1', undefined)
            );
        });

        it('scopes the delete to the selected agent', async () => {
            // Deleting an agent memory without the header hits the org-wide
            // collection instead.
            memoryService.getAll.mockResolvedValue([AGENT_MEMORY]);
            renderWithQuery(<MemoryPage />);
            await screen.findByText('Scribe tone');
            fireEvent.click(screen.getByText('Agent Specific'));
            await waitFor(() => expect(memoryService.getAll).toHaveBeenCalledWith('a1'));
            fireEvent.click(await screen.findByTitle('Delete memory'));
            fireEvent.click(await screen.findByRole('button', { name: /^delete$/i }));
            await waitFor(() =>
                expect(memoryService.delete).toHaveBeenCalledWith('mem_2', 'a1')
            );
        });

        it('closes the dialog afterwards', async () => {
            await renderPage();
            fireEvent.click(screen.getByTitle('Delete memory'));
            fireEvent.click(await screen.findByRole('button', { name: /^delete$/i }));
            await waitFor(() =>
                expect(screen.queryByText('Delete Memory')).not.toBeInTheDocument()
            );
        });

        it('can be cancelled', async () => {
            await renderPage();
            fireEvent.click(screen.getByTitle('Delete memory'));
            fireEvent.click(await screen.findByRole('button', { name: /cancel/i }));
            await waitFor(() =>
                expect(screen.queryByText('Delete Memory')).not.toBeInTheDocument()
            );
            expect(memoryService.delete).not.toHaveBeenCalled();
        });

        it('names the entry when deleting from a card', async () => {
            await renderPage();
            fireEvent.click(screen.getByTitle('Grid View'));
            fireEvent.click(screen.getByTitle('Delete memory'));
            expect(await screen.findByText(/"Company holidays"/)).toBeInTheDocument();
        });
    });

    describe('creating', () => {
        it('opens an empty modal', async () => {
            await renderPage();
            fireEvent.click(screen.getByText('Add Memory'));
            expect(await screen.findByText('Add New Memory')).toBeInTheDocument();
        });

        it('sends the new memory', async () => {
            await renderPage();
            fireEvent.click(screen.getByText('Add Memory'));
            const dialog = await screen.findByText('Add New Memory');
            const form = dialog.closest('div')!.parentElement!;
            fireEvent.change(within(form).getByLabelText(/memory title/i), {
                target: { value: 'New note' },
            });
            fireEvent.change(within(form).getByLabelText(/^content$/i), {
                target: { value: 'Body text' },
            });
            fireEvent.click(within(form).getByRole('button', { name: /^add memory$/i }));
            await waitFor(() =>
                expect(memoryService.create).toHaveBeenCalledWith({
                    title: 'New note',
                    content: 'Body text',
                    agent_id: undefined,
                })
            );
        });
    });

    describe('editing', () => {
        it('opens the modal on the entry', async () => {
            await renderPage();
            fireEvent.click(screen.getByTitle('Edit memory'));
            expect(await screen.findByText('Edit Memory')).toBeInTheDocument();
        });

        it('prefills what is there', async () => {
            await renderPage();
            fireEvent.click(screen.getByTitle('Edit memory'));
            expect(await screen.findByDisplayValue('Company holidays')).toBeInTheDocument();
        });

        it('saves the change', async () => {
            await renderPage();
            fireEvent.click(screen.getByTitle('Edit memory'));
            const title = await screen.findByDisplayValue('Company holidays');
            fireEvent.change(title, { target: { value: 'Company holidays 2026' } });
            fireEvent.click(screen.getByRole('button', { name: /save changes/i }));
            await waitFor(() =>
                expect(memoryService.update).toHaveBeenCalledWith(
                    'mem_1',
                    { title: 'Company holidays 2026', content: ORG_MEMORY.content },
                    undefined
                )
            );
        });

        it('keeps the agent scope on an agent memory', async () => {
            // Dropping agent_id on save silently promotes the note to the
            // whole organization.
            memoryService.getAll.mockResolvedValue([AGENT_MEMORY]);
            renderWithQuery(<MemoryPage />);
            await screen.findByText('Scribe tone');
            fireEvent.click(screen.getByTitle('Edit memory'));
            await screen.findByDisplayValue('Scribe tone');
            fireEvent.click(screen.getByRole('button', { name: /save changes/i }));
            await waitFor(() =>
                expect(memoryService.update).toHaveBeenCalledWith(
                    'mem_2',
                    expect.anything(),
                    'a1'
                )
            );
        });
    });
});

describe('AddMemoryModal', () => {
    function renderModal(overrides: Record<string, unknown> = {}) {
        const props = {
            isOpen: true,
            onClose: vi.fn(),
            onSubmit: vi.fn().mockResolvedValue(undefined),
            agents: AGENTS as never,
            ...overrides,
        };
        renderWithQuery(
            <AddMemoryModal
                {...(props as unknown as React.ComponentProps<typeof AddMemoryModal>)}
            />
        );
        return props;
    }

    function fill(title = 'A title', content = 'Some content') {
        fireEvent.change(screen.getByLabelText(/memory title/i), {
            target: { value: title },
        });
        fireEvent.change(screen.getByLabelText(/^content$/i), {
            target: { value: content },
        });
    }

    it('renders nothing when closed', () => {
        renderModal({ isOpen: false });
        expect(screen.queryByText('Add New Memory')).not.toBeInTheDocument();
    });

    it('titles itself for a new memory', () => {
        renderModal();
        expect(screen.getByText('Add New Memory')).toBeInTheDocument();
    });

    it('titles itself for an edit', () => {
        renderModal({ editingMemory: ORG_MEMORY });
        expect(screen.getByText('Edit Memory')).toBeInTheDocument();
    });

    it('defaults to agent scope', () => {
        renderModal();
        expect(screen.getByLabelText(/select agent/i)).toBeInTheDocument();
    });

    it('honours the scope it was opened in', () => {
        renderModal({ initialScope: 'org' });
        expect(screen.queryByLabelText(/select agent/i)).not.toBeInTheDocument();
    });

    it('honours the agent it was opened on', () => {
        renderModal({ initialAgentId: 'a2' });
        expect(screen.getByLabelText(/select agent/i)).toHaveValue('a2');
    });

    it('falls back to the first agent', () => {
        renderModal();
        expect(screen.getByLabelText(/select agent/i)).toHaveValue('a1');
    });

    it('copes with no agents at all', () => {
        // A brand new organization has none; the picker should render empty
        // rather than the modal failing to open.
        renderModal({ agents: [] });
        const picker = screen.getByLabelText(/select agent/i);
        expect(picker).toBeInTheDocument();
        expect(picker.children).toHaveLength(0);
    });

    it('switches to org scope', () => {
        renderModal();
        fireEvent.click(screen.getByText('Organization Wide'));
        expect(screen.queryByLabelText(/select agent/i)).not.toBeInTheDocument();
    });

    it('sends an agent id in agent scope', async () => {
        const props = renderModal();
        fill();
        fireEvent.click(screen.getByRole('button', { name: /^add memory$/i }));
        await waitFor(() =>
            expect(props.onSubmit).toHaveBeenCalledWith(
                expect.objectContaining({ agent_id: 'a1' })
            )
        );
    });

    it('omits it in org scope', async () => {
        const props = renderModal({ initialScope: 'org' });
        fill();
        fireEvent.click(screen.getByRole('button', { name: /^add memory$/i }));
        await waitFor(() =>
            expect(props.onSubmit).toHaveBeenCalledWith(
                expect.objectContaining({ agent_id: undefined })
            )
        );
    });

    it('prefills an edit', () => {
        renderModal({ editingMemory: ORG_MEMORY });
        expect(screen.getByLabelText(/memory title/i)).toHaveValue('Company holidays');
    });

    it('picks the scope up from the entry being edited', () => {
        renderModal({ editingMemory: AGENT_MEMORY, initialScope: 'org' });
        expect(screen.getByLabelText(/select agent/i)).toHaveValue('a1');
    });

    it('keeps the id on an edit', async () => {
        const props = renderModal({ editingMemory: ORG_MEMORY });
        fireEvent.click(screen.getByRole('button', { name: /save changes/i }));
        await waitFor(() =>
            expect(props.onSubmit).toHaveBeenCalledWith(
                expect.objectContaining({ id: 'mem_1' })
            )
        );
    });

    it('closes on success', async () => {
        const props = renderModal();
        fill();
        fireEvent.click(screen.getByRole('button', { name: /^add memory$/i }));
        await waitFor(() => expect(props.onClose).toHaveBeenCalled());
    });

    it('stays open when the save fails', async () => {
        // Closing on failure discards what the user typed and tells them it
        // worked.
        vi.spyOn(console, 'error').mockImplementation(() => {});
        const props = renderModal({
            onSubmit: vi.fn().mockRejectedValue(new Error('nope')),
        });
        fill();
        fireEvent.click(screen.getByRole('button', { name: /^add memory$/i }));
        await waitFor(() => expect(props.onSubmit).toHaveBeenCalled());
        expect(props.onClose).not.toHaveBeenCalled();
    });

    it('re-enables the button after a failure', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
        renderModal({ onSubmit: vi.fn().mockRejectedValue(new Error('nope')) });
        fill();
        const button = screen.getByRole('button', { name: /^add memory$/i });
        fireEvent.click(button);
        await waitFor(() => expect(button).toBeEnabled());
    });

    it('shows progress while saving', async () => {
        let release: () => void = () => {};
        renderModal({
            onSubmit: vi.fn(() => new Promise<void>((r) => (release = () => r()))),
        });
        fill();
        fireEvent.click(screen.getByRole('button', { name: /^add memory$/i }));
        expect(await screen.findByText(/creating memory/i)).toBeInTheDocument();
        release();
    });

    it('labels progress differently on an edit', async () => {
        let release: () => void = () => {};
        renderModal({
            editingMemory: ORG_MEMORY,
            onSubmit: vi.fn(() => new Promise<void>((r) => (release = () => r()))),
        });
        fireEvent.click(screen.getByRole('button', { name: /save changes/i }));
        expect(await screen.findByText(/saving changes/i)).toBeInTheDocument();
        release();
    });
});
