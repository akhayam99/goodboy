import { describe, expect, it } from 'vitest';
import { brandId, type MountId, type SessionId } from '@goodboy/types';
import type { ReportErrorParams } from './reportError';
import { pushFailureKeyOf, pushFailureReportOf } from './pushFailureReport';

const SESSION = brandId<SessionId>({ value: 'session-ledger-core' });
const MOUNT = brandId<MountId>({ value: 'mount-payments-api' });

describe('pushFailureReportOf', () => {
  it('names the retry and keeps the work when the push can be repeated', () => {
    expect(pushFailureReportOf({ sessionId: SESSION, mountId: MOUNT, isRetryable: true })).toEqual({
      sessionId: SESSION,
      coalesceKey: pushFailureKeyOf({ mountId: MOUNT }),
      recovery: {
        action: { kind: 'retry-push', sessionId: SESSION, mountId: MOUNT },
        clause: 'work-kept',
      },
    });
  });

  it('keeps the work and offers no button when the push cannot be repeated', () => {
    const report = pushFailureReportOf({ sessionId: SESSION, mountId: MOUNT, isRetryable: false });

    expect(report.recovery).toEqual({ clause: 'work-kept' });
  });

  it('spreads into a reportError call without losing a field', () => {
    const report = pushFailureReportOf({ sessionId: SESSION, mountId: MOUNT, isRetryable: true });
    const params = {
      title: "Couldn't push the branch",
      error: new Error('rejected'),
      ...report,
    } satisfies ReportErrorParams;

    expect(params.recovery).toEqual(report.recovery);
    expect(Object.keys(params).sort()).toEqual([
      'coalesceKey',
      'error',
      'recovery',
      'sessionId',
      'title',
    ]);
  });
});
