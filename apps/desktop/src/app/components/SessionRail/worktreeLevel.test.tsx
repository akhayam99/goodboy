// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () => (await import('../../../store/storyHarness')).dbModuleMock());
vi.mock('../../../shared/lib/db', async () =>
  (await import('../../../store/storyHarness')).dbLibModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { MountId, PullRequestState, WorktreeStatus } from '@goodboy/types';
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
import {
  ledgerCore,
  mountGithubOf,
  mountOf,
  paymentsApi,
  seedColumn,
  sessionOf,
} from '../../../features/workspace/testing/sessionColumn';
import { SessionRail } from './index';

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

describe('the worktree level', () => {
  it('drills in from a worktree row and goes back to the session Overview with its back row', async () => {
    seed({ status: worktreeStatusOf({}) });
    useAppStore.getState().navigate({ to: sessionPlace({ sessionId }) });
    await mountRail();

    const rows = await screen.findByRole('list', { name: 'payments-api worktrees' });
    fireEvent.click(within(rows).getByRole('button'));
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
    expect(line.textContent).toContain('Rebasing on main');
    expect(line.textContent).toContain('1 conflict');
    fireEvent.click(within(line).getByRole('button', { name: 'Abort rebase' }));
    await settle();

    expect(screen.getByRole('group', { name: 'Abort the rebase?' })).toBeDefined();
  });
});

describe('the worktree rows of the session level', () => {
  it('lists each worktree under its project with its number and no dot while it is fine', async () => {
    seedTwoProjects({ status: worktreeStatusOf({}) });
    await mountRail();

    const row = within(projectRows('payments-api')).getByRole('button');
    expect(row.textContent).toBe(`${mount.branch}#418`);
    expect(row.querySelector('[data-worktree-dot] [data-tone]')).toBeNull();
    expect(within(projectRows('ledger-core')).getByRole('button').textContent).toContain('#77');
  });

  it('draws the worst state as one dot named in the row, a failed check above being behind', async () => {
    seedTwoProjects({ status: worktreeStatusOf({ behind: 3 }) });
    patchRequest({ mountId: mount.mountId, patch: { checks: 'failure' } });
    await mountRail();

    await waitFor(() =>
      expect(
        within(projectRows('ledger-core')).getByRole('button').getAttribute('aria-label'),
      ).toContain('3 behind main'),
    );
    expect(
      within(projectRows('payments-api')).getByRole('button').getAttribute('aria-label'),
    ).toContain('A check failed');
  });

  it('folds the finished worktrees of a project into one count row that opens them', async () => {
    seedTwoProjects({ status: worktreeStatusOf({}) });
    patchRequest({ mountId: ledgerMount.mountId, patch: { state: 'merged' } });
    await mountRail();

    const fold = within(projectRows('ledger-core')).getByRole('button', {
      name: '1 finished in ledger-core',
    });
    expect(fold.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByRole('list', { name: 'ledger-core finished worktrees' })).toBeNull();

    fireEvent.click(fold);

    const finished = screen.getByRole('list', { name: 'ledger-core finished worktrees' });
    expect(within(finished).getByRole('button').textContent).toContain(ledgerMount.branch);
  });

  it('adds from one Add word: a project, a workspace project or a new branch in each repo', async () => {
    seedTwoProjects({ status: worktreeStatusOf({}) });
    await mountRail();

    fireEvent.click(screen.getByRole('button', { name: 'Add to this session' }));
    const panel = within(screen.getByRole('dialog', { name: 'Add to this session' }));
    const labels = panel.getAllByRole('button').map((item) => item.textContent ?? '');
    expect(labels).toEqual([
      'Add project',
      'Add workspace project',
      'New branch in payments-api',
      'New branch in ledger-core',
    ]);

    fireEvent.click(panel.getByRole('button', { name: 'New branch in ledger-core' }));
    await settle();
    await settle();

    expect(await screen.findByRole('dialog', { name: 'New branch in ledger-core' })).toBeDefined();
  });
});
