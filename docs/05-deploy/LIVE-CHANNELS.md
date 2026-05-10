# Going live — WhatsApp + Instagram without losing MCP

The architecture already supports both at once. `WA_OUTBOUND_MODE` and `IG_OUTBOUND_MODE` default to `both`, which fires the real Meta API and the sandbox MCP `*_send` in parallel for every reply. The same `/webhooks/{whatsapp,instagram}` route parses real Meta payloads and sandbox-injected payloads identically — they share Meta's wire format.

So enabling live is **credentials + a Meta Dashboard subscription**. No code changes.

## Mental model

```
                              ┌──────────────────────┐
  real customer's WA/IG ────► │ Meta Cloud / Graph   │
                              └──────────┬───────────┘
                                         │ webhook (signed)
                                         ▼
                          ┌──────────────────────────────┐
   sandbox eval ────────► │  /webhooks/whatsapp          │
   (whatsapp_inject_      │  /webhooks/instagram         │
    inbound, etc.)        └──────────┬───────────────────┘
                                     │ same parser, same handler
                                     ▼
                              ┌────────────┐
                              │ invokeAgent│
                              └──────┬─────┘
                                     │ adapter.send(threadId, text)
                                     ▼
                          ┌──────────────────────┐
                          │ outboundMode = 'both'│
                          ├──────────┬───────────┤
                          │   real   │  sandbox  │
                          ▼          ▼           ▼
                    Meta Cloud   sandbox MCP
                    (real reply  (eval scoring)
                     to user)
```

The eval scores `outboundMode === 'both' || 'sandbox'` because the rubric reads `whatsapp_send` calls. The customer experience requires `'both' || 'real'`. **Both** satisfies both — that's why it's the default.

## What you need before flipping the switch

### WhatsApp Business (~30 min if you already have a Meta Business account)

1. **Meta Business account** — https://business.facebook.com → create or pick an existing one.
2. **Meta App** — https://developers.facebook.com/apps → "Create app" → use case "Other" → type **Business**.
3. Add the **WhatsApp Business product** to the app. The wizard gives you:
   - A **test phone number** (Meta-hosted, free, instantly usable; can message up to 5 whitelisted recipients during dev mode — perfect for user-side testing without app review)
   - A **temporary 24h access token** (for the first round)
   - A **Phone Number ID** (`WA_PHONE_NUMBER_ID`)
   - A **WhatsApp Business Account ID** (`WA_BUSINESS_ACCOUNT_ID`)
4. **Generate a permanent System User token** — App Dashboard → Business Settings → System Users → Add → assign WhatsApp asset → Generate token (no expiry). That's `WA_TOKEN`.
5. **App Secret** — App Dashboard → Settings → Basic → App Secret → Show. That's `WA_APP_SECRET`. Needed for HMAC signature verification on inbound webhooks.
6. **Whitelist test recipients** — App Dashboard → WhatsApp → API Setup → "To" field → add your personal phone number. Until app review, only whitelisted numbers can message the test number.

### Instagram (similar, slightly more dependencies)

Instagram messaging requires an **Instagram Business or Creator account** that's connected to a **Facebook Page**. It's a one-time setup:

