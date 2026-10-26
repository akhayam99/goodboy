import { describe, expect, it } from 'vitest';
import type { ScriptRunRecord } from '../../../scripts/scripts';
import { scriptsSignalOf } from './scriptsSignalOf';

const record = (overrides: Partial<ScriptRunRecord>): ScriptRunRecord => ({
  status: 'ok',
  result: { stdout: '', stderr: '', exitCode: 0 },
  runId: 'run-1',
  startedAt: 1,
  ...overrides,
});

const failed = (runId: string, name: string): ScriptRunRecord =>
  record({
    status: 'error',
    result: { stdout: 'FAIL', stderr: '', exitCode: 1 },
    runId,
    name,
  });

describe('scriptsSignalOf', () => {
  it('has no signal when nothing ran', () => {
    expect(scriptsSignalOf({ runs: undefined, seen: undefined })).toBeNull();
    expect(scriptsSignalOf({ runs: { lint: record({}) }, seen: undefined })).toBeNull();
  });

  it('shows a running dot while a script runs', () => {
    const runs = { dev: record({ status: 'pending', result: null }) };
    expect(scriptsSignalOf({ runs, seen: undefined })).toEqual({
      kind: 'running',
      note: '1 script running',
    });
    expect(
      scriptsSignalOf({
        runs: { ...runs, test: record({ status: 'pending', result: null, runId: 'run-2' }) },
        seen: undefined,
      })?.note,
    ).toBe('2 scripts running');
  });

  it('shows an error dot for a failed run that nobody opened, naming it', () => {
    expect(
      scriptsSignalOf({ runs: { drift: failed('run-1', 'Check posting drift') }, seen: {} }),
    ).toEqual({ kind: 'error', note: 'Check posting drift failed. Open its output.' });
  });

  it('clears the error dot once that run was opened', () => {
    const runs = { drift: failed('run-1', 'Check posting drift') };
    expect(scriptsSignalOf({ runs, seen: { drift: 'run-1' } })).toBeNull();
  });

  it('raises the dot again when the same script fails in a new run', () => {
    const runs = { drift: failed('run-2', 'Check posting drift') };
    expect(scriptsSignalOf({ runs, seen: { drift: 'run-1' } })?.kind).toBe('error');
  });

  it('counts several failed runs and lets a failure win over a running script', () => {
    const runs = {
      drift: failed('run-1', 'Check posting drift'),
      lint: failed('run-2', 'lint'),
      dev: record({ status: 'pending', result: null, runId: 'run-3' }),
    };
    expect(scriptsSignalOf({ runs, seen: undefined })).toEqual({
      kind: 'error',
      note: '2 scripts failed. Open their output.',
    });
  });

  it('does not call a stopped run a failure', () => {
    const runs = { dev: record({ status: 'cancelled' }) };
    expect(scriptsSignalOf({ runs, seen: undefined })).toBeNull();
  });
});
