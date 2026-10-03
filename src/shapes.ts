export const shapeKinds = [
  "rectangle",
  "ellipse",
  "triangle",
  "polygon",
  "diamond",
  "star",
  "heart",
  "arrow",
  "line",
  "check",
  "lightning",
  "plus",
] as const;
export type ShapeKind = (typeof shapeKinds)[number];
export interface ShapeAnnotation {
  type: "shape";
  kind: ShapeKind;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  strokeWidth: number;
  fill: boolean;
  sides?: number;
}
/** Coordinates use the complete transformed image, independent of preview zoom or crop. */
export function drawShape(
  ctx: CanvasRenderingContext2D,
  a: ShapeAnnotation,
  width: number,
  height: number,
  scale = 1,
) {
  const x = a.x * width,
    y = a.y * height,
    w = a.width * width,
    h = a.height * height;
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = ctx.fillStyle = a.color;
  ctx.lineWidth = a.strokeWidth * scale;
  ctx.lineJoin = ctx.lineCap = "round";
  ctx.beginPath();
  const path = (points: number[][], closed = true) => {
    points.forEach(([px, py], i) =>
      i ? ctx.lineTo(px * w, py * h) : ctx.moveTo(px * w, py * h),
    );
    if (closed) ctx.closePath();
  };
  let closed = true;
  switch (a.kind) {
    case "rectangle":
      ctx.rect(0, 0, w, h);
      break;
    case "ellipse":
      ctx.ellipse(
        w / 2,
        h / 2,
        Math.abs(w) / 2,
        Math.abs(h) / 2,
        0,
        0,
        Math.PI * 2,
      );
      break;
    case "triangle":
      path([
        [0.5, 0],
        [1, 1],
        [0, 1],
      ]);
      break;
    case "polygon":
    case "star": {
      const count =
        a.kind === "star"
          ? 10
          : Math.max(3, Math.min(12, Math.round(a.sides ?? 6)));
      const points = Array.from({ length: count }, (_, i) => {
        const angle = (i * Math.PI * 2) / count - Math.PI / 2,
          r = a.kind === "star" && i % 2 ? 0.23 : 0.5;
        return [0.5 + Math.cos(angle) * r, 0.5 + Math.sin(angle) * r];
      });
      path(points);
      break;
    }
    case "diamond":
      path([
        [0.5, 0],
        [1, 0.5],
        [0.5, 1],
        [0, 0.5],
      ]);
      break;
    case "heart":
      ctx.moveTo(w * 0.5, h);
      ctx.bezierCurveTo(
        -w * 0.4,
        h * 0.35,
        w * 0.02,
        -h * 0.25,
        w * 0.5,
        h * 0.23,
      );
      ctx.bezierCurveTo(w * 0.98, -h * 0.25, w * 1.4, h * 0.35, w * 0.5, h);
      ctx.closePath();
      break;
    case "arrow":
      path([
        [0, 0.32],
        [0.62, 0.32],
        [0.62, 0],
        [1, 0.5],
        [0.62, 1],
        [0.62, 0.68],
        [0, 0.68],
      ]);
      break;
    case "line":
      ctx.moveTo(0, 0);
      ctx.lineTo(w, h);
      closed = false;
      break;
    case "check":
      path(
        [
          [0, 0.5],
          [0.35, 1],
          [1, 0],
        ],
        false,
      );
      closed = false;
      break;
    case "lightning":
      path([
        [0.6, 0],
        [0.1, 0.6],
        [0.48, 0.6],
        [0.35, 1],
        [0.95, 0.35],
        [0.57, 0.35],
      ]);
      break;
    case "plus":
      path([
        [0.35, 0],
        [0.65, 0],
        [0.65, 0.35],
        [1, 0.35],
        [1, 0.65],
        [0.65, 0.65],
        [0.65, 1],
        [0.35, 1],
        [0.35, 0.65],
        [0, 0.65],
        [0, 0.35],
        [0.35, 0.35],
      ]);
      break;
  }
  if (a.fill && closed) ctx.fill();
  ctx.stroke();
  ctx.restore();
}
export function drawStroke(
  ctx: CanvasRenderingContext2D,
  points: { x: number; y: number }[],
  width: number,
  height: number,
  smooth = false,
) {
  if (!points.length) return;
  ctx.beginPath();
  ctx.moveTo(points[0].x * width, points[0].y * height);
  if (smooth && points.length > 2) {
    for (let i = 1; i < points.length - 1; i++) {
      const p = points[i],
        next = points[i + 1];
      ctx.quadraticCurveTo(
        p.x * width,
        p.y * height,
        ((p.x + next.x) * width) / 2,
        ((p.y + next.y) * height) / 2,
      );
    }
    const last = points[points.length - 1];
    ctx.lineTo(last.x * width, last.y * height);
  } else points.slice(1).forEach((p) => ctx.lineTo(p.x * width, p.y * height));
  ctx.stroke();
}

export interface CurveAnnotation {
  type: "curve";
  points: { x: number; y: number }[];
  color: string;
  width: number;
  closed: boolean;
  fill: boolean;
}
/** Interpolating cubic spline: each clicked node lies on the curve. */
export function drawCurve(
  ctx: CanvasRenderingContext2D,
  curve: CurveAnnotation,
  width: number,
  height: number,
  scale = 1,
) {
  const points = curve.points,
    n = points.length;
  if (n < 2) return;
  const point = (index: number) =>
    points[
      curve.closed ? (index + n) % n : Math.max(0, Math.min(n - 1, index))
    ];
  ctx.save();
  ctx.strokeStyle = ctx.fillStyle = curve.color;
  ctx.lineWidth = curve.width * scale;
  ctx.lineCap = ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(points[0].x * width, points[0].y * height);
  for (let i = 0; i < (curve.closed ? n : n - 1); i++) {
    const p0 = point(i - 1),
      p1 = point(i),
      p2 = point(i + 1),
      p3 = point(i + 2);
    ctx.bezierCurveTo(
      (p1.x + (p2.x - p0.x) / 6) * width,
      (p1.y + (p2.y - p0.y) / 6) * height,
      (p2.x - (p3.x - p1.x) / 6) * width,
      (p2.y - (p3.y - p1.y) / 6) * height,
      p2.x * width,
      p2.y * height,
    );
  }
  if (curve.closed) {
    ctx.closePath();
    if (curve.fill) ctx.fill();
  }
  ctx.stroke();
  ctx.restore();
}
