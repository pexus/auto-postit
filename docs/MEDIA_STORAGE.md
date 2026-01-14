# Media Storage

Auto-PostIt supports a local media folder for storing images and videos that can be used in posts.

## Overview

The media folder is mounted as a Docker volume, allowing you to:
- Upload media files directly to the folder (via file manager, FTP, etc.)
- Organize files in subfolders (by date, campaign, platform, etc.)
- Reference files in the spreadsheet import using local paths
- Browse and select files from the web UI when creating posts

## Folder Structure

```
/path/to/media/                    # Root media folder (configurable)
├── images/                        # General images
│   ├── logos/
│   ├── products/
│   └── social/
├── videos/                        # Video files
│   ├── tutorials/
│   └── promos/
├── 2025/                          # Date-based organization
│   ├── 01-january/
│   └── 02-february/
└── campaigns/                     # Campaign-based organization
    ├── spring-sale/
    └── product-launch/
```

You can create any folder structure that works for your workflow.

## Supported Formats

### Images
| Format | Extension | Max Size | Notes |
|--------|-----------|----------|-------|
| JPEG | `.jpg`, `.jpeg` | 10 MB | Most compatible |
| PNG | `.png` | 10 MB | Supports transparency |
| GIF | `.gif` | 10 MB | Animated supported |
| WebP | `.webp` | 10 MB | Modern format |

### Videos
| Format | Extension | Max Size | Notes |
|--------|-----------|----------|-------|
| MP4 | `.mp4` | 500 MB | H.264 codec recommended |
| MOV | `.mov` | 500 MB | QuickTime format |
| WebM | `.webm` | 500 MB | Web-optimized |

## Configuration

### Environment Variables

```env
# Path to media folder (outside container)
MEDIA_PATH=/path/to/your/media

# Maximum file sizes (in bytes)
MEDIA_MAX_IMAGE_SIZE=10485760      # 10 MB
MEDIA_MAX_VIDEO_SIZE=524288000     # 500 MB

# Base URL for serving media (optional, for CDN)
MEDIA_BASE_URL=                    # Leave empty for local serving
```

### Docker Compose

```yaml
services:
  backend:
    volumes:
      - ${MEDIA_PATH:-./media}:/app/media:ro  # Read-only in container
      - ./media-uploads:/app/uploads          # For web uploads
```

## Usage

### 1. Direct File Upload

Simply copy files to your media folder:

```bash
# Copy a single file
cp image.jpg /path/to/media/images/

# Copy a folder
cp -r campaign-photos/ /path/to/media/campaigns/spring/
```

### 2. Web UI Upload

1. Go to **Posts** → **Create Post** or **Import**
2. Click **Browse Media** or the media picker
3. Upload files directly through the browser
4. Files are saved to the `uploads/` subfolder

### 3. Spreadsheet Import

Reference local files in your import spreadsheet:

```csv
platform,scheduled_date,content,media_urls
x,2025-01-15T10:00:00Z,"Check this out!",local:images/product.jpg
linkedin,2025-01-15T14:00:00Z,"New post",local:campaigns/launch/hero.png
instagram,2025-01-16T09:00:00Z,"Gallery","local:2025/photos/1.jpg, local:2025/photos/2.jpg"
```

**Path formats:**
- `local:path/to/file.jpg` - Relative to media root
- `https://example.com/image.jpg` - External URL (still supported)

### 4. API Access

```bash
# List folder contents
GET /api/media/browse?path=images

# Get file info
GET /api/media/info?path=images/logo.png

# Serve file
GET /api/media/file/images/logo.png

# Upload file
POST /api/media/upload
Content-Type: multipart/form-data
file: <file>
folder: images/products  # optional subfolder
```

## Security Considerations

1. **Read-only mount**: The main media folder is mounted read-only in the container to prevent accidental deletion
2. **Path traversal protection**: API prevents `../` path traversal attacks
3. **File type validation**: Only allowed extensions are served
4. **Size limits**: Configurable limits prevent disk exhaustion

## Platform-Specific Notes

### X (Twitter)
- Images: Max 5 MB, recommended 1200x675px
- Videos: Max 512 MB, 2:20 duration, MP4/MOV

### LinkedIn
- Images: Max 8 MB, recommended 1200x627px
- Videos: Max 200 MB, 10 min duration

### Instagram
- Images: Max 8 MB, 1080x1080px (square) or 1080x1350px (portrait)
- Videos: Max 100 MB, 60 sec (feed), 15 sec (stories)

### Facebook
- Images: Max 4 MB, recommended 1200x630px
- Videos: Max 4 GB, 240 min duration

### YouTube
- Videos: Varies by account, typically 128 GB or 12 hours

### Pinterest
- Images: Max 20 MB, recommended 1000x1500px (2:3 ratio)
- Videos: Max 2 GB, 4 sec - 15 min duration

## Troubleshooting

### Files not showing up
1. Check file permissions: `chmod 644 /path/to/media/*`
2. Verify the path in `.env` matches the actual location
3. Ensure Docker volume is mounted correctly

### Upload fails
1. Check available disk space
2. Verify file size is within limits
3. Ensure upload folder has write permissions

### Slow performance
1. Consider using a CDN for large media libraries
2. Optimize images before uploading
3. Use WebP format for smaller file sizes
