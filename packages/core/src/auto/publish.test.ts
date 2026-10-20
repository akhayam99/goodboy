import { describe, expect, it } from 'vitest';
import {
  canPutBackPublish,
  canRetryPublish,
  publishGateOf,
  publishOfRequest,
  publishOfResult,
  publishTextOf,
  type ResultPublish,
} from './publish';

const aPublish = (patch: Partial<ResultPublish> = {}): ResultPublish => ({
  mode: 'force',
  state: 'awaiting_confirm',
  branch: 'harborline/fix-ledger',
  sha: 'a1b2c3d4e5f6',
  leaseSha: '0f9e8d7c6b5a',
  backupRef: 'refs/goodboy/backup/b-68/keep-1',
  message: null,
  isRetryable: false,
  isConfirmed: false,
  tries: 0,
  reviewerReportId: null,
  isContentChanging: false,
  ...patch,
});

describe('the publish gate of a writer', () => {
  it('goes when the agent finished and the checks are green or not run', () => {
    const base = { outcome: 'completed', exit: 'ok', completion: 'done' };
    expect(publishGateOf({ ...base, checksVerdict: 'green' })).toEqual({ kind: 'go' });
    expect(publishGateOf({ ...base, checksVerdict: 'not_checked' })).toEqual({ kind: 'go' });
    expect(publishGateOf({ ...base, checksVerdict: null })).toEqual({ kind: 'go' });
  });

  it('holds on red checks and on work that did not finish', () => {
    const base = { outcome: 'completed', exit: 'ok', completion: 'done' };
    expect(publishGateOf({ ...base, checksVerdict: 'red' })).toEqual({
      kind: 'held',
      message: 'the checks are red',
    });
    expect(publishGateOf({ ...base, outcome: 'failed', checksVerdict: 'green' }).kind).toBe('held');
    expect(publishGateOf({ ...base, exit: 'error', checksVerdict: 'green' }).kind).toBe('held');
    expect(publishGateOf({ ...base, completion: 'partial', checksVerdict: 'green' }).kind).toBe(
      'held',
    );
  });
});

describe('what the card and the digest say about a publish', () => {
  it('names each state', () => {
    expect(publishTextOf({ publish: aPublish() })).toBe(
      'Waiting for you to confirm the force push of harborline/fix-ledger',
    );
    expect(publishTextOf({ publish: aPublish({ state: 'pushed' }) })).toBe(
      'Force pushed harborline/fix-ledger at a1b2c3d, the earlier online version is kept as a backup',
    );
    expect(publishTextOf({ publish: aPublish({ state: 'pushed', backupRef: null }) })).toBe(
      'Force pushed harborline/fix-ledger at a1b2c3d, it was not online before',
    );
    expect(publishTextOf({ publish: aPublish({ state: 'pushed', mode: 'push' }) })).toBe(
      'Pushed harborline/fix-ledger at a1b2c3d',
    );
    expect(publishTextOf({ publish: aPublish({ state: 'pushing', mode: 'push' }) })).toBe(
      'Pushing harborline/fix-ledger at a1b2c3d',
    );
    expect(publishTextOf({ publish: aPublish({ state: 'declined' }) })).toBe(
      'Not pushed: you declined the push of harborline/fix-ledger',
    );
    expect(publishTextOf({ publish: aPublish({ state: 'put_back' }) })).toBe(
      'Put back: harborline/fix-ledger is online as it was when the agent started',
    );
    expect(
      publishTextOf({ publish: aPublish({ state: 'failed', message: 'the checks are red' }) }),
    ).toBe('Not pushed: the checks are red');
  });
});

describe('what a publish offers next', () => {
  it('offers a retry once, only for a failure that can pass', () => {
    const failed = aPublish({ state: 'failed', isRetryable: true, tries: 1 });
    expect(canRetryPublish({ publish: failed })).toBe(true);
    expect(canRetryPublish({ publish: { ...failed, tries: 2 } })).toBe(false);
    expect(canRetryPublish({ publish: { ...failed, isRetryable: false } })).toBe(false);
    expect(canRetryPublish({ publish: aPublish({ state: 'pushed', isRetryable: true }) })).toBe(
      false,
    );
  });

  it('offers put back only after a force push that kept a backup', () => {
    expect(canPutBackPublish({ publish: aPublish({ state: 'pushed' }) })).toBe(true);
    expect(canPutBackPublish({ publish: aPublish({ state: 'pushed', mode: 'push' }) })).toBe(false);
    expect(canPutBackPublish({ publish: aPublish({ state: 'pushed', backupRef: null }) })).toBe(
      false,
    );
    expect(canPutBackPublish({ publish: aPublish({ state: 'put_back' }) })).toBe(false);
  });
});

describe('reading a publish back', () => {
  it('reads the record of a stored result and nothing from a bad one', () => {
    const publish = aPublish({ state: 'failed', message: 'x', tries: 1, isRetryable: true });
    expect(publishOfResult({ result: { verified: { publish } } })).toEqual(publish);
    expect(publishOfResult({ result: { verified: { publish: { state: 'sent' } } } })).toBeNull();
    expect(publishOfResult({ result: { verified: {} } })).toBeNull();
    expect(publishOfResult({ result: null })).toBeNull();
  });

  it('reads the publish a delegation was asked for from its request', () => {
    expect(
      publishOfRequest({
        request: { publish: { mode: 'push', reviewerReportId: 'artifact-report-1' } },
      }),
    ).toEqual({ mode: 'push', reviewerReportId: 'artifact-report-1', isContentChanging: false });
    expect(publishOfRequest({ request: { publish: { mode: 'merge' } } })).toBeNull();
    expect(publishOfRequest({ request: {} })).toBeNull();
  });
});
