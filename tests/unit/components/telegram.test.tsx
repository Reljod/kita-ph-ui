/**
 * Tests for the Telegram channel components.
 *
 * Two things here are worth pinning down rather than eyeballing. The bot
 * token is a full-privilege credential, so the connect form must not keep it
 * around or echo it back. And "who is answering this conversation" is the
 * whole point of the handoff: a thread with no opinion of its own has to fall
 * back to the integration's default, and getting that backwards silently
 * hands a conversation to the agent that a human had taken over.
 */

import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { TelegramConnectCard } from '@/components/telegram/TelegramConnectCard';
import { TelegramConversation } from '@/components/telegram/TelegramConversation';
import {
    TelegramThreadList,
    relativeTime,
} from '@/components/telegram/TelegramThreadList';
import type { Agent } from '@/types/agents';
import type {
    TelegramIntegration,
    TelegramMessage,
    TelegramThread,
} from '@/types/telegram';

const AGENTS = [
    { id: 'agent_1', name: 'Support' },
    { id: 'agent_2', name: 'Sales' },
] as Agent[];

const CONNECTED: TelegramIntegration = {
    connected: true,
    bot_id: 123,
    bot_username: 'kita_test_bot',
    bot_name: 'Kita Test',
    masked_token: '123456789:••••••••wxyz',
    agent_id: 'agent_1',
    auto_reply: true,
};

const A_THREAD: TelegramThread = {
    id: 'thread_1',
    telegram_chat_id: 555,
    chat_type: 'private',
    display_name: 'Ada Lovelace',
    username: 'ada',
    unread_count: 0,
    auto_reply: null,
    last_message_at: '2026-03-04T10:00:00Z',
    last_message_preview: 'Do you ship to Cebu?',
    created_at: '2026-03-04T09:00:00Z',
    updated_at: '2026-03-04T10:00:00Z',
};

const MESSAGES: TelegramMessage[] = [
    {
        id: 'm1',
        thread_id: 'thread_1',
        direction: 'inbound',
        sender: 'user',
        text: 'Do you ship to Cebu?',
        created_at: '2026-03-04T10:00:00Z',
    },
    {
        id: 'm2',
        thread_id: 'thread_1',
        direction: 'outbound',
        sender: 'agent',
        text: 'Yes, we do.',
        created_at: '2026-03-04T10:00:05Z',
    },
    {
        id: 'm3',
        thread_id: 'thread_1',
        direction: 'outbound',
        sender: 'member',
        text: 'Adding: it takes 3 days.',
        created_at: '2026-03-04T10:01:00Z',
    },
];

function renderCard(props: Partial<React.ComponentProps<typeof TelegramConnectCard>> = {}) {
    const handlers = {
        onConnect: vi.fn(),
        onDisconnect: vi.fn(),
        onChangeAgent: vi.fn(),
        onToggleAutoReply: vi.fn(),
    };
    render(
        <TelegramConnectCard
            agents={AGENTS}
            isLoading={false}
            isConnecting={false}
            isUpdating={false}
            {...handlers}
            {...props}
        />
    );
    return handlers;
}

