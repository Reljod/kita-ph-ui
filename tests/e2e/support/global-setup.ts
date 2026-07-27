/**
 * Brings the whole stack up before the E2E suite runs:
 *
 *   backing services (cloud-first, local fallback)
 *     -> a registered API client, so the UI's proxy can authenticate
 *     -> the Kita API on :8080
 *     -> Next.js is started separately by Playwright's `webServer`
 *
 * Everything it decides is written to tests/e2e/.runtime.json so teardown and
 * the specs can read it back.
 */

import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { existsSync, mkdirSync, openSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { startMockOpenRouter } from './mock-openrouter';
import { E2E_DB_NAME, canConnect, parseEnvFile, resolveServices } from './services';

const REPO_ROOT = path.resolve(__dirname, '../../..');
const API_ROOT = process.env.E2E_API_ROOT ?? path.resolve(REPO_ROOT, '../Kita-PH');
const RUNTIME_FILE = path.resolve(__dirname, '../.runtime.json');
const API_PORT = Number(process.env.E2E_API_PORT ?? 8080);

let apiProcess: ChildProcess | undefined;

function log(message: string) {
    process.stdout.write(`[e2e-setup] ${message}\n`);
}

async function waitForHttp(url: string, timeoutMs = 120_000): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        try {
            const res = await fetch(url);
            // Any HTTP answer means the server is up; 401 is expected on
            // authenticated routes and still proves liveness.
            if (res.status > 0) return;
        } catch {
            /* not up yet */
        }
        await new Promise((r) => setTimeout(r, 1000));
    }
    throw new Error(`timed out waiting for ${url}`);
}

/**
 * Register an API client so the Next proxy's x-client-id / x-api-key are
 * accepted by ApiKeyAuthMiddleware. Uses the repo's own generator script so
 * the encryption scheme stays in one place.
 */
function registerApiClient(env: NodeJS.ProcessEnv): { clientId: string; apiKey: string } {
    const clientId = process.env.E2E_CLIENT_ID ?? 'kita-e2e-client';
    const result = spawnSync('uv', ['run', 'python', 'scripts/generate_client.py', clientId], {
        cwd: API_ROOT,
        env,
        encoding: 'utf8',
    });
    const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
    // The script frames the credentials; pull the api key back out of them.
    const match = output.match(/x-api-key[^0-9a-f]*([0-9a-f]{24})/i);
    if (!match) {
        throw new Error(`could not read generated client credentials:\n${output}`);
    }
    return { clientId, apiKey: match[1] };
}

export default async function globalSetup(): Promise<void> {
    const envFile = process.env.E2E_API_ENV_FILE ?? '/home/user/.kita-api.env';
    const fileEnv = parseEnvFile(envFile);
    if (!Object.keys(fileEnv).length) {
        log(`no env file at ${envFile}; relying on the ambient environment`);
    }

    const services = await resolveServices({ ...fileEnv, ...process.env } as Record<string, string>);
    services.notes.forEach((note) => log(note));

    const liveLlm = process.env.E2E_LIVE_LLM === '1';
    let openRouterBase = 'https://openrouter.ai/api/v1';
    let mockUrl: string | undefined;
    if (liveLlm) {
        log('E2E_LIVE_LLM=1 — calling the real OpenRouter API (costs money, output varies)');
    } else {
        const mock = await startMockOpenRouter();
        mockUrl = mock.url;
        openRouterBase = mock.url;
        // The mock lives in this process; teardown closes it via the runtime file.
        (globalThis as Record<string, unknown>).__kitaMockLlm = mock;
        log(`mock OpenRouter listening on ${mock.url}`);
    }

    const apiEnv: NodeJS.ProcessEnv = {
        ...process.env,
        ...fileEnv,
        MONGO_URI: services.mongoUri,
        MONGO_DB_NAME: E2E_DB_NAME,
        REDIS_CONNECTION_STRING: services.redisUrl,
        APP_ENV: 'local',
        // Hatchet's broker is not reachable in a test run and the worker is a
        // separate process anyway; an empty token keeps startup from blocking.
        HATCHET_CLIENT_TOKEN: '',
        LOGFIRE_SEND_TO_LOGFIRE: 'false',
        LOGFIRE_IGNORE_NO_CONFIG: '1',
        OPENAI_BASE_URL: openRouterBase,
        OPENROUTER_BASE_URL: openRouterBase,
        CORS_ALLOWED_ORIGINS: 'http://localhost:3000',
        SECRET_KEY: fileEnv.SECRET_KEY ?? 'e2e-secret-key',
    };

    log(`Mongo: ${services.mongoSource}, Redis: ${services.redisSource}, db: ${E2E_DB_NAME}`);

    if (!existsSync(API_ROOT)) {
        throw new Error(
            `Kita API checkout not found at ${API_ROOT}. Set E2E_API_ROOT to its path.`
        );
    }

    const credentials = registerApiClient(apiEnv);
    log(`registered API client ${credentials.clientId}`);

    if (await canConnect('127.0.0.1', API_PORT, 1000)) {
        log(`something is already listening on :${API_PORT}; reusing it`);
    } else {
        mkdirSync(path.resolve(__dirname, '../artifacts'), { recursive: true });
        const apiLog = path.resolve(__dirname, '../artifacts/api-server.log');
        const out = openSync(apiLog, 'w');
        apiProcess = spawn(
            'uv',
            ['run', 'uvicorn', 'main:app', '--host', '127.0.0.1', '--port', String(API_PORT)],
            { cwd: API_ROOT, env: apiEnv, stdio: ['ignore', out, out], detached: true }
        );
        apiProcess.unref();
        log(`starting the Kita API on :${API_PORT} (log: ${apiLog})`);
        await waitForHttp(`http://127.0.0.1:${API_PORT}/docs`);
        log('Kita API is up');
    }

    const runtime = {
        mongoUri: services.mongoUri,
        redisUrl: services.redisUrl,
        mongoSource: services.mongoSource,
        redisSource: services.redisSource,
        dbName: E2E_DB_NAME,
        apiPort: API_PORT,
        apiPid: apiProcess?.pid ?? null,
        clientId: credentials.clientId,
        apiKey: credentials.apiKey,
        llm: liveLlm ? 'live' : 'mock',
        mockUrl: mockUrl ?? null,
        notes: services.notes,
    };
    writeFileSync(RUNTIME_FILE, JSON.stringify(runtime, null, 2));

    // The Next dev server (started by playwright's webServer) needs the same
    // credentials, and reads them from its own process env.
    process.env.KITA_BACKEND_URL = `http://127.0.0.1:${API_PORT}`;
    process.env.KITA_CLIENT_ID = credentials.clientId;
    process.env.KITA_API_KEY = credentials.apiKey;
    process.env.NEXT_PUBLIC_API_URL = '/api';
    process.env.NEXT_PUBLIC_BACKEND_URL = `http://127.0.0.1:${API_PORT}`;
}
