'use client';

import { useParams, useRouter } from 'next/navigation';
import { AgentEditForm } from '@/components/agents/AgentEditForm';
import { ArrowLeft } from 'lucide-react';

export default function AgentEditPage() {
    const params = useParams();
    const agentId = params.agentId as string;
    const router = useRouter();

    return (
        <div className="flex-1 bg-slate-50 min-h-screen overflow-y-auto pb-20">
            {/* Top Navigation Bar */}
            <div className="sticky top-0 z-30 w-full bg-white/80 backdrop-blur-md border-b border-slate-100 px-8 py-4 flex items-center gap-4">
                <button 
                    onClick={() => router.push('/agents')}
                    className="p-2 -ml-2 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-full transition-all"
                >
                    <ArrowLeft size={20} />
                </button>
                <div>
                    <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">Agent Settings</h2>
                    <h1 className="text-xl font-extrabold text-slate-900 tracking-tight leading-none">Configure Workspace</h1>
                </div>
            </div>

            <AgentEditForm agentId={agentId} />
        </div>
    );
}
