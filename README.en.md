# iCImg — Image Editor, Image Preview & Lightweight Photo Editor

[简体中文](README.md) · **English** · [Live playground](https://icimg-studio.robinduvip.chatgpt.site) · [npm](https://www.npmjs.com/package/icimg)

iCImg is a **browser image editor, image preview component and lightweight Photoshop-style photo editor** built with TypeScript and native Canvas. It has zero runtime dependencies and an Apple-inspired interface. Works with React, Vue, ordinary JavaScript, RequireJS and classic browser scripts. MIT licensed.

Use it for online image editing, photo editing and interactive image previews: crop, resize, rotate, pan and zoom, compare with the original, adjust colors, apply filters, draw, annotate and export images.

## Install and use

```sh
npm install icimg
```

```html
<div id="editor"></div>
```

```ts
import { createEditor } from 'icimg';
const editor = createEditor(document.getElementById('editor')!, {
  src: '/photo.jpg',
  locale: 'en',
  onExport: blob => console.log(blob),
});
await editor.ready;
editor.setLocale('zh-CN');
const blob = await editor.export({ type: 'image/png', width: 1600 });
// On unmount:
editor.destroy();
```

No CSS import is needed. Styles are isolated in Shadow DOM. Remote images must allow CORS; local files stay in the browser.

## Features

- Crop with free or fixed aspect ratios; rotate and flip.
- Pan, zoom, compare with the original, undo/redo and reset.
- Exposure, contrast, highlights, shadows, saturation, temperature, vignette and six presets.
- Brush, text, twelve shapes/symbols, stroke color/width and fill.
- Word-style curves: click nodes, preview the next segment, double-click or Enter to finish, click the start to close, Backspace to remove a node, Esc to cancel.
- PNG/JPEG/WebP export, quality settings and proportional resizing.
- 16 locales, automatic browser-language detection, live switching and Arabic RTL controls.
- ES Modules, AMD, CommonJS, browser global and UMD distributions; TypeScript declarations.

## Choose a module format

| Format | Entry |
|---|---|
| ES Modules | `import { createEditor } from 'icimg'` |
| CommonJS | `const { createEditor } = require('icimg')` |
| AMD | RequireJS path `dist/icimg.amd` |
| Global | `<script src="dist/icimg.global.js"></script>` → `ICImg` |
| UMD | `dist/icimg.umd.js` / `require('icimg/umd')` |
| Engine only | `import { ImageEngine } from 'icimg/engine'` |

See [module examples](docs/modules.md), [configuration](docs/configuration.md) and [internationalization](docs/internationalization.md). Download prebuilt files from [GitHub Releases](https://github.com/dubin88/icimg/releases).

## React

```tsx
import { useEffect, useRef } from 'react';
import { createEditor, type ImageEditor } from 'icimg';
export function PhotoEditor({ src }: { src: string }) {
  const host = useRef<HTMLDivElement>(null);
  const instance = useRef<ImageEditor | null>(null);
  useEffect(() => {
    instance.current = createEditor(host.current!, { locale: 'en' });
    return () => instance.current?.destroy();
  }, []);
  useEffect(() => { instance.current?.load(src).catch(console.error); }, [src]);
  return <div ref={host} />;
}
```

Vue uses `onMounted` to create the editor and `onBeforeUnmount` to destroy it; see the [Chinese README](README.md#vue) for a full example. Imports are SSR-safe; editor instances require a browser DOM.

## Development

```sh
npm ci
npx playwright install chromium
npm run dev
npm run test:all
npm pack
```

Input/output limit: 32 megapixels. Full-resolution exports run on the main thread and can briefly occupy the UI. Modern browser APIs are required. Placed annotations are removed with undo or cleared together; point editing after placement is not included.

[Contributing](CONTRIBUTING.md) · [Changelog](CHANGELOG.md) · [MIT License](LICENSE)

Demo photo: [Luca Bravo / Unsplash](https://unsplash.com/photos/aerial-photography-of-lake-surrounded-by-trees-and-mountain-g30P1zcOzXo).
