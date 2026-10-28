import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { env } from './config/env.js';
import { pingDatabase } from './config/db.js';
import { errorHandler, notFoundHandler } from './middleware/error.js';
import { authRouter } from './modules/auth.js';
import { addressRouter } from './modules/addresses.js';
import { favouriteRouter } from './modules/favourites.js';
import { orderRouter } from './modules/orders.js';
import { publicRouter } from './modules/public.js';
import { reviewRouter } from './modules/reviews.js';
import { uploadRouter } from './modules/uploads.js';
import { adminCatalogRouter } from './modules/admin/catalog.js';
import { adminMarketingRouter } from './modules/admin/marketing.js';
import { adminOrderRouter } from './modules/admin/orders.js';
import { adminReviewRouter } from './modules/admin/reviews.js';
import { adminStatsRouter } from './modules/admin/stats.js';
import { adminUserRouter } from './modules/admin/users.js';

const LOCAL_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d{2,5})?$/;
const LAN_ORIGIN = /^https?:\/\/(192\.168|10)\.\d{1,3}\.\d{1,3}(:\d{2,5})?$/;

const isAllowedOrigin = (origin) => {
  if (!origin) return true; // curl, mobile apps, server-to-server
  if (env.clientOrigins.includes(origin)) return true;
  if (!env.isProd && (LOCAL_ORIGIN.test(origin) || LAN_ORIGIN.test(origin))) return true;
  return false;
};

export const createApp = () => {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      contentSecurityPolicy: false,
    }),
  );

  app.use(
    cors({
      origin(origin, callback) {
        if (isAllowedOrigin(origin)) return callback(null, true);
        return callback(new Error(`Origin ${origin} is not allowed by CORS`));
      },
      methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      maxAge: 86_400,
    }),
  );

  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

  if (!env.isTest) {
    app.use((req, res, next) => {
      const startedAt = Date.now();
      res.on('finish', () => {
        const ms = Date.now() - startedAt;
        const flag = res.statusCode >= 400 ? '!' : ' ';
        console.log(`${flag} ${req.method} ${req.originalUrl} -> ${res.statusCode} (${ms}ms)`);
      });
      next();
    });
  }

  app.use('/uploads', express.static(env.uploadsDir, { maxAge: '7d', fallthrough: true }));

  app.get('/api/health', async (_req, res) => {
    let database = 'up';
    try {
      await pingDatabase();
    } catch {
      database = 'down';
    }
    res.status(database === 'up' ? 200 : 503).json({
      success: database === 'up',
      data: {
        status: database === 'up' ? 'ok' : 'degraded',
        database,
        env: env.nodeEnv,
        uptime: Math.round(process.uptime()),
        timestamp: new Date().toISOString(),
      },
    });
  });

  app.use('/api/auth', authRouter);
  app.use('/api/addresses', addressRouter);
  app.use('/api/favourites', favouriteRouter);
  app.use('/api/orders', orderRouter);
  app.use('/api/reviews', reviewRouter);
  app.use('/api/uploads', uploadRouter);

  app.use('/api/admin/stats', adminStatsRouter);
  app.use('/api/admin/orders', adminOrderRouter);
  app.use('/api/admin/users', adminUserRouter);
  app.use('/api/admin/reviews', adminReviewRouter);
  app.use('/api/admin', adminCatalogRouter);
  app.use('/api/admin', adminMarketingRouter);

  app.use('/api', publicRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};

export default createApp;
