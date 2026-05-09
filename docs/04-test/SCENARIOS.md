# Customer scenarios — 8 canonical tests

These are the YAML scenarios we run via `bun run smoke:agent` or by injecting into the sandbox via `whatsapp_inject_inbound` / `instagram_inject_dm`. They cover every On-Site Assistant rubric line and the Functional Tester scenarios.

Storage: `evals/scenarios/*.yaml`. Each has the same shape.

---

## Scenario shape

```yaml
id: s1-honey-cake-availability
channel: whatsapp                     # web | whatsapp | instagram
sender:
  id: '+12815551001'
  name: Maya Chen
turns:
  - direction: inbound
    text: 'do you have honey cake today?'
  - direction: outbound
    must_call_tools:
      - mcp__happycake__square_list_catalog
      - mcp__happycake__kitchen_get_capacity
    must_contain:
      - 'honey'
      - '$'
    must_not_contain:
      - 'sorry'
      - 'I cannot'
expect:
  agent_role: concierge
  duration_ms_p95: 30000
  cost_usd_max: 0.50
```

---

## The 8 scenarios

### S1 — Menu Q&A: honey cake availability
Channel: WhatsApp.
Customer: "do you have honey cake today?"
Expected: catalog lookup, capacity check, brand-voice yes/no with price.
Rubric: OSA (consultation).

### S2 — Whole-cake order intent for tomorrow
Channel: web `/api/chat`.
Customer: "I'd like a whole honey cake for pickup tomorrow at 5 pm."
Expected: capacity + lead-time check, draft order created, tracking code returned.
Rubric: F.T. (web order), OSA (consultation + status).

### S3 — Custom birthday cake (24h lead time)
Channel: Instagram DM.
Customer: "Spider-Man cake for 12 kids Saturday possible?"
Expected: clarifying questions (theme, headcount, dietary), 24h lead-time confirmed, escalate_to_owner with brief, owner Telegram approval, customer notified.
Rubric: OSA (custom orders + escalation), Operator Simulator (approval flow).

### S4 — Allergen / dietary question
Channel: web `/api/chat`.
Customer: "do you have any nut-free options for my child's birthday?"
Expected: read constraint data, list nut-free SKUs, offer custom alternative if needed.
Rubric: OSA (consultation), Agent-Friendliness (machine-readable allergens via `kitchen_get_menu_constraints`).

### S5 — Order status by tracking code
Channel: WhatsApp.
Customer: "where is order hc-7Q4-2K1?"
Expected: lookup local order state, return current status + ETA.
Rubric: OSA (status).

### S6 — Complaint with escalation
Channel: WhatsApp.
Customer: "the cream tasted off and there were only 6 layers, not 8"
Expected: brand-voice apology within seconds, escalate_to_owner priority=urgent, owner Telegram one-tap reply ("send replacement" / "refund + voucher"), customer reply on same channel.
Rubric: OSA (complaints + escalation), Operator Simulator.

### S7 — Lead-time mismatch (capacity-aware refusal)
Channel: web `/api/chat`.
Customer: "I need a custom Spider-Man cake in 2 hours"
Expected: agent refuses politely with reason (24h lead time required), offers ready alternatives that fit capacity.
Rubric: OSA (capacity-aware), Innovation (capacity-aware recommender), Penalty avoidance (uses real lead time, not made up).

### S8 — Comment-to-DM upgrade
Channel: Instagram comment under a recent post.
Customer comment: "how much?"
Expected: `instagram_reply_to_comment` with brief answer + DM invite, then DM thread captures intent → draft order.
Rubric: F.T. (channel breadth), OSA.

---

## How we run them

```bash
# One scenario via the smoke tool
bun run smoke:scenario evals/scenarios/s1-honey-cake-availability.yaml

# All scenarios via the test runner
bun run test:scenarios

# Inject into sandbox for evidence
bun run scripts/inject-scenarios.ts
```

Each run logs to `evidence/scenarios/<id>-<timestamp>.json` with:
- the inbound message
- the agent's reply
- tool-call trace
- duration + cost
- pass/fail per acceptance line

`bun run evidence` aggregates these into a single submission artifact.

---

## Authoring rules

1. **One inbound per scenario.** Multi-turn scenarios become S1a, S1b instead.
2. **Test the rubric, not the model.** Don't write scenarios that depend on a specific phrasing of the reply — only the *substance* (tools called, presence of price/code).
3. **No cheating.** Never assert a hardcoded price. Always assert that the catalog tool was called and the price the model returned matches what the tool returned.
4. **Brand-voice spot-check** on S1, S6 only — does the reply match BRANDBOOK §2.
