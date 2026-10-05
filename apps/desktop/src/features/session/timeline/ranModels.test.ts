import { describe, expect, it } from 'vitest';
import type {
  AgentId,
  MeasuredTurnSpan,
  ProviderId,
  ProviderName,
  WorkflowRunId,
} from '@goodboy/types';
import { agentRanModels, modelsSummary, runRanModels } from './ranModels';

const AGENT = 'agent-1' as AgentId;
const RUN = 'run-1' as WorkflowRunId;

type SpanParams = {
  readonly provider: ProviderName;
  readonly model: string;
  readonly startedAtMs: number;
  readonly endReason?: MeasuredTurnSpan['endReason'];
  readonly agentId?: string;
  readonly parentAgentId?: string | null;
  readonly runId?: string | null;
  readonly effort?: string | null;
  readonly costUsd?: number | null;
};

const spanOf = ({
  provider,
  model,
  startedAtMs,
  endReason = 'succeeded',
  agentId = AGENT,
  parentAgentId = null,
  runId = RUN,
  effort = 'high',
  costUsd = 0.1,
}: SpanParams): MeasuredTurnSpan => ({
  agentId: agentId as AgentId,
  parentAgentId: parentAgentId === null ? null : (parentAgentId as AgentId),
  agentStatus: 'completed',
  workflowRunId: runId === null ? null : (runId as WorkflowRunId),
  isOrchestratedRunDone: false,
  stepRole: 'implementer',
  provider,
  model,
  effort,
  startedAtMs,
  endedAtMs: startedAtMs + 1_000,
  endReason,
  costUsd,
  touchedMountIds: null,
});

const SONNET = { provider: 'anthropic', model: 'claude-sonnet-5-5' } as const;
const KIMI = { provider: 'moonshot', model: 'kimi-k3' } as const;

const namesOf = ({ models }: { readonly models: ReadonlyArray<{ readonly name: string }> }) =>
  models.map((model) => model.name);

