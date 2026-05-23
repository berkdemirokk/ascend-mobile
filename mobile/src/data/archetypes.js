// Identity Archetypes — surfaced at onboarding.
//
// The retention audit's #2 finding was that the app never asks the user
// "who are you becoming?" — the strongest retention lift in habit apps
// comes from identity-based framing (James Clear, Atomic Habits ch.2):
// "I'm becoming a disciplined person" beats "I want to be disciplined"
// roughly 2× on long-term adherence.
//
// At onboarding we pick one of three archetypes. The choice is then
// echoed back in:
//   - HomeScreen greeting ("Sessiz Savaşçı, günaydın")
//   - Notifications (re-engagement push variants address the archetype)
//   - Transformation report ("12 gün kaldı Sessiz Savaşçı olmana")
//
// Three options is the sweet spot — fewer feels token, more triggers
// decision fatigue. Each archetype maps to a tone/style cluster, not a
// content filter: the lesson library is the same for everyone.

export const ARCHETYPES = [
  {
    id: 'zen-master',
    icon: 'self-improvement', // MaterialIcons name
    accent: '#7F9CF5', // calm indigo
    // i18n keys (fallbacks in app code):
    nameKey: 'archetypes.zenMaster.name',
    nameFallback: 'Zen Müderris',
    tagKey: 'archetypes.zenMaster.tag',
    tagFallback: 'Sessizlik. İç odak. Sade hareket.',
    descKey: 'archetypes.zenMaster.desc',
    descFallback:
      'Acele etmiyorsun. Sessizlikte güçleniyorsun. Sade rutinlere bağlısın.',
  },
  {
    id: 'silent-warrior',
    icon: 'shield', // MaterialIcons
    accent: '#475569', // steel slate
    nameKey: 'archetypes.silentWarrior.name',
    nameFallback: 'Sessiz Savaşçı',
    tagKey: 'archetypes.silentWarrior.tag',
    tagFallback: 'Soğukkanlı. Kararlı. Tek başına gider.',
    descKey: 'archetypes.silentWarrior.desc',
    descFallback:
      'Söz vermek yerine yapıyorsun. Yorgun düşmeyen, dik duran sen.',
  },
  {
    id: 'iron-disciplined',
    icon: 'fitness-center', // MaterialIcons
    accent: '#DC2626', // brand red
    nameKey: 'archetypes.ironDisciplined.name',
    nameFallback: 'Demir Disiplinli',
    tagKey: 'archetypes.ironDisciplined.tag',
    tagFallback: 'Sert hedef. Takip. Sınır tanımayan irade.',
    descKey: 'archetypes.ironDisciplined.desc',
    descFallback:
      'Sayılarla ölçüyorsun. Zorluk seni canlandırıyor. 100 günü 100 günde bitirirsin.',
  },
];

export const DEFAULT_ARCHETYPE_ID = 'silent-warrior';

export const getArchetypeById = (id) =>
  ARCHETYPES.find((a) => a.id === id) ||
  ARCHETYPES.find((a) => a.id === DEFAULT_ARCHETYPE_ID);
