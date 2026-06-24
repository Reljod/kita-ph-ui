import { api } from '@/lib/api';
import { Organization } from '@/types/organization';

export const organizationService = {
    getMyOrganizations: async (): Promise<Organization[]> => {
        const response = await api.get('/org/me');
        return response.data;
    },

    getOrganization: async (id: string): Promise<Organization> => {
        const response = await api.get(`/org/${id}`);
        return response.data;
    },

    updateConfig: async (id: string, config: Record<string, any>): Promise<Organization> => {
        const response = await api.patch(`/org/${id}/config`, config);
        return response.data;
    },
};
