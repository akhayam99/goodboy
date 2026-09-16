import { useMemo, useState } from 'react';
import { parseWireframeSource } from '@goodboy/core';
import { formatError } from '@goodboy/ui';
import type { SessionId, WireframeArtifact } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { asWireframeFidelity, type WireframeFidelity } from '../../wireframeFidelity';
import { deriveWireframeTarget } from '../../wireframeTarget';
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
  const spawnWireframeAgent = useAppStore((state) => state.spawnWireframeAgent);
  const kickoff = useAppStore((state) => {
    const events = state.transcripts?.[artifact.agentId] ?? [];
    const first = events.find((event) => event.kind === 'user_text');
    return first?.kind === 'user_text' ? first.text : null;
  });
  const [isRespawning, setIsRespawning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const respawn = async (next: WireframeFidelity) => {
    if (isRespawning) {
      return;
    }
    setIsRespawning(true);
    setError(null);
    try {
      await spawnWireframeAgent({
        sessionId,
        fidelity: next,
        target:
          parsed.status === 'valid'
            ? (deriveWireframeTarget({ screens: parsed.document.screens }) ?? 'both')
            : 'both',
        workflowRunId: artifact.workflowRunId,
        ...(next === fidelity && kickoff !== null ? { evidence: kickoff } : {}),
      });
      window.dispatchEvent(new CustomEvent('goodboy:reveal-chat'));
    } catch (cause) {
      setError(formatError(cause));
    } finally {
      setIsRespawning(false);
    }
  };

  if (parsed.status === 'invalid') {
    return (
      <div data-testid="wireframe-studio" className="flex min-w-0 flex-col gap-3">
        <WireframeProvenanceRow
          fidelity={fidelity}
          theme={{ name: 'generic' }}
          designProfile={artifact.metadata.designProfile}
        />
        <WireframeIssues
          issues={parsed.issues}
          sourceText={artifact.sourceText}
          isRepairing={isRespawning}
          onRepair={() => void respawn(fidelity)}
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
      document={parsed.document}
      adjustments={parsed.adjustments}
      isRespawning={isRespawning}
      error={error}
      onRespawn={(next) => void respawn(next)}
    />
  );
};
