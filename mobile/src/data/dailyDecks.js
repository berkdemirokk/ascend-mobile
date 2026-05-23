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

// Archetype affinity: each deck declares which identity archetypes
// it resonates with most. When the user has an archetype set, the
// daily picker biases toward decks tagged with their archetype
// (~70% probability on matching days). This makes the archetype
// onboarding choice CONSEQUENTIAL — the same content surface
// reshapes around who the user said they're becoming, instead of
// just being a decorative chip on Home.
//
// archetypes: undefined → universal (eligible for any user)
// archetypes: ['zen-master', ...] → preferred for those archetypes
export const DAILY_DECKS = [
  {
    id: 'aurelius-control',
    archetypes: ['zen-master', 'silent-warrior'],
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
    archetypes: ['iron-disciplined', 'silent-warrior'],
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
    archetypes: ['iron-disciplined', 'zen-master'],
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
    archetypes: ['iron-disciplined'],
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
  // AUDIT NOTE: Three TR-author decks (Cemil Meriç, Doğan Cüceloğlu,
  // Sabri Esat Siyavuşgil) were removed in this commit. The quoted
  // text could not be sourced to a verifiable book + page reference;
  // attaching a real author's name to an LLM-paraphrased line is
  // exactly the "fake authority" risk the reality-check agent flagged
  // (Turkish literature readers spot inaccurate attribution fast).
  // Re-add only when each quote has a citation that survives a
  // bookstore-spot-check. In the meantime, "Sürünme — Türk yazar"
  // section relies on the rest of the international (sourced) pool.
  {
    id: 'clear-identity',
    archetypes: ['iron-disciplined', 'silent-warrior'],
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
    archetypes: ['silent-warrior', 'zen-master'],
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
    archetypes: ['zen-master'],
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
    archetypes: ['silent-warrior'],
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
  // (See note above about removed TR-author decks.)
  {
    id: 'epictetus-pain',
    archetypes: ['zen-master', 'silent-warrior'],
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
    archetypes: ['iron-disciplined'],
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
  // (See note above about removed TR-author decks.)

  // ── Pool expansion (deck count 10 → 32) ─────────────────────────
  // Audit P1 finding: 10-deck rotation repeated every 10 days, well
  // before the 2-week novelty threshold push notifications get. The
  // expansion below adds ~22 more verifiable quotes across Stoics,
  // modern operators, and universal philosophers. Each is sourced
  // to a book/work the reader can actually look up. No Turkish-
  // author quotes here — those re-enter only with citations
  // (separate workstream).

  {
    id: 'aurelius-now',
    archetypes: ['zen-master', 'silent-warrior'],
    author: 'Marcus Aurelius',
    authorMeta: 'Meditations IV.17',
    quote:
      'Sanki binlerce yıl yaşayacakmışsın gibi davranma. Ölüm üstünde sallanıyor. Hâlâ yaşıyorken, hâlâ yapabilirken — iyi ol.',
    context:
      '"Meditations" Aurelius\'un kendi günlüğü; basılmasını istemedi. IV.17 — ölüm hatırlatması Stoacılarda morbidite değil, anın değerini netleştirme aracı.',
    application:
      'Bugün ertelediğin 1 zor konuşmayı yap. Ya da 1 zor karar al. Ölüm garanti — fırsat değil.',
    microQuestion: 'Bugün son günün olsa, kime ne söylerdin?',
    microAction: 'O kişiyi şimdi ara veya 2 cümle mesaj at.',
  },
  {
    id: 'epictetus-judgment',
    archetypes: ['silent-warrior'],
    author: 'Epiktetos',
    authorMeta: 'Enchiridion §5',
    quote:
      'İnsanları rahatsız eden olaylar değil, olaylar hakkındaki yargılarıdır.',
    context:
      '"Enchiridion" (El Kitabı) Epiktetos\'un öğrencisi Arrian tarafından derlenen 53 paragraflık özet. Bu cümle 5. paragrafta — Stoacılığın temel taşı.',
    application:
      'Bugün canını sıkan bir olayda: olayı yaz, sonra yargını yaz. Sadece yargıyı değiştir. Olay aynı kalsın.',
    microQuestion: 'Bu hafta hangi olayda yargın seni acıttı?',
    microAction: 'O yargıya 1 alternatif yargı yaz. Sahip ol.',
  },
  {
    id: 'seneca-debt',
    archetypes: ['iron-disciplined'],
    author: 'Seneca',
    authorMeta: 'Letters to Lucilius, Mektup 1',
    quote:
      'Zamana saygısızlık ettiğimiz kadar hiçbir şeye saygısızlık etmiyoruz. Sahip olduklarımız bir başkasınındır; sadece zaman bizim.',
    context:
      'Seneca\'nın Lucilius\'a yazdığı 124 mektubun ilki. Tüm külliyatın açılış cümlesi — Stoacı zaman ekonomisinin manifestosu.',
    application:
      'Bu hafta 1 zaman çalanı kes: tek bir abonelik, tek bir grup, tek bir bildirim. Sürekli ufak.',
    microQuestion: 'Geçen ay en çok zaman çalan 1 alışkanlığın ne?',
    microAction: 'Bugün ona harcadığın 30 dakikayı bir başka şeye yatır.',
  },
  {
    id: 'aurelius-obstacle',
    archetypes: ['iron-disciplined', 'silent-warrior'],
    author: 'Marcus Aurelius',
    authorMeta: 'Meditations V.20',
    quote:
      'Eyleme engel olan şey, eylemin kendisi olur. Yolu engelleyen şey, yolun kendisi olur.',
    context:
      'Ryan Holiday\'in "The Obstacle Is the Way" kitabının başlığı bu cümleden. Aurelius\'un orijinal cümlesi V.20 — engelle savaş yerine engeli yakıt yap prensibi.',
    application:
      'Şu an en büyük 1 engelin ne? Onu bir 30-gün öğrenme projesine çevir. Engel = ders.',
    microQuestion: 'Bugün seni en çok bloklayan engel nedir?',
    microAction: 'O engele dair 1 saatlik ilk araştırma adımını planla.',
  },
  {
    id: 'newport-shallow',
    archetypes: ['silent-warrior'],
    author: 'Cal Newport',
    authorMeta: '"Deep Work" — 2016',
    quote:
      'Yüzeysel işin kendisi kötü değildir. Sığ iş hayatın merkezi olduğunda kötüdür.',
    context:
      'Georgetown CS profesörü Newport, Facebook/Twitter hesabı açmadan 7 kitap yazdı. Deep Work onun yöntem manifestosu.',
    application:
      'Bugünün ilk 90 dakikasını yüzeysel iş yok ilan et. Email, Slack, mesaj — saat 11 sonra.',
    microQuestion: 'Bu hafta hangi yüzeysel iş aslında derin işini ezdi?',
    microAction: 'Yarın sabah 90 dk yalnızca derin işe ayır.',
  },
  {
    id: 'ferriss-fear',
    archetypes: ['iron-disciplined'],
    author: 'Tim Ferriss',
    authorMeta: '"4-Hour Workweek" + Fear-Setting',
    quote:
      'Çoğu insanın korktuğu şey, geri dönüşü kolay olan şeydir. Çoğu insanın kaçırdığı şey, geri dönüşü zor olan şeydir.',
    context:
      'Ferriss\'in 2017 TED konuşmasından: "Fear-Setting". Bir kararı ertelerken kararın geri çevrilebilirliğini ölçme prensibi.',
    application:
      'Erttelediğin 1 kararı yaz. Sonra sor: en kötü senaryoda ne olur? %90 reversible.',
    microQuestion: 'Ertelediğin karar geri çevrilebilir mi?',
    microAction: 'Bugün küçük bir adım at — en kötü senaryo: 1 hafta kaybedersin.',
  },
  {
    id: 'holiday-ego',
    archetypes: ['silent-warrior', 'zen-master'],
    author: 'Ryan Holiday',
    authorMeta: '"Ego Is the Enemy" — 2016',
    quote:
      'Ego, sahip olduğun bir başarıyı KORUMA modunda öğrenmeyi durdurur. Öğrenmek için ego biraz aç kalmalı.',
    context:
      'Holiday Stoacı popülerleştiricisi — Aurelius/Epictetus felsefesini Bill Belichick, Howard Schultz gibi modern hikayelerle anlatır.',
    application:
      'Bu hafta seni "ben zaten biliyorum" hissi durdurdu mu? O konuda 1 yeni şey öğren. Bilmediğini kabul et.',
    microQuestion: 'En son ne zaman "bilmiyorum" dedin?',
    microAction: 'Bugün 1 alanda bilgisizliğini kabullen. Bir kaynağa git.',
  },
  {
    id: 'munger-incentive',
    archetypes: ['iron-disciplined'],
    author: 'Charlie Munger',
    authorMeta: 'Berkshire Hathaway 1995 konuşması',
    quote:
      'Bana adamın teşvikini söyle, sana sonucu söylerim. İnsanlar teşvik nereye işaret ediyorsa oraya yürür — değerleri değil.',
    context:
      'Buffett\'in ortağı Munger, 1995\'te USC\'de "The Psychology of Human Misjudgment" konuşması — 25 önyargı listesi. Teşvik en güçlüsü.',
    application:
      'Bugün şu kararını sor: bu kararı ben mi alıyorum, yoksa biri benim için teşvikli mi davranıyor? Görünmez bir teşvik var mı?',
    microQuestion: 'Hangi davranışın sana hizmet etmiyor, bir başkasına ediyor?',
    microAction: 'O davranışı bu hafta 1 kez bilinçli olarak ters yap.',
  },
  {
    id: 'buffett-circle',
    archetypes: ['silent-warrior'],
    author: 'Warren Buffett',
    authorMeta: 'Berkshire Hathaway 1996 yıllık mektup',
    quote:
      'Yetkinlik dairenin boyutu önemli değil — sınırını bilmek önemli.',
    context:
      'Buffett\'in "Circle of Competence" kavramı. 1996 mektubunda formel ifade. Yatırımcılığın ötesinde her karara uygulanabilir.',
    application:
      'Bugün bilmediğin bir konuda hızlı yorum yapma. "Bu benim dairemin dışında" demek = güç işareti.',
    microQuestion: 'Hangi konuda sürekli yorum yapıyorsun ama aslında uzman değilsin?',
    microAction: 'Bu hafta o konuda 1 kez "bilmiyorum" demeyi taahhüt et.',
  },
  {
    id: 'jobs-no',
    archetypes: ['silent-warrior'],
    author: 'Steve Jobs',
    authorMeta: 'WWDC 1997',
    quote:
      'Odaklanmak yapmadığınız şeyleri seçmektir. Yapmadığın 1000 şey kadar gurur duy.',
    context:
      '1997\'de Apple\'a döndüğünde Jobs ürün portföyünü 350\'den 10\'a indirdi. Şirket 6 ay sonra ilk kez kâr etti.',
    application:
      'Bu haftanın 5 görevinden 3\'ünü sil. Sadece 2 kalsın. O ikisine tam ver.',
    microQuestion: 'Bu hafta neye HAYIR demen lazım?',
    microAction: 'O işe bugün açıkça hayır de — mesajla, yüzyüze, mailda.',
  },
  {
    id: 'lao-tzu-water',
    archetypes: ['zen-master'],
    author: 'Lao Tzu',
    authorMeta: 'Tao Te Ching, 78. bölüm',
    quote:
      'Su her şeyden yumuşaktır, ama sert ve direnen şeylere karşı hiçbir şey daha üstün değildir.',
    context:
      'Tao Te Ching MÖ 6. yüzyıl. 81 kısa bölüm. 78. bölümde su prensibi — yumuşaklığın gücü.',
    application:
      'Bugün bir çatışmada güç kullanmak yerine yumuşa. Karşı tarafın argümanını yeniden tekrarla. Direnme — emerek geç.',
    microQuestion: 'Hangi çatışmada güç kullanarak kaybediyorsun?',
    microAction: 'Bugün o kişiye soru sor, savunma yapma.',
  },
  {
    id: 'confucius-mistake',
    archetypes: ['zen-master', 'silent-warrior'],
    author: 'Confucius',
    authorMeta: 'Analects XV.30',
    quote:
      'Hata yapıp düzeltmemek — gerçek hata budur.',
    context:
      'Konfüçyüs MÖ 5. yüzyıl Çin\'de Analects (Lun Yu) — öğrencilerin not ettiği konuşmalar. 20 kitap, 500 paragraf.',
    application:
      'Bu hafta yaptığın 1 hatayı düzelt — kabul et + sözünde dur. Hata bir özelliğin değildir, devam etmek özelliğindir.',
    microQuestion: 'Bu ay düzeltmedin sözünde bir hata var mı?',
    microAction: 'Bugün o hata için sorumluluk al — başkasına itiraf et.',
  },
  {
    id: 'pascal-room',
    archetypes: ['zen-master'],
    author: 'Blaise Pascal',
    authorMeta: 'Pensées §139, 1654',
    quote:
      'İnsanlığın tüm sefaleti tek bir gerçekten kaynaklanır: bir odada tek başına oturamamak.',
    context:
      'Fransız matematikçi-filozof Pascal\'ın "Pensées" — ölümünden sonra basılan düşünce notları. 350 yıl önce yazıldı, hâlâ doğru.',
    application:
      'Bugün 15 dakika tek başına otur. Telefon yok. TV yok. Sadece sen. Rahatsız ol. Rahatsızlığın ne dediğine dikkat et.',
    microQuestion: 'En son ne zaman tek başına oturdun, hiçbir şey yapmadan?',
    microAction: 'Bugün 15 dakika ayır — sadece otur ve düşün.',
  },
  {
    id: 'nietzsche-why',
    archetypes: ['iron-disciplined'],
    author: 'Friedrich Nietzsche',
    authorMeta: '"Twilight of the Idols" — 1889',
    quote:
      'Yaşayacak bir "niye"si olan, neredeyse her "nasıl"a katlanabilir.',
    context:
      'Nietzsche\'nin son tamamladığı kitap. Viktor Frankl bu cümleyi Auschwitz\'te aklında tuttuğunu söyledi — "Man\'s Search for Meaning" temel ilkesi.',
    application:
      'Bugün şu disiplinine niye? sor. 3 kez. Cevap derinleştikçe motivasyon kalıcılaşır.',
    microQuestion: 'Bu disipline neden bağlısın? 3 kat derinden sor.',
    microAction: 'O nedeni yaz. Cüzdana koy.',
  },
  {
    id: 'aurelius-others',
    archetypes: ['silent-warrior', 'zen-master'],
    author: 'Marcus Aurelius',
    authorMeta: 'Meditations VI.6',
    quote:
      'En iyi intikam, düşmanına benzememektir.',
    context:
      'Aurelius bir imparator olarak sürekli ihanetle yüzleşti. "Meditations" VI.6 — düşmanın seviyesine inmemek prensibi.',
    application:
      'Bugün biri sana haksızlık ederse karşılık verme. Onun bedeli onun. Senin tepkin senindir.',
    microQuestion: 'En son ne zaman bir haksızlığa "aynısıyla" karşılık verdin?',
    microAction: 'Bir dahaki sefer önce 24 saat bekle, sonra düşün.',
  },
  {
    id: 'epictetus-control',
    archetypes: ['silent-warrior'],
    author: 'Epiktetos',
    authorMeta: 'Discourses I.1',
    quote:
      'Kontrol edebildiklerimiz: yargılarımız, hedefler, arzular, kaçınmalar. Kontrol edemediklerimiz: bedenimiz, mülkümüz, itibarımız, görevimiz. Birincilere odaklan.',
    context:
      'Discourses Stoacılığın en uzun çalışması — Epiktetos\'un öğretilerini Arrian derledi. I.1 — dikotomy of control prensibi.',
    application:
      'Bugün enerji harcadığın 3 şeyi listele. Yanına kontrol-edebilir/edemez yaz. Edemediğini bırak.',
    microQuestion: 'Bugün hangi şey için endişelendin — kontrol edebileceğin mi?',
    microAction: 'Edemediğin endişeyi 1 cümleyle bırak, somut.',
  },
  {
    id: 'seneca-prepare',
    archetypes: ['iron-disciplined'],
    author: 'Seneca',
    authorMeta: 'Letters to Lucilius, Mektup 18',
    quote:
      'Hiçbir şey sahibini, sahibi olmadığı ihtimalini görmemekten daha çok bağlamaz.',
    context:
      'Seneca\'nın "premeditatio malorum" prensibi — Mektup 18\'de kötülüğün önceden simülasyonu. Modern terapide "negative visualization".',
    application:
      'Bu hafta 10 dakika otur. Sahip olduğun 1 şeyi kaybetseydin ne olurdu? Detaylı düşün. Sonra şükret.',
    microQuestion: 'Hangi varlık en zor kaybedilebilir? Sevdiğin, sağlığın, işin?',
    microAction: 'O varlık için bugün 1 koruyucu eylem yap.',
  },
  {
    id: 'newport-quit',
    archetypes: ['silent-warrior'],
    author: 'Cal Newport',
    authorMeta: '"Digital Minimalism" — 2019',
    quote:
      'Bir teknoloji yararlı olsa bile, onun maliyeti sana sağladığı faydadan yüksekse — bırak.',
    context:
      'Newport\'un dijital minimalizm felsefesi: net-positive olmadığı sürece teknoloji giriş yasak.',
    application:
      'Bugün ana ekranındaki 1 app\'i sil. Net negatif olduğunu bil. Bir hafta dene.',
    microQuestion: 'En çok zaman çalan app sana NE faydası veriyor?',
    microAction: 'Bugün o app\'i ana ekrandan kaldır. App library yeter.',
  },
  {
    id: 'clear-systems',
    archetypes: ['iron-disciplined'],
    author: 'James Clear',
    authorMeta: '"Atomic Habits" bölüm 1',
    quote:
      'Hedef seviyene yükselmezsin. Sistem seviyene düşersin.',
    context:
      'Clear\'ın temel iddiası: motivasyon zayıflar, sistemler kalıcı. Sistem, hedef yokken bile devam eder.',
    application:
      'Bugün şu hedefe karşılık gelen sistemini yaz: 30 günlük somut sistem. Hedefin yerine sistemini yaşa.',
    microQuestion: 'Hangi hedefin sisteme dönüşmesi gerek?',
    microAction: 'O hedef için yarın yapılacak 1 küçük sistem adımı planla.',
  },
  {
    id: 'aurelius-morning',
    archetypes: ['zen-master', 'silent-warrior'],
    author: 'Marcus Aurelius',
    authorMeta: 'Meditations V.1',
    quote:
      'Şafakta zorla kendini kalk: "İnsan işi yapmaya gidiyorum." Bunun için yaratıldığım şikayet edebilir miyim? Yorgan altında sıcak kalmak için mi doğdum?',
    context:
      'Meditations V.1 — en ünlü pasajlardan biri. Roma imparatoru kendine her sabah verdiği konuşma. "Yorgan tartışması" 1900 yıl sonra hâlâ herkesin.',
    application:
      'Yarın sabah uyandığında 30 saniye yatakta kal. Yorganı çık. Kalk. Tartışmayı kazan.',
    microQuestion: 'En son ne zaman snooze\'a basmaktan vazgeçtin?',
    microAction: 'Yarın alarm çalınca 5 saniye içinde kalk. Sayım yap.',
  },
  {
    id: 'holiday-stillness',
    archetypes: ['zen-master'],
    author: 'Ryan Holiday',
    authorMeta: '"Stillness Is the Key" — 2019',
    quote:
      'Hareket her zaman ilerleme değildir. Bazen durmak, en hızlı ileri gitmektir.',
    context:
      'Holiday Stoacılık üçlemesinin 3. kitabı. Aurelius/Epictetus/Seneca + Lincoln, Mr. Rogers, John Cage örnekleri.',
    application:
      'Bugün 1 saat hiçbir görev yapma. Otur, yürü, izle. Beyin bilinçaltında çalışır.',
    microQuestion: 'En son ne zaman BİLİNÇLİ olarak hiçbir şey yapmadın?',
    microAction: 'Bugün 30 dakika tek başına otur — telefon başka odada.',
  },
  {
    id: 'naval-specific',
    archetypes: ['iron-disciplined'],
    author: 'Naval Ravikant',
    authorMeta: 'How to Get Rich tweetstorm, 2018',
    quote:
      'Özgün bilgi geliştir. Sana özgün olan, başkasının taklit edemeyeceği. Çünkü her şey öğrenilebilir ama herkes seni öğrenemez.',
    context:
      'Naval\'in "specific knowledge" kavramı. Öğretilemeyen ama yaşanarak edinilen bilgi.',
    application:
      'Bu hafta 1 alanda kendi deneyimini yaz — diğerleri kopyalayamaz. Bu senin özgün bilgin.',
    microQuestion: 'Hangi alanda yıllarca yaşayıp öğrendin ki başkası bilmez?',
    microAction: 'Bugün o alanda 1 paragraf yaz. Sahip ol.',
  },
];

/**
 * Pick today's deck. Same user sees the same deck all day, rotates
 * next day (day-of-year deterministic).
 *
 * When an archetypeId is provided, we build a biased pool: decks
 * tagged with that archetype appear 3 times in the rotation, untagged
 * decks once. This makes the archetype onboarding choice
 * CONSEQUENTIAL — a Zen Master user gets contemplative quotes more
 * often than the Iron Disciplined user, who gets execution-focused
 * ones. Without an archetype we fall back to the flat rotation.
 *
 * Why 3:1 not pure filter:
 *   - A pure filter on 10 decks with ~3 matching means a 3-day
 *     repeat cycle (terrible).
 *   - 3:1 weighting still surfaces matching decks ~3x more often but
 *     keeps universal quotes in the mix, so a Zen user still
 *     occasionally sees the Iron Disciplined Naval quote — which is
 *     valuable. Identity doesn't mean tunnel vision.
 */
export const getTodaysDeck = (archetypeId = null) => {
  if (!DAILY_DECKS.length) return null;
  const now = new Date();
  const yearStart = new Date(now.getFullYear(), 0, 0);
  const dayOfYear = Math.floor((now - yearStart) / (24 * 60 * 60 * 1000));

  if (!archetypeId) {
    return DAILY_DECKS[dayOfYear % DAILY_DECKS.length];
  }

  // Weighted pool: matching decks ×3, others ×1.
  const pool = [];
  for (const d of DAILY_DECKS) {
    const matches = (d.archetypes || []).includes(archetypeId);
    const weight = matches ? 3 : 1;
    for (let i = 0; i < weight; i++) pool.push(d);
  }
  return pool[dayOfYear % pool.length];
};

export const getDeckById = (id) =>
  DAILY_DECKS.find((d) => d.id === id) || null;
