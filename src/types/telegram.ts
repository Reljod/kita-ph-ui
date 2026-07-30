export type TelegramDirection = 'inbound' | 'outbound';

/** Who wrote an outbound message: the org's agent, or a human in the inbox. */
export type TelegramSender = 'user' | 'agent' | 'member';

export interface TelegramIntegration {
    connected: boolean;
    bot_id?: number | null;
    bot_username?: string | null;
    bot_name?: string | null;
    /** Never the real token — the API only ever returns a mask. */
    masked_token?: string | null;
    webhook_url?: string | null;
    agent_id?: string | null;
    auto_reply: boolean;
    status?: string | null;
    error_message?: string | null;
    created_at?: string | null;
    updated_at?: string | null;
}

export interface TelegramThread {
    id: string;
    telegram_chat_id: number;
    chat_type: string;
    title?: string | null;
    username?: string | null;
    first_name?: string | null;
    last_name?: string | null;
    display_name: string;
    /** null means "follow the integration's default". */
    auto_reply?: boolean | null;
    unread_count: number;
    last_message_at?: string | null;
    last_message_preview?: string | null;
    created_at: string;
    updated_at: string;
}

export interface TelegramMessage {
    id: string;
    thread_id: string;
    direction: TelegramDirection;
    sender: TelegramSender;
    text: string;
    telegram_message_id?: number | null;
    created_at: string;
}

export interface TelegramConnectRequest {
    bot_token: string;
    agent_id?: string;
    auto_reply?: boolean;
}

export interface TelegramIntegrationUpdate {
    agent_id?: string;
    auto_reply?: boolean;
}

export interface TelegramThreadUpdate {
    auto_reply?: boolean | null;
}
