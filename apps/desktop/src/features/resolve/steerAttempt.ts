import type { SessionId } from '@goodboy/types';
import type { AppStore } from '../../store/store';
import { draftRoutingOf } from './draftRouting';
import { launchChoiceOf } from './launchChoice';
import { launchRowsOf } from './reviewRows';
import { startBatch, type StartedBatch } from './startBatch';

export type SteerMode = 'fixAnyway' | 'rewrite';

const STEER_BRIEF: Record<SteerMode, string> = {
  fixAnyway:
    'The owner wants a code change for this comment, even though an earlier run found nothing to change. Make the change and commit it.',
  rewrite: 'Reply only. Change no code and make no commit. Write the reply to the reviewer again.',
};

export const steerHintOf = ({
  mode,
  hint,
}: {
  readonly mode: SteerMode;
  readonly hint: string;
}): string => {
  const own = hint.trim();
  return own === '' ? STEER_BRIEF[mode] : `${STEER_BRIEF[mode]}\n\nThe owner adds: ${own}`;
};

type Params = {
  readonly getState: () => AppStore;
  readonly sessionId: SessionId;
  readonly threadId: string;
  readonly mode: SteerMode;
  readonly hint: string;
};

export const startSteeredAttempt = async ({
  getState,
  sessionId,
  threadId,
  mode,
  hint,
}: Params): Promise<StartedBatch> => {
  const state = getState();
  const row = launchRowsOf({ state, sessionId }).find(
    (candidate) => candidate.thread.threadId === threadId,
  );
  if (row !== undefined && row.item.approvalState === 'accepted') {
    await state.reopenResolveQueueItem({
      sessionId,
      itemId: row.item.id,
      revision: row.thread.revision,
    });
  }
  if (row !== undefined && row.item.approvalState === 'wont_fix') {
    await state.takeUpResolveQueueItem({ sessionId, itemId: row.item.id });
  }
  return startBatch({
    getState,
    sessionId,
    threadIds: [threadId],
    launchChoice: launchChoiceOf({
      routing: draftRoutingOf({ state: getState(), sessionId }),
      commitStyle: null,
      hint: steerHintOf({ mode, hint }),
    }),
  });
};
