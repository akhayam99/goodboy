import { describe, expect, it } from 'vitest';
import type { MountId, ProjectId, SessionId } from '@goodboy/types';
import { matrixOf } from '../../../__tests__/helpers/actionMatrix';
import { resolveActions } from '../resolveActions';
import { WORKTREE_KIND } from './worktree';
import type { WorktreeFacts } from './worktreeFacts';

const facts = (overrides: Partial<WorktreeFacts>): WorktreeFacts => ({
  sessionId: 'session-harborline' as SessionId,
  mountId: 'mount-payments' as MountId,
  projectId: 'project-payments' as ProjectId,
  label: 'hl/fix-duplicate-credit',
  branch: 'hl/fix-duplicate-credit',
  baseBranch: 'main',
  mountBaseBranch: null,
  worktreePath: '/work/payments-api',
  keptPath: '/work/payments-api',
  isRepo: true,
  isClosed: false,
  pr: 'open',
  requestLabel: 'PR #318',
  requestNumber: 318,
  requestProvider: 'github',
  createProvider: 'github',
  ahead: 5,
  unpushed: 0,
  behind: 0,
  dirty: 0,
  isDiverged: false,
  isRebasing: false,
  comments: 0,
  canStartTurnsHere: false,
  isDraftAgentRunning: false,
  blockers: [],
  editors: [],
  ...overrides,
});

const TOOLS = ['worktree.openTerminal menu', 'worktree.openInEditor menu', 'worktree.scripts menu'];
const COPIES = ['worktree.copyBranch menu', 'worktree.copyPath menu'];
const HISTORY = ['worktree.rewriteHistory menu', 'worktree.switchBranch chip'];
const WITH_PR = ['worktree.openPullRequest inline', 'worktree.openDiff inline'];
const DIRTY_2 = 'Commit or discard the 2 uncommitted changes first.';

const STATES: ReadonlyArray<{
  readonly name: string;
  readonly facts: WorktreeFacts;
  readonly expected: ReadonlyArray<string>;
}> = [
  {
    name: 'PR open, 3 to resolve',
    facts: facts({ comments: 3 }),
    expected: [
      ...WITH_PR,
      'worktree.openReview inline',
      ...TOOLS,
      ...HISTORY,
      ...COPIES,
      'worktree.close menu',
    ],
  },
  {
    name: 'No PR, not pushed',
    facts: facts({
      pr: null,
      requestLabel: null,
      requestNumber: null,
      requestProvider: null,
      ahead: 3,
      unpushed: 3,
    }),
    expected: [
      'worktree.openDiff inline',
      ...TOOLS,
      'worktree.createPullRequest inline',
      ...HISTORY,
      ...COPIES,
      'worktree.close menu',
    ],
  },
  {
    name: 'No PR, pushed',
    facts: facts({
      pr: null,
      requestLabel: null,
      requestNumber: null,
      requestProvider: null,
      ahead: 3,
    }),
    expected: [
      'worktree.openDiff inline',
      ...TOOLS,
      'worktree.createPullRequest inline',
      ...HISTORY,
      ...COPIES,
      'worktree.close menu',
    ],
  },
  {
    name: 'Draft PR',
    facts: facts({ pr: 'draft', ahead: 4 }),
    expected: [...WITH_PR, ...TOOLS, ...HISTORY, ...COPIES, 'worktree.close menu'],
  },
  {
    name: 'PR open, 2 not pushed',
    facts: facts({ ahead: 6, unpushed: 2 }),
    expected: [
      ...WITH_PR,
      ...TOOLS,
      'worktree.push inline',
      ...HISTORY,
      ...COPIES,
      'worktree.close menu',
    ],
  },
  {
    name: 'Behind main by 4',
    facts: facts({ behind: 4 }),
    expected: [
      ...WITH_PR,
      ...TOOLS,
      'worktree.rebase inline',
      ...HISTORY,
      ...COPIES,
      'worktree.close menu',
    ],
  },
  {
    name: 'Behind, 2 uncommitted',
    facts: facts({ behind: 4, dirty: 2 }),
    expected: [
      ...WITH_PR,
      ...TOOLS,
      `worktree.rebase inline (${DIRTY_2})`,
      `worktree.rewriteHistory menu (${DIRTY_2})`,
      'worktree.switchBranch chip (The 2 uncommitted changes would follow you. Commit or discard them first.)',
      ...COPIES,
      'worktree.close menu',
    ],
  },
  {
    name: 'Diverged from origin',
    facts: facts({ unpushed: 1, isDiverged: true }),
    expected: [
      ...WITH_PR,
      ...TOOLS,
      'worktree.push menu (Origin has a commit this branch lacks. Rebase on it first; Rewrite history owns force pushes.)',
      ...HISTORY,
      ...COPIES,
      'worktree.close menu',
    ],
  },
  {
    name: 'Rebase stopped',
    facts: facts({ dirty: 3, isRebasing: true }),
    expected: [
      ...WITH_PR,
      'worktree.openTerminal notice',
      'worktree.openInEditor menu',
      'worktree.scripts menu',
      'worktree.abortRebase notice',
      'worktree.rewriteHistory menu (Finish or abort the rebase first.)',
      ...COPIES,
    ],
  },
  {
    name: 'Merged',
    facts: facts({ pr: 'merged', ahead: 0 }),
    expected: [
      'worktree.openPullRequest inline',
      ...TOOLS,
      'worktree.switchBranch chip',
      ...COPIES,
      'worktree.close inline',
    ],
  },
  {
    name: 'PR closed',
    facts: facts({ pr: 'closed' }),
    expected: [...WITH_PR, ...TOOLS, ...HISTORY, ...COPIES, 'worktree.close menu'],
  },
  {
    name: 'New branch, no changes',
    facts: facts({
      pr: null,
      requestLabel: null,
      requestNumber: null,
      requestProvider: null,
      ahead: 0,
      canStartTurnsHere: true,
    }),
    expected: [
      ...TOOLS,
      'worktree.switchBranch chip',
      'worktree.startTurnsHere menu',
      ...COPIES,
      'worktree.close menu',
    ],
  },
  {
    name: 'Worktree closed, files kept',
    facts: facts({ isClosed: true, worktreePath: null }),
    expected: ['worktree.reopen inline', ...COPIES, 'worktree.forget menu'],
  },
];

