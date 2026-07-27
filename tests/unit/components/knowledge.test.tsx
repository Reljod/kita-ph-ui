/**
 * Tests for the knowledge card and table.
 *
 * Both surfaces exist to answer two questions at a glance: has this file
 * finished being ingested, and who can see it. The status badge and the scope
 * badge carry that, and both are derived rather than stored, so they are what
 * these cases pin down.
 *
 * `formatSize` gets its own attention because it is the one piece of real
 * arithmetic in either file.
 */

import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { KnowledgeCard } from '@/components/knowledge/KnowledgeCard';
import { KnowledgeTable } from '@/components/knowledge/KnowledgeTable';
import { FileStatus, type FileResponse } from '@/types/knowledge';

const A_FILE: FileResponse = {
    id: 'file_1',
    filename: 'handbook.pdf',
    extension: 'pdf',
    size: 2048,
    org_id: 'org_1',
    status: FileStatus.COMPLETED,
    created_at: '2026-03-04T10:00:00Z',
    updated_at: '2026-03-04T10:00:00Z',
};

function renderCard(overrides: Partial<FileResponse> = {}) {
    const onDelete = vi.fn();
    render(<KnowledgeCard file={{ ...A_FILE, ...overrides }} onDelete={onDelete} />);
    return { onDelete };
}

function renderTable(files: FileResponse[] = [A_FILE]) {
    const onDelete = vi.fn();
    const onEdit = vi.fn();
    render(<KnowledgeTable files={files} onDelete={onDelete} onEdit={onEdit} />);
    return { onDelete, onEdit };
}

describe('KnowledgeCard', () => {
    it('shows the filename', () => {
        renderCard();
        expect(screen.getByText('handbook.pdf')).toBeInTheDocument();
    });

    it('shows the extension', () => {
        renderCard();
        expect(screen.getByText('pdf')).toBeInTheDocument();
    });

    it('falls back to a generic label with no extension', () => {
        renderCard({ extension: '' });
        expect(screen.getByText('FILE')).toBeInTheDocument();
    });

    it('labels an org-wide file Organization', () => {
        renderCard();
        expect(screen.getByText('Organization')).toBeInTheDocument();
    });

    it('labels an agent-scoped file Agent', () => {
        renderCard({ agent_id: 'agent_1' });
        expect(screen.getByText('Agent')).toBeInTheDocument();
    });

    describe('the status badge', () => {
        it('shows completed', () => {
            renderCard();
            expect(screen.getByText('completed')).toBeInTheDocument();
        });

        it('shows pending', () => {
            // A file still being embedded is not yet searchable; showing it as
            // done is how someone concludes the RAG is broken.
            renderCard({ status: FileStatus.PENDING });
            expect(screen.getByText('pending')).toBeInTheDocument();
        });

        it('shows failed', () => {
            renderCard({ status: FileStatus.FAILED });
            expect(screen.getByText('failed')).toBeInTheDocument();
        });

        it('marks a failure in red', () => {
            renderCard({ status: FileStatus.FAILED });
            expect(screen.getByText('failed').className).toContain('text-red-700');
        });
    });

    describe('formatSize', () => {
        it.each([
            [0, '0 B'],
            [512, '512 B'],
            [2048, '2 KB'],
            [1536, '1.5 KB'],
            [1024 * 1024, '1 MB'],
            [1024 ** 3, '1 GB'],
            [1024 ** 4, '1 TB'],
        ])('renders %i bytes as %s', (size, expected) => {
            renderCard({ size });
            expect(screen.getByText(expected)).toBeInTheDocument();
        });
    });

    describe('the type icon', () => {
        it.each([
            ['png', 'text-pink-500'],
            ['ts', 'text-blue-500'],
            ['pdf', 'text-indigo-500'],
            ['csv', 'text-emerald-500'],
            ['bin', 'text-slate-400'],
        ])('colours %s by family', (extension, expected) => {
            const { container } = render(
                <KnowledgeCard file={{ ...A_FILE, extension }} onDelete={vi.fn()} />
            );
            expect(container.querySelector(`svg.${expected}`)).toBeTruthy();
        });

        it('recognises an uppercase extension', () => {
            // The API stores whatever the upload sent, so PDF and pdf both
            // reach this component.
            const { container } = render(
                <KnowledgeCard file={{ ...A_FILE, extension: 'PDF' }} onDelete={vi.fn()} />
            );
            expect(container.querySelector('svg.text-indigo-500')).toBeTruthy();
        });
    });

    it('formats the created date', () => {
        renderCard();
        expect(screen.getByText(/Mar 4, 2026/)).toBeInTheDocument();
    });

    it('shows an unparseable date verbatim', () => {
        renderCard({ created_at: 'whenever' });
        expect(screen.getByText(/whenever/)).toBeInTheDocument();
    });

    it('deletes from the delete button', () => {
        const { onDelete } = renderCard();
        fireEvent.click(screen.getByTitle('Delete knowledge'));
        expect(onDelete).toHaveBeenCalledWith('file_1');
    });
});

