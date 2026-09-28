// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { HistoryPlanPrediction, HistoryStep, MountId, SessionId } from '@goodboy/types';
import {
  combineInto,
  initialPlanItems,
  moveAbove,
  setCombineMode,
  setVerb,
} from '../../historyPlan';
import { LEDGER, LEDGER_COMMITS, LEDGER_GRAPH } from '../../testing/ledgerFixture';
import { LEDGER_PRESET } from '../../testing/ledgerPreset';
import { historyBackupRef } from '../../historyBackupRef';

const BACKUP_REF = historyBackupRef({ branch: 'hl/ledger-export', atMs: Date.now() });

const SESSION_ID = 'session-ledger' as SessionId;
const MOUNT_ID = 'mount-ledger' as MountId;
const BASE = initialPlanItems({ commits: LEDGER_COMMITS });
const { a, b, c, d, x, e, f } = LEDGER;

const h = vi.hoisted(() => ({
  state: {} as Record<string, unknown>,
  width: 1000 as number | null,
  status: {
    upstream: 'origin/hl/ledger-export',
    workingTree: { kind: 'known', staged: 0, unstaged: 0, untracked: 0, unmerged: 0, changed: 0 },
  } as Record<string, unknown>,
}));

vi.mock('../../../../store', () => ({
  useAppStore: <T,>(selector: (state: Record<string, unknown>) => T) => selector(h.state),
}));

vi.mock('../../../../store/slices/project-mounts/selectors', () => ({
  selectMountForPath: () => ({
    mountId: MOUNT_ID,
    mountName: 'payments-api',
    branch: 'hl/ledger-export',
    baseBranch: 'main',
    worktreePath: '/w/payments',
  }),
}));

vi.mock('../../../session/hooks/useWorktreeStatuses', () => ({
  useWorktreeStatuses: () => new Map([['/w/payments', h.status]]),
}));

vi.mock('../../../../shared/hooks/useElementWidth', () => ({
  useElementWidth: () => ({ ref: () => undefined, width: h.width }),
}));

import { RewriteHistoryPage } from './index';

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
};

const setup = ({ items = BASE, prediction, run = null, onto = null }: Setup = {}) => {
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
    requestScribe: vi.fn(async () => 'scribe'),
    openMountTerminal: vi.fn(),
  };
  h.state = {
    ...actions,
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
        headSha: f,
        commits: LEDGER_COMMITS,
        items,
        onto,
        graph: LEDGER_GRAPH,
        undo: [],
        prediction: prediction ?? clean(items),
        isPredicting: false,
        loadError: null,
      },
    },
  };
  render(<RewriteHistoryPage sessionId={SESSION_ID} worktreePath="/w/payments" />);
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
  actions.editHistoryDraft.mock.calls.at(-1)?.[0]?.items;

