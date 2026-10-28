import type { SessionId } from '@goodboy/types';
import type { AppStore } from '../../store/store';

type Params = {
  readonly state: Pick<AppStore, 'reviewSelection' | 'setReviewSelection'>;
  readonly sessionId: SessionId;
  readonly threadIds: ReadonlyArray<string>;
};

export const dropLaunchedSelection = ({ state, sessionId, threadIds }: Params): void => {
  const stored = state.reviewSelection[sessionId] ?? [];
  const launched = new Set(threadIds);
  if (!stored.some((threadId) => launched.has(threadId))) {
    return;
  }
  state.setReviewSelection({
    sessionId,
    threadIds: stored.filter((threadId) => !launched.has(threadId)),
  });
};
