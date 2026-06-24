'use client';

import { FileResponse } from '@/types/knowledge';
import { User, Globe, Trash2, Calendar, Database, FileText, FileImage, FileCode, FileSpreadsheet, File, CheckCircle2, Clock, AlertCircle } from 'lucide-react';
import { FileStatus } from '@/types/knowledge';

interface Props {
    file: FileResponse;
    onDelete: (id: string) => void;
    onPreview: (file: FileResponse) => void;
}

export function KnowledgeCard({ file, onDelete, onPreview }: Props) {
    const isAgentScoped = !!file.agent_id;

    const formatDate = (dateStr: string) => {
        try {
            return new Intl.DateTimeFormat('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric'
            }).format(new Date(dateStr));
        } catch (e) {
            return dateStr;
        }
    };

    const formatSize = (bytes: number) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const getIcon = (ext: string) => {
        const lowExt = ext.toLowerCase();
        if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(lowExt)) return <FileImage size={24} className="text-pink-500" />;
        if (['py', 'js', 'ts', 'tsx', 'html', 'css', 'json'].includes(lowExt)) return <FileCode size={24} className="text-blue-500" />;
        if (['pdf', 'doc', 'docx', 'txt', 'md'].includes(lowExt)) return <FileText size={24} className="text-indigo-500" />;
        if (['csv', 'xls', 'xlsx'].includes(lowExt)) return <FileSpreadsheet size={24} className="text-emerald-500" />;
        return <File size={24} className="text-slate-400" />;
    };

    return (
        <div
            className="group relative bg-white border border-slate-200 rounded-3xl p-6 shadow-xl shadow-slate-200/50 transition-all duration-300 hover:border-indigo-200 hover:shadow-indigo-100/50 flex flex-col h-full cursor-pointer"
            onClick={() => onPreview(file)}
        >
            {/* Action Menu - Delete */}
            <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onDelete(file.id);
                    }}
                    className="p-2 bg-red-50 text-red-600 rounded-full hover:bg-red-100 transition-colors shadow-sm"
                    title="Delete knowledge"
                >
                    <Trash2 size={16} />
                </button>
            </div>

            {/* Scope Badge */}
            <div className="mb-5 flex items-center justify-between">
                <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold
                    ${isAgentScoped
                        ? 'bg-indigo-50 text-indigo-700 border border-indigo-100'
                        : 'bg-emerald-50 text-emerald-700 border border-emerald-100'}`}
                >
                    {isAgentScoped ? <User size={12} /> : <Globe size={12} />}
                    {isAgentScoped ? 'Agent' : 'Organization'}
                </div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                    {file.extension || 'FILE'}
                </span>
            </div>

            {/* Status Badge */}
            <div className="mb-4">
                <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-tight border
                    ${file.status === FileStatus.COMPLETED
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                        : file.status === FileStatus.FAILED
                            ? 'bg-red-50 text-red-700 border-red-100'
                            : 'bg-amber-50 text-amber-700 border-amber-100 animate-pulse'}`}
                >
                    {file.status === FileStatus.COMPLETED && <CheckCircle2 size={10} />}
                    {file.status === FileStatus.FAILED && <AlertCircle size={10} />}
                    {file.status === FileStatus.PENDING && <Clock size={10} className="animate-spin" />}
                    {file.status}
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 flex flex-col gap-4">
                <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center shrink-0 border border-slate-100">
                        {getIcon(file.extension)}
                    </div>
                    <div className="flex-1 min-w-0">
                        <h3 className="text-lg font-bold text-slate-900 leading-tight truncate" title={file.filename}>
                            {file.filename}
                        </h3>
                        <p className="text-slate-400 text-xs font-medium mt-1">
                            {formatSize(file.size)}
                        </p>
                    </div>
                </div>
            </div>

            {/* Footer */}
            <div className="mt-6 pt-5 border-t border-slate-100 flex items-center justify-between text-[11px] font-medium text-slate-400">
                <div className="flex items-center gap-1.5 uppercase tracking-wider">
                    <Database size={12} />
                    <span>In Storage</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <Calendar size={12} />
                    <span>
                        {formatDate(file.created_at)}
                    </span>
                </div>
            </div>
        </div>
    );
}
