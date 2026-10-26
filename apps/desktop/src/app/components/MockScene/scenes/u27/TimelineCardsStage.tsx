import type {
  Agent,
  AgentId,
  IsoDateTime,
  MeasuredTurnSpan,
  SessionId,
  StepId,
  Workflow,
  WorkflowId,
  WorkflowRun,
  WorkflowRunId,
  WorkspaceId,
} from '@goodboy/types';
import { AgentKindChip } from '../../../../../shared/components/AgentKindChip';
import { RowIdentityCard } from '../../../../../features/session/components/SessionWorkspace/parts/TimelinePane/RowIdentityCard';
import { RowModelsCard } from '../../../../../features/session/components/SessionWorkspace/parts/TimelinePane/RowModelsCard';
import { RunIdentityCard } from '../../../../../features/session/components/SessionWorkspace/parts/TimelinePane/RunIdentityCard';
import { TimelineModelCell } from '../../../../../features/session/components/SessionWorkspace/parts/TimelinePane/TimelineModelCell';
import { TimelineRunGlyph } from '../../../../../features/session/components/SessionWorkspace/parts/TimelinePane/TimelineRunGlyph';
import type {
  TimelineAgentEntry,
  TimelineRunEntry,
} from '../../../../../features/session/timeline/buildTimelineGroups';
import type { AgentModels } from '../../../../../features/session/timeline/ranModels';
import { runIdentity } from '../../../../../features/session/timeline/runIdentity';
import {
  WorkTimeContext,
  type WorkTimeSource,
} from '../../../../../features/workTreeModel/workTimeSource';

type IdParams = {
  readonly value: string;
};

const idOf = <Id extends string>({ value }: IdParams): Id => JSON.parse(JSON.stringify(value));

const SESSION = idOf<SessionId>({ value: 'mock-timeline-cards-session' });
const RUN = idOf<WorkflowRunId>({ value: 'mock-timeline-cards-run' });
const WORKFLOW_ID = idOf<WorkflowId>({ value: 'mock-timeline-cards-workflow' });
const STARTED = idOf<IsoDateTime>({ value: '2026-10-04T16:41:00Z' });
const FINISHED = idOf<IsoDateTime>({ value: '2026-10-04T16:57:00Z' });
const KIMI_ENDED = Date.parse('2026-10-04T16:47:00Z');
const SONNET_ENDED = Date.parse('2026-10-04T16:57:00Z');

const AGENT: Agent = {
  id: idOf<AgentId>({ value: 'mock-timeline-cards-agent' }),
  sessionId: SESSION,
  ordinal: 4,
  name: 'Dedupe check in the webhook handler',
  status: 'completed',
  stepId: idOf<StepId>({ value: 'mock-timeline-cards-step-4' }),
  workflowRunId: RUN,
  startedAt: STARTED,
  completedAt: FINISHED,
};

const AGENT_ENTRY: TimelineAgentEntry = {
  kind: 'agent',
  id: 'agent:mock-timeline-cards',
  at: STARTED,
  ordinal: 4,
  agent: AGENT,
  agentKind: 'implementer',
  isMissingArtifact: false,
  stepLabel: '4',
  openQuestions: [],
  terminalQuestions: [],
  children: [],
  answers: [],
  hasDuration: true,
  chain: null,
};

const MODELS: AgentModels = {
  isPlanned: false,
  models: [
    {
      key: 'moonshot:Kimi K3',
      provider: 'moonshot',
      name: 'Kimi K3',
      effort: 'High',
      endReason: 'failed',
      endedAtMs: KIMI_ENDED,
    },
    {
      key: 'anthropic:Sonnet 5.5',
      provider: 'anthropic',
      name: 'Sonnet 5.5',
      effort: 'High',
      endReason: 'succeeded',
      endedAtMs: SONNET_ENDED,
    },
  ],
};

const WORKFLOW: Workflow = {
  id: WORKFLOW_ID,
  workspaceId: idOf<WorkspaceId>({ value: 'mock-timeline-cards-workspace' }),
  name: 'Fix a bug',
  description: '',
  origin: 'library',
  steps: [1, 2, 3, 4, 5, 6].map((ordinal) => ({
    id: idOf<StepId>({ value: `mock-timeline-cards-step-${ordinal}` }),
    workflowId: WORKFLOW_ID,
    role: 'implementer',
    ordinal,
    name: `Step ${ordinal}`,
    promptPrefix: '',
  })),
  createdAt: STARTED,
  updatedAt: STARTED,
};

