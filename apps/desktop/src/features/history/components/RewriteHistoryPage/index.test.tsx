// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { BranchCommit, HistoryStep, MountId, SessionId } from '@goodboy/types';

const SESSION_ID = 'session-ledger' as SessionId;
const MOUNT_ID = 'mount-ledger' as MountId;

const commit = (sha: string, subject: string, pushed = false): BranchCommit => ({
  sha,
  shortSha: sha.slice(0, 7),
  subject,
  author: 'You',
  timestamp: 1_790_000_000,
  pushed,
  parentSha: sha === 'aaa1111aaaa' ? 'base0000000' : null,
});

const COMMITS = [
  commit('ccc3333cccc', 'Retry duplicate events'),
  commit('bbb2222bbbb', 'Guard the settlement batch'),
  commit('aaa1111aaaa', 'Extract the batch key', true),
];

const PICKS: ReadonlyArray<HistoryStep> = [
  { sha: 'aaa1111aaaa', verb: 'pick' },
  { sha: 'bbb2222bbbb', verb: 'pick' },
  { sha: 'ccc3333cccc', verb: 'pick' },
];

const h = vi.hoisted(() => ({
  state: {} as Record<string, unknown>,
}));

vi.mock('../../../../store', () => ({
  useAppStore: <T,>(selector: (state: Record<string, unknown>) => T) => selector(h.state),
}));

vi.mock('../../../../store/slices/project-mounts/selectors', () => ({
  selectMountForPath: () => ({
    mountId: MOUNT_ID,
    mountName: 'ledger-core',
    branch: 'fix/ledger-postings',
    baseBranch: 'main',
    worktreePath: '/w/ledger',
  }),
}));

vi.mock('../../../session/hooks/useWorktreeStatuses', () => ({
  useWorktreeStatuses: () => new Map([['/w/ledger', { upstream: 'origin/fix/ledger-postings' }]]),
}));

import { RewriteHistoryPage } from './index';

const setup = ({
  items = PICKS,
  prediction = {
    isSupported: true,
    steps: PICKS.map((step) => ({ sha: step.sha, outcome: 'clean', files: [], newSha: null })),
    head: 'new',
    isTreeEqual: true,
    changedFiles: [],
  },
  conflictEdit = null,
  run = null,
  pushedBefore = false,
  prNumber = null,
}: {
  readonly items?: ReadonlyArray<HistoryStep>;
  readonly prediction?: unknown;
  readonly conflictEdit?: unknown;
  readonly run?: unknown;
  readonly pushedBefore?: boolean;
  readonly prNumber?: number | null;
} = {}) => {
  const actions = {
    loadHistoryDraft: vi.fn(async () => undefined),
    editHistoryDraft: vi.fn(async () => undefined),
    discardHistoryDraft: vi.fn(async () => undefined),
    applyHistoryDraft: vi.fn(async () => 'pushed'),
    applyRewrittenHistory: vi.fn(async () => 'pushed'),
    rewriteDraftWithAgent: vi.fn(async () => undefined),
    requestScribe: vi.fn(async () => 'commit-message:mount-ledger'),
    openMountTerminal: vi.fn(),
    pushHistoryRewrite: vi.fn(async () => 'pushed'),
    restoreHistory: vi.fn(async () => 'restored'),
    hasPushedHistoryBefore: vi.fn(async () => pushedBefore),
    bringOriginIntoHistory: vi.fn(async () => 'applied'),
  };
  h.state = {
    ...actions,
    historyRuns: run === null ? {} : { [MOUNT_ID]: run },
    scribeWork: {},
    mountGithub: prNumber === null ? {} : { [MOUNT_ID]: { pr: { number: prNumber } } },
    historyDrafts: {
      [MOUNT_ID]: {
        sessionId: SESSION_ID,
        mountId: MOUNT_ID,
        planId: 'plan-1',
        branch: 'fix/ledger-postings',
        baseSha: 'base0000000',
        headSha: 'ccc3333cccc',
        commits: COMMITS,
        items,
        prediction,
        isPredicting: false,
        lastEdit: null,
        conflictEdit,
        loadError: null,
      },
    },
  };
  render(<RewriteHistoryPage sessionId={SESSION_ID} worktreePath="/w/ledger" />);
  return actions;
};

