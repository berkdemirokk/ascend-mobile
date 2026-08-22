# delete-user Edge Function

Server-side account deletion. Required by Apple App Review Guideline
5.1.1(v) — apps with account creation must offer in-app deletion that
fully removes the account from the server.

## What it does

1. Verifies the caller's JWT (extracted from `Authorization: Bearer <token>`).
2. Calls `supabase.auth.admin.deleteUser(userId)` with the service role.
3. Cascades to `user_state` row via FK `ON DELETE CASCADE`.
4. Returns `{ ok: true }` on success.

## Deploy (Windows PowerShell)

```powershell
# 1. Install Supabase CLI (one-time)
npm install -g supabase

# 2. Log in (one-time, opens browser)
supabase login

# 3. Link the project to this folder (one-time)
cd mobile
supabase link --project-ref wihkcmgtzmdupxuyavyr

# 4. Deploy the function
supabase functions deploy delete-user --no-verify-jwt
```

> The `--no-verify-jwt` flag tells Supabase Edge Runtime to skip its
> automatic 401 on missing JWT — we verify it manually inside the function
> so we can return clean JSON errors.

## Set environment variables (in Supabase dashboard)

Hosted Edge Functions receive `SUPABASE_URL` and
`SUPABASE_SERVICE_ROLE_KEY` automatically. Do not copy the service-role key
into the app, repository, or a manually managed function secret.

## Test locally (optional)

```powershell
# Start Supabase locally
supabase start

# Serve the function
supabase functions serve delete-user --env-file .env.local

# In another terminal, test:
curl -X POST http://localhost:54321/functions/v1/delete-user `
  -H "Authorization: Bearer YOUR_USER_JWT" `
  -H "Content-Type: application/json"
```

## Verify after deploy

In Supabase dashboard → Edge Functions → delete-user → Logs.
You should see green log entries when users tap "Delete Account" in the app.

## Rollback

```powershell
supabase functions delete delete-user
```
