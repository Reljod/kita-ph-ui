'use client';

import { useAuthStore } from '@/store/useAuthStore';
import { LogOut, User as UserIcon } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function Header() {
    const { user, logout } = useAuthStore();
    const router = useRouter();
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    const handleLogout = () => {
        logout();
        router.push('/login');
    };

    return (
        <header className="sticky top-0 z-40 w-full bg-white/80 backdrop-blur-md border-b border-slate-200">
            <div className="flex h-16 items-center justify-between px-6 max-w-7xl mx-auto">
                <Link href="/" className="flex gap-2 items-center">
                    <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shadow-sm">
                        <div className="w-2 h-2 bg-white rounded-full"></div>
                        <div className="w-2 h-2 bg-white/60 rounded-full ml-1"></div>
                    </div>
                    <span className="font-bold text-lg text-slate-900 tracking-tight">Kita<span className="text-indigo-600">Agents</span></span>
                </Link>

                <div className="flex items-center gap-4 relative">
                    <button
                        onClick={() => setIsMenuOpen(!isMenuOpen)}
                        className="flex items-center gap-3 p-1 pr-3 rounded-full hover:bg-slate-50 border border-transparent hover:border-slate-200 transition-all"
                    >
                        <div className="w-8 h-8 rounded-full bg-indigo-100 overflow-hidden border border-indigo-200">
                            {user?.avatar ? (
                                /* eslint-disable-next-line @next/next/no-img-element */
                                <img src={user.avatar} alt={user.name || 'User'} className="w-full h-full object-cover" />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-indigo-600">
                                    <UserIcon size={16} />
                                </div>
                            )}
                        </div>
                        <span className="text-sm font-medium text-slate-700 hidden sm:block">
                            {user?.name || 'Developer'}
                        </span>
                    </button>

                    {isMenuOpen && (
                        <>
                            <div
                                className="fixed inset-0 z-40"
                                onClick={() => setIsMenuOpen(false)}
                            ></div>
                            <div className="absolute right-0 top-full mt-2 w-48 bg-white border border-slate-100 rounded-2xl shadow-xl z-50 py-2 animate-in fade-in slide-in-from-top-2">
                                <div className="px-4 py-2 border-b border-slate-50 mb-1">
                                    <p className="text-sm font-medium text-slate-900 truncate">{user?.name || 'Developer'}</p>
                                    <p className="text-xs text-slate-500 truncate">{user?.email || 'dev@local.com'}</p>
                                </div>
                                <button
                                    onClick={handleLogout}
                                    className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                                >
                                    <LogOut size={16} />
                                    <span>Logout</span>
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </header>
    );
}
