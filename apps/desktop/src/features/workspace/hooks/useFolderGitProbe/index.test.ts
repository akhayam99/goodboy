// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import { brandId, type AgentId, type ProjectId, type ProviderRunId } from '@goodboy/types';
import { aProject, aWorkspace, TEST_NOW } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../store/storyHarness';
import { useFolderGitProbe } from './index';

let useAppStore: StoryStore;

const WORKSPACE = aWorkspace({ name: 'Acme web' });
const WEB = aProject({
  id: brandId<ProjectId>({ value: 'project-acme-web' }),
  workspaceId: WORKSPACE.id,
  name: 'acme-web',
  kind: 'folder',
  rootPath: '/work/acme/acme-web',
});
const LEDGER = aProject({
  id: brandId<ProjectId>({ value: 'project-ledger-core' }),
  workspaceId: WORKSPACE.id,
  name: 'ledger-core',
  kind: 'repo',
  rootPath: '/work/acme/ledger-core',
  remoteUrl: 'https://github.com/acme/ledger-core.git',
});
const WRITER = brandId<AgentId>({ value: 'agent-writing' });

const probe = vi.fn(async () => null);

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  probe.mockClear();
  useAppStore.setState({
    workspaces: [WORKSPACE],
    projects: [WEB, LEDGER],
    probeFolderGit: probe,
  });
});

afterEach(cleanup);

describe('useFolderGitProbe', () => {
  it('probes plain folders when the workspace opens and again when a turn ends', () => {
    useAppStore.setState({
      agentTurnState: {
        [WRITER]: {
          kind: 'running',
          runId: brandId<ProviderRunId>({ value: 'run-1' }),
          startedAt: TEST_NOW,
        },
      },
    });
    renderHook(() =>
      useFolderGitProbe({ workspaceId: WORKSPACE.id, isIncludingLocalRepos: false }),
    );

    expect(probe).toHaveBeenCalledTimes(1);
    expect(probe).toHaveBeenCalledWith({ projectId: WEB.id });

    act(() => {
      useAppStore.setState({
        agentTurnState: { [WRITER]: { kind: 'idle', lastActivityAt: TEST_NOW } },
      });
    });

    expect(probe).toHaveBeenCalledTimes(2);
  });

  it('probes again when the window gets focus', () => {
    renderHook(() =>
      useFolderGitProbe({ workspaceId: WORKSPACE.id, isIncludingLocalRepos: false }),
    );

    act(() => {
      window.dispatchEvent(new Event('focus'));
    });

    expect(probe).toHaveBeenCalledTimes(2);
  });
});
