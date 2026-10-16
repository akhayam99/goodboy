import { EmptyState, PageColumn } from '@goodboy/ui';
import type { Session, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../store';
import { CONCEPT_ICONS } from '../../../shared/components/conceptIcons';
import { SessionDiffPane } from '../../diff/components/SessionDiffPane';
import type { SessionDiff } from '../../diff/hooks/useSessionDiff';
import { WriteReview } from '../../review/components/ReviewPane/WriteReview';
import { BranchBodyColumn } from './BranchBodyColumn';

type Props = {
  readonly session: Session;
  readonly workingDir: string | null;
  readonly worktreePath: string | null;
  readonly diff: SessionDiff;
  readonly hasPullRequest: boolean;
  readonly isReadOnly: boolean;
};

export const BranchFiles = ({
  session,
  workingDir,
  worktreePath,
  diff,
  hasPullRequest,
  isReadOnly,
}: Props) => {
  const sessionId = session.id as SessionId;
  const mode = useAppStore((s) => s.pullRequestModes[sessionId] ?? 'overview');
  if (worktreePath === null) {
    return (
      <PageColumn width="column">
        <EmptyState
          size="page"
          icon={CONCEPT_ICONS.diff}
          title="No worktree for this session"
          description="There is no diff without a checked-out worktree."
        />
      </PageColumn>
    );
  }
  if (mode === 'write_review' && hasPullRequest) {
    return (
      <BranchBodyColumn>
        <WriteReview session={session} />
      </BranchBodyColumn>
    );
  }
  return (
    <BranchBodyColumn>
      <SessionDiffPane
        sessionId={sessionId}
        workingDir={workingDir}
        worktreePath={worktreePath}
        diff={diff}
        isReadOnly={isReadOnly}
      />
    </BranchBodyColumn>
  );
};
