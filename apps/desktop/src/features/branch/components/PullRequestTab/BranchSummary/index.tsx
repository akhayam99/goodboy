import { useMemo } from 'react';
import type { BranchCommit, FileDiff } from '@goodboy/types';
import type { BranchTab } from '../../../../../store/slices/navigation/types';
import { branchSummaryOf } from './branchSummaryOf';
import { ChangesCardBody } from './ChangesCardBody';
import { ChangesFolderList } from './ChangesFolderList';
import { CommitsCardBody } from './CommitsCardBody';
import { SummaryCard, type SummaryCardState } from './SummaryCard';

type Props = {
  readonly commits: ReadonlyArray<BranchCommit>;
  readonly notPushed?: number;
  readonly files: ReadonlyArray<FileDiff>;
  readonly isLoading: boolean;
  readonly error: string | null;
  readonly onRetry: () => void;
  readonly onOpen: (tab: BranchTab) => void;
  readonly onOpenFolder: (folder: string) => void;
};

export const BranchSummary = ({
  commits,
  notPushed,
  files,
  isLoading,
  error,
  onRetry,
  onOpen,
  onOpenFolder,
}: Props) => {
  const summary = useMemo(
    () => branchSummaryOf({ commits, files, notPushed }),
    [commits, files, notPushed],
  );
  const state: SummaryCardState = error !== null ? 'error' : isLoading ? 'loading' : 'ready';
  if (state === 'ready' && summary.commitCount === 0 && summary.fileCount === 0) {
    return null;
  }
  return (
    <section aria-label="Summary" className="grid min-w-0 grid-cols-1 gap-3 @[640px]:grid-cols-2">
      <SummaryCard label="Commits" state={state} onOpen={() => onOpen('commits')} onRetry={onRetry}>
        <CommitsCardBody summary={summary} />
      </SummaryCard>
      <SummaryCard
        label="Changes"
        state={state}
        footer={<ChangesFolderList summary={summary} onOpenFolder={onOpenFolder} />}
        onOpen={() => onOpen('files')}
        onRetry={onRetry}
      >
        <ChangesCardBody summary={summary} />
      </SummaryCard>
    </section>
  );
};
