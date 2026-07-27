/**
 * Tests for the memory card and table.
 *
 * Both render the same rows two ways and share the same trap: the row itself
 * opens the editor, and the delete button sits on top of it. A missing
 * stopPropagation there opens the edit modal for the entry being deleted.
 *
 * The scope badge is the other thing worth pinning — "Agent" and
 * "Organization" are different blast radii, and the only thing separating
 * them is whether `agent_id` is set.
 */

import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { MemoryCard } from '@/components/memory/MemoryCard';
import { MemoryTable } from '@/components/memory/MemoryTable';
import type { RagResponse } from '@/types/memory';

const A_MEMORY: RagResponse = {
    id: 'mem_1',
    org_id: 'org_1',
    content: 'The deploy token cannot read environment variables.',
    title: 'Deploy token scope',
    status: 'completed',
    updated_at: '2026-03-04T10:00:00Z',
};

const AN_AGENT_MEMORY: RagResponse = {
    ...A_MEMORY,
    id: 'mem_2',
    agent_id: 'agent_1',
    title: 'Agent-scoped note',
};

function renderCard(memory: RagResponse = A_MEMORY) {
    const onDelete = vi.fn();
    const onEdit = vi.fn();
    render(<MemoryCard memory={memory} onDelete={onDelete} onEdit={onEdit} />);
    return { onDelete, onEdit };
}

function renderTable(memories: RagResponse[] = [A_MEMORY, AN_AGENT_MEMORY]) {
    const onDelete = vi.fn();
    const onEdit = vi.fn();
    render(<MemoryTable memories={memories} onDelete={onDelete} onEdit={onEdit} />);
    return { onDelete, onEdit };
}

describe('MemoryCard', () => {
    it('shows the title', () => {
        renderCard();
        expect(screen.getByText('Deploy token scope')).toBeInTheDocument();
    });

    it('shows the content', () => {
        renderCard();
        expect(screen.getByText(/deploy token cannot read/i)).toBeInTheDocument();
    });

    it('labels an org-wide entry as Organization', () => {
        renderCard();
        expect(screen.getByText('Organization')).toBeInTheDocument();
    });

    it('labels an agent-scoped entry as Agent', () => {
        // Mislabelling this is how a note meant for one agent looks like it
        // is visible to the whole organization.
        renderCard(AN_AGENT_MEMORY);
        expect(screen.getByText('Agent')).toBeInTheDocument();
    });

    it('formats the updated date', () => {
        renderCard();
        expect(screen.getByText(/Mar 4, 2026/)).toBeInTheDocument();
    });

    it('shows an unparseable date verbatim rather than "Invalid Date"', () => {
        renderCard({ ...A_MEMORY, updated_at: 'sometime' });
        expect(screen.getByText(/sometime/)).toBeInTheDocument();
    });

    it('opens the editor when the card is clicked', () => {
        const { onEdit } = renderCard();
        fireEvent.click(screen.getByText('Deploy token scope'));
        expect(onEdit).toHaveBeenCalledWith(A_MEMORY);
    });

    it('deletes from the delete button', () => {
        const { onDelete } = renderCard();
        fireEvent.click(screen.getByTitle('Delete memory'));
        expect(onDelete).toHaveBeenCalledWith('mem_1');
    });

    it('deleting does not also open the editor', () => {
        const { onDelete, onEdit } = renderCard();
        fireEvent.click(screen.getByTitle('Delete memory'));
        expect(onDelete).toHaveBeenCalled();
        expect(onEdit).not.toHaveBeenCalled();
    });
});

describe('MemoryTable', () => {
    it('renders a row per memory', () => {
        renderTable();
        expect(screen.getByText('Deploy token scope')).toBeInTheDocument();
        expect(screen.getByText('Agent-scoped note')).toBeInTheDocument();
    });

    it('renders its header with no rows at all', () => {
        // An empty vault still needs the column headings, not a blank panel.
        renderTable([]);
        expect(screen.getByText('Title / Prompt')).toBeInTheDocument();
    });

    it('shows the content preview', () => {
        renderTable([A_MEMORY]);
        expect(screen.getByText(/deploy token cannot read/i)).toBeInTheDocument();
    });

    it('labels an org-wide row Global', () => {
        renderTable([A_MEMORY]);
        expect(screen.getByText('Global')).toBeInTheDocument();
    });

    it('labels an agent-scoped row Agent', () => {
        renderTable([AN_AGENT_MEMORY]);
        expect(screen.getByText('Agent')).toBeInTheDocument();
    });

    it('formats the date', () => {
        renderTable([A_MEMORY]);
        expect(screen.getByText(/Mar 4, 2026/)).toBeInTheDocument();
    });

    it('falls back to the raw date string', () => {
        renderTable([{ ...A_MEMORY, updated_at: 'not-a-date' }]);
        expect(screen.getByText(/not-a-date/)).toBeInTheDocument();
    });

    it('opens the editor from the row', () => {
        const { onEdit } = renderTable([A_MEMORY]);
        fireEvent.click(screen.getByText('Deploy token scope'));
        expect(onEdit).toHaveBeenCalledWith(A_MEMORY);
    });

    it('opens the editor from the edit button', () => {
        const { onEdit } = renderTable([A_MEMORY]);
        fireEvent.click(screen.getByTitle('Edit memory'));
        expect(onEdit).toHaveBeenCalledWith(A_MEMORY);
    });

    it('does not open the editor twice from the edit button', () => {
        // The button is inside the row's own click handler.
        const { onEdit } = renderTable([A_MEMORY]);
        fireEvent.click(screen.getByTitle('Edit memory'));
        expect(onEdit).toHaveBeenCalledTimes(1);
    });

    it('deletes from the delete button', () => {
        const { onDelete } = renderTable([A_MEMORY]);
        fireEvent.click(screen.getByTitle('Delete memory'));
        expect(onDelete).toHaveBeenCalledWith('mem_1');
    });

    it('deleting does not open the editor', () => {
        const { onDelete, onEdit } = renderTable([A_MEMORY]);
        fireEvent.click(screen.getByTitle('Delete memory'));
        expect(onDelete).toHaveBeenCalled();
        expect(onEdit).not.toHaveBeenCalled();
    });

    it('wires each row to its own entry', () => {
        // A shared handler closing over the wrong row deletes the wrong note.
        const { onDelete } = renderTable();
        const row = screen.getByText('Agent-scoped note').closest('tr')!;
        fireEvent.click(within(row).getByTitle('Delete memory'));
        expect(onDelete).toHaveBeenCalledWith('mem_2');
    });
});
