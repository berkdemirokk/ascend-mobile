// Reflection Mirror — a tiny "sage responds to your journal" feature.
// When the user writes a reflection, we scan the text for emotional /
// topical signals, then return a curated quote that resonates with
// what they wrote. No AI, no network — just a small dictionary mapping
// keyword clusters to Stoic / monk / wisdom quotes (multilingual).
//
// Why this matters: the reflection journal previously sat in a void —
// user wrote, app stored, app moved on. With the Mirror, the user
// FEELS heard. That's the emotional hook the app desperately needed
// (per user feedback: "didn't captivate me").
//
// Each topic has multiple quote candidates so the same keyword
// doesn't always echo back identical text — variety keeps it feeling
// alive, not scripted.

// Topic → keyword candidates (case-folded, substring match for TR + EN
// inflections) plus a pool of quotes the app reflects back.
const TOPICS = [
  {
    id: 'phone_addiction',
    keywords: ['telefon', 'instagram', 'tiktok', 'reels', 'scroll', 'youtube', 'phone', 'social media', 'screen', 'doomscroll'],
    quotesEn: [
      "The first step toward freedom is noticing the chain. — Stoic teaching",
      "You become the average of what you scroll past. — Anonymous",
      "Cutting one habit cleanly is faster than dulling it slowly. — Bruce Lee",
    ],
    quotesTr: [
      "Özgürlüğün ilk adımı, zinciri fark etmektir. — Stoik öğreti",
      "Kaydırdığın şeylerin ortalaması haline gelirsin. — Anonim",
      "Bir alışkanlığı keskin kesmek, yavaş köreltmekten daha hızlıdır. — Bruce Lee",
    ],
  },
  {
    id: 'fatigue_sleep',
    keywords: ['yorgun', 'uyku', 'uyuyam', 'enerji yok', 'tükenmiş', 'tired', 'sleep', 'exhausted', 'fatigue'],
    quotesEn: [
      "Rest is part of the work, not its opposite. — Anonymous",
      "He who has a sleep schedule has an advantage over half the world. — Modern stoic",
      "The body keeps the score. Listen before it shouts. — Bessel van der Kolk",
    ],
    quotesTr: [
      "Dinlenmek işin parçasıdır, karşıtı değil. — Anonim",
      "Uyku düzeni olan, dünyanın yarısına karşı avantajlıdır. — Modern stoik",
      "Beden hesabı tutar. Bağırmadan dinle. — Bessel van der Kolk",
    ],
  },
  {
    id: 'motivation_loss',
    keywords: ['motivasyon', 'isteksiz', 'umut', 'yıldım', 'pes', 'unmotivated', 'lost', 'no motivation', 'give up'],
    quotesEn: [
      "Discipline outlives motivation. Show up anyway. — Jocko Willink",
      "Motivation is what gets you started. Habit is what keeps you going. — Jim Rohn",
      "The man who can wait beats the man who can't. — Lao Tzu paraphrase",
    ],
    quotesTr: [
      "Disiplin motivasyondan uzun yaşar. Yine de orada ol. — Jocko Willink",
      "Motivasyon başlatır. Alışkanlık devam ettirir. — Jim Rohn",
      "Bekleyebilen, bekleyemeyeni yener. — Lao Tzu (yorum)",
    ],
  },
  {
    id: 'anger_frustration',
    keywords: ['kızgın', 'sinir', 'öfke', 'sabır', 'patladım', 'angry', 'frustrated', 'rage', 'patience'],
    quotesEn: [
      "How much more grievous are the consequences of anger than the causes of it. — Marcus Aurelius",
      "He who angers you, owns you. — Anonymous",
      "Speak when you are angry and you will make the best speech you will ever regret. — Ambrose Bierce",
    ],
    quotesTr: [
      "Öfkenin sonuçları, sebeplerinden ne kadar daha ağırdır. — Marcus Aurelius",
      "Seni kızdıran sana sahiptir. — Anonim",
      "Öfkeliyken konuşursan, hayatının en pişman olacağın konuşmasını yaparsın. — Ambrose Bierce",
    ],
  },
  {
    id: 'anxiety_fear',
    keywords: ['endişe', 'kaygı', 'korku', 'panik', 'anxiety', 'anxious', 'afraid', 'fear', 'worry'],
    quotesEn: [
      "We suffer more in imagination than in reality. — Seneca",
      "Worry is a cycle of inefficient thoughts whirling around a center of fear. — Corrie ten Boom",
      "Fear is interest paid on a debt you may not owe. — Mark Twain",
    ],
    quotesTr: [
      "Gerçeklikten çok hayalimizde acı çekeriz. — Seneca",
      "Endişe, korku merkezi etrafında dönen verimsiz düşünceler döngüsüdür. — Corrie ten Boom",
      "Korku, ödemeyebileceğin bir borcun faizidir. — Mark Twain",
    ],
  },
  {
    id: 'progress_growth',
    keywords: ['ilerle', 'değiş', 'büyü', 'gelişim', 'progress', 'change', 'growth', 'improve', 'better'],
    quotesEn: [
      "What we do every day matters more than what we do once in a while. — Gretchen Rubin",
      "Each day is a small life. — Schopenhauer",
      "Small disciplines repeated with consistency every day lead to great achievements. — John C. Maxwell",
    ],
    quotesTr: [
      "Her gün yaptıklarımız, ara sıra yaptıklarımızdan daha önemlidir. — Gretchen Rubin",
      "Her gün küçük bir hayattır. — Schopenhauer",
      "Tutarlılıkla tekrarlanan küçük disiplinler büyük başarılara götürür. — John C. Maxwell",
    ],
  },
  {
    id: 'discipline_focus',
    keywords: ['disiplin', 'odak', 'odakla', 'kararlı', 'discipline', 'focus', 'committed', 'commit'],
    quotesEn: [
      "Discipline equals freedom. — Jocko Willink",
      "We are what we repeatedly do. Excellence is not an act, but a habit. — Will Durant",
      "The successful warrior is the average man, with laser-like focus. — Bruce Lee",
    ],
    quotesTr: [
      "Disiplin özgürlüktür. — Jocko Willink",
      "Yaptığımız şeylerin tekrarıyız. Mükemmellik bir eylem değil, alışkanlıktır. — Will Durant",
      "Başarılı savaşçı, lazer odaklı sıradan bir adamdır. — Bruce Lee",
    ],
  },
];

