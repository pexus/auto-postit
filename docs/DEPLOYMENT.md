# Auto-PostIt Deployment (VPS + GHCR Images)

This guide shows how to deploy Auto-PostIt on a VPS using prebuilt Docker images from GitHub Container Registry (GHCR).

## Prerequisites
- Docker + Docker Compose installed on your VPS
- A domain name (recommended)
- HTTPS termination (recommended)

## 1) Pull Images from GHCR
Images are published by GitHub Actions to:
- ghcr.io/pexus/auto-postit-backend
- ghcr.io/pexus/auto-postit-frontend
- ghcr.io/pexus/auto-postit-worker

You can pull the latest tag or a specific version:
- `v0.3.3`, `sha-<commit>`, or `main`

## 2) Create a production env file (outside the repo)
Copy the example to a host-owned path and lock it down:
```
sudo mkdir -p /etc/auto-postit
sudo cp env.example /etc/auto-postit/auto-postit.env
sudo chmod 600 /etc/auto-postit/auto-postit.env
sudo chown root:root /etc/auto-postit/auto-postit.env
```
If you run Docker rootless, set the owner to that user instead of root.

Set at minimum:
```
POSTGRES_PASSWORD=your_db_password
REDIS_PASSWORD=your_redis_password
SESSION_SECRET=your_session_secret
COOKIE_SECRET=your_cookie_secret
TOKEN_ENCRYPTION_KEY=your_32_byte_key
CSRF_SECRET=your_csrf_secret
CORS_ORIGIN=https://your-domain.com
MEDIA_BASE_URL=https://your-domain.com/media
TWITTER_CLIENT_ID=...
TWITTER_CLIENT_SECRET=...
TWITTER_CALLBACK_URL=https://your-domain.com/public/oauth/twitter/callback
LINKEDIN_CLIENT_ID=...
LINKEDIN_CLIENT_SECRET=...
LINKEDIN_CALLBACK_URL=https://your-domain.com/public/oauth/linkedin/callback
FACEBOOK_APP_ID=...
FACEBOOK_APP_SECRET=...
FACEBOOK_CALLBACK_URL=https://your-domain.com/public/oauth/facebook/callback
INSTAGRAM_CALLBACK_URL=https://your-domain.com/public/oauth/instagram/callback
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_CALLBACK_URL=https://your-domain.com/public/oauth/google/callback
PINTEREST_APP_ID=...
PINTEREST_APP_SECRET=...
PINTEREST_CALLBACK_URL=https://your-domain.com/public/oauth/pinterest/callback
OPENAI_API_KEY=...
```

