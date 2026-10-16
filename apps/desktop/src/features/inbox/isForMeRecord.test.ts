// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { SessionId } from '@goodboy/types';
import { nextSessionId } from '@goodboy/types/testing';
import type { InboxRecord } from './types';
import { isAssignedRecord, isForMeRecord } from './isForMeRecord';

const sentry = (sessionId: SessionId | null): InboxRecord => ({
  key: 'sentry:error:1',
  provider: 'sentry',
  kind: 'error',
  identifier: 'PAYMENTS-API-7K1',
  title: 'TypeError in ledger export',
  state: 'alert',
  stateLabel: 'Unresolved',
  updatedAt: '2026-10-01T10:00:00Z',
  url: '',
  context: '',
  payload: {
    provider: 'sentry',
    kind: 'error',
    issue: {
      id: '1',
      shortId: 'PAYMENTS-API-7K1',
      title: 'TypeError in ledger export',
      culprit: null,
      level: null,
      status: 'unresolved',
      count: null,
      userCount: null,
      firstSeen: null,
      lastSeen: null,
      permalink: null,
      metadata: null,
    },
    sessionId,
  },
});

const linear: InboxRecord = {
  key: 'linear:issue:1',
  provider: 'linear',
  kind: 'issue',
  identifier: 'HBL-412',
  title: 'Ledger export times out over 10k rows',
  state: 'active',
  stateLabel: 'In progress',
  updatedAt: '2026-10-01T10:00:00Z',
  url: '',
  context: '',
  payload: {
    provider: 'linear',
    kind: 'issue',
    issue: {
      id: '1',
      identifier: 'HBL-412',
      title: 'Ledger export times out over 10k rows',
      description: null,
      url: '',
      state: { name: 'In progress', type: 'started' },
      team: { key: 'HBL' },
      assignee: { name: 'Mara Lindqvist' },
      updatedAt: '',
    },
    sessionId: null,
  },
};

const unassignedLinear: InboxRecord =
  linear.payload.provider === 'linear'
    ? {
        ...linear,
        payload: { ...linear.payload, issue: { ...linear.payload.issue, assignee: null } },
      }
    : linear;

describe('isForMeRecord', () => {
  it('counts an assigned tracker issue as mine', () => {
    expect(isAssignedRecord({ record: linear })).toBe(true);
    expect(isForMeRecord({ record: linear, isStarred: false })).toBe(true);
  });

  it('leaves an unassigned tracker issue out of For me', () => {
    expect(isAssignedRecord({ record: unassignedLinear })).toBe(false);
    expect(isForMeRecord({ record: unassignedLinear, isStarred: false })).toBe(false);
  });

  it('leaves an error nobody linked or starred out of For me', () => {
    expect(isAssignedRecord({ record: sentry(null) })).toBe(false);
    expect(isForMeRecord({ record: sentry(null), isStarred: false })).toBe(false);
  });

  it('takes a starred or session linked error into For me', () => {
    expect(isForMeRecord({ record: sentry(null), isStarred: true })).toBe(true);
    expect(isForMeRecord({ record: sentry(nextSessionId()), isStarred: false })).toBe(true);
  });
});
