'use client';

import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Agent } from '@/types/agents';
import { ChatView, parseBackendMessages } from '@/components/chat/ChatView';
import { Loader2 } from 'lucide-react';


/** What /agent returns before it is mapped onto the client-side Agent. */
type RawAgent = {
    id: string;
    name: string;
    role: string;
    avatar?: string;
    color?: string;
    updated_at?: string;
};

export default function AgentChatPage() {
    const params = useParams();
    const agentId = params.agentId as string;
    const chatIdArray = params.chatId as string[] | undefined;
    const chatId = chatIdArray?.[0] || null;

    // 1. Query all agents
    const { data: agents = [], isLoading: isAgentsLoading, isError: isAgentsError } = useQuery({
        queryKey: ['agents-list'],
        queryFn: async () => {
            const res = await api.get('/agent');
            return res.data ?? [];
        },
        staleTime: 30000,
    });

    // 2. Query chat history list for this agent
    const { data: chats = [] } = useQuery({
        queryKey: ['agent-chats', agentId],
        queryFn: async () => {
            const res = await api.get(`/agent/${agentId}/chat?preview=true`);
            return res.data ?? [];
        },
        staleTime: 5000,
    });

    // 3. Query messages for the active chat ID
    const { data: messages = [] } = useQuery({
        queryKey: ['chat-messages', agentId, chatId],
        queryFn: async () => {
            if (!chatId) return [];
            const res = await api.get(`/agent/${agentId}/chat/${chatId}`);
            return parseBackendMessages(res.data?.messages ?? []);
        },
        enabled: !!chatId,
        staleTime: 10000,
    });

    const rawAgent = agents.find((a: RawAgent) => a.id === agentId);

    const mapAgent = (a: RawAgent): Agent => ({
        id: a.id,
        name: a.name,
        role: a.role,
        avatar: a.avatar ?? `https://api.dicebear.com/7.x/bottts/svg?seed=${a.id}&backgroundColor=2563eb`,
        color: a.color ?? 'bg-blue-600',
        updated_at: a.updated_at,
    });

    // Order matters: the loading check used to also cover `!rawAgent`, which
    // made the error branch below unreachable. A failed /agent query left the
    // spinner up forever instead of saying so.
    if (isAgentsError || (!isAgentsLoading && !rawAgent)) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center gap-4 text-slate-500">
                <p className="text-lg font-medium">Could not load this agent.</p>
            </div>
        );
    }

    if (isAgentsLoading || !rawAgent) {
        return (
            <div className="flex-1 flex items-center justify-center">
                <Loader2 className="animate-spin text-indigo-600" size={32} />
            </div>
        );
    }

    const agent = mapAgent(rawAgent);
    const allAgents = agents.map(mapAgent);

    return (
        <ChatView
            key={agentId} // Remount only when agent changes, not when chatId changes
            agent={agent}
            allAgents={allAgents}
            initialChatId={chatId}
            initialChats={chats}
            initialMessages={messages}
        />
    );
}
