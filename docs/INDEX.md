# Docs index

Single entry point. Read top-to-bottom for a fresh-onboard. Jump to the matrix tables when you need to know "where am I?".

## You probably want

- **What's left to build?** → [03-build/STATUS.md](./03-build/STATUS.md) (timeline) + [01-product/FEATURES.md](./01-product/FEATURES.md) (matrix)
- **What gets us points?** → [01-product/RUBRIC.md](./01-product/RUBRIC.md)
- **The plan from now to T+22h?** → [03-build/BUILD-PLAN.md](./03-build/BUILD-PLAN.md)
- **The submission checklist?** → [03-build/CHECKLIST.md](./03-build/CHECKLIST.md)

## 00-source — canonical inputs (read-only)

External materials we can't change. Treat as truth.

- [BRIEF.md](./00-source/BRIEF.md) — the hackathon brief
- [BRANDBOOK.md](./00-source/BRANDBOOK.md) — HappyCake voice, palette, agent rules
- [SNAPSHOT.md](./00-source/SNAPSHOT.md) — live data pulled from MCP (catalog, capacity, scenarios)
- [mcp-tools.json](./00-source/mcp-tools.json) — full schema of all 55 sandbox tools
- [asset-pack.metadata.json](./00-source/asset-pack.metadata.json) — approved photos + logos manifest

## 01-product — what we're building

- [FEATURES.md](./01-product/FEATURES.md) — feature × status × owner × DoD × rubric (the matrix)
- [USER-STORIES.md](./01-product/USER-STORIES.md) — actor → goal → acceptance
- [PERSONAS.md](./01-product/PERSONAS.md) — customer (web/WA/IG/walk-in), owner Askhat, AI evaluator
- [JOURNEYS.md](./01-product/JOURNEYS.md) — 5 end-to-end flows
- [RUBRIC.md](./01-product/RUBRIC.md) — 100-pt judging breakdown + our coverage
- [HYPOTHESIS.md](./01-product/HYPOTHESIS.md) — $500 → $5,000 marketing case

## 02-architecture — how it works

- [TECH-STACK.md](./02-architecture/TECH-STACK.md) — Bun + Hono + SQLite + claude -p + MCP, with rationale
- [SYSTEM.md](./02-architecture/SYSTEM.md) — component diagram + data flow
- [DATA-MODEL.md](./02-architecture/DATA-MODEL.md) — SQLite schema + sync rules
- [AGENT-RUNTIME.md](./02-architecture/AGENT-RUNTIME.md) — how `claude -p` is spawned and parsed
- [MCP.md](./02-architecture/MCP.md) — sandbox MCP + local stdio MCP, tool routing
- [WEBHOOKS.md](./02-architecture/WEBHOOKS.md) — inbound flow per channel (WA, IG, TG, Web, World)
- [SECURITY.md](./02-architecture/SECURITY.md) — agent fences, MCP auth, what `claude -p` can and can't touch

## 03-build — current state + plan

- [STATUS.md](./03-build/STATUS.md) — append-only timeline log
- [BUILD-PLAN.md](./03-build/BUILD-PLAN.md) — T+0 → T+22h critical path with owners
- [CHECKLIST.md](./03-build/CHECKLIST.md) — submission checklist, every item linked to evidence

## 04-test — how we'll prove it

- [SCENARIOS.md](./04-test/SCENARIOS.md) — 8 customer scenarios catalog
- [ASSISTANT-SCRIPT.md](./04-test/ASSISTANT-SCRIPT.md) — on-site assistant test script
- [EVIDENCE.md](./04-test/EVIDENCE.md) — what we capture for the evaluator

## 05-deploy — how we ship

- [DEPLOY.md](./05-deploy/DEPLOY.md) — laptop + ngrok (canonical) + droplet options
- [PRODUCTION.md](./05-deploy/PRODUCTION.md) — post-hackathon path (stub)
- [STORAGE.md](./05-deploy/STORAGE.md) — where uploads + brand assets actually live, how to flip Spaces on

## _archive — kept for reference, not load-bearing

- [PLAN.md](./_archive/PLAN.md) — original draft, stale on stack
- [BACKEND-PLAN.md](./_archive/BACKEND-PLAN.md) — earlier delegation doc, superseded by 03-build/BUILD-PLAN.md
- [TELEGRAM-AND-MINI-APP.md](./_archive/TELEGRAM-AND-MINI-APP.md)
- [WEBSITE-DELEGATION.md](./_archive/WEBSITE-DELEGATION.md)
- [AGENT-SDK-RETROFIT.md](./_archive/AGENT-SDK-RETROFIT.md)
