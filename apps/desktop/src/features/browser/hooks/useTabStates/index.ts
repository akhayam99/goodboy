import { useCallback, useEffect, useState } from 'react';
import { listenTabState } from '../../listenTabState';
import type { BrowserTabFacts, BrowserTabState } from '../../types';

type ReconcileParams = {
  readonly facts: ReadonlyArray<BrowserTabFacts>;
};

type TabStates = ReadonlyMap<string, BrowserTabState>;

type TabStatesModel = {
  readonly states: TabStates;
  readonly reconcile: (params: ReconcileParams) => void;
};

const NO_STATES: TabStates = new Map();

export const useTabStates = (): TabStatesModel => {
  const [states, setStates] = useState<TabStates>(NO_STATES);

  const reconcile = useCallback(({ facts }: ReconcileParams) => {
    setStates((current) => {
      if (facts.every((fact) => current.get(fact.id) === fact.state)) {
        return current;
      }
      const next = new Map(current);
      facts.forEach((fact) => next.set(fact.id, fact.state));
      return next;
    });
  }, []);

  useEffect(() => {
    let isLive = true;
    let unlisten: (() => void) | null = null;
    void listenTabState({
      onState: ({ facts: told }) => reconcile({ facts: [told] }),
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
  }, [reconcile]);

  return { states, reconcile };
};
