// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { act, renderHook } from '@testing-library/react';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProviderConnectionState, ProviderId } from '@goodboy/types';
import { aWorkspace } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../store/storyHarness';
import type { ProviderDisplayInfo } from '../../providers';
import { useResolution } from './index';

const WORKSPACE = aWorkspace({ name: 'Harborline' });

const providerInfo = ({
  id,
  connection,
}: {
  readonly id: ProviderId;
  readonly connection: ProviderConnectionState;
}): ProviderDisplayInfo => ({
  id,
  binary: id,
  capabilities: { models: [], supportsTools: true, supportsStream: true, supportsCheapModel: true },
  connection,
  version: null,
  identity: null,
  label: id,
  error: null,
  docsUrl: '',
});

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  useAppStore.setState({
    workspaces: [WORKSPACE],
    providers: [
      providerInfo({ id: 'anthropic', connection: 'connected' }),
      providerInfo({ id: 'codex', connection: 'connected' }),
    ],
  });
});

describe('useResolution', () => {
  it('returns the same object while nothing it reads changes', () => {
    const { result, rerender } = renderHook(() =>
      useResolution({ role: 'planner', workspaceId: WORKSPACE.id }),
    );
    const first = result.current;

    rerender();
    act(() => useAppStore.setState({ currentWorkspaceId: WORKSPACE.id }));

    expect(result.current).toBe(first);
  });

  it('follows the provider policy the moment it is saved', () => {
    const { result } = renderHook(() =>
      useResolution({ role: 'planner', workspaceId: WORKSPACE.id }),
    );
    expect(result.current.provider).toBe('anthropic');

    act(() =>
      useAppStore.setState({
        workspaceOverrides: {
          [WORKSPACE.id]: { ...WORKSPACE.overrides, providerPool: [{ id: 'codex', state: 'on' }] },
        },
      }),
    );

    expect(result.current).toMatchObject({ provider: 'codex', defaultProvider: 'codex' });
  });

  it('reads a task slot the same way as a role slot', () => {
    const { result } = renderHook(() =>
      useResolution({ task: 'summarizer', workspaceId: WORKSPACE.id, isAutoOnly: true }),
    );

    expect(result.current.slot).toEqual({ kind: 'task', id: 'summarizer' });
    expect(result.current.source).toBe('auto');
  });
});
