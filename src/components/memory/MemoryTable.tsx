'use client';

import { RagResponse } from '@/types/memory';
import { 
    User, 
    Globe, 
    Trash2, 
    Calendar, 
    Database, 
    BrainCircuit,
    Edit2,
    MoreHorizontal,
    Type
} from 'lucide-react';

interface Props {
    memories: RagResponse[];
    onDelete: (id: string) => void;
    onEdit: (memory: RagResponse) => void;
}

export function MemoryTable({ memories, onDelete, onEdit }: Props) {
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
        <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-slate-50/50 border-b border-slate-100">
                            <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">Title / Prompt</th>
                            <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">Scope</th>
                            <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">Content Preview</th>
                            <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">Last Updated</th>
                            <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-400 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                        {memories.map((memory) => (
                            <tr key={memory.id} className="hover:bg-slate-50/80 group cursor-pointer" onClick={() => onEdit(memory)}>
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-9 h-9 rounded-xl bg-slate-50 flex items-center justify-center shrink-0 border border-slate-100 group-hover:bg-white transition-colors">
                                            <Type size={18} className="text-indigo-500" />
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-sm font-bold text-slate-900 truncate max-w-[200px]" title={memory.title}>
                                                {memory.title}
                                            </p>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <div className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-tight
                                        ${memory.agent_id
                                            ? 'bg-indigo-50 text-indigo-700 border border-indigo-100'
                                            : 'bg-emerald-50 text-emerald-700 border border-emerald-100'}`}
                                    >
                                        {memory.agent_id ? <User size={10} /> : <Globe size={10} />}
                                        {memory.agent_id ? 'Agent' : 'Global'}
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <p className="text-sm font-medium text-slate-500 truncate max-w-[300px]">
                                        {memory.content}
                                    </p>
                                </td>
                                <td className="px-6 py-4 text-sm font-medium text-slate-500">
                                    <div className="flex items-center gap-1.5">
                                        <Calendar size={14} className="text-slate-300" />
                                        {formatDate(memory.updated_at)}
                                    </div>
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <div className="relative flex items-center justify-end">
                                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); onEdit(memory); }}
                                            className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                                            title="Edit memory"
                                        >
                                            <Edit2 size={16} />
                                        </button>
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); onDelete(memory.id); }}
                                            className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                                            title="Delete memory"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                    <MoreHorizontal size={18} className="text-slate-200 ml-auto group-hover:opacity-0 transition-opacity" />
                                </div>
                            </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
