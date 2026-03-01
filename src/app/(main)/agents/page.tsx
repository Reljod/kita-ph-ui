'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Agent } from '@/types/agents';
import { AgentGrid } from '@/components/dashboard/AgentGrid';
import { Bot, Loader2 } from 'lucide-react';

export default function AgentsPage() {
    const { data: agents = [], isLoading } = useQuery<Agent[]>({
        queryKey: ['agents'],
        queryFn: async () => {
            try {
                const res = await api.get('/agent');
                return (res.data ?? []).map((a: any) => ({
                    id: a.id,
                    name: a.name,
                    role: a.role,
                    avatar: a.avatar ?? `https://api.dicebear.com/7.x/bottts/svg?seed=${a.id}&backgroundColor=2563eb`,
                    color: a.color ?? 'bg-blue-600',
                    updated_at: a.updated_at,
                }));
            } catch {
                return [];
            }
        },
    });

    if (isLoading) {
        return (
            <div className="flex-1 flex items-center justify-center">
                <Loader2 className="animate-spin text-indigo-600" size={32} />
            </div>
        );
    }

    return (
        <>
            <style dangerouslySetInnerHTML={{
                __html: `.hide-scrollbar::-webkit-scrollbar { display: none; }
.hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }`
            }} />
            <div className="flex-1 flex flex-col items-center overflow-hidden py-12 bg-slate-50">
                <div className="text-center mb-12 px-4">
                    <h1 className="text-4xl md:text-5xl font-bold mb-4 tracking-tight text-slate-900">
                        Your <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600">Agents</span>
                    </h1>
                    <p className="text-slate-500 text-lg max-w-md mx-auto">
                        {agents.length === 0
                            ? 'No agents yet. Use the Kita API to create your first one.'
                            : 'All your agents are listed here. Click one to start chatting.'}
                    </p>
                </div>

                {agents.length === 0 && (
                    <div className="w-20 h-20 bg-indigo-100 text-indigo-600 rounded-3xl flex items-center justify-center mx-auto shadow-sm">
                        <Bot size={40} />
                    </div>
                )}

                {agents.length > 0 && <AgentGrid agents={agents} />}
            </div>
        </>
    );
}
