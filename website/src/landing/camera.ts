export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Transform {
  scale: number;
  tx: number;
  ty: number;
}

export interface CameraKey {
  at: number;
  region: string;
}

export function clamp01(t: number): number {
  return t < 0 ? 0 : t > 1 ? 1 : t;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function smoothstep(t: number): number {
  const x = clamp01(t);
  return x * x * x * (x * (x * 6 - 15) + 10);
}

export function band(p: number, a: number, b: number): number {
  return clamp01((p - a) / (b - a));
}

export function lerpRect(a: Rect, b: Rect, t: number): Rect {
  return {
    x: lerp(a.x, b.x, t),
    y: lerp(a.y, b.y, t),
    w: lerp(a.w, b.w, t),
    h: lerp(a.h, b.h, t),
  };
}

export function fitRect(rect: Rect, viewW: number, viewH: number, pad: number): Transform {
  const safeW = Math.max(rect.w, 1);
  const safeH = Math.max(rect.h, 1);
  const scale = Math.min(viewW / safeW, viewH / safeH) * pad;
  const cx = rect.x + rect.w / 2;
  const cy = rect.y + rect.h / 2;
  return { scale, tx: viewW / 2 - cx * scale, ty: viewH / 2 - cy * scale };
}

export function rectInCanvas(el: HTMLElement, canvas: HTMLElement): Rect {
  let x = 0;
  let y = 0;
  let node: HTMLElement | null = el;
  while (node && node !== canvas) {
    x += node.offsetLeft;
    y += node.offsetTop;
    node = node.offsetParent as HTMLElement | null;
  }
  return { x, y, w: el.offsetWidth, h: el.offsetHeight };
}

export function cameraRect(
  p: number,
  keys: ReadonlyArray<CameraKey>,
  measure: (region: string) => Rect | null,
): Rect | null {
  if (keys.length === 0) return null;
  if (p <= keys[0].at) return measure(keys[0].region);
  const last = keys[keys.length - 1];
  if (p >= last.at) return measure(last.region);
  for (let i = 0; i < keys.length - 1; i += 1) {
    const a = keys[i];
    const b = keys[i + 1];
    if (p >= a.at && p <= b.at) {
      const span = b.at - a.at;
      const local = span > 0 ? (p - a.at) / span : 0;
      const ra = measure(a.region);
      const rb = measure(b.region);
      if (!ra || !rb) return ra ?? rb;
      return lerpRect(ra, rb, smoothstep(local));
    }
  }
  return measure(last.region);
}
