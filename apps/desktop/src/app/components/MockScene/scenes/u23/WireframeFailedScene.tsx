import { useEffect, useState } from 'react';
import { ArtifactStudio } from '../../../../../features/artifacts/components/ArtifactStudio';
import { SESSION_ID, WIREFRAME_LOW_ARTIFACT_ID, seedArtifactScene } from '../artifactSeed';
import { mockSceneIpc } from '../mockSceneIpc';

const STAGE_FAILURE = "Cannot read properties of undefined (reading 'path')";

export const WireframeFailedScene = () => {
  const [isReady, setIsReady] = useState(false);
  useEffect(() => {
    mockSceneIpc((command) => {
      if (command === 'frame_stage') {
        throw new Error(STAGE_FAILURE);
      }
      return new Promise<never>(() => undefined);
    });
    seedArtifactScene({ focusedArtifactId: WIREFRAME_LOW_ARTIFACT_ID });
    setIsReady(true);
  }, []);
  if (!isReady) {
    return null;
  }
  return (
    <main className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
      <div className="min-h-0 flex-1">
        <ArtifactStudio sessionId={SESSION_ID} />
      </div>
    </main>
  );
};
