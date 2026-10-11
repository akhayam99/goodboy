import type { Agent, AgentId } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { checksAnalyzeSeed } from './checksAnalyzeSeed';

const FIX_ID: AgentId = JSON.parse(JSON.stringify('mock-u24-analyze-fix-implementer'));

type Params = {
  readonly phase: 'proposal' | 'fixing';
  readonly shouldOpenDrawer?: boolean;
};

export const analyzeFixSeed = ({ phase, shouldOpenDrawer = false }: Params) => {
  const seed = checksAnalyzeSeed({ phase: 'proposal', shouldOpenDrawer });
  if (phase === 'proposal') {
    return seed;
  }
  const fix: Agent = {
    ...seed.agent,
    id: FIX_ID,
    name: 'Implementer',
    kind: 'implementer',
    status: 'running',
    ordinal: 2,
    parentAgentId: seed.agent.id,
    sourceKind: 'failed_check',
    sourceCommentUrl: seed.check.detailsUrl ?? seed.pullRequest.url,
    modelOverride: 'claude-sonnet-5-5',
    providerOverride: 'anthropic',
    effort: 'high',
  };
  const running = Object.values(useAppStore.getState().agentTurnState).find(
    (turn) => turn.kind === 'running',
  );
  useAppStore.setState((state) => ({
    sessionPhaseRuns: { [seed.sessionId]: [seed.agent, fix] },
    agentTurnState: {
      ...state.agentTurnState,
      [fix.id]:
        running === undefined || running.kind !== 'running'
          ? { kind: 'idle', lastActivityAt: seed.agent.startedAt ?? seed.events[0]!.at }
          : { kind: 'running', runId: running.runId, startedAt: running.startedAt },
    },
    transcripts: { ...state.transcripts, [fix.id]: [] },
    sessionOpenQuestions: { [seed.sessionId]: [] },
    sessionAnsweredQuestions: { [seed.sessionId]: [] },
    sessionArtifacts: { [seed.sessionId]: [] },
    sessionPlans: { [seed.sessionId]: [] },
  }));
  return { ...seed, fix };
};
