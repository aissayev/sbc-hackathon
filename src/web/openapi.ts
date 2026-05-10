// OpenAPI 3.1 spec served at /openapi.json. Kept short on purpose — agents
// crawling the site read /llms.txt + the Schema.org JSON-LD per page; this
// spec covers the JSON endpoints the Hono backend owns.

export function openApiSpec(): object {
  return {
    openapi: '3.1.0',
    info: {
      title: 'Happy Cake API',
      version: '0.1.0',
      description: 'Customer-facing API for AI agents and humans.',
    },
    servers: [{ url: 'https://happycake.us', description: 'Production' }],
    paths: {
      '/api/products': {
        get: {
          summary: 'List in-stock products',
          responses: { '200': { description: 'array of products' } },
        },
      },
      '/api/products/{id}': {
        get: {
          summary: 'Product detail',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { '200': { description: 'product detail' }, '404': { description: 'not found' } },
        },
      },
      '/api/policies': {
        get: {
          summary: 'Policies — lead times, fulfilment, payment, allergens',
          responses: { '200': { description: 'policies object' } },
        },
      },
      '/api/orders/draft': {
        post: {
          summary: 'Create a draft order; returns order_id + total. Owner approves before kitchen.',
          requestBody: {
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['items'],
                  properties: {
                    items: {
                      type: 'array',
                      items: {
                        type: 'object',
                        required: ['product_id', 'quantity'],
                        properties: {
                          product_id: { type: 'string' },
                          quantity: { type: 'integer' },
                        },
                      },
                    },
                    scheduled_at_iso: { type: 'string', format: 'date-time' },
                    customer_name: { type: 'string' },
                    customer_phone: { type: 'string' },
                    pickup_or_delivery: { type: 'string', enum: ['pickup', 'delivery'] },
                    notes: { type: 'string' },
                    channel: { type: 'string', enum: ['web', 'whatsapp', 'instagram', 'telegram'] },
                  },
                },
              },
            },
          },
          responses: { '200': { description: 'draft order id + total' } },
        },
      },
      '/api/orders/{id}': {
        get: {
          summary: 'Order status (public, by id)',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { '200': { description: 'order status' }, '404': { description: 'not found' } },
        },
      },
      '/track/{code}': {
        get: {
          summary: 'Human-readable order tracking page (HTML, live-polling)',
          parameters: [
            { name: 'code', in: 'path', required: true, schema: { type: 'string' }, description: 'Order id (`ord_*`)' },
            {
              name: 'embed',
              in: 'query',
              required: false,
              schema: { type: 'string', enum: ['1'] },
              description: 'When `1`, hides site chrome so the page can be iframed as a widget.',
            },
          ],
          responses: { '200': { description: 'HTML status page' }, '404': { description: 'order not found' } },
        },
      },
      '/api/uploads': {
        post: {
          summary: 'Upload an image or video to DigitalOcean Spaces; returns a public CDN URL',
          description:
            'multipart/form-data with `file` (≤ 10 MB), optional `scope` ∈ {thread, order, admin}, optional `scope_id`. ' +
            'Allowed MIMEs: jpeg, png, webp, gif, heic, mp4, webm, quicktime. ' +
            '503 if backend env (SPACES_*) is not configured.',
          requestBody: {
            content: {
              'multipart/form-data': {
                schema: {
                  type: 'object',
                  required: ['file'],
                  properties: {
                    file: { type: 'string', format: 'binary' },
                    scope: { type: 'string', enum: ['thread', 'order', 'admin'] },
                    scope_id: { type: 'string' },
                  },
                },
              },
            },
          },
          responses: {
            '200': { description: 'upload succeeded — returns key + public url' },
            '413': { description: 'file too large' },
            '415': { description: 'unsupported file type' },
            '503': { description: 'uploads not configured on this backend' },
          },
        },
      },
      '/api/leads/{source}': {
        post: {
          summary: 'Capture a lead from the B2B or custom-cake funnel; queued for owner review',
          parameters: [
            { name: 'source', in: 'path', required: true, schema: { type: 'string', enum: ['b2b', 'custom-cake', 'newsletter', 'press'] } },
          ],
          requestBody: {
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['contact'],
                  properties: {
                    contact: { type: 'string', description: 'phone, email, or company name' },
                    thread_id: { type: 'string' },
                    meta: { type: 'object', additionalProperties: true, description: 'funnel-specific context (headcount, dietary, dates, etc.)' },
                  },
                },
              },
            },
          },
          responses: { '200': { description: 'lead_id' }, '400': { description: 'validation failed' } },
        },
      },
      '/api/chat': {
        post: {
          summary: 'Talk to the Happy Cake assistant; returns reply text + new thread id',
          requestBody: {
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['text'],
                  properties: {
                    text: { type: 'string' },
                    thread_id: { type: 'string', description: 'reuse to continue a conversation' },
                    sender_name: { type: 'string' },
                  },
                },
              },
            },
          },
          responses: { '200': { description: 'replies' } },
        },
      },
    },
  }
}
