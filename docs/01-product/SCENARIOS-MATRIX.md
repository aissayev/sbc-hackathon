# Scenarios matrix — all customer flows with status

The complete catalog of user flows + scenarios + acceptance criteria, organized by **actor → workflow → channel**. Use this as the single source of truth for "what does HappyCake handle?" and "is it tested?"

Companion docs:
- [USER-STORIES.md](USER-STORIES.md) — terse one-line stories
- [JOURNEYS.md](JOURNEYS.md) — 5 end-to-end flows in detail
- [PERSONAS.md](PERSONAS.md) — who's behind each scenario
- [docs/04-test/SCENARIOS.md](../04-test/SCENARIOS.md) — canonical 8 test scenarios

## Status legend

| Symbol | Meaning |
|---|---|
| ✅ | Built + verified live (smoke or eval) |
| 🟢 | Built + typechecks; not exercised live yet |
| 🟡 | Partially built / scaffolded — agent reasoning covers it but tools may be missing |
| 🔲 | Not built |
| ⚠️ | Blocked on external dependency (token, ngrok, brand asset) |

## Top-level rollup

| Actor | Total scenarios | ✅ live | 🟢 typechecks | 🟡 partial | 🔲 not built |
|---|---|---|---|---|---|
| LEADS (browsing + AI assistant) | 21 | 6 | 6 | 7 | 2 |
| CONSUMERS (transacting) | 47 | 4 | 14 | 18 | 11 |
| PARTNERS (B2B) | 16 | 0 | 0 | 8 | 8 |
| Cross-cutting (entry flows) | 6 | 1 | 2 | 3 | 0 |
| **Total** | **90** | **11** | **22** | **36** | **21** |

The 🟡 "partial" count is high because the **concierge agent** can reason about most of these conversationally — but specific tools (e.g., loyalty discounts, gift cards, custom-cake reference photo upload) don't exist yet. The agent will gracefully escalate or honestly say "I'll loop in Askhat" rather than invent.

---

## 1. LEADS — browsing, exploring, asking before commitment

### 1.A — Browsing / curiosity (8 scenarios)

| ID | Scenario | Primary channel | Status | Notes |
|---|---|---|---|---|
| L-A1 | Visitor opens site from Instagram, wants prices | Web `/menu` | ✅ | JSON-LD Product per item, prices via `/api/products` |
| L-A2 | Visitor wants best-sellers | Web | 🟡 | No "best-seller" flag in catalog yet; agent infers from margin × volume |
| L-A3 | Visitor wants to see photos | Web `/menu/[slug]` | 🟢 | Photos served from `data/photos/`; needs final asset pack |
| L-A4 | Visitor asks store location | Web `/policies`, Chat | ✅ | "Sugar Land, TX" in policies + agent prompt |
| L-A5 | Visitor asks opening hours | Web, Chat | ✅ | `/api/policies` returns `hours.pickup_window: "10:00–19:00 CT"` |
| L-A6 | Visitor asks delivery vs pickup | Web, Chat | ✅ | `/api/policies` `fulfillment` block |
| L-A7 | Visitor asks halal / alcohol policy | Chat | 🔲 | Add to policies + prompt; halal status not currently declared |
| L-A8 | Visitor wants customer reviews | Web | 🟡 | Sandbox `gb_list_reviews` exists; not yet rendered on website |

### 1.B — "Help me choose" (3 scenarios)

| ID | Scenario | Channel | Status | Notes |
|---|---|---|---|---|
| L-B1 | Doesn't know what flavor is best | Chat (concierge) | 🟡 | Agent asks 1-2 clarifying questions; recommends honey or pistachio per brand book |
| L-B2 | Cake recommendations for kids | Chat | 🟡 | Agent reasons; no explicit "kid-friendly" tag in catalog |
| L-B3 | Recommendation in $30–$50 budget | Chat | 🟢 | `list_products` price filter works; agent matches |

### 1.C — Event planning (lead stage) (4 scenarios)

| ID | Scenario | Channel | Status | Notes |
|---|---|---|---|---|
| L-C1 | Cake ideas for birthday party | Chat | 🟡 | Agent reasons; could plug a "design templates" tool |
| L-C2 | Cake ideas for wedding | Chat | 🔲 | Wedding category not in catalog; needs lead-time policy + escalation |
| L-C3 | Servings for 15 / 30 / 50 people | Chat | 🟡 | Whole honey serves ~12; custom serves 12-20; office box scales — agent does math |
| L-C4 | Refund / cancellation policy | Web `/policies`, Chat | ✅ | `/api/policies` `cancellation` block (24h free, then 100%) |

