// Supabase Edge Function: delete-user
//
// Deletes the calling user's auth.users row + cascades to user_state.
// Required by Apple App Review Guideline 5.1.1(v) — apps with account
// creation must provide IN-APP account deletion that fully removes the
// account from the server.
//
// Deploy:
//   supabase functions deploy delete-user --no-verify-jwt
//   (we DO verify JWT manually below; --no-verify-jwt just skips Supabase's
//   automatic 401 so we can return JSON instead)
//
// Supabase injects SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY into hosted
// functions. Never copy the service-role key into the app or repository.
//
// Client invocation (from React Native):
//   const { data, error } = await supabase.functions.invoke('delete-user');
//   The user's JWT is automatically attached as Authorization: Bearer <token>.

// @ts-ignore — Deno runtime
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
// @ts-ignore — Deno runtime
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.112.3';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  // Preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  try {
    // 1. Verify the caller's JWT to extract their user id.
    const authHeader = req.headers.get('Authorization') ?? '';
    const jwt = authHeader.replace(/^Bearer\s+/i, '');
    if (!jwt) {
      return new Response(
        JSON.stringify({ error: 'Missing Authorization header' }),
        {
          status: 401,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        },
      );
    }

    // @ts-ignore — Deno.env
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    // @ts-ignore — Deno.env
    const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Anonymous client to verify the JWT
    const userClient = createClient(SUPABASE_URL, SERVICE_ROLE, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        {
          status: 401,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        },
      );
    }
    const userId = userData.user.id;

    // 2. Delete with the service-role admin client.
    const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { error: delErr } = await adminClient.auth.admin.deleteUser(userId);
    if (delErr) {
      return new Response(
        JSON.stringify({ error: delErr.message }),
        {
          status: 500,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        },
      );
    }

    // user_state row cascades automatically via FK ON DELETE CASCADE
    // (see schema.sql).

    return new Response(JSON.stringify({ ok: true, userId }), {
      status: 200,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ error: (e as Error).message ?? 'Unknown error' }),
      {
        status: 500,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      },
    );
  }
});
