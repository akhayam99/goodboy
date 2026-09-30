import { strongestModelForTier } from '@goodboy/core';
import type { AgentId, SessionId } from '@goodboy/types';
import type { AppStore } from '../../store/store';
import { startFixAttempt } from '../review/startFixAttempt';
import { draftRoutingOf } from './draftRouting';
import { reviewRowsOf } from './reviewRows';

type Params = {
  readonly getState: () => AppStore;
  readonly sessionId: SessionId;
  readonly threadId: string;
};

const NOTHING_TO_RECHECK = 'This comment is no longer on the pull request';

export const recheckModelOf = ({
  provider,
}: {
  readonly provider: Parameters<typeof strongestModelForTier>[0]['provider'];
}): string | null =>
  strongestModelForTier({ provider, tier: 'cheap', wantsThinker: false })?.id ?? null;

export const startRecheck = async ({
  getState,
  sessionId,
  threadId,
}: Params): Promise<ReadonlyArray<AgentId>> => {
  const state = getState();
  const row = reviewRowsOf({ state, sessionId }).find(
    (candidate) => candidate.thread.threadId === threadId,
  );
  if (row === undefined || row.commentThread === null) {
    throw new Error(NOTHING_TO_RECHECK);
  }
  const routing = draftRoutingOf({ state, sessionId });
  const model = recheckModelOf({ provider: routing.provider });
  const shas = row.thread.commitShas ?? [];
  return startFixAttempt({
    sessionId,
    threads: [row.commentThread],
    pr: state.sessionGithub[sessionId]?.pr ?? null,
    choice: {
      provider: routing.provider,
      ...(model !== null && { model }),
    },
    mode: 'recheck',
    priorContext: [
      {
        threadId,
        ...(shas.length > 0 && { commitShas: shas }),
        intent: 'recheck',
      },
    ],
    spawnAgent: state.spawnAgent,
    setAgentConfig: state.setAgentConfig,
  });
};
