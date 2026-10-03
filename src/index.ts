export {
  resolveLocale,
  supportedLocales,
  getMessages,
  translate,
  DOMLocalizer,
} from "./i18n";
export type { Locale, Messages } from "./i18n";
export { shapeKinds } from "./shapes";
export type { ShapeKind, ShapeAnnotation } from "./shapes";
export { ImageEngine, adjustedPixels, defaults, presets } from "./engine";
export type {
  EditorState,
  Adjustments,
  Crop,
  Annotation,
  Point,
  ExportOptions,
} from "./engine";
export { ImageEditor } from "./editor";
export type { EditorOptions } from "./editor";
import { resolveLocale } from "./i18n";
import { ImageEditor, type EditorOptions } from "./editor";
export function createEditor(host: HTMLElement, options?: EditorOptions) {
  return new ImageEditor(host, options);
}
/** Explicit registration keeps the package free of import-time side effects and SSR-safe. */
export function defineCustomElement(name = "ic-image-editor") {
  if (typeof customElements === "undefined" || customElements.get(name)) return;
  customElements.define(
    name,
    class extends HTMLElement {
      editor?: ImageEditor;
      static observedAttributes = ["src", "locale"];
      connectedCallback() {
        if (!this.editor)
          this.editor = new ImageEditor(this, {
            src: this.getAttribute("src") ?? undefined,
            locale: this.getAttribute("locale") ?? undefined,
          });
        void this.editor.ready.catch(() => {});
      }
      attributeChangedCallback(
        _name: string,
        oldValue: string | null,
        value: string | null,
      ) {
        if (_name === "locale") {
          if (this.editor) this.editor.setLocale(value ?? resolveLocale());
          return;
        }
        if (value && value !== oldValue && this.editor)
          void this.editor.load(value).catch(() => {});
      }
      disconnectedCallback() {
        this.editor?.destroy();
        this.editor = undefined;
      }
    },
  );
}
