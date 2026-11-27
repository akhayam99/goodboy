// @vitest-environment node

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../storyHarness')).tauriEventModuleMock(),
);
vi.mock('../../../../shared/lib/db', async () =>
  (await import('../../../storyHarness')).sqliteDbLibModuleMock(),
);

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { MODEL_CATALOGS, getCapabilities, modelFamily } from '@goodboy/core/providers';
import { isAutoChildProvider, type AutoDelegationRole } from '@goodboy/core/auto';
import {
  DEFAULT_WORKFLOW_RULES,
  PROVIDER_IDS,
  brandId,
  type IsoDateTime,
  type ProviderId,
  type ProviderLimits,
  type WorkflowRules,
} from '@goodboy/types';
import { EMPTY_OVERRIDES, aSession, aWorkspace } from '@goodboy/types/testing';
import type { ProviderDisplayInfo } from '../../../../features/providers/providers';
import { SETTING_HIDDEN_MODELS } from '../../../../features/settings/settings';
import { formatClock } from '../../../../shared/utils/time/formatClock';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  stubStoryInvoke,
  type StoryStore,
} from '../../../storyHarness';
import type { RoutingOutcome, RoutingRequest } from '../ports';
import { resolveChildRouting } from './resolveChildRouting';

const WORKSPACE = aWorkspace({ name: 'Harborline' });

const SESSION = aSession({
  workspaceId: WORKSPACE.id,
  providerPreference: {
    defaultProvider: 'anthropic',
    allowTurnOverride: true,
    enabledProviders: ['anthropic', 'codex', 'cursor'],
  },
});

const BY_ORDER: WorkflowRules = { ...DEFAULT_WORKFLOW_RULES, spreadByHeadroom: false };

const BY_LOAD: WorkflowRules = { ...DEFAULT_WORKFLOW_RULES, spreadByHeadroom: true };

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

const request = (fields: Record<string, unknown>): RoutingRequest => ({
  sessionId: SESSION.id,
  role: 'implementer',
  fields,
  promptText: 'add the ledger export to ledger-core',
});

type ResolveParams = {
  readonly request: RoutingRequest;
  readonly nowMs?: number;
};

const resolveWith = ({ request: routed, nowMs = 0 }: ResolveParams): Promise<RoutingOutcome> =>
  resolveChildRouting({ state: useAppStore.getState(), request: routed, nowMs, turns: [] });

const resolve = (fields: Record<string, unknown>) => resolveWith({ request: request(fields) });

type ResolveForParams = {
  readonly role: AutoDelegationRole;
  readonly difficulty: string;
};

const resolveFor = ({ role, difficulty }: ResolveForParams) =>
  resolveWith({ request: { ...request({ difficulty }), role } });

type ReadyParams = {
  readonly outcome: RoutingOutcome;
};

const ready = ({ outcome }: ReadyParams): Extract<RoutingOutcome, { kind: 'ready' }> => {
  if (outcome.kind !== 'ready') {
    throw new Error(`expected a ready routing, got ${outcome.message}`);
  }
  return outcome;
};

type RulesParams = {
  readonly rules: WorkflowRules;
};

const useRules = ({ rules }: RulesParams) =>
  useAppStore.setState({
    workspaceOverrides: {
      [WORKSPACE.id]: { ...EMPTY_OVERRIDES, defaultProviderId: 'anthropic', workflowRules: rules },
    },
  });

const DIFFICULTIES = ['light', 'standard', 'heavy'] as const;

const CURSOR_HIDDEN = ['gpt-5.5', 'grok-4.6', 'kimi-k3', 'gemini-3.8-flash', 'haiku-5.5'];

const OWNER_HIDDEN = JSON.stringify({
  anthropic: ['opus-4.8', 'opus-4.7', 'sonnet-4.6', 'haiku-5.5', 'haiku-4.5', 'fable-5.2'],
  cursor: CURSOR_HIDDEN,
  codex: ['gpt-5.3-codex'],
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
  useAppStore.setState({
    workspaces: [WORKSPACE],
    currentWorkspaceId: WORKSPACE.id,
    sessions: [SESSION],
    providers: [
      providerInfo({ id: 'anthropic' }),
      providerInfo({ id: 'codex' }),
      providerInfo({ id: 'cursor' }),
    ],
    providerLimits: {},
    providerStrikes: {},
  });
  useRules({ rules: BY_ORDER });
});

