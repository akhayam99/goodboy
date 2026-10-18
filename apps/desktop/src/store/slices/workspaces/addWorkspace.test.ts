import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  importStore,
  openStorySqlite,
  resetStoryStore,
  rowsOf,
  STORE_IMPORT_TIMEOUT_MS,
  stubStoryInvoke,
  type StoryStore,
} from '../../storyHarness';

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../storyHarness')).tauriEventModuleMock(),
);
vi.mock('../../../shared/lib/db', async () =>
  (await import('../../storyHarness')).sqliteDbLibModuleMock(),
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

let useAppStore: StoryStore;

type RepoAtParams = {
  readonly path: string;
};

const repoAt = ({ path }: RepoAtParams) => ({
  isRepo: true,
  rootPath: path,
  resolvedPath: path,
  defaultBranch: 'main',
  error: null,
  errorKind: null,
});

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  await openStorySqlite();
  stubStoryInvoke({
    validate_git_repo: ({ path }: RepoAtParams) => repoAt({ path }),
    repo_identity: { rootCommits: [], remoteUrl: null },
  });
});

describe('addWorkspace names the workspace after the picked folder', () => {
  it('humanizes the folder for the workspace and keeps the folder name on disk', async () => {
    const workspace = await useAppStore
      .getState()
      .addWorkspace({ rootPath: '/Users/me/Developer/acme-web' });

    const folders = await rowsOf<{ readonly name: string }>({
      sql: 'SELECT name FROM projects WHERE workspace_id = ?',
      params: [workspace.id],
    });
    expect(workspace.name).toBe('Acme web');
    expect(folders).toEqual([{ name: 'acme-web' }]);
  });

  it('keeps a name the person typed', async () => {
    const workspace = await useAppStore
      .getState()
      .addWorkspace({ rootPath: '/Users/me/Code/ledger_core', name: ' Harborline ' });

    expect(workspace.name).toBe('Harborline');
    expect(useAppStore.getState().projects.map((project) => project.name)).toEqual(['ledger_core']);
  });
});
