export interface Message {
    id: string | number;
    role: 'user' | 'agent' | 'builder';
    content: string;
    streaming?: boolean;
    thinking?: string;
}

export interface ChatItem {
    id: string;
    preview: string;
    updated_at: string;
}

export interface Agent {
    id: string;
    name: string;
    role: string;
    goal?: string;
    backstory?: string;
    personalities?: string[];
    llm_id?: string;
    avatar?: string;
    color?: string;
    tools?: string[];
    config?: Record<string, any>;
    updated_at?: string;
}
