import { Band } from '@goodboy/ui';
import type { MountId, SessionId } from '@goodboy/types';
import { ResolverCommitLine } from '../../ResolverCommitLine';
import type { FixRunCommitsView } from '../../fixRunStatus';
import { FIX_RUN_COPY } from '../../reviewFlowCopy';

export type FixRunCommit = {
  readonly sha: string;
  readonly landedAs: string | null;
};

type Props = {
  readonly sessionId: SessionId;
  readonly mountId: MountId | null;
  readonly view: FixRunCommitsView;
  readonly commits: ReadonlyArray<FixRunCommit>;
};

export const FixRunCommits = ({ sessionId, mountId, view, commits }: Props) => {
  if (view === 'hidden') {
    return null;
  }
  return (
    <Band inset="content" label={FIX_RUN_COPY.commitsHeading} headingLevel={2}>
      {view === 'none' ? (
        <p className="text-body text-muted-foreground">{FIX_RUN_COPY.noCommit}</p>
      ) : (
        commits.map((commit) => (
          <div key={commit.sha} className="flex min-w-0 flex-col gap-0.5">
            <ResolverCommitLine
              sessionId={sessionId}
              mountId={mountId}
              sha={commit.sha}
              isFolded={commit.landedAs !== null}
            />
            {commit.landedAs !== null && (
              <p className="text-meta text-muted-foreground">
                {FIX_RUN_COPY.foldedInto({ sha: commit.landedAs })}
              </p>
            )}
          </div>
        ))
      )}
    </Band>
  );
};