describe('the model an Auto child runs on', () => {
  it('resolves a role to a model the app can confine', async () => {
    const outcome = ready({ outcome: await resolve({}) });

    expect(isAutoChildProvider({ provider: outcome.provider, role: 'implementer' })).toBe(true);
    expect(outcome.reason.length).toBeGreaterThan(0);
  });

  it('runs the child on the model its preset step pinned', async () => {
    const pick = { provider: 'codex', model: 'gpt-5.5', effort: 'high' } as const;
    const outcome = await resolveWith({
      request: { ...request({}), stepLock: { version: 1, pick, origin: 'user' } },
    });

    expect(outcome).toMatchObject({ kind: 'ready', ...pick, source: 'pin' });
  });

  it('never hands a writing child to Cursor or Gemini, even when the Lead picks one', async () => {
    for (const provider of ['cursor', 'gemini']) {
      const outcome = ready({
        outcome: await resolve({ provider, model: 'composer-2.5', effort: 'medium' }),
      });

      expect(isAutoChildProvider({ provider: outcome.provider, role: 'implementer' })).toBe(true);
      expect(outcome.proposal).not.toBe('kept');
      expect(outcome.source).toBe('fallback');
    }
  });

  it('keeps to the providers the workspace left on', async () => {
    useAppStore.setState({
      workspaceOverrides: {
        [WORKSPACE.id]: {
          ...EMPTY_OVERRIDES,
          defaultProviderId: 'anthropic',
          workflowRules: BY_ORDER,
          providerPool: [
            { id: 'anthropic', state: 'off' },
            { id: 'codex', state: 'on' },
            { id: 'cursor', state: 'on' },
          ],
        },
      },
    });

    const outcome = ready({
      outcome: await resolve({ provider: 'anthropic', model: 'sonnet-5.5', effort: 'medium' }),
    });

    expect(outcome.provider).toBe('codex');
    expect(outcome.cause).toBe('off');
  });

  it('blocks a writing child when only Cursor is connected, and says why', async () => {
    useAppStore.setState({ providers: [providerInfo({ id: 'cursor' })] });

    const outcome = await resolve({});

    expect(outcome).toMatchObject({ kind: 'blocked', code: 'no_provider' });
    if (outcome.kind === 'blocked') {
      expect(outcome.message).toContain('Cursor: runs only reading roles for Auto');
      expect(outcome.message).toContain('Settings › Models');
    }
  });

  it('runs a reading child on Cursor when only Cursor is connected', async () => {
    useAppStore.setState({ providers: [providerInfo({ id: 'cursor' })] });

    const outcome = await resolveFor({ role: 'scout', difficulty: 'standard' });

    expect(outcome).toMatchObject({ kind: 'ready', provider: 'cursor' });
  });

  it('blocks when the conversation is not open', async () => {
    const outcome = await resolveWith({ request: { ...request({}), sessionId: aSession().id } });

    expect(outcome).toMatchObject({ kind: 'blocked', code: 'no_provider' });
  });
});

type RefusalParams = {
  readonly accountId: string;
  readonly modelKey: string;
};

const refusal = ({ accountId, modelKey }: RefusalParams) => ({
  providerId: 'codex' as const,
  accountId,
  modelKey,
  plan: null,
  source: 'refused' as const,
  checkedAt: 0,
});

