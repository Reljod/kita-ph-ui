'use client';

import { Agent } from '@/types/agents';
import { useRouter } from 'next/navigation';
import { MessageSquare, MoreVertical, Edit2, RotateCw, Trash2 } from 'lucide-react';
import { useState } from 'react';

interface Props {
    agent: Agent;
    onDelete: (id: string) => void;
    dragProps: {
        draggable: boolean;
        onDragStart: (e: React.DragEvent) => void;
        onDragEnter: (e: React.DragEvent) => void;
        onDragEnd: (e: React.DragEvent) => void;
        onDragOver: (e: React.DragEvent) => void;
    };
    isDragOver: boolean;
}

export function AgentCard({ agent, onDelete, dragProps, isDragOver }: Props) {
    const router = useRouter();
    const [menuOpen, setMenuOpen] = useState(false);

    const handleCardClick = () => {
        router.push(`/agents/${agent.id}/chat`);
    };

    return (
        <div
            {...dragProps}
            onClick={handleCardClick}
            className={`relative group flex-shrink-0 cursor-pointer w-72 h-80 bg-white rounded-3xl p-6 shadow-xl shadow-slate-200/50 border border-slate-100 snap-center transition-colors duration-200 hover:border-indigo-200 ${isDragOver ? 'scale-105 ring-4 ring-indigo-100' : ''}`}
        >
            {/* Action Menu */}
            <div className="absolute top-4 right-4 z-10">
                <button
                    onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen); }}
                    className="p-2 bg-white/80 backdrop-blur rounded-full text-slate-400 hover:text-slate-800 hover:bg-slate-100 shadow-sm transition-colors"
                >
                    <MoreVertical size={18} />
                </button>
                {menuOpen && (
                    <div className="absolute top-full right-0 mt-2 w-36 bg-white rounded-xl shadow-xl border border-slate-100 overflow-hidden py-1 z-20 animate-in fade-in slide-in-from-top-2">
                        <button
                            className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 transition-colors"
                            onClick={(e) => { e.stopPropagation(); setMenuOpen(false); router.push(`/agents/${agent.id}/edit`); }}
                        >
                            <Edit2 size={14} /> Edit
                        </button>
                        <button
                            className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 transition-colors"
                            onClick={(e) => { e.stopPropagation(); setMenuOpen(false); }}
                        >
                            <RotateCw size={14} /> Re-run
                        </button>
                        <div className="h-px bg-slate-100 my-1" />
                        <button
                            className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                            onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onDelete(agent.id); }}
                        >
                            <Trash2 size={14} /> Delete
                        </button>
                    </div>
                )}
            </div>

            <div className="flex flex-col items-center h-full text-center">
                <div className="relative mb-6">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src={agent.avatar ?? `https://api.dicebear.com/7.x/bottts/svg?seed=${agent.id}`}
                        alt={agent.name}
                        className="w-32 h-32 rounded-full object-cover shadow-md pointer-events-none"
                    />
                    <div className={`absolute bottom-1 right-1 w-6 h-6 rounded-full border-4 border-white ${agent.color ?? 'bg-blue-600'}`} />
                </div>

                <h3 className="text-xl font-bold text-slate-900 mb-1 w-full truncate">{agent.name}</h3>
                <p className="text-sm font-medium text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full mb-auto max-w-full truncate">
                    {agent.role}
                </p>

                <div className="w-full mt-6 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <div className="w-full py-3 bg-slate-900 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2">
                        <MessageSquare size={16} /> Chat Now
                    </div>
                </div>
            </div>
        </div>
    );
}
