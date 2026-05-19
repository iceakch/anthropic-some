# Anthropic Proxy on Vercel (No Git required)

## What this project does

This project exposes:

- `POST /api/v1/messages`
- `POST /api/v1/messages/count_tokens`

and forwards them to `https://api.anthropic.com/...` through Vercel Edge.

If `PROXY_SECRET` is configured in Vercel, requests must include:

- header `x-proxy-token: <PROXY_SECRET>`

## Deploy with Vercel CLI

From this folder:

```powershell
vercel login
vercel
vercel --prod
```

After deploy you will get a URL like:

`https://<project>.vercel.app`

Proxy endpoint for Anthropic SDK:

`https://<project>.vercel.app/api`

## Configure optional protection

```powershell
vercel env add PROXY_SECRET production
vercel --prod
```

## Quick test from PowerShell

```powershell
$proxy = "https://<project>.vercel.app/api/v1/messages"
$apiKey = "<ANTHROPIC_API_KEY>"
$proxyToken = "<PROXY_SECRET_OR_EMPTY>"

$headers = @{
  "content-type" = "application/json"
  "x-api-key" = $apiKey
  "anthropic-version" = "2023-06-01"
}
if ($proxyToken -ne "") { $headers["x-proxy-token"] = $proxyToken }

$body = @{
  model = "claude-3-5-sonnet-20241022"
  max_tokens = 32
  messages = @(@{ role = "user"; content = "hi" })
} | ConvertTo-Json -Depth 10

Invoke-RestMethod -Method Post -Uri $proxy -Headers $headers -Body $body
```

## Connect your backend

Use in backend `.env`:

```env
ANTHROPIC_BASE_URL=https://<project>.vercel.app/api
ANTHROPIC_API_KEY=<ANTHROPIC_API_KEY>
ANTHROPIC_PROXY_TOKEN=<PROXY_SECRET>  # empty if not configured
```