### 1.E — AI assistant scenarios (lead stage) (5 scenarios)

| ID | Scenario | Channel | Status | Notes |
|---|---|---|---|---|
| L-E1 | "What's your most popular cake?" | Chat | 🟡 | Agent infers from margin × capacity; no explicit popularity score |
| L-E2 | "Recommend something for mom's birthday" | Chat | ✅ | Concierge prompt covers; recommends whole honey or custom |
| L-E3 | "How much is delivery to my zip code?" | Chat | 🔲 | No zip-code-distance tool; agent says "we'll confirm at order time" |
| L-E4 | "What's available today?" | Chat | 🟢 | `square_get_inventory` tool wired; agent can call |
| L-E5 | "What should I order for 20 guests?" | Chat | ✅ | Concierge handles servings reasoning |

---

## 2. CONSUMERS — transacting customers

### 2.A — Standard ordering (4 scenarios)

| ID | Scenario | Channel | Status | Notes |
|---|---|---|---|---|
| C-A1 | Order for pickup today | Chat / `/order` | ✅ | `create_draft_order` + `escalate_to_owner` with `severity=low` works live |
| C-A2 | Order for pickup tomorrow | Same | ✅ | Same flow, agent calls `check_constraints` first |
| C-A3 | Delivery to home | Chat / `/order` | 🟡 | Draft creation accepts `pickup_or_delivery: 'delivery'` but no address-validation tool |
| C-A4 | Order desserts (macarons, pastries) | Chat | 🔲 | Catalog has cookie box but no macarons; would need catalog expansion |

### 2.B — Custom cake (3 scenarios)

| ID | Scenario | Channel | Status | Notes |
|---|---|---|---|---|
| C-B1 | Custom design (Spiderman, Barbie themes) | Chat | 🟡 | Concierge captures intent + escalates with `severity=low, reason=draft_pending_approval`. No reference photo upload yet |
| C-B2 | Cake with custom message ("Happy Bday Sarah") | Chat | ✅ | Captured in `notes` field of `create_draft_order`; verified in smoke |
| C-B3 | Cake shaped like object (car, handbag) | Chat | 🟡 | Same as B1 — captured + escalated, no upload |

### 2.C — Size & pricing (3 scenarios)

| ID | Scenario | Channel | Status | Notes |
|---|---|---|---|---|
| C-C1 | "How much for cake for 10 people?" | Chat | ✅ | Whole honey ($55, serves ~12) — agent surfaces |
| C-C2 | "What's the cheapest cake?" | Chat | 🟢 | `list_products` returns prices — agent picks lowest |
| C-C3 | Decoration cost extra? | Chat | 🟡 | No decoration line item; agent says "included" or escalates for custom |

### 2.D — Payment & checkout (4 scenarios)

| ID | Scenario | Channel | Status | Notes |
|---|---|---|---|---|
| C-D1 | Pay online | Web `/order` | 🔲 | No Square checkout integration; brief says simulated; OK to surface "card via Square at confirmation" |
| C-D2 | Pay at pickup | Chat | ✅ | `/api/policies` `payment.methods: ["card", "cash_at_pickup", "zelle"]` |
| C-D3 | Discount code | Chat | 🔲 | No promo code tool/system |
| C-D4 | Split payment (deposit + remainder) | Chat | 🔲 | No deposit-tracking; for custom cakes the owner can set this manually |

### 2.E — Availability & scheduling (4 scenarios)

| ID | Scenario | Channel | Status | Notes |
|---|---|---|---|---|
| C-E1 | Cake ready in 2 hours? | Chat | ✅ | `check_constraints` + `kitchen_get_capacity` covers this |
| C-E2 | Kitchen overloaded — alternative date? | Chat | 🟢 | `kitchen_get_capacity` returns load; agent can offer next slot |
| C-E3 | Same-day delivery | Chat | 🟡 | Honey slice is 5min lead; whole cake 60min — agent computes feasibility |
| C-E4 | Schedule delivery for future date | Chat / `/order` | ✅ | `scheduled_at_iso` field on draft |

### 2.F — Order tracking (4 scenarios)

| ID | Scenario | Channel | Status | Notes |
|---|---|---|---|---|
| C-F1 | "Where is my order?" | Chat | 🟢 | `get_order_status` tool wired; tested via smoke |
| C-F2 | "Has my cake been started?" | Chat | 🟢 | Status field reflects (draft → approved → in_kitchen → ready) |
| C-F3 | "Is my delivery on the way?" | Chat | 🔲 | No delivery-driver / GPS integration |
| C-F4 | Change delivery address after ordering | Chat | 🟡 | Agent escalates to owner; no direct mutation tool |

