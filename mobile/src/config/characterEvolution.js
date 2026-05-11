// Character Evolution — visible identity progression keyed off the
// user's longest streak. The user starts as a regular person and
// visually transforms into a warrior, then monk, then legend as their
// streak grows. This is the strongest sunk-cost / identity-reinforcement
// signal an app can show — "look at who I became".
//
// Used on Profile (BIG hero display) and Home (small pill). The user
// SEES themselves transform; the days aren't just a number anymore.

// Stages — each gates by a streak threshold. The threshold is checked
// against the longestStreak so the user keeps their highest-ever
// character even after a streak break (we're rewarding identity, not
// punishing slip-ups).
//
// Emojis intentionally chosen with cultural resonance:
//   beginner  → regular person
//   apprentice→ karateka (training)
//   warrior   → crossed swords (committed)
//   monk      → meditation posture (mastery)
//   sage      → old man = wise / time-tested
//   legend    → crown = unmatched
export const CHARACTER_STAGES = [
  { id: 'beginner',   minStreak: 0,    emoji: '🧑',  titleKey: 'character.beginner.title',  subtitleKey: 'character.beginner.sub' },
  { id: 'apprentice', minStreak: 3,    emoji: '🥋',  titleKey: 'character.apprentice.title', subtitleKey: 'character.apprentice.sub' },
  { id: 'warrior',    minStreak: 14,   emoji: '⚔️',  titleKey: 'character.warrior.title',   subtitleKey: 'character.warrior.sub' },
  { id: 'monk',       minStreak: 30,   emoji: '🧘',  titleKey: 'character.monk.title',      subtitleKey: 'character.monk.sub' },
  { id: 'sage',       minStreak: 100,  emoji: '🧙',  titleKey: 'character.sage.title',      subtitleKey: 'character.sage.sub' },
  { id: 'legend',     minStreak: 365,  emoji: '👑',  titleKey: 'character.legend.title',    subtitleKey: 'character.legend.sub' },
];

/**
 * Compute the current character stage from the user's longest streak.
 * Falls back to the first stage (beginner) on bad input.
 */
export const getCharacterStage = (longestStreak) => {
  const s = longestStreak || 0;
  // Walk highest threshold down so the largest qualifying stage wins.
  for (let i = CHARACTER_STAGES.length - 1; i >= 0; i--) {
    if (s >= CHARACTER_STAGES[i].minStreak) return CHARACTER_STAGES[i];
  }
  return CHARACTER_STAGES[0];
};

/**
 * The next stage the user is working toward + how many days away.
 * Used to show progress: "5 days to Warrior".
 */
export const getNextCharacterStage = (longestStreak) => {
  const s = longestStreak || 0;
  const next = CHARACTER_STAGES.find((stage) => stage.minStreak > s);
  if (!next) return null;
  return {
    stage: next,
    daysAway: next.minStreak - s,
  };
};
