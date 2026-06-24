'use client';

import { useCallback } from 'react';
import { Modal } from '@/components/common/Modal';
import { FileResponse } from '@/types/knowledge';
import { FileText, Download, Loader2, AlertCircle } from 'lucide-react';
import { usePreview } from '@/hooks/usePreview';

interface Props {
    file: FileResponse | null;
    onClose: () => void;
}

const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'];
const PDF_EXTENSIONS = ['pdf'];

function PreviewContent({ file, onClose }: { file: FileResponse; onClose: () => void }) {
    const { objectUrl, isLoading, error } = usePreview(file.id);

    const isImage = IMAGE_EXTENSIONS.includes(file.extension.toLowerCase());
    const isPdf = PDF_EXTENSIONS.includes(file.extension.toLowerCase());

    const formatDate = (dateStr: string) => {
        try {
            return new Intl.DateTimeFormat('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
            }).format(new Date(dateStr));
        } catch {
            return dateStr;
        }
    };

    const formatSize = (bytes: number) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
    };

    const handleDownload = useCallback(() => {
        if (objectUrl) {
            const a = document.createElement('a');
            a.href = objectUrl;
            a.download = file.filename;
            a.click();
        }
    }, [objectUrl, file.filename]);

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center py-24 gap-4">
                <Loader2 className="animate-spin text-indigo-600" size={48} />
                <p className="text-slate-500 font-medium">Loading preview...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center py-24 gap-4 px-8">
                <div className="w-16 h-16 bg-red-50 rounded-3xl flex items-center justify-center text-red-400">
                    <AlertCircle size={36} />
                </div>
                <p className="text-slate-900 font-bold text-lg">Failed to load preview</p>
                <p className="text-slate-500 text-sm">{error}</p>
                <button
                    onClick={onClose}
                    className="mt-2 px-6 py-2.5 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition-colors"
                >
                    Close
                </button>
            </div>
        );
    }

    if (objectUrl) {
        if (isImage) {
            return (
                <div className="flex items-center justify-center p-4">
                    <img
                        src={objectUrl}
                        alt={file.filename}
                        className="max-w-full max-h-[70vh] object-contain rounded-xl"
                    />
                </div>
            );
        }

        if (isPdf) {
            return (
                <div className="p-4">
                    <iframe
                        src={objectUrl}
                        className="w-full h-[70vh] rounded-xl"
                        title={file.filename}
                    />
                </div>
            );
        }

        return (
            <div className="flex flex-col items-center justify-center py-16 gap-6 px-8">
                <div className="w-20 h-20 bg-slate-50 rounded-3xl flex items-center justify-center border border-slate-100">
                    <FileText size={40} className="text-slate-400" />
                </div>
                <div className="text-center">
                    <p className="text-slate-900 font-bold text-lg mb-1">
                        Preview not available for this file type
                    </p>
                    <p className="text-slate-400 text-sm">
                        You can download the file to view its contents.
                    </p>
                </div>
                <div className="w-full max-w-sm bg-slate-50 rounded-2xl p-5 space-y-3 border border-slate-100">
                    <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-400 font-medium">Name</span>
                        <span className="text-slate-900 font-semibold text-right truncate max-w-[200px]">
                            {file.filename}
                        </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-400 font-medium">Type</span>
                        <span className="text-slate-900 font-semibold uppercase">
                            {file.extension || 'FILE'}
                        </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-400 font-medium">Content Type</span>
                        <span className="text-slate-900 font-semibold text-right truncate max-w-[200px]">
                            {file.content_type || 'Unknown'}
                        </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-400 font-medium">Size</span>
                        <span className="text-slate-900 font-semibold">
                            {formatSize(file.size)}
                        </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-400 font-medium">Uploaded</span>
                        <span className="text-slate-900 font-semibold">
                            {formatDate(file.created_at)}
                        </span>
                    </div>
                </div>
                <button
                    onClick={handleDownload}
                    className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-2xl font-bold shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all"
                >
                    <Download size={18} />
                    Download {file.filename}
                </button>
            </div>
        );
    }

    return null;
}

export function FilePreviewModal({ file, onClose }: Props) {
    const title = file ? file.filename : '';

    return (
        <Modal isOpen={!!file} onClose={onClose} title={title} maxWidth="max-w-5xl">
            {file && <PreviewContent key={file.id} file={file} onClose={onClose} />}
        </Modal>
    );
}
