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
import type { ReportErrorsParams } from '../../../../store/slices/notifications/reportErrors';
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
import { ObjectMenuProvider } from '../../../actions/components/ObjectMenuProvider';
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
    <ObjectMenuProvider>
      <AutoReleaseContext.Provider value>
        <SessionOverviewPane session={mountedSession()} />
      </AutoReleaseContext.Provider>
    </ObjectMenuProvider>
  </ToastProvider>
);

type VerbsParams = {
  readonly tile: HTMLElement;
};

const verbsOf = ({ tile }: VerbsParams): ReadonlyArray<HTMLElement> =>
  within(tile)
    .queryAllByRole('button')
    .filter((button) => button.closest('[data-board-actions]') === null);

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

const groupDeleteButton = (): HTMLElement => {
  const group = document.querySelector<HTMLElement>('[data-board-group="merged"]');
  if (group === null) {
    throw new Error('The merged group must show.');
  }
  const [first] = within(group).getAllByRole('button', { name: /^Delete local branch(?:es)?/ });
  if (first === undefined) {
    throw new Error('The merged group must offer Delete local branches.');
  }
  return first;
};

describe('the branch board on the Overview', () => {
  it('draws three tiles above a board with one row per branch', async () => {
    seedCentralColumn({ kind: 'branches' });
    await show();

    const tiles = document.querySelector('[data-slot="session-kpis"]');
    expect(tiles?.children).toHaveLength(3);
    expect(rowButtons().length).toBeGreaterThan(1);
    screen.getByRole('region', { name: 'Branches' });
  });

  it('draws one tile per branch under its project: its name and one state chip', async () => {
    seedCentralColumn({ kind: 'branches' });
    await show();

    const tenant = tileOf({ branch: TENANT });
    expect(tenant.closest('[data-board-project]')?.getAttribute('data-board-project')).toBe(
      'payments-api',
    );
    expect(tenant.textContent).not.toContain('payments-api');
    expect(tenant.querySelectorAll('[data-board-chip]')).toHaveLength(1);
    expect(tenant.querySelector('[data-board-chip]')?.textContent).toBe('Asks you');
    await vi.waitFor(() =>
      expect(tileOf({ branch: TENANT }).querySelector('[data-board-facts]')?.textContent).toBe(
        'PR #309 · 1 question waits',
      ),
    );
    const ledger = tileOf({ branch: LEDGER });
    expect(ledger.closest('[data-board-project]')?.getAttribute('data-board-project')).toBe(
      'ledger-core',
    );
    expect(ledger.querySelector('[data-board-chip]')?.textContent).toBe('Running');
  });

  it('groups the branches of two projects under one quiet head each, with its count', async () => {
    seedCentralColumn({ kind: 'branches' });
    await show();
    const board = screen.getByRole('region', { name: 'Branches' });

    const sections = [...board.querySelectorAll<HTMLElement>('[data-board-project]')];
    const names = new Set(sections.map((section) => section.getAttribute('data-board-project')));
    expect([...names].sort()).toEqual(['ledger-core', 'payments-api']);
    for (const section of sections) {
      const head = section.querySelector('[data-board-project-head]');
      const tiles = section.querySelectorAll('[data-board-row]');
      expect(head?.textContent).toBe(
        `${section.getAttribute('data-board-project')}${tiles.length}`,
      );
      for (const tile of tiles) {
        expect(tile.textContent).not.toContain(section.getAttribute('data-board-project') ?? '');
      }
    }
  });

  it('names the one project once above the board when every branch is from it', async () => {
    seedCentralColumn({ kind: 'branches' });
    const tenant = (useAppStore.getState().sessionProjectMounts[COLUMN_SESSION_ID] ?? []).find(
      (mount) => mount.branch === TENANT,
    );
    act(() => {
      useAppStore.setState((store) => ({
        sessionProjectMounts: {
          ...store.sessionProjectMounts,
          [COLUMN_SESSION_ID]: (store.sessionProjectMounts[COLUMN_SESSION_ID] ?? []).filter(
            (mount) => mount.projectId === tenant?.projectId,
          ),
        },
      }));
    });
    await show();
    const board = screen.getByRole('region', { name: 'Branches' });

    expect(board.querySelectorAll('[data-board-project]')).toHaveLength(0);
    const heads = [...board.querySelectorAll('[data-board-project-head]')];
    expect(heads.map((head) => head.textContent)).toEqual(['payments-api']);
    expect(board.textContent?.split('payments-api')).toHaveLength(2);
  });

  it('carries one button at most: Answer before the Rebase that also waits', async () => {
    seedCentralColumn({ kind: 'branches' });
    const navigate = vi.fn();
    act(() => {
      useAppStore.setState({ navigate });
    });
    await show();

    const tenant = verbsOf({ tile: tileOf({ branch: TENANT }) });
    expect(tenant.map((button) => button.textContent)).toEqual(['Answer']);
    expect(verbsOf({ tile: tileOf({ branch: LEDGER }) })).toHaveLength(0);

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

    const tenant = verbsOf({ tile: tileOf({ branch: TENANT }) });
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

    expect(
      [...board.querySelectorAll('[aria-expanded]')].filter(
        (node) => node.closest('[data-board-actions]') === null,
      ),
    ).toHaveLength(0);
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

  it('moves a tile to Merged with no chip and no button until a cleanup is proposed', async () => {
    seedCentralColumn({ kind: 'branches' });
    await show();

    setRequestState({ state: 'merged' });
    await settle();

    const tenant = tileOf({ branch: TENANT });
    expect(tenant.closest('[data-board-group]')?.getAttribute('data-board-group')).toBe('merged');
    expect(tenant.querySelector('[data-board-chip]')).toBeNull();
    expect(verbsOf({ tile: tenant })).toHaveLength(0);
  });

  it('moves a tile to Closed with no chip, then back out when the request is reopened', async () => {
    seedCentralColumn({ kind: 'branches' });
    await show();

    setRequestState({ state: 'closed' });
    await settle();

    const closed = tileOf({ branch: TENANT });
    expect(closed.closest('[data-board-group]')?.getAttribute('data-board-group')).toBe('closed');
    expect(closed.querySelector('[data-board-chip]')).toBeNull();
    expect(verbsOf({ tile: closed })).toHaveLength(0);
    expect(document.querySelector('[data-board-group="merged"]')).toBeNull();
    expect(screen.queryAllByRole('button', { name: /^Delete local branch(?:es)?/ })).toHaveLength(
      0,
    );

    setRequestState({ state: 'open' });
    await settle();

    const reopened = tileOf({ branch: TENANT });
    expect(reopened.closest('[data-board-group]')?.getAttribute('data-board-group')).not.toBe(
      'closed',
    );
    expect(document.querySelector('[data-board-group="closed"]')).toBeNull();
  });

  it('shows Branches, Spend and Time tiles and leaves Questions and Artifacts to the tabs', async () => {
    seedCentralColumn({ kind: 'branches' });
    await show();
    const tiles = document.querySelector<HTMLElement>('[data-slot="session-kpis"]');
    if (tiles === null) {
      throw new Error('The tiles must show.');
    }
    const text = tiles.textContent ?? '';

    for (const label of ['Branches', 'Spend', 'Time']) {
      expect(text).toContain(label);
    }
    for (const label of ['Questions', 'Artifacts', 'Checks', 'Needs you', 'Agents working']) {
      expect(text).not.toContain(label);
    }
    expect(within(tiles).queryAllByRole('button')).toHaveLength(0);
  });

  it('names each branch before Delete local branches acts, deletes each, and offers one Undo', async () => {
    seedCentralColumn({ kind: 'branches' });
    setRequestState({ state: 'merged' });
    const runAfterMergeCleanup = vi.fn();
    runAfterMergeCleanup.mockImplementation(async ({ mountId }) => ({
      kind: 'deleted',
      deleted: { id: `deleted-${String(mountId)}` },
    }));
    const settleMountCleanup = vi.fn(async () => undefined);
    const undoable = vi.fn(() => 'undo-1');
    const proposals = proposalsOf({ sizeBytes: 1024 });
    act(() => {
      useAppStore.setState({
        mountCleanupProposals: { [COLUMN_SESSION_ID]: proposals },
        runAfterMergeCleanup,
        settleMountCleanup,
        undoable,
      });
    });
    await show();

    fireEvent.click(groupDeleteButton());

    const mergedIds = Object.keys(useAppStore.getState().mountGithub);
    const merged = proposals.filter((proposal) => mergedIds.includes(proposal.mountId));
    expect(merged.length).toBeGreaterThan(0);
    for (const proposal of merged) {
      expect(document.body.textContent).toContain(proposal.branch);
    }
    await act(async () => {
      fireEvent.click(
        within(screen.getByRole('dialog')).getByRole('button', {
          name: /^Delete local branch(?:es)?$/,
        }),
      );
      await Promise.resolve();
    });
    await vi.waitFor(() => expect(runAfterMergeCleanup).toHaveBeenCalledTimes(merged.length));
    expect(runAfterMergeCleanup).toHaveBeenCalledWith(
      expect.objectContaining({ isRequested: true, expectedBranch: merged[0]?.branch }),
    );
    await vi.waitFor(() => expect(undoable).toHaveBeenCalledTimes(1));
    expect(settleMountCleanup).toHaveBeenCalledTimes(merged.length);
  });

  it('logs failed deletes as one row with one Retry, and leaves the board as it was', async () => {
    seedCentralColumn({ kind: 'branches' });
    setRequestState({ state: 'merged' });
    const runAfterMergeCleanup = vi.fn(async () => {
      throw new Error('The folder is in use.');
    });
    const reportErrors = vi.fn(async (_params: ReportErrorsParams) => undefined);
    const undoable = vi.fn(() => 'undo-1');
    const proposals = proposalsOf({ sizeBytes: null });
    act(() => {
      useAppStore.setState({
        mountCleanupProposals: { [COLUMN_SESSION_ID]: proposals },
        runAfterMergeCleanup,
        reportErrors,
        undoable,
      });
    });
    await show();

    fireEvent.click(groupDeleteButton());
    await act(async () => {
      fireEvent.click(
        within(screen.getByRole('dialog')).getByRole('button', {
          name: /^Delete local branch(?:es)?$/,
        }),
      );
      await Promise.resolve();
    });

    await vi.waitFor(() => expect(reportErrors).toHaveBeenCalledTimes(1));
    const reported = reportErrors.mock.calls[0]?.[0];
    const count = reported?.failures.length ?? 0;
    expect(count).toBeGreaterThan(0);
    expect(reported?.groupTitleOf({ count: 2 })).toBe("Couldn't delete 2 local branches");
    expect(reported?.failures[0]?.title).toMatch(/^Couldn't delete the local branch /);
    expect(undoable).not.toHaveBeenCalled();
    expect(screen.queryByText('The folder is in use.')).toBeNull();
    groupDeleteButton();

    runAfterMergeCleanup.mockClear();
    await act(async () => {
      expect(await reported?.retry?.()).toBe(false);
    });
    expect(runAfterMergeCleanup).toHaveBeenCalledTimes(count);
  });
});
