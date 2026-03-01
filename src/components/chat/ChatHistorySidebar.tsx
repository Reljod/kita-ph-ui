'use client';

import { ChatItem } from '@/types/agents';
import { MessageSquare, Plus, Zap } from 'lucide-react';

interface Props {
    chats: ChatItem[];
    activeChatId: string | null;
    onSelectChat: (chatId: string) => void;
    onNewChat: () => void;
}

export function ChatHistorySidebar({ chats, activeChatId, onSelectChat, onNewChat }: Props) {
    return (
        <aside className="w-72 border-r border-slate-200 bg-white flex flex-col shrink-0 overflow-hidden">
            <div className="p-4 border-b border-slate-100 bg-slate-50/50 shrink-0">
                <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                    <MessageSquare size={16} /> History
                </h3>
            </div>

            {/* Independently scrollable chat list */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1 scrollbar-thin scrollbar-thumb-slate-200">
                {chats.length === 0 && (
                    <div className="flex flex-col items-center justify-center p-8 text-center text-slate-400">
                        <MessageSquare size={32} className="mb-2 opacity-20" />
                        <p className="text-xs">No history yet</p>
                    </div>
                )}
                {chats.map((chat) => (
                    <button
                        key={chat.id}
                        onClick={() => onSelectChat(chat.id)}
                        className={`w-full text-left p-3 rounded-xl transition-all group ${activeChatId === chat.id
                            ? 'bg-indigo-50 border-indigo-100 ring-1 ring-indigo-200'
                            : 'hover:bg-slate-50 border-transparent'
                            } border mb-1`}
                    >
                        <div className="flex justify-between items-start mb-1">
                            <span className={`text-[11px] font-bold ${activeChatId === chat.id ? 'text-indigo-600' : 'text-slate-400'}`}>
                                {new Date(chat.updated_at).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </span>
                            {activeChatId === chat.id && <Zap size={10} className="text-indigo-500 animate-pulse" />}
                        </div>
                        <p className={`text-xs line-clamp-2 ${activeChatId === chat.id ? 'text-indigo-900 font-medium' : 'text-slate-600'}`}>
                            {chat.preview || 'New Conversation'}
                        </p>
                    </button>
                ))}
            </div>

            <div className="p-4 border-t border-slate-100 shrink-0">
                <button
                    onClick={onNewChat}
                    className="w-full py-2 bg-slate-900 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-2 hover:bg-slate-800 transition-colors shadow-sm"
                >
                    <Plus size={14} /> New Chat
                </button>
            </div>
        </aside>
    );
}
