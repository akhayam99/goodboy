import { ArrowRight } from 'lucide-react';
import { ICON_SIZE } from '../iconSize';

type Props = {
  readonly headBranch: string;
  readonly baseBranch: string;
};

export const BranchPair = ({ headBranch, baseBranch }: Props) => {
  if (headBranch === '' || baseBranch === '') {
    return null;
  }

  return (
    <span className="inline-flex min-w-0 items-center gap-1 text-meta text-muted-foreground">
      <span className="truncate font-mono">{headBranch}</span>
      <ArrowRight size={ICON_SIZE.row} aria-hidden className="shrink-0" />
      <span className="truncate font-mono">{baseBranch}</span>
    </span>
  );
};
