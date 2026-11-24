import { describe, expect, it } from 'vitest';
import { brandId, type MountId, type ProjectId, type SessionId } from '@goodboy/types';
import { overlapGroupOf } from './overlapGroupOf';
import { overlapWordsOf } from './overlapWordsOf';
import type { LiveMount } from './readLiveMounts';

const LEDGER = brandId<ProjectId>({ value: 'project-ledger' });

type MountParams = {
  readonly mountId: string;
  readonly sessionId: string;
  readonly branch: string;
  readonly paths: ReadonlyArray<string>;
  readonly createdAt: number;
};

const mount = ({ mountId, sessionId, branch, paths, createdAt }: MountParams): LiveMount => ({
  mountId: brandId<MountId>({ value: mountId }),
  sessionId: brandId<SessionId>({ value: sessionId }),
  projectId: LEDGER,
  branch,
  createdAt,
  port: null,
  hasFixedPort: false,
  paths,
});

const totals = mount({
  mountId: 'totals',
  sessionId: 's-398',
  branch: 'ak/fix-ledger-totals',
  paths: ['src/ledger/totals.ts', 'src/ledger/round.ts'],
  createdAt: 3,
});
const relay = mount({
  mountId: 'relay',
  sessionId: 's-412',
  branch: 'ak/notify-relay-retry',
  paths: ['src/ledger/totals.ts', 'src/ledger/round.ts', 'src/relay/send.ts', 'src/relay/a.ts'],
  createdAt: 1,
});
const payments = mount({
  mountId: 'payments',
  sessionId: 's-420',
  branch: 'ak/payments-api-refunds',
  paths: [
    'src/ledger/round.ts',
    'src/payments/refund.ts',
    'src/payments/a.ts',
    'src/payments/b.ts',
    'src/payments/c.ts',
    'src/payments/d.ts',
  ],
  createdAt: 2,
});

const LABELS = new Map([
  [brandId<SessionId>({ value: 's-398' }), 'Fix the Harborline ledger totals'],
  [brandId<SessionId>({ value: 's-412' }), 'Retry the notify-relay sends'],
  [brandId<SessionId>({ value: 's-420' }), 'Refund Northwind payments'],
]);

type GroupParams = {
  readonly mounts: ReadonlyArray<LiveMount>;
  readonly mountId: string;
};

const groupOf = ({ mounts, mountId }: GroupParams) => {
  const group = overlapGroupOf({ mounts, mountId });
  if (group === null) {
    throw new Error('expected an overlap');
  }
  return group;
};

describe('overlapGroupOf', () => {
  it('orders every branch once, fewest files first, and says why', () => {
    const group = groupOf({ mounts: [payments, relay, totals], mountId: 'relay' });

    expect(group.steps.map((step) => [step.mount.mountId, step.reason, step.isOwn])).toEqual([
      ['totals', 'fewest-files', false],
      ['relay', 'fewer-files', true],
      ['payments', 'most-files', false],
    ]);
    expect(new Set(group.steps.map((step) => step.mount.mountId)).size).toBe(3);
  });

  it('lists each shared file once, in the order of this branch', () => {
    const group = groupOf({ mounts: [payments, relay, totals], mountId: 'relay' });

    expect(group.sharedPaths).toEqual(['src/ledger/totals.ts', 'src/ledger/round.ts']);
    expect(group.steps.map((step) => step.sharedPaths)).toEqual([
      ['src/ledger/totals.ts', 'src/ledger/round.ts'],
      ['src/ledger/totals.ts', 'src/ledger/round.ts'],
      ['src/ledger/round.ts'],
    ]);
  });

  it('breaks a tie of files with the branch that started earlier', () => {
    const later = { ...totals, createdAt: 9 };
    const earlier = {
      ...relay,
      paths: ['src/ledger/totals.ts', 'src/ledger/round.ts'],
      createdAt: 4,
    };

    const group = groupOf({ mounts: [later, earlier], mountId: 'totals' });

    expect(group.steps.map((step) => [step.mount.mountId, step.reason])).toEqual([
      ['relay', 'started-earlier'],
      ['totals', 'started-later'],
    ]);
  });

  it('is null when no other branch shares a file', () => {
    const apart = { ...payments, paths: ['src/payments/refund.ts'] };

    expect(overlapGroupOf({ mounts: [totals, apart], mountId: 'totals' })).toBeNull();
  });
});

describe('overlapWordsOf', () => {
  it('says the point once, with the count of branches and of shared files', () => {
    const group = groupOf({ mounts: [payments, relay, totals], mountId: 'relay' });

    expect(overlapWordsOf({ group, sessionLabels: LABELS })).toEqual({
      chip: 'Overlaps Fix the Harborline ledger totals +1',
      title: '3 branches change the same files',
      lead: 'Merge them in this order to avoid conflicts.',
      shared: '2 shared files',
      reasons: ['fewest files', 'fewer files', 'most files'],
    });
  });

  it('names the branch when both mounts belong to one session', () => {
    const sibling = { ...payments, sessionId: totals.sessionId };
    const group = groupOf({ mounts: [totals, sibling], mountId: 'payments' });

    expect(overlapWordsOf({ group, sessionLabels: LABELS }).chip).toBe(
      'Overlaps ak/fix-ledger-totals',
    );
  });
});
