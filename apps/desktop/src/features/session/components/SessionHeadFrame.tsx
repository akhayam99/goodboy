import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import { PANE_RHYTHM, UnderHeadContext, cn } from '@goodboy/ui';
import {
  SessionHeadSlotsContext,
  type HeadClaimParams,
  type SessionHeadSlots,
} from '../sessionHeadSlotsContext';
import { useHeadInset } from '../hooks/useHeadInset';

type Props = {
  readonly head: ReactNode;
  readonly children: ReactNode;
};

type Claims = Readonly<Record<HeadClaimParams['part'], number>>;

const NO_CLAIMS: Claims = { title: 0, heading: 0 };

export const SessionHeadFrame = ({ head, children }: Props) => {
  const [frame, setFrame] = useState<HTMLElement | null>(null);
  const [title, setTitle] = useState<HTMLElement | null>(null);
  const [meta, setMeta] = useState<HTMLElement | null>(null);
  const [aside, setAside] = useState<HTMLElement | null>(null);
  const [lead, setLead] = useState<HTMLElement | null>(null);
  const [claims, setClaims] = useState<Claims>(NO_CLAIMS);
  const columnRef = useRef<HTMLDivElement | null>(null);
  const headRef = useRef<HTMLDivElement | null>(null);
  useHeadInset({ columnRef, headRef });
  const claim = useCallback(({ part, isClaimed }: HeadClaimParams) => {
    setClaims((current) => ({
      ...current,
      [part]: Math.max(0, current[part] + (isClaimed ? 1 : -1)),
    }));
  }, []);
  const slots = useMemo<SessionHeadSlots>(
    () => ({
      title,
      meta,
      aside,
      lead,
      frame,
      isTitleClaimed: claims.title > 0,
      isHeadingClaimed: claims.heading > 0,
      setTitle,
      setMeta,
      claim,
    }),
    [title, meta, aside, lead, frame, claims, claim],
  );
  return (
    <SessionHeadSlotsContext.Provider value={slots}>
      <div ref={setFrame} data-session-head-frame="" className="flex h-full w-full min-w-0">
        <div ref={setLead} data-session-lead="" className="flex shrink-0 empty:hidden" />
        <div ref={columnRef} className="@container relative flex h-full min-w-0 flex-1 flex-col">
          <div
            ref={headRef}
            data-session-head-band=""
            className={cn('relative z-40 shrink-0', PANE_RHYTHM.head.under)}
          >
            {head}
          </div>
          <UnderHeadContext.Provider value>{children}</UnderHeadContext.Provider>
        </div>
        <div ref={setAside} data-session-aside="" className="flex shrink-0 empty:hidden" />
      </div>
    </SessionHeadSlotsContext.Provider>
  );
};
