'use client';

import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    title?: string;
    children: React.ReactNode;
    maxWidth?: string;
}

export function Modal({ isOpen, onClose, title, children, maxWidth = 'max-w-xl' }: Props) {
    const overlayRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };

        if (isOpen) {
            document.addEventListener('keydown', handleEsc);
            document.body.style.overflow = 'hidden';
        }

        return () => {
            document.removeEventListener('keydown', handleEsc);
            document.body.style.overflow = 'unset';
        };
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Overlay */}
            <div
                ref={overlayRef}
                className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200"
                onClick={onClose}
            />

            {/* Modal Content */}
            <div className={`relative bg-white w-full ${maxWidth} rounded-[32px] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 z-10`}>
                {title && (
                    <div className="flex items-center justify-between px-8 py-6 border-b border-slate-100">
                        <h2 className="text-2xl font-bold text-slate-900">{title}</h2>
                        <button
                            onClick={onClose}
                            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-full transition-colors"
                        >
                            <X size={20} />
                        </button>
                    </div>
                )}
                <div className="max-h-[85vh] overflow-y-auto">
                    {children}
                </div>
            </div>
        </div>,
        document.body
    );
}
