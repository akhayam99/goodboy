import { useEffect, useState } from 'react';
import { Button, SkeletonRow } from '@goodboy/ui';
import type { ArtifactId } from '@goodboy/types';
import type { ArtifactRevision } from '@goodboy/db';
import { listArtifactRevisions } from '../../artifacts';
import { dropLeadingTitleHeading } from '../../../../shared/utils/dropLeadingTitleHeading';
import { ArtifactLoadFailed } from '../ArtifactLoadFailed';
import { ArtifactProse } from '../ArtifactProse';

type Props = {
  readonly artifactId: ArtifactId;
  readonly revision: number;
  readonly latest: number;
  readonly onOpenCurrent: () => void;
};

type LoadState =
  | Readonly<{ kind: 'loading' }>
  | Readonly<{ kind: 'failed' }>
  | Readonly<{ kind: 'ready'; revision: ArtifactRevision | null }>;

export const ArtifactPastVersion = ({ artifactId, revision, latest, onOpenCurrent }: Props) => {
  const [state, setState] = useState<LoadState>({ kind: 'loading' });
  const [loadAttempt, setLoadAttempt] = useState(0);

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
      .catch(() => {
        if (isCurrent) {
          setState({ kind: 'failed' });
        }
      });
    return () => {
      isCurrent = false;
    };
  }, [artifactId, revision, loadAttempt]);

  return (
    <div data-testid="plan-drawer-past" className="flex min-w-0 flex-col gap-4">
      <div className="flex min-w-0 items-center justify-between gap-3 rounded-md bg-hover px-3 py-2 text-meta text-muted-foreground">
        <span className="min-w-0 truncate">{`Version ${revision}, replaced by v${latest}`}</span>
        <Button variant="ghost" size="sm" onClick={onOpenCurrent}>
          {`Open v${latest}`}
        </Button>
      </div>
      {state.kind === 'loading' ? <SkeletonRow label="Loading version" /> : null}
      {state.kind === 'failed' ? (
        <ArtifactLoadFailed
          label={`version ${revision}`}
          onRetry={() => setLoadAttempt((attempt) => attempt + 1)}
        />
      ) : null}
      {state.kind === 'ready' && state.revision === null ? (
        <p className="text-meta text-muted-foreground">This version is no longer stored.</p>
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
