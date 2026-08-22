// Prestige ranks — earned by completing paths. Shown on Profile.
// (`minSprints` field name kept for backwards compat; refers to completed paths.)

export const RANKS = [
  { id: 'novice', title: 'Novice', subtitle: 'Yolculuk başlıyor', emoji: '🌱', minSprints: 0, color: '#6B6B85' },
  { id: 'disciple', title: 'Disciple', subtitle: 'İlk yol tamamlandı', emoji: '⚡', minSprints: 1, color: '#3B82F6' },
  { id: 'warrior', title: 'Warrior', subtitle: 'Savaşçı zihniyeti', emoji: '⚔️', minSprints: 2, color: '#8B5CF6' },
  { id: 'monk', title: 'Disciplined', subtitle: 'Disiplin zirvede', emoji: '🧘', minSprints: 3, color: '#10B981' },
  { id: 'master', title: 'Master', subtitle: 'Usta', emoji: '👑', minSprints: 4, color: '#FBBF24' },
  { id: 'legend', title: 'Legend', subtitle: 'Efsane', emoji: '🔥', minSprints: 5, color: '#EF4444' },
];

export const getRank = (completedPaths = 0) => {
  let current = RANKS[0];
  for (const r of RANKS) {
    if (completedPaths >= r.minSprints) current = r;
  }
  return current;
};

export const getNextRank = (completedPaths = 0) => {
  return RANKS.find((r) => r.minSprints > completedPaths) || null;
};
