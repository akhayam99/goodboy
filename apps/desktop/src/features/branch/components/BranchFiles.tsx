import { useContext } from 'react';
import type { Session, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../store';
import { selectActiveMountId } from '../../../store/slices/project-mounts/selectors';
import { BranchNoProject } from './BranchNoProject';
import { ChangesPage } from '../../diff/components/ChangesPage';
import type { SessionDiff } from '../../diff/hooks/useSessionDiff';
import { useBranchIdentity } from '../hooks/useBranchIdentity';
import { WriteReview } from '../../review/components/WriteReview';
import { filesHeadFactOf } from '../branchTabFactsOf';
import { BranchRailSlotContext } from '../branchRailSlotContext';
import { SessionMediaScope } from '../../../shared/components/SessionMediaScope';
import { BranchBodyColumn } from './BranchBodyColumn';
import { BranchSetupOffer } from './BranchHeader/BranchSetupOffer';

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
  const railSlot = useContext(BranchRailSlotContext);
  const identity = useBranchIdentity({ sessionId });
  const mode = useAppStore((s) => s.pullRequestModes[sessionId] ?? 'overview');
  const activeMountId = useAppStore((state) => selectActiveMountId({ state, sessionId }));
  if (worktreePath === null) {
    return (
      <BranchNoProject
        sessionId={sessionId}
        workspaceId={session.workspaceId}
        size="page"
        thing="files"
      />
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
    <SessionMediaScope sessionId={sessionId} mountId={identity.mount?.mountId ?? null}>
      <ChangesPage
        sessionId={sessionId}
        workingDir={workingDir}
        worktreePath={worktreePath}
        diff={diff}
        isReadOnly={isReadOnly}
        railSlot={railSlot}
        filesFact={filesHeadFactOf({ files: diff.files })}
        commitTotal={commitTotal}
        notice={
          activeMountId === null ? null : (
            <BranchSetupOffer sessionId={sessionId} mountId={activeMountId} layout="row" />
          )
        }
      />
    </SessionMediaScope>
  );
};
