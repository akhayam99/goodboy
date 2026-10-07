import { useEffect, useState } from 'react';
import { DrawerColumn } from '@goodboy/ui';
import type {
  Agent,
  AgentId,
  ArtifactId,
  IsoDateTime,
  PlanWithCount,
  ProviderRunId,
  Session,
  SessionArtifact,
  SessionId,
  TurnState,
  WorkspaceId,
} from '@goodboy/types';
import { AgentDetailPane } from '../../../../features/session/components/AgentDetailPane';
import { useAppStore } from '../../../../store';
import { selectDrawerSizing } from '../../../../store/slices/drawer/selectDrawerSizing';
import { DrawerHost } from '../../DrawerHost';

type PlannerTranscriptVariant = 'ready' | 'revising' | 'replaced' | 'drawer' | 'expanded';

const WORKSPACE_ID = 'mock-planner-workspace' as WorkspaceId;
const SESSION_ID = 'mock-planner-session' as SessionId;
const AGENT_ID = 'mock-planner-agent' as AgentId;
const PLAN_ID = 'mock-planner-plan-retries' as ArtifactId;
const FIRST_RUN = 'mock-planner-run-1' as ProviderRunId;
const SECOND_RUN = 'mock-planner-run-2' as ProviderRunId;

const NOW = '2026-10-05T10:12:00.000Z' as IsoDateTime;

const SESSION: Session = {
  id: SESSION_ID,
  workspaceId: WORKSPACE_ID,
  goal: 'Stop retried webhooks from posting a second credit',
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
  name: 'Planner',
  status: 'completed',
  kind: 'planner',
  runId: FIRST_RUN,
  outputSummary: 'Four parts: key column, dedupe check, backfill, replay test.',
  startedAt: '2026-10-05T10:02:00.000Z' as IsoDateTime,
  completedAt: NOW,
};

const GOAL =
  'Retried webhooks must never post a second credit. Check the processor event id inside the same transaction that writes the credit, so a retry that lands mid-write is refused.';

const PLAN_BODY_V1 = [
  `## Goal\n\n${GOAL}`,
  '## Approach',
  'Add one idempotency key per processor event, check it inside the credit transaction, and backfill the keys for events already settled.',
].join('\n\n');

const PLAN_BODY_V2 = PLAN_BODY_V1.replace(
  'backfill the keys for events already settled',
  'backfill the keys for events from the last 90 days',
);

const envelope = ({ body }: { readonly body: string }): string =>
  [
    '<<artifact v=1 kind=plan>>',
    JSON.stringify({ title: 'Retry-safe webhook credits', content: body }),
    '<</artifact>>',
  ].join('\n');

const FIRST_REPLY = `I read the webhook handler and the ledger writer. The plan is below.\n\n${envelope({ body: PLAN_BODY_V1 })}`;
const SECOND_REPLY = `Split the backfill and limited it to the last 90 days.\n\n${envelope({ body: PLAN_BODY_V2 })}`;
const WRITING_REPLY = 'Reading the backfill job in ledger-core before I split part 3.';

const ASK = 'Split part 3 in two and drop the backfill for events older than 90 days.';

const PLAN: PlanWithCount = {
  id: PLAN_ID,
  sessionId: SESSION_ID,
  agentId: AGENT_ID,
  title: 'Retry-safe webhook credits',
  bodyMd: PLAN_BODY_V1,
  status: 'active',
  clusters: [
    { title: 'Add the idempotency key column in payments-api', instructions: 'Add the column.' },
    {
      title: 'Key the dedupe check on the processor event id',
      instructions: 'Check in the credit transaction.',
    },
    { title: 'Backfill keys for settled events', instructions: 'Backfill ledger-core.' },
    { title: 'Cover duplicate delivery with a replay test', instructions: 'Replay a webhook.' },
  ],
  createdAt: NOW,
  updatedAt: NOW,
  consumptionCount: 0,
};

const STORED: SessionArtifact = {
  id: PLAN_ID,
  sessionId: SESSION_ID,
  agentId: AGENT_ID,
  workflowRunId: null,
  kind: 'plan',
  schemaVersion: 1,
  title: PLAN.title,
  sourceFormat: 'markdown',
  sourceText: PLAN_BODY_V1,
  metadata: { clusters: PLAN.clusters },
  status: 'active',
  revision: 1,
  sourceTurnId: FIRST_RUN,
  createdAt: NOW,
  updatedAt: NOW,
  openedAt: null,
} as SessionArtifact;

