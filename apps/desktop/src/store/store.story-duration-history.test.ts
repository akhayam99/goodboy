import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { brandId } from '@goodboy/types';
import type { WorkspaceId } from '@goodboy/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStorySpies,
  stubStoryInvoke,
  type StoryStore,
} from './storyHarness';

const spans = vi.hoisted(() => ({
  listWorkspaceTurnSpans: vi.fn(),
}));

vi.mock('@tauri-apps/api/core', async () => (await import('./storyHarness')).tauriCoreModuleMock());
vi.mock('@tauri-apps/api/event', async () =>
  (await import('./storyHarness')).tauriEventModuleMock(),
);
vi.mock('../shared/lib/db', async () => (await import('./storyHarness')).dbLibModuleMock());
vi.mock('@goodboy/db', async () =>
  (await import('./storyHarness')).dbModuleMock({
    listWorkspaceTurnSpans: spans.listWorkspaceTurnSpans,
  }),
);

const WORKSPACE_ID = brandId<WorkspaceId>({ value: 'workspace-estimates' });

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(() => {
  resetStorySpies();
  stubStoryInvoke({});
  spans.listWorkspaceTurnSpans.mockReset();
  useAppStore.setState({ workspaceDurationHistory: {} });
});

describe('story: the plan estimate history loads for the workspace on screen', () => {
  it('drops an older load that answers after a newer one', async () => {
    let releaseOlder: () => void = () => undefined;
    spans.listWorkspaceTurnSpans
      .mockImplementationOnce(
        () =>
          new Promise<ReadonlyArray<never>>((resolve) => {
            releaseOlder = () => resolve([]);
          }),
      )
      .mockResolvedValueOnce([]);
    let writes = 0;
    const stop = useAppStore.subscribe((state, previous) => {
      if (state.workspaceDurationHistory !== previous.workspaceDurationHistory) {
        writes += 1;
      }
    });

    const older = useAppStore
      .getState()
      .loadWorkspaceDurationHistory({ workspaceId: WORKSPACE_ID });
    await useAppStore.getState().loadWorkspaceDurationHistory({ workspaceId: WORKSPACE_ID });
    expect(writes).toBe(1);

    releaseOlder();
    await older;
    stop();

    expect(writes).toBe(1);
    expect(useAppStore.getState().workspaceDurationHistory[WORKSPACE_ID]).toBeDefined();
  });
});