## 3) Use the image-based compose file
Create `docker-compose.ghcr.yml` on your VPS:
```
services:
  postgres:
    image: postgres:16-alpine
    container_name: autopostit-postgres
    restart: unless-stopped
    env_file:
      - /etc/auto-postit/auto-postit.env
    environment:
      POSTGRES_USER: ${POSTGRES_USER:-autopostit}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB:-autopostit}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U autopostit -d autopostit"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - backend

  redis:
    image: redis:7-alpine
    container_name: autopostit-redis
    restart: unless-stopped
    env_file:
      - /etc/auto-postit/auto-postit.env
    command: redis-server --appendonly yes --requirepass ${REDIS_PASSWORD}
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "-a", "${REDIS_PASSWORD}", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - backend

  backend:
    image: ghcr.io/pexus/auto-postit-backend:v0.3.3
    container_name: autopostit-backend
    restart: unless-stopped
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    env_file:
      - /etc/auto-postit/auto-postit.env
    environment:
      NODE_ENV: production
      DATABASE_URL: postgresql://${POSTGRES_USER:-autopostit}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB:-autopostit}
      REDIS_URL: redis://:${REDIS_PASSWORD}@redis:6379
      SESSION_SECRET: ${SESSION_SECRET}
      COOKIE_SECRET: ${COOKIE_SECRET}
      TOKEN_ENCRYPTION_KEY: ${TOKEN_ENCRYPTION_KEY}
      CSRF_SECRET: ${CSRF_SECRET}
      CORS_ORIGIN: ${CORS_ORIGIN}
      MEDIA_PATH: /app/media
      MEDIA_UPLOADS_PATH: /app/uploads
      MEDIA_MAX_IMAGE_SIZE: ${MEDIA_MAX_IMAGE_SIZE:-10485760}
      MEDIA_MAX_VIDEO_SIZE: ${MEDIA_MAX_VIDEO_SIZE:-524288000}
      MEDIA_BASE_URL: ${MEDIA_BASE_URL:-}
      TWITTER_CLIENT_ID: ${TWITTER_CLIENT_ID}
      TWITTER_CLIENT_SECRET: ${TWITTER_CLIENT_SECRET}
      TWITTER_CALLBACK_URL: ${TWITTER_CALLBACK_URL}
      TWITTER_MEDIA_UPLOAD_ENABLED: ${TWITTER_MEDIA_UPLOAD_ENABLED:-false}
      LINKEDIN_CLIENT_ID: ${LINKEDIN_CLIENT_ID}
      LINKEDIN_CLIENT_SECRET: ${LINKEDIN_CLIENT_SECRET}
      LINKEDIN_CALLBACK_URL: ${LINKEDIN_CALLBACK_URL}
      FACEBOOK_APP_ID: ${FACEBOOK_APP_ID}
      FACEBOOK_APP_SECRET: ${FACEBOOK_APP_SECRET}
      FACEBOOK_CALLBACK_URL: ${FACEBOOK_CALLBACK_URL}
      INSTAGRAM_CALLBACK_URL: ${INSTAGRAM_CALLBACK_URL}
      GOOGLE_CLIENT_ID: ${GOOGLE_CLIENT_ID}
      GOOGLE_CLIENT_SECRET: ${GOOGLE_CLIENT_SECRET}
      GOOGLE_CALLBACK_URL: ${GOOGLE_CALLBACK_URL}
      PINTEREST_APP_ID: ${PINTEREST_APP_ID}
      PINTEREST_APP_SECRET: ${PINTEREST_APP_SECRET}
      PINTEREST_CALLBACK_URL: ${PINTEREST_CALLBACK_URL}
      OPENAI_API_KEY: ${OPENAI_API_KEY:-}
      OPENAI_DEFAULT_MODEL: ${OPENAI_DEFAULT_MODEL:-gpt-4o-mini}
      OPENAI_AVAILABLE_MODELS: ${OPENAI_AVAILABLE_MODELS:-gpt-4o,gpt-4o-mini,gpt-3.5-turbo}
    volumes:
      - uploads:/app/uploads
      - ${MEDIA_HOST_PATH:-./media}:/app/media:ro
    expose:
      - "3001"
    networks:
      - frontend
      - backend

  frontend:
    image: ghcr.io/pexus/auto-postit-frontend:v0.3.3
    container_name: autopostit-frontend
    restart: unless-stopped
    depends_on:
      - backend
    ports:
      - "8080:80"
    networks:
      - frontend

  worker:
    image: ghcr.io/pexus/auto-postit-worker:v0.3.3
    container_name: autopostit-worker
    restart: unless-stopped
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    env_file:
      - /etc/auto-postit/auto-postit.env
    environment:
      NODE_ENV: production
      DATABASE_URL: postgresql://${POSTGRES_USER:-autopostit}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB:-autopostit}
      REDIS_URL: redis://:${REDIS_PASSWORD}@redis:6379
      SESSION_SECRET: ${SESSION_SECRET}
      COOKIE_SECRET: ${COOKIE_SECRET}
      TOKEN_ENCRYPTION_KEY: ${TOKEN_ENCRYPTION_KEY}
      CSRF_SECRET: ${CSRF_SECRET}
      CORS_ORIGIN: ${CORS_ORIGIN}
      TWITTER_CLIENT_ID: ${TWITTER_CLIENT_ID}
      TWITTER_CLIENT_SECRET: ${TWITTER_CLIENT_SECRET}
      TWITTER_CALLBACK_URL: ${TWITTER_CALLBACK_URL}
      LINKEDIN_CLIENT_ID: ${LINKEDIN_CLIENT_ID}
      LINKEDIN_CLIENT_SECRET: ${LINKEDIN_CLIENT_SECRET}
      LINKEDIN_CALLBACK_URL: ${LINKEDIN_CALLBACK_URL}
      FACEBOOK_APP_ID: ${FACEBOOK_APP_ID}
      FACEBOOK_APP_SECRET: ${FACEBOOK_APP_SECRET}
      FACEBOOK_CALLBACK_URL: ${FACEBOOK_CALLBACK_URL}
      INSTAGRAM_CALLBACK_URL: ${INSTAGRAM_CALLBACK_URL}
      GOOGLE_CLIENT_ID: ${GOOGLE_CLIENT_ID}
      GOOGLE_CLIENT_SECRET: ${GOOGLE_CLIENT_SECRET}
      GOOGLE_CALLBACK_URL: ${GOOGLE_CALLBACK_URL}
      PINTEREST_APP_ID: ${PINTEREST_APP_ID}
      PINTEREST_APP_SECRET: ${PINTEREST_APP_SECRET}
      PINTEREST_CALLBACK_URL: ${PINTEREST_CALLBACK_URL}
      OPENAI_API_KEY: ${OPENAI_API_KEY:-}
      OPENAI_DEFAULT_MODEL: ${OPENAI_DEFAULT_MODEL:-gpt-4o-mini}
      OPENAI_AVAILABLE_MODELS: ${OPENAI_AVAILABLE_MODELS:-gpt-4o,gpt-4o-mini,gpt-3.5-turbo}
    volumes:
      - uploads:/app/uploads
      - ${MEDIA_HOST_PATH:-./media}:/app/media:ro
    networks:
      - frontend
      - backend

volumes:
  postgres_data:
  redis_data:
  uploads:

networks:
  frontend:
    driver: bridge
  backend:
    internal: true
    driver: bridge
```

Run compose using the external env file for interpolation:
```
docker compose --env-file /etc/auto-postit/auto-postit.env -f docker-compose.ghcr.yml up -d
```

## 4) Start the stack
```
docker compose -f docker-compose.ghcr.yml --env-file /etc/auto-postit/auto-postit.env up -d
```

## 5) Upgrades
To upgrade to a new version, update the image tags and re-run:
```
docker compose -f docker-compose.ghcr.yml --env-file /etc/auto-postit/auto-postit.env pull

docker compose -f docker-compose.ghcr.yml --env-file /etc/auto-postit/auto-postit.env up -d
```

## Notes
- The `backend` network is internal-only; the `worker` is also attached to `frontend` so it can reach external APIs.
- Use HTTPS for OAuth callbacks (Facebook and Instagram require HTTPS).
- Add a reverse proxy (Nginx/Caddy) in front of the frontend for HTTPS and a clean domain.

## Helper Scripts
Local development (Postgres + Redis only):
```
cp env.example .env
scripts/docker-dev-up.sh
scripts/docker-dev-down.sh
```

Production (build locally):
```
ENV_FILE=/etc/auto-postit/auto-postit.env scripts/docker-build.sh
ENV_FILE=/etc/auto-postit/auto-postit.env scripts/docker-up.sh
ENV_FILE=/etc/auto-postit/auto-postit.env scripts/docker-down.sh
```
