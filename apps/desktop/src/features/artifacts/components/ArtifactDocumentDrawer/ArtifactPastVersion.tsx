import { useEffect, useState } from 'react';
import { Button, SkeletonRow, formatError } from '@goodboy/ui';
import type { ArtifactId } from '@goodboy/types';
import type { ArtifactRevision } from '@goodboy/db';
import { listArtifactRevisions } from '../../artifacts';
import { dropLeadingTitleHeading } from '../ArtifactDocument/dropLeadingTitleHeading';
import { ArtifactProse } from '../ArtifactProse';

type Props = {
  readonly artifactId: ArtifactId;
  readonly revision: number;
  readonly latest: number;
  readonly onOpenCurrent: () => void;
};

type LoadState =
  | Readonly<{ kind: 'loading' }>
  | Readonly<{ kind: 'failed'; message: string }>
  | Readonly<{ kind: 'ready'; revision: ArtifactRevision | null }>;

export const ArtifactPastVersion = ({ artifactId, revision, latest, onOpenCurrent }: Props) => {
  const [state, setState] = useState<LoadState>({ kind: 'loading' });

  useEffect(() => {
    let isCurrent = true;
    setState({ kind: 'loading' });
    listArtifactRevisions(artifactId)
      .then((revisions) => {
        if (isCurrent) {
          setState({
            kind: 'ready',
            revision: revisions.find((candidate) => candidate.revision === revision) ?? null,
          });
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
  }, [artifactId, revision]);

  return (
    <div data-testid="plan-drawer-past" className="flex min-w-0 flex-col gap-4">
      <div className="flex min-w-0 items-center justify-between gap-3 rounded-md bg-hover px-3 py-2 text-label text-muted-foreground">
        <span className="min-w-0 truncate">{`Version ${revision}, replaced by v${latest}`}</span>
        <Button variant="ghost" size="sm" onClick={onOpenCurrent}>
          {`Open v${latest}`}
        </Button>
      </div>
      {state.kind === 'loading' ? <SkeletonRow label="Loading version" /> : null}
      {state.kind === 'failed' ? (
        <span role="alert" className="text-meta text-danger">
          {state.message}
        </span>
      ) : null}
      {state.kind === 'ready' && state.revision === null ? (
        <p className="text-label text-muted-foreground">This version is no longer stored.</p>
      ) : null}
      {state.kind === 'ready' && state.revision !== null ? (
        <ArtifactProse
          text={dropLeadingTitleHeading({
            sourceText: state.revision.sourceText,
            title: state.revision.title,
          })}
          measure="full"
        />
      ) : null}
    </div>
  );
};
