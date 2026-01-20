import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { aiService } from '../../services/ai.service.js';

export const aiRouter = Router();

// Validation schema for refine request
const refineSchema = z.object({
  content: z.string().min(1, 'Content is required'),
  platforms: z.array(z.string()), // Empty array allowed - defaults to Twitter settings
  additionalContext: z.string().optional(),
  model: z.string().optional(),
});

/**
 * GET /api/ai/config
 * Get AI configuration (available models, default model, availability)
 */
aiRouter.get('/config', async (_req: Request, res: Response, _next: NextFunction): Promise<void> => {
  res.json({
    available: aiService.isAvailable(),
    defaultModel: aiService.getDefaultModel(),
    availableModels: aiService.getAvailableModels(),
  });
});

/**
 * POST /api/ai/refine
 * Refine content using AI
 */
aiRouter.post('/refine', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const parsed = refineSchema.safeParse(req.body);
    
    if (!parsed.success) {
      res.status(400).json({ 
        error: 'Validation failed', 
        details: parsed.error.flatten().fieldErrors 
      });
      return;
    }
    
    const input: Parameters<typeof aiService.refineContent>[0] = {
      content: parsed.data.content,
      platforms: parsed.data.platforms,
    };
    
    if (parsed.data.additionalContext) {
      input.additionalContext = parsed.data.additionalContext;
    }
    
    if (parsed.data.model) {
      input.model = parsed.data.model;
    }
    
    const result = await aiService.refineContent(input);
    
    res.json(result);
  } catch (error) {
    next(error);
  }
});
