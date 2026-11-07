import { EmptyState, PageColumn } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../shared/components/conceptIcons';
import { CommitsHistory } from '../../history/components/CommitsHistory';

type Props = {
  readonly sessionId: SessionId;
  readonly worktreePath: string | null;
  readonly isReadOnly: boolean;
};

export const BranchCommits = ({ sessionId, worktreePath, isReadOnly }: Props) => {
  if (worktreePath === null) {
    return (
      <PageColumn width="column">
        <EmptyState
          size="section"
          tone={CONCEPT_TONE.diff}
          icon={CONCEPT_ICONS.diff}
          title="No branch in this session"
          description="Add a branch to see its commits."
        />
      </PageColumn>
    );
  }
  return (
    <PageColumn width="column" className="flex min-h-0 min-w-0 flex-1 flex-col">
      <CommitsHistory sessionId={sessionId} worktreePath={worktreePath} isReadOnly={isReadOnly} />
    </PageColumn>
  );
};
