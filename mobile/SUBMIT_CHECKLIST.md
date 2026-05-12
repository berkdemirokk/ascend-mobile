# 🚀 App Store Submission — Final Checklist

Build sonrası senin yapacakların. Sırayla. Her birinin yanına ✅ at.

---

## ⚡ ÖNCE — Build hazır mı?

- [ ] **mobile-v0.3.0** GitHub Actions build başarılı oldu
- [ ] App Store Connect → TestFlight → build görünür ve "Ready to Test"
- [ ] iPhone'unda **TestFlight uygulamasıyla yükle ve test et**:
  - [ ] Onboarding → Path screen açılıyor
  - [ ] İlk dersi tamamla → kutlama animasyonu çıkıyor
  - [ ] Ders sayısı artıyor, alev animasyonu var
  - [ ] Apple Sign-In butonu görünüyor (sadece logged-out durumda)
  - [ ] Reklam çıkıyor (ilk 2-3 ders sonrası)
  - [ ] Profile → istatistikler doğru gösteriliyor

**Eğer bug görürsen bana söyle**, ben düzelteyim, sonraki build atalım.

---

## 1️⃣ App Store Connect — Subscriptions

### 1.1 Subscription Group oluştur
1. https://appstoreconnect.apple.com → My Apps → Ascend: Monk Mode
2. Sol menü → **Subscriptions**
3. **+ Subscription Group** → Reference Name: `Premium`

### 1.2 Aylık subscription
1. **+ Create Subscription**
2. Reference Name: `Monthly Premium`
3. Product ID: **`com.ascend.premium.monthly`** ⚠️ tam bu, kod bunu bekliyor
4. Subscription Group: Premium
5. Duration: **1 Month**
6. Price: **149 TL** (Türkiye için), **$4.99** (US baseline)
7. Localizations:
   - 🇹🇷 TR Display Name: "Premium Aylık", Description: "Tüm yollar, ek freeze, reklamsız"
   - 🇺🇸 EN Display Name: "Monthly Premium", Description: "All paths, extra freezes, ad-free"
   - 🇸🇦 AR Display Name: "بريميوم شهري", Description: "كل المسارات، تجميد إضافي، بدون إعلانات"

### 1.3 Yıllık subscription
1. **+ Create Subscription**
2. Reference Name: `Yearly Premium`
3. Product ID: **`com.ascend.premium.yearly`**
4. Subscription Group: Premium (aynı grup!)
5. Duration: **1 Year**
6. Price: **749 TL**, **$39.99**
7. Localizations:
   - 🇹🇷 "Premium Yıllık", "Aylığa göre 6 ay bedava"
   - 🇺🇸 "Yearly Premium", "Save ~33% vs monthly"
   - 🇸🇦 "بريميوم سنوي", "وفر ~33% مقارنة بالشهري"

### 1.4 Introductory Offer (7 gün ücretsiz)
Her iki subscription için:
1. Subscription detayında → **Subscription Prices** → **+ Add Introductory Offer**
2. Type: **Free**
3. Duration: **1 Week**
4. Eligibility: **New Subscribers**
5. Save

⚠️ Bu yapılmazsa paywall'da "7 gün ücretsiz" yalan beyan olur, **reject sebebi**.

---

## 2️⃣ RevenueCat Dashboard

1. https://app.revenuecat.com → giriş
2. Project: Ascend (varsa) veya yeni oluştur
3. **+ App** → iOS → Bundle ID: `com.ascend.growth`
4. App Store Connect API key bağla:
   - Issuer ID: `875b8c0f-3adb-4175-b5d4-334257c02837`
   - Key ID: `CV8FXZNAR8`
   - .p8 file: önceden indirdiğin (`mobile/credentials/AuthKey_CV8FXZNAR8.p8`)
5. **Products** → **Import from App Store Connect**:
   - `com.ascend.premium.monthly`
   - `com.ascend.premium.yearly`
6. **Entitlements** → **+ New** → Identifier: **`premium`**
   - Both products bu entitlement'a eklenir
7. **Offerings** → **+ New** → Identifier: **`default`**
   - Add packages:
     - Type: **Monthly** → `com.ascend.premium.monthly`
     - Type: **Annual** → `com.ascend.premium.yearly`
   - **Make Current** (kritik!)
8. **API Keys** → iOS public key kopyala
   - Mevcut: `appl_GdTXEiIwMXBaFuHLGjwBhzlrruB`
   - Eğer farklı görünüyorsa `mobile/src/config/constants.js` → `REVENUECAT_CONFIG.API_KEY_IOS` güncelle, push, yeni build

---

## 3️⃣ AdMob Hesabı (zaten varsa kontrol)

1. https://admob.google.com
2. Hesap aktif mi? (publisher ID: `pub-9898903071826160`)
3. Apps → "Ascend Monk Mode" var mı? Yoksa **Add App**:
   - Platform: iOS
   - App: **`com.ascend.growth`**
   - Apple ID: `6761607644`
