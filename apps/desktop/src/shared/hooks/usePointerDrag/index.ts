import { useCallback, useEffect, useRef } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { registerEscapeLayer } from '@goodboy/ui';

const POINTER_DRAG_THRESHOLD_PX = 5;

type PointerDragPoint = {
  readonly x: number;
  readonly y: number;
  readonly isAlt: boolean;
};

type Phase<Payload> = PointerDragPoint & {
  readonly payload: Payload;
};

type MovePhase<Payload> = Phase<Payload> & {
  readonly event: PointerEvent;
};

type CancelPhase<Payload> = {
  readonly payload: Payload;
};

type Params<Payload> = {
  readonly isEnabled?: boolean;
  readonly canStartOnControls?: boolean;
  readonly onStart?: (phase: MovePhase<Payload>) => void;
  readonly onMove?: (phase: MovePhase<Payload>) => void;
  readonly onRelease?: (phase: Phase<Payload>) => void;
  readonly onCancel?: (phase: CancelPhase<Payload>) => void;
};

type DownParams<Payload> = {
  readonly event: ReactPointerEvent<HTMLElement>;
  readonly payload: Payload;
};

type ControlParams = {
  readonly target: EventTarget | null;
};

const isControl = ({ target }: ControlParams): boolean =>
  target instanceof Element &&
  target.closest('button, input, textarea, a, [role="menuitem"]') !== null;

export const usePointerDrag = <Payload>(params: Params<Payload>) => {
  const latest = useRef(params);
  latest.current = params;
  const detach = useRef<(() => void) | null>(null);

  useEffect(
    () => () => {
      detach.current?.();
      detach.current = null;
    },
    [],
  );

  const onPointerDown = useCallback(({ event, payload }: DownParams<Payload>) => {
    const current = latest.current;
    if (current.isEnabled === false || event.button !== 0) {
      return;
    }
    if (current.canStartOnControls !== true && isControl({ target: event.target })) {
      return;
    }
    const x0 = event.clientX;
    const y0 = event.clientY;
    let isStarted = false;
    let lastPoint: PointerDragPoint = { x: x0, y: y0, isAlt: event.altKey };
    let releaseEscape: (() => void) | null = null;
    const phase = (): Phase<Payload> => ({ payload, ...lastPoint });
    const stop = () => {
      detach.current?.();
      detach.current = null;
    };
    const cancel = () => {
      const wasStarted = isStarted;
      stop();
      if (wasStarted) {
        latest.current.onCancel?.({ payload });
      }
    };
    const onMove = (move: PointerEvent) => {
      lastPoint = { x: move.clientX, y: move.clientY, isAlt: move.altKey };
      if (
        !isStarted &&
        Math.hypot(move.clientX - x0, move.clientY - y0) < POINTER_DRAG_THRESHOLD_PX
      ) {
        return;
      }
      if (!isStarted) {
        isStarted = true;
        window.getSelection()?.removeAllRanges();
        releaseEscape = registerEscapeLayer(cancel);
        latest.current.onStart?.({ ...phase(), event: move });
      }
      move.preventDefault();
      latest.current.onMove?.({ ...phase(), event: move });
    };
    const onUp = (up: PointerEvent) => {
      lastPoint = { x: up.clientX, y: up.clientY, isAlt: up.altKey };
      const wasStarted = isStarted;
      stop();
      if (wasStarted) {
        latest.current.onRelease?.(phase());
      }
    };
    stop();
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', cancel);
    detach.current = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', cancel);
      releaseEscape?.();
      releaseEscape = null;
    };
  }, []);

  return { onPointerDown };
};
