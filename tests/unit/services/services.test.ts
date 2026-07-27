/**
 * Tests for the API service wrappers.
 *
 * These are thin, but the thing they encode is not: which calls carry the
 * `x-agent-id` header. That header is what scopes a request to one agent's
 * memories, so a call that forgets it silently widens to the whole
 * organization, and one that sends it when it should not narrows a view the
 * user expected to be complete.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api', () => ({
    api: {
        get: vi.fn(),
        post: vi.fn(),
        put: vi.fn(),
        patch: vi.fn(),
        delete: vi.fn(),
    },
}));

vi.mock('axios', () => ({
    default: { put: vi.fn() },
}));

const { api } = await import('@/lib/api');
const axios = (await import('axios')).default;
const { knowledgeService } = await import('@/services/knowledgeService');
const { memoryService } = await import('@/services/memoryService');

const AGENT_ID = 'agent_1';

function resolving(data: unknown = []) {
    return Promise.resolve({ data });
}

beforeEach(() => {
    vi.mocked(api.get).mockReturnValue(resolving());
    vi.mocked(api.post).mockReturnValue(resolving({}));
    vi.mocked(api.put).mockReturnValue(resolving({}));
    vi.mocked(api.patch).mockReturnValue(resolving({}));
    vi.mocked(api.delete).mockReturnValue(resolving({}));
});

describe('knowledgeService', () => {
    describe('getAll', () => {
        it('returns the payload rather than the envelope', async () => {
            vi.mocked(api.get).mockReturnValue(resolving([{ id: 'f1' }]));
            expect(await knowledgeService.getAll()).toEqual([{ id: 'f1' }]);
        });

        it('sends no filter for the organization view', async () => {
            await knowledgeService.getAll();
            expect(vi.mocked(api.get).mock.calls[0][1]).toEqual({ params: {} });
        });

        it('filters by agent when one is given', async () => {
            await knowledgeService.getAll(AGENT_ID);
            expect(vi.mocked(api.get).mock.calls[0][1]).toEqual({
                params: { agent_id: AGENT_ID },
            });
        });

        it('reads from the files endpoint', async () => {
            await knowledgeService.getAll();
            expect(vi.mocked(api.get).mock.calls[0][0]).toBe('/files');
        });
    });

    describe('initiateUpload', () => {
        it('returns the signed destination', async () => {
            vi.mocked(api.post).mockReturnValue(
                resolving({ file_id: 'f1', upload_url: 'https://x', method: 'POST' })
            );
            const result = await knowledgeService.initiateUpload({
                filename: 'a.pdf',
                size: 10,
            });
            expect(result.upload_url).toBe('https://x');
        });

        it('posts the request body', async () => {
            await knowledgeService.initiateUpload({ filename: 'a.pdf', size: 10 });
            expect(vi.mocked(api.post).mock.calls[0][1]).toEqual({
                filename: 'a.pdf',
                size: 10,
            });
        });
    });

    describe('uploadFile', () => {
        it('puts the bytes at the signed url', async () => {
            const file = new File(['x'], 'a.pdf', { type: 'application/pdf' });
            await knowledgeService.uploadFile('https://storage/x', file, 'POST');
            expect(vi.mocked(axios.put).mock.calls[0][0]).toBe('https://storage/x');
        });

        it('bypasses the app client entirely', async () => {
            // The signed URL points at Supabase, not the Kita API; sending the
            // app's auth headers there would leak them to a third party.
            const file = new File(['x'], 'a.pdf', { type: 'application/pdf' });
            await knowledgeService.uploadFile('https://storage/x', file, 'POST');
            expect(api.post).not.toHaveBeenCalled();
        });

        it('sends the file content type', async () => {
            const file = new File(['x'], 'a.pdf', { type: 'application/pdf' });
            await knowledgeService.uploadFile('https://storage/x', file, 'POST');
            const config = vi.mocked(axios.put).mock.calls[0][2] as {
                headers: Record<string, string>;
            };
            expect(config.headers['Content-Type']).toBe('application/pdf');
        });

        it('marks an upsert when a token is supplied', async () => {
            const file = new File(['x'], 'a.pdf', { type: 'application/pdf' });
            await knowledgeService.uploadFile('https://storage/x', file, 'POST', 'tok');
            const config = vi.mocked(axios.put).mock.calls[0][2] as {
                headers: Record<string, string>;
            };
            expect(config.headers['x-upsert']).toBe('true');
        });

        it('rejects a resumable upload rather than silently doing nothing', async () => {
            // The API hands out TUS destinations for files over 6MB; pretending
            // to succeed would leave a permanently pending record.
            const file = new File(['x'], 'big.pdf');
            await expect(
                knowledgeService.uploadFile('https://storage/x', file, 'TUS')
            ).rejects.toThrow(/TUS/);
        });
    });

    describe('mutations', () => {
        it('deletes by id', async () => {
            await knowledgeService.delete('f1');
            expect(vi.mocked(api.delete).mock.calls[0][0]).toBe('/files/f1');
        });

        it('patches rather than replaces', async () => {
            // The record carries server-owned fields (status, size); a PUT
            // would drop whichever ones the form does not know about.
            await knowledgeService.update('f1', { filename: 'b.pdf' });
            expect(api.patch).toHaveBeenCalled();
            expect(api.put).not.toHaveBeenCalled();
        });

        it('completes an upload by id', async () => {
            await knowledgeService.completeUpload('f1');
            expect(vi.mocked(api.post).mock.calls[0][0]).toBe('/files/f1/complete');
        });
    });
});

describe('memoryService', () => {
    describe('getAll', () => {
        it('returns the payload', async () => {
            vi.mocked(api.get).mockReturnValue(resolving([{ id: 'r1' }]));
            expect(await memoryService.getAll()).toEqual([{ id: 'r1' }]);
        });

        it('sends no agent header for the organization view', async () => {
            await memoryService.getAll();
            expect(vi.mocked(api.get).mock.calls[0][1]).toEqual({ headers: {} });
        });

        it('scopes to an agent when one is given', async () => {
            await memoryService.getAll(AGENT_ID);
            const config = vi.mocked(api.get).mock.calls[0][1] as {
                headers: Record<string, string>;
            };
            expect(config.headers['x-agent-id']).toBe(AGENT_ID);
        });
    });

    describe('create', () => {
        it('takes the agent scope from the payload', async () => {
            // Unlike the other calls there is no separate argument; the agent
            // the memory belongs to is the one it gets filed under.
            await memoryService.create({
                title: 'T',
                content: 'C',
                agent_id: AGENT_ID,
            });
            const config = vi.mocked(api.post).mock.calls[0][2] as {
                headers: Record<string, string>;
            };
            expect(config.headers['x-agent-id']).toBe(AGENT_ID);
        });

        it('sends no header for an organization-wide memory', async () => {
            await memoryService.create({ title: 'T', content: 'C' });
            expect(vi.mocked(api.post).mock.calls[0][2]).toEqual({ headers: {} });
        });

        it('sends the body', async () => {
            await memoryService.create({ title: 'T', content: 'C' });
            expect(vi.mocked(api.post).mock.calls[0][1]).toEqual({
                title: 'T',
                content: 'C',
            });
        });
    });

    describe('update', () => {
        it('targets the memory by id', async () => {
            await memoryService.update('r1', { title: 'New' });
            expect(vi.mocked(api.put).mock.calls[0][0]).toBe('/memory/r1');
        });

        it('carries the agent scope', async () => {
            await memoryService.update('r1', { title: 'New' }, AGENT_ID);
            const config = vi.mocked(api.put).mock.calls[0][2] as {
                headers: Record<string, string>;
            };
            expect(config.headers['x-agent-id']).toBe(AGENT_ID);
        });
    });

    describe('delete', () => {
        it('targets the memory by id', async () => {
            await memoryService.delete('r1');
            expect(vi.mocked(api.delete).mock.calls[0][0]).toBe('/memory/r1');
        });

        it('carries the agent scope', async () => {
            await memoryService.delete('r1', AGENT_ID);
            const config = vi.mocked(api.delete).mock.calls[0][1] as {
                headers: Record<string, string>;
            };
            expect(config.headers['x-agent-id']).toBe(AGENT_ID);
        });
    });

    describe('search', () => {
        it('sends the query', async () => {
            await memoryService.search('kita');
            const config = vi.mocked(api.get).mock.calls[0][1] as {
                params: Record<string, unknown>;
            };
            expect(config.params.query).toBe('kita');
        });

        it('defaults to five results', async () => {
            await memoryService.search('kita');
            const config = vi.mocked(api.get).mock.calls[0][1] as {
                params: Record<string, unknown>;
            };
            expect(config.params.limit).toBe(5);
        });

        it('honours an explicit limit', async () => {
            await memoryService.search('kita', undefined, 20);
            const config = vi.mocked(api.get).mock.calls[0][1] as {
                params: Record<string, unknown>;
            };
            expect(config.params.limit).toBe(20);
        });

        it('carries the agent scope', async () => {
            await memoryService.search('kita', AGENT_ID);
            const config = vi.mocked(api.get).mock.calls[0][1] as {
                headers: Record<string, string>;
            };
            expect(config.headers['x-agent-id']).toBe(AGENT_ID);
        });
    });
});
