// @vitest-environment node

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../storyHarness')).tauriEventModuleMock(),
);
vi.mock('../../../shared/lib/db', async () =>
  (await import('../../storyHarness')).sqliteDbLibModuleMock(),
);

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { getCapabilities, SELECTABLE_AGENT_ROLES, ROLE_REGISTRY } from '@goodboy/core';
import type {
  AgentRole,
  AuxTaskId,
  OverrideSettings,
  ProviderId,
  ProviderPolicy,
  RoleModelPreferences,
  TaskModelPreferences,
  TurnProviderOverride,
} from '@goodboy/types';
import { EMPTY_OVERRIDES, aSession, aWorkspace, anAgent } from '@goodboy/types/testing';
import type { ProviderDisplayInfo } from '../../../features/providers/providers';
import { KIND_TO_ROLE, type AgentKind } from '../../../features/session/agent-kind';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  stubStoryInvoke,
  type StoryStore,
} from '../../storyHarness';
import { selectKindRouting } from '../agents/selectKindRouting';
import { resolveReportRouting } from '../artifacts/spawnReportAgent';
import { resolveWireframeRouting } from '../artifacts/spawnWireframeAgent';
import { historyRewriterConfig } from '../history/historyRewriterConfig';
import { scribeModelConfig } from '../scribe/scribeModelConfig';
import { routeTurn } from '../turn/routeTurn';
import { roleDefaultsFor } from '../workflows/roleDefaultsFor';
import { resolveWorkflowChildRouting } from '../workflowRouting/resolveWorkflowChildRouting';
import { liveEnabledProviders } from './liveEnabledProviders';
import { selectResolution } from './selectResolution';
import { selectTaskModel } from './selectTaskModel';

const WORKSPACE = aWorkspace({ name: 'Harborline' });

const BEFORE_THE_CHANGE = aSession({
  workspaceId: WORKSPACE.id,
  providerPreference: {
    defaultProvider: 'anthropic',
    allowTurnOverride: true,
    enabledProviders: ['anthropic', 'cursor'],
  },
});

const CODEX_ONLY: ProviderPolicy = [
  { id: 'codex', state: 'on' },
  { id: 'anthropic', state: 'off' },
  { id: 'cursor', state: 'off' },
];

const ROLE_PINS: RoleModelPreferences = {
  planner: { providerId: 'anthropic', model: 'claude-opus-5-5', effort: 'high' },
  implementer: { providerId: 'anthropic', model: 'claude-sonnet-5', effort: 'medium' },
  reviewer: { providerId: 'cursor', model: 'composer-2.5', effort: 'medium' },
  report: { providerId: 'anthropic', model: 'claude-sonnet-5', effort: 'medium' },
  wireframe: { providerId: 'anthropic', model: 'claude-sonnet-5', effort: 'medium' },
};

const TASK_PINS: TaskModelPreferences = {
  workflow_orchestrator: { providerId: 'anthropic', model: 'claude-sonnet-5-5' },
  pr_draft: { providerId: 'anthropic', model: 'claude-sonnet-5' },
  rebase: { providerId: 'anthropic', model: 'claude-sonnet-5' },
  summarizer: { providerId: 'anthropic', model: 'claude-sonnet-4-5' },
};

const PINNED_ROLES: ReadonlyArray<AgentRole> = [
  'planner',
  'implementer',
  'reviewer',
  'report',
  'wireframe',
];

const PINNED_TASKS: ReadonlyArray<AuxTaskId> = [
  'workflow_orchestrator',
  'pr_draft',
  'rebase',
  'summarizer',
];

const providerInfo = ({ id }: { readonly id: ProviderId }): ProviderDisplayInfo => ({
  id,
  binary: id,
  capabilities: getCapabilities({ id }),
  connection: 'connected',
  version: null,
  identity: null,
  label: id,
  error: null,
  docsUrl: '',
});

type SeedParams = {
  readonly policy: ProviderPolicy;
  readonly overrides?: Partial<OverrideSettings>;
};

let useAppStore: StoryStore;

