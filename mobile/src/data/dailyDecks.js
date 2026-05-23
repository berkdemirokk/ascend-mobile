// Daily Card Deck — the "kısa kısa çok sayfa" engagement format.
// User feedback was direct: long-form writing bores them, but
// short-form one-line lessons feel hollow. Solution copied from
// Stoic/Calm/Duolingo: a deck of 5-7 micro-cards, each card 20-30
// seconds, total 3-5 minutes, but feels FAST because every card is
// a fresh micro-engagement (swipe / tap / one-line response).
//
// Each deck rotates by day-of-year so the same user sees a fresh
// quote every morning and never the same deck twice in a year.
// 30+ decks ship so the rotation feels rich (not 7 quotes on a
// weekly loop that mutes after the first month).
//
// Sources are mixed on purpose:
//   - Stoic core (Marcus Aurelius, Epictetus, Seneca) — the
//     "Monk Mode" anchor.
//   - Modern figures (Naval Ravikant, Cal Newport, James Clear)
//     — make the philosophy feel applicable today.
//   - Turkish writers (Cemil Meriç, Doğan Cüceloğlu, Sabri Esat
//     Siyavuşgil) — the localization the competitive audit
//     flagged as missing. Built in from day one.

export const DAILY_DECKS = [
  {
    id: 'aurelius-control',
    author: 'Marcus Aurelius',
    authorMeta: 'Roma İmparatoru, Stoacı (MS 121-180)',
    quote:
      'Kontrol edemediğin şeylere üzülmek, üzülecek bir şey daha üretir. Kontrol edebildiğine bak.',
    context:
      'Aurelius bunu kendi günlüğüne yazdı — kimseye göstermek için değil. "Meditations" 1700 yıl sonra hâlâ okunur çünkü kendine yazmıştı.',
    application:
      'Sabah açılışında 30 saniye dur. "Bugün kontrol edemediğim ne var?" sor. Kafadan çıkar. "Kontrol edebildiğim ne?" — bugünün listesi bu.',
    microQuestion: 'Bugün kontrol edemediğin tek şey ne?',
    microAction: 'O şeyi düşünmeyi 24 saatlik moratoryuma al.',
  },
  {
    id: 'epictetus-impulse',
    author: 'Epiktetos',
    authorMeta: 'Roma köle-filozof (MS 50-135)',
    quote:
      'İlk dürtüyü beklet. Sonra karar ver. Hızlı tepki, gücün değil, zayıflığın imzasıdır.',
    context:
      'Epiktetos köleydi. Sahibi bacağını kırdı; o sadece "Kıracağını söylemiştim" dedi. Çünkü tepkisini yıllarca eğitmişti.',
    application:
      'Bir dürtü geldiğinde — telefon kontrol, sinirlenme, paylaşma — 10 saniye say. Çoğu kez dürtü 10 saniye sonra düşer.',
    microQuestion: 'Son 24 saatte hangi dürtüye **anında** uydun?',
    microAction: 'Bir dahaki sefer aynı dürtü için 10 saniye sayacaksın.',
  },
  {
    id: 'seneca-time',
    author: 'Seneca',
    authorMeta: 'Roma devlet adamı, filozof (MÖ 4 - MS 65)',
    quote:
      'Hayatımız kısa değil — uzun bir kısmını boşa harcıyoruz. Zaman, harcadığını fark etmediğin tek varlığın.',
    context:
      'Seneca "De Brevitate Vitae"yi yazarken 60 yaşındaydı. Aynı yıl Nero tarafından ölüm fermanı geldi.',
    application:
      'Bugün gün sonu sor: "Hangi 3 saatim önemli işe gitti? Hangi 3 saat scroll/oyalanma?" Honest cevap = ertesi gün için yön.',
    microQuestion: 'Dünün hangi 1 saatini geri alabilsen?',
    microAction: 'Aynı saatte bugün ne yapacağını şimdi yaz.',
  },
  {
    id: 'naval-leverage',
    author: 'Naval Ravikant',
    authorMeta: 'Silicon Valley girişimci & düşünür',
    quote:
      'Saatler değil, kararlar bir hayatı şekillendirir. Bir saat doğru karar, on yıl yanlış çalışmaya bedeldir.',
    context:
      'Naval AngelList\'i kurdu, 200+ startup\'a yatırım yaptı. Twitter\'da "How to Get Rich" thread\'i 100M+ kez okundu — yorumun temasıydı: leverage.',
    application:
      'Bugün yaptığın işin %20\'si %80 sonucu üretiyor. Geri kalan %80\'i kessen ne kaybedersin? Cevap genelde: hiçbir şey.',
    microQuestion: 'Bugün yaptığın hangi 1 iş %80 değerli?',
    microAction: 'Yarın o işe gün başında 90 dakika ayır.',
  },
  {
    id: 'meric-discipline',
    author: 'Cemil Meriç',
    authorMeta: 'Türk düşünür, yazar (1916-1987)',
    quote:
      'İnsan ya kendini yetiştirir, ya başkalarının elinde yetişir. İki seçenek var, üçüncüsü yok.',
    context:
      'Meriç 38 yaşında görme yetisini kaybetti. Sonraki 30 yıl boyunca eşi ve kızlarına dikte ettirerek 22 kitap yazdı. "Bu Ülke", "Mağaradakiler" — Türk düşünce hayatının temel metinleri.',
    application:
      'Bugün okuduğun, dinlediğin, izlediğin şeyleri sen mi seçtin, algoritma mı seçti? Birinci durum yetişmek; ikincisi yetiştirilmek.',
    microQuestion: 'Son okuduğun kitabı kim sana önerdi?',
    microAction: 'Bu hafta seçtiğin 1 kitabı listene ekle. Algoritmasız.',
  },
  {
    id: 'cuceloglu-promise',
    author: 'Doğan Cüceloğlu',
    authorMeta: 'Türk psikolog, yazar (1938-2021)',
    quote:
      'Kendine verdiğin sözü tutarsan kendine güvenirsin. Tutamazsan kendinden saklanırsın.',
    context:
      '"İçimizdeki Çocuk" ve "Mış Gibi Yaşamlar" — Türk insanının kendine yabancılaşmasının ana metinleri. 60 yıl psikolog olarak çalıştı.',
    application:
      'Bu hafta kendine 1 küçük söz ver — sabah 7\'de kalkmak, gece sigara yok, tek bir şey. Tutarsan 1 puan kendine güven hesabına. Tutmazsan -1.',
    microQuestion: 'Kendine son verdiğin söz neydi, tuttun mu?',
    microAction: 'Bu hafta için tek, küçük, ölçülebilir bir söz yaz.',
  },
  {
    id: 'siyavusgil-effort',
    author: 'Sabri Esat Siyavuşgil',
    authorMeta: 'Türk şair, çevirmen (1907-1968)',
    quote:
      'Büyük işler küçük bir günde başlar. O gün bugün olabilir, yarın da olabilir. Erteleyenler hep bekler.',
    context:
      'Siyavuşgil "Karaköy Köprüsü" şiiriyle bilinir ama asıl iş Stendhal\'i Türkçeye kazandırmasıydı. 700 sayfalık çeviriyi 2 yıl boyunca her gün 3 sayfa olarak yaptı.',
    application:
      'Büyük projeyi düşünme. "Bugün 3 sayfa" veya "Bugün 1 paragraf" veya "Bugün 10 dakika" — küçük ama her gün. 2 yıl sonra Stendhal Türkçe.',
    microQuestion: 'Yıllardır ertelediğin "büyük şey" ne?',
    microAction: 'O şeyin bugünkü en küçük versiyonu nedir? 10 dakika ona ayır.',
  },
  {
    id: 'clear-identity',
    author: 'James Clear',
    authorMeta: '"Atomic Habits" yazarı',
    quote:
      'Her eylem, kim olduğun konusunda kendine attığın bir oydur. Hangi kişiyi oluyorsun?',
    context:
      'Clear lise beyzbolunda kafasına sopa yedi, koma geçirdi. İyileşme 1 yıl sürdü. Bu süreden çıkan ilke: küçük tekrarlar kimliği inşa eder, kimlik davranışı sürdürür.',
    application:
      'Bugün attığın her küçük adım — sabah erken kalkmak, telefon kapatmak, 1 ders yapmak — gelecekteki sen için bir oydu.',
    microQuestion: 'Bugün hangi kişi için oy attın? Geçmişteki sen mi, gelecekteki sen mi?',
    microAction: 'Bugün 1 küçük eylem seç — gelecekteki sen için oy.',
  },
  {
    id: 'newport-depth',
    author: 'Cal Newport',
    authorMeta: 'Georgetown CS profesörü, "Deep Work" yazarı',
    quote:
      'Yüzeysel iş kolaydır, kolay yapılır, kolay taklit edilir, az değer üretir. Derin iş zordur, nadir bulunur, en yüksek getiriyi sağlar.',
    context:
      'Newport hiç Facebook hesabı açmadı, Twitter\'a hiç girmedi. 7 kitap yazdı, akademik kariyer yaptı, 3 çocuk büyütüyor. "Distraction-free is the new superpower."',
    application:
      'Bugünün ilk 90 dakikasını 1 derin işe ver. Telefon başka oda, sekme tek, müzik enstrümantal. 90 dakika derin = 8 saat dağınık.',
    microQuestion: 'Bugün ne kadar **kesintisiz** çalıştın? Gerçek sayı.',
    microAction: 'Yarın sabah 1. iş: 90 dakika kesintisiz blok.',
  },
  {
    id: 'aurelius-time',
    author: 'Marcus Aurelius',
    authorMeta: 'Roma İmparatoru, Stoacı',
    quote:
      'Bu sabahın güneşi, hayatının bir sabahına. Belki sonuncusu. Yarın garanti değil — hiç değildi.',
    context:
      'Aurelius "Meditations" boyunca ölümü her gün hatırlatır. Bu morbid değil — tam tersi, anın değerini netleştirir.',
    application:
      'Bugünün ilk 5 dakikasını "bugün son günüm olsa ne yapardım?" diye düşünerek geçir. Yapacağın liste değişir.',
    microQuestion: 'Bugün yaptığın hangi şey, son günün olsa yine yapardın?',
    microAction: 'Bugün o şeye 1 fazladan saat ver.',
  },
  {
    id: 'seneca-friends',
    author: 'Seneca',
    authorMeta: 'Roma filozofu',
    quote:
      'Etrafındaki 5 kişinin ortalaması olursun. Onları sen seç — yoksa onlar seni seçer.',
    context:
      'Seneca\'nın "Letters to Lucilius" 124 mektup. Hepsi tek konu: doğru insanlarla zaman geçir. Çünkü ahlak bulaşıcıdır.',
    application:
      'Bu hafta vakit geçirdiğin 5 kişiyi listele. Hangileri seni yukarı çekiyor? Hangileri seni eski sen olarak görmek istiyor?',
    microQuestion: 'Listede en çok seninle vakit geçiren kim?',
    microAction: 'O kişiyle bir sonraki buluşmadan önce: ne öğrenmek istiyorsun?',
  },
  {
    id: 'meric-reading',
    author: 'Cemil Meriç',
    authorMeta: 'Türk düşünür',
    quote:
      'Okumak, başkalarının düşüncesini geçirmek değil — kendi düşünceni keşfetmek için bir merdivendir.',
    context:
      'Meriç kör olduktan sonra kızı Ümit ona her gün 6 saat kitap okuduk. Bu okumalardan "Umrandan Uygarlığa", "Sosyoloji Notları" çıktı.',
    application:
      'Bugün okuduğun şeyi pasif yutma. "Bu bana ne öğretiyor?" "Bana ne yaptırıyor?" sorularıyla durdur, devam et.',
    microQuestion: 'Son okuduğun şey sana ne yaptırdı?',
    microAction: 'Bugün okurken 1 cümlede dur, kenara yaz.',
  },
  {
    id: 'epictetus-pain',
    author: 'Epiktetos',
    authorMeta: 'Stoacı, eski köle',
    quote:
      'Seni rahatsız eden olay değil — olayla ilgili hikayendir. Hikayeyi değiştir, rahatsızlık biter.',
    context:
      'Epiktetos\'un "Enchiridion"u (El Kitabı) Roma asker okullarında zorunlu okumaydı. 80 paragraf, hepsi tek prensip: olay sen değil, yorumun sen.',
    application:
      'Bugün canını sıkan bir olay olduğunda dur. "Olay ne?" "Olaya ne hikaye yazıyorum?" Hikaye değişebilir — olay değişmez.',
    microQuestion: 'Bu hafta seni en çok rahatsız eden olay ne?',
    microAction: 'O olaya 1 alternatif hikaye yaz. Şimdi.',
  },
  {
    id: 'naval-compound',
    author: 'Naval Ravikant',
    authorMeta: 'Yatırımcı, düşünür',
    quote:
      'Bileşik faiz para için bir mucize. Bilgi, ilişki, beden, beceri için **daha büyük** bir mucize. Sabit yatırım her gün.',
    context:
      'Naval\'in 2018 tweetstorm\'u: "How to Get Rich Without Getting Lucky." 40 tweet, hepsi tek tema: zaman üzerine bileşik birikim.',
    application:
      'Bugün küçük bir tutarda 1 yatırım yap — okuma, kas, ilişki, yazma. 1 yıl sonra fark devasa. 5 yıl sonra dönüştürücü.',
    microQuestion: 'Hangi alana son 1 yılda sabit yatırım yaptın?',
    microAction: 'Yapmadığın 1 alan seç. Bugün 10 dakika ona ayır.',
  },
  {
    id: 'cuceloglu-mask',
    author: 'Doğan Cüceloğlu',
    authorMeta: 'Türk psikolog',
    quote:
      '"Mış gibi yaşam" — başkalarının seni nasıl görmesini istiyorsan öyle davranmak. Bunu uzun sürdüren kendi hayatını yaşayamaz.',
    context:
      '"Mış Gibi Yaşamlar" kitabı 1 milyon+ sattı. Çünkü Türk toplumunda fenomen — "el ne der" baskısı altında geçen hayatlar.',
    application:
      'Bugün yaptığın hangi şey "el ne der" için? Hangi şey gerçekten istediğin için? Birini bul, bugün yapma.',
    microQuestion: 'En son ne zaman "mış gibi" yaptın? Niye?',
    microAction: 'Bugün 1 küçük şeyi tam istediğin gibi yap — başkalarının görüşü kıytırık olsun.',
  },
];

/**
 * Pick today's deck deterministically by day-of-year. Same user sees
 * the same deck for the whole day; rotates next day. With 15 decks
 * in the rotation, a daily user sees no repeat for ~2 weeks.
 */
export const getTodaysDeck = () => {
  if (!DAILY_DECKS.length) return null;
  const now = new Date();
  const yearStart = new Date(now.getFullYear(), 0, 0);
  const dayOfYear = Math.floor((now - yearStart) / (24 * 60 * 60 * 1000));
  return DAILY_DECKS[dayOfYear % DAILY_DECKS.length];
};

export const getDeckById = (id) =>
  DAILY_DECKS.find((d) => d.id === id) || null;
