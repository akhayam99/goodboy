import { useMemo, type ReactNode } from 'react';
import { EmptyState } from '@goodboy/ui';
import type { BranchCommit, Session, SessionExternalTask } from '@goodboy/types';
import { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';
import { useAppStore } from '../../../../store';
import type { BranchNextStep } from '../../branchNextStepOf';
import { pullRequestPrefillOf } from '../../pullRequestPrefillOf';
import { BranchConflicts } from './BranchConflicts';
import { NoPullRequest } from './NoPullRequest';

type Props = {
  readonly hostForm: ReactNode;
  readonly session: Session;
  readonly mountPath: string | null;
  readonly branch: string | null;
  readonly step: BranchNextStep;
  readonly configuredBase: string | null;
  readonly commits: ReadonlyArray<BranchCommit>;
  readonly conflictFiles: ReadonlyArray<string>;
  readonly isConnected: boolean;
  readonly onConnected: () => void;
  readonly onCreated: () => void;
};

const NO_TASKS: ReadonlyArray<SessionExternalTask> = [];

export const BranchStartPage = ({
  hostForm,
  session,
  mountPath,
  branch,
  step,
  configuredBase,
  commits,
  conflictFiles,
  isConnected,
  onConnected,
  onCreated,
}: Props) => {
  const tasks = useAppStore((state) => state.sessionExternalTasks[session.id] ?? NO_TASKS);
  const prefill = useMemo(
    () => pullRequestPrefillOf({ commits, tasks, branch }),
    [branch, commits, tasks],
  );
  const isStatusLoaded = step.ahead !== null;
  const main = () => {
    if (step.state === 'conflict') {
      return <BranchConflicts files={conflictFiles} requestNoun="pull request" />;
    }
    if (isStatusLoaded && step.state === 'empty') {
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
      return hostForm;
    }
    return (
      <NoPullRequest
        session={session}
        mountPath={mountPath}
        prefill={prefill}
        defaultBase={configuredBase ?? ''}
        submitVariant={step.submit === 'secondary' ? 'secondary' : 'primary'}
        isRepoMissing={false}
        isConnected={isConnected}
        onConnected={onConnected}
        onCreated={onCreated}
      />
    );
  };
  return (
    <div data-branch-start={step.state} className="@container flex min-w-0 flex-col gap-8">
      {main()}
    </div>
  );
};
