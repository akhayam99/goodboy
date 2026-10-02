import { strongestModelForTier } from '@goodboy/core';
import type { Agent, AgentId, SessionId } from '@goodboy/types';
import { agentThreadIds } from '../session/agentThreadIds';
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

export const recheckParentOf = ({
  agents,
  threadId,
}: {
  readonly agents: ReadonlyArray<Agent>;
  readonly threadId: string;
}): AgentId | null =>
  agents
    .filter(
      (agent) =>
        agent.deletedAt == null &&
        agent.sourceKind === 'review_comment' &&
        agentThreadIds(agent).includes(threadId),
    )
    .reduce<Agent | null>(
      (latest, agent) => (latest === null || agent.ordinal > latest.ordinal ? agent : latest),
      null,
    )?.id ?? null;

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
    parentAgentId: recheckParentOf({ agents: state.sessionPhaseRuns[sessionId] ?? [], threadId }),
    spawnAgent: state.spawnAgent,
    setAgentConfig: state.setAgentConfig,
  });
};
