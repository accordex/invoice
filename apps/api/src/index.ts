import './lib/env.js';
import 'express-async-errors';
import express from 'express';
import cors from 'cors';
import { authRouter } from './routes/auth.js';
import { companyRouter } from './routes/company.js';
import { customersRouter } from './routes/customers.js';
import { productsRouter } from './routes/products.js';
import { invoicesRouter } from './routes/invoices.js';
import { privilegeRouter } from './routes/privilege.js';
import { dashboardRouter } from './routes/dashboard.js';

const app = express();
const port = parseInt(process.env.API_PORT ?? '3001', 10);

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '10mb' }));

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

app.use('/api/auth', authRouter);
app.use('/api/company', companyRouter);
app.use('/api/customers', customersRouter);
app.use('/api/products', productsRouter);
app.use('/api/invoices', invoicesRouter);
app.use('/api/privilege', privilegeRouter);
app.use('/api/dashboard', dashboardRouter);

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  if (res.headersSent) return;
  const message =
    err.name === 'PrismaClientInitializationError'
      ? 'Database connection failed. Check DATABASE_URL in .env'
      : 'Internal server error';
  res.status(500).json({ error: message });
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
});

app.listen(port, () => {
  console.log(`API running on http://localhost:${port}`);
});
