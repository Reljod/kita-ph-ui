'use client';

import { RagResponse } from '@/types/memory';
import { User, Globe, Trash2, Calendar, Database } from 'lucide-react';

interface Props {
    memory: RagResponse;
    onDelete: (id: string) => void;
    onEdit: (memory: RagResponse) => void;
}

export function MemoryCard({ memory, onDelete, onEdit }: Props) {
    const isAgentScoped = !!memory.agent_id;

    const formatDate = (dateStr: string) => {
        try {
            return new Intl.DateTimeFormat('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric'
            }).format(new Date(dateStr));
        } catch (e) {
            return dateStr;
        }
    };

    return (
        <div
            onClick={() => onEdit(memory)}
            className="group relative bg-white border border-slate-200 rounded-3xl p-6 shadow-xl shadow-slate-200/50 transition-all duration-300 hover:border-indigo-200 hover:shadow-indigo-100/50 flex flex-col h-full cursor-pointer"
        >
            {/* Action Menu - Delete */}
            <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onDelete(memory.id);
                    }}
                    className="p-2 bg-red-50 text-red-600 rounded-full hover:bg-red-100 transition-colors shadow-sm"
                    title="Delete memory"
                >
                    <Trash2 size={16} />
                </button>
            </div>

            {/* Scope Badge */}
            <div className="mb-5">
                <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold
                    ${isAgentScoped
                        ? 'bg-indigo-50 text-indigo-700 border border-indigo-100'
                        : 'bg-emerald-50 text-emerald-700 border border-emerald-100'}`}
                >
                    {isAgentScoped ? <User size={12} /> : <Globe size={12} />}
                    {isAgentScoped ? 'Agent' : 'Organization'}
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 flex flex-col gap-3">
                <h3 className="text-xl font-bold text-slate-900 leading-tight">
                    {memory.title}
                </h3>
                <p className="text-slate-600 text-sm leading-relaxed line-clamp-4 overflow-hidden">
                    {memory.content}
                </p>
            </div>

            {/* Footer */}
            <div className="mt-6 pt-5 border-t border-slate-100 flex items-center justify-between text-[11px] font-medium text-slate-400">
                <div className="flex items-center gap-1.5 uppercase tracking-wider">
                    <Database size={12} />
                    <span>Embedded in DB</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <Calendar size={12} />
                    <span>
                        Updated {formatDate(memory.updated_at)}
                    </span>
                </div>
            </div>
        </div>
    );
}
