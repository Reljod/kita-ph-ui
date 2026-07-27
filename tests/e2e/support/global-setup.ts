/**
 * Brings the whole stack up before the E2E suite runs:
 *
 *   backing services (cloud-first, local fallback)
 *     -> a registered API client, so the UI's proxy can authenticate
 *     -> the Kita API on :8080
 *     -> Next.js on :3000, with those credentials in its environment
 *
 * Set E2E_API_URL to run against an already-deployed API (FastAPI Cloud)
 * instead of starting one locally. In that mode nothing here provisions or
 * owns the backing stores — the deployment carries its own configuration —
 * so no local Mongo/Redis is started and teardown drops nothing.
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
const UI_PORT = Number(process.env.E2E_UI_PORT ?? 3000);

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

/**
 * Credentials for a remote API. The generator script writes straight to Mongo,
 * so it only works from a host that can reach the deployment's own cluster —
 * which a CI runner may not. Supplying E2E_API_KEY skips it entirely.
 */
function remoteCredentials(
    apiEnv: NodeJS.ProcessEnv
): { clientId: string; apiKey: string } {
    const apiKey = process.env.E2E_API_KEY;
    if (apiKey) {
        const clientId = process.env.E2E_CLIENT_ID ?? 'kita-e2e-client';
        log(`using the supplied credentials for client ${clientId}`);
        return { clientId, apiKey };
    }
    log('no E2E_API_KEY supplied — minting one against the API\'s Mongo');
    return registerApiClient(apiEnv);
}

export default async function globalSetup(): Promise<void> {
    const envFile = process.env.E2E_API_ENV_FILE ?? '/home/user/.kita-api.env';
    const fileEnv = parseEnvFile(envFile);
    if (!Object.keys(fileEnv).length) {
        log(`no env file at ${envFile}; relying on the ambient environment`);
    }

    // A deployed API owns its own Mongo/Redis wiring, so provisioning local
    // stores here would only produce ones nothing ever reads.
    const remoteApiUrl = process.env.E2E_API_URL?.replace(/\/+$/, '');
    const services = remoteApiUrl
        ? { mongoUri: '', redisUrl: '', mongoSource: 'remote', redisSource: 'remote', notes: [] }
        : await resolveServices({ ...fileEnv, ...process.env } as Record<string, string>);
    services.notes.forEach((note) => log(note));

    const liveLlm = process.env.E2E_LIVE_LLM === '1';
    let openRouterBase = 'https://openrouter.ai/api/v1';
    let mockUrl: string | undefined;
    if (remoteApiUrl) {
        // The mock only works by pointing the API's OPENAI_BASE_URL at a local
        // listener. A deployed API reads its own environment, so starting one
        // here would silently do nothing — better to say so than to imply the
        // LLM is stubbed when it is not.
        log('remote API — LLM calls use whatever the deployment is configured with');
    } else if (liveLlm) {
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

    let credentials: { clientId: string; apiKey: string };
    let backendUrl: string;

    if (remoteApiUrl) {
        backendUrl = remoteApiUrl;
        log(`using the deployed API at ${backendUrl}`);
        await waitForHttp(`${backendUrl}/docs`, 60_000);
        log('deployed API answered');
        credentials = remoteCredentials(apiEnv);
    } else {
        log(`Mongo: ${services.mongoSource}, Redis: ${services.redisSource}, db: ${E2E_DB_NAME}`);

        if (!existsSync(API_ROOT)) {
            throw new Error(
                `Kita API checkout not found at ${API_ROOT}. Set E2E_API_ROOT to its path.`
            );
        }

        credentials = registerApiClient(apiEnv);
        log(`registered API client ${credentials.clientId}`);
        backendUrl = `http://127.0.0.1:${API_PORT}`;

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
            await waitForHttp(`${backendUrl}/docs`);
            log('Kita API is up');
        }
    }

    // --- Next.js ----------------------------------------------------------
    // Started here rather than through playwright's `webServer` because that
    // runs before globalSetup: the proxy in src/app/api/[...path]/route.ts
    // reads KITA_API_KEY / KITA_CLIENT_ID from its own process env at request
    // time, and those only exist once registerApiClient() has run.
    const uiEnv: NodeJS.ProcessEnv = {
        ...process.env,
        KITA_BACKEND_URL: backendUrl,
        KITA_CLIENT_ID: credentials.clientId,
        KITA_API_KEY: credentials.apiKey,
        NEXT_PUBLIC_API_URL: '/api',
        NEXT_PUBLIC_BACKEND_URL: backendUrl,
    };

    let uiPid: number | null = null;
    if (await canConnect('127.0.0.1', UI_PORT, 1000)) {
        log(`something is already listening on :${UI_PORT}; reusing it`);
    } else {
        if (process.env.E2E_SKIP_BUILD !== '1') {
            log('building the Next app (set E2E_SKIP_BUILD=1 to reuse an existing build)');
            const build = spawnSync('npm', ['run', 'build'], {
                cwd: REPO_ROOT,
                env: uiEnv,
                encoding: 'utf8',
            });
            if (build.status !== 0) {
                throw new Error(`next build failed:\n${build.stdout}\n${build.stderr}`);
            }
        }
        const uiLog = path.resolve(__dirname, '../artifacts/ui-server.log');
        const uiOut = openSync(uiLog, 'w');
        const ui = spawn('npx', ['next', 'start', '-p', String(UI_PORT)], {
            cwd: REPO_ROOT,
            env: uiEnv,
            stdio: ['ignore', uiOut, uiOut],
            detached: true,
        });
        ui.unref();
        uiPid = ui.pid ?? null;
        log(`starting Next on :${UI_PORT} (log: ${uiLog})`);
        await waitForHttp(`http://127.0.0.1:${UI_PORT}/login`);
        log('Next is up with API credentials in its environment');
    }

    const runtime = {
        uiPid,
        uiPort: UI_PORT,
        mongoUri: services.mongoUri,
        redisUrl: services.redisUrl,
        mongoSource: services.mongoSource,
        redisSource: services.redisSource,
        dbName: E2E_DB_NAME,
        // Teardown drops the database only when this run created it. Against a
        // deployed API the cluster belongs to the deployment, and dropping
        // someone else's data is not ours to do.
        provisionedDb: !remoteApiUrl,
        backendUrl,
        apiPort: API_PORT,
        apiPid: apiProcess?.pid ?? null,
        clientId: credentials.clientId,
        apiKey: credentials.apiKey,
        llm: liveLlm ? 'live' : 'mock',
        mockUrl: mockUrl ?? null,
        notes: services.notes,
    };
    writeFileSync(RUNTIME_FILE, JSON.stringify(runtime, null, 2));
}
