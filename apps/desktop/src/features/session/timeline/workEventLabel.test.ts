// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { WorkEvent } from '@goodboy/db';
import { brandId, type SessionId } from '@goodboy/types';
import { segmentsToText } from './sessionEventPresentation';
import { workEventLabel } from './workEventLabel';

const SESSION_ID = brandId<SessionId>({ value: 'session-ledger-core' });

type RunParams = {
  readonly kind: WorkEvent['kind'];
  readonly endedAt: number | null;
  readonly exitCode: number | null;
};

const textOf = ({ kind, endedAt, exitCode }: RunParams): string =>
  segmentsToText({
    segments: workEventLabel({
      entry: {
        kind: 'work',
        id: 'work:w1',
        at: '2026-11-20T10:00:00.000Z',
        mountName: 'ledger-core',
        work: {
          id: 'w1',
          runId: 'run-w1',
          sessionId: SESSION_ID,
          mountId: null,
          agentId: null,
          kind,
          startedAt: 1_000,
          endedAt,
          exitCode,
          payload: { name: kind === 'check-rerun' ? 'integration-tests' : 'test' },
        },
      },
    }),
  });

describe('workEventLabel', () => {
  it('says how a script run ended, in the words of the Scripts pane', () => {
    expect(textOf({ kind: 'script', endedAt: 2_000, exitCode: 0 })).toBe(
      'test passed in ledger-core',
    );
    expect(textOf({ kind: 'script', endedAt: 2_000, exitCode: 2 })).toBe(
      'test failed (exit 2) in ledger-core',
    );
    expect(textOf({ kind: 'script', endedAt: 2_000, exitCode: 143 })).toBe(
      'test stopped in ledger-core',
    );
    expect(textOf({ kind: 'script', endedAt: null, exitCode: null })).toBe(
      'test started in ledger-core',
    );
  });

  it('names a check rerun by its check', () => {
    expect(textOf({ kind: 'check-rerun', endedAt: 2_000, exitCode: 0 })).toBe(
      'integration-tests rerun passed in ledger-core',
    );
  });
});
