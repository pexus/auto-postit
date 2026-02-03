import { parse } from 'csv-parse/sync';
import ExcelJS from 'exceljs';
import { v4 as uuidv4 } from 'uuid';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { mediaService } from '@/services/media.service';
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
 * Resolved media reference
 */
interface ResolvedMedia {
  type: 'local' | 'url';
  url: string;
  absolutePath?: string;
}

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
    }) as Record<string, string>[];
    return records;
  }

  /**
   * Parse Excel file
   */
  async parseExcel(buffer: Buffer): Promise<Record<string, string>[]> {
    const workbook = new ExcelJS.Workbook();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await workbook.xlsx.load(buffer as any);
    
    const worksheet = workbook.getWorksheet('Posts') ?? workbook.worksheets[0];
    if (!worksheet) {
      return [];
    }
    
    const headerRow = worksheet.getRow(1);
    const headers: string[] = [];
    headerRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      headers[colNumber - 1] = cell.text.toLowerCase().trim();
    });
    
    if (headers.length === 0) {
      return [];
    }
    
    const records: Record<string, string>[] = [];
    for (let rowIndex = 2; rowIndex <= worksheet.rowCount; rowIndex += 1) {
      const row = worksheet.getRow(rowIndex);
      const record: Record<string, string> = {};
      let hasData = false;
      
      headers.forEach((header, index) => {
        if (!header) return;
        const cellText = row.getCell(index + 1).text ?? '';
        if (cellText.trim()) {
          hasData = true;
        }
        record[header] = cellText;
      });
      
      if (hasData) {
        records.push(record);
      }
    }
    
    return records;
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

          logger.info({
            postId: post.id,
            userId,
            platform: row.data.platform,
            scheduledAt: post.scheduledAt,
            importMetadata,
          }, 'Imported post from spreadsheet');
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

    logger.info({
      userId,
      filename: file.originalname,
      mimetype: file.mimetype,
      dryRun,
    }, 'Processing spreadsheet import');

    // Parse the file based on type
    let rows: Record<string, string>[];
    
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      rows = this.parseCSV(file.buffer.toString('utf-8'));
    } else if (
      file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      file.originalname.endsWith('.xlsx')
    ) {
      rows = await this.parseExcel(file.buffer);
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
  async generateExcelTemplate(): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Posts');
    
    const columnWidths: Record<string, number> = {
      platform: 12,
      scheduled_date: 24,
      content: 50,
      media_urls: 40,
      tags: 25,
      link: 30,
      title: 30,
      description: 40,
      board: 15,
      privacy: 10,
    };
    
    worksheet.columns = CSV_HEADERS.map((header) => ({
      header,
      key: header,
      width: columnWidths[header] ?? 20,
    }));
    
    SAMPLE_TEMPLATE_DATA.forEach((row) => {
      worksheet.addRow(row);
    });
    
    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer as ArrayBuffer);
  }

  /**
   * Resolve media URLs, handling both remote URLs and local: paths
   */
  async resolveMediaUrls(urls: string[]): Promise<{
    resolved: ResolvedMedia[];
    errors: string[];
  }> {
    const resolved: ResolvedMedia[] = [];
    const errors: string[] = [];

    for (const url of urls) {
      if (mediaService.isLocalPath(url)) {
        const fileInfo = await mediaService.resolveMediaReference(url);
        if (fileInfo) {
          resolved.push({
            type: 'local',
            url: fileInfo.url,
            absolutePath: fileInfo.absolutePath,
          });
        } else {
          errors.push(`Local file not found: ${url}`);
        }
      } else {
        // It's a URL, pass through as-is
        resolved.push({
          type: 'url',
          url,
        });
      }
    }

    return { resolved, errors };
  }

  /**
   * Validate local media paths in rows before import
   */
  async validateMediaPaths(
    rows: ValidatedRow[]
  ): Promise<{ row: number; errors: string[] }[]> {
    const mediaErrors: { row: number; errors: string[] }[] = [];

    for (const row of rows) {
      if (row.data.media_urls && row.data.media_urls.length > 0) {
        const { errors } = await this.resolveMediaUrls(row.data.media_urls);
        if (errors.length > 0) {
          mediaErrors.push({
            row: row.rowNumber,
            errors,
          });
        }
      }
    }

    return mediaErrors;
  }
}

export const importService = new ImportServiceClass();
