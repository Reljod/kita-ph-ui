'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { Loader2, User, Globe, Upload, X, FileText, CheckCircle2, AlertCircle, Save } from 'lucide-react';
import { Agent } from '@/types/agents';
import { Modal } from '@/components/common/Modal';
import { knowledgeService } from '@/services/knowledgeService';
import { FileResponse } from '@/types/knowledge';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    agents: Agent[];
    initialScope?: 'agent' | 'org';
    initialAgentId?: string;
    editingFile?: FileResponse | null;
}

interface UploadingFile {
    file: File;
    status: 'idle' | 'uploading' | 'completed' | 'error';
    error?: string;
    progress?: number;
}

export function AddKnowledgeModal({
    isOpen,
    onClose,
    onSuccess,
    agents,
    initialScope = 'agent',
    initialAgentId,
    editingFile
}: Props) {
    const [scope, setScope] = useState<'agent' | 'org'>(initialScope);
    const [agentId, setAgentId] = useState(initialAgentId || (agents.length > 0 ? agents[0].id : ''));
    const [customFilename, setCustomFilename] = useState('');
    const [files, setFiles] = useState<UploadingFile[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (editingFile) {
            setScope(editingFile.agent_id ? 'agent' : 'org');
            setAgentId(editingFile.agent_id || (agents.length > 0 ? agents[0].id : ''));
            setCustomFilename(editingFile.filename);
            setFiles([]);
        } else {
            setScope(initialScope);
            setAgentId(initialAgentId || (agents.length > 0 ? agents[0].id : ''));
            setCustomFilename('');
            setFiles([]);
        }
    }, [editingFile, isOpen, agents, initialScope, initialAgentId]);

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const newFiles = Array.from(e.target.files).map(f => ({
                file: f,
                status: 'idle' as const
            }));
            setFiles(prev => [...prev, ...newFiles]);
        }
    };

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        if (e.dataTransfer.files) {
            const newFiles = Array.from(e.dataTransfer.files).map(f => ({
                file: f,
                status: 'idle' as const
            }));
            setFiles(prev => [...prev, ...newFiles]);
        }
    }, []);

    const removeFile = (index: number) => {
        setFiles(prev => prev.filter((_, i) => i !== index));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (editingFile) {
            // Update existing file metadata
            setIsSubmitting(true);
            try {
                await knowledgeService.update(editingFile.id, {
                    filename: customFilename || undefined,
                    agent_id: scope === 'agent' ? agentId : undefined
                });
                onSuccess();
                onClose();
            } catch (error) {
                console.error('Failed to update knowledge:', error);
            } finally {
                setIsSubmitting(false);
            }
            return;
        }

        if (files.length === 0) return;

        setIsSubmitting(true);
        const updatedFiles = [...files];

        try {
            for (let i = 0; i < updatedFiles.length; i++) {
                const f = updatedFiles[i];
                if (f.status === 'completed') continue;

                try {
                    f.status = 'uploading';
                    setFiles([...updatedFiles]);

                    const filename = (i === 0 && customFilename) ? customFilename : f.file.name;

                    const initiateRes = await knowledgeService.initiateUpload({
                        filename,
                        size: f.file.size,
                        content_type: f.file.type,
                        agent_id: scope === 'agent' ? agentId : undefined
                    });

                    await knowledgeService.uploadFile(
                        initiateRes.upload_url,
                        f.file,
                        initiateRes.method,
                        initiateRes.token
                    );

                    await knowledgeService.completeUpload(initiateRes.file_id);

                    f.status = 'completed';
                } catch (err: unknown) {
                    console.error(`Failed to upload ${f.file.name}:`, err);
                    f.status = 'error';
                    f.error = err instanceof Error ? err.message : 'Upload failed';
                }
                setFiles([...updatedFiles]);
            }

            const allSuccess = updatedFiles.every(f => f.status === 'completed');
            if (allSuccess) {
                setTimeout(() => {
                    onSuccess();
                    onClose();
                    setFiles([]);
                    setCustomFilename('');
                }, 1000);
            }
        } catch (error) {
            console.error('Batch upload error:', error);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={editingFile ? 'Edit Knowledge' : 'Add to Knowledge Base'}
            maxWidth="max-w-2xl"
        >
            <form onSubmit={handleSubmit} className="px-8 py-8 space-y-6">
                {/* Scope Selector */}
                <div className="space-y-3">
                    <label className="text-sm font-semibold text-slate-700">Knowledge Scope</label>
                    <div className="flex bg-slate-50 p-1.5 rounded-2xl border border-slate-100">
                        <button
                            type="button"
                            disabled={isSubmitting}
                            onClick={() => setScope('agent')}
                            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all
                                ${scope === 'agent'
                                    ? 'bg-white text-indigo-600 shadow-sm border border-slate-100'
                                    : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            <User size={16} />
                            Agent Specific
                        </button>
                        <button
                            type="button"
                            disabled={isSubmitting}
                            onClick={() => setScope('org')}
                            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all
                                ${scope === 'org'
                                    ? 'bg-white text-indigo-600 shadow-sm border border-slate-100'
                                    : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            <Globe size={16} />
                            Organization Wide
                        </button>
                    </div>
                </div>

                {/* Agent Selector */}
                {scope === 'agent' && (
                    <div className="space-y-2">
                        <label htmlFor="knowledge-agent" className="text-sm font-semibold text-slate-700">Select Agent</label>
                        <select
                            id="knowledge-agent"
                            value={agentId}
                            disabled={isSubmitting}
                            onChange={(e) => setAgentId(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all appearance-none"
                        >
                            {agents.map((agent) => (
                                <option key={agent.id} value={agent.id}>
                                    {agent.name}
                                </option>
                            ))}
                        </select>
                    </div>
                )}

                {/* Optional Filename */}
                <div className="space-y-2">
                    <label htmlFor="knowledge-filename" className="text-sm font-semibold text-slate-700">
                        Filename <span className="text-slate-400 font-normal">{editingFile ? '' : '(Optional)'}</span>
                    </label>
                    <input
                        id="knowledge-filename"
                        type="text"
                        disabled={isSubmitting}
                        placeholder={editingFile ? "Update filename" : "Override filename (applies to first file if batching)"}
                        value={customFilename}
                        onChange={(e) => setCustomFilename(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all placeholder:text-slate-400"
                    />
                </div>

                {/* Upload Area - Hide when editing */}
                {!editingFile && (
                    <div className="space-y-3">
                        <label htmlFor="knowledge-files" className="text-sm font-semibold text-slate-700">Files</label>
                        <div
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={handleDrop}
                            onClick={() => fileInputRef.current?.click()}
                            className="border-2 border-dashed border-slate-200 rounded-3xl p-8 flex flex-col items-center justify-center gap-3 hover:border-indigo-400 hover:bg-slate-50 transition-all cursor-pointer"
                        >
                            <input
                                id="knowledge-files"
                                type="file"
                                multiple
                                hidden
                                ref={fileInputRef}
                                onChange={handleFileSelect}
                            />
                            <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-500">
                                <Upload size={24} />
                            </div>
                            <div className="text-center">
                                <p className="text-sm font-bold text-slate-900">Click to upload or drag and drop</p>
                                <p className="text-xs text-slate-400 mt-1">Maximum file size 6MB (for standard upload)</p>
                            </div>
                        </div>
                    </div>
                )}

                {/* File List / Batching */}
                {!editingFile && files.length > 0 && (
                    <div className="space-y-3">
                        <label className="text-sm font-semibold text-slate-700">Batch Queue ({files.length})</label>
                        <div className="space-y-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                            {files.map((f, i) => (
                                <div key={i} className="flex items-center gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-100 group">
                                    <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shadow-sm border border-slate-100 text-slate-400">
                                        <FileText size={20} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-semibold text-slate-700 truncate">{f.file.name}</p>
                                        <p className="text-[10px] text-slate-400">{(f.file.size / 1024).toFixed(1)} KB</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {f.status === 'uploading' && <Loader2 size={16} className="animate-spin text-indigo-500" />}
                                        {f.status === 'completed' && <CheckCircle2 size={18} className="text-emerald-500" />}
                                        {f.status === 'error' && <AlertCircle size={18} className="text-red-500" />}
                                        {f.status === 'idle' && !isSubmitting && (
                                            <button
                                                type="button"
                                                onClick={(e) => { e.stopPropagation(); removeFile(i); }}
                                                className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                            >
                                                <X size={14} />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                <button
                    type="submit"
                    disabled={isSubmitting || (!editingFile && files.length === 0)}
                    className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold text-lg shadow-lg shadow-indigo-200 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                >
                    {isSubmitting ? (
                        <>
                            <Loader2 className="animate-spin" size={20} />
                            {editingFile ? 'Saving Changes...' : 'Uploading Files...'}
                        </>
                    ) : (
                        editingFile ? (
                            <><Save size={20} /> Save Changes</>
                        ) : (
                            `Upload ${files.length > 0 ? `${files.length} Files` : 'to Knowledge'}`
                        )
                    )}
                </button>
            </form>
        </Modal>
    );
}
