// @vitest-environment happy-dom
vi.hoisted(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 18, 10, 31, 0));
});

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { brandId } from '@goodboy/types';
import type { IsoDateTime, MountCleanupProposal } from '@goodboy/types';
import { ToastProvider } from '../../../../shared/components/Toast';
import {
  importStore,
  resetStoryStore,
  storySpies,
  STORE_IMPORT_TIMEOUT_MS,
} from '../../../../store/storyHarness';
import { installFakeResizeObserver } from '../../../../test/fakeResizeObserver';
import { sceneInvoke, clearSceneInvoke } from '../../../../test/sceneInvoke';
import { resetWorktreeStatusCache } from '../../../../store/runtime/worktreeStatuses/cache';
import { AutoReleaseContext } from '../../../auto/autoReleaseContext';
import {
  COLUMN_SESSION_ID,
  seedCentralColumn,
} from '../../../../app/components/MockScene/scenes/u26/centralColumnSeed';

let useAppStore: Awaited<ReturnType<typeof importStore>>;
let SessionOverviewPane: typeof import('../SessionOverviewPane').SessionOverviewPane;

beforeAll(async () => {
  installFakeResizeObserver();
  Element.prototype.scrollIntoView = vi.fn();
  useAppStore = await importStore();
  ({ SessionOverviewPane } = await import('../SessionOverviewPane'));
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  window.localStorage.clear();
  await resetStoryStore();
  resetWorktreeStatusCache();
  clearSceneInvoke();
  storySpies.tauriInvoke.mockImplementation((command, args) => {
    if (typeof command !== 'string') {
      throw new Error('The scene command must be a string.');
    }
    return sceneInvoke({ command, args });
  });
});

afterEach(cleanup);

afterAll(() => {
  vi.useRealTimers();
});

const mountedSession = () => {
  const session = useAppStore
    .getState()
    .sessions.find((candidate) => candidate.id === COLUMN_SESSION_ID);
  if (session === undefined) {
    throw new Error('The seed must hold the session');
  }
  return session;
};

const settle = async () => {
  await act(async () => {
    await Promise.resolve();
  });
};

type StateParams = {
  readonly state: 'merged' | 'closed' | 'open';
};

const setRequestState = ({ state }: StateParams) => {
  act(() => {
    useAppStore.setState((store) => ({
      sessionGithub: Object.fromEntries(
        Object.entries(store.sessionGithub).map(([id, github]) => [
          id,
          github.pr === null ? github : { ...github, pr: { ...github.pr, state } },
        ]),
      ),
      mountGithub: Object.fromEntries(
        Object.entries(store.mountGithub).map(([id, github]) => [
          id,
          {
            ...github,
            pr: github.pr === null ? null : { ...github.pr, state },
            prs: github.prs.map((pr) => ({ ...pr, state })),
          },
        ]),
      ),
    }));
  });
};

const element = () => (
  <ToastProvider>
    <AutoReleaseContext.Provider value>
      <SessionOverviewPane session={mountedSession()} />
    </AutoReleaseContext.Provider>
  </ToastProvider>
);

const show = async () => {
  const view = render(element());
  await settle();
  return view;
};

const rowButtons = () => [
  ...document.querySelectorAll<HTMLButtonElement>('[data-board-row] button[aria-expanded]'),
];

const firstRowButton = (): HTMLButtonElement => {
  const [first] = rowButtons();
  if (first === undefined) {
    throw new Error('The board must hold a row.');
  }
  return first;
};

type ProposalsParams = {
  readonly sizeBytes: number | null;
};

const proposalsOf = ({ sizeBytes }: ProposalsParams): ReadonlyArray<MountCleanupProposal> =>
  (useAppStore.getState().sessionProjectMounts[COLUMN_SESSION_ID] ?? []).map((mount, index) => ({
    requestId: `request-${index}`,
    sessionId: COLUMN_SESSION_ID,
    mountId: mount.mountId,
    projectId: null,
    reason: 'merge_cleanup',
    repoRoot: '/repo',
    worktreePath: mount.worktreePath,
    branch: mount.branch,
    sizeBytes,
    request: null,
    createdAt: brandId<IsoDateTime>({ value: '2026-10-18T10:00:00.000Z' }),
  }));

