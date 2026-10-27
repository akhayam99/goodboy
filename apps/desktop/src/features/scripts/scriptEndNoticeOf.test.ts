import { describe, expect, it } from 'vitest';
import { nextSessionId } from '@goodboy/types/testing';
import { brandId, type MountId } from '@goodboy/types';
import type { ScriptRunRecord } from './scripts';
import { scriptEndNoticeOf } from './scriptEndNoticeOf';

const SESSION_ID = nextSessionId();
const OTHER_SESSION_ID = nextSessionId();
const MOUNT_ID = brandId<MountId>({ value: 'mount-ledger' });
const MOUNT = { mountId: MOUNT_ID, mountName: 'ledger-core' };

const failed: ScriptRunRecord = {
  status: 'error',
  result: { stdout: 'FAIL', stderr: '', exitCode: 1 },
  runId: 'run-1',
  startedAt: 1,
  name: 'Check posting drift',
  mountId: MOUNT_ID,
};

type StateParams = {
  readonly record: ScriptRunRecord | undefined;
  readonly currentSessionId?: typeof SESSION_ID | null;
};

const stateOf = ({ record, currentSessionId = OTHER_SESSION_ID }: StateParams) => ({
  currentSessionId,
  scriptRuns: record === undefined ? {} : { [SESSION_ID]: { drift: record } },
  sessionProjectMounts: { [SESSION_ID]: [MOUNT] },
});

const detail = { sessionId: SESSION_ID, scriptKey: 'drift', runId: 'run-1' };

describe('scriptEndNoticeOf', () => {
  it('says which script failed and where, for a session that is not on screen', () => {
    expect(scriptEndNoticeOf({ state: stateOf({ record: failed }), detail })).toEqual({
      kind: 'warning',
      message: 'Check posting drift failed in ledger-core',
      mountId: MOUNT_ID,
    });
  });

  it('says a passing script finished', () => {
    const record: ScriptRunRecord = {
      ...failed,
      status: 'ok',
      result: { stdout: '', stderr: '', exitCode: 0 },
    };
    expect(scriptEndNoticeOf({ state: stateOf({ record }), detail })?.message).toBe(
      'Check posting drift finished in ledger-core',
    );
  });

  it('says nothing for the session on screen', () => {
    expect(
      scriptEndNoticeOf({
        state: stateOf({ record: failed, currentSessionId: SESSION_ID }),
        detail,
      }),
    ).toBeNull();
  });

  it('says nothing for a run that was replaced, stopped or is gone', () => {
    expect(
      scriptEndNoticeOf({ state: stateOf({ record: { ...failed, runId: 'run-2' } }), detail }),
    ).toBeNull();
    expect(
      scriptEndNoticeOf({
        state: stateOf({ record: { ...failed, status: 'cancelled' } }),
        detail,
      }),
    ).toBeNull();
    expect(scriptEndNoticeOf({ state: stateOf({ record: undefined }), detail })).toBeNull();
  });

  it('leaves the project out when the run has no mount', () => {
    const { mountId: _mountId, ...record } = failed;
    expect(scriptEndNoticeOf({ state: stateOf({ record }), detail })).toEqual({
      kind: 'warning',
      message: 'Check posting drift failed',
      mountId: null,
    });
  });
});