// Fallback quotes when no keyword matches — generic encouragement for
// when the user wrote something we don't have a topic for. Better than
// "no response" — keeps the Mirror always populated.
const FALLBACK_EN = [
  "You wrote. You stayed. That's discipline. — Ascend",
  "Today you chose growth. Tomorrow that choice gets easier. — Ascend",
  "Reflection without action is theory. Action without reflection is noise. You did both. — Ascend",
];
const FALLBACK_TR = [
  "Yazdın. Kaldın. Bu disiplindir. — Ascend",
  "Bugün büyümeyi seçtin. Yarın bu seçim daha kolay olur. — Ascend",
  "Eylemsiz yansıma teoridir. Yansımasız eylem gürültüdür. Sen ikisini de yaptın. — Ascend",
];

/**
 * Reflect a quote back at the user based on their reflection text.
 *
 * @param {string} reflectionText  the raw journal entry
 * @param {string} lang            'tr', 'en', 'tr-TR', 'en-US', etc.
 * @returns {{ topicId: string|null, quote: string }}
 */
export const mirrorReflection = (reflectionText, lang = 'tr') => {
  // Normalize 'en-US', 'tr-TR' etc. to the 2-letter prefix. Caller
  // typically passes i18n.language directly, which may be a region
  // code. Without this normalization 'en-US' fell into the TR branch.
  const langPrefix = String(lang || 'tr').toLowerCase().slice(0, 2);
  const isEn = langPrefix === 'en';

  const text = String(reflectionText || '').toLowerCase().trim();
  if (!text) {
    const fallback = isEn ? FALLBACK_EN : FALLBACK_TR;
    return { topicId: null, quote: pickRandom(fallback) };
  }

  // Walk topics; first topic whose keywords appear in the text wins.
  // We don't try to score / rank — keeping it deterministic-feeling.
  for (const topic of TOPICS) {
    for (const kw of topic.keywords) {
      if (text.includes(kw)) {
        const pool = isEn ? topic.quotesEn : topic.quotesTr;
        return { topicId: topic.id, quote: pickRandom(pool) };
      }
    }
  }

  // No topic match → fallback.
  const fallback = isEn ? FALLBACK_EN : FALLBACK_TR;
  return { topicId: null, quote: pickRandom(fallback) };
};

const pickRandom = (arr) => {
  if (!arr || !arr.length) return '';
  return arr[Math.floor(Math.random() * arr.length)];
};
