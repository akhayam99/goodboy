import { describe, expect, it } from 'vitest';
import { brandId, type MountId } from '@goodboy/types';
import type { BranchEntry } from '../branches/branchStoryOf';
import type { DoneDay, DoneRowModel } from '../done/doneTypes';
import { doneSummaryOf } from './doneSummaryOf';

type EntryParams = {
  readonly branch: string;
  readonly state: 'merged' | 'closed';
};

const entryOf = ({ branch, state }: EntryParams): BranchEntry => ({
  fact: {
    mountId: brandId<MountId>({ value: `mount-${branch}` }),
    mountPath: null,
    projectName: 'harbor-portal',
    branch,
    baseBranch: 'main',
    request: null,
    behind: null,
    isStale: false,
    checkedAgo: null,
    liveCount: 0,
    liveTitle: null,
    isFinished: true,
    status: null,
    series: null,
  },
  story: { steps: [], state, word: state, tone: 'merged', blocker: '', rank: 5 },
});

type RowParams = {
  readonly id: string;
};

const rowOf = ({ id }: RowParams): DoneRowModel => ({
  id,
  entryId: id,
  title: 'Centered the profile page',
  by: 'Implementer',
  kind: 'implementer',
  leadAgentId: null,
  at: '09:00',
  mountId: null,
  retryAgentId: null,
  agentIds: [],
  detail: {
    model: null,
    effort: null,
    duration: null,
    costUsd: null,
    fullText: null,
    steps: [],
    auto: null,
    branches: [],
    files: null,
  },
});

const DAY: DoneDay = { key: 'today', label: null, rows: [rowOf({ id: 'a' }), rowOf({ id: 'b' })] };

describe('doneSummaryOf', () => {
  it('names the merged and closed branches, then counts the finished work', () => {
    const summary = doneSummaryOf({
      finished: [
        entryOf({ branch: 'hl/feat-center-about-page', state: 'merged' }),
        entryOf({ branch: 'hl/feat-center-faq-page', state: 'merged' }),
        entryOf({ branch: 'hl/feat-center-careers-page', state: 'closed' }),
      ],
      days: [DAY],
    });

    expect(summary.count).toBe(5);
    expect(summary.line).toBe(
      '2 branches merged: hl/feat-center-about-page, hl/feat-center-faq-page. 1 branch closed: hl/feat-center-careers-page. 2 finished runs and agents are in the full log.',
    );
  });

  it('says one finished item in the singular and leaves out an empty part', () => {
    const summary = doneSummaryOf({
      finished: [],
      days: [{ ...DAY, rows: [rowOf({ id: 'a' })] }],
    });

    expect(summary).toEqual({ count: 1, line: '1 finished run or agent is in the full log.' });
    expect(doneSummaryOf({ finished: [], days: [] })).toEqual({ count: 0, line: '' });
  });
});
