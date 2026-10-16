// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { HistoryPlanPrediction, HistoryStep, MountId, SessionId } from '@goodboy/types';
import {
  combineInto,
  initialPlanItems,
  moveAbove,
  resetStep,
  rewordStep,
  setCombineMode,
  setVerb,
} from '../../historyPlan';
import { LEDGER, LEDGER_COMMITS, LEDGER_GRAPH } from '../../testing/ledgerFixture';
import { LEDGER_PRESET } from '../../testing/ledgerPreset';
import { HISTORY_FOCUS_BASE_EVENT, diffEventName } from '../../../actions/kinds/diff';
import { historyBackupRef } from '../../historyBackupRef';
import { installFakeResizeObserver } from '../../../../test/fakeResizeObserver';

vi.useFakeTimers({ toFake: ['Date'] });
vi.setSystemTime(new Date(2026, 8, 30, 12, 0, 0));

type ChangeLiveInput = {
  readonly items?: ReadonlyArray<HistoryStep>;
};

const BACKUP_REF = historyBackupRef({ branch: 'hl/ledger-export', atMs: Date.now() });

const SESSION_ID = 'session-ledger' as SessionId;
const MOUNT_ID = 'mount-ledger' as MountId;
const BASE = initialPlanItems({ commits: LEDGER_COMMITS });
const { a, b, c, d, x, e, f } = LEDGER;

const extra = vi.hoisted(
  (): { backups: ReadonlyArray<unknown>; branches: ReadonlyArray<string> } => ({
    backups: [],
    branches: ['main', 'release/2.4'],
  }),
);

const h = vi.hoisted(() => ({
  state: {} as Record<string, unknown>,
  width: 1000 as number | null,
  chosenBase: 'main' as string | null,
  status: {
    upstream: 'origin/hl/ledger-export',
    workingTree: { kind: 'known', staged: 0, unstaged: 0, untracked: 0, unmerged: 0, changed: 0 },
  } as Record<string, unknown>,
}));

vi.mock('../../../../store', () => ({
  useAppStore: Object.assign(
    <T,>(selector: (state: Record<string, unknown>) => T) => selector(h.state),
    { getState: () => h.state, subscribe: () => () => undefined },
  ),
}));

vi.mock('../../../../store/slices/project-mounts/selectors', () => ({
  selectMountForPath: () => ({
    mountId: MOUNT_ID,
    mountName: 'payments-api',
    branch: 'hl/ledger-export',
    baseBranch: 'main',
    worktreePath: '/w/payments',
  }),
  selectMountBaseBranch: () => h.chosenBase,
}));

vi.mock('../../historyEngine', async () => {
  const actual = await vi.importActual<typeof import('../../historyEngine')>('../../historyEngine');
  return { ...actual, listHistoryBackups: vi.fn(async () => extra.backups) };
});

vi.mock('../../../worktree/worktree', async () => {
  const actual = await vi.importActual<typeof import('../../../worktree/worktree')>(
    '../../../worktree/worktree',
  );
  return { ...actual, listBranchNames: vi.fn(async () => extra.branches) };
});

vi.mock('../../../session/hooks/useWorktreeStatuses', () => ({
  useWorktreeStatuses: () => new Map([['/w/payments', h.status]]),
}));

vi.mock('../../../../shared/hooks/useElementWidth', () => ({
  useElementWidth: () => ({ ref: () => undefined, width: h.width }),
}));

vi.mock('./historyRowLine', async () => {
  const actual = await vi.importActual<typeof import('./historyRowLine')>('./historyRowLine');
  return { ...actual, historyRowLine: vi.fn(actual.historyRowLine) };
});

import { CommitsHistory } from './index';
import { historyRowLine } from './historyRowLine';

const clean = (items: ReadonlyArray<HistoryStep>): HistoryPlanPrediction => ({
  isSupported: true,
  steps: items.map((step) => ({ sha: step.sha, outcome: 'clean', files: [], newSha: null })),
  head: 'new-head',
  isTreeEqual: true,
  changedFiles: [],
});

