'use client';

import { Send } from 'lucide-react';

interface Props {
    value: string;
    onChange: (value: string) => void;
    onSubmit: (e?: React.FormEvent) => void;
    isDisabled: boolean;
    placeholder?: string;
}

export function ChatInput({ value, onChange, onSubmit, isDisabled, placeholder }: Props) {
    return (
        <footer className="p-4 md:p-6 bg-slate-50/80 backdrop-blur-sm border-t border-slate-200 shrink-0">
            <form
                onSubmit={onSubmit}
                className="relative flex items-center max-w-3xl mx-auto shadow-sm rounded-2xl bg-white focus-within:ring-2 focus-within:ring-indigo-100 focus-within:border-indigo-300 border border-slate-200 transition-all"
            >
                <input
                    type="text"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={placeholder ?? 'Send a message...'}
                    disabled={isDisabled}
                    className="w-full py-4 pl-4 pr-14 bg-transparent outline-none rounded-2xl disabled:opacity-60"
                />
                <button
                    type="submit"
                    disabled={!value.trim() || isDisabled}
                    className="absolute right-2 p-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white rounded-xl transition-colors flex items-center justify-center"
                >
                    <Send size={18} className="ml-0.5" />
                </button>
            </form>
            <div className="text-center mt-3 text-xs text-slate-400 font-medium">
                AI agents can make mistakes. Verify important information.
            </div>
        </footer>
    );
}
