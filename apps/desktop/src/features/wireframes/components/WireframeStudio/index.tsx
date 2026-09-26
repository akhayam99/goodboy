import { useMemo } from 'react';
import { parseWireframeSource } from '@goodboy/core';
import type { SessionId, WireframeArtifact } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { asWireframeFidelity, type WireframeFidelity } from '../../wireframeFidelity';
import { useWireframeRespawn } from '../../useWireframeRespawn';
import { WireframeIssues } from './WireframeIssues';
import { WireframeStudioBody } from './WireframeStudioBody';

type Props = {
  readonly sessionId: SessionId;
  readonly artifact: WireframeArtifact;
  readonly onScreenChange?: (screenId: string | null) => void;
};

export const WireframeStudio = ({ sessionId, artifact, onScreenChange }: Props) => {
  const parsed = useMemo(
    () => parseWireframeSource({ source: artifact.sourceText }),
    [artifact.sourceText],
  );
  const fidelity: WireframeFidelity =
    asWireframeFidelity({ value: artifact.metadata.fidelity }) ?? 'low';
  const { isRespawning, error, respawn } = useWireframeRespawn({ sessionId, artifact });

  if (parsed.status === 'invalid') {
    return (
      <div data-testid="wireframe-studio" className="flex min-w-0 flex-col gap-3">
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
    <WireframeStudioBody
      artifact={artifact}
      fidelity={fidelity}
      document={parsed.document}
      adjustments={parsed.adjustments}
      {...(onScreenChange === undefined ? {} : { onScreenChange })}
    />
  );
};
