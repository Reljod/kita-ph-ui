'use client';

import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Agent, ChatItem, Message } from '@/types/agents';
import { ChatView, parseBackendMessages } from '@/components/chat/ChatView';
import { Loader2 } from 'lucide-react';


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
    const { data: chats = [], isLoading: isChatsLoading } = useQuery({
        queryKey: ['agent-chats', agentId],
        queryFn: async () => {
            const res = await api.get(`/agent/${agentId}/chat?preview=true`);
            return res.data ?? [];
        },
        staleTime: 5000,
    });

    // 3. Query messages for the active chat ID
    const { data: messages = [], isLoading: isMessagesLoading } = useQuery({
        queryKey: ['chat-messages', agentId, chatId],
        queryFn: async () => {
            if (!chatId) return [];
            const res = await api.get(`/agent/${agentId}/chat/${chatId}`);
            return parseBackendMessages(res.data?.messages ?? []);
        },
        enabled: !!chatId,
        staleTime: 10000,
    });

    const rawAgent = agents.find((a: any) => a.id === agentId);

    const mapAgent = (a: any): Agent => ({
        id: a.id,
        name: a.name,
        role: a.role,
        avatar: a.avatar ?? `https://api.dicebear.com/7.x/bottts/svg?seed=${a.id}&backgroundColor=2563eb`,
        color: a.color ?? 'bg-blue-600',
        updated_at: a.updated_at,
    });

    const isPageLoading = isAgentsLoading || !rawAgent;

    if (isPageLoading) {
        return (
            <div className="flex-1 flex items-center justify-center">
                <Loader2 className="animate-spin text-indigo-600" size={32} />
            </div>
        );
    }

    if (isAgentsError || !rawAgent) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center gap-4 text-slate-500">
                <p className="text-lg font-medium">Could not load this agent.</p>
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
