'use client';

import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Agent, ChatItem, Message } from '@/types/agents';
import { ChatView } from '@/components/chat/ChatView';
import { ChevronLeft, Loader2 } from 'lucide-react';

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
    const { agentId, chatId } = useParams<{ agentId: string; chatId?: string }>();
    const router = useRouter();

    // Fetch agent info + chats + messages in one pass
    const { data, isLoading, isError } = useQuery({
        queryKey: ['agent-chat', agentId, chatId],
        queryFn: async () => {
            // 1. Fetch agent info (from the list, then find our agent)
            const agentsRes = await api.get('/agent');
            const agents: any[] = agentsRes.data ?? [];
            const rawAgent = agents.find((a: any) => a.id === agentId);
            if (!rawAgent) throw new Error('Agent not found');

            const agent: Agent = {
                id: rawAgent.id,
                name: rawAgent.name,
                role: rawAgent.role,
                avatar: rawAgent.avatar ?? `https://api.dicebear.com/7.x/bottts/svg?seed=${rawAgent.id}&backgroundColor=2563eb`,
                color: rawAgent.color ?? 'bg-blue-600',
            };

            // 2. Fetch chat history list
            const chatsRes = await api.get(`/agent/${agentId}/chat?preview=true`);
            const chats: ChatItem[] = chatsRes.data ?? [];

            // 3. Determine which chat to load
            let activeChatId: string | null = chatId ?? null;
            if (!activeChatId && chats.length > 0) {
                // Auto-redirect to latest chat if no chatId specified
                activeChatId = chats[0].id;
                router.replace(`/agents/${agentId}/chat/${activeChatId}`);
            }

            // 4. Fetch messages for the active chat
            let messages: Message[] = [];
            if (activeChatId) {
                const msgsRes = await api.get(`/agent/${agentId}/chat/${activeChatId}`);
                messages = parseBackendMessages(msgsRes.data?.messages ?? []);
            }

            return { agent, chats, activeChatId, messages };
        },
        staleTime: 0, // Always fresh on page load
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
                <button
                    onClick={() => router.push('/dashboard')}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors text-sm"
                >
                    <ChevronLeft size={16} /> Back to Dashboard
                </button>
            </div>
        );
    }

    return (
        <ChatView
            agent={data.agent}
            initialChatId={data.activeChatId}
            initialChats={data.chats}
            initialMessages={data.messages}
        />
    );
}
