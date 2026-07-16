import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import logger from './config/logger.js';
import { attachCorrelationId } from './middlewares/auth.middleware.js';
import authRouter from './routes/auth.routes.js';
import masterRouter from './routes/master.routes.js';
import inventoryRouter from './routes/inventory.routes.js';
import posRouter from './routes/pos.routes.js';
import financeRouter from './routes/finance.routes.js';
import dashboardRouter from './routes/dashboard.routes.js';
import auditRouter from './routes/audit.routes.js';
import procurementRouter from './routes/procurement.routes.js';
import receivingRouter from './routes/receiving.routes.js';
import fifoRouter from './routes/fifo.routes.js';
import transferRouter from './routes/transfer.routes.js';
import returnRouter from './routes/return.routes.js';
import supplierInvoiceRouter from './routes/supplierInvoice.routes.js';
import apRouter from './routes/ap.routes.js';
import reportRouter from './routes/report.routes.js';
import biRouter from './routes/bi.routes.js';
import alertRouter from './routes/alert.routes.js';
import searchRouter from './routes/search.routes.js';
import { idempotencyMiddleware } from './middlewares/idempotency.middleware.js';
import { swaggerSpec } from './config/swagger.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Security & Utility Middlewares
app.use(helmet());
const allowedOrigins = [
  'http://localhost:5432',
  'http://localhost:5173',
  'https://family-mart-tau.vercel.app'
];

if (process.env.FRONTEND_URL && !allowedOrigins.includes(process.env.FRONTEND_URL)) {
  allowedOrigins.push(process.env.FRONTEND_URL);
}

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin) || origin.endsWith('.vercel.app') || origin.endsWith('.netlify.app')) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));
app.use(express.json());
app.use(attachCorrelationId as express.RequestHandler);
app.use(idempotencyMiddleware as express.RequestHandler);

// Rate Limiter — applied before all routes
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      message: 'Too many requests, please try again later.',
      code: 'TOO_MANY_REQUESTS',
    },
  },
});
app.use('/api/', limiter);

// API Documentation routes
app.get('/api/v1/docs/swagger.json', (req, res) => {
  res.json(swaggerSpec);
});

app.get('/api/v1/docs', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>Family Mart ERP - API Documentation</title>
      <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
      <style>
        body { margin: 0; padding: 0; background-color: #fafafa; }
      </style>
    </head>
    <body>
      <div id="swagger-ui"></div>
      <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
      <script>
        window.onload = () => {
          window.ui = SwaggerUIBundle({
            url: '/api/v1/docs/swagger.json',
            dom_id: '#swagger-ui',
            deepLinking: true,
            presets: [
              SwaggerUIBundle.presets.apis
            ],
            layout: "BaseLayout"
          });
        };
      </script>
    </body>
    </html>
  `);
});

// Mount routers
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/master', masterRouter);
app.use('/api/v1/inventory', inventoryRouter);
app.use('/api/v1/pos', posRouter);
app.use('/api/v1/finance', financeRouter);
app.use('/api/v1/dashboard', dashboardRouter);
app.use('/api/v1/audit', auditRouter);
app.use('/api/v1/procurement', procurementRouter);
app.use('/api/v1/receiving', receivingRouter);
app.use('/api/v1/fifo', fifoRouter);
app.use('/api/v1/transfers', transferRouter);
app.use('/api/v1/returns', returnRouter);
app.use('/api/v1/supplier-invoices', supplierInvoiceRouter);
app.use('/api/v1/ap', apRouter);
app.use('/api/v1/reports', reportRouter);
app.use('/api/v1/bi', biRouter);
app.use('/api/v1/alerts', alertRouter);
app.use('/api/v1/search', searchRouter);

// Request logger
app.use((req, res, next) => {
  logger.http(`${req.method} ${req.url} - IP: ${req.ip}`);
  next();
});

// Health check
app.get('/api/v1/health', (req, res) => {
  res.status(200).json({
    success: true,
    data: {
      status: 'OK',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    },
  });
});

// Global Error Handler
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: any, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error(`${err.message} - Stack: ${err.stack}`);
  
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    success: false,
    error: {
      message: err.message || 'Internal Server Error',
      code: err.code || 'INTERNAL_SERVER_ERROR',
      details: err.details || null,
    },
  });
});

if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    logger.info(`Server is running on port ${PORT} in ${process.env.NODE_ENV} mode`);
  });
}

export default app;
