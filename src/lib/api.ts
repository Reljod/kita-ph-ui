import axios from 'axios';
import Cookies from 'js-cookie';
import { v4 as uuidv4 } from 'uuid';
import { useAuthStore } from '@/store/useAuthStore';

export const api = axios.create({
    baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000',
    headers: {
        'Content-Type': 'application/json',
    },
});

// Request interceptor for API calls
api.interceptors.request.use(
    (config) => {
        const token = Cookies.get('token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        // Generate correlation tracking headers
        if (!config.headers['x-request-id']) {
            config.headers['x-request-id'] = uuidv4();
        }
        if (!config.headers['x-trace-id']) {
            config.headers['x-trace-id'] = uuidv4();
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Response interceptor for API calls
api.interceptors.response.use(
    (response) => {
        return response;
    },
    async (error) => {
        const originalRequest = error.config;
        const isAuthRequest = originalRequest.url && (
            originalRequest.url.includes('/auth/login') ||
            originalRequest.url.includes('/auth/register') ||
            originalRequest.url.includes('/auth/refresh')
        );

        // Handle 401 Unauthorized globally
        if (error.response?.status === 401 && !isAuthRequest && !originalRequest._retry) {
            originalRequest._retry = true;

            const refreshToken = Cookies.get('refreshToken');
            if (refreshToken) {
                try {
                    // Attempt to refresh token
                    // We use axios directly to avoid interceptor loop if refresh itself fails with 401
                    const response = await axios.post(`${api.defaults.baseURL}/auth/refresh?refresh_token=${refreshToken}`);
                    const { access_token, refresh_token } = response.data;

                    // Update cookies
                    Cookies.set('token', access_token, { expires: 7 });
                    Cookies.set('refreshToken', refresh_token, { expires: 7 });

                    // Retry original request with new token
                    originalRequest.headers.Authorization = `Bearer ${access_token}`;
                    return api(originalRequest);
                } catch (refreshError) {
                    console.error('Token refresh failed:', refreshError);
                    // Clear state and cookies using Zustand auth store
                    useAuthStore.getState().logout();
                    return;
                }
            } else {
                // No refresh token available
                useAuthStore.getState().logout();
                return;
            }
        }
        return Promise.reject(error);
    }
);
