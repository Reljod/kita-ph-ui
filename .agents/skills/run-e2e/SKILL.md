---
name: run-e2e
description: >
  Use when running, debugging, or wiring up the Playwright E2E suite —
  locally, in CI, or against the deployed API. Triggers on "run the e2e
  tests", "e2e is failing in CI", "point e2e at the deployment", "the
  browser tests time out". Covers the two backend modes, where credentials
  come from, and which failures are the environment rather than the code.
---

# run-e2e

The suite brings its own stack up in `tests/e2e/support/global-setup.ts`.
Playwright's `webServer` is deliberately **not** used: it runs before
`globalSetup`, and the Next proxy in `src/app/api/[...path]/route.ts` reads
`KITA_API_KEY` / `KITA_CLIENT_ID` from its own process environment at
request time — so starting Next any earlier hands it empty credentials.

## Two backend modes

**Local (default).** Starts Mongo and Redis (cloud-first, local fallback),
mints a client, runs the API on `:8080`, then Next on `:3000`. Writes to
`kita_db_e2e` and drops it in teardown.

```bash
E2E_SKIP_BUILD=1 \
E2E_CHROMIUM_PATH=/opt/pw-browsers/chromium \
E2E_MONGOD_PATH=/path/to/mongod \
npx playwright test
```

**Deployed (`E2E_API_URL`).** Uses an already-running API. Nothing local is
provisioned, the OpenRouter mock is skipped, and **teardown drops nothing** —
the cluster belongs to the deployment, so dropping a database this process
never created is data loss, not cleanup.

```bash
E2E_API_URL=https://kita-api-dev.fastapicloud.dev \
E2E_SKIP_BUILD=1 E2E_CHROMIUM_PATH=/opt/pw-browsers/chromium \
npx playwright test
```

> The deployed API talks to the **shared** cluster, not `kita_db_e2e`. Every
> run leaves the accounts, orgs and agents it created behind. Use this mode
> deliberately, not as the default.

## Where credentials come from

In deployed mode, in order: `E2E_API_KEY` (the CI secret) →
`KITA_CLIENT_ID`/`KITA_API_KEY` from `.kita-ui.env` → mint a fresh one with
`scripts/generate_client.py`.

Minting needs direct Mongo access on `:27017`. A sandbox or CI runner often
cannot reach Atlas even when HTTPS works fine, which is exactly why the two
supplied forms come first.

## Environment failures that look like test failures

| Symptom | Cause |
| --- | --- |
| `Cloud MongoDB is unreachable and no local mongod was found` | Egress blocked *and* no `E2E_MONGOD_PATH`. Not a test bug. |
| Browser build mismatch (wants 1234, has 1194) | Set `E2E_CHROMIUM_PATH=/opt/pw-browsers/chromium`. Never run `playwright install` here. |
| `register failed: 401 Invalid x-client-id or x-api-key` | Deployed mode with credentials the deployment's cluster doesn't know. |
| Everything times out after `next build` | A stale `:3000`. Check ports with a socket probe. |

**Never use `pkill` to clean up.** The pattern matches the very shell
running it — `pkill -f "next start"` kills the session, and bracketing the
pattern (`[n]ext start`) does not help when the command line that spawned it
is still in flight. Probe the port instead and kill by recorded pid; that is
what `.runtime.json` stores them for.

## Evidence

`playwright.config.ts` captures a screenshot from every spec and a trace on
failure. Video is off on purpose — it was the bulk of ~11MB per run and the
screenshots carry the same review signal. Artifacts are uploaded by CI, never
committed.
