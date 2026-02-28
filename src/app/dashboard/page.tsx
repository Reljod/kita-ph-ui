'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
    Send, User, MoreVertical, Edit2, Trash2, RotateCw,
    MessageSquare, ChevronLeft, Bot, Sparkles, Plus, Loader2, Zap, CheckCircle2, ChevronRight, X
} from 'lucide-react';
import { api } from '@/lib/api';
import { Agent, Message, useAgentStore } from '@/store/useAgentStore';

const CREATOR_AGENT_ID = 'agent-creator';

export default function UnifiedWorkspace() {
    // Query to fetch agents from Kita API
    const { data: fetchedAgents, isLoading: isFetchingAgents } = useQuery({
        queryKey: ['agents'],
        queryFn: async () => {
            try {
                const response = await api.get('/agent');
                return response.data || [];
            } catch {
                console.warn('Could not fetch agents from API, using empty list.');
                return [];
            }
        }
    });

    // Local state for all agents (Persistent Builder + Fetched + Newly created)
    const { agents, setAgents, setAgentChatId, addMessage, setMessages, removeAgent, addAgent } = useAgentStore();
    const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);

    // Initialization
    useEffect(() => {
        if (fetchedAgents) {
            // Map fetched agents to UI structure ensuring avatar and color exist
            const mappedAgents: Agent[] = fetchedAgents.map((a: any) => ({
                ...a,
                avatar: a.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${a.id}&backgroundColor=${a.id === CREATOR_AGENT_ID ? '4f46e5' : '2563eb'}`,
                color: a.color || (a.id === CREATOR_AGENT_ID ? 'bg-indigo-600' : 'bg-blue-600'),
                messages: a.messages || []
            }));
            setAgents(mappedAgents);
        }
    }, [fetchedAgents]);

    const activeAgent = agents.find(a => a.id === selectedAgentId);

    // Chat State
    const [inputValue, setInputValue] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Builder Specific State
    const [isPolling, setIsPolling] = useState(false);
    const [pollStatus, setPollStatus] = useState('');
    const [newAgent, setNewAgent] = useState<Agent | null>(null);
    const [showBirthAnimation, setShowBirthAnimation] = useState(false);

    // Drag & Drop State
    const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
    const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

    // Card Menu State
    const [openMenuId, setOpenMenuId] = useState<string | null>(null);

    // Determine which UI to show: 
    // If only the builder agent exists and it's NOT selected, we show the big hero view.
    const hasOnlyBuilder = agents.length <= 1;
    const isBuilderHeroMode = hasOnlyBuilder && !selectedAgentId;

    // Scroll to bottom of chat
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [agents, selectedAgentId, isTyping]);

    // Parse Backend Messages
    const parseBackendMessages = (backendMessages: any[]): Message[] => {
        return backendMessages.map((msg: any) => {
            const content = msg.parts
                ? msg.parts
                    .filter((part: any) => part.part_kind !== 'thinking')
                    .map((part: any) => part.content)
                    .join('\n')
                : msg.content || '';

            return {
                id: msg.run_id || msg.id || crypto.randomUUID(),
                role: msg.kind === 'request' ? 'user' : 'agent',
                content: content
            };
        });
    };

    // Fetch Chat History when agent is selected
    useEffect(() => {
        const fetchHistory = async () => {
            if (!selectedAgentId || selectedAgentId === CREATOR_AGENT_ID) return;

            const agent = agents.find(a => a.id === selectedAgentId);
            if (!agent) return;

            try {
                const response = await api.get(`/agent/${selectedAgentId}/chat`);
                const chats = response.data || [];
                if (chats.length > 0) {
                    // Pick the latest chat for simplicity for now
                    const latestChat = chats[chats.length - 1];
                    setAgentChatId(selectedAgentId, latestChat.id);
                    const parsedMessages = parseBackendMessages(latestChat.messages);
                    setMessages(selectedAgentId, parsedMessages);
                }
            } catch (error) {
                console.error('Failed to fetch chat history:', error);
            }
        };

        fetchHistory();
    }, [selectedAgentId, setAgentChatId, setMessages]);

    const handleDragStart = (e: React.DragEvent, index: number) => {
        setDraggedIdx(index);
        e.dataTransfer.effectAllowed = 'move';
        setTimeout(() => (e.target as HTMLElement).classList.add('opacity-50'), 0);
    };

    const handleDragEnter = (e: React.DragEvent, index: number) => {
        e.preventDefault();
        if (draggedIdx !== index) {
            setDragOverIdx(index);
        }
    };

    const handleDragEnd = (e: React.DragEvent) => {
        (e.target as HTMLElement).classList.remove('opacity-50');
        if (draggedIdx !== null && dragOverIdx !== null && draggedIdx !== dragOverIdx) {
            const newAgents = [...agents];
            const draggedItem = newAgents[draggedIdx];
            newAgents.splice(draggedIdx, 1);
            newAgents.splice(dragOverIdx, 0, draggedItem);
            setAgents(newAgents);
        }
        setDraggedIdx(null);
        setDragOverIdx(null);
    };

    const handleDelete = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (id === CREATOR_AGENT_ID) return; // Cannot delete agent creator
        removeAgent(id);
        setOpenMenuId(null);
        if (selectedAgentId === id) setSelectedAgentId(null);
    };

    const handleSendMessage = (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!inputValue.trim()) return;

        let targetAgentId = selectedAgentId;

        // If we're in Builder Hero mode, we implicitly chat with the Creator
        if (isBuilderHeroMode) {
            targetAgentId = CREATOR_AGENT_ID;
            setSelectedAgentId(CREATOR_AGENT_ID);
        }

        if (!targetAgentId) return;

        const newMsg: Message = { id: crypto.randomUUID(), role: 'user', content: inputValue };
        addMessage(targetAgentId, newMsg);

        setInputValue('');

        // Check if target is builder
        if (targetAgentId === CREATOR_AGENT_ID) {
            simulateBuilderProcess(newMsg.content);
        } else {
            sendMessageToAgent(targetAgentId, newMsg.content);
        }
    };

    const sendMessageToAgent = async (agentId: string, userText: string) => {
        setIsTyping(true);
        const agent = agents.find(a => a.id === agentId);
        if (!agent) return;

        try {
            let response;
            if (agent.chatId) {
                // Continue existing chat
                response = await api.post(`/agent/${agentId}/chat/${agent.chatId}/continue`, {
                    message: userText
                });
            } else {
                // Start new chat
                response = await api.post(`/agent/${agentId}/chat`, {
                    message: userText
                });
                if (response.data?.id) {
                    setAgentChatId(agentId, response.data.id);
                }
            }

            const chatData = response.data;
            const parsedMessages = parseBackendMessages(chatData.messages);
            setMessages(agentId, parsedMessages);
        } catch (error) {
            console.error('Failed to send message:', error);
            addMessage(agentId, {
                id: crypto.randomUUID(),
                role: 'agent',
                content: 'Sorry, I encountered an error. Please try again later.'
            });
        } finally {
            setIsTyping(false);
        }
    };

    const simulateBuilderProcess = (userText: string) => {
        setIsTyping(true);
        setTimeout(() => {
            setIsTyping(false);
            const builderReply: Message = {
                id: crypto.randomUUID(),
                role: 'builder',
                content: `I understand you want to create an agent for: "${userText}". I'm putting together the core logic and personality right now. I'll monitor the build process for you.`
            };

            addMessage(CREATOR_AGENT_ID, builderReply);

            startPollingSimulation();
        }, 1500);
    };

    const startPollingSimulation = () => {
        setIsPolling(true);
        setPollStatus('Allocating memory...');

        setTimeout(() => setPollStatus('Configuring language models...'), 1500);
        setTimeout(() => setPollStatus('Applying personality matrix...'), 3000);
        setTimeout(() => setPollStatus('Finalizing deployment...'), 4500);

        setTimeout(() => {
            setIsPolling(false);
            setPollStatus('');

            const newId = crypto.randomUUID();
            const generatedAgent: Agent = {
                id: newId,
                name: "NexusBot",
                role: "Specialized Assistant",
                color: "bg-blue-600",
                avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${newId}&backgroundColor=2563eb`,
                messages: [{
                    id: '1', role: 'agent', content: 'Hello! I am online and ready to assist you.'
                }]
            };

            setNewAgent(generatedAgent);
            setShowBirthAnimation(true);

            // Add a final builder message and the new agent
            addMessage(CREATOR_AGENT_ID, {
                id: crypto.randomUUID(),
                role: 'builder' as const,
                content: `Success! ${generatedAgent.name} has been created and is ready to use.`
            });
            addAgent(generatedAgent);
        }, 6000);
    };

    const dismissBirthModal = () => {
        setShowBirthAnimation(false);
        if (newAgent) {
            setSelectedAgentId(newAgent.id);
            setNewAgent(null);
        }
    };

    if (isFetchingAgents) {
        return <div className="flex-1 flex items-center justify-center"><Loader2 className="animate-spin text-indigo-600" size={32} /></div>;
    }

    return (
        <div className="flex-1 flex flex-col overflow-hidden transition-all duration-700 bg-slate-50 text-slate-800 font-sans relative">
            <style dangerouslySetInnerHTML={{
                __html: `
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        .workspace-hero { padding-top: 15vh; }
        
        @keyframes birthPop {
          0% { transform: scale(0.5) translateY(20px); opacity: 0; }
          60% { transform: scale(1.05) translateY(-5px); opacity: 1; }
          100% { transform: scale(1) translateY(0); opacity: 1; }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
        @keyframes pulse-glow {
          0%, 100% { box-shadow: 0 0 0 0 rgba(79, 70, 229, 0.4); }
          50% { box-shadow: 0 0 20px 10px rgba(79, 70, 229, 0); }
        }
        .animate-birth { animation: birthPop 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards; }
        .animate-float { animation: float 3s ease-in-out infinite; }
      `}} />

            {/* --- HERO VIEW (Initial Agent Builder State OR Agent Selection Workspace) --- */}
            {!selectedAgentId && (
                <div className={`transition-all duration-700 ease-in-out w-full flex flex-col items-center ${'workspace-hero flex-1 z-10'
                    }`}>
                    {isBuilderHeroMode ? (
                        // Builder Hero Mode (When only Builder exists)
                        <div className="flex-1 flex flex-col items-center p-6 w-full max-w-3xl mx-auto animate-in fade-in duration-700 mt-10">
                            <div className="w-20 h-20 bg-indigo-100 text-indigo-600 rounded-3xl flex items-center justify-center mb-8 shadow-sm">
                                <Bot size={40} />
                            </div>
                            <h1 className="text-4xl md:text-5xl font-bold mb-4 text-center tracking-tight text-slate-900">
                                Build your <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600">Perfect Agent</span>
                            </h1>
                            <p className="text-slate-500 text-lg mb-10 text-center max-w-xl">
                                Describe the agent you want to create. Our Builder will design, configure, and deploy it for you in seconds.
                            </p>

                            <form
                                onSubmit={handleSendMessage}
                                className="w-full relative shadow-xl rounded-2xl bg-white flex items-center p-2 border border-slate-200 transition-all focus-within:ring-4 focus-within:ring-indigo-50 focus-within:border-indigo-300"
                            >
                                <input
                                    type="text"
                                    value={inputValue}
                                    onChange={(e) => setInputValue(e.target.value)}
                                    placeholder="e.g., A customer support bot that speaks like a pirate..."
                                    className="w-full py-4 pl-4 pr-16 outline-none text-lg bg-transparent"
                                    autoFocus
                                />
                                <button
                                    type="submit"
                                    disabled={!inputValue.trim()}
                                    className="absolute right-3 p-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-xl transition-colors flex items-center justify-center"
                                >
                                    <Send size={20} className="ml-1" />
                                </button>
                            </form>

                            <div className="mt-8 flex gap-3 text-sm text-slate-400 font-medium">
                                <span className="flex items-center gap-1 bg-white px-3 py-1.5 rounded-full border border-slate-200 shadow-sm cursor-pointer hover:border-indigo-300 transition-colors" onClick={() => setInputValue("A financial advisor that explains crypto simply")}>
                                    <Zap size={14} className="text-amber-500" /> Financial Advisor
                                </span>
                                <span className="flex items-center gap-1 bg-white px-3 py-1.5 rounded-full border border-slate-200 shadow-sm cursor-pointer hover:border-indigo-300 transition-colors" onClick={() => setInputValue("A coding assistant for React and Tailwind")}>
                                    <Zap size={14} className="text-amber-500" /> React Coder
                                </span>
                            </div>
                        </div>
                    ) : (
                        // Workspace Mode (When multiple agents exist)
                        <>
                            <div className="text-center transition-all duration-500 mb-12">
                                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-50 text-indigo-600 text-sm font-semibold mb-6">
                                    <Sparkles size={16} /> My Workspace
                                </div>
                                <h1 className="text-4xl md:text-5xl font-bold mb-4 tracking-tight text-slate-900">
                                    Select an Agent
                                </h1>
                                <p className="text-slate-500 text-lg max-w-md mx-auto">
                                    Choose an agent below to start collaborating, or drag to reorganize them.
                                </p>
                            </div>

                            <div className="w-full max-w-6xl mx-auto flex transition-all duration-700 ease-in-out px-6 gap-6 overflow-x-auto hide-scrollbar pb-12 snap-x snap-mandatory px-8">
                                {agents.map((agent, index) => (
                                    <div
                                        key={agent.id}
                                        draggable
                                        onDragStart={(e) => handleDragStart(e, index)}
                                        onDragEnter={(e) => handleDragEnter(e, index)}
                                        onDragEnd={handleDragEnd}
                                        onDragOver={(e) => e.preventDefault()}
                                        onClick={() => setSelectedAgentId(agent.id)}
                                        className={`relative group transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] flex-shrink-0 cursor-pointer w-72 h-80 bg-white rounded-3xl p-6 shadow-xl shadow-slate-200/50 border border-slate-100 snap-center hover:-translate-y-2 hover:shadow-2xl hover:shadow-indigo-100/50 hover:border-indigo-200 ${dragOverIdx === index ? 'scale-105 ring-4 ring-indigo-100' : ''}`}
                                    >
                                        {/* Action Menu Trigger (Skip for Creator) */}
                                        {agent.id !== CREATOR_AGENT_ID && (
                                            <div className="absolute top-4 right-4 z-10">
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); setOpenMenuId(openMenuId === agent.id ? null : agent.id); }}
                                                    className="p-2 bg-white/80 backdrop-blur rounded-full text-slate-400 hover:text-slate-800 hover:bg-slate-100 shadow-sm transition-colors"
                                                >
                                                    <MoreVertical size={18} />
                                                </button>

                                                {openMenuId === agent.id && (
                                                    <div className="absolute top-full right-0 mt-2 w-36 bg-white rounded-xl shadow-xl border border-slate-100 overflow-hidden py-1 z-20 animate-in fade-in slide-in-from-top-2">
                                                        <button className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 transition-colors" onClick={(e) => { e.stopPropagation(); setOpenMenuId(null); }}>
                                                            <Edit2 size={14} /> Edit
                                                        </button>
                                                        <button className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 transition-colors" onClick={(e) => { e.stopPropagation(); setOpenMenuId(null); }}>
                                                            <RotateCw size={14} /> Re-run
                                                        </button>
                                                        <div className="h-px bg-slate-100 my-1"></div>
                                                        <button className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors" onClick={(e) => handleDelete(agent.id, e)}>
                                                            <Trash2 size={14} /> Delete
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        <div className="flex flex-col items-center h-full text-center">
                                            <div className="relative mb-6">
                                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                                <img
                                                    src={agent.avatar}
                                                    alt={agent.name}
                                                    className={`w-32 h-32 rounded-full object-cover shadow-md pointer-events-none ${agent.id === CREATOR_AGENT_ID ? 'bg-indigo-100 p-2' : ''}`}
                                                />
                                                <div className={`absolute bottom-1 right-1 w-6 h-6 rounded-full border-4 border-white ${agent.color}`}></div>
                                            </div>

                                            <h3 className="text-xl font-bold text-slate-900 mb-1">{agent.name}</h3>
                                            <p className="text-sm font-medium text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full mb-auto">
                                                {agent.role}
                                            </p>

                                            <div className="w-full mt-6 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                                <div className="w-full py-3 bg-slate-900 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2">
                                                    <MessageSquare size={16} /> Chat Now
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}

                                {/* Additional Create New Agent Card Shortcut */}
                                <div
                                    onClick={() => setSelectedAgentId(CREATOR_AGENT_ID)}
                                    className="w-72 h-80 rounded-3xl border-2 border-dashed border-slate-300 flex flex-col items-center justify-center text-slate-400 hover:text-indigo-600 hover:border-indigo-400 hover:bg-indigo-50/50 cursor-pointer transition-colors snap-center flex-shrink-0"
                                >
                                    <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-4 group-hover:bg-indigo-100 transition-colors">
                                        <Plus size={32} />
                                    </div>
                                    <span className="font-semibold">Create New Agent</span>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            )}

            {/* --- SELECTED AGENT MINIMIZED HEADER & CHAT --- */}
            {selectedAgentId && (
                <>
                    <div className="bg-white shadow-sm border-b border-slate-200 py-3 z-20 sticky top-0 w-full flex flex-col items-center transition-all duration-700 ease-in-out">
                        <div className="w-full max-w-6xl mx-auto flex justify-center md:justify-start gap-4 overflow-x-auto hide-scrollbar items-center px-6 transition-all duration-700 ease-in-out">
                            <button
                                onClick={() => setSelectedAgentId(null)}
                                className="mr-2 p-2 rounded-full hover:bg-slate-100 text-slate-500 transition-colors flex-shrink-0"
                                title="Back to Hero"
                            >
                                <ChevronLeft size={24} />
                            </button>

                            {agents.map((agent) => (
                                <div
                                    key={agent.id}
                                    onClick={() => setSelectedAgentId(agent.id)}
                                    className={`relative group transition-all duration-500 flex-shrink-0 cursor-pointer w-14 h-14 rounded-full ${selectedAgentId === agent.id ? 'ring-4 ring-indigo-500 ring-offset-2 scale-110' : 'hover:scale-105 opacity-70 hover:opacity-100 grayscale hover:grayscale-0'}`}
                                >
                                    <div className="relative w-full h-full rounded-full group/tooltip">
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img
                                            src={agent.avatar}
                                            alt={agent.name}
                                            className={`w-full h-full rounded-full object-cover shadow-sm ${agent.id === CREATOR_AGENT_ID ? 'bg-indigo-100 p-1' : ''}`}
                                        />
                                        <div className={`absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-2 border-white ${agent.color}`}></div>

                                        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-3 pt-2 opacity-0 group-hover/tooltip:opacity-100 pointer-events-none transition-opacity z-50 flex flex-col items-center">
                                            <div className="w-3 h-3 bg-slate-800 rotate-45 -mb-2 z-0"></div>
                                            <div className="bg-slate-800 text-white text-xs px-3 py-1.5 rounded-lg whitespace-nowrap shadow-xl z-10 flex flex-col items-center">
                                                <span className="font-bold">{agent.name}</span>
                                                <span className="text-slate-300 text-[10px]">{agent.role}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                        {/* Show polling status if builder is active and polling */}
                        {activeAgent?.id === CREATOR_AGENT_ID && isPolling && (
                            <div className="mt-2 text-xs text-slate-500 font-medium flex items-center gap-1 text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full border border-indigo-100 animate-in fade-in slide-in-from-top-2">
                                <Loader2 size={14} className="animate-spin" />
                                {pollStatus}
                            </div>
                        )}
                    </div>

                    <div className="flex-1 flex flex-col w-full max-w-4xl mx-auto opacity-100 translate-y-0 transition-all duration-700 ease-[cubic-bezier(0.23,1,0.32,1)]">
                        {/* Header info (optional) */}
                        {activeAgent && (
                            <div className="px-6 py-4 flex flex-col items-center animate-in fade-in slide-in-from-top-4 duration-500 border-b border-slate-100 bg-white/50 backdrop-blur-sm">
                                <h2 className="text-lg font-bold text-slate-800">{activeAgent.name}</h2>
                                <p className="text-sm text-slate-500">{activeAgent.role}</p>
                            </div>
                        )}

                        {/* Chat Messages */}
                        <main className="flex-1 overflow-y-auto px-4 md:px-8 py-6 space-y-6">
                            {activeAgent?.messages.map((msg) => (
                                <div
                                    key={msg.id}
                                    className={`flex gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'} animate-in fade-in slide-in-from-bottom-2 duration-300`}
                                >
                                    <div className={`w-10 h-10 shrink-0 rounded-full flex items-center justify-center overflow-hidden shadow-sm ${msg.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200'}`}>
                                        {msg.role === 'user' ? <User size={20} /> : (
                                            /* eslint-disable-next-line @next/next/no-img-element */
                                            <img src={activeAgent.avatar} alt="Agent" className={`w-full h-full object-cover ${activeAgent.id === CREATOR_AGENT_ID ? 'p-1' : ''}`} />
                                        )}
                                    </div>

                                    <div className={`max-w-[75%] rounded-2xl p-4 shadow-sm text-[15px] leading-relaxed ${msg.role === 'user'
                                        ? 'bg-indigo-600 text-white rounded-tr-sm'
                                        : 'bg-white border border-slate-100 text-slate-700 rounded-tl-sm'
                                        }`}>
                                        {msg.content}
                                    </div>
                                </div>
                            ))}

                            {isTyping && activeAgent && (
                                <div className="flex gap-4 flex-row animate-in fade-in duration-300">
                                    <div className="w-10 h-10 shrink-0 rounded-full overflow-hidden flex items-center justify-center bg-white shadow-sm border border-slate-100">
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img src={activeAgent.avatar} alt="Agent" className={`w-full h-full object-cover grayscale opacity-80 ${activeAgent.id === CREATOR_AGENT_ID ? 'p-1' : ''}`} />
                                    </div>
                                    <div className="bg-white border border-slate-100 rounded-2xl rounded-tl-sm p-4 shadow-sm flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '0ms' }}></span>
                                        <span className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '150ms' }}></span>
                                        <span className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '300ms' }}></span>
                                    </div>
                                </div>
                            )}
                            <div ref={messagesEndRef} />
                        </main>

                        {/* Input Footer */}
                        <footer className="p-4 md:p-6 bg-slate-50/80 backdrop-blur-sm border-t border-slate-200 mt-auto sticky bottom-0">
                            <form
                                onSubmit={handleSendMessage}
                                className="relative flex items-center max-w-3xl mx-auto shadow-sm rounded-2xl bg-white focus-within:ring-2 focus-within:ring-indigo-100 focus-within:border-indigo-300 border border-slate-200 transition-all"
                            >
                                <input
                                    type="text"
                                    value={inputValue}
                                    onChange={(e) => setInputValue(e.target.value)}
                                    placeholder={isPolling ? "Waiting for agent build..." : `Message ${activeAgent?.name}...`}
                                    disabled={isPolling || isTyping}
                                    className="w-full py-4 pl-4 pr-14 bg-transparent outline-none rounded-2xl disabled:opacity-60"
                                />
                                <button
                                    type="submit"
                                    disabled={!inputValue.trim() || isTyping || isPolling}
                                    className="absolute right-2 p-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white rounded-xl transition-colors flex items-center justify-center"
                                >
                                    <Send size={18} className="ml-0.5" />
                                </button>
                            </form>
                            <div className="text-center mt-3 text-xs text-slate-400 font-medium">
                                AI agents can make mistakes. Verify important information.
                            </div>
                        </footer>
                    </div>
                </>
            )}

            {/* --- AGENT BIRTH ANIMATION (Modal Overlay) --- */}
            {showBirthAnimation && newAgent && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-500" onClick={dismissBirthModal}></div>

                    <div className="relative w-full max-w-sm bg-white rounded-3xl shadow-[0_0_60px_-15px_rgba(79,70,229,0.5)] overflow-hidden animate-birth flex flex-col items-center text-center p-8">
                        <button onClick={dismissBirthModal} className="absolute top-4 right-4 p-2 text-slate-400 hover:bg-slate-100 rounded-full transition-colors z-10">
                            <X size={20} />
                        </button>
                        <div className="absolute top-0 left-0 right-0 h-40 bg-gradient-to-b from-indigo-50 to-white"></div>
                        <div className="absolute top-10 left-1/2 -translate-x-1/2 w-48 h-48 bg-indigo-400/20 blur-3xl rounded-full"></div>

                        <div className="relative mb-6 mt-4">
                            <div className="w-28 h-28 rounded-3xl bg-gradient-to-tr from-indigo-500 to-purple-500 shadow-xl shadow-indigo-500/30 flex items-center justify-center animate-float relative" style={{ animation: 'float 3s ease-in-out infinite, pulse-glow 2s infinite' }}>
                                <Bot size={56} className="text-white drop-shadow-md" />
                                <div className="absolute -top-3 -right-3 w-10 h-10 bg-yellow-400 rounded-full flex items-center justify-center shadow-lg transform rotate-12">
                                    <Sparkles size={20} className="text-white" />
                                </div>
                            </div>
                        </div>

                        <h3 className="text-sm font-bold text-indigo-600 tracking-widest uppercase mb-1 flex items-center gap-1 justify-center">
                            <CheckCircle2 size={16} /> Agent Online
                        </h3>

                        <h2 className="text-3xl font-extrabold text-slate-900 mb-2">{newAgent.name}</h2>
                        <p className="text-slate-500 font-medium mb-8 px-4">
                            Your custom <span className="text-slate-800">{newAgent.role}</span> has been forged and is fully operational.
                        </p>

                        <button
                            onClick={dismissBirthModal}
                            className="w-full py-3.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-semibold shadow-md transition-transform active:scale-95 flex justify-center items-center gap-2"
                        >
                            Start Chatting <ChevronRight size={18} />
                        </button>
                    </div>

                    <div className="absolute top-1/4 left-1/4 w-3 h-3 bg-indigo-500 rounded-full animate-ping opacity-75"></div>
                    <div className="absolute bottom-1/4 right-1/4 w-4 h-4 bg-purple-500 rounded-full animate-ping opacity-75" style={{ animationDelay: '500ms' }}></div>
                    <div className="absolute top-1/3 right-1/3 w-2 h-2 bg-yellow-400 rounded-full animate-ping opacity-75" style={{ animationDelay: '200ms' }}></div>
                </div>
            )}
        </div>
    );
}
