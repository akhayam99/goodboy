import { useMemo } from 'react';
import { parseWireframeSource } from '@goodboy/core';
import type { SessionId, WireframeArtifact } from '@goodboy/types';
import { asWireframeFidelity, type WireframeFidelity } from '../../wireframeFidelity';
import { useWireframeRespawn } from '../../useWireframeRespawn';
import { WireframeIssues } from './WireframeIssues';
import { WireframeWorkspace } from './WireframeWorkspace';

type Props = {
  readonly sessionId: SessionId;
  readonly artifact: WireframeArtifact;
  readonly onScreenChange?: (screenId: string | null) => void;
};

export const WireframeViewer = ({ sessionId, artifact, onScreenChange }: Props) => {
  const parsed = useMemo(
    () => parseWireframeSource({ source: artifact.sourceText }),
    [artifact.sourceText],
  );
  const fidelity: WireframeFidelity =
    asWireframeFidelity({ value: artifact.metadata.fidelity }) ?? 'low';
  const { isRespawning, error, respawn } = useWireframeRespawn({ sessionId, artifact });

  if (parsed.status === 'invalid') {
    return (
      <div data-testid="wireframe-viewer" className="flex min-w-0 flex-col gap-3">
        <WireframeIssues
          issues={parsed.issues}
          sourceText={artifact.sourceText}
          isRepairing={isRespawning}
          onRepair={() => respawn({ fidelity })}
        />
        {error === null ? null : (
          <span role="alert" className="text-secondary text-danger">
            {error}
          </span>
        )}
      </div>
    );
  }

  return (
    <WireframeWorkspace
      sessionId={sessionId}
      artifact={artifact}
      document={parsed.document}
      adjustments={parsed.adjustments}
      {...(onScreenChange === undefined ? {} : { onScreenChange })}
    />
  );
};
