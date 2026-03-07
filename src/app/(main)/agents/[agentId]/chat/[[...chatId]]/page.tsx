'use client';

import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Agent, ChatItem, Message } from '@/types/agents';
import { ChatView } from '@/components/chat/ChatView';
import { Loader2 } from 'lucide-react';

function parseBackendMessages(backendMessages: any[]): Message[] {
    return backendMessages
        .map((msg: any, index: number) => {
            const content = msg.parts
                ? msg.parts
                    .filter((part: any) => part.part_kind === 'user-prompt' || part.part_kind === 'text')
                    .map((part: any) => part.content)
                    .join('\n')
                : msg.content || '';
            return {
                id: `${msg.id || msg.run_id || crypto.randomUUID()}-${msg.kind}-${index}`,
                role: (msg.kind === 'request' ? 'user' : 'agent') as 'user' | 'agent',
                content,
            };
        })
        .filter((msg) => msg.content.trim() !== '');
}

export default function AgentChatPage() {
    const params = useParams();
    const agentId = params.agentId as string;
    const chatIdArray = params.chatId as string[] | undefined;
    const chatId = chatIdArray?.[0] || null;

    const { data, isLoading, isError } = useQuery({
        queryKey: ['agent-chat-data', agentId, chatId],
        queryFn: async () => {
            // 1. Fetch all agents
            const agentsRes = await api.get('/agent');
            const agents: any[] = agentsRes.data ?? [];
            const rawAgent = agents.find((a: any) => a.id === agentId);
            if (!rawAgent) throw new Error('Agent not found');

            const mapAgent = (a: any): Agent => ({
                id: a.id,
                name: a.name,
                role: a.role,
                avatar: a.avatar ?? `https://api.dicebear.com/7.x/bottts/svg?seed=${a.id}&backgroundColor=2563eb`,
                color: a.color ?? 'bg-blue-600',
                updated_at: a.updated_at,
            });

            const agent = mapAgent(rawAgent);
            const allAgents = agents.map(mapAgent);

            // 2. Fetch chat history list
            const chatsRes = await api.get(`/agent/${agentId}/chat?preview=true`);
            const chats: ChatItem[] = chatsRes.data ?? [];

            // 3. Fetch messages if we have a chatId
            let messages: Message[] = [];
            if (chatId) {
                const msgsRes = await api.get(`/agent/${agentId}/chat/${chatId}`);
                messages = parseBackendMessages(msgsRes.data?.messages ?? []);
            }

            return { agent, allAgents, chats, activeChatId: chatId, messages };
        },
        staleTime: 5000,
    });

    if (isLoading) {
        return (
            <div className="flex-1 flex items-center justify-center">
                <Loader2 className="animate-spin text-indigo-600" size={32} />
            </div>
        );
    }

    if (isError || !data) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center gap-4 text-slate-500">
                <p className="text-lg font-medium">Could not load this agent.</p>
            </div>
        );
    }

    return (
        <ChatView
            key={agentId} // Remount only when agent changes, not when chatId changes
            agent={data.agent}
            allAgents={data.allAgents}
            initialChatId={data.activeChatId}
            initialChats={data.chats}
            initialMessages={data.messages}
        />
    );
}
