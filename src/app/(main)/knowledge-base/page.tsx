'use client';

import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { knowledgeService } from '@/services/knowledgeService';
import { KnowledgeCard } from '@/components/knowledge/KnowledgeCard';
import { AddKnowledgeModal } from '@/components/knowledge/AddKnowledgeModal';
import { Agent } from '@/types/agents';
import { FileResponse, FileStatus } from '@/types/knowledge';
import { Plus, Search, User, Globe, Loader2, BookOpen, List, LayoutGrid } from 'lucide-react';
import { KnowledgeTable } from '@/components/knowledge/KnowledgeTable';
import { FilePreviewModal } from '@/components/knowledge/FilePreviewModal';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';

export default function KnowledgeBasePage() {
    const queryClient = useQueryClient();
    const [scope, setScope] = useState<'agent' | 'org'>('org');
    const [selectedAgentId, setSelectedAgentId] = useState<string>('');
    const [searchQuery, setSearchQuery] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [deletingFileName, setDeletingFileName] = useState<string>('');
    const [editingFile, setEditingFile] = useState<FileResponse | null>(null);
    const [previewingFile, setPreviewingFile] = useState<FileResponse | null>(null);

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

    // Fetch Knowledge Files
    const { data: files = [], isLoading } = useQuery<FileResponse[]>({
        queryKey: ['knowledge', scope, selectedAgentId],
        queryFn: () => knowledgeService.getAll(scope === 'agent' ? selectedAgentId : undefined),
        enabled: scope === 'org' || !!selectedAgentId,
        refetchInterval: (query) => {
            const files = query.state.data as FileResponse[];
            return files?.some(f => f.status === FileStatus.PENDING) ? 3000 : false;
        }
    });

    // Handle Search locally
    const filteredFiles = useMemo(() => {
        if (!searchQuery) return files;
        const lowQuery = searchQuery.toLowerCase();
        return files.filter(f =>
            f.filename.toLowerCase().includes(lowQuery) ||
            f.extension.toLowerCase().includes(lowQuery)
        );
    }, [files, searchQuery]);

    // Delete Mutation
    const deleteMutation = useMutation({
        mutationFn: (id: string) => knowledgeService.delete(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['knowledge'] });
            setIsDeleteModalOpen(false);
            setDeletingId(null);
        },
    });

    const confirmDelete = (id: string, filename: string) => {
        setDeletingId(id);
        setDeletingFileName(filename);
        setIsDeleteModalOpen(true);
    };

    const handleDelete = () => {
        if (deletingId) {
            deleteMutation.mutate(deletingId);
        }
    };

    const handleAddClick = () => {
        setEditingFile(null);
        setIsModalOpen(true);
    };

    const handleEditClick = (file: FileResponse) => {
        setEditingFile(file);
        setIsModalOpen(true);
    };

    return (
        <div className="flex-1 flex flex-col bg-slate-50 min-h-0 overflow-y-auto">
            <div className="max-w-7xl mx-auto w-full px-6 py-8 md:px-10 md:py-12 space-y-10">
                {/* Header Section */}
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                    <div className="space-y-2">
                        <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight">
                            Knowledge Base
                        </h1>
                        <p className="text-slate-500 text-lg max-w-2xl">
                            Upload documents, logs, or any files to provide agents with extensive context. These files are indexed and used for RAG (Retrieval Augmented Generation).
                        </p>
                    </div>
                    <button
                        onClick={handleAddClick}
                        className="flex items-center justify-center gap-2 px-6 py-3.5 bg-indigo-600 text-white rounded-2xl font-bold shadow-lg shadow-indigo-100 hover:bg-indigo-700 hover:scale-[1.02] active:scale-[0.98] transition-all whitespace-nowrap self-start md:self-auto"
                    >
                        <Plus size={20} />
                        Add Knowledge
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
                                placeholder="Search knowledge files..."
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
                        <p className="text-slate-500 font-medium">Loading knowledge base...</p>
                    </div>
                ) : filteredFiles.length > 0 ? (
                    viewMode === 'grid' ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {filteredFiles.map((file) => (
                                <KnowledgeCard
                                    key={file.id}
                                    file={file}
                                    onDelete={(id) => confirmDelete(id, file.filename)}
                                    onPreview={setPreviewingFile}
                                />
                            ))}
                        </div>
                    ) : (
                        <KnowledgeTable 
                            files={filteredFiles} 
                            onDelete={(id) => {
                                const file = files.find(f => f.id === id);
                                confirmDelete(id, file?.filename || 'this file');
                            }}
                            onEdit={handleEditClick}
                            onPreview={setPreviewingFile}
                        />
                    )
                ) : (
                    <div className="flex flex-col items-center justify-center py-24 text-center px-4">
                        <div className="w-20 h-20 bg-indigo-50 rounded-3xl flex items-center justify-center text-indigo-400 mb-6">
                            <BookOpen size={40} />
                        </div>
                        <h3 className="text-xl font-bold text-slate-900 mb-2">No knowledge found</h3>
                        <p className="text-slate-500 max-w-sm">
                            {searchQuery
                                ? `We couldn't find any files matching "${searchQuery}".`
                                : scope === 'agent'
                                    ? "This agent doesn't have any specific knowledge base files yet."
                                    : "There are no organization-wide knowledge base files yet."}
                        </p>
                        {!searchQuery && (
                            <button
                                onClick={handleAddClick}
                                className="mt-8 text-indigo-600 font-bold hover:text-indigo-700 underline underline-offset-4"
                            >
                                Upload your first document
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* Modal */}
            <AddKnowledgeModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSuccess={() => queryClient.invalidateQueries({ queryKey: ['knowledge'] })}
                agents={agents}
                initialScope={scope}
                initialAgentId={selectedAgentId}
                editingFile={editingFile}
            />

            {/* File Preview Modal */}
            <FilePreviewModal
                file={previewingFile}
                onClose={() => setPreviewingFile(null)}
            />

            {/* Confirm Delete Modal */}
            <ConfirmDialog
                isOpen={isDeleteModalOpen}
                onClose={() => setIsDeleteModalOpen(false)}
                onConfirm={handleDelete}
                title="Delete Knowledge File"
                description={`Are you sure you want to delete "${deletingFileName}"? This action cannot be undone.`}
                isLoading={deleteMutation.isPending}
            />
        </div>
    );
}
