import { useMemo, type ReactNode } from 'react';
import { EmptyState } from '@goodboy/ui';
import type { BranchCommit, FileDiff, Session, SessionExternalTask } from '@goodboy/types';
import { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';
import { useAppStore } from '../../../../store';
import type { BranchTab } from '../../../../store/slices/navigation/types';
import type { BranchNextStep } from '../../branchNextStepOf';
import { pullRequestPrefillOf } from '../../pullRequestPrefillOf';
import { useOpenBranchFolder } from '../../hooks/useOpenBranchFolder';
import { BranchConflicts } from './BranchConflicts';
import { BranchSummary } from './BranchSummary';
import { NoPullRequest } from './NoPullRequest';
import { PullRequestStatusStrip } from './PullRequestStatusStrip';
import type { StatusCell } from './statusCell';

type Props = {
  readonly hostForm: ReactNode;
  readonly session: Session;
  readonly mountPath: string | null;
  readonly branch: string | null;
  readonly step: BranchNextStep;
  readonly cells: ReadonlyArray<StatusCell>;
  readonly commits: ReadonlyArray<BranchCommit>;
  readonly files: ReadonlyArray<FileDiff>;
  readonly isDiffLoading: boolean;
  readonly diffError: string | null;
  readonly onRetryDiff: () => void;
  readonly conflictFiles: ReadonlyArray<string>;
  readonly isConnected: boolean;
  readonly onConnected: () => void;
  readonly onCreated: () => void;
  readonly onSelectTab: (tab: BranchTab) => void;
};

const NO_TASKS: ReadonlyArray<SessionExternalTask> = [];

export const BranchStartPage = ({
  hostForm,
  session,
  mountPath,
  branch,
  step,
  cells,
  commits,
  files,
  isDiffLoading,
  diffError,
  onRetryDiff,
  conflictFiles,
  isConnected,
  onConnected,
  onCreated,
  onSelectTab,
}: Props) => {
  const openFolder = useOpenBranchFolder({ sessionId: session.id, onSelectTab });
  const tasks = useAppStore((state) => state.sessionExternalTasks[session.id] ?? NO_TASKS);
  const prefill = useMemo(
    () => pullRequestPrefillOf({ commits, tasks, branch }),
    [branch, commits, tasks],
  );
  const summary = (
    <BranchSummary
      commits={commits}
      files={files}
      isLoading={isDiffLoading}
      error={diffError}
      onRetry={onRetryDiff}
      onOpen={onSelectTab}
      onOpenFolder={openFolder}
    />
  );
  const main = () => {
    if (step.state === 'conflict') {
      return (
        <>
          <BranchConflicts files={conflictFiles} requestNoun="pull request" />
          {summary}
        </>
      );
    }
    if (step.state === 'empty') {
      return (
        <EmptyState
          size="page"
          icon={CONCEPT_ICONS.commits}
          title="No commits on this branch yet"
          description="Commit on this branch to start a pull request"
        />
      );
    }
    if (hostForm !== null) {
      return (
        <>
          {hostForm}
          {summary}
        </>
      );
    }
    return (
      <NoPullRequest
        session={session}
        mountPath={mountPath}
        prefill={prefill}
        submitVariant={step.submit === 'secondary' ? 'secondary' : 'primary'}
        trailing={summary}
        isRepoMissing={false}
        isConnected={isConnected}
        onConnected={onConnected}
        onCreated={onCreated}
      />
    );
  };
  return (
    <div data-branch-start={step.state} className="@container flex min-w-0 flex-col gap-6">
      <PullRequestStatusStrip cells={cells} onOpen={onSelectTab} />
      <div className="flex min-w-0 flex-col gap-8">{main()}</div>
    </div>
  );
};
