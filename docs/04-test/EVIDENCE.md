# Evidence — what we capture for the evaluator

The evaluator clones the repo, follows the README, and inspects state. Our job is to leave **convincing, verifiable evidence** of every rubric line.

Two kinds of evidence:

1. **Live evidence** — the evaluator runs scenarios and reads `mcp_audit_log` + our `agent_invocations` table.
2. **Snapshot evidence** — pre-submission, we run `bun run evidence` and commit `evidence/*.json` so the reviewer doesn't need to drive the system to see proof.

---

## `bun run evidence` — what it does

```ts
// src/scripts/evidence.ts (existing)
1. start a world scenario: world_start_scenario { id: 'launch-day-revenue-engine' }
2. tick world_next_event for the full duration; route every event through invokeAgent
3. capture mcp_audit_log per channel
4. call evaluator_get_evidence_summary, evaluator_score_marketing_loop, _pos_kitchen_flow, _channel_response, _world_scenario
5. call evaluator_generate_team_report
6. write evidence/<timestamp>.json with all of the above
7. write evidence/agent_invocations.csv (export from local SQLite)
```

The result is a single timestamped folder we link from README + ARCHITECTURE so the Code Reviewer can find it.

---

## Pre-submission demo script (run live during judging)

```bash
# 0. fresh clone shows we're production-clean
git clone https://github.com/aissayev/sbc-hackathon
cd sbc-hackathon
bun install
cp .env.example .env.local && $EDITOR .env.local   # paste tokens
bun run setup:mcp
bun run db:seed

# 1. agent smoke — proves the runtime
bun run smoke:agent "do you have a honey cake?"

# 2. start the server + tunnel
bun run dev &
ngrok http 3000 &
bun run register-webhooks

# 3. inject a customer scenario over WhatsApp
bun run scripts/inject-scenarios.ts s1-honey-cake-availability

# 4. drive a custom-cake order end-to-end (web)
curl -X POST http://localhost:3000/api/chat \
  -H 'content-type: application/json' \
  -d '{"threadId":"demo-1","text":"Spider-Man cake for 12 kids Saturday possible?"}'

# (owner taps Approve on Telegram — visible in @hc_owner_bot)

# 5. run the world scenario for evidence
bun run evidence

# 6. show the evaluator scores
cat evidence/$(ls -t evidence | head -1)/scores.json
```

## What ends up in `evidence/`

```
evidence/
├── <timestamp>/
│   ├── scores.json                 ← evaluator_score_* outputs (4 numbers + breakdown)
│   ├── team-report.json            ← evaluator_generate_team_report
│   ├── evidence-summary.json       ← evaluator_get_evidence_summary
│   ├── agent_invocations.csv       ← every claude -p call: role, duration, cost, exit
│   ├── world-timeline.json         ← world_get_timeline export
│   └── scenarios/
│       ├── s1-...-<ts>.json        ← per-scenario tool trace + reply + pass/fail
│       └── ...
```

Linked from README so the reviewer can open without running anything.

## What we explicitly do NOT capture

- The customer's PII beyond what the simulator gives us.
- Our team token.
- Real WhatsApp / Instagram OAuth tokens (we use simulator-only paths in evidence captures).
- Full prompts (we hash them in `agent_invocations.prompt_hash`); the role and tool-call trace is enough.

## Self-grading loop

After each phase of [BUILD-PLAN.md](../03-build/BUILD-PLAN.md), run:

```bash
bun run evidence --score-only   # skip the world scenario, just call evaluator_score_*
```

If a score < 60%, the next phase moves to lift that line before adding more surface area.
