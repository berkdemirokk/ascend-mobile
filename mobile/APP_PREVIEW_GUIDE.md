# 🎬 App Store Preview Video — Production Rehberi

App Store'da **app preview video**'ları conversion'ı **%15-25 artırır**. Apple bu özelliği destekliyor — 3 video slot/locale, her biri 15-30 saniye.

## 📐 Apple Spec'leri

| Kriter | Değer |
|---|---|
| Format | H.264, .mov / .mp4 |
| Çerçeve | 30fps |
| Süre | 15-30 saniye |
| Çözünürlük | 1080×1920 (9:16) iPhone, 886×1920 iPhone Mini, 1242×2208 (Pro Max) |
| Boyut | < 500 MB / video |
| Ses | Stereo, 44.1 kHz, AAC önerilen |
| Captions | Burned-in (Apple altyazı eklemiyor) |

## 🎯 Önerilen 3 Video Stratejisi

### Video 1: "Ana Hook" — 15 sn
**Amaç**: app açılışından 5 sn'de ne yaptığını anlat.

```
[0-2s] Current red-and-white Ascend icon zoom-in
       Voice: "Disiplini öğrenme zamanı"
[2-6s] Onboarding Welcome → Path picker (5 disiplin yolu)
       On-screen: "5 yol. 250 ders. Her gün ilerle."
[6-10s] PathScreen zigzag → tap a lesson
       On-screen: "Her gün 5 dakika"
[10-13s] Quiz screen → A/B/C/D + correct
       On-screen: "Quiz ile pekiştir"
[13-15s] Streak fire 🔥 + +25 XP celebration
       On-screen: "Yeni Sen başlasın"
       Logo fade
```

### Video 2: "Premium Value" — 20 sn
**Amaç**: Premium'un doğrulanmış değerini göster. Trial yalnızca App Store Connect'te aktifse vurgulanır.

```
[0-3s] Free user lesson → "Heart bitti" modal
       On-screen: "Devam etmek istiyorsan..."
[3-7s] Paywall scroll: features list (5 madde)
       On-screen: "Sınırsız kalp"
       On-screen: "50 ders, tüm yollar"
       On-screen: "Reklamsız"
[7-12s] Yearly card highlight + uygulamada görünen doğrulanmış rozet
       On-screen: StoreKit/RevenueCat tarafından dönen teklif metni
[12-17s] Doğrulanmış satın alma CTA'sına dokun → success
       On-screen: "Sonsuz disiplin"
[17-20s] Premium app görünümü (banner yok, kalp ∞)
       Logo + outro
```

### Video 3: "Müfredat Derinliği" — 25 sn
**Amaç**: 250 dersin gerçekliğini göster.

```
[0-3s] Hero: "250 ders. 1000 quiz. 2 dil."
[3-8s] Path 1 (Dopamin Detox) → 50 lesson tree
       Hızlı scroll
[8-13s] Path 2 (Sessiz Sabah) → 50 lesson tree
[13-18s] Path 3-5 quick montage
[18-22s] Reflection screen + Insights screen
       On-screen: "İlerlemen ölçülür"
[22-25s] Profile + rank up animation
       On-screen: "Yeni Sen burada başlar"
       Logo
```

## 🎬 Çekim Yöntemi

### Yöntem A — TestFlight Cihazda Screen Recording (En kolay)

1. **TestFlight'tan doğrulanacak 1.0.44 aday build'ini yükle**
2. iPhone Settings → Control Center → **Screen Recording** ekle
3. Control Center'dan kayıt başlat
4. App'i dolaş (script'e göre)
5. Kayıt durdur — Photos'a kaydedilir
6. **iMovie / DaVinci Resolve** (ücretsiz) ile düzenle:
   - 9:16 frame boyutuna trim
   - Voice-over ekle (telefon mikrofonuyla bile olur)
   - On-screen text overlay
   - Sonunda fade-out

### Yöntem B — Mac + Xcode Simulator (En profesyonel)

