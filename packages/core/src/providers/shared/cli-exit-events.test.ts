import { describe, expect, it } from 'vitest';
import type { IsoDateTime, ProviderRunId } from '@goodboy/types';
import { cliExitEvents } from './cli-exit-events';

const RUN_ID = 'run_cli_exit' as ProviderRunId;
const AT = '2026-08-02T00:00:00.000Z' as IsoDateTime;

describe('cliExitEvents', () => {
  it('names the rejected flag and binary without including the usage text', () => {
    const events = cliExitEvents({
      exitCode: 2,
      stderr: 'flags provided but not defined: -m\nUsage:\n  agy [flags]\n  hundreds of lines',
      runId: RUN_ID,
      at: AT,
      binary: 'agy',
    });
    expect(events).toEqual([
      {
        kind: 'error',
        runId: RUN_ID,
        message: 'The installed agy CLI does not accept the -m flag.',
        at: AT,
      },
    ]);
  });

  it('quotes only the first non-empty stderr line for a plain non-zero exit', () => {
    const events = cliExitEvents({
      exitCode: 1,
      stderr: '\nquota exceeded\nUsage:\n  agy [flags]',
      runId: RUN_ID,
      at: AT,
      binary: 'agy',
    });
    expect(events[0]).toMatchObject({
      kind: 'error',
      message: 'agy exited with code 1: "quota exceeded".',
    });
  });

  it('returns no events for a successful exit', () => {
    expect(
      cliExitEvents({ exitCode: 0, stderr: 'ignored', runId: RUN_ID, at: AT, binary: 'agy' }),
    ).toEqual([]);
  });

  it('returns no events for a signalled exit', () => {
    expect(
      cliExitEvents({ exitCode: null, stderr: 'ignored', runId: RUN_ID, at: AT, binary: 'agy' }),
    ).toEqual([]);
  });
});
