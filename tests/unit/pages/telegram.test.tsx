/**
 * Tests for the Integrations and Inbox pages.
 *
 * The Inbox is the human-handoff surface, so the cases that matter are the
 * ones about who is answering: opening a conversation clears its unread
 * badge, replying goes out as the bot, and the per-thread toggle is what
 * takes a conversation away from the agent.
 *
 * On the Integrations page the load-bearing behaviour is the failure path —
 * a rejected bot token has to say *why*, because "something went wrong" gives
 * the user nothing to act on.
 */

import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const get = vi.fn();
vi.mock('@/lib/api', () => ({ api: { get: (...args: unknown[]) => get(...args) } }));

const telegramService = {
    getIntegration: vi.fn(),
    connect: vi.fn(),
    updateIntegration: vi.fn(),
    disconnect: vi.fn(),
    getThreads: vi.fn(),
    getMessages: vi.fn(),
    sendMessage: vi.fn(),
    updateThread: vi.fn(),
    markRead: vi.fn(),
};
vi.mock('@/services/telegramService', () => ({ telegramService }));

const { renderWithQuery } = await import('../support/render');
const IntegrationsPage = (await import('@/app/(main)/integrations/page')).default;
const InboxPage = (await import('@/app/(main)/inbox/page')).default;

const AGENTS = [{ id: 'agent_1', name: 'Support', role: 'support' }];

const DISCONNECTED = { connected: false, auto_reply: true };

const CONNECTED = {
    connected: true,
    bot_id: 123,
    bot_username: 'kita_test_bot',
    bot_name: 'Kita Test',
    masked_token: '123456789:••••••••wxyz',
    agent_id: 'agent_1',
    auto_reply: true,
};

