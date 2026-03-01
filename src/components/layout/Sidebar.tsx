'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Bot, X } from 'lucide-react';
import { useSidebarStore } from '@/store/useSidebarStore';

const navLinks = [
    { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/agents', label: 'Agents', icon: Bot },
];

export function Sidebar() {
    const pathname = usePathname();
    const { isOpen, close } = useSidebarStore();

    return (
        <>
            {/* Sidebar panel */}
            <aside
                className={`
                    flex flex-col min-h-0 bg-white border-r border-slate-200 shrink-0
                    transition-all duration-300 ease-in-out overflow-hidden
                    ${isOpen ? 'w-56' : 'w-0'}
                `}
            >
                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                        Menu
                    </span>
                    <button
                        onClick={close}
                        aria-label="Close sidebar"
                        className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                    >
                        <X size={16} />
                    </button>
                </div>
                <nav className="flex-1 py-4 px-3 space-y-1">
                    {navLinks.map(({ href, label, icon: Icon }) => {
                        const isActive = pathname === href || pathname.startsWith(href + '/');
                        return (
                            <Link
                                key={href}
                                href={href}
                                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 whitespace-nowrap
                                    ${isActive
                                        ? 'bg-indigo-50 text-indigo-700 shadow-sm'
                                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                                    }`}
                            >
                                <Icon
                                    size={18}
                                    className={isActive ? 'text-indigo-600' : 'text-slate-400'}
                                />
                                {label}
                            </Link>
                        );
                    })}
                </nav>
            </aside>
        </>
    );
}
