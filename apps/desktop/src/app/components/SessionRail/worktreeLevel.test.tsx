// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () => (await import('../../../store/storyHarness')).dbModuleMock());
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn(async () => null) }));
vi.mock('../../../shared/lib/db', async () =>
  (await import('../../../store/storyHarness')).dbLibModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { brandId } from '@goodboy/types';
import type {
  IsoDateTime,
  MountId,
  Project,
  PullRequestState,
  WorktreeStatus,
} from '@goodboy/types';
import type { GitlabMergeRequest } from '../../../features/integrations/gitlab/client';
import type { MountGitlabMrState } from '../../../store/slices/gitlab-mr/state';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  stubStoryInvoke,
  type StoryStore,
} from '../../../store/storyHarness';
import { branchPlace, sessionPlace } from '../../../store/slices/navigation/place';
import { resetWorktreeStatusCache } from '../../../store/slices/worktreeStatuses/cache';
import { ToastProvider } from '../../../shared/components/Toast';
import { worktreeStatusOf } from '../../../test/worktreeStatusOf';
import { STORAGE_KEYS } from '../../../shared/lib/storage-keys';
import {
  ledgerCore,
  mountGithubOf,
  mountOf,
  paymentsApi,
  seedColumn,
  sessionOf,
} from '../../../features/workspace/testing/sessionColumn';
import { SessionRail } from './index';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { runObjectAction } from '../../../features/actions/registry';

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  resetWorktreeStatusCache();
  localStorage.clear();
});

afterEach(cleanup);

const session = sessionOf({
  goal: 'Stop retried webhooks',
  lastOpenedAt: '2026-10-06T09:00:00.000Z',
});
const sessionId = session.id;
const mount = mountOf({ session, project: paymentsApi });

type SeedParams = {
  readonly status: WorktreeStatus;
};

const seed = ({ status }: SeedParams) => {
  seedColumn({
    store: useAppStore,
    sessions: [session],
    currentSessionId: sessionId,
    mounts: [[session, paymentsApi]],
  });
  useAppStore.setState({ sessionBranches: { [sessionId]: mount.branch } });
  stubStoryInvoke({
    worktree_status: () => status,
    worktree_remote_url: () => 'git@github.com:harborline/payments-api.git',
    detect_editors: () => [],
  });
};

const settle = async (): Promise<void> => {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
};

const mountRail = async (): Promise<void> => {
  render(
    <ToastProvider>
      <SessionRail session={session} />
    </ToastProvider>,
  );
  await settle();
};

const openWorktree = async (): Promise<void> => {
  act(() => {
    useAppStore
      .getState()
      .navigate({ to: branchPlace({ sessionId, mountPath: mount.worktreePath, tab: 'files' }) });
  });
  await settle();
};

const worktreeLayer = (): HTMLElement => {
  const layer = document.querySelector<HTMLElement>('[data-level-layer="worktree"]:not([inert])');
  if (layer === null) {
    throw new Error('the sidebar is not on the worktree level');
  }
  return layer;
};

const ledgerMount = mountOf({ session, project: ledgerCore });

const FOLDER: Project['kind'] = 'folder';

const seedTwoProjects = ({ status }: SeedParams) => {
  seed({ status });
  useAppStore.setState({
    sessionProjectMounts: { [sessionId]: [mount, ledgerMount] },
    mountGithub: {
      [mount.mountId]: mountGithubOf({ mount, number: 418 }),
      [ledgerMount.mountId]: mountGithubOf({ mount: ledgerMount, number: 77 }),
    },
  });
  useAppStore.getState().navigate({ to: sessionPlace({ sessionId }) });
};

type PatchParams = {
  readonly mountId: MountId;
  readonly patch: Partial<PullRequestState>;
};

const patchRequest = ({ mountId, patch }: PatchParams) => {
  const current = useAppStore.getState().mountGithub[mountId];
  if (current === undefined || current.pr === null) {
    throw new Error('the mount has no pull request');
  }
  useAppStore.setState((state) => ({
    mountGithub: {
      ...state.mountGithub,
      [mountId]: { ...current, pr: { ...current.pr, ...patch } },
    },
  }));
};

const projectRows = (name: string): HTMLElement =>
  screen.getByRole('list', { name: `${name} worktrees` });

