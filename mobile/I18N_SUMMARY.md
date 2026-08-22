# i18n Summary

Current app-localized languages:

- Turkish (`tr`)
- English (`en`)

Arabic/RTL is not enabled in v1. It was removed from the runtime because the curriculum is not fully translated. Do not claim Arabic support in App Store Connect, screenshots, review notes, or marketing copy until these are all true:

- `src/i18n/locales/ar.json` exists and is wired into `src/i18n/index.js`
- `lessons.ar.json` exists for the full curriculum
- RTL layout has been tested on a real device
- App Store metadata is translated and reviewed

Runtime source of truth:

- `src/i18n/index.js`
- `src/i18n/locales/tr.json`
- `src/i18n/locales/en.json`
- `src/i18n/locales/lessons.tr.json`
- `src/i18n/locales/lessons.en.json`

App Store Connect localization source of truth:

- Turkish primary
- English (US)
- No Arabic localization for v1

Release check:

```bash
npm run quality:ci
```
