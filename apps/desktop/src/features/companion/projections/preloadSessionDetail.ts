import { useAppStore } from '../../../store/store';
import type { AppStore } from '../../../store/store';
import { isLiveSession } from './isLiveSession';

export const PRELOAD_MAX_TRIES = 5;
export const PRELOAD_BACKOFF_MS = 2000;

type Attempt = {
  tries: number;
  retryAt: number;
  isRunning: boolean;
};

const attempts = new Map<string, Attempt>();

export const resetPreloadSessionDetail = (): void => {
  attempts.clear();
};

type Params = {
  readonly state: AppStore;
  readonly now: number;
};

type LoadedParams = {
  readonly state: AppStore;
};

type LoadParams = {
  readonly key: string;
  readonly now: number;
  readonly run: () => Promise<void>;
  readonly isLoaded: (params: LoadedParams) => boolean;
};

const load = ({ key, now, run, isLoaded }: LoadParams): void => {
  const known = attempts.get(key);
  if (
    known !== undefined &&
    (known.isRunning || known.tries >= PRELOAD_MAX_TRIES || now < known.retryAt)
  ) {
    return;
  }
  const attempt: Attempt = known ?? { tries: 0, retryAt: 0, isRunning: false };
  attempts.set(key, attempt);
  attempt.isRunning = true;
  attempt.tries += 1;
  void run()
    .catch((error: unknown) => console.error('[companion] session detail failed', error))
    .finally(() => {
      attempt.isRunning = false;
      if (isLoaded({ state: useAppStore.getState() })) {
        attempts.delete(key);
        return;
      }
      attempt.retryAt = Date.now() + PRELOAD_BACKOFF_MS * 2 ** (attempt.tries - 1);
    });
};

export const preloadSessionDetail = ({ state, now }: Params): void => {
  for (const session of state.sessions) {
    if (!isLiveSession({ session })) {
      continue;
    }
    const sessionId = session.id;
    if (state.sessionArtifacts[sessionId] === undefined) {
      load({
        key: `artifacts:${sessionId}`,
        now,
        run: () => state.loadSessionArtifacts(sessionId),
        isLoaded: ({ state: current }) => current.sessionArtifacts[sessionId] !== undefined,
      });
    }
    if (state.sessionAnsweredQuestions[sessionId] === undefined) {
      load({
        key: `answered:${sessionId}`,
        now,
        run: () => state.loadSessionAnsweredQuestions(sessionId),
        isLoaded: ({ state: current }) => current.sessionAnsweredQuestions[sessionId] !== undefined,
      });
    }
  }
};