4. Ad Units (kodla eşleşmesi gereken ID'ler):
   - Interstitial (Geçiş) — `ca-app-pub-9898903071826160/5475177787`
   - Rewarded (Ödüllü)   — `ca-app-pub-9898903071826160/5610075008`
   - Banner              — `ca-app-pub-9898903071826160/8236238348`

ATT prompt için NSUserTrackingUsageDescription **app.json'da hazır** ✅

---

## 4️⃣ App Store Connect — App Information

### 4.1 Localizations (3 dil)
**Localizations** sekmesi → Add 3 languages → her birine `APP_STORE_METADATA.md`'deki içerik:
- Turkish (Primary)
- English (US)
- Arabic

### 4.2 Categories
- **Primary:** Health & Fitness
- **Secondary:** Lifestyle

### 4.3 Age Rating
4+. Tüm sorulara "None" cevapla.

### 4.4 URLs
- **Support URL:** `https://berkdemirokk.github.io/ascend-ai-growth-coach/`
- **Privacy Policy URL:** `https://berkdemirokk.github.io/ascend-ai-growth-coach/privacy.html`
- **Marketing URL:** boş

---

## 5️⃣ App Privacy (Privacy Nutrition Labels)

App Store Connect → **App Privacy** → Get Started

### Data Collected (linked to user)
- ✅ **Contact Info → Email Address** — App Functionality
- ✅ **Identifiers → User ID** — App Functionality
- ✅ **Identifiers → Device ID** — App Functionality (push), Third-Party Advertising (AdMob)
- ✅ **Usage Data → Product Interaction** — Analytics (eğer eklersen sonra), Third-Party Advertising

### Tracking
- **Do you use data for tracking?** → **YES** (AdMob var)
- ATT prompt zaten kodda var ✅

### NOT collected
- Location, Contacts, Photos, Browsing History, Health, Sensitive Info — None

---

## 6️⃣ App Icon (1024×1024)

Mevcut `mobile/assets/icon.png` programmatik oluşturuldu (siyah zemin, altın alev).

**Upload App Store Connect:**
- App Information → App Icon → Upload `icon.png`

Beğenmiyorsan farklı bir icon ile değiştirebilirsin (Figma + Midjourney). Ama mevcut iyi başlangıç.

---

## 7️⃣ Screenshots (1290×2796 px, en az 3)

TestFlight build hazır olunca:

1. Mac yoksa simulator olmaz — **iPhone'unda TestFlight'tan al**
2. **Yan tuş + Power tuşu** ile screenshot
3. iPhone'undan AirDrop / iCloud ile bilgisayara aktar
4. **Gerekli 3 ekran** minimum:
   - **Onboarding hero** ("Monk Mode" + "Başla")
   - **Path screen** (Duolingo tree görünümü)
   - **Lesson screen** (öğretim/eylem/yansıma)
5. **Önerilen 6 ekran**:
   - + Streak hero ile path (alev görünür)
   - + Profile (rütbe + stats)
   - + Paywall (7 gün ücretsiz CTA)

**Polishi için:** [previewed.app](https://previewed.app) veya [screenshot.rocks](https://screenshot.rocks) — iPhone çerçevesi içine yerleştirir.

---

## 8️⃣ Review Information

App Store Connect → **App Review Information**

- **Contact:**
  - First Name: Berk
  - Last Name: Demirok
  - Phone: senin numaran
  - Email: berkkdemirok@gmail.com

- **Demo Account** (Apple review team test için):
  - Username: `apple-review@ascend.app` (Supabase'de oluştur — sonra)
  - Password: random güçlü şifre
  - Notes:
    ```
    Use the demo account to test core flow. Premium features can be tested in sandbox.
    
    Notes:
    - Onboarding leads to PathScreen with 5 disciplinary paths
    - First 5 lessons of each path are free
    - Premium unlocks remaining lessons and removes ads
    - Apple Sign-In available in addition to email signup
    - All UI in Turkish, English, and Arabic
    ```

---

## 9️⃣ Submit for Review

App Store Connect → ana ekran → **Submit for Review**

1. Build seç (mobile-v0.3.0 veya hangisi başarılı ise)
2. Tüm sekmelerin yeşil tikli olduğundan emin ol
3. **Submit**

**Onay süresi:** 24–72 saat genellikle.

---

## 🚨 Reject olursa muhtemel sebepler

| Sebep | Çözüm |
|---|---|
| Privacy Policy URL açılmıyor | GitHub Pages aktif (zaten ayarlı, kontrol et) |
| Subscription metadata eksik | Description'a "Auto-renewable subscription" notu ekle |
| Demo account çalışmıyor | Supabase'de oluştur, password ekle |
| Apple Sign-In capability eksik | EAS credentials regenerate (zaten yapıldı) |
| Curriculum sadece TR | App Store description'da "UI in 3 languages, course content in Turkish (English/Arabic coming soon)" yaz |

---

## 📊 Şu an durum özet

| Component | Durum |
|---|---|
| App build edilebilir | ✅ (v0.2.0 başarılı) |
| Path system + Duolingo UI | ✅ |
| 30 ders Dopamin Detoks (TR+EN) | ✅ |
| 4 yol scaffolding (5 ders her birinde) | ✅ |
| 3 dil i18n | ✅ |
| Apple Sign-In | ✅ kod, capability |
| AdMob | ✅ kod, hesap onayı bekleniyor |
| Privacy/Terms HTML | ✅ GitHub Pages'te |
| App icon | ✅ programatik |
| **App Store Connect subscriptions** | ❌ SEN YAPACAKSIN |
| **RevenueCat dashboard** | ❌ SEN YAPACAKSIN |
| **Screenshots** | ❌ SEN ÇEKECEKSİN |
| **Privacy nutrition labels** | ❌ SEN YAPACAKSIN |
| **Submit for Review** | ❌ SEN YAPACAKSIN |

Senin işin ~2-3 saat. Ondan sonra Apple review 24-72 saat. Toplam **2-4 gün içinde App Store'da olabilir**.

---

## ⚡ ŞİMDİ — sırayla yap

1. **Build sonucunu bekle** (mobile-v0.3.0 → 20 dk sonra TestFlight'ta)
2. **TestFlight'ta test et** telefonunda
3. Bu dosyayı baştan sona git, ✅ at her adıma
4. Submit
5. Bekle, kutla 🔥

Sıkışırsan bana sor, ben yardım ederim.
