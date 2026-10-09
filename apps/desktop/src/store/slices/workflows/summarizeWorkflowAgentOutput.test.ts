// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  Agent,
  AgentId,
  IsoDateTime,
  ProviderId,
  Session,
  SessionId,
  TaskModelPreferences,
  WorkspaceId,
} from '@goodboy/types';

const { summarizeStepOutputSpy } = vi.hoisted(() => ({
  summarizeStepOutputSpy: vi.fn(),
}));

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));

vi.mock('@goodboy/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@goodboy/core')>();
  return { ...actual, summarizeStepOutput: summarizeStepOutputSpy };
});

import { PROVIDER_CAPABILITIES } from '@goodboy/core';
import { summarizeWorkflowAgentOutput } from './summarizeWorkflowAgentOutput';

const SESSION_ID = 'session-step-summary' as SessionId;
const AGENT_ID = 'agent-step-summary' as AgentId;
const WORKSPACE_ID = 'ws-step-summary' as WorkspaceId;
const NOW = '2026-07-23T00:00:00.000Z' as IsoDateTime;

const agent: Agent = {
  id: AGENT_ID,
  sessionId: SESSION_ID,
  ordinal: 0,
  name: 'Implement',
  status: 'completed',
};

const session: Session = {
  id: SESSION_ID,
  workspaceId: WORKSPACE_ID,
  goal: 'implement the change',
  state: { kind: 'idle', lastActivityAt: NOW },
  contextSlots: [],
  providerPreference: { defaultProvider: 'anthropic', allowTurnOverride: true },
  permissionMode: 'default',
  workflowRuns: [],
  autoRun: false,
  titleUserEdited: false,
  createdAt: NOW,
  updatedAt: NOW,
};

type HarnessParams = {
  readonly connected: ReadonlyArray<ProviderId>;
  readonly cooldowns?: Readonly<Partial<Record<ProviderId, number>>>;
  readonly defaultProviderId?: ProviderId;
  readonly taskModels?: TaskModelPreferences;
};

const buildHarness = ({ connected, cooldowns, defaultProviderId, taskModels }: HarnessParams) => {
  const emitNotification = vi.fn(async (..._args: ReadonlyArray<unknown>) => undefined);
  const resolveNotifications = vi.fn(async (..._args: ReadonlyArray<unknown>) => undefined);
  const state: Record<string, unknown> & {
    providerCooldowns: Readonly<Partial<Record<ProviderId, number>>>;
    helperProviderFailures: Readonly<Partial<Record<ProviderId, number>>>;
    stepSummaryDegraded: Record<string, boolean>;
  } = {
    sessions: [session],
    projects: [],
    sessionProjectMounts: {},
    sessionActiveProject: {},
    providers: connected.map((id) => ({
      id,
      binary: id,
      capabilities: PROVIDER_CAPABILITIES[id],
      connection: 'connected' as const,
      version: null,
      identity: null,
    })),
    providerCooldowns: cooldowns ?? {},
    workspaceOverrides:
      defaultProviderId == null && taskModels == null
        ? {}
        : {
            [WORKSPACE_ID]: {
              defaultProviderId: defaultProviderId ?? null,
              taskModels: taskModels ?? null,
            },
          },
    phaseTemplates: {},
    sessionWorkflows: {},
    stepSummaryDegraded: {},
    degradedStepOutputs: {},
    sessionPhaseRuns: {},
    helperProviderFailures: {},
    settings: {},
    emitNotification,
    resolveNotifications,
  };
  const set = vi.fn((updater: unknown) => {
    const patch =
      typeof updater === 'function'
        ? (updater as (s: typeof state) => Partial<typeof state>)(state)
        : (updater as Partial<typeof state>);
    Object.assign(state, patch);
  });
  const call = () =>
    summarizeWorkflowAgentOutput({
      set: set as unknown as Parameters<typeof summarizeWorkflowAgentOutput>[0]['set'],
      get: (() => state) as unknown as Parameters<typeof summarizeWorkflowAgentOutput>[0]['get'],
      sessionId: SESSION_ID,
      agent,
      output: 'the step wrote three files and ran the suite',
    });
  return { call, set, emitNotification, resolveNotifications, state };
};

