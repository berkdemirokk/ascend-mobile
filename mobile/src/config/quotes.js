// Daily discipline quotes — rotating Stoic + monk + warrior wisdom shown
// on the Home screen. One quote per day (deterministic via date hash so
// every device shows the same quote on the same day), refreshed every
// midnight. 35 entries = ~5 weeks of unique quotes before the cycle.
//
// Each quote is keyed (id + en + tr + author) so we can translate at
// runtime via i18n.getCurrentLanguage(). Authors are intentionally short
// — Apple's screen real estate is tight.

export const QUOTES = [
  {
    id: 1,
    en: 'You have power over your mind — not outside events. Realize this, and you will find strength.',
    tr: 'Aklının üzerinde gücün var — dış olayların değil. Bunu fark et, gücü bulursun.',
    author: 'Marcus Aurelius',
  },
  {
    id: 2,
    en: 'Discipline is the bridge between goals and accomplishment.',
    tr: 'Disiplin, hedeflerle başarı arasındaki köprüdür.',
    author: 'Jim Rohn',
  },
  {
    id: 3,
    en: 'We suffer more often in imagination than in reality.',
    tr: 'Gerçeklikten çok hayalimizde acı çekeriz.',
    author: 'Seneca',
  },
  {
    id: 4,
    en: 'The successful warrior is the average man, with laser-like focus.',
    tr: 'Başarılı savaşçı, lazer odaklı sıradan bir adamdır.',
    author: 'Bruce Lee',
  },
  {
    id: 5,
    en: 'It is not what happens to you, but how you react to it that matters.',
    tr: 'Önemli olan başına ne geldiği değil, ona nasıl tepki verdiğindir.',
    author: 'Epictetus',
  },
  {
    id: 6,
    en: 'A man who conquers himself is greater than one who conquers a thousand men in battle.',
    tr: 'Kendini fetheden adam, savaşta bin adamı yenenden büyüktür.',
    author: 'Buddha',
  },
  {
    id: 7,
    en: 'The chains of habit are too weak to be felt until they are too strong to be broken.',
    tr: 'Alışkanlığın zincirleri, hissedilemeyecek kadar zayıfken kırılamayacak kadar güçlü hâle gelir.',
    author: 'Samuel Johnson',
  },
  {
    id: 8,
    en: 'Waste no more time arguing what a good man should be. Be one.',
    tr: 'İyi bir adamın nasıl olması gerektiğini tartışarak vakit harcama. Ol.',
    author: 'Marcus Aurelius',
  },
  {
    id: 9,
    en: 'Suffering is not enough. Life is both dreadful and wonderful.',
    tr: 'Acı yetmez. Hayat hem korkunç hem harikadır.',
    author: 'Thich Nhat Hanh',
  },
  {
    id: 10,
    en: 'Do every act of your life as though it were the last act of your life.',
    tr: 'Hayatının her eylemini son eylemin gibi yap.',
    author: 'Marcus Aurelius',
  },
  {
    id: 11,
    en: 'No man is free who is not master of himself.',
    tr: 'Kendine hakim olmayan hiç kimse özgür değildir.',
    author: 'Epictetus',
  },
  {
    id: 12,
    en: 'The pain you feel today is the strength you feel tomorrow.',
    tr: 'Bugün hissettiğin acı, yarın hissedeceğin güçtür.',
    author: 'Anonymous',
  },
  {
    id: 13,
    en: 'Difficulties strengthen the mind, as labor does the body.',
    tr: 'Zorluklar zihni güçlendirir, emek bedeni güçlendirdiği gibi.',
    author: 'Seneca',
  },
  {
    id: 14,
    en: 'He who is not a good servant will not be a good master.',
    tr: 'İyi bir hizmetkâr olmayan iyi bir efendi olamaz.',
    author: 'Plato',
  },
  {
    id: 15,
    en: 'The best revenge is to be unlike him who performed the injury.',
    tr: 'En iyi intikam, sana zarar verene benzemekten kaçınmaktır.',
    author: 'Marcus Aurelius',
  },
  {
    id: 16,
    en: 'Empty your cup so that it may be filled; become devoid to gain totality.',
    tr: 'Bardağını boşalt ki dolabilsin; bütüne kavuşmak için kendini boşalt.',
    author: 'Bruce Lee',
  },
  {
    id: 17,
    en: 'First say to yourself what you would be; and then do what you have to do.',
    tr: 'Önce kendine ne olmak istediğini söyle; sonra yapman gerekeni yap.',
    author: 'Epictetus',
  },
  {
    id: 18,
    en: 'Every new beginning comes from some other beginning\'s end.',
    tr: 'Her yeni başlangıç, başka bir başlangıcın sonundan gelir.',
    author: 'Seneca',
  },
  {
    id: 19,
    en: 'If it is not right, do not do it; if it is not true, do not say it.',
    tr: 'Doğru değilse yapma; doğru değilse söyleme.',
    author: 'Marcus Aurelius',
  },
  {
    id: 20,
    en: 'The mind, when housed within a healthy body, possesses a glorious sense of power.',
    tr: 'Sağlıklı bir bedende konaklayan zihin, görkemli bir güç hissine sahiptir.',
    author: 'Joseph Pilates',
  },
  {
    id: 21,
    en: 'I judge you unfortunate because you have never lived through misfortune.',
    tr: 'Seni şanssız sayarım, çünkü hiçbir zorluk yaşamadın.',
    author: 'Seneca',
  },
  {
    id: 22,
    en: 'The impediment to action advances action. What stands in the way becomes the way.',
    tr: 'Eyleme engel olan şey eylemi ilerletir. Yolu engelleyen, yolun kendisi olur.',
    author: 'Marcus Aurelius',
  },
  {
    id: 23,
    en: 'Knowing yourself is the beginning of all wisdom.',
    tr: 'Kendini tanımak, tüm bilgeliğin başlangıcıdır.',
    author: 'Aristotle',
  },
  {
    id: 24,
    en: 'A goal without a plan is just a wish.',
    tr: 'Plansız bir hedef sadece bir dilektir.',
    author: 'Antoine de Saint-Exupéry',
  },
  {
    id: 25,
    en: 'It does not matter how slowly you go as long as you do not stop.',
    tr: 'Ne kadar yavaş gittiğin önemli değil — durmadığın sürece.',
    author: 'Confucius',
  },
  {
    id: 26,
    en: 'You can have results or excuses. Not both.',
    tr: 'Sonuçların veya bahanelerin olabilir. İkisi birden değil.',
    author: 'Arnold Schwarzenegger',
  },
  {
    id: 27,
    en: 'Be water, my friend.',
    tr: 'Su gibi ol, dostum.',
    author: 'Bruce Lee',
  },
  {
    id: 28,
    en: 'Patience is bitter, but its fruit is sweet.',
    tr: 'Sabır acıdır ama meyvesi tatlıdır.',
    author: 'Aristotle',
  },
  {
    id: 29,
    en: 'No tree, it is said, can grow to heaven unless its roots reach down to hell.',
    tr: 'Hiçbir ağaç, kökleri cehenneme uzanmadan göklere yükselemez.',
    author: 'Carl Jung',
  },
  {
    id: 30,
    en: 'The journey of a thousand miles begins with a single step.',
    tr: 'Bin millik yolculuk tek bir adımla başlar.',
    author: 'Lao Tzu',
  },
  {
    id: 31,
    en: 'Do what you can, with what you have, where you are.',
    tr: 'Olduğun yerde, elindekiyle, yapabildiğini yap.',
    author: 'Theodore Roosevelt',
  },
  {
    id: 32,
    en: 'The man who moves a mountain begins by carrying away small stones.',
    tr: 'Dağı yerinden oynatan adam, küçük taşları taşıyarak başlar.',
    author: 'Confucius',
  },
  {
    id: 33,
    en: 'Discipline equals freedom.',
    tr: 'Disiplin özgürlüktür.',
    author: 'Jocko Willink',
  },
  {
    id: 34,
    en: 'What we do every day matters more than what we do once in a while.',
    tr: 'Her gün yaptıklarımız, ara sıra yaptıklarımızdan daha önemlidir.',
    author: 'Gretchen Rubin',
  },
  {
    id: 35,
    en: 'Fall seven times, stand up eight.',
    tr: 'Yedi kez düş, sekiz kez kalk.',
    author: 'Japanese proverb',
  },
];

/**
 * Get today's quote — deterministic by date so every device shows the
 * same quote on the same calendar day. Cycle resets every 35 days.
 *
 * @param {Date} [now] override for testing.
 */
export const getDailyQuote = (now = new Date()) => {
  // Day-of-year mod length → stable rotation that doesn't depend on
  // year start (would jump on Jan 1 otherwise; this still rotates daily).
  const start = new Date(now.getFullYear(), 0, 0);
  const diff = now - start;
  const dayOfYear = Math.floor(diff / (1000 * 60 * 60 * 24));
  return QUOTES[dayOfYear % QUOTES.length];
};
