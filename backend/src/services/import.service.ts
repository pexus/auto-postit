import { parse } from 'csv-parse/sync';
import * as XLSX from 'xlsx';
import { v4 as uuidv4 } from 'uuid';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import {
  importRowSchema,
  validateRowForPlatform,
  ImportRow,
  ImportResult,
  ImportError,
  ValidatedRow,
  CSV_HEADERS,
  SAMPLE_TEMPLATE_DATA,
  SupportedPlatform,
} from '@/schemas/import.schema';

/**
 * Import Service - handles parsing and importing spreadsheet data
 */
class ImportServiceClass {
  /**
   * Parse CSV file content
   */
  parseCSV(content: string): Record<string, string>[] {
    const records = parse(content, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true,
    });
    return records;
  }

  /**
   * Parse Excel file
   */
  parseExcel(buffer: Buffer): Record<string, string>[] {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    
    // Get the first sheet (or "Posts" sheet if it exists)
    const sheetName = workbook.SheetNames.includes('Posts')
      ? 'Posts'
      : workbook.SheetNames[0];
    
    const worksheet = workbook.Sheets[sheetName];
    const records = XLSX.utils.sheet_to_json<Record<string, string>>(worksheet, {
      defval: '',
    });
    
    // Normalize column names to lowercase
    return records.map((row) => {
      const normalizedRow: Record<string, string> = {};
      for (const key of Object.keys(row)) {
        normalizedRow[key.toLowerCase().trim()] = String(row[key]);
      }
      return normalizedRow;
    });
  }

  /**
   * Validate and transform raw rows
   */
  validateRows(
    rows: Record<string, string>[],
    isPremium = false
  ): {
    validRows: ValidatedRow[];
    errors: ImportError[];
    warnings: string[];
  } {
    const validRows: ValidatedRow[] = [];
    const errors: ImportError[] = [];
    const warnings: string[] = [];

    for (let i = 0; i < rows.length; i++) {
      const rowNumber = i + 2; // +2 because row 1 is headers, and we're 1-indexed
      const rawRow = rows[i];

      try {
        // Parse with Zod
        const parsed = importRowSchema.safeParse(rawRow);
        
        if (!parsed.success) {
          // Collect all Zod errors for this row
          for (const error of parsed.error.errors) {
            errors.push({
              row: rowNumber,
              column: error.path.join('.'),
              error: error.message,
            });
          }
          continue;
        }

        // Validate against platform limits
        const validation = validateRowForPlatform(parsed.data, rowNumber, isPremium);
        
        if (!validation.valid) {
          errors.push(...validation.errors);
          continue;
        }

        warnings.push(...validation.warnings);

        validRows.push({
          rowNumber,
          data: parsed.data,
          warnings: validation.warnings,
        });
      } catch (err) {
        errors.push({
          row: rowNumber,
          error: `Unexpected error parsing row: ${err instanceof Error ? err.message : 'Unknown error'}`,
        });
      }
    }

    return { validRows, errors, warnings };
  }

  /**
   * Import posts from validated rows
   */
  async importPosts(
    userId: string,
    validRows: ValidatedRow[],
    dryRun = false
  ): Promise<ImportResult> {
    const posts: ImportResult['posts'] = [];
    const errors: ImportError[] = [];

    for (const row of validRows) {
      try {
        // Adjust scheduled date if in the past
        let scheduledDate = new Date(row.data.scheduled_date);
        const now = new Date();
        if (scheduledDate < now) {
          scheduledDate = new Date(now.getTime() + 60000); // 1 minute from now
        }

        if (dryRun) {
          // In dry run mode, just return what would be created
          posts.push({
            id: `dry-run-${uuidv4()}`,
            platform: row.data.platform,
            scheduled_date: scheduledDate.toISOString(),
            status: 'scheduled',
          });
        } else {
          // Build content with additional metadata
          let fullContent = row.data.content || '';
          
          // Add link if provided
          if (row.data.link) {
            fullContent = fullContent ? `${fullContent}\n\n${row.data.link}` : row.data.link;
          }
          
          // Add tags as hashtags
          if (row.data.tags && row.data.tags.length > 0) {
            const hashTags = row.data.tags.map(t => `#${t}`).join(' ');
            fullContent = fullContent ? `${fullContent}\n\n${hashTags}` : hashTags;
          }

          // Create the post in the database
          // Note: This creates a draft post. A separate process will link it to platforms.
          const post = await prisma.post.create({
            data: {
              id: uuidv4(),
              userId,
              content: fullContent,
              status: 'SCHEDULED',
              scheduledAt: scheduledDate,
            },
          });

          // Store import metadata in a separate structure (could be extended later)
          // For now, we log the additional info
          const importMetadata = {
            originalPlatform: row.data.platform,
            mediaUrls: row.data.media_urls,
            title: row.data.title,
            description: row.data.description,
            platformConfig: this.buildPlatformConfig(row.data),
          };

          posts.push({
            id: post.id,
            platform: row.data.platform as SupportedPlatform,
            scheduled_date: post.scheduledAt!.toISOString(),
            status: 'scheduled',
          });

          logger.info('Imported post from spreadsheet', {
            postId: post.id,
            userId,
            platform: row.data.platform,
            scheduledAt: post.scheduledAt,
            importMetadata,
          });
        }
      } catch (err) {
        errors.push({
          row: row.rowNumber,
          error: `Failed to create post: ${err instanceof Error ? err.message : 'Unknown error'}`,
        });
      }
    }

    return {
      success: errors.length === 0,
      summary: {
        total_rows: validRows.length,
        imported: posts.length,
        skipped: validRows.length - posts.length,
        errors,
        warnings: validRows.flatMap((r) => r.warnings),
      },
      posts,
    };
  }

  /**
   * Build platform-specific configuration
   */
  private buildPlatformConfig(row: ImportRow): Record<string, unknown> {
    const config: Record<string, unknown> = {};

    switch (row.platform) {
      case 'youtube':
        config.privacy = row.privacy || 'public';
        break;
      case 'pinterest':
        config.board = row.board;
        break;
    }

    return config;
  }

  /**
   * Process a spreadsheet file (CSV or Excel)
   */
  async processFile(
    userId: string,
    file: { buffer: Buffer; mimetype: string; originalname: string },
    options: { dryRun?: boolean; isPremium?: boolean } = {}
  ): Promise<ImportResult> {
    const { dryRun = false, isPremium = false } = options;

    logger.info('Processing spreadsheet import', {
      userId,
      filename: file.originalname,
      mimetype: file.mimetype,
      dryRun,
    });

    // Parse the file based on type
    let rows: Record<string, string>[];
    
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      rows = this.parseCSV(file.buffer.toString('utf-8'));
    } else if (
      file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      file.originalname.endsWith('.xlsx')
    ) {
      rows = this.parseExcel(file.buffer);
    } else {
      return {
        success: false,
        summary: {
          total_rows: 0,
          imported: 0,
          skipped: 0,
          errors: [
            {
              row: 0,
              error: `Unsupported file type: ${file.mimetype}. Use CSV or XLSX.`,
            },
          ],
          warnings: [],
        },
        posts: [],
      };
    }

    if (rows.length === 0) {
      return {
        success: false,
        summary: {
          total_rows: 0,
          imported: 0,
          skipped: 0,
          errors: [{ row: 0, error: 'No data rows found in file.' }],
          warnings: [],
        },
        posts: [],
      };
    }

    // Validate rows
    const { validRows, errors, warnings } = this.validateRows(rows, isPremium);

    if (validRows.length === 0) {
      return {
        success: false,
        summary: {
          total_rows: rows.length,
          imported: 0,
          skipped: rows.length,
          errors,
          warnings,
        },
        posts: [],
      };
    }

    // Import the valid rows
    const result = await this.importPosts(userId, validRows, dryRun);

    // Merge validation errors
    result.summary.errors = [...errors, ...result.summary.errors];
    result.summary.warnings = [...warnings, ...result.summary.warnings];
    result.summary.total_rows = rows.length;
    result.summary.skipped = rows.length - result.summary.imported;
    result.success = result.summary.errors.length === 0;

    return result;
  }

  /**
   * Generate CSV template
   */
  generateCSVTemplate(): string {
    const headers = CSV_HEADERS.join(',');
    const rows = SAMPLE_TEMPLATE_DATA.map((row) =>
      CSV_HEADERS.map((col) => {
        const value = row[col] || '';
        // Escape quotes and wrap in quotes if contains comma or quote
        if (value.includes(',') || value.includes('"') || value.includes('\n')) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      }).join(',')
    );
    return [headers, ...rows].join('\n');
  }

  /**
   * Generate Excel template
   */
  generateExcelTemplate(): Buffer {
    const workbook = XLSX.utils.book_new();
    
    // Create worksheet from sample data
    const worksheet = XLSX.utils.json_to_sheet(SAMPLE_TEMPLATE_DATA, {
      header: [...CSV_HEADERS],
    });

    // Set column widths
    worksheet['!cols'] = [
      { wch: 12 }, // platform
      { wch: 24 }, // scheduled_date
      { wch: 50 }, // content
      { wch: 40 }, // media_urls
      { wch: 25 }, // tags
      { wch: 30 }, // link
      { wch: 30 }, // title
      { wch: 40 }, // description
      { wch: 15 }, // board
      { wch: 10 }, // privacy
    ];

    XLSX.utils.book_append_sheet(workbook, worksheet, 'Posts');
    
    return Buffer.from(XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }));
  }
}

export const importService = new ImportServiceClass();
