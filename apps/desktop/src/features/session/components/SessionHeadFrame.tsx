import { useCallback, useMemo, useState, type ReactNode } from 'react';
import {
  SessionHeadSlotsContext,
  type HeadClaimParams,
  type SessionHeadSlots,
} from '../sessionHeadSlotsContext';

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
  const [claims, setClaims] = useState<Claims>(NO_CLAIMS);
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
      frame,
      isTitleClaimed: claims.title > 0,
      isHeadingClaimed: claims.heading > 0,
      setTitle,
      setMeta,
      claim,
    }),
    [title, meta, aside, frame, claims, claim],
  );
  return (
    <SessionHeadSlotsContext.Provider value={slots}>
      <div ref={setFrame} data-session-head-frame="" className="flex h-full w-full min-w-0">
        <div className="@container relative flex h-full min-w-0 flex-1 flex-col gap-2">
          {head}
          {children}
        </div>
        <div ref={setAside} data-session-aside="" className="flex shrink-0 empty:hidden" />
      </div>
    </SessionHeadSlotsContext.Provider>
  );
};
