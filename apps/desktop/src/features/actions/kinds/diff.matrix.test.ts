// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { MountId, ProjectId, SessionId } from '@goodboy/types';
import { matrixOf, slotCount } from '../../../__tests__/helpers/actionMatrix';
import { resolveActions } from '../resolveActions';
import { DIFF_KIND, type DiffFacts } from './diff';

const NO_PR = {
  pr: null,
  requestLabel: null,
  requestNumber: null,
  requestProvider: null,
} as const;

const facts = (overrides: Partial<DiffFacts>): DiffFacts => ({
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
  isBranchGone: false,
  canRestoreBranch: false,
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
  rebaseConflict: null,
  autoBlockedReason: null,
  comments: 0,
  canStartTurnsHere: false,
  isScribeWriting: false,
  blockers: [],
  editors: [],
  patch: 'diff --git a/src/credit.ts b/src/credit.ts',
  rebaseConflicts: 0,
  ...overrides,
});

const TOOLS = ['diff.openTerminal menu', 'diff.openInEditor menu'];
const COPIES = ['diff.copyBranch menu', 'diff.copyPatch menu'];
const DIRTY_2 = '2 files have changes that are not committed. Commit or stash them first.';

const STATES: ReadonlyArray<{
  readonly name: string;
  readonly facts: DiffFacts;
  readonly expected: ReadonlyArray<string>;
}> = [
  {
    name: 'On origin, PR open',
    facts: facts({}),
    expected: [
      ...TOOLS,
      'diff.rewriteHistory secondary',
      'diff.changeBase menu',
      'diff.restoreBackup menu',
      ...COPIES,
    ],
  },
  {
    name: '3 not pushed, no PR',
    facts: facts({ ...NO_PR, ahead: 3, unpushed: 3 }),
    expected: [
      ...TOOLS,
      'diff.createPullRequest primary',
      'diff.rewriteHistory secondary',
      'diff.changeBase menu',
      'diff.restoreBackup menu',
      ...COPIES,
    ],
  },
  {
    name: '2 not pushed, PR open',
    facts: facts({ ahead: 6, unpushed: 2 }),
    expected: [
      ...TOOLS,
      'diff.push primary',
      'diff.rewriteHistory secondary',
      'diff.changeBase menu',
      'diff.restoreBackup menu',
      ...COPIES,
    ],
  },
  {
    name: 'Behind main by 4',
    facts: facts({ behind: 4 }),
    expected: [
      ...TOOLS,
      'diff.rebase primary',
      'diff.rewriteHistory secondary',
      'diff.changeBase menu',
      'diff.restoreBackup menu',
      ...COPIES,
    ],
  },
  {
    name: '2 uncommitted',
    facts: facts({ behind: 4, dirty: 2 }),
    expected: [
      ...TOOLS,
      `diff.rebase primary (${DIRTY_2})`,
      `diff.rewriteHistory secondary (${DIRTY_2})`,
      'diff.changeBase menu',
      `diff.restoreBackup menu (${DIRTY_2})`,
      ...COPIES,
    ],
  },
  {
    name: 'Diverged',
    facts: facts({ unpushed: 1, isDiverged: true }),
    expected: [
      ...TOOLS,
      'diff.push menu',
      'diff.rewriteHistory secondary',
      'diff.changeBase menu',
      'diff.restoreBackup menu',
      ...COPIES,
    ],
  },
  {
    name: 'Rebase stopped',
    facts: facts({ dirty: 3, isRebasing: true }),
    expected: [
      'diff.continueRebase primary',
      'diff.openInEditor menu',
      'diff.abortRebase secondary',
      'diff.rewriteHistory secondary (Finish or abort the rebase first.)',
      'diff.restoreBackup menu (3 files have changes that are not committed. Commit or stash them first.)',
      ...COPIES,
    ],
  },
  {
    name: 'No changes',
    facts: facts({ ...NO_PR, ahead: 0, patch: '' }),
    expected: [...TOOLS, 'diff.changeBase menu', 'diff.copyBranch menu'],
  },
];

const definitions = DIFF_KIND.actions;

describe.each(STATES)('diff, $name', ({ facts: state, expected }) => {
  it('offers exactly the planned actions', () => {
    expect(matrixOf({ definitions, facts: state })).toEqual(expected);
  });

  it('stays in budget', () => {
    expect(slotCount({ definitions, facts: state, slot: 'primary' })).toBeLessThanOrEqual(1);
    expect(slotCount({ definitions, facts: state, slot: 'secondary' })).toBeLessThanOrEqual(3);
  });
});

describe('diff, the rebase label', () => {
  it('names the predicted conflicts on Rebase', () => {
    expect(matrixOf({ definitions, facts: facts({ behind: 4, rebaseConflicts: 2 }) })).toContain(
      'diff.rebase primary',
    );
    const rebase = DIFF_KIND.actions.find((action) => action.id === 'diff.rebase');
    const label = rebase?.label;
    expect(
      typeof label === 'function'
        ? label({ facts: facts({ behind: 4, rebaseConflicts: 2 }) })
        : label,
    ).toBe('Rebase on main · 2 conflicts');
  });

  it('counts own commits and says force push once the branch diverged from origin', () => {
    const push = ({ overrides }: { readonly overrides: Parameters<typeof facts>[0] }) =>
      resolveActions({ definitions: DIFF_KIND.actions, facts: facts(overrides) }).find(
        (action) => action.id === 'diff.push',
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
      resolveActions({ definitions: DIFF_KIND.actions, facts: facts(overrides) }).find(
        (action) => action.id === 'diff.push',
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
