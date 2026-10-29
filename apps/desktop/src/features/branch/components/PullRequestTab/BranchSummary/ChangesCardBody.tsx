import type { BranchSummary } from './branchSummaryOf';

type Props = {
  readonly summary: BranchSummary;
};

export const ChangesCardBody = ({ summary }: Props) => (
  <>
    <span className="flex items-baseline gap-2 text-foreground">
      <span className="text-title">{summary.fileCount}</span>
      <span className="text-meta text-muted-foreground">
        {summary.fileCount === 1 ? 'file' : 'files'}
      </span>
      <span className="text-meta text-success">+{summary.additions}</span>
      <span className="text-meta text-danger">-{summary.deletions}</span>
    </span>
    <div aria-hidden className="flex h-1.5 min-w-0 gap-px overflow-hidden rounded-full">
      {summary.folders.map((folder, index) => (
        <i
          key={folder.name}
          style={{ width: `${(folder.files / summary.fileCount) * 100}%` }}
          className={index % 2 === 0 ? 'bg-muted-foreground' : 'bg-faint-foreground'}
        />
      ))}
    </div>
    <ul className="flex min-w-0 flex-col gap-1">
      {summary.shownFolders.map((folder) => (
        <li key={folder.name} className="flex min-w-0 items-center gap-2 text-meta">
          <span className="min-w-0 flex-1 truncate text-foreground">{folder.name}</span>
          <span className="shrink-0 text-faint-foreground">
            {folder.files} {folder.files === 1 ? 'file' : 'files'}
          </span>
        </li>
      ))}
      {summary.hiddenFolderCount === 0 ? null : (
        <li className="flex min-w-0 items-center gap-2 text-meta">
          <span className="min-w-0 flex-1 truncate text-muted-foreground">
            {summary.hiddenFolderCount} more{' '}
            {summary.hiddenFolderCount === 1 ? 'folder' : 'folders'}
          </span>
          <span className="shrink-0 text-faint-foreground">{summary.hiddenFolderFiles} files</span>
        </li>
      )}
    </ul>
  </>
);
