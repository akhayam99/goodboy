import { useEffect, useState } from 'react';
import type {
  Agent,
  AgentId,
  ProviderRunId,
  Session,
  SessionId,
  TelemetryRecord,
  TelemetryRecordId,
  TurnState,
  WorkspaceId,
} from '@goodboy/types';
import { AgentDetailPane } from '../../../../../features/session/components/AgentDetailPane';
import { useAppStore } from '../../../../../store';
import { sceneClock } from '../../sceneClock';

const clock = sceneClock({ anchor: '2026-09-14T16:40:00.000Z' });

const NOW = clock.iso({ at: '2026-09-14T16:40:00.000Z' });

const WORKSPACE_ID = 'mock-lists-workspace' as WorkspaceId;
const AGENT_SESSION_ID = 'mock-lists-agent-session' as SessionId;
const AGENT_ID = 'mock-lists-agent' as AgentId;
const RUN_ID = 'mock-lists-agent-run' as ProviderRunId;

const AGENT_SESSION: Session = {
  id: AGENT_SESSION_ID,
  workspaceId: WORKSPACE_ID,
  goal: 'Make the webhook retry cap configurable',
  state: { kind: 'idle', lastActivityAt: NOW },
  contextSlots: [],
  providerPreference: { defaultProvider: 'anthropic', allowTurnOverride: true },
  permissionMode: 'default',
  workflowRuns: [],
  autoRun: false,
  titleUserEdited: true,
  createdAt: NOW,
  updatedAt: NOW,
};

const agentOf = ({ status }: { readonly status: Agent['status'] }): Agent => ({
  id: AGENT_ID,
  sessionId: AGENT_SESSION_ID,
  ordinal: 0,
  name: 'Cap the webhook retries',
  status,
  kind: 'implementer',
  runId: RUN_ID,
  startedAt: clock.iso({ at: '2026-09-14T16:20:00.000Z' }),
  ...(status === 'completed'
    ? { completedAt: NOW, outputSummary: 'Capped the retry loop at five attempts with jitter.' }
    : {}),
});

const TURN: TelemetryRecord = {
  id: 'mock-lists-agent-telemetry' as TelemetryRecordId,
  runId: RUN_ID,
  sessionId: AGENT_SESSION_ID,
  kind: 'turn',
  provider: 'anthropic',
  model: 'claude-opus-5',
  inputTokens: 91200,
  outputTokens: 1210,
  contextTokens: 52000,
  estimatedCostUsd: 0.21,
  recordedAt: NOW,
};

const TRANSCRIPT = [
  { kind: 'user_text' as const, runId: RUN_ID, text: 'Cap the webhook retries.', at: NOW },
  {
    kind: 'assistant_text' as const,
    runId: RUN_ID,
    delta: 'The retry loop now stops after five attempts and waits with jitter between them.',
    at: NOW,
  },
];

type AgentSeedParams = {
  readonly isRunning: boolean;
};

const seedAgentPage = ({ isRunning }: AgentSeedParams): void => {
  const turnState: TurnState = isRunning
    ? { kind: 'running', runId: RUN_ID, startedAt: NOW }
    : { kind: 'idle', lastActivityAt: NOW };
  useAppStore.setState({
    sessions: [AGENT_SESSION],
    currentSessionId: AGENT_SESSION_ID,
    selectedAgentId: { [AGENT_SESSION_ID]: AGENT_ID },
    agentPane: { [AGENT_SESSION_ID]: 'transcript' },
    sessionPhaseRuns: {
      [AGENT_SESSION_ID]: [agentOf({ status: isRunning ? 'running' : 'completed' })],
    },
    sessionTelemetry: { [AGENT_SESSION_ID]: isRunning ? [] : [TURN] },
    agentRunHistory: { [AGENT_ID]: isRunning ? [] : [RUN_ID] },
    agentModelOverride: isRunning ? { [AGENT_ID]: 'claude-sonnet-5' } : {},
    agentProviderOverride: isRunning ? { [AGENT_ID]: 'anthropic' } : {},
    agentTurnState: { [AGENT_ID]: turnState },
    transcripts: { [AGENT_ID]: TRANSCRIPT },
    loadAgentTranscript: async () => undefined,
    sessionPlans: { [AGENT_SESSION_ID]: [] },
    sessionOpenQuestions: { [AGENT_SESSION_ID]: [] },
    sessionAnsweredQuestions: { [AGENT_SESSION_ID]: [] },
  });
};

type AgentPageSceneProps = {
  readonly isRunning: boolean;
};

export const AgentPageScene = ({ isRunning }: AgentPageSceneProps) => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    seedAgentPage({ isRunning });
    setIsReady(true);
  }, [isRunning]);

  if (!isReady) {
    return null;
  }

  return (
    <main className="flex h-screen flex-col bg-background text-foreground">
      <AgentDetailPane
        session={AGENT_SESSION}
        agent={agentOf({ status: isRunning ? 'running' : 'completed' })}
        isChatActive
        onBack={() => undefined}
      />
    </main>
  );
};
