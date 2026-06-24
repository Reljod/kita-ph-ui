import { api } from '@/lib/api';
import { FileResponse, FileUploadRequest, FileUploadResponse, FileUpdateRequest } from '@/types/knowledge';
import axios from 'axios';

export const knowledgeService = {
    getAll: async (agentId?: string): Promise<FileResponse[]> => {
        const params = agentId ? { agent_id: agentId } : {};
        const response = await api.get('/files', { params });
        return response.data;
    },

    initiateUpload: async (data: FileUploadRequest): Promise<FileUploadResponse> => {
        const response = await api.post('/files/upload', data);
        return response.data;
    },

    uploadFile: async (uploadUrl: string, file: File, method: 'POST' | 'TUS', token?: string): Promise<void> => {
        if (method === 'POST') {
            // For standard signed upload URLs in Supabase
            // We use axios directly to avoid the global API interceptors
            await axios.put(uploadUrl, file, {
                headers: {
                    'Content-Type': file.type,
                    ...(token ? { 'x-upsert': 'true' } : {})
                }
            });
        } else {
            // TUS would require tus-js-client. 
            // For now, we'll focus on standard uploads (< 6MB) as per the replica request.
            // If TUS is needed, we'd add the client first.
            throw new Error('TUS upload not implemented in this version');
        }
    },

    delete: async (id: string): Promise<void> => {
        await api.delete(`/files/${id}`);
    },

    update: async (id: string, data: FileUpdateRequest): Promise<FileResponse> => {
        const response = await api.patch(`/files/${id}`, data);
        return response.data;
    },

    completeUpload: async (id: string): Promise<void> => {
        await api.post(`/files/${id}/complete`);
    },

    getPreview: async (fileId: string): Promise<Blob> => {
        const response = await api.get(`/files/${fileId}/preview`, {
            responseType: 'blob',
        });
        return response.data;
    },
};
