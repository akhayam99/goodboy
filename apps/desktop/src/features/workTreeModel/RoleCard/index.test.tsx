// @vitest-environment happy-dom
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import type {
  Agent,
  AgentId,
  IsoDateTime,
  OpenQuestion,
  OpenQuestionId,
  ProviderRunId,
  SessionId,
  StepId,
  TelemetryRecord,
  TelemetryRecordId,
  WorkflowRunId,
} from '@goodboy/types';
import { anAgent } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../store/storyHarness';
import { formatClock } from '../../../shared/utils/time/formatClock';
import type { AgentRowWork } from '../../session/hooks/useAgentRowWork';
import type { TimelineAgentEntry } from '../../session/timeline/buildTimelineGroups';
import type { AgentModels, RanModel } from '../../session/timeline/ranModels';
import type { RowPhase } from '../rowState';
import { AgentRoleCard } from '../../session/components/SessionWorkspace/parts/TimelinePane/AgentRoleCard';

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../store/storyHarness')).tauriEventModuleMock(),
);

type IdParams = {
  readonly value: string;
};

const idOf = <Id extends string>({ value }: IdParams): Id => JSON.parse(JSON.stringify(value));

const SESSION = idOf<SessionId>({ value: 'session-webhooks' });
const RUN = idOf<WorkflowRunId>({ value: 'run-webhooks' });
const STARTED = idOf<IsoDateTime>({ value: '2026-10-04T16:41:00Z' });
const FINISHED = idOf<IsoDateTime>({ value: '2026-10-04T16:57:00Z' });
const TASK =
  'Post one credit per retry in postCredit and applyCredit, keyed on the event id so a replayed webhook is a no-op';
const FIVE = ['low', 'medium', 'high', 'xhigh', 'max'] as const;

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

type AgentParams = Partial<Agent> & { readonly id: AgentId };

const agentOf = (overrides: AgentParams): Agent =>
  anAgent({ sessionId: SESSION, name: TASK, ...overrides });

const STEP_AGENTS: ReadonlyArray<Agent> = [1, 2, 3, 4, 5, 6].map((ordinal) =>
  agentOf({
    id: idOf<AgentId>({ value: `agent-${ordinal}` }),
    ordinal,
    stepId: idOf<StepId>({ value: `step-${ordinal}` }),
    workflowRunId: RUN,
  }),
);

type EntryParams = {
  readonly agent: Agent;
  readonly stepLabel?: string | null;
  readonly openQuestions?: ReadonlyArray<OpenQuestion>;
};

const entryOf = ({
  agent,
  stepLabel = '4',
  openQuestions = [],
}: EntryParams): TimelineAgentEntry => ({
  kind: 'agent',
  id: `agent:${agent.id}`,
  at: agent.startedAt ?? null,
  ordinal: 4,
  agent,
  agentKind: 'implementer',
  isMissingArtifact: false,
  stepLabel,
  openQuestions,
  terminalQuestions: [],
  children: [],
  answers: [],
  hasDuration: true,
  chain: null,
});

const STEP_FOUR = agentOf({
  id: idOf<AgentId>({ value: 'agent-4' }),
  ordinal: 4,
  stepId: idOf<StepId>({ value: 'step-4' }),
  workflowRunId: RUN,
  status: 'completed',
  runId: idOf<ProviderRunId>({ value: 'provider-run-4' }),
  startedAt: STARTED,
  completedAt: FINISHED,
});

const SONNET: RanModel = {
  key: 'anthropic:Sonnet 5.5',
  provider: 'anthropic',
  name: 'Sonnet 5.5',
  effort: 'High',
  effortLevel: 'high',
  effortLevels: FIVE,
  endReason: 'succeeded',
  endedAtMs: Date.parse(FINISHED ?? ''),
};

const SOL: RanModel = {
  key: 'codex:GPT-6.1 Sol',
  provider: 'codex',
  name: 'GPT-6.1 Sol',
  effort: 'Very high',
  effortLevel: 'xhigh',
  effortLevels: FIVE,
  endReason: 'succeeded',
  endedAtMs: Date.parse(FINISHED ?? ''),
};

const OPUS: RanModel = {
  ...SONNET,
  key: 'anthropic:Opus 5.5',
  name: 'Opus 5.5',
  effort: 'Max',
  effortLevel: 'max',
};

