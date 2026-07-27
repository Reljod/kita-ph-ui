/**
 * Tests for the chat surface.
 *
 * Three things carry real risk here.
 *
 * `parseBackendMessages` decides what the user sees of a run: which parts are
 * an answer and which are the model thinking out loud. The rule is subtle —
 * a text part is an answer unless the same message also called a tool, in
 * which case it was the model narrating before the call.
 *
 * The send path is a hand-rolled SSE reader. A malformed frame must not take
 * the stream down, and a 401 mid-stream has to log the user out rather than
 * render an error bubble they cannot act on.
 *
 * And the streaming placeholder must always be cleared. If `finally` misses
 * it, the bubble stays italic and grey forever and the input stays disabled.
 */

import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const push = vi.fn();
const replace = vi.fn();
vi.mock('next/navigation', () => ({
    useRouter: () => ({ push, replace }),
}));

const apiGet = vi.fn();
vi.mock('@/lib/api', () => ({ api: { get: (...args: unknown[]) => apiGet(...args) } }));

const { renderWithQuery } = await import('../support/render');
const { ChatView, parseBackendMessages } = await import('@/components/chat/ChatView');
const { ChatInput } = await import('@/components/chat/ChatInput');
const { ChatHistorySidebar } = await import('@/components/chat/ChatHistorySidebar');
const { ChatMessages } = await import('@/components/chat/ChatMessages');
const { MarkdownRenderer } = await import('@/components/chat/MarkdownRenderer');
const { useAuthStore } = await import('@/store/useAuthStore');

const AGENT = {
    id: 'agent_1',
    name: 'Scribe',
    role: 'writer',
    goal: 'write',
    backstory: '',
    llm_id: 'llm_1',
    version: 1,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
};

const OTHER_AGENT = { ...AGENT, id: 'agent_2', name: 'Scout', role: 'researcher' };

/** Build a Response whose body streams the given SSE frames. */
function sseResponse(frames: string[], status = 200) {
    const encoder = new TextEncoder();
    let i = 0;
    return {
        status,
        ok: status >= 200 && status < 300,
        body: {
            getReader: () => ({
                read: async () =>
                    i < frames.length
                        ? { done: false, value: encoder.encode(frames[i++]) }
                        : { done: true, value: undefined },
            }),
        },
    } as unknown as Response;
}

function frame(payload: unknown) {
    return `data: ${JSON.stringify(payload)}\n`;
}

const DONE = frame({
    type: 'done',
    chat: {
        id: 'chat_1',
        messages: [
            { kind: 'request', parts: [{ part_kind: 'user-prompt', content: 'hello' }] },
            { kind: 'response', parts: [{ part_kind: 'text', content: 'hi there' }] },
        ],
    },
});

