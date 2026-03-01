'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Agent } from '@/types/agents';
import { AgentCard } from './AgentCard';
import { Plus } from 'lucide-react';

interface Props {
    agents: Agent[];
}

export function AgentGrid({ agents }: Props) {
    const router = useRouter();
    const [localAgents, setLocalAgents] = useState<Agent[]>(agents);
    const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
    const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

    const handleDragStart = (e: React.DragEvent, index: number) => {
        setDraggedIdx(index);
        e.dataTransfer.effectAllowed = 'move';
        setTimeout(() => (e.target as HTMLElement).classList.add('opacity-50'), 0);
    };

    const handleDragEnter = (e: React.DragEvent, index: number) => {
        e.preventDefault();
        if (draggedIdx !== index) setDragOverIdx(index);
    };

    const handleDragEnd = (e: React.DragEvent) => {
        (e.target as HTMLElement).classList.remove('opacity-50');
        if (draggedIdx !== null && dragOverIdx !== null && draggedIdx !== dragOverIdx) {
            const next = [...localAgents];
            const [item] = next.splice(draggedIdx, 1);
            next.splice(dragOverIdx, 0, item);
            setLocalAgents(next);
        }
        setDraggedIdx(null);
        setDragOverIdx(null);
    };

    const handleDelete = (id: string) => {
        setLocalAgents((prev) => prev.filter((a) => a.id !== id));
    };

    return (
        <div className="w-full max-w-6xl mx-auto flex px-8 gap-6 overflow-x-auto pb-8 snap-x snap-proximity scroll-smooth hide-scrollbar" style={{ willChange: 'scroll-position' }}>
            {localAgents.map((agent, index) => (
                <AgentCard
                    key={agent.id}
                    agent={agent}
                    onDelete={handleDelete}
                    isDragOver={dragOverIdx === index}
                    dragProps={{
                        draggable: true,
                        onDragStart: (e) => handleDragStart(e, index),
                        onDragEnter: (e) => handleDragEnter(e, index),
                        onDragEnd: handleDragEnd,
                        onDragOver: (e) => e.preventDefault(),
                    }}
                />
            ))}

            {/* Create new agent card */}
            <div
                onClick={() => router.push('/dashboard')}
                className="w-72 h-80 rounded-3xl border-2 border-dashed border-slate-300 flex flex-col items-center justify-center text-slate-400 hover:text-indigo-600 hover:border-indigo-400 hover:bg-indigo-50/50 cursor-pointer transition-colors snap-center flex-shrink-0"
            >
                <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-4 transition-colors">
                    <Plus size={32} />
                </div>
                <span className="font-semibold">Create New Agent</span>
            </div>
        </div>
    );
}
