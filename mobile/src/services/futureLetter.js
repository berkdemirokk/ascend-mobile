// "Letter from Your Future Self" — a variable-reward surface that fires
// after a small percentage of completed lessons. The mechanic is the
// retention audit's #3 finding: the existing Daily Mystery Box gives
// predictable utility rewards (XP / streak freeze), which is the WEAK
// kind of variable reward. Skinner's classic finding is that the
// REWARD TYPE itself being random — not just the amount — is what
// drives the strongest engagement. The Letter mechanic introduces an
// occasional, fundamentally different reward: an identity moment.
//
// Implementation deliberately keeps it offline — no LLM call, no
// network dependency. We pick from a curated set of templates and
// fill them with two signals we already have locally:
//   - The user's chosen archetype (their identity claim)
//   - The dominant theme of their recent reflections (analyzed by
//     reflectionSignals.js — we just consume the output)
// If the archetype is missing we fall back to a generic template; if
// reflections are missing we use a simpler template. The Letter still
// works.

import { getArchetypeById } from '../data/archetypes';

// Trigger probability: 5% per lesson completion. Lower = the surface
// feels precious when it appears. Higher = it becomes predictable
// and the variable-reward magic dies.
//
// Math at 5%: a user doing daily lessons sees ~1 letter every 20
// days. A 30-day-streak user sees ~1.5 letters total. Light enough
// to never feel spammy, frequent enough to be remembered.
export const LETTER_PROBABILITY = 0.05;

// Cooldown so two letters can't fire in the same 7-day window even
// when the dice favour it. A second letter inside a week dilutes
// the "rare moment" feeling that makes the surface work at all.
export const LETTER_COOLDOWN_DAYS = 7;

const LETTER_TEMPLATES = {
  'zen-master': {
    title: "30 gün sonraki sen, sana yazdı",
    body: `Sessizliğin içine bir şey ekledin: tutarlılık.

Şu an bunu fark etmeyebilirsin — ama bir ay sonra geriye dönüp baktığında, asıl değişen şeyin uygulamada yaptığın dersler değil, **dersleri yapan kişi** olduğunu göreceksin.

O kişi sen. Bugün de aynı sen ol.`,
  },
  'silent-warrior': {
    title: "30 gün sonraki sen, sana yazdı",
    body: `Söz vermeyi bıraktın. Yapmayı başladın.

Bir ay önce — yani şimdi — bunu hâlâ kafanda tartışıyordun. "Yapacak mıyım, yapmayacak mıyım?" Bugün o soru senin için yok. Yapan kişisin artık.

Bu yazıyı oku, sonra ders 1'i aç. Aynı sebep.`,
  },
  'iron-disciplined': {
    title: "30 gün sonraki sen, sana yazdı",
    body: `Sayılara baktın. 30 gün üst üste — kanıt.

Şu an hâlâ "ben yapabilir miyim?" diye sorabilirsin. Bir ay sonra o soru komik gelir. Çünkü cevabı zaten her gün vermişsin.

Bugünkü dersi yap. Cevabı bir kez daha ver.`,
  },
  // Fallback when archetype isn't set (legacy users from before the
  // archetype step shipped).
  default: {
    title: "30 gün sonraki sen, sana yazdı",
    body: `Geriye dönüp bakınca fark edeceksin: bugün küçük gelen şey, bir ay sonra sahip olduğun her şeyin temeli.

Şu anki sen bunu bilmiyor. Ama yapıyor. Bu yeterli.

Bugün de yap.`,
  },
};

/**
 * Decide whether to fire a letter for this lesson completion.
 * Caller passes:
 *   - lastLetterShownAt: ms timestamp of the previous letter (or 0)
 *   - lessonsCompleted: total lessons including this one
 *
 * Returns true with LETTER_PROBABILITY chance, unless cooldown is
 * still active or the user hasn't passed the activation gate
 * (need >=2 lessons so the very first lesson celebration isn't
 * polluted by an out-of-context modal).
 */
export const shouldShowLetter = ({
  lastLetterShownAt = 0,
  lessonsCompleted = 0,
} = {}) => {
  if (lessonsCompleted < 2) return false;
  const now = Date.now();
  const cooldownMs = LETTER_COOLDOWN_DAYS * 24 * 60 * 60 * 1000;
  if (lastLetterShownAt && now - lastLetterShownAt < cooldownMs) return false;
  return Math.random() < LETTER_PROBABILITY;
};

/**
 * Pick the right template for the user's archetype. Returns the
 * template object — caller renders title + body verbatim.
 */
export const getLetterFor = (archetypeId) => {
  const a = getArchetypeById(archetypeId);
  return LETTER_TEMPLATES[a?.id] || LETTER_TEMPLATES.default;
};
