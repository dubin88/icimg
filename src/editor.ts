import {
  DOMLocalizer,
  resolveLocale,
  supportedLocales,
  translate,
  type Locale,
  type Messages,
} from "./i18n";
import {
  drawShape,
  shapeKinds,
  type ShapeAnnotation,
  type ShapeKind,
} from "./shapes";
import {
  ImageEngine,
  defaults,
  presets,
  type Adjustments,
  type Crop,
  type Point,
  type Annotation,
  type ExportOptions,
} from "./engine";
import { icon } from "./icons";
import { styles } from "./styles";
export interface EditorOptions {
  src?: string | Blob;
  locale?: string;
  messages?: Messages;
  name?: string;
  accent?: string;
  onChange?: (engine: ImageEngine) => void;
  onExport?: (blob: Blob) => void;
}
type Tool = "adjust" | "crop" | "rotate" | "move" | "brush" | "text" | "shapes";
const toolItems: [Tool, string, string][] = [
  ["adjust", "sliders", "Adjust"],
  ["crop", "crop", "Crop"],
  ["rotate", "rotate", "Transform"],
  ["move", "move", "Move"],
  ["brush", "brush", "Draw"],
  ["shapes", "shapes", "Shapes"],
  ["text", "text", "Text"],
];
const controlNames: Record<keyof Adjustments, string> = {
  exposure: "Exposure",
  contrast: "Contrast",
  saturation: "Saturation",
  warmth: "Warmth",
  highlights: "Highlights",
  shadows: "Shadows",
  vignette: "Vignette",
};

