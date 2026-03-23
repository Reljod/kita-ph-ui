export interface Tool {
    id: string;
    name: string;
    description: string;
    created_at?: string;
    updated_at?: string;
}

export interface ToolRegisterRequest {
    name: string;
}
