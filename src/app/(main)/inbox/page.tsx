'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { Loader2, MessagesSquare, Send } from 'lucide-react';
import { telegramService } from '@/services/telegramService';
import { TelegramThreadList } from '@/components/telegram/TelegramThreadList';
import { TelegramConversation } from '@/components/telegram/TelegramConversation';
import { TelegramIntegration, TelegramMessage, TelegramThread } from '@/types/telegram';

// Inbound Telegram messages arrive without us asking, and the traffic is
// human-typing-speed rather than streaming, so a poll is enough. See
// docs/TELEGRAM_INTEGRATION.md in kita-api for why this is not a socket.
const POLL_INTERVAL_MS = 5000;

export default function InboxPage() {
    const queryClient = useQueryClient();
    const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);

    const { data: integration } = useQuery<TelegramIntegration>({
        queryKey: ['telegram-integration'],
        queryFn: telegramService.getIntegration,
    });

    const { data: threads = [], isLoading: isLoadingThreads } = useQuery<TelegramThread[]>({
        queryKey: ['telegram-threads'],
        queryFn: telegramService.getThreads,
        refetchInterval: POLL_INTERVAL_MS,
    });

    // Deriving the selection from state alone would leave the pane empty on
    // first load until the user clicks something, even though there is an
    // obvious conversation to show.
    const activeThreadId = selectedThreadId ?? threads[0]?.id ?? null;
    const activeThread = threads.find((t) => t.id === activeThreadId) ?? null;

    const { data: messages = [], isLoading: isLoadingMessages } = useQuery<TelegramMessage[]>({
        queryKey: ['telegram-messages', activeThreadId],
        queryFn: () => telegramService.getMessages(activeThreadId as string),
        enabled: !!activeThreadId,
        refetchInterval: POLL_INTERVAL_MS,
    });

    const markReadMutation = useMutation({
        // See the note in the integrations page: react-query passes a
        // context argument that a bare service reference would swallow.
        mutationFn: (threadId: string) => telegramService.markRead(threadId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['telegram-threads'] });
        },
    });

    // Opening a conversation is what "reading" it means, so clear the badge
    // here rather than making the user do it explicitly.
    const unreadCount = activeThread?.unread_count ?? 0;
    const markRead = markReadMutation.mutate;
    useEffect(() => {
        if (activeThreadId && unreadCount > 0) {
            markRead(activeThreadId);
        }
    }, [activeThreadId, unreadCount, markRead]);

    const sendMutation = useMutation({
        mutationFn: ({ threadId, text }: { threadId: string; text: string }) =>
            telegramService.sendMessage(threadId, text),
        onSuccess: (_data, variables) => {
            queryClient.invalidateQueries({
                queryKey: ['telegram-messages', variables.threadId],
            });
            queryClient.invalidateQueries({ queryKey: ['telegram-threads'] });
        },
    });

    const autoReplyMutation = useMutation({
        mutationFn: ({ threadId, autoReply }: { threadId: string; autoReply: boolean }) =>
            telegramService.updateThread(threadId, { auto_reply: autoReply }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['telegram-threads'] });
        },
    });

    if (integration && !integration.connected) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
                <div className="w-16 h-16 rounded-2xl bg-sky-50 flex items-center justify-center text-sky-500 mb-5">
                    <Send size={28} />
                </div>
                <h1 className="text-2xl font-extrabold text-slate-900">
                    No channel connected
                </h1>
                <p className="text-slate-500 font-medium mt-2 max-w-sm">
                    Connect a Telegram bot and the conversations people start with it will
                    show up here.
                </p>
                <Link
                    href="/integrations"
                    className="mt-6 px-6 py-3.5 bg-indigo-600 text-white rounded-2xl font-bold shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all"
                >
                    Connect Telegram
                </Link>
            </div>
        );
    }

    return (
        <div className="flex-1 flex min-h-0">
            <aside className="w-full max-w-xs border-r border-slate-200 flex flex-col min-h-0 shrink-0">
                <div className="px-4 py-4 border-b border-slate-200 flex items-center gap-2 shrink-0">
                    <MessagesSquare size={18} className="text-slate-400" />
                    <h1 className="font-extrabold text-slate-900">Inbox</h1>
                    {threads.length > 0 && (
                        <span className="ml-auto text-xs font-bold text-slate-400">
                            {threads.length}
                        </span>
                    )}
                </div>
                <div className="flex-1 min-h-0 overflow-y-auto">
                    {isLoadingThreads ? (
                        <div className="flex justify-center py-12 text-slate-300">
                            <Loader2 className="animate-spin" size={22} />
                        </div>
                    ) : (
                        <TelegramThreadList
                            threads={threads}
                            selectedThreadId={activeThreadId}
                            onSelect={setSelectedThreadId}
                        />
                    )}
                </div>
            </aside>

            <section className="flex-1 min-w-0 flex flex-col min-h-0">
                {activeThread ? (
                    <TelegramConversation
                        thread={activeThread}
                        messages={messages}
                        isLoading={isLoadingMessages}
                        isSending={sendMutation.isPending}
                        defaultAutoReply={integration?.auto_reply ?? true}
                        onSend={(text) =>
                            sendMutation.mutate({ threadId: activeThread.id, text })
                        }
                        onToggleAutoReply={(autoReply) =>
                            autoReplyMutation.mutate({
                                threadId: activeThread.id,
                                autoReply,
                            })
                        }
                    />
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-center px-6 text-slate-400">
                        <MessagesSquare size={32} className="mb-3" />
                        <p className="font-semibold text-slate-500">
                            Nothing to read yet
                        </p>
                        <p className="text-sm font-medium mt-1">
                            Message your bot on Telegram to start a conversation.
                        </p>
                    </div>
                )}
            </section>
        </div>
    );
}
