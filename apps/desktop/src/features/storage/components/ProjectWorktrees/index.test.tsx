// @vitest-environment happy-dom

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { insertProject, insertWorkspace } from '@goodboy/db';
import type { AgentId, ProjectId, SessionId, WorkspaceId } from '@goodboy/types';
import { ToastProvider } from '../../../../shared/components/Toast';
import { brandedId } from '../../../history/testing/brandedId';
import { resetWorktreeStatusCache } from '../../../../store/runtime/worktreeStatuses/cache';
import { ObjectMenuProvider } from '../../../actions/components/ObjectMenuProvider';
import { WorkTimeProvider } from '../../../workTreeModel/WorkTimeProvider';
import { CentralColumn } from '../../../session/components/SessionOverviewPane/CentralColumn';
import type { WorktreeFolderFacts } from '../../../worktree/worktree';
import { worktreesChannel } from '../../worktreesChannel';
import {
  buildStoryAgent,
  buildStoryProject,
  buildStoryWorkspace,
  connectedAnthropicState,
  importStore,
  openStorySqlite,
  resetStoryStore,
  STORE_IMPORT_TIMEOUT_MS,
  storySpies,
  stubStoryInvoke,
  type StoryStore,
} from '../../../../store/storyHarness';

const { folderFacts, directorySize, restoreFolder } = vi.hoisted(() => ({
  folderFacts: vi.fn(),
  directorySize: vi.fn(),
  restoreFolder: vi.fn(),
}));

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('../../../../shared/lib/db', async () =>
  (await import('../../../../store/storyHarness')).sqliteDbLibModuleMock(),
);
vi.mock('../../../chat/turn', async () =>
  (await import('../../../../store/storyHarness')).turnModuleMock(),
);
vi.mock('../../../permissions/permissions', async () =>
  (await import('../../../../store/storyHarness')).permissionsModuleMock(),
);
vi.mock('../../../providers/providers', async () =>
  (await import('../../../../store/storyHarness')).providersModuleMock(),
);
vi.mock('../../../providers/routing', async () =>
  (await import('../../../../store/storyHarness')).routingModuleMock(),
);
vi.mock('../../../budget/budget', async () =>
  (await import('../../../../store/storyHarness')).budgetModuleMock(),
);
vi.mock('../../../worktree/worktree', async () => ({
  ...(await import('../../../../store/storyHarness')).worktreeModuleMock(),
  worktreeFolderFacts: folderFacts,
  worktreeDirectorySize: directorySize,
  restoreWorktreeFolder: restoreFolder,
}));
vi.mock('../../../../shared/lib/repo', async () =>
  (await import('../../../../store/storyHarness')).repoModuleMock(),
);
vi.mock('../../../plans/plans', async () =>
  (await import('../../../../store/storyHarness')).plansModuleMock(),
);

const WORKSPACE_ID = brandedId<WorkspaceId>({ value: 'workspace-harborline' });
const PROJECT_ID = brandedId<ProjectId>({ value: 'project-ledger-core' });
const ROOT = '/tmp/ledger-core';
const GOAL = 'Reconcile the ledger export';

const workspace = buildStoryWorkspace({ id: WORKSPACE_ID, name: 'Harborline', slug: 'harborline' });
const project = buildStoryProject({
  id: PROJECT_ID,
  workspaceId: WORKSPACE_ID,
  name: 'ledger-core',
  rootPath: ROOT,
});

type WorktreeParams = {
  readonly slug: string;
};

const worktreeOf = ({ slug }: WorktreeParams) => ({
  worktreePath: `${ROOT}/.goodboy/worktrees/${slug}`,
  branchName: `goodboy/${slug}`,
  slug,
  reused: false,
});

const EXPORT = worktreeOf({ slug: 'ledger-export' });
const ROUNDING = worktreeOf({ slug: 'rounding-drift' });
const MB = 1024 * 1024;

type FactsRequest = {
  readonly requests: ReadonlyArray<{ readonly path: string }>;
};

const factsFor = ({ requests }: FactsRequest): ReadonlyArray<WorktreeFolderFacts> =>
  requests.map(({ path }) => {
    const isDirty = path === ROUNDING.worktreePath;
    return {
      path,
      exists: true,
      isRegistered: true,
      branch: null,
      lastCommitAt: Date.now(),
      localOnlyCommits: 0,
      changedFiles: isDirty ? 2 : 0,
      changedSample: isDirty ? 'src/rounding.rs' : null,
      reasons: isDirty ? ['unstaged-changes'] : [],
      verdict: isDirty ? 'dirty' : 'safe',
    };
  });