describe('the branch board on the Overview', () => {
  it('draws five tiles above a board with one row per branch', async () => {
    seedCentralColumn({ kind: 'branches' });
    await show();

    const tiles = document.querySelector('[data-slot="session-kpis"]');
    expect(tiles?.children).toHaveLength(5);
    expect(rowButtons().length).toBeGreaterThan(1);
    screen.getByRole('region', { name: 'Branches' });
  });

  it('opens a row on a click and keeps the scroll of its container', async () => {
    seedCentralColumn({ kind: 'branches' });
    const { container } = await show();
    const scroller = document.createElement('div');
    scroller.scrollTop = 0;
    container.appendChild(scroller);
    const first = firstRowButton();
    expect(first.getAttribute('aria-expanded')).toBe('false');

    fireEvent.click(first);

    expect(first.getAttribute('aria-expanded')).toBe('true');
    expect(document.querySelector('[data-slot="branch-work"]')).not.toBeNull();
    expect(scroller.scrollTop).toBe(0);
  });

  it('keeps a row open when it changes group', async () => {
    seedCentralColumn({ kind: 'finished' });
    await show();
    const first = firstRowButton();
    fireEvent.click(first);
    expect(first.getAttribute('aria-expanded')).toBe('true');

    setRequestState({ state: 'merged' });
    await settle();

    const after = rowButtons().find((button) => button.getAttribute('aria-expanded') === 'true');
    expect(after).toBeDefined();
    expect(after?.closest('[data-board-group]')?.getAttribute('data-board-group')).toBe('merged');
  });

  it('reopens the last row after a reload', async () => {
    seedCentralColumn({ kind: 'branches' });
    const view = await show();
    const first = firstRowButton();
    fireEvent.click(first);
    const name = first.getAttribute('aria-label');
    view.unmount();

    await show();

    const reopened = rowButtons().find((button) => button.getAttribute('aria-label') === name);
    expect(reopened?.getAttribute('aria-expanded')).toBe('true');
  });

  it('filters the board with Needs you and Clear, and the line says so', async () => {
    seedCentralColumn({ kind: 'branches' });
    await show();
    const before = rowButtons().length;

    fireEvent.click(screen.getByRole('button', { name: /Needs you/ }));
    const needsLine = document.querySelector<HTMLElement>('[data-board-filter="needs-you"]');
    if (needsLine === null) {
      throw new Error('The filter line must show.');
    }
    expect(needsLine.textContent).toContain('Needs you');
    expect(rowButtons().length).toBeLessThanOrEqual(before);

    fireEvent.click(within(needsLine).getByRole('button', { name: 'Clear' }));
    expect(document.querySelector('[data-board-filter]')).toBeNull();
    expect(rowButtons()).toHaveLength(before);
  });

  it('names each worktree before Remove worktrees acts, and removes one by one', async () => {
    seedCentralColumn({ kind: 'branches' });
    setRequestState({ state: 'merged' });
    const resolveMountCleanup = vi.fn(async () => undefined);
    const proposals = proposalsOf({ sizeBytes: 1024 });
    act(() => {
      useAppStore.setState({
        mountCleanupProposals: { [COLUMN_SESSION_ID]: proposals },
        resolveMountCleanup,
      });
    });
    await show();

    fireEvent.click(screen.getByRole('button', { name: /^Remove \d worktrees?/ }));

    const mergedIds = Object.keys(useAppStore.getState().mountGithub);
    const merged = proposals.filter((proposal) => mergedIds.includes(proposal.mountId));
    expect(merged.length).toBeGreaterThan(0);
    for (const proposal of merged) {
      expect(document.body.textContent).toContain(proposal.branch);
    }
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /^Remove worktrees?$/ }));
      await Promise.resolve();
    });
    await vi.waitFor(() => expect(resolveMountCleanup).toHaveBeenCalledTimes(merged.length));
  });

  it('keeps a worktree that failed with its reason and offers Retry for what is left', async () => {
    seedCentralColumn({ kind: 'branches' });
    setRequestState({ state: 'merged' });
    const resolveMountCleanup = vi.fn(async () => {
      throw new Error('The folder is in use.');
    });
    const proposals = proposalsOf({ sizeBytes: null });
    act(() => {
      useAppStore.setState({
        mountCleanupProposals: { [COLUMN_SESSION_ID]: proposals },
        resolveMountCleanup,
      });
    });
    await show();

    fireEvent.click(screen.getByRole('button', { name: /^Remove \d worktrees?/ }));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /^Remove worktrees?$/ }));
      await Promise.resolve();
    });

    await vi.waitFor(() => expect(screen.getAllByRole('alert').length).toBeGreaterThan(0));
    expect(document.body.textContent).toContain('The folder is in use.');
    screen.getByRole('button', { name: /^Retry removing \d worktrees?/ });
  });
});
