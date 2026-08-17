import { useEffect, useRef, useState, type RefObject } from 'react';
import { getCurrentWebview } from '@tauri-apps/api/webview';
import { currentZoom } from '../../lib/zoom';

type Point = {
  readonly x: number;
  readonly y: number;
};

type DropPaths = {
  readonly paths: ReadonlyArray<string>;
};

type Params = {
  readonly isEnabled?: boolean;
  readonly onAmbiguousDrop?: () => void;
  readonly onDisabledDrop?: () => void;
  readonly onDropPaths: (value: DropPaths) => void;
  readonly onUnavailable?: () => void;
  readonly targetRef: RefObject<HTMLElement | null>;
};

type DropTargetResult = {
  readonly isAmbiguousMiss: boolean;
  readonly isHit: boolean;
};

const visibleDropTargets = (): HTMLElement[] =>
  Array.from(document.querySelectorAll<HTMLElement>('[data-drop-composer]')).filter(
    (element) => element.offsetParent !== null,
  );

const isInside = ({
  element,
  point,
}: {
  readonly element: HTMLElement;
  readonly point: Point;
}): boolean => {
  const rect = element.getBoundingClientRect();
  return (
    point.x >= rect.left && point.x <= rect.right && point.y >= rect.top && point.y <= rect.bottom
  );
};

const hitTarget = ({
  elements,
  point,
}: {
  readonly elements: ReadonlyArray<HTMLElement>;
  readonly point: Point;
}): HTMLElement | null =>
  [...elements].reverse().find((element) => isInside({ element, point })) ?? null;

const resolveTarget = ({
  px,
  py,
  target,
}: {
  readonly px: number;
  readonly py: number;
  readonly target: HTMLElement;
}): DropTargetResult => {
  const visible = visibleDropTargets();
  if (visible.length <= 1) {
    return {
      isHit: visible.length === 1 && visible[0] === target,
      isAmbiguousMiss: false,
    };
  }

  const zoom = currentZoom();
  const devicePixelRatio = window.devicePixelRatio === 0 ? 1 : window.devicePixelRatio;
  const logicalHit = hitTarget({
    elements: visible,
    point: { x: px / zoom, y: py / zoom },
  });
  if (logicalHit !== null) {
    return { isHit: logicalHit === target, isAmbiguousMiss: false };
  }

  const physicalHit = hitTarget({
    elements: visible,
    point: { x: px / (devicePixelRatio * zoom), y: py / (devicePixelRatio * zoom) },
  });
  if (physicalHit !== null) {
    return { isHit: physicalHit === target, isAmbiguousMiss: false };
  }

  return { isHit: false, isAmbiguousMiss: true };
};

export const useFileDropTarget = ({
  isEnabled = true,
  onAmbiguousDrop,
  onDisabledDrop,
  onDropPaths,
  onUnavailable,
  targetRef,
}: Params) => {
  const [isDragging, setIsDragging] = useState(false);
  const isEnabledRef = useRef(isEnabled);
  const onAmbiguousDropRef = useRef(onAmbiguousDrop);
  const onDisabledDropRef = useRef(onDisabledDrop);
  const onDropPathsRef = useRef(onDropPaths);
  const onUnavailableRef = useRef(onUnavailable);
  isEnabledRef.current = isEnabled;
  onAmbiguousDropRef.current = onAmbiguousDrop;
  onDisabledDropRef.current = onDisabledDrop;
  onDropPathsRef.current = onDropPaths;
  onUnavailableRef.current = onUnavailable;

  useEffect(() => {
    let isCancelled = false;
    let unlisten: (() => void) | null = null;

    void (async () => {
      try {
        const stopListening = await getCurrentWebview().onDragDropEvent((event) => {
          const payload = event.payload;
          if (payload.type === 'leave') {
            setIsDragging(false);
            return;
          }
          if (payload.type === 'enter' || payload.type === 'over') {
            const target = targetRef.current;
            if (target === null) {
              setIsDragging(false);
              return;
            }
            const result = resolveTarget({
              px: payload.position.x,
              py: payload.position.y,
              target,
            });
            setIsDragging(isEnabledRef.current && result.isHit);
            return;
          }

          setIsDragging(false);
          const target = targetRef.current;
          if (target === null) {
            return;
          }
          const result = resolveTarget({
            px: payload.position.x,
            py: payload.position.y,
            target,
          });
          if (!result.isHit) {
            if (result.isAmbiguousMiss) {
              onAmbiguousDropRef.current?.();
            }
            return;
          }
          if (!isEnabledRef.current) {
            onDisabledDropRef.current?.();
            return;
          }
          onDropPathsRef.current({ paths: payload.paths });
        });
        if (isCancelled) {
          stopListening();
          return;
        }
        unlisten = stopListening;
      } catch {
        onUnavailableRef.current?.();
      }
    })();

    return () => {
      isCancelled = true;
      unlisten?.();
    };
  }, [targetRef]);

  return { isDragging };
};
