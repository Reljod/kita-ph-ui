'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Agent } from '@/types/agents';
import { RagResponse, RagCreateRequest, RagUpdateRequest } from '@/types/memory';
import {
    Save,
    X,
    Plus,
    Trash2,
    Brain,
    User,
    Target,
    ScrollText,
    Sparkles,
    Cpu,
    Edit2,
    Loader2,
    CheckCircle2,
    Hammer,
    Wrench,
    Globe,
    Database,
    Zap,
    ArrowRight,
    Shield
} from 'lucide-react';
import { Tool } from '@/types/tools';
import { useAuthStore } from '@/store/useAuthStore';
import { organizationService } from '@/services/organizationService';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";

interface Props {
    agentId: string;
    readOnly?: boolean;
}

interface Llm {
    id: string;
    name: string;
    provider: string;
    model: string;
}

export function AgentEditForm({ agentId, readOnly = false }: Props) {
    const router = useRouter();
    const queryClient = useQueryClient();
    const [activeTab, setActiveTab] = useState<'details' | 'memory' | 'tools'>('details');
    const [personalities, setPersonalities] = useState<string[]>([]);
    const [newPersonality, setNewPersonality] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);
    const [editingMemory, setEditingMemory] = useState<RagResponse | null>(null);
    const [addingMemory, setAddingMemory] = useState<RagCreateRequest | null>(null);

    // Fetch Agent Data
    const { data: agent, isLoading: isLoadingAgent } = useQuery<Agent>({
        queryKey: ['agent', agentId],
        queryFn: async () => {
            const res = await api.get(`/agent/${agentId}`);
            return res.data;
        },
    });

    // Fetch LLMs
    const { data: llms = [] } = useQuery<Llm[]>({
        queryKey: ['llms'],
        queryFn: async () => {
            const res = await api.get('/llm');
            return res.data;
        },
    });

    // Fetch Agent Memories
    const { data: agentMemories = [], isLoading: isLoadingMemories } = useQuery<RagResponse[]>({
        queryKey: ['agent-memories', agentId],
        queryFn: async () => {
            const res = await api.get(`/agent/${agentId}/memory`);
            return res.data;
        },
    });

    // Fetch Org Memories
    const { data: orgMemories = [] } = useQuery<RagResponse[]>({
        queryKey: ['org-memories'],
        queryFn: async () => {
            const res = await api.get('/memory');
            return res.data;
        },
    });

    // Fetch All Available Tools
    const { data: availableTools = [] } = useQuery<Tool[]>({
        queryKey: ['tools'],
        queryFn: async () => {
            const res = await api.get('/tool');
            return res.data;
        },
    });

    // Fetch Organization for guardrail defaults
    const { user } = useAuthStore();
    const { data: org } = useQuery({
        queryKey: ['organization', user?.org_id],
        queryFn: () => organizationService.getOrganization(user?.org_id!),
        enabled: !!user?.org_id,
    });

    // Form State
    const [formData, setFormData] = useState({
        name: '',
        role: '',
        goal: '',
        backstory: '',
        llm_id: '',
        config: {} as Record<string, any>,
    });

    // Combined Memories - De-duplicate by ID just in case
    const combinedMemories = Array.from(
        new Map<string, RagResponse>([
            ...orgMemories.filter(m => !m.agent_id).map(m => [m.id, m] as [string, RagResponse]),
            ...agentMemories.map(m => [m.id, m] as [string, RagResponse]),
        ]).values()
    ).sort((a: RagResponse, b: RagResponse) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());

    useEffect(() => {
        if (agent) {
            setFormData({
                name: agent.name || '',
                role: agent.role || '',
                goal: agent.goal || '',
                backstory: agent.backstory || '',
                llm_id: agent.llm_id || '',
                config: agent.config || {},
            });
            setPersonalities(agent.personalities || []);
        }
    }, [agent]);

    // Mutations
    const updateAgentMutation = useMutation({
        mutationFn: async (updatedData: Partial<Agent>) => {
            const res = await api.put(`/agent/${agentId}`, updatedData);
            return res.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['agent', agentId] });
            queryClient.invalidateQueries({ queryKey: ['agents'] });
            setSaveSuccess(true);
            setTimeout(() => setSaveSuccess(false), 3000);
        },
    });

    const addMemoryMutation = useMutation({
        mutationFn: async (memory: RagCreateRequest) => {
            const res = await api.post(`/agent/${agentId}/memory`, memory);
            return res.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['agent-memories', agentId] });
            setAddingMemory(null);
        },
    });

    const updateMemoryMutation = useMutation({
        mutationFn: async ({ id, agent_id, data }: { id: string, agent_id?: string, data: RagUpdateRequest }) => {
            const endpoint = agent_id ? `/agent/${agent_id}/memory/${id}` : `/memory/${id}`;
            const res = await api.put(endpoint, data);
            return res.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['agent-memories', agentId] });
            queryClient.invalidateQueries({ queryKey: ['org-memories'] });
            setEditingMemory(null);
        },
    });

    const deleteMemoryMutation = useMutation({
        mutationFn: async ({ id, agent_id }: { id: string, agent_id?: string }) => {
            const endpoint = agent_id ? `/agent/${agent_id}/memory/${id}` : `/memory/${id}`;
            await api.delete(endpoint);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['agent-memories', agentId] });
            queryClient.invalidateQueries({ queryKey: ['org-memories'] });
        },
    });

    const addToolMutation = useMutation({
        mutationFn: async (toolId: string) => {
            const res = await api.post(`/agent/${agentId}/tools/add`, { tool_ids: [toolId] });
            return res.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['agent', agentId] });
        },
    });

    const removeToolMutation = useMutation({
        mutationFn: async (toolId: string) => {
            const res = await api.post(`/agent/${agentId}/tools/remove`, { tool_ids: [toolId] });
            return res.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['agent', agentId] });
        },
    });

    const handleSubmit = async (e: React.FormEvent) => {
        if (readOnly) return;
        e.preventDefault();
        setIsSaving(true);
        try {
            const payload: Record<string, any> = {
                ...formData,
                personalities,
            };
            const hasConfig = formData.config && Object.keys(formData.config).length > 0;
            if (hasConfig) {
                payload.config = formData.config;
            } else {
                delete payload.config;
            }
            await updateAgentMutation.mutateAsync(payload as any);
        } finally {
            setIsSaving(false);
        }
    };

    const handleAddPersonality = () => {
        if (newPersonality.trim() && !personalities.includes(newPersonality.trim())) {
            setPersonalities([...personalities, newPersonality.trim()]);
            setNewPersonality('');
        }
    };

    const removePersonality = (p: string) => {
        setPersonalities(personalities.filter(item => item !== p));
    };

    if (isLoadingAgent) {
        return (
            <div className="flex-1 flex items-center justify-center p-12">
                <Loader2 className="animate-spin text-indigo-600" size={32} />
            </div>
        );
    }

    return (
        <div className="w-full max-w-5xl mx-auto px-4 py-8 animate-in fade-in slide-in-from-bottom-4">
            {/* Memory Edit Modal */}
            <Dialog open={!!editingMemory} onOpenChange={(open) => !open && setEditingMemory(null)}>
                <DialogContent className="sm:max-w-lg rounded-3xl shadow-2xl border-slate-100 p-8">
                    <DialogHeader className="flex-row items-center gap-3 text-indigo-600 mb-6">
                        <Brain size={24} />
                        <DialogTitle className="text-xl font-bold text-slate-900">Edit Memory</DialogTitle>
                    </DialogHeader>
                    {editingMemory && (
                        <>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-1.5 ml-1">Title</label>
                                    <input
                                        type="text"
                                        value={editingMemory.title}
                                        onChange={(e) => setEditingMemory({ ...editingMemory, title: e.target.value })}
                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-400 rounded-xl outline-none transition-all"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-1.5 ml-1">Content</label>
                                    <textarea
                                        value={editingMemory.content}
                                        onChange={(e) => setEditingMemory({ ...editingMemory, content: e.target.value })}
                                        rows={5}
                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-400 rounded-xl outline-none transition-all resize-none"
                                    />
                                </div>
                            </div>
                            <div className="flex gap-3 mt-8">
                                <button
                                    onClick={() => setEditingMemory(null)}
                                    className="flex-1 py-3 text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all"
                                >
                                    CANCEL
                                </button>
                                <button
                                    onClick={() => updateMemoryMutation.mutate({
                                        id: editingMemory.id,
                                        agent_id: editingMemory.agent_id,
                                        data: { title: editingMemory.title, content: editingMemory.content }
                                    })}
                                    className="flex-1 py-3 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-lg shadow-indigo-100 transition-all flex items-center justify-center gap-2"
                                >
                                    {updateMemoryMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                                    SAVE CHANGES
                                </button>
                            </div>
                        </>
                    )}
                </DialogContent>
            </Dialog>

            {/* Memory Add Modal */}
            <Dialog open={!!addingMemory} onOpenChange={(open) => !open && setAddingMemory(null)}>
                <DialogContent className="sm:max-w-lg rounded-3xl shadow-2xl border-slate-100 p-8">
                    <DialogHeader className="flex-row items-center gap-3 text-indigo-600 mb-6">
                        <Brain size={24} />
                        <DialogTitle className="text-xl font-bold text-slate-900">Add Knowledge</DialogTitle>
                    </DialogHeader>
                    {addingMemory && (
                        <>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-1.5 ml-1">Title</label>
                                    <input
                                        type="text"
                                        placeholder="e.g. My Father's Birthday"
                                        value={addingMemory.title}
                                        onChange={(e) => setAddingMemory({ ...addingMemory, title: e.target.value })}
                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-400 rounded-xl outline-none transition-all placeholder:text-slate-300"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-1.5 ml-1">Content</label>
                                    <textarea
                                        placeholder="Add specific context or knowledge..."
                                        value={addingMemory.content}
                                        onChange={(e) => setAddingMemory({ ...addingMemory, content: e.target.value })}
                                        rows={5}
                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-400 rounded-xl outline-none transition-all resize-none placeholder:text-slate-300"
                                    />
                                </div>
                            </div>
                            <div className="flex gap-3 mt-8">
                                <button
                                    onClick={() => setAddingMemory(null)}
                                    className="flex-1 py-3 text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all"
                                >
                                    CANCEL
                                </button>
                                <button
                                    onClick={() => addMemoryMutation.mutate(addingMemory)}
                                    className="flex-1 py-3 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-lg shadow-indigo-100 transition-all flex items-center justify-center gap-2"
                                >
                                    {addMemoryMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                                    ADD KNOWLEDGE
                                </button>
                            </div>
                        </>
                    )}
                </DialogContent>
            </Dialog>

            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10 pb-8 border-b border-slate-100">
                <div className="flex items-center gap-5">
                    <div className={`w-20 h-20 rounded-3xl ${agent?.color || 'bg-indigo-600'} flex items-center justify-center text-white shadow-xl shadow-indigo-100`}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                            src={agent?.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${agentId}`}
                            alt={formData.name}
                            className="w-16 h-16 object-contain"
                        />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">{formData.name || 'Untitled Agent'}</h1>
                        <p className="text-slate-500 font-medium">{formData.role || 'No role defined'}</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    {readOnly ? (
                        <button
                            onClick={() => router.push(`/agents/${agentId}/edit`)}
                            className="px-5 py-2.5 text-sm font-semibold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 shadow-md shadow-indigo-100 transition-all flex items-center gap-2"
                        >
                            <Edit2 size={16} /> Edit Agent
                        </button>
                    ) : (
                        <>
                            <button
                                onClick={() => router.back()}
                                className="px-5 py-2.5 text-sm font-semibold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-all flex items-center gap-2"
                            >
                                <X size={16} /> Cancel
                            </button>
                            <button
                                onClick={handleSubmit}
                                disabled={isSaving}
                                className="px-5 py-2.5 text-sm font-semibold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 shadow-md shadow-indigo-100 transition-all flex items-center gap-2 disabled:opacity-70"
                            >
                                {isSaving ? <Loader2 size={16} className="animate-spin" /> : saveSuccess ? <CheckCircle2 size={16} /> : <Save size={16} />}
                                {isSaving ? 'Saving...' : saveSuccess ? 'Saved!' : 'Save Changes'}
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-8 mb-8 border-b border-slate-100">
                <button
                    onClick={() => setActiveTab('details')}
                    className={`pb-4 text-sm font-bold tracking-wide transition-all relative ${activeTab === 'details' ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'
                        }`}
                >
                    AGENT DETAILS
                    {activeTab === 'details' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-indigo-600 rounded-t-full" />}
                </button>
                <button
                    onClick={() => setActiveTab('memory')}
                    className={`pb-4 text-sm font-bold tracking-wide transition-all relative ${activeTab === 'memory' ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'
                        }`}
                >
                    MEMORY & KNOWLEDGE
                    {activeTab === 'memory' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-indigo-600 rounded-t-full" />}
                </button>
                <button
                    onClick={() => setActiveTab('tools')}
                    className={`pb-4 text-sm font-bold tracking-wide transition-all relative ${activeTab === 'tools' ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'
                        }`}
                >
                    TOOLS & CAPABILITIES
                    {activeTab === 'tools' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-indigo-600 rounded-t-full" />}
                </button>
            </div>

            {activeTab === 'details' ? (
                <div className="space-y-8">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        {/* Basic Info */}
                        <div className="space-y-6 bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
                            <div className="flex items-center gap-2 text-indigo-600 mb-2">
                                <User size={18} />
                                <h2 className="font-bold uppercase tracking-wider text-xs">Identity</h2>
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1.5 ml-1">Agent Name</label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    disabled={readOnly}
                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 rounded-xl outline-none transition-all text-slate-800 disabled:opacity-70"
                                    placeholder="e.g. Research Assistant"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1.5 ml-1">Role / Persona</label>
                                <input
                                    type="text"
                                    value={formData.role}
                                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                                    disabled={readOnly}
                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 rounded-xl outline-none transition-all text-slate-800 disabled:opacity-70"
                                    placeholder="e.g. Expert in market analysis"
                                />
                            </div>

                            <div>
                                <div className="flex items-center gap-2 text-indigo-600 mt-8 mb-4">
                                    <Cpu size={18} />
                                    <h2 className="font-bold uppercase tracking-wider text-xs">LLM Configuration</h2>
                                </div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1.5 ml-1">Selected Model</label>
                                <select
                                    value={formData.llm_id}
                                    onChange={(e) => setFormData({ ...formData, llm_id: e.target.value })}
                                    disabled={readOnly}
                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 rounded-xl outline-none transition-all text-slate-800 appearance-none disabled:opacity-70"
                                >
                                    <option value="">Select a model...</option>
                                    {llms.map((llm) => (
                                        <option key={llm.id} value={llm.id}>
                                            {llm.name} ({llm.provider})
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* Behavior & Personality */}
                        <div className="space-y-6">
                            <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
                                <div className="flex items-center gap-2 text-indigo-600 mb-4">
                                    <Target size={18} />
                                    <h2 className="font-bold uppercase tracking-wider text-xs">Mission & Goal</h2>
                                </div>
                                <textarea
                                    value={formData.goal}
                                    onChange={(e) => setFormData({ ...formData, goal: e.target.value })}
                                    disabled={readOnly}
                                    rows={3}
                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 rounded-xl outline-none transition-all text-slate-800 resize-none disabled:opacity-70"
                                    placeholder="What is the primary objective of this agent?"
                                />
                            </div>

                            <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
                                <div className="flex items-center gap-2 text-indigo-600 mb-4">
                                    <ScrollText size={18} />
                                    <h2 className="font-bold uppercase tracking-wider text-xs">Backstory</h2>
                                </div>
                                <textarea
                                    value={formData.backstory}
                                    onChange={(e) => setFormData({ ...formData, backstory: e.target.value })}
                                    disabled={readOnly}
                                    rows={4}
                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 rounded-xl outline-none transition-all text-slate-800 resize-none disabled:opacity-70"
                                    placeholder="What is the background and experience of this agent?"
                                />
                            </div>

                            <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
                                <div className="flex items-center gap-2 text-indigo-600 mb-4">
                                    <Sparkles size={18} />
                                    <h2 className="font-bold uppercase tracking-wider text-xs">Personality Traits</h2>
                                </div>
                                <div className="flex flex-wrap gap-2 mb-4">
                                    {personalities.map((p, idx) => (
                                        <span key={idx} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-lg text-sm font-semibold">
                                            {p}
                                            {!readOnly && (
                                                <button onClick={() => removePersonality(p)} className="hover:text-indigo-800">
                                                    <X size={14} />
                                                </button>
                                            )}
                                        </span>
                                    ))}
                                    {personalities.length === 0 && (
                                        <p className="text-sm text-slate-400 italic">No traits added yet.</p>
                                    )}
                                </div>
                                {!readOnly && (
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            value={newPersonality}
                                            onChange={(e) => setNewPersonality(e.target.value)}
                                            onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddPersonality())}
                                            className="flex-1 px-4 py-2 bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-400 rounded-xl outline-none transition-all text-sm"
                                            placeholder="Add a trait (e.g. Friendly)"
                                        />
                                        <button
                                            onClick={(e) => { e.preventDefault(); handleAddPersonality(); }}
                                            className="p-2 bg-indigo-100 text-indigo-600 rounded-xl hover:bg-indigo-200 transition-all"
                                        >
                                            <Plus size={20} />
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Guardrails Section */}
                    <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
                        <div className="flex items-center gap-2 text-slate-500 mb-6">
                            <Shield size={18} />
                            <h2 className="font-bold uppercase tracking-wider text-xs">Guardrails</h2>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-slate-700">
                                    Max Delegation Depth
                                </label>
                                <input
                                    type="number"
                                    min={1}
                                    max={50}
                                    value={formData.config?.max_delegation_depth ?? ''}
                                    onChange={(e) => setFormData({
                                        ...formData,
                                        config: {
                                            ...formData.config,
                                            max_delegation_depth: e.target.value ? parseInt(e.target.value) : undefined,
                                        }
                                    })}
                                    disabled={readOnly}
                                    placeholder={`Org default: ${org?.config?.max_delegation_depth ?? 5}`}
                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 rounded-xl outline-none transition-all text-slate-800 disabled:opacity-70"
                                />
                                <p className="text-xs text-slate-400">
                                    Maximum nesting level for agent-to-agent delegation. Empty = use org default.
                                </p>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-slate-700">
                                    Max Web Search Depth
                                </label>
                                <input
                                    type="number"
                                    min={1}
                                    max={50}
                                    value={formData.config?.max_websearch_depth ?? ''}
                                    onChange={(e) => setFormData({
                                        ...formData,
                                        config: {
                                            ...formData.config,
                                            max_websearch_depth: e.target.value ? parseInt(e.target.value) : undefined,
                                        }
                                    })}
                                    disabled={readOnly}
                                    placeholder={`Org default: ${org?.config?.max_websearch_depth ?? 10}`}
                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 rounded-xl outline-none transition-all text-slate-800 disabled:opacity-70"
                                />
                                <p className="text-xs text-slate-400">
                                    Maximum web search calls per agent run. Empty = use org default.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            ) : activeTab === 'memory' ? (
                <div className="space-y-8">
                    {/* Unified Knowledge Base */}
                    <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
                        <div className="p-8 border-b border-slate-100 flex items-center justify-between">
                            <div className="flex items-center gap-2 text-indigo-600">
                                <Brain size={20} />
                                <h2 className="font-bold uppercase tracking-wider text-sm">Unified Knowledge Base</h2>
                            </div>
                            {!readOnly && (
                                <button
                                    onClick={() => setAddingMemory({ title: '', content: '', agent_id: agentId })}
                                    className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-100 transition-all text-sm font-bold"
                                >
                                    <Plus size={16} /> ADD KNOWLEDGE
                                </button>
                            )}
                        </div>
                        <div className="divide-y divide-slate-100">
                            {isLoadingMemories ? (
                                <div className="p-12 flex justify-center">
                                    <Loader2 className="animate-spin text-indigo-600" size={24} />
                                </div>
                            ) : combinedMemories.length > 0 ? (
                                combinedMemories.map((mem) => (
                                    <div key={mem.id} className="p-6 hover:bg-slate-50 transition-all flex items-start justify-between group">
                                        <div className="flex-1 min-w-0 pr-4">
                                            <div className="flex items-center gap-3 mb-1.5 flex-wrap">
                                                <h3 className="font-bold text-slate-800 truncate">{mem.title}</h3>
                                                <div className="flex gap-2">
                                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-tighter ${mem.status === 'completed' ? 'bg-green-100 text-green-600' : 'bg-amber-100 text-amber-600'
                                                        }`}>
                                                        {mem.status}
                                                    </span>
                                                    {!mem.agent_id && (
                                                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-tighter bg-indigo-100 text-indigo-600 flex items-center gap-1">
                                                            <Sparkles size={10} /> ORG WIDE
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            <p className="text-sm text-slate-500 line-clamp-2 leading-relaxed">{mem.content}</p>
                                        </div>
                                        {!readOnly && (
                                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                                                <button
                                                    onClick={() => setEditingMemory(mem)}
                                                    className="p-2 text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                                                >
                                                    <Edit2 size={16} />
                                                </button>
                                                <button
                                                    onClick={() => deleteMemoryMutation.mutate({ id: mem.id, agent_id: mem.agent_id })}
                                                    className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                ))
                            ) : (
                                <div className="p-20 text-center">
                                    <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-4 text-slate-300">
                                        <Brain size={32} />
                                    </div>
                                    <h3 className="font-bold text-slate-800">No knowledge entries found</h3>
                                    <p className="text-sm text-slate-400 mt-1">Add specific context or knowledge to enhance agent performance.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Active Tools */}
                    <div className="space-y-6">
                        <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
                            <div className="flex items-center justify-between mb-6">
                                <div className="flex items-center gap-2 text-indigo-600">
                                    <Hammer size={18} />
                                    <h2 className="font-bold uppercase tracking-wider text-xs">Active Tools</h2>
                                </div>
                                <span className="bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest leading-none">
                                    {agent?.tools?.length || 0} Enabled
                                </span>
                            </div>

                            <div className="space-y-3">
                                {agent?.tools && agent.tools.length > 0 ? (
                                    agent.tools.map((toolId) => {
                                        const tool = availableTools.find(t => t.id === toolId || t.name === toolId);
                                        return (
                                            <div key={toolId} className="flex items-center justify-between p-4 bg-slate-50 hover:bg-white border-2 border-transparent hover:border-indigo-100 rounded-2xl transition-all group">
                                                <div className="flex items-center gap-4">
                                                    <div className="p-2 bg-white rounded-xl shadow-sm group-hover:bg-indigo-600 group-hover:text-white transition-all">
                                                        <Wrench size={18} />
                                                    </div>
                                                    <div>
                                                        <p className="font-bold text-slate-900 text-sm tracking-tight">{tool?.name || toolId}</p>
                                                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">Integration Active</p>
                                                    </div>
                                                </div>
                                                {!readOnly && (
                                                    <button 
                                                        onClick={() => removeToolMutation.mutate(toolId)}
                                                        className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                )}
                                            </div>
                                        );
                                    })
                                ) : (
                                    <div className="py-12 text-center opacity-40">
                                        <Hammer size={32} className="mx-auto mb-3" />
                                        <p className="text-sm font-bold uppercase tracking-tighter">No tools assigned</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {!readOnly && (
                        <div className="space-y-6">
                            <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
                                <div className="flex items-center gap-2 text-slate-400 mb-6 font-bold uppercase tracking-wider text-xs">
                                    <Plus size={18} />
                                    Add New Capability
                                </div>
                                
                                <div className="grid grid-cols-1 gap-3">
                                    {availableTools
                                        .filter(t => !agent?.tools?.includes(t.id) && !agent?.tools?.includes(t.name))
                                        .map((tool) => (
                                            <button
                                                key={tool.id}
                                                onClick={() => addToolMutation.mutate(tool.id)}
                                                className="w-full flex items-center justify-between p-4 bg-white border border-slate-100 hover:border-indigo-400 hover:bg-indigo-50/30 rounded-2xl transition-all group text-left"
                                            >
                                                <div className="flex items-center gap-4">
                                                    <div className="p-3 bg-slate-50 text-slate-400 rounded-2xl group-hover:bg-indigo-100 group-hover:text-indigo-600 transition-colors">
                                                        <Zap size={20} />
                                                    </div>
                                                    <div className="flex-1">
                                                        <h3 className="font-bold text-slate-800 text-sm group-hover:text-indigo-700 transition-colors uppercase tracking-tight">{tool.name}</h3>
                                                        <p className="text-xs text-slate-500 font-medium line-clamp-1">{tool.description}</p>
                                                    </div>
                                                </div>
                                                <ArrowRight size={18} className="text-slate-200 group-hover:text-indigo-400 transition-all opacity-0 group-hover:opacity-100 transform -translate-x-2 group-hover:translate-x-0" />
                                            </button>
                                        ))}
                                    {availableTools.filter(t => !agent?.tools?.includes(t.id) && !agent?.tools?.includes(t.name)).length === 0 && (
                                        <div className="py-12 text-center opacity-30 italic">
                                            <p className="text-sm">All capabilities are already enabled.</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
