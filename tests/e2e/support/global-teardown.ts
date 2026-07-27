/**
 * Drops the E2E database and stops anything global-setup started.
 *
 * The drop matters most when the suite ran against the real Atlas cluster:
 * the run writes users, orgs, agents and chats, and none of that should
 * outlive it. It targets only E2E_DB_NAME, never the production database.
 */

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, unlinkSync } from 'node:fs';
import path from 'node:path';

const RUNTIME_FILE = path.resolve(__dirname, '../.runtime.json');
const API_ROOT = process.env.E2E_API_ROOT ?? path.resolve(__dirname, '../../../../Kita-PH');

function log(message: string) {
    process.stdout.write(`[e2e-teardown] ${message}\n`);
}

export default async function globalTeardown(): Promise<void> {
    const mock = (globalThis as Record<string, unknown>).__kitaMockLlm as
        | { close: () => Promise<void> }
        | undefined;
    if (mock) await mock.close();

    if (!existsSync(RUNTIME_FILE)) return;
    const runtime = JSON.parse(readFileSync(RUNTIME_FILE, 'utf8'));

    if (process.env.E2E_KEEP_DB === '1') {
        log(`E2E_KEEP_DB=1 — leaving ${runtime.dbName} in place`);
    } else {
        // Drop through pymongo in the API's own venv rather than adding a
        // Node mongo driver just for teardown.
        const script = [
            'import os',
            'from pymongo import MongoClient',
            'client = MongoClient(os.environ["E2E_MONGO_URI"], serverSelectionTimeoutMS=15000)',
            'client.drop_database(os.environ["E2E_DB_NAME"])',
            'print("dropped", os.environ["E2E_DB_NAME"])',
            // scripts/generate_client.py always writes to the hardcoded
            // kita_admin database, which is shared with production when the
            // run targeted the cloud cluster. Remove just the row we added.
            'removed = client["kita_admin"]["clients"].delete_many(',
            '    {"client_id": os.environ["E2E_CLIENT_ID"]}',
            ').deleted_count',
            'print("removed", removed, "e2e client record(s) from kita_admin")',
        ].join('\n');
        const result = spawnSync('uv', ['run', 'python', '-c', script], {
            cwd: API_ROOT,
            env: {
                ...process.env,
                E2E_MONGO_URI: runtime.mongoUri,
                E2E_DB_NAME: runtime.dbName,
                E2E_CLIENT_ID: runtime.clientId,
            },
            encoding: 'utf8',
        });
        log((result.stdout || result.stderr || 'drop finished').trim());
    }

    if (runtime.uiPid) {
        try {
            process.kill(-runtime.uiPid, 'SIGTERM');
            log(`stopped Next (pid ${runtime.uiPid})`);
        } catch {
            try {
                process.kill(runtime.uiPid, 'SIGTERM');
            } catch {
                /* already gone */
            }
        }
    }

    if (runtime.apiPid) {
        try {
            process.kill(runtime.apiPid, 'SIGTERM');
            log(`stopped the API (pid ${runtime.apiPid})`);
        } catch {
            /* already gone */
        }
    }

    unlinkSync(RUNTIME_FILE);
}
