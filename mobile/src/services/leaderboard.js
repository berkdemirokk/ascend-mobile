// The public anonymous leaderboard was removed: a global ranking contradicts
// the "Monk Mode" framing of solo, intrinsic discipline. The anon username
// generator is kept as a single export because the upcoming Squad feature
// (private, opt-in collective streak rings) will reuse the same handle —
// no need to re-roll usernames at that point.
//
// If you ever truly want to drop social entirely, delete this file and
// remove the `anonUsername` field from AppContext + cloudSync's SYNCED_KEYS.

export const generateAnonUsername = () => {
  const n = Math.floor(1000 + Math.random() * 9000);
  return `monk_${n}`;
};
