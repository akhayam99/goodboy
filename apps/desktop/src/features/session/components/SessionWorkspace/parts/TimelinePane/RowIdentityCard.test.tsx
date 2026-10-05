// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(() => new Promise<never>(() => undefined)),
}));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type {
  Agent,
  AgentId,
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
} from '../../../../../../store/storyHarness';
import { formatClock } from '../../../../../../shared/utils/time/formatClock';
import type { AgentRowWork } from '../../../../hooks/useAgentRowWork';
import type { TimelineAgentEntry } from '../../../../timeline/buildTimelineGroups';
import type { AgentModels } from '../../../../timeline/ranModels';
import { RowIdentityCard } from './RowIdentityCard';

const SESSION = 'session-webhooks' as SessionId;
const RUN = 'run-webhooks' as WorkflowRunId;
const STARTED = '2026-10-04T16:41:00Z' as Agent['startedAt'];
const FINISHED = '2026-10-04T16:57:00Z' as Agent['completedAt'];

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

type AgentParams = Partial<Agent> & { readonly id: AgentId };

const agentOf = (overrides: AgentParams): Agent =>
  anAgent({ sessionId: SESSION, name: 'Dedupe check in the webhook handler', ...overrides });

const STEP_AGENTS: ReadonlyArray<Agent> = [1, 2, 3, 4, 5, 6].map((ordinal) =>
  agentOf({
    id: `agent-${ordinal}` as AgentId,
    ordinal,
    stepId: `step-${ordinal}` as StepId,
    workflowRunId: RUN,
  }),
);

type EntryParams = {
  readonly agent: Agent;
  readonly stepLabel?: string | null;
};

const entryOf = ({ agent, stepLabel = '4' }: EntryParams): TimelineAgentEntry => ({
  kind: 'agent',
  id: `agent:${agent.id}`,
  at: agent.startedAt ?? null,
  ordinal: 4,
  agent,
  agentKind: 'implementer',
  isMissingArtifact: false,
  stepLabel,
  openQuestions: [],
  terminalQuestions: [],
  children: [],
  answers: [],
  hasDuration: true,
  chain: null,
});

const STEP_FOUR = agentOf({
  id: 'agent-4' as AgentId,
  ordinal: 4,
  stepId: 'step-4' as StepId,
  workflowRunId: RUN,
  status: 'completed',
  runId: 'provider-run-4' as ProviderRunId,
  startedAt: STARTED,
  completedAt: FINISHED,
});

const MODELS: AgentModels = {
  models: [
    {
      key: 'anthropic:Sonnet 5.5',
      provider: 'anthropic',
      name: 'Sonnet 5.5',
      effort: 'High',
      endReason: 'succeeded',
      endedAtMs: Date.parse(FINISHED ?? ''),
    },
  ],
  isPlanned: false,
};

type WorkParams = {
  readonly planned?: {
    readonly provider: string;
    readonly model: string;
    readonly effort: 'low' | 'high';
  };
  readonly timeLabel?: string | null;
};

const workOf = ({
  planned = { provider: 'anthropic', model: 'claude-sonnet-5-5', effort: 'high' },
  timeLabel = '15m 59s',
}: WorkParams = {}): AgentRowWork => ({
  routing: {
    provider: 'anthropic',
    model: 'claude-sonnet-5-5',
    effort: 'high',
    isEffortObserved: true,
    planned,
    isPlanned: false,
  },
  time:
    timeLabel === null
      ? null
      : {
          label: timeLabel,
          detail: '',
          progress: null,
          headline: timeLabel,
          note: null,
          isMuchLonger: false,
        },
});

const telemetryOf = ({
  runId,
  kind = 'turn',
  inputTokens,
  outputTokens,
  cachedInputTokens,
}: {
  readonly runId: string;
  readonly kind?: TelemetryRecord['kind'];
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly cachedInputTokens?: number;
}): TelemetryRecord => ({
  id: `telemetry-${runId}-${kind}` as TelemetryRecordId,
  runId: runId as ProviderRunId,
  sessionId: SESSION,
  kind,
  provider: 'anthropic',
  model: 'claude-sonnet-5-5',
  inputTokens,
  outputTokens,
  ...(cachedInputTokens === undefined ? {} : { cachedInputTokens }),
  estimatedCostUsd: 0.1,
  recordedAt: '2026-10-04T16:57:00Z' as TelemetryRecord['recordedAt'],
});

