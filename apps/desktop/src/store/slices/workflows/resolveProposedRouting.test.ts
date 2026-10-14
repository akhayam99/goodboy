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
import {
  getCapabilities,
  hintedRoutingOutcome,
  keepProposalInRoleSet,
  orchestratorModelPool,
  parseWorkflowRoutingProposal,
  resolveWorkflowRouting,
  roleModelSetMenu,
  type WorkflowRoutingWireFields,
} from '@goodboy/core';
import type { AgentRole, ProviderId, RoleModelPreferences } from '@goodboy/types';
import { EMPTY_OVERRIDES, aSession, aWorkspace } from '@goodboy/types/testing';
import type { ProviderDisplayInfo } from '../../../features/providers/providers';
import { workflowAvailabilitySnapshot } from '../../../features/workflows/workflowAvailabilitySnapshot';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  stubStoryInvoke,
  type StoryStore,
} from '../../storyHarness';
import { rolePicks } from '../workflowRouting/rolePicks';
import { selectHiddenModels } from '../settings/selectHiddenModels';
import { resolveProposedRouting } from './resolveProposedRouting';

const WORKSPACE = aWorkspace({ name: 'Harborline' });

const SESSION = aSession({
  workspaceId: WORKSPACE.id,
  modelOverride: 'claude-sonnet-5',
  effort: 'medium',
  providerPreference: {
    defaultProvider: 'anthropic',
    allowTurnOverride: true,
    enabledProviders: ['anthropic', 'codex'],
  },
});

const ROLE_MODELS: RoleModelPreferences = {
  implementer: { providerId: 'anthropic', model: 'claude-sonnet-5', effort: 'medium' },
  reviewer: { providerId: 'codex', model: 'gpt-5.6-luna', effort: 'medium' },
};

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

let useAppStore: StoryStore;

const state = () => useAppStore.getState();

const availabilityOf = () =>
  workflowAvailabilitySnapshot({
    providers: state().providers ?? [],
    cooldowns: state().providerCooldowns ?? {},
    alerts: state().budgetAlerts ?? [],
    hidden: selectHiddenModels({ state: state() }),
    sessionId: SESSION.id,
    isRunBudgetBlocked: false,
    nowMs: 0,
    providerPool: null,
  });

type OracleParams = {
  readonly role: AgentRole;
  readonly fields: WorkflowRoutingWireFields;
  readonly promptText: string;
};

const legacyChain = ({ role, fields, promptText }: OracleParams) => {
  const modelMenu = orchestratorModelPool({
    availability: availabilityOf(),
    hidden: selectHiddenModels({ state: state() }),
  });
  const parsedProposal = parseWorkflowRoutingProposal({ fields, emittingProvider: 'anthropic' });
  const routingProposal = keepProposalInRoleSet({
    outcome: hintedRoutingOutcome({ outcome: parsedProposal, promptText }),
    setMenu: roleModelSetMenu({ menu: modelMenu, role, prefs: ROLE_MODELS }),
  });
  const picks = rolePicks({
    state: state(),
    sessionId: SESSION.id,
    role,
    profile:
      parsedProposal.kind === 'valid' ? parsedProposal.proposal.profile : parsedProposal.profile,
    providerPool: null,
  });
  const resolution = resolveWorkflowRouting({
    agentLock: null,
    stepLock: null,
    proposal: routingProposal,
    roleDefault: picks.roleDefault,
    sessionDefault: {
      provider: 'anthropic',
      model: 'claude-sonnet-5',
      effort: 'medium',
    },
    kindDefault: picks.kindDefault,
    availability: availabilityOf(),
    contextEstimate: null,
    missingProposal: 'configured_default',
  });
  return { parsedProposal, routingProposal, picks, resolution };
};

const sharedChain = ({ role, fields, promptText }: OracleParams) =>
  resolveProposedRouting({
    state: state(),
    sessionId: SESSION.id,
    session: SESSION,
    role,
    fields,
    promptText,
    emittingProvider: 'anthropic',
    defaultProvider: 'anthropic',
    modelMenu: orchestratorModelPool({
      availability: availabilityOf(),
      hidden: selectHiddenModels({ state: state() }),
    }),
    roleModels: ROLE_MODELS,
    providerPool: null,
    availability: availabilityOf(),
  });

const CASES: ReadonlyArray<Readonly<{ name: string } & OracleParams>> = [
  {
    name: 'a proposal inside the role set',
    role: 'implementer',
    fields: { provider: 'anthropic', model: 'claude-sonnet-5', effort: 'medium' },
    promptText: 'implement the ledger-core export',
  },
  {
    name: 'a proposal outside the role set',
    role: 'reviewer',
    fields: { provider: 'anthropic', model: 'claude-opus-5-5', effort: 'high' },
    promptText: 'review the notify-relay change',
  },
  {
    name: 'a proposal without a routing field',
    role: 'scout',
    fields: { taskType: 'exploration', difficulty: 'light' },
    promptText: 'look at payments-api',
  },
  {
    name: 'an invalid proposal with no model',
    role: 'planner',
    fields: { provider: 'anthropic' },
    promptText: 'plan the cascadia rollout',
  },
  {
    name: 'a proposal for a model nobody offers',
    role: 'tester',
    fields: { provider: 'codex', model: 'model-that-does-not-exist', effort: 'low' },
    promptText: 'test it',
  },
];

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
  useAppStore.setState({
    workspaces: [WORKSPACE],
    currentWorkspaceId: WORKSPACE.id,
    sessions: [SESSION],
    providers: [providerInfo({ id: 'anthropic' }), providerInfo({ id: 'codex' })],
    providerLimits: {},
    workspaceOverrides: {
      [WORKSPACE.id]: {
        ...EMPTY_OVERRIDES,
        defaultProviderId: 'anthropic',
        roleModels: ROLE_MODELS,
      },
    },
  });
});

describe('the routing chain shared by the orchestrator and Auto', () => {
  it.each(CASES)('gives $name the same outcome as the chain it was lifted from', (testCase) => {
    const expected = legacyChain(testCase);
    const actual = sharedChain(testCase);

    expect(actual).toEqual(expected);
  });

  it('reports a resolution kind the caller can act on', () => {
    const outcome = sharedChain(CASES[0]!);

    expect(['ready', 'blocked']).toContain(outcome.resolution.kind);
  });

  it('keeps the proposal out when it leaves the role set', () => {
    const outcome = sharedChain(CASES[1]!);

    expect(outcome.parsedProposal.kind).toBe('valid');
    expect(outcome.routingProposal.kind).toBe('missing');
  });
});