const statusLine = (): HTMLElement => {
  const line = worktreeLayer().querySelector<HTMLElement>('[data-worktree-status]');
  if (line === null) {
    throw new Error('the worktree level shows no status line');
  }
  return line;
};

const worktreeButton = (list: HTMLElement): HTMLElement => {
  const [first] = within(list).getAllByRole('button');
  if (first === undefined) {
    throw new Error('no worktree row');
  }
  return first;
};

describe('the worktree level', () => {
  it('drills in from a worktree row and goes back to the session Overview with its back row', async () => {
    seed({ status: worktreeStatusOf({}) });
    useAppStore.getState().navigate({ to: sessionPlace({ sessionId }) });
    await mountRail();

    const rows = await screen.findByRole('list', { name: 'payments-api worktrees' });
    fireEvent.click(worktreeButton(rows));
    await settle();

    const identity = within(worktreeLayer()).getByText('payments-api');
    expect(identity).toBeDefined();
    expect(worktreeLayer().textContent).toContain(mount.branch);
    expect(useAppStore.getState().activeLens[sessionId]).toBe('branch');

    fireEvent.click(
      within(worktreeLayer()).getByRole('button', { name: `Back to session ${session.goal}` }),
    );
    await settle();

    expect(useAppStore.getState().activeLens[sessionId] ?? null).toBeNull();
    expect(document.querySelector('[data-level-layer="session"]:not([inert])')).not.toBeNull();
  });

  it('names the merge request entry of a GitLab branch on the folded rail', async () => {
    seed({ status: worktreeStatusOf({}) });
    const mr: GitlabMergeRequest = {
      id: 4201,
      iid: 42,
      projectId: 9,
      title: 'Stop retried webhooks',
      description: null,
      state: 'opened',
      webUrl: 'https://gitlab.com/harborline/payments-api/-/merge_requests/42',
      sourceBranch: mount.branch,
      targetBranch: 'main',
      draft: false,
      hasConflicts: false,
      mergeStatus: 'can_be_merged',
      updatedAt: '2026-10-06T09:00:00.000Z',
    };
    const gitlab: MountGitlabMrState = {
      mountId: mount.mountId,
      projectId: mount.projectId,
      revision: 1,
      host: 'https://gitlab.com',
      projectPath: 'harborline/payments-api',
      branch: mount.branch,
      mrs: [mr],
      links: [],
      mr,
      fetchedAt: brandId<IsoDateTime>({ value: '2026-10-06T09:00:00.000Z' }),
      loading: false,
      error: null,
    };
    useAppStore.setState({ mountGitlabMr: { [mount.mountId]: gitlab } });
    localStorage.setItem(STORAGE_KEYS.sessionRailCollapsed, '1');
    await mountRail();
    await openWorktree();

    const level = document.querySelector<HTMLElement>('[data-rail-level="worktree"]');
    if (level === null) {
      throw new Error('the folded rail is not on the worktree level');
    }
    expect(within(level).getAllByRole('button', { name: /^Merge request/ })).toHaveLength(1);
    expect(within(level).queryAllByRole('button', { name: /^Pull request/ })).toEqual([]);
  });

  it('goes up one level on Command [ while the session rail has focus', async () => {
    seed({ status: worktreeStatusOf({}) });
    await mountRail();
    await openWorktree();

    fireEvent.keyDown(worktreeLayer(), { key: '[', metaKey: true });
    await settle();

    expect(useAppStore.getState().activeLens[sessionId] ?? null).toBeNull();
  });

  it('holds the mount actions in a visible menu, with Link work to this branch and no Rebase', async () => {
    seed({ status: worktreeStatusOf({}) });
    await mountRail();
    await openWorktree();

    fireEvent.click(
      within(worktreeLayer()).getByRole('button', {
        name: `payments-api · ${mount.branch} actions`,
      }),
    );
    const labels = (await screen.findAllByRole('menuitem')).map((item) => item.textContent ?? '');

    expect(labels.some((label) => label.includes('Link work to this branch'))).toBe(true);
    expect(labels.some((label) => label.includes('Copy branch name'))).toBe(true);
    expect(labels.some((label) => label.includes('Copy path'))).toBe(true);
    expect(labels.some((label) => /Rebase|Create PR|Open pull request/.test(label))).toBe(false);
  });

  it('opens the put on a branch picker from Link work to this branch', async () => {
    seed({ status: worktreeStatusOf({}) });
    await mountRail();
    await openWorktree();

    fireEvent.click(
      within(worktreeLayer()).getByRole('button', {
        name: `payments-api · ${mount.branch} actions`,
      }),
    );
    fireEvent.click(await screen.findByRole('menuitem', { name: /Link work to this branch/ }));
    await settle();

    expect(await screen.findByRole('dialog', { name: 'Put on a branch' })).toBeDefined();
  });

  it('shows no status line on a branch level with its base', async () => {
    seed({ status: worktreeStatusOf({}) });
    await mountRail();
    await openWorktree();

    expect(worktreeLayer().querySelector('[data-worktree-status]')).toBeNull();
  });

  it('says how far behind the branch is and rebases it once from the status line', async () => {
    const rebaseBranch = vi.fn(async () => 'rebased' as const);
    seed({ status: worktreeStatusOf({ behind: 6 }) });
    useAppStore.setState({ rebaseBranch });
    await mountRail();
    await openWorktree();

    const line = await waitFor(statusLine);
    expect(line.textContent).toContain('6 behind main');
    fireEvent.click(within(line).getByRole('button', { name: 'Rebase on main' }));
    await settle();

    expect(rebaseBranch).toHaveBeenCalledTimes(1);
    expect(rebaseBranch).toHaveBeenCalledWith({ sessionId, mountId: mount.mountId });
  });

  it('says a rebase is running and asks before Abort runs', async () => {
    seed({ status: worktreeStatusOf({ unmerged: 1, inProgress: 'rebase' }) });
    await mountRail();
    await openWorktree();

    const line = await waitFor(statusLine);
    expect(line.textContent).toContain('Rebasing · 1 conflict');
    fireEvent.click(within(line).getByRole('button', { name: 'Abort rebase' }));
    await settle();

    expect(screen.getByRole('group', { name: 'Abort the rebase?' })).toBeDefined();
  });
});

