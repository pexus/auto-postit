# Spreadsheet Import Format

Auto-PostIt supports importing posts from CSV and Excel (.xlsx) files for bulk scheduling.

## Supported File Formats

- **CSV** (.csv) - Comma-separated values
- **Excel** (.xlsx) - Microsoft Excel format

## Column Definitions

| Column | Required | Description | Format/Values |
|--------|----------|-------------|---------------|
| `platform` | ✅ Yes | Target social media platform | `x`, `linkedin`, `facebook`, `instagram`, `youtube`, `pinterest` |
| `scheduled_date` | ✅ Yes | When to publish | ISO 8601: `2025-01-15T10:00:00Z` or `2025-01-15 10:00` |
| `content` | ✅ Yes | Post text content | Plain text, max varies by platform |
| `media_urls` | No | Media attachments (images/videos) | Comma-separated URLs |
| `tags` | No | Hashtags or labels | Comma-separated: `#tech, #ai, #news` |
| `link` | No | Link to include in post | Full URL |
| `title` | No | Title (YouTube/Pinterest) | Plain text |
| `description` | No | Description (YouTube/Pinterest) | Plain text |
| `board` | No | Pinterest board name | Board name or ID |
| `privacy` | No | Video privacy (YouTube) | `public`, `unlisted`, `private` |

## Platform-Specific Requirements

### X (Twitter)
- Content max: 280 characters (4000 with Premium)
- Media: Up to 4 images OR 1 video
- Supported media: JPG, PNG, GIF, MP4

### LinkedIn
- Content max: 3000 characters
- Media: Up to 9 images OR 1 video
- Supports articles with title/description

### Facebook (Pages)
- Content max: 63,206 characters
- Media: Multiple images or 1 video
- Links auto-expand with preview

### Instagram
- Content max: 2200 characters
- Media: Required (1-10 images OR 1 video)
- First 125 chars shown in feed

### YouTube
- Requires: Title, Description, Video URL
- Title max: 100 characters
- Description max: 5000 characters
- Privacy: public, unlisted, private

### Pinterest
- Requires: Title, Image URL, Board
- Title max: 100 characters
- Description max: 500 characters

## Sample CSV

```csv
platform,scheduled_date,content,media_urls,tags,link,title,description,board,privacy
x,2025-01-15T10:00:00Z,"Excited to announce our new product launch! 🚀",https://example.com/image1.jpg,"#launch, #product",https://example.com/product,,,
linkedin,2025-01-15T14:00:00Z,"We're thrilled to share some exciting news about our company...",,"#announcement, #business",https://example.com/news,Big Announcement,Learn more about our latest updates,,
instagram,2025-01-16T09:00:00Z,"Behind the scenes of our latest photoshoot 📸","https://example.com/photo1.jpg, https://example.com/photo2.jpg","#bts, #photography",,,,
youtube,2025-01-17T12:00:00Z,,https://example.com/video.mp4,,"https://youtu.be/watch",How to Build Amazing Products,In this video we walk through the process of building great products...,,public
pinterest,2025-01-18T15:00:00Z,"Beautiful home office setup inspiration",https://example.com/office.jpg,"#homeoffice, #workspace",https://example.com/article,Home Office Ideas,Get inspired by these amazing home office setups,Home Decor,
```

## Sample Excel Format

The Excel file should have a single sheet named "Posts" with the same column headers as the CSV format.

| platform | scheduled_date | content | media_urls | tags | link | title | description | board | privacy |
|----------|----------------|---------|------------|------|------|-------|-------------|-------|---------|
| x | 2025-01-15T10:00:00Z | Exciting news! 🎉 | | #news | | | | | |
| linkedin | 2025-01-15T14:00:00Z | Professional update... | image.jpg | #business | | | | | |

## Import Rules

1. **Date Handling**
   - All dates are interpreted as UTC if no timezone specified
   - Past dates will be scheduled for "now" (immediate posting)
   - Dates must be in the future for scheduled posts

2. **Media URLs**
   - Must be publicly accessible URLs
   - Multiple URLs separated by commas
   - Auto-downloaded and validated before scheduling

3. **Content Validation**
   - Content is validated against platform limits
   - Overly long content will cause import to fail for that row
   - Empty content is allowed for platforms that don't require it

4. **Duplicate Handling**
   - Duplicate rows (same platform + date + content) are skipped
   - Import is idempotent - safe to re-run

5. **Error Handling**
   - Invalid rows are skipped with error messages
   - Valid rows are still imported
   - Detailed error report provided after import

## API Endpoint

```
POST /api/import/spreadsheet
Content-Type: multipart/form-data

file: <spreadsheet file>
dry_run: true|false (optional, default: false)
```

### Response

```json
{
  "success": true,
  "summary": {
    "total_rows": 10,
    "imported": 8,
    "skipped": 2,
    "errors": [
      {
        "row": 3,
        "error": "Content exceeds X character limit (280)"
      },
      {
        "row": 7,
        "error": "Invalid platform: tiktok"
      }
    ]
  },
  "posts": [
    {
      "id": "uuid",
      "platform": "x",
      "scheduled_date": "2025-01-15T10:00:00Z",
      "status": "scheduled"
    }
  ]
}
```

## Download Template

A sample template is available at:
- CSV: `/api/import/template.csv`
- Excel: `/api/import/template.xlsx`
