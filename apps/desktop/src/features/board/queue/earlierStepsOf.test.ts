// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { LiveWorkRow } from '../../live-state/readLiveWork';
import { earlierStepsOf } from './earlierStepsOf';

type RowParams = {
  readonly runId: string;
  readonly path: string | null;
};

const rowOf = ({ runId, path }: RowParams): LiveWorkRow => ({
  runId,
  sessionId: 'harborline-payouts',
  agentId: `${runId}-agent`,
  mountId: 'payments-api',
  workflowRunId: null,
  branch: null,
  startedAt: 0,
  quietMs: 0,
  tool: path === null ? null : { name: 'Edit', command: null, path },
  hasToolCall: path !== null,
  canSeeTools: true,
});

describe('the two steps before the live phrase', () => {
  it('keeps the two steps before the current one, newest first, without the current one', () => {
    const first = [rowOf({ runId: 'run-1', path: 'src/retry.ts' })];
    const second = [rowOf({ runId: 'run-1', path: 'src/limits.ts' })];
    const third = [rowOf({ runId: 'run-1', path: 'src/payout.ts' })];
    const fourth = [rowOf({ runId: 'run-1', path: 'src/ledger.ts' })];
    const afterTwo = earlierStepsOf({ previous: first, earlier: {}, next: second });
    const afterThree = earlierStepsOf({ previous: second, earlier: afterTwo, next: third });
    const afterFour = earlierStepsOf({ previous: third, earlier: afterThree, next: fourth });
    expect(afterFour['run-1']?.map((row) => row.tool?.path)).toEqual([
      'src/payout.ts',
      'src/limits.ts',
    ]);
  });

  it('adds nothing while the step stays the same and forgets a run that ended', () => {
    const rows = [rowOf({ runId: 'run-1', path: 'src/retry.ts' })];
    expect(earlierStepsOf({ previous: rows, earlier: {}, next: rows })).toEqual({ 'run-1': [] });
    expect(earlierStepsOf({ previous: rows, earlier: { 'run-1': rows }, next: [] })).toEqual({});
  });
});
