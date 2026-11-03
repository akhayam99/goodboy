// @vitest-environment happy-dom

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { WorkflowRunId } from '@goodboy/types';
import { brandedId } from '../../../features/history/testing/brandedId';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../storyHarness';

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../storyHarness')).tauriEventModuleMock(),
);
vi.mock('../../../shared/lib/db', async () =>
  (await import('../../storyHarness')).dbLibModuleMock(),
);

const RUN_A = brandedId<WorkflowRunId>({ value: 'run-harborline' });
const RUN_B = brandedId<WorkflowRunId>({ value: 'run-northwind' });

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

describe('orchestrator hint drafts slice', () => {
  it('keeps one draft per run', () => {
    const { setOrchestratorHintDraft } = useAppStore.getState();
    setOrchestratorHintDraft({ workflowRunId: RUN_A, text: 'check the ledger' });
    setOrchestratorHintDraft({ workflowRunId: RUN_B, text: 'skip the retry' });

    expect(useAppStore.getState().orchestratorHintDrafts).toEqual({
      [RUN_A]: 'check the ledger',
      [RUN_B]: 'skip the retry',
    });
  });

  it('drops the entry when the text is emptied', () => {
    const { setOrchestratorHintDraft } = useAppStore.getState();
    setOrchestratorHintDraft({ workflowRunId: RUN_A, text: 'wip' });
    setOrchestratorHintDraft({ workflowRunId: RUN_A, text: '' });

    expect(useAppStore.getState().orchestratorHintDrafts).toEqual({});
  });

  it('leaves state alone when clearing a run with no draft', () => {
    const before = useAppStore.getState().orchestratorHintDrafts;
    useAppStore.getState().setOrchestratorHintDraft({ workflowRunId: RUN_A, text: '' });

    expect(useAppStore.getState().orchestratorHintDrafts).toBe(before);
  });
});