const RETIRED: RanModel = {
  key: ':harborline-9000',
  provider: null,
  name: 'Unknown model',
  effort: null,
  effortLevel: null,
  effortLevels: [],
  endReason: 'failed',
  endedAtMs: null,
};

const ONE_MODEL: AgentModels = { models: [SONNET], isPlanned: false };

type WorkParams = {
  readonly planned?: {
    readonly provider: string;
    readonly model: string;
    readonly effort: 'low' | 'high';
  };
  readonly timeLabel?: string | null;
  readonly isEffortObserved?: boolean;
};

const workOf = ({
  planned = { provider: 'anthropic', model: 'claude-sonnet-5-5', effort: 'high' },
  timeLabel = '15m 59s',
  isEffortObserved = true,
}: WorkParams = {}): AgentRowWork => ({
  routing: {
    provider: 'anthropic',
    model: 'claude-sonnet-5-5',
    effort: 'high',
    isEffortObserved,
    planned,
    isPlanned: false,
  },
  time:
    timeLabel === null
      ? null
      : {
          label: timeLabel,
          detail: '',
          facts: [],
          footnote: null,
          progress: null,
          headline: timeLabel,
          note: null,
          isMuchLonger: false,
        },
});

type TelemetryParams = {
  readonly runId: string;
  readonly kind?: TelemetryRecord['kind'];
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly cachedInputTokens?: number;
};

const telemetryOf = ({
  runId,
  kind = 'turn',
  inputTokens,
  outputTokens,
  cachedInputTokens,
}: TelemetryParams): TelemetryRecord => ({
  id: idOf<TelemetryRecordId>({ value: `telemetry-${runId}-${kind}` }),
  runId: idOf<ProviderRunId>({ value: runId }),
  sessionId: SESSION,
  kind,
  provider: 'anthropic',
  model: 'claude-sonnet-5-5',
  inputTokens,
  outputTokens,
  ...(cachedInputTokens === undefined ? {} : { cachedInputTokens }),
  estimatedCostUsd: 0.1,
  recordedAt: idOf<IsoDateTime>({ value: '2026-10-04T16:57:00Z' }),
});

type QuestionParams = {
  readonly createdAt: string;
};

const questionOf = ({ createdAt }: QuestionParams): OpenQuestion => ({
  id: idOf<OpenQuestionId>({ value: `question-${createdAt}` }),
  sessionId: SESSION,
  text: 'Keep the key in ledger-core or in notify-relay?',
  suggestedAnswers: [],
  isBlocking: true,
  userAnswer: null,
  status: 'open',
  createdAt: idOf<IsoDateTime>({ value: createdAt }),
});

type CardProps = Omit<Parameters<typeof AgentRoleCard>[0], 'children' | 'isOpen'>;

const renderCard = (props: Partial<CardProps> = {}) =>
  render(
    <AgentRoleCard
      entry={entryOf({ agent: STEP_FOUR })}
      ordinal="4"
      kindWord="Implementer"
      models={ONE_MODEL}
      work={workOf()}
      phase="done"
      costUsd={0.62}
      isOpen
      {...props}
    >
      <button type="button">glyph</button>
    </AgentRoleCard>,
  );

