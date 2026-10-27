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
import type { RebaseAllBranchState, RebaseAllRun } from '../../../store/slices/rebaseAll/types';
import { resetWorktreeStatusCache } from '../../../store/runtime/worktreeStatuses/cache';
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
import { brandedId } from '../../../features/history/testing/brandedId';
import { ObjectMenuProvider } from '../../../features/actions/components/ObjectMenuProvider';
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
      <ObjectMenuProvider>
        <SessionRail session={session} />
      </ObjectMenuProvider>
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

const worktreeButton = (list: HTMLElement): HTMLElement => {
  const [first] = within(list).getAllByRole('button');
  if (first === undefined) {
    throw new Error('no worktree row');
  }
  return first;
};

const rowButton = (project: string, name: RegExp): HTMLElement =>
  within(projectRows(project)).getByRole('button', { name });

const levelCount = (): number => document.querySelectorAll('[data-level-layer="worktree"]').length;

const railLevel = (): string | null =>
  screen.getByRole('navigation', { name: 'Session' }).getAttribute('data-session-rail');

const statusLine = (): HTMLElement => {
  const line = document.querySelector<HTMLElement>('[data-worktree-status]');
  if (line === null) {
    throw new Error('the current branch shows no status line');
  }
  return line;
};

const failureLine = (): HTMLElement => {
  const failure = document.querySelector<HTMLElement>('[data-branch-failure]');
  if (failure === null) {
    throw new Error('the current branch shows no error under its line');
  }
  return failure;
};

const menuLabels = async (): Promise<ReadonlyArray<string>> =>
  (await screen.findAllByRole('menuitem')).map((item) => item.textContent ?? '');

const ACTIONS = `payments-api · ${mount.branch} actions`;

