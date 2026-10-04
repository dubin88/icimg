# Module formats / 模块格式

All formats expose the same editor API. Runtime dependencies: **zero**. They run in modern browsers; AMD/UMD support describes the module loader, not an ES5 browser target.

| Format | File | Usage |
|---|---|---|
| ES Modules | `dist/index.js` | `import { createEditor } from 'icimg'` |
| CommonJS | `dist/index.cjs` | `require('icimg')` |
| AMD | `dist/icimg.amd.js` | RequireJS anonymous module |
| Global | `dist/icimg.global.js` | `window.ICImg` / `globalThis.ICImg` |
| UMD | `dist/icimg.umd.js` / `.cjs` | Detect CommonJS, then AMD, then global |
| Engine only | `dist/engine.js` / `.cjs` | `icimg/engine`, without UI or locale dictionaries |

## ES Modules

```js
import { createEditor } from 'icimg';
const editor = createEditor(document.getElementById('editor'), {
  src: '/photo.jpg', locale: 'zh-CN',
});
await editor.ready;
```

For a browser with no bundler:

```html
<div id="editor"></div>
<script type="module">
  import { createEditor } from './dist/index.js';
  createEditor(document.getElementById('editor'), { locale: 'en' });
</script>
```

## CommonJS

```js
const { createEditor, ImageEngine } = require('icimg');
const { ImageEngine: StandaloneEngine } = require('icimg/engine');
```

Imports work during SSR. Creating an editor, loading images and exporting require a browser DOM and Canvas; CommonJS is intended for a bundler or a DOM-enabled application.

## AMD / RequireJS

```html
<div id="editor"></div>
<script src="./node_modules/requirejs/require.js"></script>
<script>
  require.config({ paths: { icimg: './dist/icimg.amd' } });
  require(['icimg'], function (ICImg) {
    ICImg.createEditor(document.getElementById('editor'), { locale: 'zh-CN' });
  });
</script>
```

Do not append `.js` to the RequireJS path. The AMD build uses `define([], factory)`, has no dependencies and does not add a browser global. RequireJS itself belongs to the host application.

## Browser global / 全局变量

```html
<div id="editor"></div>
<script src="./dist/icimg.global.js"></script>
<script>
  const editor = ICImg.createEditor(document.getElementById('editor'), {
    locale: 'zh-CN',
    onExport: function (blob) { console.log(blob); }
  });
</script>
```

The global build explicitly assigns `ICImg`, including when an AMD loader is present. It does not auto-register custom elements.

CDN after the corresponding npm release is available:

```html
<script src="https://cdn.jsdelivr.net/npm/icimg@1.2.0/dist/icimg.global.js"></script>
```

Pin a version when deploying an application. You can also download `icimg-1.2.0-dist.zip` from GitHub Releases and host the files yourself.

## UMD

Use `dist/icimg.umd.js` in a classic browser script or RequireJS path. Its detection order is CommonJS → AMD → `ICImg` global. In Node, use `require('icimg/umd')`, which resolves to the `.cjs` copy because this package has `type: module`.

## Running the examples

```sh
npm ci
npm run build
npx serve .
```

Open `examples/esm.html`, `examples/global.html` or `examples/amd.html` through the local HTTP server. ESM examples require HTTP rather than `file://`.

## Build reproducibility

```sh
npm run build          # ESM, CJS, declarations, AMD, global and UMD
npm run test:modules   # Real RequireJS + Node VM module-loader checks
npm test               # Browser behavior, including global and UMD
npm pack
```
