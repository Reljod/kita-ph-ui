'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bot, Loader2, KeyRound } from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';
import { api } from '@/lib/api';
import { getFriendlyErrorMessage } from '@/lib/error';

export default function LoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [orgCode, setOrgCode] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const login = useAuthStore((state) => state.login);
    const router = useRouter();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');

        try {
            // FastAPI's OAuth2PasswordRequestForm strictly requires
            // application/x-www-form-urlencoded — NOT multipart/form-data.
            // URLSearchParams triggers axios to send the correct encoding automatically.
            const formData = new URLSearchParams();
            formData.append('username', email);
            formData.append('password', password);
            if (orgCode) {
                formData.append('org_code', orgCode);
            }

            // Must explicitly override the axios instance default (application/json)
            // so the request is sent as application/x-www-form-urlencoded.
            const response = await api.post('/auth/login', formData, {
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            });

            const data = response.data;

            // Dummy user parsing - replace with actual user data if returned by login endpoint or /users/me
            const user = {
                id: data.user_id || '1',
                email,
                name: email.split('@')[0],
                org_id: data.org_id || orgCode,
                avatar: `https://api.dicebear.com/7.x/notionists/svg?seed=${email}`,
            };

            login(user, data.access_token, data.refresh_token);
            router.push('/dashboard');
        } catch (err: unknown) {
            console.error('Login failed:', err);
            setError(getFriendlyErrorMessage(err, 'login'));
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center p-4 selection:bg-indigo-100 selection:text-indigo-900">
            <div className="w-full max-w-md bg-white rounded-3xl shadow-xl border border-slate-100 p-8 animate-in fade-in slide-in-from-bottom-8 duration-700">
                <div className="flex justify-center mb-6">
                    <div className="w-16 h-16 bg-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center shadow-sm">
                        <Bot size={32} />
                    </div>
                </div>

                <h1 className="text-3xl font-bold text-center text-slate-900 mb-2 tracking-tight">
                    Welcome back
                </h1>
                <p className="text-center text-slate-500 mb-8">
                    Sign in to your agent workspace
                </p>

                {error && (
                    <div className="mb-6 p-4 bg-red-50 border border-red-100 text-red-600 rounded-xl text-sm flex items-start gap-2">
                        <KeyRound size={16} className="mt-0.5 shrink-0" />
                        <span>{error}</span>
                    </div>
                )}

                <form onSubmit={handleLogin} className="space-y-5">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5 ml-1">Email</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 rounded-xl outline-none transition-all text-slate-800"
                            placeholder="you@company.com"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5 ml-1">Password</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 rounded-xl outline-none transition-all text-slate-800"
                            placeholder="••••••••"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5 ml-1">Organization Code</label>
                        <input
                            type="text"
                            value={orgCode}
                            onChange={(e) => setOrgCode(e.target.value)}
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 rounded-xl outline-none transition-all text-slate-800"
                            placeholder="e.g. KITA-123"
                            required
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={isLoading || !email || !password || !orgCode}
                        className="w-full mt-2 py-3.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 disabled:cursor-not-allowed text-white rounded-xl font-semibold shadow-md shadow-indigo-200 transition-all flex items-center justify-center gap-2"
                    >
                        {isLoading ? (
                            <>
                                <Loader2 size={18} className="animate-spin" />
                                Signing in...
                            </>
                        ) : (
                            'Sign In'
                        )}
                    </button>
                </form>
            </div>

            <div className="mt-8 text-sm text-slate-500 text-center animate-in fade-in duration-1000 delay-300">
                Powered by Kita-API
            </div>
        </div>
    );
}
