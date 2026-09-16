import { useMemo, useState } from 'react';
import { parseWireframeSource } from '@goodboy/core';
import { formatError } from '@goodboy/ui';
import type { SessionId, WireframeArtifact } from '@goodboy/types';
import { useAppStore } from '../../../store';
import { asWireframeFidelity, type WireframeFidelity } from '../wireframeFidelity';
import { deriveWireframeTarget, type WireframeTarget } from '../wireframeTarget';

type Params = Readonly<{
  sessionId: SessionId;
  artifact: WireframeArtifact;
}>;

export type WireframeRespawnHandle = Readonly<{
  fidelity: WireframeFidelity;
  isRespawning: boolean;
  error: string | null;
  respawn: (params: { readonly fidelity: WireframeFidelity }) => void;
}>;

export const useWireframeRespawn = ({ sessionId, artifact }: Params): WireframeRespawnHandle => {
  const spawnWireframeAgent = useAppStore((state) => state.spawnWireframeAgent);
  const kickoff = useAppStore((state) => {
    const events = state.transcripts?.[artifact.agentId] ?? [];
    const first = events.find((event) => event.kind === 'user_text');
    return first?.kind === 'user_text' ? first.text : null;
  });
  const [isRespawning, setIsRespawning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fidelity = asWireframeFidelity({ value: artifact.metadata.fidelity }) ?? 'low';
  const target = useMemo<WireframeTarget>(() => {
    const parsed = parseWireframeSource({ source: artifact.sourceText });
    if (parsed.status !== 'valid') {
      return 'both';
    }
    return deriveWireframeTarget({ screens: parsed.document.screens }) ?? 'both';
  }, [artifact.sourceText]);

  const run = async ({ fidelity: next }: { readonly fidelity: WireframeFidelity }) => {
    if (isRespawning) {
      return;
    }
    setIsRespawning(true);
    setError(null);
    try {
      await spawnWireframeAgent({
        sessionId,
        fidelity: next,
        target,
        workflowRunId: artifact.workflowRunId,
        attachments: [],
        ...(next === fidelity && kickoff !== null ? { evidence: kickoff } : {}),
      });
      window.dispatchEvent(new CustomEvent('goodboy:reveal-chat'));
    } catch (cause) {
      setError(formatError(cause));
    } finally {
      setIsRespawning(false);
    }
  };

  return {
    fidelity,
    isRespawning,
    error,
    respawn: (params) => void run(params),
  };
};
