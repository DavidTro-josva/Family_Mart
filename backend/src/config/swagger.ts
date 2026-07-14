export const swaggerSpec = {
  openapi: '3.0.0',
  info: {
    title: 'Family Mart ERP - API Documentation',
    version: '1.0.0',
    description: 'Production-grade enterprise REST APIs for Family Mart ERP. Includes security, inventory costing, billing, and accounting endpoints.',
  },
  servers: [
    {
      url: 'http://localhost:5000',
      description: 'Local Development Server',
    },
  ],
  components: {
    securitySchemes: {
      BearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
    },
  },
  paths: {
    '/api/v1/auth/login': {
      post: {
        summary: 'Authenticate User',
        description: 'Verifies credentials and returns a JWT access token.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  username: { type: 'string' },
                  password: { type: 'string' },
                },
                required: ['username', 'password'],
              },
            },
          },
        },
        responses: {
          200: { description: 'Successful login' },
          401: { description: 'Invalid credentials' },
        },
      },
    },
    '/api/v1/pos/checkout': {
      post: {
        summary: 'POS Checkout Transaction',
        description: 'Processes retail sales, deducts inventory using FIFO costing, updates credit balances, and registers cash transaction.',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  customerId: { type: 'string', format: 'uuid' },
                  paymentMethod: { type: 'string', enum: ['CASH', 'UPI', 'CARD', 'SPLIT'] },
                  subTotal: { type: 'number' },
                  taxAmount: { type: 'number' },
                  grandTotal: { type: 'number' },
                  items: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        productId: { type: 'string', format: 'uuid' },
                        quantity: { type: 'integer' },
                        unitPrice: { type: 'number' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        responses: {
          201: { description: 'Invoice created successfully' },
        },
      },
    },
    '/api/v1/transfers': {
      post: {
        summary: 'Request Stock Transfer',
        description: 'Requests stock movement from a source warehouse to a destination warehouse.',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  sourceWarehouseId: { type: 'string', format: 'uuid' },
                  destinationWarehouseId: { type: 'string', format: 'uuid' },
                  remarks: { type: 'string' },
                  items: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        productId: { type: 'string', format: 'uuid' },
                        quantityRequested: { type: 'integer' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        responses: {
          201: { description: 'Transfer request created' },
        },
      },
    },
    '/api/v1/returns': {
      post: {
        summary: 'Request Customer Return (RMA)',
        description: 'Requests a return against an invoice, initiating the RMA inspection workflow.',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  invoiceId: { type: 'string', format: 'uuid' },
                  warehouseId: { type: 'string', format: 'uuid' },
                  refundMethod: { type: 'string', enum: ['CASH', 'CREDIT_NOTE', 'ORIGINAL_PAYMENT'] },
                  items: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        productId: { type: 'string', format: 'uuid' },
                        quantity: { type: 'integer' },
                        reason: { type: 'string', enum: ['DAMAGED', 'DEFECTIVE', 'WRONG_ITEM', 'CHANGE_OF_MIND'] },
                        unitRefundAmount: { type: 'number' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        responses: {
          201: { description: 'Return request created' },
        },
      },
    },
    '/api/v1/ap/payments': {
      post: {
        summary: 'Record Supplier Payment',
        description: 'Records a payment voucher to settle supplier outstanding payables.',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  supplierId: { type: 'string', format: 'uuid' },
                  amount: { type: 'number' },
                  paymentMethod: { type: 'string', enum: ['CASH', 'UPI', 'BANK_TRANSFER', 'CHEQUE'] },
                  referenceNumber: { type: 'string' },
                  notes: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          201: { description: 'Payment voucher recorded' },
        },
      },
    },
  },
};
