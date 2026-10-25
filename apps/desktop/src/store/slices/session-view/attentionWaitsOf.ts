import type { Agent, Session } from '@goodboy/types';
import type { AppState } from '../../types';
import { autoWaitRootsOf, type AutoWaitState } from './autoWaitRootsOf';
import { runWaitEntriesOf, type RunWaitState } from './runWaitEntriesOf';

type AttentionWaitsState = Pick<AppState, 'sessionPhaseRuns'> &
  AutoWaitState &
  RunWaitState &
  Partial<Pick<AppState, 'sessionSlackDrafts'>>;

export type AttentionWaits = {
  readonly hasStoppedRun: boolean;
  readonly hasLimitPausedRun: boolean;
  readonly hasRunWaitingForGo: boolean;
  readonly hasAutoNeedsYou: boolean;
  readonly hasSlackReplyWaiting: boolean;
};

type Params = {
  readonly state: AttentionWaitsState;
  readonly session: Session;
};

const NO_AGENTS: ReadonlyArray<Agent> = [];

export const attentionWaitsOf = ({ state, session }: Params): AttentionWaits => {
  const sessionId = session.id;
  const agents = state.sessionPhaseRuns[sessionId] ?? NO_AGENTS;
  const runWaits = runWaitEntriesOf({ state, session, agents });
  return {
    hasStoppedRun: runWaits.some((entry) => entry.wait === 'stopped'),
    hasLimitPausedRun: runWaits.some((entry) => entry.wait === 'limit'),
    hasRunWaitingForGo: runWaits.some((entry) => entry.wait === 'go'),
    hasAutoNeedsYou: autoWaitRootsOf({ state, session, agents }).length > 0,
    hasSlackReplyWaiting: (state.sessionSlackDrafts?.[sessionId] ?? []).some(
      (draft) => draft.status === 'pending',
    ),
  };
};
