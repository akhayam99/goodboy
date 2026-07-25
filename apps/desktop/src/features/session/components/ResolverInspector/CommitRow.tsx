import { GitCommit } from 'lucide-react';
import type { BranchCommit } from '@goodboy/types';

type Props = {
  readonly commit: BranchCommit;
};

export const CommitRow = ({ commit }: Props) => (
  <li className="flex min-w-0 items-baseline gap-2">
    <GitCommit size={11} aria-hidden className="shrink-0 text-muted-foreground/60" />
    <span className="shrink-0 font-mono text-2xs tabular-nums text-muted-foreground/80">
      {commit.shortSha}
    </span>
    <span className="truncate text-2xs text-foreground/80" title={commit.subject}>
      {commit.subject}
    </span>
  </li>
);