### 2.G — Modifications (4 scenarios)

| ID | Scenario | Channel | Status | Notes |
|---|---|---|---|---|
| C-G1 | Change message text | Chat | 🟡 | Escalation; needs an `update_order` tool to surface changes to kitchen |
| C-G2 | Change cake flavor after order | Chat | 🟡 | Same; depends on order status (still draft = easy, in kitchen = escalate) |
| C-G3 | Change pickup time | Chat | 🟡 | Same |
| C-G4 | Cancel order | Chat | 🟡 | `reject_order` exists for owner side; customer-initiated cancel needs new tool + policy check |

### 2.H — Complaints (6 scenarios)

| ID | Scenario | Channel | Status | Notes |
|---|---|---|---|---|
| C-H1 | Wrong cake flavor received | Chat | ✅ | `escalate_to_owner` with `severity=medium`, captured in concierge prompt |
| C-H2 | Damaged cake received | Chat | ✅ | Same flow + agent asks for photo (when supported); apologizes once |
| C-H3 | Cake smaller than expected | Chat | ✅ | Same flow + reference servings doc |
| C-H4 | Late delivery | Chat | ✅ | Same |
| C-H5 | Bad customer service complaint | Chat | ✅ | Same — escalates with full context |
| C-H6 | Refund request | Chat | ✅ | Concierge does NOT promise refund; escalates to owner |

### 2.I — Loyalty / repeat (3 scenarios)

| ID | Scenario | Channel | Status | Notes |
|---|---|---|---|---|
| C-I1 | Reorder same cake as last time | Chat | 🟡 | `loadHistory` returns thread context; agent can infer "your last order was X" |
| C-I2 | Loyalty discounts | Chat | 🔲 | No loyalty system |
| C-I3 | Gift cards | Chat | 🔲 | No gift card system |

### 2.J — Special needs (3 scenarios)

| ID | Scenario | Channel | Status | Notes |
|---|---|---|---|---|
| C-J1 | Nut-free cake | Chat | ✅ | Allergens declared per product; agent escalates allergen-critical |
| C-J2 | Low-sugar cake | Chat | 🔲 | No sugar-content data; agent escalates |
| C-J3 | No alcohol flavoring | Chat | 🟡 | Halal/alcohol policy not yet in policies endpoint |

### 2.K — AI assistant (consumer stage) (8 scenarios)

| ID | Scenario | Channel | Status | Notes |
|---|---|---|---|---|
| C-K1 | "Help me place an order step by step" | Chat | ✅ | Concierge order flow, smoke-tested |
| C-K2 | "Show cakes available today" | Chat | 🟢 | `square_get_inventory` available |
| C-K3 | "Calculate servings for 35 guests" | Chat | ✅ | Agent does math; recommends combo |
| C-K4 | "Cake for tomorrow morning, options?" | Chat | ✅ | `check_constraints` filters by lead time |
| C-K5 | "Refund policy if damaged?" | Chat | ✅ | Concierge cites policy; defers refund decision to owner |
| C-K6 | "How big for 20 people?" | Chat | ✅ | Office dessert box recommendation |
| C-K7 | "Do you need deposit?" | Chat | 🔲 | No deposit policy yet |
| C-K8 | "Can I mix flavors?" | Chat | 🟡 | For custom cakes — escalation |

---

## 3. PARTNERS — B2B inquiries

### 3.A — Event planners & wedding venues (6 scenarios)

| ID | Scenario | Channel | Status | Notes |
|---|---|---|---|---|
| P-A1 | Wedding cake price list | Chat | 🔲 | No wedding tier in catalog |
| P-A2 | Tasting box samples | Chat | 🔲 | No sampling system |
| P-A3 | Contract agreement (delivery + setup) | Chat | 🟡 | Concierge escalates to owner with "wedding planner inquiry" |
| P-A4 | Delivery radius / time guarantee | Chat | 🟡 | Policies cover area, not SLAs |
| P-A5 | Custom designs for VIP clients | Chat | 🟡 | Same as P-A3 — escalation |
| P-A6 | Desserts table service | Chat | 🟡 | Same |

### 3.B — Restaurants / cafes / grocery (4 scenarios)

| ID | Scenario | Channel | Status | Notes |
|---|---|---|---|---|
| P-B1 | Cafe wholesale resale | Chat | 🟡 | Escalation route only |
| P-B2 | Restaurant pastry supplier | Chat | 🟡 | Same |
| P-B3 | Grocery weekly cake slices | Chat | 🟡 | Same |
| P-B4 | Product catalog PDF | Chat | 🔲 | No PDF generation; could pipe `/api/products` to a PDF |

