'use client';

import { useState } from 'react';
import { Bot, Check, Loader2, Send, ShieldCheck, TriangleAlert } from 'lucide-react';
import { TelegramIntegration } from '@/types/telegram';
import { Agent } from '@/types/agents';

interface Props {
    integration?: TelegramIntegration;
    agents: Agent[];
    isLoading: boolean;
    isConnecting: boolean;
    isUpdating: boolean;
    connectError?: string | null;
    onConnect: (botToken: string) => void;
    onDisconnect: () => void;
    onChangeAgent: (agentId: string) => void;
    onToggleAutoReply: (autoReply: boolean) => void;
}

export function TelegramConnectCard({
    integration,
    agents,
    isLoading,
    isConnecting,
    isUpdating,
    connectError,
    onConnect,
    onDisconnect,
    onChangeAgent,
    onToggleAutoReply,
}: Props) {
    const [botToken, setBotToken] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!botToken.trim()) return;
        onConnect(botToken.trim());
        // Clear immediately: the token is a full-privilege credential and the
        // field has served its purpose the moment it is submitted.
        setBotToken('');
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-48 text-slate-400">
                <Loader2 className="animate-spin" size={24} />
            </div>
        );
    }

    const connected = integration?.connected;

    return (
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="p-6 sm:p-8 flex items-start gap-4 border-b border-slate-100">
                <div className="w-14 h-14 shrink-0 rounded-2xl bg-sky-50 flex items-center justify-center text-sky-500">
                    <Send size={26} />
                </div>
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="text-xl font-extrabold text-slate-900">Telegram</h2>
                        {connected ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-600 text-xs font-bold">
                                <Check size={12} /> Connected
                            </span>
                        ) : (
                            <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-500 text-xs font-bold">
                                Not connected
                            </span>
                        )}
                    </div>
                    <p className="text-slate-500 text-sm mt-1 font-medium leading-relaxed">
                        Let people message your organization on Telegram and have your
                        agent answer. You can take over any conversation from the Inbox.
                    </p>
                </div>
            </div>

            {connected ? (
                <div className="p-6 sm:p-8 space-y-6">
                    <dl className="grid gap-4 sm:grid-cols-2">
                        <div>
                            <dt className="text-xs font-bold uppercase tracking-wider text-slate-400">
                                Bot
                            </dt>
                            <dd className="mt-1 text-slate-900 font-semibold flex items-center gap-2">
                                <Bot size={16} className="text-slate-400" />
                                {integration?.bot_username
                                    ? `@${integration.bot_username}`
                                    : (integration?.bot_name ?? 'Unknown')}
                            </dd>
                        </div>
                        <div>
                            <dt className="text-xs font-bold uppercase tracking-wider text-slate-400">
                                Token
                            </dt>
                            <dd
                                className="mt-1 text-slate-600 font-mono text-sm truncate"
                                title="Kita only stores this encrypted and never shows it again"
                            >
                                {integration?.masked_token}
                            </dd>
                        </div>
                    </dl>

                    <div>
                        <label
                            htmlFor="telegram-agent"
                            className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2"
                        >
                            Answering agent
                        </label>
                        <select
                            id="telegram-agent"
                            value={integration?.agent_id ?? ''}
                            disabled={isUpdating}
                            onChange={(e) => onChangeAgent(e.target.value)}
                            className="w-full sm:max-w-sm px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-medium text-slate-700 outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300 transition-all disabled:opacity-60"
                        >
                            <option value="">Pick an agent</option>
                            {agents.map((agent) => (
                                <option key={agent.id} value={agent.id}>
                                    {agent.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    <label className="flex items-start gap-3 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={integration?.auto_reply ?? false}
                            disabled={isUpdating}
                            onChange={(e) => onToggleAutoReply(e.target.checked)}
                            className="mt-1 w-4 h-4 rounded accent-indigo-600"
                        />
                        <span>
                            <span className="block font-semibold text-slate-800">
                                Answer new messages automatically
                            </span>
                            <span className="block text-sm text-slate-500 font-medium">
                                Turn this off to leave every conversation for a human. You
                                can also override it on a single conversation in the Inbox.
                            </span>
                        </span>
                    </label>

                    <div className="pt-2 border-t border-slate-100 flex justify-end">
                        <button
                            onClick={onDisconnect}
                            className="px-5 py-3 rounded-2xl font-bold text-red-600 bg-red-50 hover:bg-red-100 transition-colors"
                        >
                            Disconnect
                        </button>
                    </div>
                </div>
            ) : (
                <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-5">
                    <ol className="text-sm text-slate-500 font-medium space-y-1.5 list-decimal list-inside">
                        <li>
                            Open{' '}
                            <span className="font-mono text-slate-700">@BotFather</span> in
                            Telegram and send <span className="font-mono">/newbot</span>.
                        </li>
                        <li>Copy the token it gives you and paste it below.</li>
                    </ol>

                    <div>
                        <label
                            htmlFor="telegram-bot-token"
                            className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2"
                        >
                            Bot token
                        </label>
                        <input
                            id="telegram-bot-token"
                            type="password"
                            autoComplete="off"
                            value={botToken}
                            onChange={(e) => setBotToken(e.target.value)}
                            placeholder="123456789:AA..."
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-mono text-sm outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300 transition-all"
                        />
                        <p className="mt-2 text-xs text-slate-400 font-medium flex items-center gap-1.5">
                            <ShieldCheck size={13} />
                            Stored encrypted. Kita never shows it again after this.
                        </p>
                    </div>

                    {connectError && (
                        <p
                            role="alert"
                            className="flex items-start gap-2 text-sm font-semibold text-red-600 bg-red-50 rounded-2xl px-4 py-3"
                        >
                            <TriangleAlert size={16} className="mt-0.5 shrink-0" />
                            {connectError}
                        </p>
                    )}

                    <button
                        type="submit"
                        disabled={!botToken.trim() || isConnecting}
                        className="w-full sm:w-auto px-6 py-3.5 bg-indigo-600 text-white rounded-2xl font-bold shadow-lg shadow-indigo-200 hover:bg-indigo-700 disabled:bg-slate-300 disabled:shadow-none transition-all flex items-center justify-center gap-2"
                    >
                        {isConnecting && <Loader2 size={16} className="animate-spin" />}
                        Connect bot
                    </button>
                </form>
            )}
        </div>
    );
}
