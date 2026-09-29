import { useEffect, useState } from 'react';
import type {
  Agent,
  AgentId,
  IsoDateTime,
  ProviderRunId,
  ResolveAttempt,
  TurnEvent,
} from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { SESSION, SESSION_ID, seedActivityRunScene } from './activityRunSeed';
import { WorkspaceFrame } from './audit/WorkspaceFrame';

const RESOLVER_ID = 'mock-brief-resolver-agent' as AgentId;
const RESOLVER_RUN_ID = 'mock-brief-resolver-run' as ProviderRunId;
const THREAD_ID = 'PRRT_kwDOHarborline318';
const MINUTE = 60_000;

type AgoParams = {
  readonly minutes: number;
};

const isoAgo = ({ minutes }: AgoParams): IsoDateTime =>
  new Date(Date.now() - minutes * MINUTE).toISOString() as IsoDateTime;

const RESOLVER: Agent = {
  id: RESOLVER_ID,
  sessionId: SESSION_ID,
  ordinal: 40,
  name: 'Resolve review on payments-api#318',
  kind: 'resolver',
  status: 'running',
  runId: RESOLVER_RUN_ID,
  startedAt: isoAgo({ minutes: 3 }),
  providerOverride: 'anthropic',
  modelOverride: 'claude-opus-5-5',
};

const ATTEMPT: ResolveAttempt = {
  id: 'mock-brief-resolver-attempt',
  sessionId: SESSION_ID,
  agentId: RESOLVER_ID,
  prNumber: 318,
  threadIds: [THREAD_ID],
  provider: 'anthropic',
  model: 'claude-opus-5-5',
  effort: null,
  instructions: null,
  phase: 'running',
  mountTarget: null,
  startedAt: Date.now() - 3 * MINUTE,
  endedAt: null,
  error: null,
  createdAt: Date.now() - 3 * MINUTE,
};

const TRANSCRIPT: ReadonlyArray<TurnEvent> = [
  {
    kind: 'user_text',
    runId: RESOLVER_RUN_ID,
    text: 'Resolve the review comment on applyWebhook.ts: the retry counter is never reset.',
    at: isoAgo({ minutes: 3 }),
  },
  {
    kind: 'assistant_text',
    runId: RESOLVER_RUN_ID,
    delta:
      'The counter lives on the delivery row and is only read on the failure path. I am moving the reset next to the credit commit so a redelivery starts from zero.',
    at: isoAgo({ minutes: 1 }),
  },
];

export const AgentBriefResolverScene = () => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const { navigate } = useAppStore.getState();
    seedActivityRunScene();
    const state = useAppStore.getState();
    useAppStore.setState({
      navigate,
      selectedAgentId: {},
      activeLens: { [SESSION_ID]: null },
      sessionPhaseRuns: {
        ...state.sessionPhaseRuns,
        [SESSION_ID]: [...(state.sessionPhaseRuns[SESSION_ID] ?? []), RESOLVER],
      },
      sessionResolveAttempts: { [SESSION_ID]: [ATTEMPT] },
      agentTurnState: {
        ...state.agentTurnState,
        [RESOLVER_ID]: {
          kind: 'running',
          runId: RESOLVER_RUN_ID,
          startedAt: isoAgo({ minutes: 3 }),
        },
      },
      transcripts: { ...state.transcripts, [RESOLVER_ID]: TRANSCRIPT },
      agentRunHistory: { ...state.agentRunHistory, [RESOLVER_ID]: [RESOLVER_RUN_ID] },
    });
    setIsReady(true);
  }, []);

  if (!isReady) {
    return null;
  }

  return <WorkspaceFrame session={SESSION} />;
};
