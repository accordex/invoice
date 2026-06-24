import './lib/env.js';
import 'express-async-errors';
import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { authRouter } from './routes/auth.js';
import { companyRouter } from './routes/company.js';
import { customersRouter } from './routes/customers.js';
import { productsRouter } from './routes/products.js';
import { invoicesRouter } from './routes/invoices.js';
import { privilegeRouter } from './routes/privilege.js';
import { dashboardRouter } from './routes/dashboard.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const port = parseInt(process.env.API_PORT ?? process.env.PORT ?? '3001', 10);
const isProduction = process.env.NODE_ENV === 'production';
const webDist = path.resolve(__dirname, '../../web/dist');

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

if (isProduction && fs.existsSync(webDist)) {
  app.use(express.static(webDist));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(webDist, 'index.html'));
  });
}

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
  console.log(`Server running on http://localhost:${port} (${isProduction ? 'production' : 'development'})`);
  if (isProduction && !fs.existsSync(webDist)) {
    console.warn(`Web build not found at ${webDist} — run pnpm build:prod`);
  }
});
