/**
 * Tests for the Knowledge Base page and its upload modal.
 *
 * Upload is a three-call handshake — initiate, PUT the bytes, complete — and
 * a failure at any step must not leave the file looking ingested. The modal
 * runs that per file in a batch, so these cases care about what happens to the
 * other files when one of them fails.
 *
 * The page's own job is scope and the pending-status poll.
 */

import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const get = vi.fn();
vi.mock('@/lib/api', () => ({ api: { get: (...args: unknown[]) => get(...args) } }));

const knowledgeService = {
    getAll: vi.fn(),
    initiateUpload: vi.fn(),
    uploadFile: vi.fn(),
    completeUpload: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
};
vi.mock('@/services/knowledgeService', () => ({ knowledgeService }));

const { renderWithQuery } = await import('../support/render');
const { FileStatus } = await import('@/types/knowledge');
const KnowledgePage = (await import('@/app/(main)/knowledge-base/page')).default;
const { AddKnowledgeModal } = await import('@/components/knowledge/AddKnowledgeModal');

const AGENTS = [
    { id: 'a1', name: 'Scribe', role: 'writer' },
    { id: 'a2', name: 'Scout', role: 'researcher' },
];

const A_FILE = {
    id: 'file_1',
    filename: 'handbook.pdf',
    extension: 'pdf',
    size: 2048,
    org_id: 'org_1',
    status: FileStatus.COMPLETED,
    created_at: '2026-03-04T10:00:00Z',
    updated_at: '2026-03-04T10:00:00Z',
};

const AGENT_FILE = {
    ...A_FILE,
    id: 'file_2',
    filename: 'runbook.md',
    extension: 'md',
    agent_id: 'a1',
};

beforeEach(() => {
    get.mockReset().mockResolvedValue({ data: AGENTS });
    knowledgeService.getAll.mockReset().mockResolvedValue([A_FILE]);
    knowledgeService.delete.mockReset().mockResolvedValue(undefined);
    knowledgeService.update.mockReset().mockResolvedValue(A_FILE);
    knowledgeService.initiateUpload
        .mockReset()
        .mockResolvedValue({ file_id: 'file_new', upload_url: 'https://up/x', method: 'POST' });
    knowledgeService.uploadFile.mockReset().mockResolvedValue(undefined);
    knowledgeService.completeUpload.mockReset().mockResolvedValue(undefined);
});

async function renderPage() {
    const result = renderWithQuery(<KnowledgePage />);
    await screen.findByText('handbook.pdf');
    return result;
}

