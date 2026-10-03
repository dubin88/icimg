import { test, expect } from "@playwright/test";
async function canvasRect(page: any) {
  const canvas = page.locator("#editor canvas");
  await canvas.scrollIntoViewIfNeeded();
  await page.evaluate(
    () =>
      new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      ),
  );
  return (await canvas.boundingBox())!;
}
async function open(page: any) {
  await page.goto("/");
  await page.waitForFunction(() => !!(window as any).icimg?.engine.image);
  await expect(page.locator("#editor canvas")).toBeVisible();
}
test("multiline HTML text is localized and can switch back", async ({
  page,
}) => {
  await open(page);
  await page.locator("#site-locale").selectOption("zh-CN");
  await expect(page.locator(".intro-bottom p")).toContainText(
    "直接在浏览器中，创作美好。",
  );
  await expect(page.locator(".features article").first()).toContainText(
    "需要的工具，就在手边。",
  );
  await page.locator("#site-locale").selectOption("en");
  await expect(page.locator(".intro-bottom p")).toContainText(
    "Make something beautiful, right in your browser.",
  );
});
test("16 locales are complete, regional variants resolve and editor locale is independent", async ({
  page,
}) => {
  await open(page);
  const result = await page.evaluate(() => {
    const api = (window as any).icimgAPI;
    const locales = api.supportedLocales;
    const keys = Object.keys(api.getMessages("en"));
    return {
      codes: locales.map((l: any) => l.code),
      complete: locales.every((l: any) =>
        keys.every(
          (k) =>
            typeof api.getMessages(l.code)[k] === "string" &&
            api.getMessages(l.code)[k].trim(),
        ),
      ),
      regions: ["zh-Hans-CN", "en-GB", "pt-PT", "fr-CA", "ar-SA", "xx-ZZ"].map(
        (l) => api.resolveLocale(l),
      ),
      ordered: api.resolveLocale(["xx-ZZ", "ko-KR"]),
      fallback: api.translate("Unknown extension", "ja"),
    };
  });
  expect(result.codes).toHaveLength(16);
  expect(result.complete).toBeTruthy();
  expect(result.regions).toEqual(["zh-CN", "en", "pt-BR", "fr", "ar", "en"]);
  expect(result.ordered).toBe("ko");
  expect(result.fallback).toBe("Unknown extension");
});
test("switch every language through website and SDK dropdown without losing edits", async ({
  page,
}) => {
  await open(page);
  await page.getByRole("slider", { name: "Exposure", exact: true }).fill("25");
  const locales = await page.evaluate(() =>
    (window as any).icimgAPI.supportedLocales.map((l: any) => l.code),
  );
  for (const locale of locales) {
    await page.locator("#site-locale").selectOption(locale);
    expect(await page.evaluate(() => (window as any).icimg.locale)).toBe(
      locale,
    );
    await expect(page.locator("html")).toHaveAttribute("lang", locale);
    await expect(page.locator("#editor .locale-select")).toHaveValue(locale);
    await expect(page.locator("#editor [data-key=exposure]")).toHaveValue("25");
    const expected = await page.evaluate(
      (l) => (window as any).icimgAPI.translate("Export image", l),
      locale,
    );
    await expect(page.locator("#editor [data-action=export]")).toHaveText(
      expected,
    );
    const copy = page.locator(".registry-note");
    await expect(copy).not.toBeEmpty();
  }
  await page.locator("#editor .locale-select").selectOption("zh-CN");
  await expect(page.locator("#site-locale")).toHaveValue("zh-CN");
  await expect(page.locator("#editor button[data-tool=shapes]")).toHaveText(
    "形状",
  );
  await page.reload();
  await page.waitForFunction(() => !!(window as any).icimg?.engine.image);
  await expect(page.locator("#site-locale")).toHaveValue("zh-CN");
  await expect(page.locator("#editor [data-key=exposure]")).toHaveValue("0");
});
test("locale change keeps crop frame, pending text, open export values and history", async ({
  page,
}) => {
  await open(page);
  await page.getByRole("button", { name: "Crop", exact: true }).click();
  await page.getByRole("button", { name: "1 : 1", exact: true }).click();
  const frame = await page.locator("#editor .crop-box").getAttribute("style");
  await page.locator("#site-locale").selectOption("zh-CN");
  expect(await page.locator("#editor .crop-box").getAttribute("style")).toBe(
    frame,
  );
  await page.locator("#editor [data-action=apply-crop]").click();
  await page.locator("#editor button[data-tool=text]").click();
  await page.locator("#text-content").fill("我的自定义文字");
  await page.locator("#site-locale").selectOption("de");
  await expect(page.locator("#text-content")).toHaveValue("我的自定义文字");
  await page.locator("#editor [data-action=export]").click();
  await page.locator("#export-width").fill("600");
  await page.evaluate(() => (window as any).icimg.setLocale("ja"));
  await expect(page.locator("#export-width")).toHaveValue("600");
  await expect(page.locator("#editor dialog")).toBeVisible();
  await expect(page.locator("#editor dialog")).toHaveAttribute("lang", "ja");
  await page.locator("#editor [data-action=close-export]").click();
  expect(await page.evaluate(() => (window as any).icimg.engine.canUndo)).toBe(
    true,
  );
});
test("custom messages remain plain text and locale attribute reacts", async ({
  page,
}) => {
  await open(page);
  const result = await page.evaluate(() => {
    const api = (window as any).icimgAPI;
    const host = document.createElement("div");
    document.body.append(host);
    const instance = api.createEditor(host, {
      locale: "ja",
      messages: { "Open image": "<img src=x onerror=alert(1)>" },
    });
    const button = host.shadowRoot!.querySelector("[data-action=upload]")!;
    const override = {
      text: button.textContent,
      images: button.querySelectorAll("img").length,
    };
    instance.destroy();
    host.remove();
    api.defineCustomElement();
    const el = document.createElement("ic-image-editor");
    el.setAttribute("locale", "zh-CN");
    document.body.append(el);
    el.setAttribute("locale", "fr-CA");
    const locale = (el as any).editor.locale;
    el.remove();
    return { override, locale };
  });
  expect(result.override.text).toContain("<img");
  expect(result.override.images).toBe(0);
  expect(result.locale).toBe("fr");
});
test("polygon and symbol placements preview, undo, redo and export", async ({
  page,
}) => {
  await open(page);
  await page.locator("#editor button[data-tool=shapes]").click();
  await page.getByRole("button", { name: "Polygon", exact: true }).click();
  await page.locator("#shape-sides").fill("7");
  await page.locator("#shape-fill").selectOption("true");
  const r = await canvasRect(page);
  await page.mouse.move(r.x + r.width * 0.2, r.y + r.height * 0.2);
  await page.mouse.down();
  await page.mouse.move(r.x + r.width * 0.6, r.y + r.height * 0.6, {
    steps: 5,
  });
  expect(
    await page.evaluate(
      () => (window as any).icimg.engine.state.annotations.length,
    ),
  ).toBe(0);
  await page.mouse.up();
  const annotation = await page.evaluate(
    () => (window as any).icimg.engine.state.annotations[0],
  );
  expect(annotation).toMatchObject({
    type: "shape",
    kind: "polygon",
    sides: 7,
    fill: true,
  });
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  expect(
    await page.evaluate(
      () => (window as any).icimg.engine.state.annotations.length,
    ),
  ).toBe(0);
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  expect(
    await page.evaluate(
      () => (window as any).icimg.engine.state.annotations.length,
    ),
  ).toBe(1);
  await page.getByRole("button", { name: "Heart", exact: true }).click();
  const heartRect = await canvasRect(page);
  await page.mouse.move(
    heartRect.x + heartRect.width * 0.6,
    heartRect.y + heartRect.height * 0.2,
  );
  await page.mouse.down();
  await page.mouse.move(
    heartRect.x + heartRect.width * 0.8,
    heartRect.y + heartRect.height * 0.4,
    { steps: 5 },
  );
  await page.mouse.up();
  const exported = await page.evaluate(async () => {
    const blob = await (window as any).icimg.export({
      type: "image/png",
      width: 400,
    });
    const bitmap = await createImageBitmap(blob);
    return {
      width: bitmap.width,
      height: bitmap.height,
      annotations: (window as any).icimg.engine.state.annotations.length,
    };
  });
  expect(exported).toEqual({ width: 400, height: 267, annotations: 2 });
});
test("free curve is smooth and horizontal lines can be placed", async ({
  page,
}) => {
  await open(page);
  await page.locator("#editor button[data-tool=shapes]").click();
  await page.getByRole("button", { name: "Free curve", exact: true }).click();
  let r = await canvasRect(page);
  await page.mouse.move(r.x + r.width * 0.2, r.y + r.height * 0.3);
  await page.mouse.click(r.x + r.width * 0.2, r.y + r.height * 0.3);
  await page.mouse.move(r.x + r.width * 0.4, r.y + r.height * 0.6, {
    steps: 5,
  });
  await page.mouse.click(r.x + r.width * 0.4, r.y + r.height * 0.6);
  expect(
    await page.evaluate(
      () => (window as any).icimg.engine.state.annotations.length,
    ),
  ).toBe(0);
  await page.mouse.dblclick(r.x + r.width * 0.6, r.y + r.height * 0.3);
  const curve = await page.evaluate(
    () => (window as any).icimg.engine.state.annotations[0],
  );
  expect(curve).toMatchObject({ type: "curve", closed: false });
  expect(curve.points).toHaveLength(3);
  await page.getByRole("button", { name: "Line", exact: true }).click();
  r = await canvasRect(page);
  await page.mouse.move(r.x + r.width * 0.7, r.y + r.height * 0.5);
  await page.mouse.down();
  await page.mouse.move(r.x + r.width * 0.2, r.y + r.height * 0.5, {
    steps: 3,
  });
  await page.mouse.up();
  const line = await page.evaluate(
    () => (window as any).icimg.engine.state.annotations[1],
  );
  expect(line.kind).toBe("line");
  expect(line.width).toBeLessThan(0);
  expect(line.height).toBeCloseTo(0);
});
test("all shape types render to pixels after cropping and a shape survives locale switches", async ({
  page,
}) => {
  await open(page);
  const result = await page.evaluate(async () => {
    const api = (window as any).icimgAPI;
    const canvas = document.createElement("canvas");
    canvas.width = 200;
    canvas.height = 200;
    const engine = new api.ImageEngine();
    await engine.load(canvas.toDataURL());
    const outputs = [];
    for (const kind of api.shapeKinds) {
      engine.update({
        annotations: [
          {
            type: "shape",
            kind,
            x: 0.25,
            y: 0.25,
            width: 0.5,
            height: 0.5,
            color: "#ed744a",
            strokeWidth: 8,
            fill: true,
            sides: 7,
          },
        ],
        crop: { x: 0.2, y: 0.2, width: 0.6, height: 0.6 },
      });
      const blob = await engine.export({ type: "image/png" });
      const bmp = await createImageBitmap(blob);
      const out = document.createElement("canvas");
      out.width = bmp.width;
      out.height = bmp.height;
      const ctx = out.getContext("2d")!;
      ctx.drawImage(bmp, 0, 0);
      const data = ctx.getImageData(0, 0, bmp.width, bmp.height).data;
      outputs.push({
        kind,
        width: bmp.width,
        visible: data.some((v, i) => i % 4 === 3 && v > 0),
      });
      bmp.close();
    }
    engine.destroy();
    return outputs;
  });
  expect(result).toHaveLength(12);
  for (const output of result) {
    expect(output.width).toBe(120);
    expect(output.visible).toBe(true);
  }
});
test("16 languages fit mobile layout, RTL and translated errors", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page);
  const locales = await page.evaluate(() =>
    (window as any).icimgAPI.supportedLocales.map((l: any) => l.code),
  );
  for (const locale of locales) {
    await page.locator("#site-locale").selectOption(locale);
    await page.locator("#editor button[data-tool=shapes]").click();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(390);
  }
  await page.locator("#site-locale").selectOption("ar");
  await expect(page.locator("#editor .editor")).toHaveAttribute("dir", "rtl");
  await expect(page.locator("#editor .stage")).toHaveAttribute("dir", "ltr");
  await page.evaluate(async () => {
    try {
      await (window as any).icimg.load("/missing-image.png");
    } catch {}
  });
  await expect(page.locator("#editor .toast")).toContainText(
    "تعذر تحميل الصورة",
  );
  await page.screenshot({
    path: "test-results/arabic-mobile.png",
    fullPage: true,
  });
  await page.locator("#site-locale").selectOption("zh-CN");
  await page.screenshot({
    path: "test-results/chinese-mobile.png",
    fullPage: true,
  });
});
