'use client';

import { useParams, useRouter } from 'next/navigation';
import { AgentEditForm } from '@/components/agents/AgentEditForm';
import { ArrowLeft, Edit2 } from 'lucide-react';

export default function AgentViewPage() {
    const params = useParams();
    const agentId = params.agentId as string;
    const router = useRouter();

    return (
        <div className="flex-1 bg-slate-50 min-h-screen overflow-y-auto pb-20">
            {/* Top Navigation Bar */}
            <div className="sticky top-0 z-30 w-full bg-white/80 backdrop-blur-md border-b border-slate-100 px-8 py-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <button 
                        onClick={() => router.push('/agents')}
                        className="p-2 -ml-2 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-full transition-all"
                    >
                        <ArrowLeft size={20} />
                    </button>
                    <div>
                        <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">Agent Profile</h2>
                        <h1 className="text-xl font-extrabold text-slate-900 tracking-tight leading-none">View Agent Details</h1>
                    </div>
                </div>
                
                <button
                    onClick={() => router.push(`/agents/${agentId}/edit`)}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all flex items-center gap-2 text-sm font-bold shadow-lg shadow-indigo-100"
                >
                    <Edit2 size={16} /> EDIT AGENT
                </button>
            </div>

            <AgentEditForm agentId={agentId} readOnly={true} />
        </div>
    );
}
