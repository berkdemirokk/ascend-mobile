// Daily Mystery Challenge — a small bonus task surfaced once per day.
// Now personalized (v1.0.12): the picker honors the user's onboarding
// answers (mood + goal) when present, biasing toward challenges that
// match their current state and the path they're working on. Falls back
// to the date-hash deterministic pick when no signals are available.
//
// Translations live in mobile/src/i18n/locales/{tr,en}.json under
// dailyChallenges.<id>.title / .body. The default fallbacks here are TR.

// Intensity tiers used to align challenge difficulty with the user's
// onboarding "mood" answer:
//   1 = easy/gentle      → fresh, lost moods
//   2 = medium           → fresh, lost, motivated
//   3 = high effort      → motivated only
//
// Categories let the picker also match the user's onboarding "goal":
//   body, mind, money, social, detox
// (A challenge can be tagged with multiple categories where relevant.)

export const DAILY_CHALLENGES = [
  { id: 'cold_water', icon: '💧', tier: 3, categories: ['body', 'detox'], titleKey: 'dailyChallenges.cold_water.title', bodyKey: 'dailyChallenges.cold_water.body', titleFallback: 'Soğuk Su Şoku', bodyFallback: 'Bugün 30 saniye soğuk duş veya yüzünü soğuk suyla yıka.' },
  { id: 'phone_free_hour', icon: '📵', tier: 2, categories: ['detox', 'mind'], titleKey: 'dailyChallenges.phone_free_hour.title', bodyKey: 'dailyChallenges.phone_free_hour.body', titleFallback: 'Telefonsuz 1 Saat', bodyFallback: 'Bugün 1 saat boyunca telefonun başka odada kalsın.' },
  { id: 'walk_15', icon: '🚶', tier: 1, categories: ['body'], titleKey: 'dailyChallenges.walk_15.title', bodyKey: 'dailyChallenges.walk_15.body', titleFallback: '15 Dakika Yürü', bodyFallback: 'Bugün 15 dakika dışarıda, telefonsuz yürü.' },
  { id: 'pushup_20', icon: '💪', tier: 3, categories: ['body'], titleKey: 'dailyChallenges.pushup_20.title', bodyKey: 'dailyChallenges.pushup_20.body', titleFallback: '20 Şınav', bodyFallback: 'Bugün 20 şınav çek (3 sete bölebilirsin).' },
  { id: 'water_2l', icon: '🚰', tier: 1, categories: ['body'], titleKey: 'dailyChallenges.water_2l.title', bodyKey: 'dailyChallenges.water_2l.body', titleFallback: '2 Litre Su', bodyFallback: 'Bugün 2 litre su iç. Görünür şişede tut.' },
  { id: 'no_sugar', icon: '🍩', tier: 2, categories: ['body'], titleKey: 'dailyChallenges.no_sugar.title', bodyKey: 'dailyChallenges.no_sugar.body', titleFallback: 'Şekersiz Gün', bodyFallback: 'Bugün ek şeker yok — meyve hariç.' },
  { id: 'read_10', icon: '📖', tier: 1, categories: ['mind'], titleKey: 'dailyChallenges.read_10.title', bodyKey: 'dailyChallenges.read_10.body', titleFallback: '10 Sayfa Kitap', bodyFallback: 'Bugün herhangi bir kitaptan 10 sayfa oku.' },
  { id: 'breath_478', icon: '🌬️', tier: 1, categories: ['mind'], titleKey: 'dailyChallenges.breath_478.title', bodyKey: 'dailyChallenges.breath_478.body', titleFallback: '4-7-8 Nefes', bodyFallback: '4 saniye al, 7 saniye tut, 8 saniye ver. 4 tekrar.' },
  { id: 'sun_5', icon: '☀️', tier: 1, categories: ['body'], titleKey: 'dailyChallenges.sun_5.title', bodyKey: 'dailyChallenges.sun_5.body', titleFallback: 'Sabah Güneşi', bodyFallback: 'Sabah uyandıktan sonraki 1 saatte 5 dakika güneş ışığı al.' },
  { id: 'no_scroll', icon: '🚫', tier: 2, categories: ['detox'], titleKey: 'dailyChallenges.no_scroll.title', bodyKey: 'dailyChallenges.no_scroll.body', titleFallback: 'Sıfır Scroll', bodyFallback: 'Bugün TikTok / Reels / Shorts açma. Tek seferlik.' },
  { id: 'tidy_5', icon: '🧹', tier: 1, categories: ['mind'], titleKey: 'dailyChallenges.tidy_5.title', bodyKey: 'dailyChallenges.tidy_5.body', titleFallback: '5 Dakika Toparla', bodyFallback: 'Odanın en dağınık alanını 5 dakikada topla.' },
  { id: 'gratitude_3', icon: '🙏', tier: 1, categories: ['mind'], titleKey: 'dailyChallenges.gratitude_3.title', bodyKey: 'dailyChallenges.gratitude_3.body', titleFallback: '3 Şükran', bodyFallback: 'Bugün şükran duyduğun 3 şeyi yaz.' },
  { id: 'plank_60', icon: '🧘', tier: 3, categories: ['body'], titleKey: 'dailyChallenges.plank_60.title', bodyKey: 'dailyChallenges.plank_60.body', titleFallback: '60 Saniye Plank', bodyFallback: 'Tek sette 60 saniye plank tut.' },
  { id: 'no_complaint', icon: '🤐', tier: 2, categories: ['mind'], titleKey: 'dailyChallenges.no_complaint.title', bodyKey: 'dailyChallenges.no_complaint.body', titleFallback: 'Şikayetsiz Gün', bodyFallback: 'Bugün hiç kimseden / hiçbir şeyden şikayet etme.' },
  { id: 'compliment', icon: '💬', tier: 1, categories: ['social'], titleKey: 'dailyChallenges.compliment.title', bodyKey: 'dailyChallenges.compliment.body', titleFallback: 'Gerçek İltifat', bodyFallback: 'Tanıdığın birine düşünülmüş, gerçek bir iltifat yap.' },
  { id: 'no_caffeine_pm', icon: '☕', tier: 2, categories: ['body'], titleKey: 'dailyChallenges.no_caffeine_pm.title', bodyKey: 'dailyChallenges.no_caffeine_pm.body', titleFallback: 'Öğleden Sonra Kafeinsiz', bodyFallback: '14:00 sonrası kahve / çay / kola yok.' },
  { id: 'eye_contact', icon: '👀', tier: 1, categories: ['social'], titleKey: 'dailyChallenges.eye_contact.title', bodyKey: 'dailyChallenges.eye_contact.body', titleFallback: 'Göz Teması', bodyFallback: 'Bugün konuştuğun kişilere ekstra 1 saniye fazla göz temasında bulun.' },
  { id: 'wallet_audit', icon: '💵', tier: 2, categories: ['money'], titleKey: 'dailyChallenges.wallet_audit.title', bodyKey: 'dailyChallenges.wallet_audit.body', titleFallback: 'Cüzdan Denetimi', bodyFallback: 'Son 7 günün harcamalarına bak. Bir gereksiz alımı tespit et.' },
  { id: 'silent_meal', icon: '🍽️', tier: 2, categories: ['mind'], titleKey: 'dailyChallenges.silent_meal.title', bodyKey: 'dailyChallenges.silent_meal.body', titleFallback: 'Sessiz Yemek', bodyFallback: 'Bir öğünü telefon / TV / podcast olmadan ye.' },
  { id: 'unsub_1', icon: '✉️', tier: 1, categories: ['money', 'detox'], titleKey: 'dailyChallenges.unsub_1.title', bodyKey: 'dailyChallenges.unsub_1.body', titleFallback: 'Bir Abonelikten Çık', bodyFallback: 'E-posta gelen kutundan 1 spam aboneliğinden çık.' },
  { id: 'morning_quiet', icon: '🤫', tier: 2, categories: ['mind'], titleKey: 'dailyChallenges.morning_quiet.title', bodyKey: 'dailyChallenges.morning_quiet.body', titleFallback: 'Sessiz Sabah', bodyFallback: 'Sabahın ilk 30 dakikası: telefon yok, müzik yok, sadece sen.' },
  { id: 'pomodoro_2', icon: '🍅', tier: 3, categories: ['mind'], titleKey: 'dailyChallenges.pomodoro_2.title', bodyKey: 'dailyChallenges.pomodoro_2.body', titleFallback: '2 Pomodoro', bodyFallback: 'Bugün 2 × 25 dakika kesintisiz odaklanmış iş yap.' },
  { id: 'stretch_5', icon: '🤸', tier: 1, categories: ['body'], titleKey: 'dailyChallenges.stretch_5.title', bodyKey: 'dailyChallenges.stretch_5.body', titleFallback: '5 Dakika Esneme', bodyFallback: 'Bugün 5 dakika esneme egzersizi yap.' },
  { id: 'cold_call', icon: '📞', tier: 2, categories: ['social'], titleKey: 'dailyChallenges.cold_call.title', bodyKey: 'dailyChallenges.cold_call.body', titleFallback: 'Bir Aramayı Yap', bodyFallback: 'Erteliyor olduğun bir telefon görüşmesini şimdi yap.' },
  { id: 'one_decision', icon: '🎯', tier: 2, categories: ['mind'], titleKey: 'dailyChallenges.one_decision.title', bodyKey: 'dailyChallenges.one_decision.body', titleFallback: 'Tek Karar', bodyFallback: 'Bugün ertelediğin bir karara nokta koy.' },
  { id: 'zero_inbox', icon: '📥', tier: 2, categories: ['mind', 'money'], titleKey: 'dailyChallenges.zero_inbox.title', bodyKey: 'dailyChallenges.zero_inbox.body', titleFallback: 'Inbox Sıfır', bodyFallback: 'Bugün e-posta / mesaj kutunu sıfırla — yanıtla, sil veya arşivle.' },
  { id: 'gym_show_up', icon: '🏋️', tier: 3, categories: ['body'], titleKey: 'dailyChallenges.gym_show_up.title', bodyKey: 'dailyChallenges.gym_show_up.body', titleFallback: 'Sadece Git', bodyFallback: 'Spor salonuna sadece git — ne yaptığın önemli değil, gitmek önemli.' },
  { id: 'sleep_early', icon: '🌙', tier: 2, categories: ['body'], titleKey: 'dailyChallenges.sleep_early.title', bodyKey: 'dailyChallenges.sleep_early.body', titleFallback: '30 Dakika Erken', bodyFallback: 'Bu gece her zamankinden 30 dakika erken yat.' },
  { id: 'send_thank', icon: '💌', tier: 1, categories: ['social'], titleKey: 'dailyChallenges.send_thank.title', bodyKey: 'dailyChallenges.send_thank.body', titleFallback: 'Teşekkür Mesajı', bodyFallback: 'Sana son 1 yılda yardım etmiş birine "teşekkür ederim" yaz.' },
  { id: 'review_yesterday', icon: '🔄', titleKey: 'dailyChallenges.review_yesterday.title', tier: 1, categories: ['mind'], bodyKey: 'dailyChallenges.review_yesterday.body', titleFallback: 'Dünü Gözden Geçir', bodyFallback: '5 dakika dünkü gününü yaz: ne iyi gitti, ne kaçırdın?' },
];

