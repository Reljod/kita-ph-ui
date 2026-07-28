import { api } from '@/lib/api';
import {
    TelegramConnectRequest,
    TelegramIntegration,
    TelegramIntegrationUpdate,
    TelegramMessage,
    TelegramThread,
    TelegramThreadUpdate,
} from '@/types/telegram';

const BASE = '/integrations/telegram';

export const telegramService = {
    getIntegration: async (): Promise<TelegramIntegration> => {
        const response = await api.get(`${BASE}/`);
        return response.data;
    },

    connect: async (data: TelegramConnectRequest): Promise<TelegramIntegration> => {
        const response = await api.post(`${BASE}/connect`, data);
        return response.data;
    },

    updateIntegration: async (
        data: TelegramIntegrationUpdate
    ): Promise<TelegramIntegration> => {
        const response = await api.patch(`${BASE}/`, data);
        return response.data;
    },

    disconnect: async (): Promise<void> => {
        await api.delete(`${BASE}/`);
    },

    getThreads: async (): Promise<TelegramThread[]> => {
        const response = await api.get(`${BASE}/threads`);
        return response.data;
    },

    getMessages: async (threadId: string): Promise<TelegramMessage[]> => {
        const response = await api.get(`${BASE}/threads/${threadId}/messages`);
        return response.data;
    },

    sendMessage: async (threadId: string, text: string): Promise<TelegramMessage> => {
        const response = await api.post(`${BASE}/threads/${threadId}/messages`, { text });
        return response.data;
    },

    updateThread: async (
        threadId: string,
        data: TelegramThreadUpdate
    ): Promise<TelegramThread> => {
        const response = await api.patch(`${BASE}/threads/${threadId}`, data);
        return response.data;
    },

    markRead: async (threadId: string): Promise<TelegramThread> => {
        const response = await api.post(`${BASE}/threads/${threadId}/read`);
        return response.data;
    },
};
