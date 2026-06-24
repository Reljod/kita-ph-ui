'use client';

import { FileResponse } from '@/types/knowledge';
import { 
    User, 
    Globe, 
    Trash2, 
    Calendar, 
    Database, 
    FileText, 
    FileImage, 
    FileCode, 
    FileSpreadsheet, 
    File,
    Edit2,
    MoreHorizontal,
    CheckCircle2,
    Clock,
    AlertCircle
} from 'lucide-react';
import { FileStatus } from '@/types/knowledge';

interface Props {
    files: FileResponse[];
    onDelete: (id: string) => void;
    onEdit: (file: FileResponse) => void;
    onPreview: (file: FileResponse) => void;
}

export function KnowledgeTable({ files, onDelete, onEdit, onPreview }: Props) {
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
        if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(lowExt)) return <FileImage size={18} className="text-pink-500" />;
        if (['py', 'js', 'ts', 'tsx', 'html', 'css', 'json'].includes(lowExt)) return <FileCode size={18} className="text-blue-500" />;
        if (['pdf', 'doc', 'docx', 'txt', 'md'].includes(lowExt)) return <FileText size={18} className="text-indigo-500" />;
        if (['csv', 'xls', 'xlsx'].includes(lowExt)) return <FileSpreadsheet size={18} className="text-emerald-500" />;
        return <File size={18} className="text-slate-400" />;
    };

    return (
        <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-slate-50/50 border-b border-slate-100">
                            <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">File Name</th>
                            <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">Scope</th>
                            <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">Status</th>
                            <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">Size</th>
                            <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">Upload Date</th>
                            <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-400 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                        {files.map((file) => (
                            <tr key={file.id} className="hover:bg-slate-50/80 group cursor-pointer" onClick={() => onPreview(file)}>
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-9 h-9 rounded-xl bg-slate-50 flex items-center justify-center shrink-0 border border-slate-100 group-hover:bg-white transition-colors">
                                            {getIcon(file.extension)}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-sm font-bold text-slate-900 truncate max-w-[240px]" title={file.filename}>
                                                {file.filename}
                                            </p>
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
                                                {file.extension || 'FILE'}
                                            </p>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <div className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-tight
                                        ${file.agent_id
                                            ? 'bg-indigo-50 text-indigo-700 border border-indigo-100'
                                            : 'bg-emerald-50 text-emerald-700 border border-emerald-100'}`}
                                    >
                                        {file.agent_id ? <User size={10} /> : <Globe size={10} />}
                                        {file.agent_id ? 'Agent' : 'Global'}
                                    </div>
                                </td>
                                <td className="px-6 py-4">
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
                                </td>
                                <td className="px-6 py-4">
                                    <span className="text-sm font-medium text-slate-500">
                                        {formatSize(file.size)}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-sm font-medium text-slate-500">
                                    <div className="flex items-center gap-1.5">
                                        <Calendar size={14} className="text-slate-300" />
                                        {formatDate(file.created_at)}
                                    </div>
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <div className="relative flex items-center justify-end">
                                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); onEdit(file); }}
                                            className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                                            title="Edit metadata"
                                        >
                                            <Edit2 size={16} />
                                        </button>
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); onDelete(file.id); }}
                                            className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                                            title="Delete file"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                    <MoreHorizontal size={18} className="text-slate-200 ml-auto group-hover:opacity-0 transition-opacity" />
                                </div>
                            </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
