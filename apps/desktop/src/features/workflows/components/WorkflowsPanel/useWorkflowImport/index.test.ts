// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../test/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../test/storyHarness')).tauriEventModuleMock(),
);
vi.mock('../../../workflows', async () =>
  (await import('../../../../../test/storyHarness')).workflowsModuleMock(),
);

import { act, renderHook } from '@testing-library/react';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Workflow } from '@goodboy/types';
import { aWorkspace } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  storySpies,
  type StoryStore,
} from '../../../../../test/storyHarness';
import { workflowIdOf } from '../../../../../__tests__/helpers/brandedIds';
import { workflowFixture } from '../../../../../__tests__/helpers/actionFixtures';
import { useWorkflowImport } from './index';

const ACME = aWorkspace({ name: 'Acme', slug: 'acme' });
const NORTHWIND = aWorkspace({ name: 'Northwind', slug: 'northwind' });
const CASCADIA = aWorkspace({ name: 'Cascadia', slug: 'cascadia' });

type WorkflowParams = {
  readonly id: string;
};

const workflow = ({ id }: WorkflowParams): Workflow => ({
  ...workflowFixture(),
  id: workflowIdOf({ value: id }),
  name: id,
});

const flush = async () => {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
};

let useAppStore: StoryStore;

describe('useWorkflowImport retry', () => {
  beforeAll(async () => {
    useAppStore = await importStore();
  }, STORE_IMPORT_TIMEOUT_MS);

  beforeEach(async () => {
    await resetStoryStore();
    useAppStore.setState({ workspaces: [ACME, NORTHWIND, CASCADIA], projects: [] });
  });

  it('retries one failed workspace and keeps the other groups and their selection', async () => {
    storySpies.invokeWorkflowList
      .mockResolvedValueOnce([workflow({ id: 'wf-north' })])
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce([workflow({ id: 'wf-cascadia' })]);
    const { result } = renderHook(() => useWorkflowImport({ workspaceId: ACME.id }));

    act(() => {
      result.current.load();
    });
    await flush();
    act(() => {
      result.current.toggle(workflowIdOf({ value: 'wf-north' }));
    });
    expect(result.current.groups.map((group) => group.status)).toEqual(['ready', 'failed']);

    act(() => {
      result.current.retry({ workspaceId: CASCADIA.id });
    });
    expect(result.current.groups.map((group) => group.status)).toEqual(['ready', 'loading']);
    await flush();

    expect(result.current.groups.map((group) => group.status)).toEqual(['ready', 'ready']);
    expect([...result.current.selected]).toEqual(['wf-north']);
    expect(result.current.groups[0]?.workflows).toHaveLength(1);
    expect(result.current.groups[1]?.workflows).toHaveLength(1);
  });
});
