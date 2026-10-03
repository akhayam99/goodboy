// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('../../../../shared/lib/db', async () =>
  (await import('../../../../store/storyHarness')).sqliteDbLibModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { insertDeletedBranch, insertProject, insertWorkspace } from '@goodboy/db';
import type { DeletedBranch, IsoDateTime, Project, Workspace } from '@goodboy/types';
import { aProject, aSession, aWorkspace } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  openStorySqlite,
  resetStoryStore,
  rowsOf,
  storySpies,
  storySqlite,
  stubStoryInvoke,
  type StoryStore,
} from '../../../../store/storyHarness';
import { forgetRepoAutoDeleteCache } from '../../../../store/slices/branch-cleanup/repoDeletesMergedBranches';
import { ToastProvider } from '../../../../shared/components/Toast';
import { pressKey, pressShortcut } from '../../../../__tests__/helpers/pressKey';
import type { ProjectBranch } from '../../../worktree/branchCleanup';
import { BranchesPage } from './index';

const DAY_MS = 24 * 60 * 60 * 1000;
const ROW_CELLS = ['select', 'branch', 'session', 'state', 'origin', 'status', 'age', 'action'];
const nowS = Math.floor(Date.now() / 1000);

let useAppStore: StoryStore;

const HARBORLINE: Workspace = aWorkspace({ name: 'Harborline', slug: 'harborline' });
const LEDGER: Project = aProject({
  workspaceId: HARBORLINE.id,
  name: 'ledger-core',
  rootPath: '/repos/ledger-core',
  kind: 'repo',
});

type BranchPatch = Partial<ProjectBranch>;

const branch = (patch: BranchPatch = {}): ProjectBranch => ({
  name: 'goodboy/ledger-close',
  sha: 'sha-close',
  authorEmail: 'mara@harborline.test',
  lastCommitAt: nowS - 86_400,
  location: 'local-only',
  mergeState: { kind: 'merged-via-pr' },
  behind: null,
  ...patch,
});

const deletedEntry = ({
  id,
  name,
  daysAgo,
}: {
  readonly id: string;
  readonly name: string;
  readonly daysAgo: number;
}): DeletedBranch => ({
  id,
  workspaceId: HARBORLINE.id,
  projectId: LEDGER.id,
  sessionId: null,
  repoRoot: LEDGER.rootPath,
  branch: name,
  sha: `sha-${id}`,
  keepRef: `refs/goodboy/deleted/${id}`,
  onOrigin: false,
  deletedAt: new Date(Date.now() - daysAgo * DAY_MS).toISOString() as IsoDateTime,
  restoredAt: null,
});

type InvokeCall = { readonly command: string; readonly args: unknown };

const invokes = (command: string): ReadonlyArray<InvokeCall> =>
  storySpies.tauriInvoke.mock.calls
    .map(([name, args]) => ({ command: String(name), args }))
    .filter((call) => call.command === command);

const seedBranches = (branches: ReadonlyArray<BranchPatch>) =>
  stubStoryInvoke({
    project_branches: { userEmail: 'mara@harborline.test', branches: branches.map(branch) },
    gh_run: { stdout: '', stderr: '', exitCode: 1 },
    branch_delete_checked: ({ args }: { readonly args: { readonly branch: string } }) => ({
      keepRef: `refs/goodboy/deleted/${args.branch}`,
      deletedOnOrigin: false,
      originError: null,
    }),
    branch_restore: { pushedToOrigin: false, originError: null },
    branch_forget_deleted: null,
  });

const renderPage = () =>
  render(
    <ToastProvider>
      <BranchesPage />
    </ToastProvider>,
  );

const openRecentlyDeleted = async () => {
  fireEvent.click(await screen.findByRole('button', { name: /Recently deleted/ }));
  return screen.getByRole('region', { name: 'Recently deleted' });
};

