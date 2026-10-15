// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { ActionDefinition } from '../types';
import { DIFF_KIND } from './diff';
import { pushDoneLabel } from './gitRuns';
import { PULL_REQUEST_KIND } from './pullRequest';

const MUTATING: ReadonlyArray<string> = [
  'diff.rebase',
  'diff.push',
  'diff.abortRebase',
  'pullRequest.markReady',
  'pullRequest.merge',
  'pullRequest.reopen',
  'pullRequest.convertToDraft',
  'pullRequest.close',
  'pullRequest.cancelAutoMerge',
];

const OPENS_A_FORM: ReadonlyArray<string> = ['diff.createPullRequest'];

const isAsync = (action: ActionDefinition<never>): boolean =>
  action.run.constructor.name === 'AsyncFunction';

const ALL: ReadonlyArray<ActionDefinition<never>> = [
  ...DIFF_KIND.actions,
  ...PULL_REQUEST_KIND.actions,
];

describe('every mutating button action says what is happening and what happened', () => {
  it('lists each mutating action in the registry', () => {
    const ids = ALL.map((action) => action.id);
    expect(MUTATING.filter((id) => !ids.includes(id))).toEqual([]);
  });

  it.each(MUTATING)('%s defines pendingLabel and doneLabel', (id) => {
    const action = ALL.find((candidate) => candidate.id === id);
    expect(action?.pendingLabel).toBeTypeOf('function');
    expect(action?.doneLabel).toBeTypeOf('function');
  });

  it('puts every async action of the diff and pull request kinds in the list', () => {
    const unlisted = ALL.filter(
      (action) =>
        isAsync(action) && !MUTATING.includes(action.id) && !OPENS_A_FORM.includes(action.id),
    ).map((action) => action.id);
    expect(unlisted).toEqual([]);
  });

  it('gives a done word to every action that has a pending word', () => {
    const missing = ALL.filter(
      (action) => action.pendingLabel !== undefined && action.doneLabel === undefined,
    ).map((action) => action.id);
    expect(missing).toEqual([]);
  });
});

describe('pushDoneLabel', () => {
  const facts = {
    branch: 'hl/fix-credit',
    unpushed: 1,
    ahead: 0,
    isDiverged: false,
    onlyOnline: null,
  };

  it('counts the commits that left and names origin', () => {
    expect(pushDoneLabel({ facts })).toBe('Pushed 1 commit to origin.');
    expect(pushDoneLabel({ facts: { ...facts, unpushed: 3 } })).toBe('Pushed 3 commits to origin.');
  });

  it('says force pushed for a diverged branch and counts its own commits', () => {
    expect(pushDoneLabel({ facts: { ...facts, isDiverged: true, ahead: 2, unpushed: 5 } })).toBe(
      'Force pushed 2 commits to origin.',
    );
  });
});
