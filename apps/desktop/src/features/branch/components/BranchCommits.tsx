import { PageColumn } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../store';
import { selectSessionById } from '../../../store/slices/sessions/selectSessionById';
import { BranchNoProject } from './BranchNoProject';
import { CommitsHistory } from '../../history/components/CommitsHistory';

type Props = {
  readonly sessionId: SessionId;
  readonly worktreePath: string | null;
  readonly isReadOnly: boolean;
};

export const BranchCommits = ({ sessionId, worktreePath, isReadOnly }: Props) => {
  const workspaceId = useAppStore((state) => selectSessionById(state, sessionId)?.workspaceId);
  if (worktreePath === null) {
    if (workspaceId === undefined) {
      return null;
    }
    return (
      <BranchNoProject
        sessionId={sessionId}
        workspaceId={workspaceId}
        size="section"
        thing="commits"
      />
    );
  }
  return (
    <PageColumn width="column" className="flex min-h-0 min-w-0 flex-1 flex-col">
      <CommitsHistory sessionId={sessionId} worktreePath={worktreePath} isReadOnly={isReadOnly} />
    </PageColumn>
  );
};
