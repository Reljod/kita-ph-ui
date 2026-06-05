'use client';

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { memoryService } from '@/services/memoryService';
import { MemoryCard } from '@/components/memory/MemoryCard';
import { AddMemoryModal } from '@/components/memory/AddMemoryModal';
import { Agent } from '@/types/agents';
import { RagResponse, RagCreateRequest, RagUpdateRequest } from '@/types/memory';
import { Plus, Search, User, Globe, Loader2, BrainCircuit, List, LayoutGrid } from 'lucide-react';
import { MemoryTable } from '@/components/memory/MemoryTable';
import { useEffect } from 'react';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';

export default function MemoryVaultPage() {
    const queryClient = useQueryClient();
    const [scope, setScope] = useState<'agent' | 'org'>('org');
    const [selectedAgentId, setSelectedAgentId] = useState<string>('');
    const [searchQuery, setSearchQuery] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingMemory, setEditingMemory] = useState<RagResponse | null>(null);
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [deletingTitle, setDeletingTitle] = useState<string>('');

    // Fetch Agents
    const { data: agents = [] } = useQuery<Agent[]>({
        queryKey: ['agents'],
        queryFn: async () => {
            try {
                const res = await api.get('/agent');
                const data = res.data ?? [];
                return data;
            } catch {
                return [];
            }
        },
    });

    // Handle initial agent selection
    useEffect(() => {
        if (agents.length > 0 && !selectedAgentId) {
            setSelectedAgentId(agents[0].id);
        }
    }, [agents, selectedAgentId]);

    // Fetch Memories
    const { data: memories = [], isLoading } = useQuery<RagResponse[]>({
        queryKey: ['memories', scope, selectedAgentId],
        queryFn: () => memoryService.getAll(scope === 'agent' ? selectedAgentId : undefined),
        enabled: scope === 'org' || !!selectedAgentId,
    });

    // Handle Search locally
    const filteredMemories = useMemo(() => {
        if (!searchQuery) return memories;
        const lowQuery = searchQuery.toLowerCase();
        return memories.filter(m =>
            m.title.toLowerCase().includes(lowQuery) ||
            m.content.toLowerCase().includes(lowQuery)
        );
    }, [memories, searchQuery]);

    // Mutations
    const createMutation = useMutation({
        mutationFn: (data: RagCreateRequest) => memoryService.create(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['memories'] });
        },
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, data, agentId }: { id: string, data: RagUpdateRequest, agentId?: string }) =>
            memoryService.update(id, data, agentId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['memories'] });
        },
    });

    const deleteMutation = useMutation({
        mutationFn: (id: string) => memoryService.delete(id, scope === 'agent' ? selectedAgentId : undefined),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['memories'] });
            setIsDeleteModalOpen(false);
            setDeletingId(null);
        },
    });

    const confirmDelete = (id: string, title: string) => {
        setDeletingId(id);
        setDeletingTitle(title);
        setIsDeleteModalOpen(true);
    };

    const handleDelete = () => {
        if (deletingId) {
            deleteMutation.mutate(deletingId);
        }
    };

    const handleAddClick = () => {
        setEditingMemory(null);
        setIsModalOpen(true);
    };

    const handleEditClick = (memory: RagResponse) => {
        setEditingMemory(memory);
        setIsModalOpen(true);
    };

    const handleModalSubmit = async (data: RagCreateRequest | RagResponse) => {
        if ('id' in data) {
            // Update
            const { id, title, content, agent_id } = data as RagResponse;
            await updateMutation.mutateAsync({
                id,
                data: { title, content },
                agentId: agent_id
            });
        } else {
            // Create
            await createMutation.mutateAsync(data as RagCreateRequest);
        }
    };

    return (
        <div className="flex-1 flex flex-col bg-slate-50 min-h-0 overflow-y-auto">
            <div className="max-w-7xl mx-auto w-full px-6 py-8 md:px-10 md:py-12 space-y-10">
                {/* Header Section */}
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                    <div className="space-y-2">
                        <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight">
                            Memory Vault
                        </h1>
                        <p className="text-slate-500 text-lg max-w-2xl">
                            Manage semantic memories embedded for agents and the organization. These memories help your agents provide more accurate and contextual responses.
                        </p>
                    </div>
                    <button
                        onClick={handleAddClick}
                        className="flex items-center justify-center gap-2 px-6 py-3.5 bg-indigo-600 text-white rounded-2xl font-bold shadow-lg shadow-indigo-100 hover:bg-indigo-700 hover:scale-[1.02] active:scale-[0.98] transition-all whitespace-nowrap self-start md:self-auto"
                    >
                        <Plus size={20} />
                        Add Memory
                    </button>
                </div>

                {/* Controls Bar */}
                <div className="flex flex-col lg:flex-row gap-4 lg:items-center justify-between">
                    <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
                        {/* Scope Toggle */}
                        <div className="inline-flex p-1 bg-white border border-slate-200 rounded-2xl shadow-sm">
                            <button
                                onClick={() => setScope('agent')}
                                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all
                                    ${scope === 'agent'
                                        ? 'bg-slate-900 text-white shadow-md'
                                        : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'}`}
                            >
                                <User size={16} />
                                Agent Specific
                            </button>
                            <button
                                onClick={() => setScope('org')}
                                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all
                                    ${scope === 'org'
                                        ? 'bg-slate-900 text-white shadow-md'
                                        : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'}`}
                            >
                                <Globe size={16} />
                                Organization Wide
                            </button>
                        </div>

                        {/* Agent Selector */}
                        {scope === 'agent' && agents.length > 0 && (
                            <div className="relative group">
                                <select
                                    value={selectedAgentId}
                                    onChange={(e) => setSelectedAgentId(e.target.value)}
                                    className="appearance-none pl-4 pr-10 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all cursor-pointer shadow-sm min-w-[200px]"
                                >
                                    {agents.map(a => (
                                        <option key={a.id} value={a.id}>{a.name}</option>
                                    ))}
                                </select>
                                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 group-hover:text-slate-600 transition-colors">
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="flex flex-1 lg:max-w-xl gap-4 items-center">
                        {/* Search */}
                        <div className="relative flex-1">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                            <input
                                type="text"
                                placeholder="Search memories..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-medium focus:outline-none focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-500 transition-all shadow-sm placeholder:text-slate-400"
                            />
                        </div>

                        {/* View Mode Toggle */}
                        <div className="flex p-1 bg-white border border-slate-200 rounded-2xl shadow-sm h-[46px] items-center">
                            <button
                                onClick={() => setViewMode('list')}
                                className={`p-2 rounded-xl transition-all ${viewMode === 'list' ? 'bg-slate-100 text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
                                title="List View"
                            >
                                <List size={20} />
                            </button>
                            <button
                                onClick={() => setViewMode('grid')}
                                className={`p-2 rounded-xl transition-all ${viewMode === 'grid' ? 'bg-slate-100 text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
                                title="Grid View"
                            >
                                <LayoutGrid size={20} />
                            </button>
                        </div>
                    </div>
                </div>

                {isLoading ? (
                    <div className="flex flex-col items-center justify-center py-24 gap-4">
                        <Loader2 className="animate-spin text-indigo-600" size={48} />
                        <p className="text-slate-500 font-medium">Loading memories...</p>
                    </div>
                ) : filteredMemories.length > 0 ? (
                    viewMode === 'grid' ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {filteredMemories.map((memory) => (
                                <MemoryCard
                                    key={memory.id}
                                    memory={memory}
                                    onDelete={(id) => confirmDelete(id, memory.title)}
                                    onEdit={handleEditClick}
                                />
                            ))}
                        </div>
                    ) : (
                        <MemoryTable 
                            memories={filteredMemories} 
                            onDelete={(id) => {
                                const memory = memories.find(m => m.id === id);
                                confirmDelete(id, memory?.title || 'this memory');
                            }}
                            onEdit={handleEditClick}
                        />
                    )
                ) : (
                    <div className="flex flex-col items-center justify-center py-24 text-center px-4">
                        <div className="w-20 h-20 bg-indigo-50 rounded-3xl flex items-center justify-center text-indigo-400 mb-6">
                            <BrainCircuit size={40} />
                        </div>
                        <h3 className="text-xl font-bold text-slate-900 mb-2">No memories found</h3>
                        <p className="text-slate-500 max-w-sm">
                            {searchQuery
                                ? `We couldn't find any memories matching "${searchQuery}".`
                                : scope === 'agent'
                                    ? "This agent doesn't have any specific memories yet."
                                    : "There are no organization-wide memories yet."}
                        </p>
                        {!searchQuery && (
                            <button
                                onClick={handleAddClick}
                                className="mt-8 text-indigo-600 font-bold hover:text-indigo-700 underline underline-offset-4"
                            >
                                Create your first memory
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* Modal */}
            <AddMemoryModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSubmit={handleModalSubmit}
                agents={agents}
                initialScope={scope}
                initialAgentId={selectedAgentId}
                editingMemory={editingMemory}
            />

            {/* Confirm Delete Modal */}
            <ConfirmDialog
                isOpen={isDeleteModalOpen}
                onClose={() => setIsDeleteModalOpen(false)}
                onConfirm={handleDelete}
                title="Delete Memory"
                description={`Are you sure you want to delete "${deletingTitle}"? This action cannot be undone.`}
                isLoading={deleteMutation.isPending}
            />
        </div>
    );
}
