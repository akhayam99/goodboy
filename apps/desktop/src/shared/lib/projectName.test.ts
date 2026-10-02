import { describe, expect, it } from 'vitest';
import { joinPath, projectNameProblem } from './projectName';

describe('projectNameProblem', () => {
  it('stays quiet for an empty name and for a good one', () => {
    expect(projectNameProblem('')).toBeNull();
    expect(projectNameProblem('  ')).toBeNull();
    expect(projectNameProblem('cascadia')).toBeNull();
    expect(projectNameProblem('ledger-core_2.0')).toBeNull();
  });

  it('names the first problem it finds', () => {
    expect(projectNameProblem('my game')).toBe(
      'Use letters, numbers, dashes, dots and underscores',
    );
    expect(projectNameProblem('a/b')).toBe('Use letters, numbers, dashes, dots and underscores');
    expect(projectNameProblem('.hidden')).toBe('Start the name with a letter or a number');
    expect(projectNameProblem('-flag')).toBe('Start the name with a letter or a number');
    expect(projectNameProblem('tail.')).toBe('End the name with a letter or a number');
    expect(projectNameProblem('a'.repeat(65))).toBe('Keep the name under 64 characters');
  });
});

describe('joinPath', () => {
  it('joins a parent and a trimmed name once', () => {
    expect(joinPath({ parent: '/Users/dana/games/', name: ' cascadia ' })).toBe(
      '/Users/dana/games/cascadia',
    );
    expect(joinPath({ parent: 'C:\\games', name: 'cascadia' })).toBe('C:\\games\\cascadia');
  });
});
