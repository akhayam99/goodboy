import { useEffect, useState } from 'react';
import { ArtifactStudio } from '../../../../features/artifacts/components/ArtifactStudio';
import { SESSION_ID } from './artifactSeed';
import { seedPlanCommentsScene } from './artifactCommentsSeed';

export const ArtifactPlanCommentsScene = () => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    seedPlanCommentsScene();
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
