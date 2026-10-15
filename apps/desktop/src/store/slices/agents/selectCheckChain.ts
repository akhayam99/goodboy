import type { Agent, SessionId, TurnState } from '@goodboy/types';
import { checkAnalysisOf } from '../../../features/branch/checks/checkAnalysisOf';
import { commitOf } from '../../../features/branch/checks/commitOf';
import type { AppState } from '../../types';
import { selectCheckAnalysis } from './selectCheckAnalysis';

export type CheckChainState =
  | 'none'
  | 'analyzing'
  | 'proposal'
  | 'fixing'
  | 'fixed-local'
  | 'fixed-pushed'
  | 'fix-failed'
  | 'no-fix';

type Params = {
  readonly state: Pick<
    AppState,
    | 'sessionPhaseRuns'
    | 'transcripts'
    | 'agentTurnState'
    | 'dismissedCheckProposals'
    | 'checkFixCommits'
  >;
  readonly sessionId: SessionId;
  readonly url: string;
};

export type CheckChain = {
  readonly state: CheckChainState;
  readonly debugger: Agent | null;
  readonly fix: Agent | null;
  readonly proposal: string | null;
  readonly commit: string | null;
  readonly commitCount: number;
  readonly isDismissed: boolean;
};

const NO_EVENTS = [] as const;

const isLive = (agent: Agent, turn: TurnState | undefined): boolean =>
  turn?.kind === 'starting' ||
  turn?.kind === 'running' ||
  turn?.kind === 'blocked' ||
  ((turn === undefined || turn.kind === 'idle') &&
    (agent.status === 'running' || agent.status === 'pending'));

export const selectCheckChain = ({ state, sessionId, url }: Params): CheckChain => {
  const analyst = selectCheckAnalysis({ state, sessionId, url });
  if (analyst === null) {
    return {
      state: 'none',
      debugger: null,
      fix: null,
      proposal: null,
      commit: null,
      commitCount: 0,
      isDismissed: false,
    };
  }
  const analysis = checkAnalysisOf({
    agent: analyst,
    events: state.transcripts[analyst.id] ?? NO_EVENTS,
    turnState: state.agentTurnState[analyst.id],
  });
  const fix = (state.sessionPhaseRuns[sessionId] ?? []).reduce<Agent | null>(
    (latest, agent) =>
      agent.parentAgentId !== analyst.id ||
      agent.sourceKind !== 'failed_check' ||
      agent.sourceCommentUrl !== url ||
      agent.deletedAt !== undefined ||
      (latest !== null && latest.ordinal > agent.ordinal)
        ? latest
        : agent,
    null,
  );
  const isDismissed = (state.dismissedCheckProposals[sessionId] ?? []).includes(analyst.id);
  const base = { debugger: analyst, fix, proposal: analysis.proposal, isDismissed };
  if (fix !== null) {
    const events = state.transcripts[fix.id];
    const fact = state.checkFixCommits[fix.id];
    if (isLive(fix, state.agentTurnState[fix.id])) {
      return { ...base, state: 'fixing', commit: null, commitCount: 0 };
    }
    if (fix.status !== 'completed') {
      return { ...base, state: 'fix-failed', commit: null, commitCount: 0 };
    }
    if (fact === undefined) {
      return { ...base, state: 'fixing', commit: null, commitCount: 0 };
    }
    if (fact.kind === 'found') {
      return {
        ...base,
        state: fact.unpushed === 0 ? 'fixed-pushed' : 'fixed-local',
        commit: fact.sha,
        commitCount: fact.unpushed === 0 ? fact.count : fact.unpushed,
      };
    }
    const quiet = fact.kind === 'unreadable' && events !== undefined ? commitOf({ events }) : null;
    if (quiet !== null) {
      return { ...base, state: 'fixed-local', commit: quiet, commitCount: 1 };
    }
    return { ...base, state: 'fix-failed', commit: null, commitCount: 0 };
  }
  if (analysis.isRunning) {
    return { ...base, state: 'analyzing', commit: null, commitCount: 0 };
  }
  return {
    ...base,
    state: analysis.proposal === null || isDismissed ? 'no-fix' : 'proposal',
    commit: null,
    commitCount: 0,
  };
};
