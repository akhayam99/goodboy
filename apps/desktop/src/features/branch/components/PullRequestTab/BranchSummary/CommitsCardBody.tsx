import type { BranchSummary } from './branchSummaryOf';

type Props = {
  readonly summary: BranchSummary;
};

export const CommitsCardBody = ({ summary }: Props) => (
  <ul className="flex min-w-0 flex-col gap-1">
    {summary.latestSubjects.map((subject, index) => (
      <li key={`${index}-${subject}`} className="min-w-0 truncate text-meta text-foreground">
        {subject}
      </li>
    ))}
  </ul>
);