### 3.C — Schools / offices / corporate (3 scenarios)

| ID | Scenario | Channel | Status | Notes |
|---|---|---|---|---|
| P-C1 | School graduation cakes | Chat | 🟡 | Office dessert box already supports group orders |
| P-C2 | Office monthly birthday cakes | Chat | 🟡 | Same — escalates for recurring orders |
| P-C3 | Branded cupcakes with logo | Chat | 🔲 | No edible-print integration |

### 3.D — Influencers / marketing (2 scenarios)

| ID | Scenario | Channel | Status | Notes |
|---|---|---|---|---|
| P-D1 | Instagram collab offer | Chat / IG DM | 🔲 | Agent escalates to owner; no formal collab system |
| P-D2 | Blogger product review | Chat / IG | 🔲 | Same |

### 3.F — Suppliers (3 scenarios — note: there's no 3.E in the source)

| ID | Scenario | Channel | Status | Notes |
|---|---|---|---|---|
| P-F1 | Ingredient supplier offers | Chat / WA | 🔲 | Concierge declines + redirects to owner |
| P-F2 | Packaging supplier | Chat / WA | 🔲 | Same |
| P-F3 | Edible photo printing | Chat | 🔲 | Same |

### 3.G — Partnership AI assistant (4 scenarios)

| ID | Scenario | Channel | Status | Notes |
|---|---|---|---|---|
| P-G1 | "Who do I contact for wholesale?" | Chat | 🟡 | Agent escalates with partner-inquiry tag |
| P-G2 | "Can you do 200 cupcakes every Friday?" | Chat | 🟡 | Capacity check + escalate (kitchen daily capacity = 420 min) |
| P-G3 | "Schedule a tasting meeting" | Chat | 🟡 | Escalates |
| P-G4 | "Do you provide contracts and invoices?" | Chat | 🟡 | Escalates |

---

## 4. KEY ENTRY FLOWS — cross-cutting customer journeys

These are what the demo + eval likely test as full round-trips.

| ID | Flow | Channels | Status | Test command |
|---|---|---|---|---|
| EF-1 | Instagram → Website → Order | IG → Web | 🟡 | Open IG bio link → click `/menu/whole-honey-cake` → click "Start an order" → `/chat?product=...` → confirm |
| EF-2 | Google search → Website → Quick info | Search → Web | 🟢 | `/llms.txt`, JSON-LD, OpenAPI all live; agent-friendly score 14/15 |
| EF-3 | WhatsApp → Website → Checkout | WA → Web | 🟡 | Concierge can send menu link via WA; `/order/confirm/[id]` for status |
| EF-4 | Complaint → Support chat → Owner escalation | Web/WA/IG → Telegram | ✅ | `escalate_to_owner` + `severity=medium` flow tested live |
| EF-5 | Custom cake consultation (BEST DEMO) | Web → Telegram (owner) | 🟡 | Concierge captures + escalates; reference photo upload TODO |
| EF-6 | Partner inquiry (Wholesale) | Web → Telegram | 🟡 | Concierge escalates with partner tag |

---

## Recommended demo path — **Option 1: Custom cake consultation**

Per your note: highest-value, easy to demo, clear structured flow.

```
1. User opens https://happycake.us/chat
2. AI asks: "What's the occasion?"
3. AI asks (in 1 message): date, servings, flavor, theme/photo, budget, delivery vs pickup
4. AI calls create_draft_order with the captured spec
5. AI calls escalate_to_owner with severity=low, reason=draft_pending_approval
6. Owner Telegram bot pings @hc_owner_bot with inline [Approve] [Reject]
7. Owner taps Approve → backend orchestration:
   a. square_create_order via sandbox MCP
   b. kitchen_create_ticket via sandbox MCP
   c. local row updated to status=approved
8. Customer notified via /chat (or WA / IG if originated there)
```

Status: 🟡 — backend pieces all built (smoke-tested), Telegram inline keyboard wiring is in `src/bots/owner.ts` (added by website agent), TG bot tokens not yet in `.env.local`, photo upload not built.

---

## How we'll track ongoing testing

For each scenario above:
1. Add a YAML entry to `evals/scenarios/<id>.yaml` with the user message and expected acceptance criteria
2. Run `bun run smoke:agent "<message>"` for quick verification
3. Run `bun run world:run` for the eval-driven scenarios
4. Update the status column above as state changes

Owner of this doc: **Adilet** (architecture). Customer-side teammate adds new scenarios as they emerge from real eval runs or demo prep.