describe('the worktree rows of the session level', () => {
  it('lists each worktree under its project with its number and no dot while it is fine', async () => {
    seedTwoProjects({ status: worktreeStatusOf({}) });
    await mountRail();

    const row = worktreeButton(projectRows('payments-api'));
    expect(row.textContent).toBe(`${mount.branch}#418`);
    expect(row.querySelector('[data-worktree-dot] [data-tone]')).toBeNull();
    expect(worktreeButton(projectRows('ledger-core')).textContent).toContain('#77');
  });

  it('draws the worst state as one dot named in the row, a failed check above being behind', async () => {
    seedTwoProjects({ status: worktreeStatusOf({ behind: 3 }) });
    patchRequest({ mountId: mount.mountId, patch: { checks: 'failure' } });
    await mountRail();

    await waitFor(() =>
      expect(worktreeButton(projectRows('ledger-core')).getAttribute('aria-label')).toContain(
        '3 behind main',
      ),
    );
    expect(worktreeButton(projectRows('payments-api')).getAttribute('aria-label')).toContain(
      'A check failed',
    );
  });

  it('shows a merged worktree as its branch with the merged icon, never a finished row', async () => {
    seedTwoProjects({ status: worktreeStatusOf({}) });
    patchRequest({ mountId: ledgerMount.mountId, patch: { state: 'merged' } });
    await mountRail();

    const row = worktreeButton(projectRows('ledger-core'));
    expect(row.textContent).toContain(ledgerMount.branch);
    expect(row.querySelector('[data-pr-state]')?.getAttribute('data-pr-state')).toBe('merged');
    expect(row.getAttribute('aria-label')).toContain('Merged');
    expect(screen.getByRole('navigation', { name: 'Session' }).textContent).not.toMatch(
      /finished/i,
    );
  });

  it('opens the project picker straight from the card plus, with Connect a repo or folder in it', async () => {
    seedTwoProjects({ status: worktreeStatusOf({}) });
    await mountRail();

    const card = within(screen.getByRole('group', { name: 'Projects' }));
    fireEvent.click(card.getByRole('button', { name: 'Add folder' }));
    const picker = within(await screen.findByRole('dialog', { name: 'Add folder' }));

    expect(picker.getByRole('button', { name: 'Add notify-relay' })).toBeDefined();
    expect(picker.queryByRole('button', { name: 'Add payments-api' })).toBeNull();
    expect(picker.getByRole('button', { name: 'Connect a repo or folder' })).toBeDefined();
    expect(picker.queryByRole('button', { name: /^New branch in/ })).toBeNull();
  });

  it('connects a new repo from the picker and lands on its preflight to add it here', async () => {
    seedTwoProjects({ status: worktreeStatusOf({}) });
    stubStoryInvoke({
      worktree_status: () => worktreeStatusOf({}),
      worktree_remote_url: () => 'git@github.com:harborline/payments-api.git',
      detect_editors: () => [],
      validate_git_repo: () => ({
        isRepo: true,
        rootPath: '/repos/acme-docs',
        resolvedPath: '/repos/acme-docs',
        defaultBranch: 'main',
        error: null,
        errorKind: null,
      }),
      scan_child_repos: () => [],
      repo_identity: () => ({ rootCommits: [], remoteUrl: null }),
      worktree_list_branch_names: () => ['main'],
    });
    vi.mocked(openDialog).mockResolvedValueOnce('/repos/acme-docs');
    await mountRail();

    fireEvent.click(screen.getByRole('button', { name: 'Add folder' }));
    const picker = within(await screen.findByRole('dialog', { name: 'Add folder' }));
    await act(async () => {
      fireEvent.click(picker.getByRole('button', { name: 'Connect a repo or folder' }));
    });
    await settle();

    const added = useAppStore.getState().projects.find((project) => project.name === 'acme-docs');
    expect(added?.workspaceId).toBe(session.workspaceId);
    expect(added?.kind).toBe('repo');
    expect(await screen.findByRole('region', { name: 'Add acme-docs' })).toBeDefined();
  });

  it('keeps the picker and offers workspace projects when the folder cannot connect', async () => {
    seedTwoProjects({ status: worktreeStatusOf({}) });
    stubStoryInvoke({
      worktree_status: () => worktreeStatusOf({}),
      detect_editors: () => [],
      validate_git_repo: () => {
        throw new Error('folder not found');
      },
    });
    vi.mocked(openDialog).mockResolvedValueOnce('/repos/gone');
    const before = useAppStore.getState().projects.length;
    await mountRail();

    fireEvent.click(screen.getByRole('button', { name: 'Add folder' }));
    const picker = within(await screen.findByRole('dialog', { name: 'Add folder' }));
    await act(async () => {
      fireEvent.click(picker.getByRole('button', { name: 'Connect a repo or folder' }));
    });
    await settle();

    expect(picker.getByRole('alert').textContent).toContain('folder not found');
    expect(picker.getByRole('button', { name: 'Open workspace folders' })).toBeDefined();
    expect(picker.getByRole('button', { name: 'Add notify-relay' })).toBeDefined();
    expect(useAppStore.getState().projects).toHaveLength(before);
  });

  it('shows Rebase all as the first line of the Projects card when two branches are behind', async () => {
    seedTwoProjects({ status: worktreeStatusOf({ behind: 3 }) });
    await mountRail();

    const card = screen.getByRole('group', { name: 'Projects' });
    await waitFor(() => expect(card.querySelector('[data-rebase-all]')).not.toBeNull());
    const rebaseAll = card.querySelector<HTMLElement>('[data-rebase-all]');
    if (rebaseAll === null) {
      throw new Error('the Rebase all line is missing');
    }
    expect(rebaseAll.textContent).toContain('2 branches behind');
    expect(within(rebaseAll).getByRole('button', { name: /Rebase all/ })).toBeDefined();
    expect(card.querySelector('[data-project-row]')?.compareDocumentPosition(rebaseAll)).toBe(
      Node.DOCUMENT_POSITION_PRECEDING,
    );
    expect(within(card).getByRole('button', { name: 'Add folder' })).toBeDefined();
    expect(within(card).getByRole('button', { name: 'New branch in ledger-core' })).toBeDefined();
  });

  it('keeps Rebase all out of the Projects card when only one branch is behind', async () => {
    seed({ status: worktreeStatusOf({ behind: 3 }) });
    await mountRail();

    expect(
      screen.getByRole('group', { name: 'Projects' }).querySelector('[data-rebase-all]'),
    ).toBeNull();
  });

  it('names the reason in the picker when the folder cannot be read', async () => {
    seedTwoProjects({ status: worktreeStatusOf({}) });
    stubStoryInvoke({
      worktree_status: () => worktreeStatusOf({}),
      detect_editors: () => [],
      validate_git_repo: () => ({
        isRepo: false,
        rootPath: null,
        resolvedPath: '/repos/locked',
        defaultBranch: null,
        error: null,
        errorKind: 'permission_denied',
      }),
    });
    vi.mocked(openDialog).mockResolvedValueOnce('/repos/locked');
    const before = useAppStore.getState().projects.length;
    await mountRail();

    fireEvent.click(screen.getByRole('button', { name: 'Add folder' }));
    const picker = within(await screen.findByRole('dialog', { name: 'Add folder' }));
    await act(async () => {
      fireEvent.click(picker.getByRole('button', { name: 'Connect a repo or folder' }));
    });
    await settle();

    expect(picker.getByRole('alert').textContent).toContain("can't read that folder");
    expect(picker.getByRole('button', { name: 'Open workspace folders' })).toBeDefined();
    expect(useAppStore.getState().projects).toHaveLength(before);
  });

  it('sends a folder holding several repos to workspace projects instead of adding it', async () => {
    seedTwoProjects({ status: worktreeStatusOf({}) });
    stubStoryInvoke({
      worktree_status: () => worktreeStatusOf({}),
      detect_editors: () => [],
      validate_git_repo: () => ({
        isRepo: false,
        rootPath: null,
        resolvedPath: '/repos/harborline',
        defaultBranch: null,
        error: null,
        errorKind: 'not_a_repository',
      }),
      scan_child_repos: () => [
        { name: 'acme-docs', path: '/repos/harborline/acme-docs', defaultBranch: 'main' },
        { name: 'acme-web', path: '/repos/harborline/acme-web', defaultBranch: 'main' },
      ],
    });
    vi.mocked(openDialog).mockResolvedValueOnce('/repos/harborline');
    const before = useAppStore.getState().projects.length;
    await mountRail();

    fireEvent.click(screen.getByRole('button', { name: 'Add folder' }));
    const picker = within(await screen.findByRole('dialog', { name: 'Add folder' }));
    await act(async () => {
      fireEvent.click(picker.getByRole('button', { name: 'Connect a repo or folder' }));
    });
    await settle();

    expect(picker.getByRole('alert').textContent).toContain('several repositories');
    expect(picker.getByRole('button', { name: 'Open workspace folders' })).toBeDefined();
    expect(useAppStore.getState().projects).toHaveLength(before);
  });

  it('starts a new branch from the plus on each repo row, with no menu between', async () => {
    seedTwoProjects({ status: worktreeStatusOf({}) });
    await mountRail();

    const plus = screen.getByRole('button', { name: 'New branch in ledger-core' });
    expect(plus.closest('[data-project-row]')?.textContent).toContain('ledger-core');
    expect(screen.getByRole('button', { name: 'New branch in payments-api' })).toBeDefined();
    fireEvent.click(plus);

    expect(await screen.findByRole('dialog', { name: 'New branch in ledger-core' })).toBeDefined();
    expect(screen.queryByRole('dialog', { name: 'Add folder' })).toBeNull();
  });

  it('opens the same new branch form when the registry action runs', async () => {
    seedTwoProjects({ status: worktreeStatusOf({}) });
    await mountRail();

    await act(async () => {
      await runObjectAction({
        target: { kind: 'project', sessionId, projectId: ledgerCore.id },
        actionId: 'project.newBranch',
        env: {
          getState: useAppStore.getState,
          showToast: vi.fn(),
          copyText: vi.fn(async () => undefined),
          origin: 'palette',
          anchorKey: null,
          viewing: null,
        },
      });
    });
    await settle();
    await settle();
    await settle();

    expect(await screen.findByRole('dialog', { name: 'New branch in ledger-core' })).toBeDefined();
  });

  it('gives a folder project no branch plus and keeps its row aligned', async () => {
    seedTwoProjects({ status: worktreeStatusOf({}) });
    useAppStore.setState((state) => ({
      projects: state.projects.map((project) =>
        project.id === ledgerCore.id ? { ...project, kind: FOLDER } : project,
      ),
    }));
    await mountRail();

    expect(screen.queryByRole('button', { name: 'New branch in ledger-core' })).toBeNull();
    expect(screen.getByRole('button', { name: 'New branch in payments-api' })).toBeDefined();
    const folderRow = document.querySelector(
      '[data-card-project="ledger-core"] [data-project-row]',
    );
    expect(folderRow?.querySelector('[data-project-row-slot]')).not.toBeNull();
  });

  it('draws neither plus on an archived session', async () => {
    seedTwoProjects({ status: worktreeStatusOf({}) });
    const archived = {
      ...session,
      archivedAt: brandId<IsoDateTime>({ value: '2026-10-06T10:00:00.000Z' }),
    };
    useAppStore.setState((state) => ({
      sessions: state.sessions.map((entry) => (entry.id === sessionId ? archived : entry)),
    }));
    render(
      <ToastProvider>
        <SessionRail session={archived} />
      </ToastProvider>,
    );
    await settle();

    expect(screen.queryByRole('button', { name: 'Add folder' })).toBeNull();
    expect(screen.queryByRole('button', { name: /^New branch in/ })).toBeNull();
  });
});

