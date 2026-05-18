// useAppMood — time + state aware UI mood.
//
// The app currently looks identical at 3 AM and 9 AM. This hook returns
// a palette/tone hint + an optional background tint that subtly shifts
// the feel of the screen across the day. Designed as an additive
// overlay layer: consumers render a `pointerEvents="none"` View with
// the returned tintColor + tintOpacity, so no existing UI colors need
// to change.
//
// The interval re-evaluation matters for users who keep the app open
// through a palette boundary (most commonly midnight) — without it,
// their UI would stay stuck on the dusk/day palette until they killed
// and relaunched the app.

import { useEffect, useState } from 'react';

const TEN_MINUTES_MS = 10 * 60 * 1000;

/**
 * Compute the mood snapshot for a given Date + user state. Pure function
 * so it's trivial to reason about and to spot-check at specific hours.
 *
 * @param {Date} now
 * @param {{ currentStreak: number, totalCompleted: number }} ctx
 */
function computeMood(now, { currentStreak, totalCompleted }) {
  const hour = now.getHours();

  let palette;
  let tone;
  let tintColor;
  let tintOpacity;

  if (hour >= 5 && hour < 9) {
    // Dawn — the user is opening the app to start their day. Warm amber
    // priming, "opener" tone (welcome, set intention).
    palette = 'dawn';
    tone = 'opener';
    tintColor = 'rgba(251, 191, 36, 0.05)';
    tintOpacity = 1;
  } else if (hour >= 9 && hour < 17) {
    // Day — peak productivity hours. No tint, default light UI. The
    // "pusher" tone is for copy elsewhere ("don't break the chain").
    palette = 'day';
    tone = 'pusher';
    tintColor = null;
    tintOpacity = 0;
  } else if (hour >= 17 && hour < 22) {
    // Dusk — winding down. Warm soft overlay, "forgiver" tone: be kind
    // if they missed today, surface tomorrow's intention.
    palette = 'dusk';
    tone = 'forgiver';
    tintColor = 'rgba(180, 83, 9, 0.04)';
    tintOpacity = 1;
  } else {
    // Night — 22:00 through 04:59. Quiet onyx wash, "witness" tone:
    // observation over instruction. Soft cap on stimulation so the app
    // doesn't fight the user's circadian rhythm.
    palette = 'night';
    tone = 'witness';
    tintColor = 'rgba(10, 10, 15, 0.12)';
    tintOpacity = 1;
  }

  return {
    palette,
    tone,
    hour,
    tintColor,
    tintOpacity,
    // Echo state inputs so consumers can branch on them without a second
    // call to useApp(). Reserved for future use (e.g. amplify dawn tint
    // for users on long streaks).
    currentStreak,
    totalCompleted,
  };
}

/**
 * Time + state aware UI mood. Re-evaluates every 10 minutes so a user
 * who keeps the app open through midnight gets the night palette.
 *
 * @param {Object} ctx
 * @param {number} ctx.currentStreak
 * @param {number} ctx.totalCompleted
 * @returns {{
 *   palette: 'dawn' | 'day' | 'dusk' | 'night',
 *   tone: 'opener' | 'pusher' | 'forgiver' | 'witness',
 *   hour: number,
 *   tintColor: string | null,
 *   tintOpacity: number,
 * }}
 */
export function useAppMood({ currentStreak = 0, totalCompleted = 0 } = {}) {
  const [mood, setMood] = useState(() =>
    computeMood(new Date(), { currentStreak, totalCompleted }),
  );

  useEffect(() => {
    // Recompute immediately on input change so a streak/total update
    // is reflected before the next 10-min tick.
    setMood(computeMood(new Date(), { currentStreak, totalCompleted }));

    const interval = setInterval(() => {
      setMood(computeMood(new Date(), { currentStreak, totalCompleted }));
    }, TEN_MINUTES_MS);

    return () => clearInterval(interval);
  }, [currentStreak, totalCompleted]);

  return mood;
}