describe('KnowledgeTable', () => {
    it('renders a row per file', () => {
        renderTable([A_FILE, { ...A_FILE, id: 'file_2', filename: 'notes.md' }]);
        expect(screen.getByText('handbook.pdf')).toBeInTheDocument();
        expect(screen.getByText('notes.md')).toBeInTheDocument();
    });

    it('renders its header with no rows', () => {
        renderTable([]);
        expect(screen.getByText('File Name')).toBeInTheDocument();
    });

    it('shows the size', () => {
        renderTable();
        expect(screen.getByText('2 KB')).toBeInTheDocument();
    });

    it('shows the status', () => {
        renderTable();
        expect(screen.getByText('completed')).toBeInTheDocument();
    });

    it('shows a pending status', () => {
        renderTable([{ ...A_FILE, status: FileStatus.PENDING }]);
        expect(screen.getByText('pending')).toBeInTheDocument();
    });

    it('shows a failed status', () => {
        renderTable([{ ...A_FILE, status: FileStatus.FAILED }]);
        expect(screen.getByText('failed')).toBeInTheDocument();
    });

    it('labels the scope', () => {
        renderTable();
        expect(screen.getByText('Global')).toBeInTheDocument();
    });

    it('labels an agent-scoped row', () => {
        renderTable([{ ...A_FILE, agent_id: 'agent_1' }]);
        expect(screen.getByText('Agent')).toBeInTheDocument();
    });

    it('falls back to a generic extension label', () => {
        renderTable([{ ...A_FILE, extension: '' }]);
        expect(screen.getByText('FILE')).toBeInTheDocument();
    });

    it('picks an icon per row', () => {
        const { container } = render(
            <KnowledgeTable
                files={[{ ...A_FILE, extension: 'jpg' }]}
                onDelete={vi.fn()}
                onEdit={vi.fn()}
            />
        );
        expect(container.querySelector('svg.text-pink-500')).toBeTruthy();
    });

    it('formats the upload date', () => {
        renderTable();
        expect(screen.getByText(/Mar 4, 2026/)).toBeInTheDocument();
    });

    it('falls back to the raw date', () => {
        renderTable([{ ...A_FILE, created_at: 'garbage' }]);
        expect(screen.getByText(/garbage/)).toBeInTheDocument();
    });

    it('opens the metadata editor from the row', () => {
        const { onEdit } = renderTable();
        fireEvent.click(screen.getByText('handbook.pdf'));
        expect(onEdit).toHaveBeenCalledWith(A_FILE);
    });

    it('opens the editor from the edit button exactly once', () => {
        const { onEdit } = renderTable();
        fireEvent.click(screen.getByTitle('Edit metadata'));
        expect(onEdit).toHaveBeenCalledTimes(1);
    });

    it('deletes from the delete button', () => {
        const { onDelete } = renderTable();
        fireEvent.click(screen.getByTitle('Delete file'));
        expect(onDelete).toHaveBeenCalledWith('file_1');
    });

    it('deleting does not open the editor', () => {
        const { onDelete, onEdit } = renderTable();
        fireEvent.click(screen.getByTitle('Delete file'));
        expect(onDelete).toHaveBeenCalled();
        expect(onEdit).not.toHaveBeenCalled();
    });

    it('wires each row to its own file', () => {
        renderTable([A_FILE, { ...A_FILE, id: 'file_2', filename: 'notes.md' }]);
        const row = screen.getByText('notes.md').closest('tr')!;
        expect(within(row).getByTitle('Delete file')).toBeInTheDocument();
    });
});
