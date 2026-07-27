/**
 * Tests for the dashboard agent cards.
 *
 * The card is a click target inside a click target: the whole surface
 * navigates to the chat, and the menu buttons on top of it must not. Every
 * one of those handlers calls stopPropagation, and forgetting it on any of
 * them would navigate away mid-action — most visibly on Delete.
 */

import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const push = vi.fn();
vi.mock('next/navigation', () => ({
    useRouter: () => ({ push }),
}));

const { AgentCard } = await import('@/components/dashboard/AgentCard');
const { AgentGrid } = await import('@/components/dashboard/AgentGrid');

const AN_AGENT = {
    id: 'agent_1',
    name: 'Researcher',
    role: 'analyst',
    goal: 'find things',
    backstory: 'trained on the archive',
    llm_id: 'llm_1',
    version: 1,
    created_at: '2026-01-15T00:00:00Z',
    updated_at: '2026-01-15T00:00:00Z',
};

const NO_DRAG = {
    draggable: false,
    onDragStart: vi.fn(),
    onDragEnter: vi.fn(),
    onDragEnd: vi.fn(),
    onDragOver: vi.fn(),
};

function renderCard(overrides: Record<string, unknown> = {}) {
    const onDelete = vi.fn();
    render(
        <AgentCard
            agent={AN_AGENT as never}
            onDelete={onDelete}
            dragProps={NO_DRAG}
            isDragOver={false}
            {...overrides}
        />
    );
    return { onDelete };
}

/** The menu toggle is the only button rendered before the menu opens. */
function openMenu() {
    fireEvent.click(screen.getAllByRole('button')[0]);
}

beforeEach(() => {
    push.mockClear();
});

describe('AgentCard', () => {
    it('shows the agent name', () => {
        renderCard();
        expect(screen.getByText('Researcher')).toBeInTheDocument();
    });

    it('shows the role', () => {
        renderCard();
        expect(screen.getByText('analyst')).toBeInTheDocument();
    });

    it('falls back to a generated avatar', () => {
        // Agents have no avatar until one is uploaded; a broken image would
        // be the first thing on the dashboard.
        renderCard();
        expect(screen.getByRole('img')).toHaveAttribute(
            'src',
            expect.stringContaining('dicebear')
        );
    });

    it('uses a supplied avatar', () => {
        renderCard({ agent: { ...AN_AGENT, avatar: 'https://img/x.png' } });
        expect(screen.getByRole('img')).toHaveAttribute('src', 'https://img/x.png');
    });

    it('labels the avatar with the agent name', () => {
        renderCard();
        expect(screen.getByRole('img')).toHaveAccessibleName('Researcher');
    });

    it('opens the chat when the card is clicked', () => {
        renderCard();
        fireEvent.click(screen.getByText('Researcher'));
        expect(push).toHaveBeenCalledWith('/agents/agent_1/chat');
    });

    describe('the action menu', () => {
        it('is closed initially', () => {
            renderCard();
            expect(screen.queryByText('Edit')).not.toBeInTheDocument();
        });

        it('opens on the menu button', () => {
            renderCard();
            openMenu();
            expect(screen.getByText('Edit')).toBeInTheDocument();
        });

        it('opening it does not navigate', () => {
            // The button sits on top of the card's own click handler.
            renderCard();
            openMenu();
            expect(push).not.toHaveBeenCalled();
        });

        it('closes on a second press', () => {
            renderCard();
            openMenu();
            openMenu();
            expect(screen.queryByText('Edit')).not.toBeInTheDocument();
        });

        it('edit navigates to the editor', () => {
            renderCard();
            openMenu();
            fireEvent.click(screen.getByText('Edit'));
            expect(push).toHaveBeenCalledWith('/agents/agent_1/edit');
        });

        it('edit does not also open the chat', () => {
            renderCard();
            openMenu();
            fireEvent.click(screen.getByText('Edit'));
            expect(push).toHaveBeenCalledTimes(1);
        });

        it('delete reports the agent', () => {
            const { onDelete } = renderCard();
            openMenu();
            fireEvent.click(screen.getByText('Delete'));
            expect(onDelete).toHaveBeenCalledWith('agent_1');
        });

        it('delete does not navigate into the agent being deleted', () => {
            const { onDelete } = renderCard();
            openMenu();
            fireEvent.click(screen.getByText('Delete'));
            expect(onDelete).toHaveBeenCalled();
            expect(push).not.toHaveBeenCalled();
        });

        it('closes after an action', () => {
            renderCard();
            openMenu();
            fireEvent.click(screen.getByText('Re-run'));
            expect(screen.queryByText('Edit')).not.toBeInTheDocument();
        });

        it('re-run does not navigate', () => {
            renderCard();
            openMenu();
            fireEvent.click(screen.getByText('Re-run'));
            expect(push).not.toHaveBeenCalled();
        });
    });

    it('highlights while a card is dragged over it', () => {
        const { container } = render(
            <AgentCard
                agent={AN_AGENT as never}
                onDelete={vi.fn()}
                dragProps={NO_DRAG}
                isDragOver
            />
        );
        expect(container.firstElementChild?.className).toContain('ring-4');
    });
});

