# iCImg

轻量、零运行时依赖的图片编辑器，原生 Canvas + TypeScript，苹果风格界面。适用于 React、Vue 或普通网页。

## 安装

已发布至 npm 官方注册表：

```sh
npm install icimg
```

也可以下载演示页里的 npm 安装包，或在源码目录执行 `npm pack` 后本地安装：

```sh
npm install ./icimg-1.1.0.tgz
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
  locale: 'zh-CN', // 默认自动识别浏览器语言
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
- 形状菜单：矩形、椭圆、三角形、多边形（3–12 边）、菱形、星形、心形、箭头、直线、对勾、闪电、加号；可调整描边颜色、线宽与填充。
- 自由曲线使用二次贝塞尔曲线平滑绘制；形状和曲线支持裁剪、导出、撤销重做。
- 16 种语言、自动检测、实时切换、阿拉伯语 RTL 布局、文案覆盖。
- 50 步撤销重做、重置、按住查看原图。
- PNG / JPEG / WebP 导出；质量设置、按比例设置输出尺寸。
- 上传与拖放图片，键盘操作、移动端触控。

这是常用修图与标注工具，不包含 Photoshop 的图层、蒙版、钢笔路径、内容识别或 AI 消除能力。

## 国际化（v1.1.0）

支持以下 16 种语言。地区变体会匹配对应基础语言，例如 `en-GB` → `en`、`fr-CA` → `fr`、`pt-PT` → `pt-BR`、`zh-Hans-CN` → `zh-CN`。中文内置为简体；其他中文地区也回退为简体。检测按浏览器首选语言列表顺序进行，不支持的语言回退为英语。

| 代码 | 语言 | 代码 | 语言 |
|---|---|---|---|
| `zh-CN` | 简体中文 | `en` | 英语 |
| `ja` | 日语 | `ko` | 韩语 |
| `fr` | 法语 | `de` | 德语 |
| `es` | 西班牙语 | `pt-BR` | 巴西葡萄牙语 |
| `it` | 意大利语 | `nl` | 荷兰语 |
| `ru` | 俄语 | `pl` | 波兰语 |
| `tr` | 土耳其语 | `ar` | 阿拉伯语（RTL） |
| `hi` | 印地语 | `th` | 泰语 |

```ts
import { createEditor, supportedLocales, resolveLocale } from 'icimg';
const editor = createEditor(host, {
  src: '/photo.jpg',
  locale: 'zh-CN', // 省略时读取 navigator.languages
  messages: { 'Export image': '保存作品' }, // 使用英语源文案作为 key
});
editor.setLocale('ja'); // 保留图片、调色、裁剪框、标注、历史及当前输入
console.log(editor.locale); // ja
host.addEventListener('icimg:localechange', event => {
  console.log(event.detail.locale);
});
```

工具栏提供原生语言下拉框，语言名称以本地文字显示。UI 文字、标题、无障碍名称、提示和已知错误信息都会切换。API 标识、预设名称、文件名、用户文字内容及程序抛出的错误字符串保持稳定，便于跨语言使用；SDK 不保存语言偏好，也不改动宿主页面的语言。演示页独立保存语言选择到浏览器本地，并与编辑器双向同步。所有翻译随包提供，不请求外部翻译服务。自定义文案作为纯文本处理。

Web Component 使用 `locale` 属性，并响应后续变化：

```html
<ic-image-editor src="/photo.jpg" locale="zh-CN"></ic-image-editor>
```

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
import { ImageEngine } from 'icimg/engine'; // 独立的轻量引擎入口，不含 UI 或语言包
const engine = new ImageEngine();
await engine.load(file);
engine.adjust({ exposure: 12, contrast: 10, warmth: 15 });
engine.preset('Vivid');
engine.rotate(90); // 任意有限角度；UI 提供 90°按钮
engine.crop({ x: .1, y: .1, width: .8, height: .8 });
engine.update({ flipX: true });
engine.update({ annotations: [{
  type: 'shape', kind: 'polygon', sides: 7,
  x: .2, y: .2, width: .4, height: .4, // 0–1 归一化坐标
  color: '#ed744a', strokeWidth: 12, fill: false,
}] });
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

引擎派发 `change` 事件。宿主 DOM 派发 `icimg:load`（名称与尺寸）、`icimg:change`（状态副本）、`icimg:export`（Blob，内置下载操作完成时）和 `icimg:localechange`（`{ locale }`）。

形状 `kind` 支持 `rectangle`、`ellipse`、`triangle`、`polygon`、`diamond`、`star`、`heart`、`arrow`、`line`、`check`、`lightning`、`plus`。线条允许带符号的宽高表示端点方向；其他形状使用正宽高包围盒。描边宽度基于原始图片像素。`stroke` 标注可设置 `smooth: true` 启用平滑曲线。形状一旦放置即成为标注，当前不提供放置后的选中、移动或单独调整操作，可通过撤销移除。

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
