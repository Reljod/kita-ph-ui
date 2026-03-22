export interface RagResponse {
    id: string;
    org_id: string;
    agent_id?: string;
    content: string;
    title: string;
    status: 'pending' | 'completed' | 'error';
    updated_at: string;
}

export interface RagCreateRequest {
    content: string;
    title: string;
    agent_id?: string;
}

export interface RagUpdateRequest {
    content?: string;
    title?: string;
}
