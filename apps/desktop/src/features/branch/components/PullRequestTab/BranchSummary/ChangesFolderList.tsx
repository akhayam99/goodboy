import { SelectableRow } from '@goodboy/ui';
import type { BranchSummary } from './branchSummaryOf';

type Props = {
  readonly summary: BranchSummary;
  readonly onOpenFolder: (folder: string) => void;
};

export const ChangesFolderList = ({ summary, onOpenFolder }: Props) => (
  <ul className="flex min-w-0 flex-col gap-1">
    {summary.shownFolders.map((folder) => (
      <li key={folder.name} className="flex min-w-0">
        <SelectableRow
          selected={false}
          ariaLabel={`Open ${folder.name} in Files`}
          className="min-w-0 items-center gap-2 text-meta"
          onClick={() => onOpenFolder(folder.name)}
        >
          <span className="min-w-0 flex-1 truncate text-foreground">{folder.name}</span>
          <span className="shrink-0 text-faint-foreground">
            {folder.files} {folder.files === 1 ? 'file' : 'files'}
          </span>
        </SelectableRow>
      </li>
    ))}
    {summary.hiddenFolderCount === 0 ? null : (
      <li className="flex min-w-0 items-center gap-2 text-meta">
        <span className="min-w-0 flex-1 truncate text-muted-foreground">
          {summary.hiddenFolderCount} more {summary.hiddenFolderCount === 1 ? 'folder' : 'folders'}
        </span>
        <span className="shrink-0 text-faint-foreground">{summary.hiddenFolderFiles} files</span>
      </li>
    )}
  </ul>
);
