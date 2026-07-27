'use client';

import { useState, useEffect } from 'react';
import { Loader2, User, Globe } from 'lucide-react';
import { Agent } from '@/types/agents';
import { RagCreateRequest, RagResponse } from '@/types/memory';
import { Modal } from '@/components/common/Modal';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (data: RagCreateRequest | RagResponse) => Promise<void>;
    agents: Agent[];
    initialScope?: 'agent' | 'org';
    initialAgentId?: string;
    editingMemory?: RagResponse | null;
}

export function AddMemoryModal({
    isOpen,
    onClose,
    onSubmit,
    agents,
    initialScope = 'agent',
    initialAgentId,
    editingMemory
}: Props) {
    const [scope, setScope] = useState<'agent' | 'org'>(initialScope);
    const [agentId, setAgentId] = useState('');
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (editingMemory) {
            setScope(editingMemory.agent_id ? 'agent' : 'org');
            setAgentId(editingMemory.agent_id || (agents.length > 0 ? agents[0].id : ''));
            setTitle(editingMemory.title);
            setContent(editingMemory.content);
        } else {
            setScope(initialScope);
            setAgentId(initialAgentId || (agents.length > 0 ? agents[0].id : ''));
            setTitle('');
            setContent('');
        }
    }, [editingMemory, isOpen, agents, initialScope, initialAgentId]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            if (editingMemory) {
                await onSubmit({
                    ...editingMemory,
                    title,
                    content,
                    agent_id: scope === 'agent' ? agentId : undefined
                } as RagResponse);
            } else {
                await onSubmit({
                    title,
                    content,
                    agent_id: scope === 'agent' ? agentId : undefined
                });
            }
            onClose();
        } catch (error) {
            console.error('Failed to save memory:', error);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={editingMemory ? 'Edit Memory' : 'Add New Memory'}
        >
            <form onSubmit={handleSubmit} className="px-8 py-8 space-y-6">
                {/* Scope Selector */}
                <div className="space-y-3">
                    <label className="text-sm font-semibold text-slate-700">Memory Scope</label>
                    <div className="flex bg-slate-50 p-1.5 rounded-2xl border border-slate-100">
                        <button
                            type="button"
                            onClick={() => setScope('agent')}
                            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all
                                ${scope === 'agent'
                                    ? 'bg-white text-indigo-600 shadow-sm border border-slate-100'
                                    : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            <User size={16} />
                            Agent Specific
                        </button>
                        <button
                            type="button"
                            onClick={() => setScope('org')}
                            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all
                                ${scope === 'org'
                                    ? 'bg-white text-indigo-600 shadow-sm border border-slate-100'
                                    : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            <Globe size={16} />
                            Organization Wide
                        </button>
                    </div>
                </div>

                {/* Agent Selector (if agent scope) */}
                {scope === 'agent' && (
                    <div className="space-y-2">
                        <label htmlFor="memory-agent" className="text-sm font-semibold text-slate-700">Select Agent</label>
                        <select
                            id="memory-agent"
                            value={agentId}
                            onChange={(e) => setAgentId(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all appearance-none"
                        >
                            {agents.map((agent) => (
                                <option key={agent.id} value={agent.id}>
                                    {agent.name} ({agent.role})
                                </option>
                            ))}
                        </select>
                    </div>
                )}

                {/* Memory Title */}
                <div className="space-y-2">
                    <label htmlFor="memory-title" className="text-sm font-semibold text-slate-700">Memory Title / Query</label>
                    <input
                        id="memory-title"
                        type="text"
                        required
                        placeholder="e.g. User Greeting Preferences"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all placeholder:text-slate-400"
                    />
                </div>

                {/* Content */}
                <div className="space-y-2">
                    <label htmlFor="memory-content" className="text-sm font-semibold text-slate-700">Content</label>
                    <textarea
                        id="memory-content"
                        required
                        rows={4}
                        placeholder="Describe the memory content here..."
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all placeholder:text-slate-400 resize-none"
                    />
                </div>

                <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold text-lg shadow-lg shadow-indigo-200 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                >
                    {isSubmitting ? (
                        <>
                            <Loader2 className="animate-spin" size={20} />
                            {editingMemory ? 'Saving Changes...' : 'Creating Memory...'}
                        </>
                    ) : (
                        editingMemory ? 'Save Changes' : 'Add Memory'
                    )}
                </button>
            </form>
        </Modal>
    );
}
