import type { ResolveCommitStyle, SessionId } from '@goodboy/types';
import type { AppStore } from '../../../store/store';
import { sessionResolveStyle } from '../../../store/sessionReplySettings';
import { draftRoutingOf } from '../draftRouting';
import { launchChoiceOf } from '../launchChoice';
import { startBatch, type StartedBatch } from '../startBatch';

type Params = {
  readonly getState: () => AppStore;
  readonly sessionId: SessionId;
  readonly threadIds: ReadonlyArray<string>;
};

const commitStyleOf = ({
  state,
  sessionId,
}: {
  readonly state: AppStore;
  readonly sessionId: SessionId;
}): ResolveCommitStyle =>
  state.sessionResolveBatches[sessionId]?.at(-1)?.launchChoice.commitStyle ??
  sessionResolveStyle({ state, sessionId }).commitStyle;

export const startNoteFix = ({ getState, sessionId, threadIds }: Params): Promise<StartedBatch> => {
  const state = getState();
  return startBatch({
    getState,
    sessionId,
    threadIds,
    noun: 'note',
    launchChoice: launchChoiceOf({
      routing: draftRoutingOf({ state, sessionId }),
      commitStyle: commitStyleOf({ state, sessionId }),
      hint: null,
    }),
  });
};