const A_THREAD = {
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

const A_MESSAGE = {
    id: 'm1',
    thread_id: 'thread_1',
    direction: 'inbound' as const,
    sender: 'user' as const,
    text: 'Do you ship to Cebu?',
    created_at: '2026-03-04T10:00:00Z',
};

beforeEach(() => {
    get.mockReset().mockResolvedValue({ data: AGENTS });
    telegramService.getIntegration.mockReset().mockResolvedValue(CONNECTED);
    telegramService.connect.mockReset().mockResolvedValue(CONNECTED);
    telegramService.updateIntegration.mockReset().mockResolvedValue(CONNECTED);
    telegramService.disconnect.mockReset().mockResolvedValue(undefined);
    telegramService.getThreads.mockReset().mockResolvedValue([A_THREAD]);
    telegramService.getMessages.mockReset().mockResolvedValue([A_MESSAGE]);
    telegramService.sendMessage.mockReset().mockResolvedValue(A_MESSAGE);
    telegramService.updateThread.mockReset().mockResolvedValue(A_THREAD);
    telegramService.markRead.mockReset().mockResolvedValue(A_THREAD);
});

describe('IntegrationsPage', () => {
    it('shows the connected bot', async () => {
        renderWithQuery(<IntegrationsPage />);
        expect(await screen.findByText('@kita_test_bot')).toBeInTheDocument();
    });

    it('offers the connect form when nothing is connected', async () => {
        telegramService.getIntegration.mockResolvedValue(DISCONNECTED);
        renderWithQuery(<IntegrationsPage />);
        expect(await screen.findByLabelText(/bot token/i)).toBeInTheDocument();
    });

    it('sends the token to the API', async () => {
        telegramService.getIntegration.mockResolvedValue(DISCONNECTED);
        renderWithQuery(<IntegrationsPage />);

        fireEvent.change(await screen.findByLabelText(/bot token/i), {
            target: { value: '123456789:AAtoken' },
        });
        fireEvent.click(screen.getByRole('button', { name: /connect bot/i }));

        await waitFor(() =>
            expect(telegramService.connect).toHaveBeenCalledWith({
                bot_token: '123456789:AAtoken',
            })
        );
    });

    it('repeats the API’s reason when a token is rejected', async () => {
        // "Something went wrong" would leave the user guessing between a typo,
        // a revoked bot, and a misconfigured webhook URL.
        telegramService.getIntegration.mockResolvedValue(DISCONNECTED);
        telegramService.connect.mockRejectedValue(
            Object.assign(new Error('Request failed'), {
                isAxiosError: true,
                response: {
                    data: { error: { message: 'Telegram rejected this bot token' } },
                },
            })
        );
        renderWithQuery(<IntegrationsPage />);

        fireEvent.change(await screen.findByLabelText(/bot token/i), {
            target: { value: '123456789:AAtoken' },
        });
        fireEvent.click(screen.getByRole('button', { name: /connect bot/i }));

        expect(await screen.findByRole('alert')).toHaveTextContent(
            /Telegram rejected this bot token/
        );
    });

    it('falls back to a generic message when the error carries no detail', async () => {
        telegramService.getIntegration.mockResolvedValue(DISCONNECTED);
        telegramService.connect.mockRejectedValue(new Error('boom'));
        renderWithQuery(<IntegrationsPage />);

        fireEvent.change(await screen.findByLabelText(/bot token/i), {
            target: { value: '123456789:AAtoken' },
        });
        fireEvent.click(screen.getByRole('button', { name: /connect bot/i }));

        expect(await screen.findByRole('alert')).toHaveTextContent(/check the token/i);
    });

    it('rebinds the answering agent', async () => {
        renderWithQuery(<IntegrationsPage />);
        fireEvent.change(await screen.findByLabelText(/answering agent/i), {
            target: { value: '' },
        });
        await waitFor(() =>
            expect(telegramService.updateIntegration).toHaveBeenCalledWith({
                agent_id: '',
            })
        );
    });

    it('toggles the org-level auto-reply', async () => {
        renderWithQuery(<IntegrationsPage />);
        fireEvent.click(await screen.findByRole('checkbox'));
        await waitFor(() =>
            expect(telegramService.updateIntegration).toHaveBeenCalledWith({
                auto_reply: false,
            })
        );
    });

    it('confirms before disconnecting rather than doing it on the first click', async () => {
        renderWithQuery(<IntegrationsPage />);
        fireEvent.click(await screen.findByRole('button', { name: /^disconnect$/i }));

        expect(await screen.findByText(/disconnect telegram\?/i)).toBeInTheDocument();
        expect(telegramService.disconnect).not.toHaveBeenCalled();
    });

    it('disconnects once confirmed', async () => {
        renderWithQuery(<IntegrationsPage />);
        fireEvent.click(await screen.findByRole('button', { name: /^disconnect$/i }));

        const dialog = (await screen.findByText(/disconnect telegram\?/i)).closest('div')!
            .parentElement!;
        fireEvent.click(
            within(dialog).getAllByRole('button', { name: /^disconnect$/i })[0]
        );

        await waitFor(() => expect(telegramService.disconnect).toHaveBeenCalled());
    });
});

describe('InboxPage', () => {
    it('points an unconnected org at the integration page', async () => {
        telegramService.getIntegration.mockResolvedValue(DISCONNECTED);
        renderWithQuery(<InboxPage />);

        expect(await screen.findByText(/no channel connected/i)).toBeInTheDocument();
        expect(screen.getByRole('link', { name: /connect telegram/i })).toHaveAttribute(
            'href',
            '/integrations'
        );
    });

    it('lists the conversations', async () => {
        // The name also renders in the conversation header, so match the list
        // row itself: a bare text query has two hits and never settles.
        renderWithQuery(<InboxPage />);
        expect(
            await screen.findByRole('button', { name: /Ada Lovelace/ })
        ).toBeInTheDocument();
    });

    it('opens the most recent conversation without waiting for a click', async () => {
        renderWithQuery(<InboxPage />);
        expect(await screen.findByLabelText(/reply as your bot/i)).toBeInTheDocument();
        await waitFor(() =>
            expect(telegramService.getMessages).toHaveBeenCalledWith('thread_1')
        );
    });

    it('explains the empty inbox rather than showing a blank pane', async () => {
        telegramService.getThreads.mockResolvedValue([]);
        renderWithQuery(<InboxPage />);
        expect(await screen.findByText(/nothing to read yet/i)).toBeInTheDocument();
    });

    it('clears the unread badge when a conversation is opened', async () => {
        // Opening a conversation is what reading it means; making the user
        // dismiss the badge separately is busywork.
        // Marking read invalidates the thread list, so the refetch has to
        // come back cleared — otherwise the effect sees the same unread count
        // and asks again, forever.
        telegramService.getThreads
            .mockResolvedValueOnce([{ ...A_THREAD, unread_count: 2 }])
            .mockResolvedValue([A_THREAD]);
        renderWithQuery(<InboxPage />);

        await waitFor(() =>
            expect(telegramService.markRead).toHaveBeenCalledWith('thread_1')
        );
    });

    it('does not mark an already-read conversation again', async () => {
        renderWithQuery(<InboxPage />);
        await screen.findByRole('button', { name: /Ada Lovelace/ });
        expect(telegramService.markRead).not.toHaveBeenCalled();
    });

    it('sends a member reply through the bot', async () => {
        renderWithQuery(<InboxPage />);

        fireEvent.change(await screen.findByLabelText(/reply as your bot/i), {
            target: { value: 'Yes, 3 days.' },
        });
        fireEvent.click(screen.getByRole('button', { name: /send reply/i }));

        await waitFor(() =>
            expect(telegramService.sendMessage).toHaveBeenCalledWith(
                'thread_1',
                'Yes, 3 days.'
            )
        );
    });

    it('takes a single conversation away from the agent', async () => {
        renderWithQuery(<InboxPage />);
        await screen.findByLabelText(/reply as your bot/i);

        fireEvent.click(screen.getByRole('checkbox'));

        await waitFor(() =>
            expect(telegramService.updateThread).toHaveBeenCalledWith('thread_1', {
                auto_reply: false,
            })
        );
    });

    it('switches conversations when another is picked', async () => {
        const other = { ...A_THREAD, id: 'thread_2', display_name: 'Grace Hopper' };
        telegramService.getThreads.mockResolvedValue([A_THREAD, other]);
        renderWithQuery(<InboxPage />);

        fireEvent.click(await screen.findByRole('button', { name: /Grace Hopper/ }));

        await waitFor(() =>
            expect(telegramService.getMessages).toHaveBeenCalledWith('thread_2')
        );
    });
});
