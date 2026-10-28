// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { worktreeStatusOf } from '../../test/worktreeStatusOf';
import { mainBehindOf } from './gitStatus';

describe('mainBehindOf', () => {
  it('reads the distance behind main for a live branch', () => {
    expect(mainBehindOf({ status: worktreeStatusOf({ behind: 63 }), isDone: false })).toBe(63);
  });

  it('never counts a done branch as behind, however far it is', () => {
    expect(mainBehindOf({ status: worktreeStatusOf({ behind: 84 }), isDone: true })).toBeNull();
  });

  it('says nothing without a status', () => {
    expect(mainBehindOf({ status: null, isDone: false })).toBeNull();
    expect(mainBehindOf({ status: undefined, isDone: false })).toBeNull();
  });
});
