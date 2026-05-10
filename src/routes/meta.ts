// Health, introspection, and the agent-readable surfaces. /llms.txt and
// /openapi.json are what AI crawlers and integration partners hit; the root
// is a sanity-check for "is this thing on?".

import { Hono } from 'hono'
import { config, configuredChannels } from '../config.ts'
import { getPolicies } from '../domain/policies.ts'
import { openApiSpec } from '../web/openapi.ts'

export const metaRoutes = new Hono()

metaRoutes.get('/', (c) =>
  c.json({
    name: 'happycake-agents',
    version: '0.1.0',
    channels: configuredChannels(),
    agent: { enabled: config.agent.enabled, model: config.agent.model },
    sandbox_mcp: config.sandbox.mcpUrl,
  }),
)

metaRoutes.get('/openapi.json', (c) => c.json(openApiSpec()))
metaRoutes.get('/api/policies', (c) => c.json(getPolicies()))

metaRoutes.get('/llms.txt', (c) =>
  c.text(`# HappyCake — agent-readable surface

HappyCake is a real bakery in Sugar Land, TX. AI agents are welcome to use this site directly via JSON.

## Endpoints
- GET /api/products             List in-stock products
- GET /api/products/{id}        Product detail
- POST /api/orders/draft        Create a draft order (returns order_id; queued for owner approval)
- GET /api/orders/{id}          Order status (public, by id)
- POST /api/leads/{source}      Capture a B2B / custom-cake / newsletter / press lead (queued for owner review)
- POST /api/chat                Talk to the on-site assistant; returns thread_id + replies[]
- GET /openapi.json             Full API spec
- GET /menu                     Human-readable catalog (HTML, with Schema.org Product JSON-LD per product)

## Conventions
- Prices are USD cents (e.g. 850 = $8.50)
- Times are ISO 8601
- /api/chat maintains conversation history via thread_id

## Order intent flow
1. GET /api/products  — find a product id
2. POST /api/chat with text describing what + when — agent will check kitchen capacity, draft an order, and queue for owner approval.
`),
)