describe('agentRanModels', () => {
  it('lists the models in the order their turns ran, not the order the spans arrive', () => {
    const { models } = agentRanModels({
      spans: [
        spanOf({ ...SONNET, startedAtMs: 9_000 }),
        spanOf({ ...KIMI, startedAtMs: 1_000, endReason: 'failed' }),
      ],
      agentId: AGENT,
      routing: null,
      isRoutingPlanned: false,
      isLive: false,
    });

    expect(namesOf({ models })).toEqual(['Kimi K3', 'Sonnet 5.5']);
    expect(models[0]?.endReason).toBe('failed');
    expect(models[1]?.endReason).toBe('succeeded');
  });

  it('folds consecutive turns on one model into one entry', () => {
    const { models } = agentRanModels({
      spans: [
        spanOf({ ...SONNET, startedAtMs: 1_000 }),
        spanOf({ ...SONNET, startedAtMs: 3_000 }),
        spanOf({ ...SONNET, startedAtMs: 5_000 }),
      ],
      agentId: AGENT,
      routing: null,
      isRoutingPlanned: false,
      isLive: false,
    });

    expect(namesOf({ models })).toEqual(['Sonnet 5.5']);
    expect(models[0]?.endedAtMs).toBe(6_000);
  });

  it('keeps the turns of other agents out of this one', () => {
    const { models } = agentRanModels({
      spans: [
        spanOf({ ...KIMI, startedAtMs: 1_000, agentId: 'agent-2' }),
        spanOf({ ...SONNET, startedAtMs: 2_000 }),
      ],
      agentId: AGENT,
      routing: null,
      isRoutingPlanned: false,
      isLive: false,
    });

    expect(namesOf({ models })).toEqual(['Sonnet 5.5']);
  });

  it('reads the effort of each turn as a word', () => {
    const { models } = agentRanModels({
      spans: [spanOf({ ...SONNET, startedAtMs: 1_000, effort: 'xhigh' })],
      agentId: AGENT,
      routing: null,
      isRoutingPlanned: false,
      isLive: false,
    });

    expect(models[0]?.effort).toBe('Very high');
  });

  it('falls back to the routing of an agent that has no turn yet and says it is planned', () => {
    const planned = agentRanModels({
      spans: [],
      agentId: AGENT,
      routing: { provider: 'anthropic', model: 'claude-sonnet-5-5', effort: 'medium' },
      isRoutingPlanned: true,
      isLive: false,
    });

    expect(namesOf(planned)).toEqual(['Sonnet 5.5']);
    expect(planned.isPlanned).toBe(true);
    expect(planned.models[0]?.endReason).toBeNull();
  });

  it('adds the current routing after the turns of a live agent that moved to another model', () => {
    const { models, isPlanned } = agentRanModels({
      spans: [spanOf({ ...KIMI, startedAtMs: 1_000, endReason: 'failed' })],
      agentId: AGENT,
      routing: { provider: 'anthropic', model: 'claude-sonnet-5-5', effort: 'high' },
      isRoutingPlanned: false,
      isLive: true,
    });

    expect(namesOf({ models })).toEqual(['Kimi K3', 'Sonnet 5.5']);
    expect(models[1]?.endReason).toBeNull();
    expect(isPlanned).toBe(false);
  });

  it('marks the last turn of a live agent as still running when the model has not changed', () => {
    const { models } = agentRanModels({
      spans: [spanOf({ ...SONNET, startedAtMs: 1_000 })],
      agentId: AGENT,
      routing: { provider: 'anthropic', model: 'claude-sonnet-5-5', effort: 'high' },
      isRoutingPlanned: false,
      isLive: true,
    });

    expect(namesOf({ models })).toEqual(['Sonnet 5.5']);
    expect(models[0]?.endReason).toBeNull();
  });

  it('keeps the models that ran, and not a later routing guess, on a finished agent', () => {
    const { models } = agentRanModels({
      spans: [spanOf({ ...KIMI, startedAtMs: 1_000 })],
      agentId: AGENT,
      routing: { provider: 'anthropic', model: 'claude-sonnet-5-5', effort: 'high' },
      isRoutingPlanned: false,
      isLive: false,
    });

    expect(namesOf({ models })).toEqual(['Kimi K3']);
  });

  it('names the provider when only the provider is known', () => {
    const { models } = agentRanModels({
      spans: [],
      agentId: AGENT,
      routing: { provider: 'cursor', model: null, effort: null },
      isRoutingPlanned: true,
      isLive: false,
    });

    expect(namesOf({ models })).toEqual(['Cursor']);
  });

  it('returns nothing when neither a turn nor a routing says anything', () => {
    const { models } = agentRanModels({
      spans: [],
      agentId: AGENT,
      routing: { provider: null, model: null, effort: null },
      isRoutingPlanned: true,
      isLive: false,
    });

    expect(models).toEqual([]);
  });
});

