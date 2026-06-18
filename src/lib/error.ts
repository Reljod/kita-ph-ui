import { AxiosError } from 'axios';

export interface ApiErrorResponse {
    error?: {
        code?: string;
        message?: string;
        details?: Record<string, any>;
        trace_id?: string;
    };
    detail?: string; // fallback for standard FastAPI exceptions
}

/**
 * Parses any API or network error into a user-friendly, secure error message.
 * Prevents leakage of internal system details and database schemas.
 */
export function getFriendlyErrorMessage(err: unknown, context?: 'login' | 'general'): string {
    if (!err) return 'An unknown error occurred.';

    let code: string | undefined;
    let message: string | undefined;
    let traceId: string | undefined;

    // 1. Parse Axios Error
    if (isAxiosError(err)) {
        const data = err.response?.data as ApiErrorResponse | undefined;
        if (data?.error) {
            code = data.error.code;
            message = data.error.message;
            traceId = data.error.trace_id;
        } else if (data?.detail) {
            message = data.detail;
        } else if (err.response?.status === 401) {
            code = 'AUTH_UNAUTHORIZED';
        } else if (err.response?.status === 403) {
            code = 'AUTH_FORBIDDEN';
        } else if (err.response?.status === 404) {
            code = 'RESOURCE_NOT_FOUND';
        }
    } 
    // 2. Parse general Error objects
    else if (err instanceof Error) {
        message = err.message;
    }

    // 3. Login context specific messaging
    if (context === 'login') {
        if (code === 'AUTH_UNAUTHORIZED' || code === 'AUTH_SESSION_EXPIRED' || message?.toLowerCase().includes('credential') || message?.toLowerCase().includes('password')) {
            return 'Incorrect email, password, or organization code.';
        }
        if (code === 'AUTH_FORBIDDEN') {
            return 'You do not have access to this organization. Please verify your membership.';
        }
        if (code === 'RESOURCE_NOT_FOUND') {
            return 'Incorrect email, password, or organization code.'; // prevent leaking org code doesn't exist
        }
    }

    // 4. Map known error codes to safe, generic messages
    if (code) {
        switch (code) {
            case 'AUTH_SESSION_EXPIRED':
                return 'Your session has expired. Please log in again.';
            case 'AUTH_UNAUTHORIZED':
                return 'Authentication required. Please log in again.';
            case 'AUTH_FORBIDDEN':
                return 'Access denied. You do not have permission to access this resource.';
            case 'RESOURCE_NOT_FOUND':
                return 'The requested resource could not be found.';
            case 'SYSTEM_VALIDATION_ERROR':
                return 'The provided inputs are invalid. Please check your inputs and try again.';
            case 'SYSTEM_INTERNAL_ERROR':
            case 'SYSTEM_DATABASE_ERROR':
            case 'SYSTEM_REDIS_ERROR':
                return `An unexpected database or server error occurred. Please try again later.${
                    traceId ? `\n(Trace ID: ${traceId})` : ''
                }`;
            default:
                break;
        }
    }

    // 5. Fallback checks
    if (message) {
        // Suppress leakage of sensitive database/system strings
        const lowerMessage = message.toLowerCase();
        if (
            lowerMessage.includes('mongo') || 
            lowerMessage.includes('redis') || 
            lowerMessage.includes('connection') || 
            lowerMessage.includes('socket') || 
            lowerMessage.includes('unhandled exception') ||
            lowerMessage.includes('line ') ||
            lowerMessage.includes('traceback')
        ) {
            return `A server connectivity issue occurred. Please try again later.${
                traceId ? `\n(Trace ID: ${traceId})` : ''
            }`;
        }
        return message;
    }

    return `An unexpected error occurred. Please try again later.${
        traceId ? `\n(Trace ID: ${traceId})` : ''
    }`;
}

function isAxiosError(err: any): err is AxiosError {
    return err && typeof err === 'object' && 'isAxiosError' in err && err.isAxiosError === true;
}