beforeEach(() => {
  h.width = 1000;
  h.status = {
    upstream: 'origin/hl/ledger-export',
    workingTree: { kind: 'known', staged: 0, unstaged: 0, untracked: 0, unmerged: 0, changed: 0 },
  };
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('RewriteHistoryPage', () => {
  it('draws one list of every commit newest first between main and the fork', () => {
    setup();
    const list = screen.getByRole('list', { name: 'Commits' });
    const labels = within(list)
      .getAllByRole('listitem')
      .map((item) => item.getAttribute('aria-label'));
    expect(labels).toEqual(LEDGER_COMMITS.map((entry) => entry.subject));
    expect(screen.getByText('3 commits newer than where your branch started')).toBeDefined();
    expect(screen.getByText('Your branch starts here')).toBeDefined();
    expect(screen.getByText(/already online, PR #214/)).toBeDefined();
    expect(screen.queryByRole('checkbox')).toBeNull();
  });

  it('marks every changed row and says what happens to it', () => {
    setup({ items: LEDGER_PRESET });
    expect(
      within(row(f)).getByText('folds into “Add ledger export endpoint”, keeps that title'),
    ).toBeDefined();
    expect(within(row(d)).getByText('moves below “Fix webhook signature check”')).toBeDefined();
    expect(within(row(d)).getByText('takes in “wip export tests”')).toBeDefined();
    expect(within(row(x)).getByText('removed on Apply')).toBeDefined();
    expect(
      within(row(c)).getByText('becomes “Verify webhook signatures before crediting”'),
    ).toBeDefined();
  });

  it('lists the planned changes with a count of what stays', () => {
    setup({ items: LEDGER_PRESET });
    const list = screen.getByRole('list', { name: 'Planned changes' });
    expect(
      within(list)
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual([
      expect.stringContaining(
        'Folded “Fix typo in CSV header” into “Add ledger export endpoint”, keeping its title',
      ),
      expect.stringContaining(
        'Combined “wip export tests” with “Add retries to the export job”, both messages kept',
      ),
      expect.stringContaining('Removed “Add debug logging to the export”'),
      expect.stringContaining(
        'Moved “Add retries to the export job” below “Fix webhook signature check”',
      ),
      expect.stringContaining(
        'Renamed “Fix webhook signature check” to “Verify webhook signatures before crediting”',
      ),
    ]);
    expect(screen.getByText('5 · 7 commits become 4')).toBeDefined();
  });

  it('undoes one planned change and resets all of them', () => {
    const actions = setup({ items: LEDGER_PRESET });
    fireEvent.click(screen.getByRole('button', { name: /^Undo: Removed/ }));
    expect(lastItems(actions)?.find((step: HistoryStep) => step.sha === x)).toEqual({
      sha: x,
      verb: 'pick',
    });
    fireEvent.click(screen.getByRole('button', { name: 'Reset all' }));
    expect(actions.discardHistoryDraft).toHaveBeenCalledWith({
      sessionId: SESSION_ID,
      mountId: MOUNT_ID,
    });
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

  it('opens the rename editor with R and undoes the last edit with command Z', () => {
    const actions = setup();
    fireEvent.keyDown(row(c), { key: 'r' });
    expect(screen.getByRole('textbox', { name: 'Commit subject' })).toBeDefined();
    fireEvent.keyDown(row(b), { key: 'z', metaKey: true });
    expect(actions.undoHistoryDraft).toHaveBeenCalledWith({
      sessionId: SESSION_ID,
      mountId: MOUNT_ID,
    });
  });

  it('switches a fold between keep title and keep both on the row and on its change', () => {
    const folded = combineInto({ items: BASE, sha: f, target: a, mode: 'fixup' });
    const actions = setup({ items: folded });
    const switches = screen.getAllByRole('group', { name: 'What to keep' });
    expect(switches).toHaveLength(2);
    fireEvent.click(within(row(f)).getByRole('button', { name: 'Keep both' }));
    expect(lastItems(actions)).toEqual(setCombineMode({ items: folded, sha: f, mode: 'squash' }));
  });

  it('lights up a row, its node in After Apply and its planned changes together', () => {
    setup({ items: LEDGER_PRESET });
    fireEvent.pointerEnter(row(d));
    expect(row(d).dataset.highlighted).toBe('true');
    expect(
      document.querySelector(`[data-after-node="${d}"]`)?.getAttribute('data-highlighted'),
    ).toBe('true');
    const lit = [...document.querySelectorAll('[data-edit][data-highlighted="true"]')].map((node) =>
      node.getAttribute('data-edit'),
    );
    expect(lit).toEqual([`combine:${e}`, `move:${d}`]);
    fireEvent.pointerEnter(document.querySelector(`[data-edit="drop:${x}"]`) as Element);
    expect(row(x).dataset.highlighted).toBe('true');
    expect(row(d).dataset.highlighted).toBeUndefined();
  });

  it('offers apply here only and apply and update online when online commits change', () => {
    const actions = setup({ items: LEDGER_PRESET });
    fireEvent.click(screen.getByRole('button', { name: 'Apply here only' }));
    expect(actions.applyHistoryDraft).toHaveBeenLastCalledWith({
      sessionId: SESSION_ID,
      mountId: MOUNT_ID,
      shouldPush: false,
    });
    fireEvent.click(screen.getByRole('button', { name: 'Apply and update online' }));
    expect(actions.applyHistoryDraft).toHaveBeenLastCalledWith({
      sessionId: SESSION_ID,
      mountId: MOUNT_ID,
      shouldPush: true,
    });
    expect(screen.getByText('Replaces 3 commits that are already online')).toBeDefined();
  });

  it('keeps one apply button when the plan leaves online commits alone', () => {
    const actions = setup({ items: setVerb({ items: BASE, sha: x, verb: 'drop' }) });
    expect(screen.queryByRole('button', { name: 'Apply and update online' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    expect(actions.applyHistoryDraft).toHaveBeenCalledWith({
      sessionId: SESSION_ID,
      mountId: MOUNT_ID,
      shouldPush: false,
    });
  });

  it('shows a predicted conflict on its row and in a notice', () => {
    const prediction: HistoryPlanPrediction = {
      ...clean(LEDGER_PRESET),
      head: null,
      steps: LEDGER_PRESET.map((step) => ({
        sha: step.sha,
        outcome: step.sha === d ? 'conflict' : 'clean',
        files: step.sha === d ? ['webhook.ts'] : [],
        newSha: null,
      })),
    };
    setup({ items: LEDGER_PRESET, prediction });
    expect(within(row(d)).getByText('may conflict in webhook.ts')).toBeDefined();
    expect(screen.getByText('2 changes do not replay cleanly')).toBeDefined();
    expect(
      screen.getByRole('button', { name: 'Apply and update online' }).hasAttribute('disabled'),
    ).toBe(false);
  });

  it('blocks apply while the worktree has uncommitted changes', () => {
    h.status = {
      upstream: 'origin/hl/ledger-export',
      workingTree: { kind: 'known', staged: 1, unstaged: 1, untracked: 0, unmerged: 0, changed: 2 },
    };
    setup({ items: LEDGER_PRESET });
    expect(screen.getByText('2 files have changes that are not committed')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Apply here only' }).hasAttribute('disabled')).toBe(
      true,
    );
  });

  it('says it is working on a temporary copy, step by step, while the plan is tried', () => {
    setup({
      items: LEDGER_PRESET,
      run: {
        sessionId: SESSION_ID,
        mountId: MOUNT_ID,
        origin: 'plan',
        phase: 'trying',
        planId: 'plan-1',
        agentId: null,
        copyPath: null,
        stop: null,
        result: null,
        backupRef: null,
        remoteSha: null,
        holder: null,
        progress: { stage: 'step', index: 3, total: 7, sha: d },
        applied: null,
        updatedAt: 1,
      },
    });
    const status = screen.getByRole('status');
    expect(within(status).getByText('Trying your changes on a temporary copy')).toBeDefined();
    expect(within(status).getByText('Your branch is untouched until this finishes.')).toBeDefined();
    expect(within(status).getByText('Step 3 of 7 · Add retries to the export job')).toBeDefined();
    expect(
      screen.getByRole('button', { name: 'Apply and update online' }).hasAttribute('disabled'),
    ).toBe(true);
    expect(screen.queryByRole('button', { name: /^Undo:/ })).toBeNull();
  });

  it('stops on a failed step, says the branch is exactly as it was and offers the agent', () => {
    const actions = setup({
      items: LEDGER_PRESET,
      run: {
        sessionId: SESSION_ID,
        mountId: MOUNT_ID,
        origin: 'plan',
        phase: 'stopped',
        planId: 'plan-1',
        agentId: null,
        copyPath: null,
        stop: {
          reason: 'conflict',
          message:
            'Step 3 of 7, “Add retries to the export job”, conflicts in webhook.ts. The temporary copy was removed. Your branch is exactly as it was.',
          files: ['webhook.ts'],
          sha: d,
        },
        result: null,
        backupRef: null,
        remoteSha: null,
        holder: null,
        progress: null,
        applied: null,
        updatedAt: 1,
      },
    });
    const alert = screen.getByRole('alert');
    expect(
      within(alert).getByText('Nothing was changed: a step does not replay cleanly'),
    ).toBeDefined();
    expect(within(alert).getByText(/Your branch is exactly as it was\./)).toBeDefined();
    expect(row(d).dataset.highlighted).toBe('true');
    expect(
      document.querySelector(`[data-edit="move:${d}"]`)?.getAttribute('data-highlighted'),
    ).toBe('true');
    fireEvent.click(within(alert).getByRole('button', { name: 'Rewrite with an agent' }));
    expect(actions.rewriteDraftWithAgent).toHaveBeenCalled();
  });

  it('shows the result with the backup, restores it and closes with done', () => {
    const actions = setup({
      run: {
        sessionId: SESSION_ID,
        mountId: MOUNT_ID,
        origin: 'plan',
        phase: 'pushed',
        planId: 'plan-1',
        agentId: null,
        copyPath: null,
        stop: null,
        result: null,
        backupRef: BACKUP_REF,
        remoteSha: null,
        holder: null,
        progress: null,
        applied: {
          before: 7,
          after: 4,
          lines: [{ action: 'drop', text: 'Removed “Add debug logging to the export”' }],
          includes: {},
          newShas: [],
          touchedOnline: 3,
          isSameCode: false,
          isOnMain: false,
          removedFiles: ['logger.ts'],
        },
        updatedAt: 1,
      },
    });
    expect(screen.getByText('History rewritten')).toBeDefined();
    expect(screen.getByText('7 commits became 4')).toBeDefined();
    expect(screen.getByText(/^Backup of/).textContent).toMatch(
      /^Backup of hl\/ledger-export · today \d/,
    );
    expect(document.body.textContent).not.toMatch(/b-[0-9a-f]{8}/);
    expect(screen.getByRole('button', { name: 'Copy the backup ref' })).toBeDefined();
    expect(
      screen.getByText(/only the files of removed commits changed \(logger\.ts\)/),
    ).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Restore it' }));
    expect(actions.restoreHistory).toHaveBeenCalledWith({
      sessionId: SESSION_ID,
      mountId: MOUNT_ID,
      backupRef: BACKUP_REF,
      shouldPush: true,
    });
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(actions.dismissHistoryRun).toHaveBeenCalledWith({
      sessionId: SESSION_ID,
      mountId: MOUNT_ID,
    });
  });

  it('starts from today main as one more planned change', () => {
    const actions = setup();
    fireEvent.click(screen.getByRole('button', { name: /Start from today's main/ }));
    expect(actions.editHistoryDraft).toHaveBeenCalledWith({
      sessionId: SESSION_ID,
      mountId: MOUNT_ID,
      items: BASE,
      onto: LEDGER_GRAPH.mainHead,
    });
  });

  it('folds the side graph into a Now and After Apply toggle when narrow', () => {
    h.width = 600;
    setup({ items: LEDGER_PRESET });
    expect(document.querySelector('[data-after-node]')).toBeNull();
    fireEvent.click(screen.getByRole('tab', { name: 'After Apply' }));
    const labels = within(screen.getByRole('list', { name: 'Commits' }))
      .getAllByRole('listitem')
      .map((item) => item.getAttribute('data-history-row'));
    expect(labels).toEqual([x, c, d, b, a]);
  });
});

describe('RewriteHistoryPage drag and drop', () => {
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
    expect(actions.editHistoryDraft).not.toHaveBeenCalled();
  });

  it('never uses html5 drag, so the native file drop keeps its events', () => {
    setup();
    expect(row(d).getAttribute('draggable')).toBeNull();
  });
});
