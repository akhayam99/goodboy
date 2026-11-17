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
import { MODEL_CATALOGS, getCapabilities } from '@goodboy/core/providers';
import { isAutoChildProvider, type AutoDelegationRole } from '@goodboy/core/auto';
import type { ProviderId } from '@goodboy/types';
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

const request = (fields: Record<string, unknown>) => ({
  sessionId: SESSION.id,
  role: 'implementer' as const,
  fields,
  promptText: 'add the ledger export to ledger-core',
});

const resolve = (fields: Record<string, unknown>) =>
  resolveChildRouting({ state: useAppStore.getState(), request: request(fields), nowMs: 0 });

type ResolveForParams = {
  readonly role: AutoDelegationRole;
  readonly difficulty: string;
};

const resolveFor = ({ role, difficulty }: ResolveForParams) =>
  resolveChildRouting({
    state: useAppStore.getState(),
    request: { ...request({ difficulty }), role },
    nowMs: 0,
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
    workspaceOverrides: {
      [WORKSPACE.id]: { ...EMPTY_OVERRIDES, defaultProviderId: 'anthropic' },
    },
  });
});

describe('the model an Auto child runs on', () => {
  it('resolves a role to a model the app can confine', () => {
    const outcome = resolve({});

    expect(outcome.kind).toBe('ready');
    if (outcome.kind === 'ready') {
      expect(isAutoChildProvider({ provider: outcome.provider, role: 'implementer' })).toBe(true);
      expect(outcome.reason.length).toBeGreaterThan(0);
    }
  });

  it('runs the child on the model its preset step pinned', () => {
    const pick = { provider: 'codex', model: 'gpt-5.5', effort: 'high' } as const;
    const outcome = resolveChildRouting({
      state: useAppStore.getState(),
      request: { ...request({}), stepLock: { version: 1, pick, origin: 'user' } },
      nowMs: 0,
    });

    expect(outcome).toMatchObject({ kind: 'ready', ...pick });
  });

  it('never hands a writing child to Cursor or Gemini, even when Auto proposes one', () => {
    for (const provider of ['cursor', 'gemini']) {
      const outcome = resolve({ provider, model: 'composer-2.5', effort: 'medium' });

      expect(outcome.kind).toBe('ready');
      if (outcome.kind === 'ready') {
        expect(isAutoChildProvider({ provider: outcome.provider, role: 'implementer' })).toBe(true);
        expect(outcome.proposal).not.toBe('kept');
      }
    }
  });

  it('keeps to the providers the workspace left on', () => {
    useAppStore.setState({
      workspaceOverrides: {
        [WORKSPACE.id]: {
          ...EMPTY_OVERRIDES,
          defaultProviderId: 'anthropic',
          providerPool: [
            { id: 'anthropic', state: 'off' },
            { id: 'codex', state: 'on' },
            { id: 'cursor', state: 'on' },
          ],
        },
      },
    });

    const outcome = resolve({ provider: 'anthropic', model: 'sonnet', effort: 'medium' });

    expect(outcome.kind).toBe('ready');
    if (outcome.kind === 'ready') {
      expect(outcome.provider).toBe('codex');
    }
  });

  it('blocks a writing child when only Cursor is connected, and says why', () => {
    useAppStore.setState({ providers: [providerInfo({ id: 'cursor' })] });

    const outcome = resolve({});

    expect(outcome).toMatchObject({ kind: 'blocked', code: 'no_provider' });
    if (outcome.kind === 'blocked') {
      expect(outcome.message).toContain('Cursor: runs only reading roles for Auto');
      expect(outcome.message).toContain('Settings › Models');
    }
  });

  it('runs a reading child on Cursor when only Cursor is connected', () => {
    useAppStore.setState({ providers: [providerInfo({ id: 'cursor' })] });

    const outcome = resolveFor({ role: 'scout', difficulty: 'standard' });

    expect(outcome).toMatchObject({ kind: 'ready', provider: 'cursor' });
  });

  it('blocks when the conversation is not open', () => {
    const outcome = resolveChildRouting({
      state: useAppStore.getState(),
      request: { ...request({}), sessionId: aSession().id },
      nowMs: 0,
    });

    expect(outcome).toMatchObject({ kind: 'blocked', code: 'no_provider' });
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

  it('hands every reading role to a visible Cursor model at each difficulty', () => {
    for (const role of ['scout', 'planner', 'investigator', 'reviewer'] as const) {
      for (const difficulty of DIFFICULTIES) {
        const outcome = resolveFor({ role, difficulty });

        expect(outcome).toMatchObject({ kind: 'ready', provider: 'cursor' });
        if (outcome.kind === 'ready') {
          expect(CURSOR_HIDDEN).not.toContain(outcome.model);
        }
      }
    }
  });

  it('refuses a writing child and names each provider with its reason', () => {
    for (const difficulty of DIFFICULTIES) {
      const outcome = resolveFor({ role: 'implementer', difficulty });

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

  it('says Cursor has no visible model when every Cursor model is hidden', () => {
    useAppStore.setState({
      settings: {
        ...useAppStore.getState().settings,
        [SETTING_HIDDEN_MODELS]: JSON.stringify({
          cursor: MODEL_CATALOGS.cursor.map((model) => model.key),
        }),
      },
    });

    const outcome = resolveFor({ role: 'planner', difficulty: 'heavy' });

    expect(outcome).toMatchObject({ kind: 'blocked', code: 'no_provider' });
    if (outcome.kind === 'blocked') {
      expect(outcome.message).toContain('Cursor: no visible model.');
    }
  });

  it('goes back to Claude once its usage limit is over', () => {
    const outcome = resolveChildRouting({
      state: useAppStore.getState(),
      request: { ...request({ difficulty: 'standard' }), role: 'planner' },
      nowMs: UNTIL_MS + 1,
    });

    expect(outcome).toMatchObject({ kind: 'ready', provider: 'anthropic' });
  });
});
