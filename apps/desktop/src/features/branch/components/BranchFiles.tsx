import { EmptyState, PageColumn } from '@goodboy/ui';
import type { Session, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../store';
import { CONCEPT_ICONS } from '../../../shared/components/conceptIcons';
import { SessionDiffPane } from '../../diff/components/SessionDiffPane';
import type { SessionDiff } from '../../diff/hooks/useSessionDiff';
import { useBranchIdentity } from '../hooks/useBranchIdentity';
import { WriteReview } from '../../review/components/WriteReview';
import { filesHeadFactOf } from '../branchTabFactsOf';
import { SessionMediaScope } from '../../../shared/components/SessionMediaScope';
import { BranchBodyColumn } from './BranchBodyColumn';

type Props = {
  readonly session: Session;
  readonly workingDir: string | null;
  readonly worktreePath: string | null;
  readonly diff: SessionDiff;
  readonly hasPullRequest: boolean;
  readonly isReadOnly: boolean;
  readonly commitTotal: number | null;
};

export const BranchFiles = ({
  session,
  workingDir,
  worktreePath,
  diff,
  hasPullRequest,
  isReadOnly,
  commitTotal,
}: Props) => {
  const sessionId = session.id as SessionId;
  const identity = useBranchIdentity({ sessionId });
  const mode = useAppStore((s) => s.pullRequestModes[sessionId] ?? 'overview');
  if (worktreePath === null) {
    return (
      <PageColumn width="column">
        <EmptyState
          size="page"
          icon={CONCEPT_ICONS.diff}
          title="No branch in this session"
          description="Add a branch to see its files."
        />
      </PageColumn>
    );
  }
  if (mode === 'write_review' && hasPullRequest) {
    return (
      <BranchBodyColumn>
        <SessionMediaScope sessionId={sessionId} mountId={identity.mount?.mountId ?? null}>
          <WriteReview session={session} />
        </SessionMediaScope>
      </BranchBodyColumn>
    );
  }
  return (
    <BranchBodyColumn>
      <SessionMediaScope sessionId={sessionId} mountId={identity.mount?.mountId ?? null}>
        <SessionDiffPane
          sessionId={sessionId}
          workingDir={workingDir}
          worktreePath={worktreePath}
          diff={diff}
          isReadOnly={isReadOnly}
          filesFact={filesHeadFactOf({ files: diff.files })}
          commitTotal={commitTotal}
        />
      </SessionMediaScope>
    </BranchBodyColumn>
  );
};
