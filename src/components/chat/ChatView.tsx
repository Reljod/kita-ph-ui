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
import { useAuthStore } from '@/store/useAuthStore';

interface Props {
    agent: Agent;
    allAgents?: Agent[];
    initialChatId: string | null;
    initialChats: ChatItem[];
    initialMessages: Message[];
}

export function parseBackendMessages(backendMessages: any[]): Message[] {
    const rawMessages = backendMessages
        .map((msg: any, index: number) => {
            const isAgent = msg.kind !== 'request';
            const hasToolCalls = isAgent && msg.parts && msg.parts.some((part: any) => part.part_kind === 'tool-call');

            // If it is an agent message and has tool calls, any 'text' part is an intermediate response before tool execution.
            // Move such text parts into 'thinking' instead of 'content'.
            const contentParts = msg.parts
                ? msg.parts.filter((part: any) => part.part_kind === 'user-prompt' || (part.part_kind === 'text' && !hasToolCalls))
                : [];
            const content = msg.parts
                ? contentParts.map((part: any) => part.content).join('\n')
                : msg.content || '';

            const thinkingParts = msg.parts
                ? msg.parts.filter((part: any) => part.part_kind === 'thinking' || (part.part_kind === 'text' && hasToolCalls))
                : [];
            const thinking = msg.parts
                ? thinkingParts.map((part: any) => part.content).join('\n')
                : undefined;

            return {
                id: `${msg.id || msg.run_id || crypto.randomUUID()}-${msg.kind}-${index}`,
                role: (msg.kind === 'request' ? 'user' : msg.kind === 'builder' ? 'builder' : 'agent') as 'user' | 'agent' | 'builder',
                content,
                thinking: thinking || undefined,
            };
        })
        .filter((msg) => msg.content.trim() !== '' || (msg.thinking && msg.thinking.trim() !== ''));

    // Merge consecutive messages with the same role
    const merged: Message[] = [];
    for (const msg of rawMessages) {
        const last = merged[merged.length - 1];
        if (last && last.role === msg.role) {
            // Merge content
            if (msg.content.trim()) {
                last.content = last.content 
                    ? `${last.content}\n${msg.content}` 
                    : msg.content;
            }
            // Merge thinking
            if (msg.thinking?.trim()) {
                last.thinking = last.thinking 
                    ? `${last.thinking}\n${msg.thinking}` 
                    : msg.thinking;
            }
        } else {
            merged.push({ ...msg });
        }
    }
    return merged;
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

        const agentMessageId = crypto.randomUUID();
        let agentMessageText = '';

        // Add optimistic placeholder for the agent message
        setMessages((prev) => [
            ...prev,
            {
                id: agentMessageId,
                role: 'agent',
                content: '',
                streaming: true,
            },
        ]);

        try {
            const token = Cookies.get('token');
            const baseURL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
            const url = activeChatId
                ? `${baseURL}/agent/${agent.id}/chat/${activeChatId}/continue`
                : `${baseURL}/agent/${agent.id}/chat`;

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                    'x-status-key': currentStatusKey,
                },
                body: JSON.stringify({ message: userText }),
            });

            if (response.status === 401) {
                useAuthStore.getState().logout();
                return;
            }

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const reader = response.body?.getReader();
            const decoder = new TextDecoder();
            if (!reader) throw new Error('No reader available for response body');

            let buffer = '';
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    const cleanedLine = line.trim();
                    if (cleanedLine.startsWith('data: ')) {
                        const dataStr = cleanedLine.slice(6);
                        try {
                            const parsedData = JSON.parse(dataStr);
                            if (parsedData.type === 'content') {
                                agentMessageText += parsedData.delta;
                                setMessages((prev) =>
                                    prev.map((m) =>
                                        m.id === agentMessageId ? { ...m, content: agentMessageText, streaming: true } : m
                                    )
                                );
                            } else if (parsedData.type === 'thought') {
                                setMessages((prev) =>
                                    prev.map((m) =>
                                        m.id === agentMessageId ? { ...m, thinking: (m.thinking ?? '') + parsedData.delta, streaming: true } : m
                                    )
                                );
                            } else if (parsedData.type === 'reset') {
                                agentMessageText = '';
                                setMessages((prev) =>
                                    prev.map((m) =>
                                        m.id === agentMessageId ? { ...m, content: '', thinking: '', streaming: true } : m
                                    )
                                );
                            } else if (parsedData.type === 'done') {
                                const chatData = parsedData.chat;
                                const newChatId: string = chatData.id ?? activeChatId;

                                // Invalidate the chats list sidebar query
                                queryClient.invalidateQueries({ queryKey: ['agent-chats', agent.id] });

                                if (!activeChatId && newChatId) {
                                    setActiveChatId(newChatId);
                                    router.replace(`/agents/${agent.id}/chat/${newChatId}`, { scroll: false });
                                }

                                const parsed = parseBackendMessages(chatData.messages ?? []);
                                queryClient.setQueryData(['chat-messages', agent.id, newChatId], parsed);
                                setMessages(parsed);
                            } else if (parsedData.type === 'error') {
                                throw new Error(parsedData.message);
                            }
                        } catch (err) {
                            console.error('Failed to parse SSE stream chunk:', err, cleanedLine);
                        }
                    }
                }
            }
        } catch (err) {
            console.error('Failed to send message:', err);
            // Replace placeholder or append error message
            setMessages((prev) =>
                prev.map((m) =>
                    m.id === agentMessageId
                        ? { ...m, content: 'Sorry, I encountered an error. Please try again.', streaming: false }
                        : m
                )
            );
        } finally {
            setIsTyping(false);
            setStatusKey(null);
            setCurrentStatus(null);
            setMessages((prev) =>
                prev.map((m) => m.streaming ? { ...m, streaming: false } : m)
            );
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

