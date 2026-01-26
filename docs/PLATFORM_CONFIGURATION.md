# Auto-PostIt Platform Configuration Guide

This guide explains how to configure each social media platform for Auto-PostIt.

## Table of Contents

1. [Twitter/X](#twitterx)
2. [LinkedIn](#linkedin)
3. [Facebook](#facebook)
4. [Instagram](#instagram)
5. [Pinterest](#pinterest)
6. [YouTube](#youtube)

---

## Twitter/X

### Requirements
- Twitter Developer Account (Free tier)
- OAuth 2.0 App with User Authentication

### Setup Steps

1. **Create a Twitter Developer Account**
   - Go to https://developer.twitter.com/
   - Sign in with your Twitter account
   - Apply for developer access (usually instant for free tier)

2. **Create a Project and App**
   - Go to Developer Portal → Projects & Apps
   - Create a new Project
   - Create a new App within the project

3. **Configure OAuth 2.0**
   - In your App settings, go to "User authentication settings"
   - Click "Set up"
   - Select:
     - **App permissions**: Read and Write
     - **Type of App**: Web App
     - **Callback URI**: `https://your-domain.com/public/oauth/twitter/callback`
     - **Website URL**: Your app's website

4. **Get Credentials**
   - Go to "Keys and Tokens"
   - Copy the **OAuth 2.0 Client ID** and **Client Secret**

5. **Configure Environment Variables**
   ```env
   TWITTER_CLIENT_ID=your_client_id
   TWITTER_CLIENT_SECRET=your_client_secret
   TWITTER_CALLBACK_URL=https://your-domain.com/public/oauth/twitter/callback
   ```

### Notes
- Twitter Free tier allows ~1,500 tweets/month
- Media upload requires X API Pro tier ($5,000/month) - disabled by default
- Set `TWITTER_MEDIA_UPLOAD_ENABLED=true` only if you have Pro tier

---

## LinkedIn

### Requirements
- LinkedIn Developer Account
- LinkedIn Page Admin access (for posting to Pages)

### Setup Steps

1. **Create a LinkedIn App**
   - Go to https://www.linkedin.com/developers/
   - Click "Create app"
   - Fill in app details:
     - App name
     - LinkedIn Page (create one if needed)
     - App logo
     - Legal agreement

2. **Request Products**
   - Go to your app → Products tab
   - Request access to:
     - **Sign In with LinkedIn using OpenID Connect**
     - **Share on LinkedIn**
   - **Marketing Developer Platform** (required for posting to Company Pages)

3. **Configure OAuth 2.0**
   - Go to Auth tab
   - Add redirect URL: `https://your-domain.com/public/oauth/linkedin/callback`

4. **Get Credentials**
   - Copy **Client ID** and **Client Secret** from Auth tab

5. **Configure Environment Variables**
   ```env
   LINKEDIN_CLIENT_ID=your_client_id
   LINKEDIN_CLIENT_SECRET=your_client_secret
   LINKEDIN_CALLBACK_URL=https://your-domain.com/public/oauth/linkedin/callback
   ```

### Notes
- LinkedIn API has rate limits of ~100 calls/day for posting
- Posts are published to your personal profile by default
- For Company Pages, the app must be approved for **Marketing Developer Platform**
- The user must be an Admin of the LinkedIn Page to post

### Connecting Profile vs Page
Auto-PostIt shows **two LinkedIn cards**:
- **LinkedIn Profile** → requests profile-only scopes (works after *Share on LinkedIn*)
- **LinkedIn Page** → requests page scopes (requires **Marketing Developer Platform** approval)

---

## Facebook

### Requirements
- Facebook Developer Account
- Facebook Page (for posting)
- Facebook Business verification (for production apps)

### Setup Steps

1. **Create a Facebook App**
   - Go to https://developers.facebook.com/
   - Click "My Apps" → "Create App"
   - Choose "Business" app type
   - Fill in app details

2. **Add Products**
   - In your app dashboard, add:
     - **Facebook Login** (click "Set Up")
     - **Pages API** (if not auto-added)

3. **Configure Facebook Login**
   - Go to Facebook Login → Settings
   - Add redirect URI: `https://your-domain.com/public/oauth/facebook/callback`
   - Enable:
     - Client OAuth Login
     - Web OAuth Login

4. **Configure Permissions**
   - Go to App Review → Permissions and Features
   - Request:
     - `pages_show_list`
     - `pages_read_engagement`
     - `pages_manage_posts`

5. **Get Credentials**
   - Go to Settings → Basic
   - Copy **App ID** (Client ID) and **App Secret** (Client Secret)

6. **Configure Environment Variables**
   ```env
   FACEBOOK_APP_ID=your_app_id
   FACEBOOK_APP_SECRET=your_app_secret
   FACEBOOK_CALLBACK_URL=https://your-domain.com/public/oauth/facebook/callback
   ```

### Notes
- Development mode: Only app admins can use the app
- Production mode: Requires Business verification
- Posts go to connected Facebook Pages, not personal profiles

---

## Instagram

### Requirements
- Facebook Developer Account (same as above)
- Instagram Business or Creator Account
- Facebook Page connected to Instagram

### Setup Steps

1. **Connect Instagram to Facebook Page**
   - On Instagram app: Settings → Account → Linked Accounts → Facebook
   - Or: On Facebook Page Settings → Instagram

2. **Convert to Business/Creator Account**
   - On Instagram: Settings → Account → Switch to Professional Account
   - Choose Business or Creator

3. **Use Same Facebook App**
   - Instagram API uses Facebook's Graph API
   - Add permissions to your Facebook app:
     - `instagram_basic`
     - `instagram_content_publish`

4. **Configure Environment Variables**
   - Uses same credentials as Facebook:
   ```env
   FACEBOOK_APP_ID=your_app_id
   FACEBOOK_APP_SECRET=your_app_secret
   FACEBOOK_CALLBACK_URL=https://your-domain.com/public/oauth/facebook/callback
   INSTAGRAM_CALLBACK_URL=https://your-domain.com/public/oauth/instagram/callback
   ```

### Notes
- Instagram posts REQUIRE at least one image or video
- Text-only posts are not supported
- Reels can be posted as videos
- Carousel posts (multiple images) require additional API setup

---

## Pinterest

### Requirements
- Pinterest Business Account
- Pinterest Developer Account

### Setup Steps

1. **Create a Pinterest Business Account**
   - Go to https://business.pinterest.com/
   - Convert your account or create a new one

2. **Create a Pinterest App**
   - Go to https://developers.pinterest.com/
   - Click "My apps" → "Create app"
   - Fill in:
     - App name
     - Description
     - Website URL

3. **Configure OAuth**
   - In app settings, add redirect URI:
     `https://your-domain.com/public/oauth/pinterest/callback`

4. **Request API Access**
   - By default, apps have Standard Access
   - For publishing pins, you need to request Standard Access approval

5. **Get Credentials**
   - Copy **App ID** and **App Secret**

6. **Configure Environment Variables**
   ```env
   PINTEREST_APP_ID=your_app_id
   PINTEREST_APP_SECRET=your_app_secret
   PINTEREST_CALLBACK_URL=https://your-domain.com/public/oauth/pinterest/callback
   ```

### Notes
- Pinterest pins REQUIRE an image
- Pins are posted to a specific board
- If no board is specified, the first available board is used
- Rate limits: ~1,000 calls/hour

---

## YouTube

### Requirements
- Google Cloud Console Account
- YouTube Channel

### Setup Steps

1. **Create a Google Cloud Project**
   - Go to https://console.cloud.google.com/
   - Create a new project

2. **Enable YouTube Data API v3**
   - Go to APIs & Services → Library
   - Search for "YouTube Data API v3"
   - Click Enable

3. **Configure OAuth Consent Screen**
   - Go to APIs & Services → OAuth consent screen
   - Choose "External" user type
   - Fill in app information:
     - App name
     - User support email
     - Developer contact email
   - Add scopes:
     - `openid`
     - `profile`
     - `email`
     - `https://www.googleapis.com/auth/youtube`
     - `https://www.googleapis.com/auth/youtube.upload`

4. **Create OAuth 2.0 Credentials**
   - Go to APIs & Services → Credentials
   - Click "Create Credentials" → "OAuth client ID"
   - Choose "Web application"
   - Add redirect URI:
     `https://your-domain.com/public/oauth/youtube/callback`

5. **Get Credentials**
   - Copy **Client ID** and **Client Secret**

6. **Configure Environment Variables**
   ```env
   GOOGLE_CLIENT_ID=your_client_id
   GOOGLE_CLIENT_SECRET=your_client_secret
   GOOGLE_CALLBACK_URL=https://your-domain.com/public/oauth/youtube/callback
   ```

### Notes
- **Video Upload**: Supported via the resumable upload API. Provide a direct video file URL.
- **Community Posts**: YouTube's Community Post API is not publicly available. Posts must be made through YouTube Studio.
- Free tier quota: ~10,000 units/day (about 6 uploads/day at ~1,600 units per upload)

---

## Environment Variables Summary

```env
# =============================================================================
# TWITTER / X
# =============================================================================
TWITTER_CLIENT_ID=
TWITTER_CLIENT_SECRET=
TWITTER_CALLBACK_URL=https://your-domain.com/public/oauth/twitter/callback
TWITTER_MEDIA_UPLOAD_ENABLED=false  # Requires X API Pro tier ($5,000/month)

# =============================================================================
# LINKEDIN
# =============================================================================
LINKEDIN_CLIENT_ID=
LINKEDIN_CLIENT_SECRET=
LINKEDIN_CALLBACK_URL=https://your-domain.com/public/oauth/linkedin/callback

# =============================================================================
# FACEBOOK & INSTAGRAM
# =============================================================================
FACEBOOK_APP_ID=
FACEBOOK_APP_SECRET=
FACEBOOK_CALLBACK_URL=https://your-domain.com/public/oauth/facebook/callback
# Note: Instagram uses the same Facebook app credentials
INSTAGRAM_CALLBACK_URL=https://your-domain.com/public/oauth/instagram/callback

# =============================================================================
# PINTEREST
# =============================================================================
PINTEREST_APP_ID=
PINTEREST_APP_SECRET=
PINTEREST_CALLBACK_URL=https://your-domain.com/public/oauth/pinterest/callback

# =============================================================================
# YOUTUBE (GOOGLE)
# =============================================================================
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_CALLBACK_URL=https://your-domain.com/public/oauth/youtube/callback
```

---

## Troubleshooting

### Common Issues

1. **"Platform is not configured" error**
   - Check that all required environment variables are set
   - Restart the backend service after adding env vars

2. **OAuth redirect fails**
   - Ensure callback URL in env matches exactly what's configured in the platform's developer console
   - Check that the callback URL is accessible from the internet

3. **"Invalid state" error**
   - OAuth state tokens expire after 10 minutes
   - Try the connection again

4. **"Access denied" or "Forbidden" errors**
   - Check that your app has the required permissions/scopes
   - Some platforms require app review before certain permissions work

5. **LinkedIn "w_organization_social not authorized"**
   - Your app is not approved for **Marketing Developer Platform** yet
   - Use the **LinkedIn Profile** connection while approval is pending

5. **Token refresh failed**
   - The platform connection has expired
   - Disconnect and reconnect the platform

### Development vs Production

For **development** (localhost):
```env
TWITTER_CALLBACK_URL=http://localhost:8080/public/oauth/twitter/callback
LINKEDIN_CALLBACK_URL=http://localhost:8080/public/oauth/linkedin/callback
# etc.
```

When using Docker in this repo, the default web port is **8080**. Set callback URLs to `http://localhost:8080/public/oauth/...` and ensure your platform apps allow localhost redirect URIs.

Most platforms require HTTPS for callback URLs in production. For local development:
- Twitter: Allows `http://localhost`
- Facebook: Allows `http://localhost`
- LinkedIn: Allows `http://localhost`
- Google: Allows `http://localhost`
- Pinterest: May require HTTPS (use ngrok or similar)