describe('one tree for every branch', () => {
  it('opens a branch in place: its pages expand under the row and the rail never drills into a second level', async () => {
    seedTwoProjects({ status: worktreeStatusOf({}) });
    await mountRail();
    const row = rowButton('payments-api', /#418/);
    expect(row.hasAttribute('aria-expanded')).toBe(false);

    await act(async () => {
      fireEvent.click(row);
    });
    await settle();

    expect(useAppStore.getState().activeLens[sessionId]).toBe('branch');
    expect(railLevel()).toBe('session');
    expect(levelCount()).toBe(0);
    expect(rowButton('payments-api', /#418/).getAttribute('aria-expanded')).toBe('true');
    expect(entryLabels(entriesOf('payments-api'))).toEqual([
      'Pull request',
      'Comments',
      'Files',
      'Commits',
      'Checks',
    ]);
  });

  it('names the pull request entry by its number alone, so the label is never cut by the reference', async () => {
    seedTwoProjects({ status: worktreeStatusOf({}) });
    await openWorktree();
    await mountRail();

    const reference = entriesOf('payments-api').querySelector('[data-entry-reference]');
    expect(reference?.textContent).toBe('#418');
    const label = reference?.parentElement?.querySelector('[data-entry-label]');
    expect(label?.textContent).toBe('Pull request');
  });

  it('collapses and expands the current branch from its row and stays on its page', async () => {
    seedTwoProjects({ status: worktreeStatusOf({}) });
    await openWorktree();
    await mountRail();
    expect(rowButton('payments-api', /#418/).getAttribute('aria-expanded')).toBe('true');
    const path = useAppStore.getState().diffMountPath[sessionId];

    fireEvent.click(rowButton('payments-api', /#418/));
    await settle();
    expect(rowButton('payments-api', /#418/).getAttribute('aria-expanded')).toBe('false');
    expect(projectRows('payments-api').querySelector('[data-worktree-entries]')).toBeNull();
    expect(useAppStore.getState().activeLens[sessionId]).toBe('branch');
    expect(useAppStore.getState().diffMountPath[sessionId]).toBe(path);

    fireEvent.click(rowButton('payments-api', /#418/));
    await settle();
    expect(rowButton('payments-api', /#418/).getAttribute('aria-expanded')).toBe('true');
  });

  it('lands a saved branch lens on the tree with that branch current and its pages open', async () => {
    seedTwoProjects({ status: worktreeStatusOf({}) });
    await openWorktree();
    await mountRail();

    expect(railLevel()).toBe('session');
    expect(levelCount()).toBe(0);
    const row = rowButton('payments-api', /#418/);
    expect(row.getAttribute('aria-current')).toBe('page');
    expect(entryLabels(entriesOf('payments-api'))).toContain('Files');
    expect(rowButton('ledger-core', /#77/).hasAttribute('aria-current')).toBe(false);
  });

  it('keeps the folded rail drilling to the branch pages, since it has no tree', async () => {
    seedTwoProjects({ status: worktreeStatusOf({}) });
    localStorage.setItem(STORAGE_KEYS.sessionRailCollapsed, '1');
    await mountRail();
    await openWorktree();

    expect(document.querySelector('[data-rail-level="worktree"]')).not.toBeNull();
  });

  it('opens the same menu from the row dots, a right click and Shift+F10', async () => {
    seedTwoProjects({ status: worktreeStatusOf({ behind: 6 }) });
    await mountRail();
    const row = rowButton('payments-api', /#418/);

    fireEvent.click(screen.getByRole('button', { name: ACTIONS }));
    const fromDots = await menuLabels();
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });
    await settle();

    fireEvent.contextMenu(row);
    const fromClick = await menuLabels();
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });
    await settle();

    row.focus();
    fireEvent.keyDown(row, { key: 'F10', shiftKey: true });
    const fromKeys = await menuLabels();

    expect(fromDots.some((label) => label.includes('Copy branch name'))).toBe(true);
    expect(fromDots.some((label) => label.includes('Link work to this branch'))).toBe(true);
    expect(fromDots.some((label) => label.includes('Rebase on main'))).toBe(true);
    expect(fromClick).toEqual(fromDots);
    expect(fromKeys).toEqual(fromDots);
  });

  it('keeps the dots empty at rest on a row that is not current, and always drawn on the current one', async () => {
    seedTwoProjects({ status: worktreeStatusOf({}) });
    await openWorktree();
    await mountRail();

    const actionsOf = (name: RegExp): Element | null =>
      rowButton('payments-api', name)
        .closest('[data-worktree-open], li')
        ?.querySelector('[data-worktree-actions]') ?? null;
    expect(actionsOf(/#418/)?.getAttribute('data-actions-at-rest')).toBe('shown');
    expect(
      projectRows('ledger-core')
        .querySelector('[data-worktree-actions]')
        ?.getAttribute('data-actions-at-rest'),
    ).toBe('hidden');
  });

  it('opens the put on a branch picker from the row menu, which also offers the branch switch', async () => {
    seedTwoProjects({ status: worktreeStatusOf({}) });
    await mountRail();

    fireEvent.click(screen.getByRole('button', { name: ACTIONS }));
    expect(await screen.findByRole('menuitem', { name: /Switch branch/ })).toBeDefined();
    fireEvent.click(await screen.findByRole('menuitem', { name: /Link work to this branch/ }));
    await settle();

    expect(await screen.findByRole('dialog', { name: 'Put on a branch' })).toBeDefined();
  });

  it('draws no status line under a current branch that is level with its base', async () => {
    seedTwoProjects({ status: worktreeStatusOf({}) });
    await openWorktree();
    await mountRail();

    expect(document.querySelector('[data-worktree-status]')).toBeNull();
  });

  it('says how far behind the current branch is and rebases that mount once from its line', async () => {
    const rebaseBranch = vi.fn(async () => 'rebased' as const);
    seedTwoProjects({ status: worktreeStatusOf({ behind: 6 }) });
    useAppStore.setState({ rebaseBranch });
    await openWorktree();
    await mountRail();

    const line = await waitFor(statusLine);
    expect(line.textContent).toContain('6 behind main');
    expect(line.closest('[data-card-project]')?.getAttribute('data-card-project')).toBe(
      'payments-api',
    );
    fireEvent.click(within(line).getByRole('button', { name: 'Rebase on main' }));
    await settle();

    expect(rebaseBranch).toHaveBeenCalledTimes(1);
    expect(rebaseBranch).toHaveBeenCalledWith({ sessionId, mountId: mount.mountId });
  });

  it('keeps the line and shows the error under it when a rebase fails, and rebases again on retry', async () => {
    const rebaseBranch = vi
      .fn()
      .mockRejectedValueOnce(new Error('origin cannot be reached'))
      .mockResolvedValue('rebased');
    seedTwoProjects({ status: worktreeStatusOf({ behind: 6 }) });
    useAppStore.setState({ rebaseBranch });
    await openWorktree();
    await mountRail();

    const line = await waitFor(statusLine);
    fireEvent.click(within(line).getByRole('button', { name: 'Rebase on main' }));
    await settle();

    const failure = failureLine();
    expect(failure.textContent).toContain('origin cannot be reached');
    expect(statusLine().textContent).toContain('6 behind main');
    expect(
      statusLine().compareDocumentPosition(failure) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();

    fireEvent.click(within(failure).getByRole('button', { name: 'Retry' }));
    await settle();

    expect(rebaseBranch).toHaveBeenCalledTimes(2);
    expect(rebaseBranch).toHaveBeenLastCalledWith({ sessionId, mountId: mount.mountId });
  });

  it('says a rebase is running and asks before Abort runs', async () => {
    seedTwoProjects({ status: worktreeStatusOf({ unmerged: 1, inProgress: 'rebase' }) });
    await openWorktree();
    await mountRail();

    const line = await waitFor(statusLine);
    expect(line.textContent).toContain('Rebasing · 1 conflict');
    fireEvent.click(within(line).getByRole('button', { name: 'Abort rebase' }));
    await settle();

    expect(screen.getByRole('group', { name: 'Abort the rebase?' })).toBeDefined();
  });
});

const branchOf = (name: string): MountSeed => ({ name });

type MountSeed = {
  readonly name: string;
};

type ExtraParams = {
  readonly seed: MountSeed;
  readonly state: PullRequestState['state'] | null;
  readonly number: number;
};

const extraMount = ({ seed: { name }, state, number }: ExtraParams): MountId => {
  const extra = {
    ...mount,
    mountId: brandedId<MountId>({ value: `mount-${name}` }),
    branch: `hl/${name}`,
    worktreePath: `/tmp/payments-api/worktrees/${name}`,
  };
  const base = mountGithubOf({ mount: extra, number });
  useAppStore.setState((current) => ({
    sessionProjectMounts: {
      ...current.sessionProjectMounts,
      [sessionId]: [...(current.sessionProjectMounts[sessionId] ?? []), extra],
    },
    mountGithub: {
      ...current.mountGithub,
      [extra.mountId]:
        state === null || base.pr === null
          ? { ...base, pr: null }
          : { ...base, pr: { ...base.pr, state } },
    },
  }));
  return extra.mountId;
};

const branchesIn = (list: HTMLElement): ReadonlyArray<string> =>
  [...list.querySelectorAll('[data-worktree-branch]')].map(
    (title) =>
      /(hl\/[a-z-]+)/.exec(title.closest('button')?.getAttribute('aria-label') ?? '')?.[1] ?? '',
  );

describe('the branch rows', () => {
  it('draws one line: the pull request title, else the branch name in mono, with no number or branch beside it', async () => {
    seedTwoProjects({ status: worktreeStatusOf({}) });
    useAppStore.setState((state) => {
      const ledger = state.mountGithub[ledgerMount.mountId];
      return ledger === undefined
        ? {}
        : { mountGithub: { ...state.mountGithub, [ledgerMount.mountId]: { ...ledger, pr: null } } };
    });
    await mountRail();

    const titled = rowButton('payments-api', /#418/);
    expect(titled.textContent).toBe('Retry window');
    expect(titled.querySelector('[data-worktree-branch]')?.getAttribute('data-title-kind')).toBe(
      'request',
    );
    expect(titled.getAttribute('aria-label')).toBe(
      `Retry window, #418, Open, branch ${mount.branch}`,
    );
    const bare = worktreeButton(projectRows('ledger-core'));
    expect(bare.textContent).toBe(ledgerMount.branch);
    expect(bare.querySelector('[data-worktree-branch]')?.getAttribute('data-title-kind')).toBe(
      'branch',
    );
  });

  it('names the host only in the folder accessible name and draws no count or host text in the header', async () => {
    seedTwoProjects({ status: worktreeStatusOf({}) });
    await mountRail();

    const header = projectToggle('payments-api');
    expect(header.getAttribute('aria-label')).toBe('payments-api, 1 branch, on GitHub');
    expect(header.textContent).toBe('payments-api');
    expect(header.closest('[data-project-row]')?.querySelector('[data-project-count]')).toBeNull();
    expect(header.querySelector('svg')).toBeNull();

    fireEvent.click(header);
    await settle();
    expect(projectToggle('payments-api').querySelector('svg')).not.toBeNull();
  });

  it('draws one chip at most, worst first: failing checks, else behind, never a word for approved, queued, draft or running', async () => {
    seedTwoProjects({ status: worktreeStatusOf({ behind: 3 }) });
    failChecks({ mountId: mount.mountId, prNumber: 418 });
    await mountRail();

    await waitFor(() =>
      expect(
        within(rowButton('ledger-core', /#77/)).getByTestId('branch-row-chip').textContent,
      ).toBe('3 behind'),
    );
    const failing = within(rowButton('payments-api', /#418/)).getAllByTestId('branch-row-chip');
    expect(failing).toHaveLength(1);
    expect(failing[0]?.textContent).toBe('1 failing');
  });

  it.each(['queued', 'approved', 'open'] as const)(
    'draws no chip on a %s row that is level with its base',
    async (state) => {
      seedTwoProjects({ status: worktreeStatusOf({}) });
      patchRequest({ mountId: mount.mountId, patch: { state } });
      await mountRail();

      expect(within(rowButton('payments-api', /#418/)).queryByTestId('branch-row-chip')).toBeNull();
    },
  );

  it('draws no chip on a draft row and none while its checks are still running', async () => {
    seedTwoProjects({ status: worktreeStatusOf({}) });
    patchRequest({ mountId: mount.mountId, patch: { isDraft: true, checks: 'pending' } });
    await mountRail();

    expect(within(rowButton('payments-api', /#418/)).queryByTestId('branch-row-chip')).toBeNull();
  });

  it('draws Conflict for a branch with unmerged files, above Behind', async () => {
    seedTwoProjects({ status: worktreeStatusOf({ behind: 2, unmerged: 1 }) });
    await mountRail();

    await waitFor(() =>
      expect(
        within(rowButton('ledger-core', /#77/)).getByTestId('branch-row-chip').textContent,
      ).toBe('Conflict'),
    );
  });

  it('orders the live rows queued, approved, open, draft, then no pull request, and folds merged and closed', async () => {
    seed({ status: worktreeStatusOf({}) });
    useAppStore.setState({ sessionProjectMounts: { [sessionId]: [] }, mountGithub: {} });
    extraMount({ seed: branchOf('local-only'), state: null, number: 90 });
    extraMount({ seed: branchOf('draft-one'), state: 'draft', number: 91 });
    extraMount({ seed: branchOf('merged-one'), state: 'merged', number: 92 });
    extraMount({ seed: branchOf('open-one'), state: 'open', number: 93 });
    extraMount({ seed: branchOf('closed-one'), state: 'closed', number: 94 });
    extraMount({ seed: branchOf('approved-one'), state: 'approved', number: 95 });
    extraMount({ seed: branchOf('queued-one'), state: 'queued', number: 96 });
    useAppStore.getState().navigate({ to: sessionPlace({ sessionId }) });
    await mountRail();

    expect(branchesIn(projectRows('payments-api'))).toEqual([
      'hl/queued-one',
      'hl/approved-one',
      'hl/open-one',
      'hl/draft-one',
      'hl/local-only',
    ]);
    const fold = screen.getByRole('button', { name: '2 finished' });
    expect(fold.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByRole('button', { name: /branch hl\/merged-one/ })).toBeNull();

    fireEvent.click(fold);
    await settle();

    const finished = screen.getByRole('list', { name: 'Finished branches' });
    expect(branchesIn(finished)).toEqual(['hl/merged-one', 'hl/closed-one']);
    expect(finished.querySelector('[data-pr-state="merged"]')?.getAttribute('data-pr-tone')).toBe(
      'merged',
    );
  });

  it('keeps the finished fold open while the current branch is in it', async () => {
    seed({ status: worktreeStatusOf({}) });
    useAppStore.setState({ sessionProjectMounts: { [sessionId]: [] }, mountGithub: {} });
    extraMount({ seed: branchOf('open-one'), state: 'open', number: 93 });
    const finishedId = extraMount({ seed: branchOf('merged-one'), state: 'merged', number: 92 });
    useAppStore.getState().navigate({
      to: branchPlace({
        sessionId,
        mountPath: '/tmp/payments-api/worktrees/merged-one',
        tab: 'files',
      }),
    });
    await mountRail();

    expect(screen.getByRole('button', { name: '1 finished' }).getAttribute('aria-expanded')).toBe(
      'true',
    );
    expect(
      screen.getByRole('list', { name: 'Finished branches' }).querySelector('[data-worktree-open]'),
    ).not.toBeNull();
    expect(finishedId).toBeDefined();
  });

  it('keeps focus and the current branch on the same mount when a poll re-ranks the rows', async () => {
    seed({ status: worktreeStatusOf({}) });
    useAppStore.setState({ sessionProjectMounts: { [sessionId]: [] }, mountGithub: {} });
    extraMount({ seed: branchOf('first'), state: 'open', number: 91 });
    const second = extraMount({ seed: branchOf('second'), state: 'draft', number: 92 });
    useAppStore.getState().navigate({
      to: branchPlace({
        sessionId,
        mountPath: '/tmp/payments-api/worktrees/second',
        tab: 'files',
      }),
    });
    await mountRail();
    const row = rowButton('payments-api', /branch hl\/second/);
    row.focus();
    expect(branchesIn(projectRows('payments-api'))).toEqual(['hl/first', 'hl/second']);

    act(() => {
      useAppStore.setState((state) => {
        const current = state.mountGithub[second];
        return current === undefined || current.pr === null
          ? {}
          : {
              mountGithub: {
                ...state.mountGithub,
                [second]: { ...current, pr: { ...current.pr, state: 'queued' } },
              },
            };
      });
    });
    await settle();

    expect(branchesIn(projectRows('payments-api'))).toEqual(['hl/second', 'hl/first']);
    expect(rowButton('payments-api', /branch hl\/second/).getAttribute('aria-current')).toBe(
      'page',
    );
    expect(document.activeElement).toBe(rowButton('payments-api', /branch hl\/second/));
  });
});

type RunParams = {
  readonly states: ReadonlyArray<readonly [MountId, RebaseAllBranchState, string | null]>;
  readonly phase?: RebaseAllRun['phase'];
};

const seedRun = ({ states, phase = 'running' }: RunParams): void => {
  useAppStore.setState({
    rebaseAllRuns: {
      [sessionId]: {
        id: 'run-1',
        sessionId,
        startedAt: Date.now(),
        shouldTidy: false,
        isAborted: false,
        phase,
        autoAgentId: null,
        error: null,
        branches: states.map(([mountId, state, message]) => ({
          mountId,
          projectName: 'payments-api',
          branch: 'hl/x',
          state,
          message,
        })),
      },
    },
  });
};

const rebaseAllHeader = (): HTMLElement => {
  const header = document.querySelector<HTMLElement>('[data-rebase-all]');
  if (header === null) {
    throw new Error('the Projects card shows no Rebase all line');
  }
  return header;
};

const chipOf = (project: string, name: RegExp): HTMLElement | null =>
  within(rowButton(project, name)).queryByTestId('branch-row-chip');

describe('rebase all on the rows', () => {
  const seedBatch = async (): Promise<ReadonlyArray<MountId>> => {
    seed({ status: worktreeStatusOf({ behind: 4 }) });
    useAppStore.setState({ sessionProjectMounts: { [sessionId]: [] }, mountGithub: {} });
    const ids = ['one', 'two', 'three', 'four', 'five', 'six'].map((name, index) =>
      extraMount({ seed: branchOf(name), state: 'open', number: 100 + index }),
    );
    useAppStore.getState().navigate({ to: sessionPlace({ sessionId }) });
    await mountRail();
    return ids;
  };

  it('draws no separate progress list: the state lives on each branch row', async () => {
    const ids = await seedBatch();
    const STATES: ReadonlyArray<readonly [RebaseAllBranchState, string | null]> = [
      ['rebased', null],
      ['rebased', null],
      ['rebasing', null],
      ['queued', null],
      ['conflict', null],
      ['failed', 'origin cannot be reached'],
    ];
    seedRun({
      states: ids.map((id, index) => [
        id,
        STATES[index]?.[0] ?? 'queued',
        STATES[index]?.[1] ?? null,
      ]),
    });
    await settle();

    const card = screen.getByRole('group', { name: 'Projects' });
    expect(card.querySelector('[data-rebase-all-branch]')).toBeNull();
    expect(card.querySelectorAll('[data-rebase-all]')).toHaveLength(1);
    expect(chipOf('payments-api', /branch hl\/one/)).toBeNull();
    expect(chipOf('payments-api', /branch hl\/two/)).toBeNull();
    expect(chipOf('payments-api', /branch hl\/three/)?.textContent).toBe('Rebasing');
    expect(
      chipOf('payments-api', /branch hl\/three/)?.closest('[data-is-breathing]'),
    ).not.toBeNull();
    expect(chipOf('payments-api', /branch hl\/four/)?.textContent).toBe('Queued');
    expect(chipOf('payments-api', /branch hl\/four/)?.closest('[data-is-breathing]')).toBeNull();
    expect(chipOf('payments-api', /branch hl\/five/)?.textContent).toBe('Conflict');
    expect(chipOf('payments-api', /branch hl\/six/)?.textContent).toBe('Failed');
  });

  it('counts the batch in the card header and keeps the height and the CTA size of Rebase all', async () => {
    const ids = await seedBatch();
    const idle = (): HTMLElement => {
      const header = document.querySelector<HTMLElement>('[data-rebase-all]');
      if (header === null) {
        throw new Error('no Rebase all header');
      }
      return header;
    };
    await waitFor(() => expect(idle().textContent).toContain('6 branches behind'));
    const idleLine = idle();
    const idleSize = within(idleLine).getByRole('button', { name: /Rebase all/ }).dataset.size;

    seedRun({
      states: ids.map((id, index) => [
        id,
        index < 2 ? 'rebased' : index === 2 ? 'rebasing' : 'queued',
        null,
      ]),
    });
    await settle();

    expect(idle().textContent).toContain('Rebasing 3 of 6');
    expect(idle().textContent).not.toContain('branches behind');
    expect(idle()).toBe(idleLine);
    expect(within(idle()).getByRole('button', { name: 'Abort' }).dataset.size).toBe(idleSize);
    expect(idleSize).toBe('sm');
  });

  it('stops after the branch in flight when Abort is pressed, and drops the queued ones', async () => {
    const ids = await seedBatch();
    seedRun({ states: ids.map((id, index) => [id, index === 0 ? 'rebasing' : 'queued', null]) });
    await settle();

    fireEvent.click(screen.getByRole('button', { name: 'Abort' }));
    await settle();

    expect(useAppStore.getState().rebaseAllRuns[sessionId]?.isAborted).toBe(true);
    expect(document.querySelector('[data-rebase-all]')?.textContent).toContain(
      'Stopping after this branch',
    );
  });

  it('lets the behind chip leave once a branch is rebased, even while its status is stale', async () => {
    const ids = await seedBatch();
    await waitFor(() =>
      expect(chipOf('payments-api', /branch hl\/one/)?.textContent).toBe('4 behind'),
    );

    seedRun({ states: ids.map((id, index) => [id, index === 0 ? 'rebased' : 'queued', null]) });
    await settle();

    expect(chipOf('payments-api', /branch hl\/one/)).toBeNull();
    expect(chipOf('payments-api', /branch hl\/two/)?.textContent).toBe('Queued');
  });

  it('names the cause of a failed branch in the row fact card and keeps the line', async () => {
    const ids = await seedBatch();
    seedRun({
      states: ids.map((id, index) => [
        id,
        index === 0 ? 'failed' : 'queued',
        index === 0 ? 'origin cannot be reached' : null,
      ]),
    });
    await settle();

    const row = rowButton('payments-api', /branch hl\/one/);
    fireEvent.pointerEnter(row, { pointerType: 'mouse' });
    await settle();
    expect(row.getAttribute('aria-label')).toContain('branch hl/one');
    expect((await screen.findByTestId('fact-card')).textContent).toContain(
      'origin cannot be reached',
    );
  });

  it('drops Conflict and Failed once git shows an agent finished the rebase and its turn ended', async () => {
    const ids = await seedBatch();
    seedRun({
      states: ids.map((id, index) => [
        id,
        index === 0 ? 'conflict' : index === 1 ? 'failed' : 'rebased',
        index === 1 ? 'origin cannot be reached' : null,
      ]),
      phase: 'done',
    });
    await settle();
    expect(chipOf('payments-api', /branch hl\/one/)?.textContent).toBe('Conflict');
    expect(chipOf('payments-api', /branch hl\/two/)?.textContent).toBe('Failed');

    stubStoryInvoke({
      worktree_status: () => worktreeStatusOf({ behind: 0 }),
      worktree_remote_url: () => 'git@github.com:harborline/payments-api.git',
      detect_editors: () => [],
    });
    await act(async () => {
      await useAppStore.getState().recheckSessionMounts({ sessionId, reason: 'turn-end' });
    });
    await settle();

    expect(chipOf('payments-api', /branch hl\/one/)).toBeNull();
    expect(chipOf('payments-api', /branch hl\/two/)).toBeNull();
    expect(
      useAppStore.getState().rebaseAllRuns[sessionId]?.branches.map((branch) => branch.state),
    ).toEqual(ids.map(() => 'rebased'));
  });

  it('keeps Conflict on a row while git still shows the rebase in progress', async () => {
    const ids = await seedBatch();
    seedRun({ states: ids.map((id) => [id, 'conflict', null]), phase: 'done' });
    await settle();

    stubStoryInvoke({
      worktree_status: () => worktreeStatusOf({ behind: 0, unmerged: 2, inProgress: 'rebase' }),
      worktree_remote_url: () => 'git@github.com:harborline/payments-api.git',
      detect_editors: () => [],
    });
    await act(async () => {
      await useAppStore.getState().recheckSessionMounts({ sessionId, reason: 'turn-end' });
    });
    await settle();

    expect(chipOf('payments-api', /branch hl\/one/)?.textContent).toBe('Conflict');
  });

  it('offers Dismiss in the header once the batch is done and clears every chip', async () => {
    const ids = await seedBatch();
    seedRun({ states: ids.map((id) => [id, 'rebased', null]), phase: 'done' });
    await settle();

    fireEvent.click(within(rebaseAllHeader()).getByRole('button', { name: 'Dismiss' }));
    await settle();

    expect(useAppStore.getState().rebaseAllRuns[sessionId]).toBeUndefined();
    expect(chipOf('payments-api', /branch hl\/two/)?.textContent).toBe('4 behind');
  });
});
describe('the folder cards of the session level', () => {
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

const expandBranch = async (name: string): Promise<void> => {
  const row = worktreeButton(projectRows(name));
  if (row.getAttribute('aria-expanded') === 'true') {
    return;
  }
  await act(async () => {
    fireEvent.click(row);
  });
  await settle();
};

const entryLabels = (list: HTMLElement): ReadonlyArray<string> =>
  [...list.querySelectorAll('[data-entry-label]')].map((label) => label.textContent ?? '');

describe('the worktree pages inside the Projects card', () => {
  it('lists Pull request, Comments, Files, Commits and Checks under a worktree with a pull request', async () => {
    seedTwoProjects({ status: worktreeStatusOf({}) });
    seedChangedFiles({ additions: 652, deletions: 99 });
    await mountRail();
    await expandBranch('payments-api');

    expect(entryLabels(entriesOf('payments-api'))).toEqual([
      'Pull request',
      'Comments',
      'Files',
      'Commits',
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

  it('lists Pull request, Files and Commits under a worktree with no pull request', async () => {
    seed({ status: worktreeStatusOf({}) });
    useAppStore.getState().navigate({ to: sessionPlace({ sessionId }) });
    await mountRail();
    await expandBranch('payments-api');

    expect(entryLabels(entriesOf('payments-api'))).toEqual(['Pull request', 'Files', 'Commits']);
  });

  it('opens the worktree page of an entry directly, on its tab', async () => {
    seedTwoProjects({ status: worktreeStatusOf({}) });
    useAppStore.setState({ setSessionActiveMount: vi.fn(async () => undefined) });
    await mountRail();
    await expandBranch('payments-api');

    await act(async () => {
      fireEvent.click(within(entriesOf('payments-api')).getByRole('button', { name: /^Files/ }));
    });

    expect(useAppStore.getState().activeLens[sessionId]).toBe('branch');
    expect(useAppStore.getState().diffMountPath[sessionId]).toBe(mount.worktreePath);
    expect(useAppStore.getState().branchTab?.[sessionId]).toBe('files');
  });

  it('puts the failing count on the Checks entry and the one chip on its worktree row', async () => {
    seedTwoProjects({ status: worktreeStatusOf({}) });
    await openWorktree();
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
    expect(
      within(worktreeButton(projectRows('payments-api'))).getByTestId('branch-row-chip')
        .textContent,
    ).toBe('1 failing');
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

const branchOpen = (name: string): string | null =>
  worktreeButton(projectRows(name)).getAttribute('aria-expanded');

const prMarkOf = (name: string): Element | null =>
  worktreeButton(projectRows(name)).querySelector('[data-pr-state]');

describe('the Projects tree', () => {
  it('opens folders and closes every branch until one is current, even one that needs you', async () => {
    seedTwoProjects({ status: worktreeStatusOf({}) });
    failChecks({ mountId: mount.mountId, prNumber: 418 });
    await mountRail();

    expect(projectToggle('payments-api').getAttribute('aria-expanded')).toBe('true');
    expect(projectToggle('ledger-core').getAttribute('aria-expanded')).toBe('true');
    expect(branchOpen('payments-api')).toBeNull();
    expect(branchOpen('ledger-core')).toBeNull();
    expect(document.querySelector('[data-worktree-entries]')).toBeNull();
  });

  it('opens the current branch only, and closes it when another branch becomes current', async () => {
    seedTwoProjects({ status: worktreeStatusOf({}) });
    await openWorktree();
    await mountRail();
    expect(branchOpen('payments-api')).toBe('true');
    expect(branchOpen('ledger-core')).toBeNull();

    await expandBranch('ledger-core');

    expect(branchOpen('ledger-core')).toBe('true');
    expect(branchOpen('payments-api')).toBeNull();
    expect(document.querySelectorAll('[data-worktree-entries]')).toHaveLength(1);
  });

  it('toggles a folder and keeps the other one', async () => {
    seedTwoProjects({ status: worktreeStatusOf({}) });
    await mountRail();

    fireEvent.click(projectToggle('payments-api'));
    await settle();

    expect(projectToggle('payments-api').getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByRole('list', { name: 'payments-api worktrees' })).toBeNull();
    expect(projectRows('ledger-core')).toBeDefined();
  });

  it('keeps what you collapsed across a reload, per session', async () => {
    seedTwoProjects({ status: worktreeStatusOf({}) });
    await openWorktree();
    await mountRail();
    fireEvent.click(worktreeButton(projectRows('payments-api')));
    fireEvent.click(projectToggle('ledger-core'));
    await settle();
    cleanup();

    await mountRail();

    expect(projectToggle('ledger-core').getAttribute('aria-expanded')).toBe('false');
    expect(branchOpen('payments-api')).toBe('false');
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
    fireEvent.click(screen.getByRole('button', { name: '1 finished' }));
    await settle();
    const closed = screen
      .getByRole('list', { name: 'Finished branches' })
      .querySelector('[data-pr-state]');

    expect(prMarkOf('payments-api')?.getAttribute('data-pr-state')).toBe('queued');
    expect(prMarkOf('payments-api')?.getAttribute('data-pr-tone')).toBe('primary');
    expect(closed?.getAttribute('data-pr-state')).toBe('closed');
    expect(closed?.getAttribute('data-pr-tone')).toBe('neutral');
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
