// Square customer sync — feature-flagged outbound CRM mirror.
//
// HappyCake's local SQLite is the source of truth for customer identity.
// Square is our point-of-sale system; mirroring our customers there gives
// the in-store team the same name + phone + history surface the website
// agent sees, and lets future Square-based loyalty / receipts work end-to-end.
//
// Dual transport, depending on what's available:
//
//   1. Sandbox MCP (hackathon path) — try `square_create_customer` over
//      JSON-RPC. If the sandbox responds with -32601 "Method not found",
//      we swallow the error once and never try again for this process
//      (most hackathon sandboxes don't expose customer endpoints). No
//      build break, no runtime cost.
//
//   2. Production Square REST (real path) — when SQUARE_LIVE_TOKEN is
//      set, POST directly to https://connect.squareup.com/v2/customers
//      with the customer's name + phone + email. The returned
//      customer.id gets stored on our local row in customers.square_customer_id.
//
// Called fire-and-forget from recordOrderForCustomer() — never blocks
// the order draft flow, never throws. Errors land in console.error
// where the operator notices but the customer doesn't.

import { getDb } from '../db/db.ts'
import { callSandboxTool, SandboxMcpError } from '../lib/sandbox-mcp.ts'
import { getCustomerById, type Customer } from './customers.ts'

// Process-scoped flag — flips to true the first time the sandbox tells us
// "method not found" for square_create_customer. Subsequent calls early-out
// so we don't hammer the sandbox with calls it can't service.
let sandboxCustomerEndpointKnownAbsent = false

interface SquareLiveCustomerResponse {
  customer?: { id?: string; given_name?: string; phone_number?: string }
}

/**
 * Sync a customer to Square.
 *
 *   - If already linked (square_customer_id non-null), no-op.
 *   - If SQUARE_LIVE_TOKEN is set, prefer the production REST API.
 *   - Otherwise, try the sandbox MCP once; on "method not found" mark
 *     the endpoint absent and stop trying for the process lifetime.
 *
 * Stores the returned id back on the customers row when successful.
 * Never throws — caller can fire-and-forget.
 */
export async function syncCustomerToSquare(customerId: string): Promise<void> {
  const customer = getCustomerById(customerId)
  if (!customer) return
  if (customer.square_customer_id) return  // already synced
  // Need at least one identifying field for Square.
  if (!customer.name && !customer.phone && !customer.email) return

  // Path 1 — production Square REST. Set SQUARE_LIVE_TOKEN in the deploy
  // env to enable; absent in hackathon by design.
  const liveToken = process.env.SQUARE_LIVE_TOKEN
  if (liveToken) {
    const id = await postToSquareLive(customer, liveToken)
    if (id) writeSquareCustomerId(customerId, id)
    return
  }

  // Path 2 — sandbox MCP. Try once; cache the absence.
  if (sandboxCustomerEndpointKnownAbsent) return
  try {
    const res = await callSandboxTool<SquareLiveCustomerResponse>('square_create_customer', {
      given_name: customer.name ?? undefined,
      phone_number: customer.phone ?? undefined,
      email_address: customer.email ?? undefined,
    })
    const sqId = res.customer?.id
    if (sqId) writeSquareCustomerId(customerId, sqId)
  } catch (err) {
    if (err instanceof SandboxMcpError && err.code === -32601) {
      sandboxCustomerEndpointKnownAbsent = true
      console.warn(
        '[customer-sync] sandbox MCP does not expose square_create_customer; ' +
          'skipping for the rest of this process. Set SQUARE_LIVE_TOKEN to use prod Square.',
      )
      return
    }
    console.warn('[customer-sync] sandbox sync failed:', (err as Error).message)
  }
}

/**
 * POST to the real Square Customers API. Returns the new customer.id on
 * success, null on failure (logged). Never throws.
 *
 * https://developer.squareup.com/reference/square/customers-api/create-customer
 */
async function postToSquareLive(
  customer: Customer,
  token: string,
): Promise<string | null> {
  const baseUrl = process.env.SQUARE_LIVE_BASE ?? 'https://connect.squareup.com'
  const idemKey = `cust_${customer.id}_${customer.created_at}`

  // Split "First Last" into Square's given_name + family_name. Square is
  // permissive about missing family names — best-effort split is fine.
  const [givenName, ...rest] = (customer.name ?? '').trim().split(/\s+/)
  const familyName = rest.join(' ') || undefined

  const body = {
    idempotency_key: idemKey,
    given_name: givenName || undefined,
    family_name: familyName,
    phone_number: customer.phone ?? undefined,
    email_address: customer.email ?? undefined,
  }

  try {
    const res = await fetch(`${baseUrl}/v2/customers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Square-Version': '2024-01-18',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const txt = await res.text().catch(() => '')
      console.warn(`[customer-sync] Square live ${res.status}: ${txt.slice(0, 200)}`)
      return null
    }
    const data = (await res.json()) as SquareLiveCustomerResponse
    return data.customer?.id ?? null
  } catch (err) {
    console.warn('[customer-sync] Square live fetch failed:', (err as Error).message)
    return null
  }
}

function writeSquareCustomerId(customerId: string, squareId: string): void {
  getDb()
    .prepare('UPDATE customers SET square_customer_id = ?, updated_at = ? WHERE id = ?')
    .run(squareId, Date.now(), customerId)
}