describe('a helper on a model the account cannot use', () => {
  const ACCOUNT = 'dev@northwind.test';

  const codexPick = async () => {
    const offered = ready({ outcome: await resolve({ difficulty: 'standard' }) });
    const codex = offered.candidates?.find((row) => row.provider === 'codex' && row.cause === null);
    if (codex === undefined) {
      throw new Error('expected a Codex candidate for the implementer');
    }
    return {
      difficulty: 'standard',
      provider: codex.provider,
      model: codex.model,
      effort: codex.effort ?? undefined,
    };
  };

  beforeEach(() => {
    useAppStore.setState({
      providers: [
        providerInfo({ id: 'anthropic' }),
        { ...providerInfo({ id: 'codex' }), identity: ACCOUNT },
        providerInfo({ id: 'cursor' }),
      ],
    });
  });

  it('moves the Lead pick off a model this account was refused', async () => {
    const pick = await codexPick();
    useAppStore.setState({
      unavailableModels: [refusal({ accountId: ACCOUNT, modelKey: pick.model })],
    });

    const outcome = ready({ outcome: await resolve(pick) });

    expect(outcome.model).not.toBe(pick.model);
    expect(outcome.source).toBe('fallback');
    expect(outcome.candidates?.some((row) => row.model === pick.model)).toBe(false);
  });

  it('stays on the same provider and says the model is not on the account', async () => {
    const pick = await codexPick();
    useAppStore.setState({
      unavailableModels: [refusal({ accountId: ACCOUNT, modelKey: pick.model })],
    });

    const outcome = ready({ outcome: await resolve(pick) });

    expect(outcome).toMatchObject({ provider: 'codex', cause: 'no-access' });
    expect(outcome.reason).toMatch(/^.+ is not on your Codex account, so this ran on .+\.$/);
    expect(outcome.reason).not.toMatch(/better|stronger|upgrade/i);
  });

  it('says it once per tree for the same model', async () => {
    const pick = await codexPick();
    useAppStore.setState({
      unavailableModels: [refusal({ accountId: ACCOUNT, modelKey: pick.model })],
    });

    const outcome = ready({
      outcome: await resolveWith({
        request: {
          ...request(pick),
          notedNoAccess: [{ provider: 'codex', model: pick.model }],
        },
      }),
    });

    expect(outcome).toMatchObject({ provider: 'codex', cause: 'no-access' });
    expect(outcome.reason).not.toContain('not on your');
  });

  it('notes a refused model hidden in Settings as hidden, not as missing from the account', async () => {
    const pick = await codexPick();
    useAppStore.setState({
      settings: { [SETTING_HIDDEN_MODELS]: JSON.stringify({ codex: [pick.model] }) },
    });

    const outcome = ready({ outcome: await resolve(pick) });

    expect(outcome.cause).not.toBe('no-access');
    expect(outcome.reason).not.toContain('not on your');
  });

  it('keeps the model for another account on the same provider', async () => {
    const pick = await codexPick();
    useAppStore.setState({
      unavailableModels: [refusal({ accountId: 'ops@acme.test', modelKey: pick.model })],
    });

    const outcome = ready({ outcome: await resolve(pick) });

    expect(outcome).toMatchObject({ provider: 'codex', model: pick.model, source: 'lead' });
  });
});

