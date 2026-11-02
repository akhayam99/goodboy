import type { BranchCommit, FileDiff } from '@goodboy/types';
import { branchPushFactsOf } from '../../../../../shared/lib/branchPushState';
import { topFolderOf } from '../../../../diff/lib/topFolderOf';

type Params = {
  readonly commits: ReadonlyArray<BranchCommit>;
  readonly notPushed?: number;
  readonly files: ReadonlyArray<Pick<FileDiff, 'path' | 'additions' | 'deletions' | 'binary'>>;
};

type FolderShare = {
  readonly name: string;
  readonly files: number;
};

export type BranchSummary = {
  readonly commitCount: number;
  readonly notPushed: number;
  readonly latestSubjects: ReadonlyArray<string>;
  readonly fileCount: number;
  readonly additions: number;
  readonly deletions: number;
  readonly folders: ReadonlyArray<FolderShare>;
  readonly shownFolders: ReadonlyArray<FolderShare>;
  readonly hiddenFolderCount: number;
  readonly hiddenFolderFiles: number;
};

const SUMMARY_SUBJECTS = 3;
const SUMMARY_FOLDERS = 3;

export const branchSummaryOf = ({ commits, files, notPushed }: Params): BranchSummary => {
  const counts = new Map<string, number>();
  for (const file of files) {
    const folder = topFolderOf({ path: file.path });
    counts.set(folder, (counts.get(folder) ?? 0) + 1);
  }
  const folders = [...counts.entries()]
    .map(([name, count]) => ({ name, files: count }))
    .sort((a, b) => (b.files === a.files ? a.name.localeCompare(b.name) : b.files - a.files));
  const hidden = folders.slice(SUMMARY_FOLDERS);
  return {
    commitCount: commits.length,
    notPushed:
      notPushed ?? branchPushFactsOf({ status: null, commits, hasRemoteHead: true }).toPush,
    latestSubjects: commits.slice(0, SUMMARY_SUBJECTS).map((commit) => commit.subject),
    fileCount: files.length,
    additions: files.reduce((sum, file) => sum + (file.binary ? 0 : file.additions), 0),
    deletions: files.reduce((sum, file) => sum + (file.binary ? 0 : file.deletions), 0),
    folders,
    shownFolders: folders.slice(0, SUMMARY_FOLDERS),
    hiddenFolderCount: hidden.length,
    hiddenFolderFiles: hidden.reduce((sum, folder) => sum + folder.files, 0),
  };
};
