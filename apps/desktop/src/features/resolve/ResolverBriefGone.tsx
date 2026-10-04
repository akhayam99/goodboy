import type { ReactNode } from 'react';
import type { MountId, ResolveSourceSnapshot, SessionId } from '@goodboy/types';
import { ReviewerCommentBlock } from './components/ReviewFlow/ReviewerCommentBlock';
import { ResolverCommitLine } from './ResolverCommitLine';
import { RESOLVER_BRIEF_COPY } from './reviewFlowCopy';
import { snapshotCommentThread } from './snapshotCommentThread';

type Props = {
  readonly sessionId: SessionId;
  readonly mountId: MountId | null;
  readonly threadId: string;
  readonly snapshot: ResolveSourceSnapshot | undefined;
  readonly sha: string | null;
  readonly children: ReactNode;
};

export const ResolverBriefGone = ({
  sessionId,
  mountId,
  threadId,
  snapshot,
  sha,
  children,
}: Props) => {
  const comment = snapshotCommentThread({ threadId, snapshot });
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <p className="text-body text-foreground">{RESOLVER_BRIEF_COPY.gone}</p>
      {comment !== null && <ReviewerCommentBlock commentThread={comment} />}
      <ResolverCommitLine sessionId={sessionId} mountId={mountId} sha={sha} isFolded={false} />
      <div className="flex min-w-0 flex-wrap items-center gap-2">{children}</div>
    </div>
  );
};
