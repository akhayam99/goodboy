import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { cameraRect, clamp01, fitRect, rectInCanvas, type CameraKey, type Rect } from './camera';

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

function narrowViewport(): boolean {
  return typeof window !== 'undefined' && window.innerWidth < 760;
}

interface TourConfig<V> {
  keyframes: ReadonlyArray<CameraKey>;
  deriveView: (p: number) => V;
  equal: (a: V, b: V) => boolean;
  pad?: number;
  showcase?: number;
}

export function useScrollTour<V>({
  keyframes,
  deriveView,
  equal,
  pad = 0.9,
  showcase = 0.46,
}: TourConfig<V>) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const regions = useRef(new Map<string, HTMLElement>());
  const refCache = useRef(new Map<string, (node: HTMLElement | null) => void>());
  const lastP = useRef(0);

  const [staticMode] = useState(() => prefersReducedMotion() || narrowViewport());
  const first = deriveView(staticMode ? showcase : 0);
  const [view, setView] = useState<V>(first);
  const viewRef = useRef<V>(first);
  const [progress, setProgress] = useState(0);

  const registerRegion = useCallback((key: string) => {
    let cb = refCache.current.get(key);
    if (!cb) {
      cb = (node: HTMLElement | null) => {
        if (node) regions.current.set(key, node);
        else regions.current.delete(key);
      };
      refCache.current.set(key, cb);
    }
    return cb;
  }, []);

  const measure = useCallback((region: string): Rect | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    if (region === 'app') return { x: 0, y: 0, w: canvas.offsetWidth, h: canvas.offsetHeight };
    const el = regions.current.get(region);
    if (!el) return null;
    return rectInCanvas(el, canvas);
  }, []);

  const applyCamera = useCallback(
    (p: number) => {
      const canvas = canvasRef.current;
      const stage = stageRef.current;
      if (!canvas || !stage) return;
      const rect = cameraRect(p, keyframes, measure);
      if (!rect) return;
      const t = fitRect(rect, stage.clientWidth, stage.clientHeight, pad);
      canvas.style.transform = `translate3d(${t.tx}px, ${t.ty}px, 0) scale(${t.scale})`;
    },
    [keyframes, measure, pad],
  );

  useEffect(() => {
    if (staticMode) return;
    let ticking = false;
    const render = () => {
      ticking = false;
      const track = trackRef.current;
      const stage = stageRef.current;
      if (!track || !stage) return;
      const top = track.getBoundingClientRect().top;
      const distance = track.offsetHeight - stage.offsetHeight;
      const p = distance > 0 ? clamp01(-top / distance) : 0;
      lastP.current = p;
      setProgress(p);
      const next = deriveView(p);
      if (!equal(next, viewRef.current)) {
        viewRef.current = next;
        setView(next);
      }
      applyCamera(p);
    };
    const onScroll = () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(render);
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    render();
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [staticMode, deriveView, equal, applyCamera]);

  useLayoutEffect(() => {
    if (!staticMode) applyCamera(lastP.current);
  }, [view, staticMode, applyCamera]);

  return { trackRef, stageRef, canvasRef, registerRegion, view, progress, staticMode };
}
