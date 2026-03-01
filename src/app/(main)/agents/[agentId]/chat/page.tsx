'use client';

import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { ChatView } from '@/components/chat/ChatView';
import { Loader2, ChevronLeft } from 'lucide-react';
import { Agent, ChatItem, Message } from '@/types/agents';

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

export default function AgentChatIndexPage() {
    const { agentId } = useParams<{ agentId: string }>();
    const router = useRouter();

    const { data, isLoading, isError } = useQuery({
        queryKey: ['agent-chat-index', agentId],
        queryFn: async () => {
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

            const chatsRes = await api.get(`/agent/${agentId}/chat?preview=true`);
            const chats: ChatItem[] = chatsRes.data ?? [];

            // Auto-redirect to latest chat
            if (chats.length > 0) {
                router.replace(`/agents/${agentId}/chat/${chats[0].id}`);
                // Still render with what we have while redirect happens
            }

            let messages: Message[] = [];
            if (chats.length > 0) {
                const msgsRes = await api.get(`/agent/${agentId}/chat/${chats[0].id}`);
                messages = parseBackendMessages(msgsRes.data?.messages ?? []);
            }

            return { agent, chats, activeChatId: chats[0]?.id ?? null, messages };
        },
        staleTime: 0,
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
