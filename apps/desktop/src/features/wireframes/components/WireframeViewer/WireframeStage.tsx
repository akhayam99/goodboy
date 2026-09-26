import { useEffect, useRef, useState, type RefObject } from 'react';
import type { WireframeViewport } from '@goodboy/core';
import { cn, ScrollFade } from '@goodboy/ui';
import { frameUrl } from '../../frame/frameUrl';
import { VIEWPORT_MIN_HEIGHT, VIEWPORT_WIDTH } from '../../wireframePalette';

export type WireframeZoom = 'fit' | 'actual';

const DEVICE_CLASSES = {
  desktop: 'rounded-md border border-border-soft',
  tablet: 'rounded-lg border-8 border-border-soft',
  mobile: 'rounded-lg border-8 border-border-soft',
} as const satisfies Record<WireframeViewport, string>;

const DEVICE_INSET = {
  desktop: 2,
  tablet: 16,
  mobile: 16,
} as const satisfies Record<WireframeViewport, number>;

type Props = {
  readonly frameRef: RefObject<HTMLIFrameElement | null>;
  readonly stageId: string;
  readonly path: string;
  readonly loadKey: number;
  readonly viewport: WireframeViewport;
  readonly zoom: WireframeZoom;
  readonly contentHeight: number;
  readonly title: string;
  readonly label?: string;
};

export const WireframeStage = ({
  frameRef,
  stageId,
  path,
  loadKey,
  viewport,
  zoom,
  contentHeight,
  title,
  label,
}: Props) => {
  const boxRef = useRef<HTMLDivElement>(null);
  const [available, setAvailable] = useState<number | null>(null);
  const width = VIEWPORT_WIDTH[viewport];
  const height = Math.max(VIEWPORT_MIN_HEIGHT[viewport], contentHeight);
  const inset = DEVICE_INSET[viewport];
  const scale =
    zoom === 'fit' && available !== null && available > 0
      ? Math.min(1, (available - inset) / width)
      : 1;

  useEffect(() => {
    const node = boxRef.current;
    if (node === null) {
      return;
    }
    const measure = () => setAvailable(node.clientWidth);
    measure();
    if (typeof ResizeObserver === 'undefined') {
      return;
    }
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      data-testid="wireframe-stage"
      data-device={viewport}
      className="flex min-w-0 flex-col gap-2"
    >
      {label === undefined ? null : (
        <span className="font-mono text-secondary text-muted-foreground">{label}</span>
      )}
      <ScrollFade orientation="horizontal" fadeSize="w-8" viewportRef={boxRef}>
        <div className="flex min-w-full justify-center">
          <div
            className={cn('shrink-0 overflow-hidden bg-background', DEVICE_CLASSES[viewport])}
            style={{ width: width * scale + inset, height: height * scale + inset }}
          >
            <iframe
              key={loadKey}
              ref={frameRef}
              title={title}
              src={frameUrl({ stageId, path })}
              sandbox="allow-scripts"
              referrerPolicy="no-referrer"
              data-testid="wireframe-frame"
              className="block border-0 bg-background"
              style={{
                width,
                height,
                transform: `scale(${scale})`,
                transformOrigin: '0 0',
              }}
            />
          </div>
        </div>
      </ScrollFade>
    </div>
  );
};
