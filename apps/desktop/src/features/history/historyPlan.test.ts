import { describe, expect, it } from 'vitest';
import type { BranchCommit, HistoryStep } from '@goodboy/types';
import {
  editPhrase,
  foldInto,
  initialPlanItems,
  isContiguous,
  moveStep,
  planSummary,
  rewordStep,
  setVerb,
  squashSteps,
  summaryLine,
} from './historyPlan';

const commit = (sha: string): BranchCommit => ({
  sha,
  shortSha: sha.slice(0, 7),
  subject: `subject ${sha}`,
  author: 'You',
  timestamp: 0,
  pushed: false,
  parentSha: null,
});

const newestFirst = [commit('ccc3333'), commit('bbb2222'), commit('aaa1111')];
const base = initialPlanItems({ commits: newestFirst });
const original = base.map((step) => step.sha);

describe('history plan', () => {
  it('replays the branch oldest first, every commit picked', () => {
    expect(base).toEqual([
      { sha: 'aaa1111', verb: 'pick' },
      { sha: 'bbb2222', verb: 'pick' },
      { sha: 'ccc3333', verb: 'pick' },
    ]);
    expect(summaryLine({ summary: planSummary({ items: base, original }) })).toBe('No changes yet');
  });

  it('rewords, drops and folds into a commit you pick', () => {
    const reworded = rewordStep({ items: base, sha: 'aaa1111', message: ' Guard postings ' });
    const dropped = setVerb({ items: reworded, sha: 'bbb2222', verb: 'drop' });
    const folded = foldInto({ items: dropped, sha: 'ccc3333', target: 'aaa1111' });

    expect(folded).toEqual<ReadonlyArray<HistoryStep>>([
      { sha: 'aaa1111', verb: 'reword', message: 'Guard postings' },
      { sha: 'bbb2222', verb: 'drop' },
      { sha: 'ccc3333', verb: 'fixup', target: 'aaa1111' },
    ]);
    expect(summaryLine({ summary: planSummary({ items: folded, original }) })).toBe(
      '1 reword · 1 folded · 1 dropped',
    );
  });

  it('squashes only neighbouring commits and keeps the message on the newest', () => {
    expect(isContiguous({ items: base, shas: ['aaa1111', 'ccc3333'] })).toBe(false);
    expect(squashSteps({ items: base, shas: ['aaa1111', 'ccc3333'], message: 'x' })).toBe(base);

    expect(squashSteps({ items: base, shas: ['bbb2222', 'aaa1111'], message: 'Both' })).toEqual([
      { sha: 'aaa1111', verb: 'pick' },
      { sha: 'bbb2222', verb: 'squash', message: 'Both' },
      { sha: 'ccc3333', verb: 'pick' },
    ]);
  });

  it('moves a commit and names the move that could break', () => {
    const moved = moveStep({ items: base, sha: 'aaa1111', direction: 'newer' });

    expect(moved.items.map((step) => step.sha)).toEqual(['bbb2222', 'aaa1111', 'ccc3333']);
    expect(moved.other).toBe('bbb2222');
    expect(planSummary({ items: moved.items, original }).moved).toBe(2);
    expect(editPhrase({ edit: { kind: 'move', sha: 'aaa1111', other: 'bbb2222' } })).toBe(
      'Moving aaa1111 above bbb2222',
    );
    expect(moveStep({ items: base, sha: 'ccc3333', direction: 'newer' }).other).toBeNull();
  });
});
