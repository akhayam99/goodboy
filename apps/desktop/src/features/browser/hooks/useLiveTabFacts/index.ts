import { useCallback, useEffect, useRef, useState } from 'react';
import type { SessionId } from '@goodboy/types';
import { usePoll } from '../../../../shared/lib/usePoll';
import { browserHost } from '../../browserHost';
import { browserPaneRequests } from '../../browserPaneRequests';
import { factsWithTold } from '../../factsWithTold';
import { listenTabState } from '../../listenTabState';
import { sameFacts } from '../../sameFacts';
import type { BrowserTabFacts } from '../../types';

type ErrorParams = {
  readonly error: unknown;
};

type PolledParams = {
  readonly facts: ReadonlyArray<BrowserTabFacts>;
};

type Params = {
  readonly sessionId: SessionId;
  readonly isWatching: boolean;
  readonly onPolled: (params: PolledParams) => void;
  readonly onError: (params: ErrorParams) => void;
};

type LiveTabFacts = {
  readonly facts: ReadonlyArray<BrowserTabFacts>;
  readonly refresh: () => void;
};

const POLL_MS = 1500;

const NO_FACTS: ReadonlyArray<BrowserTabFacts> = [];

export const useLiveTabFacts = ({
  sessionId,
  isWatching,
  onPolled,
  onError,
}: Params): LiveTabFacts => {
  const [facts, setFacts] = useState<ReadonlyArray<BrowserTabFacts>>(NO_FACTS);
  const factsRef = useRef(facts);
  factsRef.current = facts;
  const onPolledRef = useRef(onPolled);
  onPolledRef.current = onPolled;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;
  const askedFor = useRef<SessionId | null>(null);

  const refresh = useCallback(() => {
    const claimed = browserPaneRequests.facts.claim({
      key: browserPaneRequests.factsKey({ sessionId }),
    });
    void browserHost.list({ sessionId }).then(
      (next) => {
        if (!claimed.isCurrent()) {
          return;
        }
        onPolledRef.current({ facts: next });
        if (!sameFacts({ a: factsRef.current, b: next })) {
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

  useEffect(() => {
    if (isWatching || askedFor.current !== sessionId) {
      askedFor.current = sessionId;
      refresh();
    }
  }, [isWatching, refresh, sessionId]);

  useEffect(() => {
    let isLive = true;
    let unlisten: (() => void) | null = null;
    void listenTabState({
      onState: ({ facts: told }) => {
        onPolledRef.current({ facts: [told] });
        if (told.sessionId !== sessionId) {
          return;
        }
        const next = factsWithTold({ facts: factsRef.current, told });
        if (!sameFacts({ a: factsRef.current, b: next })) {
          setFacts(next);
        }
      },
    }).then((stop) => {
      if (!isLive) {
        stop();
        return;
      }
      unlisten = stop;
    });
    return () => {
      isLive = false;
      unlisten?.();
    };
  }, [sessionId]);

  usePoll({
    run: refresh,
    everyMs: POLL_MS,
    isEnabled: isWatching,
    isImmediate: false,
    restartKey: sessionId,
  });

  useEffect(
    () => () => {
      browserPaneRequests.facts.cancel({ key: browserPaneRequests.factsKey({ sessionId }) });
    },
    [sessionId],
  );

  return { facts, refresh };
};
