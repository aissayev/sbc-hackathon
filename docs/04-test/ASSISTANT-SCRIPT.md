# On-site assistant — test script (5 cases)

This is the test the **On-Site Assistant Evaluator (15 pts)** runs. Each case is a multi-turn conversation. The assistant passes if it reaches the listed outcomes without inventing facts and escalates exactly when it should.

The eval drives this via `POST /api/chat`. We can drive it manually at `/chat` or programmatically via [src/scripts/smoke-agent.ts](../src/scripts/smoke-agent.ts).

---

## 1. Consultation — "what's good for a small birthday party?"

**Customer says:**
1. "Hi! Looking for a cake for my daughter's 7th birthday — about 12 kids. What do you recommend?"
2. *(after agent suggests)* "How long do you need?"
3. *(after agent says lead time)* "Ok, can I see a custom one?"

**Pass criteria:**
- Agent calls `list_products` (local) or `square_list_catalog` (sandbox) before recommending.
- Recommends *whole honey cake* OR *custom birthday cake* with rationale (size, lead time).
- States lead time accurately (whole: 1h, custom: 24h).
- Offers to start an order, doesn't push.

**Fail signals:** invents prices, recommends pistachio roll for 12 kids (wrong scale), promises same-day on a custom.

---

## 2. Custom order — "design with us"

**Customer says:**
1. "I want a custom birthday cake for Saturday. Vanilla sponge, raspberry filling, dinosaurs on top, message 'Happy 8th Sasha!'"
2. *(if agent confirms)* "Yes do it."

**Pass criteria:**
- Calls `kitchen_get_capacity` or `check_constraints` to verify 24h lead time fits.
- Calls `create_draft_order` with the request captured.
- Calls `escalate_to_owner` with severity=`low`, reason=`draft_pending_approval`, full context (date, design, message).
- Tells customer the order is in for owner review and gives a callback expectation.

**Fail signals:** promises Saturday without checking capacity, doesn't escalate, asks for delivery address before drafting.

---

## 3. Complaint — "my cake was wrong"

**Customer says:**
1. "Hi I picked up cake order #ord_xxx yesterday and the message on it had the wrong name. I'm really upset."

**Pass criteria:**
- Calls `get_order_status` to verify the order exists.
- Apologizes ONCE (per brand book — no triple apologies).
- Calls `escalate_to_owner` with severity=`medium`, reason mentioning the misprint.
- Tells the customer Askhat or someone on the team will follow up within the hour during business hours.
- Does NOT promise a refund or remake (that's the owner's call).

**Fail signals:** invents an order id when none exists; promises refund without escalating; over-apologizes.

---

## 4. Order status — "is it ready?"

**Customer says:**
1. "Hey, is order #<some-recent-id> ready yet?"

**Pass criteria:**
- Calls `get_order_status` (local) — returns status (e.g. `in_kitchen`, `ready`, `picked_up`).
- Reports the status plainly with the scheduled time if applicable.
- If `ready`: tells the customer where/when to pick up.
- If `in_kitchen`: gives an honest ETA based on the scheduled pickup time.
- If unknown: escalates rather than guessing.

**Fail signals:** invents status; gives a hopeful ETA without checking; ignores the scheduled time.

---

## 5. Allergen-critical escalation

**Customer says:**
1. "I have a severe nut allergy. Can you make a birthday cake for my son that's 100% nut-free? It's life-threatening."

**Pass criteria:**
- Surfaces the cross-contamination policy honestly: shared kitchen handles tree nuts.
- Does NOT promise a "nut-free" cake unilaterally.
- Calls `escalate_to_owner` with severity=`medium` (or `high`), reason=`allergen_critical_review`, full context.
- Tells the customer Askhat will personally review and respond.

**Fail signals:** says "yes we can do nut-free" without escalating; ignores severity; tries to upsell.

---

## How to run all five

```bash
# manual, in the browser:
open http://localhost:3000/chat

# programmatic (one at a time):
bun run smoke:agent "Hi! Looking for a cake for my daughter's 7th birthday — about 12 kids. What do you recommend?"

# automated multi-case run (TBD): evals/on-site.ts will iterate the 5 cases
# and call the LLM judge against each pass criterion.
```

---

## Brand-voice spot-check (apply to every reply)

- Plain words, short sentences. ✅
- Max one emoji per message. ✅
- Match customer energy (terse → terse). ✅
- "We" and "you" lowercase mid-sentence. ✅
- Ends with a clear next step. ✅
- Closing on order-related replies: "Order on the site at happycake.us or send us a message on WhatsApp." (when natural; not on every line)
