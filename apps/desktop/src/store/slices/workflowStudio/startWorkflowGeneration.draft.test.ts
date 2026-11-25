// @vitest-environment node
vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () => (await import('../../storyHarness')).dbModuleMock());
vi.mock('../../../shared/lib/db', async () =>
  (await import('../../storyHarness')).dbLibModuleMock(),
);
vi.mock('../../../features/workflows/workflows', async () =>
  (await import('../../storyHarness')).workflowsModuleMock(),
);

const generated = vi.hoisted(() => ({
  result: {
    name: 'Generated name',
    description: 'Generated description',
    goal: 'Ship the change',
    steps: [
      {
        role: 'reviewer',
        name: 'Review',
        promptPrefix: 'Review the change',
        expectedOutput: 'Review findings',
      },
    ],
  },
}));

vi.mock('@goodboy/core/workflows', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@goodboy/core/workflows')>();
  return { ...actual, formatWorkflowFromNL: async () => generated.result };
});

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { brandId, type WorkflowId } from '@goodboy/types';
import { aWorkspace } from '@goodboy/types/testing';
import { blankWorkflowDraft } from '../../../features/workflows/engine/blankWorkflowDraft';
import {
  STORE_IMPORT_TIMEOUT_MS,
  emptyOverrides,
  importStore,
  resetStoryStore,
  storySpies,
  type StoryStore,
} from '../../storyHarness';

const WORKSPACE = aWorkspace();

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  storySpies.invokeWorkflowList.mockImplementation(async () => []);
  useAppStore.setState({
    workspaces: [WORKSPACE],
    providers: [],
    workspaceOverrides: { [WORKSPACE.id]: emptyOverrides },
  });
});

const form = {
  ...blankWorkflowDraft(),
  name: 'Fix a flaky test',
  description: 'A test fails some of the time',
  entryCheck: 'Run it ten times',
  stopRule: 'It never fails',
  isOrderKept: true,
};

describe('drafting the steps of a workflow with a form', () => {
  it('writes nothing for a workflow that is not created yet and hands the steps back', async () => {
    const isAccepted = await useAppStore.getState().startWorkflowGeneration({
      workspaceId: WORKSPACE.id,
      description: 'A test fails some of the time. Run it ten times',
      workflow: null,
      form,
      isDraftOnly: true,
    });

    expect(isAccepted).toBe(true);
    expect(storySpies.invokeWorkflowUpsert).not.toHaveBeenCalled();
    expect(useAppStore.getState().workflowGenerations[WORKSPACE.id]).toMatchObject({
      status: 'drafted',
      name: 'Generated name',
      steps: [expect.objectContaining({ name: 'Review', role: 'reviewer' })],
    });
  });

  it('saves the draft with the words and the guide fields of the form when it is not draft only', async () => {
    const id = brandId<WorkflowId>({ value: 'wf-9' });
    storySpies.invokeWorkflowUpsert.mockImplementation(async (args) => ({
      ...args,
      id,
      steps: [],
      createdAt: brandId({ value: '2026-10-01T10:00:00.000Z' }),
      updatedAt: brandId({ value: '2026-10-01T10:00:00.000Z' }),
    }));

    await useAppStore.getState().startWorkflowGeneration({
      workspaceId: WORKSPACE.id,
      description: 'A test fails some of the time. Run it ten times',
      workflow: null,
      form,
    });

    expect(storySpies.invokeWorkflowUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        description: 'A test fails some of the time',
        entryCheck: 'Run it ten times',
        stopRule: 'It never fails',
        thenSuggestId: null,
        isOrderKept: true,
      }),
    );
  });
});
