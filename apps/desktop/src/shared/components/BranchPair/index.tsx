import { ArrowRight } from 'lucide-react';

type Props = {
  readonly headBranch: string;
  readonly baseBranch: string;
};

export const BranchPair = ({ headBranch, baseBranch }: Props) => {
  if (headBranch === '' || baseBranch === '') {
    return null;
  }

  return (
    <span className="inline-flex min-w-0 items-center gap-1.5 text-2xs text-muted-foreground">
      <span className="truncate font-mono">{headBranch}</span>
      <ArrowRight size={11} aria-hidden className="shrink-0" />
      <span className="truncate font-mono">{baseBranch}</span>
    </span>
  );
};
