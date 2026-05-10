// Meta webhook signature verification (WhatsApp Cloud API + Instagram Graph API).
//
// Meta signs every webhook POST body with HMAC-SHA256 keyed on the Facebook App
// Secret and sends the digest in `X-Hub-Signature-256: sha256=<hex>`. Without
// this check, anyone who knows the public webhook URL can inject fake inbound
// messages and trigger agent runs (cost + reputation risk).
//
// Hackathon nuance: the sandbox MCP `whatsapp_inject_inbound` / `instagram_inject_inbound`
// tools POST to the same endpoint without a Meta signature. We therefore enforce
// the check only when an App Secret is configured. If the env var is unset (the
// default sandbox-only path), we allow unsigned bodies but log a warning so the
// gap is visible. Production deploys MUST set WA_APP_SECRET / IG_APP_SECRET.

import { createHmac, timingSafeEqual } from 'node:crypto'

export interface VerifyResult {
  ok: boolean
  // 'no_secret' = appSecret unset (allowed, sandbox mode)
  // 'no_header' = header missing but secret set (rejected)
  // 'mismatch'  = signature doesn't match (rejected)
  // 'verified'  = signature matches (allowed)
  reason: 'no_secret' | 'no_header' | 'mismatch' | 'verified'
}

export function verifyMetaSignature(
  rawBody: string,
  signatureHeader: string | undefined,
  appSecret: string | undefined,
): VerifyResult {
  if (!appSecret) return { ok: true, reason: 'no_secret' }
  if (!signatureHeader) return { ok: false, reason: 'no_header' }

  const expected = 'sha256=' + createHmac('sha256', appSecret).update(rawBody, 'utf8').digest('hex')
  const a = Buffer.from(signatureHeader)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return { ok: false, reason: 'mismatch' }
  let equal = false
  try {
    equal = timingSafeEqual(a, b)
  } catch {
    equal = false
  }
  return equal ? { ok: true, reason: 'verified' } : { ok: false, reason: 'mismatch' }
}