describe('summarizeWorkflowAgentOutput', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    summarizeStepOutputSpy.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('summarizes on another provider before truncating', async () => {
    summarizeStepOutputSpy
      .mockRejectedValueOnce(new Error('Claude usage limit reached'))
      .mockResolvedValueOnce('three files touched, suite green');
    const { call, emitNotification } = buildHarness({ connected: ['anthropic', 'codex'] });

    const summary = await call();

    expect(summary).toBe('three files touched, suite green');
    expect(summarizeStepOutputSpy.mock.calls.map((args) => args[0]?.providerId)).toEqual([
      'anthropic',
      'codex',
    ]);
    expect(emitNotification).not.toHaveBeenCalled();
  });

  it('retries a generic cli exit on another provider and does not notify', async () => {
    summarizeStepOutputSpy
      .mockRejectedValueOnce(new Error('summarizer cli exited with code 1'))
      .mockRejectedValueOnce(new Error('summarizer cli exited with code 1'))
      .mockResolvedValueOnce('three files touched, suite green');
    const { call, emitNotification } = buildHarness({ connected: ['anthropic', 'codex'] });

    const summary = await call();

    expect(summary).toBe('three files touched, suite green');
    expect(summarizeStepOutputSpy.mock.calls.map((args) => args[0]?.providerId)).toEqual([
      'anthropic',
      'anthropic',
      'codex',
    ]);
    expect(emitNotification).not.toHaveBeenCalled();
  });

  it('uses the current workspace provider for an automatic workflow summary', async () => {
    summarizeStepOutputSpy.mockResolvedValueOnce('summary');
    const { call } = buildHarness({
      connected: ['anthropic', 'codex'],
      defaultProviderId: 'codex',
    });

    await call();

    expect(summarizeStepOutputSpy).toHaveBeenCalledWith(
      expect.objectContaining({ providerId: 'codex', model: 'gpt-5.6-luna' }),
    );
  });

  it('preserves an explicit codex variant for a workflow summary', async () => {
    summarizeStepOutputSpy.mockResolvedValueOnce('summary');
    const { call } = buildHarness({
      connected: ['anthropic', 'codex'],
      taskModels: {
        summarizer: { providerId: 'codex', model: 'gpt-5.6-luna', effort: 'xhigh' },
      },
    });

    await call();

    expect(summarizeStepOutputSpy).toHaveBeenCalledWith(
      expect.objectContaining({ providerId: 'codex', model: 'gpt-5.6-luna', effort: 'xhigh' }),
    );
  });

  it('records a cooldown for the provider that ran out', async () => {
    summarizeStepOutputSpy
      .mockRejectedValueOnce(new Error('Claude usage limit reached'))
      .mockResolvedValueOnce('summary');
    const { call, state } = buildHarness({ connected: ['anthropic', 'codex'] });

    await call();

    expect(state.providerCooldowns.anthropic).toBeGreaterThan(Date.now());
  });

  it('records a cooldown when the provider is unauthenticated', async () => {
    summarizeStepOutputSpy
      .mockRejectedValueOnce(new Error('401 unauthorized'))
      .mockResolvedValueOnce('summary');
    const { call, state } = buildHarness({ connected: ['anthropic', 'codex'] });

    await call();

    expect(state.providerCooldowns.anthropic).toBeGreaterThan(Date.now());
  });

  it('records a cooldown when the provider is rate limited', async () => {
    summarizeStepOutputSpy
      .mockRejectedValueOnce(new Error('429 too many requests'))
      .mockResolvedValueOnce('summary');
    const { call, state } = buildHarness({ connected: ['anthropic', 'codex'] });

    await call();

    expect(state.providerCooldowns.anthropic).toBeGreaterThan(Date.now());
  });

  it('leaves the cooldowns untouched for a failure the pool cannot help with', async () => {
    summarizeStepOutputSpy.mockRejectedValue(new Error('the model produced nonsense'));
    const { call, state } = buildHarness({ connected: ['anthropic', 'codex'] });

    await call();

    expect(state.providerCooldowns).toEqual({});
  });

  it('records no cooldown for a non-cooldown failure kind', async () => {
    summarizeStepOutputSpy.mockRejectedValue(new Error('the model produced nonsense'));
    const { call, state } = buildHarness({ connected: ['anthropic', 'codex'] });

    await call();

    expect(state.providerCooldowns).toEqual({});
  });

  it('notifies when every provider is cooling down before the first call', async () => {
    const { call, emitNotification } = buildHarness({
      connected: ['anthropic'],
      cooldowns: { anthropic: Date.now() + 600_000 },
    });

    const summary = await call();

    expect(summarizeStepOutputSpy).not.toHaveBeenCalled();
    expect(summary).toContain('the step wrote three files');
    expect(emitNotification).toHaveBeenCalledTimes(1);
    expect((emitNotification.mock.calls[0]?.[0] as { body?: string } | undefined)?.body).toContain(
      'cooling down',
    );
  });

  it('starts on a provider that is not cooling down', async () => {
    summarizeStepOutputSpy.mockResolvedValueOnce('summary');
    const { call } = buildHarness({
      connected: ['anthropic', 'codex'],
      cooldowns: { anthropic: Date.now() + 600_000 },
    });

    await call();

    expect(summarizeStepOutputSpy.mock.calls.map((args) => args[0]?.providerId)).toEqual(['codex']);
  });

  it('summarizes on another provider when the preferred model is not available there', async () => {
    summarizeStepOutputSpy
      .mockRejectedValueOnce(
        new Error(
          "The 'gpt-5.6-luna' model is not supported when using Codex with a ChatGPT account",
        ),
      )
      .mockResolvedValueOnce('three files touched, suite green');
    const { call, state } = buildHarness({
      connected: ['anthropic', 'codex'],
      defaultProviderId: 'codex',
    });

    const summary = await call();

    expect(summary).toBe('three files touched, suite green');
    expect(summarizeStepOutputSpy.mock.calls.map((args) => args[0]?.providerId)).toEqual([
      'codex',
      'anthropic',
    ]);
    expect(state.providerCooldowns).toEqual({});
  });

  it('reports the broken preference even when the alternative model succeeds', async () => {
    summarizeStepOutputSpy
      .mockRejectedValueOnce(
        new Error(
          "The 'gpt-5.6-luna' model is not supported when using Codex with a ChatGPT account",
        ),
      )
      .mockResolvedValueOnce('three files touched, suite green');
    const { call, emitNotification } = buildHarness({
      connected: ['anthropic', 'codex'],
      defaultProviderId: 'codex',
    });

    await call();

    expect(emitNotification).toHaveBeenCalledTimes(1);
    const params = emitNotification.mock.calls[0]?.[0] as
      { title: string; body?: string; coalesceKey?: string } | undefined;
    expect(String(params?.title)).toContain('codex/');
    expect(String(params?.body)).toContain('anthropic/');
    expect(String(params?.body)).toContain('Providers then Models');
    expect(params).toMatchObject({
      coalesceKey: 'summarizer-model-unavailable:codex:gpt-5.6-luna',
    });
  });

  it('says the output was carried unsummarized when no alternative exists', async () => {
    summarizeStepOutputSpy.mockRejectedValue(
      new Error(
        "The 'gpt-5.6-luna' model is not supported when using Codex with a ChatGPT account",
      ),
    );
    const { call, emitNotification } = buildHarness({
      connected: ['codex'],
      defaultProviderId: 'codex',
    });

    const summary = await call();

    expect(summarizeStepOutputSpy).toHaveBeenCalledTimes(1);
    expect(summary).toContain('the step wrote three files');
    expect(emitNotification).toHaveBeenCalledTimes(1);
    expect(
      String((emitNotification.mock.calls[0]?.[0] as { body?: string } | undefined)?.body),
    ).toContain('carried unsummarized');
  });

  it('truncates and notifies once when no other provider can take over', async () => {
    summarizeStepOutputSpy.mockRejectedValue(new Error('Claude usage limit reached'));
    const { call, emitNotification } = buildHarness({ connected: ['anthropic'] });

    const summary = await call();

    expect(summarizeStepOutputSpy).toHaveBeenCalledTimes(1);
    expect(summary).toContain('the step wrote three files');
    expect(emitNotification).toHaveBeenCalledTimes(1);
  });

  it('raises one plain notice per session once every model failed', async () => {
    summarizeStepOutputSpy.mockRejectedValue(new Error('Claude usage limit reached'));
    const { call, emitNotification, resolveNotifications } = buildHarness({
      connected: ['anthropic', 'codex'],
    });

    await call();

    expect(summarizeStepOutputSpy.mock.calls.map((args) => args[0]?.providerId)).toEqual([
      'anthropic',
      'codex',
    ]);
    expect(emitNotification).toHaveBeenCalledTimes(1);
    expect(emitNotification).toHaveBeenCalledWith({
      kind: 'summarizer-degraded',
      severity: 'warning',
      title: 'Step summary unavailable',
      body: 'Every summarizer model failed (Claude, Codex), so the output of Implement was carried over unsummarized. Retry once a provider is back.',
      sessionId: SESSION_ID,
      action: { kind: 'retry-step-summary', sessionId: SESSION_ID, agentId: AGENT_ID },
      coalesceKey: `step-summary-degraded:${SESSION_ID}`,
      isOnce: true,
    });
    expect(resolveNotifications).not.toHaveBeenCalled();
  });

  it('clears the notice once a summary lands and nothing else is degraded', async () => {
    summarizeStepOutputSpy.mockResolvedValueOnce('three files touched, suite green');
    const { call, resolveNotifications } = buildHarness({ connected: ['anthropic'] });

    await call();

    expect(resolveNotifications).toHaveBeenCalledWith([`step-summary-degraded:${SESSION_ID}`]);
  });

  it('keeps the notice while another step of the session is still degraded', async () => {
    summarizeStepOutputSpy.mockResolvedValueOnce('three files touched, suite green');
    const other: Agent = { ...agent, id: 'agent-other' as AgentId, name: 'Verify' };
    const { call, resolveNotifications, state } = buildHarness({ connected: ['anthropic'] });
    state.sessionPhaseRuns = { [SESSION_ID]: [agent, other] };
    state.stepSummaryDegraded = { [other.id]: true };

    await call();

    expect(resolveNotifications).not.toHaveBeenCalled();
  });

  it('does not tell the owner when a fallback model wrote the summary after a generic exit', async () => {
    const exit = new Error('summarizer cli exited with code 1');
    summarizeStepOutputSpy
      .mockRejectedValueOnce(exit)
      .mockRejectedValueOnce(exit)
      .mockResolvedValueOnce('three files touched, suite green');
    const { call, emitNotification, state } = buildHarness({ connected: ['anthropic', 'codex'] });

    await call();

    expect(emitNotification).not.toHaveBeenCalled();
    expect(state.stepSummaryDegraded[AGENT_ID]).toBe(false);
  });

  it('never falls back to a hidden model', async () => {
    summarizeStepOutputSpy.mockRejectedValue(new Error('Claude usage limit reached'));
    const { call, state } = buildHarness({ connected: ['anthropic', 'codex'] });
    state.settings = {
      'providers.hiddenModels': JSON.stringify({
        codex: PROVIDER_CAPABILITIES.codex.models.map((model) => model.id),
      }),
    };

    await call();

    expect(summarizeStepOutputSpy.mock.calls.map((args) => args[0]?.providerId)).toEqual([
      'anthropic',
    ]);
  });

  it('starts on another provider while the first one is failing in this window', async () => {
    summarizeStepOutputSpy.mockResolvedValueOnce('three files touched, suite green');
    const { call, state } = buildHarness({ connected: ['anthropic', 'codex'] });
    state.helperProviderFailures = { anthropic: Date.now() + 60_000 };

    await call();

    expect(summarizeStepOutputSpy.mock.calls.map((args) => args[0]?.providerId)).toEqual(['codex']);
  });

  it('opens a failing window for a provider that failed twice before another one answered', async () => {
    const exit = new Error('summarizer cli exited with code 1');
    summarizeStepOutputSpy
      .mockRejectedValueOnce(exit)
      .mockRejectedValueOnce(exit)
      .mockResolvedValueOnce('three files touched, suite green');
    const { call, state } = buildHarness({ connected: ['anthropic', 'codex'] });

    await call();

    expect(state.helperProviderFailures.anthropic).toBeGreaterThan(Date.now());
    expect(state.helperProviderFailures.codex).toBeUndefined();
  });
});