const shapeNames: Record<string, string> = {
  rectangle: "Rectangle",
  ellipse: "Ellipse",
  triangle: "Triangle",
  polygon: "Polygon",
  diamond: "Diamond",
  star: "Star",
  heart: "Heart",
  arrow: "Arrow",
  line: "Line",
  check: "Check mark",
  lightning: "Lightning",
  plus: "Plus",
  curve: "Free curve",
};
const shapePaths: Record<string, string> = {
  rectangle: "M5 7H27V25H5Z",
  ellipse: "M27 16A11 9 0 1 1 5 16A11 9 0 1 1 27 16Z",
  triangle: "M16 5 28 26H4Z",
  polygon: "M16 4 27 10V23L16 29 5 23V10Z",
  diamond: "M16 3 28 16 16 29 4 16Z",
  star: "m16 3 4 9 10 1-7 7 2 10-9-5-9 5 2-10-7-7 10-1Z",
  heart: "M16 27C-9 12 7-4 16 10C25-4 41 12 16 27Z",
  arrow: "M3 12H19V5L29 16 19 27V20H3Z",
  line: "M5 27 27 5",
  check: "M4 16 12 25 28 6",
  lightning: "M19 3 5 19H15L12 29 28 12H18Z",
  plus: "M12 4H20V12H28V20H20V28H12V20H4V12H12Z",
  curve: "M3 24C3-4 15 3 14 17S30 30 29 6",
};
const escape = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
/** Mount a self-contained image editor into any DOM element. */
export class ImageEditor {
  private currentLocale: Locale;
  private localizer = new DOMLocalizer();
  private shapePreview: ShapeAnnotation | null = null;
  private shapeKind: ShapeKind | "curve" = "rectangle";
  readonly engine = new ImageEngine();
  readonly root: ShadowRoot;
  private destroyed = false;
  private loadGeneration = 0;
  private shapeColor = "#ed744a";
  private shapeWidth = 12;
  private shapeFill = false;
  private shapeSides = 6;
  private options: EditorOptions;
  private tool: Tool = "adjust";
  private zoom = 1;
  private pan = { x: 0, y: 0 };
  private frame = 0;
  private fitScale = 1;
  private comparing = false;
  private aspect = 0;
  private presetName = "Original";
  private toastTimer = 0;
  private draft: Crop = { x: 0.1, y: 0.1, width: 0.8, height: 0.8 };
  private pointer: {
    start: Point;
    pan: Point;
    crop: Crop;
    kind: string;
    points: Point[];
  } | null = null;
  private controller = new AbortController();
  private resizeObserver: ResizeObserver;
  private file: HTMLInputElement;
  private thumbnail = "";
  private toastNode: HTMLElement;
  private readyPromise: Promise<void> = Promise.resolve();
  constructor(
    private host: HTMLElement,
    options: EditorOptions = {},
  ) {
    if (host.shadowRoot?.querySelector(".editor"))
      throw new Error("Host already contains an editor");
    this.options = options;
    this.currentLocale = resolveLocale(options.locale);
    this.root = host.shadowRoot ?? host.attachShadow({ mode: "open" });
    this.root.innerHTML = `<style>${styles}</style><div class="editor"><header class="bar"><div class="file-icon">${icon("image", 17)}</div><div><div class="filename" data-no-i18n>Untitled image</div><div class="file-detail" data-no-i18n>Open an image to get started</div></div><div class="bar-spacer"></div><select class="locale-select" aria-label="Language">${supportedLocales.map((l) => `<option value="${l.code}" lang="${l.code}" data-no-i18n>${l.name}</option>`).join("")}</select><button class="icon-button" data-action="undo" aria-label="Undo" title="Undo (⌘Z)">${icon("undo", 17)}</button><button class="icon-button" data-action="redo" aria-label="Redo" title="Redo (⌘⇧Z)">${icon("redo", 17)}</button><div class="separator"></div><button class="secondary" data-action="upload">${icon("upload", 14)}<span>Open image</span></button><button class="primary" data-action="export">${icon("download", 14)}Export image</button></header><div class="body"><nav class="tools" aria-label="Editing tools">${toolItems.map(([id, ic, label]) => `<button class="tool ${id === "adjust" ? "active" : ""}" data-tool="${id}" aria-label="${label}" title="${label}">${icon(ic)}<span>${label}</span></button>`).join("")}<div class="tool-divider"></div><button class="tool" data-action="reset" title="Reset all edits" aria-label="Reset all edits">${icon("undo")}<span>Reset</span></button></nav><section class="workspace"><div class="workspace-heading"><span class="workspace-label">Your canvas</span><span class="workspace-note">${icon("lock", 10)} On-device editing</span></div><div class="stage" dir="ltr" tabindex="0" aria-label="Image editing canvas" data-tool="adjust"><div class="empty">${icon("image", 32)}Drop an image here<br>or click Open image</div><div class="image-wrap" hidden><canvas aria-label="Image preview"></canvas><div class="crop-box" hidden><span class="handle"></span></div></div></div><div class="workspace-bottom"><div class="zoom-controls"><button data-action="zoom-out" aria-label="Zoom out">${icon("minus", 13)}</button><span class="zoom-value">100%</span><button data-action="zoom-in" aria-label="Zoom in">${icon("plus", 13)}</button><div class="separator"></div><button data-action="fit" aria-label="Fit image to canvas" title="Fit to canvas">${icon("fit", 13)}</button></div><button class="compare" data-action="compare" aria-label="Compare original" title="Hold to see original">${icon("compare", 14)}<span>Hold to compare</span></button></div><div class="toast" role="status" hidden></div></section><aside class="panel" aria-label="Tool settings"></aside></div><footer class="status"><div class="left"><span class="dot"></span><span class="status-text" data-no-i18n>Ready when you are</span></div><div class="right"><span>All edits stay in your browser</span><kbd class="shortcut">⌘ Z</kbd><span>Undo</span></div></footer></div><input type="file" accept="image/png,image/jpeg,image/webp,image/avif,image/gif" hidden><dialog class="export-dialog"><div class="dialog-head"><h3>Make it yours.</h3><button class="icon-button" data-action="close-export" aria-label="Close export dialog">${icon("close", 18)}</button></div><p>Export your edited image, ready for wherever it goes.</p><label class="field-label" for="format">File format</label><select class="field" id="format"><option value="image/jpeg">JPEG — smaller file</option><option value="image/png">PNG — lossless, transparent</option><option value="image/webp">WebP — modern & compact</option></select><label class="field-label">Dimensions</label><div class="two-fields"><label>Width (px)<input class="field" id="export-width" type="number" min="1" max="32000"></label><label>Height (px)<input class="field" id="export-height" type="number" min="1" max="32000"></label></div><label class="field-label" for="quality">Quality <span id="quality-value">92%</span></label><input id="quality" type="range" min="10" max="100" value="92" style="width:100%;accent-color:var(--accent)"><p class="export-note">Original resolution by default. Dimensions stay proportional. JPEG uses a white background for transparent areas.</p><button class="primary wide" data-action="download">${icon("download", 15)}Download image</button></dialog>`;
    if (options.accent) host.style.setProperty("--accent", options.accent);
    this.file = this.q("input[type=file]");
    this.toastNode = this.q(".toast");
    this.renderPanel();
    this.localize();
    const signal = this.controller.signal;
    this.root.addEventListener("click", (e) => this.click(e), { signal });
    this.root.addEventListener("input", (e) => this.input(e), { signal });
    this.root.addEventListener("change", (e) => this.change(e), { signal });
    this.root.addEventListener(
      "pointerdown",
      (e) => this.pointerDown(e as PointerEvent),
      { signal },
    );
    this.root.addEventListener(
      "pointermove",
      (e) => this.pointerMove(e as PointerEvent),
      { signal },
    );
    this.root.addEventListener(
      "pointerup",
      (e) => this.pointerUp(e as PointerEvent),
      { signal },
    );
    this.root.addEventListener("pointercancel", () => this.cancelPointer(), {
      signal,
    });
    this.q(".stage").addEventListener(
      "wheel",
      (e) => {
        e.preventDefault();
        this.setZoom(this.zoom * (e.deltaY > 0 ? 0.92 : 1.08));
      },
      { signal, passive: false },
    );
    this.root.addEventListener("keydown", (e) => this.key(e as KeyboardEvent), {
      signal,
    });
    host.addEventListener("dragover", (e) => e.preventDefault(), { signal });
    host.addEventListener(
      "drop",
      (e) => {
        e.preventDefault();
        const file = e.dataTransfer?.files[0];
        if (file) this.load(file).catch((error) => this.toast(error.message));
      },
      { signal },
    );
    this.engine.addEventListener(
      "change",
      () => {
        this.refresh();
        this.options.onChange?.(this.engine);
        host.dispatchEvent(
          new CustomEvent("icimg:change", {
            detail: structuredClone(this.engine.state),
          }),
        );
      },
      { signal },
    );
    this.resizeObserver = new ResizeObserver(() => this.schedule());
    this.resizeObserver.observe(this.q(".stage"));
    if (options.src) {
      this.readyPromise = this.load(options.src, options.name);
      void this.readyPromise.catch(() => {});
    }
  }
  get ready() {
    return this.readyPromise;
  }
  get locale(): Locale {
    return this.currentLocale;
  }
  setLocale(locale: string) {
    if (this.destroyed) throw new Error("Editor has been destroyed");
    this.cancelPointer();
    this.currentLocale = resolveLocale(locale);
    this.localize();
    this.refresh();
    this.host.dispatchEvent(
      new CustomEvent("icimg:localechange", {
        detail: { locale: this.currentLocale },
      }),
    );
  }
  private t(message: string) {
    return translate(message, this.currentLocale, this.options.messages);
  }
  private localize() {
    this.localizer.apply(this.root, this.currentLocale, this.options.messages);
    const editor = this.q(".editor");
    editor.lang = this.currentLocale;
    editor.dir = this.currentLocale === "ar" ? "rtl" : "ltr";
    const dialog = this.q<HTMLDialogElement>("dialog");
    dialog.lang = this.currentLocale;
    dialog.dir = editor.dir;
    this.q<HTMLSelectElement>(".locale-select").value = this.currentLocale;
  }
  private q<T extends HTMLElement = HTMLElement>(selector: string) {
    return this.root.querySelector<T>(selector)!;
  }
  async load(src: string | Blob, name?: string) {
    if (this.destroyed) throw new Error("Editor has been destroyed");
    const generation = ++this.loadGeneration;
    try {
      this.q(".editor").classList.add("loading");
      await this.engine.load(src);
      if (this.destroyed || generation !== this.loadGeneration) return;
      this.engine.name = name ?? this.engine.name;
      this.tool = "adjust";
      this.zoom = 1;
      this.pan = { x: 0, y: 0 };
      this.presetName = "Original";
      this.thumbnail = this.engine
        .render(180, true)
        .toDataURL("image/jpeg", 0.8);
      this.selectTool("adjust");
      this.refresh();
      this.host.dispatchEvent(
        new CustomEvent("icimg:load", {
          detail: { name: this.engine.name, ...this.engine.outputDimensions },
        }),
      );
    } catch (error) {
      this.toast((error as Error).message);
      throw error;
    } finally {
      if (!this.destroyed && generation === this.loadGeneration)
        this.q(".editor").classList.remove("loading");
    }
  }
  private refresh() {
    const e = this.engine,
      d = e.outputDimensions;
    this.q(".filename").textContent =
      e.name === "Untitled" ? this.t("Untitled") : e.name;
    this.q(".file-detail").textContent = e.image
      ? `${d.width} × ${d.height} px · ${e.name.includes(".") ? e.name.split(".").pop()?.toUpperCase() : ""}`
      : this.t("Open an image to get started");
    this.q<HTMLButtonElement>("[data-action=undo]").disabled = !e.canUndo;
    this.q<HTMLButtonElement>("[data-action=redo]").disabled = !e.canRedo;
    this.q<HTMLButtonElement>("[data-action=export]").disabled = !e.image;
    this.q(".status-text").textContent = e.image
      ? `${d.width} × ${d.height} px · ${this.t(this.tool === "crop" ? "Drag the frame to crop" : "Ready to create")}`
      : this.t("Ready when you are");
    this.root
      .querySelectorAll<HTMLInputElement>("[data-key]")
      .forEach((input) => {
        const key = input.dataset.key as keyof Adjustments;
        input.value = String(e.state.adjustments[key]);
        const output = input.parentElement?.querySelector("output");
        if (output) output.textContent = this.format(e.state.adjustments[key]);
      });
    this.localize();
    this.schedule();
  }
  private format(n: number) {
    return n > 0 ? `+${n}` : String(n);
  }
  private schedule() {
    if (!this.frame)
      this.frame = requestAnimationFrame(() => {
        this.frame = 0;
        this.draw();
      });
  }
  private draw() {
    const e = this.engine,
      wrap = this.q(".image-wrap"),
      stage = this.q(".stage");
    wrap.hidden = !e.image;
    this.q(".empty").hidden = !!e.image;
    if (!e.image) return;
    const rendered = e.render(
      Math.min(1400, Math.max(stage.clientWidth * devicePixelRatio, 900)),
      this.comparing,
      this.tool === "crop",
    );
    const canvas = this.q<HTMLCanvasElement>("canvas");
    canvas.width = rendered.width;
    canvas.height = rendered.height;
    canvas.getContext("2d")!.drawImage(rendered, 0, 0);
    if (this.shapePreview) {
      const ctx = canvas.getContext("2d")!,
        c = e.state.crop,
        fullW = canvas.width / (c?.width ?? 1),
        fullH = canvas.height / (c?.height ?? 1);
      ctx.save();
      ctx.translate(-(c?.x ?? 0) * fullW, -(c?.y ?? 0) * fullH);
      drawShape(
        ctx,
        this.shapePreview,
        fullW,
        fullH,
        canvas.width / e.outputDimensions.width,
      );
      ctx.restore();
    }
    const fit = Math.min(
      (stage.clientWidth - 70) / rendered.width,
      (stage.clientHeight - 24) / rendered.height,
      1.4,
    );
    this.fitScale = fit;
    wrap.style.width = `${Math.max(1, rendered.width * fit)}px`;
    wrap.style.height = `${Math.max(1, rendered.height * fit)}px`;
    wrap.style.transform = `translate(${this.pan.x}px,${this.pan.y}px) scale(${this.zoom})`;
    this.q(".zoom-value").textContent = `${Math.round(this.zoom * 100)}%`;
    this.drawCrop();
  }
  private drawCrop() {
    const box = this.q(".crop-box");
    box.hidden = this.tool !== "crop" || !this.engine.image;
    box.style.left = `${this.draft.x * 100}%`;
    box.style.top = `${this.draft.y * 100}%`;
    box.style.width = `${this.draft.width * 100}%`;
    box.style.height = `${this.draft.height * 100}%`;
  }
  private renderPanel() {
    this.presetName =
      Object.keys(presets).find(
        (name) =>
          JSON.stringify({ ...defaults().adjustments, ...presets[name] }) ===
          JSON.stringify(this.engine.state.adjustments),
      ) ?? "Custom";
    let html = "";
    if (this.tool === "adjust")
      html = `<div class="panel-heading"><h3>Adjustments</h3><button class="text-button" data-action="reset-adjustments">Reset</button></div><p class="panel-description">A little fine-tuning goes a long way.</p><div class="section-label">Light & color</div>${(["exposure", "contrast", "highlights", "shadows", "saturation", "warmth", "vignette"] as (keyof Adjustments)[]).map((key) => this.slider(key)).join("")}<div class="panel-rule"></div><div class="panel-heading" style="margin-bottom:15px"><h3 style="font-size:11px">A different point of view</h3>${icon("sparkles", 13)}</div><div class="presets">${Object.keys(
        presets,
      )
        .map(
          (name, i) =>
            `<button class="preset ${this.presetName === name ? "selected" : ""}" data-preset="${name}" aria-label="${name} filter"><img src="${this.thumbnail}" alt="" style="filter:${["none", "saturate(1.5) contrast(1.15)", "sepia(.3) saturate(1.2)", "hue-rotate(15deg) saturate(.8)", "grayscale(1) contrast(1.15)", "contrast(.8) saturate(.8)"][i]}"><span>${name}</span></button>`,
        )
        .join("")}</div>`;
    if (this.tool === "crop")
      html = `<div class="panel-heading"><h3>Crop image</h3><button class="text-button" data-action="cancel-crop">Cancel</button></div><p class="panel-description">Find the perfect frame.</p><div class="section-label">Aspect ratio</div><div class="choice-grid">${[
        ["Free", "0"],
        ["Original", "-1"],
        ["1 : 1", "1"],
        ["4 : 3", "1.333333"],
        ["3 : 2", "1.5"],
        ["16 : 9", "1.777778"],
      ]
        .map(
          ([label, ratio]) =>
            `<button class="choice ${this.aspect === Number(ratio) ? "selected" : ""}" data-ratio="${ratio}">${label}</button>`,
        )
        .join(
          "",
        )}</div><p class="hint">Drag the frame to reposition it. Drag the bottom-right handle to resize.</p><button class="primary wide" data-action="apply-crop">${icon("check", 15)}Apply crop</button><button class="secondary wide" data-action="remove-crop">Restore full image</button>`;
    if (this.tool === "rotate")
      html = `<div class="panel-heading"><h3>Transform</h3></div><p class="panel-description">See things from another angle.</p><div class="section-label">Rotate & flip</div><div class="choice-grid"><button class="choice" data-action="rotate-left">${icon("undo", 16)}Left 90°</button><button class="choice" data-action="rotate-right">${icon("redo", 16)}Right 90°</button><button class="choice" data-action="flip-x">${icon("flip", 16)}Horizontal</button><button class="choice" data-action="flip-y">${icon("flip", 16)}Vertical</button></div><p class="hint">Rotation and flips work on your original image. Rotating clears the crop and annotations so the image can be reframed.</p><div class="panel-rule"></div><h3>Resize on export</h3><p class="hint">Set an exact width or height in the export dialog. The original stays untouched.</p><button class="secondary wide" data-action="export">${icon("download", 15)}Export settings</button>`;
    if (this.tool === "move")
      html = `<div class="panel-heading"><h3>Your space</h3></div><p class="panel-description">Get closer to the details.</p><div class="section-label">Canvas navigation</div><p class="hint">Drag the image to move around your canvas. Scroll to zoom in and out.</p><div class="choice-grid"><button class="choice" data-action="zoom-out">${icon("minus", 15)}Zoom out</button><button class="choice" data-action="zoom-in">${icon("plus", 15)}Zoom in</button></div><button class="secondary wide" data-action="fit">${icon("fit", 16)}Fit to canvas</button><p class="hint">Tip: hold Space in any tool to pan.</p>`;
    if (this.tool === "brush")
      html = `<div class="panel-heading"><h3>Draw freely</h3></div><p class="panel-description">A mark, a note, a little personality.</p><label class="field-label" for="brush-color">Brush color</label><input class="field" id="brush-color" type="color" value="#ed744a"><label class="field-label" for="brush-size">Brush size (px)</label><input class="field" id="brush-size" type="number" min="1" max="200" value="12"><p class="hint">Draw directly on the image. Brush sizes refer to the original resolution.</p><button class="secondary wide" data-action="clear-annotations">Clear annotations</button>`;
    if (this.tool === "text")
      html = `<div class="panel-heading"><h3>Say something</h3></div><p class="panel-description">Give your image a voice.</p><label class="field-label" for="text-content">Your words</label><input class="field" id="text-content" value="${escape(this.t("A moment to remember"))}" maxlength="200"><label class="field-label" for="text-color">Text color</label><input class="field" id="text-color" type="color" value="#ffffff"><label class="field-label" for="text-size">Font size (px)</label><input class="field" id="text-size" type="number" min="8" max="500" value="80"><p class="hint">Click on the image to place your text. Use Undo to remove a placement.</p><button class="secondary wide" data-action="clear-annotations">Clear annotations</button>`;
    if (this.tool === "shapes")
      html = `<div class="panel-heading"><h3>Shapes</h3></div><p class="panel-description">Bring your ideas into shape.</p><div class="shape-grid">${[...shapeKinds, "curve"].map((kind) => `<button class="shape-choice ${this.shapeKind === kind ? "selected" : ""}" data-shape="${kind}" aria-label="${shapeNames[kind]}"><svg width="28" height="28" viewBox="0 0 32 32" aria-hidden="true"><path d="${shapePaths[kind]}" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/></svg><span>${shapeNames[kind]}</span></button>`).join("")}</div><label class="field-label" for="shape-color">Stroke color</label><input class="field" id="shape-color" type="color" value="${this.shapeColor}"><label class="field-label" for="shape-width">Stroke width (px)</label><input class="field" id="shape-width" type="number" min="1" max="200" value="${this.shapeWidth}"><label class="field-label" for="shape-fill">Fill shape</label><select class="field" id="shape-fill"><option value="false" ${!this.shapeFill ? "selected" : ""}>No fill</option><option value="true" ${this.shapeFill ? "selected" : ""}>Solid fill</option></select>${this.shapeKind === "polygon" ? `<label class="field-label" for="shape-sides">Polygon sides</label><input class="field" id="shape-sides" type="number" min="3" max="12" value="${this.shapeSides}">` : ""}<p class="hint">Drag on the image to place a shape. Choose Free curve to draw a smooth path.</p><button class="secondary wide" data-action="clear-annotations">Clear annotations</button>`;
    this.q(".panel").innerHTML = html;
    this.refresh();
  }
  private slider(key: keyof Adjustments) {
    const value = this.engine.state.adjustments[key];
    return `<label class="control"><span class="control-label"><span>${controlNames[key]}</span><output>${this.format(value)}</output></span><input aria-label="${controlNames[key]}" type="range" min="${key === "vignette" ? 0 : -100}" max="100" value="${value}" data-key="${key}"></label>`;
  }
  private selectTool(tool: Tool) {
    this.cancelPointer();
    this.tool = tool;
    this.zoom = 1;
    this.pan = { x: 0, y: 0 };
    if (tool === "crop")
      this.draft = this.engine.state.crop
        ? { ...this.engine.state.crop }
        : { x: 0.1, y: 0.1, width: 0.8, height: 0.8 };
    this.q(".stage").dataset.tool = tool;
    this.root
      .querySelectorAll<HTMLElement>(".tool[data-tool]")
      .forEach((el) => el.classList.toggle("active", el.dataset.tool === tool));
    this.renderPanel();
    this.schedule();
  }
  private click(event: Event) {
    const target = (event.target as HTMLElement).closest<HTMLElement>("button");
    if (!target) return;
    if (target.dataset.shape) {
      this.shapeKind = target.dataset.shape as ShapeKind | "curve";
      this.renderPanel();
      return;
    }
    if (target.dataset.tool) {
      this.selectTool(target.dataset.tool as Tool);
      return;
    }
    if (target.dataset.preset) {
      this.presetName = target.dataset.preset;
      this.engine.preset(this.presetName);
      this.renderPanel();
      return;
    }
    if (target.dataset.ratio !== undefined) {
      this.aspect = Number(target.dataset.ratio);
      this.setAspect();
      this.renderPanel();
      return;
    }
    const action = target.dataset.action;
    const e = this.engine;
    switch (action) {
      case "upload":
        this.file.click();
        break;
      case "undo":
        e.undo();
        this.presetName = "Original";
        this.renderPanel();
        break;
      case "redo":
        e.redo();
        this.renderPanel();
        break;
      case "reset":
        e.reset();
        this.presetName = "Original";
        this.selectTool("adjust");
        this.toast("Back to the beginning.");
        break;
      case "reset-adjustments":
        e.adjust(defaults().adjustments);
        this.presetName = "Original";
        this.renderPanel();
        break;
      case "zoom-in":
        this.setZoom(this.zoom * 1.2);
        break;
      case "zoom-out":
        this.setZoom(this.zoom / 1.2);
        break;
      case "fit":
        this.zoom = 1;
        this.pan = { x: 0, y: 0 };
        this.schedule();
        break;
      case "rotate-left":
        if (e.image) e.rotate(-90);
        break;
      case "rotate-right":
        if (e.image) e.rotate(90);
        break;
      case "flip-x":
        e.update({ flipX: !e.state.flipX, annotations: [] });
        break;
      case "flip-y":
        e.update({ flipY: !e.state.flipY, annotations: [] });
        break;
      case "apply-crop":
        if (e.image) {
          e.crop({ ...this.draft });
          this.selectTool("adjust");
          this.toast("Perfectly framed.");
        }
        break;
      case "cancel-crop":
        this.selectTool("adjust");
        break;
      case "remove-crop":
        e.update({ crop: null });
        this.selectTool("adjust");
        break;
      case "clear-annotations":
        e.update({ annotations: [] });
        this.toast("Annotations cleared.");
        break;
      case "export":
        if (e.image) {
          const d = e.outputDimensions;
          this.q<HTMLInputElement>("#export-width").value = String(d.width);
          this.q<HTMLInputElement>("#export-height").value = String(d.height);
          this.q<HTMLDialogElement>("dialog").showModal();
        }
        break;
      case "close-export":
        this.q<HTMLDialogElement>("dialog").close();
        break;
      case "download":
        void this.download();
        break;
    }
  }
  private input(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.id === "shape-color") this.shapeColor = input.value;
    if (input.id === "shape-width")
      this.shapeWidth = Math.max(1, Math.min(200, Number(input.value) || 12));
    if (input.id === "shape-fill") this.shapeFill = input.value === "true";
    if (input.id === "shape-sides")
      this.shapeSides = Math.max(
        3,
        Math.min(12, Math.round(Number(input.value) || 6)),
      );
    if (input.dataset.key) {
      this.presetName = "Custom";
      this.engine.adjust({ [input.dataset.key]: Number(input.value) }, false);
      this.root
        .querySelectorAll(".preset")
        .forEach((el) => el.classList.remove("selected"));
    }
    if (input.id === "quality")
      this.q("#quality-value").textContent = `${input.value}%`;
    if (input.id === "export-width" || input.id === "export-height") {
      const d = this.engine.outputDimensions;
      const other = this.q<HTMLInputElement>(
        input.id === "export-width" ? "#export-height" : "#export-width",
      );
      other.value = String(
        Math.round(
          Number(input.value) *
            (input.id === "export-width"
              ? d.height / d.width
              : d.width / d.height),
        ),
      );
    }
  }
  private change(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.classList.contains("locale-select")) {
      this.setLocale(input.value);
      return;
    }
    if (input === this.file && input.files?.[0]) {
      void this.load(input.files[0]).catch(() => {});
      input.value = "";
    }
    if (input.dataset.key) this.engine.commit();
  }
  private setZoom(zoom: number) {
    this.zoom = Math.max(0.2, Math.min(5, zoom));
    this.schedule();
  }
  private setAspect() {
    const d = this.engine.dimensions,
      ratio = this.aspect === -1 ? d.width / d.height : this.aspect;
    if (!ratio) return;
    let w = 0.8,
      h = (w * d.width) / (ratio * d.height);
    if (h > 0.85) {
      h = 0.85;
      w = (h * ratio * d.height) / d.width;
    }
    this.draft = { x: (1 - w) / 2, y: (1 - h) / 2, width: w, height: h };
    this.drawCrop();
  }
  private point(e: PointerEvent): Point {
    const rect = this.q("canvas").getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)),
      y: Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height)),
    };
  }
  private annotationPoint(p: Point): Point {
    const c = this.engine.state.crop;
    return c ? { x: c.x + p.x * c.width, y: c.y + p.y * c.height } : p;
  }
  private space = false;
  private pointerDown(event: PointerEvent) {
    const el = event.target as HTMLElement;
    if (el.closest("[data-action=compare]")) {
      if (this.engine.image) {
        this.comparing = true;
        this.q(".compare").classList.add("held");
        el.closest<HTMLElement>("button")!.setPointerCapture(event.pointerId);
        this.schedule();
      }
      return;
    }
    if (!el.closest(".stage") || !this.engine.image || event.button !== 0)
      return;
    const stage = this.q(".stage");
    stage.focus();
    stage.setPointerCapture(event.pointerId);
    let kind: string = this.space || this.tool === "move" ? "pan" : this.tool;
    if (kind === "shapes" && this.shapeKind === "curve") kind = "curve";
    if (this.tool === "crop" && !this.space)
      kind = el.classList.contains("handle") ? "resize" : "crop";
    const p = this.point(event);
    this.pointer = {
      start: { x: event.clientX, y: event.clientY },
      pan: { ...this.pan },
      crop: { ...this.draft },
      kind,
      points: [this.annotationPoint(p)],
    };
    if (kind === "text") {
      const text = this.q<HTMLInputElement>("#text-content").value.trim();
      if (text) {
        const pos = this.annotationPoint(p);
        const a: Annotation = {
          type: "text",
          ...pos,
          text,
          color: this.q<HTMLInputElement>("#text-color").value,
          size: Math.max(
            8,
            Math.min(
              500,
              Number(this.q<HTMLInputElement>("#text-size").value) || 80,
            ),
          ),
        };
        this.engine.update({
          annotations: [...this.engine.state.annotations, a],
        });
        this.toast("Words, placed.");
      }
      this.pointer = null;
    }
  }
  private pointerMove(event: PointerEvent) {
    const p = this.pointer;
    if (!p) return;
    const dx = event.clientX - p.start.x,
      dy = event.clientY - p.start.y;
    if (p.kind === "pan") {
      this.pan = { x: p.pan.x + dx, y: p.pan.y + dy };
      this.schedule();
    }
    if (p.kind === "crop" || p.kind === "resize") {
      const rect = this.q("canvas").getBoundingClientRect();
      const nx = dx / rect.width,
        ny = dy / rect.height;
      if (p.kind === "crop")
        this.draft = {
          ...p.crop,
          x: Math.max(0, Math.min(1 - p.crop.width, p.crop.x + nx)),
          y: Math.max(0, Math.min(1 - p.crop.height, p.crop.y + ny)),
        };
      else {
        let width = Math.max(0.05, Math.min(1 - p.crop.x, p.crop.width + nx)),
          height = Math.max(0.05, Math.min(1 - p.crop.y, p.crop.height + ny));
        const d = this.engine.dimensions,
          ratio = this.aspect === -1 ? d.width / d.height : this.aspect;
        if (ratio) {
          height = (width * d.width) / (ratio * d.height);
          if (height > 1 - p.crop.y) {
            height = 1 - p.crop.y;
            width = (height * ratio * d.height) / d.width;
          }
        }
        this.draft = { ...p.crop, width, height };
      }
      this.drawCrop();
    }
    if (p.kind === "shapes") {
      const end = this.annotationPoint(this.point(event)),
        start = p.points[0];
      this.shapePreview = {
        type: "shape",
        kind: this.shapeKind as ShapeKind,
        x: this.shapeKind === "line" ? start.x : Math.min(start.x, end.x),
        y: this.shapeKind === "line" ? start.y : Math.min(start.y, end.y),
        width:
          this.shapeKind === "line"
            ? end.x - start.x
            : Math.abs(end.x - start.x),
        height:
          this.shapeKind === "line"
            ? end.y - start.y
            : Math.abs(end.y - start.y),
        color: this.shapeColor,
        strokeWidth: this.shapeWidth,
        fill: this.shapeFill,
        sides: this.shapeSides,
      };
      this.schedule();
    }
    if (p.kind === "brush" || p.kind === "curve") {
      p.points.push(this.annotationPoint(this.point(event)));
      const canvas = this.q<HTMLCanvasElement>("canvas"),
        ctx = canvas.getContext("2d")!;
      const current = this.point(event),
        prev = p.points[p.points.length - 2],
        c = this.engine.state.crop;
      const previous = c
        ? { x: (prev.x - c.x) / c.width, y: (prev.y - c.y) / c.height }
        : prev;
      ctx.strokeStyle =
        p.kind === "curve"
          ? this.shapeColor
          : this.q<HTMLInputElement>("#brush-color").value;
      ctx.lineWidth =
        p.kind === "curve"
          ? (this.shapeWidth * canvas.width) /
            this.engine.outputDimensions.width
          : (Math.max(
              1,
              Math.min(
                200,
                Number(this.q<HTMLInputElement>("#brush-size").value) || 12,
              ),
            ) *
              canvas.width) /
            this.engine.outputDimensions.width;
      ctx.lineCap = ctx.lineJoin = "round";
      ctx.beginPath();
      ctx.moveTo(previous.x * canvas.width, previous.y * canvas.height);
      ctx.lineTo(current.x * canvas.width, current.y * canvas.height);
      ctx.stroke();
    }
  }
  private pointerUp(_event: PointerEvent) {
    if (this.comparing) {
      this.comparing = false;
      this.q(".compare").classList.remove("held");
      this.schedule();
    }
    const p = this.pointer;
    if (!p) return;
    this.pointer = null;
    if (p.kind === "shapes" && this.shapePreview) {
      const shape = this.shapePreview;
      this.shapePreview = null;
      if (
        shape.kind === "line"
          ? Math.hypot(shape.width, shape.height) > 0.002
          : shape.width > 0.002 && shape.height > 0.002
      ) {
        this.engine.update({
          annotations: [...this.engine.state.annotations, shape],
        });
        this.toast("Shape added.");
      } else this.schedule();
    }
    if (p.kind === "brush" || p.kind === "curve") {
      if (p.points.length === 1)
        p.points.push({ ...p.points[0], x: p.points[0].x + 0.00001 });
      this.engine.update({
        annotations: [
          ...this.engine.state.annotations,
          {
            type: "stroke",
            points: p.points,
            color:
              p.kind === "curve"
                ? this.shapeColor
                : this.q<HTMLInputElement>("#brush-color").value,
            width:
              p.kind === "curve"
                ? this.shapeWidth
                : Math.max(
                    1,
                    Math.min(
                      200,
                      Number(this.q<HTMLInputElement>("#brush-size").value) ||
                        12,
                    ),
                  ),
            smooth: p.kind === "curve",
          },
        ],
      });
    }
  }
  private cancelPointer() {
    this.pointer = null;
    this.shapePreview = null;
    this.comparing = false;
    this.q(".compare").classList.remove("held");
    this.schedule();
  }
  private key(e: KeyboardEvent) {
    if ((e.target as HTMLElement).matches("input,select,textarea")) return;
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
      e.preventDefault();
      e.shiftKey ? this.engine.redo() : this.engine.undo();
      return;
    }
    if (e.key === " ") {
      e.preventDefault();
      this.space = e.type === "keydown";
      const stop = () => {
        this.space = false;
      };
      window.addEventListener("keyup", stop, {
        once: true,
        signal: this.controller.signal,
      });
    }
    if (e.key === "Escape" && this.tool === "crop") this.selectTool("adjust");
    if (e.key === "+" || e.key === "=") this.setZoom(this.zoom * 1.2);
    if (e.key === "-") this.setZoom(this.zoom / 1.2);
    if (e.key === "0") {
      this.zoom = 1;
      this.pan = { x: 0, y: 0 };
      this.schedule();
    }
  }
  private async download() {
    const button = this.q<HTMLButtonElement>("[data-action=download]");
    button.disabled = true;
    try {
      const type = this.q<HTMLSelectElement>("#format")
        .value as ExportOptions["type"];
      const blob = await this.engine.export({
        type,
        width: Number(this.q<HTMLInputElement>("#export-width").value),
        height: Number(this.q<HTMLInputElement>("#export-height").value),
        quality: Number(this.q<HTMLInputElement>("#quality").value) / 100,
      });
      const url = URL.createObjectURL(blob),
        a = document.createElement("a");
      a.href = url;
      a.download = `${this.engine.name.replace(/\.[^.]+$/, "")}-edited.${blob.type.split("/")[1].replace("jpeg", "jpg")}`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      this.options.onExport?.(blob);
      this.host.dispatchEvent(
        new CustomEvent("icimg:export", { detail: blob }),
      );
      this.q<HTMLDialogElement>("dialog").close();
      this.toast("Your image is ready.");
    } catch (error) {
      this.toast((error as Error).message);
    } finally {
      button.disabled = false;
    }
  }
  private toast(message: string) {
    this.toastNode.textContent = message;
    this.localizer.apply(
      this.toastNode,
      this.currentLocale,
      this.options.messages,
    );
    this.toastNode.hidden = false;
    clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(
      () => (this.toastNode.hidden = true),
      3500,
    );
  }
  export(options?: ExportOptions) {
    return this.engine.export(options);
  }
  destroy() {
    this.destroyed = true;
    this.loadGeneration++;
    this.controller.abort();
    this.resizeObserver.disconnect();
    cancelAnimationFrame(this.frame);
    clearTimeout(this.toastTimer);
    this.engine.destroy();
    this.root.innerHTML = "";
  }
}
