import { useEffect, useRef } from 'react';
import { canAnimate } from '@goodboy/ui';
import type { DemoRect } from './director/demoProtocol';

type Size = {
  readonly width: number;
  readonly height: number;
};

type Props = {
  readonly target: DemoRect;
  readonly bounds: Size;
};

const ENTER_MS = 160;
const PANEL = 'absolute bg-scrim opacity-60 backdrop-blur-sm';

export const DemoSpotlight = ({ target, bounds }: Props) => {
  const ref = useRef<HTMLDivElement>(null);
  const right = target.x + target.width;
  const bottom = target.y + target.height;

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

  return (
    <div ref={ref} data-testid="demo-spotlight" aria-hidden className="absolute inset-0">
      <div
        className={PANEL}
        style={{ left: 0, top: 0, width: bounds.width, height: Math.max(0, target.y) }}
      />
      <div
        className={PANEL}
        style={{
          left: 0,
          top: bottom,
          width: bounds.width,
          height: Math.max(0, bounds.height - bottom),
        }}
      />
      <div
        className={PANEL}
        style={{ left: 0, top: target.y, width: Math.max(0, target.x), height: target.height }}
      />
      <div
        className={PANEL}
        style={{
          left: right,
          top: target.y,
          width: Math.max(0, bounds.width - right),
          height: target.height,
        }}
      />
    </div>
  );
};
