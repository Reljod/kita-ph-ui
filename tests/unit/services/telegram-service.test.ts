/**
 * Tests for the Telegram service wrapper.
 *
 * Thin, but the paths are load-bearing: a reply posted to the wrong thread id
 * reaches the wrong person, and the org scoping lives entirely in the API's
 * auth context rather than in these URLs — so the URLs themselves have to be
 * exactly right.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api', () => ({
    api: {
        get: vi.fn(),
        post: vi.fn(),
        put: vi.fn(),
        patch: vi.fn(),
        delete: vi.fn(),
    },
}));

const { api } = await import('@/lib/api');
const { telegramService } = await import('@/services/telegramService');

function resolving(data: unknown = {}) {
    return Promise.resolve({ data });
}

beforeEach(() => {
    vi.mocked(api.get).mockReturnValue(resolving());
    vi.mocked(api.post).mockReturnValue(resolving());
    vi.mocked(api.patch).mockReturnValue(resolving());
    vi.mocked(api.delete).mockReturnValue(resolving());
});

describe('telegramService', () => {
    it('reads the integration', async () => {
        vi.mocked(api.get).mockReturnValue(resolving({ connected: true }));
        expect(await telegramService.getIntegration()).toEqual({ connected: true });
        expect(api.get).toHaveBeenCalledWith('/integrations/telegram/');
    });

    it('posts a bot token to the connect endpoint', async () => {
        await telegramService.connect({ bot_token: '123:AA' });
        expect(api.post).toHaveBeenCalledWith('/integrations/telegram/connect', {
            bot_token: '123:AA',
        });
    });

    it('patches the integration', async () => {
        await telegramService.updateIntegration({ auto_reply: false });
        expect(api.patch).toHaveBeenCalledWith('/integrations/telegram/', {
            auto_reply: false,
        });
    });

    it('deletes the integration', async () => {
        await telegramService.disconnect();
        expect(api.delete).toHaveBeenCalledWith('/integrations/telegram/');
    });

    it('lists threads', async () => {
        vi.mocked(api.get).mockReturnValue(resolving([{ id: 't1' }]));
        expect(await telegramService.getThreads()).toEqual([{ id: 't1' }]);
        expect(api.get).toHaveBeenCalledWith('/integrations/telegram/threads');
    });

    it('reads one thread’s messages', async () => {
        await telegramService.getMessages('t1');
        expect(api.get).toHaveBeenCalledWith(
            '/integrations/telegram/threads/t1/messages'
        );
    });

    it('posts a reply to the thread it belongs to', async () => {
        await telegramService.sendMessage('t1', 'hello');
        expect(api.post).toHaveBeenCalledWith(
            '/integrations/telegram/threads/t1/messages',
            { text: 'hello' }
        );
    });

    it('patches a thread', async () => {
        await telegramService.updateThread('t1', { auto_reply: false });
        expect(api.patch).toHaveBeenCalledWith('/integrations/telegram/threads/t1', {
            auto_reply: false,
        });
    });

    it('marks a thread read', async () => {
        await telegramService.markRead('t1');
        expect(api.post).toHaveBeenCalledWith('/integrations/telegram/threads/t1/read');
    });

    it('returns the payload rather than the axios envelope', async () => {
        vi.mocked(api.post).mockReturnValue(resolving({ id: 'm1', text: 'hello' }));
        expect(await telegramService.sendMessage('t1', 'hello')).toEqual({
            id: 'm1',
            text: 'hello',
        });
    });
});
