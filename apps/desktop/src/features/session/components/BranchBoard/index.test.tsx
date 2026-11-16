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
import userEvent from '@testing-library/user-event';
import { branchPlace } from '../../../../store/slices/navigation/place';
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
  ...document.querySelectorAll<HTMLButtonElement>('[data-board-row] button[role="link"]'),
];

const firstRowButton = (): HTMLButtonElement => {
  const [first] = rowButtons();
  if (first === undefined) {
    throw new Error('The board must hold a row.');
  }
  return first;
};

type TileParams = {
  readonly branch: string;
};

const tileOf = ({ branch }: TileParams): HTMLElement => {
  const link = screen.getByRole('link', { name: `Open ${branch}` });
  const tile = link.closest<HTMLElement>('[data-board-row]');
  if (tile === null) {
    throw new Error('The link must sit in a tile.');
  }
  return tile;
};

const TENANT = 'ak/eng-1190-tenant-limits';

const LEDGER = 'ak/eng-1190-ledger-limits';

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

  it('draws one tile per branch: its name, its project and one state chip', async () => {
    seedCentralColumn({ kind: 'branches' });
    await show();

    const tenant = tileOf({ branch: TENANT });
    expect(tenant.textContent).toContain('payments-api');
    expect(tenant.querySelectorAll('[data-board-chip]')).toHaveLength(1);
    expect(tenant.querySelector('[data-board-chip]')?.textContent).toBe('Waits for you');
    await vi.waitFor(() =>
      expect(tileOf({ branch: TENANT }).querySelector('[data-board-facts]')?.textContent).toBe(
        'PR #309 · 1 question waits',
      ),
    );
    const ledger = tileOf({ branch: LEDGER });
    expect(ledger.textContent).toContain('ledger-core');
    expect(ledger.querySelector('[data-board-chip]')?.textContent).toBe('Running');
  });

  it('carries one button at most: Answer before the Rebase that also waits', async () => {
    seedCentralColumn({ kind: 'branches' });
    const navigate = vi.fn();
    act(() => {
      useAppStore.setState({ navigate });
    });
    await show();

    const tenant = within(tileOf({ branch: TENANT })).getAllByRole('button');
    expect(tenant.map((button) => button.textContent)).toEqual(['Answer']);
    expect(within(tileOf({ branch: LEDGER })).queryAllByRole('button')).toHaveLength(0);

    const [answer] = tenant;
    fireEvent.click(answer ?? document.body);
    const [call] = navigate.mock.calls;
    expect(call?.[0]).toMatchObject({ to: { view: { lens: 'questions' } } });
  });

  it('carries the first verb of the branch when nothing is asked there', async () => {
    seedCentralColumn({ kind: 'branches' });
    act(() => {
      useAppStore.setState({ sessionOpenQuestions: {} });
    });
    await show();

    const tenant = within(tileOf({ branch: TENANT })).getAllByRole('button');
    expect(tenant.map((button) => button.textContent)).toEqual(['Rebase']);
    expect(tileOf({ branch: TENANT }).querySelector('[data-board-chip]')?.textContent).toBe(
      'Checks failing',
    );
  });

  it('opens the branch page on Conversation from the tile, and leaves the tools alone', async () => {
    seedCentralColumn({ kind: 'branches' });
    const navigate = vi.fn();
    act(() => {
      useAppStore.setState({ navigate });
    });
    await show();
    const before = useAppStore.getState().drawer;
    const mount = (useAppStore.getState().sessionProjectMounts[COLUMN_SESSION_ID] ?? []).find(
      (candidate) => candidate.branch === TENANT,
    );

    fireEvent.click(screen.getByRole('link', { name: `Open ${TENANT}` }));

    expect(navigate).toHaveBeenCalledWith({
      to: branchPlace({
        sessionId: COLUMN_SESSION_ID,
        mountPath: mount?.worktreePath ?? null,
        tab: 'pr',
      }),
    });
    expect(useAppStore.getState().drawer).toBe(before);
  });

  it('reaches the tile and its button as two stops, and Enter on the tile opens it', async () => {
    seedCentralColumn({ kind: 'branches' });
    const navigate = vi.fn();
    act(() => {
      useAppStore.setState({ navigate });
    });
    await show();
    const tile = tileOf({ branch: TENANT });
    const link = within(tile).getByRole('link');
    const [action] = within(tile).getAllByRole('button');
    const user = userEvent.setup();

    act(() => {
      link.focus();
    });
    await user.tab();
    expect(document.activeElement).toBe(action);
    expect(link.contains(action ?? null)).toBe(false);

    act(() => {
      link.focus();
    });
    await user.keyboard('{Enter}');
    expect(navigate).toHaveBeenCalledTimes(1);
  });

  it('shows no chevron, no open row and none of the lists or doors of the old row', async () => {
    seedCentralColumn({ kind: 'branches' });
    await show();
    const board = screen.getByRole('region', { name: 'Branches' });

    expect(board.querySelector('[aria-expanded]')).toBeNull();
    expect(document.querySelector('[data-slot="branch-work"]')).toBeNull();
    for (const word of [
      'Also waiting for you',
      'Terminal here',
      'Browser here',
      'Start a run on this branch',
      'Open the PR page',
    ]) {
      expect(board.textContent).not.toContain(word);
    }
  });

  it('moves a tile to Merged with the Merged chip and no button until a cleanup is proposed', async () => {
    seedCentralColumn({ kind: 'branches' });
    await show();

    setRequestState({ state: 'merged' });
    await settle();

    const tenant = tileOf({ branch: TENANT });
    expect(tenant.closest('[data-board-group]')?.getAttribute('data-board-group')).toBe('merged');
    expect(tenant.querySelector('[data-board-chip]')?.textContent).toBe('Merged');
    expect(within(tenant).queryAllByRole('button')).toHaveLength(0);
  });

  it('shows Questions, Artifacts, Spend and Time tiles and no Checks or Needs you tile', async () => {
    seedCentralColumn({ kind: 'branches' });
    await show();
    const tiles = document.querySelector<HTMLElement>('[data-slot="session-kpis"]');
    if (tiles === null) {
      throw new Error('The tiles must show.');
    }
    const text = tiles.textContent ?? '';

    for (const label of ['Branches', 'Questions', 'Artifacts', 'Spend', 'Time']) {
      expect(text).toContain(label);
    }
    expect(text).not.toContain('Checks');
    expect(text).not.toContain('Needs you');
    expect(text).not.toContain('Agents working');
  });

  it('filters the board with Questions and Clear, and the line says so', async () => {
    seedCentralColumn({ kind: 'branches' });
    await show();
    const before = rowButtons().length;

    fireEvent.click(screen.getByRole('button', { name: /Questions/ }));
    const needsLine = document.querySelector<HTMLElement>('[data-board-filter="questions"]');
    if (needsLine === null) {
      throw new Error('The filter line must show.');
    }
    expect(needsLine.textContent).toMatch(/open question/);
    expect(rowButtons().length).toBeLessThanOrEqual(before);
    if (rowButtons().length === 0) {
      expect(document.querySelector('[data-board-group]')).toBeNull();
      expect(needsLine.getAttribute('data-board-filter-empty')).toBe('true');
    }

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
      fireEvent.click(
        within(screen.getByRole('dialog')).getByRole('button', { name: /^Remove worktrees?$/ }),
      );
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
      fireEvent.click(
        within(screen.getByRole('dialog')).getByRole('button', { name: /^Remove worktrees?$/ }),
      );
      await Promise.resolve();
    });

    await vi.waitFor(() => expect(screen.getAllByRole('alert').length).toBeGreaterThan(0));
    expect(document.body.textContent).toContain('The folder is in use.');
    screen.getByRole('button', { name: /^Retry removing \d worktrees?/ });
  });
});