type CardProps = Parameters<typeof RowIdentityCard>[0];

const renderCard = (props: Partial<CardProps> = {}) =>
  render(
    <RowIdentityCard
      entry={entryOf({ agent: STEP_FOUR })}
      ordinal="4"
      kindWord="Implementer"
      models={MODELS}
      work={workOf()}
      phase="done"
      costUsd={0.62}
      {...props}
    />,
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

afterEach(cleanup);

const factOf = ({ label }: { readonly label: string }): string | null =>
  screen.queryByText(label)?.nextElementSibling?.textContent ?? null;

describe('RowIdentityCard', () => {
  it('names the role and the place of a step in its workflow', () => {
    renderCard();

    expect(screen.getByText('Implementer')).toBeDefined();
    expect(screen.getByText('Step 4 of 6')).toBeDefined();
  });

  it('names a subagent by its step and a launch as a launch', () => {
    const subagent = agentOf({ id: 'agent-4-3' as AgentId, parentAgentId: 'agent-4' as AgentId });
    renderCard({ entry: entryOf({ agent: subagent }), ordinal: '4.3' });
    expect(screen.getByText('Subagent 4.3 of step 4')).toBeDefined();
    cleanup();

    const launch = agentOf({ id: 'agent-launch' as AgentId });
    renderCard({ entry: entryOf({ agent: launch, stepLabel: null }), ordinal: null });
    expect(screen.getByText('Launch')).toBeDefined();
  });

  it('prints the model and effort that ran', () => {
    renderCard();

    expect(screen.getByText('Sonnet 5.5 · High')).toBeDefined();
  });

  it('says what was planned only when routing picked something else', () => {
    renderCard({
      work: workOf({
        planned: { provider: 'anthropic', model: 'claude-haiku-4-5', effort: 'low' },
      }),
    });
    expect(screen.getByText(/^Planned Haiku 4\.5.*, routing picked Sonnet 5\.5/)).toBeDefined();
    cleanup();

    renderCard();
    expect(screen.queryByText(/Planned/)).toBeNull();
    expect(screen.queryByText(/routing picked/)).toBeNull();
  });

  it('lists when it started and finished, how long it was active and what it cost', () => {
    renderCard();

    expect(factOf({ label: 'Started' })).toBe(formatClock({ at: STARTED ?? '' }));
    expect(factOf({ label: 'Finished' })).toBe(formatClock({ at: FINISHED ?? '' }));
    expect(factOf({ label: 'Active' })).toBe('15m 59s');
    expect(factOf({ label: 'Cost' })).toBe('$0.62');
  });

  it('adds up tokens in, out and cached for this agent only, leaving summaries out', () => {
    renderCard();

    expect(factOf({ label: 'Tokens' })).toBe('182.0k in · 24.0k out · 140.0k cached');
  });

  it('counts the tokens of every run the agent went through', () => {
    useAppStore.setState({
      agentRunHistory: { [STEP_FOUR.id]: ['provider-run-other' as ProviderRunId] },
    });
    renderCard();

    expect(factOf({ label: 'Tokens' })).toBe('187.0k in · 24.5k out · 140.0k cached');
  });

  it('prints no finish for a running agent and the elapsed time as active time', () => {
    const running = agentOf({ ...STEP_FOUR, status: 'running', completedAt: undefined });
    renderCard({
      entry: entryOf({ agent: running }),
      phase: 'running',
      work: workOf({ timeLabel: '7m 51s' }),
    });

    expect(factOf({ label: 'Finished' })).toBeNull();
    expect(factOf({ label: 'Active' })).toBe('7m 51s');
  });

  it('gives a queued agent an estimate and no start, no tokens and no cost', () => {
    useAppStore.setState({ sessionTelemetry: { [SESSION]: [] } });
    const queued = agentOf({
      id: 'agent-4' as AgentId,
      stepId: 'step-4' as StepId,
      workflowRunId: RUN,
      status: 'pending',
    });
    renderCard({
      entry: entryOf({ agent: queued }),
      phase: 'queued',
      work: workOf({ timeLabel: '~8-11m' }),
      costUsd: 0,
    });

    expect(factOf({ label: 'Estimate' })).toBe('~8-11m');
    expect(factOf({ label: 'Started' })).toBeNull();
    expect(factOf({ label: 'Tokens' })).toBeNull();
    expect(factOf({ label: 'Cost' })).toBeNull();
  });
});