let useAppStore: StoryStore;
let sessionId: SessionId;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  const db = await openStorySqlite();
  await insertWorkspace({ db, workspace });
  await insertProject({ db, project });
  stubStoryInvoke({
    workspaces_with_unread: [],
    workflow_list: [],
    gh_run: () => ({ stdout: '', stderr: 'no remote', exitCode: 1 }),
    monitor_snapshot: { listeners: [], processes: [], takenAt: 1, isPlatformSupported: true },
    process_ledger_list: [],
    app_data_usage: {
      folder: '',
      databaseBytes: 0,
      snapshotBytes: 0,
      snapshotCount: 0,
      savedVersionsBytes: 0,
    },
  });
  folderFacts.mockImplementation(async (request: FactsRequest) => factsFor(request));
  directorySize.mockImplementation(async ({ path }: { readonly path: string }) => ({
    path,
    sizeBytes: path === EXPORT.worktreePath ? 300 * MB : 20 * MB,
  }));
  restoreFolder.mockImplementation(async ({ path }: { readonly path: string }) => ({
    kind: 'restored',
    path,
  }));
  storySpies.createWorktree.mockResolvedValueOnce(EXPORT).mockResolvedValueOnce(ROUNDING);
  storySpies.worktreeStatus.mockRejectedValue(new Error('git status is not available'));
  resetWorktreeStatusCache();
  useAppStore.setState({
    workspaces: [workspace],
    currentWorkspaceId: WORKSPACE_ID,
    projects: [project],
    sessions: [],
    archivedSessions: {},
    ...connectedAnthropicState(),
  });
  const { session } = await useAppStore.getState().createSession({
    workspaceId: WORKSPACE_ID,
    projectId: PROJECT_ID,
    goal: GOAL,
  });
  sessionId = session.id;
  await useAppStore.getState().loadSessionMounts({ sessionId });
  const [mount] = useAppStore.getState().sessionMounts[sessionId] ?? [];
  useAppStore.setState({
    sessionPhaseRuns: {
      [sessionId]: [
        buildStoryAgent({
          id: brandedId<AgentId>({ value: 'agent-ledger-export' }),
          sessionId,
          name: 'Implementer',
          status: 'completed',
          ...(mount === undefined ? {} : { mountId: mount.id }),
        }),
      ],
    },
  });
});

afterEach(() => {
  cleanup();
});

const show = async () => {
  const session = useAppStore.getState().sessions.find((entry) => entry.id === sessionId);
  if (session === undefined) {
    throw new Error('the session is gone');
  }
  render(
    <ToastProvider>
      <ObjectMenuProvider>
        <WorkTimeProvider sessionId={session.id} workspaceId={session.workspaceId}>
          <CentralColumn session={session} />
        </WorkTimeProvider>
      </ObjectMenuProvider>
    </ToastProvider>,
  );
  await screen.findByRole('region', { name: 'Projects' });
};

const openSheet = async () => {
  const door = await screen.findByRole('button', { name: /^Worktrees in ledger-core/ });
  await act(async () => {
    fireEvent.click(door);
    await Promise.resolve();
  });
  return screen.findByRole('dialog', { name: 'Worktrees in ledger-core' });
};

const isWorktreeRead = ({ requests }: FactsRequest): boolean =>
  requests.some(({ path }) => path === EXPORT.worktreePath);

const worktreeReads = (): number =>
  folderFacts.mock.calls.filter((call: ReadonlyArray<FactsRequest>) => {
    const [request] = call;
    return request !== undefined && isWorktreeRead(request);
  }).length;

const addSecondWorktree = async () => {
  await useAppStore.getState().forkMount({ sessionId, projectId: PROJECT_ID });
};

