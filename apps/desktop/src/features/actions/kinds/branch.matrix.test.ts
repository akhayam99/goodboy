// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { matrixOf } from '../../../__tests__/helpers/actionMatrix';
import type { ActionEnv } from '../types';
import { BRANCH_KIND, type BranchFacts } from './branch';

const facts = (overrides: Partial<BranchFacts>): BranchFacts => ({
  name: 'hl/flaky-retry-test',
  isSafe: true,
  unmergedCommits: 0,
  isBusy: false,
  onOpenSession: vi.fn(),
  onDelete: vi.fn(async () => undefined),
  ...overrides,
});

const OPEN_SESSION = 'branch.openSession menu';
const COPY = 'branch.copyName menu';
const DELETE = 'branch.delete hover';

const STATES: ReadonlyArray<{
  readonly name: string;
  readonly facts: BranchFacts;
  readonly expected: ReadonlyArray<string>;
}> = [
  {
    name: 'a merged branch made by a session',
    facts: facts({}),
    expected: [OPEN_SESSION, COPY, DELETE],
  },
  {
    name: 'a branch no session made',
    facts: facts({ onOpenSession: null }),
    expected: [COPY, DELETE],
  },
  {
    name: 'a delete already running',
    facts: facts({ isBusy: true }),
    expected: [OPEN_SESSION, COPY, 'branch.delete hover (Another delete is running)'],
  },
];

const env: ActionEnv = {
  getState: () => {
    throw new Error('this verb does not read the store');
  },
  showToast: vi.fn(),
  copyText: vi.fn(async () => undefined),
  origin: 'menu',
  anchorKey: null,
  viewing: null,
};

const deleteAction = () => {
  const found = BRANCH_KIND.actions.find((action) => action.id === 'branch.delete');
  if (found === undefined) {
    throw new Error('no branch.delete');
  }
  return found;
};

describe('branch kind matrix', () => {
  it.each(STATES)('$name', ({ facts: given, expected }) => {
    expect(matrixOf({ definitions: BRANCH_KIND.actions, facts: given })).toEqual(expected);
  });

  it('deletes a safe branch without asking, and an undo is offered by the page', () => {
    expect(deleteAction().confirm?.({ facts: facts({}) })).toBeNull();
    expect(deleteAction().isUndoable).toBe(true);
  });

  it('asks before deleting a branch with work that is not merged', () => {
    expect(
      deleteAction().confirm?.({
        facts: facts({ isSafe: false, unmergedCommits: 3 }),
      }),
    ).toEqual({
      title: 'Delete hl/flaky-retry-test?',
      description: 'Kept for 14 days so you can restore it.',
      confirmLabel: 'Delete and 3 commits',
      role: 'danger',
      notes: ['3 commits not merged anywhere else.'],
    });
  });

  it('asks with a plain Delete when nothing would be lost but the verdict is not safe', () => {
    expect(
      deleteAction().confirm?.({ facts: facts({ isSafe: false, unmergedCommits: 0 }) }),
    ).toEqual({
      title: 'Delete hl/flaky-retry-test?',
      description: 'Kept for 14 days so you can restore it.',
      confirmLabel: 'Delete',
      role: 'danger',
    });
  });

  it('runs the delete of the page and copies the name', async () => {
    const given = facts({});
    const copyText = vi.fn(async () => undefined);

    await deleteAction().run({ facts: given, env, choice: null });
    await BRANCH_KIND.actions
      .find((action) => action.id === 'branch.copyName')
      ?.run({ facts: given, env: { ...env, copyText }, choice: null });

    expect(given.onDelete).toHaveBeenCalledTimes(1);
    expect(copyText).toHaveBeenCalledWith({ text: 'hl/flaky-retry-test' });
  });

  it('keeps the branch and rejects when the delete fails', async () => {
    const failing = facts({ onDelete: () => Promise.reject(new Error('git refused')) });

    await expect(deleteAction().run({ facts: failing, env, choice: null })).rejects.toThrow(
      'git refused',
    );
  });
});
