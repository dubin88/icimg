# Changelog

## 1.1.1

- Replace drag-to-scribble Free curve with Word-style click-to-place curve nodes, hover previews, double-click/Enter/button completion and click-to-close paths.
- Add interpolating cubic Bézier curves, closed-curve fills, Backspace/Delete/Ctrl+Z point removal and Esc/button cancellation.
- Keep curve drafts across language switches, commit each completed curve as one undo step and exclude draft markers from exports.
- Translate curve instructions and completion/cancellation controls in all 16 locales.

## 1.1.0

- Add 16 built-in locales, browser language detection, per-editor language selection, `setLocale()`, custom messages and `icimg:localechange`.
- Add `locale` to the custom element and Arabic right-to-left controls without changing canvas coordinates.
- Add Shapes: rectangle, ellipse, triangle, polygon (3–12 sides), diamond, star, heart, arrow, line, check mark, lightning and plus, with stroke and fill controls.
- Add smooth free curves. All new annotations participate in preview, crop, undo/redo and full-resolution export.
- Add the `icimg/engine` entry point for consumers that do not need the editor UI or language dictionaries.
- Localize the playground, preserve its language preference and synchronize both language selectors.

## 1.0.0

- Initial dependency-free image editor with crop, transforms, adjustments, presets, brush, text, navigation, history and PNG/JPEG/WebP export.
