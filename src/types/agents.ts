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

/**
 * The languages an agent can speak in. Mirrors AgentLanguage in the API —
 * the values are what the backend stores and what selects its fixed prompt
 * block, so they are not display strings.
 */
export const AGENT_LANGUAGES = ['english', 'filipino'] as const;

export type AgentLanguage = (typeof AGENT_LANGUAGES)[number];

export const AGENT_LANGUAGE_LABELS: Record<AgentLanguage, string> = {
    english: 'English',
    filipino: 'Filipino (Taglish)',
};

export interface Agent {
    id: string;
    name: string;
    role: string;
    goal?: string;
    backstory?: string;
    personalities?: string[];
    language?: AgentLanguage;
    llm_id?: string;
    avatar?: string;
    color?: string;
    tools?: string[];
    updated_at?: string;
}
