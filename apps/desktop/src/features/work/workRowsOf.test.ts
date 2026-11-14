// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { brandId, type AgentId, type AutoTreeId, type SessionId } from '@goodboy/types';
import type { AutoPhase } from '@goodboy/db';
import type { WorkLead } from '../../store/slices/work/state';
import { aView } from '../auto/testing/autoViewFixtures';
import { workRowsOf } from './workRowsOf';

type LeadParams = {
  readonly key: string;
  readonly phase: AutoPhase;
  readonly branches?: ReadonlyArray<string>;
  readonly updatedAt?: number;
  readonly spentUsd?: number;
};

const leadOf = ({
  key,
  phase,
  branches = ['main'],
  updatedAt = 1,
  spentUsd = 0,
}: LeadParams): WorkLead => {
  const base = aView({ phase, spentUsd });
  const treeId = brandId<AutoTreeId>({ value: `tree-${key}` });
  return {
    treeId,
    sessionId: brandId<SessionId>({ value: `session-${key}` }),
    sessionGoal: `goal ${key}`,
    projectId: null,
    branches,
    view: {
      ...base,
      tree: {
        ...base.tree,
        id: treeId,
        rootAgentId: brandId<AgentId>({ value: `agent-${key}` }),
        updatedAt,
      },
    },
  };
};

const LEADS = [
  leadOf({
    key: 'a',
    phase: 'deciding',
    updatedAt: 3,
    branches: ['hl/one', 'hl/two'],
    spentUsd: 1.5,
  }),
  leadOf({ key: 'b', phase: 'answering', updatedAt: 2 }),
  leadOf({ key: 'c', phase: 'blocked', updatedAt: 4 }),
  leadOf({ key: 'd', phase: 'finished', updatedAt: 1 }),
  leadOf({ key: 'e', phase: 'stopped', updatedAt: 0 }),
];

const read = (filter: 'open' | 'needsYou' | 'working' | 'finished') =>
  workRowsOf({ leads: LEADS, rootTurns: {}, filter, isWork: true });

describe('workRowsOf', () => {
  it('shows one row for a Lead on two branches and keeps both branches on it', () => {
    const row = read('open').rows.find((candidate) => candidate.treeId === 'tree-a');

    expect(row?.branches).toEqual(['hl/one', 'hl/two']);
    expect(read('open').rows.filter((candidate) => candidate.treeId === 'tree-a')).toHaveLength(1);
  });

  it('counts by filter and each count equals the rows of that filter', () => {
    expect(read('open').counts).toEqual({ open: 3, needsYou: 1, working: 1, finished: 1 });
    for (const filter of ['open', 'needsYou', 'working', 'finished'] as const) {
      const { rows, counts } = read(filter);
      expect(rows).toHaveLength(counts[filter]);
    }
  });

  it('leaves a stopped Lead out of every filter and orders rows newest first', () => {
    const open = read('open').rows;

    expect(open.map((row) => row.treeId)).toEqual(['tree-c', 'tree-a', 'tree-b']);
    expect(read('finished').rows.map((row) => row.treeId)).toEqual(['tree-d']);
  });

  it('reads the state word of each Lead from the one owner', () => {
    const words = Object.fromEntries(read('open').rows.map((row) => [row.treeId, row.lead.word]));

    expect(words).toEqual({
      'tree-a': 'Working',
      'tree-b': 'Resting',
      'tree-c': 'Waits for you',
    });
  });

  it('carries the spend of the Lead and a title that falls back to the session goal', () => {
    const row = read('working').rows[0];

    expect(row?.spentUsd).toBe(1.5);
    expect(row?.title).toBe('goal a');
  });
});