describe('TelegramConnectCard', () => {
    it('shows a spinner while the integration is loading', () => {
        const { container } = render(
            <TelegramConnectCard
                agents={[]}
                isLoading
                isConnecting={false}
                isUpdating={false}
                onConnect={vi.fn()}
                onDisconnect={vi.fn()}
                onChangeAgent={vi.fn()}
                onToggleAutoReply={vi.fn()}
            />
        );
        expect(container.querySelector('.animate-spin')).toBeInTheDocument();
    });

    describe('when no bot is connected', () => {
        it('walks the user through BotFather', () => {
            renderCard();
            expect(screen.getByText(/@BotFather/)).toBeInTheDocument();
        });

        it('masks the token field so it is not shoulder-readable', () => {
            renderCard();
            expect(screen.getByLabelText(/bot token/i)).toHaveAttribute(
                'type',
                'password'
            );
        });

        it('submits the trimmed token', () => {
            const { onConnect } = renderCard();
            fireEvent.change(screen.getByLabelText(/bot token/i), {
                target: { value: '  123456789:AAtoken  ' },
            });
            fireEvent.click(screen.getByRole('button', { name: /connect bot/i }));
            expect(onConnect).toHaveBeenCalledWith('123456789:AAtoken');
        });

        it('clears the field once the token has been submitted', () => {
            // The token is a full-privilege credential; leaving it in the DOM
            // after it has served its purpose is free risk.
            renderCard();
            const input = screen.getByLabelText(/bot token/i);
            fireEvent.change(input, { target: { value: '123456789:AAtoken' } });
            fireEvent.click(screen.getByRole('button', { name: /connect bot/i }));
            expect(input).toHaveValue('');
        });

        it('refuses to submit an empty token', () => {
            const { onConnect } = renderCard();
            fireEvent.click(screen.getByRole('button', { name: /connect bot/i }));
            expect(onConnect).not.toHaveBeenCalled();
        });

        it('surfaces the API error so the user knows what to fix', () => {
            renderCard({ connectError: 'Telegram rejected this bot token: Unauthorized' });
            expect(screen.getByRole('alert')).toHaveTextContent(/Unauthorized/);
        });

        it('disables the button while connecting', () => {
            renderCard({ isConnecting: true });
            fireEvent.change(screen.getByLabelText(/bot token/i), {
                target: { value: '123456789:AAtoken' },
            });
            expect(screen.getByRole('button', { name: /connect bot/i })).toBeDisabled();
        });
    });

    describe('when a bot is connected', () => {
        it('shows the bot username', () => {
            renderCard({ integration: CONNECTED });
            expect(screen.getByText('@kita_test_bot')).toBeInTheDocument();
        });

        it('shows only the masked token, never a raw one', () => {
            renderCard({ integration: CONNECTED });
            expect(screen.getByText('123456789:••••••••wxyz')).toBeInTheDocument();
            expect(screen.queryByLabelText(/bot token/i)).not.toBeInTheDocument();
        });

        it('preselects the bound agent', () => {
            renderCard({ integration: CONNECTED });
            expect(screen.getByLabelText(/answering agent/i)).toHaveValue('agent_1');
        });

        it('reports an agent change', () => {
            const { onChangeAgent } = renderCard({ integration: CONNECTED });
            fireEvent.change(screen.getByLabelText(/answering agent/i), {
                target: { value: 'agent_2' },
            });
            expect(onChangeAgent).toHaveBeenCalledWith('agent_2');
        });

        it('reports the auto-reply toggle', () => {
            const { onToggleAutoReply } = renderCard({ integration: CONNECTED });
            fireEvent.click(screen.getByRole('checkbox'));
            expect(onToggleAutoReply).toHaveBeenCalledWith(false);
        });

        it('offers a disconnect', () => {
            const { onDisconnect } = renderCard({ integration: CONNECTED });
            fireEvent.click(screen.getByRole('button', { name: /disconnect/i }));
            expect(onDisconnect).toHaveBeenCalled();
        });

        it('falls back to the bot name when there is no username', () => {
            renderCard({
                integration: { ...CONNECTED, bot_username: null },
            });
            expect(screen.getByText('Kita Test')).toBeInTheDocument();
        });
    });
});

describe('relativeTime', () => {
    const now = new Date('2026-03-04T12:00:00Z');

    it('is empty for a thread that has never been messaged', () => {
        expect(relativeTime(null, now)).toBe('');
    });

    it('reads as "now" under a minute', () => {
        expect(relativeTime('2026-03-04T11:59:30Z', now)).toBe('now');
    });

    it('counts minutes under an hour', () => {
        expect(relativeTime('2026-03-04T11:30:00Z', now)).toBe('30m');
    });

    it('counts hours under a day', () => {
        expect(relativeTime('2026-03-04T09:00:00Z', now)).toBe('3h');
    });

    it('counts days under a week', () => {
        expect(relativeTime('2026-03-01T12:00:00Z', now)).toBe('3d');
    });

    it('falls back to a date beyond a week', () => {
        expect(relativeTime('2026-01-04T12:00:00Z', now)).toMatch(/Jan/);
    });
});

describe('TelegramThreadList', () => {
    it('explains the empty state instead of showing a blank pane', () => {
        render(
            <TelegramThreadList threads={[]} selectedThreadId={null} onSelect={vi.fn()} />
        );
        expect(screen.getByText(/no conversations yet/i)).toBeInTheDocument();
    });

    it('shows the display name and the last message', () => {
        render(
            <TelegramThreadList
                threads={[A_THREAD]}
                selectedThreadId={null}
                onSelect={vi.fn()}
            />
        );
        expect(screen.getByText('Ada Lovelace')).toBeInTheDocument();
        expect(screen.getByText('Do you ship to Cebu?')).toBeInTheDocument();
    });

    it('reports the selected thread to assistive tech', () => {
        render(
            <TelegramThreadList
                threads={[A_THREAD]}
                selectedThreadId="thread_1"
                onSelect={vi.fn()}
            />
        );
        expect(screen.getByRole('button')).toHaveAttribute('aria-current', 'true');
    });

    it('reports a click', () => {
        const onSelect = vi.fn();
        render(
            <TelegramThreadList
                threads={[A_THREAD]}
                selectedThreadId={null}
                onSelect={onSelect}
            />
        );
        fireEvent.click(screen.getByRole('button'));
        expect(onSelect).toHaveBeenCalledWith('thread_1');
    });

    it('badges unread conversations', () => {
        render(
            <TelegramThreadList
                threads={[{ ...A_THREAD, unread_count: 3 }]}
                selectedThreadId={null}
                onSelect={vi.fn()}
            />
        );
        expect(screen.getByLabelText('3 unread')).toHaveTextContent('3');
    });

    it('marks a conversation a human has taken over', () => {
        render(
            <TelegramThreadList
                threads={[{ ...A_THREAD, auto_reply: false }]}
                selectedThreadId={null}
                onSelect={vi.fn()}
            />
        );
        expect(screen.getByText(/human handling/i)).toBeInTheDocument();
    });

    it('does not mark a conversation the agent still owns', () => {
        render(
            <TelegramThreadList
                threads={[A_THREAD]}
                selectedThreadId={null}
                onSelect={vi.fn()}
            />
        );
        expect(screen.queryByText(/human handling/i)).not.toBeInTheDocument();
    });

    it('copes with a thread that has no preview yet', () => {
        render(
            <TelegramThreadList
                threads={[{ ...A_THREAD, last_message_preview: null }]}
                selectedThreadId={null}
                onSelect={vi.fn()}
            />
        );
        expect(screen.getByText(/no messages yet/i)).toBeInTheDocument();
    });
});

