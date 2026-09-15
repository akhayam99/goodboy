import { useEffect, useState, type ReactNode } from 'react';
import type { Agent, ArtifactId, SessionId } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore } from '../../../../store';
import { PlanStudio } from '../../../plans/components/PlanStudio';
import { ArtifactDetail } from './ArtifactDetail';
import { ArtifactRail } from './ArtifactRail';

type Props = {
  readonly sessionId: SessionId;
  readonly eyebrow?: ReactNode;
};

export const ArtifactStudio = ({ sessionId, eyebrow }: Props) => {
  const artifacts = useAppStore((s) => s.sessionArtifacts[sessionId] ?? EMPTY_ARRAY);
  const agents = useAppStore(
    (s) => s.sessionPhaseRuns[sessionId] ?? (EMPTY_ARRAY as ReadonlyArray<Agent>),
  );
  const loadSessionArtifacts = useAppStore((s) => s.loadSessionArtifacts);
  const [focusedArtifactId, setFocusedArtifactId] = useState<ArtifactId | null>(null);

  useEffect(() => {
    void loadSessionArtifacts(sessionId);
  }, [sessionId, loadSessionArtifacts]);

  useEffect(() => {
    setFocusedArtifactId(null);
  }, [sessionId]);

  const standalone = artifacts.filter((artifact) => artifact.kind !== 'plan');
  const selected = standalone.find((artifact) => artifact.id === focusedArtifactId) ?? null;

  if (selected !== null) {
    return (
      <ArtifactDetail
        sessionId={sessionId}
        artifact={selected}
        agents={agents}
        artifacts={artifacts}
        count={artifacts.length}
        onBack={() => setFocusedArtifactId(null)}
      />
    );
  }

  return (
    <PlanStudio
      sessionId={sessionId}
      eyebrow={eyebrow}
      railFooter={
        standalone.length > 0 ? (
          <ArtifactRail artifacts={standalone} onSelect={setFocusedArtifactId} />
        ) : null
      }
    />
  );
};