type ChangedParams = {
  readonly additions: number;
  readonly deletions: number;
};

const seedChangedFiles = ({ additions, deletions }: ChangedParams) => {
  useAppStore.setState({
    sessionWorktreeRecords: {
      [sessionId]: [
        {
          id: 'worktree-payments',
          sessionId,
          worktreePath: mount.worktreePath,
          branch: mount.branch,
          parallelIndex: 0,
          createdAt: 1,
        },
      ],
    },
  });
  stubStoryInvoke({
    worktree_status: () => worktreeStatusOf({}),
    worktree_remote_url: () => 'git@github.com:harborline/payments-api.git',
    detect_editors: () => [],
    worktree_changed_files: () => ({ paths: [], entries: [], additions, deletions, numstat: '' }),
  });
};

const entriesOf = (name: string): HTMLElement => {
  const list = projectRows(name).querySelector<HTMLElement>('[data-worktree-entries]');
  if (list === null) {
    throw new Error(`${name} shows no worktree pages`);
  }
  return list;
};

const expandBranch = (name: string): void => {
  const toggle = projectRows(name).querySelector<HTMLElement>('[data-worktree-toggle]');
  if (toggle === null) {
    throw new Error(`${name} shows no branch toggle`);
  }
  if (toggle.getAttribute('aria-expanded') === 'true') {
    return;
  }
  fireEvent.click(toggle);
};

