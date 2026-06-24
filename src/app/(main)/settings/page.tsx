'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { Shield, Save, Loader2, CheckCircle2, ArrowLeft } from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';
import { organizationService } from '@/services/organizationService';

export default function SettingsPage() {
    const router = useRouter();
    const queryClient = useQueryClient();
    const { user } = useAuthStore();

    const [maxDelegationDepth, setMaxDelegationDepth] = useState<number>(5);
    const [maxWebsearchDepth, setMaxWebsearchDepth] = useState<number>(10);
    const [isSaving, setIsSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);

    const { data: org, isLoading } = useQuery({
        queryKey: ['organization', user?.org_id],
        queryFn: () => organizationService.getOrganization(user?.org_id!),
        enabled: !!user?.org_id,
    });

    useEffect(() => {
        if (org?.config) {
            setMaxDelegationDepth(org.config.max_delegation_depth ?? 5);
            setMaxWebsearchDepth(org.config.max_websearch_depth ?? 10);
        }
    }, [org]);

    const saveMutation = useMutation({
        mutationFn: () => organizationService.updateConfig(user?.org_id!, {
            max_delegation_depth: maxDelegationDepth,
            max_websearch_depth: maxWebsearchDepth,
        }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['organization', user?.org_id] });
            setSaveSuccess(true);
            setTimeout(() => setSaveSuccess(false), 3000);
        },
    });

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await saveMutation.mutateAsync();
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="flex-1 bg-slate-50 min-h-screen overflow-y-auto pb-20">
            <div className="sticky top-0 z-30 w-full bg-white/80 backdrop-blur-md border-b border-slate-100 px-8 py-4 flex items-center gap-4">
                <button
                    onClick={() => router.back()}
                    className="p-2 -ml-2 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-full transition-all"
                >
                    <ArrowLeft size={20} />
                </button>
                <div>
                    <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">Organization</h2>
                    <h1 className="text-xl font-extrabold text-slate-900 tracking-tight leading-none">Settings</h1>
                </div>
            </div>

            <div className="w-full max-w-3xl mx-auto px-4 py-8 animate-in fade-in slide-in-from-bottom-4">
                <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
                    <div className="flex items-center gap-2 text-indigo-600 mb-6">
                        <Shield size={20} />
                        <h2 className="font-bold uppercase tracking-wider text-sm">Guardrail Defaults</h2>
                    </div>
                    <p className="text-sm text-slate-500 mb-8">
                        These values serve as the organization-wide defaults for all agents. Individual agents can override them in their own settings.
                    </p>

                    {isLoading ? (
                        <div className="flex justify-center py-12">
                            <Loader2 className="animate-spin text-indigo-600" size={24} />
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-slate-700">
                                    Max Delegation Depth
                                </label>
                                <input
                                    type="number"
                                    min={1}
                                    max={50}
                                    value={maxDelegationDepth}
                                    onChange={(e) => setMaxDelegationDepth(e.target.value ? parseInt(e.target.value) : 5)}
                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 rounded-xl outline-none transition-all text-slate-800"
                                />
                                <p className="text-xs text-slate-400">
                                    Maximum nesting level for agent-to-agent delegation.
                                </p>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-slate-700">
                                    Max Web Search Depth
                                </label>
                                <input
                                    type="number"
                                    min={1}
                                    max={50}
                                    value={maxWebsearchDepth}
                                    onChange={(e) => setMaxWebsearchDepth(e.target.value ? parseInt(e.target.value) : 10)}
                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 rounded-xl outline-none transition-all text-slate-800"
                                />
                                <p className="text-xs text-slate-400">
                                    Maximum web search calls per agent run.
                                </p>
                            </div>
                        </div>
                    )}

                    <div className="mt-8 pt-6 border-t border-slate-100 flex justify-end">
                        <button
                            onClick={handleSave}
                            disabled={isSaving || isLoading}
                            className="px-6 py-3 text-sm font-semibold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 shadow-md shadow-indigo-100 transition-all flex items-center gap-2 disabled:opacity-70"
                        >
                            {isSaving ? <Loader2 size={16} className="animate-spin" /> : saveSuccess ? <CheckCircle2 size={16} /> : <Save size={16} />}
                            {isSaving ? 'Saving...' : saveSuccess ? 'Saved!' : 'Save Changes'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
