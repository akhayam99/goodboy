import type { PullRequestHost, Session } from '@goodboy/types';
import type { BranchFacts } from '../branches/branchFactsOf';
import type { deriveSessionStage } from '../../../../store/slices/session-view/deriveSessionStage';
import type { BoardAgent, BoardAsk, BoardLead } from './boardTypes';

export type BranchStageParams = Parameters<typeof deriveSessionStage>[0];

type Params = {
  readonly session: Session;
  readonly branch: BranchFacts | null;
  readonly asks: ReadonlyArray<BoardAsk>;
  readonly agents: ReadonlyArray<BoardAgent>;
  readonly leads: ReadonlyArray<BoardLead>;
};

type HostParams = {
  readonly noun: '#' | '!';
};

const hostOf = ({ noun }: HostParams): PullRequestHost => (noun === '!' ? 'gitlab' : 'github');

export const branchFactsFor = ({
  session,
  branch,
  asks,
  agents,
  leads,
}: Params): BranchStageParams => {
  const request = branch?.request ?? null;
  const runs: ReadonlyArray<BoardAgent | BoardLead> = [...agents, ...leads];
  const scoped: Session = {
    ...session,
    state: { kind: 'idle', lastActivityAt: session.updatedAt },
  };
  const host = request === null ? 'github' : hostOf({ noun: request.noun });
  return {
    session: scoped,
    pr:
      request === null
        ? null
        : {
            number: request.number,
            state: request.state,
            isDraft: request.isDraft,
            checks: request.checks,
            reviewDecision: request.reviewDecision,
          },
    hasUnread: false,
    openQuestionCount: asks.length,
    hasBlockedAgent: runs.some((run) => run.isBlocked),
    hasAutoFailed: runs.some((run) => run.isFailed),
    hasRunningAgent: runs.some((run) => run.isRunning),
    isBranchless: branch === null,
    requestHost: host,
    requestLabel:
      request === null
        ? undefined
        : `${host === 'gitlab' ? 'MR' : 'PR'} ${request.noun}${request.number}`,
    hasRun: runs.length > 0,
  };
};
