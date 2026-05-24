# Sentry Setup — DSN konfigürasyonu

Crash reporting `@sentry/react-native` 8.12 ile entegre edildi.

## Kurulum (bir kerelik)

1. https://sentry.io adresinde ücretsiz hesap aç (5K errors/ay free tier)
2. Yeni proje oluştur → Platform: **React Native**
3. Sentry sana bir DSN verecek, şuna benzer:
   ```
   https://abc123xyz@o123456.ingest.sentry.io/4567890
   ```
4. `mobile/app.json` içindeki `extra.sentryDsn` alanına yapıştır:
   ```json
   "sentryDsn": "https://abc123xyz@o123456.ingest.sentry.io/4567890",
   ```
5. Bir sonraki EAS build (TestFlight veya release) bu DSN'i bundle'a katar
   ve crash'ler otomatik Sentry'ye akmaya başlar.

## Davranış

- `__DEV__` modda Sentry **devre dışı** (Metro/simulator gürültüsünü görmezsin).
- DSN boş ise SDK no-op çalışır — bu, dev makinesinde DSN olmadan da
  app'in normal başlamasını sağlar.
- ErrorBoundary catch'leri Sentry'ye **VE** mevcut Supabase log tablosuna
  yazılıyor — ikili sigorta, biri çalışmazsa diğeri tutuyor.

## Test

DSN girdikten sonra crash'in Sentry'ye düşüp düşmediğini test etmek için
herhangi bir screen'e tıklanabilir bir test crash butonu ekle:
```js
import * as Sentry from '@sentry/react-native';
Sentry.captureMessage('Test from local build');
```

5-10 saniye içinde Sentry dashboard'unda `Issues` sekmesinde görünür.

## PII / Privacy

`sendDefaultPii: false` ile config edildi — Sentry IP adresi veya kullanıcı
adı toplamıyor. Sadece error mesajı + component stack + tag'ler gidiyor.
Bu nedenle `app.json` privacy manifesti içindeki **Crash Data** beyanı
artık doğru — kaldırma gereği yok.
