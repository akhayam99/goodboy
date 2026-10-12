// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { MountId, ProjectId, SessionId } from '@goodboy/types';
import { matrixOf } from '../../../__tests__/helpers/actionMatrix';
import { resolveActions } from '../resolveActions';
import { MOUNT_KIND } from './mount';
import type { MountFacts } from './mountFacts';

const facts = (overrides: Partial<MountFacts>): MountFacts => ({
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
  onlyOnline: null,
  isRebasing: false,
  comments: 0,
  canStartTurnsHere: false,
  isScribeWriting: false,
  blockers: [],
  editors: [],
  ...overrides,
});

const TOOLS = [
  'mount.openTerminal menu',
  'mount.openInEditor menu',
  'mount.scripts menu',
  'mount.browseFiles menu',
];
const COPIES = ['mount.copyBranch menu', 'mount.copyPath menu'];
const ADD_TASK = 'mount.putTaskOnBranch chip';
const HISTORY = ['mount.rewriteHistory menu', 'mount.switchBranch chip', ADD_TASK];
const WITH_PR = ['mount.openPullRequest inline', 'mount.openDiff inline'];
const DIRTY_2 = '2 files have changes that are not committed. Commit or stash them first.';

const STATES: ReadonlyArray<{
  readonly name: string;
  readonly facts: MountFacts;
  readonly expected: ReadonlyArray<string>;
}> = [
  {
    name: 'PR open, 3 to resolve',
    facts: facts({ comments: 3 }),
    expected: [
      ...WITH_PR,
      'mount.openReview inline',
      ...TOOLS,
      ...HISTORY,
      ...COPIES,
      'mount.close menu',
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
      'mount.openDiff inline',
      ...TOOLS,
      'mount.createPullRequest inline',
      ...HISTORY,
      ...COPIES,
      'mount.close menu',
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
      'mount.openDiff inline',
      ...TOOLS,
      'mount.createPullRequest inline',
      ...HISTORY,
      ...COPIES,
      'mount.close menu',
    ],
  },
  {
    name: 'Draft PR',
    facts: facts({ pr: 'draft', ahead: 4 }),
    expected: [...WITH_PR, ...TOOLS, ...HISTORY, ...COPIES, 'mount.close menu'],
  },
  {
    name: 'PR open, 2 not pushed',
    facts: facts({ ahead: 6, unpushed: 2 }),
    expected: [
      ...WITH_PR,
      ...TOOLS,
      'mount.push inline',
      ...HISTORY,
      ...COPIES,
      'mount.close menu',
    ],
  },
  {
    name: 'Behind main by 4',
    facts: facts({ behind: 4 }),
    expected: [
      ...WITH_PR,
      ...TOOLS,
      'mount.rebase inline',
      ...HISTORY,
      ...COPIES,
      'mount.close menu',
    ],
  },
  {
    name: 'Behind, 2 uncommitted',
    facts: facts({ behind: 4, dirty: 2 }),
    expected: [
      ...WITH_PR,
      ...TOOLS,
      `mount.rebase inline (${DIRTY_2})`,
      `mount.rewriteHistory menu (${DIRTY_2})`,
      'mount.switchBranch chip (The 2 uncommitted changes would follow you. Commit or discard them first.)',
      ADD_TASK,
      ...COPIES,
      'mount.close menu',
    ],
  },
  {
    name: 'Diverged from origin',
    facts: facts({ unpushed: 1, isDiverged: true }),
    expected: [...WITH_PR, ...TOOLS, 'mount.push menu', ...HISTORY, ...COPIES, 'mount.close menu'],
  },
  {
    name: 'Rebase stopped',
    facts: facts({ dirty: 3, isRebasing: true }),
    expected: [
      ...WITH_PR,
      'mount.openTerminal notice',
      'mount.openInEditor menu',
      'mount.scripts menu',
      'mount.browseFiles menu',
      'mount.abortRebase notice',
      'mount.rewriteHistory menu (Finish or abort the rebase first.)',
      ADD_TASK,
      ...COPIES,
    ],
  },
  {
    name: 'Merged',
    facts: facts({ pr: 'merged', ahead: 0 }),
    expected: [
      'mount.openPullRequest inline',
      ...TOOLS,
      'mount.switchBranch chip',
      ADD_TASK,
      ...COPIES,
      'mount.close inline',
    ],
  },
  {
    name: 'PR closed',
    facts: facts({ pr: 'closed' }),
    expected: [...WITH_PR, ...TOOLS, ...HISTORY, ...COPIES, 'mount.close menu'],
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
      'mount.switchBranch chip',
      ADD_TASK,
      'mount.startTurnsHere menu',
      ...COPIES,
      'mount.close menu',
    ],
  },
  {
    name: 'Worktree closed, files kept',
    facts: facts({ isClosed: true, worktreePath: null }),
    expected: ['mount.reopen inline', ...COPIES, 'mount.forget menu'],
  },
];

