'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Agent, ChatItem, Message } from '@/types/agents';
import { api } from '@/lib/api';
import { ChatHistorySidebar } from './ChatHistorySidebar';
import { ChatMessages } from './ChatMessages';
import { ChatInput } from './ChatInput';

interface Props {
    agent: Agent;
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

export function ChatView({ agent, initialChatId, initialChats, initialMessages }: Props) {
    const router = useRouter();

    const [chats, setChats] = useState<ChatItem[]>(initialChats);
    const [activeChatId, setActiveChatId] = useState<string | null>(initialChatId);
    const [messages, setMessages] = useState<Message[]>(initialMessages);
    const [inputValue, setInputValue] = useState('');
    const [isTyping, setIsTyping] = useState(false);

    // When user selects a different chat from the sidebar — update URL for reload persistence
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

    // New Chat — posts to backend, then navigates to the new chatId URL
    const handleNewChat = async () => {
        // Optimistically clear messages
        setMessages([]);
        setActiveChatId(null);
        // Navigate to base agent chat route; the page will show empty state
        router.push(`/agents/${agent.id}/chat`);
    };

    const handleSendMessage = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!inputValue.trim()) return;

        const userText = inputValue.trim();
        setInputValue('');
        setIsTyping(true);

        // Optimistic user message
        const optimisticMsg: Message = {
            id: crypto.randomUUID(),
            role: 'user',
            content: userText,
        };
        setMessages((prev) => [...prev, optimisticMsg]);

        try {
            let res;
            if (activeChatId) {
                res = await api.post(`/agent/${agent.id}/chat/${activeChatId}/continue`, { message: userText });
            } else {
                res = await api.post(`/agent/${agent.id}/chat`, { message: userText });
            }

            const chatData = res.data;
            const newChatId: string = chatData.id ?? activeChatId;

            // If this was a new chat, update URL and local state so reload persists
            if (!activeChatId && newChatId) {
                setActiveChatId(newChatId);
                router.replace(`/agents/${agent.id}/chat/${newChatId}`);
                // Also refresh chats list
                try {
                    const chatsRes = await api.get(`/agent/${agent.id}/chat?preview=true`);
                    setChats(chatsRes.data ?? []);
                } catch { /* non-critical */ }
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
        }
    };

    return (
        <div className="flex-1 flex overflow-hidden">
            <ChatHistorySidebar
                chats={chats}
                activeChatId={activeChatId}
                onSelectChat={handleSelectChat}
                onNewChat={handleNewChat}
            />
            <div className="flex-1 flex flex-col overflow-hidden">
                {/* Agent header info */}
                <div className="px-6 py-4 shrink-0 border-b border-slate-100 bg-white/50 backdrop-blur-sm">
                    <h2 className="text-lg font-bold text-slate-800">{agent.name}</h2>
                    <p className="text-sm text-slate-500">{agent.role}</p>
                </div>

                {/* Independently scrollable messages area */}
                <ChatMessages messages={messages} isTyping={isTyping} agent={agent} />

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
