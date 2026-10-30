import type { BranchEntry } from '../branches/branchStoryOf';
import type { DoneDay } from '../done/doneTypes';

export type DoneSummary = Readonly<{
  count: number;
  line: string;
}>;

type Params = {
  readonly finished: ReadonlyArray<BranchEntry>;
  readonly days: ReadonlyArray<DoneDay>;
  readonly listedCount: number;
};

type ListParams = {
  readonly entries: ReadonlyArray<BranchEntry>;
  readonly word: string;
};

const branchSentenceOf = ({ entries, word }: ListParams): string | null => {
  if (entries.length === 0) {
    return null;
  }
  const noun = entries.length === 1 ? 'branch' : 'branches';
  const names = entries.map((entry) => entry.fact.branch).join(', ');
  return `${entries.length} ${noun} ${word}: ${names}.`;
};

type WorkParams = {
  readonly count: number;
};

const workSentenceOf = ({ count }: WorkParams): string | null => {
  if (count === 0) {
    return null;
  }
  return count === 1
    ? '1 finished run or agent is in the full log.'
    : `${count} finished runs and agents are in the full log.`;
};

export const doneSummaryOf = ({ finished, days, listedCount }: Params): DoneSummary => {
  const merged = finished.filter((entry) => entry.story.state === 'merged');
  const closed = finished.filter((entry) => entry.story.state === 'closed');
  const workCount = days.reduce((total, day) => total + day.rows.length, 0);
  const line = [
    branchSentenceOf({ entries: merged, word: 'merged' }),
    branchSentenceOf({ entries: closed, word: 'closed' }),
    listedCount > 0 ? null : workSentenceOf({ count: workCount }),
  ]
    .filter((part) => part !== null)
    .join(' ');
  return { count: finished.length + workCount, line };
};