const seed = ({ policy, overrides = {} }: SeedParams) => {
  useAppStore.setState({
    workspaces: [WORKSPACE],
    currentWorkspaceId: WORKSPACE.id,
    sessions: [BEFORE_THE_CHANGE],
    providers: [
      providerInfo({ id: 'anthropic' }),
      providerInfo({ id: 'codex' }),
      providerInfo({ id: 'cursor' }),
    ],
    providerLimits: {},
    workspaceOverrides: {
      [WORKSPACE.id]: {
        ...EMPTY_OVERRIDES,
        defaultProviderId: policy[0]?.id ?? 'codex',
        providerPool: policy,
        roleModels: ROLE_PINS,
        taskModels: TASK_PINS,
        ...overrides,
      },
    },
  });
};

const state = () => useAppStore.getState();

const expectedRole = ({ role }: { readonly role: AgentRole }) =>
  selectResolution({
    state: state(),
    sessionId: BEFORE_THE_CHANGE.id,
    slot: { kind: 'role', id: role },
  });

const expectedTask = ({ task }: { readonly task: AuxTaskId }) =>
  selectResolution({
    state: state(),
    sessionId: BEFORE_THE_CHANGE.id,
    slot: { kind: 'task', id: task },
  });

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  stubStoryInvoke({
    check_provider_budget: () => ({
      remainingUsd: 100,
      pct: 1,
      exceeded: false,
      overThreshold: false,
    }),
  });
  seed({ policy: CODEX_ONLY });
});

