# TripSkip Publisher - Railway Deployment Guide

## Step 1: Push to GitHub

Create a new private repo on GitHub, then from your local machine:

```
cd C:\Users\jgarc\TripSkip-Content-Engine\tripskip-publisher-railway
git init
git add .
git commit -m "TripSkip Publisher - Railway deploy"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/tripskip-publisher.git
git push -u origin main
```

## Step 2: Deploy to Railway

1. Go to https://railway.app and sign in with GitHub
2. Click "New Project" → "Deploy from GitHub repo"
3. Select your tripskip-publisher repo
4. Railway will auto-detect Node.js and deploy

## Step 3: Add Environment Variables in Railway

Go to your Railway service → Variables tab → Add these:

```
SUPABASE_URL=https://loxdthuusivtkjipejwv.supabase.co
SUPABASE_SERVICE_KEY=your_supabase_service_key
LATE_API_KEY=your_getlate_api_key
WEBHOOK_SECRET=pick_a_random_secret_string_here
```

For WEBHOOK_SECRET, make up a random string like: `ts_pub_a8f3k9x2m7q1`

## Step 4: Get Your Railway URL

After deploy, Railway gives you a URL like:
`https://tripskip-publisher-production-xxxx.up.railway.app`

Test it: visit that URL in your browser — you should see:
`{"status":"ok","service":"tripskip-publisher"}`

## Step 5: Set Up n8n Workflow

1. In n8n, go to Credentials → Add new → "Header Auth"
   - Name: `Publisher Webhook Auth`
   - Header Name: `Authorization`
   - Header Value: `Bearer ts_pub_a8f3k9x2m7q1` (your WEBHOOK_SECRET)

2. Go to n8n Settings → Variables → Add:
   - Name: `PUBLISHER_URL`
   - Value: `https://tripskip-publisher-production-xxxx.up.railway.app` (your Railway URL)

3. Import the workflow:
   - Go to Workflows → Import from File → select `n8n-workflow.json`
   - Open "Trigger Publish" node → select your "Publisher Webhook Auth" credential
   - Open "Alert on Failures" node → set your Telegram chat ID and credential (optional)
   - Activate the workflow

## Endpoints

- `GET /` or `/health` — Health check
- `POST /publish` — Run publisher (body: `{"dryRun": false}`)
- `GET /status` — Check queue stats

## Manual Testing

Test from command line:
```
curl -X POST https://YOUR_RAILWAY_URL/publish -H "Authorization: Bearer YOUR_WEBHOOK_SECRET" -H "Content-Type: application/json" -d "{\"dryRun\":true}"
```
