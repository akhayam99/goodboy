import type { MountId, SessionId } from '@goodboy/types';
import { ThreadGitSha } from './components/ReviewFlow/ThreadGitSha';
import { useResolverCommit } from './hooks/useResolverCommit';
import { RESOLVER_BRIEF_COPY } from './reviewFlowCopy';

type Props = {
  readonly sessionId: SessionId;
  readonly mountId: MountId | null;
  readonly sha: string | null;
  readonly isFolded: boolean;
};

export const ResolverCommitLine = ({ sessionId, mountId, sha, isFolded }: Props) => {
  const commit = useResolverCommit({ sessionId, mountId, sha });
  if (commit === null) {
    return null;
  }
  return (
    <p className="flex min-w-0 items-center gap-2 text-meta text-muted-foreground">
      <span className="shrink-0">{RESOLVER_BRIEF_COPY.commit}</span>
      <ThreadGitSha sha={commit.sha} />
      {commit.subject !== null && (
        <span className="min-w-0 truncate text-foreground">{commit.subject}</span>
      )}
      {commit.isOnBranch === false && !isFolded && (
        <span className="shrink-0">{RESOLVER_BRIEF_COPY.rewritten}</span>
      )}
    </p>
  );
};
