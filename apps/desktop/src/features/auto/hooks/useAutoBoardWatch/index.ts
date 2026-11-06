import { useEffect } from 'react';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { startSharedPoll } from '../../useAutoTrees/sharedPoll';
import { watchedAutoSessionsOf } from '../../watchedAutoSessionsOf';

type Inputs = Readonly<{
  sessions: unknown;
  sessionPhaseRuns: unknown;
  autoTreeViews: unknown;
  agentKindOverride: unknown;
}>;

type SameParams = {
  readonly first: Inputs | null;
  readonly second: Inputs;
};

const isSameInputs = ({ first, second }: SameParams): boolean =>
  first !== null &&
  first.sessions === second.sessions &&
  first.sessionPhaseRuns === second.sessionPhaseRuns &&
  first.autoTreeViews === second.autoTreeViews &&
  first.agentKindOverride === second.agentKindOverride;

type LoadParams = {
  readonly sessionId: SessionId;
  readonly reported: Set<SessionId>;
};

const loadOnce = ({ sessionId, reported }: LoadParams): void => {
  const state = useAppStore.getState();
  state
    .loadAutoTrees({ sessionId })
    .then(() => {
      reported.delete(sessionId);
    })
    .catch((error: unknown) => {
      if (reported.has(sessionId)) {
        return;
      }
      reported.add(sessionId);
      void state.reportError({ title: "Couldn't read the Auto agents", error, sessionId });
    });
};

export const useAutoBoardWatch = (): void => {
  useEffect(() => {
    const stops = new Map<SessionId, () => void>();
    const reported = new Set<SessionId>();
    let seen: Inputs | null = null;
    const sync = (): void => {
      const state = useAppStore.getState();
      const inputs: Inputs = {
        sessions: state.sessions,
        sessionPhaseRuns: state.sessionPhaseRuns,
        autoTreeViews: state.autoTreeViews,
        agentKindOverride: state.agentKindOverride,
      };
      if (isSameInputs({ first: seen, second: inputs })) {
        return;
      }
      seen = inputs;
      const wanted = new Set(watchedAutoSessionsOf({ state }));
      for (const [sessionId, stop] of stops) {
        if (!wanted.has(sessionId)) {
          stop();
          stops.delete(sessionId);
        }
      }
      for (const sessionId of wanted) {
        if (!stops.has(sessionId)) {
          stops.set(
            sessionId,
            startSharedPoll({ sessionId, load: () => loadOnce({ sessionId, reported }) }),
          );
        }
      }
    };
    sync();
    const unsubscribe = useAppStore.subscribe(sync);
    return () => {
      unsubscribe();
      for (const stop of stops.values()) {
        stop();
      }
    };
  }, []);
};
