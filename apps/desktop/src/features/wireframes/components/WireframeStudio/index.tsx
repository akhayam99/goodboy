import { useMemo } from 'react';
import { parseWireframeSource } from '@goodboy/core';
import type { SessionId, WireframeArtifact } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import {
  asWireframeFidelity,
  requestedWireframeFidelity,
  type WireframeFidelity,
} from '../../wireframeFidelity';
import { useWireframeRespawn } from '../../useWireframeRespawn';
import { WireframeIssues } from './WireframeIssues';
import { WireframeProvenanceRow } from './WireframeProvenanceRow';
import { WireframeStudioBody } from './WireframeStudioBody';

type Props = {
  readonly sessionId: SessionId;
  readonly artifact: WireframeArtifact;
};

export const WireframeStudio = ({ sessionId, artifact }: Props) => {
  const parsed = useMemo(
    () => parseWireframeSource({ source: artifact.sourceText }),
    [artifact.sourceText],
  );
  const fidelity: WireframeFidelity =
    asWireframeFidelity({ value: artifact.metadata.fidelity }) ?? 'low';
  const requestedFidelity = useAppStore((state) =>
    requestedWireframeFidelity({
      agentName:
        state.sessionPhaseRuns?.[sessionId]?.find((agent) => agent.id === artifact.agentId)?.name ??
        null,
    }),
  );
  const { isRespawning, error, respawn } = useWireframeRespawn({ sessionId, artifact });

  if (parsed.status === 'invalid') {
    return (
      <div data-testid="wireframe-studio" className="flex min-w-0 flex-col gap-3">
        <WireframeProvenanceRow
          fidelity={fidelity}
          requestedFidelity={requestedFidelity}
          theme={{ name: 'generic' }}
          designProfile={artifact.metadata.designProfile}
        />
        <WireframeIssues
          issues={parsed.issues}
          sourceText={artifact.sourceText}
          isRepairing={isRespawning}
          onRepair={() => respawn({ fidelity })}
        />
        {error === null ? null : (
          <span role="alert" className="text-2xs text-danger">
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
      requestedFidelity={requestedFidelity}
      document={parsed.document}
      adjustments={parsed.adjustments}
    />
  );
};