beforeEach(() => {
    push.mockClear();
    replace.mockClear();
    apiGet.mockReset().mockResolvedValue({ data: { messages: [] } });
    document.cookie = 'token=tok;path=/';
    vi.stubGlobal('fetch', vi.fn(async () => sseResponse([DONE])));
    vi.stubGlobal(
        'WebSocket',
        class {
            onmessage: ((e: { data: string }) => void) | null = null;
            onerror: ((e: unknown) => void) | null = null;
            close = vi.fn();
        }
    );
    vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('parseBackendMessages', () => {
    it('returns nothing for an empty run', () => {
        expect(parseBackendMessages([])).toEqual([]);
    });

    it('reads a user prompt', () => {
        const [msg] = parseBackendMessages([
            { kind: 'request', parts: [{ part_kind: 'user-prompt', content: 'hello' }] },
        ]);
        expect(msg).toMatchObject({ role: 'user', content: 'hello' });
    });

    it('reads an agent answer', () => {
        const [msg] = parseBackendMessages([
            { kind: 'response', parts: [{ part_kind: 'text', content: 'hi' }] },
        ]);
        expect(msg).toMatchObject({ role: 'agent', content: 'hi' });
    });

    it('recognises a builder message', () => {
        const [msg] = parseBackendMessages([
            { kind: 'builder', parts: [{ part_kind: 'text', content: 'made an agent' }] },
        ]);
        expect(msg.role).toBe('builder');
    });

    it('keeps a thinking part out of the answer', () => {
        const [msg] = parseBackendMessages([
            {
                kind: 'response',
                parts: [
                    { part_kind: 'thinking', content: 'let me check' },
                    { part_kind: 'text', content: 'the answer is 4' },
                ],
            },
        ]);
        expect(msg.content).toBe('the answer is 4');
        expect(msg.thinking).toBe('let me check');
    });

    it('treats narration before a tool call as thinking', () => {
        // The model saying "let me search for that" is not the answer; it is
        // what it said on the way to calling the tool.
        const [msg] = parseBackendMessages([
            {
                kind: 'response',
                parts: [
                    { part_kind: 'text', content: 'let me search for that' },
                    { part_kind: 'tool-call', tool_name: 'web_search' },
                ],
            },
        ]);
        expect(msg.content).toBe('');
        expect(msg.thinking).toBe('let me search for that');
    });

    it('keeps text as the answer when nothing was called', () => {
        const [msg] = parseBackendMessages([
            { kind: 'response', parts: [{ part_kind: 'text', content: 'done' }] },
        ]);
        expect(msg.thinking).toBeUndefined();
    });

    it('joins multiple parts', () => {
        const [msg] = parseBackendMessages([
            {
                kind: 'response',
                parts: [
                    { part_kind: 'text', content: 'one' },
                    { part_kind: 'text', content: 'two' },
                ],
            },
        ]);
        expect(msg.content).toBe('one\ntwo');
    });

    it('falls back to a bare content field', () => {
        const [msg] = parseBackendMessages([{ kind: 'response', content: 'plain' }]);
        expect(msg.content).toBe('plain');
    });

    it('drops a message with nothing in it', () => {
        // A tool-call-only turn has no text at all; rendering it would be an
        // empty bubble.
        expect(
            parseBackendMessages([
                { kind: 'response', parts: [{ part_kind: 'tool-call', tool_name: 'x' }] },
            ])
        ).toEqual([]);
    });

    it('merges consecutive messages from the same role', () => {
        const parsed = parseBackendMessages([
            { kind: 'response', parts: [{ part_kind: 'text', content: 'first' }] },
            { kind: 'response', parts: [{ part_kind: 'text', content: 'second' }] },
        ]);
        expect(parsed).toHaveLength(1);
        expect(parsed[0].content).toBe('first\nsecond');
    });

    it('merges the thinking too', () => {
        const parsed = parseBackendMessages([
            {
                kind: 'response',
                parts: [
                    { part_kind: 'thinking', content: 'a' },
                    { part_kind: 'text', content: 'x' },
                ],
            },
            {
                kind: 'response',
                parts: [
                    { part_kind: 'thinking', content: 'b' },
                    { part_kind: 'text', content: 'y' },
                ],
            },
        ]);
        expect(parsed[0].thinking).toBe('a\nb');
    });

    it('does not merge across a role change', () => {
        const parsed = parseBackendMessages([
            { kind: 'response', parts: [{ part_kind: 'text', content: 'a' }] },
            { kind: 'request', parts: [{ part_kind: 'user-prompt', content: 'b' }] },
            { kind: 'response', parts: [{ part_kind: 'text', content: 'c' }] },
        ]);
        expect(parsed).toHaveLength(3);
    });

    it('gives every message a distinct id', () => {
        const parsed = parseBackendMessages([
            { kind: 'request', parts: [{ part_kind: 'user-prompt', content: 'a' }] },
            { kind: 'response', parts: [{ part_kind: 'text', content: 'b' }] },
        ]);
        expect(new Set(parsed.map((m) => m.id)).size).toBe(2);
    });
});

describe('ChatInput', () => {
    function renderInput(overrides: Record<string, unknown> = {}) {
        const props = {
            value: '',
            onChange: vi.fn(),
            onSubmit: vi.fn((e?: React.FormEvent) => e?.preventDefault()),
            isDisabled: false,
            ...overrides,
        };
        render(<ChatInput {...(props as unknown as React.ComponentProps<typeof ChatInput>)} />);
        return props;
    }

    it('reports what was typed', () => {
        const props = renderInput();
        fireEvent.change(screen.getByRole('textbox'), { target: { value: 'hi' } });
        expect(props.onChange).toHaveBeenCalledWith('hi');
    });

    it('cannot send an empty message', () => {
        renderInput();
        expect(screen.getByRole('button')).toBeDisabled();
    });

    it('cannot send only whitespace', () => {
        renderInput({ value: '   ' });
        expect(screen.getByRole('button')).toBeDisabled();
    });

    it('sends real text', () => {
        const props = renderInput({ value: 'hello' });
        fireEvent.click(screen.getByRole('button'));
        expect(props.onSubmit).toHaveBeenCalled();
    });

    it('is disabled while the agent is replying', () => {
        renderInput({ value: 'hello', isDisabled: true });
        expect(screen.getByRole('textbox')).toBeDisabled();
        expect(screen.getByRole('button')).toBeDisabled();
    });

    it('uses a default placeholder', () => {
        renderInput();
        expect(screen.getByPlaceholderText('Send a message...')).toBeInTheDocument();
    });

    it('accepts a custom placeholder', () => {
        renderInput({ placeholder: 'Message Scribe...' });
        expect(screen.getByPlaceholderText('Message Scribe...')).toBeInTheDocument();
    });

    it('warns that agents can be wrong', () => {
        renderInput();
        expect(screen.getByText(/can make mistakes/i)).toBeInTheDocument();
    });
});

describe('ChatHistorySidebar', () => {
    const CHATS = [
        { id: 'c1', preview: 'About the handbook', updated_at: '2026-03-04T10:00:00Z' },
        { id: 'c2', preview: '', updated_at: '2026-03-05T10:00:00Z' },
    ];

    function renderSidebar(overrides: Record<string, unknown> = {}) {
        const props = {
            chats: CHATS,
            activeChatId: null,
            onSelectChat: vi.fn(),
            onNewChat: vi.fn(),
            ...overrides,
        };
        render(
            <ChatHistorySidebar
                {...(props as unknown as React.ComponentProps<typeof ChatHistorySidebar>)}
            />
        );
        return props;
    }

    it('lists the conversations', () => {
        renderSidebar();
        expect(screen.getByText('About the handbook')).toBeInTheDocument();
    });

    it('names an unlabelled conversation', () => {
        renderSidebar();
        expect(screen.getByText('New Conversation')).toBeInTheDocument();
    });

    it('reports an empty history', () => {
        renderSidebar({ chats: [] });
        expect(screen.getByText(/no history yet/i)).toBeInTheDocument();
    });

    it('still offers a new chat with no history', () => {
        renderSidebar({ chats: [] });
        expect(screen.getByText(/new chat/i)).toBeInTheDocument();
    });

    it('opens the chat that was clicked', () => {
        const props = renderSidebar();
        fireEvent.click(screen.getByText('About the handbook'));
        expect(props.onSelectChat).toHaveBeenCalledWith('c1');
    });

    it('marks the active conversation', () => {
        renderSidebar({ activeChatId: 'c1' });
        expect(
            screen.getByText('About the handbook').closest('button')?.className
        ).toContain('bg-indigo-50');
    });

    it('starts a new chat', () => {
        const props = renderSidebar();
        fireEvent.click(screen.getByText(/new chat/i));
        expect(props.onNewChat).toHaveBeenCalled();
    });
});

describe('MarkdownRenderer', () => {
    it('renders a heading as a heading', () => {
        render(<MarkdownRenderer content={'# Title'} />);
        expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Title');
    });

    it('renders a list', () => {
        render(<MarkdownRenderer content={'- one\n- two'} />);
        expect(screen.getAllByRole('listitem')).toHaveLength(2);
    });

    it('renders a GFM table', () => {
        render(<MarkdownRenderer content={'| a | b |\n| - | - |\n| 1 | 2 |'} />);
        expect(screen.getByRole('table')).toBeInTheDocument();
    });

    it('renders nothing for an empty message', () => {
        const { container } = render(<MarkdownRenderer content="" />);
        expect(container.textContent).toBe('');
    });

    it('accepts a class override', () => {
        const { container } = render(<MarkdownRenderer content="x" className="text-white" />);
        expect(container.firstElementChild?.className).toContain('text-white');
    });
});

describe('ChatMessages', () => {
    const A_MESSAGE = { id: 'm1', role: 'user' as const, content: 'hello' };

    function renderMessages(overrides: Record<string, unknown> = {}) {
        render(
            <ChatMessages
                messages={[A_MESSAGE]}
                isTyping={false}
                agent={AGENT as never}
                {...(overrides as Partial<React.ComponentProps<typeof ChatMessages>>)}
            />
        );
    }

    it('renders a message', () => {
        renderMessages();
        expect(screen.getByText('hello')).toBeInTheDocument();
    });

    it('hides a message with no content and no thinking', () => {
        // The streaming placeholder starts empty; rendering it would flash an
        // empty bubble on every send.
        renderMessages({ messages: [{ id: 'm1', role: 'agent', content: '   ' }] });
        expect(screen.queryByText('hello')).not.toBeInTheDocument();
    });

    it('keeps a message that only has thinking', () => {
        renderMessages({
            messages: [{ id: 'm1', role: 'agent', content: '', thinking: 'hmm' }],
        });
        expect(screen.getByText('hmm')).toBeInTheDocument();
    });

    it('offers the thought process as a disclosure', () => {
        renderMessages({
            messages: [{ id: 'm1', role: 'agent', content: 'answer', thinking: 'hmm' }],
        });
        expect(screen.getByText('Thought Process')).toBeInTheDocument();
    });

    it('opens the thought while the answer is still streaming', () => {
        const { container } = render(
            <ChatMessages
                messages={
                    [
                        { id: 'm1', role: 'agent', content: 'x', thinking: 'hmm', streaming: true },
                    ] as never
                }
                isTyping
                agent={AGENT as never}
            />
        );
        expect(container.querySelector('details')?.open).toBe(true);
    });

    it('collapses it once streaming finishes', () => {
        const { container } = render(
            <ChatMessages
                messages={
                    [{ id: 'm1', role: 'agent', content: 'x', thinking: 'hmm' }] as never
                }
                isTyping={false}
                agent={AGENT as never}
            />
        );
        expect(container.querySelector('details')?.open).toBe(false);
    });

    it('shows an avatar on the first message of a run', () => {
        renderMessages();
        expect(document.querySelectorAll('.opacity-0')).toHaveLength(0);
    });

    it('hides the repeated avatar on a follow-up from the same role', () => {
        renderMessages({
            messages: [
                { id: 'm1', role: 'user', content: 'one' },
                { id: 'm2', role: 'user', content: 'two' },
            ],
        });
        expect(document.querySelectorAll('.opacity-0').length).toBeGreaterThan(0);
    });

    it('uses the agent avatar when there is one', () => {
        renderMessages({
            messages: [{ id: 'm1', role: 'agent', content: 'hi' }],
            agent: { ...AGENT, avatar: 'https://img/a.png' },
        });
        expect(screen.getByAltText('Agent')).toHaveAttribute('src', 'https://img/a.png');
    });

    it('shows a typing indicator', () => {
        const { container } = render(
            <ChatMessages messages={[]} isTyping agent={AGENT as never} />
        );
        expect(container.querySelectorAll('.animate-bounce')).toHaveLength(3);
    });

    it('prefers a live status over the dots', () => {
        render(
            <ChatMessages
                messages={[]}
                isTyping
                currentStatus="Searching the web"
                agent={AGENT as never}
            />
        );
        expect(screen.getByText(/searching the web/i)).toBeInTheDocument();
    });

    it('emphasises the starred part of a status', () => {
        // The API marks the tool name with *asterisks*; leaving them literal
        // would surface markdown syntax in the UI.
        render(
            <ChatMessages
                messages={[]}
                isTyping
                currentStatus="Calling *web_search*"
                agent={AGENT as never}
            />
        );
        expect(screen.getByText('web_search').tagName).toBe('STRONG');
    });

    it('renders with no messages at all', () => {
        const { container } = render(
            <ChatMessages messages={[]} isTyping={false} agent={AGENT as never} />
        );
        expect(container.querySelector('main')).toBeInTheDocument();
    });
});

describe('ChatView', () => {
    function renderView(overrides: Record<string, unknown> = {}) {
        return renderWithQuery(
            <ChatView
                agent={AGENT as never}
                initialChatId={null}
                initialChats={[]}
                initialMessages={[]}
                {...(overrides as Partial<React.ComponentProps<typeof ChatView>>)}
            />
        );
    }

    function send(text = 'hello') {
        fireEvent.change(screen.getByRole('textbox'), { target: { value: text } });
        fireEvent.submit(screen.getByRole('textbox').closest('form')!);
    }

    it('shows the agent it is talking to', () => {
        renderView();
        expect(screen.getByText('Scribe')).toBeInTheDocument();
    });

    it('falls back to a generated avatar', () => {
        renderView();
        expect(screen.getByAltText('Scribe')).toHaveAttribute(
            'src',
            expect.stringContaining('dicebear')
        );
    });

    it('renders the messages it was given', () => {
        renderView({
            initialMessages: [{ id: 'm1', role: 'user', content: 'earlier message' }],
        });
        expect(screen.getByText('earlier message')).toBeInTheDocument();
    });

    describe('sending', () => {
        it('posts the message', async () => {
            renderView();
            send('what is 2+2');
            await waitFor(() => expect(globalThis.fetch).toHaveBeenCalled());
            const [, options] = vi.mocked(globalThis.fetch).mock.calls[0];
            expect(JSON.parse(String(options?.body))).toEqual({ message: 'what is 2+2' });
        });

        it('starts a new chat when there is none', async () => {
            renderView();
            send();
            await waitFor(() => expect(globalThis.fetch).toHaveBeenCalled());
            expect(String(vi.mocked(globalThis.fetch).mock.calls[0][0])).toMatch(
                /\/agent\/agent_1\/chat$/
            );
        });

        it('continues an existing chat', async () => {
            renderView({ initialChatId: 'chat_9' });
            send();
            await waitFor(() => expect(globalThis.fetch).toHaveBeenCalled());
            expect(String(vi.mocked(globalThis.fetch).mock.calls[0][0])).toContain(
                '/chat/chat_9/continue'
            );
        });

        it('carries the bearer token', async () => {
            renderView();
            send();
            await waitFor(() => expect(globalThis.fetch).toHaveBeenCalled());
            const [, options] = vi.mocked(globalThis.fetch).mock.calls[0];
            expect(
                (options?.headers as Record<string, string>)['Authorization']
            ).toBe('Bearer tok');
        });

        it('carries a status key so the socket can follow the run', async () => {
            renderView();
            send();
            await waitFor(() => expect(globalThis.fetch).toHaveBeenCalled());
            const [, options] = vi.mocked(globalThis.fetch).mock.calls[0];
            expect(
                (options?.headers as Record<string, string>)['x-status-key']
            ).toBeTruthy();
        });

        it('shows the message immediately', async () => {
            // Waiting for the round trip to echo it back makes the app feel
            // broken on a slow model, so the request is left in flight here —
            // that gap is exactly what the optimistic message covers.
            vi.mocked(globalThis.fetch).mockReturnValue(new Promise(() => {}));
            renderView();
            send('optimistic');
            expect(await screen.findByText('optimistic')).toBeInTheDocument();
        });

        it('clears the input', () => {
            renderView();
            send();
            expect(screen.getByRole('textbox')).toHaveValue('');
        });

        it('ignores an empty submit', () => {
            renderView();
            fireEvent.submit(screen.getByRole('textbox').closest('form')!);
            expect(globalThis.fetch).not.toHaveBeenCalled();
        });

        it('ignores whitespace', () => {
            renderView();
            send('    ');
            expect(globalThis.fetch).not.toHaveBeenCalled();
        });

        it('renders the streamed answer', async () => {
            vi.mocked(globalThis.fetch).mockResolvedValue(
                sseResponse([
                    frame({ type: 'content', delta: 'the answer ' }),
                    frame({ type: 'content', delta: 'is 4' }),
                    DONE,
                ])
            );
            renderView();
            send();
            expect(await screen.findByText('hi there')).toBeInTheDocument();
        });

        it('accumulates content deltas', async () => {
            vi.mocked(globalThis.fetch).mockResolvedValue(
                sseResponse([
                    frame({ type: 'content', delta: 'partial ' }),
                    frame({ type: 'content', delta: 'answer' }),
                ])
            );
            renderView();
            send();
            expect(await screen.findByText('partial answer')).toBeInTheDocument();
        });

        it('accumulates thought deltas', async () => {
            vi.mocked(globalThis.fetch).mockResolvedValue(
                sseResponse([frame({ type: 'thought', delta: 'thinking hard' })])
            );
            renderView();
            send();
            expect(await screen.findByText('thinking hard')).toBeInTheDocument();
        });

        it('drops what it had on a reset', async () => {
            // The API sends this when the model retries; keeping the old text
            // would splice two different answers together.
            vi.mocked(globalThis.fetch).mockResolvedValue(
                sseResponse([
                    frame({ type: 'content', delta: 'first attempt' }),
                    frame({ type: 'reset' }),
                    frame({ type: 'content', delta: 'second attempt' }),
                ])
            );
            renderView();
            send();
            expect(await screen.findByText('second attempt')).toBeInTheDocument();
            expect(screen.queryByText(/first attempt/)).not.toBeInTheDocument();
        });

        it('handles a frame split across two chunks', async () => {
            // The reader gets whatever the socket gives it; a frame can arrive
            // in pieces and must be buffered, not parsed as two bad ones.
            vi.mocked(globalThis.fetch).mockResolvedValue(
                sseResponse(['data: {"type":"content","de', 'lta":"buffered"}\n'])
            );
            renderView();
            send();
            expect(await screen.findByText('buffered')).toBeInTheDocument();
        });

        it('survives a malformed frame', async () => {
            vi.mocked(globalThis.fetch).mockResolvedValue(
                sseResponse([
                    'data: {not json}\n',
                    frame({ type: 'content', delta: 'still works' }),
                ])
            );
            renderView();
            send();
            expect(await screen.findByText('still works')).toBeInTheDocument();
        });

        it('ignores a line that is not a frame', async () => {
            vi.mocked(globalThis.fetch).mockResolvedValue(
                sseResponse([': keep-alive\n', frame({ type: 'content', delta: 'ok' })])
            );
            renderView();
            send();
            expect(await screen.findByText('ok')).toBeInTheDocument();
        });

        it('navigates to the chat the run created', async () => {
            renderView();
            send();
            await waitFor(() =>
                expect(replace).toHaveBeenCalledWith(
                    '/agents/agent_1/chat/chat_1',
                    expect.anything()
                )
            );
        });

        it('does not renavigate inside an existing chat', async () => {
            renderView({ initialChatId: 'chat_1' });
            send();
            await waitFor(() => expect(globalThis.fetch).toHaveBeenCalled());
            expect(replace).not.toHaveBeenCalled();
        });

        it('re-enables the input when the run ends', async () => {
            renderView();
            send();
            await waitFor(() => expect(screen.getByRole('textbox')).toBeEnabled());
        });

        it('logs the user out on a 401', async () => {
            // The token expired mid-session; an error bubble would leave them
            // retyping into a chat that can never succeed.
            vi.mocked(globalThis.fetch).mockResolvedValue(sseResponse([], 401));
            const logout = vi.fn();
            const original = useAuthStore.getState().logout;
            useAuthStore.setState({ logout });
            renderView();
            send();
            await waitFor(() => expect(logout).toHaveBeenCalled());
            useAuthStore.setState({ logout: original });
        });

        it('shows an apology when the request fails outright', async () => {
            vi.mocked(globalThis.fetch).mockResolvedValue(sseResponse([], 500));
            renderView();
            send();
            expect(await screen.findByText(/encountered an error/i)).toBeInTheDocument();
        });

        it('recovers the input after a failure', async () => {
            vi.mocked(globalThis.fetch).mockRejectedValue(new Error('offline'));
            renderView();
            send();
            await waitFor(() => expect(screen.getByRole('textbox')).toBeEnabled());
        });

        it('reports a stream that errors mid-run', async () => {
            vi.mocked(globalThis.fetch).mockResolvedValue(
                sseResponse([frame({ type: 'error', message: 'model unavailable' })])
            );
            renderView();
            send();
            await waitFor(() => expect(screen.getByRole('textbox')).toBeEnabled());
        });

        it('clears the streaming marker when the run ends', async () => {
            // A bubble left marked streaming stays greyed out forever.
            const { container } = renderView();
            send();
            await waitFor(() => expect(screen.getByRole('textbox')).toBeEnabled());
            expect(container.querySelector('.italic')).toBeNull();
        });
    });

    describe('the history sidebar', () => {
        it('loads a chat that was picked', async () => {
            apiGet.mockResolvedValue({
                data: {
                    messages: [
                        { kind: 'request', parts: [{ part_kind: 'user-prompt', content: 'old' }] },
                    ],
                },
            });
            renderView({
                initialChats: [{ id: 'c1', preview: 'Older chat', updated_at: '2026-03-04T10:00:00Z' }],
            });
            fireEvent.click(screen.getByText('Older chat'));
            expect(await screen.findByText('old')).toBeInTheDocument();
        });

        it('navigates to it', async () => {
            renderView({
                initialChats: [{ id: 'c1', preview: 'Older chat', updated_at: '2026-03-04T10:00:00Z' }],
            });
            fireEvent.click(screen.getByText('Older chat'));
            expect(push).toHaveBeenCalledWith('/agents/agent_1/chat/c1');
        });

        it('survives a chat that will not load', async () => {
            apiGet.mockRejectedValue(new Error('gone'));
            renderView({
                initialChats: [{ id: 'c1', preview: 'Older chat', updated_at: '2026-03-04T10:00:00Z' }],
            });
            fireEvent.click(screen.getByText('Older chat'));
            await waitFor(() => expect(apiGet).toHaveBeenCalled());
            expect(screen.getByText('Older chat')).toBeInTheDocument();
        });

        it('clears the transcript for a new chat', async () => {
            renderView({ initialMessages: [{ id: 'm1', role: 'user', content: 'earlier' }] });
            fireEvent.click(screen.getByText(/new chat/i));
            await waitFor(() =>
                expect(screen.queryByText('earlier')).not.toBeInTheDocument()
            );
        });
    });

    describe('the agent switcher', () => {
        it('is hidden when there is nowhere to switch to', () => {
            renderView({ allAgents: [AGENT] });
            expect(screen.queryByText(/switch agent/i)).not.toBeInTheDocument();
        });

        it('appears when another agent exists', () => {
            renderView({ allAgents: [AGENT, OTHER_AGENT] });
            expect(screen.getByText(/switch agent/i)).toBeInTheDocument();
        });

        it('lists the other agents', () => {
            renderView({ allAgents: [AGENT, OTHER_AGENT] });
            fireEvent.click(screen.getByText(/switch agent/i));
            expect(screen.getByText('Scout')).toBeInTheDocument();
        });

        it('excludes the current agent', () => {
            renderView({ allAgents: [AGENT, OTHER_AGENT] });
            fireEvent.click(screen.getByText(/switch agent/i));
            const list = screen.getByRole('list');
            expect(within(list).queryByText('Scribe')).not.toBeInTheDocument();
        });

        it('switches to the one that was picked', () => {
            renderView({ allAgents: [AGENT, OTHER_AGENT] });
            fireEvent.click(screen.getByText(/switch agent/i));
            fireEvent.click(screen.getByText('Scout'));
            expect(push).toHaveBeenCalledWith('/agents/agent_2/chat');
        });

        it('closes on a second press', () => {
            renderView({ allAgents: [AGENT, OTHER_AGENT] });
            fireEvent.click(screen.getByText(/switch agent/i));
            fireEvent.click(screen.getByText(/switch agent/i));
            expect(screen.queryByText('Scout')).not.toBeInTheDocument();
        });

        it('closes on an outside click', () => {
            renderView({ allAgents: [AGENT, OTHER_AGENT] });
            fireEvent.click(screen.getByText(/switch agent/i));
            fireEvent.mouseDown(document.body);
            expect(screen.queryByText('Scout')).not.toBeInTheDocument();
        });

        it('stays open when clicked inside', () => {
            renderView({ allAgents: [AGENT, OTHER_AGENT] });
            fireEvent.click(screen.getByText(/switch agent/i));
            fireEvent.mouseDown(screen.getByRole('list'));
            expect(screen.getByText('Scout')).toBeInTheDocument();
        });
    });

    describe('the status socket', () => {
        it('opens one for the run', async () => {
            const opened: string[] = [];
            vi.stubGlobal(
                'WebSocket',
                class {
                    onmessage: ((e: { data: string }) => void) | null = null;
                    onerror: ((e: unknown) => void) | null = null;
                    close = vi.fn();
                    constructor(url: string) {
                        opened.push(url);
                    }
                }
            );
            renderView();
            send();
            await waitFor(() => expect(opened.length).toBeGreaterThan(0));
            expect(opened[0]).toMatch(/^ws/);
        });

        it('does not open one before a message is sent', () => {
            const opened: string[] = [];
            vi.stubGlobal(
                'WebSocket',
                class {
                    close = vi.fn();
                    constructor(url: string) {
                        opened.push(url);
                    }
                }
            );
            renderView();
            expect(opened).toHaveLength(0);
        });

        it('survives the socket failing to construct', async () => {
            vi.stubGlobal(
                'WebSocket',
                class {
                    constructor() {
                        throw new Error('blocked');
                    }
                }
            );
            renderView();
            send();
            await waitFor(() => expect(globalThis.fetch).toHaveBeenCalled());
            expect(screen.getByRole('textbox')).toBeInTheDocument();
        });
    });
});