describe('Codex only, every pin on Anthropic or Cursor, a session made before the change', () => {
  it('lets the Models row skip every pin and run Codex', () => {
    for (const role of PINNED_ROLES) {
      const resolution = expectedRole({ role });
      expect(resolution).toMatchObject({ provider: 'codex', source: 'auto' });
      expect(resolution.skipped.some((skip) => skip.reason === 'off')).toBe(true);
    }
    for (const task of PINNED_TASKS) {
      expect(expectedTask({ task }).provider).toBe('codex');
    }
  });

  it('reads the policy live and ignores the list the session stored', () => {
    expect(liveEnabledProviders({ state: state(), sessionId: BEFORE_THE_CHANGE.id })).toEqual([
      'codex',
    ]);
    expect(BEFORE_THE_CHANGE.providerPreference.enabledProviders).toEqual(['anthropic', 'cursor']);
  });

  it('gives the orchestrator the resolved model per role and says which pin it passed over', () => {
    const defaults = roleDefaultsFor({
      state: state(),
      sessionId: BEFORE_THE_CHANGE.id,
      roleModels: ROLE_PINS,
      menu: [],
    });

    const eligible = SELECTABLE_AGENT_ROLES.filter((role) => ROLE_REGISTRY[role].workflowEligible);
    expect(defaults.map((entry) => entry.role)).toEqual(eligible);
    for (const entry of defaults) {
      const expected = expectedRole({ role: entry.role });
      expect([entry.provider, entry.model]).toEqual([expected.provider, expected.model]);
      expect(entry.provider).toBe('codex');
    }
    const implementer = defaults.find((entry) => entry.role === 'implementer');
    expect(implementer?.skippedPin).toMatch(/\(pinned .+ skipped: Claude is Off\)$/);
    expect(implementer?.models).toBeUndefined();
    const scout = defaults.find((entry) => entry.role === 'scout');
    expect(scout?.skippedPin).toBeUndefined();
  });

  it('plans the orchestrator itself on the task the Models page prints', () => {
    const expected = expectedTask({ task: 'workflow_orchestrator' });
    const planned = selectTaskModel({
      state: state(),
      sessionId: BEFORE_THE_CHANGE.id,
      task: 'workflow_orchestrator',
    });

    expect(planned.providerId).toBe('codex');
    expect([planned.providerId, planned.model]).toEqual([expected.provider, expected.model]);
  });

  it('starts a workflow child on the same provider and model, with no recovery', () => {
    for (const role of ['planner', 'implementer', 'reviewer', 'scout'] as const) {
      const expected = expectedRole({ role });
      const child = resolveWorkflowChildRouting({
        state: state(),
        sessionId: BEFORE_THE_CHANGE.id,
        role,
        childLock: null,
        proposal: null,
        promptText: '',
        missingProposal: 'configured_default',
      });

      expect(child.resolution.kind).toBe('ready');
      if (child.resolution.kind !== 'ready') {
        return;
      }
      const { selected, adjustment } = child.resolution.decision;
      expect([selected.provider, selected.model]).toEqual([expected.provider, expected.model]);
      expect(adjustment).toBe('none');
    }
  });

  it('spawns the report and the wireframe on the resolved role', () => {
    const report = expectedRole({ role: 'report' });
    const wireframe = expectedRole({ role: 'wireframe' });

    const reportRouting = resolveReportRouting({
      state: state(),
      sessionId: BEFORE_THE_CHANGE.id,
      picked: null,
    });
    const wireframeRouting = resolveWireframeRouting({
      state: state(),
      sessionId: BEFORE_THE_CHANGE.id,
      fidelity: 'high',
      picked: null,
    });

    expect([reportRouting.provider, reportRouting.model]).toEqual([report.provider, report.model]);
    expect([wireframeRouting.provider, wireframeRouting.model]).toEqual([
      wireframe.provider,
      wireframe.model,
    ]);
    expect(reportRouting.provider).toBe('codex');
    expect(wireframeRouting.provider).toBe('codex');
  });

  it('spawns the rewriter and Scribe on the rows that carry their names', () => {
    const rewriter = expectedTask({ task: 'rebase' });
    const scribe = expectedTask({ task: 'pr_draft' });

    const rewriterConfig = historyRewriterConfig({
      state: state(),
      sessionId: BEFORE_THE_CHANGE.id,
    });
    const scribeConfig = scribeModelConfig({ state: state(), sessionId: BEFORE_THE_CHANGE.id });

    expect([rewriterConfig.provider, rewriterConfig.model]).toEqual([
      rewriter.provider,
      rewriter.model,
    ]);
    expect([scribeConfig.provider, scribeConfig.model]).toEqual([scribe.provider, scribe.model]);
    expect(rewriterConfig.provider).toBe('codex');
    expect(scribeConfig.provider).toBe('codex');
  });

  it('applies a session pin to the rewriter and Scribe, which the workspace-only read missed', () => {
    useAppStore.setState({
      sessionOverrides: {
        [BEFORE_THE_CHANGE.id]: {
          ...EMPTY_OVERRIDES,
          taskModels: {
            rebase: { providerId: 'codex', model: 'gpt-6.1-sol' },
            pr_draft: { providerId: 'codex', model: 'gpt-5.6-luna' },
          },
        },
      },
    });

    expect(
      historyRewriterConfig({ state: state(), sessionId: BEFORE_THE_CHANGE.id }),
    ).toMatchObject({ provider: 'codex', model: 'gpt-6.1-sol' });
    expect(scribeModelConfig({ state: state(), sessionId: BEFORE_THE_CHANGE.id })).toMatchObject({
      provider: 'codex',
      model: 'gpt-5.6-luna',
    });
  });

  it('starts an agent of each kind on the provider the Models row names', () => {
    const kinds: ReadonlyArray<AgentKind> = ['planner', 'implementer', 'reviewer'];
    for (const kind of kinds) {
      const expected = expectedRole({ role: KIND_TO_ROLE[kind] });
      const routing = selectKindRouting({ state: state(), sessionId: BEFORE_THE_CHANGE.id, kind });

      expect([routing.provider, routing.model]).toEqual([expected.provider, expected.model]);
    }
  });
});

type TurnParams = {
  readonly override?: TurnProviderOverride;
};

