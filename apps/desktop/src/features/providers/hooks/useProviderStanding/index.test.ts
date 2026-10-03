// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () => (await import('../../../../store/storyHarness')).dbModuleMock());
vi.mock('../../../../shared/lib/db', async () =>
  (await import('../../../../store/storyHarness')).dbLibModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, renderHook } from '@testing-library/react';
import type { IsoDateTime, ProviderId, ProviderLimits, WorkspaceId } from '@goodboy/types';
import { aWorkspace } from '@goodboy/types/testing';
import type { ProviderDisplayInfo } from '../../providers';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../store/storyHarness';
import { useProviderStanding } from './index';

const WORKSPACE = aWorkspace({ id: 'workspace-northwind' as WorkspaceId, name: 'Northwind' });

const providerInfo = ({ id }: { readonly id: ProviderId }): ProviderDisplayInfo => ({
  id,
  binary: id,
  capabilities: { models: [], supportsTools: true, supportsStream: true, supportsCheapModel: true },
  connection: 'connected',
  version: null,
  identity: null,
  label: id,
  error: null,
  docsUrl: '',
});

const inAnHour = new Date(Date.now() + 60 * 60 * 1000).toISOString() as IsoDateTime;

const CODEX_OUT: ProviderLimits = {
  providerId: 'codex',
  plan: null,
  status: 'reached',
  windows: [
    { kind: 'fiveHour', model: null, status: 'reached', usedFraction: 1, resetsAt: inAnHour },
  ],
  observedAt: new Date().toISOString() as IsoDateTime,
};

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  useAppStore.setState({
    workspaces: [WORKSPACE],
    currentWorkspaceId: WORKSPACE.id,
    providers: [
      providerInfo({ id: 'anthropic' }),
      providerInfo({ id: 'codex' }),
      providerInfo({ id: 'cursor' }),
      providerInfo({ id: 'gemini' }),
    ],
    providerLimits: { codex: CODEX_OUT },
    workspaceOverrides: {
      [WORKSPACE.id]: {
        ...WORKSPACE.overrides,
        providerPool: [
          { id: 'anthropic', state: 'on' },
          { id: 'codex', state: 'on' },
          { id: 'cursor', state: 'backup' },
          { id: 'gemini', state: 'off' },
        ],
      },
    },
  });
});

afterEach(cleanup);

const noteFor = ({ provider }: { readonly provider: ProviderId }) =>
  renderHook(() => useProviderStanding({ provider })).result.current;

describe('useProviderStanding', () => {
  it('says nothing for a provider that can take new work', () => {
    expect(noteFor({ provider: 'anthropic' })).toBeNull();
  });

  it('names every reason a provider cannot, or only can as backup', () => {
    expect(noteFor({ provider: 'gemini' })?.text).toBe('Off in this workspace');
    expect(noteFor({ provider: 'cursor' })?.text).toBe('Backup only');
    expect(noteFor({ provider: 'opencode' })?.text).toBe('Not connected');
    expect(noteFor({ provider: 'codex' })?.text).toMatch(/^At limit until \S+/);
  });
});
