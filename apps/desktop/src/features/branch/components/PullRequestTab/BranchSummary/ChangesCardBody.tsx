import type { BranchSummary } from './branchSummaryOf';

type Props = {
  readonly summary: BranchSummary;
};

export const ChangesCardBody = ({ summary }: Props) => (
  <div aria-hidden className="flex h-1.5 min-w-0 gap-px overflow-hidden rounded-full">
    {summary.folders.map((folder, index) => (
      <i
        key={folder.name}
        style={{ width: `${(folder.files / summary.fileCount) * 100}%` }}
        className={index % 2 === 0 ? 'bg-muted-foreground' : 'bg-faint-foreground'}
      />
    ))}
  </div>
);
