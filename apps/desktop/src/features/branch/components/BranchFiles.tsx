import { EmptyState, PageColumn } from '@goodboy/ui';
import type { Session, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../store';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../shared/components/conceptIcons';
import { SessionDiffPane } from '../../diff/components/SessionDiffPane';
import type { SessionDiff } from '../../diff/hooks/useSessionDiff';
import { WriteReview } from '../../review/components/ReviewPane/WriteReview';
import { BranchBodyColumn } from './BranchBodyColumn';
import { NotesButton } from './NotesButton';

type Props = {
  readonly session: Session;
  readonly workingDir: string | null;
  readonly worktreePath: string | null;
  readonly diff: SessionDiff;
  readonly hasPullRequest: boolean;
};

export const BranchFiles = ({ session, workingDir, worktreePath, diff, hasPullRequest }: Props) => {
  const sessionId = session.id as SessionId;
  const mode = useAppStore((s) => s.pullRequestModes[sessionId] ?? 'overview');
  const setPullRequestMode = useAppStore((s) => s.setPullRequestMode);
  if (worktreePath === null) {
    return (
      <PageColumn width="column">
        <EmptyState
          size="section"
          tone={CONCEPT_TONE.diff}
          icon={CONCEPT_ICONS.diff}
          title="No worktree for this session"
          description="This session has no checked-out worktree, so there is no diff to show."
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
        onWriteReview={
          hasPullRequest ? () => setPullRequestMode({ sessionId, mode: 'write_review' }) : null
        }
        toolbarExtra={<NotesButton sessionId={sessionId} mountPath={worktreePath} />}
      />
    </BranchBodyColumn>
  );
};
