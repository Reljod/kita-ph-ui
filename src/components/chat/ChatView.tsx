'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { Agent, ChatItem, Message } from '@/types/agents';
import { api } from '@/lib/api';
import { ChatHistorySidebar } from './ChatHistorySidebar';
import { ChatMessages } from './ChatMessages';
import { ChatInput } from './ChatInput';
import { ChevronRight, ArrowLeftRight } from 'lucide-react';
import Cookies from 'js-cookie';

interface Props {
    agent: Agent;
    allAgents?: Agent[];
    initialChatId: string | null;
    initialChats: ChatItem[];
    initialMessages: Message[];
}

function parseBackendMessages(backendMessages: any[]): Message[] {
    return backendMessages
        .map((msg: any, index: number) => {
            const content = msg.parts
                ? msg.parts
                    .filter((part: any) => part.part_kind === 'user-prompt' || part.part_kind === 'text')
                    .map((part: any) => part.content)
                    .join('\n')
                : msg.content || '';

            return {
                id: `${msg.id || msg.run_id || crypto.randomUUID()}-${msg.kind}-${index}`,
                role: (msg.kind === 'request' ? 'user' : 'agent') as 'user' | 'agent',
                content,
            };
        })
        .filter((msg) => msg.content.trim() !== '');
}

