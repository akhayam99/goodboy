import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Divider, Popover, ScrollFade, StatusDot } from '@goodboy/ui';
import type { Session, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../store';
import { NeedsYouSessionRow } from './NeedsYouSessionRow';

type Props = {
  readonly sessions: ReadonlyArray<Session>;
  readonly count: number;
};

type PopoverCoordinates = {
  readonly top?: number;
  readonly bottom?: number;
  readonly left: number;
};

type SelectParams = {
  readonly sessionId: SessionId;
};

const DROPDOWN_WIDTH = 320;
const VIEWPORT_MARGIN = 8;
const LIST_MAX_HEIGHT = 320;
const HEADER_HEIGHT = 37;
const DROPDOWN_MAX_HEIGHT = LIST_MAX_HEIGHT + HEADER_HEIGHT;

export const NeedsYouPopover = ({ sessions, count }: Props) => {
  const setCurrentSession = useAppStore((state) => state.setCurrentSession);
  const setActiveLens = useAppStore((state) => state.setActiveLens);
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [coordinates, setCoordinates] = useState<PopoverCoordinates | null>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen]);

  useLayoutEffect(() => {
    if (!isOpen) {
      return;
    }

    const updatePosition = () => {
      const trigger = triggerRef.current;
      if (trigger == null) {
        return;
      }

      const rect = trigger.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const desiredLeft = centerX - DROPDOWN_WIDTH / 2;
      const maxLeft = window.innerWidth - DROPDOWN_WIDTH - VIEWPORT_MARGIN;
      const left = Math.min(Math.max(desiredLeft, VIEWPORT_MARGIN), maxLeft);
      const spaceBelow = window.innerHeight - rect.bottom;
      const shouldOpenAbove = spaceBelow < DROPDOWN_MAX_HEIGHT + VIEWPORT_MARGIN;
      const top = shouldOpenAbove ? undefined : rect.bottom + 6;
      const bottom = shouldOpenAbove ? window.innerHeight - rect.top + 6 : undefined;
      setCoordinates({ top, bottom, left });
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [isOpen]);

  const selectSession = ({ sessionId }: SelectParams) => {
    setIsOpen(false);
    void setCurrentSession(sessionId).then(() => {
      setActiveLens(sessionId, null);
    });
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        aria-label={`${count} ${count === 1 ? 'session needs' : 'sessions need'} you`}
        aria-expanded={isOpen}
        className="flex items-center gap-1 rounded px-1.5 py-1 transition-colors hover:bg-muted/50"
      >
        <StatusDot tone="warning" size="sm" pulsing />
        <span className="font-medium tabular-nums text-foreground">{count}</span>
        <span className="text-muted-foreground">need you</span>
      </button>

      {isOpen && coordinates != null
        ? createPortal(
            <>
              <div className="fixed inset-0 z-30" onClick={() => setIsOpen(false)} aria-hidden />
              <Popover
                role="dialog"
                ariaLabel="Sessions needing attention"
                className="fixed z-40 w-80"
                style={{
                  top: coordinates.top,
                  bottom: coordinates.bottom,
                  left: coordinates.left,
                }}
              >
                <header className="flex items-center gap-2 px-3 py-2">
                  <StatusDot tone="warning" size="sm" />
                  <span className="text-xs font-semibold text-foreground">Needs you</span>
                  <span className="ml-auto text-2xs tabular-nums text-muted-foreground">
                    {count}
                  </span>
                </header>
                <Divider />
                <ScrollFade className="max-h-80" fadeSize={16}>
                  <ul aria-label="Sessions needing attention">
                    {sessions.map((session) => (
                      <NeedsYouSessionRow
                        key={session.id}
                        session={session}
                        onSelect={selectSession}
                      />
                    ))}
                  </ul>
                </ScrollFade>
              </Popover>
            </>,
            document.body,
          )
        : null}
    </>
  );
};
