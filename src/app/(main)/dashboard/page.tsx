'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Agent } from '@/types/agents';
import { AgentGrid } from '@/components/dashboard/AgentGrid';
import { Bot, Sparkles, Loader2 } from 'lucide-react';

export default function DashboardPage() {
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
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-50 text-indigo-600 text-sm font-semibold mb-6">
                        <Sparkles size={16} /> My Workspace
                    </div>

                    {agents.length === 0 ? (
                        <>
                            <div className="w-20 h-20 bg-indigo-100 text-indigo-600 rounded-3xl flex items-center justify-center mb-8 mx-auto shadow-sm">
                                <Bot size={40} />
                            </div>
                            <h1 className="text-4xl md:text-5xl font-bold mb-4 tracking-tight text-slate-900">
                                Build your <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600">Perfect Agent</span>
                            </h1>
                            <p className="text-slate-500 text-lg max-w-md mx-auto">
                                You don&apos;t have any agents yet. Use the Kita API to create your first one.
                            </p>
                        </>
                    ) : (
                        <>
                            <h1 className="text-4xl md:text-5xl font-bold mb-4 tracking-tight text-slate-900">
                                Select an Agent
                            </h1>
                            <p className="text-slate-500 text-lg max-w-md mx-auto">
                                Choose an agent to start collaborating, or drag to reorganize.
                            </p>
                        </>
                    )}
                </div>

                {agents.length > 0 && <AgentGrid agents={agents} />}
            </div>
        </>
    );
}
