import { z } from 'zod';

/**
 * Supported platforms for import
 */
export const SUPPORTED_PLATFORMS = [
  'x',
  'linkedin',
  'facebook',
  'instagram',
  'youtube',
  'pinterest',
] as const;

export type SupportedPlatform = (typeof SUPPORTED_PLATFORMS)[number];

/**
 * Platform content limits
 */
export const PLATFORM_LIMITS: Record<
  SupportedPlatform,
  {
    maxContent: number;
    maxMedia: number;
    requiresMedia: boolean;
    requiresTitle: boolean;
    maxTitle?: number;
    maxDescription?: number;
  }
> = {
  x: {
    maxContent: 280, // 4000 for Premium
    maxMedia: 4,
    requiresMedia: false,
    requiresTitle: false,
  },
  linkedin: {
    maxContent: 3000,
    maxMedia: 9,
    requiresMedia: false,
    requiresTitle: false,
  },
  facebook: {
    maxContent: 63206,
    maxMedia: 10,
    requiresMedia: false,
    requiresTitle: false,
  },
  instagram: {
    maxContent: 2200,
    maxMedia: 10,
    requiresMedia: true,
    requiresTitle: false,
  },
  youtube: {
    maxContent: 5000,
    maxMedia: 1,
    requiresMedia: true,
    requiresTitle: true,
    maxTitle: 100,
    maxDescription: 5000,
  },
  pinterest: {
    maxContent: 500,
    maxMedia: 1,
    requiresMedia: true,
    requiresTitle: true,
    maxTitle: 100,
    maxDescription: 500,
  },
};

/**
 * YouTube privacy options
 */
export const YOUTUBE_PRIVACY = ['public', 'unlisted', 'private'] as const;

/**
 * Schema for a single imported row
 */
