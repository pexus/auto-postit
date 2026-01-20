import OpenAI from 'openai';
import { env } from '../config/env.js';
import { logger } from '../lib/logger.js';
import { AppError } from '../middleware/errorHandler.js';

// Platform-specific content guidelines
const PLATFORM_GUIDELINES: Record<string, string> = {
  TWITTER: `Twitter/X: 
    - Maximum 280 characters
    - Concise and punchy
    - Use 1-3 relevant hashtags
    - Engaging and conversational tone
    - Encourage engagement (questions, calls to action)`,
  
  LINKEDIN: `LinkedIn:
    - Professional and thought-leadership tone
    - Can be longer (up to 3000 chars) but keep it focused
    - Share insights and value
    - Use line breaks for readability
    - 3-5 relevant hashtags at the end`,
  
  FACEBOOK: `Facebook:
    - Conversational and friendly tone
    - Can include emojis
    - Encourage comments and shares
    - Tell a story or share an experience
    - Keep it authentic and personal`,
  
  INSTAGRAM: `Instagram:
    - Visual-first mindset (describe how it relates to the image)
    - Use emojis liberally
    - Include a call to action
    - 5-10 relevant hashtags
    - Engaging caption style`,
  
  YOUTUBE: `YouTube (Community Post):
    - Engaging and direct
    - Ask questions to drive comments
    - Can include polls or choices
    - Build community connection`,
  
  PINTEREST: `Pinterest:
    - Descriptive and keyword-rich
    - Focus on what the pin offers
    - Include relevant keywords naturally
    - Keep it inspiring and actionable
    - 2-5 hashtags`,
};

// Tone based on platform selection
const getTone = (platforms: string[]): string => {
  if (platforms.length === 1) {
    const platform = platforms[0];
    switch (platform) {
      case 'TWITTER': return 'concise and engaging';
      case 'LINKEDIN': return 'professional and insightful';
      case 'FACEBOOK': return 'friendly and conversational';
      case 'INSTAGRAM': return 'visual and emoji-rich';
      case 'YOUTUBE': return 'engaging and community-focused';
      case 'PINTEREST': return 'descriptive and inspiring';
      default: return 'engaging';
    }
  }
  return 'engaging';
};

// Get the most restrictive character limit
const getCharacterLimit = (platforms: string[]): number => {
  const limits: Record<string, number> = {
    TWITTER: 280,
    LINKEDIN: 3000,
    FACEBOOK: 63206,
    INSTAGRAM: 2200,
    YOUTUBE: 5000,
    PINTEREST: 500,
  };
  
  let minLimit = Infinity;
  for (const platform of platforms) {
    const limit = limits[platform] || 5000;
    minLimit = Math.min(minLimit, limit);
  }
  
  return minLimit === Infinity ? 280 : minLimit;
};

export interface RefineContentInput {
  content: string;
  platforms: string[];
  additionalContext?: string;
  model?: string;
}

export interface RefineContentResult {
  refinedContent: string;
  model: string;
  platforms: string[];
  characterLimit: number;
}

class AIService {
  private client: OpenAI | null = null;

  private getClient(): OpenAI {
    if (!env.OPENAI_API_KEY) {
      throw new AppError('OpenAI API key not configured', 503, true, 'AI_NOT_CONFIGURED');
    }
    
    if (!this.client) {
      this.client = new OpenAI({
        apiKey: env.OPENAI_API_KEY,
      });
    }
    
    return this.client;
  }

  /**
   * Check if AI is available
   */
  isAvailable(): boolean {
    return !!env.OPENAI_API_KEY;
  }

  /**
   * Get available models
   */
  getAvailableModels(): string[] {
    return env.OPENAI_AVAILABLE_MODELS.split(',').map(m => m.trim());
  }

  /**
   * Get default model
   */
  getDefaultModel(): string {
    return env.OPENAI_DEFAULT_MODEL;
  }

  /**
   * Refine content for social media platforms
   */
  async refineContent(input: RefineContentInput): Promise<RefineContentResult> {
    const client = this.getClient();
    
    const { content, platforms, additionalContext, model } = input;
    const selectedModel = model || env.OPENAI_DEFAULT_MODEL;
    const availableModels = this.getAvailableModels();
    
    if (!availableModels.includes(selectedModel)) {
      throw new AppError(`Model ${selectedModel} is not available`, 400, true, 'INVALID_MODEL');
    }
    
    if (!content.trim()) {
      throw new AppError('Content is required', 400, true, 'CONTENT_REQUIRED');
    }
    
    // Use default settings if no platforms selected (Twitter's limit as most restrictive)
    const effectivePlatforms = platforms.length > 0 ? platforms : ['TWITTER'];
    const tone = getTone(effectivePlatforms);
    const characterLimit = getCharacterLimit(effectivePlatforms);
    const platformGuidelines = effectivePlatforms
      .map(p => PLATFORM_GUIDELINES[p] || '')
      .filter(Boolean)
      .join('\n\n');
    
    const systemPrompt = `You are an expert social media content writer. Your task is to refine and improve social media posts while maintaining the original message and intent.

Guidelines:
- Maintain the core message and intent of the original post
- Make the content more ${tone}
- The content must be under ${characterLimit} characters
- IMPORTANT: Preserve ALL URLs exactly as they appear in the original post - do not modify, shorten, or remove any links
- Do not add placeholder text like [your link] or [product name]
- Only output the refined post content, nothing else
- No explanations, no quotes around the content, just the refined text`;

    const userPrompt = `Refine this social media post for the following platform(s): ${platforms.join(', ')}.

Platform-specific guidelines:
${platformGuidelines}

${platforms.length > 1 ? `Since multiple platforms are selected, create ONE unified post that works well on all platforms. Use the most restrictive character limit (${characterLimit} characters).` : ''}

${additionalContext ? `Additional instructions: ${additionalContext}` : ''}

Original post:
"""
${content}
"""

Respond with only the refined post content.`;

    logger.info({ model: selectedModel, platforms, contentLength: content.length }, 'Refining content with AI');

    try {
      const completion = await client.chat.completions.create({
        model: selectedModel,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: 1000,
        temperature: 0.7,
      });

      const refinedContent = completion.choices[0]?.message?.content?.trim();
      
      if (!refinedContent) {
        throw new AppError('AI returned empty response', 500, true, 'AI_EMPTY_RESPONSE');
      }

      logger.info(
        { model: selectedModel, originalLength: content.length, refinedLength: refinedContent.length },
        'Content refined successfully'
      );

      return {
        refinedContent,
        model: selectedModel,
        platforms,
        characterLimit,
      };
    } catch (error) {
      if (error instanceof AppError) throw error;
      
      logger.error({ error }, 'OpenAI API error');
      
      if (error instanceof OpenAI.APIError) {
        if (error.status === 401) {
          throw new AppError('Invalid OpenAI API key', 401, true, 'AI_AUTH_ERROR');
        }
        if (error.status === 429) {
          throw new AppError('AI rate limit exceeded. Please try again later.', 429, true, 'AI_RATE_LIMIT');
        }
        throw new AppError(`AI service error: ${error.message}`, 500, true, 'AI_ERROR');
      }
      
      throw new AppError('Failed to refine content', 500, true, 'AI_ERROR');
    }
  }
}

export const aiService = new AIService();
