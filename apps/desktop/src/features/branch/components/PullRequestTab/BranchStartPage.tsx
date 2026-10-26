import { useMemo, type ReactNode } from 'react';
import { EmptyState } from '@goodboy/ui';
import type { BranchCommit, FileDiff, Session, SessionExternalTask } from '@goodboy/types';
import { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';
import { useAppStore, type MountDiffStat } from '../../../../store';
import type { BranchTab } from '../../../../store/slices/navigation/types';
import type { BranchNextStep } from '../../branchNextStepOf';
import { pullRequestPrefillOf } from '../../pullRequestPrefillOf';
import { BranchConflicts } from './BranchConflicts';
import { BranchContents } from './BranchContents';
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
  readonly stat: MountDiffStat | null;
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
  stat,
  conflictFiles,
  isConnected,
  onConnected,
  onCreated,
  onSelectTab,
}: Props) => {
  const tasks = useAppStore((state) => state.sessionExternalTasks[session.id] ?? NO_TASKS);
  const prefill = useMemo(
    () => pullRequestPrefillOf({ commits, tasks, branch }),
    [branch, commits, tasks],
  );
  const contents = <BranchContents commits={commits} files={files} stat={stat} />;
  const main = () => {
    if (step.state === 'conflict') {
      return (
        <>
          <BranchConflicts files={conflictFiles} requestNoun="pull request" />
          {contents}
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
          {contents}
        </>
      );
    }
    return (
      <NoPullRequest
        session={session}
        mountPath={mountPath}
        prefill={prefill}
        submitVariant={step.submit === 'secondary' ? 'secondary' : 'primary'}
        trailing={contents}
        isRepoMissing={false}
        isConnected={isConnected}
        onConnected={onConnected}
        onCreated={onCreated}
      />
    );
  };
  return (
    <div data-branch-start={step.state} className="flex min-w-0 flex-col gap-6">
      <PullRequestStatusStrip cells={cells} onOpen={onSelectTab} />
      <div className="flex min-w-0 flex-col gap-8">{main()}</div>
    </div>
  );
};
