// Supabase Edge Function: broadcast-push
//
// Sends a single push notification to ALL users with a registered
// Expo push token. Use case: "the app got an update — try the new
// Squad feature", milestone announcements, occasional product news.
//
// Auth model:
//   - NOT user-callable. There is no "users can spam each other" code
//     path. Caller MUST present a shared secret in the X-Broadcast-
//     Secret header that matches the BROADCAST_SECRET env var set in
//     the Supabase dashboard. If they don't, we 401.
//   - Anyone with the secret can broadcast — treat it like a master
//     key, rotate it after suspected leaks.
//
// Deploy:
//   supabase functions deploy broadcast-push --no-verify-jwt
//
// Env vars (Supabase dashboard → Edge Functions → Settings):
//   SUPABASE_URL                = https://<project>.supabase.co
//   SUPABASE_SERVICE_ROLE_KEY   = eyJ... (Project Settings → API)
//   BROADCAST_SECRET            = a long random string you generate
//
// Manual invocation (from a terminal):
//   curl -X POST https://<project>.supabase.co/functions/v1/broadcast-push \
//     -H "X-Broadcast-Secret: <your secret>" \
//     -H "Content-Type: application/json" \
//     -d '{"title":"Ascend güncellendi","body":"Halka özelliği geldi — dene!","data":{"deeplink":"squad"}}'
//
// Response:
//   { ok: true, sent: 42, failed: 2, errors: ["DeviceNotRegistered", ...] }
//
// Expo Push API ref: https://docs.expo.dev/push-notifications/sending-notifications/
//   - Up to 100 messages per request batch
//   - Returns "tickets" (queued IDs); we only check for synchronous
//     errors here, not delivery receipts (would need a follow-up
//     /getReceipts call after ~15min — out of scope for v1).

// @ts-ignore — Deno runtime
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
// @ts-ignore — Deno runtime
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-broadcast-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const BATCH_SIZE = 100; // Expo's documented limit

interface BroadcastBody {
  title: string;
  body: string;
  data?: Record<string, unknown>; // arbitrary payload, e.g. { deeplink: "squad" }
  sound?: 'default' | null;
  // Optional dry-run mode: counts targets but doesn't actually send.
  dryRun?: boolean;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  // 1. Auth — shared secret.
  // @ts-ignore — Deno.env
  const SECRET = Deno.env.get('BROADCAST_SECRET');
  if (!SECRET) {
    return json({ error: 'Server not configured (no BROADCAST_SECRET)' }, 500);
  }
  const presented = req.headers.get('X-Broadcast-Secret');
  if (!presented || presented !== SECRET) {
    return json({ error: 'Unauthorized' }, 401);
  }

  // 2. Parse + validate body.
  let payload: BroadcastBody;
  try {
    payload = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }
  const title = (payload.title || '').toString().trim();
  const body = (payload.body || '').toString().trim();
  if (!title || !body) {
    return json({ error: 'title and body are required' }, 400);
  }

  // 3. Fetch all tokens (service-role bypasses RLS).
  // @ts-ignore — Deno.env
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  // @ts-ignore — Deno.env
  const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: tokens, error: fetchErr } = await admin
    .from('push_tokens')
    .select('expo_token');
  if (fetchErr) {
    return json({ error: `Token fetch failed: ${fetchErr.message}` }, 500);
  }
  const allTokens = (tokens || [])
    .map((row: { expo_token: string }) => row.expo_token)
    .filter(
      (tok: string) =>
        typeof tok === 'string' && tok.startsWith('ExponentPushToken['),
    );

  if (payload.dryRun) {
    return json({ ok: true, dryRun: true, targets: allTokens.length });
  }

  if (allTokens.length === 0) {
    return json({ ok: true, sent: 0, failed: 0, errors: [] });
  }

  // 4. Send to Expo Push API in batches of 100.
  let sent = 0;
  let failed = 0;
  const errors: string[] = [];

  for (let i = 0; i < allTokens.length; i += BATCH_SIZE) {
    const batch = allTokens.slice(i, i + BATCH_SIZE);
    const messages = batch.map((to: string) => ({
      to,
      title,
      body,
      sound: payload.sound === null ? undefined : 'default',
      data: payload.data || {},
      priority: 'high',
    }));

    try {
      const resp = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Accept-Encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(messages),
      });
      const result = await resp.json();
      const tickets = result?.data || [];
      for (const ticket of tickets) {
        if (ticket?.status === 'ok') {
          sent += 1;
        } else {
          failed += 1;
          const errCode =
            ticket?.details?.error || ticket?.message || 'unknown';
          if (errors.length < 20) errors.push(errCode);
        }
      }
      // If the entire batch errored at the HTTP level, count all as failed.
      if (!Array.isArray(tickets) && resp.status >= 400) {
        failed += batch.length;
        if (errors.length < 20) {
          errors.push(`http_${resp.status}: ${JSON.stringify(result).slice(0, 100)}`);
        }
      }
    } catch (e) {
      failed += batch.length;
      if (errors.length < 20) {
        errors.push(`fetch_failed: ${(e as Error).message}`);
      }
    }
  }

  return json({ ok: true, total: allTokens.length, sent, failed, errors });
});

function json(payload: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}
