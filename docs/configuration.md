# Configuration / 配置说明

```ts
import { createEditor, type EditorOptions } from 'icimg';
const options: EditorOptions = {
  src: '/photo.jpg',
  name: 'photo.jpg',
  locale: 'zh-CN',
  accent: '#ed744a',
  messages: { 'Export image': '保存作品' },
  onChange: engine => console.log(engine.state),
  onExport: blob => console.log(blob),
};
const editor = createEditor(document.getElementById('editor')!, options);
await editor.ready;
```

| Option | Type | Default / behavior |
|---|---|---|
| `src` | `string \| Blob` (includes `File`) | Optional initial image; omit for an empty upload interface |
| `name` | `string` | Display name; otherwise use the File name or Untitled |
| `locale` | `string` | Detect `navigator.languages`, then fall back to English |
| `accent` | CSS color string | `#ed744a`; sets the host's `--accent` custom property |
| `messages` | `Readonly<Record<string, string>>` | Overrides indexed by the English source message |
| `onChange` | `(engine: ImageEngine) => void` | Called on editing-state changes, including slider previews |
| `onExport` | `(blob: Blob) => void` | Called after the built-in download action |

Styles are inside Shadow DOM, with no CSS import. Give the host a usable width; the editor handles responsive layout. `accent` changes accent-based controls; some decorative colors have their own fixed palette.

## Lifecycle

```ts
await editor.load(file);                  // Also accepts Blob or a CORS URL
editor.setLocale('ja');                   // Keep current image and edits
const blob = await editor.export({        // Does not trigger onExport or download
  type: 'image/webp', quality: .92, width: 1600,
});
editor.destroy();                        // Call when your view unmounts
```

Catch `editor.ready`, `load()` and `export()` failures in application code. A new image resets editing history. The `ready` promise represents the initial load; later loads return their own promise.

## Export options

| Option | Type | Default |
|---|---|---|
| `type` | `image/png`, `image/jpeg`, `image/webp` | `image/png` |
| `quality` | `number` from 0 to 1 | `.92`; PNG is lossless |
| `width` | Positive pixel count | Cropped original width |
| `height` | Positive pixel count | Calculated proportionally |

Set one dimension to preserve aspect ratio. Set both to resize to an exact rectangle. JPEG fills transparent areas white. Check `blob.type`, since a browser may fall back to PNG for an unsupported format. Input and output limits are 32 megapixels.

## Events

Listen on the host passed to `createEditor`:

| Event | `event.detail` |
|---|---|
| `icimg:load` | `{ name, width, height }` |
| `icimg:change` | Copy of `EditorState` |
| `icimg:export` | Blob, from the built-in download action |
| `icimg:localechange` | `{ locale }` |

`editor.engine` provides adjustments, transforms, crop, annotations and history. It also emits `change`. Crop and annotation positions use normalized coordinates on the complete transformed image, independent of viewport zoom.

## Custom element

```js
import { defineCustomElement } from 'icimg';
defineCustomElement();
```

```html
<ic-image-editor src="/photo.jpg" locale="zh-CN"></ic-image-editor>
```

The `src` and `locale` attributes react to changes. Registration is explicit and safe to call repeatedly. For callbacks or message overrides, use `createEditor` directly.
