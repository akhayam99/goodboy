// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { MountId } from '@goodboy/types';
import { pushFailedError } from './pushFailedError';
import { pushFailureOf } from './pushFailureOf';

const MOUNT_ID: MountId = JSON.parse(JSON.stringify('mount-push'));

describe('pushFailureOf', () => {
  it('returns the failure a push threw with its mount and lease', () => {
    const failure = pushFailedError({
      message: 'hook declined',
      mountId: MOUNT_ID,
      isForce: true,
      confirmedOnlyOnline: null,
      confirmedRemoteSha: 'remote-sha',
    });

    expect(pushFailureOf({ error: failure })).toMatchObject({
      message: 'hook declined',
      mountId: MOUNT_ID,
      isForce: true,
      confirmedRemoteSha: 'remote-sha',
    });
  });

  it('returns null for any other error or value', () => {
    expect(pushFailureOf({ error: new Error('hook declined') })).toBeNull();
    expect(pushFailureOf({ error: 'hook declined' })).toBeNull();
    expect(pushFailureOf({ error: undefined })).toBeNull();
  });
});