const deletedRows = async () =>
  rowsOf<{ readonly id: string; readonly restored_at: number | null }>({
    sql: 'SELECT id, restored_at FROM deleted_branches ORDER BY id',
  });

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  forgetRepoAutoDeleteCache();
  const db = await openStorySqlite();
  await insertWorkspace({ db, workspace: HARBORLINE });
  await insertProject({ db, project: LEDGER });
  useAppStore.setState({
    workspaces: [HARBORLINE],
    currentWorkspaceId: HARBORLINE.id,
    projects: [LEDGER],
  });
  seedBranches([branch()]);
});

afterEach(cleanup);

describe('BranchesPage', () => {
  it('keeps a deleted branch after you leave the page and restores it', async () => {
    const db = storySqlite();
    await insertDeletedBranch({
      db,
      entry: deletedEntry({ id: 'del-fee', name: 'goodboy/fee-rounding', daysAgo: 2 }),
    });
    renderPage();
    within(await openRecentlyDeleted()).getByText('goodboy/fee-rounding');
    cleanup();
    useAppStore.setState({ deletedBranches: {} });

    renderPage();
    const group = await openRecentlyDeleted();
    await within(group).findByText('goodboy/fee-rounding');
    expect(within(group).getByText('12 days left')).toBeDefined();
    fireEvent.click(within(group).getByRole('button', { name: 'Restore goodboy/fee-rounding' }));

    await waitFor(() => expect(invokes('branch_restore')).toHaveLength(1));
    expect(invokes('branch_restore')[0]?.args).toEqual({
      args: {
        repoRoot: LEDGER.rootPath,
        branch: 'goodboy/fee-rounding',
        sha: 'sha-del-fee',
        keepRef: 'refs/goodboy/deleted/del-fee',
        pushToOrigin: false,
      },
    });
    await waitFor(() => expect(within(group).queryByText('goodboy/fee-rounding')).toBeNull());
    expect((await deletedRows())[0]?.restored_at).not.toBeNull();
  });

  it('releases the refs of expired deletions when the page opens', async () => {
    const db = storySqlite();
    await insertDeletedBranch({
      db,
      entry: deletedEntry({ id: 'del-old', name: 'goodboy/old-spike', daysAgo: 20 }),
    });
    await insertDeletedBranch({
      db,
      entry: deletedEntry({ id: 'del-new', name: 'goodboy/new-spike', daysAgo: 1 }),
    });
    renderPage();

    await waitFor(() => expect(invokes('branch_forget_deleted')).toHaveLength(1));
    expect(invokes('branch_forget_deleted')[0]?.args).toEqual({
      args: {
        repoRoot: LEDGER.rootPath,
        keepRef: 'refs/goodboy/deleted/del-old',
        sha: 'sha-del-old',
      },
    });
    await waitFor(async () =>
      expect((await deletedRows()).map((row) => row.id)).toEqual(['del-new']),
    );
    const group = await openRecentlyDeleted();
    expect(within(group).queryByText('goodboy/old-spike')).toBeNull();
    within(group).getByText('goodboy/new-spike');
  });

  it('deletes a branch for good only after the inline confirmation', async () => {
    const db = storySqlite();
    await insertDeletedBranch({
      db,
      entry: deletedEntry({ id: 'del-fee', name: 'goodboy/fee-rounding', daysAgo: 2 }),
    });
    renderPage();
    const group = await openRecentlyDeleted();
    fireEvent.click(
      await within(group).findByRole('button', { name: 'Delete goodboy/fee-rounding permanently' }),
    );
    expect(invokes('branch_forget_deleted')).toHaveLength(0);

    fireEvent.click(within(group).getByRole('button', { name: 'Delete permanently' }));

    await waitFor(() => expect(invokes('branch_forget_deleted')).toHaveLength(1));
    await waitFor(async () => expect(await deletedRows()).toEqual([]));
    expect(await screen.findByText('Deleted goodboy/fee-rounding permanently.')).toBeDefined();
  });

  it('deletes a merged branch at once, lists it as recently deleted and undoes it', async () => {
    renderPage();
    const list = screen.getByRole('region', { name: 'Branches' });
    fireEvent.click(await within(list).findByRole('button', { name: 'Delete' }));

    await screen.findByText('Deleted 1 branch. Each one can be restored for 14 days.');
    expect(invokes('branch_delete_checked')).toHaveLength(1);
    expect((await deletedRows()).map((row) => row.restored_at)).toEqual([null]);
    within(await openRecentlyDeleted()).getByText('goodboy/ledger-close');

    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    await waitFor(() => expect(invokes('branch_restore')).toHaveLength(1));
  });

  it('shows only safe branches until you ask for all, and confirms an unmerged delete', async () => {
    seedBranches([
      branch(),
      branch({
        name: 'ines/fx-cache-experiment',
        sha: 'sha-fx',
        mergeState: { kind: 'not-merged', ahead: 5 },
        lastCommitAt: nowS - 40 * 86_400,
        behind: 31,
      }),
    ]);
    renderPage();
    const list = screen.getByRole('region', { name: 'Branches' });
    await within(list).findByText('goodboy/ledger-close');
    expect(within(list).queryByText('ines/fx-cache-experiment')).toBeNull();

    fireEvent.click(screen.getByRole('switch', { name: 'Show all branches' }));
    within(list).getByText('ines/fx-cache-experiment');
    within(list).getByText('Behind main by 31');
    fireEvent.click(within(list).getByRole('button', { name: 'Delete…' }));

    screen.getByRole('group', { name: /Delete 1 branch in ledger-core/ });
    expect(invokes('branch_delete_checked')).toHaveLength(0);
  });

  it('selects every branch in view with the select all key and clears with Escape', async () => {
    seedBranches([branch(), branch({ name: 'goodboy/rates-cache', sha: 'sha-rates' })]);
    renderPage();
    const list = screen.getByRole('region', { name: 'Branches' });
    fireEvent.mouseOver(await within(list).findByText('goodboy/rates-cache'));

    pressShortcut({ id: 'selection.toggle', target: window });
    expect(within(screen.getByRole('toolbar')).getByText('1 selected')).toBeDefined();
    pressShortcut({ id: 'selection.all', target: window });
    expect(within(screen.getByRole('toolbar')).getByText('2 selected')).toBeDefined();

    act(() => {
      pressKey({ code: 'Escape', key: 'Escape', target: window });
    });
    expect(screen.queryByRole('toolbar')).toBeNull();
  });

  it('lays every branch and every deleted branch on the same cells in the same order', async () => {
    const session = aSession({ workspaceId: HARBORLINE.id, goal: 'Reconcile the ledger close' });
    await insertDeletedBranch({
      db: storySqlite(),
      entry: deletedEntry({ id: 'del-fee', name: 'goodboy/fee-rounding', daysAgo: 2 }),
    });
    useAppStore.setState({
      sessions: [session],
      loadProjectBranches: async () => undefined,
      branchScans: {
        [LEDGER.id]: {
          status: 'ready',
          scan: {
            userEmail: 'mara@harborline.test',
            branches: [
              branch(),
              branch({ name: 'theo/spike', sha: 'sha-spike', authorEmail: 'theo@harborline.test' }),
              branch({
                name: 'goodboy/ledger-reconcile-with-a-very-long-branch-name',
                sha: 'sha-long',
                mergeState: { kind: 'merged-via-merge' },
              }),
            ],
          },
          goodboy: [
            {
              projectId: LEDGER.id,
              branch: 'goodboy/ledger-reconcile-with-a-very-long-branch-name',
              sessionId: session.id,
            },
          ],
        },
      },
    });
    renderPage();
    const group = await openRecentlyDeleted();
    await within(group).findByText('goodboy/fee-rounding');
    const list = screen.getByRole('region', { name: 'Branches' });
    within(list).getByRole('button', { name: /Reconcile the ledger close/ });

    const cellsOf = (row: Element) =>
      [...row.children].map((cell) => cell.getAttribute('data-cell'));
    const branchRows = within(list).getAllByRole('listitem');
    const deletedRows = within(group)
      .getAllByRole('listitem')
      .map((item) => item.firstElementChild)
      .filter((row): row is Element => row !== null);

    expect(branchRows).toHaveLength(3);
    expect(deletedRows).toHaveLength(1);
    for (const row of [...branchRows, ...deletedRows]) {
      expect(cellsOf(row)).toEqual(ROW_CELLS);
    }
  });
});
