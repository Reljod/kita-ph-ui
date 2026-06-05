export enum FileStatus {
    PENDING = 'pending',
    COMPLETED = 'completed',
    FAILED = 'failed'
}

export interface FileResponse {
    id: string;
    filename: string;
    extension: string;
    size: number;
    content_type?: string;
    org_id: string;
    agent_id?: string;
    metadata?: Record<string, any>;
    status: FileStatus;
    created_at: string;
    updated_at: string;
}

export interface FileUploadRequest {
    filename: string;
    size: number;
    content_type?: string;
    agent_id?: string;
    metadata?: Record<string, any>;
}

export interface FileUpdateRequest {
    filename?: string;
    agent_id?: string;
    metadata?: Record<string, any>;
}

export interface FileUploadResponse {
    file_id: string;
    upload_url: string;
    method: 'POST' | 'TUS';
    token?: string;
}
