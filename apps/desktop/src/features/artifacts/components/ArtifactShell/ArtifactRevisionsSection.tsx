import { useEffect, useState } from 'react';
import { Button, formatError, SectionHeader, SkeletonRow } from '@goodboy/ui';
import type { ArtifactRevision } from '@goodboy/db';
import type { SessionArtifact, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { formatDateTime } from '../../../../shared/utils/time/formatDateTime';
import { listArtifactRevisions } from '../../artifacts';

type Props = {
  readonly sessionId: SessionId;
  readonly artifact: SessionArtifact;
  readonly creatorName: string | null;
};

type LoadState =
  | Readonly<{ kind: 'loading' }>
  | Readonly<{ kind: 'failed'; message: string }>
  | Readonly<{ kind: 'ready'; revisions: ReadonlyArray<ArtifactRevision> }>;

const revisionAuthorLabel = ({
  revision,
  creatorName,
}: {
  readonly revision: ArtifactRevision;
  readonly creatorName: string | null;
}): string => (revision.author === 'agent' ? (creatorName ?? 'Agent') : 'You');

export const ArtifactRevisionsSection = ({ sessionId, artifact, creatorName }: Props) => {
  const [state, setState] = useState<LoadState>({ kind: 'loading' });
  const [restoring, setRestoring] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const restoreArtifactRevision = useAppStore((s) => s.restoreArtifactRevision);

  useEffect(() => {
    let isCurrent = true;
    setState({ kind: 'loading' });
    listArtifactRevisions(artifact.id)
      .then((revisions) => {
        if (isCurrent) {
          setState({ kind: 'ready', revisions });
        }
      })
      .catch((cause: unknown) => {
        if (isCurrent) {
          setState({ kind: 'failed', message: formatError(cause) });
        }
      });
    return () => {
      isCurrent = false;
    };
  }, [artifact.id, artifact.revision]);

  const restore = (revision: number) => {
    setError(null);
    setRestoring(revision);
    restoreArtifactRevision({ sessionId, artifact, revision })
      .catch((cause: unknown) => setError(formatError(cause)))
      .finally(() => setRestoring(null));
  };

  if (state.kind === 'ready' && state.revisions.length <= 1) {
    return null;
  }

  return (
    <section aria-label="Revisions" className="flex min-w-0 flex-col gap-1.5">
      <SectionHeader label="Revisions" />
      {state.kind === 'loading' ? <SkeletonRow label="Loading revisions" /> : null}
      {state.kind === 'failed' ? (
        <span role="alert" className="text-secondary text-danger">
          {state.message}
        </span>
      ) : null}
      {state.kind === 'ready' ? (
        <ol className="flex min-w-0 flex-col gap-1" data-testid="artifact-revisions-list">
          {state.revisions.map((revision) => (
            <li
              key={revision.revision}
              data-testid="artifact-revision-row"
              className="flex min-w-0 items-center gap-2"
            >
              <span className="w-7 shrink-0 tabular-nums text-secondary text-muted-foreground">
                v{revision.revision}
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-body text-foreground">
                  {revisionAuthorLabel({ revision, creatorName })}
                  {revision.ask === null ? '' : ` · ${revision.ask}`}
                </span>
                <span className="truncate text-secondary text-muted-foreground">
                  {formatDateTime({ at: revision.createdAt })}
                </span>
              </span>
              {revision.revision === artifact.revision ? (
                <span className="shrink-0 text-secondary text-muted-foreground">Current</span>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => restore(revision.revision)}
                  isBusy={restoring === revision.revision}
                  data-testid="artifact-revision-restore"
                >
                  Restore
                </Button>
              )}
            </li>
          ))}
        </ol>
      ) : null}
      {error === null ? null : (
        <span role="alert" className="text-secondary text-danger">
          {error}
        </span>
      )}
    </section>
  );
};