function renderConversation(
    props: Partial<React.ComponentProps<typeof TelegramConversation>> = {}
) {
    const handlers = { onSend: vi.fn(), onToggleAutoReply: vi.fn() };
    render(
        <TelegramConversation
            thread={A_THREAD}
            messages={MESSAGES}
            isLoading={false}
            isSending={false}
            defaultAutoReply
            {...handlers}
            {...props}
        />
    );
    return handlers;
}

describe('TelegramConversation', () => {
    it('shows the whole transcript', () => {
        renderConversation();
        expect(screen.getByText('Do you ship to Cebu?')).toBeInTheDocument();
        expect(screen.getByText('Yes, we do.')).toBeInTheDocument();
        expect(screen.getByText('Adding: it takes 3 days.')).toBeInTheDocument();
    });

    it('attributes an agent reply and a human reply differently', () => {
        // Otherwise a member cannot tell which of their own replies the agent
        // sent on their behalf.
        renderConversation();
        expect(screen.getByText('Agent')).toBeInTheDocument();
        expect(screen.getByText('You')).toBeInTheDocument();
    });

    it('does not label the visitor’s own messages', () => {
        renderConversation({ messages: [MESSAGES[0]] });
        expect(screen.queryByText('Agent')).not.toBeInTheDocument();
        expect(screen.queryByText('You')).not.toBeInTheDocument();
    });

    it('inherits the integration default when the thread has no opinion', () => {
        renderConversation({ thread: { ...A_THREAD, auto_reply: null } });
        expect(screen.getByRole('checkbox')).toBeChecked();
    });

    it('honours a thread override over the integration default', () => {
        // The override is exactly what a human takeover is; ignoring it would
        // put the agent back into a conversation someone had claimed.
        renderConversation({
            thread: { ...A_THREAD, auto_reply: false },
            defaultAutoReply: true,
        });
        expect(screen.getByRole('checkbox')).not.toBeChecked();
    });

    it('reports the takeover toggle', () => {
        const { onToggleAutoReply } = renderConversation();
        fireEvent.click(screen.getByRole('checkbox'));
        expect(onToggleAutoReply).toHaveBeenCalledWith(false);
    });

    it('sends a trimmed reply', () => {
        const { onSend } = renderConversation();
        fireEvent.change(screen.getByLabelText(/reply as your bot/i), {
            target: { value: '  on its way  ' },
        });
        fireEvent.click(screen.getByRole('button', { name: /send reply/i }));
        expect(onSend).toHaveBeenCalledWith('on its way');
    });

    it('clears the composer after sending', () => {
        renderConversation();
        const input = screen.getByLabelText(/reply as your bot/i);
        fireEvent.change(input, { target: { value: 'on its way' } });
        fireEvent.click(screen.getByRole('button', { name: /send reply/i }));
        expect(input).toHaveValue('');
    });

    it('refuses to send whitespace', () => {
        const { onSend } = renderConversation();
        fireEvent.change(screen.getByLabelText(/reply as your bot/i), {
            target: { value: '   ' },
        });
        fireEvent.submit(screen.getByLabelText(/reply as your bot/i).closest('form')!);
        expect(onSend).not.toHaveBeenCalled();
    });

    it('does not double-send while a reply is in flight', () => {
        const { onSend } = renderConversation({ isSending: true });
        const form = screen.getByLabelText(/reply as your bot/i).closest('form')!;
        fireEvent.change(screen.getByLabelText(/reply as your bot/i), {
            target: { value: 'again' },
        });
        fireEvent.submit(form);
        expect(onSend).not.toHaveBeenCalled();
    });

    it('says the agent is handling it while auto-reply is on', () => {
        renderConversation();
        expect(screen.getByText(/your agent is answering/i)).toBeInTheDocument();
    });

    it('drops that note once a human has taken over', () => {
        renderConversation({ thread: { ...A_THREAD, auto_reply: false } });
        expect(screen.queryByText(/your agent is answering/i)).not.toBeInTheDocument();
    });

    it('shows a spinner while the transcript loads', () => {
        const { container } = render(
            <TelegramConversation
                thread={A_THREAD}
                messages={[]}
                isLoading
                isSending={false}
                defaultAutoReply
                onSend={vi.fn()}
                onToggleAutoReply={vi.fn()}
            />
        );
        expect(container.querySelector('.animate-spin')).toBeInTheDocument();
    });

    it('shows the visitor’s telegram handle', () => {
        renderConversation();
        expect(within(screen.getByRole('banner')).getByText('@ada')).toBeInTheDocument();
    });
});
