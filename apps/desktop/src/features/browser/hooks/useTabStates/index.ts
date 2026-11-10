import { useEffect, useState } from 'react';
import { listenTabState } from '../../listenTabState';
import type { BrowserTabFacts, BrowserTabState } from '../../types';

type Params = {
  readonly facts: ReadonlyArray<BrowserTabFacts>;
};

type TabStates = ReadonlyMap<string, BrowserTabState>;

const NO_STATES: TabStates = new Map();

export const useTabStates = ({ facts }: Params): TabStates => {
  const [states, setStates] = useState<TabStates>(NO_STATES);

  useEffect(() => {
    setStates(new Map(facts.map((fact) => [fact.id, fact.state])));
  }, [facts]);

  useEffect(() => {
    let isLive = true;
    let unlisten: (() => void) | null = null;
    void listenTabState({
      onState: ({ facts: told }) =>
        setStates((current) => new Map(current).set(told.id, told.state)),
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
  }, []);

  return states;
};