const turnOf = async ({ override }: TurnParams = {}) => {
  const appendTurnEvent = vi.fn();
  useAppStore.setState({ appendTurnEvent });
  const agent = anAgent({ sessionId: BEFORE_THE_CHANGE.id });
  const routed = await routeTurn({
    get: () => useAppStore.getState(),
    ctx: {
      input: {
        sessionId: BEFORE_THE_CHANGE.id,
        content: 'Check the ledger export',
        ...(override !== undefined && { override }),
      },
      session: BEFORE_THE_CHANGE,
      now: () => BEFORE_THE_CHANGE.createdAt,
      activeAgentId: agent.id,
      activeAgent: agent,
      phaseDefinition: null,
    },
  });
  return { routed, appendTurnEvent, agent };
};

const messagesOf = ({ calls }: { readonly calls: ReadonlyArray<ReadonlyArray<unknown>> }) =>
  calls.flatMap((call) => {
    const event = call[2];
    return typeof event === 'object' && event !== null && 'message' in event
      ? [String(event.message)]
      : [];
  });

describe('routeTurn on a session made before the change', () => {
  it('never routes to a provider that is Off without an explicit pick', async () => {
    const { routed, appendTurnEvent } = await turnOf();

    expect(routed.isDone).toBe(false);
    if (routed.isDone) {
      return;
    }
    expect(routed.value.provider).toBe('codex');
    expect(messagesOf({ calls: appendTurnEvent.mock.calls })).toEqual([]);
  });

  it('keeps an explicit turn pick on Cursor and says Cursor is Off, once', async () => {
    const { routed, appendTurnEvent } = await turnOf({
      override: { providerId: 'cursor', model: 'composer-2.5', explicit: true },
    });

    expect(routed.isDone).toBe(false);
    if (routed.isDone) {
      return;
    }
    expect(routed.value.provider).toBe('cursor');
    expect(routed.value.routingDecision.reason).toBe('override-off');
    expect(messagesOf({ calls: appendTurnEvent.mock.calls })).toEqual([
      'Running on Cursor because you picked it for this turn. Cursor is Off in Settings.',
    ]);
  });

  it('says nothing for an explicit pick on a provider that is On', async () => {
    seed({
      policy: [
        { id: 'codex', state: 'on' },
        { id: 'cursor', state: 'on' },
        { id: 'anthropic', state: 'off' },
      ],
    });
    const { routed, appendTurnEvent } = await turnOf({
      override: { providerId: 'cursor', model: 'composer-2.5', explicit: true },
    });

    expect(routed.isDone).toBe(false);
    if (routed.isDone) {
      return;
    }
    expect(routed.value.provider).toBe('cursor');
    expect(routed.value.routingDecision.reason).toBe('override');
    expect(messagesOf({ calls: appendTurnEvent.mock.calls })).toEqual([]);
  });

  it('follows the workspace the moment the policy changes, with no new session', async () => {
    seed({
      policy: [
        { id: 'anthropic', state: 'on' },
        { id: 'codex', state: 'off' },
        { id: 'cursor', state: 'off' },
      ],
    });

    const { routed } = await turnOf();

    expect(routed.isDone).toBe(false);
    if (routed.isDone) {
      return;
    }
    expect(routed.value.provider).toBe('anthropic');
  });
});

describe('a pin on a Backup provider', () => {
  const BACKUP_ANTHROPIC: ProviderPolicy = [
    { id: 'codex', state: 'on' },
    { id: 'anthropic', state: 'backup' },
    { id: 'cursor', state: 'off' },
  ];

  it('is skipped as backup-idle while an On provider can serve the slot', () => {
    seed({ policy: BACKUP_ANTHROPIC });

    const resolution = expectedRole({ role: 'implementer' });

    expect(resolution).toMatchObject({ provider: 'codex', source: 'auto' });
    expect(resolution.skipped).toContainEqual(
      expect.objectContaining({ provider: 'anthropic', reason: 'backup-idle' }),
    );
  });

  it('runs once no On provider can serve the slot', () => {
    seed({ policy: BACKUP_ANTHROPIC });
    useAppStore.setState({
      providers: [providerInfo({ id: 'anthropic' })],
    });

    const resolution = expectedRole({ role: 'implementer' });

    expect(resolution).toMatchObject({
      provider: 'anthropic',
      model: 'sonnet-5',
      source: 'workspace',
    });
  });
});
