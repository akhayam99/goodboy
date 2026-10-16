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
import type { WorktreeStatus } from '@goodboy/types';
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
  harborline,
  mountOf,
  paymentsApi,
  seedColumn,
  sessionOf,
} from '../../../features/workspace/testing/sessionColumn';
import type { ColumnActions } from './columnDoors';
import { SideColumn } from './index';

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

const actions = (): ColumnActions => ({
  openBoard: vi.fn(),
  openInbox: vi.fn(),
  openChat: vi.fn(),
  openWorkflows: vi.fn(),
  openTerminalStudio: vi.fn(),
  openNewChat: vi.fn(),
  openNewTerminal: vi.fn(),
  openMonitoring: vi.fn(),
  openSettings: vi.fn(),
  openChangelog: vi.fn(),
  openGuide: vi.fn(),
  openShortcuts: vi.fn(),
});

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
  });
};

const settle = async (): Promise<void> => {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
};

const mountColumn = async (): Promise<void> => {
  render(
    <ToastProvider>
      <SideColumn
        scope="workspace"
        workspaceId={harborline.id}
        currentSessionId={sessionId}
        place={null}
        isCollapsed={false}
        actions={actions()}
        onToggle={vi.fn()}
      />
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
    await mountColumn();

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

  it('goes up one level on Command [ while the sidebar has focus', async () => {
    seed({ status: worktreeStatusOf({}) });
    await mountColumn();
    await openWorktree();

    fireEvent.keyDown(worktreeLayer(), { key: '[', metaKey: true });
    await settle();

    expect(useAppStore.getState().activeLens[sessionId] ?? null).toBeNull();
  });

  it('holds the mount actions in a visible menu, with Link work to this branch and no Rebase', async () => {
    seed({ status: worktreeStatusOf({}) });
    await mountColumn();
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
    await mountColumn();
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
    await mountColumn();
    await openWorktree();

    expect(worktreeLayer().querySelector('[data-worktree-status]')).toBeNull();
  });

  it('says how far behind the branch is and rebases it once from the status line', async () => {
    const rebaseBranch = vi.fn(async () => 'rebased' as const);
    seed({ status: worktreeStatusOf({ behind: 6 }) });
    useAppStore.setState({ rebaseBranch });
    await mountColumn();
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
    await mountColumn();
    await openWorktree();

    const line = await waitFor(statusLine);
    expect(line.textContent).toContain('Rebasing on main');
    expect(line.textContent).toContain('1 conflict');
    fireEvent.click(within(line).getByRole('button', { name: 'Abort rebase' }));
    await settle();

    expect(screen.getByRole('group', { name: 'Abort the rebase?' })).toBeDefined();
  });
});
