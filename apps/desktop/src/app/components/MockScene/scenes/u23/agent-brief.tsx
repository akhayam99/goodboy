import { useEffect, useState, type ComponentType } from 'react';
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

const WORKSPACE_ID = 'mock-agent-doors-workspace' as WorkspaceId;
const SESSION_ID = 'mock-agent-doors-session' as SessionId;
const LEAD_ID = 'mock-agent-doors-lead' as AgentId;
const BLOCKED_ID = 'mock-agent-doors-blocked' as AgentId;
const DONE_ID = 'mock-agent-doors-done' as AgentId;
const LEAD_RUN = 'mock-agent-doors-lead-run' as ProviderRunId;

const SESSION: Session = {
  id: SESSION_ID,
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

const LEAD: Agent = {
  id: LEAD_ID,
  sessionId: SESSION_ID,
  ordinal: 0,
  name: 'Cap the webhook retries',
  status: 'running',
  kind: 'implementer',
  runId: LEAD_RUN,
  startedAt: clock.iso({ at: '2026-09-14T16:26:00.000Z' }),
};

const BLOCKED: Agent = {
  id: BLOCKED_ID,
  sessionId: SESSION_ID,
  ordinal: 1,
  name: 'Expose the cap from the config',
  status: 'blocked',
  kind: 'implementer',
  parentAgentId: LEAD_ID,
  startedAt: clock.iso({ at: '2026-09-14T16:27:00.000Z' }),
};

const DONE: Agent = {
  id: DONE_ID,
  sessionId: SESSION_ID,
  ordinal: 2,
  name: 'Read the cap in the retry loop',
  status: 'completed',
  kind: 'implementer',
  parentAgentId: LEAD_ID,
  startedAt: clock.iso({ at: '2026-09-14T16:28:00.000Z' }),
  completedAt: clock.iso({ at: '2026-09-14T16:36:00.000Z' }),
};

const TURN: TelemetryRecord = {
  id: 'mock-agent-doors-telemetry' as TelemetryRecordId,
  runId: LEAD_RUN,
  sessionId: SESSION_ID,
  kind: 'turn',
  provider: 'anthropic',
  model: 'claude-opus-5',
  inputTokens: 2630000,
  outputTokens: 20800,
  contextTokens: 52000,
  estimatedCostUsd: 1.78,
  recordedAt: NOW,
};

type Pane = 'brief' | 'transcript';

const seed = ({ pane }: { readonly pane: Pane | null }): void => {
  const turnState: TurnState = { kind: 'idle', lastActivityAt: NOW };
  useAppStore.setState({
    sessions: [SESSION],
    currentSessionId: SESSION_ID,
    selectedAgentId: { [SESSION_ID]: LEAD_ID },
    agentPane: { [SESSION_ID]: pane },
    agentTab: {},
    sessionPhaseRuns: { [SESSION_ID]: [LEAD, BLOCKED, DONE] },
    sessionTelemetry: { [SESSION_ID]: [TURN] },
    agentRunHistory: { [LEAD_ID]: [LEAD_RUN] },
    agentTurnState: { [LEAD_ID]: turnState },
    transcripts: { [LEAD_ID]: [] },
    messages: { [SESSION_ID]: [] },
    loadAgentTranscript: async () => undefined,
    sessionPlans: { [SESSION_ID]: [] },
    sessionOpenQuestions: { [SESSION_ID]: [] },
    sessionAnsweredQuestions: { [SESSION_ID]: [] },
  });
};

type SceneProps = {
  readonly pane: Pane | null;
};

const AgentDoorScene = ({ pane }: SceneProps) => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    seed({ pane });
    setIsReady(true);
  }, [pane]);

  if (!isReady) {
    return null;
  }

  return (
    <main className="flex h-screen flex-col bg-background text-foreground">
      <AgentDetailPane session={SESSION} agent={LEAD} isChatActive onBack={() => undefined} />
    </main>
  );
};

export const U23_AGENT_BRIEF_SCENES = {
  'agent-brief-door': () => <AgentDoorScene pane={null} />,
  'agent-brief-door-transcript': () => <AgentDoorScene pane="transcript" />,
} satisfies Readonly<Record<string, ComponentType>>;
