'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { api } from '@/lib/api';
import { telegramService } from '@/services/telegramService';
import { TelegramConnectCard } from '@/components/telegram/TelegramConnectCard';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { Agent } from '@/types/agents';
import { TelegramIntegration, TelegramIntegrationUpdate } from '@/types/telegram';
import { Plug } from 'lucide-react';

export default function IntegrationsPage() {
    const queryClient = useQueryClient();
    const [connectError, setConnectError] = useState<string | null>(null);
    const [isDisconnectOpen, setIsDisconnectOpen] = useState(false);

    const { data: integration, isLoading } = useQuery<TelegramIntegration>({
        queryKey: ['telegram-integration'],
        queryFn: telegramService.getIntegration,
    });

    const { data: agents = [] } = useQuery<Agent[]>({
        queryKey: ['agents'],
        queryFn: async () => {
            const res = await api.get('/agent');
            return res.data ?? [];
        },
    });

    const invalidate = () => {
        queryClient.invalidateQueries({ queryKey: ['telegram-integration'] });
    };

    const connectMutation = useMutation({
        mutationFn: (botToken: string) => telegramService.connect({ bot_token: botToken }),
        onSuccess: () => {
            setConnectError(null);
            invalidate();
        },
        onError: (error: unknown) => {
            // The API's own message names the actual problem — a token
            // Telegram rejected, or a webhook URL it would not accept — and
            // that is far more actionable than "something went wrong".
            const detail = axios.isAxiosError(error)
                ? (error.response?.data?.error?.message ?? error.response?.data?.detail)
                : null;
            setConnectError(
                typeof detail === 'string'
                    ? detail
                    : 'Could not connect that bot. Check the token and try again.'
            );
        },
    });

    const updateMutation = useMutation({
        // Wrapped rather than passed by reference: react-query hands a mutation
        // context as a second argument, and forwarding that into a service
        // call is only ever an accident waiting to matter.
        mutationFn: (data: TelegramIntegrationUpdate) =>
            telegramService.updateIntegration(data),
        onSuccess: invalidate,
    });

    const disconnectMutation = useMutation({
        mutationFn: () => telegramService.disconnect(),
        onSuccess: () => {
            setIsDisconnectOpen(false);
            invalidate();
            // Threads stay in the database, but the list the inbox is holding
            // belongs to a bot that is no longer connected.
            queryClient.invalidateQueries({ queryKey: ['telegram-threads'] });
        },
    });

    return (
        <div className="flex-1 overflow-y-auto">
            <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
                <header className="mb-8">
                    <div className="flex items-center gap-2 text-slate-400 mb-2">
                        <Plug size={16} />
                        <span className="text-xs font-bold uppercase tracking-wider">
                            Integrations
                        </span>
                    </div>
                    <h1 className="text-3xl font-extrabold text-slate-900">
                        Connect a channel
                    </h1>
                    <p className="text-slate-500 font-medium mt-2">
                        Bring your organization&apos;s agent to the places your people
                        already are.
                    </p>
                </header>

                <TelegramConnectCard
                    integration={integration}
                    agents={agents}
                    isLoading={isLoading}
                    isConnecting={connectMutation.isPending}
                    isUpdating={updateMutation.isPending}
                    connectError={connectError}
                    onConnect={(token) => connectMutation.mutate(token)}
                    onDisconnect={() => setIsDisconnectOpen(true)}
                    onChangeAgent={(agentId) => updateMutation.mutate({ agent_id: agentId })}
                    onToggleAutoReply={(autoReply) =>
                        updateMutation.mutate({ auto_reply: autoReply })
                    }
                />
            </div>

            <ConfirmDialog
                isOpen={isDisconnectOpen}
                onClose={() => setIsDisconnectOpen(false)}
                onConfirm={() => disconnectMutation.mutate()}
                isLoading={disconnectMutation.isPending}
                title="Disconnect Telegram?"
                description="Your bot will stop receiving messages here and the stored token will be deleted. Past conversations stay in the Inbox."
                confirmText="Disconnect"
            />
        </div>
    );
}
