import type { EntryDiffStat } from '../worktreeEntryFacts';

type Props = {
  readonly diff: EntryDiffStat;
};

export const DiffStatText = ({ diff }: Props) => (
  <span data-diff-stat="">{`+${diff.additions} -${diff.deletions}`}</span>
);
