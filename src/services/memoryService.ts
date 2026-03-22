import { api } from '@/lib/api';
import { RagCreateRequest, RagResponse, RagUpdateRequest } from '@/types/memory';

export const memoryService = {
    getAll: async (agentId?: string): Promise<RagResponse[]> => {
        const headers = agentId ? { 'x-agent-id': agentId } : {};
        const response = await api.get('/memory', { headers });
        return response.data;
    },

    create: async (data: RagCreateRequest): Promise<RagResponse> => {
        const headers = data.agent_id ? { 'x-agent-id': data.agent_id } : {};
        const response = await api.post('/memory', data, { headers });
        return response.data;
    },

    update: async (id: string, data: RagUpdateRequest, agentId?: string): Promise<RagResponse> => {
        const headers = agentId ? { 'x-agent-id': agentId } : {};
        const response = await api.put(`/memory/${id}`, data, { headers });
        return response.data;
    },

    delete: async (id: string, agentId?: string): Promise<void> => {
        const headers = agentId ? { 'x-agent-id': agentId } : {};
        await api.delete(`/memory/${id}`, { headers });
    },

    search: async (query: string, agentId?: string, limit: number = 5): Promise<RagResponse[]> => {
        const headers = agentId ? { 'x-agent-id': agentId } : {};
        const response = await api.get('/memory/search', {
            params: { query, limit },
            headers
        });
        return response.data;
    }
};