describe('the knowledge base page', () => {
    it('shows a loading state first', () => {
        renderWithQuery(<KnowledgePage />);
        expect(screen.getByText(/loading knowledge base/i)).toBeInTheDocument();
    });

    it('starts organization-wide', async () => {
        await renderPage();
        expect(knowledgeService.getAll).toHaveBeenCalledWith(undefined);
    });

    it('lists the files', async () => {
        await renderPage();
        expect(screen.getByText('handbook.pdf')).toBeInTheDocument();
    });

    it('survives the agent list failing', async () => {
        get.mockRejectedValue(new Error('boom'));
        await renderPage();
        expect(screen.getByText('handbook.pdf')).toBeInTheDocument();
    });

    describe('the scope toggle', () => {
        it('switches to agent scope', async () => {
            await renderPage();
            fireEvent.click(screen.getByText('Agent Specific'));
            await waitFor(() => expect(knowledgeService.getAll).toHaveBeenCalledWith('a1'));
        });

        it('offers the picker only in agent scope', async () => {
            await renderPage();
            expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
            fireEvent.click(screen.getByText('Agent Specific'));
            expect(await screen.findByRole('combobox')).toBeInTheDocument();
        });

        it('refetches for another agent', async () => {
            await renderPage();
            fireEvent.click(screen.getByText('Agent Specific'));
            fireEvent.change(await screen.findByRole('combobox'), {
                target: { value: 'a2' },
            });
            await waitFor(() => expect(knowledgeService.getAll).toHaveBeenCalledWith('a2'));
        });

        it('goes back to org scope', async () => {
            await renderPage();
            fireEvent.click(screen.getByText('Agent Specific'));
            await waitFor(() => expect(knowledgeService.getAll).toHaveBeenCalledWith('a1'));
            fireEvent.click(screen.getByText('Organization Wide'));
            await waitFor(() =>
                expect(knowledgeService.getAll).toHaveBeenLastCalledWith(undefined)
            );
        });
    });

    describe('search', () => {
        beforeEach(() => knowledgeService.getAll.mockResolvedValue([A_FILE, AGENT_FILE]));

        it('filters by filename', async () => {
            await renderPage();
            fireEvent.change(screen.getByPlaceholderText(/search knowledge/i), {
                target: { value: 'handbook' },
            });
            expect(screen.queryByText('runbook.md')).not.toBeInTheDocument();
        });

        it('also matches the extension', async () => {
            // "show me the markdown" is a reasonable thing to type.
            await renderPage();
            fireEvent.change(screen.getByPlaceholderText(/search knowledge/i), {
                target: { value: 'md' },
            });
            expect(screen.getByText('runbook.md')).toBeInTheDocument();
        });

        it('ignores case', async () => {
            await renderPage();
            fireEvent.change(screen.getByPlaceholderText(/search knowledge/i), {
                target: { value: 'HANDBOOK' },
            });
            expect(screen.getByText('handbook.pdf')).toBeInTheDocument();
        });

        it('says what it searched for when nothing matches', async () => {
            await renderPage();
            fireEvent.change(screen.getByPlaceholderText(/search knowledge/i), {
                target: { value: 'zzz' },
            });
            expect(screen.getByText(/matching "zzz"/)).toBeInTheDocument();
        });

        it('does not offer to upload from a failed search', async () => {
            await renderPage();
            fireEvent.change(screen.getByPlaceholderText(/search knowledge/i), {
                target: { value: 'zzz' },
            });
            expect(
                screen.queryByText(/upload your first document/i)
            ).not.toBeInTheDocument();
        });
    });

    describe('the empty state', () => {
        beforeEach(() => knowledgeService.getAll.mockResolvedValue([]));

        it('explains an empty organization', async () => {
            renderWithQuery(<KnowledgePage />);
            expect(
                await screen.findByText(/no organization-wide knowledge base files/i)
            ).toBeInTheDocument();
        });

        it('explains an empty agent scope differently', async () => {
            renderWithQuery(<KnowledgePage />);
            await screen.findByText(/no knowledge found/i);
            fireEvent.click(screen.getByText('Agent Specific'));
            expect(
                await screen.findByText(/doesn't have any specific knowledge/i)
            ).toBeInTheDocument();
        });

        it('offers to upload the first document', async () => {
            renderWithQuery(<KnowledgePage />);
            expect(
                await screen.findByText(/upload your first document/i)
            ).toBeInTheDocument();
        });

        it('opens the modal from that prompt', async () => {
            renderWithQuery(<KnowledgePage />);
            fireEvent.click(await screen.findByText(/upload your first document/i));
            expect(await screen.findByText('Add to Knowledge Base')).toBeInTheDocument();
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
            fireEvent.click(screen.getByTitle('Delete file'));
            expect(await screen.findByText('Delete Knowledge File')).toBeInTheDocument();
        });

        it('names the file', async () => {
            await renderPage();
            fireEvent.click(screen.getByTitle('Delete file'));
            expect(await screen.findByText(/"handbook.pdf"/)).toBeInTheDocument();
        });

        it('does nothing until confirmed', async () => {
            await renderPage();
            fireEvent.click(screen.getByTitle('Delete file'));
            await screen.findByText('Delete Knowledge File');
            expect(knowledgeService.delete).not.toHaveBeenCalled();
        });

        it('deletes on confirm', async () => {
            await renderPage();
            fireEvent.click(screen.getByTitle('Delete file'));
            fireEvent.click(await screen.findByRole('button', { name: /^delete$/i }));
            await waitFor(() =>
                expect(knowledgeService.delete).toHaveBeenCalledWith('file_1')
            );
        });

        it('can be cancelled', async () => {
            await renderPage();
            fireEvent.click(screen.getByTitle('Delete file'));
            fireEvent.click(await screen.findByRole('button', { name: /cancel/i }));
            expect(knowledgeService.delete).not.toHaveBeenCalled();
        });

        it('names the file when deleting from a card', async () => {
            await renderPage();
            fireEvent.click(screen.getByTitle('Grid View'));
            fireEvent.click(screen.getByTitle('Delete knowledge'));
            expect(await screen.findByText(/"handbook.pdf"/)).toBeInTheDocument();
        });
    });

    describe('the pending poll', () => {
        it('keeps polling while a file is still being ingested', async () => {
            // A pending file becomes searchable only once the API finishes
            // embedding it, and nothing pushes that to the client.
            knowledgeService.getAll.mockResolvedValue([
                { ...A_FILE, status: FileStatus.PENDING },
            ]);
            renderWithQuery(<KnowledgePage />);
            await screen.findByText('handbook.pdf');
            const before = knowledgeService.getAll.mock.calls.length;
            await waitFor(
                () =>
                    expect(knowledgeService.getAll.mock.calls.length).toBeGreaterThan(
                        before
                    ),
                { timeout: 6000 }
            );
        });

        it('stops once everything has completed', async () => {
            await renderPage();
            const before = knowledgeService.getAll.mock.calls.length;
            await new Promise((resolve) => setTimeout(resolve, 3500));
            expect(knowledgeService.getAll.mock.calls.length).toBe(before);
        });
    });

    it('opens the upload modal', async () => {
        await renderPage();
        fireEvent.click(screen.getByText('Add Knowledge'));
        expect(await screen.findByText('Add to Knowledge Base')).toBeInTheDocument();
    });

    it('opens the edit modal on a row', async () => {
        await renderPage();
        fireEvent.click(screen.getByTitle('Edit metadata'));
        expect(await screen.findByText('Edit Knowledge')).toBeInTheDocument();
    });
});

describe('AddKnowledgeModal', () => {
    function renderModal(overrides: Record<string, unknown> = {}) {
        const props = {
            isOpen: true,
            onClose: vi.fn(),
            onSuccess: vi.fn(),
            agents: AGENTS,
            ...overrides,
        };
        renderWithQuery(
            <AddKnowledgeModal
                {...(props as unknown as React.ComponentProps<typeof AddKnowledgeModal>)}
            />
        );
        return props;
    }

    function aFile(name: string, type = 'text/plain') {
        return new File(['hello'], name, { type });
    }

    function attach(...files: File[]) {
        const input = document.querySelector<HTMLInputElement>('input[type="file"]')!;
        fireEvent.change(input, { target: { files } });
    }

    it('renders nothing when closed', () => {
        renderModal({ isOpen: false });
        expect(screen.queryByText('Add to Knowledge Base')).not.toBeInTheDocument();
    });

    it('titles itself for an upload', () => {
        renderModal();
        expect(screen.getByText('Add to Knowledge Base')).toBeInTheDocument();
    });

    it('titles itself for an edit', () => {
        renderModal({ editingFile: A_FILE });
        expect(screen.getByText('Edit Knowledge')).toBeInTheDocument();
    });

    it('cannot submit with nothing attached', () => {
        renderModal();
        expect(screen.getByRole('button', { name: /upload to knowledge/i })).toBeDisabled();
    });

    it('queues a selected file', () => {
        renderModal();
        attach(aFile('notes.txt'));
        expect(screen.getByText('notes.txt')).toBeInTheDocument();
    });

    it('counts the queue', () => {
        renderModal();
        attach(aFile('a.txt'), aFile('b.txt'));
        expect(screen.getByText(/batch queue \(2\)/i)).toBeInTheDocument();
    });

    it('accepts a drop', () => {
        renderModal();
        const dropzone = screen.getByText(/click to upload/i).closest('div')!.parentElement!;
        fireEvent.drop(dropzone, { dataTransfer: { files: [aFile('dropped.txt')] } });
        expect(screen.getByText('dropped.txt')).toBeInTheDocument();
    });

    it('adds to the queue rather than replacing it', () => {
        renderModal();
        attach(aFile('a.txt'));
        attach(aFile('b.txt'));
        expect(screen.getByText('a.txt')).toBeInTheDocument();
        expect(screen.getByText('b.txt')).toBeInTheDocument();
    });

    it('drops a queued file', () => {
        renderModal();
        attach(aFile('a.txt'), aFile('b.txt'));
        const row = screen.getByText('a.txt').closest('.flex.items-center.gap-3')!;
        fireEvent.click(row.querySelector('button')!);
        expect(screen.queryByText('a.txt')).not.toBeInTheDocument();
        expect(screen.getByText('b.txt')).toBeInTheDocument();
    });

    it('shows each file size', () => {
        renderModal();
        attach(aFile('a.txt'));
        expect(screen.getByText(/KB/)).toBeInTheDocument();
    });

    describe('uploading', () => {
        it('initiates with the file metadata', async () => {
            renderModal({ initialScope: 'org' });
            attach(aFile('notes.txt'));
            fireEvent.click(screen.getByRole('button', { name: /upload 1 file/i }));
            await waitFor(() =>
                expect(knowledgeService.initiateUpload).toHaveBeenCalledWith(
                    expect.objectContaining({ filename: 'notes.txt', agent_id: undefined })
                )
            );
        });

        it('scopes the upload to the agent', async () => {
            renderModal({ initialScope: 'agent', initialAgentId: 'a2' });
            attach(aFile('notes.txt'));
            fireEvent.click(screen.getByRole('button', { name: /upload 1 file/i }));
            await waitFor(() =>
                expect(knowledgeService.initiateUpload).toHaveBeenCalledWith(
                    expect.objectContaining({ agent_id: 'a2' })
                )
            );
        });

        it('puts the bytes at the signed url', async () => {
            renderModal();
            attach(aFile('notes.txt'));
            fireEvent.click(screen.getByRole('button', { name: /upload 1 file/i }));
            await waitFor(() =>
                expect(knowledgeService.uploadFile).toHaveBeenCalledWith(
                    'https://up/x',
                    expect.any(File),
                    'POST',
                    undefined
                )
            );
        });

        it('completes the upload afterwards', async () => {
            // Without this the row exists in Mongo but never gets embedded.
            renderModal();
            attach(aFile('notes.txt'));
            fireEvent.click(screen.getByRole('button', { name: /upload 1 file/i }));
            await waitFor(() =>
                expect(knowledgeService.completeUpload).toHaveBeenCalledWith('file_new')
            );
        });

        it('applies a custom filename to the first file', async () => {
            renderModal();
            attach(aFile('notes.txt'));
            fireEvent.change(screen.getByLabelText(/filename/i), {
                target: { value: 'renamed.txt' },
            });
            fireEvent.click(screen.getByRole('button', { name: /upload 1 file/i }));
            await waitFor(() =>
                expect(knowledgeService.initiateUpload).toHaveBeenCalledWith(
                    expect.objectContaining({ filename: 'renamed.txt' })
                )
            );
        });

        it('leaves the rest of a batch under their own names', async () => {
            renderModal();
            attach(aFile('a.txt'), aFile('b.txt'));
            fireEvent.change(screen.getByLabelText(/filename/i), {
                target: { value: 'renamed.txt' },
            });
            fireEvent.click(screen.getByRole('button', { name: /upload 2 files/i }));
            await waitFor(() =>
                expect(knowledgeService.initiateUpload).toHaveBeenCalledTimes(2)
            );
            expect(knowledgeService.initiateUpload.mock.calls[1][0].filename).toBe('b.txt');
        });

        it('uploads every file in the batch', async () => {
            renderModal();
            attach(aFile('a.txt'), aFile('b.txt'), aFile('c.txt'));
            fireEvent.click(screen.getByRole('button', { name: /upload 3 files/i }));
            await waitFor(() =>
                expect(knowledgeService.completeUpload).toHaveBeenCalledTimes(3)
            );
        });

        it('reports the batch when it lands', async () => {
            const props = renderModal();
            attach(aFile('a.txt'));
            fireEvent.click(screen.getByRole('button', { name: /upload 1 file/i }));
            await waitFor(() => expect(props.onSuccess).toHaveBeenCalled(), {
                timeout: 6000,
            });
        });

        it('closes once it lands', async () => {
            const props = renderModal();
            attach(aFile('a.txt'));
            fireEvent.click(screen.getByRole('button', { name: /upload 1 file/i }));
            await waitFor(() => expect(props.onClose).toHaveBeenCalled(), {
                timeout: 6000,
            });
        });

        it('marks a failed file', async () => {
            vi.spyOn(console, 'error').mockImplementation(() => {});
            knowledgeService.uploadFile.mockRejectedValue(new Error('storage down'));
            renderModal();
            attach(aFile('a.txt'));
            fireEvent.click(screen.getByRole('button', { name: /upload 1 file/i }));
            await waitFor(() => expect(knowledgeService.uploadFile).toHaveBeenCalled());
            expect(knowledgeService.completeUpload).not.toHaveBeenCalled();
        });

        it('stays open when a file fails', async () => {
            // Closing would claim the upload worked.
            vi.spyOn(console, 'error').mockImplementation(() => {});
            knowledgeService.uploadFile.mockRejectedValue(new Error('storage down'));
            const props = renderModal();
            attach(aFile('a.txt'));
            fireEvent.click(screen.getByRole('button', { name: /upload 1 file/i }));
            await waitFor(() => expect(knowledgeService.uploadFile).toHaveBeenCalled());
            await new Promise((resolve) => setTimeout(resolve, 1200));
            expect(props.onClose).not.toHaveBeenCalled();
        });

        it('keeps going after one file in a batch fails', async () => {
            // One bad file must not strand the rest of the queue.
            vi.spyOn(console, 'error').mockImplementation(() => {});
            knowledgeService.uploadFile
                .mockRejectedValueOnce(new Error('storage down'))
                .mockResolvedValue(undefined);
            renderModal();
            attach(aFile('bad.txt'), aFile('good.txt'));
            fireEvent.click(screen.getByRole('button', { name: /upload 2 files/i }));
            await waitFor(() =>
                expect(knowledgeService.completeUpload).toHaveBeenCalledTimes(1)
            );
        });

        it('shows progress while uploading', async () => {
            let release: () => void = () => {};
            knowledgeService.uploadFile.mockReturnValue(
                new Promise<void>((r) => (release = () => r()))
            );
            renderModal();
            attach(aFile('a.txt'));
            fireEvent.click(screen.getByRole('button', { name: /upload 1 file/i }));
            expect(await screen.findByText(/uploading files/i)).toBeInTheDocument();
            release();
        });
    });

    describe('editing metadata', () => {
        it('prefills the filename', () => {
            renderModal({ editingFile: A_FILE });
            expect(screen.getByLabelText(/filename/i)).toHaveValue('handbook.pdf');
        });

        it('hides the dropzone', () => {
            // There is nothing to re-upload; only the metadata is editable.
            renderModal({ editingFile: A_FILE });
            expect(screen.queryByText(/click to upload/i)).not.toBeInTheDocument();
        });

        it('saves the new filename', async () => {
            renderModal({ editingFile: A_FILE });
            fireEvent.change(screen.getByLabelText(/filename/i), {
                target: { value: 'renamed.pdf' },
            });
            fireEvent.click(screen.getByRole('button', { name: /save changes/i }));
            await waitFor(() =>
                expect(knowledgeService.update).toHaveBeenCalledWith(
                    'file_1',
                    expect.objectContaining({ filename: 'renamed.pdf' })
                )
            );
        });

        it('picks the scope up from the file', async () => {
            renderModal({ editingFile: AGENT_FILE, initialScope: 'org' });
            fireEvent.click(screen.getByRole('button', { name: /save changes/i }));
            await waitFor(() =>
                expect(knowledgeService.update).toHaveBeenCalledWith(
                    'file_2',
                    expect.objectContaining({ agent_id: 'a1' })
                )
            );
        });

        it('closes on success', async () => {
            const props = renderModal({ editingFile: A_FILE });
            fireEvent.click(screen.getByRole('button', { name: /save changes/i }));
            await waitFor(() => expect(props.onClose).toHaveBeenCalled());
        });

        it('stays open when the save fails', async () => {
            vi.spyOn(console, 'error').mockImplementation(() => {});
            knowledgeService.update.mockRejectedValue(new Error('nope'));
            const props = renderModal({ editingFile: A_FILE });
            fireEvent.click(screen.getByRole('button', { name: /save changes/i }));
            await waitFor(() => expect(knowledgeService.update).toHaveBeenCalled());
            expect(props.onClose).not.toHaveBeenCalled();
        });
    });
});
