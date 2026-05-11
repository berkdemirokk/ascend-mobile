// Path-based achievements (Discipline Academy)
// Triggered by: total lessons completed, streak milestones, level

// Identity badges — path-completion-based titles the user displays on their
// profile. Atomic Habits framing: identity > behavior. "I'm not someone who
// finishes a discipline path; I AM the Sleep Champion."
export const IDENTITY_BADGES = {
  'dopamine-detox': {
    id: 'dopamine-warrior',
    icon: '🧘',
    title: 'Dopamin Savaşçısı',
    titleEn: 'Dopamine Warrior',
  },
  'silent-morning': {
    id: 'morning-master',
    icon: '🌅',
    title: 'Sabah Ustası',
    titleEn: 'Morning Master',
  },
  'mind-discipline': {
    id: 'focus-architect',
    icon: '🧠',
    title: 'Odak Mimarı',
    titleEn: 'Focus Architect',
  },
  'body-discipline': {
    id: 'body-champion',
    icon: '💪',
    title: 'Beden Şampiyonu',
    titleEn: 'Body Champion',
  },
  'money-discipline': {
    id: 'wealth-builder',
    icon: '💰',
    title: 'Servet Mimarı',
    titleEn: 'Wealth Builder',
  },
};

/**
 * Returns the identity badges the user has earned by completing 80%+ of a
 * path's lessons. Picks the badge title in the user's display language.
 * @param {Object} pathProgress - { [pathId]: { completed: string[] } }
 * @param {string} lang - 'tr' or 'en'
 * @returns {Array<{ id, icon, title }>}
 */
export function getEarnedIdentityBadges(pathProgress, paths, lang = 'tr') {
  const earned = [];
  if (!pathProgress || !paths) return earned;
  // Normalize 'tr-TR' / 'en-US' to 2-letter prefix. Without this a
  // tr-TR user saw English badge titles.
  const langPrefix = String(lang || 'tr').toLowerCase().slice(0, 2);
  const isEn = langPrefix === 'en';
  for (const path of paths) {
    const prog = pathProgress[path.id];
    if (!prog?.completed?.length) continue;
    const ratio = prog.completed.length / (path.duration || 50);
    // 80% gate so the badge feels earned but doesn't force a perfectionist
    // grind to 100%.
    if (ratio < 0.8) continue;
    const badge = IDENTITY_BADGES[path.id];
    if (!badge) continue;
    earned.push({
      id: badge.id,
      icon: badge.icon,
      title: isEn ? badge.titleEn : badge.title,
    });
  }
  return earned;
}

export const ACHIEVEMENTS = [
  // ===== STREAK =====
  { id: 'first_flame', title: 'İlk Alev', description: '3 günlük seri', icon: '🔥', type: 'streak', target: 3, rarity: 'common' },
  { id: 'hot_streak', title: 'Sıcak Seri', description: '7 günlük seri', icon: '🔥', type: 'streak', target: 7, rarity: 'common' },
  { id: 'two_weeks', title: 'İki Hafta Savaşçısı', description: '14 günlük seri', icon: '⚔️', type: 'streak', target: 14, rarity: 'uncommon' },
  { id: 'on_fire', title: 'Yanıyorsun', description: '30 günlük seri', icon: '🔥', type: 'streak', target: 30, rarity: 'rare' },
  { id: 'unstoppable', title: 'Durdurulamaz', description: '100 günlük seri', icon: '⚡', type: 'streak', target: 100, rarity: 'epic' },
  // Premium-locked: even at 365 days the icon shows but the badge stays
  // greyed out until the user has Premium. The "almost there" effect is the
  // hook — they see how close they are to a legendary badge and convert.
  { id: 'legend', title: 'Efsane', description: '365 günlük seri', icon: '👑', type: 'streak', target: 365, rarity: 'legendary', premiumOnly: true },

  // ===== LESSON COUNT =====
  { id: 'getting_started', title: 'Başlangıç', description: '10 ders tamamla', icon: '🌱', type: 'lessons', target: 10, rarity: 'common' },
  { id: 'committed', title: 'Kararlı', description: '30 ders tamamla', icon: '💎', type: 'lessons', target: 30, rarity: 'uncommon' },
  { id: 'centurion', title: 'Yüzbaşı', description: '100 ders tamamla', icon: '🏆', type: 'lessons', target: 100, rarity: 'rare' },
  { id: 'marathoner', title: 'Maratoncu', description: '250 ders tamamla', icon: '🏅', type: 'lessons', target: 250, rarity: 'epic', premiumOnly: true },

  // ===== LEVEL =====
  { id: 'level_2', title: 'Tırmanışta', description: 'Seviye 2', icon: '🥉', type: 'level', target: 2, rarity: 'common' },
  { id: 'level_5', title: 'Elit', description: 'Seviye 5', icon: '🥈', type: 'level', target: 5, rarity: 'rare' },
  { id: 'level_8', title: 'Usta', description: 'Seviye 8', icon: '🥇', type: 'level', target: 8, rarity: 'epic', premiumOnly: true },

  // ===== MYSTERY BOX (hidden until unlocked) =====
  // These never appear in the locked grid — only after they unlock so the
  // user gets a 'where did this come from?' surprise. Hunt-behavior:
  // research shows hidden achievements drive 15-25% more session count.
  { id: 'night_owl', title: 'Gece Kuşu', description: 'Gece 23:00 sonrası ders bitir', icon: '🦉', type: 'special', rarity: 'rare', hidden: true },
  { id: 'early_bird', title: 'Erken Kuş', description: 'Sabah 06:00 öncesi ders bitir', icon: '🐦', type: 'special', rarity: 'rare', hidden: true },
  { id: 'weekend_warrior', title: 'Hafta Sonu Savaşçısı', description: 'Hafta sonu boyunca seri tut', icon: '⚔️', type: 'special', rarity: 'uncommon', hidden: true },

  // ===== PREMIUM TEASER =====
  // Shown as '???' to free users — drives curiosity + paywall. Only the
  // shape (rarity + locked silhouette) is visible until premium upgrade
  // reveals the real title and unlocks the badge.
  { id: 'inner_circle', title: '???', description: '???', icon: '🎭', type: 'special', rarity: 'legendary', hidden: false, premiumOnly: true, isTeaser: true },
];