describe('the worktrees of a project', () => {
  it('opens from the project block and measures every worktree when the sheet opens', async () => {
    await show();

    const sheet = await openSheet();

    await within(sheet).findByText(EXPORT.branchName);
    await vi.waitFor(() =>
      expect(directorySize).toHaveBeenCalledWith({ path: EXPORT.worktreePath }),
    );
    await within(sheet).findByText('300 MB');
    within(sheet).getByText('Clean');
    within(sheet).getByRole('button', { name: `Open session: ${GOAL}` });
  });

  it('removes only the safe worktrees, names each folder and its size, and Undo brings them back', async () => {
    await addSecondWorktree();
    await show();
    const sheet = await openSheet();
    await within(sheet).findByText('Unsaved changes');
    await within(sheet).findByText('300 MB');

    fireEvent.click(await within(sheet).findByRole('button', { name: 'Remove 1 safe · 300 MB' }));
    const confirm = within(sheet).getByRole('group', { name: 'Remove 1 worktree (300 MB)?' });
    within(confirm).getByText(`${EXPORT.branchName} 300 MB. Branches stay.`);
    await act(async () => {
      fireEvent.click(within(confirm).getByRole('button', { name: 'Remove' }));
      await Promise.resolve();
    });

    await vi.waitFor(() =>
      expect(storySpies.removeWorktreeChecked).toHaveBeenCalledWith(
        expect.objectContaining({ worktreePath: EXPORT.worktreePath }),
      ),
    );
    expect(storySpies.removeWorktreeChecked).not.toHaveBeenCalledWith(
      expect.objectContaining({ worktreePath: ROUNDING.worktreePath }),
    );
    await within(sheet).findByText(/^Removed 1 folder, 300 MB back\.$/);
    await act(async () => {
      fireEvent.click(within(sheet).getByRole('button', { name: 'Undo' }));
      await Promise.resolve();
    });
    await vi.waitFor(() =>
      expect(restoreFolder).toHaveBeenCalledWith({
        repoPath: ROOT,
        path: EXPORT.worktreePath,
        branch: EXPORT.branchName,
      }),
    );
  });

  it('measures only the project worktrees when the sheet opens, never every folder', async () => {
    const original = useAppStore.getState().measureStorageSizes;
    const measure = vi.fn(original);
    useAppStore.setState({ measureStorageSizes: measure });
    await show();

    const sheet = await openSheet();

    await within(sheet).findByText('300 MB');
    expect(measure).toHaveBeenCalledWith({ paths: [EXPORT.worktreePath] });
    expect(measure.mock.calls.every(([params]) => params?.paths !== undefined)).toBe(true);
  });

  it('asks in the row before it removes one worktree', async () => {
    await show();
    const sheet = await openSheet();
    await within(sheet).findByText('300 MB');

    fireEvent.click(
      within(sheet).getByRole('button', { name: `Remove worktree: ${EXPORT.branchName}` }),
    );
    const ask = within(sheet).getByRole('group', { name: 'Remove this folder?' });
    within(ask).getByText(`300 MB goes away from disk. The branch ${EXPORT.branchName} stays.`);
    fireEvent.click(within(ask).getByRole('button', { name: 'Cancel' }));

    expect(within(sheet).queryByRole('group', { name: 'Remove this folder?' })).toBeNull();
    expect(storySpies.removeWorktreeChecked).not.toHaveBeenCalled();
  });

  it('keeps only the list and the cleanup in the sheet, with New branch on the project head', async () => {
    await show();
    const sheet = await openSheet();

    expect(within(sheet).queryByRole('button', { name: /^New branch/ })).toBeNull();
    within(sheet).getByRole('button', { name: 'Clean up in Storage' });
  });

  it('drops a late reading of the worktrees when a newer one already landed', async () => {
    let answerLate: ((facts: ReadonlyArray<WorktreeFolderFacts>) => void) | null = null;
    let isDeferred = false;
    folderFacts.mockImplementation(async (request: FactsRequest) => {
      const isWorktreeRead = request.requests.some(({ path }) => path === EXPORT.worktreePath);
      if (!isWorktreeRead || isDeferred) {
        return factsFor(request);
      }
      isDeferred = true;
      return new Promise<ReadonlyArray<WorktreeFolderFacts>>((resolve) => {
        answerLate = resolve;
      });
    });
    await show();
    await openSheet();
    const door = screen.getByRole('button', { name: /^Worktrees in ledger-core/ });
    fireEvent.click(door);
    const sheet = await openSheet();
    await within(sheet).findByText('Clean');

    expect(answerLate).not.toBeNull();
    await act(async () => {
      answerLate?.(
        factsFor({ requests: [{ path: ROUNDING.worktreePath }] }).map((fact) => ({
          ...fact,
          path: EXPORT.worktreePath,
        })),
      );
      await Promise.resolve();
    });

    within(sheet).getByText('Clean');
    expect(within(sheet).queryByText('Unsaved changes')).toBeNull();
  });

  it('keeps the closed block count current when a branch control adds a worktree', async () => {
    const announce = vi.spyOn(worktreesChannel, 'announce');
    await show();
    await screen.findByRole('button', { name: /^Worktrees in ledger-core/ });
    const sized = directorySize.mock.calls.length;

    await act(async () => {
      await addSecondWorktree();
    });

    expect(announce).toHaveBeenCalledWith({ repoRoots: [ROOT] });
    await screen.findByRole('button', { name: /^Worktrees in ledger-core: 2 worktrees/ });
    expect(directorySize.mock.calls.length).toBe(sized);
    announce.mockRestore();
  });

  it('reads the worktrees again when another window changes them', async () => {
    const follow = vi.spyOn(worktreesChannel, 'listen');
    await show();
    const sheet = await openSheet();
    await within(sheet).findByText('Clean');
    const [subscription] = follow.mock.calls.at(-1) ?? [];
    if (subscription === undefined) {
      throw new Error('the sheet must follow the other windows');
    }
    const reads = worktreeReads();

    await act(async () => {
      subscription.onChange({ repoRoots: ['/tmp/notify-relay'] });
      subscription.onChange({ repoRoots: [ROOT] });
      await Promise.resolve();
    });

    await vi.waitFor(() => expect(worktreeReads()).toBe(reads + 1));
    follow.mockRestore();
  });
});
