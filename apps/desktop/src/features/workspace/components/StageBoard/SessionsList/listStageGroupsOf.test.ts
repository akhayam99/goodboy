import { describe, expect, it } from 'vitest';
import type { Session } from '@goodboy/types';
import { aSession } from '@goodboy/types/testing';
import { listStageGroupsOf } from './listStageGroupsOf';

type SessionParams = {
  readonly goal: string;
};

const sessionOf = ({ goal }: SessionParams): Session => aSession({ goal });

const ledger = sessionOf({ goal: 'Reconcile the ledger export' });
const payments = sessionOf({ goal: 'Paginate the payments list' });
const relay = sessionOf({ goal: 'Retry notify-relay deliveries' });
const cascadia = sessionOf({ goal: 'Cascadia onboarding copy' });

const byStage = new Map([
  ['done', [cascadia]],
  ['attention', [relay]],
  ['building', [ledger, payments]],
]);

describe('listStageGroupsOf', () => {
  it('orders groups like the board lanes, drops empty stages and ends with Archived', () => {
    const groups = listStageGroupsOf({ byStage, statusFilter: [], archived: [payments] });
    expect(groups.map((group) => [group.label, group.sessions.length])).toEqual([
      ['Building', 2],
      ['Needs you', 1],
      ['Done', 1],
      ['Archived', 1],
    ]);
  });

  it('keeps only the stages the status filter picks', () => {
    const groups = listStageGroupsOf({
      byStage,
      statusFilter: ['done', 'attention'],
      archived: [],
    });
    expect(groups.map((group) => group.key)).toEqual(['attention', 'done']);
  });

  it('draws nothing when no stage holds a session and nothing is archived', () => {
    expect(listStageGroupsOf({ byStage: new Map(), statusFilter: [], archived: [] })).toEqual([]);
  });
});
