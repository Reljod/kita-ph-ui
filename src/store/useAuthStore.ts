import { create } from 'zustand';
import Cookies from 'js-cookie';

interface User {
    id: string;
    email: string;
    name: string;
    avatar?: string;
    org_id: string;
}

interface AuthState {
    user: User | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    login: (user: User, token: string, refreshToken: string) => void;
    logout: () => void;
    checkAuth: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
    user: null,
    isAuthenticated: false,
    isLoading: true,

    login: (user, token, refreshToken) => {
        Cookies.set('token', token, { expires: 7 }); // 7 days
        Cookies.set('refreshToken', refreshToken, { expires: 7 }); // 7 days
        set({ user, isAuthenticated: true, isLoading: false });
    },

    logout: () => {
        Cookies.remove('token');
        Cookies.remove('refreshToken');
        set({ user: null, isAuthenticated: false, isLoading: false });
        if (typeof window !== 'undefined') {
            window.location.href = '/login';
        }
    },

    checkAuth: () => {
        const token = Cookies.get('token');
        if (token) {
            // Typically, verify token with backend here
            // For now we set authenticated to true if token exists
            set({ isAuthenticated: true, isLoading: false });
        } else {
            set({ isAuthenticated: false, isLoading: false });
        }
    },
}));
