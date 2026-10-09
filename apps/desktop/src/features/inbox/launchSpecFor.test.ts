// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { SessionId } from '@goodboy/types';
import {
  INBOX_RECORD_FIXTURES as RECORDS,
  LINKED_SESSION,
} from '../../__tests__/helpers/inboxRecordFixtures';
import { launchSpecFor } from './launchSpecFor';

describe('launchSpecFor', () => {
  it('gives every tool a primary: launch, or open the linked session', () => {
    const specs = RECORDS.map((record) => [record.key, launchSpecFor({ record })] as const);

    expect(specs.length).toBe(9);
    for (const [key, spec] of specs) {
      expect(spec, key).not.toBeNull();
      expect(spec?.externalTask.identifier, key).not.toBe('');
    }
  });

  it('has no launch target for a Bitbucket pull request without its repository', () => {
    const bitbucket = RECORDS.find((record) => record.provider === 'bitbucket');
    if (bitbucket?.payload.provider !== 'bitbucket') {
      throw new Error('missing bitbucket fixture');
    }

    expect(
      launchSpecFor({ record: { ...bitbucket, payload: { ...bitbucket.payload, repo: null } } }),
    ).toBeNull();
  });

  it('picks up a GitHub pull request as a task and reopens its linked session', () => {
    const github = RECORDS.find((record) => record.key === 'github:pr:12');
    if (github == null) {
      throw new Error('missing github pr fixture');
    }

    const spec = launchSpecFor({ record: github });

    expect(spec?.linkedSessionId).toBe(LINKED_SESSION);
    expect(spec?.briefSource).toBeNull();
    expect(spec?.externalTask).toEqual({
      provider: 'github',
      externalId: '12',
      identifier: '#12',
      url: 'https://github.com/harborline/ledger-core/pull/12',
      title: 'Retry ledger sync',
    });
    expect(spec?.goalSeed).toContain('GitHub pull request #12: Retry ledger sync');
    expect(spec?.goalSeed).toContain('Retries the sync on timeout.');
  });

  it('opens the session a GitHub pull request was linked to from the inbox', () => {
    const github = RECORDS.find((record) => record.key === 'github:pr:12');
    if (github?.payload.provider !== 'github' || github.payload.kind !== 'pr') {
      throw new Error('missing github pr fixture');
    }
    const linked = 'session-linked' as SessionId;

    const spec = launchSpecFor({
      record: {
        ...github,
        linkedSessionId: linked,
        payload: { ...github.payload, sessionId: null },
      },
    });

    expect(spec?.linkedSessionId).toBe(linked);
  });
});