type Setup = {
  readonly items?: ReadonlyArray<HistoryStep>;
  readonly prediction?: HistoryPlanPrediction;
  readonly run?: unknown;
  readonly onto?: string | null;
  readonly graph?: typeof LEDGER_GRAPH;
  readonly commits?: typeof LEDGER_COMMITS;
};

const seed = ({
  items = BASE,
  prediction,
  run = null,
  onto = null,
  graph = LEDGER_GRAPH,
  commits = LEDGER_COMMITS,
}: Setup = {}) => {
  const actions = {
    loadHistoryDraft: vi.fn(async () => undefined),
    editHistoryDraft: vi.fn(
      async (input: { readonly items: ReadonlyArray<HistoryStep> }): Promise<void> => {
        void input;
      },
    ),
    undoHistoryDraft: vi.fn(async () => true),
    discardHistoryDraft: vi.fn(async () => undefined),
    applyHistoryDraft: vi.fn(async () => 'applied'),
    applyRewrittenHistory: vi.fn(async () => 'applied'),
    rewriteDraftWithAgent: vi.fn(async () => undefined),
    pushHistoryRewrite: vi.fn(async () => 'pushed'),
    restoreHistory: vi.fn(async () => 'restored'),
    bringOriginIntoHistory: vi.fn(async () => 'applied'),
    dismissHistoryRun: vi.fn(),
    openDrawer: vi.fn(),
    changeLiveHistory: vi.fn(async (_input: ChangeLiveInput) => undefined),
    rebaseBranch: vi.fn(async () => 'rebased'),
    requestScribe: vi.fn(async () => 'scribe'),
    openMountTerminal: vi.fn(),
  };
  h.state = {
    ...actions,
    historyLiveSessions: {},
    setHistoryLiveSession: vi.fn(),
    historyRuns: run === null ? {} : { [MOUNT_ID]: run },
    scribeWork: {},
    mountGithub: { [MOUNT_ID]: { pr: { number: 214, headSha: c } } },
    historyDrafts: {
      [MOUNT_ID]: {
        sessionId: SESSION_ID,
        mountId: MOUNT_ID,
        planId: 'plan-1',
        branch: 'hl/ledger-export',
        baseSha: LEDGER_GRAPH.mergeBase.sha,
        headSha: commits[0]?.sha ?? f,
        commits,
        items,
        onto,
        graph,
        undo: [],
        prediction: prediction ?? clean(items),
        isPredicting: false,
        loadError: null,
      },
    },
  };
  return actions;
};

const setup = (params: Setup = {}) => {
  const actions = seed(params);
  render(<CommitsHistory sessionId={SESSION_ID} worktreePath="/w/payments" />);
  return actions;
};

const row = (sha: string): HTMLElement => {
  const found = document.querySelector<HTMLElement>(`[data-history-row="${sha}"]`);
  if (found === null) {
    throw new Error(`no row for ${sha}`);
  }
  return found;
};

const lastItems = (actions: ReturnType<typeof setup>) =>
  actions.changeLiveHistory.mock.calls.at(-1)?.[0]?.items;

