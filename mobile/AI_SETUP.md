# AI Personalization Layer — Setup

The app fires two Anthropic API calls per lesson (intro + reflection
response) when **AI Coach** is enabled for the user. This file documents
how to wire the key locally without committing it.

## Get a key

1. Sign in at https://console.anthropic.com/settings/keys
2. Create a new API key (any name — e.g. "ascend-dev")
3. Copy the key (starts with `sk-ant-...`)

## Wire it locally

Open `mobile/app.json` and paste the key into `extra.anthropicApiKey`:

```json
"extra": {
  "supabase": { ... },
  "anthropicApiKey": "sk-ant-...your-key-here...",
  "eas": { ... }
}
```

**Do not commit the actual key.** Treat `app.json` like `.env`: locally
edit the value, but revert before pushing. (For CI / production builds,
inject `ANTHROPIC_API_KEY` via the Expo env mechanism — the service
falls back to `process.env.ANTHROPIC_API_KEY` if `extra.anthropicApiKey`
is empty.)

## What happens with no key

Every public function in `src/services/aiPersonalize.js` returns `null`
when no key is configured. The LessonScreen renders nothing instead of
the intro card / sage response — the rest of the lesson is unchanged.
There is no toast, no error, no console warning surfaced to the user.

## Cost guardrails (already built in)

- **Per-(user, lesson) cache** — every successful response is cached in
  AsyncStorage. Re-opening a lesson never bills again.
- **Daily hard cap** — 10 successful API calls per user per local day.
  Counter persists across restarts.
- **5s timeout** — per-call AbortController. Failures don't retry.
- **Premium gate** — the toggle is locked off for free users.

Target spend: ~$0.005/call × 2/lesson × 3 lessons/day = **$0.03/day per
premium user**. The cache should drive it lower in practice (re-opens
are free).

## Tune

- **Model**: edit `MODEL` in `src/services/aiPersonalize.js`. Default is
  `claude-sonnet-4-5-20251022`.
- **Daily cap**: edit `DAILY_HARD_CAP`. Default is 10.
- **Prompt voice**: edit `introPrompt()` and `reflectionPrompt()` in the
  same file. Both currently enforce: stoic, masculine, direct, no
  praise, no emojis, Turkish (or English if user locale is `en`).

## Toggle in-app

Settings → Notifications section → "Kişiselleştirilmiş AI Koç". Premium
default is ON; free is OFF and the switch routes to paywall.
