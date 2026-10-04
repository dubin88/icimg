# Internationalization / 国际化

The package includes 16 complete locale dictionaries. No external translation service is used.

| Code | Language | Code | Language |
|---|---|---|---|
| `en` | English | `zh-CN` | 简体中文 |
| `ja` | 日本語 | `ko` | 한국어 |
| `fr` | Français | `de` | Deutsch |
| `es` | Español | `pt-BR` | Português (Brasil) |
| `it` | Italiano | `nl` | Nederlands |
| `ru` | Русский | `pl` | Polski |
| `tr` | Türkçe | `ar` | العربية |
| `hi` | हिन्दी | `th` | ไทย |

```ts
import { createEditor, supportedLocales, resolveLocale, getMessages } from 'icimg';
const editor = createEditor(host, { locale: 'zh-CN' });
editor.setLocale('fr-CA'); // resolves to fr
console.log(editor.locale); // fr
console.log(supportedLocales); // native labels, codes and directions
console.log(resolveLocale(['xx-ZZ', 'ja-JP'])); // ja
console.log(getMessages('en')); // available source-message keys
```

If `locale` is omitted, the browser preference list is checked in order. Region variants match their base language; examples: `en-GB` → `en`, `zh-Hans-CN` → `zh-CN`, `pt-PT` → `pt-BR`. Unsupported input falls back to English. All Chinese variants currently use the Simplified Chinese dictionary.

## Switching languages

Use the toolbar selector or `editor.setLocale(code)`. Image, adjustments, crop frame, annotations, history, user text, export settings and pending curve nodes are preserved. The SDK does not persist the choice or change the host document's `lang`; application code controls those. The demo stores its preference in localStorage.

Arabic sets the editor controls to `dir="rtl"`. Canvas geometry remains left-to-right and image-space coordinates do not change or mirror.

API identifiers, preset names such as `Vivid`, user filenames, annotation text and programmatic errors remain stable. UI labels, accessibility labels, tooltips, instructions and known error messages are localized.

## Custom wording

```ts
const editor = createEditor(host, {
  locale: 'zh-CN',
  messages: {
    'Export image': '保存作品',
    'Open image': '选择照片',
  },
});
```

Use **English source text** as keys, not translated labels. Overrides take precedence in every selected locale. Values are inserted as text, never interpreted as HTML. `getMessages('en')` lists built-in keys.

## Contributing a language

1. Add its code, native name and direction to `supportedLocales` in `src/i18n.ts`.
2. Add aligned translation rows to `src/locales/labels.ts`, `help.ts` and `curve.ts`.
3. Add the demo translations in `demo/i18n.ts` if the playground should support it.
4. Run `npm run test:all`; dictionary completeness and locale switching are checked.

Keep the order of each row aligned with its key array. The dictionaries fail early if a row has missing or extra entries.
