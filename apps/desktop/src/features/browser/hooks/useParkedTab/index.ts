import { useEffect, useRef, useState } from 'react';
import type { SessionId } from '@goodboy/types';
import { browserHost } from '../../browserHost';

type Params = {
  readonly sessionId: SessionId;
  readonly liveId: string | undefined;
};

type ParkedTab = {
  readonly isParked: boolean;
  readonly isChecking: boolean;
  readonly wake: () => void;
};

type Check =
  | { readonly at: 'checking'; readonly liveId: string }
  | { readonly at: 'parked'; readonly liveId: string }
  | { readonly at: 'awake' };

const AWAKE: Check = { at: 'awake' };

export const useParkedTab = ({ sessionId, liveId }: Params): ParkedTab => {
  const [check, setCheck] = useState<Check>(
    liveId === undefined ? AWAKE : { at: 'checking', liveId },
  );
  const liveIdRef = useRef(liveId);
  liveIdRef.current = liveId;

  useEffect(() => {
    const asked = liveIdRef.current;
    if (asked === undefined) {
      setCheck(AWAKE);
      return;
    }
    let isCurrent = true;
    setCheck({ at: 'checking', liveId: asked });
    void browserHost.list({ sessionId }).then(
      (facts) => {
        if (!isCurrent) {
          return;
        }
        const fact = facts.find((candidate) => candidate.id === asked);
        setCheck(fact?.state === 'closed' ? { at: 'parked', liveId: asked } : AWAKE);
      },
      () => {
        if (isCurrent) {
          setCheck(AWAKE);
        }
      },
    );
    return () => {
      isCurrent = false;
    };
  }, [sessionId]);

  const isOnShown = check.at !== 'awake' && check.liveId === liveId;
  return {
    isParked: isOnShown && check.at === 'parked',
    isChecking: isOnShown && check.at === 'checking',
    wake: () => setCheck(AWAKE),
  };
};
