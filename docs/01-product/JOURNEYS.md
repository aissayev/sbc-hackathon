# Journey maps — 5 end-to-end flows

Each is a sequence the demo + evaluator will exercise. If any breaks, we lose rubric points on that line.

---

## J1 — Customer DM on Instagram → order placed

Channels: Instagram → Telegram (owner approval) → Instagram (reply).

```
1. IG follower comments "looks amazing!" on a cake post.
2. Sandbox simulator (or instagram_inject_dm) delivers DM "do you have honey cake today?"
3. Hono `/webhooks/instagram` → ack 200 → enqueue.
4. Worker pulls → router → role=concierge.
5. claude -p concierge:
     - tool_use: square_list_catalog → finds whole-honey-cake $55, 60 min lead time.
     - tool_use: kitchen_get_capacity → 420 min remaining.
     - tool_use: create_draft_order (local) → returns trackingCode hc-7Q4-2K1.
     - text: "Yes — whole honey cake $55, ready in 60 min. Want me to set it aside?"
6. Outbound: instagram_send_dm with reply.
7. Customer: "yes please".
8. Concierge: tool_use: escalate_to_owner OR auto-approve if not custom.
9. (Custom path) Owner bot pings @hc_owner_bot; one-tap approve.
10. Kitchen agent: tool_use: kitchen_create_ticket → kitchen_accept_ticket.
11. Customer gets confirmation: "On the counter at 4:30 PM. Tracking: hc-7Q4-2K1."
12. AuditEvent rows for every step → evaluator_get_evidence_summary picks them up.
```

Touches: C5, C6, A1 concierge, K1, K3, K4, B1 owner bot, B3 kitchen bot.

## J2 — Customer browses website → uses on-site assistant → orders

```
1. Customer lands on /menu (server-rendered HTML, JSON-LD per product).
2. Clicks /menu/whole-honey-cake → product page with photo, lead time, "ask the assistant" CTA.
3. /chat page loads assistant-ui island.
4. Customer: "I need a cake for 12 people for Saturday"
5. /api/chat (SSE) spawns claude -p concierge:
     - tool_use: kitchen_get_menu_constraints → whole-honey-cake serves 8-10, custom-birthday-cake = 12+.
     - tool_use: kitchen_get_capacity → custom-birthday capacity 4/day.
     - text streams: "For 12 you'll want our custom birthday cake — $95, needs 24h notice. Want me to start one?"
6. Customer: "yes Spider-Man theme please"
7. Concierge: tool_use: create_draft_order with custom note → escalate_to_owner.
8. Owner Telegram inline keyboard: [Approve $95] [Edit] [Reject].
9. Approve → kitchen_create_ticket queued.
10. Customer sees: "Confirmed. Tracking: hc-9F2-K3M. Pickup Saturday 3 PM."
```

Touches: W2, W3, W4, C1, C2, A1, K1, K3, B1.

## J3 — Owner runs the day from Telegram

```
07:55 — @hc_owner_bot pings: "Good morning. 3 orders queued, 1 needs approval (custom Spider-Man, $95). Kitchen at 22% capacity."
08:00 — Owner taps /today → digest with revenue, complaints, top SKU.
10:30 — @hc_marketing_bot: "Draft campaign: Mother's Day Meta Ads, $30, expected 12 leads. Approve?"
            [Approve] [Edit] [Reject]
10:31 — Owner taps Approve → marketing_launch_simulated_campaign.
13:00 — @hc_kitchen_bot: "⚠ Kitchen at 78%. 2 more whole-honey-cakes will block today's orders."
13:01 — Owner: "ok pause whole honey on web"
14:30 — Customer complaint arrives → concierge escalates.
            @hc_owner_bot: "Complaint thread #4421. Customer says cream tasted off."
            [Send replacement] [Refund + voucher] [Custom]
14:31 — Owner taps "Refund + voucher".
20:00 — @hc_owner_bot daily digest: "12 orders, $640, 1 complaint resolved, ROAS 8.4x on Mother's Day."
```

Touches: B1, B3, B4 + agents A1, A2, A3, A4.

## J4 — Marketing closed loop ($500 → $5,000)

```
T+0   — Marketing agent (cron) reads marketing_get_sales_history + marketing_get_margin_by_product.
T+5m  — Drafts 3 campaigns:
          1. Mother's Day Meta Ads $200 — whole honey cake (62% margin)
          2. Office Box Google Local $150 — office-dessert-box (60% margin, 12+ servings)
          3. Boosted IG post $150 — pistachio roll (64% margin, slice cross-sell)
T+10m — Owner approves 2 of 3 in Telegram.
T+15m — marketing_launch_simulated_campaign × 2 → world simulator generates leads.
T+1h  — marketing_generate_leads → 8 leads pulled.
T+1h+ — marketing_route_lead each to website (cold) or whatsapp (warm) with reason.
T+4h  — marketing_get_campaign_metrics → 3 conversions, ROAS 6.8x on whole honey, 9.1x on office box.
T+4h+ — marketing_adjust_campaign: kill the underperformer, double the office box budget.
T+EOD — marketing_report_to_owner → @hc_owner_bot digest.
```

Touches: M1–M5, B4, A3.

## J5 — World scenario (the evaluator drives this)

```
Evaluator calls world_start_scenario { scenarioId: "launch-day-revenue-engine", seed: 9100510 }.
Our world poller (10s tick) starts pulling world_next_event:
  - 0s: { channel:"website", type:"visitor_arrives", payload:{cakePreference:"honey"} }
  - 30s: { channel:"whatsapp", type:"inbound", payload:{from:"+12815551001", body:"birthday cake?"} }
  - 60s: { channel:"instagram", type:"comment", payload:{postId:"...", body:"price?"} }
  - 90s: { channel:"google_business", type:"review", payload:{rating:4, text:"good but late"} }
  - ... continues for 480 simulator-minutes (= 80 real minutes at 1:10 compression)
For each event, the worker dispatches via the same router as a real channel.
Every action becomes an agent_invocations row + an MCP audit_log entry.
After scenario completes, we call evaluator_score_world_scenario.
```

Touches: C8, all roles, all channels.