// FNV-1a-like hash on the YYYY-MM-DD string so all devices pick the same
// challenge on the same date. No backend, no clock drift issues beyond the
// user's own timezone.
function hashDate(dateStr) {
  let h = 2166136261;
  for (let i = 0; i < dateStr.length; i++) {
    h ^= dateStr.charCodeAt(i);
    h = (h * 16777619) >>> 0;
  }
  return h;
}

// Mood → preferred intensity tiers. "Motivated" days get a chance at hard
// stuff; "lost" days protect the user with easier picks.
const MOOD_TIER_PREFS = {
  motivated: [3, 2, 1],
  fresh: [1, 2, 3],
  lost: [1, 2],
  // Defaults — no mood signal at all means "any"
  unknown: [1, 2, 3],
};

// Onboarding goal → preferred challenge categories.
const GOAL_CATEGORY_PREFS = {
  focus: ['mind'],
  morning: ['mind', 'body'],
  fitness: ['body'],
  money: ['money', 'detox'],
  discipline: ['detox', 'mind', 'body'],
};

/**
 * Pick today's challenge for the given date.
 *
 * @param {string}  dateStr  'YYYY-MM-DD'
 * @param {Object}  [opts]
 * @param {string|null} [opts.mood]   onboarding mood answer
 * @param {string|null} [opts.goal]   onboarding goal answer
 *
 * Algorithm:
 *   1. Filter pool to entries whose tier matches mood preference AND
 *      whose categories intersect with goal preference.
 *   2. If the filter eliminated everything (rare — happens when user
 *      has no answers), fall back to the full pool.
 *   3. Pick deterministically via the date hash mod pool size.
 *
 * The deterministic pick within the filtered subset still means the
 * same user sees the same challenge each day — we're not randomizing,
 * just narrowing the menu.
 */
export function getDailyChallenge(dateStr, opts = {}) {
  if (!DAILY_CHALLENGES.length) return null;
  const moodKey = opts.mood && MOOD_TIER_PREFS[opts.mood] ? opts.mood : 'unknown';
  const goalKey =
    opts.goal && GOAL_CATEGORY_PREFS[opts.goal] ? opts.goal : null;
  const allowedTiers = MOOD_TIER_PREFS[moodKey];
  const allowedCategories = goalKey ? GOAL_CATEGORY_PREFS[goalKey] : null;

  let pool = DAILY_CHALLENGES.filter((c) => {
    if (!allowedTiers.includes(c.tier)) return false;
    if (allowedCategories) {
      const overlap = (c.categories || []).some((cat) =>
        allowedCategories.includes(cat),
      );
      if (!overlap) return false;
    }
    return true;
  });

  // Defensive fallback — if filtering removed everything, use the full
  // pool. This keeps the function total.
  if (!pool.length) pool = DAILY_CHALLENGES;

  const idx = hashDate(dateStr) % pool.length;
  return pool[idx];
}

export const DAILY_CHALLENGE_BONUS_XP = 25;
