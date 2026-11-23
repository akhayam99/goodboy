import { useEffect, useState } from 'react';
import type { SessionId } from '@goodboy/types';
import { browserHost } from '../../browserHost';
import { browserPaneRequests } from '../../browserPaneRequests';

type Params = {
  readonly sessionId: SessionId;
  readonly liveId: string | undefined;
};

type ParkedTab = {
  readonly isParked: boolean;
  readonly isChecking: boolean;
  readonly wake: () => void;
};

type Check = {
  readonly sessionId: SessionId;
  readonly liveId: string;
  readonly at: 'checking' | 'parked' | 'awake';
};

export const useParkedTab = ({ sessionId, liveId }: Params): ParkedTab => {
  const [check, setCheck] = useState<Check | null>(null);

  useEffect(() => {
    if (liveId === undefined) {
      return;
    }
    if (browserPaneRequests.opened.delete(`${sessionId}:${liveId}`)) {
      setCheck({ sessionId, liveId, at: 'awake' });
      return;
    }
    let isCurrent = true;
    setCheck({ sessionId, liveId, at: 'checking' });
    void browserHost.list({ sessionId }).then(
      (facts) => {
        if (!isCurrent) {
          return;
        }
        const fact = facts.find((candidate) => candidate.id === liveId);
        setCheck({ sessionId, liveId, at: fact?.state === 'closed' ? 'parked' : 'awake' });
      },
      () => {
        if (isCurrent) {
          setCheck({ sessionId, liveId, at: 'awake' });
        }
      },
    );
    return () => {
      isCurrent = false;
    };
  }, [sessionId, liveId]);

  const isOnShown = check !== null && check.sessionId === sessionId && check.liveId === liveId;
  const isUnchecked =
    liveId !== undefined && !isOnShown && !browserPaneRequests.opened.has(`${sessionId}:${liveId}`);
  return {
    isParked: isOnShown && check.at === 'parked',
    isChecking: isUnchecked || (isOnShown && check.at === 'checking'),
    wake: () => {
      if (liveId !== undefined) {
        setCheck({ sessionId, liveId, at: 'awake' });
      }
    },
  };
};
