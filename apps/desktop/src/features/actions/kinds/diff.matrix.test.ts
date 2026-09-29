// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { MountId, ProjectId, SessionId } from '@goodboy/types';
import { matrixOf, slotCount } from '../../../__tests__/helpers/actionMatrix';
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
  patch: 'diff --git a/src/credit.ts b/src/credit.ts',
  rebaseConflicts: 0,
  ...overrides,
});

const TOOLS = ['diff.openTerminal menu', 'diff.openInEditor menu'];
const COPIES = ['diff.copyBranch menu', 'diff.copyPatch menu'];
const DIRTY_2 = 'Commit or discard the 2 uncommitted changes first.';

const STATES: ReadonlyArray<{
  readonly name: string;
  readonly facts: DiffFacts;
  readonly expected: ReadonlyArray<string>;
}> = [
  {
    name: 'On origin, PR open',
    facts: facts({}),
    expected: [
      'diff.openPullRequest secondary',
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
      'diff.openPullRequest secondary',
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
      'diff.openPullRequest secondary',
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
      'diff.openPullRequest secondary',
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
      'diff.openPullRequest secondary',
      ...TOOLS,
      'diff.push menu (Origin has a commit this branch lacks. Rebase on it first; Rewrite history owns force pushes.)',
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
      'diff.openPullRequest secondary',
      'diff.continueRebase primary',
      'diff.openInEditor menu',
      'diff.abortRebase secondary',
      'diff.rewriteHistory secondary (Finish or abort the rebase first.)',
      'diff.restoreBackup menu (Commit or discard the 3 uncommitted changes first.)',
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
});