const RUN_ROW: WorkflowRun = {
  id: RUN,
  workflowId: WORKFLOW_ID,
  ordinal: 0,
  currentStep: 4,
  autoRun: false,
  triggerMode: 'immediate',
  executionMode: 'static',
  title: 'Harden the webhook',
};

type StepParams = {
  readonly status: Agent['status'];
  readonly index: number;
};

const stepOf = ({ status, index }: StepParams) =>
  ({
    ...AGENT_ENTRY,
    id: `agent:mock-timeline-cards-${index}`,
    agent: { ...AGENT, id: idOf<AgentId>({ value: `mock-timeline-cards-agent-${index}` }), status },
  }) satisfies TimelineAgentEntry;

const RUN_ENTRY: TimelineRunEntry = {
  kind: 'run',
  id: 'run:mock-timeline-cards',
  at: STARTED,
  run: RUN_ROW,
  workflow: WORKFLOW,
  identity: runIdentity({ laneIndex: 0, seed: 0 }),
  children: [
    stepOf({ status: 'completed', index: 1 }),
    stepOf({ status: 'completed', index: 2 }),
    stepOf({ status: 'completed', index: 3 }),
    stepOf({ status: 'running', index: 4 }),
    stepOf({ status: 'pending', index: 5 }),
  ],
  producedPlan: null,
};

type SpanParams = {
  readonly provider: MeasuredTurnSpan['provider'];
  readonly model: string;
  readonly costUsd: number;
  readonly startedAtMs: number;
};

const spanOf = ({ provider, model, costUsd, startedAtMs }: SpanParams): MeasuredTurnSpan => ({
  agentId: AGENT.id,
  parentAgentId: null,
  agentStatus: 'completed',
  workflowRunId: RUN,
  isOrchestratedRunDone: false,
  stepRole: 'implementer',
  provider,
  model,
  effort: 'high',
  startedAtMs,
  endedAtMs: startedAtMs + 1_000,
  endReason: 'succeeded',
  costUsd,
  touchedMountIds: null,
});

const SOURCE: WorkTimeSource = {
  nowMs: 0,
  spans: [
    spanOf({ provider: 'anthropic', model: 'claude-sonnet-5-5', costUsd: 0.81, startedAtMs: 1 }),
    spanOf({ provider: 'codex', model: 'gpt-6.1-sol', costUsd: 0.41, startedAtMs: 3 }),
  ],
  history: null,
  liveStartMs: new Map(),
  childrenOf: new Map(),
};

const TRIGGER_CLASSES =
  'inline-flex h-7 items-center justify-center gap-2 rounded-md border border-border-soft px-2 text-meta text-muted-foreground';

export const TimelineCardsStage = () => (
  <WorkTimeContext.Provider value={SOURCE}>
    <div
      data-testid="timeline-cards-stage"
      className="grid w-264 grid-cols-3 items-start gap-6 rounded-lg border border-border-soft bg-subtle p-6 pb-72"
    >
      <RowIdentityCard
        entry={AGENT_ENTRY}
        ordinal="4"
        kindWord="Implementer"
        models={MODELS}
        work={{
          routing: {
            provider: 'anthropic',
            model: 'claude-sonnet-5-5',
            effort: 'high',
            isEffortObserved: true,
            planned: { provider: 'anthropic', model: 'claude-haiku-4-5', effort: 'low' },
            isPlanned: false,
          },
          time: {
            label: '15m 59s',
            detail: '',
            facts: [],
            footnote: null,
            progress: null,
            headline: '15m 59s',
            note: null,
            isMuchLonger: false,
          },
        }}
        phase="done"
        costUsd={0.62}
        isOpen
      >
        <span className={TRIGGER_CLASSES}>
          <AgentKindChip kind="implementer" density="glyph" isDecorative />
          Role glyph
        </span>
      </RowIdentityCard>
      <RowModelsCard entry={AGENT_ENTRY} ordinal="4" kindWord="Implementer" models={MODELS} isOpen>
        <span className={TRIGGER_CLASSES}>
          <TimelineModelCell
            summary={{ name: 'Sonnet 5.5', detail: 'High', providers: ['anthropic'] }}
          />
        </span>
      </RowModelsCard>
      <RunIdentityCard entry={RUN_ENTRY} isOpen>
        <span className={TRIGGER_CLASSES}>
          <TimelineRunGlyph kind="preset" />
          Run glyph
        </span>
      </RunIdentityCard>
    </div>
  </WorkTimeContext.Provider>
);