describe('the Lead picks each helper from the candidates', () => {
  it('starts the helper on the provider and model the Lead picked, with its reason', async () => {
    const offered = ready({ outcome: await resolve({ difficulty: 'standard' }) });
    const codex = offered.candidates?.find((row) => row.provider === 'codex' && row.cause === null);
    if (codex === undefined) {
      throw new Error('expected a Codex candidate for the implementer');
    }

    const outcome = ready({
      outcome: await resolve({
        difficulty: 'standard',
        provider: codex.provider,
        model: codex.model,
        effort: codex.effort ?? undefined,
        modelReason: 'Codex: most room left',
      }),
    });

    expect(outcome).toMatchObject({
      provider: 'codex',
      model: codex.model,
      source: 'lead',
      proposal: 'kept',
      reason: 'Codex: most room left',
    });
  });

  it('moves a writer the Lead sent to Cursor and says what changed', async () => {
    const outcome = ready({
      outcome: await resolve({ provider: 'cursor', model: 'sonnet-5.5', effort: 'medium' }),
    });

    expect(outcome).toMatchObject({ provider: 'anthropic', source: 'fallback', cause: 'writer' });
    expect(outcome.reason).toContain('The Lead asked for Cursor');
    expect(outcome.reason).toContain('agents that write code do not run here yet');
    expect(outcome.reason).toContain('Claude: first in your order');
  });

  it('takes the first provider in your order when the Lead names no model', async () => {
    const outcome = ready({ outcome: await resolve({ difficulty: 'standard' }) });

    expect(outcome).toMatchObject({ provider: 'anthropic', source: 'rule', proposal: 'none' });
    expect(outcome.reason).toBe('Claude: first in your order');
  });

  it('by load, takes the provider with the most room left', async () => {
    useRules({ rules: BY_LOAD });
    useAppStore.setState({ providerStrikes: { anthropic: 0 } });

    const outcome = ready({ outcome: await resolve({ difficulty: 'standard' }) });

    expect(outcome).toMatchObject({ provider: 'codex', source: 'rule' });
    expect(outcome.reason).toBe('Codex: most room left');
  });

  it('never lets the session composer model steer a helper', async () => {
    useAppStore.setState({
      sessions: [{ ...SESSION, modelOverride: 'gpt-6.1-sol', providerOverride: 'codex' }],
    });

    const outcome = ready({ outcome: await resolve({ difficulty: 'standard' }) });

    expect(outcome.provider).toBe('anthropic');
  });

  it('keeps a pinned role on its pin over the Lead pick', async () => {
    useAppStore.setState({
      workspaceOverrides: {
        [WORKSPACE.id]: {
          ...EMPTY_OVERRIDES,
          defaultProviderId: 'anthropic',
          workflowRules: BY_ORDER,
          roleModels: {
            implementer: { providerId: 'anthropic', model: 'sonnet-5.5', effort: 'high' },
          },
        },
      },
    });

    const outcome = ready({
      outcome: await resolve({ provider: 'codex', model: 'gpt-6.1-sol', effort: 'medium' }),
    });

    expect(outcome).toMatchObject({
      provider: 'anthropic',
      model: 'sonnet-5.5',
      source: 'pin',
      proposal: 'replaced',
      cause: 'off-pin',
    });
  });

  it('marks a Lead pick that matches the role pin as the pin', async () => {
    useAppStore.setState({
      workspaceOverrides: {
        [WORKSPACE.id]: {
          ...EMPTY_OVERRIDES,
          defaultProviderId: 'anthropic',
          workflowRules: BY_ORDER,
          roleModels: {
            implementer: { providerId: 'anthropic', model: 'sonnet-5.5', effort: 'high' },
          },
        },
      },
    });

    const outcome = ready({
      outcome: await resolve({ provider: 'anthropic', model: 'sonnet-5.5', effort: 'high' }),
    });

    expect(outcome).toMatchObject({
      provider: 'anthropic',
      model: 'sonnet-5.5',
      source: 'pin',
      proposal: 'kept',
    });
  });

  it('starts the reviewer of a Claude change on another model family', async () => {
    const outcome = ready({
      outcome: await resolveWith({
        request: {
          ...request({ difficulty: 'standard' }),
          role: 'reviewer',
          writerFamily: 'claude',
        },
      }),
    });
    const provider = PROVIDER_IDS.find((candidate) => candidate === outcome.provider) ?? null;

    expect(provider).not.toBeNull();
    expect(provider === null ? 'claude' : modelFamily({ provider, model: outcome.model })).not.toBe(
      'claude',
    );
  });
});

describe('an agent that goes on keeps its model', () => {
  const UNTIL_MS = 60 * 60 * 1000;
  const LOCK = { provider: 'codex', model: 'gpt-6.1-sol', effort: 'medium' } as const;

  it('goes on with the provider and model it had', async () => {
    const outcome = await resolveWith({ request: { ...request({}), agentLock: LOCK } });

    expect(outcome).toMatchObject({ kind: 'ready', ...LOCK, source: 'lock' });
  });

  it('waits while its provider cools down and says until when, never moving', async () => {
    useAppStore.setState({ providerCooldowns: { codex: UNTIL_MS } });

    const outcome = await resolveWith({ request: { ...request({}), agentLock: LOCK } });

    expect(outcome).toMatchObject({ kind: 'blocked', code: 'no_provider' });
    if (outcome.kind === 'blocked') {
      expect(outcome.message).toBe(
        `Codex is cooling down until ${formatClock({ at: UNTIL_MS })}. This agent keeps its model, so send it again then.`,
      );
    }
  });
});