describe('AgentGrid', () => {
    const agents = [
        { ...AN_AGENT, id: 'a1', name: 'First' },
        { ...AN_AGENT, id: 'a2', name: 'Second' },
    ];

    it('renders every agent', () => {
        render(<AgentGrid agents={agents as never} />);
        expect(screen.getByText('First')).toBeInTheDocument();
        expect(screen.getByText('Second')).toBeInTheDocument();
    });

    it('offers a way to create one', () => {
        render(<AgentGrid agents={agents as never} />);
        expect(screen.getByText('Create New Agent')).toBeInTheDocument();
    });

    it('renders with no agents at all', () => {
        // A new organization sees only the create card.
        render(<AgentGrid agents={[] as never} />);
        expect(screen.getByText('Create New Agent')).toBeInTheDocument();
    });

    it('removes an agent when its card reports a delete', () => {
        render(<AgentGrid agents={agents as never} />);
        const card = screen.getByText('First').closest('.relative')!;
        fireEvent.click(within(card as HTMLElement).getAllByRole('button')[0]);
        fireEvent.click(within(card as HTMLElement).getByText('Delete'));
        expect(screen.queryByText('First')).not.toBeInTheDocument();
    });

    it('leaves the other agents in place', () => {
        render(<AgentGrid agents={agents as never} />);
        const card = screen.getByText('First').closest('.relative')!;
        fireEvent.click(within(card as HTMLElement).getAllByRole('button')[0]);
        fireEvent.click(within(card as HTMLElement).getByText('Delete'));
        expect(screen.getByText('Second')).toBeInTheDocument();
    });

    describe('reordering', () => {
        function dragCardOntoCard(fromName: string, toName: string) {
            const from = screen.getByText(fromName).closest('[draggable]')!;
            const to = screen.getByText(toName).closest('[draggable]')!;
            fireEvent.dragStart(from, { dataTransfer: { effectAllowed: '' } });
            fireEvent.dragEnter(to);
            fireEvent.dragEnd(from);
        }

        it('moves the dragged card to the drop position', () => {
            render(<AgentGrid agents={agents as never} />);
            dragCardOntoCard('First', 'Second');
            const names = screen
                .getAllByRole('heading', { level: 3 })
                .map((h) => h.textContent);
            expect(names).toEqual(['Second', 'First']);
        });

        it('dropping a card on itself changes nothing', () => {
            render(<AgentGrid agents={agents as never} />);
            const card = screen.getByText('First').closest('[draggable]')!;
            fireEvent.dragStart(card, { dataTransfer: { effectAllowed: '' } });
            fireEvent.dragEnter(card);
            fireEvent.dragEnd(card);
            const names = screen
                .getAllByRole('heading', { level: 3 })
                .map((h) => h.textContent);
            expect(names).toEqual(['First', 'Second']);
        });

        it('a drag that never entered another card changes nothing', () => {
            render(<AgentGrid agents={agents as never} />);
            const card = screen.getByText('First').closest('[draggable]')!;
            fireEvent.dragStart(card, { dataTransfer: { effectAllowed: '' } });
            fireEvent.dragEnd(card);
            const names = screen
                .getAllByRole('heading', { level: 3 })
                .map((h) => h.textContent);
            expect(names).toEqual(['First', 'Second']);
        });
    });
});
