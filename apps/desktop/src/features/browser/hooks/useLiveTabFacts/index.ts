import { useCallback, useEffect, useRef, useState } from 'react';
import type { SessionId } from '@goodboy/types';
import { usePoll } from '../../../../shared/lib/usePoll';
import { browserHost } from '../../browserHost';
import { browserPaneRequests } from '../../browserPaneRequests';
import { sameFacts } from '../../sameFacts';
import type { BrowserTabFacts } from '../../types';

type ErrorParams = {
  readonly error: unknown;
};

type Params = {
  readonly sessionId: SessionId;
  readonly onError: (params: ErrorParams) => void;
};

type LiveTabFacts = {
  readonly facts: ReadonlyArray<BrowserTabFacts>;
  readonly refresh: () => void;
};

const POLL_MS = 1500;

const NO_FACTS: ReadonlyArray<BrowserTabFacts> = [];

export const useLiveTabFacts = ({ sessionId, onError }: Params): LiveTabFacts => {
  const [facts, setFacts] = useState<ReadonlyArray<BrowserTabFacts>>(NO_FACTS);
  const factsRef = useRef(facts);
  factsRef.current = facts;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  const refresh = useCallback(() => {
    const claimed = browserPaneRequests.facts.claim({
      key: browserPaneRequests.factsKey({ sessionId }),
    });
    void browserHost.list({ sessionId }).then(
      (next) => {
        if (claimed.isCurrent() && !sameFacts({ a: factsRef.current, b: next })) {
          setFacts(next);
        }
      },
      (error: unknown) => {
        if (claimed.isCurrent()) {
          onErrorRef.current({ error });
        }
      },
    );
  }, [sessionId]);

  usePoll({ run: refresh, everyMs: POLL_MS, restartKey: sessionId });

  useEffect(
    () => () => {
      browserPaneRequests.facts.cancel({ key: browserPaneRequests.factsKey({ sessionId }) });
    },
    [sessionId],
  );

  return { facts, refresh };
};
