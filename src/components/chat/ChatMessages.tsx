'use client';

import { Message, Agent } from '@/types/agents';
import { User } from 'lucide-react';
import { MarkdownRenderer } from './MarkdownRenderer';
import { useEffect, useRef, useState } from 'react';

interface Props {
    messages: Message[];
    isTyping: boolean;
    currentStatus?: string | null;
    agent: Agent;
}

export function ChatMessages({ messages, isTyping, currentStatus, agent }: Props) {
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isTyping]);

    return (
        <main className="flex-1 overflow-y-auto px-4 md:px-8 py-6 space-y-6">
            {messages
                .filter((msg) => msg.content.trim() !== '' || (msg.thinking && msg.thinking.trim() !== ''))
                .map((msg, index, filteredMessages) => {
                    const showAvatar = index === 0 || filteredMessages[index - 1].role !== msg.role;

                    return (
                        <ChatMessageItem
                            key={msg.id}
                            msg={msg}
                            showAvatar={showAvatar}
                            agent={agent}
                        />
                    );
                })}

            {isTyping && (() => {
                const lastMsg = messages
                    .filter((msg) => msg.content.trim() !== '' || (msg.thinking && msg.thinking.trim() !== ''))
                    .pop();
                const showStatusAvatar = !lastMsg || lastMsg.role !== 'agent';

                return (
                    <div className="flex gap-4 flex-row animate-in fade-in duration-300">
                        <div className={`w-10 h-10 shrink-0 rounded-full overflow-hidden flex items-center justify-center bg-white shadow-sm border border-slate-100 ${
                            !showStatusAvatar ? 'opacity-0 select-none pointer-events-none' : ''
                        }`}>
                            {showStatusAvatar && (
                                agent.avatar
                                    ? /* eslint-disable-next-line @next/next/no-img-element */
                                    <img src={agent.avatar} alt="Agent" className="w-full h-full object-cover grayscale opacity-80" />
                                    : <User size={20} />
                            )}
                        </div>
                        <div className="bg-slate-50 border border-slate-100/80 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm flex items-center min-h-[40px]">
                            {currentStatus ? (
                                <p className="text-slate-400 italic text-[13.5px] leading-relaxed">
                                    {currentStatus.split(/\*(.*?)\*/g).map((part, i) =>
                                        i % 2 === 1
                                            ? <strong key={i} className="font-semibold text-slate-500">{part}</strong>
                                            : <span key={i}>{part}</span>
                                    )}
                                    <span className="animate-blink font-bold text-indigo-400 ml-0.5">...</span>
                                </p>
                            ) : (
                                <div className="flex items-center gap-2">
                                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-300 animate-bounce" style={{ animationDelay: '0ms' }} />
                                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-300 animate-bounce" style={{ animationDelay: '150ms' }} />
                                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-300 animate-bounce" style={{ animationDelay: '300ms' }} />
                                </div>
                            )}
                        </div>
                    </div>
                );
            })()}
            <div ref={messagesEndRef} />
        </main>
    );
}

interface MessageItemProps {
    msg: Message;
    showAvatar: boolean;
    agent: Agent;
}

function ChatMessageItem({ msg, showAvatar, agent }: MessageItemProps) {
    const [isThoughtOpen, setIsThoughtOpen] = useState(msg.streaming ?? false);

    // Keep the thought open while streaming, and collapse it when streaming finishes
    useEffect(() => {
        setIsThoughtOpen(msg.streaming ?? false);
    }, [msg.streaming]);

    return (
        <div
            className={`flex gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'} animate-in fade-in slide-in-from-bottom-2 duration-300`}
        >
            <div className={`w-10 h-10 shrink-0 rounded-full flex items-center justify-center overflow-hidden ${
                !showAvatar 
                    ? 'opacity-0 select-none pointer-events-none'
                    : msg.role === 'user' 
                        ? 'bg-indigo-600 text-white shadow-sm' 
                        : 'bg-white border border-slate-200 shadow-sm'
            }`}>
                {showAvatar && (
                    msg.role === 'user' ? (
                        <User size={20} />
                    ) : (
                        agent.avatar
                            ? /* eslint-disable-next-line @next/next/no-img-element */
                            <img src={agent.avatar} alt="Agent" className="w-full h-full object-cover" />
                            : <User size={20} />
                    )
                )}
            </div>

            <div className={`rounded-2xl shadow-sm text-[15px] leading-relaxed ${msg.role === 'user'
                ? 'max-w-[75%] p-4 bg-indigo-600 text-white rounded-tr-sm'
                : msg.streaming
                    ? 'max-w-[60%] p-3 bg-slate-50/85 border border-slate-100/80 text-slate-400 italic rounded-tl-sm'
                    : 'max-w-[75%] p-4 bg-white border border-slate-100 text-slate-700 rounded-tl-sm'
                }`}>
                {msg.role === 'agent' && msg.thinking && (
                    <details 
                        className="mb-3 border-b border-slate-100 pb-3 text-xs text-slate-400 select-none cursor-pointer group" 
                        open={isThoughtOpen}
                        onToggle={(e) => {
                            setIsThoughtOpen(e.currentTarget.open);
                        }}
                    >
                        <summary className="font-semibold text-slate-500 hover:text-slate-700 transition-colors flex items-center gap-1.5 list-none">
                            <span className="transition-transform duration-200 group-open:rotate-90">▶</span>
                            Thought Process
                        </summary>
                        <div className="mt-2 text-slate-400 italic font-mono whitespace-pre-line leading-relaxed max-h-48 overflow-y-auto pr-1">
                            {msg.thinking}
                        </div>
                    </details>
                )}
                <MarkdownRenderer
                    content={msg.content}
                    className={msg.role === 'user'
                        ? 'prose-invert text-white/95'
                        : msg.streaming
                            ? 'text-slate-400 italic'
                            : 'text-slate-700'
                    }
                />
            </div>
        </div>
    );
}
