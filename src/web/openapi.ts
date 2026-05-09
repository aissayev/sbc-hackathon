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
