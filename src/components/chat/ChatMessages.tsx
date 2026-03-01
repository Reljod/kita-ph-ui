'use client';

import { Message, Agent } from '@/types/agents';
import { User } from 'lucide-react';
import { MarkdownRenderer } from './MarkdownRenderer';
import { useEffect, useRef } from 'react';

interface Props {
    messages: Message[];
    isTyping: boolean;
    agent: Agent;
}

export function ChatMessages({ messages, isTyping, agent }: Props) {
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isTyping]);

    return (
        <main className="flex-1 overflow-y-auto px-4 md:px-8 py-6 space-y-6">
            {messages.map((msg) => (
                <div
                    key={msg.id}
                    className={`flex gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'} animate-in fade-in slide-in-from-bottom-2 duration-300`}
                >
                    <div className={`w-10 h-10 shrink-0 rounded-full flex items-center justify-center overflow-hidden shadow-sm ${msg.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200'}`}>
                        {msg.role === 'user' ? (
                            <User size={20} />
                        ) : (
                            agent.avatar
                                ? /* eslint-disable-next-line @next/next/no-img-element */
                                <img src={agent.avatar} alt="Agent" className="w-full h-full object-cover" />
                                : <User size={20} />
                        )}
                    </div>

                    <div className={`max-w-[75%] rounded-2xl p-4 shadow-sm text-[15px] leading-relaxed ${msg.role === 'user'
                        ? 'bg-indigo-600 text-white rounded-tr-sm'
                        : 'bg-white border border-slate-100 text-slate-700 rounded-tl-sm'
                        }`}>
                        <MarkdownRenderer
                            content={msg.content}
                            className={msg.role === 'user' ? 'prose-invert text-white/95' : 'text-slate-700'}
                        />
                    </div>
                </div>
            ))}

            {isTyping && (
                <div className="flex gap-4 flex-row animate-in fade-in duration-300">
                    <div className="w-10 h-10 shrink-0 rounded-full overflow-hidden flex items-center justify-center bg-white shadow-sm border border-slate-100">
                        {agent.avatar
                            ? /* eslint-disable-next-line @next/next/no-img-element */
                            <img src={agent.avatar} alt="Agent" className="w-full h-full object-cover grayscale opacity-80" />
                            : <User size={20} />
                        }
                    </div>
                    <div className="bg-white border border-slate-100 rounded-2xl rounded-tl-sm p-4 shadow-sm flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                </div>
            )}
            <div ref={messagesEndRef} />
        </main>
    );
}
