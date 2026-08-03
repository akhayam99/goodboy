import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  LEFT_SIDEBAR_DEFAULT,
  LEFT_SIDEBAR_MAX,
  LEFT_SIDEBAR_MIN,
  LEFT_SIDEBAR_STORAGE_KEY,
  cn,
} from '@goodboy/ui';
import { SidebarPeekHoldContext, type SidebarPeekHold } from './hold';

const PEEK_WIDTH_FACTOR = 1.2;

const pinnedWidth = (): number => {
  if (typeof localStorage === 'undefined') {
    return LEFT_SIDEBAR_DEFAULT;
  }
  const raw = localStorage.getItem(LEFT_SIDEBAR_STORAGE_KEY);
  if (raw === null) {
    return LEFT_SIDEBAR_DEFAULT;
  }
  const parsed = Number.parseInt(raw, 10);
  if (Number.isNaN(parsed)) {
    return LEFT_SIDEBAR_DEFAULT;
  }
  return Math.max(LEFT_SIDEBAR_MIN, Math.min(LEFT_SIDEBAR_MAX, parsed));
};

const readWidth = (): number =>
  Math.min(LEFT_SIDEBAR_MAX, Math.round(pinnedWidth() * PEEK_WIDTH_FACTOR));

type Props = {
  readonly isPeeking: boolean;
  readonly onEdgeEnter: () => void;
  readonly onEdgeLeave: () => void;
  readonly onPanelEnter: () => void;
  readonly onPanelLeave: () => void;
  readonly onHold: () => void;
  readonly onRelease: () => void;
  readonly children: ReactNode;
};

export const SidebarPeekOverlay = ({
  isPeeking,
  onEdgeEnter,
  onEdgeLeave,
  onPanelEnter,
  onPanelLeave,
  onHold,
  onRelease,
  children,
}: Props) => {
  const [hasEntered, setHasEntered] = useState(false);
  const hold = useMemo<SidebarPeekHold>(
    () => ({ hold: onHold, release: onRelease }),
    [onHold, onRelease],
  );

  useEffect(() => {
    if (!isPeeking) {
      setHasEntered(false);
      return;
    }
    const frame = requestAnimationFrame(() => setHasEntered(true));
    return () => cancelAnimationFrame(frame);
  }, [isPeeking]);

  return (
    <>
      <div
        aria-hidden
        data-testid="sidebar-peek-edge"
        onPointerEnter={onEdgeEnter}
        onPointerLeave={onEdgeLeave}
        className="pointer-events-auto absolute inset-y-0 left-0 w-1.5"
      />
      {isPeeking ? (
        <SidebarPeekHoldContext value={hold}>
          <div
            role="region"
            aria-label="Sessions"
            onPointerEnter={onPanelEnter}
            onPointerLeave={onPanelLeave}
            style={{ width: readWidth() }}
            className={cn(
              'pointer-events-auto absolute inset-y-0 left-0 flex min-h-0 flex-col overflow-hidden',
              'bg-background shadow-[16px_0_40px_-24px_rgba(0,0,0,0.5)]',
              'motion-safe:transition-transform duration-200 ease-out',
              hasEntered ? 'translate-x-0' : '-translate-x-full',
            )}
          >
            {children}
            <span
              aria-hidden
              className="pointer-events-none absolute inset-y-0 right-0 w-px bg-gradient-to-b from-transparent via-border-soft to-transparent"
            />
          </div>
        </SidebarPeekHoldContext>
      ) : null}
    </>
  );
};
