// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  attemptFailureSentence,
  causeOfThread,
  failureSentence,
  threadFailureSentence,
} from './failureSentence';
import { NEEDS_RUN_REASON } from './needsRunReason';

const FOUND = 'It touches the ledger layout, the payouts route and two new components.';

describe('failureSentence', () => {
  it('says the fix agent stopped because the comment is bigger than one change', () => {
    expect(failureSentence({ cause: 'needs_a_run' })).toBe(
      'The fix agent stopped: this is bigger than one change',
    );
  });

  it('reads the thread own needs-run reason before the cause of its batch attempt', () => {
    const thread = { stateReason: NEEDS_RUN_REASON.stateReasonOf({ reason: FOUND }) };
    const attempt = { phase: 'failed' as const, failureCause: 'no_result' as const };
    expect(causeOfThread({ thread, attempt })).toBe('needs_a_run');
    expect(threadFailureSentence({ thread, attempt })).toBe(
      'The fix agent stopped: this is bigger than one change',
    );
    expect(causeOfThread({ thread: { stateReason: null }, attempt })).toBe('no_result');
  });

  it('falls back to the attempt for a thread whose reason is not a needs-run reason', () => {
    const attempt = { phase: 'cancelled' as const, failureCause: null };
    expect(causeOfThread({ thread: { stateReason: 'question' }, attempt })).toBe('stopped');
    expect(causeOfThread({ thread: { stateReason: 'needs_run' }, attempt: null })).toBeNull();
  });

  it('keeps the attempt sentence for the attempt history of a run that needed a run', () => {
    expect(
      attemptFailureSentence({ attempt: { phase: 'failed', failureCause: 'needs_a_run' } }),
    ).toBe('The fix agent stopped: this is bigger than one change');
  });
});

describe('NEEDS_RUN_REASON', () => {
  it('round-trips the agent sentence through the thread state reason', () => {
    const stateReason = NEEDS_RUN_REASON.stateReasonOf({ reason: FOUND });
    expect(NEEDS_RUN_REASON.reasonOf({ stateReason })).toBe(FOUND);
    expect(NEEDS_RUN_REASON.reasonOf({ stateReason: 'wontfix:no' })).toBeNull();
    expect(NEEDS_RUN_REASON.reasonOf({ stateReason: null })).toBeNull();
  });
});
