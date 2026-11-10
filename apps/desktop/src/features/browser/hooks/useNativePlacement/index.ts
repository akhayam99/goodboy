import { useEffect, useRef, type RefObject } from 'react';
import type { SessionId } from '@goodboy/types';
import type { BrowserTab } from '../../../../store/slices/browser/types';
import { createNativePlacement } from '../../createNativePlacement';
import { createOverlayWatch } from '../../createOverlayWatch';
import { viewBoundsOf } from '../../viewBoundsOf';

type ErrorParams = {
  readonly error: unknown;
};

type Params = {
  readonly sessionId: SessionId;
  readonly frame: RefObject<HTMLDivElement | null>;
  readonly view: RefObject<HTMLDivElement | null>;
  readonly tab: BrowserTab | null;
  readonly attempt: number;
  readonly onError: (params: ErrorParams) => void;
};

export const useNativePlacement = ({
  sessionId,
  frame,
  view,
  tab,
  attempt,
  onError,
}: Params): void => {
  const tabRef = useRef(tab);
  tabRef.current = tab;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;
  const placementRef = useRef<ReturnType<typeof createNativePlacement> | null>(null);

  useEffect(() => {
    const placement = createNativePlacement({
      sessionId,
      onError: ({ error }) => onErrorRef.current({ error }),
    });
    placementRef.current = placement;
    const overlays = createOverlayWatch();
    const sync = (): void => {
      const wantedTab = tabRef.current;
      const bounds = wantedTab === null ? null : viewBoundsOf({ view: view.current, overlays });
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
};
