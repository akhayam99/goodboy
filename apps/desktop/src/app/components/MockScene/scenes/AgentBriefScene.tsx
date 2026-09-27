import { useEffect, useState } from 'react';
import type {
  Agent,
  AgentId,
  IsoDateTime,
  Message,
  MessageId,
  ProviderRunId,
  Session,
  SessionId,
  TelemetryRecord,
  TelemetryRecordId,
  WorkspaceId,
} from '@goodboy/types';
import { AgentDetailPane } from '../../../../features/session/components/AgentDetailPane';
import { useAppStore } from '../../../../store';

const WORKSPACE_ID = 'mock-agent-brief-workspace' as WorkspaceId;
const SESSION_ID = 'mock-agent-brief-session' as SessionId;
const AGENT_ID = 'mock-agent-brief-agent' as AgentId;
const RUN_ID = 'mock-agent-brief-run' as ProviderRunId;

const NOW = '2026-09-27T10:12:00.000Z' as IsoDateTime;

const SESSION: Session = {
  id: SESSION_ID,
  workspaceId: WORKSPACE_ID,
  goal: 'Reuse the new token footer in the brief view',
  state: { kind: 'ended', endedAt: NOW },
  contextSlots: [],
  providerPreference: { defaultProvider: 'anthropic', allowTurnOverride: true },
  permissionMode: 'default',
  workflowRuns: [],
  autoRun: false,
  titleUserEdited: true,
  createdAt: NOW,
  updatedAt: NOW,
};

const AGENT: Agent = {
  id: AGENT_ID,
  sessionId: SESSION_ID,
  ordinal: 0,
  name: 'Reuse the token footer in the brief',
  status: 'completed',
  kind: 'implementer',
  runId: RUN_ID,
  outputSummary:
    'Replaced the metadata line in the Brief with the same usage footer the transcript uses, and gave the header a name and status line with routing underneath.',
  startedAt: '2026-09-27T09:58:00.000Z' as IsoDateTime,
  completedAt: NOW,
};

const TELEMETRY: TelemetryRecord = {
  id: 'mock-agent-brief-telemetry' as TelemetryRecordId,
  runId: RUN_ID,
  sessionId: SESSION_ID,
  kind: 'turn',
  provider: 'anthropic',
  model: 'claude-opus-5',
  inputTokens: 182412,
  outputTokens: 1388,
  cachedInputTokens: 171300,
  cacheCreationInputTokens: 8204,
  contextTokens: 76000,
  estimatedCostUsd: 0.34,
  recordedAt: NOW,
};

export const AgentBriefScene = () => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    useAppStore.setState({
      sessions: [SESSION],
      currentSessionId: SESSION_ID,
      sessionPhaseRuns: { [SESSION_ID]: [AGENT] },
      sessionTelemetry: { [SESSION_ID]: [TELEMETRY] },
      agentRunHistory: { [AGENT_ID]: [RUN_ID] },
      sessionPlans: { [SESSION_ID]: [] },
      sessionOpenQuestions: { [SESSION_ID]: [] },
      sessionAnsweredQuestions: { [SESSION_ID]: [] },
      messages: {
        [SESSION_ID]: [1, 2, 3].map((turn): Message => ({
          id: `mock-agent-brief-message-${turn}` as MessageId,
          sessionId: SESSION_ID,
          agentId: AGENT_ID,
          role: 'user',
          content: `Turn ${turn}`,
          createdAt: NOW,
        })),
      },
    });
    setIsReady(true);
  }, []);

  if (!isReady) {
    return null;
  }

  return (
    <main className="flex h-screen flex-col bg-background text-foreground">
      <AgentDetailPane
        session={SESSION}
        agent={AGENT}
        isChatActive={false}
        onBack={() => undefined}
      />
    </main>
  );
};
