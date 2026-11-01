// @vitest-environment happy-dom

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ThreadRead } from '@goodboy/db';
import type { SessionId } from '@goodboy/types';
import { brandedId } from '../../../features/history/testing/brandedId';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  storySpies,
  type StoryStore,
} from '../../storyHarness';

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
vi.mock('../../../features/onboarding/onboardingSettings', async () =>
  (await import('../../storyHarness')).onboardingStoreModuleMock(),
);
vi.mock('../../../features/chat/turn', async () =>
  (await import('../../storyHarness')).turnModuleMock(),
);
vi.mock('../../../features/permissions/permissions', async () =>
  (await import('../../storyHarness')).permissionsModuleMock(),
);
vi.mock('../../../features/providers/providers', async () =>
  (await import('../../storyHarness')).providersModuleMock(),
);
vi.mock('../../../features/providers/routing', async () =>
  (await import('../../storyHarness')).routingModuleMock(),
);
vi.mock('../../../features/budget/budget', async () =>
  (await import('../../storyHarness')).budgetModuleMock(),
);
vi.mock('../../../features/skills/skills', async () =>
  (await import('../../storyHarness')).skillsModuleMock(),
);
vi.mock('../../../features/workflows/workflows', async () =>
  (await import('../../storyHarness')).workflowsModuleMock(),
);
vi.mock('../../../features/worktree/worktree', async () =>
  (await import('../../storyHarness')).worktreeModuleMock(),
);
vi.mock('../../../shared/lib/repo', async () =>
  (await import('../../storyHarness')).repoModuleMock(),
);
vi.mock('../../../shared/lib/editor', async () =>
  (await import('../../storyHarness')).editorModuleMock(),
);
vi.mock('../../../features/plans/plans', async () =>
  (await import('../../storyHarness')).plansModuleMock(),
);
vi.mock('../../../features/integrations/linear/client', async () =>
  (await import('../../storyHarness')).linearClientModuleMock(),
);
vi.mock('../../../features/integrations/github/github', async () =>
  (await import('../../storyHarness')).githubModuleMock(),
);
vi.mock('@goodboy/core', async (importOriginal) =>
  (await import('../../storyHarness')).coreModuleMock(importOriginal),
);
vi.mock('../../../features/scripts/scripts', async () =>
  (await import('../../storyHarness')).scriptsModuleMock(),
);
vi.mock('../../../features/terminal/terminal', async () =>
  (await import('../../storyHarness')).terminalModuleMock(),
);
vi.mock('../../../features/terminal/outputBus', async () =>
  (await import('../../storyHarness')).terminalOutputBusModuleMock(),
);
vi.mock('../../../features/settings/config-export', async () =>
  (await import('../../storyHarness')).configExportModuleMock(),
);

let useAppStore: StoryStore;

const SESSION = brandedId<SessionId>({ value: 'session-harborline' });
const OTHER_SESSION = brandedId<SessionId>({ value: 'session-northwind' });

type Deferred = {
  readonly promise: Promise<ReadonlyArray<ThreadRead>>;
  readonly resolve: (reads: ReadonlyArray<ThreadRead>) => void;
};

const deferred = (): Deferred => {
  let resolve: (reads: ReadonlyArray<ThreadRead>) => void = () => undefined;
  const promise = new Promise<ReadonlyArray<ThreadRead>>((done) => {
    resolve = done;
  });
  return { promise, resolve };
};

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  storySpies.listThreadReads.mockReset();
  storySpies.listThreadReads.mockResolvedValue([]);
  storySpies.markThreadsRead.mockReset();
  storySpies.markThreadsRead.mockResolvedValue(undefined);
});

describe('thread reads', () => {
  it('writes the rows first and shows them as read after the write', async () => {
    const write = deferred();
    storySpies.markThreadsRead.mockImplementation(async () => {
      await write.promise;
    });

    const pending = useAppStore.getState().markThreadsRead({
      sessionId: SESSION,
      threadIds: ['thread-a', 'thread-b'],
    });

    expect(useAppStore.getState().sessionThreadReads[SESSION]).toBeUndefined();
    write.resolve([]);
    await expect(pending).resolves.toBe(true);
    const reads = useAppStore.getState().sessionThreadReads[SESSION] ?? {};
    expect(Object.keys(reads)).toEqual(['thread-a', 'thread-b']);
    expect(storySpies.markThreadsRead).toHaveBeenCalledWith(
      expect.objectContaining({ sessionId: SESSION, threadIds: ['thread-a', 'thread-b'] }),
    );
  });

  it('leaves the thread new, keeps the old reads and reports when the write fails', async () => {
    storySpies.listThreadReads.mockResolvedValue([{ threadId: 'thread-a', readAt: 10 }]);
    await useAppStore.getState().loadThreadReads({ sessionId: SESSION });
    storySpies.markThreadsRead.mockRejectedValue(new Error('disk is full'));

    const isSaved = await useAppStore
      .getState()
      .markThreadsRead({ sessionId: SESSION, threadIds: ['thread-b'] });

    expect(isSaved).toBe(false);
    expect(useAppStore.getState().sessionThreadReads[SESSION]).toEqual({ 'thread-a': 10 });
  });

  it('does not write for an empty snapshot', async () => {
    await expect(
      useAppStore.getState().markThreadsRead({ sessionId: SESSION, threadIds: [] }),
    ).resolves.toBe(true);

    expect(storySpies.markThreadsRead).not.toHaveBeenCalled();
  });

  it('loads the reads of the session it names and no other', async () => {
    storySpies.listThreadReads.mockResolvedValue([{ threadId: 'thread-a', readAt: 10 }]);

    await useAppStore.getState().loadThreadReads({ sessionId: SESSION });

    expect(storySpies.listThreadReads).toHaveBeenCalledWith(
      expect.objectContaining({ sessionId: SESSION }),
    );
    expect(useAppStore.getState().sessionThreadReads[SESSION]).toEqual({ 'thread-a': 10 });
    expect(useAppStore.getState().sessionThreadReads[OTHER_SESSION]).toBeUndefined();
  });

  it('drops a late refresh that answers after a newer one', async () => {
    const first = deferred();
    storySpies.listThreadReads
      .mockImplementationOnce(() => first.promise)
      .mockResolvedValueOnce([{ threadId: 'thread-a', readAt: 30 }]);

    const older = useAppStore.getState().loadThreadReads({ sessionId: SESSION });
    await useAppStore.getState().loadThreadReads({ sessionId: SESSION });
    first.resolve([{ threadId: 'thread-a', readAt: 5 }]);
    await older;

    expect(useAppStore.getState().sessionThreadReads[SESSION]).toEqual({ 'thread-a': 30 });
  });

  it('keeps the old reads when a refresh fails', async () => {
    storySpies.listThreadReads.mockResolvedValueOnce([{ threadId: 'thread-a', readAt: 10 }]);
    await useAppStore.getState().loadThreadReads({ sessionId: SESSION });
    storySpies.listThreadReads.mockRejectedValueOnce(new Error('locked'));

    await useAppStore.getState().loadThreadReads({ sessionId: SESSION });

    expect(useAppStore.getState().sessionThreadReads[SESSION]).toEqual({ 'thread-a': 10 });
  });
});