export const importRowSchema = z.object({
  platform: z.enum(SUPPORTED_PLATFORMS, {
    errorMap: () => ({
      message: `Invalid platform. Must be one of: ${SUPPORTED_PLATFORMS.join(', ')}`,
    }),
  }),

  scheduled_date: z.string().refine(
    (val) => {
      const date = new Date(val);
      return !isNaN(date.getTime());
    },
    { message: 'Invalid date format. Use ISO 8601 format (e.g., 2025-01-15T10:00:00Z)' }
  ),

  content: z.string().optional().default(''),

  media_urls: z
    .string()
    .optional()
    .transform((val) => {
      if (!val || val.trim() === '') return [];
      return val
        .split(',')
        .map((url) => url.trim())
        .filter((url) => url.length > 0);
    }),

  tags: z
    .string()
    .optional()
    .transform((val) => {
      if (!val || val.trim() === '') return [];
      return val
        .split(',')
        .map((tag) => tag.trim().replace(/^#/, ''))
        .filter((tag) => tag.length > 0);
    }),

  link: z.string().url().optional().or(z.literal('')),

  title: z.string().optional().default(''),

  description: z.string().optional().default(''),

  board: z.string().optional().default(''),

  privacy: z.enum(YOUTUBE_PRIVACY).optional().default('public'),
});

export type ImportRow = z.infer<typeof importRowSchema>;

/**
 * Validated import row with original row number
 */
export interface ValidatedRow {
  rowNumber: number;
  data: ImportRow;
  warnings: string[];
}

/**
 * Import error
 */
export interface ImportError {
  row: number;
  column?: string;
  error: string;
}

/**
 * Import result
 */
export interface ImportResult {
  success: boolean;
  summary: {
    total_rows: number;
    imported: number;
    skipped: number;
    errors: ImportError[];
    warnings: string[];
  };
  posts: Array<{
    id: string;
    platform: SupportedPlatform;
    scheduled_date: string;
    status: 'scheduled' | 'draft' | 'error';
  }>;
}

/**
 * Validate a row against platform-specific limits
 */
export function validateRowForPlatform(
  row: ImportRow,
  rowNumber: number,
  isPremium = false
): { valid: boolean; errors: ImportError[]; warnings: string[] } {
  const errors: ImportError[] = [];
  const warnings: string[] = [];
  const limits = PLATFORM_LIMITS[row.platform];

  // Check content length
  const maxContent = row.platform === 'x' && isPremium ? 4000 : limits.maxContent;
  if (row.content && row.content.length > maxContent) {
    errors.push({
      row: rowNumber,
      column: 'content',
      error: `Content exceeds ${row.platform} character limit (${maxContent}). Got ${row.content.length} characters.`,
    });
  }

  // Check media requirements
  if (limits.requiresMedia && (!row.media_urls || row.media_urls.length === 0)) {
    errors.push({
      row: rowNumber,
      column: 'media_urls',
      error: `${row.platform} requires at least one media attachment.`,
    });
  }

  // Check media count
  if (row.media_urls && row.media_urls.length > limits.maxMedia) {
    errors.push({
      row: rowNumber,
      column: 'media_urls',
      error: `${row.platform} allows maximum ${limits.maxMedia} media attachments. Got ${row.media_urls.length}.`,
    });
  }

  // Check title requirements
  if (limits.requiresTitle && !row.title) {
    errors.push({
      row: rowNumber,
      column: 'title',
      error: `${row.platform} requires a title.`,
    });
  }

  // Check title length
  if (row.title && limits.maxTitle && row.title.length > limits.maxTitle) {
    errors.push({
      row: rowNumber,
      column: 'title',
      error: `Title exceeds ${row.platform} limit (${limits.maxTitle}). Got ${row.title.length} characters.`,
    });
  }

  // Check Pinterest board
  if (row.platform === 'pinterest' && !row.board) {
    errors.push({
      row: rowNumber,
      column: 'board',
      error: 'Pinterest requires a board name.',
    });
  }

  // Check scheduled date is in the future
  const scheduledDate = new Date(row.scheduled_date);
  const now = new Date();
  if (scheduledDate < now) {
    warnings.push(`Row ${rowNumber}: Scheduled date is in the past. Will be scheduled for immediate posting.`);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * CSV column headers
 */
export const CSV_HEADERS = [
  'platform',
  'scheduled_date',
  'content',
  'media_urls',
  'tags',
  'link',
  'title',
  'description',
  'board',
  'privacy',
] as const;

/**
 * Sample template data
 */
export const SAMPLE_TEMPLATE_DATA: Array<Record<string, string>> = [
  {
    platform: 'x',
    scheduled_date: '2025-01-15T10:00:00Z',
    content: 'Excited to announce our new product launch! 🚀',
    media_urls: 'https://example.com/image1.jpg',
    tags: '#launch, #product',
    link: 'https://example.com/product',
    title: '',
    description: '',
    board: '',
    privacy: '',
  },
  {
    platform: 'linkedin',
    scheduled_date: '2025-01-15T14:00:00Z',
    content: "We're thrilled to share some exciting news about our company journey...",
    media_urls: '',
    tags: '#announcement, #business',
    link: 'https://example.com/news',
    title: 'Big Announcement',
    description: 'Learn more about our latest updates',
    board: '',
    privacy: '',
  },
  {
    platform: 'instagram',
    scheduled_date: '2025-01-16T09:00:00Z',
    content: 'Behind the scenes of our latest photoshoot 📸',
    media_urls: 'https://example.com/photo1.jpg, https://example.com/photo2.jpg',
    tags: '#bts, #photography',
    link: '',
    title: '',
    description: '',
    board: '',
    privacy: '',
  },
  {
    platform: 'youtube',
    scheduled_date: '2025-01-17T12:00:00Z',
    content: '',
    media_urls: 'https://example.com/video.mp4',
    tags: '',
    link: '',
    title: 'How to Build Amazing Products',
    description: 'In this video we walk through the process of building great products...',
    board: '',
    privacy: 'public',
  },
  {
    platform: 'pinterest',
    scheduled_date: '2025-01-18T15:00:00Z',
    content: 'Beautiful home office setup inspiration',
    media_urls: 'https://example.com/office.jpg',
    tags: '#homeoffice, #workspace',
    link: 'https://example.com/article',
    title: 'Home Office Ideas',
    description: 'Get inspired by these amazing home office setups',
    board: 'Home Decor',
    privacy: '',
  },
];