1. **Xcode → Open Developer Tool → Simulator**
2. iPhone 15 Pro Max simulator (1290×2796 native) aç
3. App'i Sim'e yükle (TestFlight build veya direkt expo run)
4. **Simulator → File → New Screen Recording**
5. Script'e göre dolaş
6. **Final Cut Pro / DaVinci Resolve** ile:
   - 1080×1920 export
   - Captions burn-in
   - Ses ekle

### Yöntem C — Profesyonel (Fiverr/Upwork)

- "App Store preview video" arat → $50-200
- Sen script + screenshots ver, onlar düzenler
- 24-48 saatte teslim
- ~%30 daha cilalı

## 🎙️ Voice-Over (TR + EN)

### Türkçe Script (15 sn versiyonu)
```
"Disiplini öğrenme zamanı. 5 yol, 250 ders, her gün ilerleme.
Quiz ile pekiştir. Streakini koru. Yeni sen başlasın.
Ascend: Daily Discipline — şimdi App Store'da."
```

### English Script
```
"Time to learn discipline. 5 paths, 250 lessons, daily progress.
Reinforce with quizzes. Keep your streak. Become the new you.
Ascend: Daily Discipline — now on App Store."
```

**Voice over araçları**:
- ElevenLabs (en iyi AI) — $5/ay, profesyonel ses
- Apple AVSpeechSynthesizer (cihazdan ücretsiz)
- Murf.ai (ücretsiz tier var)

## 🎨 On-Screen Text Stili

Current red-and-white design system ile tutarlı:
- Font: **Inter** (fallback: SF Pro Display)
- Boyut: **64-80px** ana title, **40-48px** alt-bilgi
- Renk: **#1A1C1C** metin, **#F9F9F9** veya **#FFFFFF** zemin
- Accent: **#B70006** primary red; CTA üzerinde **#FFFFFF**
- Konum: alt 1/3'te, video subject ile çakışmasın

## 🎵 Müzik

Apple App Store **stockf-free music** istiyor. Kaynaklar:
- **Epidemic Sound** ($15/ay, en kaliteli)
- **YouTube Audio Library** (ücretsiz, atrribution gerekmez)
- **Free Music Archive**
- **Pixabay Music** (ücretsiz, ticari kullanım OK)

Önerilen mood: **lo-fi minimal**, **ambient electronic**, **piano + strings**.

## ✅ Final Checklist

- [ ] 3 video, her biri 15-30 sn
- [ ] 1080×1920 ya da yüksek
- [ ] H.264 / .mov
- [ ] < 500 MB her biri
- [ ] Captions burned-in (TR + EN ayrı versiyonlar)
- [ ] Voice-over ses kalitesi temiz
- [ ] Apple guidelines uyumlu (no iOS UI screenshots — sadece app içi)
- [ ] Promotional content yok ("free", "best", "world's #1" yasak)
- [ ] Date references yok ("new in 2026" yasak)

## 📤 Upload

App Store Connect → My Apps → Ascend → App Store → iPhone (preview)
→ Click "+" → Upload .mov → Set as preview poster (kapak frame)

Apple **review** edebilir (~24h). Reject olursa sebep clear, fix + reupload.

## 💡 Pro İpuçları

1. **İlk 3 saniye kritik** — kullanıcı continue tıklamazsa video yarıda kalır
2. **Captions ZORUNLU** — sessiz oynatma standart, ses açık değil
3. **Renk kontrastı** — App Store thumbnail'da app icon küçük görünür
4. **Hareketle başla** — donmuş frame ile başlama, hareket dikkat çeker
5. **CTA içerme** — Apple "buy now" / "subscribe" video içinde yasaklıyor
6. **Hız** — 15-30 sn'de çok şey göster, ama her sahne 2-3 sn

---

**Bütçe önerisi**: Video başına $50-150 (Fiverr) veya kendi yap (~3 saat × 3 video = 9 saat).

**Ne zaman yap**: 1.0.44 aday build'i kalite kapısından ve gerçek cihaz regresyonundan geçince.

**Yardım**: Video script'i + storyboard hazırsın. Bana "video çekim için yardım" dersen detayları paylaşırım.
