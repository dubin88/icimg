import { test, expect } from "@playwright/test";
async function start(page: any) {
  await page.goto("/");
  await page.waitForFunction(() => !!(window as any).icimg?.engine.image);
  await page.locator("#editor button[data-tool=shapes]").click();
  await page.getByRole("button", { name: "Free curve", exact: true }).click();
  await page.locator("#editor canvas").scrollIntoViewIfNeeded();
  await page.evaluate(
    () =>
      new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
  );
  return (await page.locator("#editor canvas").boundingBox())!;
}
test("curve clicks preview without committing and Enter creates one undoable annotation", async ({
  page,
}) => {
  const r = await start(page);
  await page.mouse.click(r.x + r.width * 0.15, r.y + r.height * 0.4);
  await page.mouse.move(r.x + r.width * 0.35, r.y + r.height * 0.2);
  await page.mouse.click(r.x + r.width * 0.35, r.y + r.height * 0.2);
  await page.mouse.move(r.x + r.width * 0.55, r.y + r.height * 0.6);
  await page.mouse.click(r.x + r.width * 0.55, r.y + r.height * 0.6);
  expect(await page.evaluate(() => (window as any).icimg.engine.canUndo)).toBe(
    false,
  );
  await page.keyboard.press("Backspace");
  await page.mouse.click(r.x + r.width * 0.75, r.y + r.height * 0.3);
  await page.keyboard.press("Enter");
  const curve = await page.evaluate(
    () => (window as any).icimg.engine.state.annotations[0],
  );
  expect(curve.type).toBe("curve");
  expect(curve.points).toHaveLength(3);
  expect(curve.points[2].x).toBeCloseTo(0.75, 1);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  expect(
    await page.evaluate(() => (window as any).icimg.engine.state.annotations),
  ).toHaveLength(0);
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  expect(
    await page.evaluate(() => (window as any).icimg.engine.state.annotations),
  ).toHaveLength(1);
});
test("clicking the starting node closes the curve and exports fill", async ({
  page,
}) => {
  let r = await start(page);
  await page.locator("#shape-fill").selectOption("true");
  await page.locator("#editor canvas").scrollIntoViewIfNeeded();
  r = (await page.locator("#editor canvas").boundingBox())!;
  await page.mouse.click(r.x + r.width * 0.2, r.y + r.height * 0.2);
  await page.mouse.click(r.x + r.width * 0.7, r.y + r.height * 0.2);
  await page.mouse.click(r.x + r.width * 0.5, r.y + r.height * 0.7);
  await page.mouse.click(r.x + r.width * 0.2 + 2, r.y + r.height * 0.2 + 2);
  const curve = await page.evaluate(
    () => (window as any).icimg.engine.state.annotations[0],
  );
  expect(curve).toMatchObject({ type: "curve", closed: true, fill: true });
  expect(curve.points).toHaveLength(3);
  const pixel = await page.evaluate(async () => {
    const blob = await (window as any).icimg.export({
      type: "image/png",
      width: 600,
    });
    const bmp = await createImageBitmap(blob);
    const c = document.createElement("canvas");
    c.width = bmp.width;
    c.height = bmp.height;
    const ctx = c.getContext("2d")!;
    ctx.drawImage(bmp, 0, 0);
    return [
      ...ctx.getImageData(
        Math.round(bmp.width * 0.45),
        Math.round(bmp.height * 0.4),
        1,
        1,
      ).data,
    ];
  });
  expect(pixel).toEqual([237, 116, 74, 255]);
});
test("Esc, shape switch and tool switch discard drafts without adding history", async ({
  page,
}) => {
  let r = await start(page);
  await page.mouse.click(r.x + r.width * 0.2, r.y + r.height * 0.3);
  await page.mouse.click(r.x + r.width * 0.5, r.y + r.height * 0.5);
  await page.keyboard.press("Escape");
  await expect(page.locator("[data-action=finish-curve]")).toBeDisabled();
  await page.mouse.click(r.x + r.width * 0.2, r.y + r.height * 0.3);
  await page.mouse.click(r.x + r.width * 0.5, r.y + r.height * 0.5);
  await page.getByRole("button", { name: "Rectangle", exact: true }).click();
  expect(await page.evaluate(() => (window as any).icimg.engine.canUndo)).toBe(
    false,
  );
  await page.getByRole("button", { name: "Free curve", exact: true }).click();
  await page.locator("#editor canvas").scrollIntoViewIfNeeded();
  r = (await page.locator("#editor canvas").boundingBox())!;
  await page.mouse.click(r.x + r.width * 0.2, r.y + r.height * 0.3);
  await page.locator("#editor button[data-tool=adjust]").click();
  expect(
    await page.evaluate(
      () => (window as any).icimg.engine.state.annotations.length,
    ),
  ).toBe(0);
});
test("mobile finish button and language switching preserve clicked nodes", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const r = await start(page);
  await page.mouse.click(r.x + r.width * 0.2, r.y + r.height * 0.3);
  await page.mouse.click(r.x + r.width * 0.5, r.y + r.height * 0.5);
  await page.evaluate(() => (window as any).icimg.setLocale("zh-CN"));
  await expect(page.locator("[data-action=finish-curve]")).toHaveText(
    "完成曲线",
  );
  await page.locator("[data-action=finish-curve]").click();
  const curve = await page.evaluate(
    () => (window as any).icimg.engine.state.annotations[0],
  );
  expect(curve.points).toHaveLength(2);
  expect(curve.closed).toBe(false);
});
test("cubic curve interpolates the chosen nodes and its export uses crop coordinates", async ({
  page,
}) => {
  await start(page);
  const result = await page.evaluate(async () => {
    const { ImageEngine } = (window as any).icimgAPI;
    const c = document.createElement("canvas");
    c.width = 400;
    c.height = 400;
    const engine = new ImageEngine();
    await engine.load(c.toDataURL());
    engine.update({
      annotations: [
        {
          type: "curve",
          points: [
            { x: 0.25, y: 0.25 },
            { x: 0.5, y: 0.75 },
            { x: 0.75, y: 0.25 },
          ],
          width: 8,
          color: "#ff0000",
          closed: false,
          fill: false,
        },
      ],
      crop: { x: 0.2, y: 0.2, width: 0.6, height: 0.6 },
    });
    const out = engine.render(400),
      ctx = out.getContext("2d")!;
    return {
      width: out.width,
      points: [
        [20, 20],
        [120, 220],
        [220, 20],
      ].map(([x, y]) => [...ctx.getImageData(x, y, 1, 1).data]),
    };
  });
  expect(result.width).toBe(240);
  for (const pixel of result.points) expect(pixel).toEqual([255, 0, 0, 255]);
});