beforeEach(async () => {
  await resetStoryStore();
  useAppStore.setState({
    sessionPhaseRuns: { [SESSION]: STEP_AGENTS },
    sessionTelemetry: {
      [SESSION]: [
        telemetryOf({
          runId: 'provider-run-4',
          inputTokens: 182_000,
          outputTokens: 24_000,
          cachedInputTokens: 140_000,
        }),
        telemetryOf({
          runId: 'provider-run-4',
          kind: 'summarizer',
          inputTokens: 9_000,
          outputTokens: 1_000,
        }),
        telemetryOf({ runId: 'provider-run-other', inputTokens: 5_000, outputTokens: 500 }),
      ],
    },
    agentRunHistory: {},
  });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const shownCard = () => within(screen.getByTestId('fact-card'));

const termsOf = (): ReadonlyArray<string> =>
  Array.from(screen.getByTestId('fact-card').querySelectorAll<HTMLElement>('dt')).map(
    (term) => term.textContent ?? '',
  );

const factOf = ({ label }: { readonly label: string }): string | null =>
  shownCard().queryByText(label)?.nextElementSibling?.textContent ?? null;

const modelLines = (): ReadonlyArray<HTMLElement> =>
  Array.from(screen.getByTestId('fact-card').querySelectorAll<HTMLElement>('[data-fact-model]'));

const sentenceOf = (): string => {
  const id = screen.getByRole('button', { name: 'glyph' }).getAttribute('aria-describedby') ?? '';
  return document.getElementById(id)?.textContent ?? '';
};

type PhaseCase = {
  readonly phase: RowPhase;
  readonly words: string;
  readonly note: string | null;
};

const PHASES: ReadonlyArray<PhaseCase> = [
  { phase: 'running', words: 'Working', note: '15m 59s' },
  { phase: 'done', words: 'Done', note: 'in 15m 59s' },
  { phase: 'failed', words: 'Failed', note: 'after 15m 59s' },
  { phase: 'queued', words: 'Queued', note: '15m 59s' },
];

describe('RoleCard', () => {
  it('names the role and the place of a step in its workflow', () => {
    renderCard();

    expect(shownCard().getByText('Implementer')).toBeDefined();
    expect(shownCard().getByText('Step 4 of 6')).toBeDefined();
  });

  it('shows the task in full under the role', () => {
    renderCard();

    expect(shownCard().getByText(TASK).textContent).toBe(TASK);
  });

  it.each(PHASES)('says $words with its time on the state line', ({ phase, words, note }) => {
    renderCard({ phase });

    expect(shownCard().getByText(words)).toBeDefined();
    expect(note === null ? null : shownCard().getByText(note)).toBeDefined();
  });

  it('says it needs you and when it asked', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(Date.parse('2026-10-04T17:00:00Z'));
    renderCard({
      phase: 'waiting',
      entry: entryOf({
        agent: STEP_FOUR,
        openQuestions: [
          questionOf({ createdAt: '2026-10-04T16:50:00Z' }),
          questionOf({ createdAt: '2026-10-04T16:57:00Z' }),
        ],
      }),
    });

    expect(shownCard().getByText('Needs you')).toBeDefined();
    expect(shownCard().getByText('asked 3m ago')).toBeDefined();
  });

  it('says Stopped, not Needs you, for an agent you stopped', () => {
    renderCard({
      phase: 'waiting',
      entry: entryOf({ agent: { ...STEP_FOUR, status: 'stopped', stoppedBy: 'you' } }),
    });

    expect(shownCard().getByText('Stopped')).toBeDefined();
    expect(shownCard().queryByText('Needs you')).toBeNull();
  });

  it('drops Finished and Active, which the state line already carries', () => {
    renderCard();

    expect(termsOf()).toEqual(['Model', 'Started', 'Tokens', 'Cost']);
    expect(factOf({ label: 'Started' })).toBe(formatClock({ at: STARTED ?? '' }));
  });

  it('draws one line per model it ran on, each with its own provider mark', () => {
    renderCard({ models: { models: [SONNET, SOL], isPlanned: false } });

    const lines = modelLines();
    expect(lines.map((line) => line.querySelector('dd')?.textContent)).toEqual([
      'ClaudeSonnet 5.5High',
      'CodexGPT-6.1 SolVery high',
    ]);
    expect(lines[0]?.querySelector('[data-provider="anthropic"]')).not.toBeNull();
    expect(lines[1]?.querySelector('[data-provider="codex"]')).not.toBeNull();
  });

  it('draws no mark for a provider it does not know and keeps the name', () => {
    renderCard({ models: { models: [RETIRED, SONNET], isPlanned: false } });

    const lines = modelLines();
    expect(lines[0]?.querySelector('[data-provider]')).toBeNull();
    expect(lines[0]?.querySelector('dd')?.textContent).toBe('Unknown model');
    expect(lines[1]?.querySelector('[data-provider="anthropic"]')).not.toBeNull();
  });

  it('fills the effort meter to the level on the model axis', () => {
    renderCard();

    const meter = modelLines()[0]?.querySelector('[data-effort-meter]');
    expect(meter?.getAttribute('aria-label')).toBe('Effort High, 3 of 5');
    expect(meter?.querySelectorAll('[data-segment="on"]')).toHaveLength(3);
  });

  it('draws the effort of a turn that has not run yet in faint ink', () => {
    const live: RanModel = { ...SONNET, endReason: null, endedAtMs: null };
    renderCard({
      phase: 'running',
      models: { models: [live], isPlanned: false },
      work: workOf({ isEffortObserved: false }),
    });

    const meter = modelLines()[0]?.querySelector('[data-effort-meter]');
    expect(meter?.getAttribute('data-effort-meter')).toBe('planned');
  });

  it('draws the effort of a turn that ran in the used ink', () => {
    renderCard();

    const meter = modelLines()[0]?.querySelector('[data-effort-meter]');
    expect(meter?.getAttribute('data-effort-meter')).toBe('used');
  });

  it('shows the first and the last of three models and counts the one between', () => {
    renderCard({ models: { models: [SONNET, OPUS, SOL], isPlanned: false } });

    expect(termsOf()).toEqual(['Models', '+ 1 model', 'Started', 'Tokens', 'Cost']);
    expect(shownCard().queryByText('Opus 5.5')).toBeNull();
  });

  it('hides the cost while it is zero', () => {
    renderCard({ costUsd: 0 });

    expect(factOf({ label: 'Cost' })).toBeNull();
    cleanup();

    renderCard({ costUsd: 0.62 });
    expect(factOf({ label: 'Cost' })).toBe('$0.62');
  });

  it('is described to a screen reader by one sentence with the same facts', () => {
    renderCard();

    expect(sentenceOf()).toContain('Implementer Step 4 of 6.');
    expect(sentenceOf()).toContain(`${TASK}.`);
    expect(sentenceOf()).toContain('Done in 15m 59s.');
    expect(sentenceOf()).toContain('Model, Sonnet 5.5, Effort High, 3 of 5.');
    expect(sentenceOf()).toContain('Cost, $0.62.');
  });

  it('stays shut until it is asked for', () => {
    render(
      <AgentRoleCard
        entry={entryOf({ agent: STEP_FOUR })}
        ordinal="4"
        kindWord="Implementer"
        models={ONE_MODEL}
        work={workOf()}
        phase="done"
        costUsd={0.62}
      >
        <button type="button">glyph</button>
      </AgentRoleCard>,
    );

    expect(screen.queryByTestId('fact-card')).toBeNull();
  });

  it('names a subagent by its step and a launch as a launch', () => {
    const subagent = agentOf({
      id: idOf<AgentId>({ value: 'agent-4-3' }),
      parentAgentId: idOf<AgentId>({ value: 'agent-4' }),
    });
    renderCard({ entry: entryOf({ agent: subagent }), ordinal: '4.3' });
    expect(shownCard().getByText('Subagent 4.3 of step 4')).toBeDefined();
    cleanup();

    const launch = agentOf({ id: idOf<AgentId>({ value: 'agent-launch' }) });
    renderCard({ entry: entryOf({ agent: launch, stepLabel: null }), ordinal: null });
    expect(shownCard().getByText('Launch')).toBeDefined();
  });

  it('says what was planned only when routing picked something else', () => {
    renderCard({
      work: workOf({
        planned: { provider: 'anthropic', model: 'claude-haiku-4-5', effort: 'low' },
      }),
    });
    expect(
      shownCard().getByText(/^Planned Haiku 4\.5.*, routing picked Sonnet 5\.5/),
    ).toBeDefined();
    cleanup();

    renderCard();
    expect(shownCard().queryByText(/Planned/)).toBeNull();
    expect(shownCard().queryByText(/routing picked/)).toBeNull();
  });

  it('adds up tokens in, out and cached for this agent only, leaving summaries out', () => {
    renderCard();

    expect(factOf({ label: 'Tokens' })).toBe('182.0k in, 24.0k out140.0k cached');
  });

  it('counts the tokens of every run the agent went through', () => {
    useAppStore.setState({
      agentRunHistory: { [STEP_FOUR.id]: [idOf<ProviderRunId>({ value: 'provider-run-other' })] },
    });
    renderCard();

    expect(factOf({ label: 'Tokens' })).toBe('187.0k in, 24.5k out140.0k cached');
  });

  it('gives a queued agent its estimate on the state line and no start, tokens or cost', () => {
    useAppStore.setState({ sessionTelemetry: { [SESSION]: [] } });
    const queued = agentOf({
      id: idOf<AgentId>({ value: 'agent-4' }),
      stepId: idOf<StepId>({ value: 'step-4' }),
      workflowRunId: RUN,
      status: 'pending',
    });
    renderCard({
      entry: entryOf({ agent: queued }),
      phase: 'queued',
      work: workOf({ timeLabel: '~8-11m' }),
      costUsd: 0,
    });

    expect(shownCard().getByText('~8-11m')).toBeDefined();
    expect(termsOf()).toEqual(['Model']);
  });
});
