import { useCallback, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { DiffRailContext, type DiffRailSlot } from '../diffRailContext';
import { clampTreeWidth, useTreeWidth } from '../hooks/useTreeWidth';
import { treeRailModeOf } from '../treeRailMode';

type Props = {
  readonly isActive: boolean;
  readonly children: ReactNode;
};

export const DiffRailScope = ({ isActive, children }: Props) => {
  const paneRef = useRef<HTMLDivElement | null>(null);
  const paneWidthRef = useRef<number | null>(null);
  const [paneWidth, setPaneWidth] = useState<number | null>(null);
  const [host, setHost] = useState<HTMLElement | null>(null);
  const saved = useTreeWidth();
  const width = clampTreeWidth({ width: saved.width, paneWidth: Number.POSITIVE_INFINITY });
  const mode = paneWidth === null ? 'docked' : treeRailModeOf({ paneWidth, railWidth: width });

  useLayoutEffect(() => {
    const element = paneRef.current;
    if (element === null) {
      return;
    }
    const apply = (width: number) => {
      paneWidthRef.current = width > 0 ? width : null;
      setPaneWidth(paneWidthRef.current);
    };
    apply(element.getBoundingClientRect().width);
    if (typeof ResizeObserver === 'undefined') {
      return;
    }
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry !== undefined) {
        apply(entry.contentRect.width);
      }
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const readPaneWidth = useCallback(() => paneWidthRef.current ?? Number.POSITIVE_INFINITY, []);
  const { resizeTo: save } = saved;
  const resizeTo = useCallback(
    (next: number) => save({ width: next, paneWidth: readPaneWidth() }),
    [readPaneWidth, save],
  );

  const slot = useMemo<DiffRailSlot>(
    () => ({ host: isActive ? host : null, mode, width, paneWidth: readPaneWidth, resizeTo }),
    [host, isActive, mode, readPaneWidth, resizeTo, width],
  );

  return (
    <div
      ref={paneRef}
      data-diff-rail-scope=""
      className="relative flex h-full min-h-0 min-w-0 flex-1"
    >
      <DiffRailContext.Provider value={slot}>{children}</DiffRailContext.Provider>
      {isActive ? (
        <div
          ref={setHost}
          data-slot="diff-rail-host"
          className="absolute inset-y-0 left-0 z-20 flex"
        />
      ) : null}
    </div>
  );
};
