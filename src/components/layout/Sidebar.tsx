'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Bot } from 'lucide-react';

const navLinks = [
    { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/agents', label: 'Agents', icon: Bot },
];

export function Sidebar() {
    const pathname = usePathname();

    return (
        <aside className="flex flex-col w-56 min-h-0 bg-white border-r border-slate-200 shrink-0">
            <nav className="flex-1 py-4 px-3 space-y-1">
                {navLinks.map(({ href, label, icon: Icon }) => {
                    const isActive = pathname === href || pathname.startsWith(href + '/');
                    return (
                        <Link
                            key={href}
                            href={href}
                            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150
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
    );
}
