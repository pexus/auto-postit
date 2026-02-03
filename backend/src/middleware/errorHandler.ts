import { Request, Response, NextFunction } from 'express';
import { logger } from '../lib/logger.js';

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly code: string | undefined;

  constructor(
    message: string,
    statusCode: number = 500,
    isOperational: boolean = true,
    code?: string
  ) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.code = code;
    
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, 400, true, 'VALIDATION_ERROR');
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string = 'Authentication required') {
    super(message, 401, true, 'AUTHENTICATION_ERROR');
  }
}

export class AuthorizationError extends AppError {
  constructor(message: string = 'Permission denied') {
    super(message, 403, true, 'AUTHORIZATION_ERROR');
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = 'Resource not found') {
    super(message, 404, true, 'NOT_FOUND');
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409, true, 'CONFLICT');
  }
}

export class RateLimitError extends AppError {
  constructor(message: string = 'Too many requests') {
    super(message, 429, true, 'RATE_LIMIT');
  }
}

export class QuotaExceededError extends AppError {
  constructor(platform: string) {
    super(`API quota exceeded for ${platform}`, 429, true, 'QUOTA_EXCEEDED');
  }
}

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  if ((err as { code?: string }).code === 'EBADCSRFTOKEN') {
    logger.warn({
      path: req.path,
      method: req.method,
    }, 'Invalid CSRF token');
    res.status(403).json({
      error: {
        message: 'Invalid CSRF token',
        code: 'CSRF_INVALID',
      },
    });
    return;
  }

  // Log the error
  if (err instanceof AppError && err.isOperational) {
    logger.warn({
      err: {
        message: err.message,
        code: err.code,
        statusCode: err.statusCode,
      },
      path: req.path,
      method: req.method,
    }, 'Operational error');
  } else {
    logger.error({
      err,
      path: req.path,
      method: req.method,
    }, 'Unexpected error');
  }

  // Send response
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: {
        message: err.message,
        code: err.code,
      },
    });
    return;
  }

  // Unknown error - don't leak details in production
  res.status(500).json({
    error: {
      message: process.env.NODE_ENV === 'production' 
        ? 'Internal server error' 
        : err.message,
      code: 'INTERNAL_ERROR',
    },
  });
}