describe('runRanModels', () => {
  it('counts the steps and sums the cost of each model, in the order they first ran', () => {
    const models = runRanModels({
      spans: [
        spanOf({ ...SONNET, startedAtMs: 1_000, agentId: 'a', costUsd: 0.3 }),
        spanOf({ ...KIMI, startedAtMs: 2_000, agentId: 'b', costUsd: 0.1 }),
        spanOf({ ...SONNET, startedAtMs: 3_000, agentId: 'c', costUsd: 0.2 }),
        spanOf({ ...SONNET, startedAtMs: 4_000, agentId: 'c', costUsd: 0.1 }),
      ],
      runId: RUN,
    });

    expect(models.map((model) => [model.name, model.stepCount])).toEqual([
      ['Sonnet 5.5', 2],
      ['Kimi K3', 1],
    ]);
    expect(models[0]?.costUsd).toBeCloseTo(0.6);
    expect(models[1]?.costUsd).toBeCloseTo(0.1);
  });

  it('credits a subagent turn to the step that owns it', () => {
    const models = runRanModels({
      spans: [
        spanOf({ ...SONNET, startedAtMs: 1_000, agentId: 'step' }),
        spanOf({ ...SONNET, startedAtMs: 2_000, agentId: 'child', parentAgentId: 'step' }),
      ],
      runId: RUN,
    });

    expect(models[0]?.stepCount).toBe(1);
  });

  it('leaves out turns of other runs and turns outside any run', () => {
    const models = runRanModels({
      spans: [
        spanOf({ ...KIMI, startedAtMs: 1_000, runId: 'run-2' }),
        spanOf({ ...KIMI, startedAtMs: 2_000, runId: null }),
        spanOf({ ...SONNET, startedAtMs: 3_000 }),
      ],
      runId: RUN,
    });

    expect(models.map((model) => model.name)).toEqual(['Sonnet 5.5']);
  });

  it('treats a turn with no cost as free rather than as an error', () => {
    const models = runRanModels({
      spans: [spanOf({ ...SONNET, startedAtMs: 1_000, costUsd: null })],
      runId: RUN,
    });

    expect(models[0]?.costUsd).toBe(0);
  });
});

describe('modelsSummary', () => {
  const route = ({ name, provider }: { readonly name: string; readonly provider: ProviderId }) => ({
    key: `${provider}:${name}`,
    name,
    provider,
  });

  it('says nothing when no model ran', () => {
    expect(modelsSummary({ models: [] })).toBeNull();
  });

  it('prints one model by its name', () => {
    expect(
      modelsSummary({ models: [route({ name: 'Sonnet 5.5', provider: 'anthropic' })] })?.text,
    ).toBe('Sonnet 5.5');
  });

  it('prints a fallback as an arrow in the order the models ran', () => {
    const summary = modelsSummary({
      models: [
        route({ name: 'Kimi K3', provider: 'moonshot' }),
        route({ name: 'Sonnet 5.5', provider: 'anthropic' }),
      ],
    });

    expect(summary?.text).toBe('Kimi K3 → Sonnet 5.5');
    expect(summary?.providers).toEqual(['moonshot', 'anthropic']);
  });

  it('counts the models once there are more than two', () => {
    const summary = modelsSummary({
      models: [
        route({ name: 'Kimi K3', provider: 'moonshot' }),
        route({ name: 'Sonnet 5.5', provider: 'anthropic' }),
        route({ name: 'GPT-6.1', provider: 'codex' }),
      ],
    });

    expect(summary?.text).toBe('3 models');
    expect(summary?.providers).toEqual(['moonshot', 'anthropic', 'codex']);
  });

  it('counts a model once when it came back after a fallback', () => {
    const summary = modelsSummary({
      models: [
        route({ name: 'Sonnet 5.5', provider: 'anthropic' }),
        route({ name: 'Kimi K3', provider: 'moonshot' }),
        route({ name: 'Sonnet 5.5', provider: 'anthropic' }),
      ],
    });

    expect(summary?.text).toBe('Sonnet 5.5 → Kimi K3');
  });

  it('sums a run up as its first model plus the others, with one glyph per provider', () => {
    const summary = modelsSummary({
      isRun: true,
      models: [
        route({ name: 'Sonnet 5.5', provider: 'anthropic' }),
        route({ name: 'GPT-6.1', provider: 'codex' }),
        route({ name: 'Haiku 4.5', provider: 'anthropic' }),
      ],
    });

    expect(summary?.text).toBe('Sonnet 5.5 + 2');
    expect(summary?.providers).toEqual(['anthropic', 'codex']);
  });

  it('prints a run on one model by that name alone', () => {
    expect(
      modelsSummary({
        isRun: true,
        models: [route({ name: 'Sonnet 5.5', provider: 'anthropic' })],
      })?.text,
    ).toBe('Sonnet 5.5');
  });
});
