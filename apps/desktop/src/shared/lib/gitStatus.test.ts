import { describe, expect, it } from 'vitest';
import type { GitDistance, GitWorkingTree } from '@goodboy/types';
import {
  changedCount,
  distanceAhead,
  distanceBehind,
  isWorkingTreeClean,
  operationLabel,
  unknownReasonLabel,
  unmergedCount,
} from './gitStatus';

const known: GitWorkingTree = {
  kind: 'known',
  staged: 0,
  unstaged: 0,
  untracked: 0,
  unmerged: 0,
  changed: 0,
};

const unknownTree: GitWorkingTree = { kind: 'unknown', reason: 'status-read-failed' };

const unknownDistance: GitDistance = { kind: 'unknown', reason: 'rev-list-failed' };

describe('gitStatus readers', () => {
  it('never reports a count when the distance could not be read', () => {
    expect(distanceAhead({ distance: unknownDistance })).toBeNull();
    expect(distanceBehind({ distance: unknownDistance })).toBeNull();
    expect(distanceAhead({ distance: { kind: 'known', ahead: 3, behind: 1 } })).toBe(3);
    expect(distanceBehind({ distance: { kind: 'known', ahead: 3, behind: 1 } })).toBe(1);
  });

  it('never reports a count when the working tree could not be read', () => {
    expect(changedCount({ workingTree: unknownTree })).toBeNull();
    expect(unmergedCount({ workingTree: unknownTree })).toBeNull();
    expect(changedCount({ workingTree: { ...known, changed: 4 } })).toBe(4);
    expect(unmergedCount({ workingTree: { ...known, unmerged: 2, changed: 2 } })).toBe(2);
  });

  it('never calls an unreadable working tree clean', () => {
    expect(isWorkingTreeClean({ workingTree: unknownTree })).toBe(false);
    expect(isWorkingTreeClean({ workingTree: known })).toBe(true);
    expect(isWorkingTreeClean({ workingTree: { ...known, unstaged: 1, changed: 1 } })).toBe(false);
  });

  it('names every reason a read can fail and every operation that can be in progress', () => {
    expect(unknownReasonLabel({ reason: 'no-upstream' })).toBe(
      'this branch tracks no upstream yet',
    );
    expect(unknownReasonLabel({ reason: 'detached-head' })).toBe(
      "this checkout isn't on a branch, so there's no branch to update",
    );
    expect(unknownReasonLabel({ reason: 'rev-list-failed' })).toBe(
      'git could not compare this branch with its upstream',
    );
    expect(unknownReasonLabel({ reason: 'main-ref-unresolved' })).toBe(
      'git could not resolve a main branch to compare against',
    );
    expect(unknownReasonLabel({ reason: 'status-read-failed' })).toBe(
      'git status could not be read',
    );
    expect(operationLabel({ operation: 'merge' })).toBe('merge');
    expect(operationLabel({ operation: 'rebase' })).toBe('rebase');
    expect(operationLabel({ operation: 'cherry-pick' })).toBe('cherry-pick');
    expect(operationLabel({ operation: 'bisect' })).toBe('bisect');
  });
});
