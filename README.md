# iCImg

轻量、零运行时依赖的图片编辑器，原生 Canvas + TypeScript，苹果风格界面。适用于 React、Vue 或普通网页。

## 安装

npm 注册表发布成功后：

```sh
npm install icimg
```

尚未发布时，下载演示页里的 npm 安装包，或在源码目录执行 `npm pack`：

```sh
npm install ./icimg-1.0.0.tgz
```

## 快速开始

```html
<div id="editor"></div>
```

```ts
import { createEditor } from 'icimg';

const editor = createEditor(document.querySelector('#editor')!, {
  src: '/photo.jpg',
  name: 'photo.jpg',
  accent: '#ed744a',
  onExport: blob => console.log(blob),
});
await editor.ready;

await editor.load(file); // File、Blob 或支持 CORS 的图片 URL
const blob = await editor.export({ type: 'image/png', width: 1600 });
editor.destroy(); // 卸载时释放资源
```

组件样式封装在 Shadow DOM 中，无需额外导入 CSS，不污染宿主页面。宿主元素应拥有可用宽度，组件响应式布局自动切换。

## 功能

- 自由裁剪、原图比例、1:1、4:3、3:2、16:9；拖动与缩放裁剪框。
- 90°旋转、水平/垂直翻转；画布拖动与滚轮缩放、适应画布。
- 曝光、对比度、高光、阴影、饱和度、色温、暗角。
- Original / Vivid / Warm / Cool / Mono / Fade 六种预设。
- 自由画笔、自定义颜色与笔宽；文字标注、颜色与字号。
- 50 步撤销重做、重置、按住查看原图。
- PNG / JPEG / WebP 导出；质量设置、按比例设置输出尺寸。
- 上传与拖放图片，键盘操作、移动端触控。

这是常用修图与标注工具，不包含 Photoshop 的图层、蒙版、钢笔路径、内容识别或 AI 消除能力。

## React

```tsx
import { useEffect, useRef } from 'react';
import { createEditor, type ImageEditor } from 'icimg';

export function PhotoEditor({ src }: { src: string }) {
  const host = useRef<HTMLDivElement>(null);
  const instance = useRef<ImageEditor | null>(null);
  useEffect(() => {
    instance.current = createEditor(host.current!);
    return () => instance.current?.destroy();
  }, []);
  useEffect(() => {
    instance.current?.load(src).catch(console.error);
  }, [src]);
  return <div ref={host} />;
}
```

支持 React StrictMode 的挂载、清理与再次挂载。图片地址变化使用 `load`，不要重建整个组件。导入模块不会访问浏览器全局变量，可在 SSR 项目中导入；实例需在客户端创建。

## Vue

```vue
<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch } from 'vue';
import { createEditor, type ImageEditor } from 'icimg';
const props = defineProps<{ src: string }>();
const host = ref<HTMLElement>();
let editor: ImageEditor | undefined;
onMounted(() => {
  editor = createEditor(host.value!);
  editor.load(props.src).catch(console.error);
});
watch(() => props.src, src => editor?.load(src).catch(console.error));
onBeforeUnmount(() => editor?.destroy());
</script>
<template><div ref="host" /></template>
```

## Web Component

```ts
import { defineCustomElement } from 'icimg';
defineCustomElement(); // 可选名称，默认 ic-image-editor
```

```html
<ic-image-editor src="/photo.jpg"></ic-image-editor>
```

## 引擎 API

`ImageEngine` 可单独使用，无需挂载 UI。UI 的 `editor.engine` 是同一个接口。

```ts
import { ImageEngine } from 'icimg';
const engine = new ImageEngine();
await engine.load(file);
engine.adjust({ exposure: 12, contrast: 10, warmth: 15 });
engine.preset('Vivid');
engine.rotate(90); // 任意有限角度；UI 提供 90°按钮
engine.crop({ x: .1, y: .1, width: .8, height: .8 });
engine.update({ flipX: true });
engine.undo();
engine.redo();
engine.reset();
const blob = await engine.export({ type: 'image/webp', quality: .92, width: 1600 });
engine.destroy();
```

| 方法 / 属性 | 说明 |
|---|---|
| `load(source)` | 载入 string URL 或 Blob/File；自动重置历史 |
| `adjust(patch, commit = true)` | 调色值 -100 至 100；暗角为 0 至 100 |
| `preset(name)` | 应用六种命名预设之一 |
| `rotate(degrees = 90)` | 累加旋转；清空裁剪和标注 |
| `crop(rect)` | 裁剪框为旋转后完整图片上的 0–1 归一化坐标 |
| `update(patch, commit = true)` | 更新 `EditorState`；标注坐标相对于完整旋转后图片 |
| `commit()` | 把连续预览更改合并为一个历史记录 |
| `undo()` / `redo()` | 历史操作 |
| `reset()` | 恢复原图，可撤销 |
| `render(maxDimension = 1400)` | 返回预览 Canvas |
| `export(options)` | 返回 Promise<Blob>；默认原图分辨率、PNG |
| `state` | 调色、旋转、翻转、裁剪与标注数据 |
| `dimensions` / `outputDimensions` | 旋转后尺寸 / 裁剪后尺寸 |
| `canUndo` / `canRedo` | 历史可用状态 |
| `destroy()` | 释放引用，实例随后不可再次载入 |

`ExportOptions`: `type` 为 `image/png` / `image/jpeg` / `image/webp`；`quality` 为 0–1；只提供 `width` 或 `height` 会保持比例，同时提供二者允许改变比例。JPEG 的透明区域填充白色。浏览器不支持请求的格式时可能返回 PNG，以 `blob.type` 为准。

引擎派发 `change` 事件。宿主 DOM 派发 `icimg:load`（名称与尺寸）、`icimg:change`（状态副本）、`icimg:export`（Blob，内置下载操作完成时）。

## 性能与兼容

- 核心无运行时依赖，ESM / CommonJS / TypeScript 声明均提供。
- 预览按画布尺寸降采样；requestAnimationFrame 合并更新；同一编辑状态复用渲染缓存。
- 调色直接处理像素，避免依赖 Safari 支持不完整的 Canvas `filter`。
- 大图导出按原分辨率重新绘制；默认不会降低最终尺寸。输入与输出限制为 3200 万像素，保护内存。导出在主线程执行，大图可能短暂占用 UI。
- 文件不会上传到服务器。远程图片需要服务端允许 CORS。
- 面向现代 Chrome、Edge、Firefox、Safari，依赖 Canvas 2D、Shadow DOM、ResizeObserver、structuredClone 和 `<dialog>`。已通过 Chromium 自动化验证；其他浏览器请在你的目标环境测试。
- 编辑器单指触控支持拖动与画笔；缩放使用滚轮或按钮，未提供双指手势。
- 打开新图片会丢弃上一张图片的历史。UI 旋转清空裁剪与标注，翻转清空标注。

## 本地开发

```sh
npm install
npm run dev
npm run typecheck
npm run build
npm run build:demo
npx playwright install chromium
npm test
npm pack
```

演示图片：[Luca Bravo / Unsplash](https://unsplash.com/photos/aerial-photography-of-lake-surrounded-by-trees-and-mountain-g30P1zcOzXo)。

MIT License.
