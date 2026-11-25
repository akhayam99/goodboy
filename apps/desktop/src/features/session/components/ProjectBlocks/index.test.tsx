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
import { branchTabPlaceOf } from '../../../branch/branchTabPlaceOf';
import { NAMES } from '../../../../shared/utils/names';
import { AutoReleaseContext } from '../../../auto/autoReleaseContext';
import { ObjectMenuProvider } from '../../../actions/components/ObjectMenuProvider';
import {
  COLUMN_SESSION_ID,
  seedCentralColumn,
} from '../../../../app/components/MockScene/scenes/u26/centralColumnSeed';

let useAppStore: Awaited<ReturnType<typeof importStore>>;
let SessionOverviewPane: typeof import('../SessionOverviewPane').SessionOverviewPane;
let registerMockFixtures: typeof import('../../../../shared/lib/mockFixtures').registerMockFixtures;

beforeAll(async () => {
  installFakeResizeObserver();
  Element.prototype.scrollIntoView = vi.fn();
  useAppStore = await importStore();
  ({ SessionOverviewPane } = await import('../SessionOverviewPane'));
  ({ registerMockFixtures } = await import('../../../../shared/lib/mockFixtures'));
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
  const link = screen.getByRole('link', { name: `Open ${branch} overview` });
  const tile = link.closest<HTMLElement>('[data-board-row]');
  if (tile === null) {
    throw new Error('The link must sit in a tile.');
  }
  return tile;
};

const TENANT = 'hl/tenant-limits';

const LEDGER = 'hl/ledger-limits';

const mountIdOf = ({ branch }: TileParams): string => {
  const mount = (useAppStore.getState().sessionProjectMounts[COLUMN_SESSION_ID] ?? []).find(
    (candidate) => candidate.branch === branch,
  );
  if (mount === undefined) {
    throw new Error('The seed must mount the branch.');
  }
  return mount.mountId;
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

const groupDeleteButton = (): HTMLElement => {
  const heads = [...document.querySelectorAll<HTMLElement>('[data-board-project-head]')];
  const [first] = heads.flatMap((head) =>
    within(head).queryAllByRole('button', { name: /^Delete local branch(?:es)?/ }),
  );
  if (first === undefined) {
    throw new Error('A project head must offer Delete local branches.');
  }
  return first;
};

const projects = (): HTMLElement => screen.getByRole('region', { name: 'Projects' });

const nextSection = (): HTMLElement => screen.getByRole('region', { name: 'Next' });

describe('the project blocks on the Overview', () => {
  it('draws one block per project with one row per branch, and no tiles above', async () => {
    seedCentralColumn({ kind: 'branches' });
    await show();

    expect(document.querySelector('[data-slot="session-kpis"]')).toBeNull();
    expect(rowButtons().length).toBeGreaterThan(1);
    const names = [...projects().querySelectorAll('[data-board-project]')].map((block) =>
      block.getAttribute('data-board-project'),
    );
    expect([...names].sort()).toEqual(['ledger-core', 'payments-api']);
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

  it('heads each project block with its name, no row count, and its worktrees door', async () => {
    seedCentralColumn({ kind: 'branches' });
    await show();

    const sections = [...projects().querySelectorAll<HTMLElement>('[data-board-project]')];
    for (const section of sections) {
      const head = section.querySelector('[data-board-project-head]');
      expect(head?.querySelector('[data-board-project-name]')?.textContent).toBe(
        section.getAttribute('data-board-project'),
      );
      expect(head?.querySelector('[data-project-worktrees]')?.textContent).toBe('Worktrees');
      for (const tile of section.querySelectorAll('[data-board-row]')) {
        expect(tile.textContent).not.toContain(section.getAttribute('data-board-project') ?? '');
      }
    }
  });

  it('names the one project once when every branch is from it', async () => {
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
    const board = projects();

    const heads = [...board.querySelectorAll('[data-board-project-head]')];
    expect(
      heads.filter(
        (head) => head.querySelector('[data-board-project-name]')?.textContent === 'payments-api',
      ),
    ).toHaveLength(1);
    expect(board.textContent?.split('payments-api')).toHaveLength(2);
  });

  it('puts the waiting question in Needs you with a filled Answer, never on its tile', async () => {
    seedCentralColumn({ kind: 'branches' });
    const navigate = vi.fn();
    act(() => {
      useAppStore.setState({ navigate });
    });
    await show();

    expect(verbsOf({ tile: tileOf({ branch: TENANT }) })).toHaveLength(0);
    expect(verbsOf({ tile: tileOf({ branch: LEDGER }) })).toHaveLength(0);
    const needsYou = screen.getByRole('region', { name: 'Needs you' });
    const answer = within(needsYou).getByRole('button', { name: 'Answer' });
    expect(answer.getAttribute('data-variant')).toBe('primary');

    fireEvent.click(answer);
    const [call] = navigate.mock.calls;
    expect(call?.[0]).toMatchObject({ to: { view: { lens: 'questions' } } });
  });

  it('shows the first move in Next and never repeats it on the row', async () => {
    seedCentralColumn({ kind: 'branches' });
    act(() => {
      useAppStore.setState({ sessionOpenQuestions: {} });
    });
    await show();

    expect(
      within(nextSection())
        .getAllByRole('button')
        .map((button) => button.textContent),
    ).toContain('Rebase');
    expect(verbsOf({ tile: tileOf({ branch: TENANT }) })).toHaveLength(0);
    expect(tileOf({ branch: TENANT }).querySelector('[data-board-chip]')?.textContent).toBe(
      'static-analysis failed',
    );
  });

  it('names the failing check as the one fact in tone, and keeps the request as text', async () => {
    seedCentralColumn({ kind: 'branches' });
    act(() => {
      useAppStore.setState({ sessionOpenQuestions: {} });
    });
    await show();
    const tenant = tileOf({ branch: TENANT });

    expect(tenant.querySelectorAll('[data-board-chip]')).toHaveLength(1);
    expect(tenant.querySelector('[data-board-chip]')?.textContent).toBe('static-analysis failed');
    expect(
      [...tenant.querySelectorAll('[data-board-facts] button, [data-board-facts] a')].length,
    ).toBe(0);
  });

  it('keeps the full check name in the tooltip of a chip that may cut it', async () => {
    seedCentralColumn({ kind: 'branches' });
    act(() => {
      useAppStore.setState({ sessionOpenQuestions: {} });
    });
    await show();
    const chip = tileOf({ branch: TENANT }).querySelector('[data-board-chip]')?.firstElementChild;

    if (!(chip instanceof HTMLElement)) {
      throw new Error('The chip must be an element.');
    }
    fireEvent.mouseEnter(chip);
    expect((await screen.findByRole('tooltip')).textContent).toBe('static-analysis failed');
  });

  it('holds one target and at most one verb per row, and one door per project head', async () => {
    seedCentralColumn({ kind: 'branches' });
    await show();

    for (const tile of projects().querySelectorAll<HTMLElement>('[data-board-row]')) {
      expect(within(tile).getAllByRole('link')).toHaveLength(1);
      expect(verbsOf({ tile }).length).toBeLessThanOrEqual(1);
    }
    for (const head of projects().querySelectorAll<HTMLElement>('[data-board-project-head]')) {
      const doors = within(head)
        .queryAllByRole('button')
        .filter((button) => {
          const label = button.getAttribute('aria-label') ?? '';
          return (
            !label.startsWith(`${NAMES.unmount} `) && !label.startsWith(`${NAMES.newBranch} in `)
          );
        });
      expect(doors.length).toBeLessThanOrEqual(1);
    }
  });

  it('opens the overview of the branch from its row, by its mount, and leaves the tools alone', async () => {
    seedCentralColumn({ kind: 'branches' });
    const navigate = vi.fn();
    act(() => {
      useAppStore.setState({ navigate });
    });
    await show();
    const before = useAppStore.getState().drawer;

    fireEvent.click(screen.getByRole('link', { name: `Open ${TENANT} overview` }));

    expect(navigate).toHaveBeenCalledWith({
      to: branchTabPlaceOf({
        sessionId: COLUMN_SESSION_ID,
        mountId: mountIdOf({ branch: TENANT }),
        tab: 'pr',
      }),
    });
    expect(useAppStore.getState().drawer).toBe(before);
  });

  it('opens the overview from a row whose chip names no fact too', async () => {
    seedCentralColumn({ kind: 'branches' });
    const navigate = vi.fn();
    act(() => {
      useAppStore.setState({ navigate });
    });
    await show();

    fireEvent.click(screen.getByRole('link', { name: `Open ${LEDGER} overview` }));

    expect(navigate).toHaveBeenCalledWith({
      to: branchTabPlaceOf({
        sessionId: COLUMN_SESSION_ID,
        mountId: mountIdOf({ branch: LEDGER }),
        tab: 'pr',
      }),
    });
  });

  it('opens the changes only from the diff stat and the overview from the rest of the row', async () => {
    seedCentralColumn({ kind: 'branches' });
    registerMockFixtures({
      readers: {
        mountDiffStat: () => ({ additions: 5, deletions: 0 }),
        artifactProvenance: () => null,
      },
    });
    const navigate = vi.fn();
    act(() => {
      useAppStore.setState((store) => ({
        navigate,
        sessionPhaseRuns: {
          ...store.sessionPhaseRuns,
          [COLUMN_SESSION_ID]: (store.sessionPhaseRuns[COLUMN_SESSION_ID] ?? []).map((agent) => ({
            ...agent,
            status: 'completed' as const,
          })),
        },
        sessionWorktreeRecords: {
          ...store.sessionWorktreeRecords,
          [COLUMN_SESSION_ID]: (store.sessionProjectMounts[COLUMN_SESSION_ID] ?? []).map(
            (mount, index) => ({
              id: mount.mountId,
              sessionId: COLUMN_SESSION_ID,
              worktreePath: mount.worktreePath,
              branch: mount.branch,
              parallelIndex: index,
              projectId: mount.projectId,
              mountName: mount.mountName,
              repoSlug: 'harborline/payments-api',
              createdAt: 1,
            }),
          ),
        },
      }));
    });
    await show();
    const mountId = mountIdOf({ branch: TENANT });
    const tile = tileOf({ branch: TENANT });
    const diff = await within(tile).findByRole('button', { name: `Open ${TENANT} in Changes` });
    expect(diff.getAttribute('aria-description')).toBe('5 added, 0 removed');
    fireEvent.click(diff);

    expect(navigate).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenLastCalledWith({
      to: branchTabPlaceOf({ sessionId: COLUMN_SESSION_ID, mountId, tab: 'files' }),
    });

    fireEvent.click(within(tile).getByRole('link', { name: `Open ${TENANT} overview` }));

    expect(navigate).toHaveBeenCalledTimes(2);
    expect(navigate).toHaveBeenLastCalledWith({
      to: branchTabPlaceOf({ sessionId: COLUMN_SESSION_ID, mountId, tab: 'pr' }),
    });
    registerMockFixtures({
      readers: { mountDiffStat: () => null, artifactProvenance: () => null },
    });
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
    const board = projects();

    expect(
      [...board.querySelectorAll('[aria-expanded]')].filter(
        (node) =>
          node.closest('[data-board-actions]') === null &&
          node.closest('[data-section-actions]') === null &&
          !node.hasAttribute('data-project-worktrees') &&
          !node.hasAttribute('data-project-new-branch'),
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

  it('keeps a merged branch in its block with no chip and no button until a cleanup is proposed', async () => {
    seedCentralColumn({ kind: 'branches' });
    await show();

    setRequestState({ state: 'merged' });
    await settle();

    const tenant = tileOf({ branch: TENANT });
    expect(tenant.closest('[data-board-project]')?.getAttribute('data-board-project')).toBe(
      'payments-api',
    );
    expect(tenant.querySelector('[data-board-chip]')).toBeNull();
    expect(tenant.querySelector('[data-board-facts]')?.textContent).toContain('Merged');
    expect(tenant.querySelector('[data-board-facts]')?.textContent).not.toContain('Closed');
    expect(verbsOf({ tile: tenant })).toHaveLength(0);
  });

  it('keeps a closed branch with no chip and no delete, and takes it back when reopened', async () => {
    seedCentralColumn({ kind: 'branches' });
    await show();

    setRequestState({ state: 'closed' });
    await settle();

    const closed = tileOf({ branch: TENANT });
    expect(closed.querySelector('[data-board-chip]')).toBeNull();
    expect(closed.querySelector('[data-board-facts]')?.textContent).toContain('Closed');
    expect(closed.querySelector('[data-board-facts]')?.textContent).not.toContain('Merged');
    expect(verbsOf({ tile: closed })).toHaveLength(0);
    expect(screen.queryAllByRole('button', { name: /^Delete local branch(?:es)?/ })).toHaveLength(
      0,
    );

    setRequestState({ state: 'open' });
    await settle();

    expect(tileOf({ branch: TENANT }).querySelector('[data-board-chip]')).not.toBeNull();
  });

  it('says spend and agent time once, in the facts row, with no tiles', async () => {
    seedCentralColumn({ kind: 'branches' });
    await show();

    expect(document.querySelector('[data-slot="session-kpis"]')).toBeNull();
    const facts = document.querySelector<HTMLElement>('[data-overview-facts]');
    expect(facts).not.toBeNull();
    expect(facts?.querySelectorAll('[data-session-spend]')).toHaveLength(1);
    for (const label of ['Branches', 'Time', 'Questions']) {
      expect(facts?.textContent).not.toContain(label);
    }
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
