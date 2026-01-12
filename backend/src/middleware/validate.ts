import { Request, Response, NextFunction } from 'express';
import { AnyZodObject, ZodError } from 'zod';
import { ValidationError } from './errorHandler.js';

/**
 * Middleware factory for validating request body, query, or params
 */
export function validate(schema: AnyZodObject) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
      });
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const message = error.errors
          .map((e) => `${e.path.join('.')}: ${e.message}`)
          .join(', ');
        next(new ValidationError(message));
      } else {
        next(error);
      }
    }
  };
}

/**
 * Middleware factory for validating only request body
 */
export function validateBody(schema: AnyZodObject) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      req.body = await schema.parseAsync(req.body);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const message = error.errors
          .map((e) => `${e.path.join('.')}: ${e.message}`)
          .join(', ');
        next(new ValidationError(message));
      } else {
        next(error);
      }
    }
  };
}
