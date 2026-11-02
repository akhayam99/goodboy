// @vitest-environment happy-dom

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  storySpies,
  type StoryStore,
} from '../../storyHarness';
import { brandId, type WorkspaceId } from '@goodboy/types';
import type { WorkspaceAttentionRow } from '../../../features/workflows/workflows';

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
vi.mock('../../../features/settings/config-export', async () =>
  (await import('../../storyHarness')).configExportModuleMock(),
);

const NORTHWIND = brandId<WorkspaceId>({ value: 'ws-northwind' });
const CASCADIA = brandId<WorkspaceId>({ value: 'ws-cascadia' });

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(() => {
  vi.clearAllMocks();
});

const rowOf = (overrides: Partial<WorkspaceAttentionRow>): WorkspaceAttentionRow => ({
  workspaceId: NORTHWIND,
  count: 2,
  tone: 'warning',
  reasons: ['open-question'],
  ...overrides,
});

describe('refreshWorkspaceAttention', () => {
  it('keeps the count of each workspace with the words of its reasons', async () => {
    storySpies.invokeWorkspacesAttention.mockResolvedValueOnce([
      rowOf({}),
      rowOf({
        workspaceId: CASCADIA,
        count: 1,
        tone: 'danger',
        reasons: ['ci-failed'],
      }),
    ]);

    await useAppStore.getState().refreshWorkspaceAttention();

    expect(useAppStore.getState().attentionFromDatabase).toEqual({
      [NORTHWIND]: { count: 2, tone: 'warning', reasonWords: ['1 question for you'] },
      [CASCADIA]: { count: 1, tone: 'danger', reasonWords: ['Checks failing'] },
    });
  });

  it('forgets a workspace that no longer waits on you', async () => {
    storySpies.invokeWorkspacesAttention.mockResolvedValueOnce([rowOf({})]);
    await useAppStore.getState().refreshWorkspaceAttention();

    storySpies.invokeWorkspacesAttention.mockResolvedValueOnce([]);
    await useAppStore.getState().refreshWorkspaceAttention();

    expect(useAppStore.getState().attentionFromDatabase).toEqual({});
  });

  it('keeps the old counts and hands the error back when the read fails', async () => {
    storySpies.invokeWorkspacesAttention.mockResolvedValueOnce([rowOf({})]);
    await useAppStore.getState().refreshWorkspaceAttention();
    storySpies.invokeWorkspacesAttention.mockRejectedValueOnce(new Error('database is locked'));

    await expect(useAppStore.getState().refreshWorkspaceAttention()).rejects.toThrow(
      'database is locked',
    );

    expect(useAppStore.getState().attentionFromDatabase[NORTHWIND]?.count).toBe(2);
  });

  it('drops a late answer for an older request', async () => {
    let answerFirst: (rows: ReadonlyArray<WorkspaceAttentionRow>) => void = () => undefined;
    storySpies.invokeWorkspacesAttention.mockImplementationOnce(
      () => new Promise((resolve) => (answerFirst = resolve)),
    );
    storySpies.invokeWorkspacesAttention.mockResolvedValueOnce([rowOf({ count: 1 })]);

    const first = useAppStore.getState().refreshWorkspaceAttention();
    await useAppStore.getState().refreshWorkspaceAttention();
    answerFirst([rowOf({ count: 9 })]);
    await first;

    expect(useAppStore.getState().attentionFromDatabase[NORTHWIND]?.count).toBe(1);
  });

  it('leaves the reports of windows alone', async () => {
    useAppStore.getState().setWindowAttention({
      report: { workspaceId: CASCADIA, count: 3, tone: 'danger', reasonWords: [] },
    });
    storySpies.invokeWorkspacesAttention.mockResolvedValueOnce([rowOf({})]);

    await useAppStore.getState().refreshWorkspaceAttention();

    expect(useAppStore.getState().attentionFromWindows[CASCADIA]?.count).toBe(3);
  });
});

describe('setWindowAttention', () => {
  it('keeps a report per workspace', () => {
    const { setWindowAttention } = useAppStore.getState();

    setWindowAttention({
      report: { workspaceId: NORTHWIND, count: 2, tone: 'warning', reasonWords: ['a'] },
    });
    setWindowAttention({
      report: { workspaceId: CASCADIA, count: 0, tone: null, reasonWords: [] },
    });

    expect(useAppStore.getState().attentionFromWindows).toEqual({
      [NORTHWIND]: { count: 2, tone: 'warning', reasonWords: ['a'] },
      [CASCADIA]: { count: 0, tone: 'warning', reasonWords: [] },
    });
  });

  it('does not change the state for a report that says what it said before', () => {
    const { setWindowAttention } = useAppStore.getState();
    const report = {
      workspaceId: NORTHWIND,
      count: 2,
      tone: 'warning' as const,
      reasonWords: ['a'],
    };
    setWindowAttention({ report });
    const before = useAppStore.getState().attentionFromWindows;

    setWindowAttention({ report: { ...report } });

    expect(useAppStore.getState().attentionFromWindows).toBe(before);
  });
});
