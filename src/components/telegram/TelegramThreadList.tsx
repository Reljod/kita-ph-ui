'use client';

import { Inbox, UserRound } from 'lucide-react';
import { TelegramThread } from '@/types/telegram';

interface Props {
    threads: TelegramThread[];
    selectedThreadId: string | null;
    onSelect: (threadId: string) => void;
}

/** Render a timestamp as a short relative age. Long conversations otherwise
 *  turn the list into a wall of identical-looking dates. */
export function relativeTime(iso?: string | null, now: Date = new Date()): string {
    if (!iso) return '';
    const then = new Date(iso);
    const seconds = Math.round((now.getTime() - then.getTime()) / 1000);

    if (!Number.isFinite(seconds)) return '';
    if (seconds < 60) return 'now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d`;
    return then.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function TelegramThreadList({ threads, selectedThreadId, onSelect }: Props) {
    if (threads.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-full px-6 text-center text-slate-400">
                <Inbox size={32} className="mb-3" />
                <p className="font-semibold text-slate-500">No conversations yet</p>
                <p className="text-sm font-medium mt-1">
                    They appear here as soon as someone messages your bot.
                </p>
            </div>
        );
    }

    return (
        <ul className="divide-y divide-slate-100">
            {threads.map((thread) => {
                const isSelected = thread.id === selectedThreadId;
                return (
                    <li key={thread.id}>
                        <button
                            onClick={() => onSelect(thread.id)}
                            aria-current={isSelected ? 'true' : undefined}
                            className={`w-full text-left px-4 py-3.5 flex gap-3 transition-colors ${
                                isSelected ? 'bg-indigo-50' : 'hover:bg-slate-50'
                            }`}
                        >
                            <div className="w-10 h-10 shrink-0 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                                <UserRound size={18} />
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="flex items-baseline gap-2">
                                    <span
                                        className={`truncate font-bold text-sm ${
                                            isSelected ? 'text-indigo-700' : 'text-slate-800'
                                        }`}
                                    >
                                        {thread.display_name}
                                    </span>
                                    <span className="ml-auto shrink-0 text-[11px] font-semibold text-slate-400">
                                        {relativeTime(thread.last_message_at)}
                                    </span>
                                </div>
                                <div className="flex items-center gap-2 mt-0.5">
                                    <p className="truncate text-sm text-slate-500 font-medium">
                                        {thread.last_message_preview ?? 'No messages yet'}
                                    </p>
                                    {thread.unread_count > 0 && (
                                        <span
                                            aria-label={`${thread.unread_count} unread`}
                                            className="ml-auto shrink-0 min-w-5 h-5 px-1.5 rounded-full bg-indigo-600 text-white text-[11px] font-bold flex items-center justify-center"
                                        >
                                            {thread.unread_count}
                                        </span>
                                    )}
                                </div>
                                {thread.auto_reply === false && (
                                    <span className="inline-block mt-1.5 px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 text-[10px] font-bold uppercase tracking-wide">
                                        Human handling
                                    </span>
                                )}
                            </div>
                        </button>
                    </li>
                );
            })}
        </ul>
    );
}
