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
import { getCapabilities, isAutoChildProvider } from '@goodboy/core';
import type { ProviderId } from '@goodboy/types';
import { EMPTY_OVERRIDES, aSession, aWorkspace } from '@goodboy/types/testing';
import type { ProviderDisplayInfo } from '../../../features/providers/providers';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  stubStoryInvoke,
  type StoryStore,
} from '../../storyHarness';
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
      expect(isAutoChildProvider({ provider: outcome.provider })).toBe(true);
      expect(outcome.reason.length).toBeGreaterThan(0);
    }
  });

  it('never picks Cursor or Gemini, even when Auto proposes one', () => {
    for (const provider of ['cursor', 'gemini']) {
      const outcome = resolve({ provider, model: 'composer-2.5', effort: 'medium' });

      expect(outcome.kind).toBe('ready');
      if (outcome.kind === 'ready') {
        expect(isAutoChildProvider({ provider: outcome.provider })).toBe(true);
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

  it('blocks when no model Auto may use is connected', () => {
    useAppStore.setState({ providers: [providerInfo({ id: 'cursor' })] });

    const outcome = resolve({});

    expect(outcome).toMatchObject({ kind: 'blocked' });
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