const eventsFor = ({ variant }: { readonly variant: PlannerTranscriptVariant }) => {
  const first = [
    {
      kind: 'user_text' as const,
      runId: FIRST_RUN,
      text: 'Plan the fix for retried webhooks posting a second credit.',
      at: NOW,
    },
    { kind: 'assistant_text' as const, runId: FIRST_RUN, delta: FIRST_REPLY, at: NOW },
  ];
  if (variant === 'ready' || variant === 'drawer' || variant === 'expanded') {
    return first;
  }
  const ask = { kind: 'user_text' as const, runId: SECOND_RUN, text: ASK, at: NOW };
  if (variant === 'revising') {
    return [
      ...first,
      ask,
      { kind: 'assistant_text' as const, runId: SECOND_RUN, delta: WRITING_REPLY, at: NOW },
    ];
  }
  return [
    ...first,
    ask,
    { kind: 'assistant_text' as const, runId: SECOND_RUN, delta: SECOND_REPLY, at: NOW },
  ];
};

const turnFor = ({ variant }: { readonly variant: PlannerTranscriptVariant }): TurnState =>
  variant === 'revising'
    ? { kind: 'running', runId: SECOND_RUN, startedAt: NOW }
    : { kind: 'idle', lastActivityAt: NOW };

const RUNNING_AGENT: Agent = { ...AGENT, status: 'running' };

type Props = {
  readonly variant?: PlannerTranscriptVariant;
};

export const PlannerTranscriptScene = ({ variant = 'ready' }: Props) => {
  const [isReady, setIsReady] = useState(false);
  const sizing = useAppStore(selectDrawerSizing);
  const isDrawerOpen = useAppStore((s) => s.drawer !== null);
  const agent = variant === 'revising' ? RUNNING_AGENT : AGENT;
  const isReplaced = variant === 'replaced';

  useEffect(() => {
    useAppStore.setState({
      sessions: [SESSION],
      currentSessionId: SESSION_ID,
      selectedAgentId: { [SESSION_ID]: AGENT_ID },
      agentPane: { [SESSION_ID]: 'transcript' },
      sessionPhaseRuns: { [SESSION_ID]: [agent] },
      agentTurnState: { [AGENT_ID]: turnFor({ variant }) },
      agentRunHistory: { [AGENT_ID]: isReplaced ? [FIRST_RUN, SECOND_RUN] : [FIRST_RUN] },
      transcripts: { [AGENT_ID]: eventsFor({ variant }) },
      loadAgentTranscript: async () => undefined,
      sessionPlans: {
        [SESSION_ID]: [isReplaced ? { ...PLAN, bodyMd: PLAN_BODY_V2 } : PLAN],
      },
      sessionArtifacts: {
        [SESSION_ID]: [
          isReplaced
            ? { ...STORED, sourceText: PLAN_BODY_V2, revision: 2, sourceTurnId: SECOND_RUN }
            : STORED,
        ],
      },
      sessionOpenQuestions: { [SESSION_ID]: [] },
      sessionAnsweredQuestions: { [SESSION_ID]: [] },
      documentDrawerExpanded: { [SESSION_ID]: variant === 'expanded' },
      drawer:
        variant === 'drawer' || variant === 'expanded'
          ? {
              kind: 'artifact-document',
              sessionId: SESSION_ID,
              payload: { artifactId: PLAN_ID, revision: null },
            }
          : null,
    });
    setIsReady(true);
  }, [agent, variant, isReplaced]);

  if (!isReady) {
    return null;
  }

  return (
    <main className="flex h-screen bg-background text-foreground">
      <DrawerColumn
        main={
          <AgentDetailPane session={SESSION} agent={agent} isChatActive onBack={() => undefined} />
        }
        drawer={isDrawerOpen ? <DrawerHost /> : null}
        sizing={sizing}
        ariaLabel="Side panel"
        resizeLabel="Resize side panel"
      />
    </main>
  );
};