export function ChatView({ agent, allAgents = [], initialChatId, initialChats, initialMessages }: Props) {
    const router = useRouter();
    const queryClient = useQueryClient();

    const [chats, setChats] = useState<ChatItem[]>(initialChats);
    const [activeChatId, setActiveChatId] = useState<string | null>(initialChatId);
    const [messages, setMessages] = useState<Message[]>(initialMessages);
    const [inputValue, setInputValue] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [currentStatus, setCurrentStatus] = useState<string | null>(null);
    const [statusKey, setStatusKey] = useState<string | null>(null);
    const [switcherOpen, setSwitcherOpen] = useState(false);
    const switcherRef = useRef<HTMLDivElement>(null);

    // WebSocket logic for real-time status updates
    useEffect(() => {
        if (!isTyping || !statusKey) {
            setCurrentStatus(null);
            return;
        }

        let socket: WebSocket | null = null;
        try {
            const token = Cookies.get('token');
            let baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
            if (baseUrl.startsWith('/')) {
                baseUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8080';
            }
            const wsUrl = `${baseUrl.replace(/^http/, 'ws')}/chat/status/ws/${statusKey}?token=${encodeURIComponent(token || '')}`;

            socket = new WebSocket(wsUrl);

            socket.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    if (data && data.current_message) {
                        setCurrentStatus(data.current_message);
                    }
                } catch (err) {
                    console.error('Error parsing WebSocket message:', err);
                }
            };

            socket.onerror = (err) => {
                console.error('Status WebSocket error:', err);
            };
        } catch (err) {
            console.error('Failed to connect to status WebSocket:', err);
        }

        return () => {
            if (socket) {
                socket.close();
            }
        };
    }, [isTyping, statusKey]);

    // Sync chats and messages state when props change (revalidation)
    useEffect(() => {
        setChats(initialChats);
    }, [initialChats]);

    useEffect(() => {
        setMessages(initialMessages);
        setActiveChatId(initialChatId);
    }, [initialMessages, initialChatId]);

    // Close switcher on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (switcherRef.current && !switcherRef.current.contains(e.target as Node)) {
                setSwitcherOpen(false);
            }
        };
        if (switcherOpen) document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [switcherOpen]);

    const handleSelectChat = async (chatId: string) => {
        router.push(`/agents/${agent.id}/chat/${chatId}`);
        setActiveChatId(chatId);
        try {
            const res = await api.get(`/agent/${agent.id}/chat/${chatId}`);
            const parsed = parseBackendMessages(res.data.messages ?? []);
            setMessages(parsed);
        } catch (err) {
            console.error('Failed to load chat:', err);
        }
    };

    const handleNewChat = async () => {
        setMessages([]);
        setActiveChatId(null);
        router.push(`/agents/${agent.id}/chat`);
    };

    const handleSwitchAgent = (target: Agent) => {
        setSwitcherOpen(false);
        router.push(`/agents/${target.id}/chat`);
    };

    const handleSendMessage = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!inputValue.trim()) return;

        const userText = inputValue.trim();
        setInputValue('');
        setIsTyping(true);

        const optimisticMsg: Message = {
            id: crypto.randomUUID(),
            role: 'user',
            content: userText,
        };
        setMessages((prev) => [...prev, optimisticMsg]);

        const currentStatusKey = crypto.randomUUID();
        setStatusKey(currentStatusKey);

        try {
            let res;
            const headers = { 'x-status-key': currentStatusKey };
            if (activeChatId) {
                res = await api.post(`/agent/${agent.id}/chat/${activeChatId}/continue`, { message: userText }, { headers });
            } else {
                res = await api.post(`/agent/${agent.id}/chat`, { message: userText }, { headers });
            }

            const chatData = res.data;
            const newChatId: string = chatData.id ?? activeChatId;

            if (!activeChatId && newChatId) {
                setActiveChatId(newChatId);
                // Use router.replace with scroll: false to prevent jumps
                router.replace(`/agents/${agent.id}/chat/${newChatId}`, { scroll: false });

                // Invalidate the chat list query (which is part of our consolidated query key)
                queryClient.invalidateQueries({ queryKey: ['agent-chat-data', agent.id] });
            }

            const parsed = parseBackendMessages(chatData.messages ?? []);
            setMessages(parsed);
        } catch (err) {
            console.error('Failed to send message:', err);
            setMessages((prev) => [
                ...prev,
                { id: crypto.randomUUID(), role: 'agent', content: 'Sorry, I encountered an error. Please try again.' } as Message,
            ]);
        } finally {
            setIsTyping(false);
            setStatusKey(null);
            setCurrentStatus(null);
        }
    };

    const otherAgents = allAgents.filter((a) => a.id !== agent.id);

    return (
        <div className="flex-1 flex overflow-hidden relative">
            <ChatHistorySidebar
                chats={chats}
                activeChatId={activeChatId}
                onSelectChat={handleSelectChat}
                onNewChat={handleNewChat}
            />

            <div className="flex-1 flex flex-col overflow-hidden">
                {/* ── Agent Header ── */}
                <div className="px-5 py-3 shrink-0 border-b border-slate-100 bg-white flex items-center justify-between gap-4">
                    {/* Left: avatar + name */}
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="relative shrink-0">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                                src={agent.avatar ?? `https://api.dicebear.com/7.x/bottts/svg?seed=${agent.id}`}
                                alt={agent.name}
                                className="w-10 h-10 rounded-full object-cover border-2 border-white shadow-md"
                            />
                            {/* Online indicator */}
                            <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-400 border-2 border-white rounded-full" />
                        </div>
                        <div className="min-w-0">
                            <h2 className="text-sm font-bold text-slate-800 leading-tight truncate">{agent.name}</h2>
                            <p className="text-xs text-indigo-500 font-medium truncate">{agent.role}</p>
                        </div>
                    </div>

                    {/* Right: switch agent button */}
                    {otherAgents.length > 0 && (
                        <div className="relative" ref={switcherRef}>
                            <button
                                onClick={() => setSwitcherOpen((o) => !o)}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-200 transition-all"
                            >
                                <ArrowLeftRight size={13} />
                                Switch Agent
                            </button>

                            {/* Agent switcher popover */}
                            {switcherOpen && (
                                <div className="absolute right-0 top-full mt-2 z-50 w-72 bg-white border border-slate-100 rounded-2xl shadow-2xl shadow-slate-200/60 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
                                    <div className="px-4 py-3 border-b border-slate-50 bg-slate-50/80">
                                        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Switch to another agent</p>
                                    </div>
                                    <ul className="py-2 max-h-80 overflow-y-auto">
                                        {otherAgents.map((a) => (
                                            <li key={a.id}>
                                                <button
                                                    onClick={() => handleSwitchAgent(a)}
                                                    className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-indigo-50 transition-colors group text-left"
                                                >
                                                    <div className="relative shrink-0">
                                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                                        <img
                                                            src={a.avatar ?? `https://api.dicebear.com/7.x/bottts/svg?seed=${a.id}`}
                                                            alt={a.name}
                                                            className="w-9 h-9 rounded-full object-cover border-2 border-white shadow-sm group-hover:border-indigo-200 transition-all"
                                                        />
                                                        <span className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-white ${a.color ?? 'bg-blue-500'}`} />
                                                    </div>
                                                    <div className="min-w-0 flex-1">
                                                        <p className="text-sm font-semibold text-slate-800 truncate group-hover:text-indigo-700">{a.name}</p>
                                                        <p className="text-xs text-slate-400 truncate">{a.role}</p>
                                                    </div>
                                                    <ChevronRight size={14} className="text-slate-300 group-hover:text-indigo-400 shrink-0 transition-colors" />
                                                </button>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Independently scrollable messages area */}
                <ChatMessages messages={messages} isTyping={isTyping} currentStatus={currentStatus} agent={agent} />

                {/* Fixed input at bottom */}
                <ChatInput
                    value={inputValue}
                    onChange={setInputValue}
                    onSubmit={handleSendMessage}
                    isDisabled={isTyping}
                    placeholder={`Message ${agent.name}...`}
                />
            </div>
        </div>
    );
}