1. On the Instagram app → Settings → Account → Switch to professional account → Business or Creator.
2. Connect to a Facebook Page (create one if you don't have it).
3. In the same Meta App from above, add the **Instagram Graph API** + **Instagram Messaging** products.
4. App Dashboard → Instagram → API Setup → grab:
   - `IG_USER_ID` — the connected IG account's id
   - `IG_TOKEN` — Page Access Token (generate from Graph API Explorer or System User; needs `instagram_basic`, `instagram_manage_messages`, `pages_messaging` scopes)
   - `IG_APP_ID` — App Dashboard → Settings → Basic → App ID
   - `IG_APP_SECRET` — same screen as WA app secret
5. **Test users** — IG dev mode lets up to 25 instagram accounts message the connected business. Add yours: App Dashboard → Roles → Instagram Testers → Add.

## Step 1 — credentials

Add to backend `.env.local` (not the website `.env`; the website doesn't talk to Meta directly):

```bash
# WhatsApp
WA_PHONE_NUMBER_ID=1234567890
WA_TOKEN=EAA...                          # permanent System User token
WA_APP_SECRET=abc123...                  # Meta App Secret (HMAC verify)
WA_BUSINESS_ACCOUNT_ID=987654321
WA_VERIFY_TOKEN=happycake_verify_2026    # any string; must match Meta dashboard

# Instagram
IG_USER_ID=17841...
IG_TOKEN=EAA...                          # Page access token
IG_APP_ID=1122334455
IG_APP_SECRET=def456...
IG_VERIFY_TOKEN=happycake_verify_2026

# Leave outbound mode at default 'both' so the eval still scores
WA_OUTBOUND_MODE=both
IG_OUTBOUND_MODE=both
```

Restart the backend. The `[whatsapp]`/`[instagram]` "no app secret" warnings should disappear.

## Step 2 — public tunnel

Meta needs a publicly reachable HTTPS URL to deliver webhooks. The hackathon path uses ngrok or cloudflared (see [DEPLOY.md](./DEPLOY.md)). Whatever you use, the resulting URL is `<TUNNEL>` below. Examples:

- `https://abc123.ngrok-free.app` (free tier, rotates on every restart — annoying)
- `https://happycake-api.flowleads.dev` (named cloudflared tunnel, stable)

## Step 3 — register webhook URL with Meta

This is a Meta Dashboard action, **not** the `bun run register-webhooks` script — that one only registers with the sandbox MCP for evaluator scoring. Live customers route through Meta's own dashboard subscription.

**WhatsApp**:
1. App Dashboard → WhatsApp → Configuration → Webhook → "Edit"
2. Callback URL: `<TUNNEL>/webhooks/whatsapp`
3. Verify token: same value as `WA_VERIFY_TOKEN` above
4. Click "Verify and save" — Meta hits your `GET /webhooks/whatsapp` once with `hub.challenge`; you should see `[whatsapp] webhook verified` in the backend log.
5. In the same screen, **subscribe to fields**: `messages` is the only one we need.

**Instagram**:
1. App Dashboard → Instagram → API Setup → Webhooks → Configure webhooks
2. Callback URL: `<TUNNEL>/webhooks/instagram`
3. Verify token: same as `IG_VERIFY_TOKEN`
4. Click "Verify and save" — same handshake.
5. Subscribe to fields: `messages`, optionally `comments` if the marketing agent should reply on Reels.

## Step 4 — keep the sandbox MCP path live in parallel

Run the sandbox webhook registration too so the evaluator can keep injecting synthetic customers:

```bash
bun run src/scripts/register-webhooks.ts <TUNNEL>
```

That one updates the sandbox's idea of where to forward `whatsapp_inject_inbound` / `instagram_inject_dm`. Both now reach the same handler. Replies fire on **both** real Meta and sandbox MCP because `*_OUTBOUND_MODE=both`.

## Step 5 — testing from the user side

### WhatsApp

1. Open WhatsApp on your **whitelisted** personal phone.
2. Message the **test phone number** Meta gave you (it's printed in App Dashboard → WhatsApp → API Setup).
3. Type "hi, do you have honey cake?"
4. Watch the backend log:
   ```
   [whatsapp] +1281xxxxxxx → concierge
   [whatsapp:real] sent (Cloud API)
   [whatsapp:sandbox] sent (MCP)
   ```
5. The reply lands on your phone within a few seconds. You should also see the same conversation in the owner cockpit Inbox under the WhatsApp tab.

If only `[whatsapp:sandbox] sent` appears, the Cloud API call failed (check the warning log line — usually a token scope or whitelisted-number issue). The customer never sees your reply because their phone is on real WhatsApp, not the sandbox.

### Instagram

1. From your **tester** Instagram account, open the connected business profile (`@happycake.us` or whatever you connected).
2. Send a DM: "hey, can you do a custom cake for Saturday?"
3. Backend log:
   ```
   [instagram] 17841xxxxxxx → concierge
   [instagram:real] sent
   [instagram:sandbox] sent
   ```
4. Reply lands in your IG inbox. Cockpit Inbox shows it under the Instagram tab.

### Sanity checks

```bash
# Confirm the live mode is actually 'both' (not silently fallen back)
curl -s http://localhost:3000/api/admin/settings | jq '.env'

# Force a sandbox-side inject to make sure MCP still works
bun -e "import {callSandboxTool} from './src/lib/sandbox-mcp.ts'; \
  await callSandboxTool('whatsapp_inject_inbound', { from: '+12815559999', message: 'sandbox smoke' })"
# → backend logs [whatsapp] +12815559999 → concierge
```

## Common failure modes

| Symptom | Likely cause | Fix |
|---|---|---|
| Meta dashboard "Verify and save" returns 403 | `WA_VERIFY_TOKEN` mismatch | dashboard token must equal env value |
| Webhook 401s after a real message | App Secret missing or wrong | set `WA_APP_SECRET` / `IG_APP_SECRET`; restart |
| Real customer doesn't see reply | Token expired / wrong scopes | regenerate System User token, must include `whatsapp_business_messaging` (WA) or `pages_messaging` + `instagram_manage_messages` (IG) |
| "Cannot send message" outside 24h window (IG) | IG only allows reactive replies within 24h of last user message | by design — owner can re-engage via the human handoff |
| Eval score drops to 0 on `whatsapp_send` rows | Outbound mode flipped to `real` | set `WA_OUTBOUND_MODE=both` (default) |

## When to use the MCP path explicitly

The sandbox MCP tools (`whatsapp_send`, `instagram_send_dm`, `whatsapp_inject_inbound`, `instagram_inject_dm`) are scored by the evaluator and used by the world simulator. They are **not** for production customer messaging — they don't reach a real phone or IG account. Production customer messaging goes through `whatsappAdapter.send()` / `instagramAdapter.send()` on the channel router, which fan out to both backends per `*_OUTBOUND_MODE`.

Rule of thumb:

- **Customer-facing reply path** → call `adapter.send()` (the channel router does the fan-out).
- **Owner cockpit / agent tools that exist only in the sandbox world** → call `tryCallSandboxTool('whatsapp_send', ...)` directly. These are world-sim tools; they should not double up onto real Meta.

Both `src/channels/whatsapp.ts` and `src/channels/instagram/outbound.ts` document this at the top of the file.

## Cost note

WhatsApp Cloud API is **free** for service messages within the 24h customer-care window (which is all we send during the hackathon). Marketing-category templates outside that window are paid (~$0.04/msg US). Instagram messaging is currently free across the board for compliant business accounts. Neither needs a credit card for dev/test.