beforeEach(() => {
  h.width = 1000;
  h.chosenBase = 'main';
  extra.backups = [];
  extra.branches = ['main', 'release/2.4'];
  h.status = {
    upstream: 'origin/hl/ledger-export',
    workingTree: { kind: 'known', staged: 0, unstaged: 0, untracked: 0, unmerged: 0, changed: 0 },
  };
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('CommitsHistory toolbar', () => {
  const mountWithSlot = () => {
    seed({});
    const slot = document.createElement('div');
    render(<CommitsHistory sessionId={SESSION_ID} worktreePath="/w/payments" />);
    return slot;
  };

  it('puts no Backups button in the header and no Refresh, terminal or menu', () => {
    mountWithSlot();

    expect(screen.queryByRole('button', { name: 'Backups' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Refresh' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Open terminal here' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'More history actions' })).toBeNull();
  });

  it('draws no fact chips above the graph', () => {
    const slot = mountWithSlot();

    expect(screen.queryByText(/of your own/)).toBeNull();
    expect(screen.queryByText(/already online/)).toBeNull();
    expect(screen.queryByText(/on top of today/)).toBeNull();
    slot.remove();
  });

  it('draws one node graphic only, the 72px lane', () => {
    const slot = mountWithSlot();

    const lanes = document.querySelectorAll('[data-history-lane]');
    expect(lanes).toHaveLength(1);
    expect(lanes[0]?.getAttribute('width')).toBe('72');
    slot.remove();
  });

  it('says how to drag at rest and lists the keys from a Keys popover', () => {
    const slot = mountWithSlot();

    expect(
      screen.getByText('Drag a commit to move it, drop it on another to fold it in.'),
    ).toBeDefined();
    expect(screen.queryByText('Fold in')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Keys' }));
    expect(screen.getByText('Fold in')).toBeDefined();
    expect(screen.getByText('Rename')).toBeDefined();
    expect(screen.getByText('Remove')).toBeDefined();
    slot.remove();
  });

  it('offers no previous versions link while there are none', () => {
    seed({});
    render(<CommitsHistory sessionId={SESSION_ID} worktreePath="/w/payments" />);

    expect(screen.queryByRole('button', { name: /previous versions/i })).toBeNull();
  });

  it('shows previous versions under the graph and opens the drawer on click', async () => {
    extra.backups = [
      { refName: BACKUP_REF, sha: a, subject: 'Add ledger export', createdAt: 1, isLegacy: false },
    ];
    const actions = seed({});
    render(<CommitsHistory sessionId={SESSION_ID} worktreePath="/w/payments" />);

    fireEvent.click(await screen.findByRole('button', { name: 'Previous versions 1' }));

    expect(actions.openDrawer).toHaveBeenCalledWith({
      kind: 'history-versions',
      sessionId: SESSION_ID,
      payload: { mountId: MOUNT_ID, worktreePath: '/w/payments' },
    });
  });
});

describe('the base row', () => {
  it('reads the base as text with its sha and leaves Rebase to the status line', () => {
    setup();

    expect(screen.getByText('Based on main')).toBeDefined();
    expect(screen.queryByText('3 new commits on main')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Rebase onto latest' })).toBeNull();
  });

  it('rebases onto another base picked from the chip', async () => {
    const actions = setup({ graph: { ...LEDGER_GRAPH, behind: 0, mainCommits: [] } });

    fireEvent.click(await screen.findByRole('combobox', { name: 'Rebase onto branch' }));
    fireEvent.click(await screen.findByRole('option', { name: /release\/2\.4/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Rebase onto release/2.4' }));
    const dialog = screen.getByRole('dialog', { name: 'Rebase onto release/2.4?' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Rebase' }));

    expect(actions.rebaseBranch).toHaveBeenCalledWith({
      sessionId: SESSION_ID,
      mountId: MOUNT_ID,
      ontoBranch: 'release/2.4',
    });
  });

  it('scrolls to the base row and focuses the Rebase of the status line when asked', () => {
    setup();
    const railRebase = document.createElement('button');
    railRebase.setAttribute('data-worktree-verb', 'mount.rebase');
    document.body.append(railRebase);
    const scroll = vi.fn();
    Element.prototype.scrollIntoView = scroll;

    act(() => {
      window.dispatchEvent(
        new CustomEvent(diffEventName({ name: HISTORY_FOCUS_BASE_EVENT, sessionId: SESSION_ID })),
      );
    });

    expect(scroll).toHaveBeenCalled();
    expect(document.activeElement).toBe(railRebase);
    railRebase.remove();
  });
});

describe('CommitsHistory', () => {
  it('draws one list of every commit newest first between main and the fork', () => {
    setup();
    const list = screen.getByRole('list', { name: 'Commits' });
    const labels = within(list)
      .getAllByRole('listitem')
      .map((item) => item.getAttribute('aria-label'));
    expect(labels).toEqual(LEDGER_COMMITS.map((entry) => entry.subject));
    expect(screen.getByText('Based on main')).toBeDefined();
    expect(screen.queryByText('online')).toBeNull();
    expect(screen.queryByText(/already online/)).toBeNull();
    expect(screen.queryByText(/of your own/)).toBeNull();
    expect(screen.queryByRole('checkbox')).toBeNull();
  });

  it('folds with C, combines with S, removes with Delete and moves with alt and the arrows', () => {
    const actions = setup();
    fireEvent.keyDown(row(f), { key: 'c' });
    expect(lastItems(actions)?.find((step: HistoryStep) => step.sha === f)).toEqual({
      sha: f,
      verb: 'fixup',
      target: e,
    });
    fireEvent.keyDown(row(e), { key: 's' });
    expect(lastItems(actions)?.find((step: HistoryStep) => step.sha === e)).toEqual({
      sha: e,
      verb: 'squash',
      target: x,
    });
    fireEvent.keyDown(row(x), { key: 'Delete' });
    expect(lastItems(actions)).toEqual(setVerb({ items: BASE, sha: x, verb: 'drop' }));
    fireEvent.keyDown(row(d), { key: 'ArrowDown', altKey: true });
    expect(lastItems(actions)).toEqual(moveAbove({ items: BASE, sha: d, anchor: b }));
  });

  it('builds the row menu from the commit actions, no icon buttons on the row', () => {
    const actions = setup();
    const taking = within(row(d));
    expect(taking.queryByRole('button', { name: 'Rename' })).toBeNull();
    expect(taking.queryByRole('button', { name: 'Fold down' })).toBeNull();
    fireEvent.click(within(row(b)).getByRole('button', { name: /More for/ }));
    fireEvent.click(screen.getByRole('menuitem', { name: /^Remove/ }));
    expect(lastItems(actions)).toEqual(setVerb({ items: BASE, sha: b, verb: 'drop' }));
  });

  it('keeps rebase off the list, never as a planned change', () => {
    const actions = setup();
    expect(screen.queryByText(/is here now/)).toBeNull();
    expect(screen.queryByRole('button', { name: /Rebase on main/ })).toBeNull();
    expect(screen.queryAllByRole('button', { name: 'Rebase onto latest' })).toHaveLength(0);
    expect(actions.changeLiveHistory).not.toHaveBeenCalled();
  });

  it('names the chosen base branch in the graph', () => {
    h.chosenBase = 'develop';
    setup();
    expect(screen.getAllByText(/develop/).length).toBeGreaterThan(0);
    expect(screen.queryAllByText(/main · merge base/)).toHaveLength(0);
  });

  it('names the base the repo resolved when none is chosen, never main', () => {
    h.chosenBase = null;
    setup({ graph: { ...LEDGER_GRAPH, baseRef: 'origin/develop' } });
    expect(screen.getAllByText(/develop/).length).toBeGreaterThan(0);
    expect(screen.queryAllByText(/main · merge base/)).toHaveLength(0);
  });
});

describe('CommitsHistory plan panel', () => {
  const reducedMotion = () => {
    vi.stubGlobal('matchMedia', () => ({
      matches: true,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }));
  };

  it('shows Not pushed only on commits that are not on the online copy', () => {
    setup();
    for (const entry of LEDGER_COMMITS) {
      const chip = within(row(entry.sha)).queryByText('Not pushed');
      expect(chip === null).toBe(entry.pushed);
    }
    expect(screen.queryByText('online')).toBeNull();
  });
});

describe('CommitsHistory drag and drop', () => {
  const ROW_HEIGHT = 60;
  const topOf = (sha: string): number =>
    100 + LEDGER_COMMITS.findIndex((entry) => entry.sha === sha) * ROW_HEIGHT;

  beforeEach(() => {
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function rect(
      this: Element,
    ) {
      const sha = this instanceof HTMLElement ? this.dataset.historyRow : undefined;
      const top = sha === undefined ? 0 : topOf(sha);
      const height = sha === undefined ? 1000 : ROW_HEIGHT;
      return {
        top,
        bottom: top + height,
        left: 0,
        right: 600,
        width: 600,
        height,
        x: 0,
        y: top,
        toJSON: () => ({}),
      } as DOMRect;
    });
  });

  const drag = ({ sha, toY }: { readonly sha: string; readonly toY: number }) => {
    fireEvent.pointerDown(row(sha), { button: 0, clientX: 40, clientY: topOf(sha) + 30 });
    fireEvent.pointerMove(window, { clientX: 40, clientY: topOf(sha) + 40 });
    fireEvent.pointerMove(window, { clientX: 40, clientY: toY });
    fireEvent.pointerUp(window, { clientX: 40, clientY: toY });
  };

  it('moves a commit when it is dropped between two others', () => {
    const actions = setup();
    drag({ sha: d, toY: topOf(b) + 2 });
    expect(lastItems(actions)).toEqual(moveAbove({ items: BASE, sha: d, anchor: b }));
  });

  it('folds a commit in when it is dropped onto the middle of another', () => {
    const actions = setup();
    drag({ sha: f, toY: topOf(a) + 30 });
    expect(lastItems(actions)).toEqual(
      combineInto({ items: BASE, sha: f, target: a, mode: 'fixup' }),
    );
  });

  it('cancels with Escape and changes nothing', () => {
    const actions = setup();
    fireEvent.pointerDown(row(d), { button: 0, clientX: 40, clientY: topOf(d) + 30 });
    fireEvent.pointerMove(window, { clientX: 40, clientY: topOf(b) + 2 });
    fireEvent.keyDown(window, { key: 'Escape' });
    fireEvent.pointerUp(window, { clientX: 40, clientY: topOf(b) + 2 });
    expect(actions.changeLiveHistory).not.toHaveBeenCalled();
  });

  it('never uses html5 drag, so the native file drop keeps its events', () => {
    setup();
    expect(row(d).getAttribute('draggable')).toBeNull();
  });
});

describe('CommitsHistory on a long branch', () => {
  const COUNT = 200;
  const shaAt = ({ index }: { readonly index: number }) =>
    `${index.toString(16).padStart(4, '0')}`.padEnd(40, 'a');
  const LONG = Array.from({ length: COUNT }, (_, index) => ({
    sha: shaAt({ index }),
    shortSha: shaAt({ index }).slice(0, 7),
    subject: `refactor: step ${index} of the ledger batching`,
    author: 'Theo Varga',
    timestamp: 1_790_000_000 - index * 60,
    pushed: false,
    parentSha: index === COUNT - 1 ? LEDGER_GRAPH.mergeBase.sha : shaAt({ index: index + 1 }),
  })) satisfies typeof LEDGER_COMMITS;
  const LONG_ITEMS = initialPlanItems({ commits: LONG });
  const renders = vi.mocked(historyRowLine);

  it('redraws only the row that changed', () => {
    seed({ commits: LONG, items: LONG_ITEMS });
    render(<CommitsHistory sessionId={SESSION_ID} worktreePath="/w/payments" />);
    expect(renders.mock.calls.length).toBeGreaterThanOrEqual(COUNT);

    renders.mockClear();
    fireEvent.pointerEnter(row(shaAt({ index: 40 })));
    expect(renders.mock.calls.length).toBeLessThanOrEqual(2);
  });
});

describe('CommitsHistory initial read states', () => {
  it('shows skeleton rows before the draft has been read', () => {
    seed();
    h.state.historyDrafts = {};
    render(<CommitsHistory sessionId={SESSION_ID} worktreePath="/w/payments" />);
    expect(screen.getAllByRole('status', { name: 'Loading commits' })).toHaveLength(3);
    expect(screen.queryByText('No commits yet on this branch')).toBeNull();
  });

  it('shows the branch empty state after a successful empty read', () => {
    setup({ commits: [] });
    screen.getByText('No commits yet');
    expect(screen.queryByRole('status', { name: 'Loading commits' })).toBeNull();
  });

  it('offers Retry and Details after the initial read fails', () => {
    const actions = seed({ commits: [] });
    const drafts = h.state.historyDrafts;
    if (typeof drafts !== 'object' || drafts === null) {
      throw new Error('Missing drafts');
    }
    const draft: unknown = Reflect.get(drafts, MOUNT_ID);
    if (typeof draft !== 'object' || draft === null) {
      throw new Error('Missing draft');
    }
    h.state.historyDrafts = { [MOUNT_ID]: { ...draft, loadError: 'Could not read the branch' } };
    render(<CommitsHistory sessionId={SESSION_ID} worktreePath="/w/payments" />);
    screen.getByRole('alert');
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(actions.loadHistoryDraft).toHaveBeenCalled();
    screen.getByRole('button', { name: 'Details' });
    expect(screen.queryByText('No commits yet on this branch')).toBeNull();
  });
});
