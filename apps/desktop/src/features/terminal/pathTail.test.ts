import { describe, expect, it } from 'vitest';
import { pathTail } from './pathTail';

const WORKTREE = '/mock/harborline/payments-api/.goodboy/worktrees/gb-7k2q9x';

const tailOf = (path: string): string => path.slice(path.search(pathTail({ path })));

describe('pathTail', () => {
  it('keeps the project folder and the gb- folder of a worktree readable', () => {
    expect(tailOf(WORKTREE)).toBe('/payments-api/.goodboy/worktrees/gb-7k2q9x');
  });

  it('keeps the last two folders of any other path', () => {
    expect(tailOf('/mock/harborline/payments-api')).toBe('/harborline/payments-api');
  });

  it('keeps nothing apart for a path of one folder', () => {
    expect('/harborline'.search(pathTail({ path: '/harborline' }))).toBe(-1);
  });
});