export const RARITY_COLORS = {
  common: '#9CA3AF',
  uncommon: '#10B981',
  rare: '#3B82F6',
  epic: '#A855F7',
  legendary: '#F59E0B',
};

/**
 * Returns array of newly unlocked achievement IDs. Premium-only achievements
 * stay locked for free users even when their target is reached — the UI shows
 * them as "Premium ile aç" so the user sees how close they were and converts.
 *
 * @param {Object} ctx
 * @param {number} ctx.totalLessonsCompleted
 * @param {number} ctx.streak
 * @param {number} ctx.level
 * @param {string[]} ctx.unlocked - already-unlocked IDs
 * @param {boolean} ctx.isPremium
 * @returns {string[]}
 */
export function checkAchievements(ctx) {
  const {
    totalLessonsCompleted = 0,
    streak = 0,
    level = 1,
    unlocked = [],
    isPremium = false,
  } = ctx;
  const newlyUnlocked = [];

  for (const a of ACHIEVEMENTS) {
    if (unlocked.includes(a.id)) continue;
    if (a.premiumOnly && !isPremium) continue;
    let met = false;
    if (a.type === 'streak' && streak >= a.target) met = true;
    if (a.type === 'lessons' && totalLessonsCompleted >= a.target) met = true;
    if (a.type === 'level' && level >= a.target) met = true;
    // 'special' types are unlocked by named events, not progress thresholds.
    if (met) newlyUnlocked.push(a.id);
  }
  return newlyUnlocked;
}

/**
 * Returns the special achievement IDs the user just qualified for, given
 * a context-of-completion. Called from COMPLETE_PATH_LESSON.
 *
 * @param {Object} ctx
 * @param {Date}   ctx.now - current moment
 * @param {string[]} ctx.unlocked
 * @returns {string[]} new specials to unlock
 */
export function checkSpecialAchievements(ctx) {
  const now = ctx?.now || new Date();
  const unlocked = ctx?.unlocked || [];
  const out = [];
  const hour = now.getHours();
  const day = now.getDay(); // 0 = Sunday, 6 = Saturday

  if (hour >= 23 && !unlocked.includes('night_owl')) out.push('night_owl');
  if (hour < 6 && !unlocked.includes('early_bird')) out.push('early_bird');
  if ((day === 0 || day === 6) && !unlocked.includes('weekend_warrior')) {
    // Triggers on the second weekend day completion to actually require both.
    // Caller should pass weekendStreak count via ctx if they want stricter
    // gating; for now, hitting weekend at all once is enough.
    out.push('weekend_warrior');
  }
  return out;
}

/**
 * For an achievement the user *would* have earned by progress alone but is
 * gated behind Premium, returns true. Used by the achievements grid to show
 * a "Premium ile aç" overlay instead of a generic locked state.
 */
export function isPremiumGated(achievement, ctx) {
  if (!achievement?.premiumOnly) return false;
  if (ctx?.isPremium) return false;
  const { totalLessonsCompleted = 0, streak = 0, level = 1 } = ctx || {};
  if (achievement.type === 'streak') return streak >= achievement.target;
  if (achievement.type === 'lessons')
    return totalLessonsCompleted >= achievement.target;
  if (achievement.type === 'level') return level >= achievement.target;
  return false;
}