afterEach(cleanup);

describe('RewriteHistoryPage', () => {
  it('lists local commits and commits on origin apart, newest first, over the merge base', () => {
    setup();

    expect(screen.getByText('Only here · 2')).toBeDefined();
    expect(screen.getByText('On origin · 1')).toBeDefined();
    expect(screen.getByText('main · merge base · not editable here')).toBeDefined();
    const rows = screen.getAllByRole('listitem').map((row) => row.getAttribute('aria-label'));
    expect(rows).toEqual([
      'ccc3333 Retry duplicate events',
      'bbb2222 Guard the settlement batch',
      'aaa1111 Extract the batch key',
    ]);
    expect(screen.getByText('No conflicts expected')).toBeDefined();
  });

  it('explains every verb in one line and never says fixup', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: 'What happens to ccc3333' }));

    const menu = screen.getByRole('menu');
    expect(within(menu).getByText('Keep this commit as it is.')).toBeDefined();
    expect(within(menu).getByText('Keep the changes, write a new message.')).toBeDefined();
    expect(within(menu).getByText('Squash into the one below')).toBeDefined();
    expect(
      within(menu).getByText('Remove this commit and its changes from the branch.'),
    ).toBeDefined();
    expect(
      within(menu).getByText('Change the order. Moving commits can cause conflicts.'),
    ).toBeDefined();
    expect(within(menu).queryByText(/fixup/i)).toBeNull();
  });

  it('saves a reword into the draft, not into git', () => {
    const actions = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Retry duplicate events' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Commit subject' }), {
      target: { value: 'Retry duplicate settlement events' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save to the plan' }));

    expect(actions.editHistoryDraft).toHaveBeenCalledWith({
      sessionId: SESSION_ID,
      mountId: MOUNT_ID,
      items: [
        { sha: 'aaa1111aaaa', verb: 'pick' },
        { sha: 'bbb2222bbbb', verb: 'pick' },
        { sha: 'ccc3333cccc', verb: 'reword', message: 'Retry duplicate settlement events' },
      ],
      edit: { kind: 'reword', sha: 'ccc3333cccc' },
    });
    expect(actions.applyHistoryDraft).not.toHaveBeenCalled();
  });

  it('moves a commit with alt and the arrows', () => {
    const actions = setup();
    const row = screen.getByTestId('history-row-bbb2222');
    fireEvent.keyDown(row, { key: 'ArrowUp', altKey: true });

    expect(actions.editHistoryDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        items: [
          { sha: 'aaa1111aaaa', verb: 'pick' },
          { sha: 'ccc3333cccc', verb: 'pick' },
          { sha: 'bbb2222bbbb', verb: 'pick' },
        ],
        edit: { kind: 'move', sha: 'bbb2222bbbb', other: 'ccc3333cccc' },
      }),
    );
  });

  it('names the move that breaks the plan and offers the history rewriter', () => {
    const moved: ReadonlyArray<HistoryStep> = [
      { sha: 'aaa1111aaaa', verb: 'pick' },
      { sha: 'ccc3333cccc', verb: 'pick' },
      { sha: 'bbb2222bbbb', verb: 'pick' },
    ];
    const actions = setup({
      items: moved,
      prediction: {
        isSupported: true,
        steps: [
          { sha: 'aaa1111aaaa', outcome: 'clean', files: [], newSha: null },
          {
            sha: 'ccc3333cccc',
            outcome: 'conflict',
            files: ['src/ledger/postings.ts'],
            newSha: null,
          },
          { sha: 'bbb2222bbbb', outcome: 'blocked', files: [], newSha: null },
        ],
        head: null,
        isTreeEqual: false,
        changedFiles: [],
      },
      conflictEdit: { kind: 'move', sha: 'bbb2222bbbb', other: 'ccc3333cccc' },
    });

    expect(screen.getByText('Moving bbb2222 above ccc3333 will conflict')).toBeDefined();
    expect(screen.getByText('Conflict')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Rewrite with an agent' }));
    expect(actions.rewriteDraftWithAgent).toHaveBeenCalledWith({
      sessionId: SESSION_ID,
      mountId: MOUNT_ID,
    });
  });

  it('applies and pushes a changed plan from the dock', () => {
    const actions = setup({
      items: [
        { sha: 'aaa1111aaaa', verb: 'pick' },
        { sha: 'bbb2222bbbb', verb: 'drop' },
        { sha: 'ccc3333cccc', verb: 'pick' },
      ],
    });

    expect(screen.getByText(/1 dropped/)).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Apply and push' }));

    expect(actions.applyHistoryDraft).toHaveBeenCalledWith({
      sessionId: SESSION_ID,
      mountId: MOUNT_ID,
      shouldPush: true,
    });
  });

  it('asks once before a push rewrites commits already on origin, and names the PR', async () => {
    const actions = setup({
      items: [
        { sha: 'aaa1111aaaa', verb: 'reword', message: 'Extract the settlement batch key' },
        { sha: 'bbb2222bbbb', verb: 'pick' },
        { sha: 'ccc3333cccc', verb: 'pick' },
      ],
      prNumber: 418,
    });

    expect(screen.getByText('Rewrites 1 commit on origin')).toBeDefined();
    expect(screen.getByText(/PR #418 updates/)).toBeDefined();
    await vi.waitFor(() => expect(actions.hasPushedHistoryBefore).toHaveBeenCalled());
    fireEvent.click(screen.getByRole('button', { name: 'Apply and push' }));

    expect(actions.applyHistoryDraft).not.toHaveBeenCalled();
    expect(screen.getByText('Push with lease rewrites origin.')).toBeDefined();
  });

  it('pushes later with the lease read at apply, or undoes the rewrite from the backup', () => {
    const actions = setup({
      run: {
        sessionId: SESSION_ID,
        mountId: MOUNT_ID,
        origin: 'plan',
        phase: 'applied',
        planId: 'plan-1',
        agentId: null,
        copyPath: null,
        stop: null,
        result: null,
        backupRef: 'refs/goodboy/backup/fix-ledger-postings/1790000000000000000',
        remoteSha: 'remote-sha',
        holder: null,
        updatedAt: 1,
      },
    });

    expect(screen.getByText('Rewritten here · origin has the old history')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Push with lease' }));
    expect(actions.pushHistoryRewrite).toHaveBeenCalledWith({
      sessionId: SESSION_ID,
      mountId: MOUNT_ID,
      origin: 'plan',
      planId: 'plan-1',
      expectedRemoteSha: 'remote-sha',
    });
    fireEvent.click(screen.getByRole('button', { name: 'Undo rewrite' }));
    expect(actions.restoreHistory).toHaveBeenCalledWith({
      sessionId: SESSION_ID,
      mountId: MOUNT_ID,
      backupRef: 'refs/goodboy/backup/fix-ledger-postings/1790000000000000000',
      shouldPush: false,
    });
  });

  it('brings what origin gained into the plan after the lease refused the push', () => {
    const actions = setup({
      run: {
        sessionId: SESSION_ID,
        mountId: MOUNT_ID,
        origin: 'plan',
        phase: 'stopped',
        planId: 'plan-1',
        agentId: null,
        copyPath: null,
        stop: {
          reason: 'origin-moved',
          message: 'Origin has new commits since the rewrite. Nothing was pushed.',
          files: [],
          sha: null,
        },
        result: null,
        backupRef: null,
        remoteSha: 'remote-sha',
        holder: null,
        updatedAt: 1,
      },
    });

    expect(
      screen.getByText('Origin has new commits since the rewrite. Nothing was pushed.'),
    ).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Bring them into the plan' }));
    expect(actions.bringOriginIntoHistory).toHaveBeenCalledWith({
      sessionId: SESSION_ID,
      mountId: MOUNT_ID,
    });
  });
});
