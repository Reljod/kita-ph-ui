/**
 * Backing-service resolution for the E2E suite.
 *
 * Policy is cloud-first: the URIs in `.kita-api.env` are the real Doppler
 * values, and if this machine can actually reach them the suite runs against
 * them. When it cannot — a sandbox that only permits egress on :443, for
 * instance — we provision mongod and redis locally and say so loudly, rather
 * than failing the run or silently pretending the cloud was used.
 *
 * Either way the suite never writes to the production database: MONGO_DB_NAME
 * is always overridden to a dedicated E2E database that is dropped on teardown.
 */

import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';

export const E2E_DB_NAME = process.env.E2E_MONGO_DB_NAME ?? 'kita_db_e2e';

export interface ResolvedServices {
    mongoUri: string;
    redisUrl: string;
    mongoSource: 'cloud' | 'local';
    redisSource: 'cloud' | 'local';
    notes: string[];
}

/** Parse a dotenv-style file into a plain object. Values may be quoted. */
export function parseEnvFile(file: string): Record<string, string> {
    if (!existsSync(file)) return {};
    const out: Record<string, string> = {};
    for (const rawLine of readFileSync(file, 'utf8').split('\n')) {
        const line = rawLine.trim();
        if (!line || line.startsWith('#')) continue;
        const eq = line.indexOf('=');
        if (eq === -1) continue;
        const key = line.slice(0, eq).trim();
        let value = line.slice(eq + 1).trim();
        if (
            (value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))
        ) {
            value = value.slice(1, -1);
        }
        out[key] = value;
    }
    return out;
}

/** True when a TCP connection to host:port completes inside `timeoutMs`. */
export function canConnect(host: string, port: number, timeoutMs = 5000): Promise<boolean> {
    return new Promise((resolve) => {
        const socket = new net.Socket();
        const done = (ok: boolean) => {
            socket.destroy();
            resolve(ok);
        };
        socket.setTimeout(timeoutMs);
        socket.once('connect', () => done(true));
        socket.once('timeout', () => done(false));
        socket.once('error', () => done(false));
        socket.connect(port, host);
    });
}

/**
 * Reachability for a Mongo URI. `mongodb+srv://` hosts publish no A record and
 * their shards answer on 27017, so probe the shard port on the seed host's
 * SRV-resolved targets; for a plain `mongodb://` probe the literal host:port.
 */
async function mongoReachable(uri: string): Promise<boolean> {
    try {
        const url = new URL(uri.replace(/^mongodb(\+srv)?:\/\//, 'http://'));
        const host = url.hostname;
        if (uri.startsWith('mongodb+srv://')) {
            const { promises: dns } = await import('node:dns');
            const records = await dns.resolveSrv(`_mongodb._tcp.${host}`);
            if (!records.length) return false;
            return canConnect(records[0].name, records[0].port);
        }
        return canConnect(host, Number(url.port || 27017));
    } catch {
        return false;
    }
}

async function redisReachable(url: string): Promise<boolean> {
    try {
        const parsed = new URL(url.replace(/^rediss?:\/\//, 'http://'));
        return canConnect(parsed.hostname, Number(parsed.port || 6379));
    } catch {
        return false;
    }
}

const LOCAL_MONGO_PORT = Number(process.env.E2E_LOCAL_MONGO_PORT ?? 27018);
const LOCAL_REDIS_PORT = Number(process.env.E2E_LOCAL_REDIS_PORT ?? 6380);

function workDir(): string {
    const dir = path.join(os.tmpdir(), 'kita-e2e');
    mkdirSync(dir, { recursive: true });
    return dir;
}

/** Locate a mongod binary: PATH first, then an E2E_MONGOD_PATH override. */
function mongodBinary(): string | null {
    if (process.env.E2E_MONGOD_PATH && existsSync(process.env.E2E_MONGOD_PATH)) {
        return process.env.E2E_MONGOD_PATH;
    }
    for (const candidate of ['/usr/bin/mongod', '/usr/local/bin/mongod']) {
        if (existsSync(candidate)) return candidate;
    }
    return null;
}

async function startLocalMongo(): Promise<string> {
    if (await canConnect('127.0.0.1', LOCAL_MONGO_PORT, 1000)) {
        return `mongodb://127.0.0.1:${LOCAL_MONGO_PORT}`;
    }
    const binary = mongodBinary();
    if (!binary) {
        throw new Error(
            'Cloud MongoDB is unreachable and no local mongod was found. Either open ' +
                'egress to the Atlas cluster on :27017, or install mongod / set ' +
                'E2E_MONGOD_PATH to a mongod binary.'
        );
    }
    const dbpath = path.join(workDir(), 'mongo-data');
    mkdirSync(dbpath, { recursive: true });
    const child = spawn(
        binary,
        [
            '--dbpath', dbpath,
            '--port', String(LOCAL_MONGO_PORT),
            '--bind_ip', '127.0.0.1',
            '--logpath', path.join(workDir(), 'mongod.log'),
            '--fork',
        ],
        { stdio: 'ignore' }
    );
    await new Promise((resolve) => child.once('exit', resolve));
    for (let i = 0; i < 30; i++) {
        if (await canConnect('127.0.0.1', LOCAL_MONGO_PORT, 1000)) {
            return `mongodb://127.0.0.1:${LOCAL_MONGO_PORT}`;
        }
        await new Promise((r) => setTimeout(r, 500));
    }
    throw new Error('local mongod did not become reachable');
}

async function startLocalRedis(): Promise<string> {
    if (await canConnect('127.0.0.1', LOCAL_REDIS_PORT, 1000)) {
        return `redis://127.0.0.1:${LOCAL_REDIS_PORT}/0`;
    }
    spawn(
        'redis-server',
        ['--port', String(LOCAL_REDIS_PORT), '--daemonize', 'yes', '--save', ''],
        { stdio: 'ignore' }
    );
    for (let i = 0; i < 30; i++) {
        if (await canConnect('127.0.0.1', LOCAL_REDIS_PORT, 1000)) {
            return `redis://127.0.0.1:${LOCAL_REDIS_PORT}/0`;
        }
        await new Promise((r) => setTimeout(r, 500));
    }
    throw new Error('local redis-server did not become reachable');
}

/**
 * Resolve the Mongo and Redis endpoints the API should use, preferring the
 * cloud values from the env file and falling back to local instances.
 */
export async function resolveServices(env: Record<string, string>): Promise<ResolvedServices> {
    const notes: string[] = [];
    const cloudMongo = env.MONGO_URI ?? '';
    const cloudRedis = env.REDIS_CONNECTION_STRING ?? '';

    let mongoUri = cloudMongo;
    let mongoSource: 'cloud' | 'local' = 'cloud';
    if (!cloudMongo || !(await mongoReachable(cloudMongo))) {
        mongoUri = await startLocalMongo();
        mongoSource = 'local';
        notes.push(
            `MongoDB: cloud endpoint unreachable from this host — using local mongod at ${mongoUri}`
        );
    } else {
        notes.push('MongoDB: using the cloud cluster from .kita-api.env');
    }

    let redisUrl = cloudRedis;
    let redisSource: 'cloud' | 'local' = 'cloud';
    if (!cloudRedis || !(await redisReachable(cloudRedis))) {
        redisUrl = await startLocalRedis();
        redisSource = 'local';
        notes.push(
            `Redis: cloud endpoint unreachable from this host — using local redis at ${redisUrl}`
        );
    } else {
        notes.push('Redis: using the cloud instance from .kita-api.env');
    }

    return { mongoUri, redisUrl, mongoSource, redisSource, notes };
}
