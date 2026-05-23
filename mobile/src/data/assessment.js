// Outcome Assessment — the audit's #1 missing piece: the app had NO
// way to show a user that they actually changed. Streak + XP measure
// app usage, not life outcome. This module defines the 5 dimensions
// we ask the user to self-rate, both at onboarding (baseline) and
// every 30 days after (delta surface).
//
// Why these 5 (not 3, not 10):
//   - Each maps cleanly to one of the 5 paths so the user sees the
//     ASCEND content domains reflected in their self-report.
//   - 5 is the sweet spot for self-assessment: <3 feels arbitrary,
//     >7 invites survey fatigue (drop-off climbs sharply past q.7
//     in habit-app onboarding research).
//   - 1-10 Likert (not 1-5) gives meaningful "+3" delta moments —
//     a 1-5 scale rarely shows visible movement in 30 days.
//
// Anti-bullshit measures:
//   - Wording focuses on OBSERVABLE behaviour, not feelings ("Bir
//     hafta önce verdiğin sözü tutmaya çalışıyor musun?" beats
//     "Disiplinli misin?"). Users self-report consistently more
//     accurately about behaviour than identity.
//   - The "freedom" question is reverse-scored in the UI prompt
//     but stored as 1-10 same direction so deltas always read "+N".

export const ASSESSMENT_DIMENSIONS = [
  {
    id: 'discipline',
    pathId: 'dopamine-detox', // visual anchor: where this dimension is trained
    icon: 'workspaces',
    color: '#DC2626',
    questionKey: 'assessment.qDiscipline',
    questionFallback:
      'Bir hafta önce verdiğin sözü ne kadar tutuyorsun? (1: hiç — 10: tam)',
    labelKey: 'assessment.labelDiscipline',
    labelFallback: 'Disiplin',
  },
  {
    id: 'focus',
    pathId: 'mind-discipline',
    icon: 'center-focus-strong',
    color: '#6366F1',
    questionKey: 'assessment.qFocus',
    questionFallback:
      'Bir işe başlayınca kaç dakika kesintisiz odaklanabiliyorsun? (1: <5dk — 10: 90+ dk)',
    labelKey: 'assessment.labelFocus',
    labelFallback: 'Odak',
  },
  {
    id: 'body',
    pathId: 'body-discipline',
    icon: 'directions-run',
    color: '#10B981',
    questionKey: 'assessment.qBody',
    questionFallback:
      'Bedenini bugün nasıl hissediyorsun? Enerji + form. (1: bitkin — 10: zinde)',
    labelKey: 'assessment.labelBody',
    labelFallback: 'Beden',
  },
  {
    id: 'mind',
    pathId: 'silent-morning',
    icon: 'self-improvement',
    color: '#8B5CF6',
    questionKey: 'assessment.qMind',
    questionFallback:
      'Sabahları zihnen ne kadar berraksın? (1: dağınık — 10: net)',
    labelKey: 'assessment.labelMind',
    labelFallback: 'Zihin',
  },
  {
    id: 'freedom',
    pathId: 'money-discipline',
    icon: 'shield',
    color: '#F59E0B',
    questionKey: 'assessment.qFreedom',
    questionFallback:
      'Anlık dürtülere karşı kendini ne kadar özgür hissediyorsun? (1: tetiklenince yapıyorum — 10: ben karar veriyorum)',
    labelKey: 'assessment.labelFreedom',
    labelFallback: 'Bağımsızlık',
  },
];

export const ASSESSMENT_MAX_PER_DIM = 10;
export const ASSESSMENT_TOTAL_MAX =
  ASSESSMENT_DIMENSIONS.length * ASSESSMENT_MAX_PER_DIM; // 50

// Days between baseline and the first post-assessment prompt.
// 30 = matches Lally's behaviour-formation literature, also lines up
// with the "1 month review" instinct most users already have.
export const POST_ASSESSMENT_INTERVAL_DAYS = 30;

/**
 * Compute the total score (0..50) from a {dimId: 1..10} map.
 */
export const totalScore = (scores) => {
  if (!scores) return 0;
  let sum = 0;
  for (const d of ASSESSMENT_DIMENSIONS) {
    sum += Math.max(0, Math.min(10, scores[d.id] || 0));
  }
  return sum;
};

/**
 * Per-dimension deltas + total delta. Always positive direction
 * means improvement. Used by ProgressReportScreen.
 *
 * Returns: { totalDelta, dimensions: [{id, before, after, delta}, ...] }
 */
export const computeDelta = (before, after) => {
  if (!before || !after) return null;
  const dims = ASSESSMENT_DIMENSIONS.map((d) => {
    const b = before[d.id] || 0;
    const a = after[d.id] || 0;
    return { id: d.id, before: b, after: a, delta: a - b };
  });
  const totalDelta = dims.reduce((s, d) => s + d.delta, 0);
  return { totalDelta, dimensions: dims };
};

/**
 * Build the empty-state default scores object — used to initialise
 * the assessment UI sliders so they all start at 5 (neutral) rather
 * than 0 (which would feel like the app is judging the user before
 * they even answered).
 */
export const defaultScores = () => {
  const out = {};
  for (const d of ASSESSMENT_DIMENSIONS) out[d.id] = 5;
  return out;
};