const entryLabels = (list: HTMLElement): ReadonlyArray<string> =>
  [...list.querySelectorAll('[data-entry-label]')].map((label) => label.textContent ?? '');

describe('the worktree pages inside the Projects card', () => {
  it('lists Pull request, Comments, Files and Checks under a worktree with a pull request', async () => {
    seedTwoProjects({ status: worktreeStatusOf({}) });
    seedChangedFiles({ additions: 652, deletions: 99 });
    await mountRail();
    expandBranch('payments-api');

    expect(entryLabels(entriesOf('payments-api'))).toEqual([
      'Pull request',
      'Comments',
      'Files',
      'Checks',
    ]);
    await waitFor(() =>
      expect(
        within(entriesOf('payments-api'))
          .getByRole('button', { name: /^Files/ })
          .querySelector('[data-testid="diff-stat"]')?.textContent,
      ).toBe('+652-99'),
    );
    expect(
      within(entriesOf('payments-api'))
        .getByRole('button', { name: /^Files/ })
        .getAttribute('aria-label'),
    ).toBe('Files, +652 -99');
  });

  it('lists only Files under a worktree with no pull request, the drill keeps the rest', async () => {
    seed({ status: worktreeStatusOf({}) });
    useAppStore.getState().navigate({ to: sessionPlace({ sessionId }) });
    await mountRail();
    expandBranch('payments-api');

    expect(entryLabels(entriesOf('payments-api'))).toEqual(['Files']);
  });

  it('opens the worktree page of an entry directly, on its tab', async () => {
    seedTwoProjects({ status: worktreeStatusOf({}) });
    useAppStore.setState({ setSessionActiveMount: vi.fn(async () => undefined) });
    await mountRail();
    expandBranch('payments-api');

    await act(async () => {
      fireEvent.click(within(entriesOf('payments-api')).getByRole('button', { name: /^Files/ }));
    });

    expect(useAppStore.getState().activeLens[sessionId]).toBe('branch');
    expect(useAppStore.getState().diffMountPath[sessionId]).toBe(mount.worktreePath);
    expect(useAppStore.getState().branchTab?.[sessionId]).toBe('files');
  });

  it('puts a failing check on the Checks entry and not again on its worktree row', async () => {
    seedTwoProjects({ status: worktreeStatusOf({}) });
    patchRequest({ mountId: mount.mountId, patch: { checks: 'failure' } });
    useAppStore.setState((state) => {
      const current = state.mountGithub[mount.mountId];
      if (current === undefined) {
        return {};
      }
      return {
        mountGithub: {
          ...state.mountGithub,
          [mount.mountId]: {
            ...current,
            detail: {
              prNumber: 418,
              comments: [],
              reviews: [],
              reviewRequests: [],
              checks: [
                { name: 'lint', conclusion: 'failure', detailsUrl: null, durationMs: null },
                { name: 'test', conclusion: 'success', detailsUrl: null, durationMs: null },
              ],
            },
          },
        },
      };
    });
    await mountRail();

    const checks = within(entriesOf('payments-api')).getByRole('button', { name: /^Checks/ });
    expect(checks.getAttribute('aria-label')).toBe('Checks, 1 failing');
    expect(checks.querySelector('[data-entry-slot]')?.textContent).toBe('1');
    expect(worktreeButton(projectRows('payments-api')).getAttribute('aria-label')).not.toContain(
      'A check failed',
    );
  });

  it('folds the card from its header, remembers it, and keeps a state dot on the folded header', async () => {
    seedTwoProjects({ status: worktreeStatusOf({ behind: 3 }) });
    await mountRail();
    const toggle = screen.getByRole('button', { name: 'Projects' });
    expect(toggle.getAttribute('aria-expanded')).toBe('true');

    fireEvent.click(toggle);
    await settle();

    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(localStorage.getItem(STORAGE_KEYS.sessionRailFoldedCards)).toBe('["projects"]');
    const card = toggle.closest<HTMLElement>('[data-level-card]');
    if (card === null) {
      throw new Error('the Projects toggle sits in no card');
    }
    await waitFor(() => expect(card.querySelector('[data-card-signal]')).not.toBeNull());
    expect(within(card).getByRole('button', { name: 'Add folder' })).toBeDefined();
  });
});

