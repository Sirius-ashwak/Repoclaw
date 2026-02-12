# RepoClaw Setup Guide

This guide will help you set up RepoClaw for development.

## Step 1: Install Node.js

RepoClaw requires Node.js 18 or higher. Download and install from:
- https://nodejs.org/ (LTS version recommended)

Verify installation:
```bash
node --version  # Should show v18.x.x or higher
npm --version   # Should show 9.x.x or higher
```

## Step 2: Install Dependencies

Once Node.js is installed, run:

```bash
npm install
```

This will install all required dependencies including:
- Next.js 14
- React 18
- TypeScript
- Tailwind CSS + shadcn/ui components
- LangGraph for agent orchestration
- Vercel AI SDK
- Octokit (GitHub API)
- fast-check (property-based testing)
- And more...

## Step 3: Configure Environment Variables

### GitHub OAuth App

1. Go to GitHub Settings → Developer settings → OAuth Apps
2. Click "New OAuth App"
3. Fill in:
   - Application name: `RepoClaw (Dev)`
   - Homepage URL: `http://localhost:3000`
   - Authorization callback URL: `http://localhost:3000/api/auth/callback`
4. Click "Register application"
5. Copy the Client ID and generate a Client Secret
6. Add to `.env`:
   ```
   GITHUB_CLIENT_ID=your_client_id
   GITHUB_CLIENT_SECRET=your_client_secret
   GITHUB_CALLBACK_URL=http://localhost:3000/api/auth/callback
   ```

### Vercel API Token

1. Go to Vercel Dashboard → Settings → Tokens
2. Create a new token with appropriate scope
3. Copy the token and add to `.env`:
   ```
   VERCEL_TOKEN=your_vercel_token
   ```
4. If using a team, also add:
   ```
   VERCEL_TEAM_ID=your_team_id
   ```

### LLM API Configuration

RepoClaw uses Grok (via x.ai) by default, but supports any OpenAI-compatible API:

**For Grok:**
1. Get API key from https://x.ai/
2. Add to `.env`:
   ```
   LLM_API_KEY=your_grok_api_key
   LLM_API_BASE_URL=https://api.x.ai/v1
   LLM_MODEL=grok-beta
   ```

**For OpenAI:**
```
LLM_API_KEY=your_openai_api_key
LLM_API_BASE_URL=https://api.openai.com/v1
LLM_MODEL=gpt-4-turbo-preview
```

### Vercel KV (for local development)

For local development, you have two options:

**Option 1: Use Vercel KV (Recommended)**
1. Create a KV database in Vercel Dashboard
2. Go to Storage → KV → Create Database
3. Copy the environment variables and add to `.env`:
   ```
   KV_URL=your_kv_url
   KV_REST_API_URL=your_kv_rest_api_url
   KV_REST_API_TOKEN=your_kv_rest_api_token
   KV_REST_API_READ_ONLY_TOKEN=your_kv_rest_api_read_only_token
   ```

**Option 2: Use Upstash Redis (Alternative)**
1. Create account at https://upstash.com/
2. Create a Redis database
3. Copy the REST API credentials to `.env`

### Optional: Telegram Bot

If you want to enable Telegram export:
1. Create a bot via @BotFather on Telegram
2. Copy the bot token and add to `.env`:
   ```
   TELEGRAM_BOT_TOKEN=your_bot_token
   ```

## Step 4: Run Development Server

```bash
npm run dev
```

Open http://localhost:3000 in your browser.

## Step 5: Run Tests

```bash
# Run all tests
npm test

# Run in watch mode
npm run test:watch
```

## Troubleshooting

### "Module not found" errors
Run `npm install` again to ensure all dependencies are installed.

### Port 3000 already in use
Either stop the process using port 3000, or run on a different port:
```bash
PORT=3001 npm run dev
```

### KV connection errors
Make sure your KV credentials are correct in `.env`. For local development, you can also use a local Redis instance.

### GitHub OAuth errors
- Verify callback URL matches exactly in GitHub OAuth App settings
- Check that CLIENT_ID and CLIENT_SECRET are correct
- Ensure you're accessing the app via the same URL configured in GitHub

## Next Steps

Once setup is complete, you can:
1. Start implementing agents (see `.kiro/specs/repoclaw/tasks.md`)
2. Run the test suite to verify everything works
3. Begin development following the implementation plan

## Production Deployment

For production deployment to Vercel:

1. Push code to GitHub
2. Import project in Vercel
3. Configure environment variables in Vercel dashboard
4. Vercel will automatically provide KV credentials
5. Deploy!

The production setup is simpler because Vercel handles KV provisioning automatically.