describe('an Auto child when Claude and Codex are at their usage limit', () => {
  const UNTIL_MS = 60 * 60 * 1000;

  beforeEach(() => {
    useAppStore.setState({
      providerCooldowns: { anthropic: UNTIL_MS, codex: UNTIL_MS },
      settings: { ...useAppStore.getState().settings, [SETTING_HIDDEN_MODELS]: OWNER_HIDDEN },
    });
  });

  it('hands every reading role to a visible Cursor model at each difficulty', async () => {
    for (const role of ['scout', 'planner', 'investigator', 'reviewer'] as const) {
      for (const difficulty of DIFFICULTIES) {
        const outcome = ready({ outcome: await resolveFor({ role, difficulty }) });

        expect(outcome.provider).toBe('cursor');
        expect(CURSOR_HIDDEN).not.toContain(outcome.model);
      }
    }
  });

  it('refuses a writing child and names each provider with its reason', async () => {
    for (const difficulty of DIFFICULTIES) {
      const outcome = await resolveFor({ role: 'implementer', difficulty });

      expect(outcome).toMatchObject({ kind: 'blocked', code: 'no_provider' });
      if (outcome.kind === 'blocked') {
        const until = formatClock({ at: UNTIL_MS });
        expect(outcome.message).toContain(`Claude: usage limit until ${until}.`);
        expect(outcome.message).toContain(`Codex: usage limit until ${until}.`);
        expect(outcome.message).toContain('Cursor: runs only reading roles for Auto');
        expect(outcome.message).toContain('Settings › Models');
        expect(outcome.message).not.toContain('routing default');
      }
    }
  });

  it('says Cursor has no visible model when every Cursor model is hidden', async () => {
    useAppStore.setState({
      settings: {
        ...useAppStore.getState().settings,
        [SETTING_HIDDEN_MODELS]: JSON.stringify({
          cursor: MODEL_CATALOGS.cursor.map((model) => model.key),
        }),
      },
    });

    const outcome = await resolveFor({ role: 'planner', difficulty: 'heavy' });

    expect(outcome).toMatchObject({ kind: 'blocked', code: 'no_provider' });
    if (outcome.kind === 'blocked') {
      expect(outcome.message).toContain('Cursor: no visible model.');
    }
  });

  it('goes back to Claude once its usage limit is over', async () => {
    const outcome = await resolveWith({
      request: { ...request({ difficulty: 'standard' }), role: 'planner' },
      nowMs: UNTIL_MS + 1,
    });

    expect(outcome).toMatchObject({ kind: 'ready', provider: 'anthropic' });
  });
});

describe('an Auto child while Claude is near its limit', () => {
  const NOW_MS = Date.parse('2026-11-24T10:00:00.000Z');

  const TIGHT_CLAUDE: ProviderLimits = {
    providerId: 'anthropic',
    plan: 'max',
    status: 'ok',
    windows: [
      {
        kind: 'fiveHour',
        model: null,
        status: 'ok',
        usedFraction: 0.85,
        resetsAt: brandId<IsoDateTime>({ value: new Date(NOW_MS + 3_600_000).toISOString() }),
      },
    ],
    observedAt: brandId<IsoDateTime>({ value: new Date(NOW_MS).toISOString() }),
  };

  type RulesParams = {
    readonly isSpreadOn: boolean;
  };

  const setSpread = ({ isSpreadOn }: RulesParams) =>
    useAppStore.setState({
      workspaceOverrides: {
        [WORKSPACE.id]: {
          ...EMPTY_OVERRIDES,
          defaultProviderId: 'anthropic',
          workflowRules: { ...DEFAULT_WORKFLOW_RULES, spreadByHeadroom: isSpreadOn },
        },
      },
    });

  const resolveNow = () =>
    resolveChildRouting({
      state: useAppStore.getState(),
      request: request({ difficulty: 'standard' }),
      nowMs: NOW_MS,
      turns: [],
    });

  beforeEach(() => {
    useAppStore.setState({ providerLimits: { anthropic: TIGHT_CLAUDE } });
  });

  it('starts a writing helper on Codex while Skip a provider near its limit is on', async () => {
    setSpread({ isSpreadOn: true });

    expect(await resolveNow()).toMatchObject({ kind: 'ready', provider: 'codex' });
  });

  it('skips the session model on a Claude near its limit', async () => {
    setSpread({ isSpreadOn: true });
    useAppStore.setState({ sessions: [{ ...SESSION, modelOverride: 'claude-sonnet-5-5' }] });

    expect(await resolveNow()).toMatchObject({ kind: 'ready', provider: 'codex' });
  });

  it('puts a Claude near its limit behind Codex by order too', async () => {
    setSpread({ isSpreadOn: false });

    expect(await resolveNow()).toMatchObject({ kind: 'ready', provider: 'codex' });
  });
});