type FailParams = {
  readonly mountId: MountId;
  readonly prNumber: number;
};

const failChecks = ({ mountId, prNumber }: FailParams) => {
  patchRequest({ mountId, patch: { checks: 'failure' } });
  useAppStore.setState((state) => {
    const current = state.mountGithub[mountId];
    if (current === undefined) {
      return {};
    }
    return {
      mountGithub: {
        ...state.mountGithub,
        [mountId]: {
          ...current,
          detail: {
            prNumber,
            comments: [],
            reviews: [],
            reviewRequests: [],
            checks: [{ name: 'lint', conclusion: 'failure', detailsUrl: null, durationMs: null }],
          },
        },
      },
    };
  });
};

const projectToggle = (name: string): HTMLElement =>
  screen.getByRole('button', { name: new RegExp(`^${name}, \\d+ branch`) });

const branchToggle = (name: string): HTMLElement => {
  const toggle = projectRows(name).querySelector<HTMLElement>('[data-worktree-toggle]');
  if (toggle === null) {
    throw new Error(`${name} shows no branch toggle`);
  }
  return toggle;
};

const prMarkOf = (name: string): Element | null =>
  worktreeButton(projectRows(name)).querySelector('[data-pr-state]');

describe('the Projects tree', () => {
  it('opens projects and closes branches by default, except a branch that needs you', async () => {
    seedTwoProjects({ status: worktreeStatusOf({}) });
    failChecks({ mountId: mount.mountId, prNumber: 418 });
    await mountRail();

    expect(projectToggle('payments-api').getAttribute('aria-expanded')).toBe('true');
    expect(projectToggle('ledger-core').getAttribute('aria-expanded')).toBe('true');
    expect(projectToggle('payments-api').querySelector('[data-project-count]')?.textContent).toBe(
      '1',
    );
    expect(branchToggle('payments-api').getAttribute('aria-expanded')).toBe('true');
    expect(branchToggle('ledger-core').getAttribute('aria-expanded')).toBe('false');
    expect(projectRows('ledger-core').querySelector('[data-worktree-entries]')).toBeNull();
  });

  it('opens the branch you were on, also after going back to the session', async () => {
    seedTwoProjects({ status: worktreeStatusOf({}) });
    await mountRail();
    expect(branchToggle('payments-api').getAttribute('aria-expanded')).toBe('false');

    await openWorktree();
    act(() => {
      useAppStore.getState().navigate({ to: sessionPlace({ sessionId }) });
    });
    await settle();

    expect(branchToggle('payments-api').getAttribute('aria-expanded')).toBe('true');
    expect(branchToggle('ledger-core').getAttribute('aria-expanded')).toBe('false');
  });

  it('toggles a project and a branch, with several open at once', async () => {
    seedTwoProjects({ status: worktreeStatusOf({}) });
    await mountRail();

    fireEvent.click(branchToggle('payments-api'));
    fireEvent.click(branchToggle('ledger-core'));
    await settle();

    expect(entryLabels(entriesOf('payments-api'))).toContain('Pull request');
    expect(entryLabels(entriesOf('ledger-core'))).toContain('Pull request');

    fireEvent.click(branchToggle('ledger-core'));
    await settle();
    expect(projectRows('ledger-core').querySelector('[data-worktree-entries]')).toBeNull();
    expect(entriesOf('payments-api')).toBeDefined();

    fireEvent.click(projectToggle('payments-api'));
    await settle();
    expect(projectToggle('payments-api').getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByRole('list', { name: 'payments-api worktrees' })).toBeNull();
    expect(projectRows('ledger-core')).toBeDefined();
  });

  it('keeps what you opened and closed across a reload, per session', async () => {
    seedTwoProjects({ status: worktreeStatusOf({}) });
    await mountRail();
    fireEvent.click(branchToggle('ledger-core'));
    fireEvent.click(projectToggle('payments-api'));
    await settle();
    cleanup();

    await mountRail();

    expect(projectToggle('payments-api').getAttribute('aria-expanded')).toBe('false');
    expect(branchToggle('ledger-core').getAttribute('aria-expanded')).toBe('true');
    const stored: unknown = JSON.parse(
      localStorage.getItem(STORAGE_KEYS.sessionRailTreeOpen) ?? '{}',
    );
    expect(Object.keys(typeof stored === 'object' && stored !== null ? stored : {})).toEqual([
      sessionId,
    ]);
  });

  it('leads each branch with its pull request state icon in its color', async () => {
    seedTwoProjects({ status: worktreeStatusOf({}) });
    patchRequest({ mountId: mount.mountId, patch: { state: 'queued' } });
    patchRequest({ mountId: ledgerMount.mountId, patch: { state: 'closed' } });
    await mountRail();

    expect(prMarkOf('payments-api')?.getAttribute('data-pr-state')).toBe('queued');
    expect(prMarkOf('payments-api')?.getAttribute('data-pr-tone')).toBe('warning');
    expect(prMarkOf('ledger-core')?.getAttribute('data-pr-state')).toBe('closed');
    expect(prMarkOf('ledger-core')?.getAttribute('data-pr-tone')).toBe('danger');
  });

  it('draws a draft pull request gray and a branch with none as a neutral branch glyph', async () => {
    seedTwoProjects({ status: worktreeStatusOf({}) });
    patchRequest({ mountId: mount.mountId, patch: { isDraft: true } });
    useAppStore.setState((state) => {
      const ledger = state.mountGithub[ledgerMount.mountId];
      return ledger === undefined
        ? {}
        : { mountGithub: { ...state.mountGithub, [ledgerMount.mountId]: { ...ledger, pr: null } } };
    });
    await mountRail();

    expect(prMarkOf('payments-api')?.getAttribute('data-pr-state')).toBe('draft');
    expect(prMarkOf('payments-api')?.getAttribute('data-pr-tone')).toBe('neutral');
    expect(prMarkOf('ledger-core')?.getAttribute('data-pr-state')).toBe('none');
    expect(prMarkOf('ledger-core')?.getAttribute('data-pr-tone')).toBe('neutral');
  });
});
