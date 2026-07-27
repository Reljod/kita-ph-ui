---
description: Run or debug the Playwright E2E suite, locally or against the deployed API.
argument-hint: "[spec path, or 'deployed' to target E2E_API_URL]"
---

Run the E2E suite using the **run-e2e** skill at
`.agents/skills/run-e2e/SKILL.md`. Read that skill and follow it.

Target: $ARGUMENTS (if empty, run the whole suite in local mode).

Pick the backend mode first — local provisions and cleans up after itself,
deployed writes to the shared cluster and cleans up nothing. When a run fails,
check the environment-failure table in the skill before reading the specs.
