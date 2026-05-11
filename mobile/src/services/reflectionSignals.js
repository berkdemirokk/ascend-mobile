// Reflection keyword analyzer — a tiny on-device "what does this user
// actually care about" inference engine. No AI, no backend, no ML — just
// substring matching against a curated vocabulary mapped onto the same
// discipline categories used by daily-challenge filtering.
//
// Why: the onboarding "goal" answer is a one-time snapshot. After the
// user has completed a dozen lessons and written reflections, we can
// listen to what they're actually focusing on and tune content accordingly.
// (E.g. they picked "general discipline" at install but every reflection
// mentions phone/instagram — they really want dopamine detox.)
//
// Output: a `categoryWeights` object keyed by daily-challenge category.
// Higher = more frequently mentioned across reflections. Consumers can
// use it to bias the daily challenge picker, suggest related paths, or
// just rank recommendations.

// Keyword vocabulary. Each entry maps a list of substrings (case-folded)
// to the category it signals. Both Turkish and English forms covered.
// Substrings rather than whole words so we catch inflections (telefonum,
// telefonsuz, phones, phoning, etc.) without per-language stemming.
const VOCAB = [
  {
    category: 'detox',
    needles: [
      // TR
      'telefon', 'sosyal medya', 'instagram', 'tiktok', 'reels',
      'youtube', 'scroll', 'kayd', 'dopamin', 'porno',
      // EN
      'phone', 'social media', 'screen time', 'doomscroll',
    ],
  },
  {
    category: 'body',
    needles: [
      // TR
      'uyku', 'uyu', 'yemek', 'beslenme', 'spor', 'yürü',
      'koşu', 'antren', 'şınav', 'kalo', 'kilo', 'su iç',
      // EN
      'sleep', 'workout', 'gym', 'run', 'walk', 'pushup',
      'calorie', 'weight', 'water', 'meal',
    ],
  },
  {
    category: 'mind',
    needles: [
      // TR
      'odak', 'odakla', 'meditas', 'farkında', 'okuma', 'kitap',
      'düşün', 'huzur', 'sakin', 'soğuk kanlı',
      // EN
      'focus', 'meditat', 'mindful', 'read', 'book',
      'think', 'calm', 'patience',
    ],
  },
  {
    category: 'money',
    needles: [
      // TR
      'para', 'harca', 'birikim', 'tasarruf', 'borç', 'kahve',
      'kafein', 'kahvaltı dışarıda',
      // EN
      'money', 'spend', 'save', 'savings', 'debt',
      'coffee', 'caffeine',
    ],
  },
  {
    category: 'social',
    needles: [
      // TR
      'aile', 'arkadaş', 'sevgili', 'eş', 'çocuk', 'iletişim',
      'göz teması', 'iltifat',
      // EN
      'family', 'friend', 'partner', 'wife', 'husband',
      'kid', 'eye contact', 'compliment',
    ],
  },
];

/**
 * Analyze all reflection texts and return weights per category.
 *
 * @param {string[]} reflectionTexts  array of raw reflection strings
 * @returns {Object<string, number>}  e.g. { detox: 3, body: 5, mind: 1 }
 */
export const analyzeReflections = (reflectionTexts) => {
  const weights = { detox: 0, body: 0, mind: 0, money: 0, social: 0 };
  if (!Array.isArray(reflectionTexts) || !reflectionTexts.length) {
    return weights;
  }
  for (const raw of reflectionTexts) {
    if (typeof raw !== 'string' || !raw.trim()) continue;
    const text = raw.toLowerCase();
    for (const { category, needles } of VOCAB) {
      for (const needle of needles) {
        if (text.includes(needle)) {
          weights[category] += 1;
          // One hit per category per reflection — prevents a single
          // long reflection from dominating signals by repeating a word.
          break;
        }
      }
    }
  }
  return weights;
};

/**
 * Pick the strongest category from analyzed weights. Returns null if the
 * user hasn't written enough to produce a confident signal (default
 * threshold: 3 hits across all reflections).
 */
export const dominantReflectionCategory = (
  weights,
  { minHits = 3 } = {},
) => {
  if (!weights) return null;
  let best = null;
  let bestCount = 0;
  for (const [cat, count] of Object.entries(weights)) {
    if (count > bestCount) {
      best = cat;
      bestCount = count;
    }
  }
  if (bestCount < minHits) return null;
  return best;
};

/**
 * Flatten the user's pathProgress reflections map into a flat array of
 * strings, ready to feed into analyzeReflections. Skips empty entries.
 */
export const collectReflectionTexts = (pathProgress) => {
  if (!pathProgress) return [];
  const out = [];
  for (const path of Object.values(pathProgress)) {
    if (!path?.reflections) continue;
    for (const text of Object.values(path.reflections)) {
      if (typeof text === 'string' && text.trim()) out.push(text);
    }
  }
  return out;
};
