import type { BranchSummary } from './branchSummaryOf';

type Props = {
  readonly summary: BranchSummary;
};

export const CommitsCardBody = ({ summary }: Props) => (
  <>
    <span className="flex items-baseline gap-2 text-foreground">
      <span className="text-title">{summary.commitCount}</span>
      <span className="text-meta text-muted-foreground">
        {summary.commitCount === 1 ? 'commit' : 'commits'}
        {summary.notPushed > 0 ? `, ${summary.notPushed} not pushed` : ''}
      </span>
    </span>
    <ul className="flex min-w-0 flex-col gap-1">
      {summary.latestSubjects.map((subject, index) => (
        <li key={`${index}-${subject}`} className="min-w-0 truncate text-meta text-foreground">
          {subject}
        </li>
      ))}
    </ul>
  </>
);
