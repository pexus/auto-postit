import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import session from 'express-session';
import { rateLimit } from 'express-rate-limit';
import { logger } from './lib/logger.js';
import { env } from './config/env.js';
import { errorHandler } from './middleware/errorHandler.js';
import { requestLogger } from './middleware/requestLogger.js';

// Route imports
import { healthRouter } from './routes/health.js';
import { authRouter } from './routes/auth.js';
import { publicRouter } from './routes/public.js';
import { apiRouter } from './routes/api/index.js';

const app = express();

// =============================================================================
// SECURITY MIDDLEWARE
// =============================================================================

// Helmet for security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

// CORS configuration
app.use(cors({
  origin: env.CORS_ORIGIN,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token'],
}));

// Rate limiting - general
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: { error: 'Too many requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(generalLimiter);

// =============================================================================
// PARSING MIDDLEWARE
// =============================================================================

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser(env.COOKIE_SECRET));

// =============================================================================
// SESSION MIDDLEWARE
// =============================================================================

app.use(session({
  secret: env.SESSION_SECRET,
  name: 'autopostit.sid',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
  },
}));

// =============================================================================
// LOGGING MIDDLEWARE
// =============================================================================

app.use(requestLogger);

// =============================================================================
// ROUTES
// =============================================================================

// Health check (no auth required)
app.use('/health', healthRouter);

// Public routes (OAuth callbacks, etc.)
app.use('/public', publicRouter);

// Auth routes (login, register, etc.)
app.use('/auth', authRouter);

// Protected API routes
app.use('/api', apiRouter);

// =============================================================================
// ERROR HANDLING
// =============================================================================

app.use(errorHandler);

// =============================================================================
// SERVER START
// =============================================================================

const PORT = env.PORT;

app.listen(PORT, () => {
  logger.info(`🚀 Server running on port ${PORT}`);
  logger.info(`📍 Environment: ${env.NODE_ENV}`);
});

export { app };
