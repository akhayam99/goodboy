import type { AppStore } from '../../../store/store';
import { isLiveSession } from './isLiveSession';

const attempted = new Set<string>();

type Params = {
  readonly state: AppStore;
};

type OnceParams = {
  readonly key: string;
  readonly run: () => Promise<void>;
};

const once = ({ key, run }: OnceParams): void => {
  if (attempted.has(key)) {
    return;
  }
  attempted.add(key);
  void run().catch((error: unknown) => console.error('[companion] session detail failed', error));
};

export const preloadSessionDetail = ({ state }: Params): void => {
  for (const session of state.sessions) {
    if (!isLiveSession({ session })) {
      continue;
    }
    const sessionId = session.id;
    if (state.sessionArtifacts[sessionId] === undefined) {
      once({
        key: `artifacts:${sessionId}`,
        run: () => state.loadSessionArtifacts(sessionId),
      });
    }
    if (state.sessionAnsweredQuestions[sessionId] === undefined) {
      once({
        key: `answered:${sessionId}`,
        run: () => state.loadSessionAnsweredQuestions(sessionId),
      });
    }
  }
};