const definitions = MOUNT_KIND.actions;

describe.each(STATES)('mount, $name', ({ facts: state, expected }) => {
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

describe('mount, labels by state', () => {
  it('names the cleanup Close branch whether or not the pull request merged', () => {
    const merged = resolveActions({ definitions, facts: facts({ pr: 'merged', ahead: 0 }) });
    const open = resolveActions({ definitions, facts: facts({}) });
    expect(merged.find((action) => action.id === 'mount.close')?.label).toBe('Close branch');
    expect(open.find((action) => action.id === 'mount.close')?.label).toBe('Close branch');
  });

  it('says a close with uncommitted changes keeps them', () => {
    const close = resolveActions({ definitions, facts: facts({ dirty: 2 }) }).find(
      (action) => action.id === 'mount.close',
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
    }).find((action) => action.id === 'mount.forget');
    expect(forget?.blockedReason).toBe(
      'Work is still running in hl/fix-duplicate-credit; stop it first.',
    );
  });

  it('holds Create PR while Scribe is still writing', () => {
    const create = resolveActions({
      definitions,
      facts: facts({
        pr: null,
        requestLabel: null,
        requestNumber: null,
        requestProvider: null,
        isScribeWriting: true,
      }),
    }).find((action) => action.id === 'mount.createPullRequest');
    expect(create?.blockedReason).toBe('Scribe is still writing the text.');
  });

  it('counts own commits and says force push once the branch diverged from origin', () => {
    const push = ({ overrides }: { readonly overrides: Parameters<typeof facts>[0] }) =>
      resolveActions({ definitions: MOUNT_KIND.actions, facts: facts(overrides) }).find(
        (action) => action.id === 'mount.push',
      );

    expect(push({ overrides: { ahead: 5, unpushed: 83, isDiverged: true } })?.label).toBe(
      'Force push 5 commits',
    );
    expect(push({ overrides: { ahead: 1, unpushed: 9, isDiverged: true } })?.label).toBe(
      'Force push 1 commit',
    );
    expect(push({ overrides: { ahead: 6, unpushed: 2 } })?.label).toBe('Push 2 commits');
    expect(push({ overrides: { ahead: 5, unpushed: 83, isDiverged: true } })?.description).toBe(
      'Your branch and the online copy differ. Force push replaces the online copy (with lease).',
    );
    expect(push({ overrides: { ahead: 6, unpushed: 2 } })?.description).toBeNull();
  });

  it('enables the force push with a confirm only when the branch has own commits', () => {
    const push = ({ overrides }: { readonly overrides: Parameters<typeof facts>[0] }) =>
      resolveActions({ definitions: MOUNT_KIND.actions, facts: facts(overrides) }).find(
        (action) => action.id === 'mount.push',
      );

    const forced = push({ overrides: { ahead: 5, unpushed: 83, isDiverged: true } });
    expect(forced?.blockedReason).toBeNull();
    expect(forced?.confirm).toEqual({
      title: 'Replace the online copy?',
      description:
        'This machine has not checked the online copy yet. Anything pushed there since is lost.',
      confirmLabel: 'Force push',
      role: 'danger',
    });
    expect(
      push({ overrides: { ahead: 5, unpushed: 83, isDiverged: true, onlyOnline: [] } })?.confirm,
    ).toEqual({
      title: 'Replace the online copy?',
      description: 'The online copy has no commits you lack. Nothing online is lost.',
      confirmLabel: 'Force push',
      role: 'danger',
    });
    expect(
      push({
        overrides: {
          ahead: 5,
          unpushed: 83,
          isDiverged: true,
          onlyOnline: ['Fix rounding', 'Add retry', 'Drop flag', 'Bump deps', 'Tidy'].map(
            (subject, index) => ({ sha: `sha-${index}`, subject }),
          ),
        },
      })?.confirm,
    ).toEqual({
      title: 'Replace the online copy and drop 5 commits?',
      description: 'These exist only online and are lost if you force push.',
      notes: ['Fix rounding', 'Add retry', 'Drop flag', 'and 2 more'],
      confirmLabel: 'Force push anyway',
      role: 'danger',
    });
    expect(
      push({
        overrides: {
          ahead: 5,
          unpushed: 83,
          isDiverged: true,
          onlyOnline: [{ sha: 'sha-0', subject: 'Fix rounding' }],
        },
      })?.confirm?.title,
    ).toBe('Replace the online copy and drop 1 commit?');
    expect(push({ overrides: { ahead: 0, unpushed: 2, isDiverged: true } })?.blockedReason).toBe(
      'Origin has a commit this branch lacks. Rebase on it first.',
    );
    expect(push({ overrides: { ahead: 6, unpushed: 2 } })?.confirm).toBeNull();
    expect(push({ overrides: { ahead: 6, unpushed: 2 } })?.blockedReason).toBeNull();
  });
});
