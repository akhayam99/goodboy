// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import type {
  Agent,
  AgentId,
  IsoDateTime,
  MeasuredTurnSpan,
  OpenQuestion,
  OpenQuestionId,
  ProviderName,
  SessionId,
  StepId,
  Workflow,
  WorkflowId,
  WorkflowRunId,
  WorkspaceId,
} from '@goodboy/types';
import { anAgent, aWorkflowRun } from '@goodboy/types/testing';
import type {
  TimelineAgentEntry,
  TimelineRunEntry,
} from '../../../../timeline/buildTimelineGroups';
import { runIdentity } from '../../../../timeline/runIdentity';
import { WorkTimeContext, type WorkTimeSource } from '../../../../../workTreeModel/workTimeSource';
import { RunIdentityCard } from './RunIdentityCard';

afterEach(cleanup);

const RUN_ID = 'run-1' as WorkflowRunId;
const SESSION = 'session-webhooks' as SessionId;

const WORKFLOW: Workflow = {
  id: 'workflow-1' as WorkflowId,
  workspaceId: 'workspace-harborline' as WorkspaceId,
  name: 'Fix a bug',
  description: '',
  origin: 'library',
  steps: [1, 2, 3, 4, 5, 6, 7].map((ordinal) => ({
    id: `step-${ordinal}` as StepId,
    workflowId: 'workflow-1' as WorkflowId,
    role: 'implementer',
    ordinal,
    name: `Step ${ordinal}`,
    promptPrefix: '',
  })),
  createdAt: '2026-10-04T16:00:00Z' as IsoDateTime,
  updatedAt: '2026-10-04T16:00:00Z' as IsoDateTime,
};

const ANSWER: OpenQuestion = {
  id: 'question-1' as OpenQuestionId,
  sessionId: SESSION,
  text: 'Key on the event id?',
  suggestedAnswers: [],
  selectMode: 'one',
  isBlocking: false,
  userAnswer: 'Yes',
  status: 'answered',
  createdAt: '2026-10-04T16:10:00Z' as IsoDateTime,
};

type StepParams = {
  readonly status: Agent['status'];
  readonly hasAnswer?: boolean;
};

const stepOf = ({ status, hasAnswer = false }: StepParams): TimelineAgentEntry => ({
  kind: 'agent',
  id: 'agent:step',
  at: null,
  ordinal: 0,
  agent: anAgent({ status }),
  agentKind: 'implementer',
  isMissingArtifact: false,
  stepLabel: null,
  openQuestions: [],
  terminalQuestions: [],
  children: [],
  answers: hasAnswer
    ? [{ kind: 'answer', id: 'answer:1', at: ANSWER.createdAt, question: ANSWER }]
    : [],
  hasDuration: true,
  chain: null,
});

const entryOf = ({ children }: { readonly children: ReadonlyArray<TimelineAgentEntry> }) => {
  const entry: TimelineRunEntry = {
    kind: 'run',
    id: 'run:one',
    at: '2026-10-04T16:05:00Z',
    run: aWorkflowRun({ id: RUN_ID, title: 'Harden the webhook', executionMode: 'static' }),
    workflow: WORKFLOW,
    identity: runIdentity({ laneIndex: 0, seed: 0 }),
    children,
    producedPlan: null,
  };
  return entry;
};

type SpanParams = {
  readonly agentId: string;
  readonly provider: ProviderName;
  readonly model: string;
  readonly costUsd: number;
  readonly startedAtMs: number;
};

