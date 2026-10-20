import { describe, expect, it } from 'vitest';
import {
  canRerunChecks,
  checksRunOfResult,
  checksTextOf,
  checksVerdictOf,
  notCheckedOf,
} from './checks';

describe('checksVerdictOf', () => {
  it('reads green when every script passes', () => {
    const verdict = checksVerdictOf({
      reports: [
        { name: 'typecheck', status: 'pass' },
        { name: 'lint', status: 'pass' },
      ],
      commit: 'abc123',
    });
    expect(verdict.run).toEqual({ verdict: 'green', reason: null, commit: 'abc123' });
    expect(verdict.checks.every((check) => check.source === 'harness')).toBe(true);
    expect(checksTextOf(verdict)).toBe('Checks green: typecheck, lint');
  });

  it('reads red and names the failing scripts', () => {
    const verdict = checksVerdictOf({
      reports: [
        { name: 'typecheck', status: 'fail' },
        { name: 'lint', status: 'pass' },
      ],
      commit: 'abc123',
    });
    expect(verdict.run.verdict).toBe('red');
    expect(checksTextOf(verdict)).toBe('Checks red: typecheck');
  });

  it('keeps red when another script timed out', () => {
    const verdict = checksVerdictOf({
      reports: [
        { name: 'test', status: 'timed_out' },
        { name: 'lint', status: 'fail' },
      ],
      commit: 'abc123',
    });
    expect(verdict.run.verdict).toBe('red');
  });

  it('reads not checked when a script timed out and none failed', () => {
    const verdict = checksVerdictOf({
      reports: [
        { name: 'test', status: 'timed_out' },
        { name: 'lint', status: 'pass' },
      ],
      commit: 'abc123',
    });
    expect(verdict.run).toEqual({ verdict: 'not_checked', reason: 'timed_out', commit: 'abc123' });
    expect(verdict.checks.find((check) => check.name === 'test')?.status).toBe('unknown');
    expect(checksTextOf(verdict)).toBe('Not checked: timed out');
  });

  it('never reads green when a script could not run', () => {
    const verdict = checksVerdictOf({
      reports: [{ name: 'lint', status: 'unknown' }],
      commit: 'abc123',
    });
    expect(verdict.run.verdict).toBe('not_checked');
    expect(verdict.run.reason).toBe('not_available');
  });

  it('reads not checked with no scripts ticked', () => {
    const verdict = checksVerdictOf({ reports: [], commit: 'abc123' });
    expect(verdict.run.reason).toBe('none_ticked');
    expect(verdict.checks).toEqual([]);
  });
});

describe('checksRunOfResult', () => {
  it('reads the verdict a result carries', () => {
    const result = {
      verified: { checksRun: { verdict: 'red', reason: null, commit: 'abc123' } },
    };
    expect(checksRunOfResult({ result })).toEqual({
      verdict: 'red',
      reason: null,
      commit: 'abc123',
    });
  });

  it('reads nothing from a result without one or with a bad one', () => {
    expect(checksRunOfResult({ result: { verified: {} } })).toBeNull();
    expect(checksRunOfResult({ result: null })).toBeNull();
    expect(
      checksRunOfResult({
        result: { verified: { checksRun: { verdict: 'green', reason: 'x', commit: null } } },
      }),
    ).toBeNull();
  });
});

describe('canRerunChecks', () => {
  it('offers a rerun when a commit was recorded', () => {
    expect(
      canRerunChecks({ run: notCheckedOf({ reason: 'tree_moved', commit: 'abc123' }).run }),
    ).toBe(true);
  });

  it('offers none for a dirty tree', () => {
    expect(
      canRerunChecks({ run: notCheckedOf({ reason: 'tree_dirty', commit: 'abc123' }).run }),
    ).toBe(false);
  });

  it('offers none when nothing is ticked or no commit is known', () => {
    expect(
      canRerunChecks({ run: notCheckedOf({ reason: 'none_ticked', commit: 'abc123' }).run }),
    ).toBe(false);
    expect(
      canRerunChecks({ run: notCheckedOf({ reason: 'not_available', commit: null }).run }),
    ).toBe(false);
  });
});
