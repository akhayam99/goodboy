import { useEffect, useRef, useState, type RefObject } from 'react';
import type { SessionId } from '@goodboy/types';
import type { BrowserTab } from '../../../../store/slices/browser/types';
import { createNativePlacement } from '../../createNativePlacement';
import { createOverlayWatch, type CoverReason } from '../../createOverlayWatch';
import { viewBoundsOf } from '../../viewBoundsOf';

type ErrorParams = {
  readonly error: unknown;
};

type ShowParams = {
  readonly next: CoverReason | null;
};

type Params = {
  readonly sessionId: SessionId;
  readonly frame: RefObject<HTMLDivElement | null>;
  readonly view: RefObject<HTMLDivElement | null>;
  readonly tab: BrowserTab | null;
  readonly attempt: number;
  readonly maxWidth: number | null;
  readonly onError: (params: ErrorParams) => void;
};

export const useNativePlacement = ({
  sessionId,
  frame,
  view,
  tab,
  attempt,
  maxWidth,
  onError,
}: Params): CoverReason | null => {
  const tabRef = useRef(tab);
  tabRef.current = tab;
  const maxWidthRef = useRef(maxWidth);
  maxWidthRef.current = maxWidth;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;
  const placementRef = useRef<ReturnType<typeof createNativePlacement> | null>(null);
  const [cover, setCover] = useState<CoverReason | null>(null);
  const coverRef = useRef<CoverReason | null>(null);
  const isOverlaidRef = useRef(false);
  const uncoverFrameRef = useRef(0);

  useEffect(() => {
    const show = ({ next }: ShowParams): void => {
      coverRef.current = next;
      setCover(next);
    };
    const uncover = (): void => {
      if (coverRef.current === null || isOverlaidRef.current || uncoverFrameRef.current !== 0) {
        return;
      }
      uncoverFrameRef.current = window.requestAnimationFrame(() => {
        uncoverFrameRef.current = 0;
        if (!isOverlaidRef.current) {
          show({ next: null });
        }
      });
    };
    const placement = createNativePlacement({
      sessionId,
      onError: ({ error }) => onErrorRef.current({ error }),
      onShown: uncover,
    });
    placementRef.current = placement;
    const overlays = createOverlayWatch();
    const sync = (): void => {
      const wantedTab = tabRef.current;
      const element = view.current;
      const reason =
        wantedTab === null || element === null || !element.isConnected
          ? null
          : overlays.coverOf({ view: element, rect: element.getBoundingClientRect() });
      isOverlaidRef.current = reason !== null;
      if (wantedTab === null && coverRef.current !== null) {
        show({ next: null });
      }
      if (reason !== null && reason !== coverRef.current) {
        show({ next: reason });
      }
      const bounds =
        wantedTab === null
          ? null
          : viewBoundsOf({ view: element, overlays, maxWidth: maxWidthRef.current });
      placement.want({
        view: wantedTab === null || bounds === null ? null : { tab: wantedTab, bounds },
      });
    };
    let frameId = 0;
    const tick = (): void => {
      frameId = window.requestAnimationFrame(tick);
      sync();
    };
    frameId = window.requestAnimationFrame(tick);
    const resize = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(sync);
    if (frame.current !== null) {
      resize?.observe(frame.current);
    }
    sync();
    return () => {
      window.cancelAnimationFrame(frameId);
      window.cancelAnimationFrame(uncoverFrameRef.current);
      uncoverFrameRef.current = 0;
      resize?.disconnect();
      overlays.stop();
      placement.stop();
      placementRef.current = null;
    };
  }, [sessionId, frame, view]);

  useEffect(() => {
    if (attempt === 0) {
      return;
    }
    placementRef.current?.retry();
  }, [attempt]);

  return cover;
};
