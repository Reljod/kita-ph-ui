import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';

async function handleRequest(request: NextRequest) {
    const { pathname, search } = request.nextUrl;
    
    // Strip the /api prefix (e.g. /api/agent -> /agent)
    const cleanPath = pathname.replace(/^\/api/, '');
    
    const backendUrl = process.env.KITA_BACKEND_URL || 'http://localhost:8080';
    const targetUrl = new URL(cleanPath + search, backendUrl);
    
    const headers = new Headers();
    // Copy headers from original request
    request.headers.forEach((value, key) => {
        // Skip host and connection headers to let fetch generate them
        if (key !== 'host' && key !== 'connection') {
            headers.set(key, value);
        }
    });
    
    // Securely inject API credentials on the server side
    headers.set('x-api-key', process.env.KITA_API_KEY || '');
    headers.set('x-client-id', process.env.KITA_CLIENT_ID || '');

    // Ensure correlation headers are present, generating UUIDs as fallbacks
    if (!headers.has('x-request-id')) {
        headers.set('x-request-id', uuidv4());
    }
    if (!headers.has('x-trace-id')) {
        headers.set('x-trace-id', uuidv4());
    }
    
    const method = request.method;
    const hasBody = method !== 'GET' && method !== 'HEAD';
    
    try {
        const fetchOptions: RequestInit = {
            method,
            headers,
            redirect: 'follow', // Follow any redirects (like trailing slashes) internally
        };
        
        if (hasBody) {
            fetchOptions.body = request.body;
            // @ts-ignore - duplex is required when body is a ReadableStream in Node.js
            fetchOptions.duplex = 'half';
        }
        
        const response = await fetch(targetUrl.toString(), fetchOptions);
        
        const responseHeaders = new Headers();
        response.headers.forEach((value, key) => {
            // Skip compression encoding header to prevent content encoding issues
            if (key !== 'content-encoding') {
                responseHeaders.set(key, value);
            }
        });
        
        return new NextResponse(response.body, {
            status: response.status,
            statusText: response.statusText,
            headers: responseHeaders,
        });
    } catch (error) {
        console.error('API Proxy error:', error);
        return NextResponse.json(
            { detail: 'Internal API proxy error' }, 
            { status: 502 }
        );
    }
}

export async function GET(request: NextRequest) { return handleRequest(request); }
export async function POST(request: NextRequest) { return handleRequest(request); }
export async function PUT(request: NextRequest) { return handleRequest(request); }
export async function DELETE(request: NextRequest) { return handleRequest(request); }
export async function PATCH(request: NextRequest) { return handleRequest(request); }
export async function OPTIONS(request: NextRequest) { return handleRequest(request); }
export async function HEAD(request: NextRequest) { return handleRequest(request); }
