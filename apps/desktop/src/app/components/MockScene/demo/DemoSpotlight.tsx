import { useEffect, useRef } from 'react';
import { canAnimate } from '@goodboy/ui';
import type { DemoRect } from './director/demoProtocol';

type Size = {
  readonly width: number;
  readonly height: number;
};

type Props = {
  readonly hole: DemoRect;
  readonly bounds: Size;
};

type MaskParams = Props & {
  readonly radius: number;
};

const ENTER_MS = 160;
const RADIUS = 12;

const maskOf = ({ hole, bounds, radius }: MaskParams): string => {
  const r = Math.min(radius, hole.width / 2, hole.height / 2);
  const right = hole.x + hole.width;
  const bottom = hole.y + hole.height;
  const frame = `M0 0H${bounds.width}V${bounds.height}H0Z`;
  const cut =
    `M${hole.x + r} ${hole.y}A${r} ${r} 0 0 0 ${hole.x} ${hole.y + r}` +
    `V${bottom - r}A${r} ${r} 0 0 0 ${hole.x + r} ${bottom}H${right - r}` +
    `A${r} ${r} 0 0 0 ${right} ${bottom - r}V${hole.y + r}A${r} ${r} 0 0 0 ${right - r} ${hole.y}Z`;
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${bounds.width}" height="${bounds.height}">` +
    `<path d="${frame}${cut}"/></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
};

export const DemoSpotlight = ({ hole, bounds }: Props) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const layer = ref.current;
    if (layer === null || !canAnimate({ element: layer })) {
      return;
    }
    const fade = layer.animate([{ opacity: 0 }, { opacity: 1 }], {
      duration: ENTER_MS,
      easing: 'ease-out',
    });
    return () => fade.cancel();
  }, []);

  const mask = maskOf({ hole, bounds, radius: RADIUS });

  return (
    <div
      ref={ref}
      data-testid="demo-spotlight"
      data-hole={`${hole.x} ${hole.y} ${hole.width} ${hole.height}`}
      aria-hidden
      className="absolute inset-0 bg-surround/50 backdrop-blur-xs"
      style={{
        maskImage: mask,
        WebkitMaskImage: mask,
        maskSize: '100% 100%',
        WebkitMaskSize: '100% 100%',
        maskRepeat: 'no-repeat',
        WebkitMaskRepeat: 'no-repeat',
      }}
    />
  );
};
