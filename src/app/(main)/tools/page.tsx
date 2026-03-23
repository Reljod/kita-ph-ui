'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Tool } from '@/types/tools';
import { Agent } from '@/types/agents';
import { 
    Hammer, 
    Search, 
    ChevronRight, 
    Users, 
    ExternalLink,
    Loader2,
    Wrench,
    Globe,
    Database,
    Cpu,
    Zap
} from 'lucide-react';
import Link from 'next/link';

// Helper to get icon for tool name
const getToolIcon = (name: string) => {
    const n = name.toLowerCase();
    if (n.includes('search')) return <Globe className="text-blue-500" size={24} />;
    if (n.includes('memory') || n.includes('rag')) return <Database className="text-amber-500" size={24} />;
    if (n.includes('agent')) return <Users className="text-indigo-500" size={24} />;
    if (n.includes('code') || n.includes('python')) return <Cpu className="text-emerald-500" size={24} />;
    return <Wrench className="text-slate-400" size={24} />;
};

export default function ToolsPage() {
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedToolId, setSelectedToolId] = useState<string | null>(null);

    // Fetch all tools
    const { data: tools = [], isLoading: isLoadingTools } = useQuery<Tool[]>({
        queryKey: ['tools'],
        queryFn: async () => {
            const res = await api.get('/tool');
            return res.data;
        },
    });

    // Fetch agents for selected tool
    const { data: toolAgents = [], isLoading: isLoadingAgents } = useQuery<Agent[]>({
        queryKey: ['tool-agents', selectedToolId],
        queryFn: async () => {
            if (!selectedToolId) return [];
            const res = await api.get(`/tool/${selectedToolId}/agents`);
            return res.data;
        },
        enabled: !!selectedToolId,
    });

    const filteredTools = tools.filter(tool => 
        tool.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tool.description.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="flex-1 overflow-y-auto bg-slate-50/50">
            <div className="max-w-7xl mx-auto px-6 py-10">
                {/* Header Section */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
                    <div>
                        <h1 className="text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
                            <Hammer className="text-indigo-600" size={32} />
                            Tools Registry
                        </h1>
                        <p className="text-slate-500 mt-2 font-medium">Explore and manage available tools for your agents.</p>
                    </div>
                    
                    <div className="relative w-full md:w-96">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input
                            type="text"
                            placeholder="Search tools..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-indigo-100 focus:border-indigo-400 transition-all shadow-sm"
                        />
                    </div>
                </div>

                {isLoadingTools ? (
                    <div className="flex flex-col items-center justify-center py-32 text-slate-400">
                        <Loader2 className="animate-spin mb-4" size={40} />
                        <p className="font-medium">Loading tools...</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        {/* Tools Grid */}
                        <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
                            {filteredTools.map((tool) => (
                                <button
                                    key={tool.id}
                                    onClick={() => setSelectedToolId(tool.id)}
                                    className={`
                                        group relative p-6 bg-white border-2 rounded-[2rem] text-left transition-all duration-300
                                        ${selectedToolId === tool.id 
                                            ? 'border-indigo-500 shadow-xl shadow-indigo-100 ring-4 ring-indigo-50' 
                                            : 'border-white hover:border-slate-200 hover:shadow-lg shadow-sm'}
                                    `}
                                >
                                    <div className="flex items-start gap-4 mb-4">
                                        <div className={`p-4 rounded-3xl ${selectedToolId === tool.id ? 'bg-indigo-600 text-white' : 'bg-slate-50 text-slate-600 group-hover:bg-indigo-50 group-hover:text-indigo-600'} transition-colors`}>
                                            {getToolIcon(tool.name)}
                                        </div>
                                        <div className="flex-1">
                                            <h3 className="font-bold text-lg text-slate-900 mb-1">{tool.name}</h3>
                                            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-400 uppercase tracking-wider">
                                                <Zap size={12} /> Registered
                                            </div>
                                        </div>
                                        <ChevronRight className={`text-slate-300 transition-transform duration-300 ${selectedToolId === tool.id ? 'translate-x-1 text-indigo-400' : 'group-hover:translate-x-1'}`} size={20} />
                                    </div>
                                    <p className="text-sm text-slate-500 line-clamp-2 leading-relaxed h-10">
                                        {tool.description}
                                    </p>
                                </button>
                            ))}
                            {filteredTools.length === 0 && (
                                <div className="col-span-full py-20 text-center bg-white border border-dashed border-slate-200 rounded-[2.5rem]">
                                    <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-300">
                                        <Hammer size={32} />
                                    </div>
                                    <h3 className="font-bold text-slate-800">No tools found</h3>
                                    <p className="text-sm text-slate-400 mt-1">Try a different search term or register new tools.</p>
                                </div>
                            )}
                        </div>

                        {/* Agents Using Tool Section */}
                        <div className="lg:col-span-1">
                            <div className="sticky top-6 bg-white border border-slate-100 rounded-[2.5rem] shadow-sm overflow-hidden flex flex-col min-h-[500px]">
                                <div className="p-8 border-b border-slate-100 bg-slate-50/50">
                                    <h2 className="font-bold text-slate-900 flex items-center gap-2">
                                        <Users className="text-indigo-600" size={20} />
                                        Agents using this tool
                                    </h2>
                                    <p className="text-xs text-slate-400 mt-1 font-semibold uppercase tracking-widest">
                                        {selectedToolId ? 'Linked Agents' : 'Select a tool to see agents'}
                                    </p>
                                </div>
                                
                                <div className="flex-1 overflow-y-auto flex flex-col">
                                    {!selectedToolId ? (
                                        <div className="flex-1 flex flex-col items-center justify-center p-12 text-center opacity-50">
                                            <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mb-4 text-slate-300">
                                                <ChevronRight size={32} />
                                            </div>
                                            <p className="text-sm text-slate-500 font-medium">Select a tool from the left to view active integrations.</p>
                                        </div>
                                    ) : isLoadingAgents ? (
                                        <div className="flex-1 flex flex-col items-center justify-center p-12 text-slate-400">
                                            <Loader2 className="animate-spin mb-4" size={32} />
                                            <p className="text-sm font-medium">Finding agents...</p>
                                        </div>
                                    ) : toolAgents.length > 0 ? (
                                        <div className="p-4 space-y-2">
                                            {toolAgents.map((agent) => (
                                                <Link
                                                    key={agent.id}
                                                    href={`/agents/${agent.id}`}
                                                    className="flex items-center justify-between p-4 hover:bg-slate-50 rounded-2xl transition-all group border border-transparent hover:border-slate-100"
                                                >
                                                    <div className="flex items-center gap-4">
                                                        <div className="w-12 h-12 rounded-xl overflow-hidden bg-slate-100 bg-gradient-to-br from-indigo-50 to-white flex items-center justify-center border border-slate-100 shrink-0">
                                                            <img
                                                                src={agent.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${agent.id}`}
                                                                alt={agent.name}
                                                                className="w-10 h-10 object-contain"
                                                            />
                                                        </div>
                                                        <div>
                                                            <p className="font-bold text-slate-900 text-sm group-hover:text-indigo-600 transition-colors uppercase tracking-tight">{agent.name}</p>
                                                            <p className="text-xs text-slate-400 font-medium line-clamp-1">{agent.role}</p>
                                                        </div>
                                                    </div>
                                                    <ExternalLink size={16} className="text-slate-300 group-hover:text-indigo-400 transition-colors" />
                                                </Link>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="flex-1 flex flex-col items-center justify-center p-12 text-center opacity-50">
                                            <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mb-4 text-slate-300">
                                                <Zap size={32} />
                                            </div>
                                            <p className="text-sm text-slate-500 font-medium uppercase tracking-tight">No agents linked yet.</p>
                                            <p className="text-xs text-slate-400 mt-1">This tool is not yet assigned to any active agent profiles.</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