const spanOf = ({
  agentId,
  provider,
  model,
  costUsd,
  startedAtMs,
}: SpanParams): MeasuredTurnSpan => ({
  agentId: agentId as AgentId,
  parentAgentId: null,
  agentStatus: 'completed',
  workflowRunId: RUN_ID,
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

const sourceOf = ({
  spans,
}: {
  readonly spans: ReadonlyArray<MeasuredTurnSpan>;
}): WorkTimeSource => ({
  nowMs: 0,
  spans,
  history: null,
  liveStartMs: new Map(),
  childrenOf: new Map(),
});

const SPANS = [
  spanOf({
    agentId: 'a',
    provider: 'anthropic',
    model: 'claude-sonnet-5-5',
    costUsd: 0.31,
    startedAtMs: 1,
  }),
  spanOf({
    agentId: 'b',
    provider: 'anthropic',
    model: 'claude-sonnet-5-5',
    costUsd: 0.5,
    startedAtMs: 2,
  }),
  spanOf({
    agentId: 'c',
    provider: 'codex',
    model: 'gpt-6.1-sol',
    costUsd: 0.41,
    startedAtMs: 3,
  }),
];

type RenderParams = {
  readonly children?: ReadonlyArray<TimelineAgentEntry>;
  readonly spans?: ReadonlyArray<MeasuredTurnSpan>;
  readonly isModelsOnly?: boolean;
};

const renderCard = ({
  children = [stepOf({ status: 'completed' })],
  spans = SPANS,
  isModelsOnly = false,
}: RenderParams = {}) =>
  render(
    <WorkTimeContext.Provider value={sourceOf({ spans })}>
      <RunIdentityCard entry={entryOf({ children })} isModelsOnly={isModelsOnly} isOpen>
        <button type="button">run</button>
      </RunIdentityCard>
    </WorkTimeContext.Provider>,
  );

const shownCard = () => within(screen.getByTestId('fact-card'));

const factOf = ({ label }: { readonly label: string }): string | null =>
  shownCard().queryByText(label)?.nextElementSibling?.textContent ?? null;

describe('RunIdentityCard', () => {
  it('names the workflow by its title and says what kind it is', () => {
    renderCard();

    expect(shownCard().getByText('Harden the webhook')).toBeDefined();
    expect(shownCard().getByText('Preset run')).toBeDefined();
  });

  it('tallies the steps by state and the questions answered', () => {
    renderCard({
      children: [
        stepOf({ status: 'completed', hasAnswer: true }),
        stepOf({ status: 'completed' }),
        stepOf({ status: 'running' }),
        stepOf({ status: 'pending' }),
        stepOf({ status: 'pending' }),
      ],
    });

    expect(factOf({ label: 'Done' })).toBe('2');
    expect(factOf({ label: 'Running' })).toBe('1');
    expect(factOf({ label: 'Queued' })).toBe('2');
    expect(factOf({ label: 'Answered' })).toBe('1');
  });

  it('says how far the run is', () => {
    renderCard({ children: [stepOf({ status: 'completed' }), stepOf({ status: 'running' })] });

    expect(factOf({ label: 'Progress' })).toBe('Step 2 of 7');
  });

  it('lists each model with the steps it ran and what it cost', () => {
    renderCard();

    expect(factOf({ label: 'Sonnet 5.5' })).toBe('2 steps$0.81');
    expect(factOf({ label: 'GPT-6.1 Sol' })).toBe('1 step$0.41');
  });

  it('keeps only the header and the models on the card of the model cell', () => {
    renderCard({
      isModelsOnly: true,
      children: [stepOf({ status: 'completed' }), stepOf({ status: 'running' })],
    });

    expect(factOf({ label: 'Progress' })).toBeNull();
    expect(factOf({ label: 'Done' })).toBeNull();
    expect(factOf({ label: 'Sonnet 5.5' })).toBe('2 steps$0.81');
  });

  it('leaves the models rows out of a run that has not run anything yet', () => {
    renderCard({ spans: [] });

    expect(factOf({ label: 'Sonnet 5.5' })).toBeNull();
    expect(factOf({ label: 'GPT-6.1 Sol' })).toBeNull();
  });

  it('fits a long tally and many models in six rows and counts the rest', () => {
    renderCard({
      children: [
        stepOf({ status: 'completed', hasAnswer: true }),
        stepOf({ status: 'running' }),
        stepOf({ status: 'pending' }),
        stepOf({ status: 'failed' }),
        stepOf({ status: 'blocked' }),
        stepOf({ status: 'stopped' }),
      ],
    });

    expect(Array.from(screen.getByTestId('fact-card').querySelectorAll('dt'))).toHaveLength(5);
    expect(shownCard().getByText(/^and \d+ more$/)).toBeDefined();
  });
});
