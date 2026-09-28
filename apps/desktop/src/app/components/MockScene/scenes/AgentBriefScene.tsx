import { useEffect, useState } from 'react';
import type {
  Agent,
  AgentId,
  IsoDateTime,
  Message,
  MessageId,
  OpenQuestion,
  OpenQuestionId,
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

const WAITING_AGENT: Agent = {
  ...AGENT,
  status: 'running',
  completedAt: undefined,
};

const QUESTION: OpenQuestion = {
  id: 'mock-agent-brief-question' as OpenQuestionId,
  sessionId: SESSION_ID,
  createdByAgentId: AGENT_ID,
  text: 'Should the brief footer show cached tokens, or only input and output?',
  suggestedAnswers: ['Show cached tokens', 'Input and output only'],
  recommendedAnswer: 'Show cached tokens',
  isBlocking: true,
  userAnswer: null,
  status: 'open',
  createdAt: NOW,
};

const TURNS = [
  [
    'Reuse the token footer from the transcript in the Brief view.',
    'The transcript already renders a usage footer with input, output and cached tokens.\n\nI moved it into a shared component so both views draw the same numbers, then replaced the metadata line in the Brief with it.',
  ],
  [
    'Keep the header readable too.',
    'The header now carries the agent name and a status line, with routing underneath.\n\nThe role badge and the model stay on their own row so the name never wraps into them.',
  ],
  [
    'Do the tests still cover the old metadata line?',
    'They did. I rewrote the Brief tests to assert the shared footer instead, and added one for an agent with no telemetry yet.\n\nThe session and chat folders pass locally.',
  ],
  [
    'Check both themes before you stop.',
    'Checked the Brief in dark and light against the transcript footer. The figures match, and the footer keeps its muted tone in both.\n\nDone. The Brief and the transcript now share one footer.',
  ],
] as const;

const TRANSCRIPT = TURNS.flatMap(([text, delta], index) => {
  const runId = `mock-agent-brief-turn-${index}` as ProviderRunId;
  return [
    { kind: 'user_text' as const, runId, text, at: NOW },
    { kind: 'assistant_text' as const, runId, delta, at: NOW },
  ];
});

type Props = {
  readonly hasQuestion?: boolean;
};

export const AgentBriefScene = ({ hasQuestion = false }: Props) => {
  const [isReady, setIsReady] = useState(false);
  const agent = hasQuestion ? WAITING_AGENT : AGENT;

  useEffect(() => {
    useAppStore.setState({
      sessions: [SESSION],
      currentSessionId: SESSION_ID,
      selectedAgentId: { [SESSION_ID]: AGENT_ID },
      sessionPhaseRuns: { [SESSION_ID]: [agent] },
      sessionTelemetry: { [SESSION_ID]: [TELEMETRY] },
      agentRunHistory: { [AGENT_ID]: [RUN_ID] },
      transcripts: { [AGENT_ID]: TRANSCRIPT },
      loadAgentTranscript: async () => undefined,
      sessionPlans: { [SESSION_ID]: [] },
      sessionOpenQuestions: { [SESSION_ID]: hasQuestion ? [QUESTION] : [] },
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
  }, [agent, hasQuestion]);

  if (!isReady) {
    return null;
  }

  return (
    <main className="flex h-screen flex-col bg-background text-foreground">
      <AgentDetailPane
        session={SESSION}
        agent={agent}
        isChatActive={false}
        onBack={() => undefined}
      />
    </main>
  );
};
