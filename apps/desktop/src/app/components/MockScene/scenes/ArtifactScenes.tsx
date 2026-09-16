import { useEffect, useState } from 'react';
import type { ArtifactId } from '@goodboy/types';
import { ArtifactStudio } from '../../../../features/artifacts/components/ArtifactStudio';
import { CreateReportCta } from '../../../../features/reports/components/CreateReportCta';
import { CreateWireframeCta } from '../../../../features/wireframes/components/CreateWireframeCta';
import {
  REPORT_ARTIFACT_ID,
  SESSION_ID,
  WIREFRAME_HIGH_ARTIFACT_ID,
  WIREFRAME_LOW_ARTIFACT_ID,
  seedArtifactScene,
} from './artifactSeed';

type Props = {
  readonly artifactId: ArtifactId;
};

const ArtifactScene = ({ artifactId }: Props) => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    seedArtifactScene({ focusedArtifactId: artifactId });
    setIsReady(true);
  }, [artifactId]);

  if (!isReady) {
    return null;
  }

  return (
    <main className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
      <div className="flex shrink-0 items-center justify-end gap-1 border-b border-border-soft px-4 py-2">
        <CreateReportCta sessionId={SESSION_ID} />
        <CreateWireframeCta sessionId={SESSION_ID} />
      </div>
      <div className="min-h-0 flex-1">
        <ArtifactStudio sessionId={SESSION_ID} />
      </div>
    </main>
  );
};

export const ArtifactReportScene = () => <ArtifactScene artifactId={REPORT_ARTIFACT_ID} />;

export const ArtifactWireframeLowScene = () => (
  <ArtifactScene artifactId={WIREFRAME_LOW_ARTIFACT_ID} />
);

export const ArtifactWireframeHighScene = () => (
  <ArtifactScene artifactId={WIREFRAME_HIGH_ARTIFACT_ID} />
);
