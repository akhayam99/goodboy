import { useLayoutEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '../cn';
import { SHELL_GUTTER_PX } from '../frameGeometry';
import { usePopoverPortalTarget } from '../PopoverPortalContext';
import { useFloatingPlace } from '../useFloatingPlace';

const LAYER_GAP_PX = 4;

type Props = {
  readonly side: 'top' | 'bottom';
  readonly children: ReactNode;
  readonly isAnchorWidth?: boolean;
  readonly maxWidth?: number;
  readonly className?: string;
};

export const AnchoredLayer = ({
  side,
  children,
  isAnchorWidth = false,
  maxWidth,
  className,
}: Props) => {
  const markerRef = useRef<HTMLSpanElement | null>(null);
  const layerRef = useRef<HTMLDivElement | null>(null);
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [anchorWidth, setAnchorWidth] = useState(0);
  const [sizeKey, setSizeKey] = useState(0);
  const layerTarget = usePopoverPortalTarget();

  useLayoutEffect(() => {
    setAnchor(markerRef.current?.parentElement ?? null);
  }, []);

  useLayoutEffect(() => {
    const layer = layerRef.current;
    if (anchor === null || layer === null) {
      return;
    }
    const resize = () => {
      setAnchorWidth(anchor.getBoundingClientRect().width);
      setSizeKey((key) => key + 1);
    };
    resize();
    if (typeof ResizeObserver === 'undefined') {
      return;
    }
    const observer = new ResizeObserver(resize);
    observer.observe(anchor);
    observer.observe(layer);
    return () => observer.disconnect();
  }, [anchor]);

  const place = useFloatingPlace({
    anchor,
    tipRef: layerRef,
    isActive: anchor !== null,
    side,
    gap: LAYER_GAP_PX,
    edge: SHELL_GUTTER_PX,
    alignment: 'start',
    crossInset: 0,
    contentKey: sizeKey,
  });

  const target = layerTarget ?? anchor?.closest('dialog[open]') ?? document.body;
  const roomWidth = `calc(100vw - ${SHELL_GUTTER_PX * 2}px)`;

  return (
    <>
      <span ref={markerRef} hidden />
      {anchor === null
        ? null
        : createPortal(
            <div
              ref={layerRef}
              data-anchored-layer=""
              style={{
                position: 'fixed',
                top: place === null ? 0 : place.top,
                left: place === null ? 0 : place.left,
                maxHeight: place === null ? undefined : place.maxHeight,
                width: isAnchorWidth && anchorWidth > 0 ? anchorWidth : undefined,
                maxWidth: maxWidth === undefined ? roomWidth : `min(${maxWidth}px, ${roomWidth})`,
                visibility: place === null ? 'hidden' : 'visible',
              }}
              className={cn('z-popover', className)}
            >
              {children}
            </div>,
            target,
          )}
    </>
  );
};
