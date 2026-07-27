/**
 * A stand-in for OpenRouter's chat-completions API.
 *
 * The default E2E run must be deterministic and free, so the agent path talks
 * to this instead of the real provider. Set E2E_LIVE_LLM=1 to skip it and let
 * the API call OpenRouter for real (costs money, output varies — that mode is
 * for the occasional confidence check, not the gate).
 */

import http from 'node:http';
import type { AddressInfo } from 'node:net';

export interface MockLlm {
    url: string;
    /** Every prompt the app sent, in order — handy for assertions. */
    requests: unknown[];
    close: () => Promise<void>;
}

/** A canned reply keyed on what the user asked, so specs can assert on text. */
function replyFor(body: { messages?: { role: string; content: string }[] }): string {
    const last = body.messages?.[body.messages.length - 1]?.content ?? '';
    const text = String(last).toLowerCase();
    if (text.includes('capital of france')) return 'The capital of France is Paris.';
    if (text.includes('error') || text.includes('fail')) return 'I could not complete that request.';
    if (text.includes('json')) return '{"answer": "structured"}';
    return `Mock assistant reply to: ${String(last).slice(0, 120)}`;
}

export async function startMockOpenRouter(): Promise<MockLlm> {
    const requests: unknown[] = [];

    const server = http.createServer((req, res) => {
        let raw = '';
        req.on('data', (chunk) => {
            raw += chunk;
        });
        req.on('end', () => {
            let body: Record<string, unknown> = {};
            try {
                body = raw ? JSON.parse(raw) : {};
            } catch {
                /* fall through with an empty body */
            }
            requests.push({ path: req.url, body });

            if (req.url?.includes('/models')) {
                res.writeHead(200, { 'content-type': 'application/json' });
                res.end(JSON.stringify({ data: [{ id: 'mock/model' }] }));
                return;
            }

            const content = replyFor(body as { messages?: { role: string; content: string }[] });
            const isStream = body.stream === true;

            if (isStream) {
                res.writeHead(200, {
                    'content-type': 'text/event-stream',
                    'cache-control': 'no-cache',
                });
                const chunkPayload = {
                    id: 'mock-1',
                    object: 'chat.completion.chunk',
                    created: 1,
                    model: String(body.model ?? 'mock/model'),
                    choices: [{ index: 0, delta: { role: 'assistant', content }, finish_reason: null }],
                };
                res.write(`data: ${JSON.stringify(chunkPayload)}\n\n`);
                res.write(
                    `data: ${JSON.stringify({
                        ...chunkPayload,
                        choices: [{ index: 0, delta: {}, finish_reason: 'stop' }],
                    })}\n\n`
                );
                res.write('data: [DONE]\n\n');
                res.end();
                return;
            }

            res.writeHead(200, { 'content-type': 'application/json' });
            res.end(
                JSON.stringify({
                    id: 'mock-1',
                    object: 'chat.completion',
                    created: 1,
                    model: String(body.model ?? 'mock/model'),
                    choices: [
                        {
                            index: 0,
                            message: { role: 'assistant', content },
                            finish_reason: 'stop',
                        },
                    ],
                    usage: { prompt_tokens: 10, completion_tokens: 8, total_tokens: 18 },
                })
            );
        });
    });

    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address() as AddressInfo;

    return {
        url: `http://127.0.0.1:${port}/api/v1`,
        requests,
        close: () =>
            new Promise<void>((resolve) => {
                server.close(() => resolve());
            }),
    };
}
