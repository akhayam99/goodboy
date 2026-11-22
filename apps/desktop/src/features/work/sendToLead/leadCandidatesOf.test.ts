import { describe, expect, it } from 'vitest';
import type { LeadStop } from '@goodboy/core/auto';
import { brandId, type AgentId, type AutoTreeId, type SessionId } from '@goodboy/types';
import type { WorkRow } from '../workRowsOf';
import { leadCandidatesOf, type LeadItem } from './leadCandidatesOf';

const HBL = brandId<SessionId>({ value: 'session-hbl-417' });
const OTHER_SESSION = brandId<SessionId>({ value: 'session-hbl-412' });
const LEDGER = 'project-ledger-core';
const NOTIFY = 'project-notify-relay';

type RowParams = {
  readonly id: string;
  readonly sessionId?: SessionId;
  readonly projectId?: string | null;
  readonly projectIds?: ReadonlyArray<string>;
  readonly branches?: ReadonlyArray<string>;
  readonly stop?: LeadStop;
  readonly updatedAt?: number;
};

const rowOf = ({
  id,
  sessionId = HBL,
  projectId = LEDGER,
  projectIds = [LEDGER],
  branches = [],
  stop = 'working',
  updatedAt = 1,
}: RowParams): WorkRow => ({
  treeId: brandId<AutoTreeId>({ value: `tree-${id}` }),
  rootAgentId: brandId<AgentId>({ value: `lead-${id}` }),
  sessionId,
  sessionGoal: `Goal ${id}`,
  projectId,
  title: `Goal ${id}`,
  branches,
  projectIds,
  lead: { stop, reason: null },
  askCount: 0,
  agentsRunning: 0,
  spentUsd: 0,
  updatedAt,
});

const item = (overrides: Partial<LeadItem> = {}): LeadItem => ({
  sessionId: HBL,
  projectId: LEDGER,
  branch: 'hl/ledger-batch',
  holderAgentId: null,
  holdReason: 'Holds #79',
  ...overrides,
});

describe('leadCandidatesOf', () => {
  it('offers no Lead and no choice when none is open in the project', () => {
    expect(leadCandidatesOf({ rows: [], item: item() })).toEqual({ kind: 'none' });
  });

  it('sends in one click to the Lead that holds the item, whatever else is open', () => {
    const holder = rowOf({ id: 'holder', updatedAt: 1 });
    const recent = rowOf({ id: 'recent', branches: ['hl/ledger-batch'], updatedAt: 9 });

    const choice = leadCandidatesOf({
      rows: [recent, holder],
      item: item({ holderAgentId: holder.rootAgentId }),
    });

    expect(choice).toMatchObject({
      kind: 'one',
      candidate: { rootAgentId: holder.rootAgentId, reason: 'Holds #79', rule: 'holds' },
    });
  });

  it('sends in one click to the only open Lead', () => {
    const only = rowOf({ id: 'only', sessionId: OTHER_SESSION });

    expect(leadCandidatesOf({ rows: [only], item: item() })).toMatchObject({
      kind: 'one',
      candidate: { rule: 'project', reason: 'In this project' },
    });
  });

  it('ranks branch, then session, then project, then the most recent, and asks', () => {
    const project = rowOf({ id: 'project', sessionId: OTHER_SESSION, updatedAt: 9 });
    const sessionOld = rowOf({ id: 'session-old', updatedAt: 1 });
    const sessionNew = rowOf({ id: 'session-new', updatedAt: 5 });
    const branch = rowOf({
      id: 'branch',
      sessionId: OTHER_SESSION,
      branches: ['hl/ledger-batch'],
      updatedAt: 0,
    });

    const choice = leadCandidatesOf({
      rows: [project, sessionOld, sessionNew, branch],
      item: item(),
    });

    expect(choice.kind).toBe('pick');
    if (choice.kind !== 'pick') {
      return;
    }
    expect(choice.candidates.map((candidate) => [candidate.rootAgentId, candidate.rule])).toEqual([
      [branch.rootAgentId, 'branch'],
      [sessionNew.rootAgentId, 'session'],
      [sessionOld.rootAgentId, 'session'],
    ]);
    expect(choice.candidates[0]?.reason).toBe('Works on hl/ledger-batch');
  });

  it('never offers more than three Leads', () => {
    const rows = ['a', 'b', 'c', 'd', 'e'].map((id) => rowOf({ id }));

    const choice = leadCandidatesOf({ rows, item: item() });

    expect(choice.kind === 'pick' ? choice.candidates : []).toHaveLength(3);
  });

  it('never offers a finished or a stopped Lead, even the one that holds the item', () => {
    const finished = rowOf({ id: 'finished', stop: 'finished' });
    const stopped = rowOf({ id: 'stopped', stop: 'stopped' });

    const choice = leadCandidatesOf({
      rows: [finished, stopped],
      item: item({ holderAgentId: finished.rootAgentId }),
    });

    expect(choice).toEqual({ kind: 'none' });
  });

  it('offers a Lead waiting for you or resting with its state word', () => {
    const waiting = rowOf({ id: 'waiting', stop: 'waitsForYou', updatedAt: 2 });
    const resting = rowOf({ id: 'resting', stop: 'resting', updatedAt: 1 });

    const choice = leadCandidatesOf({ rows: [waiting, resting], item: item() });

    expect(choice.kind === 'pick' ? choice.candidates.map((c) => c.stateWord) : []).toHaveLength(2);
  });

  it('offers only Leads with a branch in the item project, a delegation counting too', () => {
    const elsewhere = rowOf({ id: 'elsewhere', projectId: NOTIFY, projectIds: [NOTIFY] });
    const delegated = rowOf({
      id: 'delegated',
      sessionId: OTHER_SESSION,
      projectId: NOTIFY,
      projectIds: [NOTIFY, LEDGER],
    });

    expect(leadCandidatesOf({ rows: [elsewhere, delegated], item: item() })).toMatchObject({
      kind: 'one',
      candidate: { rootAgentId: delegated.rootAgentId },
    });
  });
});