const definitions = WORKTREE_KIND.actions;

describe.each(STATES)('worktree, $name', ({ facts: state, expected }) => {
  it('offers exactly the planned actions', () => {
    expect(matrixOf({ definitions, facts: state })).toEqual(expected);
  });

  it('shows at most one state-picked action on the row', () => {
    const picked = resolveActions({ definitions, facts: state }).filter(
      (action) => action.slot === 'inline' && action.group !== 'open',
    );
    expect(picked.length).toBeLessThanOrEqual(1);
  });
});

describe('worktree, labels by state', () => {
  it('names the merged cleanup Remove worktree and the rest Close worktree', () => {
    const merged = resolveActions({ definitions, facts: facts({ pr: 'merged', ahead: 0 }) });
    const open = resolveActions({ definitions, facts: facts({}) });
    expect(merged.find((action) => action.id === 'worktree.close')?.label).toBe('Remove worktree');
    expect(open.find((action) => action.id === 'worktree.close')?.label).toBe('Close worktree');
  });

  it('says a close with uncommitted changes keeps them', () => {
    const close = resolveActions({ definitions, facts: facts({ dirty: 2 }) }).find(
      (action) => action.id === 'worktree.close',
    );
    expect(close?.confirm?.confirmLabel).toBe('Close, keep changes');
  });

  it('blocks Remove from session while an agent still runs there', () => {
    const forget = resolveActions({
      definitions,
      facts: facts({
        isClosed: true,
        worktreePath: null,
        blockers: ['Work is still running in hl/fix-duplicate-credit; stop it first.'],
      }),
    }).find((action) => action.id === 'worktree.forget');
    expect(forget?.blockedReason).toBe(
      'Work is still running in hl/fix-duplicate-credit; stop it first.',
    );
  });

  it('holds Create PR while an agent is already opening one', () => {
    const create = resolveActions({
      definitions,
      facts: facts({
        pr: null,
        requestLabel: null,
        requestNumber: null,
        requestProvider: null,
        isDraftAgentRunning: true,
      }),
    }).find((action) => action.id === 'worktree.createPullRequest');
    expect(create?.blockedReason).toBe('An agent is already opening a pull request.');
  });
});
