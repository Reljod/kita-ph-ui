'use client';

import { useEffect, useRef, useState } from 'react';
import { Bot, Loader2, Send, UserRound } from 'lucide-react';
import { TelegramMessage, TelegramThread } from '@/types/telegram';

interface Props {
    thread: TelegramThread;
    messages: TelegramMessage[];
    isLoading: boolean;
    isSending: boolean;
    /** The org-level default, used when the thread has no override of its own. */
    defaultAutoReply: boolean;
    onSend: (text: string) => void;
    onToggleAutoReply: (autoReply: boolean) => void;
}

const senderLabel: Record<TelegramMessage['sender'], string> = {
    user: '',
    agent: 'Agent',
    member: 'You',
};

export function TelegramConversation({
    thread,
    messages,
    isLoading,
    isSending,
    defaultAutoReply,
    onSend,
    onToggleAutoReply,
}: Props) {
    const [draft, setDraft] = useState('');
    const endRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        endRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // `null` means the thread inherits the integration's setting rather than
    // holding an opinion of its own, so the switch has to fall back to it.
    const autoReply = thread.auto_reply ?? defaultAutoReply;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const text = draft.trim();
        if (!text || isSending) return;
        onSend(text);
        setDraft('');
    };

    return (
        <div className="flex flex-col h-full min-h-0">
            <header className="px-6 py-4 border-b border-slate-200 flex items-center gap-3 shrink-0">
                <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                    <UserRound size={18} />
                </div>
                <div className="min-w-0">
                    <h2 className="font-extrabold text-slate-900 truncate">
                        {thread.display_name}
                    </h2>
                    {thread.username && (
                        <p className="text-xs font-semibold text-slate-400">
                            @{thread.username}
                        </p>
                    )}
                </div>

                <label className="ml-auto flex items-center gap-2 cursor-pointer shrink-0">
                    <input
                        type="checkbox"
                        checked={autoReply}
                        onChange={(e) => onToggleAutoReply(e.target.checked)}
                        className="w-4 h-4 rounded accent-indigo-600"
                    />
                    <span className="text-sm font-semibold text-slate-600">
                        Agent replies
                    </span>
                </label>
            </header>

            <div className="flex-1 min-h-0 overflow-y-auto px-6 py-6 space-y-4">
                {isLoading ? (
                    <div className="flex justify-center py-12 text-slate-300">
                        <Loader2 className="animate-spin" size={22} />
                    </div>
                ) : (
                    messages.map((message) => {
                        const isInbound = message.direction === 'inbound';
                        return (
                            <div
                                key={message.id}
                                className={`flex ${isInbound ? 'justify-start' : 'justify-end'}`}
                            >
                                <div
                                    className={`max-w-[75%] rounded-2xl px-4 py-2.5 shadow-sm ${
                                        isInbound
                                            ? 'bg-slate-100 text-slate-800 rounded-tl-sm'
                                            : message.sender === 'agent'
                                              ? 'bg-indigo-600 text-white rounded-tr-sm'
                                              : 'bg-emerald-600 text-white rounded-tr-sm'
                                    }`}
                                >
                                    {!isInbound && (
                                        <span className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide opacity-80 mb-0.5">
                                            {message.sender === 'agent' && <Bot size={11} />}
                                            {senderLabel[message.sender]}
                                        </span>
                                    )}
                                    <p className="whitespace-pre-wrap break-words text-[14.5px] leading-relaxed">
                                        {message.text}
                                    </p>
                                </div>
                            </div>
                        );
                    })
                )}
                <div ref={endRef} />
            </div>

            <form
                onSubmit={handleSubmit}
                className="p-4 border-t border-slate-200 bg-slate-50/80 shrink-0"
            >
                <div className="relative flex items-center bg-white border border-slate-200 rounded-2xl focus-within:ring-2 focus-within:ring-indigo-100 focus-within:border-indigo-300 transition-all">
                    <input
                        type="text"
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        placeholder="Reply as your bot..."
                        aria-label="Reply as your bot"
                        disabled={isSending}
                        className="w-full py-3.5 pl-4 pr-14 bg-transparent outline-none rounded-2xl disabled:opacity-60"
                    />
                    <button
                        type="submit"
                        aria-label="Send reply"
                        disabled={!draft.trim() || isSending}
                        className="absolute right-2 p-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white rounded-xl transition-colors flex items-center justify-center"
                    >
                        {isSending ? (
                            <Loader2 size={16} className="animate-spin" />
                        ) : (
                            <Send size={16} className="ml-0.5" />
                        )}
                    </button>
                </div>
                {autoReply && (
                    <p className="mt-2 text-center text-xs text-slate-400 font-medium">
                        Your agent is answering this conversation. Turn off{' '}
                        <span className="font-semibold">Agent replies</span> to handle it
                        yourself.
                    </p>
                )}
            </form>
        </div>
    );
}
